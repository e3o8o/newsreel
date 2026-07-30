// Scene: ascii-wordmark — particles held in the shape of a word by a flow field, sampled back
// into a grid and drawn as ASCII glyphs that drift and thicken with density.
// props: word, cols, ramp, hue, bg, flow, count.
//
// The drop does this as GPGPU on three.js. The physics is a few thousand particles nudged by a
// curl-ish field and pulled home by a spring, which is fine on the CPU, and the render is a
// character grid, which is the cheapest thing 2D canvas draws. So no GPU, no dependency.
//
// The glyph ramp is doing the shading: characters are chosen by how many particles landed in
// the cell, running from a dot up to a solid block, which is what makes the word legible while
// the particles are still swarming.

import { canvas, rng, setFont, MONO } from "../shared/source";

interface P { x: number; y: number; vx: number; vy: number; hx: number; hy: number; }

const DEFAULT_RAMP = " .:-=+*#%@";

export default {
    async mount(host: HTMLElement, props: Record<string, unknown>) {
        const word = (typeof props.word === "string" ? props.word : "ascii").slice(0, 14);
        const cols = typeof props.cols === "number" ? Math.max(40, props.cols) : 112;
        const ramp = typeof props.ramp === "string" && props.ramp.length > 1 ? props.ramp : DEFAULT_RAMP;
        const hue = typeof props.hue === "number" ? props.hue : 150;
        const bg = typeof props.bg === "string" ? props.bg : "#05070a";
        const flow = typeof props.flow === "number" ? props.flow : 1;
        const want = typeof props.count === "number" ? props.count : 6000;

        const [c, ctx] = canvas(1, 1);
        Object.assign(c.style, { position: "absolute", inset: "0", width: "100%", height: "100%" });
        host.appendChild(c);

        let W = 0, H = 0, dpr = 1, cw = 0, ch = 0, rows = 0;
        // particles per lit cell once settled. The glyph ramp is scaled against this: a fixed
        // constant either clips every cell to the top glyph (a solid block with no texture) or
        // never climbs out of the dots, depending on the word's length and the grid size.
        let avg = 1;
        let ps: P[] = [];
        let dens: Float32Array = new Float32Array(0);
        const r = rng(23);

        const build = () => {
            const b = host.getBoundingClientRect();
            dpr = Math.min(2, window.devicePixelRatio || 1);
            W = Math.max(1, b.width); H = Math.max(1, b.height);
            c.width = Math.round(W * dpr); c.height = Math.round(H * dpr);

            cw = W / cols;
            ch = cw * 1.86;                    // monospace cells are taller than they are wide
            rows = Math.max(1, Math.ceil(H / ch));
            dens = new Float32Array(cols * rows);

            // rasterise the word at grid resolution and seed particles on the lit pixels
            const [off, o] = canvas(cols, rows);
            const px = Math.min(rows * 0.5, (cols * 1.35) / Math.max(1, word.length));
            setFont(o, px, MONO, 700);
            o.fillStyle = "#fff";
            o.textAlign = "center";
            o.textBaseline = "middle";
            o.fillText(word, cols / 2, rows / 2);
            const data = o.getImageData(0, 0, cols, rows).data;

            const lit: Array<[number, number]> = [];
            for (let y = 0; y < rows; y++) {
                for (let x = 0; x < cols; x++) {
                    if (data[(y * cols + x) * 4 + 3] > 120) lit.push([x, y]);
                }
            }
            ps = [];
            if (!lit.length) return;
            avg = Math.max(1, want / lit.length);
            for (let i = 0; i < want; i++) {
                const [lx, ly] = lit[Math.floor(r() * lit.length)];
                const hx = (lx + r()) * cw, hy = (ly + r()) * ch;
                ps.push({ x: r() * W, y: r() * H, vx: 0, vy: 0, hx, hy });
            }
        };
        build();

        // a cheap curl-ish field: two sine lobes crossed, which gives swirls without a noise table
        const field = (x: number, y: number, t: number) => {
            const a = Math.sin(x * 0.0064 + t * 0.55) + Math.cos(y * 0.0052 - t * 0.4);
            const b = Math.cos(x * 0.0041 - t * 0.35) + Math.sin(y * 0.0073 + t * 0.5);
            return [b * 26 * flow, -a * 26 * flow];
        };

        let raf = 0;
        const t0 = performance.now();
        let last = t0;

        const draw = (now: number) => {
            const t = (now - t0) / 1000;
            const dt = Math.min(0.05, (now - last) / 1000);
            last = now;

            // the pull home ramps in over the first second and a half, so the word emerges out
            // of the swarm instead of being there from frame one
            const pull = Math.min(1, Math.max(0, (t - 0.4) / 1.6));
            // ⚠️ the flow has to get out of the way as the spring takes over. Left at full
            // strength it wins the tug of war and the word never resolves, which just reads as
            // noise. It keeps a tenth of its amplitude so the settled word still breathes.
            const swirl = 1 - pull * 0.9;
            const K = 34;                              // spring rate
            const C = 2 * Math.sqrt(K);                // critical damping, so it lands without ringing

            dens.fill(0);
            for (const p of ps) {
                const [fx, fy] = field(p.x, p.y, t);
                p.vx += (fx * swirl + ((p.hx - p.x) * K - p.vx * C) * pull) * dt;
                p.vy += (fy * swirl + ((p.hy - p.y) * K - p.vy * C) * pull) * dt;
                const drag = Math.pow(0.12, dt);        // frame-rate independent drag
                p.vx *= drag; p.vy *= drag;
                p.x += p.vx * dt; p.y += p.vy * dt;

                const gx = Math.floor(p.x / cw), gy = Math.floor(p.y / ch);
                if (gx >= 0 && gx < cols && gy >= 0 && gy < rows) dens[gy * cols + gx] += 1;
            }

            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.fillStyle = bg;
            ctx.fillRect(0, 0, W, H);
            setFont(ctx, ch * 0.92, MONO, 500);
            ctx.textBaseline = "top";
            ctx.textAlign = "left";

            const top = ramp.length - 1;
            for (let y = 0; y < rows; y++) {
                for (let x = 0; x < cols; x++) {
                    const d = dens[y * cols + x];
                    if (d < 0.5) continue;
                    const i = Math.min(top, Math.round(Math.sqrt(d / avg) * top * 0.62));
                    const gl = ramp[i];
                    if (gl === " ") continue;
                    const lum = 40 + (i / top) * 46;
                    ctx.fillStyle = `hsl(${hue + (i / top) * 44} 84% ${lum}%)`;
                    ctx.fillText(gl, x * cw, y * ch);
                }
            }
            raf = requestAnimationFrame(draw);
        };

        const onResize = () => build();
        window.addEventListener("resize", onResize);

        return {
            start: () => { raf = requestAnimationFrame(draw); },
            action: async (name: string) => {
                // "scatter" throws the swarm apart again so it can re-form on a beat
                if (name === "scatter") {
                    for (const p of ps) {
                        p.vx += (r() - 0.5) * 2400;
                        p.vy += (r() - 0.5) * 2400;
                    }
                }
            },
            destroy: () => {
                cancelAnimationFrame(raf);
                window.removeEventListener("resize", onResize);
                c.remove();
            },
        };
    },
};
