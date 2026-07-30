// Scene: pixel-scan — a diagonal band sweeps across the frame and leaves a word behind it,
// assembled from a spray of tiny coloured blocks that settle into solid type.
// props: word, cellSize, hue, bg, sweep, loop.
//
// The drop reaches for three.js. Nothing here needs a GPU: the word is rasterised once to an
// offscreen canvas, every lit pixel becomes a block with a scatter position, and the band's
// position decides how far each block has travelled home. That is a per-frame loop over a few
// thousand rects, which 2D canvas does comfortably, and it keeps the bundle at a few KB.

import { canvas, rng, setFont, SANS } from "../shared/source";

interface Block { hx: number; hy: number; sx: number; sy: number; hue: number; d: number; }

export default {
    async mount(host: HTMLElement, props: Record<string, unknown>) {
        const word = (typeof props.word === "string" ? props.word : "SCAN").slice(0, 16);
        const cell = typeof props.cellSize === "number" ? Math.max(4, props.cellSize) : 9;
        const hue = typeof props.hue === "number" ? props.hue : 190;
        const bg = typeof props.bg === "string" ? props.bg : "#07080d";
        const sweep = typeof props.sweep === "number" ? props.sweep : 2.6;   // seconds per pass
        const loop = props.loop !== false;

        const [c, ctx] = canvas(1, 1);
        Object.assign(c.style, { position: "absolute", inset: "0", width: "100%", height: "100%" });
        host.appendChild(c);

        let W = 0, H = 0, dpr = 1;
        let blocks: Block[] = [];
        const r = rng(7);

        const build = () => {
            const b = host.getBoundingClientRect();
            dpr = Math.min(2, window.devicePixelRatio || 1);
            W = Math.max(1, b.width); H = Math.max(1, b.height);
            c.width = Math.round(W * dpr); c.height = Math.round(H * dpr);

            // rasterise the word at grid resolution, then read it back as a bitmap
            const gw = Math.ceil(W / cell), gh = Math.ceil(H / cell);
            const [off, o] = canvas(gw, gh);
            const px = Math.min(gh * 0.42, (gw * 1.5) / Math.max(1, word.length));
            setFont(o, px, SANS, 800);
            o.fillStyle = "#fff";
            o.textAlign = "center";
            o.textBaseline = "middle";
            o.fillText(word, gw / 2, gh / 2);
            const data = o.getImageData(0, 0, gw, gh).data;

            blocks = [];
            for (let y = 0; y < gh; y++) {
                for (let x = 0; x < gw; x++) {
                    if (data[(y * gw + x) * 4 + 3] < 128) continue;
                    blocks.push({
                        hx: x * cell, hy: y * cell,
                        // scattered start: thrown wide and mostly from below, which reads as
                        // being swept up into place rather than falling into it
                        sx: x * cell + (r() - 0.5) * W * 0.7,
                        sy: y * cell + (r() - 0.3) * H * 0.8,
                        hue: hue + (r() - 0.5) * 70,
                        d: r(),
                    });
                }
            }
        };
        build();

        let raf = 0, t0 = performance.now(), done = false;

        const draw = (now: number) => {
            const el = (now - t0) / 1000;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.fillStyle = bg;
            ctx.fillRect(0, 0, W, H);

            // the band runs on a diagonal, so its position along the sweep axis is x+y
            const span = W + H;
            const p = Math.min(1, el / sweep);
            const bandAt = -H + p * (span + H);
            const BAND = 190;

            ctx.globalCompositeOperation = "lighter";
            for (const b of blocks) {
                // how far behind the band this block sits decides how settled it is
                const behind = bandAt - (b.hx + b.hy);
                let s = behind / BAND;
                s = s < 0 ? 0 : s > 1 ? 1 : s;
                const e = 1 - Math.pow(1 - s, 3);
                if (e <= 0.001) continue;

                const x = b.sx + (b.hx - b.sx) * e;
                const y = b.sy + (b.hy - b.sy) * e;
                // blocks still in flight stay hot and slightly oversized
                const heat = 1 - e;
                const size = cell * (1 + heat * 1.4);
                ctx.fillStyle = e > 0.985
                    ? "#ffffff"
                    : `hsla(${b.hue}, 92%, ${58 + heat * 24}%, ${0.25 + e * 0.75})`;
                ctx.fillRect(x, y, size, size);
            }
            ctx.globalCompositeOperation = "source-over";

            // the leading edge of the band, drawn as a thin diagonal glow
            if (p < 1) {
                ctx.save();
                const g = ctx.createLinearGradient(bandAt, 0, bandAt - BAND, BAND);
                g.addColorStop(0, `hsla(${hue}, 100%, 72%, .55)`);
                g.addColorStop(1, "hsla(0,0%,0%,0)");
                ctx.fillStyle = g;
                ctx.translate(0, 0);
                ctx.beginPath();
                ctx.moveTo(bandAt, 0); ctx.lineTo(bandAt - H, H);
                ctx.lineTo(bandAt - H - 26, H); ctx.lineTo(bandAt - 26, 0);
                ctx.closePath();
                ctx.fill();
                ctx.restore();
            }

            if (p >= 1 && !done) {
                done = true;
                if (loop) window.setTimeout(() => { t0 = performance.now(); done = false; }, 1400);
            }
            raf = requestAnimationFrame(draw);
        };

        const onResize = () => build();
        window.addEventListener("resize", onResize);

        return {
            start: () => { t0 = performance.now(); raf = requestAnimationFrame(draw); },
            action: async (name: string) => {
                if (name === "rescan") { t0 = performance.now(); done = false; }
            },
            destroy: () => {
                cancelAnimationFrame(raf);
                window.removeEventListener("resize", onResize);
                c.remove();
            },
        };
    },
};
