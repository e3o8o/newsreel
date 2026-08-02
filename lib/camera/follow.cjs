'use strict';
// Camera mode "follow": the continuous cursor-follow camera (Screenize's Mode A), built from
// the same parts as the segment planner -- the dead-zone target, the adaptive look-ahead
// response, and the shared analytic spring. Where the segment planner cuts a plan and glides
// between poses, follow keeps the cursor comfortably framed at all times: the camera only
// moves when the cursor leaves a generous safe zone, corrects partially rather than centering
// (centering reads as surveillance), and softens or hardens its response depending on how
// soon the script does something next -- which newsreel KNOWS, because the script is ours.
//
// Constants from the study doc (DeadZoneTarget.swift, AdaptiveResponse.swift): safe zone 0.75
// of the visible half (0.60 while typing), correction 0.45 rising to 0.80 across a smoothstep
// band of 0.25, hysteresis 0.15, response 0.20s when the next action is <= 0.5s away and
// 0.50s when >= 2.0s. Pure math, deterministic, no IO.

const { springStep, clampCenter, softPushback } = require('./spring.cjs');
const { extractIntents, zoomFor, centerFor } = require('./plan.cjs');
const { sampleTrack } = require('./overlay.cjs');

const SAFE_FRACTION = 0.75;          // of the visible half-extent
const SAFE_FRACTION_TYPING = 0.60;   // typing wants a tighter leash
const CORRECTION_NEAR = 0.45;        // partial correction just outside the zone...
const CORRECTION_FAR = 0.80;         // ...harder when the cursor is running away
const GRADIENT_BAND = 0.25;          // of the visible half: smoothstep between the two
const HYSTERESIS = 0.15;             // of the safe half: exit threshold below entry
const RESPONSE_URGENT = 0.20;        // next scripted action <= LOOKAHEAD_NEAR away
const RESPONSE_RELAXED = 0.50;       // nothing coming for >= LOOKAHEAD_FAR
const LOOKAHEAD_NEAR = 0.5;
const LOOKAHEAD_FAR = 2.0;
const IDLE_ZOOM_DECAY = 0.5;         // after the last intent, decay toward 1 + (z-1)*this
const ZOOM_MERGE_GAP_S = 2.0;        // intent zoom windows closer than this hold, not dip
const ZOOM_TARGET_HYSTERESIS = 0.3;  // a target change smaller than this is noise, not intent
const FOLLOW_ZOOM_RESPONSE = 0.9;    // follow's zoom breathes slower than the segment camera

const smoothstep = (a, b, x) => {
    const t = Math.min(1, Math.max(0, (x - a) / Math.max(1e-9, b - a)));
    return t * t * (3 - 2 * t);
};

// The cursor track in output time, straight from the sidecar's transit samples.
function trackFromEvents(events, clip) {
    const map = (ms) => (ms / 1000 - clip.trimStart) / clip.speed;
    const track = [];
    for (const e of events || []) {
        if (e.type !== 'move' || !Array.isArray(e.path)) continue;
        for (const [ms, x, y] of e.path) {
            const t = map(ms);
            if (t >= 0 && t <= clip.durOut) track.push([t, x, y]);
        }
    }
    track.sort((a, b) => a[0] - b[0]);
    return track;
}

// One dead-zone update, per axis. target: where the camera center wants to be; cursor: where
// the pointer is. Activation is Chebyshev (either axis breaking out activates the zone, with
// hysteresis so a cursor dithering on the edge cannot make the camera chatter); correction is
// per-axis and partial.
function deadZoneStep(state, cursor, zoom, typing) {
    const half = 0.5 / Math.max(1, zoom);
    const safeHalf = half * (typing ? SAFE_FRACTION_TYPING : SAFE_FRACTION);
    const dx = cursor.x - state.tx;
    const dy = cursor.y - state.ty;
    const cheb = Math.max(Math.abs(dx), Math.abs(dy));

    if (!state.active && cheb > safeHalf) state.active = true;
    else if (state.active && cheb < safeHalf * (1 - HYSTERESIS)) state.active = false;
    if (!state.active) return;

    const band = half * GRADIENT_BAND;
    for (const axis of ['x', 'y']) {
        const d = axis === 'x' ? dx : dy;
        const over = Math.abs(d) - safeHalf;
        if (over <= 0) continue;
        const corr = CORRECTION_NEAR + (CORRECTION_FAR - CORRECTION_NEAR) * smoothstep(0, band, over);
        const shift = Math.sign(d) * over * corr;
        if (axis === 'x') state.tx += shift; else state.ty += shift;
    }
}

// Adaptive response: the camera leads a busy script and relaxes in the quiet.
function responseFor(t, intentTimes) {
    let next = Infinity;
    for (const it of intentTimes) {
        if (it >= t) { next = it - t; break; }
    }
    if (next <= LOOKAHEAD_NEAR) return RESPONSE_URGENT;
    if (next >= LOOKAHEAD_FAR) return RESPONSE_RELAXED;
    const f = (next - LOOKAHEAD_NEAR) / (LOOKAHEAD_FAR - LOOKAHEAD_NEAR);
    return RESPONSE_URGENT + (RESPONSE_RELAXED - RESPONSE_URGENT) * f;
}

// followBake(events, clip, cfg) -> per-frame transforms, same shape as spring.bake().
function followBake(events, clip, cfg = {}) {
    const fps = Number(clip.fps || 30);
    const durOut = Number(clip.durOut);
    const dt = 1 / fps;
    const frames = Math.max(1, Math.round(durOut * fps));
    const maxZoom = cfg.maxZoom ?? 2.2;
    const smooth = cfg.smoothness ?? 1;
    const zoomResp = (cfg.zoomResponse ?? FOLLOW_ZOOM_RESPONSE) * smooth;

    const track = trackFromEvents(events, clip);
    const { intents, contentT } = extractIntents(events || [], clip);
    const intentTimes = intents.map((it) => it.t0).sort((a, b) => a - b);

    // 🫧 Zoom WINDOWS, built once and merged: adjacent intents whose spans sit within
    //    ZOOM_MERGE_GAP of each other become one window at the max of their zooms. Without
    //    this the target flips per intent and the spring dutifully chases every twitch --
    //    observed on real footage as zoom "pumping" (2.0 -> 1.9 -> 2.2 -> 1.6, second by
    //    second). A camera should commit to a depth and stay there while work continues.
    const windows = [];
    for (const it of intents.slice().sort((a, b) => a.t0 - b.t0)) {
        const z = zoomFor(it.box, it.kind, cfg);
        const t0 = Math.max(contentT, it.t0 - 0.4);
        const t1 = it.t1 + 0.4;
        const prev = windows[windows.length - 1];
        if (prev && t0 - prev.t1 <= ZOOM_MERGE_GAP_S) {
            prev.t1 = Math.max(prev.t1, t1);
            prev.z = Math.max(prev.z, z);
        } else {
            windows.push({ t0, t1, z });
        }
    }

    const zoomTargetAt = (t) => {
        if (t < contentT) return 1;
        let lastZ = 1;
        for (const w of windows) {
            if (t >= w.t0 && t <= w.t1) return w.z;
            if (t > w.t1) lastZ = 1 + (w.z - 1) * IDLE_ZOOM_DECAY;
        }
        return lastZ;
    };
    // typing spans tighten the dead zone
    const typingAt = (t) => intents.some((it) =>
        (it.kind === 'field' || it.kind === 'textarea') && t >= it.t0 && t <= it.t1);

    const state = { tx: 0.5, ty: 0.5, active: false };
    let cx = 0.5, cy = 0.5, zoom = 1;
    let vx = 0, vy = 0, vz = 0;
    let heldZoomTarget = 1;

    const out = [];
    for (let f = 0; f < frames; f++) {
        const t = f * dt;
        const cursor = sampleTrack(track, t) || { x: 0.5, y: 0.5 };
        const typing = typingAt(t);
        // target hysteresis: only commit to a NEW depth when it differs by more than noise
        const raw = Math.min(maxZoom, Math.max(1, zoomTargetAt(t)));
        if (Math.abs(raw - heldZoomTarget) >= ZOOM_TARGET_HYSTERESIS || raw === 1) heldZoomTarget = raw;
        const zTarget = heldZoomTarget;

        deadZoneStep(state, cursor, zoom, typing);
        // the target itself must stay croppable, or the spring chases the impossible
        state.tx = clampCenter(state.tx, zTarget);
        state.ty = clampCenter(state.ty, zTarget);

        const resp = responseFor(t, intentTimes) * smooth;
        const sx = springStep(cx, vx, state.tx, dt, resp);
        const sy = springStep(cy, vy, state.ty, dt, resp);
        const sz = springStep(zoom, vz, zTarget, dt, zoomResp);
        cx = sx.x; vx = sx.v;
        cy = sy.x; vy = sy.v;
        zoom = sz.x; vz = sz.v;

        if (zoom < 1) { zoom = 1; if (vz < 0) vz = 0; }
        if (zoom > maxZoom) { zoom = maxZoom; if (vz > 0) vz = 0; }
        const px = softPushback(cx, vx, zoom, dt);
        cx = px.x; vx = px.v;
        const py = softPushback(cy, vy, zoom, dt);
        cy = py.x; vy = py.v;

        out.push({ t, zoom, cx, cy, vx, vy, vz });
    }
    return out;
}

module.exports = {
    SAFE_FRACTION, SAFE_FRACTION_TYPING, CORRECTION_NEAR, CORRECTION_FAR, HYSTERESIS,
    RESPONSE_URGENT, RESPONSE_RELAXED,
    trackFromEvents, deadZoneStep, responseFor, followBake,
};
