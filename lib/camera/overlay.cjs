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

module.exports = {
    SQUASH_MS, SQUASH_FLOOR, EFFECT_DELAY_MS, SNAP_S,
    cursorPx, squashScale, cursorSpring, rippleShape, spotlightShape, sampleTrack,
};
