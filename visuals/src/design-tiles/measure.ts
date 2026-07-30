// The measurement module the drop imports but does not ship. It answers one question per
// word: where does each glyph sit, and how tall is its ink? The engine draws one background
// rect per glyph from these numbers, so the tiles hug the letterforms rather than a font's
// generous em box.
//
// Everything is reported in a REFERENCE space (font-size REF_FS, baseline BASELINE_Y) which
// the engine hands straight to an SVG viewBox, so the result scales without re-measuring.

export const REF_FS = 100;
export const BASELINE_Y = 100;

export interface GlyphMetric {
    ch: string;
    x: number;      // pen position where this glyph starts
    w: number;      // advance width
    top: number;    // ink top, in the same space as BASELINE_Y
    bottom: number; // ink bottom
}

export interface WordMetrics {
    width: number;
    glyphs: GlyphMetric[];
}

let ctx: CanvasRenderingContext2D | null = null;
function context(): CanvasRenderingContext2D {
    if (!ctx) ctx = document.createElement("canvas").getContext("2d")!;
    return ctx;
}

// ⚠️ Canvas silently IGNORES a font string it cannot parse, leaving the context on its
//    10px default -- so a long resolved family list (quoted names, -apple-system, several
//    generics) measures every glyph at a sixth of its real width and the tiles collapse to
//    slivers. Assign, then verify the size actually took, and simplify until it does.
function setFont(c: CanvasRenderingContext2D, fontFamily: string, weight: string): void {
    const candidates = [
        `${weight} ${REF_FS}px ${fontFamily}`,
        // just the first family, quoted if it needs it
        `${weight} ${REF_FS}px ${(fontFamily.split(",")[0] || "").trim()}, sans-serif`,
        `${weight} ${REF_FS}px sans-serif`,
    ];
    for (const font of candidates) {
        c.font = font;
        if (c.font.includes(`${REF_FS}px`)) return;
    }
}

export function measureWord(word: string, fontFamily: string, weight = "500"): WordMetrics | null {
    const c = context();
    if (!c || !word) return null;
    setFont(c, fontFamily, weight);

    const glyphs: GlyphMetric[] = [];
    let pen = 0;
    for (const ch of word) {
        const m = c.measureText(ch);
        // ⚠️ actualBoundingBox is measured from the ALPHABETIC BASELINE and grows upward,
        //    so ascent must be subtracted from the baseline to land in view space. A space
        //    has no ink at all and reports zeros; give it the band so the run stays even.
        const asc = m.actualBoundingBoxAscent || REF_FS * 0.72;
        const desc = m.actualBoundingBoxDescent || 0;
        glyphs.push({
            ch,
            x: pen,
            w: m.width,
            top: BASELINE_Y - asc,
            bottom: BASELINE_Y + desc,
        });
        pen += m.width;
    }
    return { width: pen, glyphs };
}
