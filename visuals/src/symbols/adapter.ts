// Scene: symbols — a picture rebuilt out of glyph stamps, each cell picking a character from a
// brightness band so the image survives as tone while the detail becomes type.
// props: glyphs, cell, bands, hue, mono, source (url), bg, drift.
//
// The drop does this as a GPU halftone in three.js. The operation is: downsample the source to
// a grid, read each cell's luminance, pick a glyph from the band it falls in, draw it. That is
// a getImageData and a nested loop, which 2D canvas does at full frame rate here, so the
// dependency buys nothing.
//
// Four bands, not a continuous ramp: the banding is the look. A smooth mapping just reads as a
// blurry photo, whereas hard steps make the eye see the glyphs first and the picture second.

import { canvas, portrait, setFont, MONO } from "../shared/source";

// dark to light, four bands. Heavy shapes hold the shadows, sparse ones let the highlights go.
const BANDS = ["██▓▒", "◆◇◈●", "+×÷=", "·˙‥:"];

export default {
    async mount(host: HTMLElement, props: Record<string, unknown>) {
        const cell = typeof props.cell === "number" ? Math.max(6, props.cell) : 15;
        const hue = typeof props.hue === "number" ? props.hue : 32;
        const monochrome = props.mono === true;
        const bg = typeof props.bg === "string" ? props.bg : "#08090e";
        const drift = props.drift !== false;
        const bands: string[] = Array.isArray(props.bands) && props.bands.length === 4
            ? (props.bands as string[]) : BANDS;

        // the subject: a supplied image if there is one, otherwise a generated bust, which has
        // the bright-face-against-dark-surround structure a halftone needs to read as a picture
        let src: CanvasImageSource = portrait(4);
        let sw = 640, sh = 800;
        if (typeof props.source === "string") {
            const im = await new Promise<HTMLImageElement | null>((res) => {
                const i = new Image();
                i.crossOrigin = "anonymous";
                i.onload = () => res(i);
                i.onerror = () => res(null);
                i.src = props.source as string;
            });
            if (im) { src = im; sw = im.naturalWidth; sh = im.naturalHeight; }
        }

        const [c, ctx] = canvas(1, 1);
        Object.assign(c.style, { position: "absolute", inset: "0", width: "100%", height: "100%" });
        host.appendChild(c);

        let W = 0, H = 0, dpr = 1, cols = 0, rows = 0;
        let lum: Float32Array = new Float32Array(0);

        const build = () => {
            const b = host.getBoundingClientRect();
            dpr = Math.min(2, window.devicePixelRatio || 1);
            W = Math.max(1, b.width); H = Math.max(1, b.height);
            c.width = Math.round(W * dpr); c.height = Math.round(H * dpr);

            cols = Math.max(1, Math.floor(W / cell));
            rows = Math.max(1, Math.floor(H / cell));

            // draw the source into a cols×rows buffer: the browser's own downscale is the
            // box filter, so each pixel already is the average of the cell it stands for
            const [small, s] = canvas(cols, rows);
            const scale = Math.max(cols / sw, rows / sh);
            const dw = sw * scale, dh = sh * scale;
            s.fillStyle = "#000";
            s.fillRect(0, 0, cols, rows);
            s.drawImage(src, (cols - dw) / 2, (rows - dh) / 2, dw, dh);
            const d = s.getImageData(0, 0, cols, rows).data;

            lum = new Float32Array(cols * rows);
            for (let i = 0; i < cols * rows; i++) {
                lum[i] = (0.2126 * d[i * 4] + 0.7152 * d[i * 4 + 1] + 0.0722 * d[i * 4 + 2]) / 255;
            }
        };
        build();

        let raf = 0;
        const t0 = performance.now();

        const draw = (now: number) => {
            const t = (now - t0) / 1000;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.fillStyle = bg;
            ctx.fillRect(0, 0, W, H);
            setFont(ctx, cell * 1.02, MONO, 600);
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";

            const ox = (W - cols * cell) / 2, oy = (H - rows * cell) / 2;
            for (let y = 0; y < rows; y++) {
                for (let x = 0; x < cols; x++) {
                    const l = lum[y * cols + x];
                    if (l < 0.06) continue;
                    // four hard bands, brightest first in the array order we want
                    const band = l > 0.72 ? 0 : l > 0.46 ? 1 : l > 0.24 ? 2 : 3;
                    const set = bands[band];
                    // which glyph within the band drifts over time, so the picture crawls
                    const k = drift
                        ? Math.floor(Math.abs(Math.sin(x * 0.7 + y * 0.4 + t * 1.6)) * set.length)
                        : (x + y) % set.length;
                    ctx.fillStyle = monochrome
                        ? `hsl(0 0% ${28 + l * 68}%)`
                        : `hsl(${hue + l * 26} 82% ${24 + l * 58}%)`;
                    ctx.fillText(set[Math.min(set.length - 1, k)],
                        ox + x * cell + cell / 2, oy + y * cell + cell / 2);
                }
            }
            raf = requestAnimationFrame(draw);
        };

        const onResize = () => build();
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
