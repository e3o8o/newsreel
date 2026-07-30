# Visual prompts and source drops

Raw material for evolving newsreel beyond the weekly-report genre: prompts with
complete source for self-contained web visuals (effects, materials, reveals,
generators) that can become composable video primitives — for ads, launch
videos, demos, and anything else. Each set is pasted verbatim as provided; the
distillation into newsreel primitives lives in `analysis.md` next to this file.

Do not edit the sets in place. Append new sets at the bottom under their own
heading.

---

## Set 1 (received 2026-07-30)

1. You are given the complete source for a self-contained web visual: "Midjourney Medical's ASCII".


What it is:
- This is the [Midjourney Medical](https://www.midjourney.com) page. When it loads, a bunch of letters spin around and slowly form the Midjourney name. The cool part is that it's not a video or an image. It's all real text that the code moves around live.
- It all runs on one canvas. Each letter is drawn once and saved, then reused thousands of times, so it stays fast. Every frame the code takes text from a list of prompts and spins each letter around the center. The letters in the middle spin fast and the ones on the edges barely move, so it looks like a whirlpool. When a letter reaches the logo, it slowly turns into the right letter of the name.
- After the text is drawn, they add an old TV effect on top. The screen bends a little, the colors split at the edges, there are soft scanlines, the corners get darker, and everything gets a warm tone.

How to use this code:
- It is a React + TypeScript component tree (Next.js App Router) that renders to an HTML canvas; the entry point is the playground component.
- Drop the files into a project under the same relative paths, mount the playground component, and it runs as-is. No external assets beyond what's inline.
- To adapt it: change the resolved word/logo, the color controls, or the experiment parameters. Ask me to modify, explain, or port any part.
- Original inspiration: https://www.midjourney.com/medical

The full source follows, one file per block:

### swirl/playground.tsx

```tsx
"use client";

// An interactive rebuild of Midjourney Medical's ASCII intro, taken apart and
// re-authored as our own modules (see ./swirl): a vortex field of monospace
// cells that spins and condenses into a word, finished with a CRT post pass.
// The renderer reads a mutable config ref every frame, so controls update the
// effect live — no re-init. Below the main rebuild are a few EXPERIMENTS that
// push the same engine somewhere the original never went.

import { useEffect, useRef, useState } from "react";
import { Slider, ColorControl, SegmentedControl, GhostButton } from "./controls";
import { SectionLabel } from "../section-label";
import { useSwirlStage, DEFAULT_STAGE, type StageConfig } from "./use-swirl-stage";
import { VARIANTS } from "./resolver";
import { DEFAULT_TEXT } from "./default-text";
import { SwirlExperiments } from "./experiments";

export function SwirlPlayground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [variantId, setVariantId] = useState(VARIANTS[0].id);
  const [ink, setInk] = useState(VARIANTS[0].ink);
  const [logoColor, setLogoColor] = useState(VARIANTS[0].logo);
  const [bg, setBg] = useState(VARIANTS[0].bg);
  const [rows, setRows] = useState<string[]>(VARIANTS[0].rows);
  const [scanlines, setScanlines] = useState(0.4);
  const [aberration, setAberration] = useState(1);
  const [curvature, setCurvature] = useState(1);
  const [zoom, setZoom] = useState(VARIANTS[0].zoom);
  const [failed, setFailed] = useState(false);

  // The background prompt text is fixed; it is not user-editable.
  const cfg = useRef<StageConfig>({
    ...DEFAULT_STAGE,
    rows,
    inkStops: [ink],
    logoColor,
    bg,
    text: DEFAULT_TEXT,
    scanlines,
    aberration,
    curvature,
    zoom,
  });
  useEffect(() => {
    cfg.current = {
      ...DEFAULT_STAGE,
      rows,
      inkStops: [ink],
      logoColor,
      bg,
      text: DEFAULT_TEXT,
      scanlines,
      aberration,
      curvature,
      zoom,
    };
  }, [rows, ink, logoColor, bg, scanlines, aberration, curvature, zoom]);

  const stage = useSwirlStage(canvasRef, cfg, () => setFailed(true));

  const pickVariant = (id: string) => {
    const v = VARIANTS.find((x) => x.id === id) ?? VARIANTS[0];
    setVariantId(v.id);
    setInk(v.ink);
    setLogoColor(v.logo);
    setBg(v.bg);
    setRows(v.rows);
    setZoom(v.zoom);
    stage.current.replay();
  };

  return (
    <>
      <section className="flex min-w-0 flex-col gap-3">
        <SectionLabel
          action={!failed && <GhostButton onClick={() => stage.current.replay()}>Replay</GhostButton>}
        >
          Implementation
        </SectionLabel>

        <div
          className="relative z-10 overflow-hidden rounded-xl border border-[var(--border-line)]"
          style={{ backgroundColor: bg }}
        >
          {failed ? (
            <div className="flex aspect-[16/10] w-full items-center justify-center px-6 text-center text-[13px] text-[var(--text-tertiary)]">
              Your browser doesn&apos;t support WebGL2, so the live playground can&apos;t run here.
            </div>
          ) : (
            <canvas ref={canvasRef} className="block aspect-[16/10] w-full" />
          )}
        </div>

        {!failed && (
          <div className="-mt-5 flex min-w-0 flex-col gap-3 rounded-b-xl border border-t-0 border-[var(--border-line)] bg-[var(--bg-surface)] p-3 pt-5">
            <div className="grid grid-cols-1 items-center gap-x-4 gap-y-3 sm:grid-cols-2">
              <SegmentedControl
                options={VARIANTS.map((v) => ({ id: v.id, label: v.label }))}
                activeId={variantId}
                onPick={pickVariant}
              />
              <div className="grid grid-cols-[1fr_1fr_1.4fr] gap-0.5">
                <ColorControl label="Letters" value={ink} onChange={setInk} />
                <ColorControl label="Logo" value={logoColor} onChange={setLogoColor} />
                <ColorControl label="Background" value={bg} onChange={setBg} />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-x-4 gap-y-2.5 sm:grid-cols-2">
              <Slider label="Zoom" value={zoom} min={0.5} max={1.6} format={(v) => v.toFixed(2) + "x"} onChange={setZoom} />
              <Slider label="Scanlines" value={scanlines} min={0} max={1} format={(v) => (v * 100).toFixed(0) + "%"} onChange={setScanlines} />
              <Slider label="Aberration" value={aberration} min={0} max={3} onChange={setAberration} />
              <Slider label="Curvature" value={curvature} min={0} max={1} format={(v) => (v * 100).toFixed(0) + "%"} onChange={setCurvature} />
            </div>
          </div>
        )}
      </section>

      <SwirlExperiments />
    </>
  );
}

```

### swirl/experiments.tsx

```tsx
"use client";

// Experiments: the same vortex engine pushed past the faithful rebuild. Each is
// a small stage plus a short note on what I was trying. Always visible. The
// control panel under each stage tucks UNDER the canvas with the exact styling
// of the main playground panel (see swirl-playground.tsx): the canvas wrapper
// carries the shadow + full rounding, the panel pulls up with -mt-5 / border-t-0
// / no top radius / pt-8 so they read as one piece.

import { useEffect, useMemo, useRef, useState } from "react";
import { SectionLabel } from "../section-label";
import { SegmentedControl, Slider, ColorControl, GhostButton } from "./controls";
import { ExperimentStage } from "./experiment-stage";
import { DEFAULT_STAGE, type StageConfig, type StageEvents } from "./use-swirl-stage";
import type { WavePattern } from "./vortex-field";
import { DEFAULT_TEXT } from "./default-text";
import { renderWord, type FontStyle } from "./block-font";
import { swirlFormation, swirlChurn, swirlMove, swirlClick } from "../../lib/sound";

const BASE: StageConfig = {
  ...DEFAULT_STAGE,
  inkStops: ["#d8d8d8"],
  logoColor: "#ffffff",
  bg: "#0c0c0d",
  rows: undefined,
  word: "ARLAN",
  style: "slant",
  text: DEFAULT_TEXT,
  zoom: 0.62,
};

function Experiment({
  title,
  action,
  children,
}: {
  title: string;
  /** Optional control on the right of the title row (e.g. a Replay button). */
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold text-[var(--text-primary)]">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

// Control panel that tucks under the canvas, matching the main playground panel.
function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="-mt-5 flex min-w-0 flex-col gap-3 rounded-b-xl border border-t-0 border-[var(--border-line)] bg-[var(--bg-surface)] p-3 pt-5">
      {children}
    </div>
  );
}

/* ---------- 1. Logo generator ---------- */
const STYLES: { id: FontStyle; label: string }[] = [
  { id: "slant", label: "Slant" },
  { id: "standard", label: "Standard" },
  { id: "ogre", label: "Ogre" },
  { id: "doom", label: "Doom" },
  { id: "big", label: "Big" },
  { id: "speed", label: "Speed" },
  { id: "stop", label: "Stop" },
  { id: "subzero", label: "Sub-Zero" },
  { id: "banner", label: "Banner" },
];

// Wider/taller faces get pulled back a little so the word still fits the frame.
const STYLE_ZOOM: Partial<Record<FontStyle, number>> = {
  subzero: 0.42,
  big: 0.46,
  doom: 0.46,
  stop: 0.46,
  speed: 0.46,
};

const THEMES = [
  { id: "dark", label: "Dark" },
  { id: "light", label: "Light" },
];

// Each font carries its own accent in dark mode, so switching the face also
// switches the palette. [letters, logo]. Light mode overrides to dark-on-white.
const FONT_ACCENT: Record<FontStyle, [string, string]> = {
  slant: ["#e7e3da", "#ffffff"], // warm white
  standard: ["#8fd0ff", "#eaf6ff"], // sky blue
  ogre: ["#7fe3a3", "#e9fff0"], // green
  doom: ["#ff7a6e", "#ffeae7"], // red
  big: ["#9b8cff", "#efeaff"], // indigo
  speed: ["#ffd166", "#fff6e0"], // gold
  stop: ["#ff9ed2", "#ffeaf6"], // pink
  subzero: ["#5fe0e0", "#e6ffff"], // cyan
  banner: ["#c2f06b", "#f4ffe0"], // lime
};

function LogoGenerator() {
  const [word, setWord] = useState("MINERVA");
  const [style, setStyle] = useState<FontStyle>("slant");
  const [theme, setTheme] = useState("dark");
  const light = theme === "light";
  const [accent, logoAccent] = FONT_ACCENT[style];
  const cfg: StageConfig = {
    ...BASE,
    rows: renderWord(word || " ", style),
    zoom: STYLE_ZOOM[style] ?? 0.5,
    // light: dark text + dark logo on a near-white field; dark: the font's accent
    bg: light ? "#fcfcfc" : "#0a0a0c",
    inkStops: [light ? "#9a9a9a" : accent],
    logoColor: light ? "#1b1b1b" : logoAccent,
  };

  return (
    <Experiment
      title="Type your own logo"
    >
      <ExperimentStage config={cfg} />
      <Panel>
        <div className="flex items-stretch gap-2">
          <input
            value={word}
            onChange={(e) => setWord(e.target.value.slice(0, 14))}
            spellCheck={false}
            aria-label="Logo word"
            placeholder="type a word"
            className="h-8 min-w-0 flex-1 rounded-lg border border-[var(--border-line)] bg-[var(--bg-page)] px-3 text-[13px] uppercase tracking-wide text-[var(--text-body)] outline-none transition-colors duration-150 focus:border-[var(--border-ring)]"
          />
          <div className="w-44 shrink-0">
            <SegmentedControl options={THEMES} activeId={theme} onPick={setTheme} />
          </div>
        </div>
        <SegmentedControl options={STYLES} activeId={style} onPick={(id) => setStyle(id as FontStyle)} fill />
      </Panel>
    </Experiment>
  );
}

/* ---------- 2. Sound ---------- */
// The same engine, but wired for AUDIO: a layered synth cue rides the entrance
// (a rising sweep + a tap cascade that lands as the word forms + a low lock
// thud), and a soft churn/CRT-static drone plays while the canvas is on screen.
// All synthesized live (Web Audio, no files), gated on the global mute, first
// user gesture, and reduced-motion. See lib/sound.ts.
function SoundSwirl() {
  const cfg: StageConfig = {
    ...BASE,
    word: "SOUND",
    zoom: 0.62,
    inkStops: ["#cfe0ff"],
    logoColor: "#ffffff",
    bg: "#070a12",
  };

  // the churn drone, started/stopped by visibility; kept in a ref so re-renders
  // don't restart it
  const churn = useRef<{ stop: () => void } | null>(null);
  const reduced = useRef(false);
  useEffect(() => {
    reduced.current =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    return () => churn.current?.stop();
  }, []);

  const restartChurn = () => {
    churn.current?.stop();
    churn.current = reduced.current ? null : swirlChurn();
  };

  const events: StageEvents = useMemo(
    () => ({
      onFormationStart: () => {
        if (!reduced.current) swirlFormation();
      },
      onVisible: (visible) => {
        if (visible && !reduced.current) {
          if (!churn.current) churn.current = swirlChurn();
        } else {
          churn.current?.stop();
          churn.current = null;
        }
      },
      // cursor over the letters → a soft tick that pitches up with speed
      onPointerMove: (speed) => {
        if (!reduced.current) swirlMove(speed);
      },
      // click / shockwave → an impact thud
      onPointerDown: () => {
        if (!reduced.current) swirlClick();
      },
    }),
    [],
  );

  // bumping this replays the entrance (and re-fires the entrance sound, since
  // onFormationStart runs on every (re)start)
  const [replay, setReplay] = useState(0);
  const onReplay = () => {
    setReplay((n) => n + 1); // restarts the visual + the entrance sound
    restartChurn(); // and the ambient bed, so EVERYTHING restarts together
  };

  return (
    <Experiment
      title="The same swirl, with sound"
      action={<GhostButton onClick={onReplay}>Replay</GhostButton>}
    >
      <ExperimentStage
        config={cfg}
        events={events}
        replayKey={replay}
        trackPointer
        burstOnClick
      />
    </Experiment>
  );
}

/* ---------- 3. Cursor trail ---------- */
function CursorTrail() {
  // its own warm-coral palette; dragging lights a hot white-gold trail that
  // churns the soup into the vortex and lingers
  const cfg: StageConfig = {
    ...BASE,
    trail: true,
    trailStrength: 1.6,
    trailFlare: "#fff1c2",
    word: "TRACE",
    zoom: 0.62,
    inkStops: ["#ff7a55"],
    logoColor: "#fff0ea",
    bg: "#160604",
  };
  return (
    <Experiment
      title="Drag a trail through the letters"
    >
      <ExperimentStage config={cfg} trackPointer />
    </Experiment>
  );
}

/* ---------- 4. Flowing multi-stop gradient ---------- */
// Default is ONE color living through its own shades: a single hue ramped from
// deep to bright and back, so it reads as a rich, breathing teal rather than a
// rainbow. The per-letter drift + speed brightness already baked into the field
// turn that one hue into something with real depth.
const MONO_RAMP = ["#0a3d3a", "#13807a", "#2fd4c4", "#9ff5ec", "#13807a"];

function GradientInk() {
  const [stops, setStops] = useState<string[]>(MONO_RAMP);
  const [angle, setAngle] = useState(0.4);
  const [flow, setFlow] = useState(0.06);

  const setStop = (i: number, v: string) =>
    setStops((s) => s.map((c, k) => (k === i ? v : c)));

  const cfg: StageConfig = {
    ...BASE,
    word: "FLOW",
    zoom: 0.55,
    gradient: true,
    inkStops: stops,
    gradientAngle: angle * Math.PI * 2,
    gradientFlow: flow,
    bg: "#08080b",
  };

  return (
    <Experiment
      title="Letters that flow through colors"
    >
      <ExperimentStage config={cfg} />
      <Panel>
        <div className="grid grid-cols-5 gap-1">
          {stops.map((c, i) => (
            <ColorControl key={i} label={`${i + 1}`} value={c} onChange={(v) => setStop(i, v)} />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-x-4 gap-y-2.5 sm:grid-cols-2">
          <Slider label="Angle" value={angle} min={0} max={1} format={(v) => (v * 360).toFixed(0) + "°"} onChange={setAngle} />
          <Slider label="Flow" value={flow} min={0} max={0.4} format={(v) => (v * 100).toFixed(0) + "%"} onChange={setFlow} />
        </div>
      </Panel>
    </Experiment>
  );
}

/* ---------- 5. Shockwaves + sustained wave patterns ---------- */
const PATTERNS = [
  { id: "wavefront", label: "Wavefront" },
  { id: "ripples", label: "Ripples" },
  { id: "flow", label: "Flow" },
  { id: "cloth", label: "Cloth" },
];

// Each pattern gets its own bold palette so switching feels like a mood change.
const WAVE_PALETTE: Record<WavePattern, { ink: string; logo: string; bg: string }> = {
  wavefront: { ink: "#7fb8ff", logo: "#eaf3ff", bg: "#040a1a" }, // ocean blue
  ripples: { ink: "#4fe3d0", logo: "#e6fffb", bg: "#021414" }, // teal
  flow: { ink: "#d98cff", logo: "#f7ebff", bg: "#10031a" }, // magenta / violet
  cloth: { ink: "#ffc266", logo: "#fff4e0", bg: "#1a0f02" }, // amber
};

function ClickShock() {
  const [turbulence, setTurbulence] = useState(0.35);
  const [pattern, setPattern] = useState<WavePattern>("wavefront");
  const pal = WAVE_PALETTE[pattern];
  const cfg: StageConfig = {
    ...BASE,
    shock: true,
    turbulence,
    wavePattern: pattern,
    word: "WAVES",
    zoom: 0.62,
    inkStops: [pal.ink],
    logoColor: pal.logo,
    bg: pal.bg,
  };
  return (
    <Experiment
      title="Click for a wave, or leave it churning"
    >
      <ExperimentStage config={cfg} burstOnClick replayKey={pattern} />
      <Panel>
        <SegmentedControl options={PATTERNS} activeId={pattern} onPick={(id) => setPattern(id as WavePattern)} />
        <Slider label="Strength" value={turbulence} min={0} max={1} format={(v) => (v * 100).toFixed(0) + "%"} onChange={setTurbulence} />
      </Panel>
    </Experiment>
  );
}

export function SwirlExperiments() {
  return (
    <section className="mt-12 flex min-w-0 flex-col gap-6">
      <SectionLabel>Experiments</SectionLabel>
      <p className="-mt-3 text-[15px] leading-[1.7] text-[var(--text-secondary)]">
        A few things I added on top, just to see how far the same idea would go.
      </p>
      {/* each experiment after the first is set off by a hairline divider with
          generous spacing, so they read as distinct sections */}
      <div className="flex min-w-0 flex-col [&>*:not(:first-child)]:mt-14 [&>*:not(:first-child)]:border-t [&>*:not(:first-child)]:border-[var(--border-line)] [&>*:not(:first-child)]:pt-14">
        <LogoGenerator />
        <SoundSwirl />
        <CursorTrail />
        <GradientInk />
        <ClickShock />
      </div>
    </section>
  );
}

```

### swirl/controls.tsx

```tsx
"use client";

// Minimalist, site-styled controls for the swirl playground. Native color
// dialog / range chrome is replaced with our own so the panel matches the rest
// of the page (thin lines, soft grays, the site font) and reads as one system.
// The color control's anatomy (swatch trigger -> popover with a hue slider, a
// hex field and quick presets) is adapted from HeroUI's ColorPicker.

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { hapticTap } from "../../lib/haptics";
import { hoverLink } from "../../lib/sound";

const LABEL = "text-[12px] text-[var(--text-tertiary)]";

// ── Shared playground shell ─────────────────────────────────────────────────
// One connected card: a fully-rounded preview box with the control panel tucked
// underneath via a deep negative-margin overlap (the panel slides up under the
// preview's rounded bottom so they read as a single card). Matched to the vector
// editor; used by every Vault playground so their roundings are identical.
// PANEL_PAD covers the overlap so the first control row clears the seam.
export const PG_PREVIEW =
  "relative z-10 overflow-hidden rounded-xl border border-[var(--border-line)] bg-[var(--bg-hover)]";
export const PG_PANEL =
  "-mt-5 flex min-w-0 flex-col gap-4 rounded-b-xl border border-t-0 border-[var(--border-line)] bg-[var(--bg-surface)] p-4 pt-8";

/* ---------- Segmented control (variant picker) ---------- */
// One pill container with a sliding white indicator behind the active segment —
// the same sliding-pill language as the code tabs, so the panel reads cohesive.
export function SegmentedControl({
  options,
  activeId,
  onPick,
  fill = false,
}: {
  options: { id: string; label: string }[];
  activeId: string;
  onPick: (id: string) => void;
  /** Distribute segments to fill the row evenly when there's space, but never
   *  shrink a label below its text — so on a narrow screen the row scrolls
   *  horizontally instead of forcing the page wider. */
  fill?: boolean;
}) {
  const rowRef = useRef<HTMLDivElement>(null);
  const segRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [pill, setPill] = useState<{ x: number; w: number } | null>(null);
  const activeIndex = Math.max(
    0,
    options.findIndex((o) => o.id === activeId),
  );

  useLayoutEffect(() => {
    const el = segRefs.current[activeIndex];
    if (!el) return;
    setPill({ x: el.offsetLeft, w: el.offsetWidth });
  }, [activeIndex, options.length]);

  useEffect(() => {
    const row = rowRef.current;
    if (!row || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      const el = segRefs.current[activeIndex];
      if (el) setPill({ x: el.offsetLeft, w: el.offsetWidth });
    });
    ro.observe(row);
    return () => ro.disconnect();
  }, [activeIndex]);

  return (
    <div
      ref={rowRef}
      role="tablist"
      aria-label="Variant"
      className="swirl-tabscroll relative flex h-8 w-full items-stretch gap-0 overflow-x-auto rounded-lg border border-[var(--border-line)] bg-[var(--bg-page)] p-0.5"
    >
      {pill && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0.5 rounded-md border border-[var(--border-line)] bg-[var(--bg-hover)]"
          style={{
            transform: `translateX(${pill.x - 2}px)`,
            width: pill.w,
            transition:
              "transform 0.34s var(--ease-out), width 0.34s var(--ease-out)",
          }}
        />
      )}
      {options.map((o, i) => {
        const active = o.id === activeId;
        return (
          <button
            key={o.id}
            ref={(el) => {
              segRefs.current[i] = el;
            }}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => {
              hapticTap();
              onPick(o.id);
            }}
            onPointerEnter={hoverLink}
            className={`relative z-10 flex items-center justify-center whitespace-nowrap rounded-md px-2 py-1 text-[12px] transition-colors duration-150 ease-[var(--ease-out)] ${
              fill ? "flex-1 basis-0 [min-width:fit-content]" : "flex-1"
            } ${
              active
                ? "text-[var(--text-primary)]"
                : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ---------- Select (dropdown) ---------- */
// A site-styled select: a pill trigger (same border / radius / 12px text as the
// segmented control and theme toggle) with a chevron, opening a popover of
// options that share the sliding-pill's hover + active treatment. Used where a
// segmented row would be too many options to fit (e.g. the 9 fonts).
export function Select({
  options,
  activeId,
  onPick,
  ariaLabel,
}: {
  options: { id: string; label: string }[];
  activeId: string;
  onPick: (id: string) => void;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const active = options.find((o) => o.id === activeId);

  // close on outside click / Escape (same pattern as ColorControl)
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative flex shrink-0">
      <button
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => {
          hapticTap();
          setOpen((o) => !o);
        }}
        onPointerEnter={hoverLink}
        className="flex h-8 w-full items-center justify-between gap-1.5 rounded-lg border border-[var(--border-line)] bg-[var(--bg-page)] pl-3 pr-2.5 text-[12px] text-[var(--text-primary)] transition-colors duration-150 ease-[var(--ease-out)] hover:border-[var(--border-ring)]"
      >
        <span className="whitespace-nowrap">{active?.label ?? "Select"}</span>
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          aria-hidden="true"
          className={`shrink-0 text-[var(--text-tertiary)] transition-transform duration-150 ease-[var(--ease-out)] ${open ? "rotate-180" : ""}`}
        >
          <path d="M2 3.5 5 6.5 8 3.5" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute right-0 top-full z-50 mt-2 flex max-h-64 w-40 flex-col gap-0.5 overflow-y-auto rounded-xl border border-[var(--border-ring)] bg-[var(--bg-surface)] p-1 shadow-[0_1px_2px_rgba(17,24,39,0.06),0_8px_24px_rgba(17,24,39,0.08)]"
          style={{ animation: "swirl-pop 0.16s var(--ease-expo)" }}
        >
          {options.map((o) => {
            const isActive = o.id === activeId;
            return (
              <button
                key={o.id}
                type="button"
                role="option"
                aria-selected={isActive}
                onClick={() => {
                  hapticTap();
                  onPick(o.id);
                  setOpen(false);
                }}
                onPointerEnter={hoverLink}
                className={`rounded-md px-2.5 py-1.5 text-left text-[12px] transition-colors duration-150 ease-[var(--ease-out)] ${
                  isActive
                    ? "bg-[var(--bg-page)] text-[var(--text-primary)]"
                    : "text-[var(--text-secondary)] hover:bg-[var(--bg-page)] hover:text-[var(--text-primary)]"
                }`}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------- Slider ---------- */
// Row slider: the whole row is the track (fill grows from the left), label sits
// left + value right, with a thin handle riding the fill edge. Drag anywhere on
// the row, click to snap, or arrow-key when focused.
const CLICK_THRESHOLD = 3; // px — distinguishes a click from a drag

export function Slider({
  label,
  value,
  min,
  max,
  step = 0.01,
  format,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  format?: (v: number) => string;
  onChange: (v: number) => void;
}) {
  const rowRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const down = useRef<{ x: number; moved: boolean } | null>(null);

  const pct = max === min ? 0 : ((value - min) / (max - min)) * 100;
  const snap = (v: number) => {
    const snapped = Math.round(v / step) * step;
    const clamped = Math.min(Math.max(snapped, min), max);
    // round float dust from the step division
    return parseFloat(clamped.toPrecision(12));
  };
  const valueFromX = (clientX: number) => {
    const r = rowRef.current!.getBoundingClientRect();
    const t = (clientX - r.left) / r.width;
    return snap(min + t * (max - min));
  };

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    down.current = { x: e.clientX, moved: false };
    setDragging(true);
    hapticTap();
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging || !down.current) return;
    if (Math.abs(e.clientX - down.current.x) > CLICK_THRESHOLD) down.current.moved = true;
    onChange(valueFromX(e.clientX));
  };
  const endDrag = (e: React.PointerEvent) => {
    if (!down.current) return;
    if (!down.current.moved) onChange(valueFromX(e.clientX)); // click-to-snap
    down.current = null;
    setDragging(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      e.preventDefault();
      onChange(snap(value - step));
    } else if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      e.preventDefault();
      onChange(snap(value + step));
    }
  };

  return (
    <label className="flex min-w-[9rem] flex-1 flex-col">
      <div
        ref={rowRef}
        role="slider"
        tabIndex={0}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-label={label}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerEnter={hoverLink}
        onKeyDown={onKeyDown}
        className="relative flex h-8 w-full cursor-pointer touch-none select-none items-center overflow-hidden rounded-lg border border-[var(--border-line)] bg-[var(--bg-page)] outline-none ring-[var(--border-ring)] focus-visible:ring-1"
      >
        {/* fill — a light gray wash so the level reads against the white track */}
        <span
          className="pointer-events-none absolute inset-y-0 left-0 bg-[var(--bg-hover)]"
          style={{ width: `${pct}%` }}
        />
        {/* handle on the fill edge */}
        <span
          className={`pointer-events-none absolute top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-full bg-[var(--text-primary)] transition-opacity duration-150 ${
            dragging ? "opacity-90" : "opacity-40"
          }`}
          style={{ left: `max(3px, calc(${pct}% - 1.5px))` }}
        />
        <span className="pointer-events-none relative z-10 pl-3 text-[12px] text-[var(--text-secondary)]">
          {label}
        </span>
        <span className="pointer-events-none relative z-10 ml-auto mr-3 text-[12px] tabular-nums text-[var(--text-secondary)]">
          {format ? format(value) : value.toFixed(2)}
        </span>
      </div>
    </label>
  );
}

/* ---------- Color helpers ---------- */
function hexToHsl(hex: string): [number, number, number] {
  let h = hex.replace("#", "").trim();
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let s = 0;
  let hue = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) hue = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) hue = (b - r) / d + 2;
    else hue = (r - g) / d + 4;
    hue *= 60;
  }
  return [Math.round(hue), Math.round(s * 100), Math.round(l * 100)];
}
function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) =>
    l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const to = (n: number) =>
    Math.round(255 * f(n))
      .toString(16)
      .padStart(2, "0");
  return `#${to(0)}${to(8)}${to(4)}`;
}
const isHex = (s: string) => /^#?[0-9a-fA-F]{6}$/.test(s.trim());
const normHex = (s: string) => {
  const v = s.trim().replace(/^#?/, "");
  return `#${v.toLowerCase()}`;
};

const PRESET_SWATCHES = [
  "#ffffff", "#d8d8d8", "#9b9b9b", "#1b1b1b", "#0b1733",
  "#e88f00", "#2ee06a", "#3b82f6", "#a855f7", "#f7d8e3",
];

/* ---------- Color control (swatch trigger + popover) ---------- */
export function ColorControl({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [h, s, l] = hexToHsl(value);
  const [hexDraft, setHexDraft] = useState(value);

  useEffect(() => setHexDraft(value), [value]);

  // close on outside click / Escape
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node))
        setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const setHue = (hue: number) => onChange(hslToHex(hue, s || 70, l || 50));

  return (
    <div ref={wrapRef} className="relative flex w-full min-w-0">
      <button
        type="button"
        onClick={() => {
          hapticTap();
          setOpen((o) => !o);
        }}
        onPointerEnter={hoverLink}
        aria-label={`${label}: ${value}`}
        aria-expanded={open}
        className={`group flex h-8 w-full min-w-0 items-center gap-1.5 rounded-lg border border-[var(--border-line)] bg-[var(--bg-page)] px-2.5 transition-colors duration-150 ease-[var(--ease-out)] hover:border-[var(--border-ring)] ${
          label ? "" : "justify-center"
        }`}
      >
        {label && <span className={`${LABEL} truncate`}>{label}</span>}
        <span
          aria-hidden="true"
          className={`h-4 w-4 shrink-0 rounded-[5px] border border-[var(--border-ring)] transition-transform duration-150 ease-[var(--ease-out)] group-active:scale-[0.96] ${
            label ? "ml-auto" : ""
          }`}
          style={{ backgroundColor: value }}
        />
      </button>

      {open && (
        <div
          className="absolute left-0 top-full z-50 mt-2 flex w-56 flex-col gap-3 rounded-xl border border-[var(--border-ring)] bg-[var(--bg-surface)] p-3 shadow-[0_1px_2px_rgba(17,24,39,0.06),0_8px_24px_rgba(17,24,39,0.08)]"
          style={{ animation: "swirl-pop 0.16s var(--ease-expo)" }}
        >
          {/* hue slider */}
          <span className="hue-track relative flex h-4 items-center">
            <span
              className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.15)]"
              style={{ left: `${(h / 360) * 100}%`, backgroundColor: value }}
            />
            <input
              type="range"
              min={0}
              max={360}
              step={1}
              value={h}
              onChange={(e) => setHue(+e.target.value)}
              onPointerDown={hapticTap}
              aria-label={`${label} hue`}
              className="swirl-range relative z-10 h-4 w-full cursor-pointer appearance-none bg-transparent"
            />
          </span>

          {/* hex field */}
          <input
            type="text"
            value={hexDraft}
            spellCheck={false}
            onChange={(e) => {
              setHexDraft(e.target.value);
              if (isHex(e.target.value)) onChange(normHex(e.target.value));
            }}
            onBlur={() => setHexDraft(value)}
            aria-label={`${label} hex`}
            className="w-full rounded-md border border-[var(--border-line)] bg-[var(--bg-page)] px-2 py-1 font-mono text-[12px] lowercase text-[var(--text-body)] outline-none transition-colors duration-150 focus:border-[var(--border-ring)]"
          />

          {/* preset swatches */}
          <div className="grid grid-cols-5 gap-1.5">
            {PRESET_SWATCHES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => {
                  hapticTap();
                  onChange(c);
                }}
                onPointerEnter={hoverLink}
                aria-label={c}
                className={`h-6 w-full rounded-md border transition-transform duration-150 ease-[var(--ease-out)] active:scale-[0.96] ${
                  c.toLowerCase() === value.toLowerCase()
                    ? "border-[var(--text-primary)]"
                    : "border-[var(--border-ring)]"
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Auto-growing prompt input ---------- */
export function PromptInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [max] = useState(132);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, max)}px`;
  }, [value, max]);

  return (
    <label className="flex flex-col gap-1.5">
      <span className={LABEL}>{label}</span>
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onPointerEnter={hoverLink}
        spellCheck={false}
        rows={2}
        className="w-full resize-none overflow-y-auto overscroll-none rounded-lg border border-[var(--border-line)] bg-[var(--bg-page)] px-3 py-2 text-[12px] leading-[1.55] text-[var(--text-body)] outline-none transition-colors duration-150 focus:border-[var(--border-ring)]"
        style={{ maxHeight: max } as CSSProperties}
      />
    </label>
  );
}

/* ---------- Ghost button (panel actions) ---------- */
// Matches the Copy button / code-tab pill language: hairline border, anchored
// surface, hover darkens the border (never dissolves into the panel).
export function GhostButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        hapticTap();
        onClick();
      }}
      onPointerEnter={hoverLink}
      className="inline-flex h-7 shrink-0 items-center self-start rounded-lg border border-[var(--border-line)] bg-[var(--bg-surface)] px-3 text-[12px] font-medium text-[var(--text-secondary)] transition-colors duration-150 ease-[var(--ease-out)] hover:bg-[var(--bg-hover)] hover:border-[var(--border-ring)] hover:text-[var(--text-primary)] active:scale-[0.98]"
    >
      {children}
    </button>
  );
}

```

### swirl/use-swirl-stage.ts

```ts
// One React hook that mounts the whole pipeline onto a <canvas> and runs the
// frame loop, reading a mutable config ref every frame so controls update the
// effect live (no re-init). Both the main playground and each experiment use
// this — they just feed it a different StageConfig.
//
// Interaction state (the spring-smoothed cursor bend, the velocity smoothing,
// and the click shockwave pool) lives HERE, per frame; the per-cell math that
// consumes it lives in vortex-field. The split keeps the hot loop pure.

import { useEffect, useRef, type RefObject } from "react";
import { buildAtlas, type GlyphAtlas } from "./glyph-atlas";
import { createRenderer, type Renderer } from "./renderer";
import { hexToRgb01 } from "./color";
import {
  composeField,
  makeBuffers,
  makeTarget,
  type FieldBuffers,
  type FieldGrid,
  type InkMode,
  type InkPaint,
  type Shock,
  type Target,
  type WavePattern,
} from "./vortex-field";
import { depositTrail, makeTrailField, stepTrail } from "./trail-field";
import { renderWord, type FontStyle } from "./block-font";

export interface StageConfig {
  /** Pre-baked ASCII rows for the named presets (takes priority over word). */
  rows?: string[];
  /** Live word for the logo generator (used when `rows` is absent). */
  word?: string;
  style?: FontStyle;
  /** Gradient color stops (hex). One stop = flat fill. */
  inkStops: string[];
  /** Color of the resolved logo word (hex), independent of the swirl letters. */
  logoColor: string;
  gradient: boolean;
  gradientAngle: number; // radians
  /** Gradient band drift speed (cycles/sec). 0 = static gradient. */
  gradientFlow: number;
  /** How the stops map onto the field. Defaults to "rows" (color swirls with
   *  the letters); "axis" is the old flat screen-space gradient. */
  gradientMode?: InkMode;
  bg: string;
  text: string;
  scanlines: number;
  aberration: number;
  curvature: number;
  zoom: number;
  /** Enable the persistent cursor trail (wake + local swirl-up). */
  trail: boolean;
  /** Trail intensity multiplier (1 = default). */
  trailStrength?: number;
  /** Hex color hot trail cells glow toward; omit for no color flare. */
  trailFlare?: string;
  /** Enable click shockwaves. */
  shock: boolean;
  /** Sustained ambient ripple, 0..1 (a permanent churning wave). */
  turbulence: number;
  /** Which ambient wave shape to use. */
  wavePattern: WavePattern;
}

export const DEFAULT_STAGE: Omit<StageConfig, "rows" | "word" | "style" | "bg" | "zoom" | "inkStops" | "logoColor"> = {
  gradient: false,
  gradientAngle: 0,
  gradientFlow: 0,
  text: "",
  scanlines: 0.4,
  aberration: 1,
  curvature: 1,
  trail: false,
  shock: false,
  turbulence: 0,
  wavePattern: "wavefront",
};

// Rows of glyphs down the canvas = BASE_ROWS / zoom. Smaller zoom → more, smaller
// cells → more words fit. Driven by the Zoom control.
const BASE_ROWS = 22;
// spring rate for the bend (1/time-constant); ~100ms half-life
// velocity smoothing rate
const VEL_SMOOTH = 5.0;
// shockwaves older than this (seconds) are retired
const SHOCK_LIFE = 2.4;

export interface StageHandle {
  /** Restart the formation so the word condenses from scratch. */
  replay: () => void;
  /** Set the pointer in normalized coords (-1..1); null = pointer left. */
  setPointer: (p: { x: number; y: number } | null) => void;
  /** Spawn a click shockwave at normalized coords (-1..1). */
  burst: (x: number, y: number) => void;
}

function resolveTarget(c: StageConfig): Target {
  if (c.rows && c.rows.length) return makeTarget(c.rows);
  return makeTarget(renderWord(c.word ?? " ", c.style ?? "slant"));
}

function targetKey(c: StageConfig): string {
  return c.rows ? "rows:" + c.rows.join("|") : `word:${c.word}:${c.style}`;
}

export interface StageEvents {
  /** The entrance (re)started — soup begins condensing into the word. */
  onFormationStart?: () => void;
  /** The word has fully formed (formation reached ~1). Fires once per entrance. */
  onSettle?: () => void;
  /** Visibility changed (canvas entered/left the on-screen play band). */
  onVisible?: (visible: boolean) => void;
  /** The very first frame has been drawn (canvas now has real content). */
  onFirstFrame?: () => void;
  /** Pointer moved over the canvas; `speed` is 0..1 (normalized units/frame). */
  onPointerMove?: (speed: number) => void;
  /** Pointer pressed on the canvas (e.g. for a click sound). */
  onPointerDown?: () => void;
}

export function useSwirlStage(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  cfgRef: RefObject<StageConfig>,
  onFail: () => void,
  eventsRef?: RefObject<StageEvents>,
): RefObject<StageHandle> {
  const handle = useRef<StageHandle>({ replay: () => {}, setPointer: () => {}, burst: () => {} });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const r: Renderer | null = createRenderer(canvas);
    if (!r) {
      onFail();
      return;
    }
    const { gl } = r;
    const { round, max, floor } = Math;

    // Glyph set: printable ASCII + whatever box/block chars the fonts use.
    const glyphs: string[] = [];
    const lookup: Record<string, number> = Object.create(null);
    const addGlyph = (cc: string) => {
      if (lookup[cc] !== undefined) return;
      lookup[cc] = glyphs.length;
      glyphs.push(cc);
    };
    // printable ASCII covers most styles + anything the user types; the full
    // block is for the Banner face
    for (let code = 32; code <= 126; code++) addGlyph(String.fromCharCode(code));
    for (const cc of "█▓") addGlyph(cc);
    addGlyph(" ");
    const spaceSlot = lookup[" "];
    const slotOf = (cc: string, weight: number) => {
      const i = lookup[cc];
      return weight * glyphs.length + (i === undefined ? spaceSlot : i);
    };

    let source: string[] = cfgRef.current.text.split("\n").map((e) => e.replace(/\t/g, "    "));
    let lastText = cfgRef.current.text;

    let target: Target = resolveTarget(cfgRef.current);
    let lastTargetKey = targetKey(cfgRef.current);
    let lastZoom = cfgRef.current.zoom;

    let atlas: GlyphAtlas | null = null;
    let grid: FieldGrid | null = null;
    let buffers: FieldBuffers | null = null;
    let lastCw = -1;
    let lastCh = -1;

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => {
        lastCw = -1;
        lastCh = -1;
      });
      ro.observe(canvas);
    }

    // ── play only while roughly centered on screen ──
    // The rAF loop runs only when the canvas is near the vertical middle of the
    // viewport; offscreen it stops entirely (zero per-frame work). Each time it
    // re-enters, the entrance replays so the word condenses in as you scroll to
    // it. rootMargin shrinks the trigger band to the middle ~30% of the screen.
    let visible = true;
    let io: IntersectionObserver | null = null;

    // ── interaction state (per frame) ──
    const pointer = { x: 0, y: 0, active: false };
    const trail = makeTrailField();
    let velX = 0; // smoothed pointer velocity (normalized units / sec)
    let velY = 0;
    let prevPx = 0;
    let prevPy = 0;
    let havePrev = false;
    const shocks: Shock[] = [];

    function rebuild(cw: number, ch: number) {
      const c = cfgRef.current;
      const rows = max(8, round(BASE_ROWS / max(0.3, c.zoom)));
      atlas = buildAtlas(gl, r!.glyphTex, r!.scratch, glyphs, max(8, round(ch / rows)));
      const gridRows = max(target.rows.length, Math.ceil(ch / atlas.inkSize) + 1);
      const contentH = gridRows * atlas.inkSize;
      const cols = floor(cw / atlas.advance);
      grid = {
        cols,
        rows: gridRows,
        inkSize: atlas.inkSize,
        vOffset: round((ch - contentH) / 2),
        targetX: max(0, round((cols - (target.rows[0]?.length ?? 0)) / 2)),
        targetY: max(0, round((gridRows - target.rows.length) / 2)),
      };
      buffers = makeBuffers(gridRows * cols);
      r!.allocCells(buffers);
      r!.resizeTargets(cw, ch);
    }

    let startTime = 0;
    let prevTime = 0;
    let raf = 0;
    let settled = false; // has onSettle fired for the current entrance
    let firstFramePainted = false; // has the canvas drawn its first frame
    // seconds until the word is fully formed — matches FORMATION_SEC in
    // vortex-field (the formation easeOutQuad is ~done by then)
    const FORMATION_SETTLE_SEC = 1.8;

    // (re)start the loop, resetting timing so the first frame after a pause
    // doesn't compute a giant dt from the time spent offscreen.
    function startLoop() {
      if (raf !== 0) return;
      prevTime = 0;
      raf = requestAnimationFrame(frame);
    }
    function stopLoop() {
      if (raf !== 0) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    }

    handle.current = {
      replay: () => {
        startTime = 0;
      },
      setPointer: (p) => {
        if (p) {
          pointer.x = p.x;
          pointer.y = p.y;
          pointer.active = true;
        } else {
          pointer.active = false;
        }
      },
      burst: (x, y) => {
        shocks.push({ x, y, age: 0 });
        if (shocks.length > 4) shocks.shift();
      },
    };

    function frame(time: number) {
      const c = cfgRef.current;
      if (c.text !== lastText) {
        lastText = c.text;
        source = c.text.split("\n").map((e) => e.replace(/\t/g, "    "));
        lastCw = -1;
      }
      const tk = targetKey(c);
      if (tk !== lastTargetKey) {
        lastTargetKey = tk;
        target = resolveTarget(c);
        lastCw = -1;
        startTime = 0; // re-run the entrance so the new word condenses in
      }
      if (c.zoom !== lastZoom) {
        lastZoom = c.zoom;
        lastCw = -1;
      }

      const rect = canvas!.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const cw = round(rect.width * dpr);
      const ch = round(rect.height * dpr);
      if (cw > 0 && ch > 0 && (cw !== lastCw || ch !== lastCh)) {
        rebuild(cw, ch);
        lastCw = cw;
        lastCh = ch;
      }

      if (grid && atlas && buffers) {
        if (startTime === 0) {
          startTime = time;
          settled = false; // a fresh entrance is beginning
          eventsRef?.current?.onFormationStart?.();
        }
        if (prevTime === 0) prevTime = time; // first frame after a (re)start
        const elapsed = time - startTime;
        const dt = Math.min(0.05, Math.max(0.001, (time - prevTime) / 1000));
        prevTime = time;

        // fire onSettle once the word has fully formed (formation ~1)
        if (!settled && elapsed * 0.001 >= FORMATION_SETTLE_SEC) {
          settled = true;
          eventsRef?.current?.onSettle?.();
        }

        // ── persistent cursor trail: deposit at the pointer, then decay+diffuse ──
        if (c.trail) {
          if (pointer.active) {
            const vSp = 1 - Math.exp(-VEL_SMOOTH * dt);
            if (havePrev) {
              const instVx = (pointer.x - prevPx) / dt;
              const instVy = (pointer.y - prevPy) / dt;
              velX += (instVx - velX) * vSp;
              velY += (instVy - velY) * vSp;
            }
            prevPx = pointer.x;
            prevPy = pointer.y;
            havePrev = true;
            depositTrail(trail, pointer.x, pointer.y, velX, velY, dt);
          } else {
            havePrev = false;
            velX *= 1 - (1 - Math.exp(-VEL_SMOOTH * dt));
            velY *= 1 - (1 - Math.exp(-VEL_SMOOTH * dt));
          }
          stepTrail(trail, dt);
        }

        // ── age + retire shockwaves ──
        if (shocks.length) {
          for (let i = 0; i < shocks.length; i++) shocks[i].age += dt;
          for (let i = shocks.length - 1; i >= 0; i--) {
            if (shocks[i].age > SHOCK_LIFE) shocks.splice(i, 1);
          }
        }

        const stops = (c.gradient ? c.inkStops : c.inkStops.slice(0, 1)).map(hexToRgb01);
        const paint: InkPaint = {
          stops: stops.length ? (stops as [number, number, number][]) : [[1, 1, 1]],
          angle: c.gradientAngle,
          flow: c.gradient ? (elapsed * 0.001 * c.gradientFlow) : 0,
          gradient: c.gradient && stops.length > 1,
          mode: c.gradientMode ?? "rows",
        };
        const bg = hexToRgb01(c.bg);
        const count = composeField({
          grid,
          atlas,
          buffers,
          source: source.length ? source : [""],
          target,
          elapsed,
          paint,
          logo: hexToRgb01(c.logoColor),
          slotOf,
          trail: c.trail ? trail : undefined,
          trailStrength: c.trailStrength,
          trailFlare: c.trailFlare ? hexToRgb01(c.trailFlare) : undefined,
          shocks: c.shock && shocks.length ? shocks : undefined,
          turbulence: c.turbulence,
          wavePattern: c.wavePattern,
        });
        r!.drawField(count, grid, buffers, bg);
        r!.drawCrt(elapsed * 0.001, cw, ch, {
          scanline: c.scanlines,
          aberration: c.aberration,
          curvature: c.curvature,
          bg,
        });
        if (!firstFramePainted) {
          firstFramePainted = true;
          eventsRef?.current?.onFirstFrame?.();
        }
      }
      raf = 0;
      if (visible) raf = requestAnimationFrame(frame); // stop entirely if offscreen
    }

    if (typeof IntersectionObserver !== "undefined") {
      io = new IntersectionObserver(
        ([entry]) => {
          const nowVisible = entry.isIntersecting;
          if (nowVisible && !visible) {
            visible = true;
            startTime = 0; // replay the entrance each time it scrolls into the middle
            startLoop();
            eventsRef?.current?.onVisible?.(true);
          } else if (!nowVisible && visible) {
            visible = false;
            stopLoop();
            eventsRef?.current?.onVisible?.(false);
          }
        },
        // only "in view" when the canvas is near the vertical middle of the
        // screen: shrink the viewport's effective top/bottom by 35% each.
        { threshold: 0, rootMargin: "-35% 0px -35% 0px" },
      );
      io.observe(canvas);
      // Start hidden until the observer reports; the first callback fires async.
      visible = false;
    } else {
      startLoop();
    }

    return () => {
      stopLoop();
      ro?.disconnect();
      io?.disconnect();
      r.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return handle;
}

```

### swirl/renderer.ts

```ts
// The WebGL2 plumbing: compile both programs, allocate the buffers and the
// offscreen framebuffer, and expose two draw calls — drawField (instanced text
// into the FBO) and drawCrt (the post pass to the screen). The React component
// drives this; none of the per-frame math lives here.

import { CRT_VERT, CRT_FRAG, TEXT_VERT, TEXT_FRAG } from "./crt-pass";
import type { FieldBuffers, FieldGrid } from "./vortex-field";

export interface Renderer {
  gl: WebGL2RenderingContext;
  glyphTex: WebGLTexture;
  scratch: HTMLCanvasElement;
  resizeTargets: (cw: number, ch: number) => void;
  allocCells: (buffers: FieldBuffers) => void;
  drawField: (
    count: number,
    grid: FieldGrid,
    buffers: FieldBuffers,
    bg: [number, number, number],
  ) => void;
  drawCrt: (
    elapsedSec: number,
    cw: number,
    ch: number,
    uniforms: { scanline: number; aberration: number; curvature: number; bg: [number, number, number] },
  ) => void;
  dispose: () => void;
}

/** Returns null if WebGL2 / 2D context / shader compile fails. */
export function createRenderer(canvas: HTMLCanvasElement): Renderer | null {
  const gl = canvas.getContext("webgl2", { alpha: true, antialias: false, depth: false });
  if (!gl) return null;
  gl.disable(gl.DEPTH_TEST);

  const scratch = document.createElement("canvas");
  if (!scratch.getContext("2d")) return null;

  let ok = true;
  const compile = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error("swirl shader compile failed:", gl.getShaderInfoLog(s));
      ok = false;
    }
    return s;
  };
  const link = (vs: WebGLShader, fs: WebGLShader) => {
    const p = gl.createProgram()!;
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      console.error("swirl program link failed:", gl.getProgramInfoLog(p));
      ok = false;
    }
    return p;
  };

  const crtProg = link(compile(gl.VERTEX_SHADER, CRT_VERT), compile(gl.FRAGMENT_SHADER, CRT_FRAG));
  const textProg = link(compile(gl.VERTEX_SHADER, TEXT_VERT), compile(gl.FRAGMENT_SHADER, TEXT_FRAG));
  if (!ok) return null;

  const C = {
    aPos: gl.getAttribLocation(crtProg, "aPos"),
    aUv: gl.getAttribLocation(crtProg, "aUv"),
    uTex: gl.getUniformLocation(crtProg, "uTex"),
    uTime: gl.getUniformLocation(crtProg, "uTime"),
    uRes: gl.getUniformLocation(crtProg, "uRes"),
    uScanline: gl.getUniformLocation(crtProg, "uScanline"),
    uAberration: gl.getUniformLocation(crtProg, "uAberration"),
    uCurvature: gl.getUniformLocation(crtProg, "uCurvature"),
    uBg: gl.getUniformLocation(crtProg, "uBg"),
  };
  const T = {
    aCorner: gl.getAttribLocation(textProg, "aCorner"),
    aBounds: gl.getAttribLocation(textProg, "aBounds"),
    aGlyphUv: gl.getAttribLocation(textProg, "aGlyphUv"),
    aColor: gl.getAttribLocation(textProg, "aColor"),
    uTarget: gl.getUniformLocation(textProg, "uTarget"),
    uAtlas: gl.getUniformLocation(textProg, "uAtlas"),
  };

  const posBuf = gl.createBuffer()!;
  const uvBuf = gl.createBuffer()!;
  const cornerBuf = gl.createBuffer()!;
  const boundsBuf = gl.createBuffer()!;
  const glyphUvBuf = gl.createBuffer()!;
  const colorBuf = gl.createBuffer()!;
  const glyphTex = gl.createTexture()!;
  const textTex = gl.createTexture()!;
  const fbo = gl.createFramebuffer()!;

  gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, 1, 1, 1, -1, -1, 1, -1]), gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, uvBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 1, 1, 1, 0, 0, 1, 0]), gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, cornerBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);

  const configureTex = (tex: WebGLTexture) => {
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  };
  configureTex(glyphTex);
  configureTex(textTex);

  const allocStream = (buffer: WebGLBuffer, data: Float32Array) => {
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data.byteLength, gl.DYNAMIC_DRAW);
  };
  const streamAttr = (buffer: WebGLBuffer, data: Float32Array, loc: number) => {
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, data);
    gl.vertexAttribPointer(loc, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribDivisor(loc, 1);
  };

  return {
    gl,
    glyphTex,
    scratch,
    resizeTargets(cw, ch) {
      canvas.width = cw;
      canvas.height = ch;
      gl.bindTexture(gl.TEXTURE_2D, textTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, cw, ch, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, textTex, 0);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    },
    allocCells(buffers) {
      allocStream(boundsBuf, buffers.bounds);
      allocStream(glyphUvBuf, buffers.glyphUvs);
      allocStream(colorBuf, buffers.colors);
    },
    drawField(count, grid, buffers, bg) {
      void grid;
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.disable(gl.DEPTH_TEST);
      gl.clearColor(bg[0], bg[1], bg[2], 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.useProgram(textProg);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, glyphTex);
      gl.uniform1i(T.uAtlas, 0);
      gl.uniform2f(T.uTarget, canvas.width, canvas.height);
      gl.bindBuffer(gl.ARRAY_BUFFER, cornerBuf);
      gl.vertexAttribPointer(T.aCorner, 2, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(T.aCorner);
      gl.vertexAttribDivisor(T.aCorner, 0);
      streamAttr(boundsBuf, buffers.bounds.subarray(0, count * 4), T.aBounds);
      streamAttr(glyphUvBuf, buffers.glyphUvs.subarray(0, count * 4), T.aGlyphUv);
      streamAttr(colorBuf, buffers.colors.subarray(0, count * 4), T.aColor);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, count);
      gl.vertexAttribDivisor(T.aBounds, 0);
      gl.vertexAttribDivisor(T.aGlyphUv, 0);
      gl.vertexAttribDivisor(T.aColor, 0);
    },
    drawCrt(elapsedSec, cw, ch, u) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, cw, ch);
      gl.disable(gl.BLEND);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(crtProg);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, textTex);
      gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
      gl.vertexAttribPointer(C.aPos, 2, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(C.aPos);
      gl.bindBuffer(gl.ARRAY_BUFFER, uvBuf);
      gl.vertexAttribPointer(C.aUv, 2, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(C.aUv);
      gl.uniform1i(C.uTex, 0);
      gl.uniform1f(C.uTime, elapsedSec);
      gl.uniform2f(C.uRes, cw, ch);
      gl.uniform1f(C.uScanline, u.scanline);
      gl.uniform1f(C.uAberration, u.aberration);
      gl.uniform1f(C.uCurvature, u.curvature);
      gl.uniform3f(C.uBg, u.bg[0], u.bg[1], u.bg[2]);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    },
    dispose() {
      // Intentionally NOT calling WEBGL_lose_context().loseContext(): under
      // React Strict Mode the effect mounts → cleans up → remounts on the same
      // <canvas>, and force-losing the context left the remount with a dead one
      // (the swirl only appeared after a hard reload). Let GC reclaim it.
    },
  };
}

```

### swirl/glyph-atlas.ts

```ts
// Glyph atlas: we rasterize every character we might draw ONCE into a hidden 2D
// canvas, then hand that canvas to the GPU as a single texture. After that,
// drawing N letters is N UV lookups into one image instead of N canvas writes —
// which is the whole reason the field can be thousands of cells and still hold
// 60fps.
//
// Two weights are baked (regular + bold) so the resolving word can fade in a
// bolder stroke over the background swirl without a second atlas.

export const WEIGHT_REGULAR = 0;
export const WEIGHT_BOLD = 1;
export const WEIGHT_COUNT = 2;

export interface GlyphAtlas {
  /** Rasterization pixel size (also the cell font-size). */
  inkSize: number;
  /** Advance width of one monospace cell. */
  advance: number;
  cellW: number;
  cellH: number;
  baseline: number;
  pad: number;
  /** [u0,v0,u1,v1] per (weight*glyphCount + glyphIndex). */
  uvs: number[][];
  canvas: HTMLCanvasElement;
}

/**
 * Build the atlas for a given ink size over the supplied glyph list, uploading
 * it into `tex`. The caller owns the GL context and the glyph ordering.
 */
export function buildAtlas(
  gl: WebGL2RenderingContext,
  tex: WebGLTexture,
  scratch: HTMLCanvasElement,
  glyphs: string[],
  inkSize: number,
): GlyphAtlas {
  const { max, ceil, sqrt, floor } = Math;
  const ctx = scratch.getContext("2d")!;
  const baseFont = `${inkSize}px monospace`;
  ctx.font = baseFont;
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  const advance = ctx.measureText("M").width;

  // measure the tallest ascent/descent across both weights so every cell fits
  let asc = 0;
  let desc = 0;
  for (let w = 0; w < WEIGHT_COUNT; w++) {
    ctx.font = w === WEIGHT_BOLD ? `bold ${baseFont}` : baseFont;
    for (const g of glyphs) {
      const m = ctx.measureText(g);
      asc = max(asc, m.actualBoundingBoxAscent || inkSize * 0.8);
      desc = max(desc, m.actualBoundingBoxDescent || inkSize * 0.25);
    }
  }

  const pad = max(2, ceil(inkSize * 0.18));
  const cellW = max(1, ceil(advance + pad * 2));
  const cellH = max(1, ceil(asc + desc + pad * 2));
  const baseline = pad + ceil(asc);

  const count = glyphs.length * WEIGHT_COUNT;
  const cols = ceil(sqrt(count));
  const rows = ceil(count / cols);
  scratch.width = cols * cellW;
  scratch.height = rows * cellH;
  ctx.clearRect(0, 0, scratch.width, scratch.height);
  ctx.fillStyle = "#ffffff";
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";

  const uvs: number[][] = new Array(count);
  for (let w = 0; w < WEIGHT_COUNT; w++) {
    ctx.font = w === WEIGHT_BOLD ? `bold ${baseFont}` : baseFont;
    for (let i = 0; i < glyphs.length; i++) {
      const idx = w * glyphs.length + i;
      const cx = (idx % cols) * cellW;
      const cy = floor(idx / cols) * cellH;
      ctx.fillText(glyphs[i], cx + pad, cy + baseline);
      uvs[idx] = [
        cx / scratch.width,
        cy / scratch.height,
        (cx + cellW) / scratch.width,
        (cy + cellH) / scratch.height,
      ];
    }
  }

  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, scratch);

  return { inkSize, advance, cellW, cellH, baseline, pad, uvs, canvas: scratch };
}

```

### swirl/vortex-field.ts

```ts
// The vortex field: a dense grid of monospace cells. Every frame each cell's
// position is rotated around the center by a twist that grows toward the middle
// (fast core, still rim — that gradient is the whirlpool), then the source text
// is sampled at the rotated coordinate. Where a cell lands inside the target
// word's stencil, its character is pulled toward the word so the name condenses
// out of the soup.
//
// Renamed and re-derived from a study of Midjourney Medical's ASCII intro; the
// twist falloff here is our own smoothstep core rather than a raw 1/dist.

import {
  WEIGHT_REGULAR,
  WEIGHT_BOLD,
  type GlyphAtlas,
} from "./glyph-atlas";
import { sampleTrail, type TrailField } from "./trail-field";

// ---- tuning ----
/** Base angular speed; the falloff below scales it up toward the core. */
export const TWIST_RATE = 0.1;
/** Floor on the radius so the very center doesn't spin to infinity. */
export const CORE_FLOOR = 0.1;
/** Seconds for the word to fully condense out of the field. Long enough that the
 *  crossfade entrance clearly reads, short enough not to drag on each keystroke. */
export const FORMATION_SEC = 1.8;
/** How wide the letter-body halo is when carving the stencil. */
export const STENCIL_HALO = 4;
/** Sampling stays in [-1,1] so columns map cleanly onto the grid width. */
export const FIELD_EXTENT = 1.0;

const SPACE = " ";

const easeOutQuad = (t: number) => t * (2 - t);
const mix = (a: number, b: number, t: number) => a * (1 - t) + b * t;
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
// The twist a cell receives, given its distance from the center: strong at the
// core, fading toward the rim. Expressed as TWIST_RATE over the (floored)
// radius — the floor stops the center spinning to infinity.
const twistAt = (spin: number, dist: number) =>
  (spin * TWIST_RATE) / Math.max(CORE_FLOOR, dist);

/**
 * The target word laid out as 5+ rows of ASCII, plus a stencil marking which
 * cells belong to the letter bodies (so the morph knows what to carve).
 */
export interface Target {
  rows: string[];
  stencil: boolean[][];
}

/** Build the body stencil around a word's glyph cells (incl. interior counters). */
export function carveStencil(rows: string[]): boolean[][] {
  const w = Math.max(0, ...rows.map((l) => l.length));
  return rows.map((line) => {
    const isInk = (x: number) => x >= 0 && x < w && line[x] !== undefined && line[x] !== " ";
    return Array.from({ length: w }, (_u, x) => {
      if (isInk(x) || isInk(x - 1) || isInk(x + 1)) return true;
      // a cell sitting inside a letter counter (ink on both sides) still belongs
      let left = false;
      let right = false;
      for (let d = 1; d <= STENCIL_HALO; d++) {
        if (isInk(x - d)) left = true;
        if (isInk(x + d)) right = true;
      }
      return left && right;
    });
  });
}

export function makeTarget(rows: string[]): Target {
  const w = Math.max(0, ...rows.map((l) => l.length));
  const padded = rows.map((l) => l.padEnd(w, " "));
  return { rows: padded, stencil: carveStencil(padded) };
}

/** A reusable cell buffer the composer fills each frame. */
export interface FieldBuffers {
  bounds: Float32Array;
  glyphUvs: Float32Array;
  colors: Float32Array;
}

export function makeBuffers(maxCells: number): FieldBuffers {
  return {
    bounds: new Float32Array(maxCells * 4),
    glyphUvs: new Float32Array(maxCells * 4),
    colors: new Float32Array(maxCells * 4),
  };
}

export interface FieldGrid {
  cols: number;
  rows: number;
  inkSize: number;
  vOffset: number;
  targetX: number;
  targetY: number;
}

/** Per-cell ink color. Flat color, or a gradient sampled across the field. */
// ---- ink: a flowing multi-stop gradient sampled per cell ----
/**
 * How the stops are mapped onto the field:
 *  - "rows":  hue follows the SOURCE row each character was pulled from, so a
 *             letter carries its color as the vortex flings it around — the
 *             rainbow spirals with the swirl instead of sitting still.
 *  - "axis":  the legacy flat screen-space gradient (a fixed sheet the letters
 *             slide across). Kept for the simple look.
 */
export type InkMode = "rows" | "axis";

export interface InkPaint {
  /** Ordered color stops in 0..1 RGB. One stop = flat fill. */
  stops: [number, number, number][];
  /** Gradient axis direction in radians (0 = left→right). Used by "axis" mode. */
  angle: number;
  /** Phase the bands have drifted (animated by the caller). */
  flow: number;
  /** When false, every cell is stops[0]. */
  gradient: boolean;
  /** Which mapping to use (defaults to "rows" when gradient is on). */
  mode: InkMode;
}

// ---- depth layers stacked on top of the base hue ----
/** Max ± hue offset a single cell can drift, in stop-space (so neighbours
 *  shimmer between adjacent colors instead of matching exactly). */
const HUE_DRIFT = 0.12;
/** How fast each cell's drift cycles. */
const HUE_DRIFT_SPEED = 0.6;
/** Brightness floor for the slowest (rim) cells; the fast core reaches 1. */
const SPEED_DIM = 0.55;

// sample the stop ramp as a closed loop at position t (any real; wrapped to 0..1)
function rampAt(stops: [number, number, number][], t: number): [number, number, number] {
  t = t - Math.floor(t); // 0..1 wrapped
  const seg = t * stops.length;
  const i = Math.floor(seg) % stops.length;
  const j = (i + 1) % stops.length;
  const f = seg - Math.floor(seg);
  const a = stops[i];
  const b = stops[j];
  return [mix(a[0], b[0], f), mix(a[1], b[1], f), mix(a[2], b[2], f)];
}

/** A click shockwave: an expanding ring that displaces the cells it crosses. */
export interface Shock {
  /** Origin in normalized field units (-1..1). */
  x: number;
  y: number;
  /** Seconds since the click (the caller ages this). */
  age: number;
}

// cursor-trail tuning. The trail is a persistent heat+flow field (see
// trail-field.ts); here we turn a cell's local heat into two layers:
//   1. a directional WAKE — push the cell along the remembered flow direction
//   2. a local SWIRL-UP — add to the cell's twist so hot regions spin faster
// Both scale per cell by heat, so a faint lingering trail keeps nudging and
// churning the soup long after the cursor has gone.
const WAKE_PUSH = 0.34; // max wake displacement at full heat (half-field units)
const SWIRL_GAIN = 4.5; // extra spin multiplier per unit heat (strong churn)
const TRAIL_NOISE = 0.9; // per-cell variation so the wake isn't a uniform slab
const FLARE_GAIN = 2.4; // how hard heat drives the color flare (clamped to 1)
// shockwave tuning
const SHOCK_SPEED = 1.4; // ring radius growth per second (field units)
const SHOCK_WIDTH = 0.13; // ring thickness
const SHOCK_PUSH = 0.12; // radial shove at the ring crest (gentle)
const SHOCK_FADE = 1.9; // exp decay per second

// deterministic per-cell hash → 0..1 (so a cell's noise is stable frame to frame)
const cellHash = (col: number, row: number) => {
  const n = Math.sin(col * 127.1 + row * 311.7) * 43758.5453;
  return n - Math.floor(n);
};

// Where this cell sits on the color ramp BEFORE the depth layers. "rows" keys
// off the source row (color travels with the letter); "axis" is the old
// screen-space projection.
interface PaintSample {
  /** Final screen position (-1..1), for the legacy axis mode. */
  fx: number;
  fy: number;
  /** Source row this character came from, normalized 0..1 (for "rows"). */
  srcRow: number;
  /** Stable per-cell hash 0..1, for the per-letter hue drift. */
  jitter: number;
  /** Swirl speed at this cell 0..1 (1 = fast core), for speed brightness. */
  speed: number;
  /** Animation phase in seconds, for the drift cycle. */
  time: number;
}

function paintAt(paint: InkPaint, s: PaintSample): [number, number, number] {
  const stops = paint.stops;
  if (!paint.gradient || stops.length < 2) return stops[0];

  // ── base hue position on the ramp ──
  let t: number;
  if (paint.mode === "axis") {
    const ca = Math.cos(paint.angle);
    const sa = Math.sin(paint.angle);
    t = (s.fx * ca + s.fy * sa) * 0.5 + 0.5 + paint.flow;
  } else {
    // rows: each source line maps to a point on the loop, drifting by flow
    t = s.srcRow + paint.flow;
  }

  // ── layer 1: per-letter hue drift — a slow ± wobble unique to each cell, so
  //    neighbours shimmer between adjacent colors instead of matching exactly ──
  t += Math.sin(s.time * HUE_DRIFT_SPEED + s.jitter * Math.PI * 2) * HUE_DRIFT * s.jitter;

  const rgb = rampAt(stops, t);

  // ── layer 2: speed brightness — the fast-spinning core renders full, the slow
  //    rim dims toward SPEED_DIM, so the swirl's energy reads in the color ──
  const bright = mix(SPEED_DIM, 1, s.speed);
  return [rgb[0] * bright, rgb[1] * bright, rgb[2] * bright];
}

function pushCell(
  buf: FieldBuffers,
  atlas: GlyphAtlas,
  glyphSlot: number,
  x: number,
  baseline: number,
  rgb: [number, number, number],
  alpha: number,
  state: { count: number },
) {
  if (alpha <= 0) return;
  const o = state.count * 4;
  const uv = atlas.uvs[glyphSlot];
  buf.bounds[o] = x - atlas.pad;
  buf.bounds[o + 1] = baseline - atlas.baseline;
  buf.bounds[o + 2] = x - atlas.pad + atlas.cellW;
  buf.bounds[o + 3] = baseline - atlas.baseline + atlas.cellH;
  buf.glyphUvs[o] = uv[0];
  buf.glyphUvs[o + 1] = uv[1];
  buf.glyphUvs[o + 2] = uv[2];
  buf.glyphUvs[o + 3] = uv[3];
  buf.colors[o] = rgb[0];
  buf.colors[o + 1] = rgb[1];
  buf.colors[o + 2] = rgb[2];
  buf.colors[o + 3] = alpha;
  state.count++;
}

export interface ComposeArgs {
  grid: FieldGrid;
  atlas: GlyphAtlas;
  buffers: FieldBuffers;
  source: string[];
  target: Target;
  /** ms since the formation (re)started. */
  elapsed: number;
  paint: InkPaint;
  /** Color of the resolved logo word in 0..1 RGB (independent of the swirl ink). */
  logo: [number, number, number];
  /** Glyph index lookup (resolves a character to its atlas slot, per weight). */
  slotOf: (ch: string, weight: number) => number;
  /** Persistent cursor trail: drives the directional wake + local swirl-up. */
  trail?: TrailField;
  /** Overall trail intensity multiplier (1 = default). */
  trailStrength?: number;
  /** Color hot trail cells flare toward (0..1 RGB); omit for no color flare. */
  trailFlare?: [number, number, number];
  /** Active click shockwaves (optional). */
  shocks?: Shock[];
  /** Sustained ambient wave distortion, 0..1 (a permanent rippling). */
  turbulence?: number;
  /** Which ambient wave shape to use (defaults to "wavefront"). */
  wavePattern?: WavePattern;
}

/**
 * Fill the buffers for this frame and return how many cells were written. The
 * caller uploads `buffers` and issues one instanced draw of `count` quads.
 *
 * The swirl sampling is unchanged from the faithful rebuild; the cursor bend and
 * click shockwaves are applied AFTER, as a positional displacement on each
 * cell's screen position — so the letters physically shove around the pointer
 * and ripple out from a click, rather than the whole field shifting.
 */
// ── ambient wave: a sustained displacement pattern over the whole field. The
// strength is `turbulence` (0..1); the shape is `wavePattern`. ──
export type WavePattern = "wavefront" | "ripples" | "flow" | "cloth";

const WAVE_AMP = 0.16; // max displacement at turbulence = 1
const WAVE_FREQ = 2.4; // spatial frequency
const WAVE_SPEED = 0.9; // travel speed
const WAVE_DIR = Math.PI * 0.15; // wavefront travel direction (radians)

// cheap value noise (hash-lerp) for the "flow" pattern — smooth, scrolling,
// non-repeating. Not Perlin, but plenty for a soft drift.
const vnoise = (x: number, y: number): number => {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const h = (a: number, b: number) => {
    const n = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
    return n - Math.floor(n);
  };
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = h(xi, yi);
  const b = h(xi + 1, yi);
  const c = h(xi, yi + 1);
  const d = h(xi + 1, yi + 1);
  return (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v) * 2 - 1; // -1..1
};

export function composeField(args: ComposeArgs): number {
  const { grid, atlas, buffers, source, target, elapsed, paint, logo, slotOf, trail, shocks, turbulence } = args;
  const wavePattern = args.wavePattern ?? "wavefront";
  const trailStrength = args.trailStrength ?? 1;
  const flare = args.trailFlare;
  const { sin, cos, sqrt, floor, round, exp, max, PI } = Math;
  const spin = elapsed * 0.001;
  const turbOn = !!turbulence && turbulence > 0.001;
  const tWave = elapsed * 0.001 * WAVE_SPEED;
  const waveDirX = cos(WAVE_DIR);
  const waveDirY = sin(WAVE_DIR);
  const formation = easeOutQuad(clamp01((elapsed * 0.001) / FORMATION_SEC));
  // Highlight tracks the logo color instead of being hardcoded white: nudge it
  // toward whichever end is "further" so a dark logo gets a soft sheen and a
  // light logo a faint lift — never a white wash that breaks on light bgs.
  const lum = 0.299 * logo[0] + 0.587 * logo[1] + 0.114 * logo[2];
  const hi: [number, number, number] = lum < 0.5
    ? [mix(logo[0], 1, 0.5), mix(logo[1], 1, 0.5), mix(logo[2], 1, 0.5)] // lighten dark logo
    : [mix(logo[0], 0, 0.35), mix(logo[1], 0, 0.35), mix(logo[2], 0, 0.35)]; // darken light logo
  const lines = source;
  const tw = target.rows;
  const tWidth = tw[0]?.length ?? 0;
  const state = { count: 0 };

  const trailOn = !!trail;
  const ts = { heat: 0, fx: 0, fy: 0 }; // reused per-cell trail sample
  const shockOn = !!shocks && shocks.length > 0;
  // px per normalized HALF-unit, per axis (the canvas is not square, so x and y
  // get their own scale or the push would skew on one axis).
  const halfW = (grid.cols * atlas.advance) / 2;
  const halfH = (grid.rows * grid.inkSize) / 2;

  for (let row = 0; row < grid.rows; row++) {
    const y = (1 - (row * 2) / grid.rows) * FIELD_EXTENT;
    const baseline = grid.vOffset + row * grid.inkSize;
    // screen-normalized y (-1..1, y-down) for displacement math
    const sny = (row + 0.5) / grid.rows * 2 - 1;
    for (let col = 0; col < grid.cols; col++) {
      const x = ((col * 2) / grid.cols - 1) * FIELD_EXTENT;
      const snx = (col + 0.5) / grid.cols * 2 - 1; // screen-normalized x (y-down)
      const dist = sqrt(x * x + y * y);

      // Sample the persistent cursor trail once (heat + remembered flow). The
      // heat locally spins the whirlpool up so a touched region keeps churning.
      let heat = 0;
      if (trailOn) {
        sampleTrail(trail!, snx, sny, ts);
        heat = ts.heat;
      }
      const twist = twistAt(spin, dist) * (1 + SWIRL_GAIN * heat * trailStrength);
      const s = sin(twist);
      const cse = cos(twist);
      const rx = x * cse + y * s;
      const ry = x * s - y * cse;

      // Sample the source: rows cycle through the prompt lines; the column
      // indexes DIRECTLY into the line so where a line runs out the cell is
      // blank — that ragged edge is what keeps the field open and airy.
      const sampleCol = floor(((rx + 1) / 2) * grid.cols);
      const sampleRow = floor(((ry + 1) / 2) * grid.rows);
      const srcLine = lines[((sampleRow % lines.length) + lines.length) % lines.length] ?? "";
      let ch = sampleCol >= 0 && sampleCol < srcLine.length ? srcLine[sampleCol] ?? SPACE : SPACE;

      // The name reads by NEGATIVE space: inside the logo footprint (the
      // stencil) the soup is cleared so letters never show through the word, and
      // the figlet's own glyph cells morph from the soup char toward the target
      // char as the formation ramps in (the entrance).
      let resolved = SPACE;
      const tx = col - grid.targetX;
      const ty = row - grid.targetY;
      const inTarget = tx >= 0 && tx < tWidth && ty >= 0 && ty < tw.length;
      // The whole logo footprint (every stencil cell, not just glyph cells) is
      // held rigid: no displacement reaches it, so the name never warps while the
      // soup around it bends, shocks and churns.
      const inLogo = inTarget && !!target.stencil[ty]?.[tx];
      if (inLogo) {
        const wordChar = tw[ty][tx];
        if (wordChar && wordChar !== " ") {
          ch = String.fromCharCode(
            round(mix(ch.charCodeAt(0), wordChar.charCodeAt(0), formation)),
          );
          resolved = ch;
        } else if (formation > 0.5) {
          ch = SPACE; // counter / halo cell clears once the word has formed
        }
      }
      if (ch === SPACE && resolved === SPACE) continue;

      // ── positional displacement: cursor wake + click shockwaves ──
      // Worked entirely in SCREEN-normalized space (-1..1, y-down) so the trail /
      // click coordinates line up exactly with where the letters are.
      let dx = 0;
      let dy = 0;
      // Directional WAKE: push the cell along the trail's remembered flow,
      // scaled by heat, with per-cell noise so it isn't a uniform slab. Because
      // the trail lingers, this keeps nudging long after the cursor has left.
      if (trailOn && !inLogo && heat > 0.001) {
        const noise = 1 + (cellHash(col, row) - 0.5) * TRAIL_NOISE;
        const push = WAKE_PUSH * heat * trailStrength * noise;
        dx += ts.fx * push;
        dy += ts.fy * push;
        // a swirl curl: also nudge perpendicular to the flow so the wake twists
        // into the vortex instead of just streaking straight — more alive
        dx += -ts.fy * push * 0.5;
        dy += ts.fx * push * 0.5;
      }
      if (shockOn && !inLogo) {
        for (let k = 0; k < shocks!.length; k++) {
          const sh = shocks![k];
          const ox = snx - sh.x;
          const oy = sny - sh.y;
          const r = sqrt(ox * ox + oy * oy);
          const ringR = sh.age * SHOCK_SPEED;
          const d = (r - ringR) / SHOCK_WIDTH;
          const crest = exp(-d * d) * exp(-sh.age * SHOCK_FADE);
          if (crest > 0.002) {
            const inv = 1 / max(0.0001, r);
            const push = SHOCK_PUSH * crest;
            dx += ox * inv * push;
            dy += oy * inv * push;
          }
        }
      }
      if (turbOn && !inLogo) {
        const a = WAVE_AMP * turbulence!;
        if (wavePattern === "wavefront") {
          // a directional crest sweeps across the field; cells lift along the
          // travel direction as the front passes (water / flag)
          const phase = (snx * waveDirX + sny * waveDirY) * WAVE_FREQ * PI - tWave * PI;
          const w = sin(phase);
          dx += a * w * waveDirX;
          dy += a * w * waveDirY;
        } else if (wavePattern === "ripples") {
          // endless concentric rings radiating from the center (pond breathing)
          const r = sqrt(snx * snx + sny * sny);
          const w = sin(r * WAVE_FREQ * PI * 1.6 - tWave * PI);
          const inv = 1 / max(0.08, r);
          dx += a * w * snx * inv;
          dy += a * w * sny * inv;
        } else if (wavePattern === "flow") {
          // drift each cell along a scrolling noise field (ink / smoke)
          const nx = vnoise(snx * 1.6 + tWave * 0.4, sny * 1.6);
          const ny = vnoise(sny * 1.6 - tWave * 0.4 + 7.3, snx * 1.6 + 3.1);
          dx += a * 1.4 * nx;
          dy += a * 1.4 * ny;
        } else {
          // cloth: columns sway side-to-side, phase increasing down the rows, so
          // the field ripples like a banner in a breeze
          dx += a * 1.3 * sin(sny * WAVE_FREQ * PI * 0.9 + tWave * PI * 1.2);
          dy += a * 0.35 * sin(snx * WAVE_FREQ * PI + tWave * PI);
        }
      }

      const px = col * atlas.advance + dx * halfW;
      const by = baseline + dy * halfH;
      const fx = (col * 2) / grid.cols - 1;
      const fy = 1 - (row * 2) / grid.rows;
      // color by the SOURCE row (so it travels with the letter), shimmered by a
      // per-cell drift and brightened by how fast this cell is spinning.
      const srcRow = floor(((ry + 1) / 2) * grid.rows);
      const rgb = paintAt(paint, {
        fx,
        fy,
        srcRow: (((srcRow % grid.rows) + grid.rows) % grid.rows) / grid.rows,
        jitter: cellHash(col, row),
        speed: clamp01(1 - dist),
        time: spin,
      });
      // COLOR FLARE: hot trail cells glow toward the flare color, so dragging
      // lights up a visible, lingering path (the trail reads as light + heat).
      let cellRgb = rgb;
      if (flare && heat > 0.001 && !inLogo) {
        const t = clamp01(heat * FLARE_GAIN * trailStrength);
        cellRgb = [mix(rgb[0], flare[0], t), mix(rgb[1], flare[1], t), mix(rgb[2], flare[2], t)];
      }
      if (ch !== SPACE) {
        pushCell(buffers, atlas, slotOf(ch, WEIGHT_REGULAR), px, by, cellRgb, 1, state);
      }
      if (resolved !== SPACE) {
        // the forming letter fades in over the morphing char, in the LOGO color
        // plus a sheen derived from it (not pure white, so light themes read)
        pushCell(buffers, atlas, slotOf(resolved, WEIGHT_BOLD), px, by, logo, formation, state);
        pushCell(buffers, atlas, slotOf(resolved, WEIGHT_BOLD), px, by, hi, formation * 0.5, state);
      }
    }
  }
  return state.count;
}

```

### swirl/trail-field.ts

```ts
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

```

### swirl/crt-pass.ts

```ts
// The CRT post pass and the instanced-text pass, as GLSL strings + the named
// constants that tune them. Keeping the shaders here (instead of inline in the
// React component) means the playground file reads as orchestration, and the
// "feel" numbers live in one place where they're documented as decisions.

// ---- tuning constants (named so they read as choices, not copied dust) ----
/** How hard the barrel bulge pushes at full curvature. */
export const BARREL_GAIN = 0.1;
/** Inward pinch that pairs with the bulge to keep the frame square-ish. */
export const BARREL_PINCH = 0.085;
/** Edge-weighted term so the bulge grows toward the corners. */
export const BARREL_EDGE = 0.05;
/** RGB split distance per aberration unit, in UV. */
export const ABERRATION_UV = 0.0028;
/** Vignette darkening at the corners (0 = none). */
export const VIGNETTE = 0.7;
/** Filmic exposure before the tonemap; >1 lifts midtones. */
export const TONEMAP_EXPOSURE = 2.2;
/** Seconds for the curvature to ease in from flat at load. */
export const CURVE_RAMP_SEC = 3.0;

// ---- fullscreen CRT pass over the rendered-text texture ----
export const CRT_FRAG = `#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec2 vUv;
uniform sampler2D uTex;
uniform float uTime;
uniform vec2 uRes;
uniform float uScanline;
uniform float uAberration;
uniform float uCurvature;
uniform vec3 uBg;
float easeOutQuad(float t){ return t*(2.0-t); }
void main(){
  float prog = min(uTime / ${CRT_NUM(CURVE_RAMP_SEC)}, 1.0);
  float curve = easeOutQuad(prog) * uCurvature;
  vec2 c = vUv * 2.0 - 1.0;
  c *= 1.0 + ${CRT_NUM(BARREL_GAIN)} * curve;
  c *= 1.0 - ${CRT_NUM(BARREL_PINCH)} * curve + ${CRT_NUM(BARREL_EDGE)} * curve * pow(abs(c.yx), vec2(2.0));
  c = c * 0.5 + 0.5;
  if (c.x < 0.0 || c.x > 1.0 || c.y < 0.0 || c.y > 1.0){ gl_FragColor = vec4(uBg, 1.0); return; }
  float d = uAberration * ${CRT_NUM(ABERRATION_UV)};
  float r = texture2D(uTex, vec2(c.x + d, c.y)).r;
  float g = texture2D(uTex, c).g;
  float b = texture2D(uTex, vec2(c.x - d, c.y)).b;
  vec3 col = vec3(r, g, b);

  // How light the background is (0 = black, 1 = white). The CRT darkening tricks
  // (vignette toward black, filmic tonemap) are tuned for a dark tube and leave
  // a grey halo on a light field, so we fade them out as the bg gets lighter.
  float bgLum = dot(uBg, vec3(0.299, 0.587, 0.114));
  float darkMode = 1.0 - smoothstep(0.4, 0.8, bgLum);

  float scan = max(0.0, sin((c.y + uTime * 0.0005) * uRes.y)) * 0.5;
  col = mix(col, col - vec3(scan), uScanline);

  // Vignette fades the edges toward the ACTUAL background (not black), so on a
  // white field the corners stay white instead of going grey.
  float vig = length(c - 0.5) * ${CRT_NUM(VIGNETTE)};
  col = mix(col, uBg, clamp(vig, 0.0, 1.0) * darkMode);

  // Filmic glow/tonemap only on dark backgrounds; on light it would dull white.
  vec3 toned = 1.0 - exp(-col * ${CRT_NUM(TONEMAP_EXPOSURE)});
  col = mix(col, toned, darkMode);

  gl_FragColor = vec4(col, 1.0);
}`;

export const CRT_VERT = `attribute vec4 aPos; attribute vec2 aUv; varying vec2 vUv;
void main(){ gl_Position = aPos; vUv = aUv; }`;

// ---- instanced text pass: one quad per visible glyph cell ----
export const TEXT_VERT = `attribute vec2 aCorner; attribute vec4 aBounds; attribute vec4 aGlyphUv; attribute vec4 aColor;
uniform vec2 uTarget; varying vec2 vGlyphUv; varying vec4 vColor;
void main(){
  vec2 px = mix(aBounds.xy, aBounds.zw, aCorner);
  vec2 clip = vec2((px.x / uTarget.x) * 2.0 - 1.0, 1.0 - (px.y / uTarget.y) * 2.0);
  gl_Position = vec4(clip, 0.0, 1.0);
  vGlyphUv = mix(aGlyphUv.xy, aGlyphUv.zw, aCorner);
  vColor = aColor;
}`;

export const TEXT_FRAG = `precision mediump float; varying vec2 vGlyphUv; varying vec4 vColor; uniform sampler2D uAtlas;
void main(){ float a = texture2D(uAtlas, vGlyphUv).a; if(a <= 0.001) discard; gl_FragColor = vec4(vColor.rgb, vColor.a * a); }`;

// GLSL needs a decimal point on float literals; this stamps our JS constants in.
function CRT_NUM(n: number): string {
  const s = String(n);
  return s.includes(".") ? s : s + ".0";
}

```

### swirl/block-font.ts

```ts
// The logo-generator font engine. You give it a word and a style; it returns
// rows of monospace ASCII art that the vortex resolves into.
//
// Eight styles come straight from figlet (patorjk/figlet.js), converted to our
// row format in figlet-fonts.ts — real display faces, hand-picked to stay
// legible once the swirl shrinks them (short, sparse line-art). A ninth, Banner,
// is our own block face kept for the chunky poster look. Whatever the source,
// everything flows through one renderWord, so each font automatically inherits
// the entrance morph and all the experiment behaviours.

import { FIGLET_FONTS } from "./figlet-fonts";

export type FontStyle =
  | "slant"
  | "standard"
  | "ogre"
  | "doom"
  | "big"
  | "speed"
  | "stop"
  | "subzero"
  | "banner";

// ── Banner: our own block face. Bitmaps (1 = filled) outlined into hollow
//    letters so they read at small scale instead of merging into a blob. ──
const BANNER_BITS: Record<string, string[]> = {
  A: ["01110", "10001", "11111", "10001", "10001"],
  B: ["11110", "10001", "11110", "10001", "11110"],
  C: ["01111", "10000", "10000", "10000", "01111"],
  D: ["11110", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "11110", "10000", "11111"],
  F: ["11111", "10000", "11110", "10000", "10000"],
  G: ["01111", "10000", "10011", "10001", "01111"],
  H: ["10001", "10001", "11111", "10001", "10001"],
  I: ["111", "010", "010", "010", "111"],
  J: ["00111", "00010", "00010", "10010", "01100"],
  K: ["10001", "10010", "11100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001"],
  O: ["01110", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "11110", "10000", "10000"],
  Q: ["01110", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "11110", "10010", "10001"],
  S: ["01111", "10000", "01110", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10101", "11011", "10001"],
  X: ["10001", "01010", "00100", "01010", "10001"],
  Y: ["10001", "01010", "00100", "00100", "00100"],
  Z: ["11111", "00010", "00100", "01000", "11111"],
  "0": ["01110", "10011", "10101", "11001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "01110"],
  "2": ["11110", "00001", "01110", "10000", "11111"],
  "3": ["11110", "00001", "01110", "00001", "11110"],
  "4": ["10010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "11110", "00001", "11110"],
  "6": ["01111", "10000", "11110", "10001", "01110"],
  "7": ["11111", "00010", "00100", "01000", "01000"],
  "8": ["01110", "10001", "01110", "10001", "01110"],
  "9": ["01110", "10001", "01111", "00001", "11110"],
  "!": ["1", "1", "1", "0", "1"],
  "?": ["11110", "00001", "00110", "00000", "00100"],
  ".": ["0", "0", "0", "0", "1"],
  "-": ["000", "000", "111", "000", "000"],
  " ": ["00", "00", "00", "00", "00"],
};

// A filled cell becomes a block only on the EDGE of the shape; interiors go
// blank. Hollow letters read; solid blocks merge into a mass when shrunk.
function bitsToOutline(bits: string[]): string[] {
  const h = bits.length;
  const w = Math.max(0, ...bits.map((r) => r.length));
  const on = (r: number, c: number) =>
    r >= 0 && r < h && c >= 0 && c < w && bits[r]?.[c] === "1";
  return bits.map((row, r) => {
    let line = "";
    for (let c = 0; c < w; c++) {
      if (!on(r, c)) { line += " "; continue; }
      const edge = !on(r - 1, c) || !on(r + 1, c) || !on(r, c - 1) || !on(r, c + 1);
      line += edge ? "█" : " ";
    }
    return line;
  });
}

const BANNER: Record<string, string[]> = Object.fromEntries(
  Object.entries(BANNER_BITS).map(([k, v]) => [k, bitsToOutline(v)]),
);

const TABLES: Record<FontStyle, Record<string, string[]>> = {
  slant: FIGLET_FONTS.slant,
  standard: FIGLET_FONTS.standard,
  ogre: FIGLET_FONTS.ogre,
  doom: FIGLET_FONTS.doom,
  big: FIGLET_FONTS.big,
  speed: FIGLET_FONTS.speed,
  stop: FIGLET_FONTS.stop,
  subzero: FIGLET_FONTS.subzero,
  banner: BANNER,
};

// Banner letters are solid blocks with no built-in gutter, so they need an
// explicit gap; the figlet faces carry their own spacing and smush together.
const GAP_COLS: Partial<Record<FontStyle, number>> = { banner: 1 };

// Pad every row of a glyph to its own widest row, so an uneven glyph never
// shears the letters after it on that row.
function squareGlyph(rows: string[]): string[] {
  const w = Math.max(0, ...rows.map((r) => r.length));
  return rows.map((r) => r.padEnd(w, " "));
}

// How far a glyph can slide left into the canvas without any of its non-space
// cells overlapping one already there. This is figlet "kerning": the blank
// gutters each letter carries get nested instead of stacked, so pairs like V+A
// or M+I sit at a natural spacing rather than far apart.
function overlapAllowed(canvas: string[], glyph: string[], leftEdge: number, minGap: number): number {
  const gw = Math.max(0, ...glyph.map((r) => r.length));
  let shift = 0;
  for (let s = 1; s <= gw; s++) {
    let collides = false;
    for (let r = 0; r < canvas.length && !collides; r++) {
      const crow = canvas[r];
      const grow = glyph[r] ?? "";
      for (let gx = 0; gx < gw; gx++) {
        const gc = grow[gx] ?? " ";
        if (gc === " ") continue;
        const cx = leftEdge - s + gx;
        if (cx < 0) continue;
        // a forced gap reserves `minGap` blank columns between letters
        for (let g = 0; g <= minGap; g++) {
          if ((crow[cx + g] ?? " ") !== " ") { collides = true; break; }
        }
        if (collides) break;
      }
    }
    if (collides) break;
    shift = s;
  }
  return shift;
}

/**
 * Render `word` in the given figlet style. Returns equal-length rows (right-
 * padded) so the caller gets a clean rectangle; row count is the font's height.
 */
export function renderWord(word: string, style: FontStyle): string[] {
  const table = TABLES[style];
  const minGap = GAP_COLS[style] ?? 0;
  const rowCount = table[" "].length;
  const glyphs = word
    .toUpperCase()
    .split("")
    .map((c) => squareGlyph(table[c] ?? table[" "]));
  if (glyphs.length === 0) return Array.from({ length: rowCount }, () => "");

  // Lay glyphs onto a row canvas, smushing each one leftward as far as it fits.
  let canvas: string[] = Array.from({ length: rowCount }, () => "");
  for (const glyph of glyphs) {
    const gw = Math.max(0, ...glyph.map((r) => r.length));
    const cw = Math.max(0, ...canvas.map((r) => r.length));
    const shift = cw > 0 ? overlapAllowed(canvas, glyph, cw, minGap) : 0;
    const at = cw - shift;
    const next: string[] = [];
    for (let r = 0; r < rowCount; r++) {
      const crow = (canvas[r] ?? "").padEnd(at, " ");
      const grow = (glyph[r] ?? "").padEnd(gw, " ");
      let merged = crow.slice(0, at);
      for (let gx = 0; gx < gw; gx++) {
        const cx = at + gx;
        const existing = (canvas[r] ?? "")[cx] ?? " ";
        const gc = grow[gx];
        merged += gc !== " " ? gc : existing;
      }
      next.push(merged);
    }
    canvas = next;
  }
  const w = Math.max(...canvas.map((r) => r.length));
  return canvas.map((r) => r.padEnd(w, " "));
}

```

### swirl/figlet-fonts.ts

```ts
// AUTO-GENERATED from figlet.js (patorjk/figlet.js) fonts, converted to our
// compact row format. Each glyph is N equal-height rows; squareGlyph in
// block-font.ts pads each to its own width before joining. Regenerate with
// the script in scripts/gen-figlet.mjs if you add fonts.

export type FigletFont = Record<string, string[]>;

export const FIGLET_FONTS: Record<string, FigletFont> = {
  slant: {
    "0": ["   ____ ", "  / __ \\", " / / / /", "/ /_/ / ", "\\____/  "],
    "1": ["   ___", "  <  /", "  / / ", " / /  ", "/_/   "],
    "2": ["   ___ ", "  |__ \\", "  __/ /", " / __/ ", "/____/ "],
    "3": ["   _____", "  |__  /", "   /_ < ", " ___/ / ", "/____/  "],
    "4": ["   __ __", "  / // /", " / // /_", "/__  __/", "  /_/   "],
    "5": ["    ______", "   / ____/", "  /___ \\  ", " ____/ /  ", "/_____/   "],
    "6": ["   _____", "  / ___/", " / __ \\ ", "/ /_/ / ", "\\____/  "],
    "7": [" _____", "/__  /", "  / / ", " / /  ", "/_/   "],
    "8": ["   ____ ", "  ( __ )", " / __  |", "/ /_/ / ", "\\____/  "],
    "9": ["   ____ ", "  / __ \\", " / /_/ /", " \\__, / ", "/____/  "],
    "A": ["    ___ ", "   /   |", "  / /| |", " / ___ |", "/_/  |_|"],
    "B": ["    ____ ", "   / __ )", "  / __  |", " / /_/ / ", "/_____/  "],
    "C": ["   ______", "  / ____/", " / /     ", "/ /___   ", "\\____/   "],
    "D": ["    ____ ", "   / __ \\", "  / / / /", " / /_/ / ", "/_____/  "],
    "E": ["    ______", "   / ____/", "  / __/   ", " / /___   ", "/_____/   "],
    "F": ["    ______", "   / ____/", "  / /_    ", " / __/    ", "/_/       "],
    "G": ["   ______", "  / ____/", " / / __  ", "/ /_/ /  ", "\\____/   "],
    "H": ["    __  __", "   / / / /", "  / /_/ / ", " / __  /  ", "/_/ /_/   "],
    "I": ["    ____", "   /  _/", "   / /  ", " _/ /   ", "/___/   "],
    "J": ["       __", "      / /", " __  / / ", "/ /_/ /  ", "\\____/   "],
    "K": ["    __ __", "   / //_/", "  / ,<   ", " / /| |  ", "/_/ |_|  "],
    "L": ["    __ ", "   / / ", "  / /  ", " / /___", "/_____/"],
    "M": ["    __  ___", "   /  |/  /", "  / /|_/ / ", " / /  / /  ", "/_/  /_/   "],
    "N": ["    _   __", "   / | / /", "  /  |/ / ", " / /|  /  ", "/_/ |_/   "],
    "O": ["   ____ ", "  / __ \\", " / / / /", "/ /_/ / ", "\\____/  "],
    "P": ["    ____ ", "   / __ \\", "  / /_/ /", " / ____/ ", "/_/      "],
    "Q": ["   ____ ", "  / __ \\", " / / / /", "/ /_/ / ", "\\___\\_\\ "],
    "R": ["    ____ ", "   / __ \\", "  / /_/ /", " / _, _/ ", "/_/ |_|  "],
    "S": ["   _____", "  / ___/", "  \\__ \\ ", " ___/ / ", "/____/  "],
    "T": ["  ______", " /_  __/", "  / /   ", " / /    ", "/_/     "],
    "U": ["   __  __", "  / / / /", " / / / / ", "/ /_/ /  ", "\\____/   "],
    "V": [" _    __", "| |  / /", "| | / / ", "| |/ /  ", "|___/   "],
    "W": [" _       __", "| |     / /", "| | /| / / ", "| |/ |/ /  ", "|__/|__/   "],
    "X": ["   _  __", "  | |/ /", "  |   / ", " /   |  ", "/_/|_|  "],
    "Y": ["__  __", "\\ \\/ /", " \\  / ", " / /  ", "/_/   "],
    "Z": [" _____", "/__  /", "  / / ", " / /__", "/____/"],
    " ": ["         ", "         ", "         ", "         ", "         "],
    "!": ["    __", "   / /", "  / / ", " /_/  ", "(_)   "],
    "?": ["  ___ ", " /__ \\", "  / _/", " /_/  ", "(_)   "],
    ".": ["   ", "   ", "   ", " _ ", "(_)"],
    "-": ["       ", "       ", " ______", "/_____/", "       "],
  },
  standard: {
    "0": ["   ___  ", "  / _ \\ ", " | | | |", " | |_| |", "  \\___/ "],
    "1": ["  _ ", " / |", " | |", " | |", " |_|"],
    "2": ["  ____  ", " |___ \\ ", "   __) |", "  / __/ ", " |_____|"],
    "3": ["  _____ ", " |___ / ", "   |_ \\ ", "  ___) |", " |____/ "],
    "4": ["  _  _   ", " | || |  ", " | || |_ ", " |__   _|", "    |_|  "],
    "5": ["  ____  ", " | ___| ", " |___ \\ ", "  ___) |", " |____/ "],
    "6": ["   __   ", "  / /_  ", " | '_ \\ ", " | (_) |", "  \\___/ "],
    "7": ["  _____ ", " |___  |", "    / / ", "   / /  ", "  /_/   "],
    "8": ["   ___  ", "  ( _ ) ", "  / _ \\ ", " | (_) |", "  \\___/ "],
    "9": ["   ___  ", "  / _ \\ ", " | (_) |", "  \\__, |", "    /_/ "],
    "A": ["     _    ", "    / \\   ", "   / _ \\  ", "  / ___ \\ ", " /_/   \\_\\"],
    "B": ["  ____  ", " | __ ) ", " |  _ \\ ", " | |_) |", " |____/ "],
    "C": ["   ____ ", "  / ___|", " | |    ", " | |___ ", "  \\____|"],
    "D": ["  ____  ", " |  _ \\ ", " | | | |", " | |_| |", " |____/ "],
    "E": ["  _____ ", " | ____|", " |  _|  ", " | |___ ", " |_____|"],
    "F": ["  _____ ", " |  ___|", " | |_   ", " |  _|  ", " |_|    "],
    "G": ["   ____ ", "  / ___|", " | |  _ ", " | |_| |", "  \\____|"],
    "H": ["  _   _ ", " | | | |", " | |_| |", " |  _  |", " |_| |_|"],
    "I": ["  ___ ", " |_ _|", "  | | ", "  | | ", " |___|"],
    "J": ["      _ ", "     | |", "  _  | |", " | |_| |", "  \\___/ "],
    "K": ["  _  __", " | |/ /", " | ' / ", " | . \\ ", " |_|\\_\\"],
    "L": ["  _     ", " | |    ", " | |    ", " | |___ ", " |_____|"],
    "M": ["  __  __ ", " |  \\/  |", " | |\\/| |", " | |  | |", " |_|  |_|"],
    "N": ["  _   _ ", " | \\ | |", " |  \\| |", " | |\\  |", " |_| \\_|"],
    "O": ["   ___  ", "  / _ \\ ", " | | | |", " | |_| |", "  \\___/ "],
    "P": ["  ____  ", " |  _ \\ ", " | |_) |", " |  __/ ", " |_|    "],
    "Q": ["   ___  ", "  / _ \\ ", " | | | |", " | |_| |", "  \\__\\_\\"],
    "R": ["  ____  ", " |  _ \\ ", " | |_) |", " |  _ < ", " |_| \\_\\"],
    "S": ["  ____  ", " / ___| ", " \\___ \\ ", "  ___) |", " |____/ "],
    "T": ["  _____ ", " |_   _|", "   | |  ", "   | |  ", "   |_|  "],
    "U": ["  _   _ ", " | | | |", " | | | |", " | |_| |", "  \\___/ "],
    "V": [" __     __", " \\ \\   / /", "  \\ \\ / / ", "   \\ V /  ", "    \\_/   "],
    "W": [" __        __", " \\ \\      / /", "  \\ \\ /\\ / / ", "   \\ V  V /  ", "    \\_/\\_/   "],
    "X": [" __  __", " \\ \\/ /", "  \\  / ", "  /  \\ ", " /_/\\_\\"],
    "Y": [" __   __", " \\ \\ / /", "  \\ V / ", "   | |  ", "   |_|  "],
    "Z": ["  _____", " |__  /", "   / / ", "  / /_ ", " /____|"],
    " ": ["   ", "   ", "   ", "   ", "   "],
    "!": ["  _ ", " | |", " | |", " |_|", " (_)"],
    "?": ["  ___ ", " |__ \\", "   / /", "  |_| ", "  (_) "],
    ".": ["    ", "    ", "    ", "  _ ", " (_)"],
    "-": ["        ", "        ", "  _____ ", " |_____|", "        "],
  },
  ogre: {
    "0": ["  ___  ", " / _ \\ ", "| | | |", "| |_| |", " \\___/ "],
    "1": [" _ ", "/ |", "| |", "| |", "|_|"],
    "2": [" ____  ", "|___ \\ ", "  __) |", " / __/ ", "|_____|"],
    "3": [" _____ ", "|___ / ", "  |_ \\ ", " ___) |", "|____/ "],
    "4": [" _  _   ", "| || |  ", "| || |_ ", "|__   _|", "   |_|  "],
    "5": [" ____  ", "| ___| ", "|___ \\ ", " ___) |", "|____/ "],
    "6": ["  __   ", " / /_  ", "| '_ \\ ", "| (_) |", " \\___/ "],
    "7": [" _____ ", "|___  |", "   / / ", "  / /  ", " /_/   "],
    "8": ["  ___  ", " ( _ ) ", " / _ \\ ", "| (_) |", " \\___/ "],
    "9": ["  ___  ", " / _ \\ ", "| (_) |", " \\__, |", "   /_/ "],
    "A": ["   _   ", "  /_\\  ", " //_\\\\ ", "/  _  \\", "\\_/ \\_/"],
    "B": ["   ___ ", "  / __\\", " /__\\//", "/ \\/  \\", "\\_____/"],
    "C": ["   ___ ", "  / __\\", " / /   ", "/ /___ ", "\\____/ "],
    "D": ["    ___ ", "   /   \\", "  / /\\ /", " / /_// ", "/___,'  "],
    "E": ["   __ ", "  /__\\", " /_\\  ", "//__  ", "\\__/  "],
    "F": ["   ___ ", "  / __\\", " / _\\  ", "/ /    ", "\\/     "],
    "G": ["   ___ ", "  / _ \\", " / /_\\/", "/ /_\\\\ ", "\\____/ "],
    "H": ["        ", "  /\\  /\\", " / /_/ /", "/ __  / ", "\\/ /_/  "],
    "I": ["  _____ ", "  \\_   \\", "   / /\\/", "/\\/ /_  ", "\\____/  "],
    "J": ["   __  ", "   \\ \\ ", "    \\ \\", " /\\_/ /", " \\___/ "],
    "K": ["       ", "  /\\ /\\", " / //_/", "/ __ \\ ", "\\/  \\/ "],
    "L": ["   __  ", "  / /  ", " / /   ", "/ /___ ", "\\____/ "],
    "M": ["        ", "  /\\/\\  ", " /    \\ ", "/ /\\/\\ \\", "\\/    \\/"],
    "N": ["     __ ", "  /\\ \\ \\", " /  \\/ /", "/ /\\  / ", "\\_\\ \\/  "],
    "O": ["   ___ ", "  /___\\", " //  //", "/ \\_// ", "\\___/  "],
    "P": ["   ___ ", "  / _ \\", " / /_)/", "/ ___/ ", "\\/     "],
    "Q": ["   ____ ", "  /___ \\", " //  / /", "/ \\_/ / ", "\\___,_\\ "],
    "R": ["   __  ", "  /__\\ ", " / \\// ", "/ _  \\ ", "\\/ \\_/ "],
    "S": [" __    ", "/ _\\   ", "\\ \\    ", "_\\ \\   ", "\\__/   "],
    "T": [" _____ ", "/__   \\", "  / /\\/", " / /   ", " \\/    "],
    "U": ["       ", " /\\ /\\ ", "/ / \\ \\", "\\ \\_/ /", " \\___/ "],
    "V": ["         ", " /\\   /\\ ", " \\ \\ / / ", "  \\ V /  ", "   \\_/   "],
    "W": [" __    __ ", "/ / /\\ \\ \\", "\\ \\/  \\/ /", " \\  /\\  / ", "  \\/  \\/  "],
    "X": ["__  __", "\\ \\/ /", " \\  / ", " /  \\ ", "/_/\\_\\"],
    "Y": ["     ", "/\\_/\\", "\\_ _/", " / \\ ", " \\_/ "],
    "Z": [" _____", "/ _  /", "\\// / ", " / //\\", "/____/"],
    " ": ["  ", "  ", "  ", "  ", "  "],
    "!": ["   _ ", "  / \\", " /  /", "/\\_/ ", "\\/   "],
    "?": [" ___ ", "/ _ \\", "\\// /", "  \\/ ", "  () "],
    ".": ["   ", "   ", "   ", " _ ", "(_)"],
    "-": ["       ", "       ", " _____ ", "|_____|", "       "],
  },
  doom: {
    "0": [" _____ ", "|  _  |", "| |/' |", "|  /| |", "\\ |_/ /", " \\___/ "],
    "1": [" __  ", "/  | ", "`| | ", " | | ", "_| |_", "\\___/"],
    "2": [" _____ ", "/ __  \\", "`' / /'", "  / /  ", "./ /___", "\\_____/"],
    "3": [" _____ ", "|____ |", "    / /", "    \\ \\", ".___/ /", "\\____/ "],
    "4": ["   ___ ", "  /   |", " / /| |", "/ /_| |", "\\___  |", "    |_/"],
    "5": [" _____ ", "|  ___|", "|___ \\ ", "    \\ \\", "/\\__/ /", "\\____/ "],
    "6": ["  ____ ", " / ___|", "/ /___ ", "| ___ \\", "| \\_/ |", "\\_____/"],
    "7": [" ______", "|___  /", "   / / ", "  / /  ", "./ /   ", "\\_/    "],
    "8": [" _____ ", "|  _  |", " \\ V / ", " / _ \\ ", "| |_| |", "\\_____/"],
    "9": [" _____ ", "|  _  |", "| |_| |", "\\____ |", ".___/ /", "\\____/ "],
    "A": ["  ___  ", " / _ \\ ", "/ /_\\ \\", "|  _  |", "| | | |", "\\_| |_/"],
    "B": ["______ ", "| ___ \\", "| |_/ /", "| ___ \\", "| |_/ /", "\\____/ "],
    "C": [" _____ ", "/  __ \\", "| /  \\/", "| |    ", "| \\__/\\", " \\____/"],
    "D": ["______ ", "|  _  \\", "| | | |", "| | | |", "| |/ / ", "|___/  "],
    "E": [" _____ ", "|  ___|", "| |__  ", "|  __| ", "| |___ ", "\\____/ "],
    "F": ["______ ", "|  ___|", "| |_   ", "|  _|  ", "| |    ", "\\_|    "],
    "G": [" _____ ", "|  __ \\", "| |  \\/", "| | __ ", "| |_\\ \\", " \\____/"],
    "H": [" _   _ ", "| | | |", "| |_| |", "|  _  |", "| | | |", "\\_| |_/"],
    "I": [" _____ ", "|_   _|", "  | |  ", "  | |  ", " _| |_ ", " \\___/ "],
    "J": ["   ___ ", "  |_  |", "    | |", "    | |", "/\\__/ /", "\\____/ "],
    "K": [" _   __", "| | / /", "| |/ / ", "|    \\ ", "| |\\  \\", "\\_| \\_/"],
    "L": [" _     ", "| |    ", "| |    ", "| |    ", "| |____", "\\_____/"],
    "M": ["___  ___", "|  \\/  |", "| .  . |", "| |\\/| |", "| |  | |", "\\_|  |_/"],
    "N": [" _   _ ", "| \\ | |", "|  \\| |", "| . ` |", "| |\\  |", "\\_| \\_/"],
    "O": [" _____ ", "|  _  |", "| | | |", "| | | |", "\\ \\_/ /", " \\___/ "],
    "P": ["______ ", "| ___ \\", "| |_/ /", "|  __/ ", "| |    ", "\\_|    "],
    "Q": [" _____ ", "|  _  |", "| | | |", "| | | |", "\\ \\/' /", " \\_/\\_\\"],
    "R": ["______ ", "| ___ \\", "| |_/ /", "|    / ", "| |\\ \\ ", "\\_| \\_|"],
    "S": [" _____ ", "/  ___|", "\\ `--. ", " `--. \\", "/\\__/ /", "\\____/ "],
    "T": [" _____ ", "|_   _|", "  | |  ", "  | |  ", "  | |  ", "  \\_/  "],
    "U": [" _   _ ", "| | | |", "| | | |", "| | | |", "| |_| |", " \\___/ "],
    "V": [" _   _ ", "| | | |", "| | | |", "| | | |", "\\ \\_/ /", " \\___/ "],
    "W": [" _    _ ", "| |  | |", "| |  | |", "| |/\\| |", "\\  /\\  /", " \\/  \\/ "],
    "X": ["__   __", "\\ \\ / /", " \\ V / ", " /   \\ ", "/ /^\\ \\", "\\/   \\/"],
    "Y": ["__   __", "\\ \\ / /", " \\ V / ", "  \\ /  ", "  | |  ", "  \\_/  "],
    "Z": [" ______", "|___  /", "   / / ", "  / /  ", "./ /___", "\\_____/"],
    " ": ["  ", "  ", "  ", "  ", "  ", "  "],
    "!": [" _ ", "| |", "| |", "| |", "|_|", "(_)"],
    "?": [" ___  ", "|__ \\ ", "   ) |", "  / / ", " |_|  ", " (_)  "],
    ".": ["   ", "   ", "   ", "   ", " _ ", "(_)"],
    "-": ["        ", "        ", " ______ ", "|______|", "        ", "        "],
  },
  big: {
    "0": ["   ___  ", "  / _ \\ ", " | | | |", " | | | |", " | |_| |", "  \\___/ "],
    "1": ["  __ ", " /_ |", "  | |", "  | |", "  | |", "  |_|"],
    "2": ["  ___  ", " |__ \\ ", "    ) |", "   / / ", "  / /_ ", " |____|"],
    "3": ["  ____  ", " |___ \\ ", "   __) |", "  |__ < ", "  ___) |", " |____/ "],
    "4": ["  _  _   ", " | || |  ", " | || |_ ", " |__   _|", "    | |  ", "    |_|  "],
    "5": ["  _____ ", " | ____|", " | |__  ", " |___ \\ ", "  ___) |", " |____/ "],
    "6": ["    __  ", "   / /  ", "  / /_  ", " | '_ \\ ", " | (_) |", "  \\___/ "],
    "7": ["  ______ ", " |____  |", "     / / ", "    / /  ", "   / /   ", "  /_/    "],
    "8": ["   ___  ", "  / _ \\ ", " | (_) |", "  > _ < ", " | (_) |", "  \\___/ "],
    "9": ["   ___  ", "  / _ \\ ", " | (_) |", "  \\__, |", "    / / ", "   /_/  "],
    "A": ["           ", "     /\\    ", "    /  \\   ", "   / /\\ \\  ", "  / ____ \\ ", " /_/    \\_\\"],
    "B": ["  ____  ", " |  _ \\ ", " | |_) |", " |  _ < ", " | |_) |", " |____/ "],
    "C": ["   _____ ", "  / ____|", " | |     ", " | |     ", " | |____ ", "  \\_____|"],
    "D": ["  _____  ", " |  __ \\ ", " | |  | |", " | |  | |", " | |__| |", " |_____/ "],
    "E": ["  ______ ", " |  ____|", " | |__   ", " |  __|  ", " | |____ ", " |______|"],
    "F": ["  ______ ", " |  ____|", " | |__   ", " |  __|  ", " | |     ", " |_|     "],
    "G": ["   _____ ", "  / ____|", " | |  __ ", " | | |_ |", " | |__| |", "  \\_____|"],
    "H": ["  _    _ ", " | |  | |", " | |__| |", " |  __  |", " | |  | |", " |_|  |_|"],
    "I": ["  _____ ", " |_   _|", "   | |  ", "   | |  ", "  _| |_ ", " |_____|"],
    "J": ["       _ ", "      | |", "      | |", "  _   | |", " | |__| |", "  \\____/ "],
    "K": ["  _  __", " | |/ /", " | ' / ", " |  <  ", " | . \\ ", " |_|\\_\\"],
    "L": ["  _      ", " | |     ", " | |     ", " | |     ", " | |____ ", " |______|"],
    "M": ["  __  __ ", " |  \\/  |", " | \\  / |", " | |\\/| |", " | |  | |", " |_|  |_|"],
    "N": ["  _   _ ", " | \\ | |", " |  \\| |", " | . ` |", " | |\\  |", " |_| \\_|"],
    "O": ["   ____  ", "  / __ \\ ", " | |  | |", " | |  | |", " | |__| |", "  \\____/ "],
    "P": ["  _____  ", " |  __ \\ ", " | |__) |", " |  ___/ ", " | |     ", " |_|     "],
    "Q": ["   ____  ", "  / __ \\ ", " | |  | |", " | |  | |", " | |__| |", "  \\___\\_\\"],
    "R": ["  _____  ", " |  __ \\ ", " | |__) |", " |  _  / ", " | | \\ \\ ", " |_|  \\_\\"],
    "S": ["   _____ ", "  / ____|", " | (___  ", "  \\___ \\ ", "  ____) |", " |_____/ "],
    "T": ["  _______ ", " |__   __|", "    | |   ", "    | |   ", "    | |   ", "    |_|   "],
    "U": ["  _    _ ", " | |  | |", " | |  | |", " | |  | |", " | |__| |", "  \\____/ "],
    "V": [" __      __", " \\ \\    / /", "  \\ \\  / / ", "   \\ \\/ /  ", "    \\  /   ", "     \\/    "],
    "W": [" __          __", " \\ \\        / /", "  \\ \\  /\\  / / ", "   \\ \\/  \\/ /  ", "    \\  /\\  /   ", "     \\/  \\/    "],
    "X": [" __   __", " \\ \\ / /", "  \\ V / ", "   > <  ", "  / . \\ ", " /_/ \\_\\"],
    "Y": [" __     __", " \\ \\   / /", "  \\ \\_/ / ", "   \\   /  ", "    | |   ", "    |_|   "],
    "Z": ["  ______", " |___  /", "    / / ", "   / /  ", "  / /__ ", " /_____|"],
    " ": ["   ", "   ", "   ", "   ", "   ", "   "],
    "!": ["  _ ", " | |", " | |", " | |", " |_|", " (_)"],
    "?": ["  ___  ", " |__ \\ ", "    ) |", "   / / ", "  |_|  ", "  (_)  "],
    ".": ["    ", "    ", "    ", "    ", "  _ ", " (_)"],
    "-": ["         ", "         ", "  ______ ", " |______|", "         ", "         "],
  },
  speed: {
    "0": ["_______ ", "__  __ \\", "_  / / /", "/ /_/ / ", "\\____/  "],
    "1": ["______", "__<  /", "__  / ", "_  /  ", "/_/   "],
    "2": ["______ ", "__|__ \\", "____/ /", "_  __/ ", "/____/ "],
    "3": ["________", "__|__  /", "___/_ < ", "____/ / ", "/____/  "],
    "4": ["_____ __", "__  // /", "_  // /_", "/__  __/", "  /_/   "],
    "5": ["__________", "___  ____/", "______ \\  ", " ____/ /  ", "/_____/   "],
    "6": ["________", "__  ___/", "_  __ \\ ", "/ /_/ / ", "\\____/  "],
    "7": ["______", "/__  /", "__  / ", "_  /  ", "/_/   "],
    "8": ["_______ ", "__( __ )", "_  __  |", "/ /_/ / ", "\\____/  "],
    "9": ["_______ ", "__  __ \\", "_  /_/ /", "_\\__, / ", "/____/  "],
    "A": ["_______ ", "___    |", "__  /| |", "_  ___ |", "/_/  |_|"],
    "B": ["________ ", "___  __ )", "__  __  |", "_  /_/ / ", "/_____/  "],
    "C": ["_________", "__  ____/", "_  /     ", "/ /___   ", "\\____/   "],
    "D": ["________ ", "___  __ \\", "__  / / /", "_  /_/ / ", "/_____/  "],
    "E": ["__________", "___  ____/", "__  __/   ", "_  /___   ", "/_____/   "],
    "F": ["__________", "___  ____/", "__  /_    ", "_  __/    ", "/_/       "],
    "G": ["_________", "__  ____/", "_  / __  ", "/ /_/ /  ", "\\____/   "],
    "H": ["______  __", "___  / / /", "__  /_/ / ", "_  __  /  ", "/_/ /_/   "],
    "I": ["________", "____  _/", " __  /  ", "__/ /   ", "/___/   "],
    "J": ["_________", "______  /", "___ _  / ", "/ /_/ /  ", "\\____/   "],
    "K": ["______ __", "___  //_/", "__  ,<   ", "_  /| |  ", "/_/ |_|  "],
    "L": ["______ ", "___  / ", "__  /  ", "_  /___", "/_____/"],
    "M": ["______  ___", "___   |/  /", "__  /|_/ / ", "_  /  / /  ", "/_/  /_/   "],
    "N": ["_____   __", "___  | / /", "__   |/ / ", "_  /|  /  ", "/_/ |_/   "],
    "O": ["_______ ", "__  __ \\", "_  / / /", "/ /_/ / ", "\\____/  "],
    "P": ["________ ", "___  __ \\", "__  /_/ /", "_  ____/ ", "/_/      "],
    "Q": ["_______ ", "__  __ \\", "_  / / /", "/ /_/ / ", "\\___\\_\\ "],
    "R": ["________ ", "___  __ \\", "__  /_/ /", "_  _, _/ ", "/_/ |_|  "],
    "S": ["________", "__  ___/", "_____ \\ ", "____/ / ", "/____/  "],
    "T": ["________", "___  __/", "__  /   ", "_  /    ", "/_/     "],
    "U": ["_____  __", "__  / / /", "_  / / / ", "/ /_/ /  ", "\\____/   "],
    "V": ["___    __", "__ |  / /", "__ | / / ", "__ |/ /  ", "_____/   "],
    "W": ["___       __", "__ |     / /", "__ | /| / / ", "__ |/ |/ /  ", "____/|__/   "],
    "X": ["____  __", "__  |/ /", "__    / ", "_    |  ", "/_/|_|  "],
    "Y": ["__  __", "_ \\/ /", "__  / ", "_  /  ", "/_/   "],
    "Z": ["______", "___  /", "__  / ", "_  /__", "/____/"],
    " ": ["         ", "         ", "         ", "         ", "         "],
    "!": ["______", "___  /", "__  / ", " /_/  ", "(_)   "],
    "?": ["_____ ", "_ __ \\", "__/ _/", "_/_/  ", "(_)   "],
    ".": ["    ", "    ", "    ", "___ ", "_(_)"],
    "-": ["        ", "        ", "________", "_/_____/", "        "],
  },
  stop: {
    "0": ["  ______ ", " / __   |", "| | //| |", "| |// | |", "|  /__| |", " \\_____/ "],
    "1": ["  __ ", " /  |", "/_/ |", "  | |", "  | |", "  |_|"],
    "2": [" ______  ", "(_____ \\ ", "  ____) )", " /_____/ ", " _______ ", "(_______)"],
    "3": [" ________", "(_______/", "   ____  ", "  (___ \\ ", " _____) )", "(______/ "],
    "4": ["   __    ", "  / /    ", " / /____ ", "|___   _)", "    | |  ", "    |_|  "],
    "5": [" _______ ", "(_______)", " ______  ", "(_____ \\ ", " _____) )", "(______/ "],
    "6": ["    __  ", "   / /  ", "  / /_  ", " / __ \\ ", "( (__) )", " \\____/ "],
    "7": [" _______ ", "(_______)", "      _  ", "     / ) ", "    / /  ", "   (_/   "],
    "8": ["  _____  ", " / ___ \\ ", "( (   ) )", " > > < < ", "( (___) )", " \\_____/ "],
    "9": ["  ____  ", " / __ \\ ", "( (__) )", " \\__  / ", "   / /  ", "  /_/   "],
    "A": ["        ", "   /\\   ", "  /  \\  ", " / /\\ \\ ", "| |__| |", "|______|"],
    "B": [" ______  ", "(____  \\ ", " ____)  )", "|  __  ( ", "| |__)  )", "|______/ "],
    "C": ["  ______ ", " / _____)", "| /      ", "| |      ", "| \\_____ ", " \\______)"],
    "D": [" _____   ", "(____ \\  ", " _   \\ \\ ", "| |   | |", "| |__/ / ", "|_____/  "],
    "E": [" _______ ", "(_______)", " _____   ", "|  ___)  ", "| |_____ ", "|_______)"],
    "F": [" _______ ", "(_______)", " _____   ", "|  ___)  ", "| |      ", "|_|      "],
    "G": ["  ______ ", " / _____)", "| /  ___ ", "| | (___)", "| \\____/|", " \\_____/ "],
    "H": [" _     _ ", "| |   | |", "| |__ | |", "|  __)| |", "| |   | |", "|_|   |_|"],
    "I": [" _____ ", "(_____)", "   _   ", "  | |  ", " _| |_ ", "(_____)"],
    "J": ["   _____ ", "  (_____)", "     _   ", "    | |  ", " ___| |  ", "(____/   "],
    "K": [" _    _ ", "| |  / )", "| | / / ", "| |< <  ", "| | \\ \\ ", "|_|  \\_)"],
    "L": [" _       ", "| |      ", "| |      ", "| |      ", "| |_____ ", "|_______)"],
    "M": [" ______  ", "|  ___ \\ ", "| | _ | |", "| || || |", "| || || |", "|_||_||_|"],
    "N": [" ______  ", "|  ___ \\ ", "| |   | |", "| |   | |", "| |   | |", "|_|   |_|"],
    "O": ["  _____  ", " / ___ \\ ", "| |   | |", "| |   | |", "| |___| |", " \\_____/ "],
    "P": [" ______  ", "(_____ \\ ", " _____) )", "|  ____/ ", "| |      ", "|_|      "],
    "Q": ["  _____  ", " / ___ \\ ", "| |   | |", "| |   |_|", " \\ \\____ ", "  \\_____)"],
    "R": [" ______  ", "(_____ \\ ", " _____) )", "(_____ ( ", "      | |", "      |_|"],
    "S": ["    _    ", "   | |   ", "    \\ \\  ", "     \\ \\ ", " _____) )", "(______/ "],
    "T": [" _______ ", "(_______)", " _       ", "| |      ", "| |_____ ", " \\______)"],
    "U": [" _     _ ", "| |   | |", "| |   | |", "| |   | |", "| |___| |", " \\______|"],
    "V": [" _    _ ", "| |  | |", "| |  | |", " \\ \\/ / ", "  \\  /  ", "   \\/   "],
    "W": [" _  _  _ ", "| || || |", "| || || |", "| ||_|| |", "| |___| |", " \\______|"],
    "X": [" _    _ ", "\\ \\  / /", " \\ \\/ / ", "  )  (  ", " / /\\ \\ ", "/_/  \\_\\"],
    "Y": [" _     _ ", "| |   | |", "| |___| |", " \\_____/ ", "   ___   ", "  (___)  "],
    "Z": [" _______ ", "(_______)", "   __    ", "  / /    ", " / /____ ", "(_______)"],
    " ": ["    ", "    ", "    ", "    ", "    ", "    "],
    "!": [" _ ", "| |", "| |", "|_|", " _ ", "|_|"],
    "?": [" ____  ", "(___ \\ ", "    ) )", "   /_/ ", "   _   ", "  (_)  "],
    ".": ["   ", "   ", "   ", "   ", " _ ", "(_)"],
    "-": ["     ", "     ", " ___ ", "(___)", "     ", "     "],
  },
  subzero: {
    "0": ["", "", "", "", ""],
    "1": ["", "", "", "", ""],
    "2": ["", "", "", "", ""],
    "3": ["", "", "", "", ""],
    "4": ["", "", "", "", ""],
    "5": ["", "", "", "", ""],
    "6": ["", "", "", "", ""],
    "7": ["", "", "", "", ""],
    "8": ["", "", "", "", ""],
    "9": ["", "", "", "", ""],
    "A": [" ______    ", "/\\  __ \\   ", "\\ \\  __ \\  ", " \\ \\_\\ \\_\\ ", "  \\/_/\\/_/ "],
    "B": [" ______    ", "/\\  == \\   ", "\\ \\  __<   ", " \\ \\_____\\ ", "  \\/_____/ "],
    "C": [" ______    ", "/\\  ___\\   ", "\\ \\ \\____  ", " \\ \\_____\\ ", "  \\/_____/ "],
    "D": [" _____    ", "/\\  __-.  ", "\\ \\ \\/\\ \\ ", " \\ \\____- ", "  \\/____/ "],
    "E": [" ______    ", "/\\  ___\\   ", "\\ \\  __\\   ", " \\ \\_____\\ ", "  \\/_____/ "],
    "F": [" ______  ", "/\\  ___\\ ", "\\ \\  __\\ ", " \\ \\_\\   ", "  \\/_/   "],
    "G": [" ______    ", "/\\  ___\\   ", "\\ \\ \\__ \\  ", " \\ \\_____\\ ", "  \\/_____/ "],
    "H": [" __  __    ", "/\\ \\_\\ \\   ", "\\ \\  __ \\  ", " \\ \\_\\ \\_\\ ", "  \\/_/\\/_/ "],
    "I": [" __    ", "/\\ \\   ", "\\ \\ \\  ", " \\ \\_\\ ", "  \\/_/ "],
    "J": ["   __    ", "  /\\ \\   ", " _\\_\\ \\  ", "/\\_____\\ ", "\\/_____/ "],
    "K": [" __  __    ", "/\\ \\/ /    ", "\\ \\  _\"-.  ", " \\ \\_\\ \\_\\ ", "  \\/_/\\/_/ "],
    "L": [" __        ", "/\\ \\       ", "\\ \\ \\____  ", " \\ \\_____\\ ", "  \\/_____/ "],
    "M": [" __    __    ", "/\\ \"-./  \\   ", "\\ \\ \\-./\\ \\  ", " \\ \\_\\ \\ \\_\\ ", "  \\/_/  \\/_/ "],
    "N": [" __   __    ", "/\\ \"-.\\ \\   ", "\\ \\ \\-.  \\  ", " \\ \\_\\\\\"\\_\\ ", "  \\/_/ \\/_/ "],
    "O": [" ______    ", "/\\  __ \\   ", "\\ \\ \\/\\ \\  ", " \\ \\_____\\ ", "  \\/_____/ "],
    "P": [" ______  ", "/\\  == \\ ", "\\ \\  _-/ ", " \\ \\_\\   ", "  \\/_/   "],
    "Q": [" ______    ", "/\\  __ \\   ", "\\ \\ \\/\\_\\  ", " \\ \\___\\_\\ ", "  \\/___/_/ "],
    "R": [" ______    ", "/\\  == \\   ", "\\ \\  __<   ", " \\ \\_\\ \\_\\ ", "  \\/_/ /_/ "],
    "S": [" ______    ", "/\\  ___\\   ", "\\ \\___  \\  ", " \\/\\_____\\ ", "  \\/_____/ "],
    "T": [" ______  ", "/\\__  _\\ ", "\\/_/\\ \\/ ", "   \\ \\_\\ ", "    \\/_/ "],
    "U": [" __  __    ", "/\\ \\/\\ \\   ", "\\ \\ \\_\\ \\  ", " \\ \\_____\\ ", "  \\/_____/ "],
    "V": [" __   __  ", "/\\ \\ / /  ", "\\ \\ \\'/   ", " \\ \\__|   ", "  \\/_/    "],
    "W": [" __     __    ", "/\\ \\  _ \\ \\   ", "\\ \\ \\/ \".\\ \\  ", " \\ \\__/\".~\\_\\ ", "  \\/_/   \\/_/ "],
    "X": [" __  __    ", "/\\_\\_\\_\\   ", "\\/_/\\_\\/_  ", "  /\\_\\/\\_\\ ", "  \\/_/\\/_/ "],
    "Y": [" __  __    ", "/\\ \\_\\ \\   ", "\\ \\____ \\  ", " \\/\\_____\\ ", "  \\/_____/ "],
    "Z": [" ______    ", "/\\___  \\   ", "\\/_/  /__  ", "  /\\_____\\ ", "  \\/_____/ "],
    " ": ["      ", "      ", "      ", "      ", "      "],
    "!": ["", "", "", "", ""],
    "?": ["", "", "", "", ""],
    ".": ["", "", "", "", ""],
    "-": ["", "", "", "", ""],
  },
};

```

### swirl/resolver.ts

```ts
// Variants the swirl resolves into. The three named presets carry hand-set
// figlet "slant" ASCII (the look we want for the real names — crisp, italic,
// hollow letterforms). The free-text logo generator renders ITS word live via
// block-font; that path is the only one that touches the generated fonts.

// figlet "slant" — the original logos, kept verbatim.
const SLANT_ARLAN = [
  "    ___         __          ",
  "   /   |  _____/ /___ _____ ",
  "  / /| | / ___/ / __ `/ __ \\",
  " / ___ |/ /  / / /_/ / / / /",
  "/_/  |_/_/  /_/\\__,_/_/ /_/ ",
];
const SLANT_HUMAN_DELTA = [
  "    __  __                               ____       ____       ",
  "   / / / /_  ______ ___  ____ _____     / __ \\___  / / /_____ _",
  "  / /_/ / / / / __ `__ \\/ __ `/ __ \\   / / / / _ \\/ / __/ __ `/",
  " / __  / /_/ / / / / / / /_/ / / / /  / /_/ /  __/ / /_/ /_/ / ",
  "/_/ /_/\\__,_/_/ /_/ /_/\\__,_/_/ /_/  /_____/\\___/_/\\__/\\__,_/  ",
];
const SLANT_KAMILA = [
  "    __ __                _ __     ",
  "   / //_/___ _____ ___  (_) /___ _",
  "  / ,< / __ `/ __ `__ \\/ / / __ `/",
  " / /| / /_/ / / / / / / / / /_/ / ",
  "/_/ |_\\__,_/_/ /_/ /_/_/_/\\__,_/  ",
];

export interface Variant {
  id: string;
  label: string;
  /** Pre-baked ASCII rows for the named presets. */
  rows: string[];
  /** Swirl-letter color. */
  ink: string;
  /** Resolved-logo color (independent of the swirl letters). */
  logo: string;
  /** Canvas background. */
  bg: string;
  /** Starting zoom (smaller = more cells, fits a wider word). */
  zoom: number;
}

export const VARIANTS: Variant[] = [
  { id: "arlan", label: "Arlan", rows: SLANT_ARLAN, ink: "#d8d8d8", logo: "#ffffff", bg: "#0c0c0d", zoom: 0.62 },
  { id: "human-delta", label: "Human Delta", rows: SLANT_HUMAN_DELTA, ink: "#dfe6f5", logo: "#ffffff", bg: "#0b1733", zoom: 0.62 },
  { id: "kamila", label: "Kamila", rows: SLANT_KAMILA, ink: "#f7d8e3", logo: "#ffffff", bg: "#2a0f1c", zoom: 0.62 },
];

```

### swirl/color.ts

```ts
// Hex → linear-ish 0..1 RGB for shader uniforms / per-cell colors.
export function hexToRgb01(hex: string): [number, number, number] {
  let h = hex.replace("#", "").trim();
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

```

### swirl/default-text.ts

```ts
// Placeholder field text. Lines should be LONG and VARIED in length: rows cycle
// through them and each column samples the line directly, so a long line fills
// the width while a short one leaves an airy gap, and that mix is the look.
export const DEFAULT_TEXT = `design is deciding what to leave out, then defending that emptiness against every well meaning request to fill it back in
clarity beats cleverness
the best interfaces feel inevitable, as if no other arrangement of the same pixels could have been correct
ship small
constraints are where the good ideas hide, so a boring problem usually means you have not found the right constraint yet
make it work, then make it right, then make it fast
taste is patience
a product is a long sequence of small decisions made visible, and the work is to keep making them after everyone got tired
the demo is the spec everyone actually reads
delete more than you add
most complexity is a missing decision wearing a costume, a question pushed downstream until it hardened into architecture
read the code before you replace it
motion should explain something true, where a thing came from or where it went, otherwise it is just expensive confetti
small loops beat big plans
the edges are where the craft shows, the empty states and the errors and the quiet moment right after a click
write it down or it did not happen
build for the person in front of you, not the imaginary average user who wants whatever you already built
opinions are cheap, working software is not
the boring solution is usually the correct one, and the urge to make it interesting is your ego asking for a stage
finish something today`;

```

### swirl/experiment-stage.tsx

```tsx
"use client";

// A compact swirl canvas for the experiments below the main rebuild. Same
// engine, smaller frame. The wrapper matches the main playground's canvas box
// (z-10, shadow, full rounding) so a control Panel can tuck under it. It
// forwards pointer moves (cursor bend) and clicks (shockwave) to the stage.

import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { useSwirlStage, type StageConfig, type StageEvents } from "./use-swirl-stage";

export function ExperimentStage({
  config,
  trackPointer = false,
  burstOnClick = false,
  onClick,
  replayKey,
  events,
  children,
}: {
  config: StageConfig;
  /** Forward normalized pointer (-1..1) to the stage each move (cursor bend). */
  trackPointer?: boolean;
  /** Spawn a shockwave on pointer down at the click point. */
  burstOnClick?: boolean;
  /** Extra click callback (e.g. bump a counter). */
  onClick?: () => void;
  /** Replay the entrance whenever this value changes (e.g. a pattern switch). */
  replayKey?: string | number;
  /** Lifecycle hooks (entrance start / settle / visibility) — e.g. for sound. */
  events?: StageEvents;
  /** Overlay (e.g. a hint line) rendered above the canvas. */
  children?: ReactNode;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cfg = useRef<StageConfig>(config);
  // Sync live config (colors, pattern, sliders) into the ref the frame loop
  // reads every frame, so panel controls update the effect without re-init.
  cfg.current = config;
  const [failed, setFailed] = useState(false);
  // The canvas fades in (opacity only) once it has painted AND is in view, and
  // fades back out when scrolled off the play band, so the idle state shows the
  // dashed placeholder rather than a frozen frame.
  const [painted, setPainted] = useState(false);
  const [inView, setInView] = useState(false);

  // Merge the caller's events with our reveal tracking; keep in a ref so the
  // stage reads the latest without re-initializing.
  const eventsRef = useRef<StageEvents>({});
  eventsRef.current = {
    ...events,
    onFirstFrame: () => {
      setPainted(true);
      events?.onFirstFrame?.();
    },
    onVisible: (v) => {
      setInView(v);
      events?.onVisible?.(v);
    },
  };

  const stage = useSwirlStage(canvasRef, cfg, () => setFailed(true), eventsRef);

  // Restart the formation when replayKey changes (the word condenses again).
  useEffect(() => {
    if (replayKey !== undefined) stage.current.replay();
  }, [replayKey, stage]);

  const norm = (e: PointerEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * 2 - 1,
      y: ((e.clientY - rect.top) / rect.height) * 2 - 1,
    };
  };

  // last pointer position (normalized) for a cheap speed estimate, used to drive
  // the cursor-move sound
  const prevPt = useRef<{ x: number; y: number } | null>(null);
  const handleMove = (e: PointerEvent) => {
    const p = norm(e);
    if (trackPointer) stage.current.setPointer(p);
    const onMove = eventsRef.current.onPointerMove;
    if (onMove) {
      const prev = prevPt.current;
      const speed = prev ? Math.min(1, Math.hypot(p.x - prev.x, p.y - prev.y) * 6) : 0;
      onMove(speed);
    }
    prevPt.current = p;
  };
  const wantsMove = trackPointer || !!events?.onPointerMove;
  const wantsDown = burstOnClick || !!events?.onPointerDown;

  return (
    <div
      // Idle backdrop reads like the Vault "more soon" cards: a light page-bg
      // panel with a dashed hairline border. Before the swirl paints / when it's
      // scrolled off the play band you see that, not a black box. Once the canvas
      // fades in it covers the panel; the solid border returns under it.
      className={`relative z-10 overflow-hidden rounded-xl ${
        painted && inView
          ? "border border-[var(--border-line)] bg-[color-mix(in_srgb,var(--bg-page)_97%,#000)]"
          : "border border-dashed border-[var(--border-line)] bg-[var(--bg-page)]"
      }`}
    >
      {failed ? (
        <div className="flex aspect-[16/9] w-full items-center justify-center px-6 text-center text-[12px] text-[var(--text-tertiary)]">
          WebGL2 unavailable here.
        </div>
      ) : (
        <canvas
          ref={canvasRef}
          style={{ opacity: painted && inView ? 1 : 0 }}
          className={`block aspect-[16/9] w-full transition-opacity duration-500 ease-[var(--ease-out)] motion-reduce:transition-none ${burstOnClick ? "cursor-pointer" : ""}`}
          onPointerMove={wantsMove ? handleMove : undefined}
          onPointerLeave={
            wantsMove
              ? () => {
                  if (trackPointer) stage.current.setPointer(null);
                  prevPt.current = null;
                }
              : undefined
          }
          onPointerDown={
            wantsDown
              ? (e) => {
                  const p = norm(e);
                  if (burstOnClick) stage.current.burst(p.x, p.y);
                  eventsRef.current.onPointerDown?.();
                  onClick?.();
                }
              : undefined
          }
        />
      )}
      {children}
    </div>
  );
}

```



2. You are given the complete source for a self-contained web visual: "Amo hover button".

What it is:
- On [amo](https://amo.co) a small pill button reveals a short video when you hover it, where the word puffs up into glossy 3D letters. The puffy part is only a video, so the button just plays it on hover and resets on leave, which means you can generate your own clip with any AI video model and drop it in.

How to use this code:
- It is a React + TypeScript component tree (Next.js App Router) that renders to an HTML canvas; the entry point is the playground component.
- Drop the files into a project under the same relative paths, mount the playground component, and it runs as-is. No external assets beyond what's inline.
- To adapt it: change the resolved word/logo, the color controls, or the experiment parameters. Ask me to modify, explain, or port any part.
- Original inspiration: https://amo.co

The full source follows, one file per block:

### hover-video/HoverVideoButton.tsx

```tsx
"use client";

// A playful hover-reveal button: a styled pill at rest that, on hover (or tap on
// touch), reveals a short video over itself — bigger than the pill, centered, no
// box/background of its own. The content lives entirely in the clip.
//
// Clips can be TRANSPARENT (alpha): pass `alpha` and the component loads the
// alpha source set (VP9-alpha .webm for Chrome/Firefox, HEVC-alpha .hevc.mp4 for
// Safari) so only the shape floats over the page.
//
// Playback:
//   • forward plays ONCE and holds on the last frame (no loop) when a reverse
//     clip is supplied; otherwise it loops while hovered.
//   • on leave, if a reverse clip exists, it REWINDS FROM THE CURRENT POSITION —
//     the reversed clip is seeked to the mirror of the forward time (D - t) and
//     played, so stopping mid-clip rolls back from exactly there, then hides.
//   • without a reverse clip, it just snaps away.
// Honors prefers-reduced-motion (no reveal).

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { videoSources, mediaUrl } from "../../lib/video-sources";
import { buttonHover, buttonClick, type ButtonSound } from "../../lib/sound";
import { hapticHover, hapticTap } from "../../lib/haptics";

type Variant = "light" | "blue" | "dark";
type Phase = "idle" | "fwd" | "rev";

const BASE =
  "relative z-0 inline-flex cursor-pointer items-center justify-center overflow-hidden rounded-full px-5 py-2.5";

function pill(variant: Variant): { className: string; style: CSSProperties; overlays?: ReactNode; labelStyle?: CSSProperties } {
  if (variant === "blue") {
    return {
      className: `${BASE} text-[15px] font-medium text-white`,
      style: {
        background: "linear-gradient(180deg, #3CB2CD 0%, #1D6EB1 100%)",
        boxShadow:
          "rgba(142,217,255,0.5) 0px -1px 4.1px 0.5px inset, rgb(190,226,255) 0px 0px 4px 0px inset, rgba(43,162,189,0.5) 0px -36px 14.2px -28px inset",
      },
      labelStyle: { textShadow: "0px 1px 2px rgba(0,0,0,0.5)" },
      overlays: (
        <span
          aria-hidden
          className="pointer-events-none absolute left-2.5 right-2.5 top-[-4.5px] h-7 rounded-[500px] bg-gradient-to-t from-white/0 to-white opacity-70 blur-[1px]"
        />
      ),
    };
  }
  if (variant === "dark") {
    return {
      className: `${BASE} text-[14px] font-normal leading-[20px] tracking-[0.02em] text-white/90 backdrop-blur-[6px]`,
      style: { background: "transparent" },
      overlays: (
        <span aria-hidden className="pointer-events-none absolute inset-0" style={{ background: "rgba(0,0,0,0.56)" }}>
          <span className="absolute inset-0" style={{ opacity: 0.12, background: "linear-gradient(180deg, #fff 0%, rgba(255,255,255,0) 100%)" }} />
          <span className="absolute inset-0" style={{ opacity: 0.32, background: "radial-gradient(65.62% 65.62% at 50% 50%, #000 0%, rgba(0,0,0,0) 100%)" }} />
          <span
            className="absolute inset-0"
            style={{
              opacity: 0.24,
              padding: "1px",
              background: "linear-gradient(180deg, #fff 0%, #999 55%, #fff 80%, #999 95%)",
              WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
              WebkitMaskComposite: "xor",
              mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
              maskComposite: "exclude",
            }}
          />
        </span>
      ),
    };
  }
  return {
    className: `${BASE} border border-[var(--border-line)] text-[15px] font-medium text-[#1b1b1b] backdrop-blur-[2px]`,
    style: {
      background: "linear-gradient(180deg, #fff 0%, rgba(255,255,255,0) 100%), #f1f0ea",
      boxShadow: "0 -1px 1.5px 0 rgba(71,58,45,0.12) inset, 0 1.5px 6px rgba(71,58,45,0.06)",
    },
  };
}

function sourcesFor(base: string, alpha: boolean): ReactNode {
  if (alpha) {
    return (
      <>
        <source src={mediaUrl(`${base}.alpha.webm`)} type="video/webm" />
        <source src={mediaUrl(`${base}.alpha.hevc.mp4`)} type='video/mp4; codecs="hvc1"' />
      </>
    );
  }
  return videoSources(base).map((s) => <source key={s.src} src={s.src} type={s.type} />);
}

export function HoverVideoButton({
  label,
  video,
  reverseVideo,
  poster,
  width = 320,
  variant = "light",
  speed = 1,
  alpha = false,
  offsetX = 0,
  offsetY = 0,
  sound,
}: {
  label: string;
  /** forward clip base path without extension, e.g. "/buttons/boop" */
  video: string;
  /** reversed clip base; if set, leave rewinds from the current position */
  reverseVideo?: string;
  poster?: string;
  width?: number;
  variant?: Variant;
  speed?: number;
  alpha?: boolean;
  /** nudge the overlay horizontally (px); positive = right */
  offsetX?: number;
  /** nudge the overlay vertically (px); positive = down */
  offsetY?: number;
  /** per-button synthesized voice for hover + click cues */
  sound?: ButtonSound;
}) {
  const wrapRef = useRef<HTMLElement | null>(null);
  const fwdRef = useRef<HTMLVideoElement>(null);
  const revRef = useRef<HTMLVideoElement>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [reduced] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const hoverable = useRef(true);

  useEffect(() => {
    hoverable.current = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  }, []);

  // --- magnetism (a bit of cursor-follow) + accumulating click-pop scale ---
  // Both are driven by one rAF loop writing the wrapper transform directly, so
  // there are no per-move re-renders. `pop` is a spring toward 0; each click adds
  // an impulse, so spam-clicking stacks the scale up (then it settles back).
  const magTarget = useRef({ x: 0, y: 0 });
  const magCur = useRef({ x: 0, y: 0 });
  const popTarget = useRef(0); // accumulates on click, decays back to 0
  const popPos = useRef(0); // actual scale offset, springs toward the target
  const popVel = useRef(0);
  const rafRef = useRef(0);

  const tick = () => {
    const el = wrapRef.current;
    if (!el) {
      rafRef.current = 0;
      return;
    }
    const tx = magTarget.current.x;
    const ty = magTarget.current.y;
    magCur.current.x += (tx - magCur.current.x) * 0.2;
    magCur.current.y += (ty - magCur.current.y) * 0.2;
    // pop: the target bumps up on each click and decays back; the actual scale
    // springs toward it (slightly underdamped, so each click gives a little bounce).
    popTarget.current *= 0.9;
    if (popTarget.current < 0.001) popTarget.current = 0;
    popVel.current += (popTarget.current - popPos.current) * 0.22;
    popVel.current *= 0.68;
    popPos.current += popVel.current;
    const s = 1 + popPos.current;
    el.style.transform = `translate(${magCur.current.x.toFixed(2)}px, ${magCur.current.y.toFixed(2)}px) scale(${s.toFixed(3)})`;
    const restMag = Math.abs(tx - magCur.current.x) < 0.08 && Math.abs(ty - magCur.current.y) < 0.08;
    const restPop =
      popTarget.current === 0 && Math.abs(popPos.current) < 0.001 && Math.abs(popVel.current) < 0.001;
    if (restMag && restPop && tx === 0 && ty === 0) {
      el.style.transform = "";
      rafRef.current = 0;
    } else {
      rafRef.current = requestAnimationFrame(tick);
    }
  };
  const wake = () => {
    if (!rafRef.current) rafRef.current = requestAnimationFrame(tick);
  };
  const popClick = () => {
    if (reduced) return;
    popTarget.current = Math.min(popTarget.current + 0.06, 0.28); // subtle stack (decays back)
    wake();
  };

  // Magnetism only: while the cursor is in the box, the button drifts a little
  // toward it. The hover REVEAL itself triggers on the pill (below), not here.
  useEffect(() => {
    if (reduced) return;
    const box = wrapRef.current?.parentElement;
    if (!box) return;
    const STRENGTH = 0.1;
    const MAX = 9;
    const clamp = (v: number) => Math.max(-MAX, Math.min(MAX, v));
    const onMove = (e: PointerEvent) => {
      const r = box.getBoundingClientRect();
      magTarget.current.x = clamp((e.clientX - (r.left + r.width / 2)) * STRENGTH);
      magTarget.current.y = clamp((e.clientY - (r.top + r.height / 2)) * STRENGTH);
      wake();
    };
    const onLeave = () => {
      magTarget.current.x = 0;
      magTarget.current.y = 0;
      wake();
    };
    box.addEventListener("pointermove", onMove);
    box.addEventListener("pointerleave", onLeave);
    return () => {
      box.removeEventListener("pointermove", onMove);
      box.removeEventListener("pointerleave", onLeave);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced]);

  // Reveal on the pill itself (not a bigger area).
  const enter = () => {
    if (reduced) return;
    setPhase("fwd");
  };
  const leave = () => {
    if (reduced) return;
    setPhase(reverseVideo ? "rev" : "idle");
  };

  useEffect(() => {
    if (reduced) return;
    const fwd = fwdRef.current;
    const rev = revRef.current;
    if (!fwd) return;

    if (phase === "fwd") {
      rev?.pause();
      fwd.currentTime = 0;
      fwd.playbackRate = speed;
      fwd.play().catch(() => {});
    } else if (phase === "rev" && rev) {
      // rewind from where the forward clip currently is: mirror the time.
      const D = fwd.duration || rev.duration || 0;
      const t = Math.min(fwd.currentTime || 0, D);
      fwd.pause();
      rev.currentTime = Math.max(0, D - t);
      rev.playbackRate = speed * 1.3; // exit 30% faster than the entrance
      rev.play().catch(() => {});
    } else {
      // idle: pause, and snap the FORWARD clip back to frame 0 (its deflated /
      // resting frame). Otherwise, when the reverse ends and the forward layer
      // becomes visible again under the hide, it would flash the mid-inflate
      // frame we left off at. Do NOT reset the REVERSE clip — its frame 0 is the
      // puffed state, which would flash instead.
      fwd.pause();
      fwd.currentTime = 0;
      rev?.pause();
    }
  }, [phase, speed, reduced]);

  // Spring the SPEED itself: while the forward clip plays, ride playbackRate on a
  // damped wobble around the set speed (a springy entrance), then EASE IT DOWN
  // into the final frame so the puff decelerates as it settles. Your speed holds
  // for the middle; the spring is early, the slowdown is the tail.
  useEffect(() => {
    if (reduced || phase !== "fwd") return;
    const el = fwdRef.current;
    if (!el) return;
    const AMP = 0.6, DECAY = 3.5, FREQ = 11; // entrance spring
    const TAIL = 0.6, SLOW = 0.62;           // tail slowdown (start, amount)
    let raf = 0;
    const tick = () => {
      if (el.ended) return;
      const D = el.duration || 1;
      const p = Math.min(1, (el.currentTime || 0) / D); // progress 0..1
      const wobble = 1 + AMP * Math.exp(-DECAY * p) * Math.sin(FREQ * p);
      const tp = Math.max(0, (p - TAIL) / (1 - TAIL)); // 0..1 across the tail
      const ease = tp * tp * (3 - 2 * tp);             // smoothstep
      const slow = 1 - SLOW * ease;                    // 1 -> 1-SLOW near the end
      el.playbackRate = Math.max(0.25, speed * wobble * slow);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase, speed, reduced]);

  // Warm the clips up shortly after mount: a quick muted play -> pause forces the
  // browser to download AND decode the first frames, so the first hover plays
  // instantly instead of waiting on the network/decoder. The videos are hidden
  // (overlay opacity 0 at rest), so this is invisible.
  useEffect(() => {
    if (reduced) return;
    let cancelled = false;
    const warm = (v: HTMLVideoElement | null) => {
      if (!v) return;
      v.muted = true;
      const p = v.play();
      if (p) {
        p.then(() => {
          if (cancelled) return;
          v.pause();
          v.currentTime = 0;
        }).catch(() => {});
      }
    };
    const id = window.setTimeout(() => {
      warm(fwdRef.current);
      warm(revRef.current);
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [reduced]);

  // touch: tapping outside the pill resets (rewinds)
  useEffect(() => {
    if (phase === "idle" || hoverable.current) return;
    const onDoc = (e: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) leave();
    };
    document.addEventListener("pointerdown", onDoc);
    return () => document.removeEventListener("pointerdown", onDoc);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const setWrap = (el: HTMLElement | null) => {
    wrapRef.current = el;
  };

  const fwd = (
    <video
      ref={fwdRef}
      muted
      playsInline
      preload="auto"
      loop={!reverseVideo}
      poster={poster}
      className="block h-auto w-full"
      style={{ opacity: phase === "rev" ? 0 : 1 }}
    >
      {sourcesFor(video, alpha)}
    </video>
  );
  const rev = reverseVideo ? (
    <video
      ref={revRef}
      muted
      playsInline
      preload="auto"
      onEnded={() => setPhase("idle")}
      className="absolute inset-0 block h-auto w-full"
      style={{ opacity: phase === "rev" ? 1 : 0 }}
    >
      {sourcesFor(reverseVideo, alpha)}
    </video>
  ) : null;

  // A real CSS button at rest; the clip plays over it on hover. Instant swap.
  const p = pill(variant);
  const visible = phase !== "idle" && !reduced;

  return (
    <div
      ref={setWrap}
      className="relative inline-flex cursor-pointer"
      onPointerEnter={() => {
        if (!hoverable.current) return;
        enter();
        if (sound) buttonHover(sound);
        hapticHover();
      }}
      onPointerLeave={() => hoverable.current && leave()}
      onPointerDown={() => {
        if (sound) buttonClick(sound);
        hapticTap();
        popClick();
      }}
    >
      <button
        type="button"
        onClick={() => {
          if (hoverable.current) return;
          if (phase === "fwd") leave();
          else enter();
        }}
        className={p.className}
        style={{ ...p.style, opacity: visible ? 0 : 1 }}
      >
        {p.overlays}
        <span className="relative z-10" style={p.labelStyle}>
          {label}
        </span>
      </button>

      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 z-10"
        style={{
          width: `min(${width}px, 78vw)`,
          opacity: visible ? 1 : 0,
          transform: `translate(calc(-50% + ${offsetX}px), calc(-50% + ${offsetY}px))`,
        }}
      >
        {fwd}
        {rev}
      </div>
    </div>
  );
}

```

### app/lib/video-sources.ts

```ts
// A Vault clip is encoded into three formats (see scripts/optimize-video.sh):
// AV1/WebM (smallest, modern browsers), VP9/WebM (Chrome/Firefox/Edge), and an
// H.264/MP4 universal fallback. Given the base path (no extension), build the
// <source> list in best-to-worst order so the browser picks the first format it
// can play and downloads only that one.
//
// Videos are served from Cloudflare R2 (zero egress) instead of Vercel's edge, so
// a viral spike doesn't burn Vercel bandwidth/edge requests. Defaults to the R2
// public bucket URL so prod uses R2 with no env config; override with
// NEXT_PUBLIC_MEDIA_BASE if the bucket URL changes, or set it to "" to serve from
// same-origin /public (useful for local dev without network).
const R2_MEDIA_BASE = "https://pub-58a0dfd4417141169bd84ab545cd7830.r2.dev";

// Public media base (no trailing slash). Empty string = serve from /public.
export const MEDIA_BASE = (process.env.NEXT_PUBLIC_MEDIA_BASE ?? R2_MEDIA_BASE).replace(/\/$/, "");

// The origin (scheme + host) media is served from, or "" when serving same-origin
// from /public. Used to preconnect the CDN early so the first video isn't stalled
// on DNS+TLS. Derived from MEDIA_BASE so it stays in sync automatically.
export const MEDIA_ORIGIN = (() => {
  if (!MEDIA_BASE) return "";
  try {
    return new URL(MEDIA_BASE).origin;
  } catch {
    return "";
  }
})();

// Resolve a /public-relative media path to its served URL (R2 in prod, local in dev).
// Pass a leading-slash path like "/vault/amo.mp4".
export function mediaUrl(path: string): string {
  return MEDIA_BASE ? `${MEDIA_BASE}${path}` : path;
}

export interface VideoSource {
  src: string;
  type: string;
}

export function videoSources(base: string): VideoSource[] {
  return [
    { src: mediaUrl(`${base}.av1.webm`), type: 'video/webm; codecs="av01.0.05M.08"' },
    { src: mediaUrl(`${base}.vp9.webm`), type: 'video/webm; codecs="vp9"' },
    { src: mediaUrl(`${base}.mp4`), type: "video/mp4" },
  ];
}

```


3. You are given the complete source for a self-contained web visual: "Figma vector editor".

What it is:
- You know that Figma look everyone copies: the thin blue box around a thing, the little corner squares, the size tag under it, and the dots you grab to bend a shape. I wanted to see if I could build it for the web, so here it is.
- It is two small parts. One draws the blue box and the size tag around anything. The other lets you grab the dots on a shape and drag them to change it, then gives you the new path back. It is pretty raw, just a fun little experiment, but it works and you can take it.

How to use this code:
- It is a React + TypeScript component tree (Next.js App Router) that renders to an HTML canvas; the entry point is the playground component.
- Drop the files into a project under the same relative paths, mount the playground component, and it runs as-is. No external assets beyond what's inline.
- To adapt it: change the resolved word/logo, the color controls, or the experiment parameters. Ask me to modify, explain, or port any part.
- Original inspiration: https://figma.com

The full source follows, one file per block:

### svg-editor/standalone/types.ts

```ts
// The editable vector model. An SVG <path> is broken into ANCHOR points, each
// with up to two bezier control HANDLES (the "in" tangent from the previous
// segment and the "out" tangent toward the next). A path may contain several
// SUBPATHS (the word "arlan" is many glyphs; a shape with a hole is an outer ring
// plus an inner ring). Anchors are kept in ONE flat array; `starts` marks where
// each subpath begins and `closed` is the per-subpath Z flag. Serializing back to
// a path `d` string is lossless for the cubic/line subset we support.

export interface Vec {
  x: number;
  y: number;
}

export interface Anchor {
  /** Anchor position. */
  p: Vec;
  /** Outgoing control handle (toward the next anchor), absolute coords. null = straight. */
  out: Vec | null;
  /** Incoming control handle (from the previous anchor), absolute coords. null = straight. */
  in: Vec | null;
}

export interface VectorPath {
  /** All anchors of every subpath, concatenated. */
  anchors: Anchor[];
  /** Flat index where each subpath begins. `starts[0]` is always 0. Subpath `s`
   *  owns anchors `[starts[s], starts[s+1])` (or to the end for the last). */
  starts: number[];
  /** Per-subpath: does this subpath close back to its first anchor (Z)? */
  closed: boolean[];
}

export const v = (x: number, y: number): Vec => ({ x, y });
export const add = (a: Vec, b: Vec): Vec => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a: Vec, b: Vec): Vec => ({ x: a.x - b.x, y: a.y - b.y });
export const dist = (a: Vec, b: Vec): number => Math.hypot(a.x - b.x, a.y - b.y);

/** [begin, end) flat-anchor range of subpath `s`. */
export function subRange(path: VectorPath, s: number): [number, number] {
  const begin = path.starts[s];
  const end = s + 1 < path.starts.length ? path.starts[s + 1] : path.anchors.length;
  return [begin, end];
}

```

### svg-editor/standalone/parse.ts

```ts
// Parse an SVG path `d` string into our editable anchor model, and serialize it
// back. We support the common subset: M/L/H/V/C/S/Q/T/Z (absolute + relative).
// Arcs (A) are not control-point editable, so a path using them is rejected by
// the playground with a friendly message. Everything is normalized to cubic
// beziers internally so the editor only ever deals with anchors + two handles.
//
// Multi-subpath: every `M` opens a new subpath. Anchors stay in one flat array;
// `starts` marks each subpath's first index and `closed` is its per-subpath Z.

import type { Anchor, Vec, VectorPath } from "./types";
import { v, subRange } from "./types";

// Tokenize a `d` string into [command, ...numbers] groups.
function tokenize(d: string): { cmd: string; args: number[] }[] {
  const out: { cmd: string; args: number[] }[] = [];
  const re = /([MmLlHhVvCcSsQqTtAaZz])|(-?\d*\.?\d+(?:e[-+]?\d+)?)/gi;
  let m: RegExpExecArray | null;
  let cur: { cmd: string; args: number[] } | null = null;
  while ((m = re.exec(d))) {
    if (m[1]) {
      cur = { cmd: m[1], args: [] };
      out.push(cur);
    } else if (cur) {
      cur.args.push(parseFloat(m[2]));
    }
  }
  return out;
}

/** Parse a path into the flat multi-subpath model. Throws on unsupported (arc) commands. */
export function parsePath(d: string): VectorPath {
  const tokens = tokenize(d);
  const anchors: Anchor[] = [];
  const starts: number[] = [];
  const closed: boolean[] = [];

  let cur: Vec = v(0, 0);
  let start: Vec = v(0, 0); // current subpath's start point (for Z)
  let prevCtrl: Vec | null = null;
  let prevCmd = "";

  const push = (p: Vec) => anchors.push({ p, out: null, in: null });
  const last = () => anchors[anchors.length - 1];

  // Drop the duplicate trailing anchor a closed subpath often repeats, folding
  // its `in` handle onto the subpath's first anchor (matches old single-ring code).
  const dedupClose = () => {
    if (!starts.length) return;
    const si = starts[starts.length - 1];
    if (anchors.length - si > 1) {
      const a = anchors[si].p;
      const z = anchors[anchors.length - 1].p;
      if (Math.abs(a.x - z.x) < 0.01 && Math.abs(a.y - z.y) < 0.01) {
        anchors[si].in = anchors[anchors.length - 1].in;
        anchors.pop();
      }
    }
  };

  for (const { cmd, args } of tokens) {
    const rel = cmd === cmd.toLowerCase();
    const C = cmd.toUpperCase();
    let i = 0;
    const num = () => args[i++];
    const pt = (): Vec => {
      const x = num();
      const y = num();
      return rel ? { x: cur.x + x, y: cur.y + y } : { x, y };
    };

    switch (C) {
      case "M": {
        // A new M opens a NEW subpath. Finalize the previous one (dedup if it was
        // closed by a Z) before starting fresh.
        if (starts.length && closed[closed.length - 1]) dedupClose();
        cur = pt();
        start = cur;
        starts.push(anchors.length);
        closed.push(false);
        push(cur);
        // extra coordinate pairs after M are implicit L
        while (i < args.length) {
          cur = pt();
          push(cur);
        }
        prevCtrl = null;
        break;
      }
      case "L": {
        while (i < args.length) { cur = pt(); push(cur); }
        prevCtrl = null;
        break;
      }
      case "H": {
        while (i < args.length) {
          const x = num();
          cur = { x: rel ? cur.x + x : x, y: cur.y };
          push(cur);
        }
        prevCtrl = null;
        break;
      }
      case "V": {
        while (i < args.length) {
          const y = num();
          cur = { x: cur.x, y: rel ? cur.y + y : y };
          push(cur);
        }
        prevCtrl = null;
        break;
      }
      case "C": {
        while (i < args.length) {
          const c1 = pt();
          const c2 = pt();
          const end = pt();
          last().out = c1;
          push(end);
          last().in = c2;
          cur = end;
          prevCtrl = c2;
        }
        break;
      }
      case "S": {
        while (i < args.length) {
          const c1: Vec =
            prevCmd === "C" || prevCmd === "S"
              ? { x: 2 * cur.x - (prevCtrl?.x ?? cur.x), y: 2 * cur.y - (prevCtrl?.y ?? cur.y) }
              : cur;
          const c2 = pt();
          const end = pt();
          last().out = c1;
          push(end);
          last().in = c2;
          cur = end;
          prevCtrl = c2;
        }
        break;
      }
      case "Q": {
        while (i < args.length) {
          const qc = pt();
          const end = pt();
          const c1 = { x: cur.x + (2 / 3) * (qc.x - cur.x), y: cur.y + (2 / 3) * (qc.y - cur.y) };
          const c2 = { x: end.x + (2 / 3) * (qc.x - end.x), y: end.y + (2 / 3) * (qc.y - end.y) };
          last().out = c1;
          push(end);
          last().in = c2;
          cur = end;
          prevCtrl = qc;
        }
        break;
      }
      case "T": {
        while (i < args.length) {
          const qc: Vec =
            prevCmd === "Q" || prevCmd === "T"
              ? { x: 2 * cur.x - (prevCtrl?.x ?? cur.x), y: 2 * cur.y - (prevCtrl?.y ?? cur.y) }
              : cur;
          const end = pt();
          const c1 = { x: cur.x + (2 / 3) * (qc.x - cur.x), y: cur.y + (2 / 3) * (qc.y - cur.y) };
          const c2 = { x: end.x + (2 / 3) * (qc.x - end.x), y: end.y + (2 / 3) * (qc.y - end.y) };
          last().out = c1;
          push(end);
          last().in = c2;
          cur = end;
          prevCtrl = qc;
        }
        break;
      }
      case "Z": {
        if (closed.length) closed[closed.length - 1] = true;
        cur = start;
        prevCtrl = null;
        break;
      }
      case "A":
        throw new Error("Arc commands (A) aren't supported by the point editor.");
      default:
        throw new Error(`Unsupported path command: ${cmd}`);
    }
    prevCmd = C;
  }

  // Finalize the trailing subpath.
  if (starts.length && closed[closed.length - 1]) dedupClose();

  return { anchors, starts, closed };
}

const n = (x: number) => {
  // trim to 2 decimals, drop trailing zeros
  const r = Math.round(x * 100) / 100;
  return String(r);
};

/** Serialize the flat model back to a path `d` string (one M…(Z) run per subpath). */
export function serializePath(path: VectorPath): string {
  const { anchors, starts, closed } = path;
  if (!anchors.length || !starts.length) return "";
  const parts: string[] = [];

  for (let s = 0; s < starts.length; s++) {
    const [begin, end] = subRange(path, s);
    const count = end - begin;
    if (count === 0) continue;
    const isClosed = closed[s];

    parts.push(`M ${n(anchors[begin].p.x)} ${n(anchors[begin].p.y)}`);
    const segCount = isClosed ? count : count - 1;
    for (let k = 0; k < segCount; k++) {
      const a = anchors[begin + k];
      const b = anchors[begin + ((k + 1) % count)];
      if (a.out || b.in) {
        const c1 = a.out ?? a.p;
        const c2 = b.in ?? b.p;
        parts.push(`C ${n(c1.x)} ${n(c1.y)} ${n(c2.x)} ${n(c2.y)} ${n(b.p.x)} ${n(b.p.y)}`);
      } else {
        parts.push(`L ${n(b.p.x)} ${n(b.p.y)}`);
      }
    }
    if (isClosed) parts.push("Z");
  }
  return parts.join(" ");
}

/** Axis-aligned bounding box over all anchors + handles of every subpath. */
export function bounds(path: VectorPath): { x: number; y: number; w: number; h: number } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const eat = (p: Vec) => {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  };
  for (const a of path.anchors) {
    eat(a.p);
    if (a.in) eat(a.in);
    if (a.out) eat(a.out);
  }
  if (!isFinite(minX)) return { x: 0, y: 0, w: 0, h: 0 };
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

```

### svg-editor/standalone/FigmaFrame.tsx

```tsx
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

```

### svg-editor/standalone/VectorEditor.tsx

```tsx
"use client";

// VectorEditor — a live SVG bezier editor. It draws the path and overlays the
// editable rig on top: every ANCHOR is a draggable dot, every bezier HANDLE is a
// draggable diamond joined to its anchor by a thin "arm" line (exactly the rig
// Figma/Framer show when you enter a vector shape). Drag an anchor to move it
// (its handles come along); drag a handle to reshape the curve. By default the
// two handles of an anchor stay mirrored (smooth point) — hold Alt while
// dragging a handle to break the tangent and make a corner.
//
// Pure pointer math, no deps. Coordinates are the SVG's own user units; we map
// screen → user space through the live CTM so it stays correct at any size.

import { useRef, type PointerEvent as RPointerEvent } from "react";
import type { Anchor, Vec, VectorPath } from "./types";
import { serializePath } from "./parse";
import { sub, add } from "./types";

// How an anchor's two bezier handles relate while you drag one (matches Figma's
// Mirroring setting). Hold Alt while dragging to momentarily force "none".
export type Mirror = "none" | "angle" | "angle-length";

export interface EditorStyle {
  accent: string;
  arm: string;        // tangent-line color
  anchorR: number;    // anchor dot radius (user units)
  handleR: number;    // handle diamond half-size (user units)
  pointFill: string;  // dot/diamond fill
  fill: string;       // path fill
  fillOpacity: number;
  stroke: string;     // path stroke
  strokeWidth: number;
  showRig: boolean;   // hide all points → just the shape
  fillRule: "nonzero" | "evenodd"; // evenodd cuts holes from inner subpaths
}

export const DEFAULT_EDITOR: EditorStyle = {
  accent: "#0d99ff",
  arm: "#9bb7d4",
  anchorR: 4,
  handleR: 3.2,
  pointFill: "#ffffff",
  fill: "#0d99ff",
  fillOpacity: 0.08,
  stroke: "#0d99ff",
  strokeWidth: 1.5,
  showRig: true,
  fillRule: "evenodd",
};

type Drag =
  | { kind: "anchor"; i: number }
  | { kind: "handle"; i: number; side: "in" | "out"; mirror: Mirror };

export function VectorEditor({
  path,
  onChange,
  style = DEFAULT_EDITOR,
  mirror = "angle-length",
  viewBox,
  width,
  height,
  className,
}: {
  path: VectorPath;
  onChange: (next: VectorPath) => void;
  style?: EditorStyle;
  /** Default handle-mirroring mode; Alt-drag temporarily forces "none". */
  mirror?: Mirror;
  /** [minX, minY, width, height] of the SVG viewBox. */
  viewBox: [number, number, number, number];
  /** Rendered pixel size. Defaults to the viewBox's own width/height. */
  width?: number;
  height?: number;
  className?: string;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<Drag | null>(null);
  // latest path (so a coalesced rAF reads current state, not a stale closure)
  const pathRef = useRef(path);
  pathRef.current = path;
  const pending = useRef<Vec | null>(null);
  const rafMove = useRef(0);

  // map a pointer event to SVG user-space coordinates via the live screen CTM
  function toUser(e: { clientX: number; clientY: number }): Vec {
    const svg = svgRef.current!;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const u = pt.matrixTransform(ctm.inverse());
    return { x: u.x, y: u.y };
  }

  function startAnchor(e: RPointerEvent, i: number) {
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    drag.current = { kind: "anchor", i };
  }
  function startHandle(e: RPointerEvent, i: number, side: "in" | "out") {
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    // Alt overrides the active mode to a free corner.
    drag.current = { kind: "handle", i, side, mirror: e.altKey ? "none" : mirror };
  }

  // Apply a drag at user-space point u against the current path → next path.
  function applyDrag(d: Drag, u: Vec): VectorPath {
    const anchors = pathRef.current.anchors.map((a) => ({
      p: { ...a.p },
      in: a.in ? { ...a.in } : null,
      out: a.out ? { ...a.out } : null,
    })) as Anchor[];

    if (d.kind === "anchor") {
      const a = anchors[d.i];
      const delta = sub(u, a.p);
      a.p = u;
      if (a.in) a.in = add(a.in, delta);
      if (a.out) a.out = add(a.out, delta);
    } else {
      const a = anchors[d.i];
      if (d.side === "out") a.out = u;
      else a.in = u;
      const other = d.side === "out" ? a.in : a.out;
      if (d.mirror !== "none" && other) {
        const rel = sub(u, a.p);
        const relLen = Math.hypot(rel.x, rel.y) || 1;
        const len =
          d.mirror === "angle-length" ? relLen : Math.hypot(other.x - a.p.x, other.y - a.p.y);
        const opp = { x: a.p.x - (rel.x / relLen) * len, y: a.p.y - (rel.y / relLen) * len };
        if (d.side === "out") a.in = opp;
        else a.out = opp;
      }
    }
    return { anchors, starts: pathRef.current.starts, closed: pathRef.current.closed };
  }

  // Coalesce rapid pointermove events to ONE commit per animation frame, so a
  // fast drag doesn't fire dozens of re-renders between paints.
  function onMove(e: RPointerEvent) {
    if (!drag.current) return;
    pending.current = toUser(e);
    if (rafMove.current) return;
    rafMove.current = requestAnimationFrame(() => {
      rafMove.current = 0;
      const d = drag.current;
      const u = pending.current;
      if (!d || !u) return;
      onChange(applyDrag(d, u));
    });
  }

  function endDrag(e: RPointerEvent) {
    if (drag.current) {
      // flush any pending coalesced move so the final position isn't dropped
      if (rafMove.current) {
        cancelAnimationFrame(rafMove.current);
        rafMove.current = 0;
        const u = pending.current;
        if (u) onChange(applyDrag(drag.current, u));
      }
      try {
        (e.target as Element).releasePointerCapture(e.pointerId);
      } catch {
        /* capture may already be gone */
      }
      drag.current = null;
      pending.current = null;
    }
  }

  const s = style;
  const d = serializePath(path);

  // tangent arm segments to draw (anchor → handle)
  const arms: { ax: number; ay: number; hx: number; hy: number }[] = [];
  if (s.showRig) {
    for (const a of path.anchors) {
      if (a.out) arms.push({ ax: a.p.x, ay: a.p.y, hx: a.out.x, hy: a.out.y });
      if (a.in) arms.push({ ax: a.p.x, ay: a.p.y, hx: a.in.x, hy: a.in.y });
    }
  }

  return (
    <svg
      ref={svgRef}
      viewBox={viewBox.join(" ")}
      width={width ?? viewBox[2]}
      height={height ?? viewBox[3]}
      className={className}
      style={{ display: "block", touchAction: "none", userSelect: "none", overflow: "visible" }}
      onPointerMove={onMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      {/* the shape itself */}
      <path d={d} fill={s.fill} fillRule={s.fillRule} fillOpacity={s.fillOpacity} stroke={s.stroke} strokeWidth={s.strokeWidth} />

      {s.showRig && (
        <g>
          {/* tangent arms */}
          <g stroke={s.arm} strokeWidth={Math.max(0.75, s.strokeWidth * 0.6)}>
            {arms.map((a, k) => (
              <line key={k} x1={a.ax} y1={a.ay} x2={a.hx} y2={a.hy} />
            ))}
          </g>

          {/* bezier handles (diamonds) */}
          {path.anchors.map((a, i) => (
            <g key={`h-${i}`}>
              {a.out && (
                <Diamond
                  cx={a.out.x}
                  cy={a.out.y}
                  r={s.handleR}
                  fill={s.pointFill}
                  stroke={s.accent}
                  onPointerDown={(e) => startHandle(e, i, "out")}
                />
              )}
              {a.in && (
                <Diamond
                  cx={a.in.x}
                  cy={a.in.y}
                  r={s.handleR}
                  fill={s.pointFill}
                  stroke={s.accent}
                  onPointerDown={(e) => startHandle(e, i, "in")}
                />
              )}
            </g>
          ))}

          {/* anchors on top so they win the hit-test */}
          {path.anchors.map((a, i) => (
            <g key={`a-${i}`} style={{ cursor: "grab" }} onPointerDown={(e) => startAnchor(e, i)}>
              {/* fat invisible hit target */}
              <circle cx={a.p.x} cy={a.p.y} r={s.anchorR * 3} fill="transparent" />
              <circle cx={a.p.x} cy={a.p.y} r={s.anchorR} fill={s.pointFill} stroke={s.accent} strokeWidth={1.25} />
            </g>
          ))}
        </g>
      )}
    </svg>
  );
}

function Diamond({
  cx,
  cy,
  r,
  fill,
  stroke,
  onPointerDown,
}: {
  cx: number;
  cy: number;
  r: number;
  fill: string;
  stroke: string;
  onPointerDown: (e: RPointerEvent) => void;
}) {
  return (
    <g style={{ cursor: "grab" }} onPointerDown={onPointerDown}>
      <circle cx={cx} cy={cy} r={r * 3.5} fill="transparent" />
      <rect
        x={cx - r}
        y={cy - r}
        width={r * 2}
        height={r * 2}
        fill={fill}
        stroke={stroke}
        strokeWidth={1.1}
        style={{ transform: "rotate(45deg)", transformOrigin: "50% 50%", transformBox: "fill-box" }}
      />
    </g>
  );
}

```


4. You are given the complete source for a self-contained web visual: "Dia Browser's gradient".

What it is:
- Dia Browser has a soft glow at the bottom of the screen. A row of blurry colour bars, short on the sides and tall in the middle, going from dark up through blue, white, yellow, red and pink, then fading out at the top. It grows up from the floor when the page loads.
- It is simpler than it looks. Just a few tall rectangles in one small SVG, all painted with the same rainbow and blurred a lot so they melt together. It starts flat at the bottom and scales up to full height, so it looks like it rises from the floor. Below you can change the bars, the blur, the curve and the colours.

How to use this code:
- It is a React + TypeScript component tree (Next.js App Router) that renders to an HTML canvas; the entry point is the playground component.
- Drop the files into a project under the same relative paths, mount the playground component, and it runs as-is. No external assets beyond what's inline.
- To adapt it: change the resolved word/logo, the color controls, or the experiment parameters. Ask me to modify, explain, or port any part.
- Original inspiration: https://www.diabrowser.com

The full source follows, one file per block:

### dia-gradient/standalone/DiaGradient.tsx

```tsx
"use client";

// Dia Browser's signature gradient — a self-contained drop-in.
//
// A row of N tall, heavily-blurred columns share one vertical rainbow gradient
// and are arranged in a symmetric bell curve (short at the edges, tallest in the
// middle). The whole field is anchored to the bottom and RISES UP on mount via a
// scaleY(0) → 1 transform (transform-origin: bottom), so it unfurls from the
// floor like an aurora. It's one inline <svg> — no canvas, no per-frame work.
//
// Usage:
//   <div className="fixed inset-x-0 bottom-0 h-[55vh] pointer-events-none -z-10">
//     <DiaGradient />
//   </div>

import { useEffect, useState } from "react";

type Stop = { offset: number; color: string };

// Dia's stops, bottom (0) → top (1): dark ember → blue → near-white → yellow →
// red-orange → magenta → transparent pink.
const DIA_STOPS: Stop[] = [
  { offset: 0, color: "#340B05" },
  { offset: 0.1827, color: "#0358F7" },
  { offset: 0.2837, color: "#5092C7" },
  { offset: 0.4135, color: "#E1ECFE" },
  { offset: 0.5866, color: "#FFD400" },
  { offset: 0.6827, color: "#FA3D1D" },
  { offset: 0.8029, color: "#FD02F5" },
  { offset: 1, color: "#FFC0FD00" },
];

const VBW = 1271;
const VBH = 599;

// Height curve fitted to the real Dia footer: a gentle power falloff (not a
// cosine bell), giving the flatter, pyramid-like rise of the original.
function bellHeights(n: number, peak: number, valley: number): number[] {
  const out: number[] = [];
  const mid = (n - 1) / 2;
  for (let i = 0; i < n; i++) {
    const t = mid === 0 ? 0 : Math.abs(i - mid) / mid; // 0 center → 1 edge
    const eased = 1 - Math.pow(t, 1.24); // 1 at center → 0 at edge
    out.push(peak * VBH * (valley + (1 - valley) * eased));
  }
  return out;
}

export function DiaGradient({
  bars = 9,
  blur = 15,
  peak = 0.98,
  valley = 0.55,
  stops = DIA_STOPS,
  riseMs = 1100,
}: {
  bars?: number;
  blur?: number;
  peak?: number;
  valley?: number;
  stops?: Stop[];
  riseMs?: number;
}) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() =>
      requestAnimationFrame(() => setShown(true)),
    );
    return () => cancelAnimationFrame(id);
  }, []);

  const heights = bellHeights(bars, peak, valley);
  const colW = VBW / bars;

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
      <svg
        style={{ height: "100%", width: "100%" }}
        viewBox={`0 0 ${VBW} ${VBH}`}
        preserveAspectRatio="none"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* objectBoundingBox units (default): the gradient maps to each rect's
              own box, so every bar shows the full rainbow over its own height —
              a field of full-rainbow columns, the way the real Dia footer does it. */}
          <linearGradient id="dia-grad" x1="0" y1="1" x2="0" y2="0">
            {stops.map((s, i) => (
              <stop key={i} offset={s.offset} stopColor={s.color} />
            ))}
          </linearGradient>
          <filter id="dia-blur" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation={blur} />
          </filter>
        </defs>
        {heights.map((h, i) => (
          <g key={i} filter="url(#dia-blur)">
            <rect
              x={i * colW}
              y={VBH - h}
              width={colW * 1.23}
              height={h}
              fill="url(#dia-grad)"
            />
          </g>
        ))}
      </svg>
    </div>
  );
}

```

### dia-gradient/standalone/PeakedGradient.tsx

```tsx
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

```

### dia-gradient/standalone/DodgeGradient.tsx

```tsx
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

```


5. You are given the complete source for a self-contained web visual: "Symbols effect".

What it is:
- Drop in an image or a video and it gets cut into four brightness bands. Each band is stamped with a tiny symbol, tinted with its own colour, so the picture is rebuilt out of little marks. It all runs on the GPU, so video plays through it live.
- The symbols, the colours and where the bands split are yours to change. When it looks right you can save a still as a PNG or record the whole thing as a video.
- It runs entirely in the browser, nothing gets uploaded, and you can grab the code below and drop the renderer into your own project.

How to use this code:
- It is a React + TypeScript component tree (Next.js App Router) that renders to an HTML canvas; the entry point is the playground component.
- Drop the files into a project under the same relative paths, mount the playground component, and it runs as-is. No external assets beyond what's inline.
- To adapt it: change the resolved word/logo, the color controls, or the experiment parameters. Ask me to modify, explain, or port any part.

The full source follows, one file per block:

### sandbox/shaders.ts

```ts
// Symbols effect shader — authored from first principles. A photo or video frame is
// pixelated into a grid of cells; each cell's luminance is bucketed into one of four
// brightness bands; and that band's symbol glyph (tiled once per cell) is stamped,
// tinted with the band's colour over a white ground. The result is a halftone built
// out of little marks.

export const SANDBOX_VERT = /* glsl */ `
precision highp float;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const SANDBOX_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;

uniform sampler2D src;
uniform vec2 resolution;
uniform vec2 srcScale;     // cover-crop of the source (<=1 on the cropped axis)
uniform float zoom;        // user zoom: >1 scales the source up, <1 shrinks it
uniform vec3 bgColor;      // colour shown around a shrunk source (the background)
uniform float cell;        // pixel cell size (px)

uniform vec3 bandColor[4];  // current colour per brightness band (the "to" preset)
uniform vec3 bandColorB[4]; // previous colour per band (the "from" preset)
uniform float bandLo[4];    // band lower bound (inclusive)
uniform float bandHi[4];    // band upper bound (inclusive)
uniform sampler2D glyph[4];  // current symbol per band
uniform sampler2D glyphB[4]; // previous symbol per band
uniform float morphT;        // 0 = fully previous, 1 = fully current (crossfade)

float lum(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

// map a full-frame uv into the COVER-cropped + user-zoomed source (centred). zoom
// >1 magnifies; zoom <1 shrinks the source so background shows around it.
vec2 cover(vec2 uv) {
  return (uv - 0.5) * srcScale / zoom + 0.5;
}

// snap a uv to the centre of its cell, so a whole cell reads one source colour
vec2 cellUV(vec2 step) {
  return floor(vUv / step) * step + step * 0.5;
}

vec4 sampleGlyph(int i, vec2 uv) {
  if (i == 0) return texture2D(glyph[0], uv);
  if (i == 1) return texture2D(glyph[1], uv);
  if (i == 2) return texture2D(glyph[2], uv);
  return texture2D(glyph[3], uv);
}
vec4 sampleGlyphB(int i, vec2 uv) {
  if (i == 0) return texture2D(glyphB[0], uv);
  if (i == 1) return texture2D(glyphB[1], uv);
  if (i == 2) return texture2D(glyphB[2], uv);
  return texture2D(glyphB[3], uv);
}

void main() {
  vec3 paper = vec3(1.0);
  vec2 step = vec2(cell) / resolution;

  // sample the source at this cell's centre. If the sample falls outside the source
  // — including a 1px inset to avoid the clamped edge column that smears into a thin
  // line, and the area around a shrunk/zoomed source — fill with the background
  // colour instead of black, so a scaled-down video sits on a clean ground.
  vec2 suv = cover(cellUV(step));
  vec2 inset = 1.0 / resolution;
  if (suv.x < inset.x || suv.x > 1.0 - inset.x ||
      suv.y < inset.y || suv.y > 1.0 - inset.y) {
    gl_FragColor = vec4(bgColor, 1.0);
    return;
  }
  float l = lum(texture2D(src, suv).rgb);

  gl_FragColor = vec4(paper, 1.0);
  for (int i = 0; i < 4; i++) {
    if (l >= bandLo[i] && l <= bandHi[i]) {
      vec2 gUv = mod(vUv / step, vec2(1.0));   // glyph repeats once per cell
      // crossfade the glyph alpha AND the band colour from the previous preset
      // (B) to the current one, by morphT — so a remix dissolves smoothly.
      vec4 gA = sampleGlyph(i, gUv);
      vec4 gB = sampleGlyphB(i, gUv);
      float a = mix(gB.a, gA.a, morphT);
      vec3 gcol = mix(gB.rgb, gA.rgb, morphT);
      vec3 col = mix(bandColorB[i], bandColor[i], morphT);
      vec3 sym = mix(paper, gcol, a);          // glyph over paper
      float k = smoothstep(0.0, 1.0, lum(sym));
      gl_FragColor = vec4(mix(col, paper, k), 1.0);
    }
  }
}
`;

```

### sandbox/glyphs.ts

```ts
// A small set of geometric symbol glyphs, drawn from scratch as 2D-canvas paths on
// a 32x32 grid. Used by the "symbols" effect: each brightness band stamps one of
// these tiled across the image, tinted with the band's colour. Authored here (not
// imported) so the set is fully self-contained and easy to extend.

export type GlyphDraw = (ctx: CanvasRenderingContext2D, s: number) => void;

const C = 16; // centre of the 32 grid (scaled to `s` at draw time)

// Each glyph is a function that paints a black shape on a transparent square. The
// caller scales the context so coordinates are in the 0..32 design space.
export const GLYPHS: { name: string; draw: GlyphDraw }[] = [
  { name: "empty", draw: () => {} },

  {
    name: "dot",
    draw: (ctx) => {
      ctx.beginPath();
      ctx.arc(C, C, 5, 0, Math.PI * 2);
      ctx.fill();
    },
  },
  {
    name: "ring",
    draw: (ctx) => {
      ctx.beginPath();
      ctx.arc(C, C, 9, 0, Math.PI * 2);
      ctx.arc(C, C, 5.5, 0, Math.PI * 2, true);
      ctx.fill("evenodd");
    },
  },
  {
    name: "square",
    draw: (ctx) => {
      ctx.fillRect(C - 7, C - 7, 14, 14);
    },
  },
  {
    name: "frame",
    draw: (ctx) => {
      ctx.beginPath();
      ctx.rect(C - 9, C - 9, 18, 18);
      ctx.rect(C - 5, C - 5, 10, 10);
      ctx.fill("evenodd");
    },
  },
  {
    name: "diagonal",
    draw: (ctx) => {
      ctx.lineWidth = 5;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(6, 26);
      ctx.lineTo(26, 6);
      ctx.stroke();
    },
  },
  {
    name: "cross",
    draw: (ctx) => {
      ctx.lineWidth = 5;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(7, 7);
      ctx.lineTo(25, 25);
      ctx.moveTo(25, 7);
      ctx.lineTo(7, 25);
      ctx.stroke();
    },
  },
  {
    name: "plus",
    draw: (ctx) => {
      ctx.fillRect(C - 2.5, 5, 5, 22);
      ctx.fillRect(5, C - 2.5, 22, 5);
    },
  },
  {
    name: "chevron",
    draw: (ctx) => {
      ctx.lineWidth = 5;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(8, 10);
      ctx.lineTo(C, 22);
      ctx.lineTo(24, 10);
      ctx.stroke();
    },
  },
  {
    name: "triangle",
    draw: (ctx) => {
      ctx.beginPath();
      ctx.moveTo(C, 6);
      ctx.lineTo(26, 25);
      ctx.lineTo(6, 25);
      ctx.closePath();
      ctx.fill();
    },
  },
  {
    name: "diamond",
    draw: (ctx) => {
      ctx.beginPath();
      ctx.moveTo(C, 5);
      ctx.lineTo(27, C);
      ctx.lineTo(C, 27);
      ctx.lineTo(5, C);
      ctx.closePath();
      ctx.fill();
    },
  },
  {
    name: "bars",
    draw: (ctx) => {
      ctx.fillRect(7, 6, 4, 20);
      ctx.fillRect(14, 6, 4, 20);
      ctx.fillRect(21, 6, 4, 20);
    },
  },
  {
    name: "hexagon",
    draw: (ctx) => {
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i - Math.PI / 6;
        const x = C + Math.cos(a) * 11;
        const y = C + Math.sin(a) * 11;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
    },
  },
  {
    name: "star",
    draw: (ctx) => {
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? 12 : 5;
        const a = (Math.PI / 5) * i - Math.PI / 2;
        const x = C + Math.cos(a) * r;
        const y = C + Math.sin(a) * r;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
    },
  },
  {
    name: "heart",
    draw: (ctx) => {
      ctx.beginPath();
      ctx.moveTo(16, 26);
      ctx.bezierCurveTo(2, 16, 6, 6, 16, 12);
      ctx.bezierCurveTo(26, 6, 30, 16, 16, 26);
      ctx.closePath();
      ctx.fill();
    },
  },
  {
    name: "drop",
    draw: (ctx) => {
      ctx.beginPath();
      ctx.moveTo(16, 5);
      ctx.bezierCurveTo(24, 15, 26, 20, 16, 27);
      ctx.bezierCurveTo(6, 20, 8, 15, 16, 5);
      ctx.closePath();
      ctx.fill();
    },
  },
  {
    name: "flower",
    draw: (ctx) => {
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i;
        ctx.beginPath();
        ctx.ellipse(C + Math.cos(a) * 7, C + Math.sin(a) * 7, 4.5, 4.5, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    },
  },
  {
    name: "asterisk",
    draw: (ctx) => {
      ctx.lineWidth = 4;
      ctx.lineCap = "round";
      for (let i = 0; i < 3; i++) {
        const a = (Math.PI / 3) * i;
        ctx.beginPath();
        ctx.moveTo(C - Math.cos(a) * 11, C - Math.sin(a) * 11);
        ctx.lineTo(C + Math.cos(a) * 11, C + Math.sin(a) * 11);
        ctx.stroke();
      }
    },
  },
  {
    name: "spark",
    draw: (ctx) => {
      ctx.beginPath();
      const pts = [
        [16, 3], [19, 13], [29, 16], [19, 19],
        [16, 29], [13, 19], [3, 16], [13, 13],
      ];
      pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
      ctx.closePath();
      ctx.fill();
    },
  },
  {
    name: "pentagon",
    draw: (ctx) => {
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const a = (Math.PI * 2 / 5) * i - Math.PI / 2;
        const x = C + Math.cos(a) * 11;
        const y = C + Math.sin(a) * 11;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
    },
  },
  {
    name: "donut",
    draw: (ctx) => {
      ctx.beginPath();
      ctx.arc(C, C, 11, 0, Math.PI * 2);
      ctx.arc(C, C, 4, 0, Math.PI * 2, true);
      ctx.fill("evenodd");
    },
  },
  {
    name: "halfmoon",
    draw: (ctx) => {
      ctx.beginPath();
      ctx.arc(C, C, 11, 0, Math.PI * 2);
      ctx.arc(C + 6, C - 3, 10, 0, Math.PI * 2, true);
      ctx.fill("evenodd");
    },
  },
  {
    name: "arrow",
    draw: (ctx) => {
      ctx.lineWidth = 4;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(7, 16);
      ctx.lineTo(23, 16);
      ctx.moveTo(16, 9);
      ctx.lineTo(23, 16);
      ctx.lineTo(16, 23);
      ctx.stroke();
    },
  },
  {
    name: "wave",
    draw: (ctx) => {
      ctx.lineWidth = 4;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(5, 16);
      ctx.quadraticCurveTo(11, 7, 16, 16);
      ctx.quadraticCurveTo(21, 25, 27, 16);
      ctx.stroke();
    },
  },
];

// Render a glyph to an offscreen canvas (black shape, transparent ground) so it can
// become a repeating texture.
export function glyphCanvas(index: number, size = 64): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  ctx.clearRect(0, 0, size, size);
  const g = GLYPHS[index];
  if (g) {
    const scale = size / 32;
    ctx.save();
    ctx.scale(scale, scale);
    ctx.fillStyle = "#000";
    ctx.strokeStyle = "#000";
    g.draw(ctx, 32);
    ctx.restore();
  }
  return c;
}

```

### sandbox/standalone/SymbolsEffect.ts

```ts
// A minimal, self-contained version of the Symbols effect renderer — the core idea
// with none of the playground machinery (no preset pool, preloading, remix
// crossfade, or recording). This is what's shown in the Code tabs so the effect
// reads clearly; the live playground uses a fuller version of the same shader.
//
// Build a full-frame quad, sample the source per cell, bucket its luminance into a
// band, and stamp that band's glyph tinted with its colour over white paper.

import * as THREE from "three";
import { SANDBOX_VERT, SANDBOX_FRAG } from "../shaders";
import { glyphCanvas } from "../glyphs";

export interface SymbolsParams {
  cell: number; // pixel cell size
  bandColors: string[]; // 4 hex colours, dark band → light band
  bandStops: number[]; // 5 stops → 4 luminance bands
  bandGlyphs: number[]; // 4 glyph indices (0 = empty)
  zoom?: number; // source zoom (1 = fill)
  bg?: string; // background colour around a shrunk source
}

export class SymbolsEffect {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private uniforms: Record<string, { value: unknown }>;
  private canvas: HTMLCanvasElement;
  private srcAspect = 1;
  private video: HTMLVideoElement | null = null;
  private raf = 0;
  private reqCell: number; // requested cell size (CSS px @ the 600px ref width)

  constructor(canvas: HTMLCanvasElement, p: SymbolsParams) {
    this.canvas = canvas;
    this.reqCell = p.cell;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.setClearColor(new THREE.Color(p.bg ?? "#ffffff"), 1);

    const glyph = (i: number) => {
      const t = new THREE.CanvasTexture(glyphCanvas(i));
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      return t;
    };
    const col = p.bandColors.map((h) => new THREE.Color(h));

    this.uniforms = {
      src: { value: new THREE.Texture() },
      resolution: { value: new THREE.Vector2(1, 1) },
      srcScale: { value: new THREE.Vector2(1, 1) },
      zoom: { value: p.zoom ?? 1 },
      bgColor: { value: new THREE.Color(p.bg ?? "#ffffff") },
      cell: { value: p.cell },
      bandColor: { value: col },
      bandColorB: { value: col.map((c) => c.clone()) },
      bandLo: { value: [p.bandStops[0], p.bandStops[1], p.bandStops[2], p.bandStops[3]] },
      bandHi: { value: [p.bandStops[1], p.bandStops[2], p.bandStops[3], p.bandStops[4]] },
      glyph: { value: p.bandGlyphs.map(glyph) },
      glyphB: { value: p.bandGlyphs.map(glyph) },
      morphT: { value: 1 },
    };

    const mat = new THREE.ShaderMaterial({
      vertexShader: SANDBOX_VERT,
      fragmentShader: SANDBOX_FRAG,
      uniforms: this.uniforms,
    });
    this.scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat));
    this.resize();
  }

  // COVER fit: the quad always fills the frame; we crop the SOURCE sampling instead
  // (a uv scale) so there are never black bars.
  private fit() {
    const r = this.canvas.getBoundingClientRect();
    const ca = r.width / Math.max(1, r.height);
    let ux = 1;
    let uy = 1;
    if (this.srcAspect > ca) ux = ca / this.srcAspect;
    else uy = this.srcAspect / ca;
    (this.uniforms.srcScale.value as THREE.Vector2).set(ux, uy);
  }

  resize = () => {
    const r = this.canvas.getBoundingClientRect();
    const w = Math.max(1, r.width);
    const h = Math.max(1, r.height);
    this.renderer.setSize(w, h, false);
    (this.uniforms.resolution.value as THREE.Vector2).set(w, h);
    // scale the cell with the card width (ref 600px) so a narrow mobile card keeps
    // roughly the same cell density as a wide desktop one, not chunkier cells.
    this.uniforms.cell.value = Math.max(2, this.reqCell * (w / 600));
    this.fit();
    this.render();
  };

  render = () => this.renderer.render(this.scene, this.camera);

  setImage(url: string) {
    new THREE.TextureLoader().load(url, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      this.uniforms.src.value = tex;
      this.srcAspect = tex.image.width / tex.image.height;
      this.video = null;
      this.fit();
      this.render();
    });
  }

  setVideo(url: string) {
    const v = document.createElement("video");
    v.src = url;
    v.loop = v.muted = v.playsInline = true;
    const tex = new THREE.VideoTexture(v);
    tex.colorSpace = THREE.SRGBColorSpace;
    v.addEventListener("loadeddata", () => {
      this.uniforms.src.value = tex;
      this.srcAspect = v.videoWidth / v.videoHeight || 1;
      this.video = v;
      this.fit();
      v.play();
      this.loop();
    });
    v.load();
  }

  private loop = () => {
    if (!this.video) return;
    this.render();
    this.raf = requestAnimationFrame(this.loop);
  };

  dispose() {
    cancelAnimationFrame(this.raf);
    this.video?.pause();
    this.renderer.dispose();
  }
}

```



6. You are given the complete source for a self-contained web visual: "Ghosty reveal".

What it is:
- I love it when photos do not just fade in. The good ones bleed in through a soft, cloudy edge, like the image is forming out of fog. It looks expensive and hard to build. It is neither.
- The whole trick is a mask. A tall, feathered gradient is laid over the image, several times taller than the box, and you slide it across with `mask-position`. Because the edge of the mask is soft and a little cloudy, the image appears through a feathered front instead of a hard line. That is the ghost.
- Below is the real thing on live images, with controls for how soft the bleed is, which way it travels, the duration and the easing. You can grab the component and the mask and drop them into anything.

How to use this code:
- It is a React + TypeScript component tree (Next.js App Router) that renders to an HTML canvas; the entry point is the playground component.
- Drop the files into a project under the same relative paths, mount the playground component, and it runs as-is. No external assets beyond what's inline.
- To adapt it: change the resolved word/logo, the color controls, or the experiment parameters. Ask me to modify, explain, or port any part.

The full source follows, one file per block:

### ghosty-reveal/standalone/GhostReveal.tsx

```tsx
"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

/**
 * GhostReveal — a soft "ghostly" image/element reveal.
 *
 * The trick: a tall, feathered alpha mask is laid over the element at
 * `mask-size: 100% <scale>%` (the mask is
 * several times taller than the box). Animating `mask-position` from one end to
 * the other slides that soft gradient across the element, so the content bleeds
 * in through a cloudy, feathered edge instead of a hard wipe — the ghost look.
 *
 * Direction just rotates which mask edge leads. Scroll-triggered by default via
 * IntersectionObserver; pass `play` to drive it yourself. Honors reduced motion.
 */

export type GhostDirection = "up" | "down" | "left" | "right";

export interface GhostRevealProps {
  children: ReactNode;
  /** Mask image — a soft feathered PNG with a VERTICAL ramp (for up/down). */
  maskSrc: string;
  /** Optional HORIZONTAL-ramp version of the mask, used for left/right so the
   *  feather runs along the wipe. Falls back to maskSrc if omitted (then
   *  left/right reveal without a horizontal feather). */
  maskSrcH?: string;
  /** How many times taller/wider than the box the mask is. Bigger = slower,
   *  softer bleed. Maps to `mask-size`. Default 500 (i.e. 500%). */
  scale?: number;
  /** Reveal duration in ms. Default 1000. */
  duration?: number;
  /** CSS easing. Default a gliding ease-out. */
  easing?: string;
  /** Which way the soft edge travels. Default "up" (rises from the bottom). */
  direction?: GhostDirection;
  /** Controlled trigger. When omitted, reveals on scroll-into-view (once). */
  play?: boolean;
  /** Visible fraction before the scroll trigger fires (0..1). Default 0.2. */
  threshold?: number;
  /** Fires when the mask finishes animating OUT (fully hidden). Lets a driver
   *  swap the child image exactly when nothing is visible, so a new image can
   *  never flash in over the old one mid-transition. */
  onHidden?: () => void;
  className?: string;
  style?: CSSProperties;
}

// The reveal is a soft gradient mask that slides across the box. The PNG asset
// is a vertical feather (good for up/down); for left/right we use a CSS gradient
// oriented horizontally so the feather runs along the wipe — NO element rotation
// (rotating a non-square box clips it). Each direction defines the mask image,
// its over-sized dimension, and the from/to positions for hidden→revealed.
function axisFor(
  dir: GhostDirection,
  maskSrc: string,
  maskSrcH: string,
  scale: number,
) {
  const pct = `${scale}%`;
  // Up/down use the vertical-ramp PNG (tall mask, sweeps along Y). Left/right use
  // the horizontal-ramp PNG (wide mask, sweeps along X). Both are REAL feathered
  // images and no element is rotated, so the feather is correct and nothing clips.
  switch (dir) {
    case "up": // feather rises from the bottom
      return { image: `url(${maskSrc})`, size: `100% ${pct}`, from: "0% 0%", to: "0% 100%" };
    case "down": // feather descends from the top
      return { image: `url(${maskSrc})`, size: `100% ${pct}`, from: "0% 100%", to: "0% 0%" };
    case "left": // feather sweeps in horizontally
      return { image: `url(${maskSrcH})`, size: `${pct} 100%`, from: "0% 0%", to: "100% 0%" };
    case "right":
      return { image: `url(${maskSrcH})`, size: `${pct} 100%`, from: "100% 0%", to: "0% 0%" };
  }
}

export function GhostReveal({
  children,
  maskSrc,
  maskSrcH,
  scale = 500,
  duration = 1000,
  easing = "cubic-bezier(0.16, 1, 0.3, 1)",
  direction = "up",
  play,
  threshold = 0.2,
  onHidden,
  className = "",
  style,
}: GhostRevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const controlled = play !== undefined;
  const [shown, setShown] = useState(false);

  // Scroll trigger (uncontrolled mode). Fires once when the element scrolls in.
  useEffect(() => {
    if (controlled) return;
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setShown(true);
            io.disconnect();
          }
        }
      },
      { threshold },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [controlled, threshold]);

  const open = controlled ? play! : shown;
  const { image, size, from, to } = axisFor(
    direction,
    maskSrc,
    maskSrcH ?? maskSrc,
    scale,
  );

  // Fire onHidden when the mask-position transition completes while hidden, so a
  // driver swaps the image only after it's fully masked out (never a flash of
  // the next image over the old one). Keep the latest `open`/`onHidden` in refs
  // so the listener stays attached without re-binding each render.
  const openRef = useRef(open);
  openRef.current = open;
  const onHiddenRef = useRef(onHidden);
  onHiddenRef.current = onHidden;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handle = (e: TransitionEvent) => {
      if (e.target !== el) return;
      if (e.propertyName !== "mask-position" && e.propertyName !== "-webkit-mask-position")
        return;
      if (!openRef.current) onHiddenRef.current?.();
    };
    el.addEventListener("transitionend", handle);
    return () => el.removeEventListener("transitionend", handle);
  }, []);

  const reduce =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  const maskStyle: CSSProperties = reduce
    ? { opacity: open ? 1 : 0, transition: `opacity 0.3s ${easing}` }
    : {
        WebkitMaskImage: image,
        maskImage: image,
        WebkitMaskSize: size,
        maskSize: size,
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskPosition: open ? to : from,
        maskPosition: open ? to : from,
        transition: `-webkit-mask-position ${duration}ms ${easing}, mask-position ${duration}ms ${easing}`,
      };

  return (
    <div ref={ref} className={className} style={{ ...maskStyle, ...style }}>
      {children}
    </div>
  );
}

```


7. You are given the complete source for a self-contained web visual: "The art of color depth".

What it is:
- Buttons that feel like real objects, glossy glass or brushed metal or a soft cushion. They look expensive and slow to make. They are neither.
- The depth is just layers stacked on one button: a gradient body, inset shadows for the bevel and glow, a brighter layer that fades in on hover, and a soft bar of light along the top. Below is one button built ten different ways, by technique, not by color. Switch and grab the CSS you want.

How to use this code:
- It is a React + TypeScript component tree (Next.js App Router) that renders to an HTML canvas; the entry point is the playground component.
- Drop the files into a project under the same relative paths, mount the playground component, and it runs as-is. No external assets beyond what's inline.
- To adapt it: change the resolved word/logo, the color controls, or the experiment parameters. Ask me to modify, explain, or port any part.

The full source follows, one file per block:

### color-depth/standalone/color-depth.css

```css
/* The Art of Color Depth — button depth by technique, not by color.
 *
 * Six ways to give a flat button real depth. Each is a different METHOD; the
 * colors are just variables you swap. Every recipe styles the same markup:
 *
 *   <button class="depth-btn depth-<type>">
 *     <span class="depth-label">Get Started</span>
 *   </button>
 *
 * The depth never comes from one drop shadow. It is layers stacked on the same
 * element: a base gradient (the body), inset shadows (the bevel and inner glow),
 * a ::before that fades in on hover (the light turning on), and often a ::after
 * highlight (the specular sheen). Copy the shared base plus the one type you want.
 */

/* ── shared base (same for every type) ─────────────────────────────────────── */
.depth-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 44px;
  padding: 0 22px;
  border: none;
  border-radius: 999px;
  font: 500 15px/1 ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
  letter-spacing: 0.01em;
  color: #fff;
  cursor: pointer;
  isolation: isolate; /* keep the ::before/::after layers under the label */
  overflow: hidden; /* clip every decoration layer to the pill */
  -webkit-tap-highlight-color: transparent;
  /* No scale/lift on the button itself — each material animates only its own
     look (a glint, a glow) on hover/press, nothing generic. */
  transition:
    filter 0.2s ease,
    box-shadow 0.2s ease;
}
.depth-label {
  position: relative;
  z-index: 2;
  display: inline-flex;
  align-items: center;
}
/* icon variant: a square button (same material, different silhouette) */
.depth-btn.depth-icon {
  width: 44px;
  padding: 0;
  border-radius: 14px;
}

/* ── Toggle switch: the material is the TRACK; a solid knob slides on top ───── */
.depth-btn.depth-toggle {
  width: 76px;
  padding: 0;
  cursor: pointer;
}
/* the knob — a smaller, textured circle that rides above the material and glides.
   Texture: a soft top highlight + a faint bottom shade baked into the background,
   plus a hairline rim, so it reads as a rounded physical dot, not a flat disc. */
.depth-knob {
  position: absolute;
  z-index: 3;
  top: 7px;
  left: 7px;
  width: 30px;
  height: 30px;
  border-radius: 999px;
  background:
    radial-gradient(120% 120% at 50% 22%, rgba(255, 255, 255, var(--knob-hi, 0.55)), rgba(255, 255, 255, 0) 55%),
    radial-gradient(120% 120% at 50% 100%, rgba(0, 0, 0, var(--knob-lo, 0.22)), rgba(0, 0, 0, 0) 55%),
    var(--knob, #ffffff);
  box-shadow:
    0 1px 2px rgba(0, 0, 0, 0.35),
    0 2px 5px rgba(0, 0, 0, 0.22),
    inset 0 1px 1px rgba(255, 255, 255, var(--knob-hi, 0.5)),
    inset 0 0 0 1px rgba(0, 0, 0, 0.06);
  transition: transform 0.28s cubic-bezier(0.22, 1, 0.36, 1);
}
.depth-toggle[data-on="true"] .depth-knob {
  transform: translateX(32px);
}
/* off state reads a little dimmer, so "on" is clearly the lit one */
.depth-toggle[data-on="false"] {
  filter: saturate(0.6) brightness(0.94);
}
/* per-material knob colour: dark knob on the pale materials, white elsewhere.
   Dark knobs get much softer texture (the highlight/shade would read as heavy
   gloss on a near-black circle). */
.depth-inset,
.depth-satin,
.depth-metal,
.depth-glass {
  --knob: #2a2f3a;
  --knob-hi: 0.14;
  --knob-lo: 0.08;
}
.depth-btn::before,
.depth-btn::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  z-index: 1;
  pointer-events: none;
}
/* ::before defaults to visible now; materials that want it hidden set opacity:0
   themselves. (No generic white sheen-fade on hover.) */

/* ── Glossy — a specular highlight bar over a gradient body ──────────────────
   The classic app-button look. A bright-to-dark gradient body, faint inner rim
   light, a dark inset at the bottom for weight, and a blurred white bar that
   overhangs the top edge like studio lighting on plastic. */
.depth-glossy {
  overflow: hidden; /* clip the highlight bar to the pill */
  background: linear-gradient(180deg, #ffb347 0%, #e06c1f 100%);
  box-shadow:
    inset 0 -1px 4.1px 0.5px rgba(255, 224, 160, 0.55),
    inset 0 0 4px 0 rgb(255, 234, 200),
    inset 0 -36px 14.2px -28px rgba(180, 80, 20, 0.5),
    0 3px 8px rgba(200, 96, 30, 0.35);
  text-shadow: 0 1px 2px rgba(90, 40, 0, 0.5);
}
.depth-glossy::after {
  content: "";
  position: absolute;
  left: 10px;
  right: 10px;
  top: -5px;
  height: 28px;
  border-radius: 500px;
  background: linear-gradient(to top, rgba(255, 255, 255, 0), #fff);
  filter: blur(1px);
  opacity: 0.7;
  transition: opacity 0.3s ease, top 0.3s ease;
  z-index: 1;
}
.depth-glossy:hover::after {
  opacity: 0.9;
  top: -3px;
}

/* ── Glow — a solid body lit from inside, hover turns the light up ───────────
   No specular. The depth is an internal glow: a dark-to-bright gradient with
   inset color glows, and a ::before that swaps to a brighter gradient with crisp
   light along the lower inner edge — the button appears to power on. */
.depth-glow {
  color: #fdeaff;
  text-shadow: 0 1px 2px rgba(40, 0, 48, 0.55);
  background: linear-gradient(180deg, #2a0a45 0%, #a01fd0 100%);
  box-shadow:
    inset 0 -1.5px 2px 0 #d67bff,
    inset 0 0 10px 0 #b01ffb,
    inset 0 0 8px 0 #b01ffb,
    0 2px 6px rgba(140, 20, 200, 0.35);
}
/* the brighter "light on" layer: hidden at rest, fades in on hover */
.depth-glow::before {
  opacity: 0;
  transition: opacity 0.2s ease;
  background: linear-gradient(180deg, #45108a 9%, #c31ffb 100%);
  box-shadow:
    inset 0 -0.5px 1px 0 #ff8cf0,
    inset 0 -1px 3px 0 #ff8cf0,
    inset 0 -1.5px 5px 0 #ff9ce8,
    inset 0 0 12px 0 #d155ff,
    inset 0 0 10px 0 #d155ff;
}
.depth-glow:hover::before {
  opacity: 1;
}

/* ── Metal — brushed surface with a bevel and a sheen that follows the cursor ─
   A cool vertical gradient with a bright top bevel and dark bottom bevel, a
   faint vertical "brushing", and a diagonal specular streak (::after) whose
   position tracks --pointer-x (a driver updates it while hovering; it rests in
   the centre). The glint slides to wherever the light "hits" as you move. */
.depth-metal {
  --pointer-x: 50%; /* driven by JS on hover; falls back to centre */
  color: #1c2230;
  text-shadow: 0 1px 0 rgba(255, 255, 255, 0.55);
  overflow: hidden;
  background:
    repeating-linear-gradient(
      90deg,
      rgba(255, 255, 255, 0.05) 0px,
      rgba(0, 0, 0, 0.04) 1px,
      rgba(255, 255, 255, 0.05) 2px
    ),
    linear-gradient(180deg, #f4f6f9 0%, #c3cad6 48%, #aab2c0 52%, #d3d9e2 100%);
  box-shadow:
    inset 0 1px 0 0 rgba(255, 255, 255, 0.9),
    inset 0 -1px 1px 0 rgba(30, 38, 56, 0.35),
    inset 0 0 0 1px rgba(255, 255, 255, 0.25),
    0 3px 8px rgba(30, 38, 56, 0.28);
}
/* the moving glint: a soft band positioned at the cursor's x (smoothed in CSS) */
.depth-metal::after {
  opacity: 0.85;
  background: radial-gradient(
    120% 140% at var(--pointer-x, 50%) -20%,
    rgba(255, 255, 255, 0.85) 0%,
    rgba(255, 255, 255, 0.25) 18%,
    rgba(255, 255, 255, 0) 42%
  );
  transition: opacity 0.3s ease, background 0.12s linear;
}
.depth-metal:hover::after {
  opacity: 1;
}

/* ── Layered — depth from soft translucent overlays over any fill ────────────
   No baked colours: a translucent black base plus faint layers, so it adds depth
   to a button of ANY fill. Kept smooth — one gentle top→bottom dome on the body,
   a soft top sheen (::before, fades on press), and a clean even hairline rim
   (::after). Nothing heavy or uneven. */
.depth-layered {
  overflow: hidden;
  /* One smooth translucent body — no heavy center-shade. A single gentle
     top-to-bottom lightening does the doming, so it reads clean over any fill. */
  background:
    linear-gradient(
      180deg,
      rgba(255, 255, 255, 0.1) 0%,
      rgba(255, 255, 255, 0) 40%,
      rgba(0, 0, 0, 0.12) 100%
    ),
    rgba(0, 0, 0, 0.55);
}
/* layer 1 — a soft top sheen (fades in on hover, off on press) */
.depth-layered::before {
  opacity: 0.1;
  background: linear-gradient(180deg, #fff 0%, rgba(255, 255, 255, 0) 60%);
  transition: opacity 0.2s ease;
}
.depth-layered:hover::before {
  opacity: 0.15;
}
.depth-layered:active::before {
  opacity: 0;
  transition-duration: 0.05s;
}
/* layer 2 — a clean, even hairline rim (soft, not the uneven white/grey band) */
.depth-layered::after {
  opacity: 1;
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.16),
    inset 0 1px 0 0 rgba(255, 255, 255, 0.14);
}

/* ── Inset — carved INTO the surface (the only recessed one) ─────────────────
   Unlike every other type (which sit ON the page), this one reads as a hole cut
   into it. The trick: the fill is NEARLY the page colour, so it looks like the
   same surface pushed inward — then a hard dark shadow along the TOP inner edge
   (the near wall the light can't reach) and a bright highlight along the BOTTOM
   inner edge + a 1px light lip just BELOW the button (the far rim catching light).
   No outer drop shadow (recessed things don't float). Tuned for a light page. */
.depth-inset {
  color: #5b6473;
  text-shadow: 0 1px 0 rgba(255, 255, 255, 0.7);
  background: linear-gradient(180deg, #dfe3ea 0%, #eef1f6 100%);
  box-shadow:
    inset 0 3px 4px -1px rgba(60, 70, 90, 0.5),
    inset 0 6px 10px -6px rgba(60, 70, 90, 0.45),
    inset 0 -2px 2px -1px rgba(255, 255, 255, 0.95),
    inset 0 0 0 1px rgba(60, 70, 90, 0.12),
    0 1px 0 0 rgba(255, 255, 255, 0.9); /* the lit far lip below the cut */
}
.depth-inset:hover {
  transform: none; /* recessed things don't lift */
  box-shadow:
    inset 0 4px 6px -1px rgba(60, 70, 90, 0.58),
    inset 0 8px 12px -6px rgba(60, 70, 90, 0.5),
    inset 0 -2px 2px -1px rgba(255, 255, 255, 1),
    inset 0 0 0 1px rgba(60, 70, 90, 0.16),
    0 1px 0 0 rgba(255, 255, 255, 0.9);
}
.depth-inset:active {
  /* press flattens the depth — the cut shallows */
  box-shadow:
    inset 0 1px 2px 0 rgba(60, 70, 90, 0.4),
    inset 0 0 0 1px rgba(60, 70, 90, 0.12);
}

/* ── Glass — real refraction through an SVG displacement filter ──────────────
   The background is bent through the button, not just blurred. A tiny SVG filter
   (feImage of a red/blue gradient map -> three per-channel feDisplacementMaps ->
   blended) refracts what is behind it, then we stack glass highlights on top: a
   gradient border ring (::before), an inner diagonal shine (::after), a top edge
   light line, and a layered outer glow. Needs the <svg id="liquid-glass-filter">
   present in the document (see color-depth.html). Put it over something colorful.
   Falls back to a plain blur where url() backdrop filters aren't supported. */
.depth-glass {
  /* white text reads on the (often busy/photo) background behind the glass */
  color: #ffffff;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.45);
  background: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.12) 0%,
    rgba(255, 255, 255, 0.05) 50%,
    rgba(255, 255, 255, 0.12) 100%
  );
  -webkit-backdrop-filter: blur(2px) saturate(1.5) brightness(1.05);
  backdrop-filter: blur(2px) saturate(1.5) brightness(1.05);
  box-shadow:
    0 8px 32px rgba(31, 38, 135, 0.15),
    inset 0 0 0 1px rgba(255, 255, 255, 0.18),
    0 4px 24px rgba(0, 0, 0, 0.06),
    inset 0 1px 1px rgba(255, 255, 255, 0.4);
}
@supports (backdrop-filter: url(#liquid-glass-filter)) or
  (-webkit-backdrop-filter: url(#liquid-glass-filter)) {
  .depth-glass {
    -webkit-backdrop-filter: url(#liquid-glass-filter) saturate(1.5) brightness(1.05);
    backdrop-filter: url(#liquid-glass-filter) saturate(1.5) brightness(1.05);
  }
}
.depth-glass::before {
  opacity: 1;
  padding: 1px;
  background: linear-gradient(
    180deg,
    rgba(255, 255, 255, 0.5) 0%,
    rgba(255, 255, 255, 0.1) 45%,
    transparent 100%
  );
  -webkit-mask:
    linear-gradient(#fff 0 0) content-box,
    linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
}
.depth-glass::after {
  opacity: 0.8;
  inset: 2px;
  border-radius: inherit;
  background:
    linear-gradient(to right, transparent 10%, rgba(255, 255, 255, 0.6) 50%, transparent 90%)
      top / 100% 1px no-repeat,
    linear-gradient(135deg, rgba(255, 255, 255, 0.3) 0%, transparent 50%, rgba(255, 255, 255, 0.05) 100%);
}
.depth-glass:hover {
  box-shadow:
    0 12px 40px rgba(31, 38, 135, 0.2),
    inset 0 0 0 1px rgba(255, 255, 255, 0.25),
    0 6px 30px rgba(0, 0, 0, 0.08),
    inset 0 2px 2px rgba(255, 255, 255, 0.5);
}

/* ── Foil — iridescent metal that reacts to the cursor ───────────────────────
   The richest one: a silver metal base with a holographic rainbow that shifts,
   soft coloured "film" blobs, a pearly sheen, a moving shine band and a glare
   dot at the cursor. Built from stacked CHILD layers (not just pseudo-elements)
   because it needs five. A tiny JS driver feeds --pointer-x/y, --glare-x/y,
   --foil-shift and --shine-angle while hovering; without JS it still shows a
   handsome static foil. Markup:
     <button class="depth-btn depth-foil">
       <span class="depth-foil-l depth-foil-base"></span>
       <span class="depth-foil-l depth-foil-film"></span>
       <span class="depth-foil-l depth-foil-pearl"></span>
       <span class="depth-label">Get Started</span>
       <span class="depth-foil-l depth-foil-shine"></span>
       <span class="depth-foil-l depth-foil-glare"></span>
     </button>  */
.depth-foil {
  --foil-shift: 0%;
  --glare-x: 50%;
  --glare-y: 50%;
  --pointer-x: 50%;
  --pointer-y: 50%;
  --shine-angle: 135deg;
  color: #14202e;
  text-shadow: 0 1px 0 rgba(255, 255, 255, 0.5);
  overflow: hidden;
  background: linear-gradient(135deg, #eee 0%, #dcdcdc 40%, #c9c9c9 72%, #e8e8e8 100%);
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.5),
    inset 0 1px 1px rgba(255, 255, 255, 0.7),
    inset 0 -2px 4px rgba(60, 70, 90, 0.3),
    0 3px 10px rgba(30, 38, 56, 0.3);
}
.depth-foil-l {
  position: absolute;
  inset: -48%;
  z-index: 1;
  background-repeat: no-repeat;
  pointer-events: none;
}
/* the rainbow band over silver — visible at rest, and it drifts on its own so
   the foil shimmers without the cursor. The JS driver nudges --foil-shift on
   hover, which composes on top of the ambient drift via translateX. */
.depth-foil-base {
  background: linear-gradient(
    112deg,
    transparent 22%,
    rgba(0, 220, 255, 0.4) 30%,
    rgba(80, 255, 190, 0.34) 36%,
    rgba(190, 255, 80, 0.26) 41%,
    rgba(255, 230, 70, 0.24) 47%,
    rgba(255, 70, 180, 0.36) 55%,
    rgba(150, 90, 255, 0.36) 63%,
    rgba(60, 120, 255, 0.3) 70%,
    transparent 80%
  );
  background-size: 240% 100%;
  filter: saturate(1.3) contrast(1.25);
  /* Ambient drift ONLY (background-position). The pointer does NOT move this
     layer — that's what made it jump/lose state on hover. The rainbow just
     glides on its own; the cursor drives the highlight layers below instead. */
  animation: depth-foil-drift 7s ease-in-out infinite alternate;
}
/* soft coloured film blobs — also visible at rest, gently breathing */
.depth-foil-film {
  background:
    radial-gradient(ellipse at 20% 30%, rgba(255, 70, 180, 0.34) 0%, transparent 48%),
    radial-gradient(ellipse at 70% 20%, rgba(0, 220, 255, 0.34) 0%, transparent 52%),
    radial-gradient(ellipse at 78% 74%, rgba(80, 255, 190, 0.34) 0%, transparent 56%);
  background-size: 150% 150%, 160% 160%, 145% 145%;
  filter: blur(0.4px) saturate(1.4);
  mix-blend-mode: screen;
  opacity: 0.7;
  animation: depth-foil-drift 9s ease-in-out infinite alternate-reverse;
}
@keyframes depth-foil-drift {
  from {
    background-position: 0% center;
  }
  to {
    background-position: 100% center;
  }
}
@media (prefers-reduced-motion: reduce) {
  .depth-foil-base,
  .depth-foil-film {
    animation: none;
  }
}
/* pearly sheen — a soft moving highlight that tracks the cursor smoothly */
.depth-foil-pearl {
  z-index: 2;
  inset: 0; /* keep it on-box so its position math is stable, no jump */
  background: radial-gradient(
    120% 120% at var(--glare-x, 50%) var(--glare-y, 50%),
    rgba(230, 238, 245, 0.6) 0%,
    rgba(205, 217, 226, 0.2) 26%,
    transparent 58%
  );
  mix-blend-mode: soft-light;
  opacity: 0.95;
  transition: background 0.12s linear; /* smooth the cursor tracking */
}
/* the travelling shine band, angled by the cursor */
.depth-foil-shine {
  z-index: 4;
  inset: 0;
  background: linear-gradient(
    var(--shine-angle, 120deg),
    transparent 30%,
    rgba(226, 235, 242, 0.5) 48%,
    rgba(0, 124, 255, 0.1) 58%,
    rgba(255, 0, 147, 0.1) 66%,
    transparent 82%
  );
  background-size: 200% 100%;
  background-position: calc(var(--pointer-x, 50%)) center;
  filter: blur(0.25px);
  mix-blend-mode: screen;
  opacity: 0.6;
  transition: background-position 0.12s linear;
}
/* a bright glare dot right under the cursor */
.depth-foil-glare {
  z-index: 5;
  inset: 0;
  background: radial-gradient(
    circle at var(--glare-x, 50%) var(--glare-y, 50%),
    rgba(230, 238, 245, 0.55) 0%,
    rgba(205, 218, 228, 0.16) 10%,
    transparent 38%
  );
  mix-blend-mode: screen;
  opacity: 0.5;
  transition: background 0.12s linear;
}
@media (prefers-reduced-motion: reduce) {
  .depth-foil-l {
    transition: none;
  }
}

/* ── Neon — a crisp lit outline (a clean line, not a bloom) ──────────────────
   Restrained on purpose: the depth is one precise bright RING drawn as a solid
   line, with only a whisper of glow so it reads as a lit tube, not a shadow
   storm. A very slight inner tint from the bottom grounds the body. Hover firms
   the line and adds the faintest bloom. Refined, "in line", not shadowy. */
.depth-neon {
  --neon: #35f0ff;
  color: #eafeff;
  background:
    linear-gradient(180deg, rgba(53, 240, 255, 0) 55%, color-mix(in srgb, var(--neon) 12%, transparent) 100%),
    #0b1016;
  text-shadow: 0 0 5px color-mix(in srgb, var(--neon) 55%, transparent);
}
/* the ring: a clean 1px line with only the faintest inner glow — no outer bloom */
.depth-neon::before {
  opacity: 1;
  box-shadow:
    inset 0 0 0 1px var(--neon),
    inset 0 0 2px 0 color-mix(in srgb, var(--neon) 45%, transparent);
  transition: box-shadow 0.25s ease;
}
.depth-neon:hover::before {
  box-shadow:
    inset 0 0 0 1px color-mix(in srgb, var(--neon) 55%, #fff),
    inset 0 0 4px 0 color-mix(in srgb, var(--neon) 60%, transparent),
    0 0 4px -2px color-mix(in srgb, var(--neon) 50%, transparent);
}

/* ── Duotone — a hard-bevel extruded key (crisp, not soft) ───────────────────
   No blur in the depth: a bright top FACE gradient, then a solid darker "side"
   under it built from stacked 1px box-shadows (the extrusion), so it looks like
   a chunky moulded plastic key. Pressing pushes it down onto its own side. */
.depth-duotone {
  background: linear-gradient(180deg, #ff8a4b 0%, #f2612f 100%);
  color: #fff;
  text-shadow: 0 1px 0 rgba(140, 50, 10, 0.6);
  box-shadow:
    inset 0 1px 0 rgba(255, 220, 190, 0.9),
    /* the extruded side: stacked hard shadows in the darker tone */
    0 1px 0 #c9481c,
    0 2px 0 #c9481c,
    0 3px 0 #b23f18,
    0 4px 0 #b23f18,
    0 5px 0 #9c3714,
    0 6px 0 #9c3714,
    0 8px 8px rgba(120, 40, 10, 0.35);
  transition:
    transform 0.12s cubic-bezier(0.22, 1, 0.36, 1),
    box-shadow 0.12s ease;
}
.depth-duotone:hover {
  transform: translateY(-1px);
}
.depth-duotone:active {
  /* slam down onto the extrusion */
  transform: translateY(5px);
  box-shadow:
    inset 0 1px 0 rgba(255, 220, 190, 0.9),
    0 1px 0 #b23f18,
    0 2px 4px rgba(120, 40, 10, 0.35);
}

/* ── Satin — a single flat colour with the softest possible dome ─────────────
   Deliberately the OPPOSITE of Glossy: no gradient body, no specular, no top
   light bar. One solid pastel, and the only depth is a very soft radial vignette
   baked into the background (brighter centre, a hair darker at the rim) plus a
   whisper-thin inner ring. Nothing hard anywhere — pure smooth matte. */
.depth-satin {
  color: #6a4a86;
  text-shadow: 0 1px 1px rgba(255, 255, 255, 0.6);
  background:
    radial-gradient(
      120% 140% at 50% 38%,
      rgba(255, 255, 255, 0.5) 0%,
      rgba(255, 255, 255, 0) 55%
    ),
    radial-gradient(
      130% 130% at 50% 100%,
      rgba(150, 120, 200, 0.22) 0%,
      rgba(150, 120, 200, 0) 60%
    ),
    #e7dcfb;
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.45),
    0 6px 18px -6px rgba(160, 130, 210, 0.4);
  transition:
    filter 0.25s ease,
    transform 0.2s cubic-bezier(0.22, 1, 0.36, 1);
}
.depth-satin:hover {
  filter: brightness(1.03);
}
.depth-satin:active {
  box-shadow:
    inset 0 2px 6px 0 rgba(150, 120, 200, 0.4),
    inset 0 0 0 1px rgba(255, 255, 255, 0.4);
}

```

### color-depth/standalone/color-depth.html

```html
<!-- The Art of Color Depth — markup for the ten button materials + three shapes.
     Load color-depth.css, then use `depth-btn` plus one material class. The markup
     is identical for every material; only the second class changes.

     Pure CSS gets you every static look. Two things want the small companion
     script (color-depth.js): the cursor-reactive materials (Metal, Foil) and the
     toggle's slide. Glass also needs the SVG filter at the bottom, once. -->

<link rel="stylesheet" href="color-depth.css" />

<!-- the ten materials, on the default label pill -->
<button class="depth-btn depth-glossy"><span class="depth-label">Get Started</span></button>
<button class="depth-btn depth-glow"><span class="depth-label">Get Started</span></button>
<button class="depth-btn depth-metal"><span class="depth-label">Get Started</span></button>
<button class="depth-btn depth-layered"><span class="depth-label">Get Started</span></button>
<button class="depth-btn depth-inset"><span class="depth-label">Get Started</span></button>
<button class="depth-btn depth-glass"><span class="depth-label">Get Started</span></button>
<button class="depth-btn depth-neon"><span class="depth-label">Get Started</span></button>
<button class="depth-btn depth-duotone"><span class="depth-label">Get Started</span></button>
<button class="depth-btn depth-satin"><span class="depth-label">Get Started</span></button>

<!-- Foil needs its five stacked layers around the label. Without the script it
     is still a handsome static holographic silver; with it, it tracks the cursor. -->
<button class="depth-btn depth-foil">
  <span aria-hidden class="depth-foil-l depth-foil-base"></span>
  <span aria-hidden class="depth-foil-l depth-foil-film"></span>
  <span aria-hidden class="depth-foil-l depth-foil-pearl"></span>
  <span class="depth-label">Get Started</span>
  <span aria-hidden class="depth-foil-l depth-foil-shine"></span>
  <span aria-hidden class="depth-foil-l depth-foil-glare"></span>
</button>

<!-- other shapes, same material class. Icon button (a square) -->
<button class="depth-btn depth-icon depth-glossy" aria-label="Go">
  <span class="depth-label">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></svg>
  </span>
</button>

<!-- Toggle switch: material on the track, a sliding knob on top. The script flips
     data-on on click; start it on or off with the attribute. -->
<button class="depth-btn depth-toggle depth-glossy" role="switch" data-on="true" aria-label="Toggle">
  <span aria-hidden class="depth-knob"></span>
</button>

<!-- Glass refraction filter. Keep it once in the page (it can be visually
     hidden). The .depth-glass rule points at it via backdrop-filter: url(#…). -->
<svg width="0" height="0" style="position:absolute" aria-hidden="true">
  <defs>
    <filter id="liquid-glass-filter" color-interpolation-filters="sRGB">
      <!-- map: neutral-grey centre (no shift) ramping to colour only at the rim,
           so glass bends the view at its edges and passes the centre through. -->
      <feImage x="0" y="0" width="100%" height="100%"
        href="data:image/svg+xml,%3Csvg%20viewBox%3D%270%200%20200%2080%27%20xmlns%3D%27http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%27%3E%3Cdefs%3E%3ClinearGradient%20id%3D%27r%27%20x2%3D%27100%25%27%3E%3Cstop%20stop-color%3D%27%23f00%27%2F%3E%3Cstop%20offset%3D%2750%25%27%20stop-color%3D%27%23808080%27%2F%3E%3Cstop%20offset%3D%27100%25%27%20stop-color%3D%27%230f0%27%2F%3E%3C%2FlinearGradient%3E%3ClinearGradient%20id%3D%27b%27%20y2%3D%27100%25%27%3E%3Cstop%20stop-color%3D%27%2300f%27%2F%3E%3Cstop%20offset%3D%2750%25%27%20stop-color%3D%27%23808080%27%2F%3E%3Cstop%20offset%3D%27100%25%27%20stop-color%3D%27%23ff0%27%2F%3E%3C%2FlinearGradient%3E%3C%2Fdefs%3E%3Crect%20width%3D%27200%27%20height%3D%2780%27%20rx%3D%2740%27%20fill%3D%27url%28%23r%29%27%2F%3E%3Crect%20width%3D%27200%27%20height%3D%2780%27%20rx%3D%2740%27%20fill%3D%27url%28%23b%29%27%20style%3D%27mix-blend-mode%3Aoverlay%27%2F%3E%3Crect%20x%3D%2714%27%20y%3D%2714%27%20width%3D%27172%27%20height%3D%2752%27%20rx%3D%2726%27%20fill%3D%27%23808080%27%20style%3D%27filter%3Ablur%2814px%29%27%2F%3E%3C%2Fsvg%3E"
        result="map" />
      <feDisplacementMap in="SourceGraphic" in2="map" scale="-14" xChannelSelector="R" yChannelSelector="G" result="dispRed" />
      <feColorMatrix in="dispRed" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="red" />
      <feDisplacementMap in="SourceGraphic" in2="map" scale="-13" xChannelSelector="R" yChannelSelector="G" result="dispGreen" />
      <feColorMatrix in="dispGreen" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="green" />
      <feDisplacementMap in="SourceGraphic" in2="map" scale="-12" xChannelSelector="R" yChannelSelector="G" result="dispBlue" />
      <feColorMatrix in="dispBlue" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="blue" />
      <feBlend in="red" in2="green" mode="screen" result="rg" />
      <feBlend in="rg" in2="blue" mode="screen" result="output" />
      <feGaussianBlur in="output" stdDeviation="0.4" />
    </filter>
  </defs>
</svg>

<!-- optional: cursor-reactive materials + the toggle slide. Static without it. -->
<script src="color-depth.js"></script>

```

### color-depth/standalone/color-depth.js

```js
// Optional behaviour for the color-depth buttons. Pure CSS gets you every static
// look; this adds the two interactive bits:
//   1. the cursor-reactive materials (Metal's glint, Foil's sheen) follow the
//      pointer — it writes --pointer-x/y, --glare-x/y and --shine-angle on the
//      element; the smoothing lives in the CSS transitions, not here.
//   2. the toggle switch flips its `data-on` on click so the knob slides.
//
// Drop it in and call `initColorDepth()` once (or let it auto-run on load). It is
// framework-free and safe to run again after adding more buttons.

function initColorDepth(root = document) {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // cursor-reactive materials
  if (!reduce) {
    root.querySelectorAll(".depth-metal, .depth-foil").forEach((el) => {
      if (el.dataset.depthBound) return;
      el.dataset.depthBound = "1";
      let raf = 0;
      let px = 0.5;
      let py = 0.5;
      const write = () => {
        raf = 0;
        const s = el.style;
        s.setProperty("--pointer-x", (px * 100).toFixed(1) + "%");
        s.setProperty("--pointer-y", (py * 100).toFixed(1) + "%");
        s.setProperty("--glare-x", (px * 100).toFixed(1) + "%");
        s.setProperty("--glare-y", (py * 100).toFixed(1) + "%");
        s.setProperty("--shine-angle", (110 + (px - 0.5) * 50).toFixed(1) + "deg");
      };
      const schedule = () => {
        if (!raf) raf = requestAnimationFrame(write);
      };
      el.addEventListener(
        "pointermove",
        (e) => {
          const r = el.getBoundingClientRect();
          if (r.width && r.height) {
            px = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
            py = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
          }
          schedule();
        },
        { passive: true },
      );
      el.addEventListener("pointerleave", () => {
        px = 0.5;
        py = 0.5;
        schedule();
      });
    });
  }

  // toggle switches: flip data-on on click (the CSS slides the knob)
  root.querySelectorAll(".depth-toggle").forEach((el) => {
    if (el.dataset.depthToggleBound) return;
    el.dataset.depthToggleBound = "1";
    if (!el.hasAttribute("data-on")) el.setAttribute("data-on", "true");
    el.addEventListener("click", () => {
      el.setAttribute("data-on", el.getAttribute("data-on") === "true" ? "false" : "true");
    });
  });
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => initColorDepth());
  } else {
    initColorDepth();
  }
}

```

### color-depth/standalone/SKILL.md

```md
---
name: skeuomorphic-button-depth
description: >-
  Give any button, control, or surface real physical depth in CSS — glossy,
  metal, glass, matte, neon, recessed, and more — in any colour or mode, not just
  dark. Use whenever a button/pill/icon/toggle/card should read as a tactile
  object instead of a flat rectangle. Teaches the layering method (so you can
  build any material on any shape) plus ten ready techniques.
---

# Skeuomorphic button depth

Depth is never one drop shadow. It is many faint layers stacked on the same
element, each faking one part of how light meets a real surface: the body, the
bevel, the inner glow, the reflection. Learn the layers and you can dress any
button in any material — this works in light, dark, or full-colour palettes; the
colours are variables, the method is fixed.

## The one rule everything obeys

Pick a single light direction and commit every layer to it. By default the light
is from the **top**: bright edge on top, dark edge on the bottom, on every
element in the group. The moment two controls disagree about where the light is,
the illusion breaks. Flip the direction only on purpose (a pressed or recessed
control, below).

The surface also has to sit apart from what's behind it — a raised button needs a
background a step darker or lighter than itself, or its lift shadow has nothing to
lift off.

## The layer recipe

Build any material from the same four layers, outermost first:

1. **Body** — usually a top-to-bottom gradient, lighter at the top so the face
   reads as lit from above. `background: linear-gradient(180deg, <light>, <dark>)`.
   A flat fill is fine for matte materials; the doming then comes from step 2.

2. **Inset shadows** — the bevel and inner light, all `box-shadow` with `inset`:
   - a bright inset at the **top** = the lit bevel edge,
   - a dark inset at the **bottom** = weight and thickness,
   - broad soft inner glows = a domed, internally-lit face,
   - a hairline `inset 0 0 0 1px` = a crisp rim that catches light.

3. **Hover layer (`::before`)** — a second, brighter version of the body/insets
   that fades in on hover: "the light turning on." Keep the label above it with
   `isolation: isolate` (or a `z-index` on the text).

4. **Specular (`::after`)** — a soft bright bar or blob near the top edge
   (`linear-gradient` white → transparent, a touch of `blur`, low opacity): the
   reflection on glossy plastic or glass. Move or brighten it on hover for life.

Not every material uses all four — matte uses 1–2, neon leans on the rim, glass
adds real `backdrop-filter`. Add only the layers the material needs.

## Raised vs recessed

Two opposite reads, same toolkit, mirrored:

- **Raised** (sits on the page): bright inset on top, dark inset on the bottom,
  and an outer drop shadow to lift it off the background.
- **Recessed** (carved into the page): flip it — a dark inset on top (the near
  wall in shadow), a bright inset on the bottom (the far wall catching light),
  and **no** outer shadow. Make the fill close to the page colour so it looks
  like the same surface pushed inward, not a separate dark chip.

On press, a raised control should briefly become recessed (swap the outer lift
for inner shadows, ~50ms), so it visibly pushes in.

## Build order (for compound controls)

For anything with parts — a toggle, a segmented control, a stepper — layer from
the outside in, and don't skip a level:

1. the surface behind it (a step darker/lighter than the control),
2. the raised shell / track (the material lives here),
3. any recessed zones inside it (a track well, an active-segment notch),
4. the raised moving parts (a knob, a thumb) — same material as the shell unless
   you want deliberate contrast,
5. the readout on top (label, value, icon).

Put the material on the **container**, not each cell, so a compound control reads
as one carved piece.

## Rules

1. **One element, many layers.** Use `::before`/`::after` for the glow and sheen,
   not extra DOM. `isolation: isolate` keeps the label on top.
2. **Commit to the light direction** (see above). No element disagrees.
3. **Tint the layers toward the material**, don't just add black/white — cyan
   inside a blue glass, warm white inside a warm gel.
4. **Press = invert.** `:active` swaps lift for inner shadow (or collapses the
   sheen). Short transition (~50ms).
5. **Motion is subtle.** The material sells the depth; a hover doesn't need a big
   lift or scale. A moving highlight beats a moving button.
6. **Respect reduced motion.** Guard transforms/animations with
   `@media (prefers-reduced-motion: reduce)`.
7. **Stay compact.** Real controls are dense: tight padding, ~13–15px labels,
   restrained icons. Reach for smaller spacing before bigger type.

## Anti-patterns

- A flat block with a single soft shadow and no inset layers.
- Light coming from different directions on neighbouring controls.
- Glow so bright it erases the form underneath.
- A "recessed" control whose shadows are oriented like a raised one (it pops out).
- A raised control on a background lighter/brighter than itself (nothing to lift
  from).
- One shared inset behind several buttons when each wants its own well.

## Any shape, any palette

The same `depth-btn` base + one material class works on more than a text pill.
This entry ships the label pill, a square **icon** button (`.depth-icon`), and a
**toggle** switch (the material on the track, a sliding knob on top) — and the
method extends to steppers, cards, inputs, or any control you need. Colour is a
value you swap: retint the gradient stops and inset colours and the same material
becomes a new theme.

## Types

Ten techniques, named by method (colour is just a value you swap). Same markup,
one class swap:

- **Glossy** (`depth-glossy`) — a specular highlight bar over a gradient body.
- **Glow** (`depth-glow`) — a solid body lit from inside; hover turns it up.
- **Metal** (`depth-metal`) — a brushed bevel with a glint that follows the cursor.
- **Foil** (`depth-foil`) — iridescent holographic metal; five stacked light layers
  that shift and glare under the cursor (needs its child layers + a tiny pointer
  driver for --pointer-x/y, --glare-x/y, --shine-angle).
- **Layered** (`depth-layered`) — soft translucent overlays over any fill.
- **Inset** (`depth-inset`) — recessed into the surface; the bevel is flipped.
- **Glass** (`depth-glass`) — subtle refraction through an SVG displacement filter.
- **Neon** (`depth-neon`) — a crisp lit outline; a clean ring, not a bloom.
- **Duotone** (`depth-duotone`) — a hard-bevel extruded key from stacked shadows.
- **Satin** (`depth-satin`) — a soft smooth pastel; diffuse light, no gloss or grain.

## Drop-in CSS

A complete `color-depth.css` implementing all ten is the companion to this skill.
Markup is always the same; only the second class changes:

```html
<button class="depth-btn depth-glossy">
  <span class="depth-label">Get Started</span>
</button>
```


```

```


8. You are given the complete source for a self-contained web visual: "The art of color depth".

What it is:
- Buttons that feel like real objects, glossy glass or brushed metal or a soft cushion. They look expensive and slow to make. They are neither.
- The depth is just layers stacked on one button: a gradient body, inset shadows for the bevel and glow, a brighter layer that fades in on hover, and a soft bar of light along the top. Below is one button built ten different ways, by technique, not by color. Switch and grab the CSS you want.

How to use this code:
- It is a React + TypeScript component tree (Next.js App Router) that renders to an HTML canvas; the entry point is the playground component.
- Drop the files into a project under the same relative paths, mount the playground component, and it runs as-is. No external assets beyond what's inline.
- To adapt it: change the resolved word/logo, the color controls, or the experiment parameters. Ask me to modify, explain, or port any part.

The full source follows, one file per block:

### color-depth/standalone/color-depth.css

```css
/* The Art of Color Depth — button depth by technique, not by color.
 *
 * Six ways to give a flat button real depth. Each is a different METHOD; the
 * colors are just variables you swap. Every recipe styles the same markup:
 *
 *   <button class="depth-btn depth-<type>">
 *     <span class="depth-label">Get Started</span>
 *   </button>
 *
 * The depth never comes from one drop shadow. It is layers stacked on the same
 * element: a base gradient (the body), inset shadows (the bevel and inner glow),
 * a ::before that fades in on hover (the light turning on), and often a ::after
 * highlight (the specular sheen). Copy the shared base plus the one type you want.
 */

/* ── shared base (same for every type) ─────────────────────────────────────── */
.depth-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 44px;
  padding: 0 22px;
  border: none;
  border-radius: 999px;
  font: 500 15px/1 ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
  letter-spacing: 0.01em;
  color: #fff;
  cursor: pointer;
  isolation: isolate; /* keep the ::before/::after layers under the label */
  overflow: hidden; /* clip every decoration layer to the pill */
  -webkit-tap-highlight-color: transparent;
  /* No scale/lift on the button itself — each material animates only its own
     look (a glint, a glow) on hover/press, nothing generic. */
  transition:
    filter 0.2s ease,
    box-shadow 0.2s ease;
}
.depth-label {
  position: relative;
  z-index: 2;
  display: inline-flex;
  align-items: center;
}
/* icon variant: a square button (same material, different silhouette) */
.depth-btn.depth-icon {
  width: 44px;
  padding: 0;
  border-radius: 14px;
}

/* ── Toggle switch: the material is the TRACK; a solid knob slides on top ───── */
.depth-btn.depth-toggle {
  width: 76px;
  padding: 0;
  cursor: pointer;
}
/* the knob — a smaller, textured circle that rides above the material and glides.
   Texture: a soft top highlight + a faint bottom shade baked into the background,
   plus a hairline rim, so it reads as a rounded physical dot, not a flat disc. */
.depth-knob {
  position: absolute;
  z-index: 3;
  top: 7px;
  left: 7px;
  width: 30px;
  height: 30px;
  border-radius: 999px;
  background:
    radial-gradient(120% 120% at 50% 22%, rgba(255, 255, 255, var(--knob-hi, 0.55)), rgba(255, 255, 255, 0) 55%),
    radial-gradient(120% 120% at 50% 100%, rgba(0, 0, 0, var(--knob-lo, 0.22)), rgba(0, 0, 0, 0) 55%),
    var(--knob, #ffffff);
  box-shadow:
    0 1px 2px rgba(0, 0, 0, 0.35),
    0 2px 5px rgba(0, 0, 0, 0.22),
    inset 0 1px 1px rgba(255, 255, 255, var(--knob-hi, 0.5)),
    inset 0 0 0 1px rgba(0, 0, 0, 0.06);
  transition: transform 0.28s cubic-bezier(0.22, 1, 0.36, 1);
}
.depth-toggle[data-on="true"] .depth-knob {
  transform: translateX(32px);
}
/* off state reads a little dimmer, so "on" is clearly the lit one */
.depth-toggle[data-on="false"] {
  filter: saturate(0.6) brightness(0.94);
}
/* per-material knob colour: dark knob on the pale materials, white elsewhere.
   Dark knobs get much softer texture (the highlight/shade would read as heavy
   gloss on a near-black circle). */
.depth-inset,
.depth-satin,
.depth-metal,
.depth-glass {
  --knob: #2a2f3a;
  --knob-hi: 0.14;
  --knob-lo: 0.08;
}
.depth-btn::before,
.depth-btn::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  z-index: 1;
  pointer-events: none;
}
/* ::before defaults to visible now; materials that want it hidden set opacity:0
   themselves. (No generic white sheen-fade on hover.) */

/* ── Glossy — a specular highlight bar over a gradient body ──────────────────
   The classic app-button look. A bright-to-dark gradient body, faint inner rim
   light, a dark inset at the bottom for weight, and a blurred white bar that
   overhangs the top edge like studio lighting on plastic. */
.depth-glossy {
  overflow: hidden; /* clip the highlight bar to the pill */
  background: linear-gradient(180deg, #ffb347 0%, #e06c1f 100%);
  box-shadow:
    inset 0 -1px 4.1px 0.5px rgba(255, 224, 160, 0.55),
    inset 0 0 4px 0 rgb(255, 234, 200),
    inset 0 -36px 14.2px -28px rgba(180, 80, 20, 0.5),
    0 3px 8px rgba(200, 96, 30, 0.35);
  text-shadow: 0 1px 2px rgba(90, 40, 0, 0.5);
}
.depth-glossy::after {
  content: "";
  position: absolute;
  left: 10px;
  right: 10px;
  top: -5px;
  height: 28px;
  border-radius: 500px;
  background: linear-gradient(to top, rgba(255, 255, 255, 0), #fff);
  filter: blur(1px);
  opacity: 0.7;
  transition: opacity 0.3s ease, top 0.3s ease;
  z-index: 1;
}
.depth-glossy:hover::after {
  opacity: 0.9;
  top: -3px;
}

/* ── Glow — a solid body lit from inside, hover turns the light up ───────────
   No specular. The depth is an internal glow: a dark-to-bright gradient with
   inset color glows, and a ::before that swaps to a brighter gradient with crisp
   light along the lower inner edge — the button appears to power on. */
.depth-glow {
  color: #fdeaff;
  text-shadow: 0 1px 2px rgba(40, 0, 48, 0.55);
  background: linear-gradient(180deg, #2a0a45 0%, #a01fd0 100%);
  box-shadow:
    inset 0 -1.5px 2px 0 #d67bff,
    inset 0 0 10px 0 #b01ffb,
    inset 0 0 8px 0 #b01ffb,
    0 2px 6px rgba(140, 20, 200, 0.35);
}
/* the brighter "light on" layer: hidden at rest, fades in on hover */
.depth-glow::before {
  opacity: 0;
  transition: opacity 0.2s ease;
  background: linear-gradient(180deg, #45108a 9%, #c31ffb 100%);
  box-shadow:
    inset 0 -0.5px 1px 0 #ff8cf0,
    inset 0 -1px 3px 0 #ff8cf0,
    inset 0 -1.5px 5px 0 #ff9ce8,
    inset 0 0 12px 0 #d155ff,
    inset 0 0 10px 0 #d155ff;
}
.depth-glow:hover::before {
  opacity: 1;
}

/* ── Metal — brushed surface with a bevel and a sheen that follows the cursor ─
   A cool vertical gradient with a bright top bevel and dark bottom bevel, a
   faint vertical "brushing", and a diagonal specular streak (::after) whose
   position tracks --pointer-x (a driver updates it while hovering; it rests in
   the centre). The glint slides to wherever the light "hits" as you move. */
.depth-metal {
  --pointer-x: 50%; /* driven by JS on hover; falls back to centre */
  color: #1c2230;
  text-shadow: 0 1px 0 rgba(255, 255, 255, 0.55);
  overflow: hidden;
  background:
    repeating-linear-gradient(
      90deg,
      rgba(255, 255, 255, 0.05) 0px,
      rgba(0, 0, 0, 0.04) 1px,
      rgba(255, 255, 255, 0.05) 2px
    ),
    linear-gradient(180deg, #f4f6f9 0%, #c3cad6 48%, #aab2c0 52%, #d3d9e2 100%);
  box-shadow:
    inset 0 1px 0 0 rgba(255, 255, 255, 0.9),
    inset 0 -1px 1px 0 rgba(30, 38, 56, 0.35),
    inset 0 0 0 1px rgba(255, 255, 255, 0.25),
    0 3px 8px rgba(30, 38, 56, 0.28);
}
/* the moving glint: a soft band positioned at the cursor's x (smoothed in CSS) */
.depth-metal::after {
  opacity: 0.85;
  background: radial-gradient(
    120% 140% at var(--pointer-x, 50%) -20%,
    rgba(255, 255, 255, 0.85) 0%,
    rgba(255, 255, 255, 0.25) 18%,
    rgba(255, 255, 255, 0) 42%
  );
  transition: opacity 0.3s ease, background 0.12s linear;
}
.depth-metal:hover::after {
  opacity: 1;
}

/* ── Layered — depth from soft translucent overlays over any fill ────────────
   No baked colours: a translucent black base plus faint layers, so it adds depth
   to a button of ANY fill. Kept smooth — one gentle top→bottom dome on the body,
   a soft top sheen (::before, fades on press), and a clean even hairline rim
   (::after). Nothing heavy or uneven. */
.depth-layered {
  overflow: hidden;
  /* One smooth translucent body — no heavy center-shade. A single gentle
     top-to-bottom lightening does the doming, so it reads clean over any fill. */
  background:
    linear-gradient(
      180deg,
      rgba(255, 255, 255, 0.1) 0%,
      rgba(255, 255, 255, 0) 40%,
      rgba(0, 0, 0, 0.12) 100%
    ),
    rgba(0, 0, 0, 0.55);
}
/* layer 1 — a soft top sheen (fades in on hover, off on press) */
.depth-layered::before {
  opacity: 0.1;
  background: linear-gradient(180deg, #fff 0%, rgba(255, 255, 255, 0) 60%);
  transition: opacity 0.2s ease;
}
.depth-layered:hover::before {
  opacity: 0.15;
}
.depth-layered:active::before {
  opacity: 0;
  transition-duration: 0.05s;
}
/* layer 2 — a clean, even hairline rim (soft, not the uneven white/grey band) */
.depth-layered::after {
  opacity: 1;
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.16),
    inset 0 1px 0 0 rgba(255, 255, 255, 0.14);
}

/* ── Inset — carved INTO the surface (the only recessed one) ─────────────────
   Unlike every other type (which sit ON the page), this one reads as a hole cut
   into it. The trick: the fill is NEARLY the page colour, so it looks like the
   same surface pushed inward — then a hard dark shadow along the TOP inner edge
   (the near wall the light can't reach) and a bright highlight along the BOTTOM
   inner edge + a 1px light lip just BELOW the button (the far rim catching light).
   No outer drop shadow (recessed things don't float). Tuned for a light page. */
.depth-inset {
  color: #5b6473;
  text-shadow: 0 1px 0 rgba(255, 255, 255, 0.7);
  background: linear-gradient(180deg, #dfe3ea 0%, #eef1f6 100%);
  box-shadow:
    inset 0 3px 4px -1px rgba(60, 70, 90, 0.5),
    inset 0 6px 10px -6px rgba(60, 70, 90, 0.45),
    inset 0 -2px 2px -1px rgba(255, 255, 255, 0.95),
    inset 0 0 0 1px rgba(60, 70, 90, 0.12),
    0 1px 0 0 rgba(255, 255, 255, 0.9); /* the lit far lip below the cut */
}
.depth-inset:hover {
  transform: none; /* recessed things don't lift */
  box-shadow:
    inset 0 4px 6px -1px rgba(60, 70, 90, 0.58),
    inset 0 8px 12px -6px rgba(60, 70, 90, 0.5),
    inset 0 -2px 2px -1px rgba(255, 255, 255, 1),
    inset 0 0 0 1px rgba(60, 70, 90, 0.16),
    0 1px 0 0 rgba(255, 255, 255, 0.9);
}
.depth-inset:active {
  /* press flattens the depth — the cut shallows */
  box-shadow:
    inset 0 1px 2px 0 rgba(60, 70, 90, 0.4),
    inset 0 0 0 1px rgba(60, 70, 90, 0.12);
}

/* ── Glass — real refraction through an SVG displacement filter ──────────────
   The background is bent through the button, not just blurred. A tiny SVG filter
   (feImage of a red/blue gradient map -> three per-channel feDisplacementMaps ->
   blended) refracts what is behind it, then we stack glass highlights on top: a
   gradient border ring (::before), an inner diagonal shine (::after), a top edge
   light line, and a layered outer glow. Needs the <svg id="liquid-glass-filter">
   present in the document (see color-depth.html). Put it over something colorful.
   Falls back to a plain blur where url() backdrop filters aren't supported. */
.depth-glass {
  /* white text reads on the (often busy/photo) background behind the glass */
  color: #ffffff;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.45);
  background: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.12) 0%,
    rgba(255, 255, 255, 0.05) 50%,
    rgba(255, 255, 255, 0.12) 100%
  );
  -webkit-backdrop-filter: blur(2px) saturate(1.5) brightness(1.05);
  backdrop-filter: blur(2px) saturate(1.5) brightness(1.05);
  box-shadow:
    0 8px 32px rgba(31, 38, 135, 0.15),
    inset 0 0 0 1px rgba(255, 255, 255, 0.18),
    0 4px 24px rgba(0, 0, 0, 0.06),
    inset 0 1px 1px rgba(255, 255, 255, 0.4);
}
@supports (backdrop-filter: url(#liquid-glass-filter)) or
  (-webkit-backdrop-filter: url(#liquid-glass-filter)) {
  .depth-glass {
    -webkit-backdrop-filter: url(#liquid-glass-filter) saturate(1.5) brightness(1.05);
    backdrop-filter: url(#liquid-glass-filter) saturate(1.5) brightness(1.05);
  }
}
.depth-glass::before {
  opacity: 1;
  padding: 1px;
  background: linear-gradient(
    180deg,
    rgba(255, 255, 255, 0.5) 0%,
    rgba(255, 255, 255, 0.1) 45%,
    transparent 100%
  );
  -webkit-mask:
    linear-gradient(#fff 0 0) content-box,
    linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
}
.depth-glass::after {
  opacity: 0.8;
  inset: 2px;
  border-radius: inherit;
  background:
    linear-gradient(to right, transparent 10%, rgba(255, 255, 255, 0.6) 50%, transparent 90%)
      top / 100% 1px no-repeat,
    linear-gradient(135deg, rgba(255, 255, 255, 0.3) 0%, transparent 50%, rgba(255, 255, 255, 0.05) 100%);
}
.depth-glass:hover {
  box-shadow:
    0 12px 40px rgba(31, 38, 135, 0.2),
    inset 0 0 0 1px rgba(255, 255, 255, 0.25),
    0 6px 30px rgba(0, 0, 0, 0.08),
    inset 0 2px 2px rgba(255, 255, 255, 0.5);
}

/* ── Foil — iridescent metal that reacts to the cursor ───────────────────────
   The richest one: a silver metal base with a holographic rainbow that shifts,
   soft coloured "film" blobs, a pearly sheen, a moving shine band and a glare
   dot at the cursor. Built from stacked CHILD layers (not just pseudo-elements)
   because it needs five. A tiny JS driver feeds --pointer-x/y, --glare-x/y,
   --foil-shift and --shine-angle while hovering; without JS it still shows a
   handsome static foil. Markup:
     <button class="depth-btn depth-foil">
       <span class="depth-foil-l depth-foil-base"></span>
       <span class="depth-foil-l depth-foil-film"></span>
       <span class="depth-foil-l depth-foil-pearl"></span>
       <span class="depth-label">Get Started</span>
       <span class="depth-foil-l depth-foil-shine"></span>
       <span class="depth-foil-l depth-foil-glare"></span>
     </button>  */
.depth-foil {
  --foil-shift: 0%;
  --glare-x: 50%;
  --glare-y: 50%;
  --pointer-x: 50%;
  --pointer-y: 50%;
  --shine-angle: 135deg;
  color: #14202e;
  text-shadow: 0 1px 0 rgba(255, 255, 255, 0.5);
  overflow: hidden;
  background: linear-gradient(135deg, #eee 0%, #dcdcdc 40%, #c9c9c9 72%, #e8e8e8 100%);
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.5),
    inset 0 1px 1px rgba(255, 255, 255, 0.7),
    inset 0 -2px 4px rgba(60, 70, 90, 0.3),
    0 3px 10px rgba(30, 38, 56, 0.3);
}
.depth-foil-l {
  position: absolute;
  inset: -48%;
  z-index: 1;
  background-repeat: no-repeat;
  pointer-events: none;
}
/* the rainbow band over silver — visible at rest, and it drifts on its own so
   the foil shimmers without the cursor. The JS driver nudges --foil-shift on
   hover, which composes on top of the ambient drift via translateX. */
.depth-foil-base {
  background: linear-gradient(
    112deg,
    transparent 22%,
    rgba(0, 220, 255, 0.4) 30%,
    rgba(80, 255, 190, 0.34) 36%,
    rgba(190, 255, 80, 0.26) 41%,
    rgba(255, 230, 70, 0.24) 47%,
    rgba(255, 70, 180, 0.36) 55%,
    rgba(150, 90, 255, 0.36) 63%,
    rgba(60, 120, 255, 0.3) 70%,
    transparent 80%
  );
  background-size: 240% 100%;
  filter: saturate(1.3) contrast(1.25);
  /* Ambient drift ONLY (background-position). The pointer does NOT move this
     layer — that's what made it jump/lose state on hover. The rainbow just
     glides on its own; the cursor drives the highlight layers below instead. */
  animation: depth-foil-drift 7s ease-in-out infinite alternate;
}
/* soft coloured film blobs — also visible at rest, gently breathing */
.depth-foil-film {
  background:
    radial-gradient(ellipse at 20% 30%, rgba(255, 70, 180, 0.34) 0%, transparent 48%),
    radial-gradient(ellipse at 70% 20%, rgba(0, 220, 255, 0.34) 0%, transparent 52%),
    radial-gradient(ellipse at 78% 74%, rgba(80, 255, 190, 0.34) 0%, transparent 56%);
  background-size: 150% 150%, 160% 160%, 145% 145%;
  filter: blur(0.4px) saturate(1.4);
  mix-blend-mode: screen;
  opacity: 0.7;
  animation: depth-foil-drift 9s ease-in-out infinite alternate-reverse;
}
@keyframes depth-foil-drift {
  from {
    background-position: 0% center;
  }
  to {
    background-position: 100% center;
  }
}
@media (prefers-reduced-motion: reduce) {
  .depth-foil-base,
  .depth-foil-film {
    animation: none;
  }
}
/* pearly sheen — a soft moving highlight that tracks the cursor smoothly */
.depth-foil-pearl {
  z-index: 2;
  inset: 0; /* keep it on-box so its position math is stable, no jump */
  background: radial-gradient(
    120% 120% at var(--glare-x, 50%) var(--glare-y, 50%),
    rgba(230, 238, 245, 0.6) 0%,
    rgba(205, 217, 226, 0.2) 26%,
    transparent 58%
  );
  mix-blend-mode: soft-light;
  opacity: 0.95;
  transition: background 0.12s linear; /* smooth the cursor tracking */
}
/* the travelling shine band, angled by the cursor */
.depth-foil-shine {
  z-index: 4;
  inset: 0;
  background: linear-gradient(
    var(--shine-angle, 120deg),
    transparent 30%,
    rgba(226, 235, 242, 0.5) 48%,
    rgba(0, 124, 255, 0.1) 58%,
    rgba(255, 0, 147, 0.1) 66%,
    transparent 82%
  );
  background-size: 200% 100%;
  background-position: calc(var(--pointer-x, 50%)) center;
  filter: blur(0.25px);
  mix-blend-mode: screen;
  opacity: 0.6;
  transition: background-position 0.12s linear;
}
/* a bright glare dot right under the cursor */
.depth-foil-glare {
  z-index: 5;
  inset: 0;
  background: radial-gradient(
    circle at var(--glare-x, 50%) var(--glare-y, 50%),
    rgba(230, 238, 245, 0.55) 0%,
    rgba(205, 218, 228, 0.16) 10%,
    transparent 38%
  );
  mix-blend-mode: screen;
  opacity: 0.5;
  transition: background 0.12s linear;
}
@media (prefers-reduced-motion: reduce) {
  .depth-foil-l {
    transition: none;
  }
}

/* ── Neon — a crisp lit outline (a clean line, not a bloom) ──────────────────
   Restrained on purpose: the depth is one precise bright RING drawn as a solid
   line, with only a whisper of glow so it reads as a lit tube, not a shadow
   storm. A very slight inner tint from the bottom grounds the body. Hover firms
   the line and adds the faintest bloom. Refined, "in line", not shadowy. */
.depth-neon {
  --neon: #35f0ff;
  color: #eafeff;
  background:
    linear-gradient(180deg, rgba(53, 240, 255, 0) 55%, color-mix(in srgb, var(--neon) 12%, transparent) 100%),
    #0b1016;
  text-shadow: 0 0 5px color-mix(in srgb, var(--neon) 55%, transparent);
}
/* the ring: a clean 1px line with only the faintest inner glow — no outer bloom */
.depth-neon::before {
  opacity: 1;
  box-shadow:
    inset 0 0 0 1px var(--neon),
    inset 0 0 2px 0 color-mix(in srgb, var(--neon) 45%, transparent);
  transition: box-shadow 0.25s ease;
}
.depth-neon:hover::before {
  box-shadow:
    inset 0 0 0 1px color-mix(in srgb, var(--neon) 55%, #fff),
    inset 0 0 4px 0 color-mix(in srgb, var(--neon) 60%, transparent),
    0 0 4px -2px color-mix(in srgb, var(--neon) 50%, transparent);
}

/* ── Duotone — a hard-bevel extruded key (crisp, not soft) ───────────────────
   No blur in the depth: a bright top FACE gradient, then a solid darker "side"
   under it built from stacked 1px box-shadows (the extrusion), so it looks like
   a chunky moulded plastic key. Pressing pushes it down onto its own side. */
.depth-duotone {
  background: linear-gradient(180deg, #ff8a4b 0%, #f2612f 100%);
  color: #fff;
  text-shadow: 0 1px 0 rgba(140, 50, 10, 0.6);
  box-shadow:
    inset 0 1px 0 rgba(255, 220, 190, 0.9),
    /* the extruded side: stacked hard shadows in the darker tone */
    0 1px 0 #c9481c,
    0 2px 0 #c9481c,
    0 3px 0 #b23f18,
    0 4px 0 #b23f18,
    0 5px 0 #9c3714,
    0 6px 0 #9c3714,
    0 8px 8px rgba(120, 40, 10, 0.35);
  transition:
    transform 0.12s cubic-bezier(0.22, 1, 0.36, 1),
    box-shadow 0.12s ease;
}
.depth-duotone:hover {
  transform: translateY(-1px);
}
.depth-duotone:active {
  /* slam down onto the extrusion */
  transform: translateY(5px);
  box-shadow:
    inset 0 1px 0 rgba(255, 220, 190, 0.9),
    0 1px 0 #b23f18,
    0 2px 4px rgba(120, 40, 10, 0.35);
}

/* ── Satin — a single flat colour with the softest possible dome ─────────────
   Deliberately the OPPOSITE of Glossy: no gradient body, no specular, no top
   light bar. One solid pastel, and the only depth is a very soft radial vignette
   baked into the background (brighter centre, a hair darker at the rim) plus a
   whisper-thin inner ring. Nothing hard anywhere — pure smooth matte. */
.depth-satin {
  color: #6a4a86;
  text-shadow: 0 1px 1px rgba(255, 255, 255, 0.6);
  background:
    radial-gradient(
      120% 140% at 50% 38%,
      rgba(255, 255, 255, 0.5) 0%,
      rgba(255, 255, 255, 0) 55%
    ),
    radial-gradient(
      130% 130% at 50% 100%,
      rgba(150, 120, 200, 0.22) 0%,
      rgba(150, 120, 200, 0) 60%
    ),
    #e7dcfb;
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.45),
    0 6px 18px -6px rgba(160, 130, 210, 0.4);
  transition:
    filter 0.25s ease,
    transform 0.2s cubic-bezier(0.22, 1, 0.36, 1);
}
.depth-satin:hover {
  filter: brightness(1.03);
}
.depth-satin:active {
  box-shadow:
    inset 0 2px 6px 0 rgba(150, 120, 200, 0.4),
    inset 0 0 0 1px rgba(255, 255, 255, 0.4);
}

```

### color-depth/standalone/color-depth.html

```html
<!-- The Art of Color Depth — markup for the ten button materials + three shapes.
     Load color-depth.css, then use `depth-btn` plus one material class. The markup
     is identical for every material; only the second class changes.

     Pure CSS gets you every static look. Two things want the small companion
     script (color-depth.js): the cursor-reactive materials (Metal, Foil) and the
     toggle's slide. Glass also needs the SVG filter at the bottom, once. -->

<link rel="stylesheet" href="color-depth.css" />

<!-- the ten materials, on the default label pill -->
<button class="depth-btn depth-glossy"><span class="depth-label">Get Started</span></button>
<button class="depth-btn depth-glow"><span class="depth-label">Get Started</span></button>
<button class="depth-btn depth-metal"><span class="depth-label">Get Started</span></button>
<button class="depth-btn depth-layered"><span class="depth-label">Get Started</span></button>
<button class="depth-btn depth-inset"><span class="depth-label">Get Started</span></button>
<button class="depth-btn depth-glass"><span class="depth-label">Get Started</span></button>
<button class="depth-btn depth-neon"><span class="depth-label">Get Started</span></button>
<button class="depth-btn depth-duotone"><span class="depth-label">Get Started</span></button>
<button class="depth-btn depth-satin"><span class="depth-label">Get Started</span></button>

<!-- Foil needs its five stacked layers around the label. Without the script it
     is still a handsome static holographic silver; with it, it tracks the cursor. -->
<button class="depth-btn depth-foil">
  <span aria-hidden class="depth-foil-l depth-foil-base"></span>
  <span aria-hidden class="depth-foil-l depth-foil-film"></span>
  <span aria-hidden class="depth-foil-l depth-foil-pearl"></span>
  <span class="depth-label">Get Started</span>
  <span aria-hidden class="depth-foil-l depth-foil-shine"></span>
  <span aria-hidden class="depth-foil-l depth-foil-glare"></span>
</button>

<!-- other shapes, same material class. Icon button (a square) -->
<button class="depth-btn depth-icon depth-glossy" aria-label="Go">
  <span class="depth-label">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></svg>
  </span>
</button>

<!-- Toggle switch: material on the track, a sliding knob on top. The script flips
     data-on on click; start it on or off with the attribute. -->
<button class="depth-btn depth-toggle depth-glossy" role="switch" data-on="true" aria-label="Toggle">
  <span aria-hidden class="depth-knob"></span>
</button>

<!-- Glass refraction filter. Keep it once in the page (it can be visually
     hidden). The .depth-glass rule points at it via backdrop-filter: url(#…). -->
<svg width="0" height="0" style="position:absolute" aria-hidden="true">
  <defs>
    <filter id="liquid-glass-filter" color-interpolation-filters="sRGB">
      <!-- map: neutral-grey centre (no shift) ramping to colour only at the rim,
           so glass bends the view at its edges and passes the centre through. -->
      <feImage x="0" y="0" width="100%" height="100%"
        href="data:image/svg+xml,%3Csvg%20viewBox%3D%270%200%20200%2080%27%20xmlns%3D%27http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%27%3E%3Cdefs%3E%3ClinearGradient%20id%3D%27r%27%20x2%3D%27100%25%27%3E%3Cstop%20stop-color%3D%27%23f00%27%2F%3E%3Cstop%20offset%3D%2750%25%27%20stop-color%3D%27%23808080%27%2F%3E%3Cstop%20offset%3D%27100%25%27%20stop-color%3D%27%230f0%27%2F%3E%3C%2FlinearGradient%3E%3ClinearGradient%20id%3D%27b%27%20y2%3D%27100%25%27%3E%3Cstop%20stop-color%3D%27%2300f%27%2F%3E%3Cstop%20offset%3D%2750%25%27%20stop-color%3D%27%23808080%27%2F%3E%3Cstop%20offset%3D%27100%25%27%20stop-color%3D%27%23ff0%27%2F%3E%3C%2FlinearGradient%3E%3C%2Fdefs%3E%3Crect%20width%3D%27200%27%20height%3D%2780%27%20rx%3D%2740%27%20fill%3D%27url%28%23r%29%27%2F%3E%3Crect%20width%3D%27200%27%20height%3D%2780%27%20rx%3D%2740%27%20fill%3D%27url%28%23b%29%27%20style%3D%27mix-blend-mode%3Aoverlay%27%2F%3E%3Crect%20x%3D%2714%27%20y%3D%2714%27%20width%3D%27172%27%20height%3D%2752%27%20rx%3D%2726%27%20fill%3D%27%23808080%27%20style%3D%27filter%3Ablur%2814px%29%27%2F%3E%3C%2Fsvg%3E"
        result="map" />
      <feDisplacementMap in="SourceGraphic" in2="map" scale="-14" xChannelSelector="R" yChannelSelector="G" result="dispRed" />
      <feColorMatrix in="dispRed" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="red" />
      <feDisplacementMap in="SourceGraphic" in2="map" scale="-13" xChannelSelector="R" yChannelSelector="G" result="dispGreen" />
      <feColorMatrix in="dispGreen" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="green" />
      <feDisplacementMap in="SourceGraphic" in2="map" scale="-12" xChannelSelector="R" yChannelSelector="G" result="dispBlue" />
      <feColorMatrix in="dispBlue" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="blue" />
      <feBlend in="red" in2="green" mode="screen" result="rg" />
      <feBlend in="rg" in2="blue" mode="screen" result="output" />
      <feGaussianBlur in="output" stdDeviation="0.4" />
    </filter>
  </defs>
</svg>

<!-- optional: cursor-reactive materials + the toggle slide. Static without it. -->
<script src="color-depth.js"></script>

```

### color-depth/standalone/color-depth.js

```js
// Optional behaviour for the color-depth buttons. Pure CSS gets you every static
// look; this adds the two interactive bits:
//   1. the cursor-reactive materials (Metal's glint, Foil's sheen) follow the
//      pointer — it writes --pointer-x/y, --glare-x/y and --shine-angle on the
//      element; the smoothing lives in the CSS transitions, not here.
//   2. the toggle switch flips its `data-on` on click so the knob slides.
//
// Drop it in and call `initColorDepth()` once (or let it auto-run on load). It is
// framework-free and safe to run again after adding more buttons.

function initColorDepth(root = document) {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // cursor-reactive materials
  if (!reduce) {
    root.querySelectorAll(".depth-metal, .depth-foil").forEach((el) => {
      if (el.dataset.depthBound) return;
      el.dataset.depthBound = "1";
      let raf = 0;
      let px = 0.5;
      let py = 0.5;
      const write = () => {
        raf = 0;
        const s = el.style;
        s.setProperty("--pointer-x", (px * 100).toFixed(1) + "%");
        s.setProperty("--pointer-y", (py * 100).toFixed(1) + "%");
        s.setProperty("--glare-x", (px * 100).toFixed(1) + "%");
        s.setProperty("--glare-y", (py * 100).toFixed(1) + "%");
        s.setProperty("--shine-angle", (110 + (px - 0.5) * 50).toFixed(1) + "deg");
      };
      const schedule = () => {
        if (!raf) raf = requestAnimationFrame(write);
      };
      el.addEventListener(
        "pointermove",
        (e) => {
          const r = el.getBoundingClientRect();
          if (r.width && r.height) {
            px = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
            py = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
          }
          schedule();
        },
        { passive: true },
      );
      el.addEventListener("pointerleave", () => {
        px = 0.5;
        py = 0.5;
        schedule();
      });
    });
  }

  // toggle switches: flip data-on on click (the CSS slides the knob)
  root.querySelectorAll(".depth-toggle").forEach((el) => {
    if (el.dataset.depthToggleBound) return;
    el.dataset.depthToggleBound = "1";
    if (!el.hasAttribute("data-on")) el.setAttribute("data-on", "true");
    el.addEventListener("click", () => {
      el.setAttribute("data-on", el.getAttribute("data-on") === "true" ? "false" : "true");
    });
  });
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => initColorDepth());
  } else {
    initColorDepth();
  }
}

```

### color-depth/standalone/SKILL.md

```md
---
name: skeuomorphic-button-depth
description: >-
  Give any button, control, or surface real physical depth in CSS — glossy,
  metal, glass, matte, neon, recessed, and more — in any colour or mode, not just
  dark. Use whenever a button/pill/icon/toggle/card should read as a tactile
  object instead of a flat rectangle. Teaches the layering method (so you can
  build any material on any shape) plus ten ready techniques.
---

# Skeuomorphic button depth

Depth is never one drop shadow. It is many faint layers stacked on the same
element, each faking one part of how light meets a real surface: the body, the
bevel, the inner glow, the reflection. Learn the layers and you can dress any
button in any material — this works in light, dark, or full-colour palettes; the
colours are variables, the method is fixed.

## The one rule everything obeys

Pick a single light direction and commit every layer to it. By default the light
is from the **top**: bright edge on top, dark edge on the bottom, on every
element in the group. The moment two controls disagree about where the light is,
the illusion breaks. Flip the direction only on purpose (a pressed or recessed
control, below).

The surface also has to sit apart from what's behind it — a raised button needs a
background a step darker or lighter than itself, or its lift shadow has nothing to
lift off.

## The layer recipe

Build any material from the same four layers, outermost first:

1. **Body** — usually a top-to-bottom gradient, lighter at the top so the face
   reads as lit from above. `background: linear-gradient(180deg, <light>, <dark>)`.
   A flat fill is fine for matte materials; the doming then comes from step 2.

2. **Inset shadows** — the bevel and inner light, all `box-shadow` with `inset`:
   - a bright inset at the **top** = the lit bevel edge,
   - a dark inset at the **bottom** = weight and thickness,
   - broad soft inner glows = a domed, internally-lit face,
   - a hairline `inset 0 0 0 1px` = a crisp rim that catches light.

3. **Hover layer (`::before`)** — a second, brighter version of the body/insets
   that fades in on hover: "the light turning on." Keep the label above it with
   `isolation: isolate` (or a `z-index` on the text).

4. **Specular (`::after`)** — a soft bright bar or blob near the top edge
   (`linear-gradient` white → transparent, a touch of `blur`, low opacity): the
   reflection on glossy plastic or glass. Move or brighten it on hover for life.

Not every material uses all four — matte uses 1–2, neon leans on the rim, glass
adds real `backdrop-filter`. Add only the layers the material needs.

## Raised vs recessed

Two opposite reads, same toolkit, mirrored:

- **Raised** (sits on the page): bright inset on top, dark inset on the bottom,
  and an outer drop shadow to lift it off the background.
- **Recessed** (carved into the page): flip it — a dark inset on top (the near
  wall in shadow), a bright inset on the bottom (the far wall catching light),
  and **no** outer shadow. Make the fill close to the page colour so it looks
  like the same surface pushed inward, not a separate dark chip.

On press, a raised control should briefly become recessed (swap the outer lift
for inner shadows, ~50ms), so it visibly pushes in.

## Build order (for compound controls)

For anything with parts — a toggle, a segmented control, a stepper — layer from
the outside in, and don't skip a level:

1. the surface behind it (a step darker/lighter than the control),
2. the raised shell / track (the material lives here),
3. any recessed zones inside it (a track well, an active-segment notch),
4. the raised moving parts (a knob, a thumb) — same material as the shell unless
   you want deliberate contrast,
5. the readout on top (label, value, icon).

Put the material on the **container**, not each cell, so a compound control reads
as one carved piece.

## Rules

1. **One element, many layers.** Use `::before`/`::after` for the glow and sheen,
   not extra DOM. `isolation: isolate` keeps the label on top.
2. **Commit to the light direction** (see above). No element disagrees.
3. **Tint the layers toward the material**, don't just add black/white — cyan
   inside a blue glass, warm white inside a warm gel.
4. **Press = invert.** `:active` swaps lift for inner shadow (or collapses the
   sheen). Short transition (~50ms).
5. **Motion is subtle.** The material sells the depth; a hover doesn't need a big
   lift or scale. A moving highlight beats a moving button.
6. **Respect reduced motion.** Guard transforms/animations with
   `@media (prefers-reduced-motion: reduce)`.
7. **Stay compact.** Real controls are dense: tight padding, ~13–15px labels,
   restrained icons. Reach for smaller spacing before bigger type.

## Anti-patterns

- A flat block with a single soft shadow and no inset layers.
- Light coming from different directions on neighbouring controls.
- Glow so bright it erases the form underneath.
- A "recessed" control whose shadows are oriented like a raised one (it pops out).
- A raised control on a background lighter/brighter than itself (nothing to lift
  from).
- One shared inset behind several buttons when each wants its own well.

## Any shape, any palette

The same `depth-btn` base + one material class works on more than a text pill.
This entry ships the label pill, a square **icon** button (`.depth-icon`), and a
**toggle** switch (the material on the track, a sliding knob on top) — and the
method extends to steppers, cards, inputs, or any control you need. Colour is a
value you swap: retint the gradient stops and inset colours and the same material
becomes a new theme.

## Types

Ten techniques, named by method (colour is just a value you swap). Same markup,
one class swap:

- **Glossy** (`depth-glossy`) — a specular highlight bar over a gradient body.
- **Glow** (`depth-glow`) — a solid body lit from inside; hover turns it up.
- **Metal** (`depth-metal`) — a brushed bevel with a glint that follows the cursor.
- **Foil** (`depth-foil`) — iridescent holographic metal; five stacked light layers
  that shift and glare under the cursor (needs its child layers + a tiny pointer
  driver for --pointer-x/y, --glare-x/y, --shine-angle).
- **Layered** (`depth-layered`) — soft translucent overlays over any fill.
- **Inset** (`depth-inset`) — recessed into the surface; the bevel is flipped.
- **Glass** (`depth-glass`) — subtle refraction through an SVG displacement filter.
- **Neon** (`depth-neon`) — a crisp lit outline; a clean ring, not a bloom.
- **Duotone** (`depth-duotone`) — a hard-bevel extruded key from stacked shadows.
- **Satin** (`depth-satin`) — a soft smooth pastel; diffuse light, no gloss or grain.

## Drop-in CSS

A complete `color-depth.css` implementing all ten is the companion to this skill.
Markup is always the same; only the second class changes:

```html
<button class="depth-btn depth-glossy">
  <span class="depth-label">Get Started</span>
</button>
```

```
