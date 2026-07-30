// Squircle path generator. A border-radius is one circular arc per corner, and
// the arc meets the straight edge at a hard tangent, so curvature jumps 0→max in
// one step. A squircle is the superellipse |x|ⁿ+|y|ⁿ=1, where curvature ramps in
// continuously and the corner flows into the edge with no kink. We emit it as an
// SVG path and apply it with `clip-path: path(...)`.

export interface SquircleOptions {
  width: number;
  height: number;
  /** Corner radius in px (clamped to half the shorter side). */
  radius: number;
  /** Corner extent along the edge (0..1). 1 = full corner, ~0.6 is a common look. */
  smoothing: number;
  /** Superellipse exponent n: 2 = circle, ~5 = classic squircle, higher = boxier. */
  exponent?: number;
}

const DEFAULT_EXPONENT = 5;

const n = (v: number) => v.toFixed(4);

// A three-cubic-bézier fit of one superellipse corner at the default exponent, on
// a unit box: it starts at the top edge (0,0), ends at the side edge (1,1), and is
// symmetric across the (1,0)-(0,1) diagonal. Each row is [control1, control2, end];
// segment 0 starts at (0,0), each next segment starts where the previous ended.
const CORNER: readonly [number, number][][] = [
  [ [0.3, 0],       [0.473, 0],     [0.619, 0.039] ],
  [ [0.804, 0.088], [0.912, 0.196], [0.961, 0.381] ],
  [ [1, 0.527],     [1, 0.7],       [1, 1] ],
];

// rotate a unit-corner point 90°·k clockwise (k = 0 top-right … 3 top-left)
function rot90([x, y]: [number, number], k: number): [number, number] {
  switch (((k % 4) + 4) % 4) {
    case 1: return [y, -x];
    case 2: return [-x, -y];
    case 3: return [-y, x];
    default: return [x, y];
  }
}

// The three cubic segments for one corner, scaled by `radius`, placed at `start`
// (where the straight edge meets the corner) and rotated by k.
function cornerCubics(sx: number, sy: number, radius: number, k: number): string {
  const put = (p: [number, number]) => {
    const [rx, ry] = rot90(p, k);
    return `${n(sx + rx * radius)} ${n(sy + ry * radius)}`;
  };
  return CORNER.map(([c1, c2, end]) => `C ${put(c1)} ${put(c2)} ${put(end)}`).join(" ");
}

// For any other exponent, sample the superellipse arc directly. In unit-corner
// coords the top-right quarter of |x|ⁿ+|y|ⁿ=1 is x = sin(θ)^(2/n),
// y = 1 - cos(θ)^(2/n) for θ ∈ [0, π/2]; 32 line segments read as smooth.
function cornerSampled(sx: number, sy: number, radius: number, k: number, exponent: number): string {
  const STEPS = 32;
  const e = 2 / exponent;
  const pts: string[] = [];
  for (let i = 1; i <= STEPS; i++) {
    const t = (i / STEPS) * (Math.PI / 2);
    const ux = Math.pow(Math.sin(t), e);
    const uy = 1 - Math.pow(Math.cos(t), e);
    const [rx, ry] = rot90([ux, uy], k);
    pts.push(`L ${n(sx + rx * radius)} ${n(sy + ry * radius)}`);
  }
  return pts.join(" ");
}

// Closed SVG path for a squircle-cornered rectangle. `smoothing` scales how far
// the corner reaches along each edge; `exponent` sets its squareness.
export function squirclePath({ width, height, radius, smoothing, exponent = DEFAULT_EXPONENT }: SquircleOptions): string {
  const budget = Math.min(width, height) / 2;
  const s = Math.max(0, Math.min(1, smoothing));
  const r = Math.max(0, Math.min(radius, budget)) * (0.4 + 0.6 * s);

  if (r <= 0) {
    return `M 0 0 L ${n(width)} 0 L ${n(width)} ${n(height)} L 0 ${n(height)} Z`;
  }

  // The bézier fit is exact at the default exponent; sample for anything else.
  const useBezier = Math.abs(exponent - DEFAULT_EXPONENT) < 0.05;
  const corner = (sx: number, sy: number, k: number) =>
    useBezier ? cornerCubics(sx, sy, r, k) : cornerSampled(sx, sy, r, k, exponent);

  return [
    `M ${n(r)} 0`,
    `L ${n(width - r)} 0`,
    corner(width - r, 0, 0),
    `L ${n(width)} ${n(height - r)}`,
    corner(width, height - r, 3),
    `L ${n(r)} ${n(height)}`,
    corner(r, height, 2),
    `L 0 ${n(r)}`,
    corner(0, r, 1),
    "Z",
  ].join(" ");
}

// The plain border-radius path for the same box (one arc per corner), drawn as a
// dashed reference in compare mode.
export function roundRectPath(w: number, h: number, r: number): string {
  const rr = Math.max(0, Math.min(r, Math.min(w, h) / 2));
  return `M ${rr} 0 L ${w - rr} 0 A ${rr} ${rr} 0 0 1 ${w} ${rr} L ${w} ${h - rr} A ${rr} ${rr} 0 0 1 ${w - rr} ${h} L ${rr} ${h} A ${rr} ${rr} 0 0 1 0 ${h - rr} L 0 ${rr} A ${rr} ${rr} 0 0 1 ${rr} 0 Z`;
}

// Pick the shape path: a plain border-radius when `plain` is set, else the
// squircle. Used so the "Compare" toggle can swap every component to a plain
// rounded rect in one place.
export function shapePath(o: SquircleOptions & { plain?: boolean }): string {
  return o.plain
    ? roundRectPath(o.width, o.height, o.radius)
    : squirclePath(o);
}

// Native one-liner (Chromium-only for now; falls back to plain border-radius).
export function nativeCornerShape(radius: number): { borderRadius: string; cornerShape: string } {
  return { borderRadius: `${radius}px`, cornerShape: "squircle" };
}

