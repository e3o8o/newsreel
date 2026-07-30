"use client";

// Renders content inside a squircle. The body is painted (as an SVG fill or a
// clipped gradient div) and the border is a stroke on the exact outline, so the
// border is never sliced in half the way `clip-path` on the container would do.
// The element measures its own box so the path always matches its size.

import { useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { squirclePath, roundRectPath } from "./superellipse";

export interface SquircleProps {
  radius: number;
  smoothing: number;
  /** Superellipse exponent (squareness): 2=circle, 5=squircle, higher=boxier. */
  exponent?: number;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** Fill color or CSS gradient for the body. */
  fill?: string;
  /** Border color on the outline. */
  stroke?: string;
  /** Vertical gradient border (top → bottom), 2+ stops; overrides `stroke`. */
  strokeGradient?: string[];
  strokeWidth?: number;
  /** Overlay the plain border-radius outline (dashed) to show the delta. */
  compare?: boolean;
  /** Classes for the content overlay (padding, gap, text); centered by default. */
  contentClassName?: string;
}

export function Squircle({
  radius,
  smoothing,
  exponent,
  children,
  className = "",
  style,
  fill,
  stroke,
  strokeGradient,
  strokeWidth = 1,
  compare = false,
  contentClassName = "",
}: SquircleProps) {
  const ref = useRef<HTMLDivElement>(null);
  const uid = useId().replace(/:/g, "");
  const [size, setSize] = useState({ w: 0, h: 0 });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      // Layout size, not getBoundingClientRect (which is scaled by any ancestor
      // transform), so the path stays matched to the box under a `scale()`.
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      setSize((p) => (p.w === w && p.h === h ? p : { w, h }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { w, h } = size;
  // `compare` swaps the shape to a PLAIN border-radius (a single circular arc per
  // corner), so toggling it shows the ordinary rounded rect vs the squircle.
  const body = w && h
    ? compare
      ? roundRectPath(w, h, radius)
      : squirclePath({ width: w, height: h, radius, smoothing, exponent })
    : "";
  // A CSS gradient can't be an SVG fill, so it's painted on a clipped div instead.
  const isCssGradient = !!fill && /gradient\(/.test(fill);

  return (
    <div ref={ref} className={className} style={{ position: "relative", ...style }}>
      {isCssGradient && w > 0 && h > 0 && (
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            background: fill,
            clipPath: `path("${body}")`,
            WebkitClipPath: `path("${body}")`,
            zIndex: 0,
          }}
        />
      )}
      {w > 0 && h > 0 && (
        <svg
          aria-hidden
          width={w}
          height={h}
          viewBox={`0 0 ${w} ${h}`}
          style={{ position: "absolute", inset: 0, pointerEvents: "none", display: "block", zIndex: 0 }}
        >
          {fill && !isCssGradient && <path d={body} fill={fill} />}
        </svg>
      )}
      {/* Content overlay: fills the box and centers by default. */}
      {children != null && (
        <div
          className={`absolute inset-0 flex items-center justify-center ${contentClassName}`}
          style={{ zIndex: 1 }}
        >
          {children}
        </div>
      )}
      {/* Border on top of everything, clipped to the shape so only its inner half
          shows (drawn at 2× so the visible half equals strokeWidth). This keeps
          the hairline uniform on flats and corners and stops any body/shadow layer
          from painting over it. */}
      {(stroke || strokeGradient) && w > 0 && h > 0 && (
        <svg
          aria-hidden
          width={w}
          height={h}
          viewBox={`0 0 ${w} ${h}`}
          style={{ position: "absolute", inset: 0, pointerEvents: "none", display: "block", zIndex: 3 }}
        >
          <clipPath id={`sq-clip-${uid}`}>
            <path d={body} />
          </clipPath>
          {strokeGradient && (
            <linearGradient id={`sq-stroke-${uid}`} x1="0" y1="0" x2="0" y2="1">
              {strokeGradient.map((c, i) => (
                <stop key={i} offset={i / (strokeGradient.length - 1)} stopColor={c} />
              ))}
            </linearGradient>
          )}
          <path
            d={body}
            fill="none"
            stroke={strokeGradient ? `url(#sq-stroke-${uid})` : stroke}
            strokeWidth={strokeWidth * 2}
            clipPath={`url(#sq-clip-${uid})`}
          />
        </svg>
      )}
    </div>
  );
}

