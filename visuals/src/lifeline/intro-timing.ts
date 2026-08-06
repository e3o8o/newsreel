// Derived from evilrabbit/lifeline (MIT, (c) 2026 Evil Rabbit) — see LICENSE.
//
// The intro's timing math, lifted verbatim from components/lifeline/
// lifeline-intro-timing.ts: a smoothstep-softened clock raised to a power
// calibrated so the first LIFELINE_SLOW_YEARS markers consume
// LIFELINE_SLOW_TIME_RATIO of the sweep (slow open, accelerating tail), plus
// the bisection inversion that turns a marker's track offset back into its
// fade delay. Two local adaptations: `clamp` and `snapToDevicePixel` are
// inlined from lifeline-utils.ts instead of imported, and the rail-duration
// scaling from use-lifeline-intro.ts is ported out of hook form into plain
// functions at the bottom.

/** Tweak these */
export const LIFELINE_SLOW_YEARS = 5;
export const LIFELINE_SLOW_TIME_RATIO = 0.38;
export const LIFELINE_SLOW_MARKER_FADE_MS = 720;
export const LIFELINE_FAST_MARKER_FADE_MS = 280;
/** Set > 0 to override auto-calibrated ease power */
export const LIFELINE_EASE_POWER = 0;

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/**
 * A composited layer resting on a fractional offset resamples its whole
 * subtree — text goes soft. Snapping to the device pixel grid (not whole
 * CSS pixels) keeps half-pixel steps on retina, so motion stays smooth.
 */
export function snapToDevicePixel(value: number) {
  const dpr = window.devicePixelRatio || 1;
  return Math.round(value * dpr) / dpr;
}

function smoothstep(value: number) {
  const t = clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
}

export function getSlowTrackWidth(widths: number[]) {
  return widths
    .slice(0, LIFELINE_SLOW_YEARS)
    .reduce((sum, width) => sum + width, 0);
}

export function getSlowTrackPortion(widths: number[]) {
  const total = widths.reduce((sum, width) => sum + width, 0);
  if (total <= 0) return 0;
  return getSlowTrackWidth(widths) / total;
}

function getEasePower(widths: number[]) {
  if (LIFELINE_EASE_POWER > 0) return LIFELINE_EASE_POWER;

  const slowPortion = getSlowTrackPortion(widths);
  const softenedPivot = smoothstep(LIFELINE_SLOW_TIME_RATIO);

  if (slowPortion <= 0 || softenedPivot <= 0 || softenedPivot >= 1) {
    return 2.6;
  }

  return Math.log(slowPortion) / Math.log(softenedPivot);
}

function softenedTime(elapsedMs: number, railMs: number) {
  return smoothstep(elapsedMs / railMs);
}

export function trackProgressAtTime(
  elapsedMs: number,
  widths: number[],
  railMs: number,
) {
  if (railMs <= 0) return 0;

  const t = softenedTime(elapsedMs, railMs);
  const power = getEasePower(widths);

  return clamp(Math.pow(t, power), 0, 1);
}

export function timeAtTrackProgress(
  progress: number,
  widths: number[],
  railMs: number,
) {
  const clamped = clamp(progress, 0, 1);
  if (clamped <= 0) return 0;
  if (clamped >= 1) return railMs;

  const power = getEasePower(widths);
  const softened = Math.pow(clamped, 1 / power);

  return invertSmoothstep(softened) * railMs;
}

function invertSmoothstep(value: number) {
  const target = clamp(value, 0, 1);
  let lo = 0;
  let hi = 1;

  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2;
    if (smoothstep(mid) < target) lo = mid;
    else hi = mid;
  }

  return (lo + hi) / 2;
}

export function isSlowIntroYear(index: number) {
  return index < LIFELINE_SLOW_YEARS;
}

export function getTransitionMarkerFadeDuration(index: number) {
  if (index < LIFELINE_SLOW_YEARS) return LIFELINE_SLOW_MARKER_FADE_MS;

  const rampYears = 3;
  const rampIndex = index - LIFELINE_SLOW_YEARS;
  if (rampIndex >= rampYears) return LIFELINE_FAST_MARKER_FADE_MS;

  const t = (rampIndex + 1) / rampYears;
  const blend = smoothstep(t);

  return Math.round(
    LIFELINE_SLOW_MARKER_FADE_MS +
      (LIFELINE_FAST_MARKER_FADE_MS - LIFELINE_SLOW_MARKER_FADE_MS) * blend,
  );
}

// ── rail duration, ported from use-lifeline-intro.ts (same constants,
//    hook state dropped) ──

/** Tweak these */
export const LIFELINE_LABELS_MS = 600;
export const LIFELINE_RAIL_MS = 3200;
/**
 * Track length (px) the base rail duration was tuned for — roughly a
 * 40-year personal lifeline. Longer tracks slow the sweep sublinearly so
 * dense timelines stay readable, capped so a 250-year nation doesn't
 * become a screensaver.
 */
export const LIFELINE_REFERENCE_TRACK = 9000;
export const LIFELINE_RAIL_MAX_MS = 7200;
export const LIFELINE_RAIL_SCALE_POWER = 0.45;
/**
 * Keep fade stretching subtle — long fades lag behind the sweeping
 * line and read as out of sync.
 */
export const LIFELINE_FADE_SCALE_MAX = 1.5;

export function getRailDuration(totalMarkersWidth: number) {
  if (totalMarkersWidth <= LIFELINE_REFERENCE_TRACK) return LIFELINE_RAIL_MS;

  const scale = Math.pow(
    totalMarkersWidth / LIFELINE_REFERENCE_TRACK,
    LIFELINE_RAIL_SCALE_POWER,
  );
  return Math.min(LIFELINE_RAIL_MAX_MS, Math.round(LIFELINE_RAIL_MS * scale));
}

// Stretch each marker's fade with the sweep so dense timelines bloom
// in a trailing wave instead of flickering past.
export function getFadeScale(railDuration: number) {
  return Math.min(LIFELINE_FADE_SCALE_MAX, railDuration / LIFELINE_RAIL_MS);
}
