'use strict';
// Record one webm per shot in the config's shots[].
//
// Reuses the session saved by `login`, drives each shot's actions[], and injects
// capture.hideCss so dev badges/overlays never make it on camera. Adding a shot is a config
// change, not a code change.
//
// Config keys: baseUrl, auth.storageState, capture.viewport, capture.hideCss, output.workDir,
//              shots[] (id, route, actions[] ({ type: waitFor|click|fill|wait|scroll|press, ... }))
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
const ACTIONS = 'waitFor, click, fill, wait, scroll, press';

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

async function run(c) {
    const baseUrl = c.req('baseUrl');
    const statePath = c.resolve(c.req('auth.storageState'));
    const shots = c.req('shots');
    const viewport = c.get('capture.viewport', { width: 1440, height: 900 });
    // 🔍 capture.zoom < 1 zooms the PAGE out (CSS zoom on :root), fitting more UI into
    //    the same viewport. Injected with hideCss so it applies on every navigation.
    const zoom = Number(c.get('capture.zoom', 1));
    const zoomCss = zoom && zoom !== 1 ? `:root { zoom: ${zoom}; }` : '';
    const hideCss = [c.get('capture.hideCss', ''), zoomCss].filter(Boolean).join('\n');
    const workDir = c.resolve(c.req('output.workDir'));
    const clipsDir = ensureDir(path.join(workDir, 'clips'));

    if (!fs.existsSync(statePath)) {
        fail(`No saved session at ${statePath}\nRun login first:\n  newsreel login --config ${c.file}`);
    }

    const only = typeof c.args.only === 'string' ? c.args.only : null;
    const list = only ? shots.filter((s) => s.id === only) : shots;
    if (only && !list.length) {
        fail(`No shot with id "${only}" in ${c.file}\nAvailable: ${shots.map((s) => s.id).join(', ')}`);
    }

    const launch = chromium(c.root);
    const browser = await launch.launch({
        headless: Boolean(c.args.headless),
        // deliberate pacing so interactions read on camera rather than snapping
        slowMo: Number(c.args['slow-mo'] || 500),
    });

    const results = [];
    for (const shot of list) {
        const ctx = await browser.newContext({
            storageState: statePath,
            viewport,
            recordVideo: { dir: clipsDir, size: viewport },
        });
        const page = await ctx.newPage();
        if (hideCss) page.on('load', () => page.addStyleTag({ content: hideCss }).catch(() => {}));

        let status = 'OK';
        try {
            await page.goto(new URL(shot.route, baseUrl).toString(), { waitUntil: 'domcontentloaded' });
            if (hideCss) await page.addStyleTag({ content: hideCss }).catch(() => {});
            const actions = Array.isArray(shot.actions) ? shot.actions : [];
            for (let i = 0; i < actions.length; i++) await runAction(page, actions[i], i);
        } catch (e) {
            status = `FAIL: ${e.message.split('\n')[0]}`;
        }

        await page.waitForTimeout(1200); // tail so the last state is on screen before the cut
        const video = page.video();
        await ctx.close(); // video is only finalised on context close

        let dest = null;
        if (video) {
            try {
                dest = path.join(clipsDir, `${shot.id}.webm`);
                fs.rmSync(dest, { force: true });
                fs.renameSync(await video.path(), dest);
            } catch (e) {
                status += ` (video not saved: ${e.message})`;
                dest = null;
            }
        } else {
            status += ' (no video recorded)';
        }
        results.push({ id: shot.id, status, dest });
        console.log(`${shot.id.padEnd(20)} ${status}`);
    }

    await browser.close().catch(() => {});

    const failed = results.filter((r) => r.status !== 'OK');
    console.log(`\nCAPTURE DONE: ${results.length - failed.length}/${results.length} clean -> ${clipsDir}`);
    if (failed.length) {
        console.log(`check: ${failed.map((r) => r.id).join(', ')}`);
        console.log(`redo one with:  newsreel capture --config ${c.file} --only <shotId>`);
    }
    return results;
}

module.exports = { run };
