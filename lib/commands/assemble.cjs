'use strict';
// Assemble the demo video: styled frame + speed-fit + voiceover + ambient bed + thumbnail.
//
// Config keys: project, output.workDir, output.videoDir, capture.viewport,
//              style.{background,padding,radius,shadow,accent,theme},
//              voice.* (see lib/voice), music.* (see lib/music),
//              video.{targetSeconds,maxSpeed,title,thumbnail,narration?},
//              shots[] (id, narration, caption), closingCard.{title,lines,narration?}
//
// Order of operations matters; each of these is load-bearing (see the README's Gotchas):
//   1. trim each clip's blank page-load lead     -> firstContentTime()
//   2. render the styled frame from `style`      -> renderFrameAssets()
//   3. speed each clip to fit its narration      -> planSections()
//   4. hard-cut concat over an opaque frame      -> concat lists, no xfade anywhere

const fs = require('fs');
const path = require('path');
const { chromium, ffmpeg } = require('../deps.cjs');
const { backgroundCss, backgroundFlat, frameBox, initRandom } = require('../style.cjs');
const { styleForKind } = require('../kinds.cjs');
const { renderPasses } = require('../camera/render.cjs');
const { ensureDir, stamp, fail } = require('../util.cjs');
const { voiceSetup } = require('../voice/index.cjs');
const { musicSetup, musicBed } = require('../music/index.cjs');
const { narrate } = require('../narrate.cjs');

const FPS = 30;
const MIN_SPEED = 1.5;             // never crawl; a short clip holds its last frame instead
const CLIP_TAIL = 0.7;             // breathing room after a clip's narration
const CARD_TAIL = 1.0;             // ... and after a card's
const GEN_MIN = 3.2;               // floor for a generated scene, so a short line still reads
const VO_LEAD_MS = 300;            // narration starts just after the cut
const ENC = ['-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', '-r', String(FPS)];
const OUT_NAME = 'launch-video.mp4';

// ⚠️ THE WHITE-FLASH FIX. Every captured clip starts with the browser's blank page-load
//    (black, then white, then the app). That blank lead is the "flash between scenes" --
//    it is not a transition bug. Find the first frame where the UI has actually painted and
//    -ss trim everything before it, so each scene cuts straight into content.
//
//    The signal is STRUCTURE, not brightness, which is what makes it theme-agnostic: a blank
//    page-load frame is near-uniform whichever colour it is (black YMIN==YMAX==16, white
//    YMIN==YMAX==235, so range ~0), while any real UI has text and chrome and therefore a
//    large luma range. Measured on synthetic clips: blank frames range 0, a dark UI 184, a
//    light UI 192. So: skip the leading near-uniform frames, cut at the first structured one.
//    Keying on brightness instead (the old signal) only ever worked for dark UIs -- a light
//    app's YAVG stays up at ~214 and never crosses back down, so nothing was trimmed.
//
//    ffmpeg's signalstats exposes lavfi.signalstats.{YMIN,YAVG,YMAX} per frame, printed after
//    that frame's pts_time line, YMAX last -- so YMAX closes each frame's record.
const UNIFORM_RANGE = 24;      // YMAX-YMIN below this = a blank frame, whatever its colour
// A LOADING page (a bright body with a flat sidebar/gutter, no real content yet) passes the
// range test because white-to-gray already spans > UNIFORM_RANGE. But a real UI, dark OR
// light, always paints near-black text somewhere, so its range is much larger (~185+) and its
// darkest pixel is genuinely dark. A bright frame whose darkest pixel is only mid-gray is a
// loading screen, not content. These two thresholds skip it without touching either theme:
// a dark UI is not bright (low YAVG), a light UI still has dark text (low YMIN).
const LOAD_BRIGHT = 170;       // YAVG above this = a bright, white-dominated frame
const LOAD_MIN_DARK = 70;      // ... and if its YMIN never drops below this, nothing dark painted
function firstContentTime(ff, clip) {
    const out = ff.probeText(['-hide_banner', '-i', clip, '-vf', 'signalstats,metadata=print', '-f', 'null', '-']);
    let t = 0, ymin = null, yavg = null;
    for (const line of out.split('\n')) {
        const mt = line.match(/pts_time:([\d.]+)/);
        if (mt) { t = parseFloat(mt[1]); ymin = yavg = null; continue; }
        const mn = line.match(/lavfi\.signalstats\.YMIN=([\d.]+)/);
        if (mn) { ymin = parseFloat(mn[1]); continue; }
        const ma = line.match(/lavfi\.signalstats\.YAVG=([\d.]+)/);
        if (ma) { yavg = parseFloat(ma[1]); continue; }
        const mx = line.match(/lavfi\.signalstats\.YMAX=([\d.]+)/);
        if (!mx || ymin === null || yavg === null) continue;
        const range = parseFloat(mx[1]) - ymin;
        if (range < UNIFORM_RANGE) continue;                       // blank frame
        if (yavg > LOAD_BRIGHT && ymin > LOAD_MIN_DARK) continue;  // bright loading screen
        return t; // the app has actually painted
    }
    return 0; // never found a structured frame -> trim nothing rather than cut wrongly
}

// The styled frame (the BetterShot look), as two PNGs:
//   bg   - the gradient plus the drop shadow, painted where the clip will land
//   mask - a white rounded rect on black, alphamerged onto the clip for rounded corners
// Rendered in Chromium so the CSS is the single source of truth for the look.
async function renderFrameAssets(c, ff, W, H, style, box, dir) {
    const { cw, ch, x, y } = box;
    const radius = Math.max(0, Number(style.radius) || 0);
    const shadow = Number(style.shadow) === 0 ? 0 : (Number(style.shadow) || 0.35);
    const bgPath = path.join(dir, 'frame-bg.png');
    const maskPath = path.join(dir, 'frame-mask.png');

    const launch = chromium(c.root, { soft: true });
    if (launch) {
        const browser = await launch.launch();
        try {
            const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
            await page.setContent(`<html><body><style>
                *{margin:0;padding:0;box-sizing:border-box}
                .bg{width:${W}px;height:${H}px;background:${backgroundCss(style)};position:relative;overflow:hidden}
                .sh{position:absolute;left:${x}px;top:${y}px;width:${cw}px;height:${ch}px;
                    border-radius:${radius}px;box-shadow:0 24px 64px rgba(0,0,0,${shadow});}
            </style><div class="bg"><div class="sh"></div></div></body></html>`, { waitUntil: 'networkidle' });
            await page.screenshot({ path: bgPath });

            await page.setViewportSize({ width: cw, height: ch });
            await page.setContent(`<html><body><style>
                *{margin:0;padding:0}
                html,body{width:${cw}px;height:${ch}px;background:#000}
                .m{width:${cw}px;height:${ch}px;background:#fff;border-radius:${radius}px}
            </style><div class="m"></div></body></html>`, { waitUntil: 'networkidle' });
            await page.screenshot({ path: maskPath });
        } finally {
            await browser.close().catch(() => {});
        }
        return { bg: bgPath, mask: radius > 0 ? maskPath : null };
    }

    // ⚠️ Degraded path: no Chromium here, so flat colour and square corners. The video still
    //    builds (and stays flash-free, which is what matters) but loses the gradient/rounding.
    console.warn('WARN: Playwright not available; falling back to a flat frame (no gradient, no rounding).');
    const flat = `0x${backgroundFlat(style).replace('#', '')}`;
    ff.run(['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', `color=c=${flat}:s=${W}x${H}`, '-frames:v', '1', bgPath]);
    return { bg: bgPath, mask: null };
}

// --- planning ------------------------------------------------------------------------

const qq = (p) => `'${p.replace(/'/g, "'\\''")}'`; // concat-list quoting

function buildSections(c, clipsDir, cardsDir) {
    const shots = c.req('shots');
    const sections = [];
    const titleCard = path.join(cardsDir, 'card-title.png');
    if (!fs.existsSync(titleCard)) {
        fail(`No cards found at ${cardsDir}\nRun cards first:\n  newsreel cards --config ${c.file}`);
    }
    // Card narration is optional and falls back to the card's own text.
    sections.push({
        name: '_title',
        type: 'card',
        src: titleCard,
        vo: c.get('video.narration', c.get('video.title', 'What shipped this week')),
        narrator: c.get('video.narrator', null),
    });

    for (const s of shots) {
        const clip = path.join(clipsDir, `${s.id}.webm`);
        if (!fs.existsSync(clip)) {
            console.warn(`WARN: no clip for shot "${s.id}" (${clip}); skipping. ` +
                `Re-run:  newsreel capture --config ${c.file} --only ${s.id}`);
            continue;
        }
        const lowerPng = path.join(cardsDir, `lower-${s.id}.png`);
        sections.push({
            // Generated scenes are full compositions: they render full-bleed at
            // native speed (a title choreographed at 1x is ruined at 1.5x),
            // holding their last frame if the narration outlives the take.
            name: s.id,
            type: s.type === 'generated' ? 'generated' : 'clip',
            src: clip,
            lowerPng: fs.existsSync(lowerPng) ? lowerPng : null,
            vo: s.narration || s.caption || '',
            narrator: s.narrator || null,
            motion: s.motion || null,
            trimBefore: Number(s.trimBefore) || 0,
            camera: s.camera,
        });
    }
    if (sections.length < 2) fail(`No usable clips in ${clipsDir}. Run capture first.`);

    const closing = c.get('closingCard');
    const closingCard = path.join(cardsDir, 'card-closing.png');
    if (closing && closing.title && fs.existsSync(closingCard)) {
        const lines = Array.isArray(closing.lines) ? closing.lines : [];
        sections.push({
            name: '_closing',
            type: 'card',
            src: closingCard,
            vo: closing.narration || [closing.title, ...lines].join('. '),
            narrator: closing.narrator || null,
        });
    }
    return sections;
}

async function planSections(sections, { ff, voice, tmp, maxSpeed, cacheDir }) {
    // 1) voiceover -> each section's natural length (shared with compose; lib/narrate.cjs)
    await narrate(sections, { ff, voice, tmp, cacheDir });
    for (const s of sections) {
        if (s.type === 'generated') {
            // 🎬 NARRATION DRIVES THE CUT. A generated scene plays at native speed (its
            //    choreography is the point, so it is never speed-fitted) and the section ends
            //    when the line ends. That keeps voice and picture in sync instead of leaving a
            //    frozen last frame under trailing narration, or dead air under a long take --
            //    so capture these GENEROUSLY (shots[].duration) and let the cut land here.
            //    A floor keeps a very short line from flashing a scene past the eye.
            s.clipStart = Math.max(firstContentTime(ff, s.src), s.trimBefore || 0);
            s.clipDur = Math.max(0.2, ff.duration(s.src) - s.clipStart);
            s.dur = s.voDur > 0
                ? Math.max(s.voDur + CLIP_TAIL, GEN_MIN)
                : s.clipDur;
            s.speed = 1;
            s.holds = s.clipDur < s.dur - 0.05;
            s.trails = s.clipDur > s.dur + 0.05; // captured longer than needed; cut early
            continue;
        }
        if (s.type !== 'clip') { s.dur = s.voDur + CARD_TAIL; continue; }

        // 2) trim the blank page-load lead before measuring anything. The auto
        //    trim only removes NEAR-UNIFORM frames, so a dark theme's loading
        //    skeletons (structured) survive it; shots[].trimBefore is the manual
        //    override for cutting straight to loaded content.
        s.clipStart = Math.max(firstContentTime(ff, s.src), s.trimBefore || 0);
        s.clipDur = Math.max(0.2, ff.duration(s.src) - s.clipStart);

        // 3) fit the clip to its narration, speed bounded by [MIN_SPEED, maxSpeed].
        //    dur >= clipDur/maxSpeed guarantees we never exceed maxSpeed; if that leaves the
        //    sped clip shorter than the narration, overlay's eof_action=repeat holds the last
        //    frame for the remainder rather than dropping below MIN_SPEED.
        s.dur = Math.max(s.voDur + CLIP_TAIL, s.clipDur / maxSpeed);
        s.speed = Math.min(Math.max(s.clipDur / s.dur, MIN_SPEED), maxSpeed);
        s.holds = s.clipDur / s.speed < s.dur - 0.05;
    }
    return sections;
}

// --- main ----------------------------------------------------------------------------

async function run(c) {
    const ff = ffmpeg();

    const { width: W, height: H } = c.get('capture.viewport', { width: 1440, height: 900 });
    const style = styleForKind(c.get('video.kind'), c.get('style', {}));

    // style.background.image is a path in the config, so it resolves against the config file's
    // directory like every other path here, never the shell's cwd.
    if (style.background && style.background.image) {
        style.background = { ...style.background, image: c.resolve(style.background.image) };
    }
    const maxSpeed = Math.max(MIN_SPEED, Number(c.get('video.maxSpeed', 3)) || 3);
    const target = Number(c.get('video.targetSeconds', 0)) || 0;
    const date = typeof c.args.date === 'string' ? c.args.date : stamp();

    const workDir = c.resolve(c.req('output.workDir'));
    const clipsDir = path.join(workDir, 'clips');
    const cardsDir = path.join(workDir, 'cards');
    const tmp = ensureDir(path.join(workDir, 'assemble'));
    initRandom(workDir, { reroll: Boolean(c.args.reroll) });
    const outDir = ensureDir(path.join(c.resolve(c.req('output.videoDir')), date));

    // Validate both audio configs up front: a dead Voicebox or a bad music block should fail
    // before anything renders, and long before mirelo could spend a credit.
    const voice = await voiceSetup(c);
    const music = musicSetup(c);
    // Reserve a band at the bottom for the lower-third so it never overlaps the screen.
    // Matches the caption's own footprint (bottom:56 + ~1-line bar). Configurable via
    // style.captionBand for taller captions.
    const captionBand = Number(c.get('style.captionBand', 150));
    const box = frameBox(W, H, style.padding, captionBand);
    const frame = await renderFrameAssets(c, ff, W, H, style, box, tmp);

    const sections = await planSections(buildSections(c, clipsDir, cardsDir),
        // the voice cache lives in workDir, not the per-run tmp: it must survive re-cuts
        { ff, voice, tmp, maxSpeed, cacheDir: path.join(workDir, 'vo-cache') });

    // 🎥 The cinema pass: camera-enabled sections are re-rendered (camera transform, and in
    //    later phases cursor/effects/badges) in OUTPUT time, then flow through the styled
    //    frame below as ordinary clips with trim 0 and speed 1. Runs after narration is
    //    measured because the camera animates on the final clock; a shot it cannot process
    //    is left exactly as it was.
    await renderPasses({ c, ff, sections, W, H, fps: FPS, workDir });

    const TOTAL = sections.reduce((a, s) => a + s.dur, 0);

    console.log('sections:');
    for (const s of sections) {
        const bits = [];
        if (s.speed) bits.push(`${s.speed.toFixed(2)}x`);
        if (s.clipStart) bits.push(`trimmed white lead @${s.clipStart.toFixed(2)}s`);
        if (s.cinema) bits.push('camera');
        if (s.holds) bits.push('holds last frame');
        if (s.trails) bits.push('cut to narration');
        console.log(`  ${s.name.padEnd(18)} ${s.dur.toFixed(2)}s${bits.length ? `  [${bits.join(', ')}]` : ''}`);
    }
    console.log(`TOTAL ${TOTAL.toFixed(2)}s${target ? ` (target ${target}s)` : ''}`);
    if (target && TOTAL > target) {
        console.warn(`WARN: ${(TOTAL - target).toFixed(1)}s over target. Narration drives length; ` +
            `trim narration, drop a shot, or raise video.maxSpeed (now ${maxSpeed}).`);
    }

    // --- video segments ---------------------------------------------------------------
    // Cards are full-bleed by design; clips get the styled frame.
    for (const s of sections) {
        const out = path.join(tmp, `seg-${s.name}.mp4`);
        s.seg = out;
        if (s.type === 'card') {
            ff.run(['-y', '-loglevel', 'error', '-loop', '1', '-i', s.src, '-t', s.dur.toFixed(3),
                '-vf', `scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=${FPS}`,
                ...ENC, out]);
            continue;
        }
        if (s.type === 'generated') {
            // Full-bleed, native speed. tpad clones the last frame so a longer
            // narration never runs the video dry; -t bounds the section.
            const inputs = ['-ss', s.clipStart.toFixed(3), '-i', s.src];
            let f = `scale=${W}:${H}:force_original_aspect_ratio=decrease,` +
                `pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=${FPS},` +
                `tpad=stop_mode=clone:stop_duration=${Math.max(0, s.dur - s.clipDur + 1).toFixed(3)}`;
            if (s.lowerPng) {
                ff.run(['-y', '-loglevel', 'error', ...inputs, '-loop', '1', '-i', s.lowerPng,
                    '-filter_complex', `[0:v]${f}[v];[v][1:v]overlay=0:0[o]`,
                    '-map', '[o]', '-an', '-t', s.dur.toFixed(3), ...ENC, out]);
            } else {
                ff.run(['-y', '-loglevel', 'error', ...inputs, '-vf', f,
                    '-an', '-t', s.dur.toFixed(3), ...ENC, out]);
            }
            continue;
        }

        const inputs = [];
        let n = 0;
        inputs.push('-loop', '1', '-i', frame.bg); const iBg = n++;
        inputs.push('-ss', s.clipStart.toFixed(3), '-i', s.src); const iClip = n++;
        let iMask = -1, iLower = -1;
        if (frame.mask) { inputs.push('-loop', '1', '-i', frame.mask); iMask = n++; }
        if (s.lowerPng) { inputs.push('-loop', '1', '-i', s.lowerPng); iLower = n++; }

        // 🎥 Optional per-shot motion: a slow push-in over the whole section keeps the
        //    frame alive and draws the eye toward `focus` (fractions of the clip, [x, y];
        //    default center). zoompan runs on the already-scaled clip: z ramps linearly
        //    from 1 to `to` across the section's duration, so the motion always lands
        //    exactly when the narration does. Zooming crops, so keep `to` subtle (≤1.15).
        let motionF = '';
        if (s.motion) {
            const m = typeof s.motion === 'string' ? { type: s.motion } : s.motion;
            if (m.type === 'in') {
                const to = Math.min(Number(m.to) || 1.06, 1.3);
                const [fx, fy] = Array.isArray(m.focus) ? m.focus : [0.5, 0.5];
                const frames = Math.max(1, Math.round(s.dur * FPS));
                motionF = `,zoompan=z='min(1+${(to - 1).toFixed(4)}*on/${frames},${to.toFixed(4)})'` +
                    `:x='(iw-iw/zoom)*${Number(fx).toFixed(3)}':y='(ih-ih/zoom)*${Number(fy).toFixed(3)}'` +
                    `:d=1:s=${box.cw}x${box.ch}:fps=${FPS}`;
            }
        }
        const clipF = `setpts=PTS/${s.speed.toFixed(6)},scale=${box.cw}:${box.ch}${motionF},setsar=1,fps=${FPS}`;
        const chain = [`[${iBg}:v]scale=${W}:${H},setsar=1,fps=${FPS}[bg]`];
        if (iMask >= 0) {
            chain.push(`[${iClip}:v]${clipF},format=yuva420p[c]`);
            chain.push(`[${iMask}:v]format=gray,scale=${box.cw}:${box.ch}[m]`);
            chain.push('[c][m]alphamerge[r]');
            chain.push(`[bg][r]overlay=${box.x}:${box.y}[f]`);
        } else {
            chain.push(`[${iClip}:v]${clipF}[c]`);
            chain.push(`[bg][c]overlay=${box.x}:${box.y}[f]`);
        }
        let last = 'f';
        if (iLower >= 0) { chain.push(`[f][${iLower}:v]overlay=0:0[o]`); last = 'o'; }

        // -t bounds the (infinite, looped-bg) graph; overlay's default eof_action=repeat
        // freezes the clip's last frame if the narration outlives it.
        ff.run(['-y', '-loglevel', 'error', ...inputs, '-filter_complex', chain.join(';'),
            '-map', `[${last}]`, '-an', '-t', s.dur.toFixed(3), ...ENC, out]);
    }

    // --- audio segments ---------------------------------------------------------------
    for (const s of sections) {
        const out = path.join(tmp, `aud-${s.name}.wav`);
        s.aud = out;
        if (s.voFile) {
            ff.run(['-y', '-loglevel', 'error', '-i', s.voFile,
                '-af', `adelay=${VO_LEAD_MS}|${VO_LEAD_MS},apad`, '-t', s.dur.toFixed(3),
                '-ar', '44100', '-ac', '2', out]);
        } else {
            // provider "none": silence keeps one code path through the mix
            ff.run(['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo',
                '-t', s.dur.toFixed(3), out]);
        }
    }

    // --- concat (HARD CUTS) -----------------------------------------------------------
    // ⚠️ No xfade/fade anywhere. A fade-from-transparent is what exposed the white page-load
    //    in the first place; every segment is already opaque and full-frame, so cuts are clean
    //    and frame 0 is the fully rendered title card (a real poster, not a black frame).
    const vlist = path.join(tmp, 'vlist.txt'), alist = path.join(tmp, 'alist.txt');
    fs.writeFileSync(vlist, sections.map((s) => `file ${qq(s.seg)}`).join('\n'));
    fs.writeFileSync(alist, sections.map((s) => `file ${qq(s.aud)}`).join('\n'));
    const videoOnly = path.join(tmp, 'video.mp4'), voAll = path.join(tmp, 'voiceover.wav');
    ff.run(['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', vlist, ...ENC, '-movflags', '+faststart', videoOnly]);
    ff.run(['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', alist, '-ar', '44100', '-ac', '2', voAll]);

    // --- ambient bed ------------------------------------------------------------------
    // The bed comes back already looped/trimmed to TOTAL, ducked to music.gainDb and faded,
    // so every provider mixes identically here. null means music.provider is "none".
    const bed = await musicBed(music, { ff, workDir, tmp, seconds: TOTAL });
    const soundtrack = path.join(tmp, 'soundtrack.wav');
    if (bed) {
        ff.run(['-y', '-loglevel', 'error', '-i', voAll, '-i', bed,
            '-filter_complex', '[0:a][1:a]amix=inputs=2:duration=first:normalize=0,dynaudnorm=p=0.6[a]',
            '-map', '[a]', soundtrack]);
    } else {
        ff.run(['-y', '-loglevel', 'error', '-i', voAll, '-af', 'dynaudnorm=p=0.6', soundtrack]);
    }

    // --- mux --------------------------------------------------------------------------
    const outFile = path.join(outDir, OUT_NAME);
    ff.run(['-y', '-loglevel', 'error', '-i', videoOnly, '-i', soundtrack,
        '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', outFile]);

    // ⚠️ Poster: without it players show a black frame before play. The title card is frame 0
    //    (hard cuts, no fade-in), so the poster matches the first frame exactly.
    if (c.get('video.thumbnail', true)) {
        ff.run(['-y', '-loglevel', 'error', '-i', path.join(cardsDir, 'card-title.png'),
            '-vf', `scale=${W}:${H}`, '-frames:v', '1', path.join(outDir, 'thumbnail.jpg')]);
    }

    console.log(`\nDONE -> ${outFile}`);
    console.log(`final: ${ff.duration(outFile).toFixed(2)}s, ${(fs.statSync(outFile).size / 1e6).toFixed(1)}MB`);
    if (c.get('video.thumbnail', true)) console.log(`poster: ${path.join(outDir, 'thumbnail.jpg')}`);
    return outFile;
}

// firstContentTime is exported because it is the one piece here with a real algorithm: it can
// be exercised against fixture clips without building a video.
module.exports = { run, firstContentTime, UNIFORM_RANGE };
