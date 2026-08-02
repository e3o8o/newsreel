'use strict';
// The camera pass driver: the Node half of the compositor.
//
// Per camera-enabled shot, invoked BY assemble/compose after narration is measured (so it
// renders in output time and the processed clip needs no further trim or speed-fit):
//
//   1. plan   -- the sidecar becomes an inspectable <shot>.camera.json (or a user override
//                rides through normalizeOverride), then the spring bakes per-frame transforms.
//   2. frames -- ffmpeg extracts the source to an output-time JPEG sequence: -ss trim,
//                setpts/speed, fps, tpad clones the last frame through narration holds.
//                Numbered images instead of <video> seeking, deliberately: Playwright's
//                Chromium has no H.264 and VP9 currentTime seeks are asynchronous
//                approximations, while frame N of a sequence is exactly frame N.
//   3. render -- the compositor page draws each frame through the camera (plus blur; cursor
//                and overlays in later phases) and returns JPEGs, piped straight into a
//                spawned ffmpeg image2pipe encode.
//
// Everything is cached by content hash -- sha1 over the sidecar, the resolved config, the
// clip timing and the compositor bundle -- so a narration edit elsewhere re-renders nothing
// and a camera tweak re-renders only the shots it touches.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { chromium } = require('../deps.cjs');
const { ensureDir } = require('../util.cjs');
const { startVisualsServer } = require('../visuals.cjs');
const { plan, normalizeOverride } = require('./plan.cjs');
const { bake } = require('./spring.cjs');
const { styleForKind } = require('../kinds.cjs');

// Bump when the compositor's rendering changes: it is part of the cache key, so stale
// passes re-render instead of surviving on a hash that no longer describes them.
const PASS_VERSION = 2;

// Screenize's blur model: trigger thresholds in camera units/s, radius scale, hard cap.
const BLUR = { panThreshold: 0.25, zoomThreshold: 1.0, panScale: 30, zoomScale: 8, maxRadius: 10 };

// ── per-shot camera config resolution ────────────────────────────────────────────────
// Precedence: shots[].camera > video.camera. A shot saying "off" wins everything; a shot
// with its own object enables the pass even without video.camera. Kinds tune these numbers
// in phase 6, but they never activate the camera on their own.
function cameraFor(c, shotCamera) {
    const videoCam = c.get('video.camera', undefined);
    if (shotCamera === 'off') return null;
    if (shotCamera === undefined && videoCam === undefined) return null;
    const base = (videoCam && typeof videoCam === 'object') ? videoCam : {};
    const over = (shotCamera && typeof shotCamera === 'object') ? shotCamera : {};
    const merged = { ...base, ...over };
    if (merged.mode === 'off') return null;
    return {
        mode: merged.mode || 'auto',
        intensity: merged.intensity ?? 1,
        maxZoom: merged.maxZoom ?? 2.2,
        response: merged.response,
        zoomResponse: merged.zoomResponse,
        motionBlur: merged.motionBlur ?? 0.35,
        holdLastFrame: merged.holdLastFrame !== false,
        segments: Array.isArray(over.segments) ? over.segments
            : Array.isArray(merged.segments) ? merged.segments : null,
    };
}

// ── overlay (cursor + click effects) resolution ──────────────────────────────────────
// Presence of style.cursor / style.clicks enables the pass even without a camera: the
// overlays render over an identity camera at zoom 1, which is valid and cheap.
function overlaysFor(c) {
    const style = styleForKind(c.get('video.kind'), c.get('style', {}));
    const accent = style.accent || '#22c55e';
    const cur = c.get('style.cursor', undefined);
    const clk = c.get('style.clicks', undefined);
    const cursor = cur === undefined ? null : {
        show: cur.show !== false && cur.style !== 'none',
        style: cur.style || 'auto',
        scale: cur.scale ?? 2.0,
        smoothing: cur.smoothing ?? 0.67,
        clickBounce: cur.clickBounce ?? 2.5,
        color: cur.color || null,
        accent,
    };
    const clicks = clk === undefined ? null : {
        effect: clk.effect || 'ripple',
        color: clk.color || accent,
        scale: clk.scale ?? 1,
        opacity: clk.opacity ?? 1,
        durationMs: clk.durationMs ?? 600,
        cursorScale: (cur && cur.scale) ?? 2.0,
    };
    const active = (cursor && cursor.show) || (clicks && clicks.effect !== 'none');
    return active ? { cursor, clicks } : null;
}

// The sidecar's raw-clock events, mapped to output time for the compositor: the dense cursor
// track (park point plus every transit sample), the cursor-style spans, and the click marks
// that drive squash and effects.
function buildOverlayData(sidecar, clip) {
    const map = (ms) => (ms / 1000 - clip.trimStart) / clip.speed;
    const track = [];
    const styles = [];
    const clicks = [];
    if (sidecar.start) track.push([0, sidecar.start.x, sidecar.start.y]);
    for (const e of sidecar.events || []) {
        if (e.type === 'move' && Array.isArray(e.path)) {
            for (const [ms, x, y] of e.path) {
                const t = map(ms);
                if (t >= 0 && t <= clip.durOut) track.push([t, x, y]);
            }
        } else if (e.type === 'click' || e.type === 'dblclick') {
            const t = map(e.t);
            if (t < 0 || t > clip.durOut) continue;
            clicks.push({ t, x: e.at[0], y: e.at[1] });
            // the pointer shape shows from roughly the transit through a beat after the click
            styles.push({ t0: Math.max(0, t - 0.9 / clip.speed), t1: t + 0.4, style: e.cursorStyle || 'arrow' });
        } else if (e.type === 'typeBurst' || e.type === 'fill') {
            const t0 = map(e.t0 ?? e.t), t1 = map(e.t1 ?? e.t0 ?? e.t);
            if (t1 < 0 || t0 > clip.durOut) continue;
            styles.push({ t0: Math.max(0, t0 - 0.3), t1: t1 + 0.3, style: 'text' });
        }
    }
    track.sort((a, b) => a[0] - b[0]);
    return { track, styles, clicks };
}

function readSidecar(clipsDir, shotId) {
    try {
        const p = path.join(clipsDir, `${shotId}.events.json`);
        return JSON.parse(fs.readFileSync(p, 'utf8'));
    } catch { return null; }
}

const sha1 = (v) => crypto.createHash('sha1').update(v).digest('hex');

// ── one shot's pass ──────────────────────────────────────────────────────────────────
// section: { name, src, clipStart, speed, dur } from assemble's planning.
// Returns { out, planFile, cached } or null when the pass cannot run for this shot.
async function renderShotPass({ ff, page, serverUrl, cinemaDir, section, sidecar, camCfg, overlays, W, H, fps, log }) {
    const clip = {
        trimStart: section.clipStart || 0,
        speed: section.speed || 1,
        durOut: section.dur,
        fps,
    };

    // the plan: an override rides normalizeOverride; the planner reads the sidecar; and an
    // overlays-only pass gets an identity camera (one hold at zoom 1)
    let camPlan;
    const blurAmount = camCfg ? camCfg.motionBlur : 0;
    if (camCfg && camCfg.segments) {
        const { plan: p, warnings } = normalizeOverride(camCfg.segments, clip, camCfg);
        for (const w of warnings) log(`  camera ${section.name}: ${w}`);
        camPlan = p;
    } else if (camCfg) {
        if (!sidecar) return null;   // caller decides how loudly to say why
        camPlan = plan(sidecar.events, clip, camCfg);
    } else {
        camPlan = normalizeOverride([], clip, { maxZoom: 1 }).plan;
    }
    camPlan.shot = section.name;

    const planFile = path.join(cinemaDir, `${section.name}.camera.json`);
    fs.writeFileSync(planFile, JSON.stringify(camPlan, null, 2));

    const overlayData = overlays && sidecar ? buildOverlayData(sidecar, clip) : null;

    const hash = sha1(JSON.stringify({
        v: PASS_VERSION,
        events: sidecar ? sha1(JSON.stringify(sidecar.events)) : 'override',
        plan: camPlan.segments,
        cfg: camCfg
            ? { intensity: camCfg.intensity, maxZoom: camCfg.maxZoom, motionBlur: camCfg.motionBlur }
            : null,
        overlays: overlays ? { cursor: overlays.cursor, clicks: overlays.clicks } : null,
        clip, W, H,
    })).slice(0, 12);
    const out = path.join(cinemaDir, `${section.name}-${hash}.mp4`);
    if (fs.existsSync(out)) return { out, planFile, cached: true };

    // ── frames: source -> output-time JPEG sequence ─────────────────────────────────
    const framesDir = path.join(cinemaDir, `frames-${section.name}`);
    fs.rmSync(framesDir, { recursive: true, force: true });
    ensureDir(framesDir);
    const frameCount = Math.max(1, Math.round(clip.durOut * fps));
    const setpts = clip.speed !== 1
        ? `setpts=(PTS-STARTPTS)/${clip.speed.toFixed(6)}`
        : 'setpts=PTS-STARTPTS';
    ff.run(['-y', '-loglevel', 'error',
        '-ss', clip.trimStart.toFixed(3), '-i', section.src,
        '-vf', `${setpts},fps=${fps},scale=${W}:${H},` +
            `tpad=stop_mode=clone:stop_duration=${(clip.durOut + 2).toFixed(3)}`,
        '-frames:v', String(frameCount), '-q:v', '3',
        path.join(framesDir, 'f%05d.jpg')]);

    // ⚠️ tpad clones only when the source had at least one frame past the trim; a clip cut
    //    exactly at its end can come up short. Pad by duplicating the last written frame.
    let written = fs.readdirSync(framesDir).filter((f) => f.endsWith('.jpg')).length;
    if (written === 0) throw new Error(`frame extraction produced nothing for ${section.name}`);
    for (; written < frameCount; written++) {
        fs.copyFileSync(
            path.join(framesDir, `f${String(written).padStart(5, '0')}.jpg`),
            path.join(framesDir, `f${String(written + 1).padStart(5, '0')}.jpg`));
    }

    // ── bake + render ───────────────────────────────────────────────────────────────
    const transforms = bake(camPlan, camCfg || {}).map((t) => ({
        zoom: t.zoom, cx: t.cx, cy: t.cy, vx: t.vx, vy: t.vy, vz: t.vz,
    }));

    await page.goto(`${serverUrl}/cinema/cinema.html`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__CINEMA_READY__ === true, null, { timeout: 15000 });
    await page.evaluate((spec) => window.__CINEMA__.init(spec), {
        framesBase: `/work/frames-${section.name}/`,
        frameCount, width: W, height: H, fps,
        transforms,
        blur: { amount: blurAmount, ...BLUR },
        jpegQuality: 0.9,
        cursor: overlayData && overlays.cursor && overlays.cursor.show
            ? { cfg: overlays.cursor, track: overlayData.track, styles: overlayData.styles, clicks: overlayData.clicks }
            : null,
        clicks: overlayData && overlays.clicks && overlays.clicks.effect !== 'none'
            ? { cfg: overlays.clicks, clicks: overlayData.clicks }
            : null,
    });

    // ⚠️ image2pipe cannot probe a codec out of a pipe: without the explicit input `-c:v
    //    mjpeg` it concludes "no decoder found for: none" and exits before the first frame
    //    (which then surfaces as a confusing EPIPE on our side, not as its own error).
    const enc = spawn(ff.bin, ['-y', '-loglevel', 'error',
        '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
        '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p',
        out]);
    // If the encoder dies mid-run, the failure must surface as ITS error, not as an EPIPE
    // from our next write (and never as an unhandled rejection during teardown).
    let encError = null;
    const encDone = new Promise((resolve) => {
        let err = '';
        enc.stderr.on('data', (d) => { err += d; });
        enc.on('close', (code) => {
            if (code !== 0) encError = new Error(`encode failed: ${err.slice(0, 400)}`);
            resolve();
        });
        enc.on('error', (e) => { encError = e; resolve(); });
    });
    enc.stdin.on('error', () => { /* EPIPE after an encoder death; encError carries the cause */ });

    for (let i = 0; i < frameCount && !encError; i++) {
        const dataUrl = await page.evaluate((n) => window.__CINEMA__.renderFrame(n), i);
        const buf = Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64');
        if (!enc.stdin.write(buf)) {
            await new Promise((r) => enc.stdin.once('drain', r));
        }
    }
    enc.stdin.end();
    await encDone;
    if (encError) throw encError;

    fs.rmSync(framesDir, { recursive: true, force: true });
    return { out, planFile, cached: false };
}

// ── the pass over all camera sections ────────────────────────────────────────────────
// Mutates each processed section in place: src becomes the rendered clip, trim and speed
// collapse to identity, and shots[].motion is retired for that section (the camera replaced
// it). Sections it cannot process are left exactly as they were.
async function renderPasses({ c, ff, sections, W, H, fps, workDir, log = console.log }) {
    const jobs = [];
    const clipsDir = path.join(workDir, 'clips');
    const overlays = overlaysFor(c);
    for (const s of sections) {
        if (s.type !== 'clip') continue;
        const camCfg = cameraFor(c, s.camera);
        if (!camCfg && !overlays) continue;
        const sidecar = readSidecar(clipsDir, s.name);
        if (!sidecar && !(camCfg && camCfg.segments)) {
            log(`  camera ${s.name}: no events sidecar (captured before telemetry?); pass skipped. ` +
                `Re-capture:  newsreel capture --config ${c.file} --only ${s.name}`);
            continue;
        }
        jobs.push({ s, camCfg, sidecar });
    }
    if (!jobs.length) return 0;

    const launcher = chromium(c.root, { soft: true });
    if (!launcher) {
        log('WARN: video.camera is set but Playwright is not installed; rendering without the camera pass.');
        return 0;
    }

    const cinemaDir = ensureDir(path.join(workDir, 'cinema'));
    const server = await startVisualsServer({ mounts: { '/work': cinemaDir } });
    const browser = await launcher.launch({ headless: true });
    // deviceScaleFactor 1: the canvas is already at output resolution
    const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
    let rendered = 0;
    try {
        for (const { s, camCfg, sidecar } of jobs) {
            const t0 = Date.now();
            const res = await renderShotPass({
                ff, page, serverUrl: server.url, cinemaDir,
                section: s, sidecar, camCfg, overlays, W, H, fps, log,
            });
            if (!res) continue;
            s.src = res.out;
            s.clipStart = 0;
            s.speed = 1;
            s.clipDur = s.dur;
            if (s.motion) {
                log(`  camera ${s.name}: shots[].motion ignored (the camera pass replaces it)`);
                s.motion = null;
            }
            s.cinema = true;
            rendered++;
            log(`  camera ${s.name}: ${res.cached ? 'cached' : `rendered in ${((Date.now() - t0) / 1000).toFixed(1)}s`} -> ${path.basename(res.out)}`);
        }
    } finally {
        await browser.close().catch(() => {});
        await server.close();
    }
    return rendered;
}

module.exports = { cameraFor, overlaysFor, buildOverlayData, renderPasses, renderShotPass, PASS_VERSION, BLUR };
