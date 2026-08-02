// Click effects: the ripple (one expanding, fading ring) and the spotlight (two converging
// rings). Geometry from Recordly's canvas functions, re-expressed from the study doc's math
// (constants live in lib/camera/overlay.cjs, shared with the tests).
//
// Effects are anchored at the CLICK's recorded position, not the smoothed cursor -- the ring
// marks where the event happened, and the spring may still be arriving. They render in the
// camera's screen space at the transformed point, scaled by zoom: they belong to the content,
// unlike badges, which belong to the glass.

// @ts-expect-error -- CJS shared with the Node side; esbuild inlines it
import overlay from "../../../lib/camera/overlay.cjs";
import { contentToScreen } from "./cursor";
import type { ClickMark } from "./cursor";

export interface ClicksCfg {
    effect: "ripple" | "spotlight" | "none";
    color: string;          // resolved: user color or accent
    scale: number;
    opacity: number;
    durationMs: number;
    cursorScale: number;    // the cursor cfg's scale: effect geometry keys off cursor height
}

const state: { cfg: ClicksCfg | null; clicks: ClickMark[] } = { cfg: null, clicks: [] };

export function initEffects(cfg: ClicksCfg, clicks: ClickMark[]) {
    state.cfg = cfg;
    state.clicks = clicks;
}

export function drawEffects(
    ctx: CanvasRenderingContext2D,
    tOut: number,
    cam: { zoom: number; cx: number; cy: number },
    W: number, H: number,
) {
    const cfg = state.cfg;
    if (!cfg || cfg.effect === "none") return;
    const durS = cfg.durationMs / 1000;
    const delayS = overlay.EFFECT_DELAY_MS / 1000;
    const cursorH = overlay.cursorPx(cfg.cursorScale, W, cam.zoom);

    for (const c of state.clicks) {
        const started = c.t + delayS;
        const p = 1 - (tOut - started) / durS;     // 1 -> 0 over the duration
        if (p <= 0 || p > 1) continue;
        const pt = contentToScreen(cam, c.x, c.y, W, H);

        ctx.save();
        if (cfg.effect === "ripple") {
            const r = overlay.rippleShape(p, cursorH, cfg.scale, cfg.opacity);
            ctx.globalAlpha = r.alpha;
            ctx.strokeStyle = cfg.color;
            ctx.lineWidth = r.strokeWidth;
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, r.radius, 0, Math.PI * 2);
            ctx.stroke();
        } else {
            const s = overlay.spotlightShape(p, cursorH, cfg.scale, cfg.opacity);
            ctx.strokeStyle = cfg.color;
            ctx.globalAlpha = s.outerAlpha;
            ctx.lineWidth = s.outerWidth;
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, s.glowR, 0, Math.PI * 2);
            ctx.stroke();
            ctx.globalAlpha = s.innerAlpha;
            ctx.lineWidth = s.innerWidth;
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, s.innerR, 0, Math.PI * 2);
            ctx.stroke();
        }
        ctx.restore();
    }
}
