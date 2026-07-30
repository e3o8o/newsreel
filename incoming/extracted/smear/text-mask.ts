// Rasterizes the word into a white-on-transparent coverage mask. The shader
// treats the silhouette as the thing being stamped, so this is the only CPU work
// in the whole effect and it happens once per word/size/font, never per frame.
//
// The mask is FULL-CANVAS here, unlike the Canvas 2D version's tight crop. The
// crop existed purely to keep 210 CPU blits affordable; the GPU samples a texture
// by uv, so the shader needs the word positioned in the same space it reads.
//
// The bitmap face has a small cap-height for its point size, so it needs a larger
// request than a normal grotesk to sit at the same optical weight.

/** Where the word's centre sits, as a fraction of height. Leaves the trail room
 *  to fall away below it. Must match the anchor the engine hands the shader. */
export const ANCHOR_Y = 0.42;

export function makeWordMask(
  word: string,
  w: number,
  h: number,
  fontFamily: string,
): HTMLCanvasElement {
  const W = Math.max(1, Math.round(w));
  const H = Math.max(1, Math.round(h));

  const out = document.createElement("canvas");
  out.width = W;
  out.height = H;
  const ctx = out.getContext("2d")!;
  ctx.clearRect(0, 0, W, H);

  const text = (word || "").trim();
  if (!text) return out;

  let size = H * 0.34;
  ctx.font = `400 ${size}px ${fontFamily}`;
  const maxW = W * 0.72;
  const measured = ctx.measureText(text).width;
  if (measured > maxW) {
    size *= maxW / measured;
    ctx.font = `400 ${size}px ${fontFamily}`;
  }

  // Real ink bounds, not the em box — the bitmap face leaves a lot of slack above
  // the ascender, and centring on the em box would put the trail's origin
  // somewhere above the letters instead of through them.
  const m = ctx.measureText(text);
  const asc = m.actualBoundingBoxAscent || size * 0.75;
  const desc = m.actualBoundingBoxDescent || size * 0.25;
  const inkMid = (asc - desc) / 2;

  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(text, W / 2, H * ANCHOR_Y + inkMid);

  return out;
}

/** Measured width of the word at a reference size, used to detect a real font
 *  swap. A CSS var resolves to the same family name whether or not the webfont
 *  file has arrived, so comparing NAMES would look identical before and after
 *  load and skip the one rebuild that matters. */
export function measureWord(word: string, fontFamily: string): number {
  const probe = document.createElement("canvas").getContext("2d");
  if (!probe) return 0;
  probe.font = `400 100px ${fontFamily}`;
  return Math.round(probe.measureText(word).width);
}

