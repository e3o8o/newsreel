"use client";

// A second take on the Dia glow, the "peaked" way: instead of discrete bars, stack
// a few smooth bezier PEAK shapes — light at the front, dark behind — each blurred,
// so they read as one soft mountain of colour rising from the bottom. A `pointiness`
// control sharpens or rounds the peak. Same rise-up reveal as the bars version.

import { useEffect, useRef, useState, type CSSProperties } from "react";

const VBW = 1271;
const VBH = 599;

// One quadratic-bezier arch: bottom-left → peak → bottom-right, closed along an
// extended bottom (so the blur never clips). pointiness 0 = round, 1 = sharp.
function peakPath(widthFrac: number, heightFrac: number, pointiness: number): string {
  const w = widthFrac * VBW;
  const startX = (VBW - w) / 2;
  const endX = startX + w;
  const peakX = VBW / 2;
  const peakY = VBH - heightFrac * VBH;
  const spread = (1 - pointiness) * (w / 2); // wide control pts = rounder
  const ext = VBH * 0.6; // extend bottom past the viewBox
  return [
    `M ${startX} ${VBH}`,
    `Q ${peakX - spread} ${peakY}, ${peakX} ${peakY}`,
    `Q ${peakX + spread} ${peakY}, ${endX} ${VBH}`,
    `L ${endX} ${VBH + ext}`,
    `L ${startX} ${VBH + ext}`,
    "Z",
  ].join(" ");
}

export interface PeakedGradientProps {
  /** Front-to-back colours (lightest first looks best). */
  colors?: string[];
  /** Peak height as a fraction of the viewBox (0..1). */
  peak?: number;
  /** 0 = round dome, 1 = sharp point. */
  pointiness?: number;
  /** Blur in viewBox units. */
  blur?: number;
  reveal?: "mount" | "scroll" | "none";
  riseMs?: number;
  replayKey?: number;
  className?: string;
  style?: CSSProperties;
}

const DEFAULT_COLORS = ["#E1ECFE", "#FFD400", "#FA3D1D", "#FD02F5", "#0358F7", "#340B05"];

export function PeakedGradient({
  colors = DEFAULT_COLORS,
  peak = 0.92,
  pointiness = 0.5,
  blur = 26,
  reveal = "mount",
  riseMs = 1100,
  replayKey = 0,
  className,
  style,
}: PeakedGradientProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scaleY, setScaleY] = useState(reveal === "none" ? 1 : 0);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reveal === "none" || reduced) {
      setScaleY(1);
      return;
    }
    if (reveal === "mount") {
      setScaleY(0);
      const id = requestAnimationFrame(() =>
        requestAnimationFrame(() => setScaleY(1)),
      );
      return () => cancelAnimationFrame(id);
    }
    let ticking = false;
    const measure = () => {
      ticking = false;
      const el = wrapRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      setScaleY(Math.max(0, Math.min(1, (vh - r.top) / (vh * 0.65))));
    };
    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(measure);
      }
    };
    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [reveal, replayKey]);

  const fid = `peak-blur-${replayKey}`;
  // back (darkest, widest, lowest) → front (lightest, narrowest, tallest), so
  // the layers nest into one shaded mountain.
  const layers = colors
    .slice()
    .reverse()
    .map((color, i, arr) => {
      const t = arr.length === 1 ? 1 : i / (arr.length - 1); // 0 back → 1 front
      const heightFrac = peak * (0.55 + 0.45 * t);
      const widthFrac = 1.05 - 0.45 * t;
      return { color, d: peakPath(widthFrac, heightFrac, pointiness) };
    });

  return (
    <div
      ref={wrapRef}
      aria-hidden
      className={className}
      style={{
        transformOrigin: "bottom",
        transform: `scaleY(${scaleY})`,
        transition:
          reveal === "mount"
            ? `transform ${riseMs}ms cubic-bezier(0.16, 1, 0.3, 1)`
            : undefined,
        willChange: "transform",
        ...style,
      }}
    >
      <svg
        className="h-full w-full"
        viewBox={`0 0 ${VBW} ${VBH}`}
        preserveAspectRatio="none"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <filter id={fid} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation={blur} />
          </filter>
        </defs>
        <g filter={`url(#${fid})`}>
          {layers.map((l, i) => (
            <path key={i} d={l.d} fill={l.color} />
          ))}
        </g>
      </svg>
    </div>
  );
}

