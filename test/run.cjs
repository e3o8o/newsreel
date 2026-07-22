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
try {
    testStripJsonc();
    testBackground();
    testFrameBox();
    testPalettes();
    testValidator();

    let ff = null;
    try { ff = makeFf(bin('ffmpeg', 'FFMPEG_PATH'), bin('ffprobe', 'FFPROBE_PATH')); } catch { /* reported below */ }
    if (ff) testTrim(ff, dir);
    else results.push('  SKIP  the white-flash trim tests (ffmpeg not found)');

    console.log(`\n${results.join('\n')}\n`);
    console.log(`${passed} passed, ${failed} failed`);
    if (failed) process.exitCode = 1;
} finally {
    fs.rmSync(dir, { recursive: true, force: true });
}
