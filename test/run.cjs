'use strict';
// A dependency-free test run: node test/run.cjs
//
// The point of this file is the white-flash trim. firstContentTime() is the one piece of this
// pipeline with a real algorithm, and it was got wrong once already (an earlier signal keyed on
// brightness and silently trimmed nothing on light-themed apps). So it is exercised here against
// synthetic clips with a KNOWN blank lead, in both themes, exactly the way it was measured when
// the fix landed. Needs ffmpeg; everything else runs anywhere.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const { firstContentTime, UNIFORM_RANGE } = require('../lib/commands/assemble.cjs');
const { makeFf, bin } = require('../lib/deps.cjs');
const { stripJsonc } = require('../lib/config.cjs');
const { backgroundCss, backgroundFlat, frameBox, presetIds } = require('../lib/style.cjs');

let passed = 0, failed = 0;
const results = [];

function ok(name, cond, detail) {
    if (cond) { passed++; results.push(`  PASS  ${name}${detail ? `  (${detail})` : ''}`); }
    else { failed++; results.push(`  FAIL  ${name}${detail ? `  (${detail})` : ''}`); }
}
const eq = (name, actual, expected) => ok(name, actual === expected, `got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
const near = (name, actual, expected, tol) =>
    ok(name, Math.abs(actual - expected) <= tol, `got ${actual}, expected ${expected} +/-${tol}`);

// --- fixtures ------------------------------------------------------------------------

const FPS = 30;
const LEAD = 1.2;   // the blank page-load lead every fixture starts with, in seconds

// A clip shaped like a real capture: black, then white (the browser's page-load), then a
// painted "UI". `ui` is [background, mark] hex; the mark is what gives the frame luma range.
function makeClip(ff, out, [uiBg, uiMark]) {
    const W = 320, H = 180;
    const half = (LEAD / 2).toFixed(3);
    ff.run(['-y', '-loglevel', 'error',
        '-f', 'lavfi', '-i', `color=c=black:s=${W}x${H}:d=${half}:r=${FPS}`,
        '-f', 'lavfi', '-i', `color=c=white:s=${W}x${H}:d=${half}:r=${FPS}`,
        '-f', 'lavfi', '-i', `color=c=0x${uiBg}:s=${W}x${H}:d=2:r=${FPS}`,
        '-f', 'lavfi', '-i', `color=c=0x${uiMark}:s=120x14:d=2:r=${FPS}`,
        // [2]+[3] = a "UI": a bar of contrasting colour on a flat background, so the frame has
        // a large luma range the way real text and chrome do.
        '-filter_complex', '[2][3]overlay=40:40:shortest=1[ui];[0][1][ui]concat=n=3:v=1:a=0[v]',
        '-map', '[v]', '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', out]);
}

// A clip that never paints anything: blank the whole way through.
function makeBlankClip(ff, out) {
    ff.run(['-y', '-loglevel', 'error',
        '-f', 'lavfi', '-i', `color=c=black:s=320x180:d=1:r=${FPS}`,
        '-f', 'lavfi', '-i', `color=c=white:s=320x180:d=1:r=${FPS}`,
        '-filter_complex', '[0][1]concat=n=2:v=1:a=0[v]',
        '-map', '[v]', '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', out]);
}

// The luma range of the last frame, to report what each synthetic UI actually measures.
function lastFrameRange(ff, clip) {
    const out = ff.probeText(['-hide_banner', '-i', clip, '-vf', 'signalstats,metadata=print', '-f', 'null', '-']);
    let ymin = null, range = null;
    for (const line of out.split('\n')) {
        const mn = line.match(/lavfi\.signalstats\.YMIN=([\d.]+)/);
        if (mn) { ymin = parseFloat(mn[1]); continue; }
        const mx = line.match(/lavfi\.signalstats\.YMAX=([\d.]+)/);
        if (mx && ymin !== null) range = parseFloat(mx[1]) - ymin;
    }
    return range;
}

// --- tests ---------------------------------------------------------------------------

function testTrim(ff, dir) {
    // ⚠️ THE regression test. A dark UI and a light UI, same 1.20s blank lead. The trim must
    //    find both: it keys on luma RANGE (structure), not brightness, which is precisely why
    //    the light case works. Brightness alone never crosses back down on a light app.
    const dark = path.join(dir, 'dark.mp4');
    const light = path.join(dir, 'light.mp4');
    makeClip(ff, dark, ['0a0e0f', 'e6f1ee']);   // dark chrome, light text
    makeClip(ff, light, ['f5f7f8', '0b1211']);  // light chrome, dark text

    const dRange = lastFrameRange(ff, dark);
    const lRange = lastFrameRange(ff, light);
    ok('dark UI frame has structure (luma range over the uniform threshold)', dRange >= UNIFORM_RANGE, `range ${dRange} >= ${UNIFORM_RANGE}`);
    ok('light UI frame has structure (luma range over the uniform threshold)', lRange >= UNIFORM_RANGE, `range ${lRange} >= ${UNIFORM_RANGE}`);

    // One frame of tolerance: the cut lands on the first painted frame, at 30fps.
    near('trims the blank lead on a DARK ui', firstContentTime(ff, dark), LEAD, 1 / FPS + 0.001);
    near('trims the blank lead on a LIGHT ui', firstContentTime(ff, light), LEAD, 1 / FPS + 0.001);

    // ✅ Safe direction: nothing structured anywhere -> trim nothing, never cut wrongly.
    const blank = path.join(dir, 'blank.mp4');
    makeBlankClip(ff, blank);
    eq('an all-blank clip trims nothing', firstContentTime(ff, blank), 0);

    // The old brightness-based signal, reproduced, to show WHY the range signal exists: a light
    // app's average luma never falls back after the white flash, so a brightness test finds no
    // cut and the white lead survives into the finished video.
    const brightnessSignal = (clip) => {
        const out = ff.probeText(['-hide_banner', '-i', clip, '-vf', 'signalstats,metadata=print', '-f', 'null', '-']);
        let t = 0, sawFlash = false;
        for (const line of out.split('\n')) {
            const mt = line.match(/pts_time:([\d.]+)/);
            if (mt) { t = parseFloat(mt[1]); continue; }
            const ma = line.match(/lavfi\.signalstats\.YAVG=([\d.]+)/);
            if (!ma) continue;
            const yavg = parseFloat(ma[1]);
            if (yavg > 190) sawFlash = true;
            else if (sawFlash) return t;   // brightness dropped back: "content"
        }
        return 0;
    };
    ok('the old brightness signal would MISS a light ui (why the range signal exists)',
        brightnessSignal(light) === 0 && Math.abs(brightnessSignal(dark) - LEAD) < 0.1,
        `brightness: dark ${brightnessSignal(dark)}s (found), light ${brightnessSignal(light)}s (missed)`);
}

function testStripJsonc() {
    const src = `{
        // a line comment
        "baseUrl": "http://localhost:3000",  // the // inside the string must survive
        /* a block
           comment */
        "n": 1,
    }`;
    const parsed = JSON.parse(stripJsonc(src));
    eq('stripJsonc keeps "//" inside a string (the baseUrl trap)', parsed.baseUrl, 'http://localhost:3000');
    eq('stripJsonc drops trailing commas', parsed.n, 1);
    eq('stripJsonc handles an escaped quote', JSON.parse(stripJsonc('{"a":"x\\"y"}')).a, 'x"y');
}

function testBackground() {
    eq('preset gradient -> 3-stop css with its own angle',
        backgroundCss({ background: { preset: 'deep-ocean' } }),
        'linear-gradient(153deg, #0A0D80, #4230ED, #6BABFA)');
    eq('preset id is case-insensitive',
        backgroundCss({ background: { preset: 'Deep-Ocean' } }),
        'linear-gradient(153deg, #0A0D80, #4230ED, #6BABFA)');
    eq('preset angle can be overridden',
        backgroundCss({ background: { preset: 'deep-ocean', angle: 90 } }),
        'linear-gradient(90deg, #0A0D80, #4230ED, #6BABFA)');
    eq('preset solid -> flat hex', backgroundCss({ background: { preset: 'obsidian' } }), '#050508');
    eq('custom gradient (unchanged from the original)',
        backgroundCss({ background: { type: 'gradient', from: '#111111', to: '#222222' } }),
        'linear-gradient(135deg, #111111, #222222)');
    eq('custom gradient honours angle',
        backgroundCss({ background: { from: '#111111', to: '#222222', angle: 45 } }),
        'linear-gradient(45deg, #111111, #222222)');
    eq('type solid collapses to from', backgroundCss({ background: { type: 'solid', from: '#123456' } }), '#123456');
    eq('type solid accepts color', backgroundCss({ background: { type: 'solid', color: '#123456' } }), '#123456');
    eq('from with no to collapses to flat', backgroundCss({ background: { from: '#123456' } }), '#123456');
    eq('empty style falls back to the default', backgroundCss({}), '#0f172a');

    eq('flat fallback: gradient preset -> first stop', backgroundFlat({ background: { preset: 'deep-ocean' } }), '#0A0D80');
    eq('flat fallback: solid preset -> its hex', backgroundFlat({ background: { preset: 'obsidian' } }), '#050508');
    eq('flat fallback: custom -> from', backgroundFlat({ background: { from: '#123456', to: '#654321' } }), '#123456');
    eq('flat fallback: default', backgroundFlat({}), '#0f172a');

    eq('presets: 28 ids', presetIds().length, 28);
    eq('preset ids are unique', new Set(presetIds()).size, presetIds().length);
}

function testPalettes() {
    const { resolvePalette, paletteIds } = require('../lib/palettes.cjs');
    ok('palettes: at least the four shipped ids', paletteIds().length >= 4, paletteIds().join(','));
    eq('palette ids are unique', new Set(paletteIds()).size, paletteIds().length);
    const sunrise = resolvePalette(null);
    ok('default palette is sunrise with commons merged',
        sunrise.accent === '#ffd166' && sunrise.frameRadius === 18 && typeof sunrise.font === 'string');
    eq('unknown palette name -> null (compose reports it)', resolvePalette('sunset-strip'), null);
    const custom = resolvePalette({ base: 'deep-ocean', accent: '#ffffff' });
    ok('object spec overrides its base', custom.accent === '#ffffff' && custom.card === '#0d1220');
    // Every named palette must be complete: the template reads all of these keys.
    for (const id of paletteIds()) {
        const p = resolvePalette(id);
        const keys = ['bgGradient', 'bgGlow', 'card', 'cardSoft', 'ink', 'inkSoft', 'accent', 'accentInk', 'chip', 'frameRadius', 'font'];
        ok(`palette "${id}" is complete`, keys.every((k) => p[k] !== undefined && p[k] !== ''),
            keys.filter((k) => p[k] === undefined || p[k] === '').join(',') || 'all keys');
    }
}

// The validator exits the process on errors, so rejects are exercised in a child node.
function testValidator() {
    const base = {
        project: 'Test',
        baseUrl: 'http://localhost:3000',
        output: { workDir: '.w', videoDir: 'out' },
        auth: { storageState: '.w/auth.json', loginPath: '/sign-in', readyPath: '/home' },
        shots: [{ id: 'a', route: '/a', caption: 'A' }],
    };
    const { validateConfig } = require('../lib/validate.cjs');

    // Accepts: everything this round added, in one config.
    let threw = false;
    try {
        validateConfig({
            ...base,
            auth: { profile: '.w/profile', loginPath: '/sign-in', readyPath: '/home' },
            compose: { palette: 'sunrise', tailSeconds: 1.2 },
            shots: [{
                id: 'a', route: '/a', caption: 'A',
                motion: { type: 'in-out', to: 1.07, focus: [0.4, 0.35] },
                trimBefore: 3.2, speed: 1,
                actions: [
                    { type: 'type', selector: 'input', value: 'Bolt', delay: 110 },
                    { type: 'press', key: 'Meta+a' },
                ],
            }],
        }, 'test.json');
    } catch { threw = true; }
    ok('validator accepts profile auth + compose + motion + type action', !threw);

    // Rejects: each bad config exits non-zero in a child process.
    const reject = (name, mutate) => {
        const cfg = JSON.parse(JSON.stringify(base));
        mutate(cfg);
        const r = execFileSync(process.execPath, ['-e', `
            const { validateConfig } = require(${JSON.stringify(path.join(__dirname, '..', 'lib', 'validate.cjs'))});
            validateConfig(${JSON.stringify(cfg)}, 'test.json');
        `], { encoding: 'utf8', stdio: 'pipe' });
        return r; // only reached when validation passed
    };
    const rejects = (name, mutate) => {
        let failedAsExpected = false;
        try { reject(name, mutate); } catch { failedAsExpected = true; }
        ok(name, failedAsExpected);
    };
    rejects('validator rejects an unknown palette name', (c) => { c.compose = { palette: 'sunset-strip' }; });
    rejects('validator rejects motion.to above 1.3', (c) => { c.shots[0].motion = { type: 'in', to: 2 }; });
    rejects('validator rejects a bad motion focus', (c) => { c.shots[0].motion = { focus: [2, 0] }; });
    rejects('validator rejects a type action without value', (c) => { c.shots[0].actions = [{ type: 'type', selector: 'input' }]; });
    rejects('validator rejects auth with neither storageState nor profile', (c) => { c.auth = { loginPath: '/a', readyPath: '/b' }; });

    // 🎥 cinema round: the new action + the telemetry switch
    let cinemaOk = true;
    try {
        validateConfig({
            ...base,
            capture: { telemetry: true },
            shots: [{
                id: 'a', route: '/a', caption: 'A',
                actions: [{ type: 'dblclick', selector: 'text=Report.pdf' }],
            }],
        }, 'test.json');
    } catch { cinemaOk = false; }
    ok('validator accepts dblclick + capture.telemetry', cinemaOk);
    rejects('validator rejects dblclick without selector', (c) => { c.shots[0].actions = [{ type: 'dblclick' }]; });
    rejects('validator rejects a non-boolean capture.telemetry', (c) => { c.capture = { telemetry: 'yes' }; });
}

// 🎥 The transit generator and the events recorder: pure, deterministic, and the foundation
//    the whole cinema pass stands on -- if the sidecar lies, everything downstream lies.
function testTelemetry() {
    const { synthesizeTransit, seededRng, createRecorder, telemetryEnabled, mapCursorStyle,
        TRANSIT_MIN_MS, TRANSIT_MAX_MS } = require('../lib/telemetry.cjs');

    // -- transit synthesis ---------------------------------------------------------
    const from = { x: 0.50, y: 0.55 }, to = { x: 0.62, y: 0.41 };
    const t1 = synthesizeTransit(from, to, seededRng('shot-a'));
    const t2 = synthesizeTransit(from, to, seededRng('shot-a'));
    const t3 = synthesizeTransit(from, to, seededRng('shot-b'));

    eq('transit: first sample is exactly `from`', JSON.stringify(t1.samples[0].slice(1)), JSON.stringify([0.5, 0.55]));
    eq('transit: last sample is exactly `to`', JSON.stringify(t1.samples[t1.samples.length - 1].slice(1)), JSON.stringify([0.62, 0.41]));
    ok('transit: duration clamps to [min,max]', t1.durMs >= TRANSIT_MIN_MS && t1.durMs <= TRANSIT_MAX_MS, `${t1.durMs}ms`);
    ok('transit: timestamps strictly monotone', t1.samples.every((s, i) => i === 0 || s[0] > t1.samples[i - 1][0]));
    near('transit: ~60Hz cadence between samples', t1.samples[2][0] - t1.samples[1][0], 1000 / 60, 1.5);
    eq('transit: deterministic under the same seed', JSON.stringify(t1.samples), JSON.stringify(t2.samples));
    ok('transit: a different seed bends a different path', JSON.stringify(t1.samples) !== JSON.stringify(t3.samples));

    const far = synthesizeTransit({ x: 0, y: 0 }, { x: 1, y: 1 }, seededRng('x'));
    eq('transit: cross-screen move hits the duration ceiling', far.durMs, TRANSIT_MAX_MS);
    const nearMove = synthesizeTransit({ x: 0.5, y: 0.5 }, { x: 0.51, y: 0.5 }, seededRng('x'));
    eq('transit: tiny move hits the duration floor', nearMove.durMs, TRANSIT_MIN_MS);

    // -- recorder normalization (the capture.zoom case: layout viewport 1800x1125) --
    const rec = createRecorder({
        shot: 'zoomed', viewport: { width: 1440, height: 900 },
        layoutViewport: { width: 1800, height: 1125 }, captureZoom: 0.8,
    });
    rec.start();
    rec.click({ selector: '#b', box: { x: 900, y: 562.5, width: 180, height: 56.25 }, cursorStyle: 'pointer', t: 100 });
    rec.keyChord({ combo: 'Shift+Meta+z', t: 200 });
    rec.typeBurst({ selector: '#q', box: null, text: 'ok', keys: [{ t: 300, key: 'o' }, { t: 390, key: 'k' }], t0: 300, t1: 400 });
    rec.settle();
    const sc = rec.toJSON();
    eq('sidecar: schema 1', sc.schema, 1);
    const click = sc.events.find((e) => e.type === 'click');
    eq('sidecar: box normalized against the LAYOUT viewport', JSON.stringify(click.box), JSON.stringify({ x: 0.5, y: 0.5, w: 0.1, h: 0.05 }));
    ok('sidecar: events sorted by time', sc.events.every((e, i, a) => i === 0 || (e.t0 ?? e.t) >= (a[i - 1].t0 ?? a[i - 1].t)));
    eq('sidecar: chord kept in Playwright syntax', sc.events.find((e) => e.type === 'keyChord').combo, 'Shift+Meta+z');
    eq('sidecar: burst carries per-key cadence', sc.events.find((e) => e.type === 'typeBurst').keys.length, 2);

    // -- activation ----------------------------------------------------------------
    const fakeCfg = (obj) => ({
        get(key, dflt) {
            const v = key.split('.').reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), obj);
            return v === undefined ? dflt : v;
        },
    });
    eq('telemetry: off for a plain config', telemetryEnabled(fakeCfg({ shots: [{ id: 'a' }] })), false);
    eq('telemetry: on when video.camera exists', telemetryEnabled(fakeCfg({ video: { camera: {} } })), true);
    eq('telemetry: on when style.cursor exists', telemetryEnabled(fakeCfg({ style: { cursor: { show: true } } })), true);
    eq('telemetry: on when a shot sets camera', telemetryEnabled(fakeCfg({ shots: [{ id: 'a', camera: 'auto' }] })), true);
    eq('telemetry: capture.telemetry false wins over cinema keys', telemetryEnabled(fakeCfg({ capture: { telemetry: false }, video: { camera: {} } })), false);

    // -- cursor style mapping ------------------------------------------------------
    eq('cursor style: pointer', mapCursorStyle('pointer'), 'pointer');
    eq('cursor style: default -> arrow', mapCursorStyle('default'), 'arrow');
    eq('cursor style: grabbing -> grab', mapCursorStyle('grabbing'), 'grab');
}

// 🎥 The camera: the analytic spring and the segment planner. Pure math against synthetic
//    sidecars with known events -- the golden tests the whole cinema pass leans on.
function testCamera() {
    const { springStep, clampCenter, bake } = require('../lib/camera/spring.cjs');
    const { plan, zoomFor, toOut, normalizeOverride } = require('../lib/camera/plan.cjs');

    // -- spring behavior -----------------------------------------------------------
    {
        // settles: within epsilon of the target after 3x response
        let x = 0, v = 0;
        const resp = 0.35, dt = 1 / 30;
        for (let t = 0; t < resp * 3; t += dt) { const s = springStep(x, v, 1, dt, resp); x = s.x; v = s.v; }
        near('spring settles within 2% by 3x response', x, 1, 0.02);

        // no NaN at dt extremes
        const tiny = springStep(0.3, 2, 1, 1e-6, 0.35);
        const huge = springStep(0.3, 2, 1, 1, 0.35);
        ok('spring finite at dt extremes', Number.isFinite(tiny.x) && Number.isFinite(tiny.v)
            && Number.isFinite(huge.x) && Number.isFinite(huge.v));

        // overdamped regime also settles
        let x2 = 0, v2 = 0;
        for (let t = 0; t < 2; t += dt) { const s = springStep(x2, v2, 1, dt, 0.35, 1.2); x2 = s.x; v2 = s.v; }
        near('overdamped spring settles too', x2, 1, 0.02);
    }

    eq('clampCenter pins center at zoom 1', clampCenter(0.9, 1), 0.5);
    eq('clampCenter: halfCrop = 0.5/zoom', clampCenter(0.05, 2), 0.25);

    // -- bake: continuity, clamping, hold damping ----------------------------------
    {
        const p = {
            schema: 1, mode: 'segments',
            clip: { trimStart: 0, speed: 1, durOut: 4, fps: 30 },
            config: { intensity: 1, maxZoom: 2.5 },
            segments: [
                { t0: 0, t1: 0.8, from: { zoom: 1, cx: 0.5, cy: 0.5 }, to: { zoom: 1, cx: 0.5, cy: 0.5 }, why: 'establish' },
                { t0: 0.8, t1: 1.3, from: { zoom: 1, cx: 0.5, cy: 0.5 }, to: { zoom: 2, cx: 0.25, cy: 0.25 }, why: 'move' },
                { t0: 1.3, t1: 3.0, from: { zoom: 2, cx: 0.25, cy: 0.25 }, to: { zoom: 2, cx: 0.25, cy: 0.25 }, why: 'hold' },
                { t0: 3.0, t1: 4.0, from: { zoom: 2, cx: 0.25, cy: 0.25 }, to: { zoom: 1, cx: 0.5, cy: 0.5 }, why: 'release' },
            ],
        };
        const frames = bake(p);
        eq('bake emits one transform per frame', frames.length, 120);
        // no teleports: peak per-frame step stays in the band real spring velocity produces
        // (a 0.35-unit move peaks ~2.4 units/s = 0.08/frame at 30fps; a cut would be 0.2+)
        const maxStep = Math.max(...frames.slice(1).map((f, i) => Math.hypot(f.cx - frames[i].cx, f.cy - frames[i].cy)));
        ok('bake: velocity continuity (no teleports)', maxStep < 0.12, `max step ${maxStep.toFixed(4)}`);
        // the crop never leaves the frame beyond the soft-pushback cap
        const worst = Math.max(...frames.map((f) => {
            const half = 0.5 / Math.max(1, f.zoom);
            return Math.max(half - f.cx, f.cx - (1 - half), half - f.cy, f.cy - (1 - half), 0);
        }));
        ok('bake: clamp respected at every tick (within pushback cap)', worst <= 0.031, `worst overflow ${worst.toFixed(4)}`);
        // deep into the hold, the camera rests on target
        const rest = frames[Math.round(2.8 * 30)];
        near('bake: hold rests on target (cx)', rest.cx, 0.25, 0.02);
        near('bake: hold rests on target (zoom)', rest.zoom, 2, 0.05);
        // by the end of the release the camera is home
        const last = frames[frames.length - 1];
        near('bake: release lands at zoom 1', last.zoom, 1, 0.05);
    }

    // -- planner goldens -----------------------------------------------------------
    const clip = { trimStart: 0, speed: 1, durOut: 6, fps: 30 };
    const box = { x: 0.58, y: 0.38, w: 0.08, h: 0.06 };

    // zoom sizing: 0.7 / max(0.08+0.16, 0.06+0.16) = 2.9167 -> click range cap 2.5 -> maxZoom 2.2
    near('zoom formula: coverage / padded size, range- and max-clamped',
        zoomFor(box, 'click', { intensity: 1, maxZoom: 2.2 }), 2.2, 1e-9);
    eq('zoom formula: a giant container never zooms', zoomFor({ x: 0.1, y: 0.1, w: 0.7, h: 0.5 }, 'click', {}), 1);
    near('zoom formula: intensity scales the zoom-1 part',
        zoomFor(box, 'click', { intensity: 0.5, maxZoom: 4 }), 1 + (2.5 - 1) * 0.5, 1e-9);

    // single click: establish from 1.0, anticipated move, travel-clamped, hold, release
    {
        const events = [
            { type: 'waitFor', t: 200, settledT: 700, selector: 'main', box: { x: 0, y: 0, w: 1, h: 1 } },
            { type: 'click', t: 2000, at: [0.62, 0.41], selector: '#approve', box, cursorStyle: 'pointer' },
        ];
        const p = plan(events, clip, { intensity: 1, maxZoom: 2.2 });
        eq('planner: first segment starts at 0 from zoom 1', p.segments[0].t0 === 0 && p.segments[0].from.zoom === 1, true);
        const move = p.segments.find((s) => s.why.startsWith('click'));
        ok('planner: click move exists', Boolean(move));
        ok('planner: anticipation leads the click by >= 0.15s', move.t0 <= 2.0 - 0.15 + 0.01, `t0=${move.t0}`);
        const dur = move.t1 - move.t0;
        ok('planner: travel clamp [0.15, 0.8]', dur >= 0.15 - 1e-9 && dur <= 0.8 + 1e-9, `${dur.toFixed(3)}s`);
        near('planner: click zoom honors the table', move.to.zoom, 2.2, 0.01);
        const last = p.segments[p.segments.length - 1];
        eq('planner: plan covers the full clip', last.t1, 6);
        near('planner: trailing tail releases to 1.0', last.to.zoom, 1, 1e-9);
        ok('planner: segments contiguous', p.segments.every((s, i, a) => i === 0 || Math.abs(s.t0 - a[i - 1].t1) < 1e-6));
    }

    // two clicks near in time and space merge into ONE focus
    {
        const b2 = { x: 0.60, y: 0.42, w: 0.08, h: 0.06 };
        const events = [
            { type: 'click', t: 2000, at: [0.62, 0.41], selector: '#a', box },
            { type: 'click', t: 3000, at: [0.64, 0.45], selector: '#b', box: b2 },
        ];
        const p = plan(events, clip, { intensity: 1, maxZoom: 2.2 });
        const moves = p.segments.filter((s) => s.why.includes('click'));
        eq('planner: adjacent clicks merge to one focus', moves.length, 1);
        ok('planner: merged focus is marked', moves[0].why.includes('merged'));
    }

    // corner click at maxZoom 2 -> center clamped to (0.25, 0.25)
    {
        const events = [{ type: 'click', t: 2000, at: [0.05, 0.03], selector: '#c', box: { x: 0, y: 0, w: 0.1, h: 0.05 } }];
        const p = plan(events, clip, { intensity: 1, maxZoom: 2.0 });
        const move = p.segments.find((s) => s.why.startsWith('click'));
        near('planner: corner focus clamps cx to halfCrop', move.to.cx, 0.25, 1e-6);
        near('planner: corner focus clamps cy to halfCrop', move.to.cy, 0.25, 1e-6);
    }

    // trim/speed mapping: raw 3.0s with trim 1.0 at speed 2 lands at out 1.0
    near('planner: raw->output time mapping', toOut(3000, { trimStart: 1, speed: 2, durOut: 10 }), 1.0, 1e-9);

    // no events at all: a single establishing hold covering the clip
    {
        const p = plan([], clip, {});
        eq('planner: empty sidecar -> one hold at zoom 1', p.segments.length, 1);
        eq('planner: empty sidecar covers the clip', p.segments[0].t1, 6);
    }

    // override normalization: gaps filled, zoom clamped with a warning, ends pinned
    {
        const { plan: np, warnings } = normalizeOverride([
            { t0: 1, t1: 2, from: { zoom: 1, cx: 0.5, cy: 0.5 }, to: { zoom: 9, cx: 0.9, cy: 0.1 } },
        ], clip, { maxZoom: 2.2 });
        ok('override: zoom clamp warns', warnings.some((w) => w.includes('maxZoom')));
        eq('override: leading gap filled with a hold', np.segments[0].why.includes('hold') || np.segments[0].why === 'hold (gap)', true);
        eq('override: plan pinned to [0, durOut]', np.segments[0].t0 === 0 && np.segments[np.segments.length - 1].t1 === 6, true);
        const to = np.segments.find((s) => s.why === 'override').to;
        // 1e-3 tolerance: the plan stores 3 decimals, and the renderer re-clamps in pixel
        // space anyway (belt and braces), so a rounding hair over the bound is harmless
        ok('override: clamped center stays croppable', to.cx <= 1 - 0.5 / to.zoom + 1e-3 && to.cy >= 0.5 / to.zoom - 1e-3);
    }
}

// 🎥 Overlay formulas: squash, ripple, spotlight, track sampling. These exact functions are
//    inlined into the compositor bundle, so testing them here tests what the pixels do.
function testOverlayFormulas() {
    const o = require('../lib/camera/overlay.cjs');

    // squash: at bounce 3.5 the floor engages exactly at the bottom of the press
    eq('squash: floor is exactly 0.72 at bounce 3.5', o.squashScale(0.5, 3.5, 1), 0.72);
    ok('squash: softer bounce never reaches the floor', o.squashScale(0.5, 2.5, 1) > 0.72,
        `${o.squashScale(0.5, 2.5, 1)}`);
    eq('squash: identity outside the window', o.squashScale(1.5, 2.5, 1), 1);
    ok('squash: zoom deepens the punch', o.squashScale(0.5, 2.5, 4) < o.squashScale(0.5, 2.5, 1));

    // ripple: p runs 1 -> 0; the ring starts as a dot at full alpha and dies expanded
    const h = o.cursorPx(2, 1920, 1);   // 56 at reference width
    eq('cursorPx: 28 x scale at reference width', h, 56);
    near('cursorPx: floor at 0.55 for narrow frames', o.cursorPx(2, 320, 1), 28 * 2 * 0.55, 1e-9);
    const r1 = o.rippleShape(1, h, 1, 1);
    near('ripple @p=1: radius starts at the dot floor', r1.radius, 0.5, 1e-9);
    near('ripple @p=1: alpha starts at 0.6', r1.alpha, 0.6, 1e-9);
    near('ripple @p=1: stroke starts at 2', r1.strokeWidth, 2, 1e-9);
    const r0 = o.rippleShape(0.001, h, 1, 1);
    near('ripple @p->0: radius approaches 1.95x cursor height', r0.radius, h * 1.95, h * 0.02);
    ok('ripple @p->0: alpha dies', r0.alpha < 0.01, `${r0.alpha}`);
    const rHalf = o.rippleShape(0.5, h, 1, 1);
    near('ripple @p=0.5: radius honors the cube law', rHalf.radius, (1 - 0.125) * h * 1.95, 1e-6);

    // spotlight: two rings, converging, alpha split 0.28 / 0.5
    const sp = o.spotlightShape(0.5, h, 1, 1);
    ok('spotlight: inner ring inside the glow', sp.innerR < sp.glowR, `${sp.innerR} < ${sp.glowR}`);
    near('spotlight: outer alpha is 0.28 of p', sp.outerAlpha, 0.5 * 0.28, 1e-9);
    near('spotlight: inner alpha is 0.5 of p', sp.innerAlpha, 0.5 * 0.5, 1e-9);

    // track sampling: lerp between close samples, hold-then-snap across a gap
    const track = [[0, 0.1, 0.1], [0.05, 0.2, 0.2], [1.0, 0.9, 0.9]];
    const mid = o.sampleTrack(track, 0.025);
    near('track: lerp between close samples', mid.x, 0.15, 1e-9);
    const heldEarly = o.sampleTrack(track, 0.5);
    near('track: a gap holds instead of gliding', heldEarly.x, 0.2, 1e-9);
    const after = o.sampleTrack(track, 1.0);
    near('track: the snap lands when the gap closes', after.x, 0.9, 1e-9);

    // cursor spring parameterization
    eq('cursor spring: smoothing 0 disables it', o.cursorSpring(0), null);
    near('cursor spring: default smoothing gives the base response', o.cursorSpring(0.67).response, 0.09, 1e-9);
    near('cursor spring: zeta is the measured underdamp', o.cursorSpring(0.67).zeta, 0.855, 1e-9);
}

// 🎥 Cursor + effects on real pixels: a dot cursor parked at a known point over a black clip
//    must light exactly that neighbourhood -- at zoom 1 and, transformed, at zoom 2 -- and a
//    ripple must exist mid-life and be gone after.
async function testCinemaOverlays(ff, dir) {
    const { chromium } = require('../lib/deps.cjs');
    if (!chromium(path.join(__dirname, '..'), { soft: true })) {
        results.push('  SKIP  cinema overlays (playwright not found)');
        return;
    }
    const { renderPasses } = require('../lib/camera/render.cjs');

    const W = 320, H = 240;
    const src = path.join(dir, 'black.webm');
    ff.run(['-y', '-loglevel', 'error',
        '-f', 'lavfi', '-i', `color=c=black:s=${W}x${H}:d=2:r=30`,
        '-c:v', 'libvpx', '-b:v', '1M', '-pix_fmt', 'yuv420p', src]);

    const ymaxCrop = (file, t, x, y, w, h) => {
        const out = ff.probeText(['-ss', String(t), '-i', file, '-frames:v', '1',
            '-vf', `crop=${w}:${h}:${x}:${y},signalstats,metadata=print`, '-f', 'null', '-']);
        const m = out.match(/lavfi\.signalstats\.YMAX=([\d.]+)/);
        return m ? parseFloat(m[1]) : NaN;
    };

    const workDir = path.join(dir, 'overlay-work');
    const clipsDir = path.join(workDir, 'clips');
    fs.mkdirSync(clipsDir, { recursive: true });

    // a sidecar with a parked cursor at (0.25, 0.25) and one click there
    const sidecar = {
        schema: 1, shot: 'ov', viewport: { width: W, height: H },
        layoutViewport: { width: W, height: H }, captureZoom: 1,
        clock: { basis: 'recordStart', recordStartAt: 0, uncertaintyMs: 0, navSettledT: 0 },
        start: { x: 0.25, y: 0.25 },
        events: [
            { type: 'click', t: 50, at: [0.25, 0.25], button: 'left', count: 1,
              selector: '#x', box: { x: 0.2, y: 0.2, w: 0.1, h: 0.1 }, cursorStyle: 'pointer' },
        ],
    };
    const cfgFor = (cameraSeg) => ({
        file: 't.json',
        root: path.join(__dirname, '..'),
        get: (key, dflt) => {
            if (key === 'style.cursor') return { style: 'dot', smoothing: 0, scale: 2, color: '#ffffff' };
            if (key === 'style.clicks') return { effect: 'ripple', color: '#ffffff', opacity: 1, durationMs: 600 };
            return dflt;
        },
    });
    const mkSection = (name, camera) => ({
        name, type: 'clip', src, camera,
        clipStart: 0, speed: 1, dur: 1.5, clipDur: 2.0,
    });
    for (const [name, sc] of [['ov', sidecar]]) {
        fs.writeFileSync(path.join(clipsDir, `${name}.events.json`), JSON.stringify(sc));
    }

    // zoom 1 (overlays only, no camera): the dot lights (80, 60), the far corner stays dark
    const s1 = mkSection('ov', undefined);
    const n = await renderPasses({ c: cfgFor(), ff, sections: [s1], W, H, fps: 30, workDir, log: () => {} });
    eq('overlays: the pass runs with no camera configured', n, 1);
    const dotY = ymaxCrop(s1.src, 1.2, 80 - 12, 60 - 12, 24, 24);
    ok('overlays: dot cursor lights its parked point', dotY > 120, `YMAX ${dotY}`);
    const farY = ymaxCrop(s1.src, 1.2, W - 40, H - 40, 24, 24);
    ok('overlays: the far corner stays black', farY < 40, `YMAX ${farY}`);

    // ripple: probe AT the radius the shared formula predicts for that instant, so the test
    // and the compositor cannot disagree about geometry (they are the same file)
    const o = require('../lib/camera/overlay.cjs');
    // early in the ring's life: alpha 0.4, which survives jpeg->x264 double compression
    const tProbe = 0.30;
    const pRip = 1 - (tProbe - (0.05 + o.EFFECT_DELAY_MS / 1000)) / 0.6;
    const rip = o.rippleShape(pRip, o.cursorPx(2, W, 1), 1, 1);
    const ringY = ymaxCrop(s1.src, tProbe, Math.round(80 + rip.radius) - 7, 60 - 7, 14, 14);
    ok('overlays: ripple ring present mid-life at the predicted radius', ringY > 40,
        `YMAX ${ringY} at r=${rip.radius.toFixed(1)} alpha=${rip.alpha.toFixed(2)}`);
    const lateY = ymaxCrop(s1.src, 1.4, Math.round(80 + rip.radius) - 7, 60 - 7, 14, 14);
    ok('overlays: ripple gone after its duration', lateY < 20, `YMAX ${lateY}`);

    // zoom 2 pinned at (0.25, 0.25): content point (0.25,0.25) maps to screen center
    fs.writeFileSync(path.join(clipsDir, 'ov2.events.json'), JSON.stringify({ ...sidecar, shot: 'ov2' }));
    const s2 = mkSection('ov2', { segments: [{ t0: 0, t1: 1.5, from: { zoom: 2, cx: 0.25, cy: 0.25 }, to: { zoom: 2, cx: 0.25, cy: 0.25 } }] });
    await renderPasses({ c: cfgFor(), ff, sections: [s2], W, H, fps: 30, workDir, log: () => {} });
    const zoomedDotY = ymaxCrop(s2.src, 1.2, 160 - 16, 120 - 16, 32, 32);
    ok('overlays: at zoom 2 the cursor rides the transform to screen center', zoomedDotY > 120, `YMAX ${zoomedDotY}`);
    const oldSpotY = ymaxCrop(s2.src, 1.2, 40, 24, 20, 20);
    ok('overlays: nothing remains at the un-transformed point', oldSpotY < 40, `YMAX ${oldSpotY}`);
}

// 🎥 The compositor, end to end: a synthetic clip with four colored quadrants, a pinned
//    camera plan, and luma assertions on the rendered pixels. If zoom 2 at (0.25, 0.25)
//    does not fill the frame with the top-left quadrant, everything upstream is theory.
async function testCinemaPass(ff, dir) {
    const { chromium } = require('../lib/deps.cjs');
    if (!chromium(path.join(__dirname, '..'), { soft: true })) {
        results.push('  SKIP  cinema pass (playwright not found)');
        return;
    }
    const { renderPasses } = require('../lib/camera/render.cjs');

    // four quadrants: TL white, the rest dark -- luma tells us which one we look at
    const W = 320, H = 240;
    const src = path.join(dir, 'quad.webm');
    ff.run(['-y', '-loglevel', 'error',
        '-f', 'lavfi', '-i', `color=c=white:s=${W / 2}x${H / 2}:d=2:r=30`,
        '-f', 'lavfi', '-i', `color=c=0x300000:s=${W / 2}x${H / 2}:d=2:r=30`,
        '-f', 'lavfi', '-i', `color=c=0x000030:s=${W / 2}x${H / 2}:d=2:r=30`,
        '-f', 'lavfi', '-i', `color=c=0x203020:s=${W / 2}x${H / 2}:d=2:r=30`,
        '-filter_complex', '[0][1]hstack[t];[2][3]hstack[b];[t][b]vstack[v]',
        '-map', '[v]', '-c:v', 'libvpx', '-b:v', '1M', '-pix_fmt', 'yuv420p', src]);

    const yavgAt = (file, t) => {
        const out = ff.probeText(['-ss', String(t), '-i', file, '-frames:v', '1',
            '-vf', 'signalstats,metadata=print', '-f', 'null', '-']);
        const m = out.match(/lavfi\.signalstats\.YAVG=([\d.]+)/);
        return m ? parseFloat(m[1]) : NaN;
    };

    const workDir = path.join(dir, 'cinema-work');
    fs.mkdirSync(path.join(workDir, 'clips'), { recursive: true });
    const fakeC = {
        file: 'test.json',
        root: path.join(__dirname, '..'),
        get: (key, dflt) => (key === 'video.camera' ? undefined : dflt),
    };
    const seg = (zoom, cx, cy) => [{ t0: 0, t1: 1, from: { zoom, cx, cy }, to: { zoom, cx, cy } }];
    const mkSection = (name, camera) => ({
        name, type: 'clip', src, camera,
        clipStart: 0, speed: 1, dur: 1.0, clipDur: 2.0,
    });

    // zoom 2 pinned on the top-left quadrant: the render must be (nearly) all white
    const sZoom = mkSection('q-zoom', { segments: seg(2, 0.25, 0.25) });
    const n1 = await renderPasses({ c: fakeC, ff, sections: [sZoom], W, H, fps: 30, workDir, log: () => {} });
    eq('cinema: the pass ran for the zoomed section', n1, 1);
    eq('cinema: the section now points at the processed clip', sZoom.src !== src && sZoom.speed === 1 && sZoom.clipStart === 0, true);
    const zoomY = yavgAt(sZoom.src, 0.5);
    ok('cinema: zoom 2 @ (0.25,0.25) fills the frame with the white quadrant', zoomY > 200, `YAVG ${zoomY}`);

    // zoom 1: the render matches the source's own mixed luma
    const sFlat = mkSection('q-flat', { segments: seg(1, 0.5, 0.5) });
    await renderPasses({ c: fakeC, ff, sections: [sFlat], W, H, fps: 30, workDir, log: () => {} });
    const flatY = yavgAt(sFlat.src, 0.5);
    const srcY = yavgAt(src, 0.5);
    near('cinema: zoom 1 preserves the source frame', flatY, srcY, 8);

    // cache: an identical invocation must not re-encode
    const before = fs.statSync(sZoom.src).mtimeMs;
    const sAgain = mkSection('q-zoom', { segments: seg(2, 0.25, 0.25) });
    await renderPasses({ c: fakeC, ff, sections: [sAgain], W, H, fps: 30, workDir, log: () => {} });
    eq('cinema: identical inputs hit the cache (same output file)', sAgain.src, sZoom.src);
    eq('cinema: cache hit performs no re-encode', fs.statSync(sAgain.src).mtimeMs, before);

    // the plan lands on disk, inspectable
    const planFile = path.join(workDir, 'cinema', 'q-zoom.camera.json');
    ok('cinema: the camera plan is written next to the render', fs.existsSync(planFile));
    const p = JSON.parse(fs.readFileSync(planFile, 'utf8'));
    eq('cinema: plan pinned to the section length', p.segments[p.segments.length - 1].t1, 1);
}

// 🎥 Integration: drive the instrumented actions against a real page and read the sidecar
//    back. This is the test that proves the sidecar is ground truth, not bookkeeping.
async function testTelemetryIntegration(dir) {
    let browser = null;
    try {
        const { chromium } = require('../lib/deps.cjs');
        browser = await chromium(path.join(__dirname, '..')).launch({ headless: true });
    } catch {
        results.push('  SKIP  telemetry integration (playwright not found)');
        return;
    }
    try {
        const { runAction } = require('../lib/commands/capture.cjs');
        const { createRecorder } = require('../lib/telemetry.cjs');
        const page = await browser.newPage({ viewport: { width: 640, height: 480 } });
        await page.setContent(`
            <button id="b" style="position:fixed;left:200px;top:120px;width:120px;height:40px;cursor:pointer">Go</button>
            <input id="q" style="position:fixed;left:60px;top:300px;width:200px;height:24px">`);

        const vp = { width: 640, height: 480 };
        const tel = createRecorder({ shot: 'itest', viewport: vp, layoutViewport: vp, captureZoom: 1 });
        tel.start();
        tel.navSettled();
        await page.mouse.move(320, 264);

        await runAction(page, { type: 'click', selector: '#b' }, 0, tel);
        await runAction(page, { type: 'type', selector: '#q', value: 'Acme', delay: 10 }, 1, tel);
        tel.settle();
        const file = tel.flush(dir);
        // the instrumented type must have really typed (semantics preserved, not just logged)
        eq('integration: the field holds the typed text', await page.inputValue('#q'), 'Acme');
        await page.close();

        const sc = JSON.parse(fs.readFileSync(file, 'utf8'));
        const types = sc.events.map((e) => e.type);
        eq('integration: event order is move,click,move,typeBurst,settle', types.join(','), 'move,click,move,typeBurst,settle');

        const click = sc.events.find((e) => e.type === 'click');
        // #b at 200,120 sized 120x40 in a 640x480 viewport
        near('integration: click box.x measured from the page', click.box.x, 200 / 640, 0.01);
        near('integration: click box.w measured from the page', click.box.w, 120 / 640, 0.01);
        eq('integration: cursorStyle read from the element css', click.cursorStyle, 'pointer');
        const move = sc.events.find((e) => e.type === 'move');
        ok('integration: the click transit lands inside the button box',
            move.to[0] >= click.box.x && move.to[0] <= click.box.x + click.box.w
            && move.to[1] >= click.box.y && move.to[1] <= click.box.y + click.box.h,
            `to=${JSON.stringify(move.to)}`);

        const burst = sc.events.find((e) => e.type === 'typeBurst');
        eq('integration: burst text', burst.text, 'Acme');
        eq('integration: one key per character', burst.keys.length, 4);
    } finally {
        await browser.close().catch(() => {});
    }
}

function testFrameBox() {
    // h264/yuv420p rejects odd dimensions, so every value out of here must be even.
    for (const [W, H, pad] of [[1440, 900, 64], [1440, 900, 0], [1920, 1080, 100], [1280, 720, 33]]) {
        const b = frameBox(W, H, pad);
        ok(`frameBox(${W},${H},${pad}) is all-even`,
            b.cw % 2 === 0 && b.ch % 2 === 0 && b.x % 2 === 0 && b.y % 2 === 0,
            JSON.stringify(b));
        ok(`frameBox(${W},${H},${pad}) fits inside the canvas`, b.cw <= W && b.ch <= H && b.x >= 0 && b.y >= 0);
    }
    const b = frameBox(1440, 900, 64);
    ok('frameBox preserves aspect ratio', Math.abs((b.cw / b.ch) - (1440 / 900)) < 0.01, `${b.cw}x${b.ch}`);
}

// --- main ----------------------------------------------------------------------------

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'newsreel-test-'));
(async () => {
    try {
        testStripJsonc();
        testBackground();
        testFrameBox();
        testPalettes();
        testValidator();
        testTelemetry();
        testCamera();
        testOverlayFormulas();

        let ff = null;
        try { ff = makeFf(bin('ffmpeg', 'FFMPEG_PATH'), bin('ffprobe', 'FFPROBE_PATH')); } catch { /* reported below */ }
        if (ff) testTrim(ff, dir);
        else results.push('  SKIP  the white-flash trim tests (ffmpeg not found)');

        await testTelemetryIntegration(dir);
        if (ff) await testCinemaPass(ff, dir);
        else results.push('  SKIP  cinema pass (ffmpeg not found)');
        if (ff) await testCinemaOverlays(ff, dir);
        else results.push('  SKIP  cinema overlays (ffmpeg not found)');

        console.log(`\n${results.join('\n')}\n`);
        console.log(`${passed} passed, ${failed} failed`);
        if (failed) process.exitCode = 1;
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
})();
