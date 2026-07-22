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

const DEFAULT_TIMEOUT = 20000;
const HANDSHAKE_TIMEOUT = 25000;
const ACTIONS = 'waitFor, click, fill, type, wait, scroll, press';

// Selectors go straight to page.locator(), so CSS plus Playwright's own engines
// ("text=...", "role=button[name=Confirm]") all work without extra config surface.
function pick(page, sel, action) {
    if (!sel) throw new Error(`${action} action needs a "selector"`);
    return page.locator(sel).first();
}

async function runAction(page, a, i) {
    const t = Number(a.timeout || DEFAULT_TIMEOUT);
    switch (a.type) {
        case 'waitFor':
            await pick(page, a.selector, 'waitFor').waitFor({ timeout: t, state: a.state || 'visible' });
            break;
        case 'click':
            await pick(page, a.selector, 'click').click({ timeout: t });
            break;
        case 'fill':
            if (a.value === undefined) throw new Error('fill action needs a "value"');
            await pick(page, a.selector, 'fill').fill(String(a.value), { timeout: t });
            break;
        // ⌨️ Real keystrokes, one per `delay` ms. Two reasons to prefer this over fill: typing
        //    reads on camera instead of text appearing all at once, and debounced autocompletes
        //    only open on genuine key events. It does NOT clear the field first -- pair with
        //    press Meta+a and press Backspace when the field pre-fills.
        case 'type':
            if (a.value === undefined) throw new Error('type action needs a "value"');
            await pick(page, a.selector, 'type').pressSequentially(String(a.value), {
                delay: Number(a.delay || 90),
                timeout: t,
            });
            break;
        case 'press':
            if (!a.key) throw new Error('press action needs a "key"');
            if (a.selector) await pick(page, a.selector, 'press').press(a.key, { timeout: t });
            else await page.keyboard.press(a.key);
            break;
        case 'wait':
            await page.waitForTimeout(Number(a.ms || 1000));
            break;
        case 'scroll':
            if (a.selector) await pick(page, a.selector, 'scroll').scrollIntoViewIfNeeded({ timeout: t });
            else await page.mouse.wheel(Number(a.x || 0), Number(a.y || 300));
            break;
        default:
            throw new Error(`action ${i + 1}: unknown type "${a.type}". Supported: ${ACTIONS}`);
    }
}

// One shot on an already-open page: navigate, survive an auth handshake, run the actions.
async function playShot(page, shot, { baseUrl, hideCss }) {
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

    if (hideCss) await page.addStyleTag({ content: hideCss }).catch(() => {});
    const actions = Array.isArray(shot.actions) ? shot.actions : [];
    for (let i = 0; i < actions.length; i++) await runAction(page, actions[i], i);
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
    const baseUrl = c.req('baseUrl');
    const profileDir = c.get('auth.profile', null);
    const statePath = profileDir ? null : c.resolve(c.req('auth.storageState'));
    const shots = c.req('shots');
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
    const workDir = c.resolve(c.req('output.workDir'));
    const clipsDir = ensureDir(path.join(workDir, 'clips'));

    if (!profileDir && !fs.existsSync(statePath)) {
        fail(`No saved session at ${statePath}\nRun login first:\n  newsreel login --config ${c.file}`);
    }

    const only = typeof c.args.only === 'string' ? c.args.only : null;
    const list = only ? shots.filter((s) => s.id === only) : shots;
    if (only && !list.length) {
        fail(`No shot with id "${only}" in ${c.file}\nAvailable: ${shots.map((s) => s.id).join(', ')}`);
    }

    const launch = chromium(c.root);
    const launchOpts = {
        headless: Boolean(c.args.headless),
        // deliberate pacing so interactions read on camera rather than snapping
        slowMo: Number(c.args['slow-mo'] || 500),
    };
    const home = new URL(baseUrl).origin;

    const results = [];

    if (profileDir) {
        // --- persistent-profile mode: one context, a page per shot ----------------------
        const ctx = await launch.launchPersistentContext(c.resolve(profileDir), {
            ...launchOpts,
            viewport: layoutViewport,
            recordVideo: { dir: clipsDir, size: viewport },
        });
        // The profile opens with a blank page that records too; its video is dropped below.
        const blank = ctx.pages()[0] || null;
        const blankVideo = blank ? blank.video() : null;
        if (blank) await blank.close().catch(() => {});

        const pending = []; // ⚠️ videos only finalize when the CONTEXT closes, so collect after
        let signedOut = false;
        for (const shot of list) {
            const page = await ctx.newPage();
            let status = 'OK';
            try {
                await playShot(page, shot, { baseUrl, hideCss });
            } catch (e) {
                status = `FAIL: ${e.message.split('\n')[0]}`;
            }
            try { if (new URL(page.url()).origin !== home) signedOut = true; } catch { /* mid-nav */ }
            await page.waitForTimeout(1200); // tail so the last state is on screen before the cut
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
                storageState: statePath,
                viewport: layoutViewport,
                recordVideo: { dir: clipsDir, size: viewport },
            });
            const page = await ctx.newPage();

            let status = 'OK';
            try {
                await playShot(page, shot, { baseUrl, hideCss });
            } catch (e) {
                status = `FAIL: ${e.message.split('\n')[0]}`;
            }

            await page.waitForTimeout(1200); // tail so the last state is on screen before the cut
            const video = page.video();
            await ctx.close(); // video is only finalised on context close

            const entry = { id: shot.id, status, video };
            if (video) entry.videoPath = await video.path().catch(() => null);
            results.push(collectVideo(clipsDir, entry));
            console.log(`${shot.id.padEnd(20)} ${status}`);
        }
        await browser.close().catch(() => {});
    }

    const failed = results.filter((r) => r.status !== 'OK');
    console.log(`\nCAPTURE DONE: ${results.length - failed.length}/${results.length} clean -> ${clipsDir}`);
    if (failed.length) {
        console.log(`check: ${failed.map((r) => r.id).join(', ')}`);
        console.log(`redo one with:  newsreel capture --config ${c.file} --only <shotId>`);
    }
    return results;
}

module.exports = { run };
