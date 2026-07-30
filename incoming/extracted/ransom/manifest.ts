// Ransom-note cutout manifest + per-character picker. The sprites are real torn/cut-out
// magazine letters (Resource Boy "Ransom Note Letters" pack, royalty-free), trimmed to
// their alpha bbox and downscaled to ~220px tall WebP. Each key (a character) maps to a
// handful of variants; composing a word means picking one cutout per character and
// jittering it a little so it reads like a hand-assembled ransom note.

import { mediaUrl } from "../../lib/video-sources";
import manifestJson from "../../../public/vault/ransom/manifest.json";

export type Variant = { file: string; w: number; h: number };
export type Manifest = Record<string, Variant[]>;

export const RANSOM: Manifest = manifestJson as Manifest;

// where the sprites are served from (R2 in prod, /public in dev)
export const RANSOM_BASE = "/vault/ransom/";
export function spriteUrl(file: string): string {
  return mediaUrl(`${RANSOM_BASE}${file}`);
}

// Characters we have cutouts for. Everything else (space, unknown) is rendered as a gap.
export function hasGlyph(ch: string): boolean {
  return RANSOM[ch] !== undefined;
}

// A small deterministic PRNG (mulberry32) so a given seed reproduces the same note — the
// hero holds a stable composition per phrase, and "Re-roll" just bumps the seed.
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// hash a string to a stable 32-bit seed (so the same phrase defaults to the same note)
export function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export type Placed = {
  kind: "glyph" | "space";
  ch: string;
  variant?: Variant;
  rot: number;      // deg tilt
  dy: number;       // baseline offset, in em of the line height
  scale: number;    // per-letter scale multiplier
  mx: number;       // extra horizontal gap after (em)
  depth: number;    // 0..1 parallax depth (seeded) — far scraps lean less toward the cursor
};

export type JitterConfig = {
  rot: number;    // max |tilt| in deg
  dy: number;     // max baseline bounce (em)
  scale: number;  // scale variance (0.1 => 0.9..1.1)
  gap: number;    // max extra gap between letters (em)
};

export const DEFAULT_JITTER: JitterConfig = {
  rot: 8,     // lively but readable
  dy: 0.06,
  scale: 0.12,
  gap: 0.05,
};

// All cutout variants available for a given character (via its manifest key), or [] if none.
// Used by click-to-swap so a scrap can flip to a *different* scrap of the same letter.
export function variantsFor(ch: string): Variant[] {
  const key = keyFor(ch);
  return key ? RANSOM[key] : [];
}

// Resolve a character to a manifest key. Uppercase/lowercase share a folder in the pack
// (variants already mix cases), so we upcase letters; a few symbols map to shared keys.
function keyFor(ch: string): string | null {
  if (ch === " ") return null;
  const up = ch.toUpperCase();
  if (RANSOM[up]) return up;
  if (RANSOM[ch]) return ch;
  if (ch === "(" || ch === ")") return RANSOM["()"] ? "()" : null;
  if (ch === "." && RANSOM[","]) return null; // no period cutout; render as a small gap
  return null;
}

// Natural rendered width of a composed line at a given letter height (px). Mirrors the
// layout in RansomLine (per-letter width = aspect*scale*lineH, spaces = 0.32em, a small
// inter-item gap of 0.04em, plus each glyph's extra mx gap). Used to fit a line to one row.
export function lineWidth(placed: Placed[], lineH: number): number {
  let w = 0;
  const gap = lineH * 0.04;
  placed.forEach((p, i) => {
    if (i > 0) w += gap;
    if (p.kind === "space") {
      w += lineH * 0.32;
      return;
    }
    const v = p.variant!;
    w += (v.w / v.h) * (lineH * p.scale) + p.mx * lineH;
  });
  return w;
}

// Compose a line of text into placed cutouts using a seed. Deterministic for (text, seed).
export function composeLine(
  text: string,
  seed: number,
  jitter: JitterConfig = DEFAULT_JITTER,
): Placed[] {
  const rnd = mulberry32(seed);
  const out: Placed[] = [];
  for (const ch of text) {
    const key = keyFor(ch);
    if (!key) {
      out.push({ kind: "space", ch, rot: 0, dy: 0, scale: 1, mx: 0, depth: 0 });
      continue;
    }
    const variants = RANSOM[key];
    const v = variants[Math.floor(rnd() * variants.length)];
    out.push({
      kind: "glyph",
      ch,
      variant: v,
      rot: (rnd() * 2 - 1) * jitter.rot,
      dy: (rnd() * 2 - 1) * jitter.dy,
      scale: 1 + (rnd() * 2 - 1) * jitter.scale,
      mx: rnd() * jitter.gap,
      // seeded parallax depth: 0.35..1. Near scraps (→1) lean most toward the cursor,
      // far ones barely move, so the taped collage gets real depth on hover.
      depth: 0.35 + rnd() * 0.65,
    });
  }
  return out;
}

