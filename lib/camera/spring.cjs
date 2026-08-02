'use strict';
// The camera's motion engine: an analytic damped-harmonic-oscillator step, the center clamp,
// the soft boundary pushback, and the bake that turns a camera plan into per-frame transforms.
//
// The step is Screenize's (SpringDamperSimulator.swift:348-381, re-derived from the study doc;
// see design/cinema.md's steal list): omega = 2*pi/response, no mass term, closed form in both
// damping regimes, so it is exact at any dt -- there is no integration error to accumulate and
// a fixed dt = 1/fps gives deterministic output. Springs replaced easing curves wholesale:
// velocity carries across segment boundaries, which is what makes a retargeted camera feel
// like one continuous instrument instead of a sequence of tweens.
//
// Everything is normalized 0..1 top-left; zoom >= 1. Pure math, no IO.

const ZETA = 0.90;                 // slight underdamp: settles with a breath, never rings
const RESPONSE_POS = 0.35;         // seconds; pan spring period
const RESPONSE_ZOOM = 0.55;        // seconds; zoom breathes slower than it pans
const RESP_FILL_POS = 0.40;        // long segments stretch response to fill the slot
const RESP_FILL_ZOOM = 0.45;
const RESP_MIN = 0.15;
const HOLD_DAMP = 0.3;             // velocity multiplier on entering a hold segment
const PUSH_CAP = 0.03;             // soft boundary: allowed overflow before the hard stop
const PUSH_STIFF = 12;             // pushback stiffness
const HOLD_EPS = 1e-3;             // from==to within this => the segment is a hold

// One analytic spring step. state = { x, v }, target T, over dt seconds.
// response is the spring period (omega = 2*pi/response); zeta the damping ratio.
function springStep(x, v, target, dt, response = RESPONSE_POS, zeta = ZETA) {
    const omega = (2 * Math.PI) / Math.max(1e-6, response);
    const d = x - target;
    const zo = zeta * omega;
    const decay = Math.exp(-zo * dt);
    if (zeta >= 1) {
        const B = v + zo * d;
        const x1 = target + (d + B * dt) * decay;
        const v1 = (B - zo * (d + B * dt)) * decay;
        return { x: x1, v: v1 };
    }
    const wd = omega * Math.sqrt(1 - zeta * zeta);
    const B = (v + zo * d) / wd;
    const cos = Math.cos(wd * dt), sin = Math.sin(wd * dt);
    const x1 = target + decay * (d * cos + B * sin);
    const v1 = decay * (-zo * (d * cos + B * sin) + (-d * wd * sin + B * wd * cos));
    return { x: x1, v: v1 };
}

// The visible crop is 1/zoom wide, so its center can never leave [half, 1-half] or the crop
// samples outside the frame. The same constraint written as a margin is 1/(2*scale) -- both
// study apps arrived at this formula independently, which is as close to proof as it gets.
function clampCenter(c, zoom) {
    const half = 0.5 / Math.max(1, zoom);
    return Math.min(1 - half, Math.max(half, c));
}

// Soft boundary: rather than a hard stop (a visible thud), the center may overflow by up to
// PUSH_CAP while its velocity is damped and pushed back in. The renderer applies the hard
// clamp in pixel space, so the overflow is never visible -- it only exists so the spring can
// decelerate smoothly. Returns { x, v }.
function softPushback(x, v, zoom, dt) {
    const half = 0.5 / Math.max(1, zoom);
    const lo = half, hi = 1 - half;
    let ovf = 0;
    if (x < lo) ovf = x - lo;
    else if (x > hi) ovf = x - hi;
    if (ovf !== 0) {
        v *= Math.max(0, 1 - Math.min(1, Math.abs(ovf) / PUSH_CAP) * 0.5 * dt * PUSH_STIFF);
        v -= ovf * PUSH_STIFF * 0.3 * dt;
        x = Math.min(hi + PUSH_CAP, Math.max(lo - PUSH_CAP, x));
    }
    return { x, v };
}

const isHold = (seg) =>
    Math.abs(seg.to.zoom - seg.from.zoom) < HOLD_EPS
    && Math.abs(seg.to.cx - seg.from.cx) < HOLD_EPS
    && Math.abs(seg.to.cy - seg.from.cy) < HOLD_EPS;

// Bake a camera plan (schema 2) into per-frame transforms.
// Returns [{ t, zoom, cx, cy, vx, vy, vz }] with one entry per output frame; velocities are
// the spring's own (units/s), which is exactly what motion blur wants.
function bake(plan, opts = {}) {
    const fps = Number(plan.clip.fps || 30);
    const durOut = Number(plan.clip.durOut);
    const maxZoom = Number((plan.config && plan.config.maxZoom) || opts.maxZoom || 4);
    // one dial for "calmer or snappier": smoothness scales both spring responses, and the
    // per-segment stretch keeps long glides filling their slots, so nothing ever races
    const smooth = Number(opts.smoothness ?? (plan.config && plan.config.smoothness) ?? 1);
    const basePos = Number(opts.response || (plan.config && plan.config.response) || RESPONSE_POS) * smooth;
    const baseZoom = Number(opts.zoomResponse || (plan.config && plan.config.zoomResponse) || RESPONSE_ZOOM) * smooth;
    const dt = 1 / fps;
    const frames = Math.max(1, Math.round(durOut * fps));
    const segs = plan.segments;

    // start exactly where the plan says the camera starts
    let cx = segs[0].from.cx, cy = segs[0].from.cy, zoom = segs[0].from.zoom;
    let vx = 0, vy = 0, vz = 0;
    let segIdx = -1;
    let posResp = basePos, zoomResp = baseZoom;

    const out = [];
    for (let f = 0; f < frames; f++) {
        const t = f * dt;
        // active segment: last one whose t0 <= t (they are sorted and contiguous)
        let idx = segs.length - 1;
        for (let i = 0; i < segs.length; i++) {
            if (t < segs[i].t1 || i === segs.length - 1) { idx = i; break; }
        }
        const seg = segs[idx];
        if (idx !== segIdx) {
            segIdx = idx;
            // ⚙️ response stretches to fill the slot: a 2 s glide should take 2 s, not race
            //    there in 0.35 and idle. Short segments keep the base snap.
            const segDur = Math.max(0.05, seg.t1 - seg.t0);
            posResp = Math.max(RESP_MIN, Math.max(basePos, segDur * RESP_FILL_POS));
            zoomResp = Math.max(RESP_MIN, Math.max(baseZoom, segDur * RESP_FILL_ZOOM));
            if (isHold(seg)) { vx *= HOLD_DAMP; vy *= HOLD_DAMP; vz *= HOLD_DAMP; }
        }

        const sx = springStep(cx, vx, seg.to.cx, dt, posResp);
        const sy = springStep(cy, vy, seg.to.cy, dt, posResp);
        const sz = springStep(zoom, vz, seg.to.zoom, dt, zoomResp);
        cx = sx.x; vx = sx.v;
        cy = sy.x; vy = sy.v;
        zoom = sz.x; vz = sz.v;

        // zoom never below 1 (crop larger than the frame) nor above the ceiling
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
    ZETA, RESPONSE_POS, RESPONSE_ZOOM, PUSH_CAP,
    springStep, clampCenter, softPushback, bake, isHold,
};
