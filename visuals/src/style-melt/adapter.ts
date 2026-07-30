// Scene: style-melt — a portrait cycling through art styles, melting back to the untouched
// photograph along a trail of merged blocks that follows the cursor.
// props: source (url), styles[] (urls), grid, radius, decay, bg, label.
//
// The drop needs a photo plus AI-restyled versions of it. Restyling is a filter chain here:
// the same source rendered through posterise, halftone, blueprint and thermal passes, which
// is enough to make the melt mechanic legible without an image pipeline or a model.
//
// The mechanic is the interesting part. A heat grid decays every frame and is topped up under
// the pointer, and each cell's heat decides how far it has melted from the styled version back
// to the real one. Blocks with neighbours above the threshold render as one merged shape, so
// the trail reads as a hole opening rather than a row of squares.

import { canvas, portrait, rng, setFont, MONO } from "../shared/source";

type Filter = { name: string; apply: (c: HTMLCanvasElement) => HTMLCanvasElement };

const posterise = (levels: number): Filter["apply"] => (src) => {
    const [c, ctx] = canvas(src.width, src.height);
    ctx.drawImage(src, 0, 0);
    const d = ctx.getImageData(0, 0, c.width, c.height);
    const step = 255 / (levels - 1);
    for (let i = 0; i < d.data.length; i += 4) {
        for (let k = 0; k < 3; k++) d.data[i + k] = Math.round(d.data[i + k] / step) * step;
    }
    ctx.putImageData(d, 0, 0);
    return c;
};

const duotone = (loHue: number, hiHue: number): Filter["apply"] => (src) => {
    const [c, ctx] = canvas(src.width, src.height);
    ctx.drawImage(src, 0, 0);
    const d = ctx.getImageData(0, 0, c.width, c.height);
    for (let i = 0; i < d.data.length; i += 4) {
        const l = (0.2126 * d.data[i] + 0.7152 * d.data[i + 1] + 0.0722 * d.data[i + 2]) / 255;
        const h = loHue + (hiHue - loHue) * l;
        // hsl to rgb, inline: a canvas fillStyle per pixel would be thousands of parses
        const s = 0.72, li = 0.16 + l * 0.62;
        const q = li < 0.5 ? li * (1 + s) : li + s - li * s;
        const p = 2 * li - q;
        const hk = ((h % 360) + 360) % 360 / 360;
        const ch = (tc: number) => {
            let x = tc; if (x < 0) x += 1; if (x > 1) x -= 1;
            if (x < 1 / 6) return p + (q - p) * 6 * x;
            if (x < 1 / 2) return q;
            if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
            return p;
        };
        d.data[i] = ch(hk + 1 / 3) * 255;
        d.data[i + 1] = ch(hk) * 255;
        d.data[i + 2] = ch(hk - 1 / 3) * 255;
    }
    ctx.putImageData(d, 0, 0);
    return c;
};

const halftone = (dot: number): Filter["apply"] => (src) => {
    const [c, ctx] = canvas(src.width, src.height);
    const [s, sc] = canvas(Math.ceil(src.width / dot), Math.ceil(src.height / dot));
    sc.drawImage(src, 0, 0, s.width, s.height);
    const d = sc.getImageData(0, 0, s.width, s.height).data;
    ctx.fillStyle = "#0d0f14";
    ctx.fillRect(0, 0, c.width, c.height);
    for (let y = 0; y < s.height; y++) {
        for (let x = 0; x < s.width; x++) {
            const i = (y * s.width + x) * 4;
            const l = (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255;
            ctx.fillStyle = `rgb(${d[i]},${d[i + 1]},${d[i + 2]})`;
            ctx.beginPath();
            ctx.arc(x * dot + dot / 2, y * dot + dot / 2, (dot / 2) * Math.sqrt(l) * 1.25, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    return c;
};

const blueprint: Filter["apply"] = (src) => {
    const [c, ctx] = canvas(src.width, src.height);
    ctx.drawImage(src, 0, 0);
    const d = ctx.getImageData(0, 0, c.width, c.height);
    const out = ctx.createImageData(c.width, c.height);
    const lum = (i: number) => 0.2126 * d.data[i] + 0.7152 * d.data[i + 1] + 0.0722 * d.data[i + 2];
    for (let y = 1; y < c.height - 1; y++) {
        for (let x = 1; x < c.width - 1; x++) {
            const i = (y * c.width + x) * 4;
            // Sobel, which is what turns a photo into a drawing
            const gx = lum(i - 4 - c.width * 4) + 2 * lum(i - 4) + lum(i - 4 + c.width * 4)
                - lum(i + 4 - c.width * 4) - 2 * lum(i + 4) - lum(i + 4 + c.width * 4);
            const gy = lum(i - c.width * 4 - 4) + 2 * lum(i - c.width * 4) + lum(i - c.width * 4 + 4)
                - lum(i + c.width * 4 - 4) - 2 * lum(i + c.width * 4) - lum(i + c.width * 4 + 4);
            const e = Math.min(255, Math.hypot(gx, gy));
            out.data[i] = 30 + e * 0.5;
            out.data[i + 1] = 70 + e * 0.7;
            out.data[i + 2] = 150 + e * 0.4;
            out.data[i + 3] = 255;
        }
    }
    ctx.putImageData(out, 0, 0);
    return c;
};

export default {
    async mount(host: HTMLElement, props: Record<string, unknown>) {
        const grid = typeof props.grid === "number" ? Math.max(8, props.grid) : 26;
        const radius = typeof props.radius === "number" ? props.radius : 2.4;   // in cells
        const decay = typeof props.decay === "number" ? props.decay : 0.55;     // heat lost per second
        const bg = typeof props.bg === "string" ? props.bg : "#08090e";

        // the real photograph, then the restyled versions of it
        let real: HTMLCanvasElement = portrait(9, 720, 900);
        if (typeof props.source === "string") {
            const im = await new Promise<HTMLImageElement | null>((res) => {
                const i = new Image();
                i.crossOrigin = "anonymous";
                i.onload = () => res(i); i.onerror = () => res(null);
                i.src = props.source as string;
            });
            if (im) {
                const [cc, cx2] = canvas(im.naturalWidth, im.naturalHeight);
                cx2.drawImage(im, 0, 0);
                real = cc;
            }
        }

        const styles: Array<{ name: string; img: HTMLCanvasElement }> = [
            { name: "posterised", img: posterise(4)(real) },
            { name: "halftone", img: halftone(9)(real) },
            { name: "blueprint", img: blueprint(real) },
            { name: "thermal", img: duotone(250, 55)(real) },
        ];

        const [c, ctx] = canvas(1, 1);
        Object.assign(c.style, { position: "absolute", inset: "0", width: "100%", height: "100%" });
        host.appendChild(c);

        let W = 0, H = 0, dpr = 1, cw = 0, chh = 0, cols = 0, rows = 0;
        let heat: Float32Array = new Float32Array(0);

        const fit = () => {
            const b = host.getBoundingClientRect();
            dpr = Math.min(2, window.devicePixelRatio || 1);
            W = Math.max(1, b.width); H = Math.max(1, b.height);
            c.width = Math.round(W * dpr); c.height = Math.round(H * dpr);
            cols = grid;
            cw = W / cols;
            chh = cw;
            rows = Math.max(1, Math.ceil(H / chh));
            heat = new Float32Array(cols * rows);
        };
        fit();

        // pointer position in cell space; wanders on its own so a capture has something to show
        const r = rng(31);
        let px = 0.5, py = 0.5, manual = false;
        const onMove = (e: PointerEvent) => {
            const b = c.getBoundingClientRect();
            px = (e.clientX - b.left) / b.width;
            py = (e.clientY - b.top) / b.height;
            manual = true;
        };
        c.addEventListener("pointermove", onMove);

        // cover-fit the source into the frame once, so every style lines up pixel for pixel
        const box = () => {
            const k = Math.max(W / real.width, H / real.height);
            const w = real.width * k, h = real.height * k;
            return { x: (W - w) / 2, y: (H - h) / 2, w, h };
        };

        let raf = 0;
        const t0 = performance.now();
        let last = t0;

        const draw = (now: number) => {
            // ⚠️ clamped, not raw. A rAF timestamp is the start of the frame, which can be a
            // few milliseconds EARLIER than the performance.now() taken during mount, so the
            // first t is negative -- and JS keeps the sign through %, so an index like
            // floor(t/per) % n comes back as -1 and reads off the end of the array.
            const t = Math.max(0, (now - t0) / 1000);
            const dt = Math.min(0.05, (now - last) / 1000);
            last = now;

            if (!manual) {
                // a lissajous wander, so the trail crosses itself and the melt overlaps
                px = 0.5 + Math.sin(t * 0.75) * 0.3 + Math.sin(t * 1.9) * 0.08;
                py = 0.5 + Math.cos(t * 0.55) * 0.28 + Math.cos(t * 2.3) * 0.06;
            }

            // decay everything, then top up under the pointer
            const keep = Math.pow(decay, dt);
            for (let i = 0; i < heat.length; i++) heat[i] *= keep;
            const gx = px * cols, gy = py * rows;
            const rad = Math.ceil(radius) + 1;
            for (let y = Math.floor(gy - rad); y <= gy + rad; y++) {
                for (let x = Math.floor(gx - rad); x <= gx + rad; x++) {
                    if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
                    const d = Math.hypot(x + 0.5 - gx, y + 0.5 - gy) / radius;
                    if (d > 1) continue;
                    const add = (1 - d * d);
                    const i = y * cols + x;
                    if (add > heat[i]) heat[i] = add;
                }
            }

            const b = box();
            // which style is on top right now, crossfading into the next
            const per = 3.2;
            const si = Math.floor(t / per) % styles.length;
            const mix = Math.min(1, Math.max(0, (t % per) - per + 0.9));
            const cur = styles[si].img;
            const nxt = styles[(si + 1) % styles.length].img;

            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.fillStyle = bg;
            ctx.fillRect(0, 0, W, H);

            // base layer: the styled portrait, cross-dissolving between styles
            ctx.drawImage(cur, b.x, b.y, b.w, b.h);
            if (mix > 0) {
                ctx.globalAlpha = mix;
                ctx.drawImage(nxt, b.x, b.y, b.w, b.h);
                ctx.globalAlpha = 1;
            }

            // the melt: the untouched photograph, clipped to the hot cells. Cells are drawn as
            // rounded rects whose radius falls as heat rises, so adjacent hot cells lose their
            // corners and merge into one shape instead of staying a row of tiles.
            ctx.save();
            ctx.beginPath();
            for (let y = 0; y < rows; y++) {
                for (let x = 0; x < cols; x++) {
                    const hv = heat[y * cols + x];
                    if (hv < 0.04) continue;
                    const e = Math.min(1, hv * 1.35);
                    const pad = (1 - e) * cw * 0.5;
                    const rr = Math.max(0, (1 - e) * cw * 0.5 + 2);
                    ctx.roundRect(x * cw + pad, y * chh + pad, cw - pad * 2, chh - pad * 2, rr);
                }
            }
            ctx.clip();
            ctx.drawImage(real, b.x, b.y, b.w, b.h);
            ctx.restore();

            // the style's name, so the cycle is legible
            setFont(ctx, Math.max(11, W * 0.011), MONO, 600);
            ctx.textAlign = "left";
            ctx.fillStyle = "rgba(255,255,255,.72)";
            ctx.fillText(styles[mix > 0.5 ? (si + 1) % styles.length : si].name.toUpperCase(),
                W * 0.04, H * 0.94);

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
