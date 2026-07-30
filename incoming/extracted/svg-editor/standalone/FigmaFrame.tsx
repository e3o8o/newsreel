"use client";

// FigmaFrame — the "selected layer" chrome you see in Figma/Framer: a thin
// accent border that draws itself open, four corner handles that pop in one by
// one, and a live W×H dimension badge under the box. Drop it around ANY element
// and it tracks that element's size with a ResizeObserver, so the badge stays
// honest as the content reflows or you drag points inside it.
//
// Everything visual is prop-driven (accent, handle size/color, border width,
// badge on/off) so a playground can restyle it live.

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

export interface FrameStyle {
  accent: string;        // selection color (Figma blue by default)
  handleSize: number;    // px, the little corner squares
  handleFill: string;    // usually white
  borderWidth: number;   // px
  showHandles: boolean;
  showBadge: boolean;
  badgeBg: string;
  badgeText: string;
  /** Replay the open animation whenever this value changes. */
  animateKey?: string | number;
}

export const DEFAULT_FRAME: FrameStyle = {
  accent: "#0d99ff",
  handleSize: 8,
  handleFill: "#ffffff",
  borderWidth: 1,
  showHandles: true,
  showBadge: true,
  badgeBg: "#0d99ff",
  badgeText: "#ffffff",
};

export function FigmaFrame({
  children,
  style = DEFAULT_FRAME,
  /** Override the measured size with explicit numbers (e.g. the SVG viewBox). */
  width,
  height,
}: {
  children: ReactNode;
  style?: FrameStyle;
  width?: number;
  height?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  // true only on the very first render → the intro animation plays once
  const [firstMount, setFirstMount] = useState(true);
  useEffect(() => {
    const id = setTimeout(() => setFirstMount(false), 900);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    if (width != null && height != null) {
      setSize({ w: width, h: height });
      return;
    }
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      setSize({ w: Math.round(r.width), h: Math.round(r.height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [width, height]);

  const w = width ?? size.w;
  const h = height ?? size.h;

  const s = style;
  const half = s.handleSize / 2;
  const handle = (pos: CSSProperties, intro: boolean, delay: number): CSSProperties => ({
    position: "absolute",
    zIndex: 10,
    width: s.handleSize,
    height: s.handleSize,
    backgroundColor: s.handleFill,
    border: `1px solid ${s.accent}`,
    borderRadius: 1,
    // set the shorthand + delay together, or neither — never mix one set with one
    // removed across renders (React warns about shorthand/non-shorthand conflicts)
    ...(intro ? { animation: `bbox-handle 0.25s ease-out both`, animationDelay: `${delay}s` } : {}),
    ...pos,
  });

  // Play the draw-open / pop-in animation only on the FIRST mount. On a remix the
  // box must not disappear and redraw — it just resizes to track the new shape,
  // which it does smoothly because width/height come straight from the viewBox.
  const intro = firstMount;

  return (
    <div ref={ref} className="relative inline-block">
      {/* the selection border — animates open once, then just tracks the size */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          border: `${s.borderWidth}px solid ${s.accent}`,
          transformOrigin: "top left",
          animation: intro ? `bbox-open 0.6s var(--ease-expo) both` : undefined,
        }}
      />

      {s.showHandles && (
        <>
          <span style={handle({ top: -half, left: -half }, intro, 0.18)} />
          <span style={handle({ top: -half, right: -half }, intro, 0.28)} />
          <span style={handle({ bottom: -half, right: -half }, intro, 0.38)} />
          <span style={handle({ bottom: -half, left: -half }, intro, 0.48)} />
        </>
      )}

      {s.showBadge && (
        <span
          className="pointer-events-none absolute left-1/2 z-10 whitespace-nowrap rounded-[4px] px-2 py-0.5 text-[11px] tabular-nums"
          style={{
            bottom: -30,
            backgroundColor: s.badgeBg,
            color: s.badgeText,
            transform: "translateX(-50%)",
            ...(intro ? { animation: `bbox-badge 0.25s ease-out both`, animationDelay: "0.2s" } : {}),
          }}
        >
          {w} × {h}
        </span>
      )}

      {children}
    </div>
  );
}

