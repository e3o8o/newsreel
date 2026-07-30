// Scene: pixel-field — images cycling in and out of chunky pixelation, the swap sliding,
// scaling and skewing as one goes out and the next comes in.
// props: sources[] (urls), hold, swap, maxBlock, bg, label.
//
// The drop wants gsap and an image set. The tween here is four eased channels driven off one
// clock, which is less code than importing a tween library to do the same thing, and the images
// generate themselves when none are supplied.
//
// The pixelation is a two-step draw: shrink the frame to a handful of pixels with smoothing
// off, then blow it back up, also with smoothing off. That is what gives hard square blocks
// rather than a blur, and it costs one extra drawImage.

import { canvas, plate, sourceImages } from "../shared/source";

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export default {
    async mount(host: HTMLElement, props: Record<string, unknown>) {
        const hold = typeof props.hold === "number" ? props.hold : 1.5;      // seconds sharp
        const swap = typeof props.swap === "number" ? props.swap : 1.15;     // seconds of transition
        const maxBlock = typeof props.maxBlock === "number" ? props.maxBlock : 44;
        const bg = typeof props.bg === "string" ? props.bg : "#0a0a0f";

        // ⚠️ landscape and busy, on purpose. Pixelation only reads against detail: a tall,
        // smooth gradient gets cover-cropped to a single soft wash, and 8px blocks over a soft
        // wash are invisible, so the effect looked like it had simply failed.
        const imgs = await sourceImages(props.sources, 5, (i) => plate(i * 13 + 3, 640, 420));

        const [c, ctx] = canvas(1, 1);
        Object.assign(c.style, { position: "absolute", inset: "0", width: "100%", height: "100%" });
        host.appendChild(c);

        // the scratch buffer the pixelation goes through; sized to the block count, not the frame
        const [buf, bctx] = canvas(1, 1);

        let W = 0, H = 0, dpr = 1;
        const fit = () => {
            const b = host.getBoundingClientRect();
            dpr = Math.min(2, window.devicePixelRatio || 1);
            W = Math.max(1, b.width); H = Math.max(1, b.height);
            c.width = Math.round(W * dpr); c.height = Math.round(H * dpr);
        };
        fit();

        // cover-fit an image into a box, offset and scaled by the transition channels
        const paint = (
            img: CanvasImageSource, target: CanvasRenderingContext2D,
            w: number, h: number, dx: number, scale: number, skew: number,
        ) => {
            const iw = (img as HTMLImageElement).naturalWidth || (img as HTMLCanvasElement).width;
            const ih = (img as HTMLImageElement).naturalHeight || (img as HTMLCanvasElement).height;
            const k = Math.max(w / iw, h / ih) * scale;
            target.save();
            target.translate(w / 2 + dx, h / 2);
            target.transform(1, 0, skew, 1, 0, 0);
            target.drawImage(img, -iw * k / 2, -ih * k / 2, iw * k, ih * k);
            target.restore();
        };

        let raf = 0;
        const t0 = performance.now();

        const draw = (now: number) => {
            // ⚠️ clamped: a rAF timestamp can precede the performance.now() taken at mount, and
            // a negative t makes floor(t/cycle) % n return -1, which indexes off the array
            const t = Math.max(0, (now - t0) / 1000);
            const cycle = hold + swap;
            const idx = Math.floor(t / cycle);
            const local = t - idx * cycle;
            // 0 while the image sits sharp, then 0 to 1 across the swap
            const p = local < hold ? 0 : easeInOut((local - hold) / swap);

            const a = imgs[idx % imgs.length];
            const b = imgs[(idx + 1) % imgs.length];

            // block size peaks in the middle of the swap: sharp, coarse, sharp again
            const chunk = 1 + Math.sin(Math.min(1, p) * Math.PI) * maxBlock;
            const bw = Math.max(2, Math.round(W / chunk));
            const bh = Math.max(2, Math.round(H / chunk));
            buf.width = bw; buf.height = bh;
            bctx.imageSmoothingEnabled = false;
            bctx.fillStyle = bg;
            bctx.fillRect(0, 0, bw, bh);

            // outgoing slides left and shrinks, incoming arrives from the right; the crossfade
            // happens inside the coarse buffer so the blocks themselves blend
            const bufScale = bw / W;
            if (p < 1) {
                bctx.globalAlpha = 1 - p;
                paint(a, bctx, bw, bh, -p * W * 0.35 * bufScale, 1 + p * 0.28, -p * 0.22);
            }
            if (p > 0) {
                bctx.globalAlpha = p;
                paint(b, bctx, bw, bh, (1 - p) * W * 0.35 * bufScale, 1.28 - p * 0.28, (1 - p) * 0.22);
            }
            bctx.globalAlpha = 1;

            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.imageSmoothingEnabled = false;   // ⚠️ the whole effect is here: smoothing turns blocks into mush
            ctx.fillStyle = bg;
            ctx.fillRect(0, 0, W, H);
            ctx.drawImage(buf, 0, 0, W, H);

            raf = requestAnimationFrame(draw);
        };

        const onResize = () => fit();
        window.addEventListener("resize", onResize);

        return {
            start: () => { raf = requestAnimationFrame(draw); },
            destroy: () => {
                cancelAnimationFrame(raf);
                window.removeEventListener("resize", onResize);
                c.remove();
            },
        };
    },
};
