// The drawn cursor: sprites, the chase spring, and the click squash.
//
// A headless capture has no cursor at all -- Playwright's pointer is invisible -- so the
// cursor is DRAWN over the processed footage, which is precisely the architecture both study
// apps converged on (footage stays clean; the cursor re-styles without re-capturing). Sprites
// are vector paths rendered at the exact pixel size each frame, crisp at any zoom. The arrow
// outline is Screenize's (Apache-2.0, see the study doc): black fill with a white round-joined
// stroke, the one combination legible on any background.

// @ts-expect-error -- CJS shared with the Node side; esbuild inlines it
import overlay from "../../../lib/camera/overlay.cjs";
// @ts-expect-error -- same spring the camera uses
import spring from "../../../lib/camera/spring.cjs";

export interface CursorCfg {
    show: boolean;
    style: "auto" | "arrow" | "pointer" | "text" | "dot" | "none";
    scale: number;
    smoothing: number;
    clickBounce: number;
    color: string | null;   // dot tint; null = accent
    accent: string;
}
export interface StyleSpan { t0: number; t1: number; style: string; }
export interface ClickMark { t: number; x: number; y: number; }

interface SpringState { x: number; v: number; }

const state: {
    cfg: CursorCfg | null;
    track: number[][];
    styles: StyleSpan[];
    clicks: ClickMark[];
    sx: SpringState | null;    // camera-relative spring state, per axis
    sy: SpringState | null;
} = { cfg: null, track: [], styles: [], clicks: [], sx: null, sy: null };

export function initCursor(cfg: CursorCfg, track: number[][], styles: StyleSpan[], clicks: ClickMark[]) {
    state.cfg = cfg;
    state.track = track;
    state.styles = styles;
    state.clicks = clicks;
    state.sx = null;
    state.sy = null;
}

function activeStyle(t: number): string {
    const cfg = state.cfg!;
    if (cfg.style !== "auto") return cfg.style;
    for (let i = state.styles.length - 1; i >= 0; i--) {
        const s = state.styles[i];
        if (t >= s.t0 && t <= s.t1) return s.style;
    }
    return "arrow";
}

// ── sprites ──────────────────────────────────────────────────────────────────────────
// Each draws into a ctx already translated to the HOTSPOT and scaled so the design box maps
// to the requested height. Black body, white outline, soft shadow.

function outlined(ctx: CanvasRenderingContext2D, p: Path2D, fill: string) {
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.35)";
    ctx.shadowBlur = 3;
    ctx.shadowOffsetY = 1.5;
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1.5;
    ctx.lineJoin = "round";
    ctx.stroke(p);
    ctx.shadowColor = "transparent";
    ctx.fillStyle = fill;
    ctx.fill(p);
    ctx.restore();
}

// Screenize's arrow, 17x25 design box, hotspot at the tip (1.5, 1).
function drawArrow(ctx: CanvasRenderingContext2D, h: number) {
    const k = h / 25;
    ctx.save();
    ctx.scale(k, k);
    ctx.translate(-1.5, -1);
    const p = new Path2D("M1.5 1 L1.5 18.5 L5.5 14.5 L9.5 22.5 L12 21.5 L8 13.5 L13.5 13.5 Z");
    outlined(ctx, p, "#101014");
    ctx.restore();
}

// A pointing hand, 20x24 design box, hotspot at the index fingertip (7, 1).
function drawPointer(ctx: CanvasRenderingContext2D, h: number) {
    const k = h / 24;
    ctx.save();
    ctx.scale(k, k);
    ctx.translate(-7, -1);
    const p = new Path2D(
        // index finger up, three folded knuckles, thumb tucked left
        "M5.6 1.8 a1.9 1.9 0 0 1 3.8 0 V10 h1.6 a1.6 1.6 0 0 1 3.2 0.3 h0.3 a1.55 1.55 0 0 1 3.1 0.4 " +
        "V16.5 a6 6 0 0 1 -6 6 H9.2 a5.6 5.6 0 0 1 -4.6 -2.4 L2.2 16.6 a1.8 1.8 0 0 1 2.9 -2.1 " +
        "l0.5 0.6 V1.8 Z");
    outlined(ctx, p, "#101014");
    ctx.restore();
}

// An I-beam, 12x22 design box, hotspot centered.
function drawText(ctx: CanvasRenderingContext2D, h: number) {
    const k = h / 22;
    ctx.save();
    ctx.scale(k, k);
    ctx.translate(-6, -11);
    const p = new Path2D(
        "M2 1 h3 a2 2 0 0 1 1 0.7 a2 2 0 0 1 1 -0.7 h3 v2 h-2 a1 1 0 0 0 -1 1 v14 a1 1 0 0 0 1 1 " +
        "h2 v2 h-3 a2 2 0 0 1 -1 -0.7 a2 2 0 0 1 -1 0.7 H2 v-2 h2 a1 1 0 0 0 1 -1 V4 a1 1 0 0 0 -1 -1 H2 Z");
    outlined(ctx, p, "#101014");
    ctx.restore();
}

// A tinted disc with a white ring: the minimal cursor for dense UI footage.
function drawDot(ctx: CanvasRenderingContext2D, h: number, tint: string) {
    const r = h * 0.24;
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.4)";
    ctx.shadowBlur = 4;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = tint;
    ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.lineWidth = Math.max(1.5, r * 0.28);
    ctx.strokeStyle = "rgba(255,255,255,0.92)";
    ctx.stroke();
    ctx.restore();
}

// ── per-frame drawing ────────────────────────────────────────────────────────────────
// content point -> screen: the same crop math the camera draw uses.
export function contentToScreen(
    t: { zoom: number; cx: number; cy: number }, x: number, y: number, W: number, H: number,
) {
    const zoom = Math.max(1, t.zoom);
    const sw = W / zoom, sh = H / zoom;
    const sx = Math.min(W - sw, Math.max(0, t.cx * W - sw / 2));
    const sy = Math.min(H - sh, Math.max(0, t.cy * H - sh / 2));
    return { x: (x * W - sx) * zoom, y: (y * H - sy) * zoom };
}

export function drawCursor(
    ctx: CanvasRenderingContext2D,
    tOut: number, dt: number,
    cam: { zoom: number; cx: number; cy: number },
    W: number, H: number,
) {
    const cfg = state.cfg;
    if (!cfg || !cfg.show || cfg.style === "none") return null;
    const raw = overlay.sampleTrack(state.track, tOut);
    if (!raw) return null;

    // 🧲 The chase spring runs CAMERA-RELATIVE: the springed value is the cursor's offset
    //    from the camera center, so a camera pan does not read as cursor drag (Screenize's
    //    non-obvious fix; without it the cursor visibly slides during every pan).
    let x = raw.x, y = raw.y;
    const sp = overlay.cursorSpring(cfg.smoothing);
    if (sp) {
        const rx = raw.x - cam.cx, ry = raw.y - cam.cy;
        if (!state.sx) { state.sx = { x: rx, v: 0 }; state.sy = { x: ry, v: 0 }; }
        // a track discontinuity (hold -> snap) must snap the spring too
        const dx = Math.hypot(state.sx.x - rx, state.sy!.x - ry);
        if (dx > 0.25) { state.sx = { x: rx, v: 0 }; state.sy = { x: ry, v: 0 }; }
        state.sx = spring.springStep(state.sx.x, state.sx.v, rx, dt, sp.response, sp.zeta);
        state.sy = spring.springStep(state.sy!.x, state.sy!.v, ry, dt, sp.response, sp.zeta);
        x = state.sx.x + cam.cx;
        y = state.sy.x + cam.cy;
    }

    const pt = contentToScreen(cam, x, y, W, H);
    const h = overlay.cursorPx(cfg.scale, W, cam.zoom);

    // squash: the most recent click inside its window presses the sprite down
    let squash = 1;
    for (let i = state.clicks.length - 1; i >= 0; i--) {
        const c = state.clicks[i];
        const p = (tOut - c.t) / (overlay.SQUASH_MS / 1000);
        if (p >= 0 && p <= 1) { squash = overlay.squashScale(p, cfg.clickBounce, cam.zoom); break; }
        if (c.t < tOut - overlay.SQUASH_MS / 1000) break;
    }

    ctx.save();
    ctx.translate(pt.x, pt.y);
    ctx.scale(squash, squash);
    const style = activeStyle(tOut);
    if (style === "dot") drawDot(ctx, h, cfg.color || cfg.accent);
    else if (style === "pointer") drawPointer(ctx, h);
    else if (style === "text") drawText(ctx, h);
    else drawArrow(ctx, h);
    ctx.restore();
    return { x, y, screen: pt, h };
}
