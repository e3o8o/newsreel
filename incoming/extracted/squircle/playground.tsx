"use client";

// The squircle on a few real components — a glossy button, a chat, an iOS
// segmented control — all sharing one neutral material. Remix shuffles which one
// is shown; two sliders tune the corner; Compare / Remix sit beside the title.

import { useState } from "react";
import { PG_PREVIEW, PG_PANEL, Slider, GhostButton } from "../swirl/controls";
import { SectionLabel } from "../section-label";
import { hapticTap } from "../../lib/haptics";
import {
  SquircleGlossyButton,
  SquircleChat,
  SquircleTabs,
  SquircleToggle,
  SquircleInput,
  SquircleStepper,
  SquircleDropdown,
} from "./parts";

const DEFAULT_SMOOTHING = 1;
const DEFAULT_EXPONENT = 5;
const RADIUS = 22;
const DEMOS = 7;

export function SquirclePlayground() {
  const [smoothing, setSmoothing] = useState(DEFAULT_SMOOTHING);
  const [exponent, setExponent] = useState(DEFAULT_EXPONENT);
  const [compare, setCompare] = useState(false);
  const [demo, setDemo] = useState(0);
  const [tab, setTab] = useState(0);
  const [toggleOn, setToggleOn] = useState(false);

  // Remix: step to the next demo in order.
  const remix = () => {
    hapticTap();
    setDemo((d) => (d + 1) % DEMOS);
  };

  const shape = { radius: RADIUS, smoothing, exponent, compare };

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <SectionLabel
        action={
          <div className="flex items-center gap-2">
            <GhostButton onClick={() => setCompare((c) => !c)}>
              {compare ? "Compare on" : "Compare"}
            </GhostButton>
            <GhostButton onClick={remix}>Remix</GhostButton>
          </div>
        }
      >
        Playground
      </SectionLabel>

      <div className="flex flex-col">
        <div className={`${PG_PREVIEW} flex min-h-[260px] items-center justify-center px-6 py-12`}>
          {demo === 0 && <SquircleGlossyButton {...shape} />}
          {demo === 1 && <SquircleChat {...shape} />}
          {demo === 2 && <SquircleTabs {...shape} active={tab} onChange={setTab} />}
          {demo === 3 && <SquircleToggle {...shape} on={toggleOn} onChange={setToggleOn} />}
          {demo === 4 && <SquircleInput {...shape} />}
          {demo === 5 && <SquircleStepper {...shape} />}
          {/* nudged down so the upward-opening menu clears the top without growing the stage */}
          {demo === 6 && (
            <div className="translate-y-10">
              <SquircleDropdown {...shape} />
            </div>
          )}
        </div>

        <div className={PG_PANEL}>
          <Slider
            label="Smoothing"
            value={smoothing}
            min={0}
            max={1}
            step={0.01}
            format={(v) =>
              v < 0.005
                ? "0.00 · plain"
                : Math.abs(v - 0.6) < 0.005
                  ? "0.60 · iOS"
                  : v.toFixed(2)
            }
            onChange={setSmoothing}
          />
          <Slider
            label="Squareness"
            value={exponent}
            min={2}
            max={8}
            step={0.1}
            format={(v) =>
              Math.abs(v - 2) < 0.05
                ? "2.0 · circle"
                : Math.abs(v - 5) < 0.05
                  ? "5.0 · iOS"
                  : `n ${v.toFixed(1)}`
            }
            onChange={setExponent}
          />
        </div>
      </div>
    </div>
  );
}

