// Procedural source imagery.
//
// Half the drops in the collection are effects that need pictures to work on: a pixelation
// swap, a glyph halftone, an orbiting image cloud. Shipping stock photography would make the
// bundles enormous and the licensing someone else's problem, and leaving them unbuilt means
// the page only ever shows a prompt. So the effects generate their own subjects.
//
// Two makers, both deterministic from a seed so a re-render is identical:
//   plate()    a coloured card with some form to it, for grids and clouds
//   portrait() a synthetic bust on a backdrop, for anything that wants a subject
//
// Every effect here takes a `sources` prop. Give it real URLs and these never run.

export type Ctx = CanvasRenderingContext2D;

// A small deterministic PRNG. Math.random would make two renders of the same shot differ,
// which matters when a video gets re-cut.
//
// ⚠️ Raw xorshift returns near-zero for its first few outputs when seeded with a small integer,
// which is exactly how these scenes seed it. That is not a subtle statistical wrinkle: it meant
// the first letter of a ransom note always took the same branch. So mix the seed through
// splitmix32 first and then discard the warmup.
export function rng(seed: number) {
    let s = (seed >>> 0) || 0x9e3779b9;
    s = Math.imul(s ^ (s >>> 16), 0x21f0aaad) >>> 0;
    s = Math.imul(s ^ (s >>> 15), 0x735a2d97) >>> 0;
    s = (s ^ (s >>> 15)) >>> 0 || 0x6d2b79f5;
    const next = () => {
        s ^= s << 13; s >>>= 0;
        s ^= s >>> 17;
        s ^= s << 5; s >>>= 0;
        return s / 4294967296;
    };
    for (let i = 0; i < 8; i++) next();
    return next;
}

export function canvas(w: number, h: number): [HTMLCanvasElement, Ctx] {
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    return [c, c.getContext("2d")!];
}

/** A coloured card with a highlight and a couple of shapes, so it reads as an image and not paper. */
export function plate(seed: number, w = 320, h = 400): HTMLCanvasElement {
    const [c, ctx] = canvas(w, h);
    const r = rng(seed + 7);
    const hue = (seed * 47) % 360;
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, `hsl(${hue} 72% 62%)`);
    g.addColorStop(1, `hsl(${(hue + 48) % 360} 66% 36%)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    ctx.globalAlpha = 0.5;
    for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        const cx = r() * w, cy = r() * h, rad = (0.12 + r() * 0.22) * w;
        ctx.fillStyle = `hsl(${(hue + 120 + i * 60) % 360} 80% ${55 + i * 8}%)`;
        if (r() < 0.5) ctx.arc(cx, cy, rad, 0, Math.PI * 2);
        else ctx.rect(cx - rad, cy - rad * 0.7, rad * 2, rad * 1.4);
        ctx.fill();
    }
    ctx.globalAlpha = 1;

    const hi = ctx.createRadialGradient(w * 0.34, h * 0.22, 8, w * 0.5, h * 0.5, h * 0.7);
    hi.addColorStop(0, "rgba(255,255,255,0.36)");
    hi.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = hi;
    ctx.fillRect(0, 0, w, h);
    return c;
}

/**
 * A synthetic bust: backdrop, shoulders, head, hair mass, two eyes, a mouth. Not a person and
 * not trying to be, but it has the light-and-shade structure that portrait effects key on
 * (a bright face against a darker surround), which a gradient plate does not.
 */
export function portrait(seed = 1, w = 640, h = 800): HTMLCanvasElement {
    const [c, ctx] = canvas(w, h);
    const r = rng(seed);
    const hue = 200 + r() * 120;

    const bg = ctx.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, `hsl(${hue} 34% 22%)`);
    bg.addColorStop(1, `hsl(${(hue + 40) % 360} 40% 12%)`);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // a rim of light behind the head, which is what gives the silhouette its edge
    const rim = ctx.createRadialGradient(w * 0.5, h * 0.36, 20, w * 0.5, h * 0.42, w * 0.62);
    rim.addColorStop(0, `hsla(${(hue + 180) % 360}, 80%, 70%, 0.5)`);
    rim.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = rim;
    ctx.fillRect(0, 0, w, h);

    const skin = `hsl(${26 + r() * 14} 44% ${58 + r() * 12}%)`;
    const shade = `hsl(${22 + r() * 10} 40% 38%)`;
    const cx = w * 0.5, cy = h * 0.42, rw = w * 0.21, rh = h * 0.19;

    // shoulders
    ctx.fillStyle = `hsl(${hue} 30% 30%)`;
    ctx.beginPath();
    ctx.ellipse(cx, h * 1.06, w * 0.44, h * 0.30, 0, 0, Math.PI * 2);
    ctx.fill();

    // neck
    ctx.fillStyle = shade;
    ctx.fillRect(cx - rw * 0.34, cy + rh * 0.5, rw * 0.68, rh * 0.9);

    // head
    const face = ctx.createLinearGradient(cx - rw, cy - rh, cx + rw, cy + rh);
    face.addColorStop(0, skin);
    face.addColorStop(1, shade);
    ctx.fillStyle = face;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rw, rh, 0, 0, Math.PI * 2);
    ctx.fill();

    // hair as a cap, offset a little so the light side stays clean
    ctx.fillStyle = `hsl(${20 + r() * 200} 24% ${12 + r() * 14}%)`;
    ctx.beginPath();
    ctx.ellipse(cx + rw * 0.04, cy - rh * 0.36, rw * 1.04, rh * 0.78, 0, Math.PI, Math.PI * 2);
    ctx.fill();

    // eyes and mouth: small, dark, enough to read as a face at thumbnail size
    ctx.fillStyle = "rgba(18,18,24,0.85)";
    for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(cx + s * rw * 0.38, cy - rh * 0.06, rw * 0.11, rh * 0.07, 0, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.strokeStyle = "rgba(80,30,30,0.6)";
    ctx.lineWidth = Math.max(2, w * 0.008);
    ctx.beginPath();
    ctx.moveTo(cx - rw * 0.24, cy + rh * 0.5);
    ctx.quadraticCurveTo(cx, cy + rh * 0.62, cx + rw * 0.24, cy + rh * 0.5);
    ctx.stroke();

    // vignette, so a halftone sampler sees a real falloff at the edges
    const vg = ctx.createRadialGradient(w / 2, h / 2, h * 0.28, w / 2, h / 2, h * 0.78);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(0,0,0,0.55)");
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, w, h);
    return c;
}

/** Load caller-supplied urls, or fall back to `count` generated ones. */
export async function sourceImages(
    urls: unknown,
    count: number,
    make: (i: number) => HTMLCanvasElement,
): Promise<CanvasImageSource[]> {
    const list = Array.isArray(urls) ? urls.filter((u): u is string => typeof u === "string") : [];
    if (!list.length) return Array.from({ length: count }, (_, i) => make(i));
    const loaded = await Promise.all(list.map((src) => new Promise<HTMLImageElement | null>((res) => {
        const im = new Image();
        im.crossOrigin = "anonymous";
        im.onload = () => res(im);
        im.onerror = () => res(null);   // ⚠️ a dead url must not stall the whole scene
        im.src = src;
    })));
    const ok = loaded.filter((x): x is HTMLImageElement => !!x);
    return ok.length ? ok : Array.from({ length: count }, (_, i) => make(i));
}

/**
 * The font stack the harness maps its CSS vars to, for canvas work that cannot read a var().
 *
 * ⚠️ Single-quoted family names, deliberately. These get interpolated into `style="…"` in
 * innerHTML as often as into a canvas font string, and a double quote there closes the
 * attribute early: the rule is silently dropped and the text renders at the browser default.
 * CSS accepts either quote, so single is the one that survives both contexts.
 */
export const SANS = "'Helvetica Neue', Helvetica, Arial, sans-serif";
export const MONO = "'SF Mono', ui-monospace, Menlo, Consolas, monospace";

/** Canvas silently ignores a font string it cannot parse, so always check the assignment took. */
export function setFont(ctx: Ctx, px: number, family: string, weight: string | number = 400) {
    for (const f of [`${weight} ${px}px ${family}`, `${weight} ${px}px sans-serif`, `${px}px sans-serif`]) {
        ctx.font = f;
        if (ctx.font.includes(`${px}px`)) return;
    }
}
