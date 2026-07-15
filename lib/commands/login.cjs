'use strict';
// Save an authenticated browser session for the capture run.
//
// Opens a headed browser at baseUrl + auth.loginPath; you log in by hand; once auth.readyPath
// loads, the storage state is written to auth.storageState. There is no login automation on
// purpose: that keeps the pipeline agnostic to the auth provider (Clerk, Auth0, sessions, ...).
//
// Config keys: baseUrl, auth.loginPath, auth.readyPath, auth.storageState, capture.viewport

const path = require('path');
const { chromium } = require('../deps.cjs');
const { ensureDir } = require('../util.cjs');

async function run(c) {
    const baseUrl = c.req('baseUrl');
    const loginPath = c.req('auth.loginPath');
    const readyPath = c.req('auth.readyPath');
    const statePath = c.resolve(c.req('auth.storageState'));
    const viewport = c.get('capture.viewport', { width: 1440, height: 900 });
    const timeoutSec = Number(c.args.timeout || 480);

    ensureDir(path.dirname(statePath));

    const launch = chromium(c.root);
    const browser = await launch.launch({ headless: false });
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();

    const loginUrl = new URL(loginPath, baseUrl).toString();
    console.log(`opening ${loginUrl}`);
    console.log(`log in by hand; waiting for ${readyPath} (up to ${timeoutSec}s)`);
    await page.goto(loginUrl, { waitUntil: 'domcontentloaded' }).catch((e) => {
        console.error(`could not open ${loginUrl}: ${e.message}`);
        console.error('is the app running at baseUrl?');
    });

    // 🔒 Poll rather than waitForURL: the user may bounce through several provider pages,
    //    and any of them can navigate out from under a single waiter.
    const deadline = Date.now() + timeoutSec * 1000;
    let ok = false;
    while (Date.now() < deadline) {
        let here = '';
        try { here = page.url(); } catch { /* page mid-navigation */ }
        if (here && new URL(here, baseUrl).pathname.startsWith(readyPath)) {
            // let the authed page settle so every cookie/token is committed before we save
            await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
            await page.waitForTimeout(1000);
            ok = true;
            break;
        }
        await page.waitForTimeout(2000);
    }

    if (ok) {
        await context.storageState({ path: statePath });
        console.log(`AUTH_SAVED -> ${statePath}`);
    } else {
        console.error(`TIMEOUT: never reached ${readyPath} within ${timeoutSec}s. Nothing saved.`);
    }

    await browser.close().catch(() => {});
    // A timeout is a real failure (nothing was saved) but not a misconfiguration, so it exits
    // non-zero without the fail() banner.
    if (!ok) process.exitCode = 1;
    return ok;
}

module.exports = { run };
