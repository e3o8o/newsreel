// Glyph atlas: we rasterize every character we might draw ONCE into a hidden 2D
// canvas, then hand that canvas to the GPU as a single texture. After that,
// drawing N letters is N UV lookups into one image instead of N canvas writes —
// which is the whole reason the field can be thousands of cells and still hold
// 60fps.
//
// Two weights are baked (regular + bold) so the resolving word can fade in a
// bolder stroke over the background swirl without a second atlas.

export const WEIGHT_REGULAR = 0;
export const WEIGHT_BOLD = 1;
export const WEIGHT_COUNT = 2;

export interface GlyphAtlas {
  /** Rasterization pixel size (also the cell font-size). */
  inkSize: number;
  /** Advance width of one monospace cell. */
  advance: number;
  cellW: number;
  cellH: number;
  baseline: number;
  pad: number;
  /** [u0,v0,u1,v1] per (weight*glyphCount + glyphIndex). */
  uvs: number[][];
  canvas: HTMLCanvasElement;
}

/**
 * Build the atlas for a given ink size over the supplied glyph list, uploading
 * it into `tex`. The caller owns the GL context and the glyph ordering.
 */
export function buildAtlas(
  gl: WebGL2RenderingContext,
  tex: WebGLTexture,
  scratch: HTMLCanvasElement,
  glyphs: string[],
  inkSize: number,
): GlyphAtlas {
  const { max, ceil, sqrt, floor } = Math;
  const ctx = scratch.getContext("2d")!;
  const baseFont = `${inkSize}px monospace`;
  ctx.font = baseFont;
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  const advance = ctx.measureText("M").width;

  // measure the tallest ascent/descent across both weights so every cell fits
  let asc = 0;
  let desc = 0;
  for (let w = 0; w < WEIGHT_COUNT; w++) {
    ctx.font = w === WEIGHT_BOLD ? `bold ${baseFont}` : baseFont;
    for (const g of glyphs) {
      const m = ctx.measureText(g);
      asc = max(asc, m.actualBoundingBoxAscent || inkSize * 0.8);
      desc = max(desc, m.actualBoundingBoxDescent || inkSize * 0.25);
    }
  }

  const pad = max(2, ceil(inkSize * 0.18));
  const cellW = max(1, ceil(advance + pad * 2));
  const cellH = max(1, ceil(asc + desc + pad * 2));
  const baseline = pad + ceil(asc);

  const count = glyphs.length * WEIGHT_COUNT;
  const cols = ceil(sqrt(count));
  const rows = ceil(count / cols);
  scratch.width = cols * cellW;
  scratch.height = rows * cellH;
  ctx.clearRect(0, 0, scratch.width, scratch.height);
  ctx.fillStyle = "#ffffff";
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";

  const uvs: number[][] = new Array(count);
  for (let w = 0; w < WEIGHT_COUNT; w++) {
    ctx.font = w === WEIGHT_BOLD ? `bold ${baseFont}` : baseFont;
    for (let i = 0; i < glyphs.length; i++) {
      const idx = w * glyphs.length + i;
      const cx = (idx % cols) * cellW;
      const cy = floor(idx / cols) * cellH;
      ctx.fillText(glyphs[i], cx + pad, cy + baseline);
      uvs[idx] = [
        cx / scratch.width,
        cy / scratch.height,
        (cx + cellW) / scratch.width,
        (cy + cellH) / scratch.height,
      ];
    }
  }

  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, scratch);

  return { inkSize, advance, cellW, cellH, baseline, pad, uvs, canvas: scratch };
}

