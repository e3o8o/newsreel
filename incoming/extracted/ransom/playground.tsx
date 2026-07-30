"use client";

// Ransom-note playground — the detail-page editor. Type any text and it composes into a
// note built from real torn-paper cutout letters, with live jitter controls (tilt, bounce,
// scale variance, spacing, size) and a Re-roll that reshuffles which cutouts are used.
// Built on the shared composeLine picker the display card uses.

import { useEffect, useMemo, useRef, useState } from "react";
import { SlammingLine } from "./RansomLine";
import { useMagnetism } from "./use-magnetism";
import { composeLine, hashSeed, lineWidth, type JitterConfig } from "./manifest";
import { PG_PREVIEW, PG_PANEL, Slider, GhostButton } from "../swirl/controls";
import { SectionLabel } from "../section-label";
import { hapticTap } from "../../lib/haptics";

const LABEL = "text-[12px] text-[var(--text-tertiary)]";

export function RansomNotePlayground() {
  const [text, setText] = useState("stay weird");
  const [seed, setSeed] = useState(() => hashSeed("stay weird"));
  const [jit, setJit] = useState<JitterConfig>({ rot: 8, dy: 0.06, scale: 0.12, gap: 0.2 });
  const [size, setSize] = useState(78);
  const stageRef = useRef<HTMLDivElement>(null);
  const [avail, setAvail] = useState(900); // usable inner width of the preview
  // bumps on every Re-roll so the lines remount (via key) and slam back in.
  const [playKey, setPlayKey] = useState(0);

  // split into lines (Enter breaks a line); compose each with a per-line seed so re-roll
  // reshuffles everything at once.
  const lines = useMemo(() => {
    const raw = (text || " ").split("\n");
    return raw.map((ln, i) => composeLine(ln.toUpperCase(), seed + i * 101, jit));
  }, [text, seed, jit]);

  // track the stage width so we can shrink each line to fit on ONE row (never wrap)
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setAvail(el.clientWidth));
    ro.observe(el);
    setAvail(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  // cursor magnetism: each scrap reacts to the pointer's proximity to itself (same per-letter
  // field as the display card), scoped to the preview stage.
  useMagnetism(stageRef);

  // per line: use the Size slider as the max height, but scale down if the line would
  // overflow the stage width, so the whole note always stays on a single row.
  const fittedH = (placed: (typeof lines)[number]) => {
    // small safety factor: tilt expands each letter's box a little beyond its upright width
    const room = avail * 0.94;
    const natural = lineWidth(placed, size);
    if (natural <= room || natural <= 0) return size;
    return Math.max(20, Math.floor((size * room) / natural));
  };

  const reroll = () => {
    hapticTap();
    setSeed((s) => (s + 0x9e3779b1) >>> 0);
    setPlayKey((k) => k + 1); // remount → slam the fresh scraps back in
  };

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <SectionLabel action={<GhostButton onClick={reroll}>Re-roll</GhostButton>}>
        Playground
      </SectionLabel>

      {/* live preview */}
      <div className={`${PG_PREVIEW} aspect-[1344/620] w-full bg-[var(--bg-page)]`}>
        <div
          ref={stageRef}
          className="absolute inset-0 flex flex-col items-center justify-center gap-[3%] overflow-hidden px-[5%]"
        >
          {/* Keyed on playKey only, so Re-roll remounts → slams the fresh scraps in, while
              live typing / slider edits update the same lines in place (no replayed slam). */}
          {lines.map((placed, i) => (
            <SlammingLine key={`${playKey}-${i}`} placed={placed} lineH={fittedH(placed)} nowrap />
          ))}
        </div>
      </div>

      {/* controls */}
      <div className={PG_PANEL}>
        {/* text */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <span className={`${LABEL} shrink-0`}>Text</span>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="type a note"
            maxLength={40}
            className="h-8 min-w-0 flex-1 rounded-lg border border-[var(--border-line)] bg-[var(--bg-page)] px-3 text-[12px] text-[var(--text-primary)] outline-none transition-colors duration-150 ease-[var(--ease-out)] placeholder:text-[var(--text-tertiary)] hover:border-[var(--border-ring)] focus:border-[var(--border-ring)] sm:ml-auto sm:w-[220px] sm:flex-none"
          />
        </div>

        {/* two columns of sliders */}
        <div className="grid grid-cols-1 items-start gap-x-6 gap-y-5 sm:grid-cols-2">
          <div className="flex flex-col gap-3 self-start">
            <span className={LABEL}>Chaos</span>
            <Slider label="Tilt" value={jit.rot} min={0} max={22} step={0.5}
              format={(v) => `${v.toFixed(0)}°`} onChange={(v) => setJit((j) => ({ ...j, rot: v }))} />
            <Slider label="Bounce" value={jit.dy} min={0} max={0.2} step={0.005}
              format={(v) => v.toFixed(2)} onChange={(v) => setJit((j) => ({ ...j, dy: v }))} />
          </div>
          <div className="flex flex-col gap-3 self-start">
            <span className={LABEL}>Layout</span>
            <Slider label="Scale mix" value={jit.scale} min={0} max={0.3} step={0.01}
              format={(v) => v.toFixed(2)} onChange={(v) => setJit((j) => ({ ...j, scale: v }))} />
            <Slider label="Spacing" value={jit.gap} min={0} max={0.25} step={0.01}
              format={(v) => v.toFixed(2)} onChange={(v) => setJit((j) => ({ ...j, gap: v }))} />
            <Slider label="Size" value={size} min={40} max={120} step={1}
              format={(v) => `${v.toFixed(0)}px`} onChange={setSize} />
          </div>
        </div>
      </div>
    </div>
  );
}

