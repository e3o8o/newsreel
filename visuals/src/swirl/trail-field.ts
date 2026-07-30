// A persistent "trail" the cursor leaves on the swirl. It is a low-res grid that
// remembers, per cell, how much the pointer has disturbed that spot (heat) and
// which way it was moving when it did (a flow direction). Heat barely fades, so
// a path you trace lingers almost indefinitely — but each deposit is tiny, so it
// stays a faint, slowly-churning trace rather than a bright smear.
//
// The grid is a fixed resolution in normalized field space (-1..1 on both axes),
// independent of the canvas size, so it survives resizes. composeField samples it
// per cell to drive a directional wake (push along the remembered flow) and a
// local swirl-up (extra spin where it is hot).

export const TRAIL_W = 72;
export const TRAIL_H = 40;

// ── tuning ── kept deliberately weak: the trail is near-permanent, so a small
// per-frame deposit accumulates into a faint, lingering trace rather than a
// bright smear. HEAT_MAX caps how strong a hammered spot can ever get.
const DEPOSIT_RADIUS = 0.15; // Gaussian radius of a single deposit (field units)
const DEPOSIT_BASE = 0.05; // heat laid down per second just by hovering
const DEPOSIT_SPEED = 0.8; // extra heat scaled by pointer speed
const HEAT_MAX = 0.7; // clamp: headroom for a strong, visible trail
const DECAY_PER_SEC = 0.025; // near-permanent: ~2.5% of the heat fades per second
const DIFFUSE = 0.12; // per-frame blur so trails soften into pools
const FLOW_BLEND = 0.25; // how fast a cell adopts the latest pointer direction

export interface TrailField {
  heat: Float32Array; // TRAIL_W * TRAIL_H, 0..HEAT_MAX
  flowX: Float32Array; // remembered pointer direction per cell, -1..1
  flowY: Float32Array;
  tmp: Float32Array; // scratch for diffusion
}

export function makeTrailField(): TrailField {
  const n = TRAIL_W * TRAIL_H;
  return {
    heat: new Float32Array(n),
    flowX: new Float32Array(n),
    flowY: new Float32Array(n),
    tmp: new Float32Array(n),
  };
}

export function clearTrail(t: TrailField) {
  t.heat.fill(0);
  t.flowX.fill(0);
  t.flowY.fill(0);
}

// normalized (-1..1) → grid index helpers
const toGX = (nx: number) => ((nx + 1) / 2) * (TRAIL_W - 1);
const toGY = (ny: number) => ((ny + 1) / 2) * (TRAIL_H - 1);

/**
 * Deposit heat + flow at the pointer. `nx,ny` are normalized field coords
 * (-1..1, y-down to match screen). `vx,vy` is the pointer velocity (same units
 * per second); its magnitude scales the deposit and its direction is stored.
 */
export function depositTrail(
  t: TrailField,
  nx: number,
  ny: number,
  vx: number,
  vy: number,
  dt: number,
) {
  const speed = Math.min(3, Math.hypot(vx, vy));
  const amount = (DEPOSIT_BASE + DEPOSIT_SPEED * speed) * dt;
  const dirLen = Math.hypot(vx, vy) || 1;
  const dirX = vx / dirLen;
  const dirY = vy / dirLen;

  const gx = toGX(nx);
  const gy = toGY(ny);
  const rx = DEPOSIT_RADIUS * (TRAIL_W / 2);
  const ry = DEPOSIT_RADIUS * (TRAIL_H / 2);
  const x0 = Math.max(0, Math.floor(gx - rx * 2));
  const x1 = Math.min(TRAIL_W - 1, Math.ceil(gx + rx * 2));
  const y0 = Math.max(0, Math.floor(gy - ry * 2));
  const y1 = Math.min(TRAIL_H - 1, Math.ceil(gy + ry * 2));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const ddx = (x - gx) / rx;
      const ddy = (y - gy) / ry;
      const fall = Math.exp(-(ddx * ddx + ddy * ddy));
      if (fall < 0.01) continue;
      const i = y * TRAIL_W + x;
      t.heat[i] = Math.min(HEAT_MAX, t.heat[i] + amount * fall);
      // ease the stored flow toward the current direction, weighted by deposit
      const w = FLOW_BLEND * fall;
      t.flowX[i] += (dirX - t.flowX[i]) * w;
      t.flowY[i] += (dirY - t.flowY[i]) * w;
    }
  }
}

/** Decay (near-permanent) + a light box blur so heat diffuses into soft pools. */
export function stepTrail(t: TrailField, dt: number) {
  const keep = Math.exp(-DECAY_PER_SEC * dt);
  const { heat, tmp } = t;
  // 4-neighbour blur into tmp, then lerp back by DIFFUSE and apply decay
  for (let y = 0; y < TRAIL_H; y++) {
    for (let x = 0; x < TRAIL_W; x++) {
      const i = y * TRAIL_W + x;
      const l = x > 0 ? heat[i - 1] : heat[i];
      const rr = x < TRAIL_W - 1 ? heat[i + 1] : heat[i];
      const u = y > 0 ? heat[i - TRAIL_W] : heat[i];
      const d = y < TRAIL_H - 1 ? heat[i + TRAIL_W] : heat[i];
      tmp[i] = (l + rr + u + d) * 0.25;
    }
  }
  for (let i = 0; i < heat.length; i++) {
    heat[i] = (heat[i] + (tmp[i] - heat[i]) * DIFFUSE) * keep;
  }
}

/** Bilinear-sample heat + flow at normalized coords. Returns into `out`. */
export function sampleTrail(
  t: TrailField,
  nx: number,
  ny: number,
  out: { heat: number; fx: number; fy: number },
) {
  const gx = toGX(nx);
  const gy = toGY(ny);
  const x0 = Math.max(0, Math.min(TRAIL_W - 1, Math.floor(gx)));
  const y0 = Math.max(0, Math.min(TRAIL_H - 1, Math.floor(gy)));
  const x1 = Math.min(TRAIL_W - 1, x0 + 1);
  const y1 = Math.min(TRAIL_H - 1, y0 + 1);
  const tx = gx - x0;
  const ty = gy - y0;
  const i00 = y0 * TRAIL_W + x0;
  const i10 = y0 * TRAIL_W + x1;
  const i01 = y1 * TRAIL_W + x0;
  const i11 = y1 * TRAIL_W + x1;
  const lerp = (a: number, b: number, f: number) => a + (b - a) * f;
  const bi = (arr: Float32Array) =>
    lerp(lerp(arr[i00], arr[i10], tx), lerp(arr[i01], arr[i11], tx), ty);
  out.heat = bi(t.heat);
  out.fx = bi(t.flowX);
  out.fy = bi(t.flowY);
}

