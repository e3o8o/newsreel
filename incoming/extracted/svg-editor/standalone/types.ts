// The editable vector model. An SVG <path> is broken into ANCHOR points, each
// with up to two bezier control HANDLES (the "in" tangent from the previous
// segment and the "out" tangent toward the next). A path may contain several
// SUBPATHS (the word "arlan" is many glyphs; a shape with a hole is an outer ring
// plus an inner ring). Anchors are kept in ONE flat array; `starts` marks where
// each subpath begins and `closed` is the per-subpath Z flag. Serializing back to
// a path `d` string is lossless for the cubic/line subset we support.

export interface Vec {
  x: number;
  y: number;
}

export interface Anchor {
  /** Anchor position. */
  p: Vec;
  /** Outgoing control handle (toward the next anchor), absolute coords. null = straight. */
  out: Vec | null;
  /** Incoming control handle (from the previous anchor), absolute coords. null = straight. */
  in: Vec | null;
}

export interface VectorPath {
  /** All anchors of every subpath, concatenated. */
  anchors: Anchor[];
  /** Flat index where each subpath begins. `starts[0]` is always 0. Subpath `s`
   *  owns anchors `[starts[s], starts[s+1])` (or to the end for the last). */
  starts: number[];
  /** Per-subpath: does this subpath close back to its first anchor (Z)? */
  closed: boolean[];
}

export const v = (x: number, y: number): Vec => ({ x, y });
export const add = (a: Vec, b: Vec): Vec => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a: Vec, b: Vec): Vec => ({ x: a.x - b.x, y: a.y - b.y });
export const dist = (a: Vec, b: Vec): number => Math.hypot(a.x - b.x, a.y - b.y);

/** [begin, end) flat-anchor range of subpath `s`. */
export function subRange(path: VectorPath, s: number): [number, number] {
  const begin = path.starts[s];
  const end = s + 1 < path.starts.length ? path.starts[s + 1] : path.anchors.length;
  return [begin, end];
}

