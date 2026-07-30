// One source of truth for every squircle demo, so they read as a single family
// instead of six independently hand-tuned components.
//
// Two control heights (a default and a small tier), one radius formula tied to
// the element's own height (so a 36px control and a 28px control get
// proportionally identical corners, and stay proportional as the sliders move),
// and shared text/tracking/padding.

/** Default control height (button, input, tabs, dropdown). */
export const CONTROL_H = 36;
/** Small control height (toggle, stepper key). */
export const CONTROL_H_SM = 28;

/** Corner radius as a fixed fraction of the element's own height. */
export function radiusFor(height: number): number {
  return Math.round(height * 0.42);
}

/** Shared label size and tracking, in px. Horizontal padding is `px-3` (12px). */
export const TEXT = 14;
export const TRACKING = -0.3;

