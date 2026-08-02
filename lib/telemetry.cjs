'use strict';
// Ground-truth capture telemetry: the events sidecar behind the cinema pass.
//
// Recordly and Screenize infer what the user did from raw OS event streams. newsreel executes
// the script, so this module RECORDS the script as it runs: before every targeted action the
// pointer is driven along a synthesized, eased, slightly bowed path (hover states fire for
// real), and the same samples are written to `<shotId>.events.json` next to the clip. Nothing
// is inferred; the sidecar is ground truth by construction. See design/cinema.md, Schema 1.
//
// Conventions (stated once, used everywhere):
//   - Coordinates are normalized 0..1, top-left origin, in LAYOUT-viewport space, which equals
//     recorded-frame space because capture.zoom scaling is uniform.
//   - Times are integer ms from recording start (page open). The sidecar stays on the raw-clip
//     clock forever; consumers map through their own trim/speed.
//
// Everything here is deterministic under a fixed shot id: the transit generator's jitter and
// bow are seeded, so re-capturing a shot yields the same path shape (timestamps aside).

const fs = require('fs');
const path = require('path');

const SCHEMA = 1;
const SAMPLE_MS = 1000 / 60;          // transit sample cadence (~60 Hz)
const TRANSIT_MIN_MS = 250;           // duration clamp, plan §Schema 1
const TRANSIT_MAX_MS = 800;
const TRANSIT_BASE_S = 0.20;          // duration = clamp(0.20 + dist * 0.55, ...)
const TRANSIT_PER_DIST_S = 0.55;
const BOW_MIN = 0.04;                 // perpendicular bow: 4-8% of the transit distance,
const BOW_MAX = 0.08;                 // magnitude AND side both seeded (a coin flip alone
                                      // made half of all seed pairs produce identical paths)
const JITTER_MAX_PX = 8;              // target jitter, clamped inside the box
const SETTLE_BEFORE_MS = 250;         // explicit pacing (replaces slowMo under telemetry)
const SETTLE_AFTER_CLICK_MS = 600;

// ── deterministic randomness ──────────────────────────────────────────────────────────
// Seeded from the shot id. Same mixing discipline as visuals/src/shared/source.ts: raw
// xorshift's first outputs are near-zero for small seeds, so mix through splitmix32 and
// discard a warmup, or every shot's first jitter lands on the same side.
function seededRng(seedStr) {
    let s = 0;
    for (const ch of String(seedStr)) s = (Math.imul(s, 31) + ch.charCodeAt(0)) >>> 0;
    s = Math.imul(s ^ (s >>> 16), 0x21f0aaad) >>> 0;
    s = Math.imul(s ^ (s >>> 15), 0x735a2d97) >>> 0;
    s = (s ^ (s >>> 15)) >>> 0 || 0x6d2b79f5;
    const next = () => {
        s ^= s << 13; s >>>= 0;
        s ^= s >>> 17;
        s ^= s << 5; s >>>= 0;
        return s / 4294967296;
    };
    for (let i = 0; i < 8; i++) next();
    return next;
}

const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const r4 = (v) => Math.round(v * 10000) / 10000;

// ── transit synthesis (pure) ──────────────────────────────────────────────────────────
// from/to normalized {x,y}; returns { durMs, samples: [[relMs, x, y], ...] } including both
// endpoints exactly. The path is a quadratic bezier bowed perpendicular to the chord (arcs
// read as a hand; ruler-straight lines read as a machine), traversed on an ease-in-out-cubic
// clock at ~60 Hz.
function synthesizeTransit(from, to, rand = Math.random) {
    const dx = to.x - from.x, dy = to.y - from.y;
    const dist = Math.hypot(dx, dy);
    const durMs = Math.round(Math.min(TRANSIT_MAX_MS,
        Math.max(TRANSIT_MIN_MS, (TRANSIT_BASE_S + dist * TRANSIT_PER_DIST_S) * 1000)));

    // control point: chord midpoint pushed perpendicular; side and depth both by seed
    const side = rand() < 0.5 ? -1 : 1;
    const bow = dist * (BOW_MIN + rand() * (BOW_MAX - BOW_MIN)) * side;
    const nx = dist > 1e-6 ? -dy / dist : 0;
    const ny = dist > 1e-6 ? dx / dist : 0;
    const cx = from.x + dx / 2 + nx * bow;
    const cy = from.y + dy / 2 + ny * bow;

    const samples = [];
    const n = Math.max(2, Math.round(durMs / SAMPLE_MS) + 1);
    for (let k = 0; k < n; k++) {
        const rel = k === n - 1 ? durMs : Math.round(k * SAMPLE_MS);
        const p = easeInOutCubic(k / (n - 1));
        const q = 1 - p;
        // quadratic bezier, endpoints exact at p=0 and p=1
        samples.push([rel,
            r4(q * q * from.x + 2 * q * p * cx + p * p * to.x),
            r4(q * q * from.y + 2 * q * p * cy + p * p * to.y)]);
    }
    // endpoint exactness regardless of rounding
    samples[0][1] = r4(from.x); samples[0][2] = r4(from.y);
    samples[n - 1][1] = r4(to.x); samples[n - 1][2] = r4(to.y);
    return { durMs, samples };
}

// ── activation ────────────────────────────────────────────────────────────────────────
// Telemetry turns on iff a cinema feature exists in the resolved config, or is forced with
// capture.telemetry (record now, decide later). Absent all of that, capture must take the
// exact current code path: that is the backward-compatibility line.
function telemetryEnabled(c) {
    const forced = c.get('capture.telemetry', undefined);
    if (forced !== undefined) return Boolean(forced);
    if (c.get('video.camera', undefined) !== undefined) return true;
    for (const k of ['style.cursor', 'style.clicks', 'style.keys']) {
        if (c.get(k, undefined) !== undefined) return true;
    }
    const shots = c.get('shots', []) || [];
    return shots.some((s) => s && typeof s === 'object' && s.camera !== undefined);
}

// ── cursor style ──────────────────────────────────────────────────────────────────────
// The sidecar enum. The compositor draws the cursor, so the shape comes from the CSS the
// element declares -- the one honest signal a headless capture has.
function mapCursorStyle(css) {
    const v = String(css || '').toLowerCase();
    if (v.includes('pointer')) return 'pointer';
    if (v.includes('text')) return 'text';
    if (v.includes('crosshair')) return 'crosshair';
    if (v.includes('grab')) return 'grab';
    if (v.includes('not-allowed') || v.includes('no-drop')) return 'not-allowed';
    return 'arrow';
}

async function cursorStyleOf(locator) {
    try {
        return mapCursorStyle(await locator.evaluate((el) => getComputedStyle(el).cursor));
    } catch { return 'arrow'; }
}

// ── the recorder ──────────────────────────────────────────────────────────────────────
function createRecorder({ shot, viewport, layoutViewport, captureZoom = 1 }) {
    const lv = layoutViewport || viewport;
    const rand = seededRng(shot);
    const events = [];
    let recordStartAt = null;
    let navSettledT = null;
    // pointer in normalized coords; park default matches the sidecar `start` field
    let px = 0.5, py = 0.55;

    const now = () => (recordStartAt === null ? 0 : Date.now() - recordStartAt);
    const normBox = (b) => (b ? {
        x: r4(b.x / lv.width), y: r4(b.y / lv.height),
        w: r4(b.width / lv.width), h: r4(b.height / lv.height),
    } : null);

    return {
        // -- clock ------------------------------------------------------------------
        start() { recordStartAt = Date.now(); },
        now,
        navSettled() { navSettledT = now(); },

        // -- pointer ----------------------------------------------------------------
        get pointer() { return { x: px, y: py }; },
        setPointer(x, y) { px = x; py = y; },
        toPx(p) { return { x: p.x * lv.width, y: p.y * lv.height }; },

        // A jittered point inside the box, so repeated captures do not rubber-stamp the
        // exact center. Jitter is seeded (deterministic per shot) and clamped to the box's
        // inner 60% so it can never fall on an edge.
        jitteredCenter(box) {
            const jx = (rand() * 2 - 1) * Math.min(JITTER_MAX_PX, box.width * 0.2);
            const jy = (rand() * 2 - 1) * Math.min(JITTER_MAX_PX, box.height * 0.2);
            return {
                x: (box.x + box.width / 2 + jx) / lv.width,
                y: (box.y + box.height / 2 + jy) / lv.height,
            };
        },

        // Drive the real pointer along a synthesized transit and record the identical
        // samples. Timing runs on an absolute schedule (planned offset vs wall clock), so
        // per-move round-trip cost does not accumulate into drift.
        async driveTransit(page, target, reason) {
            const from = { x: px, y: py };
            const dist = Math.hypot(target.x - from.x, target.y - from.y);
            if (dist < 0.002) { px = target.x; py = target.y; return null; }

            const { durMs, samples } = synthesizeTransit(from, target, rand);
            const t0 = now();
            const wall0 = Date.now();
            for (const [rel, x, y] of samples) {
                await page.mouse.move(x * lv.width, y * lv.height);
                const ahead = rel - (Date.now() - wall0);
                if (ahead > 4) await page.waitForTimeout(ahead);
            }
            px = target.x; py = target.y;
            const ev = {
                type: 'move', t0, t1: now(),
                from: [r4(from.x), r4(from.y)], to: [r4(target.x), r4(target.y)],
                reason,
                path: samples.map(([rel, x, y]) => [t0 + rel, x, y]),
            };
            events.push(ev);
            return ev;
        },

        // -- events -----------------------------------------------------------------
        click({ selector, box, count = 1, cursorStyle = 'arrow', t }) {
            events.push({
                type: count >= 2 ? 'dblclick' : 'click',
                t: t === undefined ? now() : t,
                at: [r4(px), r4(py)], button: 'left', count,
                selector: selector || null, box: normBox(box), cursorStyle,
            });
        },
        typeBurst({ selector, box, text, keys, t0, t1 }) {
            events.push({ type: 'typeBurst', t0, t1, selector: selector || null, box: normBox(box), text, keys });
        },
        fill({ selector, box, text, t }) {
            events.push({ type: 'fill', t: t === undefined ? now() : t, selector: selector || null, text, box: normBox(box) });
        },
        keyChord({ combo, selector, box, t }) {
            events.push({ type: 'keyChord', t: t === undefined ? now() : t, combo, selector: selector || null, box: normBox(box) });
        },
        scroll({ at, delta, selector, box, t0, t1 }) {
            events.push({
                type: 'scroll', t0, t1: t1 === undefined ? t0 : t1,
                at: at ? [r4(at.x), r4(at.y)] : [r4(px), r4(py)],
                delta: delta || null, selector: selector || null, box: normBox(box),
            });
        },
        waitFor({ selector, box, state, t, settledT }) {
            events.push({ type: 'waitFor', t, settledT, state: state || 'visible', selector: selector || null, box: normBox(box) });
        },
        settle() { events.push({ type: 'settle', t: now() }); },

        // -- output -----------------------------------------------------------------
        toJSON() {
            return {
                schema: SCHEMA,
                shot,
                createdAt: new Date().toISOString(),
                viewport: { width: viewport.width, height: viewport.height },
                layoutViewport: { width: lv.width, height: lv.height },
                captureZoom,
                clock: {
                    basis: 'recordStart',
                    recordStartAt,
                    // page.mouse and recordVideo start within the newPage() resolution; the
                    // honest uncertainty is stored so consumers can reason about it.
                    uncertaintyMs: 80,
                    navSettledT,
                },
                start: { x: 0.5, y: 0.55 },
                events: events.slice().sort((a, b) => (a.t0 ?? a.t) - (b.t0 ?? b.t)),
            };
        },
        // A failing sidecar write logs and never fails the shot.
        flush(dir) {
            try {
                const file = path.join(dir, `${shot}.events.json`);
                fs.writeFileSync(file, JSON.stringify(this.toJSON()));
                return file;
            } catch (e) {
                console.log(`  (telemetry not saved for ${shot}: ${e.message})`);
                return null;
            }
        },
    };
}

module.exports = {
    SCHEMA,
    SETTLE_BEFORE_MS,
    SETTLE_AFTER_CLICK_MS,
    TRANSIT_MIN_MS,
    TRANSIT_MAX_MS,
    seededRng,
    synthesizeTransit,
    telemetryEnabled,
    mapCursorStyle,
    cursorStyleOf,
    createRecorder,
};
