'use strict';
// Debug one shot's camera pass without a full assemble.
//
//   newsreel cinema --config ./newsreel.config.json [--only <shotId>]
//
// Renders the pass at the clip's own length and speed 1 (no narration involved), prints the
// plan path so the segments can be read and edited, and leaves the result in
// <workDir>/cinema/. Nothing this command writes is consumed by assemble -- the pass there
// re-runs against the real section timing -- but the cache is shared, so a debugged shot at
// the same timing costs nothing the second time.

const fs = require('fs');
const path = require('path');
const { ffmpeg } = require('../deps.cjs');
const { fail } = require('../util.cjs');
const { renderPasses, cameraFor } = require('./../camera/render.cjs');
const { firstContentTime } = require('./assemble.cjs');

const FPS = 30;

async function run(c) {
    const ff = ffmpeg();
    const { width: W, height: H } = c.get('capture.viewport', { width: 1440, height: 900 });
    const workDir = c.resolve(c.req('output.workDir'));
    const clipsDir = path.join(workDir, 'clips');
    const shots = c.req('shots').filter((s) => s.type !== 'generated');

    const only = typeof c.args.only === 'string' ? c.args.only : null;
    let pick = only
        ? shots.find((s) => s.id === only)
        : shots.find((s) => cameraFor(c, s.camera)) || shots[0];
    if (!pick) fail(only ? `No shot with id "${only}".` : 'No captured shots in the config.');
    if (!cameraFor(c, pick.camera)) {
        fail(`Shot "${pick.id}" has no camera enabled.\n` +
            `Set "video": { "camera": { "mode": "auto" } } or "camera": "auto" on the shot.`);
    }

    const src = path.join(clipsDir, `${pick.id}.webm`);
    if (!fs.existsSync(src)) {
        fail(`No clip at ${src}\nRun capture first:  newsreel capture --config ${c.file} --only ${pick.id}`);
    }

    const clipStart = Math.max(firstContentTime(ff, src), Number(pick.trimBefore) || 0);
    const clipDur = Math.max(0.2, ff.duration(src) - clipStart);
    const section = {
        name: pick.id, type: 'clip', src,
        camera: pick.camera,
        clipStart, speed: 1, dur: clipDur, clipDur,
    };

    console.log(`cinema: ${pick.id}  (${clipDur.toFixed(2)}s after trim @${clipStart.toFixed(2)}s)`);
    const n = await renderPasses({ c, ff, sections: [section], W, H, fps: FPS, workDir });
    if (!n) fail('The pass did not run; see the message above.');

    console.log(`\nplan:   ${path.join(workDir, 'cinema', `${pick.id}.camera.json`)}`);
    console.log(`render: ${section.src}`);
    console.log('\nEdit the plan\'s segments into the shot as an override to pin them:');
    console.log(`  "shots": [{ "id": "${pick.id}", "camera": { "segments": [ ... ] } }]`);
}

module.exports = { run };
