'use strict';
// Record one webm per shot in the config's shots[].
//
// Reuses the session saved by `login`, drives each shot's actions[], and injects
// capture.hideCss so dev badges/overlays never make it on camera. Adding a shot is a config
// change, not a code change.
//
// Config keys: baseUrl, auth.storageState, auth.profile, capture.viewport, capture.zoom,
//              capture.hideCss, output.workDir,
//              shots[] (id, route, actions[] ({ type: waitFor|click|fill|type|wait|scroll|press, ... }))
//
// Two session modes:
//   - auth.storageState (default): each shot records in a fresh context seeded from the saved
//     state file. Fine for cookie sessions that stay valid at rest.
//   - auth.profile: every shot is a page in ONE persistent Chromium profile. Use this when the
//     auth provider ROTATES tokens on use (Clerk dev instances do): a static state file goes
//     stale after its first handshake, while a real profile absorbs each rotation. Sign in
//     once with `login`; the profile keeps itself valid across runs.
//
// A failing shot is logged and skipped, never fatal: one stale selector must not cost the
// whole run. The assemble command skips clips that did not make it. (Config-shape errors --
// an unknown action type, a missing selector -- are caught at load instead, where they cost a
// second rather than a capture session.)

const fs = require('fs');
const path = require('path');
const { chromium } = require('../deps.cjs');
const { ensureDir, fail } = require('../util.cjs');
const { startVisualsServer, sceneUrl } = require('../visuals.cjs');
const {
    telemetryEnabled, createRecorder, cursorStyleOf,
    SETTLE_BEFORE_MS, SETTLE_AFTER_CLICK_MS,
} = require('../telemetry.cjs');

const DEFAULT_TIMEOUT = 20000;
const HANDSHAKE_TIMEOUT = 25000;
const ACTIONS = 'waitFor, click, dblclick, fill, type, wait, scroll, press';

// Selectors go straight to page.locator(), so CSS plus Playwright's own engines
// ("text=...", "role=button[name=Confirm]") all work without extra config surface.
function pick(page, sel, action) {
    if (!sel) throw new Error(`${action} action needs a "selector"`);
    return page.locator(sel).first();
}

// 🎥 Telemetry preamble for a targeted action: resolve the element's box, settle so the
//    transit reads on camera, then drive the pointer to a jittered point inside it along a
//    synthesized eased path (recorded verbatim -- ground truth by construction). Returns the
//    box, or null when the element could not be measured; a missing box degrades gracefully
//    everywhere downstream (the planner falls back to the click point).
async function transitTo(page, tel, locator, reason) {
    let box = null;
    try { box = await locator.boundingBox(); } catch { /* detached mid-animation */ }
    await page.waitForTimeout(SETTLE_BEFORE_MS);
    if (box) await tel.driveTransit(page, tel.jitteredCenter(box), reason);
    return box;
}

async function runAction(page, a, i, tel = null) {
    const t = Number(a.timeout || DEFAULT_TIMEOUT);
    switch (a.type) {
        case 'waitFor': {
            const loc = pick(page, a.selector, 'waitFor');
            const t0 = tel ? tel.now() : 0;
            await loc.waitFor({ timeout: t, state: a.state || 'visible' });
            if (tel) {
                let box = null;
                try { box = await loc.boundingBox(); } catch { /* hidden states have no box */ }
                tel.waitFor({ selector: a.selector, box, state: a.state || 'visible', t: t0, settledT: tel.now() });
            }
            break;
        }
        case 'click':
        case 'dblclick': {
            const loc = pick(page, a.selector, a.type);
            const count = a.type === 'dblclick' ? 2 : 1;
            if (tel) {
                const box = await transitTo(page, tel, loc, 'click');
                const cursorStyle = await cursorStyleOf(loc);   // before the click: it may navigate
                const at = tel.now();
                if (count === 2) await loc.dblclick({ timeout: t });
                else await loc.click({ timeout: t });
                tel.click({ selector: a.selector, box, count, cursorStyle, t: at });
                await page.waitForTimeout(SETTLE_AFTER_CLICK_MS);
            } else if (count === 2) {
                await loc.dblclick({ timeout: t });
            } else {
                await loc.click({ timeout: t });
            }
            break;
        }
        case 'fill': {
            if (a.value === undefined) throw new Error('fill action needs a "value"');
            const loc = pick(page, a.selector, 'fill');
            if (tel) {
                const box = await transitTo(page, tel, loc, 'fill');
                const at = tel.now();
                await loc.fill(String(a.value), { timeout: t });
                tel.fill({ selector: a.selector, box, text: String(a.value), t: at });
            } else {
                await loc.fill(String(a.value), { timeout: t });
            }
            break;
        }
        // 📎 Attach a file. Selector may be the <input type=file> itself, or any button
        //    that opens the OS file chooser (we intercept the chooser event). `file` resolves
        //    against the working directory (where npx newsreel runs).
        case 'upload': {
            if (!a.file) throw new Error('upload action needs a "file"');
            const filePath = path.isAbsolute(a.file) ? a.file : path.resolve(process.cwd(), a.file);
            if (!fs.existsSync(filePath)) throw new Error(`upload file not found: ${filePath}`);
            const loc = pick(page, a.selector, 'upload');
            const tag = await loc.evaluate((el) => `${el.tagName}:${el.type || ''}`).catch(() => '');
            if (/^INPUT:file$/i.test(tag)) {
                await loc.setInputFiles(filePath, { timeout: t });
            } else {
                const chooser = page.waitForEvent('filechooser', { timeout: t });
                if (tel) {
                    const box = await transitTo(page, tel, loc, 'click');
                    const cursorStyle = await cursorStyleOf(loc);
                    const at = tel.now();
                    await loc.click({ timeout: t });
                    tel.click({ selector: a.selector, box, count: 1, cursorStyle, t: at });
                } else {
                    await loc.click({ timeout: t });
                }
                await (await chooser).setFiles(filePath);
            }
            await page.waitForTimeout(SETTLE_AFTER_CLICK_MS);
            break;
        }
        // ⌨️ Real keystrokes, one per `delay` ms. Two reasons to prefer this over fill: typing
        //    reads on camera instead of text appearing all at once, and debounced autocompletes
        //    only open on genuine key events. It does NOT clear the field first -- pair with
        //    press Meta+a and press Backspace when the field pre-fills.
        case 'type': {
            if (a.value === undefined) throw new Error('type action needs a "value"');
            const loc = pick(page, a.selector, 'type');
            const delay = Number(a.delay || 90);
            if (tel) {
                // Equivalent semantics to pressSequentially (focus first, per-key events,
                // never clears the field), unrolled so each key's timestamp is ground truth.
                const box = await transitTo(page, tel, loc, 'type');
                await loc.focus({ timeout: t });
                const t0 = tel.now();
                const keys = [];
                const chars = Array.from(String(a.value));
                for (let k = 0; k < chars.length; k++) {
                    keys.push({ t: tel.now(), key: chars[k] });
                    await page.keyboard.type(chars[k]);
                    if (k < chars.length - 1) await page.waitForTimeout(delay);
                }
                tel.typeBurst({ selector: a.selector, box, text: String(a.value), keys, t0, t1: tel.now() });
            } else {
                await loc.pressSequentially(String(a.value), { delay, timeout: t });
            }
            break;
        }
        case 'press': {
            if (!a.key) throw new Error('press action needs a "key"');
            if (a.selector) {
                const loc = pick(page, a.selector, 'press');
                const box = tel ? await transitTo(page, tel, loc, 'press') : null;
                const at = tel ? tel.now() : 0;
                await loc.press(a.key, { timeout: t });
                if (tel) tel.keyChord({ combo: a.key, selector: a.selector, box, t: at });
            } else {
                const at = tel ? tel.now() : 0;
                await page.keyboard.press(a.key);
                if (tel) tel.keyChord({ combo: a.key, t: at });
            }
            break;
        }
        case 'wait':
            await page.waitForTimeout(Number(a.ms || 1000));
            break;
        case 'scroll': {
            if (a.selector) {
                const loc = pick(page, a.selector, 'scroll');
                const box = tel ? await transitTo(page, tel, loc, 'scroll') : null;
                const t0 = tel ? tel.now() : 0;
                await loc.scrollIntoViewIfNeeded({ timeout: t });
                if (tel) tel.scroll({ selector: a.selector, box, t0, t1: tel.now() });
            } else {
                const delta = [Number(a.x || 0), Number(a.y || 300)];
                const t0 = tel ? tel.now() : 0;
                await page.mouse.wheel(delta[0], delta[1]);
                if (tel) tel.scroll({ delta, t0 });
            }
            break;
        }
        default:
            throw new Error(`action ${i + 1}: unknown type "${a.type}". Supported: ${ACTIONS}`);
    }
}

// One shot on an already-open page: navigate, survive an auth handshake, run the actions.
async function playShot(page, shot, { baseUrl, hideCss, tel = null }) {
    if (hideCss) page.on('load', () => page.addStyleTag({ content: hideCss }).catch(() => {}));
    await page.goto(new URL(shot.route, baseUrl).toString(), { waitUntil: 'domcontentloaded' });

    // ♻️ Auth handshake grace: some providers bounce a valid session through their own origin
    //    and back (Clerk dev instances redirect via accounts.dev with a token in the URL).
    //    The round-trip completes on its own -- re-navigating restarts it -- so when the page
    //    lands off-origin, wait for it to come home before declaring the shot broken.
    const home = new URL(baseUrl).origin;
    if (new URL(page.url()).origin !== home) {
        await page.waitForURL((u) => u.origin === home, { timeout: HANDSHAKE_TIMEOUT })
            .catch(() => { /* actions will report against whatever page this is */ });
    }

    if (tel) {
        tel.navSettled();
        // park: put the real pointer where the sidecar's `start` says it is, so the cursor
        // track begins at a known point instead of Playwright's (0,0)
        const park = tel.toPx(tel.pointer);
        await page.mouse.move(park.x, park.y).catch(() => { /* parking is best-effort */ });
    }

    if (hideCss) await page.addStyleTag({ content: hideCss }).catch(() => {});
    const actions = Array.isArray(shot.actions) ? shot.actions : [];
    for (let i = 0; i < actions.length; i++) await runAction(page, actions[i], i, tel);
}

// One GENERATED shot: the harness page mounts the scene, flags readiness, and the
// page simply stays on camera for the shot's duration while the scene self-drives.
// Timeline beats (optional) call into the scene's action bus at their offsets.
const GENERATED_READY_TIMEOUT = 20000;
async function playGeneratedShot(page, shot, visualsBase) {
    await page.goto(sceneUrl(visualsBase, shot), { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(
        () => window.__NEWSREEL_READY__ === true || window.__NEWSREEL_ERROR__,
        null,
        { timeout: Number(shot.readyTimeout || GENERATED_READY_TIMEOUT) },
    );
    const err = await page.evaluate(() => window.__NEWSREEL_ERROR__ || null);
    if (err) throw new Error(`scene "${shot.scene}": ${err}`);

    const duration = Number(shot.duration || 6) * 1000;
    const beats = (Array.isArray(shot.timeline) ? shot.timeline : [])
        .slice()
        .sort((a, b) => Number(a.at) - Number(b.at));
    let clock = 0;
    for (const b of beats) {
        const at = Math.max(0, Math.min(Number(b.at) * 1000, duration));
        if (at > clock) await page.waitForTimeout(at - clock);
        clock = at;
        await page.evaluate(
            ([name, args]) => window.__NEWSREEL_ACTION__ && window.__NEWSREEL_ACTION__(name, args),
            [String(b.action), b.args],
        ).catch(() => { /* a missed beat should not kill the take */ });
    }
    if (duration > clock) await page.waitForTimeout(duration - clock);
}

// A finalized recording -> <clipsDir>/<id>.webm. Only valid after the owning context closed.
function collectVideo(clipsDir, entry) {
    let dest = null;
    if (entry.video) {
        try {
            dest = path.join(clipsDir, `${entry.id}.webm`);
            fs.rmSync(dest, { force: true });
            fs.renameSync(entry.videoPath, dest);
        } catch (e) {
            entry.status += ` (video not saved: ${e.message})`;
            dest = null;
        }
    } else {
        entry.status += ' (no video recorded)';
    }
    return { id: entry.id, status: entry.status, dest };
}

async function run(c) {
    const shots = c.req('shots');
    // An all-generated video records from the packaged harness and never opens the app, so it
    // needs no baseUrl, no saved session and no login. Asking for credentials to film nothing
    // is the first wall a newcomer hits, and it is entirely avoidable.
    const filmsApp = shots.some((s) => s.type !== 'generated');
    const baseUrl = filmsApp ? c.req('baseUrl') : null;
    const profileDir = filmsApp ? c.get('auth.profile', null) : null;
    const statePath = filmsApp && !profileDir ? c.resolve(c.req('auth.storageState')) : null;
    const viewport = c.get('capture.viewport', { width: 1440, height: 900 });
    // 🔍 capture.zoom reproduces BROWSER zoom (Cmd-minus), not CSS zoom: at 0.8 the page
    //    lays out in a 1/0.8 larger viewport and the recording scales it back down to the
    //    configured size, so more UI fits and everything shrinks proportionally. CSS zoom
    //    was tried first and breaks fixed/sticky layouts; layout-viewport scaling doesn't.
    const zoom = Number(c.get('capture.zoom', 1));
    const even = (v) => v - (v % 2);
    const layoutViewport = zoom && zoom !== 1
        ? { width: even(Math.round(viewport.width / zoom)), height: even(Math.round(viewport.height / zoom)) }
        : viewport;
    const hideCss = c.get('capture.hideCss', '');
    // 📐 capture.supersample records at N x the viewport (deviceScaleFactor N + a scaled
    //    recordVideo size) so the cinema camera magnifies REAL pixels instead of upscaling.
    //    Layout is untouched: CSS still sees layoutViewport. Costs ~N^2 in capture encode.
    const supersample = Math.max(1, Math.min(3, Number(c.get('capture.supersample', 1)) || 1));
    const recordSize = supersample !== 1
        ? { width: even(Math.round(viewport.width * supersample)), height: even(Math.round(viewport.height * supersample)) }
        : viewport;
    if (supersample !== 1) console.log(`supersample: recording at ${recordSize.width}x${recordSize.height} (${supersample}x)`);
    const workDir = c.resolve(c.req('output.workDir'));
    const clipsDir = ensureDir(path.join(workDir, 'clips'));

    if (filmsApp && !profileDir && !fs.existsSync(statePath)) {
        fail(`No saved session at ${statePath}\nRun login first:\n  newsreel login --config ${c.file}`);
    }

    const only = typeof c.args.only === 'string' ? c.args.only : null;
    const list = only ? shots.filter((s) => s.id === only) : shots;
    if (only && !list.length) {
        fail(`No shot with id "${only}" in ${c.file}\nAvailable: ${shots.map((s) => s.id).join(', ')}`);
    }

    // 🎥 Telemetry (the cinema sidecar) turns on iff a cinema config key exists or
    //    capture.telemetry forces it. Under telemetry the uniform slowMo is replaced by
    //    designed pacing (eased transits, settles around clicks): slowMo would otherwise
    //    multiply across every per-sample mouse.move. An explicit --slow-mo still wins.
    const wantTelemetry = telemetryEnabled(c);
    if (wantTelemetry) console.log('telemetry: recording events sidecars (cinema)');

    const launch = chromium(c.root);
    const launchOpts = {
        headless: Boolean(c.args.headless),
        // deliberate pacing so interactions read on camera rather than snapping
        slowMo: c.args['slow-mo'] !== undefined
            ? Number(c.args['slow-mo'])
            : (wantTelemetry ? 0 : 500),
    };
    const home = baseUrl ? new URL(baseUrl).origin : null;

    // Generated shots record from the packaged harness instead of the app; the
    // static server exists only while the run needs it.
    let visuals = null;
    if (list.some((s) => s.type === 'generated')) {
        visuals = await startVisualsServer();
    }
    // Generated shots are never instrumented: they are self-driving full compositions.
    const recorderFor = (shot) => (wantTelemetry && shot.type !== 'generated'
        ? createRecorder({ shot: shot.id, viewport, layoutViewport, captureZoom: zoom })
        : null);
    const playAny = (page, shot, tel) => (shot.type === 'generated'
        ? playGeneratedShot(page, shot, visuals.url)
        : playShot(page, shot, { baseUrl, hideCss, tel }));

    const results = [];

    if (profileDir) {
        // --- persistent-profile mode: one context, a page per shot ----------------------
        const ctx = await launch.launchPersistentContext(c.resolve(profileDir), {
            ...launchOpts,
            viewport: layoutViewport,
            deviceScaleFactor: supersample,
            recordVideo: { dir: clipsDir, size: recordSize },
        });
        // The profile opens with a blank page that records too; its video is dropped below.
        const blank = ctx.pages()[0] || null;
        const blankVideo = blank ? blank.video() : null;
        if (blank) await blank.close().catch(() => {});

        const pending = []; // ⚠️ videos only finalize when the CONTEXT closes, so collect after
        let signedOut = false;
        for (const shot of list) {
            const page = await ctx.newPage();
            const tel = recorderFor(shot);
            if (tel) tel.start();   // t=0 == page open == recordVideo start
            let status = 'OK';
            try {
                await playAny(page, shot, tel);
            } catch (e) {
                status = `FAIL: ${e.message.split('\n')[0]}`;
            }
            try {
                if (shot.type !== 'generated' && new URL(page.url()).origin !== home) signedOut = true;
            } catch { /* mid-nav */ }
            if (tel) tel.settle();  // the planner may start its release here
            await page.waitForTimeout(1200); // tail so the last state is on screen before the cut
            if (tel) tel.flush(clipsDir);
            const video = page.video();
            await page.close().catch(() => {});
            pending.push({ id: shot.id, status, video });
            console.log(`${shot.id.padEnd(20)} ${status}`);
        }
        await ctx.close(); // finalizes every recording

        for (const p of pending) {
            if (p.video) p.videoPath = await p.video.path().catch(() => null);
            results.push(collectVideo(clipsDir, p));
        }
        if (blankVideo) await blankVideo.delete().catch(() => {});
        if (signedOut) {
            console.log(`\nA shot ended on the sign-in page: the profile has no session.\n` +
                `Sign in once:  newsreel login --config ${c.file}`);
        }
    } else {
        // --- storage-state mode: a fresh context per shot -------------------------------
        const browser = await launch.launch(launchOpts);
        for (const shot of list) {
            const ctx = await browser.newContext({
                // omitted, not null: an all-generated run has no session to seed from
                ...(statePath && { storageState: statePath }),
                viewport: layoutViewport,
                deviceScaleFactor: supersample,
                recordVideo: { dir: clipsDir, size: recordSize },
            });
            const page = await ctx.newPage();
            const tel = recorderFor(shot);
            if (tel) tel.start();   // t=0 == page open == recordVideo start

            let status = 'OK';
            try {
                await playAny(page, shot, tel);
            } catch (e) {
                status = `FAIL: ${e.message.split('\n')[0]}`;
            }

            if (tel) tel.settle();  // the planner may start its release here
            await page.waitForTimeout(1200); // tail so the last state is on screen before the cut
            if (tel) tel.flush(clipsDir);
            const video = page.video();
            await ctx.close(); // video is only finalised on context close

            const entry = { id: shot.id, status, video };
            if (video) entry.videoPath = await video.path().catch(() => null);
            results.push(collectVideo(clipsDir, entry));
            console.log(`${shot.id.padEnd(20)} ${status}`);
        }
        await browser.close().catch(() => {});
    }

    if (visuals) await visuals.close();

    const failed = results.filter((r) => r.status !== 'OK');
    console.log(`\nCAPTURE DONE: ${results.length - failed.length}/${results.length} clean -> ${clipsDir}`);
    if (failed.length) {
        console.log(`check: ${failed.map((r) => r.id).join(', ')}`);
        console.log(`redo one with:  newsreel capture --config ${c.file} --only <shotId>`);
    }
    return results;
}

module.exports = { run, runAction };
