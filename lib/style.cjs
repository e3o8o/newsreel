'use strict';
// The styled frame's look: background (preset or custom), card palette, frame geometry.
//
// `bettershot-presets.json` carries BetterShot's own palette, lifted from its source rather
// than forked: 16 three-stop gradients and 12 solids, each usable by id. See the README's
// third-party notice.

const path = require('path');
const { fail, even, even0 } = require('./util.cjs');

const PRESETS_FILE = path.join(__dirname, '..', 'assets', 'bettershot-presets.json');

let _presets = null;
function presets() {
    if (_presets) return _presets;
    // Shipped inside the package (see package.json "files"); a failure here means a broken install.
    let raw;
    try {
        raw = require(PRESETS_FILE);
    } catch (e) {
        return fail(`Could not read the bundled presets at ${PRESETS_FILE}\n  ${e.message}\n` +
            `This file ships with newsreel; reinstall the package.`);
    }
    const gradients = (raw.gradients || []).map((g) => ({ ...g, kind: 'gradient' }));
    const solids = (raw.solids || []).map((s) => ({ ...s, kind: 'solid' }));
    _presets = { gradients, solids, all: [...gradients, ...solids], shadowFormula: raw.shadowFormula || null };
    return _presets;
}

const presetIds = () => presets().all.map((p) => p.id);

// Look a preset up by id (case-insensitive). Returns null for a miss; callers decide whether
// that is fatal, so the config validator can list every bad key at once.
//
// "random" is a real id here: every video coming out the same blue is a tell that nobody
// chose the colour. Resolved ONCE per process (below) so the frame, the cards and the
// thumbnail of a single render all agree -- a title card in one colour over scenes in
// another would look like a bug, not a choice.
let rolled = null;
let rollFile = null;

// ⚠️ cards and assemble are SEPARATE PROCESSES. Rolling in each one gives a title card in
//    one colour and scene frames in another, which reads as a bug rather than a choice
//    (observed: "forge" for the cards, "iris" for the frames). So the roll is persisted in
//    workDir and reused until it is deliberately cleared with --reroll.
function initRandom(workDir, { reroll = false } = {}) {
    const fs = require('fs');
    const path = require('path');
    rollFile = path.join(workDir, '.style-roll');
    if (reroll) {
        try { fs.rmSync(rollFile, { force: true }); } catch { /* nothing to clear */ }
        rolled = null;
        return;
    }
    try {
        const saved = fs.readFileSync(rollFile, 'utf8').trim();
        if (saved) usePreset(saved);
    } catch { /* first run of this video */ }
}

// Pick from a family of preset ids -- how a KIND varies its look without drifting out of
// character. Same persistence as "random": rolled once per video, reused by every command.
function pickFamily(ids) {
    if (!Array.isArray(ids) || !ids.length) return null;
    if (rolled && ids.some((i) => String(i).toLowerCase() === rolled.id.toLowerCase())) return rolled;
    const pool = ids.map((i) => presets().all.find((p) => p.id.toLowerCase() === String(i).toLowerCase())).filter(Boolean);
    if (!pool.length) return null;
    rolled = pool[Math.floor(Math.random() * pool.length)];
    console.log(`style: background picked "${rolled.id}" for this video (pin it in the config to keep it)`);
    if (rollFile) {
        try { require('fs').writeFileSync(rollFile, rolled.id); } catch { /* not persisted */ }
    }
    return rolled;
}

function findPreset(id) {
    const want = String(id == null ? '' : id).trim().toLowerCase();
    if (want === 'random') {
        if (!rolled) {
            const all = presets().all;
            rolled = all[Math.floor(Math.random() * all.length)];
            console.log(`style: background preset "random" -> "${rolled.id}" (pin it in the config to keep it)`);
            if (rollFile) {
                try {
                    require('fs').writeFileSync(rollFile, rolled.id);
                } catch { /* not persisted; the next step may pick another colour */ }
            }
        }
        return rolled;
    }
    return presets().all.find((p) => p.id.toLowerCase() === want) || null;
}

// Pin the roll, so a re-render can reproduce a cut you liked: style.background.preset
// "random" prints the id it chose; put that id in the config to keep it.
function usePreset(id) {
    const hit = presets().all.find((p) => p.id.toLowerCase() === String(id).toLowerCase());
    if (hit) rolled = hit;
    return hit;
}

// --- colour -------------------------------------------------------------------------

const clamp01 = (n) => Math.min(1, Math.max(0, n));

function hexToRgb(hex) {
    let h = String(hex || '').replace('#', '').trim();
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

// Blend two hex colours; used to tint the card background with the brand accent the way
// the reference cards did, without requiring a second colour in the config.
function mix(a, b, t) {
    const ra = hexToRgb(a), rb = hexToRgb(b);
    if (!ra || !rb) return a;
    const c = ra.map((v, i) => Math.round(v + (rb[i] - v) * clamp01(t)));
    return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

const DEFAULT_BG = '#0f172a';

// The styled frame's background, as a CSS value. Three accepted shapes:
//   { preset: "deep-ocean" }                          - by id, from bettershot-presets.json
//   { type: "gradient", from, to, angle? }            - a custom 2-stop gradient
//   { type: "solid", color }  /  { from } with no to  - a flat colour
// `angle` overrides a gradient preset's own angle when given.
function resolveBg(bg) {
    if (bg && Array.isArray(bg.family) && !bg.preset) {
        const hit = pickFamily(bg.family);
        if (hit) return { ...bg, preset: hit.id };
    }
    return bg;
}

function backgroundCss(style = {}) {
    const bg = resolveBg(style.background) || {};
    if (bg.preset) {
        const p = findPreset(bg.preset);
        if (!p) {
            return fail(`style.background.preset "${bg.preset}" is not a known preset.\n` +
                `Run "newsreel presets" for the full list, or use\n` +
                `  { "type": "gradient", "from": "#…", "to": "#…" }  /  { "type": "solid", "color": "#…" }`);
        }
        if (p.kind === 'solid') return p.hex;
        const angle = bg.angle === undefined ? p.angle : bg.angle;
        return `linear-gradient(${angle}deg, ${p.stops.join(', ')})`;
    }
    const from = bg.from || bg.color || DEFAULT_BG;
    if (bg.type === 'solid' || !bg.to) return from;
    return `linear-gradient(${bg.angle === undefined ? 135 : bg.angle}deg, ${from}, ${bg.to})`;
}

// One flat hex for the degraded no-Chromium path, which can only paint a solid colour.
// A gradient collapses to its first stop.
function backgroundFlat(style = {}) {
    const bg = resolveBg(style.background) || {};
    if (bg.preset) {
        const p = findPreset(bg.preset);
        if (!p) return DEFAULT_BG;
        return p.kind === 'solid' ? p.hex : p.stops[0];
    }
    return bg.from || bg.color || DEFAULT_BG;
}

// Card/lower-third palette derived from `style.accent` + `style.theme`.
function palette(style = {}) {
    const accent = style.accent || '#22c55e';
    const isLight = (style.theme || 'dark') === 'light';
    const base = isLight ? '#f5f7f8' : '#0a0e0f';
    return {
        accent,
        isLight,
        base,
        // accent-tinted radial wash over the base, matching the reference card look
        cardBg: `radial-gradient(1200px 600px at 50% 30%, ${mix(base, accent, 0.1)} 0%, ${base} 60%)`,
        fg: isLight ? '#0b1211' : '#e6f1ee',
        muted: isLight ? '#4a5b57' : '#a7c4bc',
        barBg: isLight ? 'rgba(255,255,255,.9)' : 'rgba(8,14,15,.82)',
        tagFg: isLight ? '#ffffff' : '#04120d',
    };
}

// Geometry of the styled frame: where the clip lands inside the padded canvas.
// The clip is recorded at the canvas size, so the fit is uniform and centred.
// `captionBand` reserves height at the BOTTOM for the lower-third, so the caption sits on
// the gradient below the clip instead of over the screen. band=0 keeps the old symmetric
// look (used for full-frame cards). band>0 shrinks the clip and lifts it above the band.
function frameBox(W, H, padding, captionBand = 0) {
    const pad = Math.max(0, Number(padding) || 0);
    const band = Math.max(0, Number(captionBand) || 0);
    const topSpace = pad;
    const bottomSpace = Math.max(pad, band); // caption reserve replaces the bottom padding
    const boxW = Math.max(2, W - pad * 2);
    const boxH = Math.max(2, H - topSpace - bottomSpace);
    const scale = Math.min(boxW / W, boxH / H);
    const cw = even(Math.round(W * scale));
    const ch = even(Math.round(H * scale));
    const x = even0(Math.round((W - cw) / 2));
    const y = even0(topSpace + Math.round((boxH - ch) / 2));
    return { cw, ch, x, y };
}

module.exports = {
    presets, presetIds, findPreset, usePreset, initRandom, pickFamily, resolveBg,
    hexToRgb, mix, backgroundCss, backgroundFlat, palette, frameBox,
};
