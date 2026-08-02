'use strict';
// Compose the demo video with Remotion: animated cards, animated lower-thirds, Ken Burns
// motion with a real ease back out, and a freeze on each clip's final state. This is the
// rich renderer; `assemble` remains the light ffmpeg path (no npm install, runs anywhere).
//
// Config keys: project, output.{workDir,videoDir}, capture.viewport, voice.*, music.*,
//              video.{title,narration,maxSpeed,thumbnail}, compose.{palette,tailSeconds},
//              shots[] (id, narration, caption, tag, motion, trimBefore, speed),
//              closingCard.{title,lines,narration}
//
// How it works: a Remotion project template ships inside this package. Compose copies it
// into <workDir>/remotion (node_modules survive between runs), regenerates src/data.json
// with every measured duration, drops clips + narration + the music bed into public/, and
// runs `npx remotion render`. The project is generated output: edit the config and re-run
// compose, never the project.
//
// Timing model (same idea as assemble, tuned for motion):
//   - a section lasts its narration plus compose.tailSeconds (default 1.0)
//   - a clip speeds up (never above video.maxSpeed) to fit; if it is still shorter, the
//     scene freezes on its last frame rather than crawling below 1x -- typed input and
//     cursor movement read best at natural speed
//   - the blank page-load lead is trimmed via the same detector assemble uses; a shot can
//     override with trimBefore (seconds) when the lead is a spinner rather than a blank
//     (structure fools the detector; a number never does)

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { ffmpeg } = require('../deps.cjs');
const { ensureDir, stamp, fail } = require('../util.cjs');
const { voiceSetup } = require('../voice/index.cjs');
const { musicSetup, musicBed } = require('../music/index.cjs');
const { narrate } = require('../narrate.cjs');
const { renderPasses } = require('../camera/render.cjs');
const { resolvePalette, paletteIds } = require('../palettes.cjs');
const { firstContentTime } = require('./assemble.cjs');

const FPS = 30;
const VOICE_DELAY_FRAMES = 8;
const OUT_NAME = 'launch-video.mp4';

function buildSections(c, clipsDir) {
    const project = c.req('project');
    const shots = c.req('shots');
    const sections = [];

    sections.push({
        kind: 'card',
        name: '_title',
        kicker: project,
        title: c.get('video.title', 'What shipped this week'),
        bullets: shots.map((s) => s.caption).filter(Boolean).slice(0, 4),
        vo: c.get('video.narration', c.get('video.title', 'What shipped this week')),
    });

    for (const s of shots) {
        const clip = path.join(clipsDir, `${s.id}.webm`);
        if (!fs.existsSync(clip)) {
            console.warn(`WARN: no clip for shot "${s.id}" (${clip}); skipping. ` +
                `Re-run:  newsreel capture --config ${c.file} --only ${s.id}`);
            continue;
        }
        sections.push({
            kind: 'shot',
            name: s.id,
            clip,
            vo: s.narration || s.caption || '',
            tag: s.tag || s.id,
            caption: s.caption || '',
            motion: s.motion || null,
            trimBefore: s.trimBefore,
            speed: s.speed,
            camera: s.camera,
            generated: s.type === 'generated',
        });
    }
    if (sections.length < 2) fail(`No usable clips in ${clipsDir}. Run capture first.`);

    const closing = c.get('closingCard');
    if (closing && closing.title) {
        const lines = Array.isArray(closing.lines) ? closing.lines : [];
        sections.push({
            kind: 'card',
            name: '_closing',
            kicker: c.req('project'),
            title: closing.title,
            bullets: lines,
            vo: closing.narration || [closing.title, ...lines].join('. '),
        });
    }
    return sections;
}

// Normalize a config motion spec; default is a subtle push-in that eases back out.
function motionSpec(m) {
    if (m === null) return null;
    const spec = typeof m === 'string' ? { type: m } : (m || {});
    const type = spec.type === 'in' ? 'in' : 'in-out';
    return {
        type,
        to: Math.min(Number(spec.to) || 1.06, 1.3),
        focus: Array.isArray(spec.focus) ? [Number(spec.focus[0]), Number(spec.focus[1])] : [0.5, 0.5],
    };
}

// The template ships in this package; the working copy lives in the workDir so its
// node_modules persist between runs. src/ and configs are re-copied every time (the
// template is the source of truth), public/ and data.json are regenerated after.
function syncProject(projectDir) {
    const templateDir = path.join(__dirname, '..', '..', 'templates', 'remotion');
    ensureDir(path.join(projectDir, 'src'));
    ensureDir(path.join(projectDir, 'public'));
    for (const f of ['package.json', 'remotion.config.ts', 'tsconfig.json']) {
        fs.copyFileSync(path.join(templateDir, f), path.join(projectDir, f));
    }
    for (const f of fs.readdirSync(path.join(templateDir, 'src'))) {
        fs.copyFileSync(path.join(templateDir, 'src', f), path.join(projectDir, 'src', f));
    }
}

function npx(projectDir, args, what) {
    const r = spawnSync('npx', args, { cwd: projectDir, stdio: 'inherit' });
    if (r.error) fail(`${what} could not start: ${r.error.message}\nIs Node/npm on PATH?`);
    if (r.status !== 0) fail(`${what} failed (exit ${r.status}). The Remotion output above has the cause.`);
}

async function run(c) {
    const ff = ffmpeg();

    const { width: W, height: H } = c.get('capture.viewport', { width: 1440, height: 900 });
    const maxSpeed = Math.max(1, Number(c.get('video.maxSpeed', 3)) || 3);
    const tail = Math.max(0, Number(c.get('compose.tailSeconds', 1.0)));
    const date = typeof c.args.date === 'string' ? c.args.date : stamp();

    const palette = resolvePalette(c.get('compose.palette', null));
    if (!palette) {
        fail(`compose.palette "${c.get('compose.palette')}" is not a known palette.\n` +
            `Named palettes: ${paletteIds().join(', ')} -- or pass an object to override colours.`);
    }

    const workDir = c.resolve(c.req('output.workDir'));
    const clipsDir = path.join(workDir, 'clips');
    const tmp = ensureDir(path.join(workDir, 'compose'));
    const projectDir = ensureDir(path.join(workDir, 'remotion'));
    const outDir = ensureDir(path.join(c.resolve(c.req('output.videoDir')), date));

    // Validate both audio configs up front, before anything slow runs.
    const voice = await voiceSetup(c);
    const music = musicSetup(c);

    // --- narrate + measure --------------------------------------------------------------
    const sections = buildSections(c, clipsDir);
    await narrate(sections, { ff, voice, tmp });

    const data = { fps: FPS, width: W, height: H, voiceDelayFrames: VOICE_DELAY_FRAMES, palette, music: { file: null }, sections: [] };
    const publicFiles = []; // [srcPath, destName]

    // measure every shot's timing FIRST, so the cinema pass can render in output time
    for (const s of sections) {
        s.durationInFrames = Math.round((s.voDur + tail) * FPS);
        if (s.kind !== 'shot') continue;
        // trimBefore overrides the detector: a spinner lead has structure and fools it.
        s.trimBeforeSec = s.trimBefore !== undefined ? Number(s.trimBefore) : firstContentTime(ff, s.clip);
        s.clipDur = Math.max(0.2, ff.duration(s.clip) - s.trimBeforeSec);
        s.playbackRate = s.speed !== undefined
            ? Math.max(0.5, Number(s.speed))
            : Math.min(Math.max(s.clipDur / (s.voDur + tail), 1), maxSpeed);
    }

    // 🎥 The cinema pass, exactly as in assemble: camera-enabled shots re-render in output
    //    time and come back as ordinary clips with trim 0 and rate 1. Both renderers consume
    //    the same processed files, so the look is identical between them.
    const passSections = sections.filter((s) => s.kind === 'shot' && !s.generated).map((s) => ({
        name: s.name, type: 'clip', src: s.clip, camera: s.camera,
        clipStart: s.trimBeforeSec, speed: s.playbackRate,
        dur: s.durationInFrames / FPS, clipDur: s.clipDur,
        ref: s,
    }));
    await renderPasses({ c, ff, sections: passSections, W, H, fps: FPS, workDir });
    for (const ps of passSections) {
        if (!ps.cinema) continue;
        ps.ref.clip = ps.src;
        ps.ref.trimBeforeSec = 0;
        ps.ref.playbackRate = 1;
        ps.ref.clipDur = ps.dur;
        ps.ref.motion = null;   // the camera replaced it
        ps.ref.cinema = true;
    }

    console.log('sections:');
    for (const s of sections) {
        const durationInFrames = s.durationInFrames;
        if (s.voFile) publicFiles.push([s.voFile, path.basename(s.voFile)]);

        if (s.kind === 'card') {
            data.sections.push({
                kind: 'card', id: s.name, kicker: s.kicker, title: s.title, bullets: s.bullets,
                voice: s.voFile ? path.basename(s.voFile) : null, durationInFrames,
            });
            console.log(`  ${s.name.padEnd(18)} ${(durationInFrames / FPS).toFixed(2)}s`);
            continue;
        }

        const { trimBeforeSec, playbackRate, clipDur } = s;
        const liveFrames = Math.max(1, Math.floor((clipDur / playbackRate) * FPS) - 2);
        const holds = liveFrames < durationInFrames - 2;

        const clipExt = path.extname(s.clip) || '.webm';
        publicFiles.push([s.clip, `${s.name}${clipExt}`]);
        data.sections.push({
            kind: 'shot', id: s.name, clip: `${s.name}${clipExt}`,
            voice: s.voFile ? path.basename(s.voFile) : null, durationInFrames,
            trimBeforeSec, playbackRate, liveFrames,
            tag: s.tag, caption: s.caption, motion: motionSpec(s.motion),
        });
        const bits = [`${playbackRate.toFixed(2)}x`];
        if (s.cinema) bits.push('camera');
        if (trimBeforeSec) bits.push(`lead trimmed @${trimBeforeSec.toFixed(2)}s`);
        if (holds) bits.push('freezes last frame');
        console.log(`  ${s.name.padEnd(18)} ${(durationInFrames / FPS).toFixed(2)}s  [${bits.join(', ')}]`);
    }
    const TOTAL = data.sections.reduce((a, s) => a + s.durationInFrames, 0) / FPS;
    console.log(`TOTAL ${TOTAL.toFixed(2)}s`);

    // --- music bed (already gain-staged and faded to TOTAL by the provider) --------------
    const bed = await musicBed(music, { ff, workDir, tmp, seconds: TOTAL });
    if (bed) {
        publicFiles.push([bed, `music${path.extname(bed) || '.wav'}`]);
        data.music.file = `music${path.extname(bed) || '.wav'}`;
    }

    // --- emit the project ----------------------------------------------------------------
    syncProject(projectDir);
    fs.writeFileSync(path.join(projectDir, 'src', 'data.json'), JSON.stringify(data, null, 2));
    for (const [src, name] of publicFiles) {
        fs.copyFileSync(src, path.join(projectDir, 'public', name));
    }

    if (!fs.existsSync(path.join(projectDir, 'node_modules'))) {
        console.log('first run: npm install in the Remotion project (one-time per workDir) ...');
        const r = spawnSync('npm', ['install', '--silent'], { cwd: projectDir, stdio: 'inherit' });
        if (r.status !== 0) fail(`npm install failed in ${projectDir}.`);
    }

    // --- render ---------------------------------------------------------------------------
    const outFile = path.join(outDir, OUT_NAME);
    npx(projectDir, ['remotion', 'render', 'Launch', outFile], 'remotion render');

    if (c.get('video.thumbnail', true)) {
        // Mid-title frame: the card is fully revealed there, and the palette makes it loud.
        const titleFrames = data.sections[0].durationInFrames;
        const at = Math.min(titleFrames - 1, Math.round(titleFrames * 0.6));
        npx(projectDir, ['remotion', 'still', 'Launch', '--frame', String(at), path.join(outDir, 'thumbnail.jpg')], 'remotion still');
    }

    console.log(`\nDONE -> ${outFile}`);
    console.log(`final: ${ff.duration(outFile).toFixed(2)}s, ${(fs.statSync(outFile).size / 1e6).toFixed(1)}MB`);
    if (c.get('video.thumbnail', true)) console.log(`poster: ${path.join(outDir, 'thumbnail.jpg')}`);
    return outFile;
}

module.exports = { run };
