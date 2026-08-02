'use strict';
// Overlay formulas: cursor sizing, click squash, ripple and spotlight geometry, and the
// cursor spring's parameters. Pure math with the constants from the study docs.
//
// This file is required by Node (tests, render driver) AND imported by the compositor bundle
// (esbuild inlines CJS), so the numbers exist exactly once. If a formula here drifts from
// what the compositor draws, the pixel tests catch it -- because both sides ARE this file.

// ── cursor ───────────────────────────────────────────────────────────────────────────
// Base sprite height 28 px at a 1920-wide reference frame, scaled by the user's setting and
// by zoom (the cursor is drawn after the camera transform, in screen space, so zooming the
// content must also grow the cursor or it visibly shrinks against the world).
function cursorPx(scale, frameW, zoom) {
    return 28 * scale * Math.max(0.55, frameW / 1920) * Math.max(1, zoom);
}

// Click squash: a quick press-down over a 350 ms window. At bounce 3.5 the floor engages
// exactly (1 - sin(pi/2) * 0.08 * 3.5 = 0.72); softer bounces never reach it. Depth is
// boosted by sqrt(zoom) so the punch still reads when zoomed in.
const SQUASH_MS = 350;
const SQUASH_FLOOR = 0.72;
function squashScale(p, bounce, zoom = 1) {
    if (p < 0 || p > 1) return 1;
    const depth = 0.08 * bounce * Math.sqrt(Math.max(1, zoom));
    return Math.max(SQUASH_FLOOR, 1 - Math.sin(p * Math.PI) * depth);
}

// The cursor chase spring, parameterized by the user's `smoothing` (0..2; 0 = raw path).
// The study doc's raw (k, c, m) triplet for Recordly's default does not cohere with its own
// quoted damping ratio, so what is kept is the measured FEEL -- slight underdamp (zeta
// 0.855), fast settle -- expressed through the same analytic spring the camera uses.
// smoothing scales the response linearly around the 0.67 default.
function cursorSpring(smoothing) {
    const s = Math.max(0, Math.min(2, smoothing));
    if (s === 0) return null;                       // raw: no spring at all
    return { response: 0.09 * (s / 0.67), zeta: 0.855 };
}

// ── click effects ────────────────────────────────────────────────────────────────────
// Both effects run p from 1 -> 0 over their duration, starting SQUASH_MS/2 after the click
// (the press lands first, the ring answers). Geometry is a function of the cursor height so
// the effect scales with everything else.
const EFFECT_DELAY_MS = SQUASH_MS / 2;

function rippleShape(p, cursorH, scale, opacity) {
    const inv = 1 - p * p * p;
    return {
        radius: Math.max(0.5, inv * cursorH * 1.95 * scale),
        alpha: Math.max(0, Math.min(1, p * p * p * 0.6 * opacity)),
        strokeWidth: Math.max(1, 2 * p * p * p),
    };
}

function spotlightShape(p, cursorH, scale, opacity) {
    const base = Math.max(12, cursorH * 0.55 * scale);
    const glow = base + (1 - p) * cursorH * scale;
    const inner = Math.max(base * 0.72, glow * 0.76);
    const sw = Math.max(2, cursorH * 0.08);
    const alpha = p * opacity;
    return {
        glowR: glow, innerR: inner,
        outerAlpha: alpha * 0.28, outerWidth: Math.max(1.25, sw * 0.68),
        innerAlpha: alpha * 0.5, innerWidth: Math.max(1.5, sw * 0.75),
    };
}

// ── track interpolation ──────────────────────────────────────────────────────────────
// The cursor track is [t, x, y] samples in OUTPUT seconds, sorted. Between samples: lerp.
// Across a gap longer than SNAP_S the cursor holds, then snaps -- animating across a cut
// or a long hold would invent motion that never happened (Recordly's seek-snap rule).
const SNAP_S = 0.1;
function sampleTrack(track, t) {
    if (!track.length) return null;
    if (t <= track[0][0]) return { x: track[0][1], y: track[0][2] };
    if (t >= track[track.length - 1][0]) {
        const last = track[track.length - 1];
        return { x: last[1], y: last[2] };
    }
    let lo = 0, hi = track.length - 1;
    while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (track[mid][0] <= t) lo = mid; else hi = mid;
    }
    const a = track[lo], b = track[hi];
    const gap = b[0] - a[0];
    if (gap > SNAP_S) return { x: a[1], y: a[2] };   // hold; the snap happens when t crosses b
    const f = gap > 0 ? (t - a[0]) / gap : 1;
    return { x: a[1] + (b[1] - a[1]) * f, y: a[2] + (b[2] - a[2]) * f };
}

// ── keystroke badges ─────────────────────────────────────────────────────────────────
// Designed fresh: Recordly typed this and never shipped it; Screenize's badges overlap.
// A chord collapses to ONE badge with modifiers in canonical order (⌃⌥⇧⌘ regardless of how
// the config wrote them); bare modifier presses produce nothing; a typing burst becomes one
// pill that fills on the real key cadence, never per-letter badge spam.

const MOD_ORDER = ['Control', 'Alt', 'Shift', 'Meta'];
const MOD_GLYPH = { Control: '\u2303', Alt: '\u2325', Shift: '\u21e7', Meta: '\u2318' };
const MOD_TEXT = { Control: 'Ctrl', Alt: 'Alt', Shift: 'Shift', Meta: 'Cmd' };
const MOD_NORM = {
    ctrl: 'Control', control: 'Control', controlorMeta: 'Control',
    alt: 'Alt', option: 'Alt',
    shift: 'Shift',
    meta: 'Meta', cmd: 'Meta', command: 'Meta',
};
const KEY_GLYPH = {
    Enter: '\u21a9', Backspace: '\u232b', Escape: 'esc', Tab: '\u21e5',
    ArrowLeft: '\u2190', ArrowRight: '\u2192', ArrowUp: '\u2191', ArrowDown: '\u2193',
    Delete: '\u2326', Space: '\u2423', ' ': '\u2423',
};

// Playwright combo syntax -> badge label, or null for a bare-modifier press (the collapse
// mechanism: "hold Meta" is not an event worth a badge).
function chordLabel(combo, symbols = 'mac') {
    const parts = String(combo || '').split('+').map((x) => x.trim()).filter(Boolean);
    const mods = [];
    const keys = [];
    for (const part of parts) {
        const norm = MOD_NORM[part.toLowerCase()];
        if (norm) { if (!mods.includes(norm)) mods.push(norm); } else keys.push(part);
    }
    if (!keys.length) return null;
    const ordered = MOD_ORDER.filter((m) => mods.includes(m));
    const key = keys[keys.length - 1];
    const keyUp = key.length === 1 ? key.toUpperCase() : key;
    if (symbols === 'text') return [...ordered.map((m) => MOD_TEXT[m]), keyUp].join('+');
    return ordered.map((m) => MOD_GLYPH[m]).join('') + (KEY_GLYPH[key] || keyUp);
}

// Sidecar events -> the badge timeline, in output seconds.
//   chord: { kind: 'chord', t, label, count }   (count grows on repeats within REPEAT_S)
//   pill:  { kind: 'pill', t0, tLast, text, keys: [{ t, ch }] }
const REPEAT_S = 0.3;
const PILL_HOLD_S = 0.9;
function buildBadges(events, clip, cfg) {
    const map = (ms) => (ms / 1000 - clip.trimStart) / clip.speed;
    const out = [];
    for (const e of events || []) {
        if (e.type === 'keyChord' && cfg.chords !== false) {
            const label = chordLabel(e.combo, cfg.symbols);
            if (!label) continue;
            const t = map(e.t);
            if (t < 0 || t > clip.durOut) continue;
            const prev = out[out.length - 1];
            if (prev && prev.kind === 'chord' && prev.label === label && t - prev.t <= REPEAT_S) {
                prev.count += 1;
                prev.t = t;      // a repeat refreshes the badge's clock instead of spawning
                continue;
            }
            out.push({ kind: 'chord', t, label, count: 1 });
        } else if (e.type === 'typeBurst' && cfg.typing !== 'none') {
            const keys = (e.keys || []).map((k) => ({ t: map(k.t), ch: k.key }))
                .filter((k) => k.t >= 0 && k.t <= clip.durOut);
            if (!keys.length) continue;
            out.push({
                kind: 'pill', t0: keys[0].t, tLast: keys[keys.length - 1].t,
                text: e.text || keys.map((k) => k.ch).join(''), keys,
            });
        }
    }
    return out;
}

module.exports = {
    SQUASH_MS, SQUASH_FLOOR, EFFECT_DELAY_MS, SNAP_S,
    cursorPx, squashScale, cursorSpring, rippleShape, spotlightShape, sampleTrack,
    REPEAT_S, PILL_HOLD_S, chordLabel, buildBadges,
};
