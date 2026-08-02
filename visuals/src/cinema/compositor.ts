// The cinema compositor: the in-page half of the camera pass.
//
// Node extracts the source clip to an output-time JPEG frame sequence (exact frames, no
// <video> seeking, no codec roulette -- Playwright's Chromium has no H.264, and VP9 seeks
// are asynchronous approximations; a numbered image is a numbered image). This page draws
// each frame through the camera transform, adds velocity-scaled motion blur as multi-draw
// accumulation, and hands back a JPEG. Cursor, click effects and key badges composite on
// top in later phases -- always AFTER the camera transform, never zoomed or blurred.
//
// Protocol (driven by lib/camera/render.cjs):
//   window.__CINEMA__.init(spec)        -> Promise<void>
//   window.__CINEMA__.renderFrame(i)    -> Promise<string>   (data:image/jpeg;base64,...)
//
// spec: { framesBase, frameCount, width, height, fps, transforms[], blur, jpegQuality }
//   transforms[i] = { zoom, cx, cy, vx, vy, vz }   (normalized; velocities units/s)
//   blur = { amount, panThreshold, zoomThreshold, panScale, zoomScale, maxRadius }

interface Transform { zoom: number; cx: number; cy: number; vx: number; vy: number; vz: number; }
interface BlurCfg {
    amount: number; panThreshold: number; zoomThreshold: number;
    panScale: number; zoomScale: number; maxRadius: number;
}
interface Spec {
    framesBase: string; frameCount: number;
    width: number; height: number; fps: number;
    transforms: Transform[];
    blur: BlurCfg;
    jpegQuality?: number;
}

const state: {
    spec: Spec | null;
    canvas: HTMLCanvasElement | null;
    ctx: CanvasRenderingContext2D | null;
    cache: Map<number, HTMLImageElement>;
} = { spec: null, canvas: null, ctx: null, cache: new Map() };

const frameUrl = (i: number) =>
    `${state.spec!.framesBase}f${String(i + 1).padStart(5, "0")}.jpg`;

async function loadFrame(i: number): Promise<HTMLImageElement> {
    const hit = state.cache.get(i);
    if (hit) return hit;
    const img = new Image();
    img.src = frameUrl(i);
    await img.decode();
    // a tiny LRU: the current frame, its blur neighbours, and the prefetched next
    state.cache.set(i, img);
    for (const k of state.cache.keys()) {
        if (state.cache.size <= 4) break;
        if (k < i - 1) state.cache.delete(k);
    }
    return img;
}

// Camera draw: source crop of size 1/zoom centered on (cx, cy), hard-clamped in PIXEL space
// (the spring may carry up to the soft-pushback overflow; this is where it becomes invisible).
function drawWithTransform(
    ctx: CanvasRenderingContext2D, img: HTMLImageElement,
    t: { zoom: number; cx: number; cy: number }, W: number, H: number, alpha = 1,
) {
    const zoom = Math.max(1, t.zoom);
    const sw = W / zoom, sh = H / zoom;
    const sx = Math.min(W - sw, Math.max(0, t.cx * W - sw / 2));
    const sy = Math.min(H - sh, Math.max(0, t.cy * H - sh / 2));
    ctx.globalAlpha = alpha;
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, W, H);
}

const lerpT = (a: Transform, b: Transform, f: number) => ({
    zoom: a.zoom + (b.zoom - a.zoom) * f,
    cx: a.cx + (b.cx - a.cx) * f,
    cy: a.cy + (b.cy - a.cy) * f,
});

async function renderFrame(i: number): Promise<string> {
    const spec = state.spec!;
    const { width: W, height: H } = spec;
    const ctx = state.ctx!;
    const idx = Math.min(spec.frameCount - 1, Math.max(0, i));
    const t = spec.transforms[Math.min(idx, spec.transforms.length - 1)];
    const prev = spec.transforms[Math.max(0, Math.min(idx, spec.transforms.length - 1) - 1)];
    const img = await loadFrame(idx);

    ctx.globalAlpha = 1;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);

    // 🌀 Motion blur as multi-draw accumulation (Screenize's velocity model, Recordly's
    //    cosine taper): when the CAMERA moves fast, draw the frame a few extra times along
    //    the previous->current transform delta with weights summing to 1. One decoded frame,
    //    K cheap draws; the content is what smears, never the overlays.
    const b = spec.blur;
    const panV = Math.hypot(t.vx, t.vy);
    const zoomV = Math.abs(t.vz);
    let radius = 0;
    if (b.amount > 0) {
        if (panV > b.panThreshold) radius = Math.max(radius, (panV - b.panThreshold) * b.panScale);
        if (zoomV > b.zoomThreshold) radius = Math.max(radius, (zoomV - b.zoomThreshold) * b.zoomScale);
        radius = Math.min(b.maxRadius, radius) * (b.amount / 0.35);
    }

    if (radius >= 2 && idx > 0) {
        const K = Math.min(8, Math.ceil(radius / 2));
        // Cosine-tapered target weights over K+1 layers: the trail fades, the current
        // transform stays heaviest. Drawn oldest-first; with source-over compositing a layer
        // drawn at alpha `a` scales everything beneath by (1-a), so to land on weights w_j
        // each layer's alpha is w_j / (w_0 + ... + w_j). The last (sharpest) layer's alpha
        // is its weight over the total, and the stack sums to exactly 1.
        const weights: number[] = [];
        for (let j = 0; j <= K; j++) {
            const trail = j / K;                        // 1 = oldest, 0 = current
            weights.push(0.25 + 0.75 * (1 + Math.cos(trail * Math.PI)) / 2);
        }
        let cum = 0;
        for (let j = K; j >= 0; j--) {                  // oldest -> newest
            const w = weights[j];
            cum += w;
            const alpha = w / cum;
            const f = 1 - j / (K + 1);                  // where along prev->current
            drawWithTransform(ctx, img, lerpT(prev, t, f), W, H, alpha);
        }
    } else {
        drawWithTransform(ctx, img, t, W, H, 1);
    }

    ctx.globalAlpha = 1;
    // prefetch the next frame while Node is busy encoding this one
    if (idx + 1 < spec.frameCount) void loadFrame(idx + 1).catch(() => undefined);
    return state.canvas!.toDataURL("image/jpeg", spec.jpegQuality ?? 0.9);
}

async function init(spec: Spec): Promise<void> {
    state.spec = spec;
    state.cache.clear();
    const c = document.createElement("canvas");
    c.width = spec.width;
    c.height = spec.height;
    c.style.width = `${spec.width}px`;
    c.style.height = `${spec.height}px`;
    document.body.textContent = "";
    document.body.appendChild(c);
    state.canvas = c;
    state.ctx = c.getContext("2d", { willReadFrequently: false })!;
    // decode the first frame up front so renderFrame(0) is not the slow one
    await loadFrame(0);
}

(window as unknown as { __CINEMA__: unknown }).__CINEMA__ = { init, renderFrame };
(window as unknown as { __CINEMA_READY__: boolean }).__CINEMA_READY__ = true;
