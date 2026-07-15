'use strict';
// The whole pipeline in one go: capture -> cards -> assemble.
//
// Login is deliberately not part of this: it is headed and interactive, and the saved session
// is reused across many runs. Seeding is not part of it either; it is app-specific, so the
// config only names the command and you run it (see the README).

const { chromium, ffmpeg } = require('../deps.cjs');
const capture = require('./capture.cjs');
const cards = require('./cards.cjs');
const assemble = require('./assemble.cjs');

const STEPS = [
    ['capture', capture],
    ['cards', cards],
    ['assemble', assemble],
];

async function run(c) {
    // ⚠️ Preflight every external tool before the first browser opens. Capture is the slow,
    //    stateful step (interactive shots consume seeded data), so discovering a missing
    //    ffmpeg at the assemble step would cost the whole session and a re-seed.
    chromium(c.root);
    ffmpeg();

    let out = null;
    for (const [name, step] of STEPS) {
        console.log(`\n=== ${name} ===`);
        out = await step.run(c);
    }
    return out;
}

module.exports = { run };
