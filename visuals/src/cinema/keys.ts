// Keystroke badges: chord pills (⇧⌘Z) and the typing pill, rendered AFTER the camera
// transform in fixed screen space -- never zoomed, never blurred (the overlay layering rule
// that keeps them crisp). Designed fresh, because neither study app shipped this working:
// Recordly's is typed but never called, Screenize's overlap at one anchor.
//
// The stacking fix: one row anchored at the configured position. The NEWEST badge takes the
// anchor; older badges slide left with a fixed gap, eased, and the fourth evicts the oldest.
// The typing pill owns the anchor exclusively while it is alive.

// @ts-expect-error -- CJS shared with the Node side; esbuild inlines it
import overlay from "../../../lib/camera/overlay.cjs";

export interface KeysCfg {
    show: boolean;
    chords: boolean;
    typing: "pill" | "none";
    symbols: "mac" | "text";
    durationMs: number;
    position: [number, number];   // normalized, in clip space
}
export interface ChordBadge { kind: "chord"; t: number; label: string; count: number; }
export interface PillBadge { kind: "pill"; t0: number; tLast: number; text: string; keys: { t: number; ch: string }[]; }
export type Badge = ChordBadge | PillBadge;

const FADE_IN_S = 0.15;
const FADE_OUT_S = 0.3;
const GAP_PX = 8;
const SLIDE_RESPONSE_S = 0.05;    // exponential approach; ~150 ms to visually settle
const MAX_VISIBLE = 3;
const ELIDE_CHARS = 24;

const state: {
    cfg: KeysCfg | null;
    badges: Badge[];
    slideX: Map<Badge, number>;   // per-badge current x offset (left of anchor), eased
} = { cfg: null, badges: [], slideX: new Map() };

export function initKeys(cfg: KeysCfg, badges: Badge[]) {
    state.cfg = cfg;
    state.badges = badges;
    state.slideX = new Map();
}

interface Live { badge: Badge; alpha: number; label: string; birth: number; }

function chordAlpha(b: ChordBadge, t: number, durS: number): number {
    const age = t - b.t;
    if (age < 0 || age > durS + FADE_OUT_S) return 0;
    if (age < FADE_IN_S) return age / FADE_IN_S;
    if (age > durS) return 1 - (age - durS) / FADE_OUT_S;
    return 1;
}

function pillAlpha(b: PillBadge, t: number): number {
    const end = b.tLast + overlay.PILL_HOLD_S;
    if (t < b.t0 || t > end + FADE_OUT_S) return 0;
    if (t < b.t0 + FADE_IN_S) return (t - b.t0) / FADE_IN_S;
    if (t > end) return 1 - (t - end) / FADE_OUT_S;
    return 1;
}

function pillText(b: PillBadge, t: number): string {
    let n = 0;
    for (const k of b.keys) { if (k.t <= t) n++; else break; }
    let text = b.text.slice(0, n);
    if (!text) text = " ";                 // hair space: the empty pill still has a body
    if (text.length > ELIDE_CHARS) text = `…${text.slice(text.length - ELIDE_CHARS)}`;
    return text;
}

export function drawKeys(
    ctx: CanvasRenderingContext2D, tOut: number, dt: number, W: number, H: number,
) {
    const cfg = state.cfg;
    if (!cfg || !cfg.show) return;
    const durS = cfg.durationMs / 1000;

    // who is alive right now, newest first
    const live: Live[] = [];
    for (const b of state.badges) {
        if (b.kind === "chord") {
            const a = chordAlpha(b, tOut, durS);
            if (a > 0) live.push({ badge: b, alpha: a, label: b.count >= 3 ? `${b.label} ×${b.count}` : b.label, birth: b.t });
        } else {
            const a = pillAlpha(b, tOut);
            if (a > 0) live.push({ badge: b, alpha: a, label: pillText(b, tOut), birth: b.t0 });
        }
    }
    if (!live.length) return;
    live.sort((a, b) => b.birth - a.birth);
    const visible = live.slice(0, MAX_VISIBLE);   // the fourth evicts the oldest, instantly

    const font = Math.max(24, H * 0.03);
    ctx.save();
    ctx.font = `500 ${font}px -apple-system, 'Helvetica Neue', Arial, sans-serif`;
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";

    const anchorX = cfg.position[0] * W;
    const anchorY = cfg.position[1] * H;
    const padH = font * 0.8;
    const padV = font * 0.4;
    const radius = font * 0.4;

    // layout: newest centered on the anchor, older sliding left with the gap; positions ease
    // toward their targets so a new arrival pushes the row instead of teleporting it
    let cursorLeft = 0;   // running offset of the current badge's RIGHT edge, from anchor
    for (let i = 0; i < visible.length; i++) {
        const item = visible[i];
        const w = ctx.measureText(item.label).width + padH * 2;
        const targetCenter = i === 0 ? 0 : cursorLeft - w / 2;
        cursorLeft = (i === 0 ? -w / 2 : targetCenter - w / 2) - GAP_PX;

        let x = state.slideX.get(item.badge);
        if (x === undefined) x = targetCenter;   // born in place
        x += (targetCenter - x) * (1 - Math.exp(-dt / SLIDE_RESPONSE_S));
        state.slideX.set(item.badge, x);

        const cx = anchorX + x;
        const h = font + padV * 2;
        ctx.globalAlpha = item.alpha;
        ctx.fillStyle = "rgba(26,26,26,0.75)";
        ctx.beginPath();
        ctx.roundRect(cx - w / 2, anchorY - h / 2, w, h, radius);
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.fillText(item.label, cx, anchorY + font * 0.04);
    }
    ctx.restore();
}
