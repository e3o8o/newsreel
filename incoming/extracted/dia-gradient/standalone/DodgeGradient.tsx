"use client";

// The "color-dodge" gradient — a self-contained drop-in. One full-bleed block whose
// background stacks a vertical black → off-white fade, color-dodge-blended over a
// horizontal full rainbow. The dodge
// brightens the rainbow where the fade is light, so it reads dark at the floor and
// blooms into saturated rainbow toward the top. Rises on a scaleY reveal.
//
// Usage (on a dark stage so the bloom reads):
//   <div className="fixed inset-x-0 bottom-0 h-[40vh] bg-black pointer-events-none -z-10">
//     <DodgeGradient />
//   </div>

import { useEffect, useState } from "react";

const BLEND = "color-dodge, normal";
const RAINBOW = ["#FF0000", "#FFFF00", "#00FF00", "#00FFFF", "#0000FF", "#FF00FF"];

export function DodgeGradient({
  colors = RAINBOW,
  riseMs = 1100,
}: {
  colors?: string[];
  riseMs?: number;
}) {
  // loop the band back to its first colour so the dodge zones repeat seamlessly
  const band = (colors.length ? colors : RAINBOW).concat(colors[0] ?? RAINBOW[0]);
  const BACKGROUND =
    "linear-gradient(0deg, #000000 0%, #f7f7f7 100%), " +
    `linear-gradient(90deg, ${band.join(", ")})`;

  const [shown, setShown] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() =>
      requestAnimationFrame(() => setShown(true)),
    );
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div
      aria-hidden
      style={{
        height: "100%",
        width: "100%",
        transformOrigin: "bottom",
        transform: shown ? "scaleY(1)" : "scaleY(0)",
        transition: `transform ${riseMs}ms cubic-bezier(0.16, 1, 0.3, 1)`,
        willChange: "transform",
      }}
    >
      <div
        style={{
          height: "100%",
          width: "100%",
          background: BACKGROUND,
          backgroundBlendMode: BLEND,
          // arch the rainbow into a soft dome rising from the floor (radial mask
          // anchored bottom-centre) instead of a flat rectangle
          WebkitMaskImage:
            "radial-gradient(75% 170% at 50% 100%, #000 38%, transparent 78%)",
          maskImage:
            "radial-gradient(75% 170% at 50% 100%, #000 38%, transparent 78%)",
        }}
      />
    </div>
  );
}

