// Scene: ransom — every letter torn from a different magazine and taped down crooked.
// props: text, seed, bg, tape, settle.
//
// The drop wants a sprite pack of photographed cut-out letters. Drawn ones are better here:
// the pack fixes you to whatever glyphs someone shot, whereas drawing means any word in any
// language works, and the seed makes a re-render identical rather than merely similar.
//
// What sells it is not the fonts, it is the paper. Each letter gets its own torn quad with a
// jagged edge, its own paper tint and grain, a drop shadow to lift it off the page, and a
// rotation that never repeats. Uniform tilt reads as a filter; uneven tilt reads as hands.

import { canvas, rng, setFont, SANS } from "../shared/source";

// deliberately mismatched: a serif next to a heavy grotesque next to a typewriter is what
// makes a line look assembled from different magazines
const FACES = [
    { family: `Georgia, 'Times New Roman', serif`, weight: 700 },
    { family: `Impact, 'Haettenschweiler', ${SANS}`, weight: 400 },
    { family: `'Courier New', Courier, monospace`, weight: 700 },
    { family: `${SANS}`, weight: 800 },
    { family: `'Palatino Linotype', Palatino, Georgia, serif`, weight: 400 },
    { family: `'Arial Black', Gadget, ${SANS}`, weight: 900 },
];

// warm newsprint and cheap magazine stock, all light: the scraps have to read as paper against
// a dark table, and a mostly-dark set just looks like a set of dark rectangles
const PAPERS = [
    ["#f7f2e4", "#1a1714"], ["#efe7d2", "#241f18"], ["#fdfbf4", "#15120f"],
    ["#f3dcb4", "#2b1f10"], ["#e2ebef", "#101619"], ["#fae3e6", "#2a1219"],
    ["#fff1c9", "#1e1808"], ["#e9f0dd", "#141a0e"],
];
// a couple of inverted scraps, white out of black, for contrast in the line
const INVERTED = [["#191816", "#f8f5ec"], ["#221b1d", "#f4ebe6"]];

export default {
    async mount(host: HTMLElement, props: Record<string, unknown>) {
        const text = (typeof props.text === "string" ? props.text : "RANSOM").slice(0, 24);
        const seed = typeof props.seed === "number" ? props.seed : 11;
        const showTape = props.tape !== false;
        const settle = props.settle !== false;

        const [c, ctx] = canvas(1, 1);
        Object.assign(c.style, { position: "absolute", inset: "0", width: "100%", height: "100%" });
        host.appendChild(c);

        let W = 0, H = 0, dpr = 1;
        const fit = () => {
            const b = host.getBoundingClientRect();
            dpr = Math.min(2, window.devicePixelRatio || 1);
            W = Math.max(1, b.width); H = Math.max(1, b.height);
            c.width = Math.round(W * dpr); c.height = Math.round(H * dpr);
        };
        fit();

        interface Glyph {
            ch: string; face: typeof FACES[number]; paper: string; ink: string;
            rot: number; dy: number; pad: number; grain: number[]; edge: number[];
            w: number; h: number; scale: number; tape: number; drop: number;
        }

        const r = rng(seed);
        const glyphs: Glyph[] = [];
        for (const ch of text) {
            if (ch === " ") { glyphs.push(null as unknown as Glyph); continue; }
            const inverted = r() < 0.18;
            const [paper, ink] = inverted
                ? INVERTED[Math.floor(r() * INVERTED.length)]
                : PAPERS[Math.floor(r() * PAPERS.length)];
            glyphs.push({
                ch,
                face: FACES[Math.floor(r() * FACES.length)],
                paper, ink,
                rot: (r() - 0.5) * 0.5,           // radians, so about ±14 degrees
                dy: (r() - 0.5) * 40,
                pad: 14 + r() * 16,
                scale: 0.82 + r() * 0.42,
                // per-edge nibbles. Four offsets round the corners left the scraps looking
                // guillotined; a tear needs many small irregular bites along each side
                edge: Array.from({ length: 40 }, () => r()),
                grain: Array.from({ length: 26 }, () => r()),
                tape: r() < 0.55 ? (r() - 0.5) * 0.6 : NaN,   // NaN means no tape on this one
                drop: 0.6 + r() * 0.5,
                w: 0, h: 0,
            });
        }

        const BASE = 108;
        const measure = () => {
            for (const g of glyphs) {
                if (!g) continue;
                const px = BASE * g.scale;
                setFont(ctx, px, g.face.family, g.face.weight);
                g.w = ctx.measureText(g.ch).width + g.pad * 2;
                g.h = px * 1.06 + g.pad * 2;
            }
        };

        // The torn outline: walk the rectangle's perimeter taking ten irregular bites out of
        // each side. Amplitude varies per bite, so the edge has both fine fibre and the odd
        // deep notch, which is what a hand-torn edge actually looks like.
        const outline = (g: Glyph) => {
            const { w, h, edge } = g;
            const N = 10, amp = 11;
            const pts: Array<[number, number]> = [];
            let k = 0;
            const bite = () => (edge[k++ % edge.length] - 0.5) * amp * (0.4 + edge[k % edge.length]);
            for (let i = 0; i < N; i++) pts.push([(i / N) * w, bite()]);
            for (let i = 0; i < N; i++) pts.push([w + bite(), (i / N) * h]);
            for (let i = 0; i < N; i++) pts.push([w - (i / N) * w, h + bite()]);
            for (let i = 0; i < N; i++) pts.push([bite(), h - (i / N) * h]);
            return pts;
        };

        // one torn scrap: paper, grain, the letter, then a rough edge cut back out
        const scrap = (g: Glyph, t: number) => {
            const { w, h } = g;
            const pts = outline(g);
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(pts[0][0], pts[0][1]);
            for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
            ctx.closePath();

            ctx.shadowColor = `rgba(0,0,0,${0.34 * g.drop})`;
            ctx.shadowBlur = 12; ctx.shadowOffsetY = 4;
            ctx.fillStyle = g.paper;
            ctx.fill();
            ctx.shadowColor = "transparent";

            ctx.clip();
            // grain: faint specks so the paper is not a flat swatch
            ctx.fillStyle = "rgba(0,0,0,.06)";
            for (let i = 0; i < g.grain.length; i += 2) {
                ctx.fillRect(g.grain[i] * w, g.grain[i + 1] * h, 2, 2);
            }
            // a soft gradient across the scrap, as if the page curved under the light
            const lg = ctx.createLinearGradient(0, 0, w, h);
            lg.addColorStop(0, "rgba(255,255,255,.14)");
            lg.addColorStop(1, "rgba(0,0,0,.09)");
            ctx.fillStyle = lg;
            ctx.fillRect(0, 0, w, h);
            // the white fibre a tear exposes, just inside the edge
            ctx.strokeStyle = "rgba(255,255,255,.5)";
            ctx.lineWidth = 2;
            ctx.stroke();

            const px = BASE * g.scale;
            setFont(ctx, px, g.face.family, g.face.weight);
            ctx.fillStyle = g.ink;
            ctx.textBaseline = "middle";
            ctx.textAlign = "center";
            ctx.fillText(g.ch, w / 2, h / 2 + px * 0.03);
            ctx.restore();

            if (showTape && !Number.isNaN(g.tape)) {
                ctx.save();
                ctx.translate(w / 2, 0);
                ctx.rotate(g.tape);
                ctx.fillStyle = "rgba(236,224,190,.62)";
                ctx.fillRect(-w * 0.28, -12 * t, w * 0.56, 24 * t);
                ctx.strokeStyle = "rgba(255,255,255,.4)";
                ctx.lineWidth = 1;
                ctx.strokeRect(-w * 0.28, -12 * t, w * 0.56, 24 * t);
                ctx.restore();
            }
        };

        let raf = 0;
        const t0 = performance.now();
        const draw = (now: number) => {
            const el = (now - t0) / 1000;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.clearRect(0, 0, W, H);
            ctx.fillStyle = typeof props.bg === "string" ? props.bg : "#12100e";
            ctx.fillRect(0, 0, W, H);

            measure();
            const total = glyphs.reduce((s, g) => s + (g ? g.w * 0.94 : BASE * 0.34), 0);
            const fitScale = Math.min(1, (W * 0.86) / total);
            let x = (W - total * fitScale) / 2;
            const midY = H / 2;

            glyphs.forEach((g, i) => {
                if (!g) { x += BASE * 0.34 * fitScale; return; }
                // each scrap drops in on its own beat, then holds
                const start = i * 0.075;
                const p = settle ? Math.min(1, Math.max(0, (el - start) / 0.55)) : 1;
                if (p <= 0) { x += g.w * 0.94 * fitScale; return; }
                const e = 1 - Math.pow(1 - p, 3);

                ctx.save();
                ctx.translate(x + (g.w * fitScale) / 2, midY + g.dy * fitScale - (1 - e) * 90);
                ctx.rotate(g.rot * (0.4 + e * 0.6));
                ctx.scale(fitScale, fitScale);
                ctx.globalAlpha = e;
                ctx.translate(-g.w / 2, -g.h / 2);
                scrap(g, e);
                ctx.restore();

                x += g.w * 0.94 * fitScale;
            });

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
