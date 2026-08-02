'use strict';
// The camera planner: a pure function from (events sidecar, clip timing, config) to a camera
// plan -- the newsreel analog of Screenize's Mode-B activity planner, with the detection layer
// deleted. Those apps classify raw event streams into "the user is typing here"; the sidecar
// already says so, with the element's box attached. What remains is the part worth stealing:
// the zoom-sizing formula, the anticipation leads, the merge/yo-yo/idle rules and their
// thresholds, all lifted verbatim from the study docs (design/cinema.md, steal list).
//
// The output (schema 2) is written next to the work files as <shot>.camera.json: inspectable,
// diffable, and the exact shape a config may supply inline as an override -- which is what
// makes the camera agent-editable. Times in output seconds; the spring bake gives it motion.

const { clampCenter } = require('./spring.cjs');

// ── the constants (Screenize defaults; see the steal list for file:line sources) ─────
const COVERAGE = 0.7;                 // the focused target covers 70% of the frame
const BOX_PAD = 0.08;                 // padding added per side before sizing
const GIANT_DIM = 0.6;                // a target bigger than this is a container: don't zoom
const RANGES = {
    click: [1.5, 2.5],
    field: [2.2, 2.8],                // typing into a one-line field
    textarea: [1.8, 2.2],             // typing into a tall box
    scroll: [1.3, 1.5],
};
const TEXTAREA_MIN_H = 0.10;          // a "field" taller than this is treated as a textarea
const ANTICIPATION = { click: 0.15, typing: 0.4, scroll: 0.25 };  // camera leads the action
const POINT_SPAN_S = 0.5;             // a point intent gets this synthetic duration
const MERGE_GAP_S = 2.0;              // merge intents this close in time...
const MERGE_DIST = 0.20;              // ...and this close in space
const MOVE_MIN_S = 0.15;              // transition duration from travel, clamped
const MOVE_MAX_S = 0.8;
const MOVE_PER_DIST = 1.0;            // seconds per unit of travel
const MOVE_PER_ZOOM = 0.35;           // seconds per unit of zoom change
const MIN_HOLD_S = 0.1;               // below this, the move fills the whole span
const SKIP_DIST = 0.05;               // a retarget this small is not worth a move
const SKIP_ZOOM = 0.1;
const IDLE_GAP_S = 1.5;               // a gap longer than this pulls back...
const IDLE_DECAY = 0.5;               // ...to 1 + (z-1)*0.5, center inherited (never snap)
const RELEASE_REMAINING_S = 1.2;      // this much tail releases to 1.0
const RELEASE_S = 1.0;
const YOYO = { zClose: 0.30, dTight: 0.15, dLoose: 0.35, gapS: 1.5, decay: 0.70 };

const r3 = (v) => Math.round(v * 1000) / 1000;

// ── event -> output time ─────────────────────────────────────────────────────────────
// The sidecar stays on the raw-clip clock forever; every consumer maps through its own trim
// and speed. Events fully before the trim (the park move during page load) drop out here.
function toOut(ms, clip) { return (ms / 1000 - clip.trimStart) / clip.speed; }

// ── intent extraction ────────────────────────────────────────────────────────────────
// One intent per ground-truth event. No inference: the classification IS the event type.
function extractIntents(events, clip) {
    const durOut = clip.durOut;
    const intents = [];
    let contentT = null;   // first waitFor settle: never zoom before content exists

    for (const e of events) {
        switch (e.type) {
            case 'waitFor': {
                const t = toOut(e.settledT ?? e.t, clip);
                if (contentT === null && t > 0) contentT = Math.min(t, durOut);
                break;
            }
            case 'click':
            case 'dblclick': {
                const t = toOut(e.t, clip);
                if (t < 0 || t > durOut) break;
                intents.push({
                    kind: 'click', t0: t, t1: t + POINT_SPAN_S / clip.speed,
                    box: e.box, point: e.at,
                    why: `${e.type} ${e.selector || ''}`.trim(),
                });
                break;
            }
            case 'typeBurst':
            case 'fill': {
                const t0 = toOut(e.t0 ?? e.t, clip);
                const t1 = e.t1 !== undefined ? toOut(e.t1, clip) : t0 + POINT_SPAN_S / clip.speed;
                if (t1 < 0 || t0 > durOut) break;
                const tall = e.box && e.box.h > TEXTAREA_MIN_H;
                intents.push({
                    kind: tall ? 'textarea' : 'field',
                    t0: Math.max(0, t0), t1: Math.min(durOut, Math.max(t1, t0 + 0.2)),
                    box: e.box, point: null,
                    why: `${e.type} ${e.selector || ''}`.trim(),
                });
                break;
            }
            case 'scroll': {
                const t0 = toOut(e.t0 ?? e.t, clip);
                const t1 = e.t1 !== undefined ? toOut(e.t1, clip) : t0;
                if (t1 < 0 || t0 > durOut) break;
                intents.push({
                    kind: 'scroll',
                    t0: Math.max(0, t0), t1: Math.min(durOut, Math.max(t1, t0 + POINT_SPAN_S / clip.speed)),
                    box: e.box, point: e.at,
                    why: `scroll ${e.selector || ''}`.trim(),
                });
                break;
            }
            default: break;   // move/keyChord/settle shape the cursor and badges, not the camera
        }
    }
    return { intents, contentT: contentT ?? 0 };
}

// ── zoom sizing: one formula plus a table ────────────────────────────────────────────
function zoomFor(box, kind, cfg) {
    const range = RANGES[kind] || RANGES.click;
    let z;
    if (!box) {
        z = range[0];                              // point intent: the calm end of the range
    } else if (Math.max(box.w, box.h) > GIANT_DIM) {
        return 1;                                  // a giant container: the modal pull-back analog
    } else {
        const areaSize = Math.max(box.w + 2 * BOX_PAD, box.h + 2 * BOX_PAD);
        z = Math.min(range[1], Math.max(range[0], COVERAGE / areaSize));
    }
    z = 1 + (z - 1) * (cfg.intensity ?? 1);        // intensity scales the zoom-1 part, post-plan
    return Math.min(cfg.maxZoom ?? 2.2, Math.max(1, z));
}

// Center on the target, shifted minimally so the padded box fits the crop, then clamped so
// the crop never leaves the frame. Applied here, at every spring tick, and once more in
// pixel space -- belt and braces, exactly as Screenize does.
function centerFor(box, point, zoom) {
    const half = 0.5 / Math.max(1, zoom);
    let cx, cy;
    if (box) {
        cx = box.x + box.w / 2;
        cy = box.y + box.h / 2;
        const fit = (c, lo, size) => {
            const min = lo + size - half, max = lo + half;
            return min > max ? c : Math.min(max, Math.max(min, c));
        };
        cx = fit(cx, box.x - BOX_PAD, box.w + 2 * BOX_PAD);
        cy = fit(cy, box.y - BOX_PAD, box.h + 2 * BOX_PAD);
    } else if (point) {
        cx = point[0]; cy = point[1];
    } else {
        cx = 0.5; cy = 0.5;
    }
    return { cx: clampCenter(cx, zoom), cy: clampCenter(cy, zoom) };
}

const boxUnion = (a, b) => {
    if (!a) return b; if (!b) return a;
    const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
    return {
        x, y,
        w: Math.max(a.x + a.w, b.x + b.w) - x,
        h: Math.max(a.y + a.h, b.y + b.h) - y,
    };
};

// ── the planner ──────────────────────────────────────────────────────────────────────
// plan(events, clip, cfg) -> schema-2 camera plan.
//   clip: { trimStart, speed, durOut, fps }   (seconds; output-time durOut)
//   cfg:  { intensity, maxZoom, holdLastFrame, response, zoomResponse }
function plan(events, clip, cfg = {}) {
    const durOut = clip.durOut;
    const { intents: raw, contentT } = extractIntents(events || [], clip);

    // anticipation: the camera leads the action, floored at the content-arrival marker
    let intents = raw.map((it) => {
        const lead = it.kind === 'click' ? ANTICIPATION.click
            : it.kind === 'scroll' ? ANTICIPATION.scroll : ANTICIPATION.typing;
        return {
            ...it,
            t0: Math.max(0, contentT, it.t0 - lead),
            t1: Math.max(0, it.t1 - lead),
        };
    }).filter((it) => it.t1 > it.t0 && it.t0 < durOut)
        .sort((a, b) => a.t0 - b.t0);

    // merge: near in time AND space becomes one focus over the union of boxes
    const merged = [];
    for (const it of intents) {
        const prev = merged[merged.length - 1];
        if (prev) {
            const pc = centerFor(prev.box, prev.point, 2);
            const ic = centerFor(it.box, it.point, 2);
            const dist = Math.hypot(pc.cx - ic.cx, pc.cy - ic.cy);
            if (it.t0 - prev.t1 <= MERGE_GAP_S && dist <= MERGE_DIST) {
                prev.t1 = Math.max(prev.t1, it.t1);
                prev.box = boxUnion(prev.box, it.box);
                prev.why = `${prev.why} (merged)`.replace(/( \(merged\))+$/, ' (merged)');
                continue;
            }
        }
        merged.push({ ...it });
    }

    // resolve each focus to a target
    let foci = merged.map((it) => {
        const zoom = zoomFor(it.box, it.kind, cfg);
        const { cx, cy } = centerFor(it.box, it.point, zoom);
        return { ...it, zoom, cx, cy, active: true };
    });

    // idle pull-back between distant foci: decay toward 1, center inherited (never snap)
    const withIdle = [];
    for (let i = 0; i < foci.length; i++) {
        const f = foci[i];
        withIdle.push(f);
        const next = foci[i + 1];
        if (next && next.t0 - f.t1 > IDLE_GAP_S) {
            withIdle.push({
                kind: 'idle', active: false,
                t0: f.t1, t1: next.t0,
                zoom: 1 + (f.zoom - 1) * IDLE_DECAY, cx: f.cx, cy: f.cy,
                why: 'idle',
            });
        }
    }

    // yo-yo removal over (active, passive, active) triples: zooming out only to zoom back
    // into the same place reads as indecision, not craft
    foci = withIdle;
    for (let i = 1; i < foci.length - 1; i++) {
        const [a, m, b] = [foci[i - 1], foci[i], foci[i + 1]];
        if (!a.active || m.active || !b.active) continue;
        if (Math.abs(a.zoom - b.zoom) >= YOYO.zClose) continue;
        const d = Math.hypot(a.cx - b.cx, a.cy - b.cy);
        const gap = b.t0 - a.t1;
        if (d <= YOYO.dTight || (d <= YOYO.dLoose && gap < YOYO.gapS)) {
            foci.splice(i, 1); i--;                       // delete the middle
        } else {
            m.zoom = Math.max(a.zoom * YOYO.decay, 1);    // soften it instead
        }
    }

    // ── segment emission: contiguous, sorted, first t0=0, last t1=durOut ─────────────
    const segments = [];
    let cur = { zoom: 1, cx: 0.5, cy: 0.5 };
    let cursor = 0;
    const pushHold = (t1, why) => {
        if (t1 - cursor < 1e-3) return;
        segments.push({
            t0: r3(cursor), t1: r3(t1),
            from: { zoom: r3(cur.zoom), cx: r3(cur.cx), cy: r3(cur.cy) },
            to: { zoom: r3(cur.zoom), cx: r3(cur.cx), cy: r3(cur.cy) },
            why,
        });
        cursor = t1;
    };
    const pushMove = (t0, t1, to, why) => {
        segments.push({
            t0: r3(t0), t1: r3(t1),
            from: { zoom: r3(cur.zoom), cx: r3(cur.cx), cy: r3(cur.cy) },
            to: { zoom: r3(to.zoom), cx: r3(to.cx), cy: r3(to.cy) },
            why,
        });
        cur = { zoom: to.zoom, cx: to.cx, cy: to.cy };
        cursor = t1;
    };

    for (const f of foci) {
        if (cursor >= durOut) break;
        const start = Math.max(f.t0, cursor);
        const dist = Math.hypot(f.cx - cur.cx, f.cy - cur.cy);
        const dz = Math.abs(f.zoom - cur.zoom);
        if (dist <= SKIP_DIST && dz <= SKIP_ZOOM) {
            // not worth a move: stay where we are through this focus
            pushHold(Math.min(Math.max(f.t1, cursor), durOut), 'hold');
            continue;
        }
        pushHold(Math.min(start, durOut), segments.length ? 'hold' : 'establish');
        if (cursor >= durOut) break;
        const moveDur = Math.min(MOVE_MAX_S, Math.max(MOVE_MIN_S, Math.max(dist * MOVE_PER_DIST, dz * MOVE_PER_ZOOM)));
        const spanEnd = Math.max(f.t1, cursor + moveDur);
        const moveEnd = Math.min(spanEnd - cursor >= moveDur + MIN_HOLD_S ? cursor + moveDur : spanEnd, durOut);
        pushMove(cursor, moveEnd, f, f.why);
        if (f.t1 > cursor && cursor < durOut) pushHold(Math.min(f.t1, durOut), 'hold');
    }

    // release: with enough tail, breathe back out to the full frame
    const releaseEnabled = cfg.holdLastFrame !== false;
    const remaining = durOut - cursor;
    if (releaseEnabled && remaining >= RELEASE_REMAINING_S
        && (Math.abs(cur.zoom - 1) > 1e-3 || Math.abs(cur.cx - 0.5) > 1e-3 || Math.abs(cur.cy - 0.5) > 1e-3)) {
        pushMove(cursor, Math.min(cursor + Math.min(RELEASE_S, remaining), durOut), { zoom: 1, cx: 0.5, cy: 0.5 }, 'release');
    }
    pushHold(durOut, segments.length ? 'hold' : 'establish');

    return {
        schema: 1,
        shot: null,   // the caller stamps the shot id
        mode: 'segments',
        clip: { trimStart: r3(clip.trimStart), speed: r3(clip.speed), durOut: r3(durOut), fps: clip.fps || 30 },
        config: { intensity: cfg.intensity ?? 1, maxZoom: cfg.maxZoom ?? 2.2 },
        segments,
    };
}

// ── override normalization ───────────────────────────────────────────────────────────
// A user/agent-supplied segments array is welcomed, then made safe: sorted, zoom clamped
// with a warning, centers clamped so the crop stays in frame, gaps filled with holds, the
// ends pinned to [0, durOut]. Overrides then ride the same spring bake, so they inherit the
// house motion for free.
function normalizeOverride(rawSegments, clip, cfg = {}) {
    const warnings = [];
    const maxZoom = cfg.maxZoom ?? 2.2;
    const durOut = clip.durOut;
    const fix = (p, label, i) => {
        let zoom = Number(p.zoom);
        if (!(zoom >= 1)) { zoom = Math.max(1, zoom || 1); }
        if (zoom > maxZoom) {
            warnings.push(`segments[${i}].${label}.zoom ${p.zoom} exceeds maxZoom ${maxZoom}; clamped.`);
            zoom = maxZoom;
        }
        return {
            zoom: r3(zoom),
            cx: r3(clampCenter(Math.min(1, Math.max(0, Number(p.cx))), zoom)),
            cy: r3(clampCenter(Math.min(1, Math.max(0, Number(p.cy))), zoom)),
        };
    };

    const sorted = rawSegments.slice().sort((a, b) => Number(a.t0) - Number(b.t0));
    const segments = [];
    let cursor = 0;
    let cur = sorted.length ? fix(sorted[0].from, 'from', 0) : { zoom: 1, cx: 0.5, cy: 0.5 };
    for (let i = 0; i < sorted.length; i++) {
        const s = sorted[i];
        const t0 = Math.max(0, Math.min(durOut, Number(s.t0)));
        const t1 = Math.max(t0, Math.min(durOut, Number(s.t1)));
        if (t0 - cursor > 1e-3) {
            warnings.push(`gap before segments[${i}] filled with a hold.`);
            segments.push({ t0: r3(cursor), t1: r3(t0), from: cur, to: cur, why: 'hold (gap)' });
        }
        const from = cur;                 // continuity beats the override's own `from`
        const to = fix(s.to, 'to', i);
        segments.push({ t0: r3(Math.max(cursor, t0)), t1: r3(t1), from, to, why: s.why || 'override' });
        cur = to;
        cursor = t1;
    }
    if (durOut - cursor > 1e-3) segments.push({ t0: r3(cursor), t1: r3(durOut), from: cur, to: cur, why: 'hold (tail)' });
    if (!segments.length) segments.push({ t0: 0, t1: r3(durOut), from: cur, to: cur, why: 'establish' });

    return {
        plan: {
            schema: 1, shot: null, mode: 'segments',
            clip: { trimStart: r3(clip.trimStart), speed: r3(clip.speed), durOut: r3(durOut), fps: clip.fps || 30 },
            config: { intensity: cfg.intensity ?? 1, maxZoom },
            segments,
        },
        warnings,
    };
}

module.exports = {
    COVERAGE, BOX_PAD, RANGES, ANTICIPATION,
    toOut, extractIntents, zoomFor, centerFor, plan, normalizeOverride,
};
