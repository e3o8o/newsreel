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

---

## Set 2 (received 2026-07-30)

9. You are given the complete source for a self-contained web visual: "The typer".

What it is:
- Most headlines fade in. The nice ones type in. A wave runs across the line, and as it passes each letter the letter flickers through a few states, a solid pill, a highlight, an outlined pill, then lands on plain text. Letters next to each other in the same state merge into one long rounded bar.
- Below you can type your own text and change the color, the speed, and which states are in the mix. The colors are three variables, so it drops onto any theme.

How to use this code:
- It is a React + TypeScript component tree (Next.js App Router) that renders to an HTML canvas; the entry point is the playground component.
- Drop the files into a project under the same relative paths, mount the playground component, and it runs as-is. No external assets beyond what's inline.
- To adapt it: change the resolved word/logo, the color controls, or the experiment parameters. Ask me to modify, explain, or port any part.

The full source follows, one file per block:

### typer/standalone/typer.ts

```ts
// Typer — a character-by-character text reveal where each glyph ripples through a
// pool of randomized visual states (filled pill, inverse, accent, outlined pill…)
// before settling into plain text. Adjacent same-state chars merge into one
// rounded bar (that corner-merging is pure CSS, see typer.css).
//
// The reveal is a frame loop: a normalized progress runs across the word, and each
// character has its own bezier "control point" so the wave of state-changes ripples
// smoothly instead of marching in a straight line. Per character, once progress has
// passed it, it rolls through `cycles` random states, then settles.
//
// Framework-free. Attach one Typer to a [data-typer] element, then drive it with
// in()/out()/inOut()/reset(). A TyperGroup runs several with a per-line stagger,
// which is how a stacked block cascades in.

// ── math helpers ──
const clamp = (v: number, lo: number, hi: number) =>
  v < lo ? lo : v > hi ? hi : v;

// round v to the nearest multiple of step (quantizes the per-char progress so a
// glyph holds each state for a beat instead of flickering every frame).
const roundToStep = (v: number, step: number) => Math.round(v / step) * step;

// linear remap of v from [inLo,inHi] into [outLo,outHi].
const remap = (
  v: number,
  inLo: number,
  inHi: number,
  outLo: number,
  outHi: number,
) => ((v - inLo) * (outHi - outLo)) / (inHi - inLo) + outLo;

// solve a cubic bezier easing y for a given x, control points (x1,y1)(x2,y2),
// endpoints fixed at (0,0)(1,1). Newton's method with a bisection fallback. Used
// once per character to place its reveal "control point" along an eased curve, so
// the ripple accelerates and settles like the original.
function bezierEase(
  x: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  eps = 1e-6,
): number {
  const bx = (t: number) =>
    3 * (1 - t) ** 2 * t * x1 + 3 * (1 - t) * t ** 2 * x2 + t ** 3;
  const by = (t: number) =>
    3 * (1 - t) ** 2 * t * y1 + 3 * (1 - t) * t ** 2 * y2 + t ** 3;
  const bxDeriv = (t: number) =>
    3 * (1 - t) ** 2 * x1 + 6 * (1 - t) * t * (x2 - x1) + 3 * t ** 2 * (1 - x2);

  let t = x;
  for (let i = 0; i < 8; i++) {
    const dx = bx(t) - x;
    if (Math.abs(dx) < eps) return by(t);
    const d = bxDeriv(t);
    if (Math.abs(d) < 1e-6) break;
    t -= dx / d;
  }
  let lo = 0,
    hi = 1;
  t = x;
  while (lo < hi) {
    const cx = bx(t);
    if (Math.abs(cx - x) < eps) return by(t);
    if (cx < x) lo = t;
    else hi = t;
    t = (lo + hi) / 2;
  }
  return by(t);
}

// the full pool of per-character states (CSS class suffixes). Any subset can be
// used; they get shuffled per run so the ripple never looks the same twice.
export const ALL_VARIATIONS = [
  "charFill",
  "charInverse",
  "charAccent",
  "charAccentInverse",
  "charAccentFill",
  "charBorder",
] as const;

export type TyperType = "initial" | "in" | "out" | "inout" | "done";

export interface TyperOptions {
  fps?: number; // frames per second of the reveal loop
  cycles?: number; // how many random states each char rolls through
  cycleLength?: number; // fraction of frames spent settling (0..1)
  delay?: number; // seconds before this typer's loop starts (per-line stagger)
  variations?: string[]; // which state classes are in the pool
  initVisible?: boolean; // start fully revealed (no animation)
}

interface CharNode {
  el: HTMLSpanElement;
  cp: number; // per-char control point (bezier-eased position along the word)
  currentClass: string;
}

export class Typer {
  private element: HTMLElement;
  private originalContent: string;
  private source: string;
  private length: number;
  private fps: number;
  private cycles: number;
  private cycleLength: number;
  private frames: number;
  private frame = 0;
  private loop: number | null = null;
  private delay: number;
  private delayTimer: number | null = null;
  private charNodes: CharNode[] = [];
  private type: TyperType = "initial";
  private divisor: number;
  private denominator: number;
  private variations: string[];
  private initVisible: boolean;

  constructor(element: HTMLElement, opts: TyperOptions = {}) {
    this.element = element;
    this.originalContent = element.innerHTML;
    this.source = element.textContent || "";
    this.length = this.source.replace(/\s/g, "").length;
    this.fps = opts.fps ?? 20;
    this.cycles = opts.cycles ?? 3;
    this.cycleLength = opts.cycleLength ?? 0.5;
    // total frames scales a little with word length so long lines don't feel rushed.
    this.frames = this.length ? this.fps * (1 + this.length * 0.01) : 0;
    this.delay = opts.delay ?? 0;
    this.divisor = this.length > 1 ? this.length - 1 : 1;
    this.denominator = this.frames - this.frames * this.cycleLength || 1;

    this.variations = (opts.variations ?? [...ALL_VARIATIONS]).slice();
    this.shuffle();
    this.initVisible = opts.initVisible ?? false;

    if (this.length) {
      this.build();
      if (this.initVisible) {
        this.charNodes.forEach((n) => this.setClass(n, "char"));
        this.type = "done";
        this.element.dataset.typerType = "done";
      } else {
        this.applyFrame();
        this.element.dataset.typerType = "initial";
      }
    }
  }

  // split into words (preserving whitespace nodes) and wrap each char in a span.
  // Each char gets a bezier-eased control point from its position in the word.
  private build() {
    this.element.innerHTML = "";
    this.charNodes = [];
    const parts = this.source.split(/(\s+)/);
    let i = 0;
    for (const part of parts) {
      if (part.trim() === "") {
        this.element.append(document.createTextNode(part));
        continue;
      }
      const word = document.createElement("span");
      word.className = "word";
      for (const ch of part.split("")) {
        const pos = i / this.divisor;
        // ease the control point so chars near the start reveal sooner, with a
        // smooth ramp; quantize to 0.05 so states hold for a beat.
        const cp = roundToStep(bezierEase(pos, 0, 0.75, 0.75, 0), 0.05);
        const span = document.createElement("span");
        span.className = "char charInit";
        span.textContent = ch || " ";
        this.charNodes.push({ el: span, cp, currentClass: "char charInit" });
        i += 1;
        word.appendChild(span);
      }
      this.element.appendChild(word);
    }
  }

  // swap this typer to new text and rebuild (used by the "type your own" control).
  reset(text: string) {
    this.stopLoop();
    this.source = text;
    this.length = text.replace(/\s/g, "").length;
    this.divisor = this.length > 1 ? this.length - 1 : 1;
    this.frames = this.length ? this.fps * (1 + this.length * 0.01) : 0;
    this.denominator = this.frames - this.frames * this.cycleLength || 1;
    this.frame = 0;
    this.type = "initial";
    this.build();
    this.applyFrame();
    this.element.dataset.typerType = "initial";
  }

  in() {
    this.setType("in");
  }
  out() {
    this.setType("out");
  }
  inOut() {
    this.setType("inout");
  }

  private setType(t: TyperType) {
    if (t === this.type && t !== "inout") return;
    this.type = t;
    this.element.dataset.typerType = t;
    this.stopLoop();
    this.frame = 0;
    this.applyFrame();
    if (t !== "initial" && this.charNodes.length) this.startLoop();
  }

  private startLoop() {
    if (this.loop || this.delayTimer || !this.charNodes.length) return;
    if (this.type === "initial") return;
    this.shuffle();
    const begin = () => {
      this.delayTimer = null;
      if (this.loop || this.type === "initial") return;
      this.applyFrame();
      this.loop = window.setInterval(() => this.tick(), 1000 / this.fps);
    };
    if (this.delay > 0) {
      this.delayTimer = window.setTimeout(begin, this.delay * 1000);
    } else {
      begin();
    }
  }

  private stopLoop() {
    if (this.delayTimer) {
      window.clearTimeout(this.delayTimer);
      this.delayTimer = null;
    }
    if (this.loop) {
      window.clearInterval(this.loop);
      this.loop = null;
    }
  }

  private tick() {
    // inout runs the in phase then the out phase back to back (2x the frames).
    const total = this.type === "inout" ? this.frames * 2 : this.frames;
    this.frame += 1;
    this.frame = clamp(this.frame, 0, total);
    this.applyFrame();
    if (this.frame >= total) {
      this.stopLoop();
      this.type = "done";
      this.element.dataset.typerType = "done";
    }
  }

  // paint every char's class for the current frame.
  private applyFrame() {
    if (!this.length || !this.charNodes.length) return;
    if (this.type === "initial") {
      this.charNodes.forEach((n) => this.setClass(n, "char charInit"));
      return;
    }
    // in the inout case, the second half is the "out" phase.
    const phase =
      this.type === "inout" && this.frame > this.frames
        ? "out"
        : this.type === "inout"
          ? "in"
          : this.type;
    const progress =
      (this.type === "inout" && phase === "out"
        ? this.frame - this.frames
        : this.frame) / this.denominator;

    for (const node of this.charNodes) {
      // this char's local progress = global progress minus its control-point offset.
      let p = progress - node.cp;
      p = roundToStep(p, 0.1);
      p = clamp(p, 0, 1);

      // pick a state: while mid-reveal, roll through the shuffled pool by cycle.
      let variation = "charInit";
      if (p > 0) {
        const idx = Math.round(remap(p, 0, 1, 0, this.cycles));
        variation = this.variations[idx % this.variations.length];
      }
      if (p >= 1) variation = ""; // settled → plain char
      const midClass = variation ? `char ${variation}` : "char";

      // "in" ramps charInit → states → plain; "out" runs it in reverse.
      let cls: string;
      if (phase === "in") {
        cls = p <= 0 ? "char charInit" : p >= 1 ? "char" : midClass;
      } else {
        cls = p <= 0 ? "char" : p >= 1 ? "char charInit" : midClass;
      }
      this.setClass(node, cls);
    }
  }

  private setClass(node: CharNode, cls: string) {
    if (cls === node.currentClass) return;
    node.currentClass = cls;
    node.el.className = cls;
  }

  private shuffle() {
    this.variations.sort(() => 0.5 - Math.random());
  }

  destroy() {
    this.stopLoop();
    this.element.innerHTML = this.originalContent;
    delete this.element.dataset.typerType;
  }
}

// Runs several typers together with a per-line stagger, so a stacked block cascades
// in top-to-bottom. Each line's `delay` offsets when its reveal starts.
export class TyperGroup {
  private typers: Typer[] = [];

  constructor(
    elements: HTMLElement[],
    opts: Omit<TyperOptions, "delay"> = {},
    stagger = 0.15, // seconds between consecutive lines
  ) {
    this.typers = elements.map(
      (el, i) => new Typer(el, { ...opts, delay: i * stagger }),
    );
  }

  in() {
    this.typers.forEach((t) => t.in());
  }
  out() {
    this.typers.forEach((t) => t.out());
  }
  destroy() {
    this.typers.forEach((t) => t.destroy());
  }
}

```

### typer/standalone/typer.css

```css
/* Typer — the styling for the character reveal. The engine (typer.ts) swaps each
   char's class between these states; the CSS is what makes a state look like a
   solid pill, an outlined pill, an accent block, and so on. The nicest trick is
   pill-merging: adjacent same-state chars round only at the two outer ends, so a
   run of them reads as one continuous rounded bar, not separate boxes.

   Everything is themed from four custom properties, so a preset can recolor the
   text, the pill fills, AND the borders all at once:
     --typer-fg          the base ink (plain letters, ink pills, ink borders)
     --typer-bg          the page / knockout color inside a filled pill
     --typer-accent      the accent surface (accent pill fills, accent borders)
     --typer-accent-ink  the text color that sits ON an accent fill
   Set them on the [data-typer] element or any ancestor. */

[data-typer] {
  --typer-fg: #1b1b1b;
  --typer-bg: #fcfcfc;
  --typer-accent: #12a150;
  --typer-accent-ink: #fcfcfc;
  --typer-radius: 5px;
}

/* before the reveal runs, the whole line is invisible (chars are charInit). */
[data-typer][data-typer-type="initial"] {
  opacity: 0;
}

[data-typer] .word {
  white-space: pre; /* keep intra-word spacing exact */
}

[data-typer] .word .char {
  box-sizing: content-box;
  display: inline-block;
  color: var(--typer-fg);
  background: transparent;
  transition: none; /* state changes are discrete frames, not tweened */
}

/* not yet revealed → transparent (holds the layout, shows nothing). */
[data-typer] .word .char.charInit {
  color: transparent;
}

/* ── Solid pill: ink block, knockout text. Adjacent fills merge into one bar. ── */
[data-typer] .word .char.charFill {
  color: var(--typer-bg);
  background: var(--typer-fg);
  border-radius: var(--typer-radius);
}
[data-typer] .word .char.charFill:has(+ .charFill) {
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
}
[data-typer] .word .char.charFill + .charFill {
  border-radius: 0;
}
[data-typer] .word .char.charFill + .charFill:last-child,
[data-typer] .word .char.charFill + .charFill:has(+ :not(.charFill)) {
  border-radius: 0 var(--typer-radius) var(--typer-radius) 0;
}

/* ── Inverse: ink knockout, no rounding (a hard block). ── */
[data-typer] .word .char.charInverse {
  color: var(--typer-bg);
  background: var(--typer-fg);
}

/* ── Accent: colored LETTERS on the page (no pill) — the accent reaching the
      text itself, not just a fill. ── */
[data-typer] .word .char.charAccent {
  color: var(--typer-accent);
  background: transparent;
}

/* ── Accent inverse: an accent PILL with knockout text sitting on it. Merges into
      a bar like the ink fill. ── */
[data-typer] .word .char.charAccentInverse {
  color: var(--typer-accent-ink);
  background: var(--typer-accent);
  border-radius: var(--typer-radius);
}
[data-typer] .word .char.charAccentInverse:has(+ .charAccentInverse) {
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
}
[data-typer] .word .char.charAccentInverse + .charAccentInverse {
  border-radius: 0;
}
[data-typer] .word .char.charAccentInverse + .charAccentInverse:last-child,
[data-typer]
  .word
  .char.charAccentInverse
  + .charAccentInverse:has(+ :not(.charAccentInverse)) {
  border-radius: 0 var(--typer-radius) var(--typer-radius) 0;
}

/* ── Accent fill: a briefly solid block of pure accent (both fill and text). ── */
[data-typer] .word .char.charAccentFill {
  color: var(--typer-accent);
  background: var(--typer-accent);
}

/* ── Outlined pill: an ACCENT border box around ink text; a run merges like the
      solid pill, but by dropping the inner vertical borders instead of the fill. ── */
[data-typer] .word .char.charBorder {
  position: relative;
  color: var(--typer-fg);
}
[data-typer] .word .char.charBorder::after {
  content: "";
  display: inline-block;
  position: absolute;
  inset: 0;
  border: 1px solid var(--typer-accent);
  border-radius: var(--typer-radius);
}
[data-typer] .word .char.charBorder:has(+ .charBorder)::after {
  border-right: 1px solid transparent;
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
}
[data-typer] .word .char.charBorder + .charBorder::after {
  border-left: 1px solid transparent;
  border-right: 1px solid transparent;
  border-radius: 0;
}
[data-typer] .word .char.charBorder + .charBorder:last-child::after,
[data-typer] .word .char.charBorder + .charBorder:has(+ :not(.charBorder))::after {
  border-left: 1px solid transparent;
  border-right: 1px solid var(--typer-accent);
  border-radius: 0 var(--typer-radius) var(--typer-radius) 0;
}

@media (prefers-reduced-motion: reduce) {
  /* no reveal animation: show the text plainly. */
  [data-typer][data-typer-type="initial"] {
    opacity: 1;
  }
  [data-typer] .word .char.charInit {
    color: var(--typer-fg);
  }
}

```

### typer/standalone/typer.html

```html
<!-- Typer — a stacked block of lines that reveal character by character, each glyph
     rippling through randomized pill/highlight/border states before it settles.
     Load typer.css, put one [data-typer] element per line, then drive them with a
     TyperGroup (from typer.ts) for the top-to-bottom cascade.

     Colors are three custom properties (set them on any ancestor):
       --typer-fg  ink/pill · --typer-bg  page/knockout · --typer-accent  highlight -->

<link rel="stylesheet" href="typer.css" />

<div class="typer-block" style="display:flex;flex-direction:column;align-items:center;gap:4px;text-align:center;font-weight:600;font-size:clamp(1.4rem,4vw,2.4rem)">
  <span data-typer data-typer-type="initial">design engineered by me :)</span>
</div>

<!-- typer.ts is an ES module. Instantiate a TyperGroup over the lines and reveal
     them; the group staggers each line so the block cascades in top-to-bottom. -->
<script type="module">
  import { TyperGroup } from "./typer.js"; // built from typer.ts

  const lines = [...document.querySelectorAll("[data-typer]")];
  const group = new TyperGroup(
    lines,
    { fps: 20, cycles: 3 }, // tune speed and how many states each char rolls through
    0.15, // seconds of stagger between consecutive lines
  );

  // reveal once the block scrolls into view
  const io = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting) {
      group.in();
      io.disconnect();
    }
  }, { threshold: 0.4 });
  io.observe(document.querySelector(".typer-block"));
</script>

```


10. You are given the complete source for a self-contained web visual: "Realistic emboss".

What it is:
- Really liked the emboss effect people do, so I replicated it in web.
- Type your own word or drop an SVG, then play with the depth, the light, and the surface until it feels right. The presets are good places to start.

How to use this code:
- It is a React + TypeScript component tree (Next.js App Router) that renders to an HTML canvas; the entry point is the playground component.
- Drop the files into a project under the same relative paths, mount the playground component, and it runs as-is. No external assets beyond what's inline.
- To adapt it: change the resolved word/logo, the color controls, or the experiment parameters. Ask me to modify, explain, or port any part.

The full source follows, one file per block:

### emboss/params.ts

```ts
// The editable emboss parameters + presets. Each preset is a distinct bevel character
// (relief, bevel width, soften, light, highlight/shadow) paired with its own tint and
// plaster slice. The playground edits an EmbossParams; the card renders three fixed
// ones. One source of truth for both.

export type EmbossParams = {
  // bevel
  depth: number; // relief strength      (~0.4..1.9)
  size: number; // bevel width in px @ the 620px card height
  soften: number; // extra edge softening
  // light
  angle: number; // degrees
  altitude: number; // degrees (low = raking)
  highlight: number; // 0..1 highlight opacity
  shadow: number; // 0..1 shadow opacity
  // surface
  contrast: number; // plaster grain punch
  bright: number; // panel brightness
  tint: [number, number, number];
  texOffset: [number, number]; // which plaster region
  texScale: number; // plaster zoom
};

// Map a raw bevel spec (relief %, bevel size, soften, light, hi/sh) to EmbossParams,
// normalizing the ranges to this WebGL model. Size is capped so a wide bevel stays
// crisp rather than going soft/blobby.
function fromSpec(a: {
  depth: number;
  size: number;
  soften: number;
  angle: number;
  alt: number;
  hi: number;
  sh: number;
}): Omit<EmbossParams, "tint" | "texOffset" | "texScale" | "contrast" | "bright"> {
  return {
    depth: 0.55 + (Math.min(a.depth, 1000) / 1000) * 1.2,
    // cap at 6px: past that the bevel goes soft/blobby in this model, so the wide
    // specs (size 15-20) are clamped to a crisp edge.
    size: Math.min(6, Math.max(1, (a.size / 4.17) * 2.2)),
    soften: Math.min(2, a.soften / 4.17),
    angle: a.angle,
    altitude: a.alt,
    highlight: a.hi / 100,
    shadow: a.sh / 100,
  };
}

export type Preset = { id: string; name: string; params: EmbossParams };

// Shared grain; bright ~2 so tints read as vivid colored walls. Each preset overrides
// tint AND texture (region + zoom), so presets cycle bold color AND surface variety.
const SURFACE = { contrast: 0.32, bright: 2.0 };
type RGB = [number, number, number];
type XY = [number, number];

// Nine presets, each a genuinely distinct hue (spread across the wheel: red, orange,
// yellow, green, teal, blue, indigo, violet, magenta) + its own texture slice.
export const PRESETS: Preset[] = [
  { id: "sharp", name: "Sharp",
    params: { ...fromSpec({ depth: 188, size: 1, soften: 1, angle: 73, alt: 21, hi: 15, sh: 10 }), ...SURFACE, tint: [1.0, 0.42, 0.42] as RGB, texOffset: [0.0, 0.0] as XY, texScale: 1.35 } }, // red
  { id: "press", name: "Press",
    params: { ...fromSpec({ depth: 188, size: 5, soften: 3, angle: 73, alt: 21, hi: 20, sh: 20 }), ...SURFACE, tint: [1.0, 0.62, 0.24] as RGB, texOffset: [0.4, 0.15] as XY, texScale: 1.0 } }, // orange
  { id: "brutal", name: "Brutal",
    params: { ...fromSpec({ depth: 1000, size: 20, soften: 10, angle: 73, alt: 21, hi: 25, sh: 20 }), ...SURFACE, tint: [0.98, 0.85, 0.2] as RGB, texOffset: [0.6, 0.55] as XY, texScale: 1.9 } }, // yellow
  { id: "soft", name: "Soft",
    params: { ...fromSpec({ depth: 188, size: 15, soften: 7, angle: 73, alt: 21, hi: 12, sh: 8 }), ...SURFACE, tint: [0.42, 0.9, 0.42] as RGB, texOffset: [0.2, 0.7] as XY, texScale: 0.7 } }, // green
  { id: "wide", name: "Wide",
    params: { ...fromSpec({ depth: 469, size: 20, soften: 5, angle: 90, alt: 30, hi: 10, sh: 10 }), ...SURFACE, tint: [0.2, 0.85, 0.75] as RGB, texOffset: [0.75, 0.1] as XY, texScale: 1.5 } }, // teal
  { id: "deep", name: "Deep",
    params: { ...fromSpec({ depth: 1000, size: 12, soften: 12, angle: 90, alt: 30, hi: 10, sh: 6 }), ...SURFACE, tint: [0.34, 0.62, 1.0] as RGB, texOffset: [0.1, 0.4] as XY, texScale: 2.2 } }, // blue
  { id: "crisp", name: "Crisp",
    params: { ...fromSpec({ depth: 1000, size: 2, soften: 3, angle: 90, alt: 30, hi: 20, sh: 10 }), ...SURFACE, tint: [0.55, 0.45, 1.0] as RGB, texOffset: [0.55, 0.8] as XY, texScale: 1.15 } }, // indigo
  { id: "highkey", name: "High key",
    params: { ...fromSpec({ depth: 646, size: 4, soften: 4, angle: 90, alt: 30, hi: 25, sh: 25 }), ...SURFACE, tint: [0.82, 0.42, 1.0] as RGB, texOffset: [0.3, 0.25] as XY, texScale: 0.85 } }, // violet
  { id: "pillow", name: "Pillow",
    params: { ...fromSpec({ depth: 1000, size: 5, soften: 16, angle: 73, alt: 21, hi: 10, sh: 10 }), ...SURFACE, tint: [1.0, 0.42, 0.78] as RGB, texOffset: [0.85, 0.6] as XY, texScale: 0.6 } }, // magenta
];

export function defaultParams(): EmbossParams {
  return { ...PRESETS[1].params }; // Press
}

// A tasteful random surface (tint + texture region/zoom) for Remix. Tints are kept
// light + soft (mixed toward white) so the plaster always reads as a real wall.
function randomSurface(): Pick<
  EmbossParams,
  "tint" | "texOffset" | "texScale" | "contrast" | "bright"
> {
  // Bold BUT bright tint: a saturated hue mixed partway toward white so no channel is
  // ever near 0 (pure red/indigo would multiply the wall to near-black). This keeps
  // every color vivid AND light enough to read the press.
  const hue = Math.random() * 360;
  const s = 0.55 + Math.random() * 0.2; // saturated, not extreme
  const c = s;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const seg = [
    [c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x],
  ][Math.floor(hue / 60) % 6];
  // lift toward white so the darkest channel stays >= ~0.55 (vivid but not dark)
  const lift = 0.55;
  const tint: [number, number, number] = [
    seg[0] * (1 - lift) + lift,
    seg[1] * (1 - lift) + lift,
    seg[2] * (1 - lift) + lift,
  ];
  return {
    tint,
    texOffset: [Math.random(), Math.random()],
    texScale: 0.85 + Math.random() * 0.9, // avoid extreme zoom
    contrast: 0.25 + Math.random() * 0.2, // low grain
    bright: 1.85 + Math.random() * 0.2,
  };
}

// Remix: a random preset's bevel, plus a fresh random surface. Returns a full
// EmbossParams. Remix ALWAYS produces a crisp, tight press: the wide/soft presets
// (size 15-20, soften 7-16) read as a big blurry mush, so we force a small size and
// low soften every time. Only the light + surface really vary between remixes.
export function remixParams(): EmbossParams {
  const preset = PRESETS[Math.floor(Math.random() * PRESETS.length)];
  const surf = randomSurface();
  return {
    ...preset.params,
    ...surf,
    highlight: Math.max(preset.params.highlight, 0.22),
    shadow: Math.max(preset.params.shadow, 0.3),
    // a good crisp relief, not a faint one
    depth: Math.max(preset.params.depth, 1.0),
    // ALWAYS a tight, sharp edge: small size + low soften. This is the single biggest
    // thing that made remixes look bad (a soft 6px bevel reads as a blurry blob).
    size: 1 + Math.random() * 1.5,      // 1.0 - 2.5px
    soften: Math.random() * 0.6,        // 0 - 0.6px
  };
}

```

### emboss/content-mask.ts

```ts
// Rasterizes the pressed CONTENT (a word and/or an SVG shape, composed together) into
// a height field for the emboss shader. Blurs once on the CPU at the bevel radius.
// Packed: R = crisp coverage, G = blurred height. Async because an SVG is drawn via an
// <img> that must load.

export type Content = {
  word: string; // pressed word (empty in image mode)
  svg: string | null; // raw SVG markup (null in text mode)
};

export async function makeContentField(
  content: Content,
  blurPx: number,
  w: number,
  h: number,
  fontFamily: string,
): Promise<HTMLCanvasElement> {
  const W = Math.max(1, Math.round(w));
  const H = Math.max(1, Math.round(h));

  const crisp = document.createElement("canvas");
  crisp.width = W;
  crisp.height = H;
  const cx = crisp.getContext("2d")!;
  cx.clearRect(0, 0, W, H);

  // One mode at a time: a centered word, or a centered SVG.
  if (content.svg && content.svg.trim()) {
    await drawSvg(cx, content.svg, W, H, 0.5, 0.5, 0.52);
  } else if (content.word.trim()) {
    drawWord(cx, content, W, H, fontFamily, 0.5, 0.36);
  }

  const soft = document.createElement("canvas");
  soft.width = W;
  soft.height = H;
  const sx = soft.getContext("2d")!;
  sx.filter = `blur(${Math.max(0.5, blurPx).toFixed(2)}px)`;
  sx.drawImage(crisp, 0, 0);
  sx.filter = "none";

  const out = document.createElement("canvas");
  out.width = W;
  out.height = H;
  const ox = out.getContext("2d")!;
  const c = cx.getImageData(0, 0, W, H).data;
  const s = sx.getImageData(0, 0, W, H).data;
  const packed = ox.createImageData(W, H);
  const p = packed.data;
  for (let i = 0; i < p.length; i += 4) {
    p[i] = c[i + 3];
    p[i + 1] = s[i + 3];
    p[i + 2] = 0;
    p[i + 3] = 255;
  }
  ox.putImageData(packed, 0, 0);
  return out;
}

function drawWord(
  ctx: CanvasRenderingContext2D,
  content: Content,
  W: number,
  H: number,
  fontFamily: string,
  cyFrac: number,
  capFrac: number,
) {
  const text = content.word;
  if (!text) return;
  const cx = W / 2;
  const cy = H * cyFrac;
  const maxW = W * 0.82;

  let size = H * capFrac;
  ctx.font = `800 ${size}px ${fontFamily}`;
  const wWidth = ctx.measureText(text).width;
  if (wWidth > maxW) {
    size *= maxW / wWidth;
    ctx.font = `800 ${size}px ${fontFamily}`;
  }
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, cx, cy);
}

// Draw an SVG (as a white silhouette) centered at (cxFrac,cyFrac), sized to a
// fraction of the card. We force the fill to white via a wrapper so any SVG becomes
// a clean coverage mask regardless of its own colors.
async function drawSvg(
  ctx: CanvasRenderingContext2D,
  svg: string,
  W: number,
  H: number,
  cxFrac: number,
  cyFrac: number,
  sizeFrac: number,
): Promise<void> {
  // Force every fill/stroke white so ANY svg (incl. colored uploads) becomes a clean
  // white-on-transparent coverage mask (the shader reads alpha, so color is moot).
  const forced = svg.replace(
    /<svg([^>]*)>/i,
    `<svg$1><style>*{fill:#fff!important;stroke:#fff!important}</style>`,
  );
  const blob = new Blob([forced], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  try {
    const img = await loadImage(url);
    const target = H * sizeFrac;
    const ar = img.width / Math.max(1, img.height);
    let dh = target;
    let dw = target * ar;
    const maxW = W * 0.82;
    if (dw > maxW) {
      dw = maxW;
      dh = dw / ar;
    }
    ctx.drawImage(img, W * cxFrac - dw / 2, H * cyFrac - dh / 2, dw, dh);
  } catch {
    // invalid SVG -> draw nothing (playground stays usable)
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = src;
  });
}

// Built-in marks users can drop in. Bold, solid, medium-complexity shapes read best
// as a press (fine detail gets lost in the bevel). All draw as a white silhouette.
export const BUILTIN_SVGS: { id: string; name: string; svg: string }[] = [
  {
    id: "sparkle",
    name: "Sparkle",
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><path d="M50 4 C54 34 66 46 96 50 C66 54 54 66 50 96 C46 66 34 54 4 50 C34 46 46 34 50 4 Z"/></svg>`,
  },
  {
    id: "star",
    name: "Star",
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><path d="M50 4 L61 38 L97 38 L68 60 L79 94 L50 72 L21 94 L32 60 L3 38 L39 38 Z"/></svg>`,
  },
  {
    id: "heart",
    name: "Heart",
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><path d="M50 88 C10 60 8 30 26 20 C40 12 50 24 50 32 C50 24 60 12 74 20 C92 30 90 60 50 88 Z"/></svg>`,
  },
  {
    id: "bolt",
    name: "Bolt",
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><path d="M58 4 L26 56 L46 56 L40 96 L74 40 L52 40 Z"/></svg>`,
  },
  {
    id: "flower",
    name: "Flower",
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><g><ellipse cx="50" cy="24" rx="15" ry="22"/><ellipse cx="50" cy="24" rx="15" ry="22" transform="rotate(72 50 50)"/><ellipse cx="50" cy="24" rx="15" ry="22" transform="rotate(144 50 50)"/><ellipse cx="50" cy="24" rx="15" ry="22" transform="rotate(216 50 50)"/><ellipse cx="50" cy="24" rx="15" ry="22" transform="rotate(288 50 50)"/><circle cx="50" cy="50" r="11"/></g></svg>`,
  },
  {
    id: "sun",
    name: "Sun",
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><g><circle cx="50" cy="50" r="20"/><g stroke-width="0"><rect x="47" y="4" width="6" height="16" rx="3"/><rect x="47" y="80" width="6" height="16" rx="3"/><rect x="4" y="47" width="16" height="6" rx="3"/><rect x="80" y="47" width="16" height="6" rx="3"/><rect x="47" y="4" width="6" height="16" rx="3" transform="rotate(45 50 50)"/><rect x="47" y="80" width="6" height="16" rx="3" transform="rotate(45 50 50)"/><rect x="4" y="47" width="16" height="6" rx="3" transform="rotate(45 50 50)"/><rect x="80" y="47" width="16" height="6" rx="3" transform="rotate(45 50 50)"/></g></g></svg>`,
  },
  {
    id: "flame",
    name: "Flame",
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><path d="M52 4 C52 26 74 34 70 58 C68 74 60 78 60 78 C64 66 56 60 54 52 C50 62 42 62 44 76 C36 70 30 60 32 46 C34 30 52 30 52 4 Z"/></svg>`,
  },
  {
    id: "blob",
    name: "Blob",
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><path d="M60 8 C82 12 94 34 88 56 C82 78 60 94 40 88 C18 82 6 58 14 38 C22 18 38 4 60 8 Z"/></svg>`,
  },
  {
    id: "moon",
    name: "Moon",
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><path d="M64 8 A44 44 0 1 0 64 92 A34 34 0 0 1 64 8 Z"/></svg>`,
  },
  {
    id: "arrow",
    name: "Arrow",
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><path d="M44 12 L44 62 L26 62 L50 92 L74 62 L56 62 L56 12 Z"/></svg>`,
  },
  {
    id: "target",
    name: "Target",
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect x="47" y="6" width="6" height="88" rx="3"/><rect x="6" y="47" width="88" height="6" rx="3"/><circle cx="50" cy="50" r="22" fill="none" stroke-width="6"/></svg>`,
  },
];

```

### emboss/pg-shader.ts

```ts
// Single-panel parametric emboss shader for the playground. Same model as the card
// (real plaster surface + Bevel & Emboss from the height-field gradient + grunge
// overlay), but every lever is a live uniform so the controls can drive it. Fills
// the whole canvas (one panel), light follows the cursor.

export const PG_VERT = `
attribute vec2 aPosition;
attribute vec2 aUV;
varying vec2 vUV;
void main(){ vUV = aUV; gl_Position = vec4(aPosition, 0.0, 1.0); }
`;

export const PG_FRAG = `
precision highp float;
varying vec2 vUV;

uniform sampler2D uField;   // R crisp, G blurred height
uniform sampler2D uPlaster;
uniform sampler2D uGrunge;
uniform float uGrungeAmt;
uniform vec2  uTexel;
uniform vec2  uLight;       // from angle + altitude
uniform float uLightZ;
uniform float uDepth;
uniform float uHi;
uniform float uSh;
uniform float uContrast;
uniform float uBright;
uniform vec3  uTint;
uniform vec2  uTexOff;
uniform float uTexScale;
uniform float uReveal;
uniform float uAspect;

void main(){
  vec2 uv = vUV;

  float gs = 1.0;
  float hL = texture2D(uField, uv - vec2(gs,0.0)*uTexel).g;
  float hR = texture2D(uField, uv + vec2(gs,0.0)*uTexel).g;
  float hD = texture2D(uField, uv - vec2(0.0,gs)*uTexel).g;
  float hU = texture2D(uField, uv + vec2(0.0,gs)*uTexel).g;
  float crisp = texture2D(uField, uv).r;
  vec2 slope = vec2(hR-hL, hU-hD) * uDepth * 16.0 * uReveal;
  vec3 N = normalize(vec3(-slope.x, -slope.y, 1.0));
  float bevel = clamp(length(slope), 0.0, 1.0);

  vec3 L = normalize(vec3(uLight, uLightZ));
  float diff = dot(N, L);
  float hi = pow(max(diff,0.0), 1.2) * bevel;
  float sh = pow(max(-diff,0.0), 1.0) * bevel;

  // clamped sub-window of the plaster (zoom + pan, no fract wrap) so there is no
  // seam and the texture never tiles across the panel.
  float zoom = max(1.0, uTexScale);
  vec2 span = vec2(1.0 / zoom);
  vec2 origin = clamp(uTexOff, 0.0, 1.0) * (1.0 - span);
  vec2 puv = origin + uv * span;
  float p = texture2D(uPlaster, puv).r;
  p = clamp((p-0.5)*uContrast + 0.5, 0.0, 1.0);
  vec3 base = uTint * p * uBright;

  float face = smoothstep(0.4, 0.62, crisp);
  base *= mix(1.0, 0.86, face * uReveal);

  vec3 c = base;
  c += hi * uHi * uReveal;
  c -= sh * uSh * uReveal;

  float gr = texture2D(uGrunge, uv).r;
  vec3 ov = mix(2.0*c*gr, 1.0-2.0*(1.0-c)*(1.0-gr), step(0.5, c));
  c = mix(c, ov, uGrungeAmt);

  gl_FragColor = vec4(clamp(c,0.0,1.0), 1.0);
}
`;

```

### emboss/pg-engine.ts

```ts
// Parametric playground engine: one emboss panel filling the canvas, every lever a
// live uniform. The playground calls setParams()/setContent() and it re-renders.
// The height field is rebuilt (async) only when the CONTENT or bevel SIZE changes;
// all other params are cheap per-frame uniforms.

import { PG_VERT, PG_FRAG } from "./pg-shader";
import { makeContentField, type Content } from "./content-mask";
import { mediaUrl } from "../../lib/video-sources";
import type { EmbossParams } from "./params";

const PLASTER_URL = mediaUrl("/vault/emboss-plaster.webp");
const GRUNGE_URL = mediaUrl("/vault/emboss-grunge.webp");
const GRUNGE_AMT = 0.38;

export class EmbossPlayground {
  private host: HTMLElement;
  private canvas: HTMLCanvasElement;
  private gl: WebGLRenderingContext | null = null;
  private prog: WebGLProgram | null = null;
  private loc: Record<string, WebGLUniformLocation | null> = {};
  private field: WebGLTexture | null = null;
  private plaster: WebGLTexture | null = null;
  private grunge: WebGLTexture | null = null;
  private fieldW = 1;
  private fieldH = 1;

  private w = 0;
  private h = 0;
  private dpr = 1;
  private fontFamily = "var(--font-neue-corp), sans-serif";

  private params: EmbossParams;
  private content: Content;
  private lastSize = -1;
  private fieldSeq = 0; // guards against out-of-order async field builds

  private raf = 0;
  private running = false;
  private fieldReady = false; // the height field has been built at least once
  private painted = false; // canvas revealed after its first real frame
  ok = false;

  constructor(host: HTMLElement, params: EmbossParams, content: Content) {
    this.host = host;
    this.params = params;
    this.content = content;
    this.canvas = document.createElement("canvas");
    Object.assign(this.canvas.style, {
      position: "absolute", inset: "0", width: "100%", height: "100%", display: "block",
      // Hidden until the first real frame, so the white host shows instead of a black
      // undrawn canvas (matches the emboss card; avoids a black flash on mount).
      opacity: "0",
    });
    host.appendChild(this.canvas);

    const gl = this.canvas.getContext("webgl", { alpha: false, antialias: false, premultipliedAlpha: false });
    if (!gl) return;
    this.gl = gl;
    gl.clearColor(1, 1, 1, 1); // white, not the default black
    try { this.prog = this.build(PG_VERT, PG_FRAG); } catch { this.gl = null; return; }

    for (const u of [
      "uField", "uPlaster", "uGrunge", "uGrungeAmt", "uTexel", "uLight", "uLightZ",
      "uDepth", "uHi", "uSh", "uContrast", "uBright", "uTint", "uTexOff", "uTexScale",
      "uReveal", "uAspect",
    ]) this.loc[u] = gl.getUniformLocation(this.prog!, u);

    const aPos = gl.getAttribLocation(this.prog!, "aPosition");
    const aUV = gl.getAttribLocation(this.prog!, "aUV");
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1,-1,0,1, 1,-1,1,1, -1,1,0,0, 1,1,1,0,
    ]), gl.STATIC_DRAW);
    gl.useProgram(this.prog);
    gl.enableVertexAttribArray(aPos); gl.vertexAttribPointer(aPos,2,gl.FLOAT,false,16,0);
    gl.enableVertexAttribArray(aUV); gl.vertexAttribPointer(aUV,2,gl.FLOAT,false,16,8);

    this.field = gl.createTexture();
    this.plaster = this.placeholder([128,128,128,255]);
    this.grunge = this.placeholder([128,128,128,255]);
    this.loadTex(PLASTER_URL, () => this.plaster, false); // CLAMP (sub-window, no wrap)
    this.loadTex(GRUNGE_URL, () => this.grunge, false);

    this.resize();
    void this.rebuildField();
    this.ok = true;
  }

  private build(vs: string, fs: string): WebGLProgram {
    const gl = this.gl!;
    const c = (t: number, s: string) => {
      const sh = gl.createShader(t)!; gl.shaderSource(sh, s); gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh) || "compile");
      return sh;
    };
    const p = gl.createProgram()!;
    gl.attachShader(p, c(gl.VERTEX_SHADER, vs)); gl.attachShader(p, c(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) || "link");
    return p;
  }

  private placeholder(rgba: number[]): WebGLTexture | null {
    const gl = this.gl; if (!gl) return null;
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(rgba));
    return t;
  }

  private loadTex(url: string, target: () => WebGLTexture | null, repeat: boolean) {
    const img = new Image(); img.crossOrigin = "anonymous";
    img.onload = () => {
      const g = this.gl, tex = target(); if (!g || !tex) return;
      g.bindTexture(g.TEXTURE_2D, tex);
      g.pixelStorei(g.UNPACK_FLIP_Y_WEBGL, true);
      g.texImage2D(g.TEXTURE_2D,0,g.RGBA,g.RGBA,g.UNSIGNED_BYTE,img);
      const w = repeat ? g.REPEAT : g.CLAMP_TO_EDGE;
      g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_S,w);
      g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_T,w);
      g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MIN_FILTER,g.LINEAR);
      g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MAG_FILTER,g.LINEAR);
      g.pixelStorei(g.UNPACK_FLIP_Y_WEBGL, false);
      this.renderOnce();
    };
    img.src = url;
  }

  setFont(f: string) { this.fontFamily = f; void this.rebuildField(); }

  setParams(p: EmbossParams) {
    const sizeChanged = p.size !== this.params.size || p.soften !== this.params.soften;
    this.params = p;
    if (sizeChanged) void this.rebuildField();
    else this.renderOnce();
  }

  setContent(c: Content) { this.content = c; void this.rebuildField(); }

  private async rebuildField() {
    const gl = this.gl; if (!gl) return;
    // Cap the mask width (was DPR x2 supersample -> ~5000px on retina, a
    // multi-hundred-ms CPU build). ~1500px is plenty: crispness is from the pre-blur.
    const MAX_W = 1500;
    const mw = Math.max(2, Math.min(MAX_W, Math.round(this.w * this.dpr)));
    const mh = Math.max(2, Math.round(mw * (this.h / Math.max(1, this.w))));
    // bevel width (px @ card) -> field-space blur, plus the soften amount
    const blur = Math.max(1, (this.params.size + this.params.soften) * this.dpr * 1.2);
    this.lastSize = this.params.size;
    const seq = ++this.fieldSeq;
    const art = await makeContentField(this.content, blur, mw, mh, this.fontFamily);
    if (seq !== this.fieldSeq || !this.gl) return; // superseded
    gl.bindTexture(gl.TEXTURE_2D, this.field);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, art);
    this.fieldW = art.width; this.fieldH = art.height;
    this.fieldReady = true;
    this.renderOnce();
  }

  resize() {
    const r = this.host.getBoundingClientRect();
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.w = r.width; this.h = r.height;
    const cw = Math.max(1, Math.round(this.w * this.dpr));
    const ch = Math.max(1, Math.round(this.h * this.dpr));
    if (this.canvas.width !== cw || this.canvas.height !== ch) {
      this.canvas.width = cw; this.canvas.height = ch;
      this.gl?.viewport(0, 0, cw, ch);
      void this.rebuildField();
    }
  }

  private renderOnce() {
    if (this.raf) return;
    this.raf = requestAnimationFrame(() => { this.raf = 0; this.render(); });
  }

  private render() {
    const gl = this.gl, p = this.params; if (!gl || !this.prog) return;
    // Don't draw until the field is built (else a fieldless frame flashes / a black
    // canvas shows before the press). The white host shows through until then.
    if (!this.fieldReady) return;
    // light from the params' angle/altitude (no cursor interaction)
    const a = (p.angle * Math.PI) / 180;
    const lx = Math.cos(a);
    const ly = Math.sin(a);
    const lz = Math.max(0.25, Math.sin((p.altitude * Math.PI) / 180) + 0.3);
    gl.useProgram(this.prog);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.field); gl.uniform1i(this.loc.uField, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.plaster); gl.uniform1i(this.loc.uPlaster, 1);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, this.grunge); gl.uniform1i(this.loc.uGrunge, 2);
    gl.uniform1f(this.loc.uGrungeAmt, GRUNGE_AMT);
    gl.uniform2f(this.loc.uTexel, 1 / this.fieldW, 1 / this.fieldH);
    gl.uniform2f(this.loc.uLight, lx, ly);
    gl.uniform1f(this.loc.uLightZ, lz);
    gl.uniform1f(this.loc.uDepth, p.depth);
    gl.uniform1f(this.loc.uHi, p.highlight);
    gl.uniform1f(this.loc.uSh, p.shadow);
    gl.uniform1f(this.loc.uContrast, p.contrast);
    gl.uniform1f(this.loc.uBright, p.bright);
    gl.uniform3f(this.loc.uTint, p.tint[0], p.tint[1], p.tint[2]);
    gl.uniform2f(this.loc.uTexOff, p.texOffset[0], p.texOffset[1]);
    gl.uniform1f(this.loc.uTexScale, p.texScale);
    gl.uniform1f(this.loc.uReveal, 1);
    gl.uniform1f(this.loc.uAspect, this.w / Math.max(1, this.h));
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    if (!this.painted) { this.painted = true; this.canvas.style.opacity = "1"; }
  }

  destroy() {
    if (this.raf) cancelAnimationFrame(this.raf);
    const gl = this.gl;
    if (gl) {
      [this.field, this.plaster, this.grunge].forEach((t) => t && gl.deleteTexture(t));
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    }
    this.canvas.remove();
  }
}

```

### emboss/playground.tsx

```tsx
"use client";

// Emboss playground — the detail-page editor. One live panel you press a word AND/OR
// an SVG into, with full control over the bevel (depth/size/soften), light
// (angle/altitude/highlight+shadow), and surface (texture/contrast/tint). Load one of
// the presets as a starting point, then tweak. Built from the shared Vault control kit
// so it matches the site.

import { useEffect, useMemo, useRef, useState } from "react";
import { EmbossPlayground } from "./pg-engine";
import { defaultParams, remixParams, type EmbossParams } from "./params";
import { BUILTIN_SVGS, type Content } from "./content-mask";
import {
  PG_PREVIEW, PG_PANEL, Slider, ColorControl, GhostButton, SegmentedControl, Select,
} from "../swirl/controls";
import { SectionLabel } from "../section-label";
import { hapticTap } from "../../lib/haptics";

const LABEL = "text-[12px] text-[var(--text-tertiary)]";

// rgb 0..1 <-> #hex for the ColorControl (which speaks hex)
const toHex = (c: [number, number, number]) =>
  "#" + c.map((v) => Math.round(v * 255).toString(16).padStart(2, "0")).join("");
const fromHex = (h: string): [number, number, number] => {
  const n = h.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2) || "0", 16) / 255) as [number, number, number];
};

export function EmbossPlayground_() {
  const hostRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<EmbossPlayground | null>(null);

  const [params, setParams] = useState<EmbossParams>(() => defaultParams());
  const [mode, setMode] = useState<"text" | "image">("text");
  const [word, setWord] = useState("emboss");
  const [shapeId, setShapeId] = useState(BUILTIN_SVGS[0].id);
  const [svg, setSvg] = useState<string | null>(BUILTIN_SVGS[0].svg);
  const fileRef = useRef<HTMLInputElement>(null);

  // In text mode only the word presses; in image mode only the SVG presses.
  const content: Content = useMemo(
    () => (mode === "text" ? { word, svg: null } : { word: "", svg }),
    [mode, word, svg],
  );

  // Mount the engine only when the playground scrolls into view. On the detail page
  // the emboss hero card is already spinning up its own WebGL build during the
  // view-transition morph; deferring the (also heavy) playground build until it is
  // actually near the viewport keeps the morph smooth and avoids two CPU height-field
  // builds racing at once.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let raf = 0;
    let started = false;
    const build = () => {
      if (started) return;
      started = true;
      raf = requestAnimationFrame(() => {
        const eng = new EmbossPlayground(host, params, content);
        if (!eng.ok) return;
        engineRef.current = eng;
        // warm Neue Corp then refresh
        if (document.fonts?.load) {
          const probe = document.createElement("span");
          probe.style.cssText = "position:absolute;visibility:hidden;font-family:var(--font-neue-corp)";
          probe.textContent = "Ag";
          document.body.appendChild(probe);
          const fam = getComputedStyle(probe).fontFamily.split(",")[0].replace(/["']/g, "").trim();
          document.body.removeChild(probe);
          document.fonts.load(`800 1em "${fam}"`).then(() => eng.setFont(`"${fam}", sans-serif`), () => {});
        }
      });
    };
    const io = new IntersectionObserver(
      (es) => {
        if (es[0]?.isIntersecting) {
          io.disconnect();
          build();
        }
      },
      { rootMargin: "200px" }, // start just before it scrolls in
    );
    io.observe(host);
    const onResize = () => engineRef.current?.resize();
    window.addEventListener("resize", onResize);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      engineRef.current?.destroy();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // push params/content to the engine
  useEffect(() => { engineRef.current?.setParams(params); }, [params]);
  useEffect(() => { engineRef.current?.setContent(content); }, [content]);

  const patch = (p: Partial<EmbossParams>) => setParams((prev) => ({ ...prev, ...p }));

  const remix = () => {
    hapticTap();
    setParams(remixParams());
  };

  // Shape dropdown: the built-ins plus an "Upload SVG…" entry that opens the picker.
  const shapeOptions = [
    ...BUILTIN_SVGS.map((s) => ({ id: s.id, label: s.name })),
    { id: "upload", label: "Upload SVG…" },
  ];
  const pickShape = (id: string) => {
    if (id === "upload") {
      fileRef.current?.click();
      return;
    }
    const s = BUILTIN_SVGS.find((b) => b.id === id);
    if (s) { setShapeId(id); setSvg(s.svg); }
  };
  const onUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      hapticTap();
      setShapeId("upload");
      setSvg(String(reader.result || ""));
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <SectionLabel
        action={<GhostButton onClick={remix}>Remix</GhostButton>}
      >
        Playground
      </SectionLabel>

      {/* live preview */}
      <div className={`${PG_PREVIEW} aspect-[1344/620] w-full`}>
        <div ref={hostRef} data-canvas-card className="absolute inset-0 h-full w-full" />
      </div>

      {/* controls */}
      <div className={PG_PANEL}>
        {/* content: stacks on mobile (label above, controls full-width); on sm+ it's
            one row with the toggle + input/dropdown pushed to the right. */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <span className={`${LABEL} shrink-0`}>Content</span>
          <div className="flex items-center gap-2 sm:ml-auto">
            <div className="w-[130px] shrink-0 sm:w-[140px]">
              <SegmentedControl
                activeId={mode}
                onPick={(id) => setMode(id as "text" | "image")}
                options={[
                  { id: "text", label: "Text" },
                  { id: "image", label: "Image" },
                ]}
              />
            </div>
            {mode === "text" ? (
              <input
                value={word}
                onChange={(e) => setWord(e.target.value)}
                placeholder="type a word"
                maxLength={16}
                className="h-8 min-w-0 flex-1 rounded-lg border border-[var(--border-line)] bg-[var(--bg-page)] px-3 text-[12px] text-[var(--text-primary)] outline-none transition-colors duration-150 ease-[var(--ease-out)] placeholder:text-[var(--text-tertiary)] hover:border-[var(--border-ring)] focus:border-[var(--border-ring)] sm:w-[150px] sm:flex-none"
              />
            ) : (
              <div className="min-w-0 flex-1 sm:w-[150px] sm:flex-none">
                <Select
                  activeId={shapeId}
                  onPick={pickShape}
                  options={shapeOptions}
                  ariaLabel="Shape"
                />
                <input
                  ref={fileRef}
                  type="file"
                  accept=".svg,image/svg+xml"
                  onChange={onUpload}
                  className="hidden"
                />
              </div>
            )}
          </div>
        </div>

        {/* two columns: Bevel+Light | Surface */}
        <div className="grid grid-cols-1 items-start gap-x-6 gap-y-5 sm:grid-cols-2">
          <div className="flex flex-col gap-3 self-start">
            <span className={LABEL}>Bevel</span>
            <Slider label="Depth" value={params.depth} min={0.2} max={2} step={0.01}
              format={(v) => v.toFixed(2)} onChange={(v) => patch({ depth: v })} />
            <Slider label="Size" value={params.size} min={1} max={24} step={0.5}
              format={(v) => `${v.toFixed(1)}px`} onChange={(v) => patch({ size: v })} />
            <Slider label="Soften" value={params.soften} min={0} max={12} step={0.5}
              format={(v) => `${v.toFixed(1)}px`} onChange={(v) => patch({ soften: v })} />
          </div>

          <div className="flex flex-col gap-3">
            <span className={LABEL}>Light</span>
            <Slider label="Angle" value={params.angle} min={0} max={360} step={1}
              format={(v) => `${v | 0}°`} onChange={(v) => patch({ angle: v })} />
            <Slider label="Altitude" value={params.altitude} min={0} max={90} step={1}
              format={(v) => `${v | 0}°`} onChange={(v) => patch({ altitude: v })} />
            <Slider label="Highlight" value={params.highlight} min={0} max={0.6} step={0.01}
              format={(v) => `${(v * 100) | 0}%`} onChange={(v) => patch({ highlight: v })} />
            <Slider label="Shadow" value={params.shadow} min={0} max={0.6} step={0.01}
              format={(v) => `${(v * 100) | 0}%`} onChange={(v) => patch({ shadow: v })} />
          </div>

          <div className="flex flex-col gap-3 sm:col-span-2">
            <span className={LABEL}>Surface</span>
            <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
              <Slider label="Brightness" value={params.bright} min={0.8} max={2.4} step={0.01}
                format={(v) => v.toFixed(2)} onChange={(v) => patch({ bright: v })} />
              <Slider label="Grain" value={params.contrast} min={0} max={1.4} step={0.01}
                format={(v) => v.toFixed(2)} onChange={(v) => patch({ contrast: v })} />
              <Slider label="Texture zoom" value={params.texScale} min={0.4} max={2.4} step={0.01}
                format={(v) => `${v.toFixed(2)}×`} onChange={(v) => patch({ texScale: v })} />
              <ColorControl
                label="Tint"
                value={toHex(params.tint)}
                onChange={(hex) => patch({ tint: fromHex(hex) })}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

```


11. You are given the complete source for a self-contained web visual: "Chromatic glow".

What it is:
- I wanted light that blooms out soft and pulls the colors apart at the edges.
- The word gets blurred at a few sizes and added back together, so it glows for real. Then it splits into a warm copy and a cool copy that drift a little the opposite way, and that gap is the rainbow edge. Move over it and the split leans toward your cursor. Type your own word and pick the two colors below.

How to use this code:
- It is a React + TypeScript component tree (Next.js App Router) that renders to an HTML canvas; the entry point is the playground component.
- Drop the files into a project under the same relative paths, mount the playground component, and it runs as-is. No external assets beyond what's inline.
- To adapt it: change the resolved word/logo, the color controls, or the experiment parameters. Ask me to modify, explain, or port any part.

The full source follows, one file per block:

### chroma/params.ts

```ts
// Chromatic Glow presets + Remix. Each preset is its own colour world (a distinct
// background paired with a matching warm/cool/fringe palette). Remix keeps the RGB-split
// mechanic but rolls a fresh warm/cool pair, a matching background, and a split amount.

import { CHROMA_DEFAULTS, type ChromaParams } from "./engine";

export type ChromaPreset = { id: string; name: string; params: Partial<ChromaParams> };

// Each preset is its OWN world: a distinct background hue paired with a matching but
// unique glow palette (warm / cool / fringe) and its own split + bloom feel. No two share
// a background family. The first stays the default (the card renders it).
export const CHROMA_PRESETS: ChromaPreset[] = [
  {
    id: "peachsteel",
    name: "Peach / Steel",
    // soft PEACH vs. cool STEEL-BLUE, with a rose fringe, on a deep dusk-blue wall (a lifted
    // indigo, clearly a colour and not black). Editorial, unexpected — the default.
    params: { warm: [1.0, 0.66, 0.5], cool: [0.42, 0.6, 0.95], red: [1.0, 0.42, 0.6], split: 9.0, bloom: 1.62, core: 1.06, noise: 0.15, spectral: 0.6, bg: [0.11, 0.13, 0.2] },
  },
  {
    id: "chartviolet",
    name: "Chartreuse / Violet",
    // acid CHARTREUSE vs. deep VIOLET with an electric-blue fringe, on a rich PLUM wall
    // (clearly purple, not black) — a high-tension art-book combo, wide rainbow rim.
    params: { warm: [0.78, 0.95, 0.2], cool: [0.55, 0.3, 1.0], red: [0.3, 0.7, 1.0], split: 10.5, bloom: 1.52, core: 1.04, noise: 0.17, spectral: 0.85, bg: [0.15, 0.08, 0.19] },
  },
  {
    id: "pinkamber",
    name: "Hot Pink / Amber",
    // HOT PINK vs. warm AMBER (two warms held in tension by the split), gold fringe, on a
    // deep AUBERGINE wall (a lifted wine, reads as colour) — a neon-sign look that works.
    params: { warm: [1.0, 0.22, 0.62], cool: [1.0, 0.72, 0.24], red: [1.0, 0.5, 0.85], split: 8.0, bloom: 1.55, core: 1.05, noise: 0.16, spectral: 0.5, bg: [0.19, 0.08, 0.15] },
  },
  {
    id: "rustmint",
    name: "Rust / Mint",
    // burnt RUST vs. cool MINT with a teal fringe, on a deep PINE-GREEN wall (clearly green,
    // not black) — a muted, grown-up pairing (terracotta against seafoam), tight fringe.
    params: { warm: [0.92, 0.42, 0.22], cool: [0.5, 0.95, 0.78], red: [0.3, 0.85, 0.7], split: 7.5, bloom: 1.5, core: 1.02, noise: 0.13, spectral: 0.45, bg: [0.07, 0.16, 0.13] },
  },
  {
    id: "sandcobalt",
    name: "Sand / Cobalt",
    // LIGHT mode: warm SAND wall, dark word, a deep COBALT + rose split haze — a paper-and-
    // ink editorial feel with a cold shadow.
    params: { warm: [1.0, 0.55, 0.42], cool: [0.24, 0.36, 0.95], red: [0.95, 0.34, 0.5], split: 9.0, bloom: 1.5, core: 1.0, noise: 0.09, spectral: 0.6, bg: [0.95, 0.9, 0.8], invert: true },
  },
  {
    id: "blushsky",
    name: "Blush / Sky",
    // LIGHT mode: pale BLUSH wall, dark word, a SKY-BLUE + coral split haze — soft, airy,
    // a little vaporwave.
    params: { warm: [1.0, 0.44, 0.5], cool: [0.34, 0.72, 1.0], red: [0.6, 0.5, 1.0], split: 9.5, bloom: 1.52, core: 1.0, noise: 0.09, spectral: 0.7, bg: [0.97, 0.9, 0.92], invert: true },
  },
];

export function defaultChromaParams(): ChromaParams {
  return { ...CHROMA_DEFAULTS, ...CHROMA_PRESETS[0].params };
}

// The hero card cycles these funny words, each paired with its own colour world, joined
// by the chromatic glitch-slide. Words + palettes are index-matched (they loop together).
export const HERO_CYCLE: { word: string; params: Partial<ChromaParams> }[] = [
  { word: "boom", params: CHROMA_PRESETS[0].params },   // peach / steel
  { word: "poof", params: CHROMA_PRESETS[3].params },   // rust / mint
  { word: "zap",  params: CHROMA_PRESETS[1].params },   // chartreuse / violet
  { word: "pow",  params: CHROMA_PRESETS[2].params },   // hot pink / amber
  { word: "yeet", params: CHROMA_PRESETS[5].params },   // blush / sky (light)
  { word: "oof",  params: CHROMA_PRESETS[4].params },   // sand / cobalt (light)
];

// Silly sound-effect words the playground Remix rolls from.
export const SFX_WORDS = [
  "boom", "poop", "pow", "zap", "yeet", "oof", "bruh", "meep",
  "honk", "blip", "splat", "womp", "boing", "poof", "zoom", "womp",
];

// rgb 0..1 <-> #hex for the ColorControl (which speaks hex)
export const toHex = (c: [number, number, number]) =>
  "#" + c.map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, "0")).join("");
export const fromHex = (h: string): [number, number, number] => {
  const n = h.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2) || "0", 16) / 255) as [number, number, number];
};

// A vivid, glowy random colour: a saturated hue lifted a little so it never reads dim
// on black. Returns rgb 0..1.
function vividHue(hue: number, lift = 0.15): [number, number, number] {
  const c = 1;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const seg = [
    [c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x],
  ][Math.floor(hue / 60) % 6];
  return [seg[0] * (1 - lift) + lift, seg[1] * (1 - lift) + lift, seg[2] * (1 - lift) + lift];
}

// A background tint that SUITS a glow palette: take the warm+cool average hue, keep a
// touch of that colour, but crush it very dark + low-saturation so it always reads as a
// deep neutral wall the glow can sit on (never a bright or clashing panel).
function suitedBg(warm: [number, number, number], cool: [number, number, number]): [number, number, number] {
  // Average the two glow colours, boost that hue's saturation, then set it to a low
  // (dark) value. The result is a clearly-tinted deep wall (navy / wine / plum / moss),
  // not a flat near-black — but still dark enough for the glow to read.
  const avg = [(warm[0] + cool[0]) / 2, (warm[1] + cool[1]) / 2, (warm[2] + cool[2]) / 2];
  const max = Math.max(avg[0], avg[1], avg[2], 0.001);
  const floor = 0.05; // darkest channel never goes fully black
  const peak = 0.17;  // brightest channel of the wall (keeps it dark)
  // normalize to push saturation up, then scale into [floor, peak]
  return [0, 1, 2].map((i) => floor + (avg[i] / max) * (peak - floor)) as unknown as [number, number, number];
}

// Remix: a fresh complementary warm/cool pair (opposite sides of the wheel), a random
// third fringe, a matching dark background, and varied split/bloom.
export function remixChromaParams(): Partial<ChromaParams> {
  const h = Math.random() * 360;
  const warm = vividHue(h);
  const cool = vividHue((h + 150 + Math.random() * 60) % 360);
  const red = vividHue((h + 40 + Math.random() * 40) % 360, 0.1);
  // ~1 in 3 remixes is a LIGHT-mode variant: a light wall (a pale tint of the palette
  // hue) with the word pressed in dark. Otherwise the usual dark wall + glowing word.
  const invert = Math.random() < 0.34;
  const bg = invert ? suitedLightBg(warm, cool) : suitedBg(warm, cool);
  return {
    word: SFX_WORDS[Math.floor(Math.random() * SFX_WORDS.length)], // a fresh silly word
    warm,
    cool,
    red,
    bg,
    invert,
    split: 4 + Math.random() * 8,   // 4 - 12 px
    bloom: 1.0 + Math.random() * 0.4,
    noise: 0.06 + Math.random() * 0.14,
    spectral: 0.3 + Math.random() * 0.6,  // varied rainbow-rim strength per remix
  };
}

// A LIGHT wall that suits the palette: a very pale tint of the average glow hue (mostly
// white, a hint of colour) so the dark pressed word + coloured fringe read cleanly.
function suitedLightBg(warm: [number, number, number], cool: [number, number, number]): [number, number, number] {
  const avg = [(warm[0] + cool[0]) / 2, (warm[1] + cool[1]) / 2, (warm[2] + cool[2]) / 2];
  const max = Math.max(avg[0], avg[1], avg[2], 0.001);
  // mostly white (~0.9), with ~8% of the normalized hue mixed in
  return [0, 1, 2].map((i) => 0.88 + (avg[i] / max) * 0.08) as unknown as [number, number, number];
}

```

### chroma/text-mask.ts

```ts
// Rasterizes ONE word into a white-on-transparent coverage mask for the chromatic
// glow. The shader treats the white silhouette as the glow SOURCE — it's the bright
// shape the bloom spreads out from. No blur here — the bloom is built on the GPU.

export async function makeWordMask(
  word: string,
  w: number,
  h: number,
  fontFamily: string,
): Promise<HTMLCanvasElement> {
  const W = Math.max(1, Math.round(w));
  const H = Math.max(1, Math.round(h));

  const out = document.createElement("canvas");
  out.width = W;
  out.height = H;
  const ctx = out.getContext("2d")!;
  ctx.clearRect(0, 0, W, H);

  const text = (word || "").trim();
  if (!text) return out;

  const cx = W / 2;
  const cy = H * 0.5;
  const maxW = W * 0.78; // leave room for the bloom + split to spread past the letters

  // A big, bold cap height; shrink to fit the width if the word is long.
  let size = H * 0.42;
  ctx.font = `800 ${size}px ${fontFamily}`;
  const measured = ctx.measureText(text).width;
  if (measured > maxW) {
    size *= maxW / measured;
    ctx.font = `800 ${size}px ${fontFamily}`;
  }

  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // A touch of letter spacing so the glow between letters breathes.
  const ls = size * 0.02;
  const chars = [...text];
  const widths = chars.map((c) => ctx.measureText(c).width);
  const total = widths.reduce((a, b) => a + b, 0) + ls * (chars.length - 1);
  let x = cx - total / 2;
  ctx.textAlign = "left";
  for (let i = 0; i < chars.length; i++) {
    ctx.fillText(chars[i], x, cy);
    x += widths[i] + ls;
  }
  return out;
}

```

### chroma/shaders.ts

```ts
// Chromatic Glow shaders (raw WebGL1). The look:
//   1. a white silhouette of the word = the glow source
//   2. a BLOOM = the sum of several Gaussian blurs at growing radii -> a tight core +
//      a huge soft halo
//   3. CHROMATIC ABERRATION = the bloom sampled a few times, each tinted (warm, cool,
//      and a third fringe) and offset a few px in a different direction -> a glowing RGB
//      split fringe
//   4. LO-FI NOISE grain over the top.
// The bloom is built as a downsample chain (progressively smaller framebuffers, each
// blurred cheaply and summed) — the standard real-time way to get a smooth wide halo.

// A full-screen triangle used by every pass.
export const FULL_VERT = `
attribute vec2 aPosition;
varying vec2 vUv;
void main() {
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

// ── BLUR pass ────────────────────────────────────────────────────────────────
// Separable 9-tap Gaussian. Run once horizontally, once vertically per chain level.
// uDir is (texelX, 0) or (0, texelY) scaled by the level's blur radius.
export const BLUR_FRAG = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uTex;
uniform vec2 uDir;   // per-tap step (texel * radius) along one axis

void main() {
  // 9-tap Gaussian weights (sigma ~ 2), normalized.
  float w0 = 0.2270270270;
  float w1 = 0.1945945946;
  float w2 = 0.1216216216;
  float w3 = 0.0540540541;
  float w4 = 0.0162162162;
  vec4 c = texture2D(uTex, vUv) * w0;
  c += texture2D(uTex, vUv + uDir * 1.0) * w1;
  c += texture2D(uTex, vUv - uDir * 1.0) * w1;
  c += texture2D(uTex, vUv + uDir * 2.0) * w2;
  c += texture2D(uTex, vUv - uDir * 2.0) * w2;
  c += texture2D(uTex, vUv + uDir * 3.0) * w3;
  c += texture2D(uTex, vUv - uDir * 3.0) * w3;
  c += texture2D(uTex, vUv + uDir * 4.0) * w4;
  c += texture2D(uTex, vUv - uDir * 4.0) * w4;
  gl_FragColor = c;
}
`;

// ── COMPOSITE pass ───────────────────────────────────────────────────────────
// Takes the crisp mask + up to 4 blurred bloom levels and builds the final image:
// the summed bloom, split into tinted channels each offset by uSplit, over black,
// with lo-fi noise grain and a soft vignette. Every knob is a uniform so the same
// shader drives the card and the playground.
export const COMPOSITE_FRAG = `
precision highp float;
varying vec2 vUv;

uniform sampler2D uMask;    // crisp white silhouette (the core)
uniform sampler2D uB0;      // bloom level 0 (tightest)
uniform sampler2D uB1;
uniform sampler2D uB2;
uniform sampler2D uB3;      // bloom level 3 (widest halo)
uniform vec2  uSplit;       // chromatic aberration offset (uv units), cursor/auto driven
uniform float uBloom;       // overall bloom gain
uniform vec3  uWarm;        // warm/yellow tint  (yellow/blue preset)
uniform vec3  uCool;        // cool/blue tint
uniform vec3  uRed;         // red/cyan fringe tint
uniform float uCore;        // brightness of the crisp white core
uniform vec3  uBg;          // background tint (dark wall, or light wall if inverted)
uniform float uInvert;      // 0 = dark wall + glowing word, 1 = light wall + dark press
uniform float uNoise;       // grain amount 0..1
uniform float uTime;        // for animated grain
uniform float uAspect;      // w/h, to keep the split + vignette round
uniform vec2  uResolution;
uniform float uSpectral;    // 0..1 how much true prism rainbow rides over the base split
uniform vec2  uCursor;      // pointer position in uv (0..1)
uniform float uCursorOn;    // 0..1 eased cursor presence over the card
uniform float uDisperse;    // 0..1 cycle transition: blooms the word out into a soft haze

// cheap hash noise for the lo-fi grain
float hash(vec2 p) {
  p = fract(p * vec2(123.34, 345.45));
  p += dot(p, p + 34.345);
  return fract(p.x * p.y);
}

// smooth value noise (bilinear-interpolated hash) — soft blotches, not per-pixel dither.
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f); // smoothstep the cell
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

// a minimal but richer wall texture, centred around 0. Kept very subtle — just enough that
// the dark background reads as a soft, lit surface with depth instead of flat grain:
//   - 3-octave fbm gives gentle cloudy mottling (large soft blotches + a little fine break-up)
//   - a slow, large-scale diagonal drift so the surface feels hand-finished, not tiled
// The amplitude is low; the caller scales it down further. No hard edges, no obvious pattern.
float wallTex(vec2 uv, vec2 res) {
  vec2 p = uv * vec2(res.x / res.y, 1.0);        // square the domain so blotches aren't stretched
  float fbm =
      vnoise(p * 2.4) * 0.55 +
      vnoise(p * 5.1 + 11.0) * 0.30 +
      vnoise(p * 11.7 + 3.0) * 0.15;
  // a broad, slowly-varying sheen across the panel (one very low-freq octave), so one side
  // of the wall sits a touch lighter — a soft raking light rather than uniform fill.
  float sheen = vnoise(p * 0.9 + 5.0);
  return (fbm - 0.5) * 0.8 + (sheen - 0.5) * 0.5;
}

// the summed multi-radius bloom sampled at an offset (one "channel"). CONCENTRATED:
// the tight core levels carry most of the weight; the wide halo is only a faint skirt,
// so the glow hugs the letters instead of washing the whole card out.
float bloomAt(vec2 uv) {
  float b = 0.0;
  b += texture2D(uB0, uv).r * 0.85;  // tightest -> most of the glow
  b += texture2D(uB1, uv).r * 0.55;
  b += texture2D(uB2, uv).r * 0.22;
  b += texture2D(uB3, uv).r * 0.10;  // widest halo -> just a faint skirt
  return b;
}

// A palette-anchored spectral ramp: 0 = warm end, 1 = cool end, with the fringe tint
// as the midpoint. Instead of 3 hard tints this gives a smooth colour walk across the
// halo, so the split reads as a soft rainbow edge rather than a flat colour cast.
vec3 spectralTint(float u) {
  u = clamp(u, 0.0, 1.0);
  if (u < 0.5) return mix(uWarm, uRed, u * 2.0);
  return mix(uRed, uCool, (u - 0.5) * 2.0);
}

// TRUE prism dispersion, kept MINIMAL: the aberration grows with distance from the word
// centre (real glass fans outward), and we take a few taps across the spectrum along the
// split direction. Small radius + few taps => a refined rainbow rim, not a busy smear.
vec3 spectralFringe(vec2 uv, vec2 split) {
  // radial gain: ~1 near centre, a touch more toward the edges (clamped so it stays soft)
  vec2 fromC = (uv - 0.5) * vec2(uAspect, 1.0);
  float disp = 0.6 + 0.9 * clamp(length(fromC), 0.0, 1.0);
  vec2 step = split * disp;
  vec3 acc = vec3(0.0);
  // 5 evenly-spaced taps from -1 (warm) to +1 (cool); the fringe colour sits in the middle
  const int N = 5;
  for (int i = 0; i < N; i++) {
    float f = float(i) / float(N - 1);        // 0..1
    float off = (f - 0.5) * 2.0;              // -1..1
    float b = bloomAt(uv + step * off);
    acc += spectralTint(f) * b;
  }
  return acc / float(N);
}

void main() {
  // LIQUID-CHROME SHIMMER: a whisper-amplitude uv warp driven by slow noise, so the word
  // and its glow gently wobble like molten metal instead of a dead silhouette. The warp
  // is domain-distorted (noise of noise) for an organic, non-directional ripple and kept
  // extremely small (~0.15% of the frame) so it never smears the letters.
  vec2 uv = vUv;
  float wx = vnoise(uv * 4.0 + vec2(uTime * 0.13, uTime * 0.05));
  float wy = vnoise(uv * 4.0 + vec2(7.0 - uTime * 0.06, 3.0 + uTime * 0.11));
  uv += (vec2(wx, wy) - 0.5) * 0.0016;

  // ---- CYCLE DISPERSE & RE-FORM: the transition is made entirely of the effect's OWN
  // language — bloom + split — not a glitch. uDisperse (0 at rest, 1 at mid-swap) spreads
  // the chromatic split WIDE so the warm/cool copies pull far apart, melts the crisp core,
  // and lifts the bloom, so the old word blooms out into a soft coloured haze; at the peak
  // the word swaps under the cloud; then uDisperse falls and the new word condenses back
  // out of the light as the split collapses to rest. Smooth, glowy, in-style. ----
  vec2 s = uSplit;
  float disp = uDisperse;                         // 0..1 dispersion strength this frame
  // spread the split RADIALLY outward from centre (a prism blooming apart), plus a slow
  // swirl so the haze has a little organic drift rather than a pure zoom.
  vec2 fromMid = (uv - 0.5) * vec2(uAspect, 1.0);
  float rr = length(fromMid) + 0.0001;
  vec2 radial = fromMid / rr;
  float ang = uTime * 0.6;
  vec2 swirl = vec2(radial.x * cos(ang) - radial.y * sin(ang),
                    radial.x * sin(ang) + radial.y * cos(ang));
  // during dispersion the split grows (copies drift apart) and gains the radial/swirl
  // direction, so the word softens into a gentle rainbow haze instead of tearing. Kept
  // WEAK — the word stays put and just breathes, it never flies far out.
  s += mix(radial, swirl, 0.5) * disp * 0.022;
  s *= 1.0 + disp * 0.9;
  // no per-channel tear anymore — the split alone carries the whole transition.
  vec2 tearW = vec2(0.0), tearC = vec2(0.0), tearR = vec2(0.0);

  // CURSOR POOL: a soft aspect-correct falloff around the pointer. It does NOT move the
  // word — it just brightens the bloom + widens the rainbow locally, so the light lifts
  // where you hover and settles back when you leave. Gentle radius, eased by presence.
  vec2 cAsp = vec2(uAspect, 1.0);
  vec2 toCur = uv * cAsp - uCursor * cAsp;
  float cd = length(toCur);
  float pool = smoothstep(0.34, 0.0, cd) * uCursorOn;   // 1 at cursor -> 0 by ~0.34

  // HOVER LIFE: near the pointer the light behaves like a disturbed liquid, not just a
  // brighter spot. Two small touches, both fading out with the pool:
  //  1. a soft concentric RIPPLE pushes the sampled uv in/out radially around the cursor,
  //     so the glow ripples as if the pointer pressed into it.
  //  2. the split gains a component that leans ALONG the cursor->centre direction, so the
  //     rainbow tilts toward where you are (felt, but it never drags the whole word).
  if (pool > 0.001) {
    vec2 rdir = toCur / max(cd, 0.0001);
    float ripple = sin(cd * 46.0 - uTime * 5.0) * pool * 0.0022;
    uv += (rdir / cAsp) * ripple;
    s += (rdir / cAsp) * pool * 0.010;                  // split leans toward the cursor
  }

  // Chromatic aberration: sample the bloom three times, each pushed a different way, so
  // the tinted copies pull apart at the edges:
  //   warm  ->  +split
  //   cool  ->  -split
  //   fringe -> perpendicular split (a second, weaker fringe)
  // These are SCALAR intensities per channel, tinted then blended below.
  float bw = bloomAt(uv + s + tearW);
  float bc = bloomAt(uv - s + tearC);
  float br = bloomAt(uv + vec2(-s.y, s.x) * 0.6 + tearR);

  // Coloured glow, tone-mapped with a soft rolloff so the letter bodies don't clip to
  // flat white. 1 - exp(-x) saturates gently toward the tint's own colour. A small
  // amount of the TRUE spectral fringe (radial prism, multi-tap) is mixed into the raw
  // energy so the halo edge gains a soft rainbow without changing the overall colour.
  vec3 baseRaw = (uWarm * bw + uCool * bc + uRed * br);
  // near the cursor, widen the rainbow (more spectral) and lift the glow (more energy).
  // during dispersion gently widen the spectral rainbow + lift the bloom a touch, so the
  // word softly breathes rather than blowing into a big cloud. Kept weak.
  float specAmt = clamp(uSpectral + pool * 0.4 + disp * 0.25, 0.0, 1.0);
  vec3 raw = mix(baseRaw, spectralFringe(uv, s), specAmt * 0.55) * uBloom * (1.0 + pool * 0.9 + disp * 0.45);
  vec3 glow = vec3(1.0) - exp(-raw);
  // the crisp white core softens as the word disperses (loses its hard edge into the bloom)
  // but never fully vanishes, so it stays readable while it re-forms.
  float core = texture2D(uMask, uv).r * (1.0 - disp * 0.75);

  // shared: vignette + a minimal plaster grain so the wall reads as a real surface
  vec2 vc = (uv - 0.5) * vec2(uAspect, 1.0);
  float vig = smoothstep(1.05, 0.35, length(vc));
  float tex = wallTex(uv, uResolution);
  float g = hash(uv * uResolution * 0.5 + uTime);

  // LIVING WALL: a very slow caustic drift so the dark background breathes instead of
  // sitting dead. Two counter-scrolling low-freq noise fields beat against each other;
  // the result is tiny (a few % of the wall value) and tinted by the palette below.
  float ca = vnoise(uv * vec2(uAspect, 1.0) * 2.3 + vec2(uTime * 0.012, uTime * 0.008));
  float cb = vnoise(uv * vec2(uAspect, 1.0) * 3.7 - vec2(uTime * 0.009, uTime * 0.014));
  float caustic = (ca * cb - 0.25);   // centred-ish, mostly small

  // ---- DARK mode: dark wall + glowing word (additive) ----
  vec3 rimC = vec3(uCore) * smoothstep(0.35, 0.55, core) * (1.0 - smoothstep(0.6, 0.9, core));
  vec3 glowD = glow;
  glowD += rimC;
  glowD += (g - 0.5) * uNoise * (0.4 + 0.6 * length(glowD));
  glowD *= mix(0.82, 1.0, vig);
  // base wall + a soft mottle/sheen: multiply for the darker blotches, plus a gentle additive
  // lift on the bright side of the sheen so the surface has light on it (not only shadow).
  vec3 wallD = uBg * mix(0.82, 1.08, vig) * (1.0 + tex * 0.35) + uBg * max(tex, 0.0) * 0.25;
  // palette-tinted caustic light on the wall (stronger toward the darker outer field, so it
  // never fights the glow): the wall clearly shimmers in the word's own colours instead of
  // sitting as a flat near-black panel.
  vec3 causticTint = normalize(uWarm + uCool + 0.0001);
  wallD += causticTint * caustic * 0.09 * (1.0 - vig * 0.4);
  vec3 outD = wallD + glowD;

  // ---- LIGHT mode: dark word with the SAME soft bloom, as a dark tinted haze ----
  // This is dark mode's look inverted: the same soft multi-radius bloom (bw/bc/br) drives
  // everything, so the word carries the same blurry glow — but here it DARKENS the light
  // wall toward each split colour instead of adding light. Because we use the soft bloom
  // (not the crisp mask), the edges are soft + glowy, and the warm/cool offsets give the
  // coloured chromatic haze. A crisp dark core sits under it so the letters stay legible.
  vec3 wallL = uBg * mix(1.0, 0.94, 1.0 - vig);       // light wall, faintly darker at edges
  wallL += tex * 0.018;                               // faint mottle/sheen (subtle on paper)

  // the soft bloom, tinted + split, as a "darken amount" per channel (same tone-map as
  // dark mode). glowL is bright/coloured near the word, ~0 out on the wall.
  vec3 rawL = mix(baseRaw, spectralFringe(uv, s), specAmt * 0.55) * uBloom * (1.0 + pool * 0.9);
  vec3 glowL = vec3(1.0) - exp(-rawL);
  // darken the wall toward the COMPLEMENT of the glow colour, weighted by how strong the
  // glow is here -> a soft warm haze on one side, cool on the other, fading into the wall.
  vec3 pressed = wallL * (vec3(1.0) - glowL * 0.9);

  // a crisp dark core so the letters read solid (the soft bloom alone is too faint to be
  // legible as text). Uses the plain mask, pressed to near-black.
  float ink = smoothstep(0.4, 0.62, core);
  pressed *= mix(1.0, 0.1, ink);
  pressed += (g - 0.5) * uNoise * 0.4;                // grain
  vec3 outL = pressed;

  vec3 outc = mix(outD, outL, uInvert);
  gl_FragColor = vec4(outc, 1.0);
}
`;

```

### chroma/engine.ts

```ts
// Chromatic Glow engine (raw WebGL1). Renders ONE word as a bright chromatic bloom on
// a dark card. Pipeline per frame:
//   1. the word's white mask is the glow source (uploaded once)
//   2. BLOOM = a downsample chain: the mask is blurred + shrunk into 4 progressively
//      smaller framebuffers, each Gaussian-blurred (H then V). Small buffers = a huge,
//      smooth halo for almost no cost.
//   3. COMPOSITE = the 4 bloom levels sampled 3× with per-tint offsets (warm/cool/
//      fringe) -> the RGB chromatic-aberration fringe, + noise grain + vignette
// Motion: an autonomous drift starts on load and gently pushes the split + bloom; the
// cursor overrides it and intensifies the split when you move over the card.

import { FULL_VERT, BLUR_FRAG, COMPOSITE_FRAG } from "./shaders";
import { makeWordMask } from "./text-mask";

export type ChromaParams = {
  word: string;
  bloom: number;    // overall glow gain
  split: number;    // chromatic aberration distance (px @ 620h)
  core: number;     // crisp white core brightness
  noise: number;    // grain amount
  spectral: number; // 0..1 how much true prism rainbow rides over the base split
  warm: [number, number, number];
  cool: [number, number, number];
  red: [number, number, number];
  bg: [number, number, number]; // background tint (dark wall, or light wall if invert)
  invert: boolean;              // true = LIGHT wall + DARK pressed word (glow as fringe)
};

// Defaults: soft PEACH vs. cool STEEL-BLUE on a deep dusk-blue wall (the peach/steel world).
export const CHROMA_DEFAULTS: ChromaParams = {
  word: "chrome",
  bloom: 1.62,   // gain into the tone-map (1 - exp(-x)); high enough to read, can't clip
  split: 9.0,
  core: 1.06,    // thin rim brightness only (not a full white fill anymore)
  noise: 0.15,
  spectral: 0.6, // a soft real-rainbow rim rides over the warm/cool split

  warm: [1.0, 0.66, 0.5],   // soft peach
  cool: [0.42, 0.6, 0.95],  // steel blue
  red: [1.0, 0.42, 0.6],    // rose fringe
  bg: [0.11, 0.13, 0.2],    // deep dusk-blue wall (a lifted indigo, clearly a colour)
  invert: false,
};

// The downsample chain: each level is a fraction of the canvas, with a blur radius (in
// its own texels). Growing scale-down + radius reproduces the 5/25/50/80/190px ladder.
const LEVELS = [
  { scale: 0.5, radius: 1.5 },
  { scale: 0.25, radius: 2.0 },
  { scale: 0.125, radius: 2.5 },
  { scale: 0.0625, radius: 3.0 },
];

type Target = { fb: WebGLFramebuffer; tex: WebGLTexture; w: number; h: number };

export class ChromaGlow {
  private host: HTMLElement;
  private canvas: HTMLCanvasElement;
  private gl: WebGLRenderingContext | null = null;

  private blurProg: WebGLProgram | null = null;
  private compProg: WebGLProgram | null = null;
  private quad: WebGLBuffer | null = null;
  private blurLoc: Record<string, WebGLUniformLocation | null> = {};
  private compLoc: Record<string, WebGLUniformLocation | null> = {};

  private mask: WebGLTexture | null = null;
  private maskW = 1;
  private maskH = 1;
  // per level: the bloom target + a scratch target for the separable blur
  private levels: { out: Target; tmp: Target }[] = [];

  private raf = 0;
  private running = false;
  private awake = false;
  private startT = 0;

  private w = 0;
  private h = 0;
  private dpr = 1;
  private fontFamily = "var(--font-neue-corp), sans-serif";
  private params: ChromaParams;

  // rebuild guards (mask is the only expensive CPU step)
  private builtW = 0;
  private builtH = 0;
  private builtWord = "";
  private builtFont = "";
  private buildScheduled = 0;
  private destroyed = false;
  private painted = false;

  // motion: eased split target (cursor) + autonomous flick + hover intensity
  private px = 0;       // pointer x in -1..1 from center
  private py = 0;
  private tpx = 0;
  private tpy = 0;
  private active = 0;   // eased 0..1, 1 while cursor over the card
  private tActive = 0;
  // autonomous motion: a smoothly-followed position that wanders the word fast on a few
  // layered sines (the LEGO virtual-cursor style), non-circular + non-linear. fx/fy.
  private fx = 0;
  private fy = 0;

  // ---- cycle mode: the hero card walks a list of funny words + colour worlds, joined by
  // a chromatic glitch-slide. Off by default (the playground never cycles). ----
  private cycle = false;
  private cycleWords: string[] = [];
  private cyclePalettes: Partial<ChromaParams>[] = [];
  private cycleIdx = 0;
  private cyclePhase: "hold" | "out" | "in" = "hold";
  private cyclePhaseT = 0;      // seconds into the current phase
  private holdDur = 1.15;       // seconds a word rests before the next transition
  private outDur = 0.24;        // bloom out into haze
  private inDur = 0.32;         // condense back into the new word
  private disperse = 0;         // 0..1 transition dispersion (bloom-out), driven by phase
  private nextPending = false;  // set at the out->in swap point
  private lastNow = 0;          // for real-dt cycle stepping
  // palette tween: we lerp the colour uniforms from `palFrom` to `palTo` across a swap so
  // the world changes smoothly under the glitch instead of popping.
  private palFrom: Partial<ChromaParams> | null = null;
  private palTo: Partial<ChromaParams> | null = null;
  private palMix = 1;           // 0..1, eased across the transition

  ok = false;

  constructor(host: HTMLElement, params?: Partial<ChromaParams>) {
    this.host = host;
    this.params = { ...CHROMA_DEFAULTS, ...params };
    this.canvas = document.createElement("canvas");
    Object.assign(this.canvas.style, {
      position: "absolute",
      inset: "0",
      width: "100%",
      height: "100%",
      display: "block",
      // Hidden until the first real frame so the dark host shows (and gets captured by
      // the view-transition) instead of an undrawn black canvas flashing.
      opacity: "0",
    });
    host.appendChild(this.canvas);

    const gl = this.canvas.getContext("webgl", {
      alpha: false,
      antialias: false,
      premultipliedAlpha: false,
    });
    if (!gl) return;
    this.gl = gl;

    try {
      this.blurProg = this.build(FULL_VERT, BLUR_FRAG);
      this.compProg = this.build(FULL_VERT, COMPOSITE_FRAG);
    } catch {
      this.gl = null;
      return;
    }

    for (const u of ["uTex", "uDir"]) {
      this.blurLoc[u] = gl.getUniformLocation(this.blurProg, u);
    }
    for (const u of [
      "uMask", "uB0", "uB1", "uB2", "uB3", "uSplit", "uBloom", "uWarm", "uCool",
      "uRed", "uCore", "uBg", "uInvert", "uNoise", "uTime", "uAspect", "uResolution",
      "uSpectral", "uCursor", "uCursorOn", "uDisperse",
    ]) {
      this.compLoc[u] = gl.getUniformLocation(this.compProg, u);
    }

    // full-screen triangle
    this.quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);

    // clear to the current bg tint so any pre-composite frame matches the wall (no flash)
    gl.clearColor(this.params.bg[0], this.params.bg[1], this.params.bg[2], 1);

    this.resize();
    void this.buildMaskNow();

    this.canvas.addEventListener("pointermove", this.onMove);
    this.canvas.addEventListener("pointerenter", this.onEnter);
    this.canvas.addEventListener("pointerleave", this.onLeave);
    this.ok = true;
  }

  private build(vs: string, fs: string): WebGLProgram {
    const gl = this.gl!;
    const c = (type: number, src: string) => {
      const sh = gl.createShader(type)!;
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        throw new Error(gl.getShaderInfoLog(sh) || "compile failed");
      }
      return sh;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, c(gl.VERTEX_SHADER, vs));
    gl.attachShader(prog, c(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(prog) || "link failed");
    }
    return prog;
  }

  private makeTarget(w: number, h: number): Target {
    const gl = this.gl!;
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fb = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { fb, tex, w, h };
  }

  private allocLevels() {
    const gl = this.gl;
    if (!gl) return;
    this.freeLevels();
    const cw = this.canvas.width;
    const ch = this.canvas.height;
    this.levels = LEVELS.map((l) => {
      const w = Math.max(2, Math.round(cw * l.scale));
      const h = Math.max(2, Math.round(ch * l.scale));
      return { out: this.makeTarget(w, h), tmp: this.makeTarget(w, h) };
    });
  }

  private freeLevels() {
    const gl = this.gl;
    if (!gl) return;
    for (const lv of this.levels) {
      gl.deleteFramebuffer(lv.out.fb);
      gl.deleteTexture(lv.out.tex);
      gl.deleteFramebuffer(lv.tmp.fb);
      gl.deleteTexture(lv.tmp.tex);
    }
    this.levels = [];
  }

  setFont(family: string) {
    if (family === this.fontFamily) return;
    this.fontFamily = family;
    this.scheduleBuild();
  }

  setParams(p: Partial<ChromaParams>) {
    const wordChanged = p.word !== undefined && p.word !== this.params.word;
    this.params = { ...this.params, ...p };
    if (wordChanged) this.scheduleBuild();
    else if (!this.running) this.renderOnce();
  }

  /**
   * Turn on hero cycle mode: walk `words` paired with `palettes` (a colour world each),
   * swapping every few seconds with a chromatic glitch-slide. The first pair is applied
   * immediately. The playground never calls this, so it stays a single static word.
   */
  enableCycle(words: string[], palettes: Partial<ChromaParams>[]) {
    if (!words.length) return;
    this.cycle = true;
    this.cycleWords = words;
    this.cyclePalettes = palettes;
    this.cycleIdx = 0;
    this.cyclePhase = "hold";
    this.cyclePhaseT = 0;
    this.palMix = 1;
    this.palFrom = palettes[0] ?? null;
    this.palTo = palettes[0] ?? null;
    this.params = { ...this.params, word: words[0], ...(palettes[0] ?? {}) };
    this.scheduleBuild();
  }

  // lerp helpers for the palette tween
  private lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
  private lerp3(
    a: [number, number, number], b: [number, number, number], t: number,
  ): [number, number, number] {
    return [this.lerp(a[0], b[0], t), this.lerp(a[1], b[1], t), this.lerp(a[2], b[2], t)];
  }

  // Resolve the currently-displayed palette by easing palFrom -> palTo by palMix. Falls
  // back to the live params for any field a palette omits.
  private tweenedPalette(): ChromaParams {
    const base = this.params;
    if (!this.palFrom || !this.palTo || this.palMix >= 1) {
      const to = this.palTo ?? {};
      return { ...base, ...to };
    }
    const f = { ...base, ...this.palFrom };
    const g = { ...base, ...this.palTo };
    const t = this.palMix;
    return {
      ...base,
      warm: this.lerp3(f.warm, g.warm, t),
      cool: this.lerp3(f.cool, g.cool, t),
      red: this.lerp3(f.red, g.red, t),
      bg: this.lerp3(f.bg, g.bg, t),
      split: this.lerp(f.split, g.split, t),
      bloom: this.lerp(f.bloom, g.bloom, t),
      core: this.lerp(f.core, g.core, t),
      noise: this.lerp(f.noise, g.noise, t),
      spectral: this.lerp(f.spectral, g.spectral, t),
      // invert can't tween; switch it at the midpoint (when the glitch hides the pop)
      invert: t < 0.5 ? f.invert : g.invert,
    };
  }

  private onMove = (e: PointerEvent) => {
    const r = this.canvas.getBoundingClientRect();
    this.tpx = ((e.clientX - r.left) / r.width) * 2 - 1;
    this.tpy = -(((e.clientY - r.top) / r.height) * 2 - 1);
    this.tActive = 1;
    this.wake();
  };
  private onEnter = () => {
    this.tActive = 1;
    this.wake();
  };
  private onLeave = () => {
    this.tActive = 0;
    this.tpx = 0;
    this.tpy = 0;
    this.wake();
  };

  private wake() {
    if (this.awake && !this.running) this.start();
  }

  resize() {
    const r = this.host.getBoundingClientRect();
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.w = r.width;
    this.h = r.height;
    const cw = Math.max(1, Math.round(this.w * this.dpr));
    const ch = Math.max(1, Math.round(this.h * this.dpr));
    if (this.canvas.width !== cw || this.canvas.height !== ch) {
      this.canvas.width = cw;
      this.canvas.height = ch;
      this.gl?.viewport(0, 0, cw, ch);
      this.allocLevels();
      this.scheduleBuild();
    } else if (this.levels.length === 0) {
      this.allocLevels();
    }
  }

  // cap the mask resolution so the (CPU) rasterize stays cheap; the bloom smooths it.
  private maskSize(): [number, number] {
    const MAX_W = 1400;
    const mw = Math.max(2, Math.min(MAX_W, Math.round(this.w * this.dpr)));
    const mh = Math.max(2, Math.round(mw * (this.h / Math.max(1, this.w))));
    return [mw, mh];
  }

  private scheduleBuild() {
    if (!this.gl || this.destroyed) return;
    const [mw, mh] = this.maskSize();
    if (
      mw === this.builtW && mh === this.builtH &&
      this.params.word === this.builtWord && this.fontFamily === this.builtFont
    ) return;
    if (this.buildScheduled) return;
    const run = () => {
      this.buildScheduled = 0;
      void this.buildMaskNow();
    };
    const ric = (window as unknown as {
      requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number;
    }).requestIdleCallback;
    this.buildScheduled = ric ? ric(run, { timeout: 200 }) : window.setTimeout(run, 0);
  }

  private async buildMaskNow() {
    const gl = this.gl;
    if (!gl || this.destroyed) return;
    if (this.buildScheduled) {
      const cic = (window as unknown as { cancelIdleCallback?: (id: number) => void })
        .cancelIdleCallback;
      if (cic) cic(this.buildScheduled);
      else window.clearTimeout(this.buildScheduled);
      this.buildScheduled = 0;
    }
    const [mw, mh] = this.maskSize();
    this.builtW = mw;
    this.builtH = mh;
    this.builtWord = this.params.word;
    this.builtFont = this.fontFamily;
    const art = await makeWordMask(this.params.word, mw, mh, this.fontFamily);
    if (!this.gl || this.destroyed) return;
    if (!this.mask) this.mask = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.mask);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, art);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    this.maskW = art.width;
    this.maskH = art.height;
    if (!this.running) this.renderOnce();
  }

  start() {
    if (!this.ok) return;
    this.awake = true;
    if (this.running) return;
    this.running = true;
    this.resize();
    if (!this.startT) this.startT = performance.now();
    const loop = (now: number) => {
      if (!this.running) return;
      this.frame(now);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  /** Stop and forbid waking (offscreen / hidden). */
  stop() {
    this.awake = false;
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  private renderOnce() {
    if (this.raf) return;
    this.raf = requestAnimationFrame((t) => {
      this.raf = 0;
      this.render(t);
    });
  }

  private frame(now: number) {
    // ease pointer + active toward targets (cursor stays smooth, no overshoot)
    const k = 0.08;
    this.px += (this.tpx - this.px) * k;
    this.py += (this.tpy - this.py) * k;
    this.active += (this.tActive - this.active) * 0.06;

    // Autonomous motion = the same organic wander the LEGO card's virtual cursor uses
    // (a few sine/cosine harmonics at different frequencies, so it roams the word in a
    // smooth non-circular, non-linear path), but MUCH faster here. Ease the actual
    // position toward it so it always stays silky, never snappy.
    const t = (now - (this.startT || now)) / 1000;
    const T = t * 3.2; // faster than LEGO's wander
    const ax =
      0.16 * Math.sin(T * 1.15) +
      0.09 * Math.sin(T * 2.6 + 1.0) +
      0.05 * Math.cos(T * 4.1 + 0.4);
    const ay =
      0.13 * Math.cos(T * 0.95 + 2.1) +
      0.07 * Math.sin(T * 2.2 + 0.5) +
      0.04 * Math.cos(T * 3.7 + 1.7);
    this.fx += (ax - this.fx) * 0.2; // smooth follow
    this.fy += (ay - this.fy) * 0.2;

    if (this.cycle) {
      // real elapsed seconds (clamped) so the cycle runs at a steady wall-clock speed and
      // never lags or jumps when frames are uneven.
      const dt = this.lastNow ? Math.min(0.05, (now - this.lastNow) / 1000) : 1 / 60;
      this.stepCycle(dt);
    }
    this.lastNow = now;

    this.render(now);
  }

  // Advance the hero cycle clock with a real dt so it runs at steady wall-clock speed.
  // The transition is a DISPERSE & RE-FORM built from the effect's own bloom+split:
  //   HOLD  — the word rests (disperse = 0)
  //   OUT   — disperse rises: the split spreads wide, the core melts, the word blooms out
  //           into a soft coloured haze; palette crossfades halfway
  //   IN    — disperse falls: the new word condenses back out of the light as the split
  //           collapses; palette finishes. The word + invert swap at the OUT->IN peak,
  //           when it's a formless cloud, so the change is invisible.
  private stepCycle(dt: number) {
    this.cyclePhaseT += dt;
    // ease so the haze blooms open quickly then re-forms gently (easeOut on the way in).
    const easeIn = (x: number) => x * x;
    const easeOut = (x: number) => 1 - (1 - x) * (1 - x);

    if (this.cyclePhase === "hold") {
      this.disperse += (0 - this.disperse) * Math.min(1, dt * 12);
      if (this.cyclePhaseT >= this.holdDur) {
        // begin the transition: palette tween toward the NEXT world
        this.palFrom = this.cyclePalettes[this.cycleIdx] ?? null;
        const nextIdx = (this.cycleIdx + 1) % this.cycleWords.length;
        this.palTo = this.cyclePalettes[nextIdx] ?? this.palFrom;
        this.palMix = 0;
        this.nextPending = true;
        this.cyclePhase = "out";
        this.cyclePhaseT = 0;
      }
    } else if (this.cyclePhase === "out") {
      const k = Math.min(1, this.cyclePhaseT / this.outDur);
      this.disperse = easeIn(k);          // bloom out into haze
      this.palMix = 0.5 * k;
      if (k >= 1) {
        // PEAK: the word is a formless cloud -> swap word + invert now (hidden by the haze)
        if (this.nextPending) {
          this.nextPending = false;
          this.cycleIdx = (this.cycleIdx + 1) % this.cycleWords.length;
          this.params = { ...this.params, word: this.cycleWords[this.cycleIdx] };
          void this.buildMaskNow();        // rebuild mask for the new word
        }
        this.cyclePhase = "in";
        this.cyclePhaseT = 0;
      }
    } else {
      // IN: the new word condenses back out of the light; palette settles.
      const k = Math.min(1, this.cyclePhaseT / this.inDur);
      this.disperse = 1 - easeOut(k);     // haze collapses back to a sharp word
      this.palMix = 0.5 + 0.5 * k;
      if (k >= 1) {
        this.disperse = 0;
        this.palMix = 1;
        this.cyclePhase = "hold";
        this.cyclePhaseT = 0;
      }
    }
  }

  private render(now: number) {
    const gl = this.gl;
    if (!gl || !this.compProg || !this.blurProg) return;
    if (!this.mask || this.levels.length === 0) return;

    const t = (now - this.startT) / 1000;

    // ---- build the bloom chain ----
    // Level 0 blurs the mask; each next level blurs the previous level's output. Each
    // level is separable (H then V). Smaller buffers = a wider effective blur.
    gl.useProgram(this.blurProg);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    const aPos = gl.getAttribLocation(this.blurProg, "aPosition");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    for (let i = 0; i < this.levels.length; i++) {
      const lv = this.levels[i];
      const src = i === 0 ? this.mask : this.levels[i - 1].out.tex;
      const r = LEVELS[i].radius;
      // H pass: src -> tmp
      gl.bindFramebuffer(gl.FRAMEBUFFER, lv.tmp.fb);
      gl.viewport(0, 0, lv.tmp.w, lv.tmp.h);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, src);
      gl.uniform1i(this.blurLoc.uTex, 0);
      gl.uniform2f(this.blurLoc.uDir, r / lv.tmp.w, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      // V pass: tmp -> out
      gl.bindFramebuffer(gl.FRAMEBUFFER, lv.out.fb);
      gl.viewport(0, 0, lv.out.w, lv.out.h);
      gl.bindTexture(gl.TEXTURE_2D, lv.tmp.tex);
      gl.uniform2f(this.blurLoc.uDir, 0, r / lv.out.h);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    // ---- composite to screen ----
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.useProgram(this.compProg);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    const aPos2 = gl.getAttribLocation(this.compProg, "aPosition");
    gl.enableVertexAttribArray(aPos2);
    gl.vertexAttribPointer(aPos2, 2, gl.FLOAT, false, 0, 0);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.mask);
    gl.uniform1i(this.compLoc.uMask, 0);
    for (let i = 0; i < 4; i++) {
      gl.activeTexture(gl.TEXTURE1 + i);
      gl.bindTexture(gl.TEXTURE_2D, this.levels[i]?.out.tex ?? this.mask);
      gl.uniform1i(this.compLoc[`uB${i}`], 1 + i);
    }

    // ---- motion: autonomous wander drives the split; the cursor lights up LOCALLY ----
    // In cycle mode the colour world is the eased tween palFrom->palTo; otherwise it's the
    // live params (playground). Everything below reads from `p`.
    const p = this.cycle ? this.tweenedPalette() : this.params;
    const splitUv = p.split / 620; // base split in uv units (px @ 620h -> uv)
    // The split itself is driven purely by the card's own gentle wander (fx/fy) — the
    // cursor does NOT drag it around (that felt wrong). Instead the pointer position is
    // handed to the shader, which swells the bloom + rainbow in a soft pool right under
    // the cursor. So moving over it lights the word up where you are, and leaving lets it
    // settle back — no sliding, no whole-word shove.
    const sx = this.fx * 2.4 * splitUv;
    const sy = this.fy * 2.4 * splitUv;
    gl.uniform2f(this.compLoc.uSplit, sx, sy);
    // cursor uv (0..1) + eased strength; the shader makes a glow pool around it.
    gl.uniform2f(this.compLoc.uCursor, this.px * 0.5 + 0.5, this.py * 0.5 + 0.5);
    gl.uniform1f(this.compLoc.uCursorOn, this.active);
    gl.uniform1f(this.compLoc.uDisperse, this.disperse);

    const bloomPulse = p.bloom * (0.94 + 0.06 * Math.sin(t * 0.7));
    gl.uniform1f(this.compLoc.uBloom, bloomPulse);
    gl.uniform3f(this.compLoc.uWarm, p.warm[0], p.warm[1], p.warm[2]);
    gl.uniform3f(this.compLoc.uCool, p.cool[0], p.cool[1], p.cool[2]);
    gl.uniform3f(this.compLoc.uRed, p.red[0], p.red[1], p.red[2]);
    gl.uniform1f(this.compLoc.uCore, p.core);
    gl.uniform1f(this.compLoc.uSpectral, p.spectral);
    gl.uniform3f(this.compLoc.uBg, p.bg[0], p.bg[1], p.bg[2]);
    gl.uniform1f(this.compLoc.uInvert, p.invert ? 1 : 0);
    gl.uniform1f(this.compLoc.uNoise, p.noise);
    gl.uniform1f(this.compLoc.uTime, t);
    gl.uniform1f(this.compLoc.uAspect, this.w / Math.max(1, this.h));
    gl.uniform2f(this.compLoc.uResolution, this.canvas.width, this.canvas.height);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    if (!this.painted) {
      this.painted = true;
      this.canvas.style.opacity = "1";
    }
  }

  /** One static frame for reduced-motion. */
  renderStill() {
    this.resize();
    void this.buildMaskNow();
    this.startT = performance.now();
    this.render(performance.now());
  }

  destroy() {
    this.destroyed = true;
    if (this.buildScheduled) {
      const cic = (window as unknown as { cancelIdleCallback?: (id: number) => void })
        .cancelIdleCallback;
      if (cic) cic(this.buildScheduled);
      else window.clearTimeout(this.buildScheduled);
      this.buildScheduled = 0;
    }
    this.stop();
    this.canvas.removeEventListener("pointermove", this.onMove);
    this.canvas.removeEventListener("pointerenter", this.onEnter);
    this.canvas.removeEventListener("pointerleave", this.onLeave);
    const gl = this.gl;
    if (gl) {
      this.freeLevels();
      if (this.mask) gl.deleteTexture(this.mask);
      if (this.quad) gl.deleteBuffer(this.quad);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    }
    this.canvas.remove();
  }
}

```

### chroma/playground.tsx

```tsx
"use client";

// Chromatic Glow playground — the detail-page editor. Type a word and it blooms with
// the RGB chromatic split live. Sliders drive the bloom, the split distance, the noise
// grain, and the three tint colours (warm / cool / fringe). Remix rolls a fresh pair.
// Built on the same ChromaGlow engine the card uses, from the shared Vault control kit
// so it matches the site.

import { useEffect, useMemo, useRef, useState } from "react";
import { ChromaGlow, type ChromaParams } from "./engine";
import {
  defaultChromaParams, remixChromaParams, toHex, fromHex,
} from "./params";
import { PG_PREVIEW, PG_PANEL, Slider, ColorControl, GhostButton } from "../swirl/controls";
import { SectionLabel } from "../section-label";
import { hapticTap } from "../../lib/haptics";

const LABEL = "text-[12px] text-[var(--text-tertiary)]";

export function ChromaGlowPlayground() {
  const hostRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<ChromaGlow | null>(null);

  const [params, setParams] = useState<ChromaParams>(() => defaultChromaParams());
  const [word, setWord] = useState("chrome");

  const full = useMemo<ChromaParams>(() => ({ ...params, word }), [params, word]);

  // Mount the engine only when the playground scrolls into view, so the detail hero
  // card and the playground don't both spin up WebGL during the view-transition morph.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let raf = 0;
    let started = false;
    let onScreen = true;
    const sync = () => {
      const eng = engineRef.current;
      if (!eng) return;
      if (onScreen) eng.start();
      else eng.stop();
    };
    const build = () => {
      if (started) return;
      started = true;
      raf = requestAnimationFrame(() => {
        const eng = new ChromaGlow(host, full);
        if (!eng.ok) return;
        engineRef.current = eng;
        eng.start();
        if (document.fonts?.load) {
          const probe = document.createElement("span");
          probe.style.cssText = "position:absolute;visibility:hidden;font-family:var(--font-neue-corp)";
          probe.textContent = "Ag";
          document.body.appendChild(probe);
          const fam = getComputedStyle(probe).fontFamily.split(",")[0].replace(/["']/g, "").trim();
          document.body.removeChild(probe);
          document.fonts.load(`800 1em "${fam}"`).then(() => eng.setFont(`"${fam}", sans-serif`), () => {});
        }
      });
    };
    const io = new IntersectionObserver(
      (es) => {
        onScreen = es[0]?.isIntersecting ?? false;
        if (onScreen) build();
        sync();
      },
      { rootMargin: "200px" },
    );
    io.observe(host);
    const onResize = () => engineRef.current?.resize();
    window.addEventListener("resize", onResize);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      engineRef.current?.destroy();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // push params/word to the engine
  useEffect(() => { engineRef.current?.setParams(full); }, [full]);

  const patch = (p: Partial<ChromaParams>) => setParams((prev) => ({ ...prev, ...p }));
  const remix = () => {
    hapticTap();
    // keep the user's typed word — Remix only rolls a fresh colour world, so you can apply
    // different presets to the same text.
    const { word: _drop, ...colours } = remixChromaParams();
    void _drop;
    setParams((prev) => ({ ...prev, ...colours }));
  };

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <SectionLabel action={<GhostButton onClick={remix}>Remix</GhostButton>}>
        Playground
      </SectionLabel>

      {/* live preview */}
      <div className={`${PG_PREVIEW} aspect-[1344/620] w-full bg-[#1c2133]`}>
        <div ref={hostRef} data-canvas-card className="absolute inset-0 h-full w-full" />
      </div>

      {/* controls */}
      <div className={PG_PANEL}>
        {/* word */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <span className={`${LABEL} shrink-0`}>Word</span>
          <input
            value={word}
            onChange={(e) => setWord(e.target.value)}
            placeholder="type a word"
            maxLength={14}
            className="h-8 min-w-0 flex-1 rounded-lg border border-[var(--border-line)] bg-[var(--bg-page)] px-3 text-[12px] text-[var(--text-primary)] outline-none transition-colors duration-150 ease-[var(--ease-out)] placeholder:text-[var(--text-tertiary)] hover:border-[var(--border-ring)] focus:border-[var(--border-ring)] sm:ml-auto sm:w-[180px] sm:flex-none"
          />
        </div>

        {/* two columns: Glow | Colours */}
        <div className="grid grid-cols-1 items-start gap-x-6 gap-y-5 sm:grid-cols-2">
          <div className="flex flex-col gap-3 self-start">
            <span className={LABEL}>Glow</span>
            <Slider label="Bloom" value={params.bloom} min={0.4} max={2} step={0.01}
              format={(v) => v.toFixed(2)} onChange={(v) => patch({ bloom: v })} />
            <Slider label="Split" value={params.split} min={0} max={20} step={0.5}
              format={(v) => `${v.toFixed(1)}px`} onChange={(v) => patch({ split: v })} />
            <Slider label="Core" value={params.core} min={0} max={1.4} step={0.01}
              format={(v) => v.toFixed(2)} onChange={(v) => patch({ core: v })} />
            <Slider label="Spectral" value={params.spectral} min={0} max={1} step={0.01}
              format={(v) => v.toFixed(2)} onChange={(v) => patch({ spectral: v })} />
            <Slider label="Grain" value={params.noise} min={0} max={0.4} step={0.01}
              format={(v) => v.toFixed(2)} onChange={(v) => patch({ noise: v })} />
          </div>

          <div className="flex flex-col gap-3">
            <span className={LABEL}>Colours</span>
            <ColorControl label="Warm" value={toHex(params.warm)}
              onChange={(hex) => patch({ warm: fromHex(hex) })} />
            <ColorControl label="Cool" value={toHex(params.cool)}
              onChange={(hex) => patch({ cool: fromHex(hex) })} />
            <ColorControl label="Fringe" value={toHex(params.red)}
              onChange={(hex) => patch({ red: fromHex(hex) })} />
            <ColorControl label="Background" value={toHex(params.bg)}
              onChange={(hex) => patch({ bg: fromHex(hex) })} />
          </div>
        </div>
      </div>
    </div>
  );
}

```


12. You are given the complete source for a self-contained web visual: "Ransom note".

What it is:
- I always liked the ransom-note look, where every letter is torn from a different magazine and taped down crooked. So I took a set of real cut-out letters and made it into something you can type with.
- Each character picks a random paper scrap from the set, then gets a small random tilt, bounce and size so the line reads like it was assembled by hand, not typed. Type your own note below, tune how messy it is, and re-roll to shuffle the scraps.

How to use this code:
- It is a React + TypeScript component tree (Next.js App Router) that renders to an HTML canvas; the entry point is the playground component.
- Drop the files into a project under the same relative paths, mount the playground component, and it runs as-is. No external assets beyond what's inline.
- To adapt it: change the resolved word/logo, the color controls, or the experiment parameters. Ask me to modify, explain, or port any part.
- Original inspiration: https://resourceboy.com/

The full source follows, one file per block:

### ransom/manifest.ts

```ts
// Ransom-note cutout manifest + per-character picker. The sprites are real torn/cut-out
// magazine letters (Resource Boy "Ransom Note Letters" pack, royalty-free), trimmed to
// their alpha bbox and downscaled to ~220px tall WebP. Each key (a character) maps to a
// handful of variants; composing a word means picking one cutout per character and
// jittering it a little so it reads like a hand-assembled ransom note.

import { mediaUrl } from "../../lib/video-sources";
import manifestJson from "../../../public/vault/ransom/manifest.json";

export type Variant = { file: string; w: number; h: number };
export type Manifest = Record<string, Variant[]>;

export const RANSOM: Manifest = manifestJson as Manifest;

// where the sprites are served from (R2 in prod, /public in dev)
export const RANSOM_BASE = "/vault/ransom/";
export function spriteUrl(file: string): string {
  return mediaUrl(`${RANSOM_BASE}${file}`);
}

// Characters we have cutouts for. Everything else (space, unknown) is rendered as a gap.
export function hasGlyph(ch: string): boolean {
  return RANSOM[ch] !== undefined;
}

// A small deterministic PRNG (mulberry32) so a given seed reproduces the same note — the
// hero holds a stable composition per phrase, and "Re-roll" just bumps the seed.
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// hash a string to a stable 32-bit seed (so the same phrase defaults to the same note)
export function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export type Placed = {
  kind: "glyph" | "space";
  ch: string;
  variant?: Variant;
  rot: number;      // deg tilt
  dy: number;       // baseline offset, in em of the line height
  scale: number;    // per-letter scale multiplier
  mx: number;       // extra horizontal gap after (em)
  depth: number;    // 0..1 parallax depth (seeded) — far scraps lean less toward the cursor
};

export type JitterConfig = {
  rot: number;    // max |tilt| in deg
  dy: number;     // max baseline bounce (em)
  scale: number;  // scale variance (0.1 => 0.9..1.1)
  gap: number;    // max extra gap between letters (em)
};

export const DEFAULT_JITTER: JitterConfig = {
  rot: 8,     // lively but readable
  dy: 0.06,
  scale: 0.12,
  gap: 0.05,
};

// All cutout variants available for a given character (via its manifest key), or [] if none.
// Used by click-to-swap so a scrap can flip to a *different* scrap of the same letter.
export function variantsFor(ch: string): Variant[] {
  const key = keyFor(ch);
  return key ? RANSOM[key] : [];
}

// Resolve a character to a manifest key. Uppercase/lowercase share a folder in the pack
// (variants already mix cases), so we upcase letters; a few symbols map to shared keys.
function keyFor(ch: string): string | null {
  if (ch === " ") return null;
  const up = ch.toUpperCase();
  if (RANSOM[up]) return up;
  if (RANSOM[ch]) return ch;
  if (ch === "(" || ch === ")") return RANSOM["()"] ? "()" : null;
  if (ch === "." && RANSOM[","]) return null; // no period cutout; render as a small gap
  return null;
}

// Natural rendered width of a composed line at a given letter height (px). Mirrors the
// layout in RansomLine (per-letter width = aspect*scale*lineH, spaces = 0.32em, a small
// inter-item gap of 0.04em, plus each glyph's extra mx gap). Used to fit a line to one row.
export function lineWidth(placed: Placed[], lineH: number): number {
  let w = 0;
  const gap = lineH * 0.04;
  placed.forEach((p, i) => {
    if (i > 0) w += gap;
    if (p.kind === "space") {
      w += lineH * 0.32;
      return;
    }
    const v = p.variant!;
    w += (v.w / v.h) * (lineH * p.scale) + p.mx * lineH;
  });
  return w;
}

// Compose a line of text into placed cutouts using a seed. Deterministic for (text, seed).
export function composeLine(
  text: string,
  seed: number,
  jitter: JitterConfig = DEFAULT_JITTER,
): Placed[] {
  const rnd = mulberry32(seed);
  const out: Placed[] = [];
  for (const ch of text) {
    const key = keyFor(ch);
    if (!key) {
      out.push({ kind: "space", ch, rot: 0, dy: 0, scale: 1, mx: 0, depth: 0 });
      continue;
    }
    const variants = RANSOM[key];
    const v = variants[Math.floor(rnd() * variants.length)];
    out.push({
      kind: "glyph",
      ch,
      variant: v,
      rot: (rnd() * 2 - 1) * jitter.rot,
      dy: (rnd() * 2 - 1) * jitter.dy,
      scale: 1 + (rnd() * 2 - 1) * jitter.scale,
      mx: rnd() * jitter.gap,
      // seeded parallax depth: 0.35..1. Near scraps (→1) lean most toward the cursor,
      // far ones barely move, so the taped collage gets real depth on hover.
      depth: 0.35 + rnd() * 0.65,
    });
  }
  return out;
}

```

### ransom/RansomLine.tsx

```tsx
"use client";

// Renders one composed line of ransom-note cutouts. Each glyph is an <img> of a real
// torn-paper letter, sized to a shared line height (width follows the sprite's aspect),
// tilted / baseline-bounced / scaled per the composition. Spaces become a gap.
//
// Appear vocabulary is "slam & settle": a scrap punches in slightly too big with extra
// tilt and overshoots flat, like it's being pressed / taped onto the page (scale + rotate,
// no vertical drop). `direction` lets the same line animate OUT (fade + shrink) so the card
// can crossfade one phrase into the next with no blank gap.
//
// Each scrap also carries a per-letter parallax `depth` (data-depth) + its resting rotation
// (data-rot) so a cursor engine can lean the whole collage toward the pointer.

import { type CSSProperties, useEffect, useRef, useState } from "react";
import { spriteUrl, variantsFor, type Placed, type Variant } from "./manifest";
import { hapticTap } from "../../lib/haptics";

// Back-out overshoot: scrap springs past its size then settles flat — the "tape-down" snap.
const SLAM_EASE = "cubic-bezier(.34,1.56,.64,1)";
// A calm ease-OUT for the box-width glide. The slam ease overshoots, which on `width` shoved
// neighbors wider-then-back; width should settle monotonically so the row never jitters.
const WIDTH_EASE = "cubic-bezier(.22,.61,.36,1)";
// Switch (phrase→phrase) vertical-pass motion: a soft rise + un-blur in, a quick lift-blur out.
const RISE_EASE = "cubic-bezier(.16,1,.3,1)"; // expo-out — fast start, long glide, no overshoot
const IN_MS = 460; // per-scrap rise-in duration (slower than a slam → smoother, feathered)
const OUT_MS = 240; // lift-blur-out duration (whole line together)
const STAGGER_MS = 26; // left-to-right cascade step on the rise-in
const SWAP_MS = 260; // click-swap flip duration

export function RansomLine({
  placed,
  lineH,
  revealed = true,
  direction = "in",
  staggerStart = 0,
  nowrap = false,
  className = "",
}: {
  placed: Placed[];
  /** cap height of a letter in px (the sprites are 220px tall; width scales to aspect) */
  lineH: number;
  /** when false, letters sit hidden (for an entrance animation) */
  revealed?: boolean;
  /** "in" = slam/settle to rest; "out" = fade + shrink away (for the crossfade) */
  direction?: "in" | "out";
  /** index offset so multiple lines can stagger continuously */
  staggerStart?: number;
  /** keep the whole line on one row (no wrapping) — the caller sizes it to fit */
  nowrap?: boolean;
  className?: string;
}) {
  let gi = staggerStart;
  return (
    <div
      className={`flex items-center justify-center ${nowrap ? "flex-nowrap" : "flex-wrap"} ${className}`}
      style={{ gap: `${lineH * 0.04}px` }}
    >
      {placed.map((p, i) => {
        if (p.kind === "space") {
          return <span key={i} style={{ width: `${lineH * 0.32}px` }} aria-hidden />;
        }
        return (
          <Scrap key={i} p={p} lineH={lineH} revealed={revealed} direction={direction} idx={gi++} />
        );
      })}
    </div>
  );
}

// One cutout letter. Owns two things beyond rendering:
//  • the entrance/exit slam (inner <img> transform, staggered per idx),
//  • click-to-swap — clicking flips the scrap to a DIFFERENT variant of the same character
//    with a quick spin/scale flip (old image flips out, new one slams in over it).
// The outer <span> is the parallax lean layer the cursor engine writes --px/--py/--pr/--ps to.
function Scrap({
  p,
  lineH,
  revealed,
  direction,
  idx,
}: {
  p: Placed;
  lineH: number;
  revealed: boolean;
  direction: "in" | "out";
  idx: number;
}) {
  // A click-chosen override variant, or null to show the composed one. Derived (no effect):
  // when the composition changes (re-roll / phrase switch), p.variant changes identity and
  // the override is dropped so the fresh cutout shows.
  const [override, setOverride] = useState<{ base: Variant; picked: Variant } | null>(null);
  const variant = override && override.base === p.variant ? override.picked : p.variant!;
  // During a swap: `incoming` = the new width target (box glides to it); `outgoing` = the OLD
  // cutout, rendered as an overlay that flips OUT on top of the already-promoted base.
  const [incoming, setIncoming] = useState<Variant | null>(null);
  const [outgoing, setOutgoing] = useState<Variant | null>(null);
  const swapTimer = useRef<number | null>(null);
  useEffect(() => () => {
    if (swapTimer.current) window.clearTimeout(swapTimer.current);
  }, []);

  const h = lineH * p.scale;
  const aspect = (vr: Variant) => (vr.w / vr.h) * h;
  const w = aspect(variant); // width of the currently-shown variant
  // While swapping, the box targets the INCOMING variant's width immediately (on click), so
  // it glides to the real size right away and neighbors slide along with it — no end-of-swap
  // jump. The two images inside keep their own true widths so neither distorts mid-animation.
  const boxW = incoming ? aspect(incoming) : w;

  const baseY = (p.dy * lineH).toFixed(2);
  const leanTransform = `translate(var(--px, 0px), calc(${baseY}px + var(--py, 0px))) rotate(var(--pr, 0deg)) scale(var(--ps, 1))`;
  const restInner = `translateY(0px) rotate(${p.rot}deg) scale(1)`;
  // Switch vocabulary — a soft VERTICAL PASS with a feathered blur (the note re-assembling):
  //   • in  → the scrap rises from just below, un-blurs and settles (staggered L→R);
  //   • out → the scrap lifts up, blurs and fades away (peeled off the board).
  const RISE = Math.max(10, lineH * 0.18);
  const hiddenInner =
    direction === "in"
      ? `translateY(${RISE.toFixed(1)}px) rotate(${(p.rot * 1.25).toFixed(2)}deg) scale(0.96)`
      : `translateY(${(-RISE * 0.8).toFixed(1)}px) rotate(${(p.rot * 0.8).toFixed(2)}deg) scale(0.98)`;
  // drop-shadow is constant (the paper contact); the blur is what animates on the switch.
  const SHADOW = "drop-shadow(0 2px 3px rgba(20,20,25,0.16)) drop-shadow(0 6px 10px rgba(20,20,30,0.10))";
  const blurAmt = revealed ? 0 : direction === "in" ? 3.5 : 5;

  const swap = () => {
    if (incoming) return; // already mid-swap
    const all = variantsFor(p.ch);
    const others = all.filter((v) => v.file !== variant.file);
    if (!others.length) return; // only one cutout for this letter — nothing to swap to
    hapticTap();
    const next = others[Math.floor(Math.random() * others.length)];
    // Promote immediately: the BASE image now shows `next` (fully opaque, at rest), and the
    // OLD variant becomes a transient overlay that flips OUT on top of it. So when the overlay
    // is removed at the end, the base is already the final letter — no empty blink frame.
    setOverride({ base: p.variant!, picked: next });
    setOutgoing(variant); // the letter we're leaving, flips out over the new base
    setIncoming(next); // (kept for the box-width target)
    swapTimer.current = window.setTimeout(() => {
      setOutgoing(null);
      setIncoming(null);
    }, SWAP_MS);
  };

  const outerStyle: CSSProperties = {
    transform: leanTransform,
    // No CSS transition here: the magnetism/drag/breathe hook eases every value per frame in
    // JS, so a CSS transition on top would just add lag and fight the spring. When the hook is
    // inactive (reduced-motion / touch) the vars stay 0 and this is a plain static transform.
    willChange: "transform",
    marginRight: `${p.mx * lineH}px`,
    lineHeight: 0,
    cursor: "grab",
    touchAction: "none", // let the scrap own drag gestures (no scroll hijack fighting)
  };
  const wrapStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    width: `${boxW}px`,
    height: `${h}px`,
    transformOrigin: "center center",
    transform: revealed ? restInner : hiddenInner,
    opacity: revealed ? 1 : 0,
    transition:
      direction === "in"
        ? // rise + un-blur + fade in, per-letter staggered L→R on a smooth ease-out.
          `transform ${IN_MS}ms ${RISE_EASE} ${idx * STAGGER_MS}ms, opacity ${Math.round(IN_MS * 0.7)}ms ease ${idx * STAGGER_MS}ms, filter ${IN_MS}ms ease ${idx * STAGGER_MS}ms, width ${SWAP_MS}ms ${WIDTH_EASE}`
        : // lift + blur + fade out, quick, all letters together (no cascade) so it clears fast.
          `transform ${OUT_MS}ms cubic-bezier(.4,0,.7,1), opacity ${OUT_MS}ms ease, filter ${OUT_MS}ms ease, width ${SWAP_MS}ms ${WIDTH_EASE}`,
    filter: `${SHADOW} blur(${blurAmt}px)`,
    willChange: "transform, opacity, filter, width",
  };

  // Each image keeps its OWN true aspect width (centered in the box) so the animating box
  // width never stretches/distorts a scrap. Both are absolute + centered so they overlap.
  const imgBase = (vr: Variant): CSSProperties => ({
    position: "absolute",
    top: "50%",
    left: "50%",
    width: `${aspect(vr)}px`,
    height: `${h}px`,
    transition: `transform ${SWAP_MS}ms ${SLAM_EASE}, opacity ${SWAP_MS}ms ease`,
  });

  return (
    <span
      style={outerStyle}
      data-depth={p.depth ?? 0.5}
      onPointerDown={(e) => {
        // don't begin a native text selection / image drag when grabbing a scrap
        e.preventDefault();
      }}
      onClick={(e) => {
        // a real drag sets data-dragging on this element (see use-magnetism); a click that
        // follows a drag should NOT swap — only a genuine tap does.
        if (e.currentTarget.dataset.dragging) return;
        swap();
      }}
    >
      <span style={wrapStyle}>
        {/* BASE: always the shown variant, fully at rest. During a swap it's already the NEW
            cutout underneath, so removing the overlay reveals it with no empty frame. */}
        <img
          src={spriteUrl(variant.file)}
          alt={p.ch}
          draggable={false}
          decoding="async"
          className="select-none"
          style={{
            ...imgBase(variant),
            transform: "translate(-50%,-50%)",
            // during a swap the new letter slams in via the overlay, so keep the base itself
            // steady (no reverse transition = no blink); at rest it's just the letter.
            transition: "none",
          }}
        />
        {/* OVERLAY: the OLD cutout, flipping OUT on top of the already-swapped base (spin +
            shrink + fade). When it finishes and unmounts, the new base is simply revealed. */}
        {outgoing && (
          <img
            src={spriteUrl(outgoing.file)}
            alt=""
            aria-hidden
            draggable={false}
            decoding="async"
            className="select-none"
            style={{
              ...imgBase(outgoing),
              animation: `ransom-swap-out ${SWAP_MS}ms ${SLAM_EASE} both`,
            }}
          />
        )}
      </span>
    </span>
  );
}

// A RansomLine that manages its OWN entrance: mounts hidden, then slams in on the next
// frame. Remount it (change its `key`) to replay the slam — used by the playground's
// Re-roll / live edits so a fresh composition punches back in with no shared reveal state.
export function SlammingLine(props: Omit<Parameters<typeof RansomLine>[0], "revealed">) {
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    const r = requestAnimationFrame(() => setRevealed(true));
    return () => cancelAnimationFrame(r);
  }, []);
  return <RansomLine {...props} revealed={revealed} />;
}

```

### ransom/RansomNoteCard.tsx

```tsx
"use client";

// A live, display-only Vault card: short phrases assembled as a ransom note out of real
// torn-paper cutout letters. Each phrase SLAMS in letter-by-letter (scale + tilt overshoot,
// like it's taped down), holds, then CROSSFADES straight into the next — the outgoing line
// shrinks/fades out while the incoming line is already slamming in over it, so there's no
// blank gap. Moving the cursor magnetizes each scrap toward the pointer by its own proximity
// (near letters lean + lift, far ones stay put). Pauses when offscreen / hidden.

import { useEffect, useMemo, useRef, useState } from "react";
import { RansomLine } from "./RansomLine";
import { useMagnetism } from "./use-magnetism";
import { composeLine, hashSeed, lineWidth, DEFAULT_JITTER, type Placed } from "./manifest";

// kept short so they compose cleanly on one card and stay readable
const PHRASES = ["stay weird", "make stuff", "be kind", "trust me", "keep going", "no rules"];

// cycle timing
const REVEAL_HOLD = 1800; // ms held fully revealed (quicker resting state)
const CROSS_OVERLAP = 150; // ms after the old line lifts off before the new one rises in
const OUT_MS = 260; // how long the outgoing line stays mounted while it lifts + blurs away

type Slot = { key: number; phraseIdx: number; placed: Placed[]; direction: "in" | "out"; revealed: boolean };

export function RansomNoteCard({
  bare = false,
  viewTransitionName,
}: {
  bare?: boolean;
  viewTransitionName?: string;
} = {}) {
  void bare;
  const hostRef = useRef<HTMLDivElement>(null);
  const [avail, setAvail] = useState(900);

  // The card renders 1 or 2 stacked lines: the current one (slamming in / resting) and,
  // briefly during a switch, the outgoing one (fading out underneath). A monotonic key
  // guarantees React remounts each line so its enter transition re-fires. The counter lives
  // in a ref and is only ever bumped inside effects/handlers (never during render).
  const seq = useRef(1);
  const makeSlot = (phraseIdx: number): Slot => ({
    key: seq.current++,
    phraseIdx,
    placed: composeLine(PHRASES[phraseIdx].toUpperCase(), hashSeed(PHRASES[phraseIdx]), DEFAULT_JITTER),
    direction: "in",
    revealed: false,
  });
  // Initial slot built without touching the ref (key 0), so nothing is read during render.
  const [slots, setSlots] = useState<Slot[]>(() => [
    {
      key: 0,
      phraseIdx: 0,
      placed: composeLine(PHRASES[0].toUpperCase(), hashSeed(PHRASES[0]), DEFAULT_JITTER),
      direction: "in",
      revealed: false,
    },
  ]);

  // fit the CURRENT phrase to ONE row: comfortable target height, scaled down if it would
  // overflow the card's usable width (padding leaves ~86% for the letters). The outgoing
  // line reuses this height (it's leaving, exact fit doesn't matter).
  const current = slots[slots.length - 1];
  const lineH = useMemo(() => {
    const usable = avail * 0.86;
    const target = Math.max(34, Math.min(80, Math.round(avail * 0.062)));
    const natural = lineWidth(current.placed, target);
    return natural > usable ? Math.max(30, Math.floor((target * usable) / natural)) : target;
  }, [current.placed, avail]);

  // ── cycle: slam in → hold → crossfade to next ──────────────────────────────
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const ro = new ResizeObserver(() => setAvail(host.clientWidth));
    ro.observe(host);

    if (reduced) {
      // static: just show the current phrase revealed, no cycling. Deferred a frame so it
      // isn't a synchronous set in the effect body (avoids a cascading render).
      const raf = requestAnimationFrame(() =>
        setSlots((s) => [{ ...s[s.length - 1], revealed: true }]),
      );
      return () => {
        cancelAnimationFrame(raf);
        ro.disconnect();
      };
    }

    let onScreen = false;
    let hidden = false;
    let hovering = false; // freeze the phrase while the cursor is on the card
    let running = false;
    const timers = new Set<number>();
    const after = (fn: () => void, ms: number) => {
      const id = window.setTimeout(() => {
        timers.delete(id);
        fn();
      }, ms);
      timers.add(id);
      return id;
    };
    const clearTimers = () => {
      for (const id of timers) window.clearTimeout(id);
      timers.clear();
    };

    const revealCurrent = () => {
      // flip the just-mounted line to revealed so it slams in.
      setSlots((s) => s.map((sl, i) => (i === s.length - 1 ? { ...sl, revealed: true } : sl)));
    };

    const toNext = () => {
      if (!running) return;
      setSlots((s) => {
        const cur = s[s.length - 1];
        const nextIdx = (cur.phraseIdx + 1) % PHRASES.length;
        // mark current as leaving (out), add the next as an incoming hidden line on top.
        const leaving: Slot = { ...cur, direction: "out", revealed: false };
        const incoming = makeSlot(nextIdx);
        return [leaving, incoming];
      });
      // drop the outgoing line once it's faded, and slam the incoming one in.
      after(() => setSlots((s) => s.slice(-1)), OUT_MS);
      after(revealCurrent, CROSS_OVERLAP);
      // schedule the next switch.
      after(toNext, CROSS_OVERLAP + REVEAL_HOLD);
    };

    const start = () => {
      if (running) return;
      running = true;
      // reveal whatever's current, then begin the loop.
      revealCurrent();
      after(toNext, REVEAL_HOLD);
    };
    const stop = () => {
      running = false;
      clearTimers();
    };
    // Freeze the auto-cycle while hovering, so a phrase never switches out from under the
    // cursor mid-interaction (the letters you're leaning / dragging stay put). Because a
    // switch only ever fires from a queued timer, stopping before it fires leaves the current
    // phrase fully settled; leaving resumes the loop and the next switch happens then.
    const sync = () => (onScreen && !hidden && !hovering ? start() : stop());

    const io = new IntersectionObserver(
      (es) => {
        onScreen = es[0]?.isIntersecting ?? false;
        sync();
      },
      { threshold: 0.2 },
    );
    io.observe(host);
    const onVis = () => {
      hidden = document.hidden;
      sync();
    };
    document.addEventListener("visibilitychange", onVis);

    // pause on hover, resume on leave (pointer devices only — a touch has no lingering hover)
    const canHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const onEnter = () => {
      hovering = true;
      sync();
      // if a crossfade was mid-flight when the pointer arrived, collapse to a single clean,
      // fully-revealed line so it freezes tidily (no half-faded outgoing scrap left behind).
      setSlots((s) => {
        if (s.length === 1 && s[0].revealed && s[0].direction === "in") return s;
        const cur = s[s.length - 1];
        return [{ ...cur, direction: "in", revealed: true }];
      });
    };
    const onLeave = () => {
      hovering = false;
      sync();
    };
    if (canHover) {
      host.addEventListener("pointerenter", onEnter);
      host.addEventListener("pointerleave", onLeave);
    }

    return () => {
      stop();
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      host.removeEventListener("pointerenter", onEnter);
      host.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  // cursor magnetism: each scrap reacts to the pointer's proximity to ITSELF (near letters
  // lean toward it + lift, far ones stay put) — a per-letter field, not a flat card tilt.
  useMagnetism(hostRef);

  return (
    <div
      ref={hostRef}
      data-canvas-card
      aria-label="Short phrases spelled out as a ransom note from torn-paper cutout letters, revealing one letter at a time."
      style={viewTransitionName ? { viewTransitionName } : undefined}
      className="relative mx-auto flex aspect-[1344/620] w-full select-none items-center justify-center overflow-hidden rounded-[12px] border border-[var(--border-line)] bg-[var(--bg-page)] px-10 sm:px-16"
    >
      {/* Stacked lines: outgoing (leaving) sits under the incoming during a crossfade.
          Absolute so both occupy the same centered box; the current one is last. */}
      {slots.map((sl) => (
        <div key={sl.key} className="absolute inset-0 flex items-center justify-center px-10 sm:px-16">
          <RansomLine
            placed={sl.placed}
            lineH={lineH}
            revealed={sl.revealed}
            direction={sl.direction}
            nowrap
          />
        </div>
      ))}
    </div>
  );
}

```

### ransom/playground.tsx

```tsx
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

```


13. You are given the complete source for a self-contained web visual: "Apple's corners".

What it is:
- A normal rounded corner has a tiny kink where it meets the flat edge. You feel it before you can name it. Apple fixes this with a squircle, a corner that eases in smooth. Here is the real one on a live button you can play with.

How to use this code:
- It is a React + TypeScript component tree (Next.js App Router) that renders to an HTML canvas; the entry point is the playground component.
- Drop the files into a project under the same relative paths, mount the playground component, and it runs as-is. No external assets beyond what's inline.
- To adapt it: change the resolved word/logo, the color controls, or the experiment parameters. Ask me to modify, explain, or port any part.
- Original inspiration: https://www.figma.com/blog/desperately-seeking-squircles/

The full source follows, one file per block:

### squircle/superellipse.ts

```ts
// Squircle path generator. A border-radius is one circular arc per corner, and
// the arc meets the straight edge at a hard tangent, so curvature jumps 0→max in
// one step. A squircle is the superellipse |x|ⁿ+|y|ⁿ=1, where curvature ramps in
// continuously and the corner flows into the edge with no kink. We emit it as an
// SVG path and apply it with `clip-path: path(...)`.

export interface SquircleOptions {
  width: number;
  height: number;
  /** Corner radius in px (clamped to half the shorter side). */
  radius: number;
  /** Corner extent along the edge (0..1). 1 = full corner, ~0.6 is a common look. */
  smoothing: number;
  /** Superellipse exponent n: 2 = circle, ~5 = classic squircle, higher = boxier. */
  exponent?: number;
}

const DEFAULT_EXPONENT = 5;

const n = (v: number) => v.toFixed(4);

// A three-cubic-bézier fit of one superellipse corner at the default exponent, on
// a unit box: it starts at the top edge (0,0), ends at the side edge (1,1), and is
// symmetric across the (1,0)-(0,1) diagonal. Each row is [control1, control2, end];
// segment 0 starts at (0,0), each next segment starts where the previous ended.
const CORNER: readonly [number, number][][] = [
  [ [0.3, 0],       [0.473, 0],     [0.619, 0.039] ],
  [ [0.804, 0.088], [0.912, 0.196], [0.961, 0.381] ],
  [ [1, 0.527],     [1, 0.7],       [1, 1] ],
];

// rotate a unit-corner point 90°·k clockwise (k = 0 top-right … 3 top-left)
function rot90([x, y]: [number, number], k: number): [number, number] {
  switch (((k % 4) + 4) % 4) {
    case 1: return [y, -x];
    case 2: return [-x, -y];
    case 3: return [-y, x];
    default: return [x, y];
  }
}

// The three cubic segments for one corner, scaled by `radius`, placed at `start`
// (where the straight edge meets the corner) and rotated by k.
function cornerCubics(sx: number, sy: number, radius: number, k: number): string {
  const put = (p: [number, number]) => {
    const [rx, ry] = rot90(p, k);
    return `${n(sx + rx * radius)} ${n(sy + ry * radius)}`;
  };
  return CORNER.map(([c1, c2, end]) => `C ${put(c1)} ${put(c2)} ${put(end)}`).join(" ");
}

// For any other exponent, sample the superellipse arc directly. In unit-corner
// coords the top-right quarter of |x|ⁿ+|y|ⁿ=1 is x = sin(θ)^(2/n),
// y = 1 - cos(θ)^(2/n) for θ ∈ [0, π/2]; 32 line segments read as smooth.
function cornerSampled(sx: number, sy: number, radius: number, k: number, exponent: number): string {
  const STEPS = 32;
  const e = 2 / exponent;
  const pts: string[] = [];
  for (let i = 1; i <= STEPS; i++) {
    const t = (i / STEPS) * (Math.PI / 2);
    const ux = Math.pow(Math.sin(t), e);
    const uy = 1 - Math.pow(Math.cos(t), e);
    const [rx, ry] = rot90([ux, uy], k);
    pts.push(`L ${n(sx + rx * radius)} ${n(sy + ry * radius)}`);
  }
  return pts.join(" ");
}

// Closed SVG path for a squircle-cornered rectangle. `smoothing` scales how far
// the corner reaches along each edge; `exponent` sets its squareness.
export function squirclePath({ width, height, radius, smoothing, exponent = DEFAULT_EXPONENT }: SquircleOptions): string {
  const budget = Math.min(width, height) / 2;
  const s = Math.max(0, Math.min(1, smoothing));
  const r = Math.max(0, Math.min(radius, budget)) * (0.4 + 0.6 * s);

  if (r <= 0) {
    return `M 0 0 L ${n(width)} 0 L ${n(width)} ${n(height)} L 0 ${n(height)} Z`;
  }

  // The bézier fit is exact at the default exponent; sample for anything else.
  const useBezier = Math.abs(exponent - DEFAULT_EXPONENT) < 0.05;
  const corner = (sx: number, sy: number, k: number) =>
    useBezier ? cornerCubics(sx, sy, r, k) : cornerSampled(sx, sy, r, k, exponent);

  return [
    `M ${n(r)} 0`,
    `L ${n(width - r)} 0`,
    corner(width - r, 0, 0),
    `L ${n(width)} ${n(height - r)}`,
    corner(width, height - r, 3),
    `L ${n(r)} ${n(height)}`,
    corner(r, height, 2),
    `L 0 ${n(r)}`,
    corner(0, r, 1),
    "Z",
  ].join(" ");
}

// The plain border-radius path for the same box (one arc per corner), drawn as a
// dashed reference in compare mode.
export function roundRectPath(w: number, h: number, r: number): string {
  const rr = Math.max(0, Math.min(r, Math.min(w, h) / 2));
  return `M ${rr} 0 L ${w - rr} 0 A ${rr} ${rr} 0 0 1 ${w} ${rr} L ${w} ${h - rr} A ${rr} ${rr} 0 0 1 ${w - rr} ${h} L ${rr} ${h} A ${rr} ${rr} 0 0 1 0 ${h - rr} L 0 ${rr} A ${rr} ${rr} 0 0 1 ${rr} 0 Z`;
}

// Pick the shape path: a plain border-radius when `plain` is set, else the
// squircle. Used so the "Compare" toggle can swap every component to a plain
// rounded rect in one place.
export function shapePath(o: SquircleOptions & { plain?: boolean }): string {
  return o.plain
    ? roundRectPath(o.width, o.height, o.radius)
    : squirclePath(o);
}

// Native one-liner (Chromium-only for now; falls back to plain border-radius).
export function nativeCornerShape(radius: number): { borderRadius: string; cornerShape: string } {
  return { borderRadius: `${radius}px`, cornerShape: "squircle" };
}

```

### squircle/tokens.ts

```ts
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

```

### squircle/Squircle.tsx

```tsx
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

```

### squircle/parts.tsx

```tsx
"use client";

// Squircle demo components, all sharing one glossy neutral surface.
//
// GlossySquircle is a deep stack of ~18 very low-opacity greyscale layers, each
// clipped to the squircle so it follows the corner:
//   surface: porcelain gradient · corner vignette · centre glow · fine grain ·
//            brushed streaks · diagonal light sweep · middle sheen band
//   light:   side edge-lights · top sheen · glass rim · bottom counter-sheen ·
//            light lift · grounding shadow
//   edge:    tri-stop bevel border · inner shadow wall · fresnel edge-brighten ·
//            ambient-occlusion ring · corner glints · double outer hairline
// The button, chat bubbles and segmented control are all built on it, so they read
// as one material.

import { useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Squircle } from "./Squircle";
import { shapePath } from "./superellipse";
import { CONTROL_H, CONTROL_H_SM, radiusFor, TEXT, TRACKING } from "./tokens";

interface Shape {
  radius: number;
  smoothing: number;
  /** Superellipse exponent (squareness): 2=circle, 5=squircle, higher=boxier. */
  exponent?: number;
  compare?: boolean;
}

// The glossy neutral surface. Pass a fixed size (w/h in px) OR omit them to size to
// content — it measures its own box and clips every gloss layer to the exact
// squircle of that size. Give it the corner params + content.
function GlossySquircle({
  w,
  h,
  radius,
  smoothing,
  exponent,
  compare,
  children,
  className = "",
  contentClassName,
  interactive = true,
}: Shape & {
  w?: number;
  h?: number;
  children?: ReactNode;
  className?: string;
  contentClassName?: string;
  /** press feedback (scale + shimmer). Off for passive surfaces like AI bubbles. */
  interactive?: boolean;
}) {
  const auto = w === undefined || h === undefined;
  const measureRef = useRef<HTMLSpanElement>(null);
  const [size, setSize] = useState({ w: w ?? 0, h: h ?? 0 });
  useLayoutEffect(() => {
    if (!auto) return;
    const el = measureRef.current;
    if (!el) return;
    const m = () => setSize((p) =>
      p.w === el.offsetWidth && p.h === el.offsetHeight ? p : { w: el.offsetWidth, h: el.offsetHeight });
    m();
    const ro = new ResizeObserver(m);
    ro.observe(el);
    return () => ro.disconnect();
  }, [auto]);

  const cw = auto ? size.w : (w as number);
  const ch = auto ? size.h : (h as number);
  const clip = cw && ch ? `path("${shapePath({ width: cw, height: ch, radius, smoothing, exponent, plain: compare })}")` : "none";
  const layer = (style: CSSProperties) => (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-0"
      style={{ clipPath: clip, WebkitClipPath: clip, ...style }}
    />
  );

  // double outer hairline only (faint dark contact ring, near-white cut), no shadow
  const HAIRLINE =
    "drop-shadow(0 0 0.5px rgba(0,0,0,0.18)) drop-shadow(0 0.5px 0.5px rgba(255,255,255,0.9))";
  const press = interactive
    ? "active:scale-[0.97] active:brightness-[1.04] transition-[transform,filter] duration-150"
    : "";

  const gloss = (
    <>
      {/* corner vignette */}
      {layer({ background: "radial-gradient(120% 130% at 50% 50%, rgba(0,0,0,0) 62%, rgba(0,0,0,0.045) 100%)" })}
      {/* centre glow */}
      {layer({ background: "radial-gradient(70% 120% at 50% 45%, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0) 70%)" })}
      {/* fine grain */}
      {layer({
        opacity: 0.05,
        mixBlendMode: "overlay",
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
      })}
      {/* brushed streaks */}
      {layer({
        opacity: 0.5,
        mixBlendMode: "overlay",
        backgroundImage:
          "repeating-linear-gradient(90deg, rgba(255,255,255,0.06) 0px, rgba(0,0,0,0.03) 1px, rgba(255,255,255,0.06) 2px)",
      })}
      {/* diagonal light sweep */}
      {layer({
        mixBlendMode: "screen",
        background: "linear-gradient(115deg, rgba(255,255,255,0) 30%, rgba(255,255,255,0.28) 46%, rgba(255,255,255,0) 60%)",
      })}
      {/* middle sheen band */}
      {layer({
        background: "linear-gradient(180deg, rgba(255,255,255,0) 34%, rgba(255,255,255,0.5) 50%, rgba(255,255,255,0) 66%)",
        opacity: 0.45,
      })}
      {/* side edge-lights */}
      {layer({
        background: "linear-gradient(90deg, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0) 8%, rgba(255,255,255,0) 92%, rgba(255,255,255,0.5) 100%)",
        opacity: 0.5,
      })}
      {/* top sheen */}
      {layer({ background: "radial-gradient(78% 82% at 50% -34%, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0.28) 42%, rgba(255,255,255,0) 72%)" })}
      {/* glass rim */}
      {layer({ boxShadow: "inset 0 2px 0 -1px rgba(255,255,255,0.85)" })}
      {/* bottom counter-sheen */}
      {layer({ mixBlendMode: "screen", background: "radial-gradient(90% 60% at 50% 118%, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0) 60%)" })}
      {/* light lift along the bottom */}
      {layer({ mixBlendMode: "screen", boxShadow: "inset 0 -15px 2px -12px rgba(255,255,255,0.25)" })}
      {/* grounding shadow along the bottom */}
      {layer({ mixBlendMode: "color-burn", boxShadow: "inset 0 -6px 5px -2px #d2d2d2" })}
      {/* inner shadow wall */}
      {layer({ boxShadow: "inset 0 0 0 0.5px rgba(0,0,0,0.06)" })}
      {/* fresnel edge-brighten */}
      {layer({ mixBlendMode: "screen", boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.28)" })}
      {/* ambient occlusion ring */}
      {layer({ boxShadow: "inset 0 0 6px 0 rgba(0,0,0,0.05)" })}
      {/* corner glints */}
      {layer({
        mixBlendMode: "screen",
        background:
          "radial-gradient(6px 5px at 14% 14%, rgba(255,255,255,0.75) 0%, rgba(255,255,255,0) 100%), radial-gradient(6px 5px at 86% 14%, rgba(255,255,255,0.75) 0%, rgba(255,255,255,0) 100%)",
      })}
    </>
  );

  const squircleBg = (extraStyle: CSSProperties) => (
    <Squircle
      radius={radius}
      smoothing={smoothing}
      exponent={exponent}
      compare={compare}
      fill="linear-gradient(180deg, #ffffff 0%, #f4f4f5 52%, #ececed 100%)"
      strokeGradient={["#d3d6db", "#b4b7bd", "#7f8288"]}
      strokeWidth={1}
      style={extraStyle}
    >
      {gloss}
    </Squircle>
  );

  // Fixed size: the Squircle is the box; content is centred inside it.
  if (!auto) {
    return (
      <Squircle
        radius={radius}
        smoothing={smoothing}
        exponent={exponent}
        compare={compare}
        contentClassName={contentClassName}
        fill="linear-gradient(180deg, #ffffff 0%, #f4f4f5 52%, #ececed 100%)"
        strokeGradient={["#d3d6db", "#b4b7bd", "#7f8288"]}
        strokeWidth={1}
        className={`${press} ${className}`}
        style={{ width: w, height: h, filter: HAIRLINE }}
      >
        {gloss}
        {children}
      </Squircle>
    );
  }

  // Auto size: the in-flow content (with its own padding) drives the box size; the
  // Squircle background is absolute and sized to the measured content.
  return (
    <span
      className={`relative inline-flex ${press} ${className}`}
      style={{ filter: HAIRLINE }}
    >
      {cw > 0 && ch > 0 && squircleBg({ position: "absolute", inset: 0 })}
      <span ref={measureRef} className={`relative z-[1] inline-flex items-center justify-center ${contentClassName ?? ""}`}>
        {children}
      </span>
    </span>
  );
}

// Debossed neutral label — two-tone near-black ink, cut into the surface with a
// base-occlusion halo, a bottom highlight, a chiselled top-highlight and a faint
// top shadow. Reused by every demo so text reads consistently.
function InkLabel({
  children,
  size = TEXT,
  tracking = TRACKING,
  className = "",
}: {
  children: ReactNode;
  size?: number;
  tracking?: number;
  className?: string;
}) {
  const ls = `${tracking}px`;
  return (
    <span className={`relative inline-flex items-center justify-center whitespace-nowrap ${className}`}>
      <span
        aria-hidden
        className="pointer-events-none absolute font-medium text-black/20 blur-[2px]"
        style={{ fontSize: size, letterSpacing: ls }}
      >
        {children}
      </span>
      <span
        className="relative z-[2] font-medium"
        style={{
          fontSize: size,
          letterSpacing: ls,
          // a hair of horizontal padding so background-clip:text never clips a glyph edge
          padding: "0 0.5px",
          backgroundImage: "linear-gradient(180deg, #14151a 0%, #33353b 100%)",
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          color: "transparent",
          filter:
            "drop-shadow(0 1px 1px rgba(255,255,255,0.8)) drop-shadow(0 -0.5px 0.3px rgba(255,255,255,0.5)) drop-shadow(0 -0.5px 0.5px rgba(0,0,0,0.12))",
        }}
      >
        {children}
      </span>
    </span>
  );
}

// ── Demo 1: the glossy button ────────────────────────────────────────────────
export function SquircleGlossyButton({ smoothing, exponent, compare }: Shape & { label?: string }) {
  const h = CONTROL_H;
  return (
    <GlossySquircle w={132} h={h} radius={radiusFor(h)} smoothing={smoothing} exponent={exponent} compare={compare}>
      <InkLabel>Get the app</InkLabel>
    </GlossySquircle>
  );
}

// ── Demo 2: a chat — user bubble → AI (no bubble) → user bubble ───────────────
export function SquircleChat({ smoothing, exponent, compare }: Shape) {
  // radius keyed to the default control height so bubbles match the family
  const br = radiusFor(CONTROL_H);
  const bubble = (text: string) => (
    <div className="flex justify-end">
      <GlossySquircle
        radius={br}
        smoothing={smoothing}
        exponent={exponent}
        compare={compare}
        interactive={false}
        contentClassName="px-3 py-2"
      >
        <InkLabel>{text}</InkLabel>
      </GlossySquircle>
    </div>
  );
  return (
    <div className="flex w-[300px] flex-col gap-2.5">
      {bubble("hey, what’s a squircle?")}
      {/* AI answer — no bubble, just quiet text */}
      <p className="max-w-[86%] text-[14px] leading-[1.5] text-[var(--text-secondary)]">
        A corner that eases into the edge with no kink, like on iOS.
      </p>
      {bubble("love it")}
    </div>
  );
}

// ── Demo 3: an iOS segmented control (glossy squircle thumb slides under active)
export function SquircleTabs({
  smoothing,
  exponent,
  compare,
  active = 0,
  onChange,
}: Shape & { active?: number; onChange?: (i: number) => void }) {
  const items = ["Design", "Code", "Ship"];
  const W = 224;
  const H = CONTROL_H;
  const pad = 3;
  const seg = (W - pad * 2) / items.length;
  const trackR = radiusFor(H); // the track is a squircle too
  const tr = radiusFor(H - pad * 2); // thumb corner keyed to the thumb's height

  const trackClip = `path("${shapePath({ width: W, height: H, radius: trackR, smoothing, exponent, plain: compare })}")`;

  return (
    <div className="relative" style={{ width: W, height: H }}>
      {/* recessed track — a squircle well the thumb sits inside */}
      <span
        aria-hidden
        className="absolute inset-0"
        style={{
          clipPath: trackClip,
          WebkitClipPath: trackClip,
          background: "linear-gradient(180deg, #e9eaec 0%, #f3f4f5 100%)",
          boxShadow: "inset 0 1px 3px rgba(0,0,0,0.12)",
        }}
      />
      {/* sliding glossy thumb under the active segment */}
      <div
        className="absolute transition-[left] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
        style={{ top: pad, left: pad + active * seg, width: seg, height: H - pad * 2 }}
      >
        <GlossySquircle
          w={seg}
          h={H - pad * 2}
          radius={tr}
          smoothing={smoothing}
          exponent={exponent}
          compare={compare}
          interactive={false}
        />
      </div>
      {/* labels — same tracking whether active or not, so they don't shift width */}
      <div className="absolute inset-0 flex items-center" style={{ padding: pad }}>
        {items.map((it, i) => (
          <button
            key={it}
            type="button"
            onClick={() => onChange?.(i)}
            className="relative z-[1] flex h-full flex-1 items-center justify-center font-medium transition-colors"
            style={{
              fontSize: TEXT,
              letterSpacing: `${TRACKING}px`,
              color: i === active ? "transparent" : "var(--text-secondary)",
            }}
          >
            {i === active ? <InkLabel>{it}</InkLabel> : it}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Demo 4: an iOS toggle switch (glossy squircle thumb slides in a squircle track)
export function SquircleToggle({
  smoothing,
  exponent,
  compare,
  on = true,
  onChange,
}: Shape & { on?: boolean; onChange?: (v: boolean) => void }) {
  const H = CONTROL_H_SM;
  const W = Math.round(H * 1.6);
  const pad = 4;
  const thumb = H - pad * 2;
  const trackR = radiusFor(H);
  const thumbR = radiusFor(thumb);
  const trackClip = `path("${shapePath({ width: W, height: H, radius: trackR, smoothing, exponent, plain: compare })}")`;

  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => onChange?.(!on)}
      className="relative active:brightness-[1.04] transition-[filter] duration-150"
      style={{ width: W, height: H }}
    >
      {/* track — a squircle well; darker when on, recessed light when off */}
      <span
        aria-hidden
        className="absolute inset-0 transition-[background] duration-300"
        style={{
          clipPath: trackClip,
          WebkitClipPath: trackClip,
          background: on
            ? "linear-gradient(180deg, #4b4d52 0%, #3a3c41 100%)"
            : "linear-gradient(180deg, #e5e6e8 0%, #eef0f1 100%)",
          boxShadow: on
            ? "inset 0 1px 2px rgba(0,0,0,0.35)"
            : "inset 0 1px 2px rgba(0,0,0,0.14)",
        }}
      />
      {/* sliding glossy thumb */}
      <div
        className="absolute transition-[left] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
        style={{ top: pad, left: on ? W - pad - thumb : pad, width: thumb, height: thumb }}
      >
        <GlossySquircle
          w={thumb}
          h={thumb}
          radius={thumbR}
          smoothing={smoothing}
          exponent={exponent}
          compare={compare}
          interactive={false}
        />
      </div>
    </button>
  );
}

// A recessed squircle surface — a light inset well with a real squircle border
// (for input fields / menus). Fixed-size (w/h in px). Content is a child that
// overlays the well; it is NOT clipped, so menu rows never get cut.
function RecessedSquircle({
  w,
  h,
  radius,
  smoothing,
  exponent,
  compare,
  children,
  contentClassName = "",
}: Shape & {
  w: number;
  h: number;
  children?: ReactNode;
  contentClassName?: string;
}) {
  const uid = useId().replace(/:/g, "");
  const path = shapePath({ width: w, height: h, radius, smoothing, exponent, plain: compare });
  const clip = `path("${path}")`;
  return (
    <span className="relative inline-flex" style={{ width: w, height: h }}>
      {/* the recessed well: light fill + inset shadow, clipped to the squircle */}
      <span
        aria-hidden
        className="absolute inset-0"
        style={{
          clipPath: clip,
          WebkitClipPath: clip,
          background: "linear-gradient(180deg, #f5f6f7 0%, #ffffff 100%)",
          boxShadow: "inset 0 1.5px 3px rgba(0,0,0,0.10)",
        }}
      />
      {/* a hairline border on the squircle outline — clipped to itself so only the
          inner half shows (uniform on flats + corners) */}
      <svg
        aria-hidden
        width={w}
        height={h}
        viewBox={`0 0 ${w} ${h}`}
        className="pointer-events-none absolute inset-0 z-[1]"
      >
        <clipPath id={`rec-${uid}`}>
          <path d={path} />
        </clipPath>
        <path d={path} fill="none" stroke="#c7cace" strokeWidth={2} clipPath={`url(#rec-${uid})`} />
      </svg>
      {/* content overlays the well; not clipped */}
      <span className={`relative z-[2] flex w-full ${contentClassName}`}>{children}</span>
    </span>
  );
}

// ── Demo 5: a text input — a recessed squircle field with a placeholder ───────
export function SquircleInput({ smoothing, exponent, compare }: Shape) {
  const h = CONTROL_H;
  return (
    <RecessedSquircle
      w={200}
      h={h}
      radius={radiusFor(h)}
      smoothing={smoothing}
      exponent={exponent}
      compare={compare}
      contentClassName="h-full items-center gap-1.5 px-3"
    >
      {/* search glyph */}
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className="shrink-0 text-[var(--text-tertiary)]">
        <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
        <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <span className="text-[var(--text-tertiary)]" style={{ fontSize: TEXT }}>Search</span>
    </RecessedSquircle>
  );
}

// ── Demo 6: a stepper — − / value / + as glossy squircle keys around a readout ─
export function SquircleStepper({ smoothing, exponent, compare }: Shape) {
  const [n, setN] = useState(3);
  const h = CONTROL_H_SM;
  const key = (label: string, onClick: () => void) => (
    <GlossySquircle
      w={h}
      h={h}
      radius={radiusFor(h)}
      smoothing={smoothing}
      exponent={exponent}
      compare={compare}
      className="cursor-pointer"
    >
      {/* label is non-interactive; the covering button on top takes the click */}
      <span className="pointer-events-none">
        <InkLabel>{label}</InkLabel>
      </span>
      <button type="button" onClick={onClick} className="absolute inset-0 z-[4]" aria-label={label} />
    </GlossySquircle>
  );
  return (
    <div className="flex items-center gap-2">
      {key("−", () => setN((v) => Math.max(0, v - 1)))}
      <span className="w-6 text-center font-medium tabular-nums text-[var(--text-primary)]" style={{ fontSize: TEXT }}>{n}</span>
      {key("+", () => setN((v) => v + 1))}
    </div>
  );
}

// ── Demo 7: a dropdown — a glossy squircle field that opens a squircle menu ────
export function SquircleDropdown({ smoothing, exponent, compare }: Shape) {
  const options = ["Squircle", "Rounded", "Circle"];
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState(0);
  const W = 180;
  const r = radiusFor(CONTROL_H);
  return (
    <div className="relative">
      <GlossySquircle
        w={W}
        h={CONTROL_H}
        radius={r}
        smoothing={smoothing}
        exponent={exponent}
        compare={compare}
        className="cursor-pointer"
        contentClassName="justify-between px-3 pointer-events-none"
      >
        <InkLabel>{options[sel]}</InkLabel>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="ml-2 shrink-0 text-[var(--text-secondary)]" style={{ transform: open ? "rotate(180deg)" : undefined, transition: "transform .2s" }}>
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {/* the click target, on top of the gloss + label */}
        <button type="button" onClick={() => setOpen((o) => !o)} className="pointer-events-auto absolute inset-0 z-[4]" aria-haspopup="listbox" aria-expanded={open} />
      </GlossySquircle>

      {open && (
        // opens UPWARD (bottom-full) so it isn't clipped by the preview's bottom edge
        <div className="absolute bottom-full left-0 z-10 mb-2" style={{ width: W }}>
          <RecessedSquircle
            w={W}
            h={options.length * 34 + 8}
            radius={r}
            smoothing={smoothing}
            exponent={exponent}
            compare={compare}
            contentClassName="flex-col p-1"
          >
            {options.map((o, i) => (
              <button
                key={o}
                type="button"
                onClick={() => { setSel(i); setOpen(false); }}
                className="flex h-[34px] w-full items-center rounded-lg px-3 text-left transition-colors hover:bg-black/[0.05]"
                style={{ fontSize: TEXT, color: i === sel ? "var(--text-primary)" : "var(--text-secondary)", fontWeight: i === sel ? 600 : 400 }}
              >
                {o}
              </button>
            ))}
          </RecessedSquircle>
        </div>
      )}
    </div>
  );
}

```

### squircle/playground.tsx

```tsx
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

```


14. You are given the complete source for a self-contained web visual: "Kinetic typography".

What it is:
- A letter is cut into a grid of tiles, and each tile slips on its own wave, so the whole letter ripples like water.

How to use this code:
- It is a React + TypeScript component tree (Next.js App Router) that renders to an HTML canvas; the entry point is the playground component.
- Drop the files into a project under the same relative paths, mount the playground component, and it runs as-is. No external assets beyond what's inline.
- To adapt it: change the resolved word/logo, the color controls, or the experiment parameters. Ask me to modify, explain, or port any part.

The full source follows, one file per block:

### kinetic-a/engine.ts

```ts
// Kinetic typography — a letter warped through a tile grid, in duotone.
//
// The core: draw the letter once to an offscreen buffer, cut the frame into a
// grid of tiles, and for each tile copy from a SOURCE rectangle offset by a sine
// wave whose phase depends on frameCount and the tile's position. That slips
// neighbouring tiles out of phase and the letter ripples.
//
// Four upgrades on top of that base:
//   1. Two-axis interference — the source offset is the SUM of two waves at
//      different frequencies, so the ripple crosses itself (cloth/water) instead
//      of sliding as one flat sheet.
//   2. Chromatic split — the warped letter is composited in the ink colour plus
//      two accent copies pushed a few px apart, so warped edges bloom into a
//      coloured fringe.
//   3. Depth shading — each warped tile is drawn at an alpha set by how much it
//      moved, so tiles in motion catch a bit of light and the letter gains relief.
//   4. A faint grain + scanline veil over the whole card for analog warmth.
//
// PERFORMANCE: the warp is done ONCE per frame with plain drawImage tile copies
// (no per-tile compositing — that was the slow path). Duotone + chroma are three
// whole-frame composites, so their cost is constant no matter the tile count.

export interface KineticParams {
  text: string;
  paper: string;
  ink: string;
  accent: string;
  tiles: number; // grid columns; rows derived from aspect
  offset: number; // max source displacement, CSS px
  speed: number; // wave speed per frame
  spread: number; // the x*y phase term — low = uniform, high = turbulent
  chroma: number; // chromatic-split strength 0..1
  shade: number; // depth-shading strength 0..1
  grain: number; // grain/scanline strength 0..1
}

// ── small colour helpers ────────────────────────────────────────────────────
function parseHex(hex: string): [number, number, number] {
  let h = hex.replace("#", "").trim();
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}
const clamp255 = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
const rgb = ([r, g, b]: [number, number, number], a = 1) => `rgba(${r},${g},${b},${a})`;

function token(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

const ASPECT = 16 / 9;

export class KineticA {
  private stage: HTMLDivElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  // `mask`: the letter drawn once as WHITE on BLACK (opaque), so warping it is a
  // plain fast drawImage copy. `warp`: the warped letter each frame (also
  // white-on-black). We tint `warp` onto the main canvas at composite time.
  private mask: HTMLCanvasElement;
  private mctx: CanvasRenderingContext2D;
  private warp: HTMLCanvasElement;
  private wctx: CanvasRenderingContext2D;
  private grainCanvas: HTMLCanvasElement | null = null;

  private dpr = 1;
  private w = 0;
  private h = 0;
  private frame = 0;
  private raf = 0;
  private running = false;

  private p: KineticParams;
  private paperRGB: [number, number, number] = [252, 252, 252];
  private inkRGB: [number, number, number] = [27, 27, 27];
  private accentRGB: [number, number, number] = [59, 130, 246];
  private accentInv: [number, number, number] = [196, 125, 9];
  private box = { x0: 0, y0: 0, x1: 0, y1: 0 };

  constructor(stage: HTMLDivElement, params: KineticParams) {
    this.stage = stage;
    this.p = params;

    this.canvas = document.createElement("canvas");
    this.canvas.style.width = "100%";
    this.canvas.style.height = "100%";
    this.canvas.style.display = "block";
    stage.appendChild(this.canvas);
    this.ctx = this.canvas.getContext("2d")!;

    this.mask = document.createElement("canvas");
    this.mctx = this.mask.getContext("2d", { willReadFrequently: true })!;
    this.warp = document.createElement("canvas");
    this.wctx = this.warp.getContext("2d")!;

    this.applyColors();
    this.resize();
  }

  setParams(params: KineticParams) {
    const textChanged = params.text !== this.p.text;
    const colorsChanged =
      params.paper !== this.p.paper ||
      params.ink !== this.p.ink ||
      params.accent !== this.p.accent;
    const grainChanged = params.grain !== this.p.grain;
    this.p = params;
    if (colorsChanged) this.applyColors();
    if (textChanged) this.drawLetter();
    if (grainChanged) this.buildGrain();
    if (!this.running) this.renderStatic();
  }

  private applyColors() {
    this.paperRGB = parseHex(this.p.paper);
    this.inkRGB = parseHex(this.p.ink);
    this.accentRGB = parseHex(this.p.accent);
    this.accentInv = [
      255 - this.accentRGB[0],
      255 - this.accentRGB[1],
      255 - this.accentRGB[2],
    ];
  }

  resize() {
    const rect = this.stage.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = rect.width;
    this.h = rect.height;

    const pw = Math.round(this.w * this.dpr);
    const ph = Math.round(this.h * this.dpr);
    for (const c of [this.canvas, this.mask, this.warp]) {
      c.width = pw;
      c.height = ph;
    }

    this.buildGrain();
    this.drawLetter();
    if (!this.running) this.renderStatic();
  }

  // Draw the letter once as an opaque white shape on a TRANSPARENT background, so
  // the warped tiles carry real alpha and can be tinted to any ink and placed
  // over any paper. Warping is a plain drawImage copy (the fast tutorial path).
  private drawLetter() {
    const { mctx, mask } = this;
    const W = mask.width;
    const H = mask.height;
    mctx.clearRect(0, 0, W, H);

    const text = (this.p.text || "A").slice(0, 12);
    const single = text.length === 1;
    const family = token("--font-woodland", "").split(",")[0].trim();
    let size = Math.round(H * (single ? 0.86 : 0.6));
    mctx.fillStyle = "#fff";
    mctx.textAlign = "center";
    mctx.textBaseline = "middle";
    const setFont = (s: number) =>
      (mctx.font = family ? `700 ${s}px ${family}, system-ui` : `800 ${s}px system-ui`);
    setFont(size);
    if (!single) {
      const maxW = W * 0.9;
      let guard = 0;
      while (mctx.measureText(text).width > maxW && size > 12 && guard++ < 40) {
        size -= 4;
        setFont(size);
      }
    }
    mctx.fillText(text, W / 2, H * 0.54);
    this.measureBox();
  }

  // Bounding box of the ink so the tile loop skips empty tiles. Runs only on
  // text/size change (not per frame), so getImageData here is fine.
  private measureBox() {
    const { mctx, mask } = this;
    const W = mask.width;
    const H = mask.height;
    try {
      const data = mctx.getImageData(0, 0, W, H).data;
      let x0 = W, y0 = H, x1 = 0, y1 = 0;
      for (let y = 0; y < H; y += 2) {
        for (let x = 0; x < W; x += 2) {
          // letter is opaque on a transparent bg → alpha channel marks ink
          if (data[(y * W + x) * 4 + 3] > 20) {
            if (x < x0) x0 = x;
            if (x > x1) x1 = x;
            if (y < y0) y0 = y;
            if (y > y1) y1 = y;
          }
        }
      }
      if (x1 < x0) { x0 = 0; y0 = 0; x1 = W; y1 = H; }
      this.box = { x0, y0, x1, y1 };
    } catch {
      this.box = { x0: 0, y0: 0, x1: W, y1: H };
    }
  }

  private buildGrain() {
    if (this.p.grain <= 0) { this.grainCanvas = null; return; }
    const W = this.mask.width;
    const H = this.mask.height;
    if (!W || !H) return;
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const g = c.getContext("2d")!;
    const img = g.createImageData(W, H);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const n = (Math.sin(i * 12.9898) * 43758.5453) % 1;
      const v = 128 + (n - 0.5) * 255;
      d[i] = d[i + 1] = d[i + 2] = clamp255(v);
      d[i + 3] = 12;
    }
    g.putImageData(img, 0, 0);
    g.globalAlpha = 0.06;
    g.fillStyle = "#000";
    const step = Math.max(2, Math.round(3 * this.dpr));
    for (let y = 0; y < H; y += step) g.fillRect(0, y, W, Math.max(1, Math.round(this.dpr)));
    this.grainCanvas = c;
  }

  // ── the frame ────────────────────────────────────────────────────────────
  private renderFrame() {
    const { ctx, wctx, mask } = this;
    const W = mask.width;
    const H = mask.height;
    const p = this.p;
    const off = p.offset * this.dpr;

    // 1) Build the warped letter into `warp` (white shape on transparent). Plain
    //    tile copies — the fast tutorial path. Depth shade is baked in per-tile.
    wctx.globalCompositeOperation = "source-over";
    wctx.globalAlpha = 1;
    wctx.clearRect(0, 0, W, H);

    const TILES_X = Math.max(2, Math.round(p.tiles));
    const TILES_Y = Math.max(2, Math.round(p.tiles / ASPECT));
    const tileW = Math.floor(W / TILES_X);
    const tileH = Math.floor(H / TILES_Y);
    if (tileW > 0 && tileH > 0) {
      const cx0 = Math.max(0, Math.floor(this.box.x0 / tileW) - 1);
      const cy0 = Math.max(0, Math.floor(this.box.y0 / tileH) - 1);
      const cx1 = Math.min(TILES_X - 1, Math.ceil(this.box.x1 / tileW) + 1);
      const cy1 = Math.min(TILES_Y - 1, Math.ceil(this.box.y1 / tileH) + 1);
      const t = this.frame * p.speed;

      for (let y = cy0; y <= cy1; y++) {
        for (let x = cx0; x <= cx1; x++) {
          const phase = x * y;
          const wave1 = Math.sin(t + phase * p.spread);
          const wave2 = Math.sin(t * 0.7 + (x + y) * p.spread * 1.9 + 1.3);
          const mix = wave1 * 0.65 + wave2 * 0.45; // ~[-1.1, 1.1]
          const waveX = Math.round(mix * off);
          const waveY = Math.round(Math.sin(t * 0.9 + phase * p.spread * 0.6) * off * 0.7);

          const sx = x * tileW + waveX;
          const sy = y * tileH + waveY;
          const dx = x * tileW;
          const dy = y * tileH;
          const dw = x === TILES_X - 1 ? W - dx : tileW;
          const dh = y === TILES_Y - 1 ? H - dy : tileH;
          if (dw <= 0 || dh <= 0) continue;
          if (sx + dw <= 0 || sy + dh <= 0 || sx >= W || sy >= H) continue;

          // depth shade → alpha: tiles that moved most are a touch brighter.
          wctx.globalAlpha = p.shade > 0
            ? 1 - p.shade * 0.5 + Math.min(1, Math.abs(mix)) * p.shade * 0.5
            : 1;
          wctx.drawImage(mask, sx, sy, dw, dh, dx, dy, dw, dh);
        }
      }
      wctx.globalAlpha = 1;
    }

    // 2) Composite `warp` onto the main canvas in DUOTONE, with a chromatic split.
    //    Constant cost: three full-frame draws max. The accent copies go down
    //    FIRST (offset, so their fringe peeks out from behind), then the ink on
    //    top at true position, so the letter body stays clean ink and only the
    //    warped edges show colour.
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.fillStyle = rgb(this.paperRGB);
    ctx.fillRect(0, 0, W, H);

    if (p.chroma > 0) {
      const shiftPx = Math.round(p.chroma * 5 * this.dpr) + 1;
      this.compositeTinted(this.accentRGB, shiftPx, 0.7 * p.chroma);
      this.compositeTinted(this.accentInv, -shiftPx, 0.6 * p.chroma);
    }
    this.compositeTinted(this.inkRGB, 0, 1);

    // 3) grain + scanline veil
    if (this.grainCanvas && p.grain > 0) {
      ctx.globalCompositeOperation = "overlay";
      ctx.globalAlpha = p.grain;
      ctx.drawImage(this.grainCanvas, 0, 0);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    }
  }

  // Tint the warped letter (white shape on transparent) to `col` and composite it
  // onto the main canvas, shifted by `dxPx`. One reusable scratch buffer:
  //   scratch = warp            (white letter, real alpha)
  //   scratch 'source-in' col   (fill col only where the letter is) → tinted letter
  //   main    'source-over'     (place it over the paper at any offset)
  // Correct for ANY ink/paper combo (no luminance-key assumptions).
  private tintScratch: HTMLCanvasElement | null = null;
  private tctx: CanvasRenderingContext2D | null = null;
  private compositeTinted(
    col: [number, number, number],
    dxPx: number,
    alpha: number,
  ) {
    const W = this.warp.width;
    const H = this.warp.height;
    if (!this.tintScratch) {
      this.tintScratch = document.createElement("canvas");
      this.tctx = this.tintScratch.getContext("2d")!;
    }
    if (this.tintScratch.width !== W || this.tintScratch.height !== H) {
      this.tintScratch.width = W;
      this.tintScratch.height = H;
    }
    const s = this.tctx!;
    s.globalCompositeOperation = "source-over";
    s.globalAlpha = 1;
    s.clearRect(0, 0, W, H);
    s.drawImage(this.warp, 0, 0);
    s.globalCompositeOperation = "source-in";
    s.fillStyle = rgb(col);
    s.fillRect(0, 0, W, H);
    s.globalCompositeOperation = "source-over";

    this.ctx.globalAlpha = alpha;
    this.ctx.drawImage(this.tintScratch, dxPx, 0);
    this.ctx.globalAlpha = 1;
  }

  renderStatic() {
    this.frame = 0;
    this.renderFrame();
  }

  private tick = () => {
    if (!this.running) return;
    this.frame++;
    this.renderFrame();
    this.raf = requestAnimationFrame(this.tick);
  };

  start() {
    if (this.running) return;
    this.running = true;
    this.raf = requestAnimationFrame(this.tick);
  }

  stop() {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  refreshLetter() {
    this.drawLetter();
    if (!this.running) this.renderStatic();
  }

  destroy() {
    this.stop();
    this.canvas.remove();
  }
}

```

### kinetic-a/KineticACard.tsx

```tsx
"use client";

// The kinetic-typography Vault card: a bold letter warped through a tile grid in
// duotone (see ./engine.ts). Thin wrapper — mounts the framework-free engine,
// keeps it in sync with `params`, and pauses it offscreen or when the tab is
// hidden. Used both as the gallery card and the detail-page hero (share a
// view-transition-name so the card morphs into the hero).

import { useEffect, useRef, type CSSProperties } from "react";
import { KineticA as Engine, type KineticParams } from "./engine";
import { onTransitionChange } from "../../lib/view-transition";

// The card's default look: ink on paper, a calm ripple with a blue edge-split.
// The playground passes its own live params instead.
export const DEFAULT_PARAMS: KineticParams = {
  text: "a",
  paper: "#fcfcfc",
  ink: "#1b1b1b",
  accent: "#3b82f6",
  tiles: 34,
  offset: 26,
  speed: 0.02,
  spread: 0.025,
  chroma: 0.35,
  shade: 0.35,
  grain: 0.7,
};

export function KineticACard({
  flush = false,
  params = DEFAULT_PARAMS,
  viewTransitionName,
}: {
  /** Playground mode: round only the TOP so the control panel tucks under the
   *  flat bottom (matches PG_PREVIEW + PG_PANEL used by the other playgrounds). */
  flush?: boolean;
  params?: KineticParams;
  viewTransitionName?: string;
} = {}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<Engine | null>(null);

  // Mount once; lifecycle wiring lives here.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const engine = new Engine(stage, params);
    engineRef.current = engine;

    // Repaint the letter once the heavy display face loads (first paint may have
    // used the fallback).
    if (typeof document !== "undefined" && document.fonts) {
      const fam = getComputedStyle(document.documentElement)
        .getPropertyValue("--font-woodland")
        .split(",")[0]
        .trim();
      if (fam) {
        document.fonts.load(`700 64px ${fam}`).then(() => engine.refreshLetter()).catch(() => {});
      }
    }

    if (reduced) {
      engine.renderStatic();
      return () => {
        engine.destroy();
        engineRef.current = null;
      };
    }

    let onScreen = true;
    let hidden = false;
    let inTransition = false;
    // Freeze the rAF loop while a cross-route morph is running — the browser is
    // compositing page snapshots then, so a live canvas underneath only steals
    // the main thread / GPU (and can't visibly update anyway).
    const running = () => onScreen && !hidden && !inTransition;
    const sync = () => {
      if (running()) engine.start();
      else engine.stop();
    };
    sync();

    const ro = new ResizeObserver(() => engine.resize());
    ro.observe(stage);
    const io = new IntersectionObserver((es) => {
      onScreen = es[0]?.isIntersecting ?? true;
      sync();
    });
    io.observe(stage);
    const onVis = () => {
      hidden = document.hidden;
      sync();
    };
    document.addEventListener("visibilitychange", onVis);
    const offTransition = onTransitionChange((active) => {
      inTransition = active;
      sync();
    });

    return () => {
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      offTransition();
      engine.destroy();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Push live param changes to the running engine (playground drives this).
  useEffect(() => {
    engineRef.current?.setParams(params);
  }, [params]);

  // The engine paints its own paper colour, so the frame bg only shows for the
  // split second before mount. In `flush` (playground) mode the bottom is square
  // and the panel tucks under it; otherwise it's a fully-rounded card.
  // flush = the PG_PREVIEW recipe: a FULLY-rounded box at z-10, so PG_PANEL's
  // -mt-5 slides up BEHIND it and the preview keeps its own rounded bottom.
  const shape = flush
    ? "relative z-10 rounded-xl border"
    : "rounded-[12px] border";

  const style: CSSProperties | undefined = viewTransitionName
    ? { viewTransitionName, background: params.paper }
    : { background: params.paper };

  return (
    <div
      ref={stageRef}
      data-canvas-card
      style={style}
      className={`relative mx-auto aspect-video w-full select-none overflow-hidden border-[var(--border-line)] ${shape}`}
    />
  );
}

```


15. You are given the complete source for a self-contained web visual: "Liquid UI".

What it is:
- I love UI where two cards fuse and the corner between them bends inward, like they were poured together, so I built a tiny engine that just makes it from code instead of drawing it by hand. Drag the cards below to watch the join re-flow, and turn one knob to go from crisp joints all the way to soft gooey blobs.

How to use this code:
- It is a React + TypeScript component tree (Next.js App Router) that renders to an HTML canvas; the entry point is the playground component.
- Drop the files into a project under the same relative paths, mount the playground component, and it runs as-is. No external assets beyond what's inline.
- To adapt it: change the resolved word/logo, the color controls, or the experiment parameters. Ask me to modify, explain, or port any part.

The full source follows, one file per block:

### liquid/sdf.ts

```ts
// The signed-distance field that powers the liquid fusion.
//
// The whole "liquid UI" trick is one idea: don't stack shapes, take the UNION of
// their signed-distance fields with a SMOOTH minimum. A plain min() gives a hard
// union (shapes touch at a sharp seam); a smooth-min blends the fields near the
// seam, and that blend IS the concave (inverse) fillet where two cards meet. Turn
// the blend `k` up and the fillet grows into a full gooey neck — so a single knob
// spans "crisp inverse-rounded joint" -> "organic metaball melt".
//
// Everything here is CPU/TS (ported from the repo's GLSL: sdRoundBox + smin live in
// lego/shaders.ts, smin also in liquid-wipe/shader.ts). marching-squares.ts samples
// Field.eval over a grid to trace the fused outline into an SVG path.
//
// Convention: the field is NEGATIVE inside a shape, 0 on the surface, POSITIVE
// outside (standard SDF). The fused outline is the iso-contour at 0.

/** Signed distance from point (px,py) to an axis-aligned rounded box. `hw`,`hh`
 *  are half-extents, `r` the corner radius. Ported from lego/shaders.ts sdRoundBox. */
export function sdRoundBox(
  px: number,
  py: number,
  cx: number,
  cy: number,
  hw: number,
  hh: number,
  r: number,
): number {
  // clamp the radius so it never exceeds the box
  const rr = Math.min(r, Math.min(hw, hh));
  const qx = Math.abs(px - cx) - hw + rr;
  const qy = Math.abs(py - cy) - hh + rr;
  const ax = Math.max(qx, 0);
  const ay = Math.max(qy, 0);
  const outside = Math.hypot(ax, ay);
  const inside = Math.min(Math.max(qx, qy), 0);
  return outside + inside - rr;
}

/** Signed distance to a capsule (a line segment of radius `r`) from (ax,ay) to
 *  (bx,by). Used for explicit "bridges" that connect two cards with a pipe. */
export function sdCapsule(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  r: number,
): number {
  const pax = px - ax;
  const pay = py - ay;
  const bax = bx - ax;
  const bay = by - ay;
  const denom = bax * bax + bay * bay || 1e-6;
  // projection of P onto AB, clamped to the segment
  const h = Math.max(0, Math.min(1, (pax * bax + pay * bay) / denom));
  const dx = pax - bax * h;
  const dy = pay - bay * h;
  return Math.hypot(dx, dy) - r;
}

/** Polynomial smooth-minimum (the fillet maker). k=0 → hard min (sharp seam);
 *  larger k → wider blend → bigger concave fillet / gooey neck. Ported from
 *  lego/shaders.ts (the mix() form — no derivative kink at the seam). */
export function smin(a: number, b: number, k: number): number {
  if (k <= 0) return Math.min(a, b);
  const h = Math.max(0, Math.min(1, 0.5 + (0.5 * (b - a)) / k));
  return b * (1 - h) + a * h - k * h * (1 - h);
}

// ── Shapes ───────────────────────────────────────────────────────────────────
export interface RoundBox {
  kind: "box";
  cx: number;
  cy: number;
  hw: number;
  hh: number;
  r: number;
}
export interface Bridge {
  kind: "bridge";
  ax: number;
  ay: number;
  bx: number;
  by: number;
  r: number;
}
export type Shape = RoundBox | Bridge;

export function shapeSD(s: Shape, px: number, py: number): number {
  return s.kind === "box"
    ? sdRoundBox(px, py, s.cx, s.cy, s.hw, s.hh, s.r)
    : sdCapsule(px, py, s.ax, s.ay, s.bx, s.by, s.r);
}

/** The whole group as one field: the smooth-union of every shape. `eval` returns
 *  the fused signed distance at (x,y). Proximity auto-fuse is automatic — two boxes
 *  close enough that their k-blend overlaps merge with a fillet, with no explicit
 *  connection. Add Bridge shapes for deliberate pipes between distant cards. */
export class Field {
  shapes: Shape[];
  k: number;

  constructor(shapes: Shape[] = [], k = 12) {
    this.shapes = shapes;
    this.k = k;
  }

  eval(x: number, y: number): number {
    const { shapes, k } = this;
    if (shapes.length === 0) return Infinity;
    let d = shapeSD(shapes[0], x, y);
    for (let i = 1; i < shapes.length; i++) {
      d = smin(d, shapeSD(shapes[i], x, y), k);
    }
    return d;
  }

  /** Axis-aligned bounds of the whole group, padded so the fused skin (which bulges
   *  OUTSIDE each box by up to ~k at the fillets) is fully contained in the sample
   *  grid. Without the pad the marching-squares grid would clip the blend. */
  bounds(pad = 0): { minX: number; minY: number; maxX: number; maxY: number } {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    const grow = pad + this.k; // the smin bulge reaches ~k past a box edge
    for (const s of this.shapes) {
      if (s.kind === "box") {
        minX = Math.min(minX, s.cx - s.hw - grow);
        minY = Math.min(minY, s.cy - s.hh - grow);
        maxX = Math.max(maxX, s.cx + s.hw + grow);
        maxY = Math.max(maxY, s.cy + s.hh + grow);
      } else {
        minX = Math.min(minX, Math.min(s.ax, s.bx) - s.r - grow);
        minY = Math.min(minY, Math.min(s.ay, s.by) - s.r - grow);
        maxX = Math.max(maxX, Math.max(s.ax, s.bx) + s.r + grow);
        maxY = Math.max(maxY, Math.max(s.ay, s.by) + s.r + grow);
      }
    }
    if (!isFinite(minX)) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
    return { minX, minY, maxX, maxY };
  }
}

```

### liquid/marching-squares.ts

```ts
// Trace the fused outline of a Field into an SVG path.
//
// This is the one piece with nothing to reuse in the repo. We sample the field's
// signed distance on a grid, then run marching squares at the iso-contour 0 (the
// surface). Each grid cell looks at its 4 corners' inside/outside state (16 cases)
// and emits 0, 1, or 2 short edges; we place each edge endpoint by LINEAR
// INTERPOLATION along the cell edge (where the field actually crosses 0), not at
// the midpoint — that's what turns a blocky staircase into a smooth curve. Then we
// stitch the loose segments into closed loops and CHAIKIN-smooth them so the path
// reads as fluid, not faceted, and doesn't wobble frame-to-frame while morphing.
//
// Output: a single `d` string (possibly multiple subpaths if the group has
// disconnected islands). SVG path formatting matches squircle/superellipse.ts.

import { Field } from "./sdf";

const fmt = (v: number) => v.toFixed(2);

export interface MarchOptions {
  /** Grid cell size in the field's units (px). Smaller = crisper + slower. */
  cell?: number;
  /** Chaikin smoothing passes (0 = raw marching-squares polyline). */
  smooth?: number;
}

type Pt = { x: number; y: number };

// Marching-squares edge table. For each of the 16 corner-mask cases, which cell
// edges the contour crosses, as pairs [edgeA, edgeB]. Edges: 0=top,1=right,2=bottom,
// 3=left. Corner bit order: 0=TL,1=TR,2=BR,3=BL (bit set = INSIDE, field < 0).
// Cases 5 and 10 are saddles → two segments; we resolve them by the cell-center sign.
const EDGES: number[][][] = [
  [], // 0000
  [[3, 2]], // 0001 BL
  [[2, 1]], // 0010 BR
  [[3, 1]], // 0011 BL+BR
  [[0, 1]], // 0100 TR
  [[3, 2], [0, 1]], // 0101 saddle TL?/TR/BL
  [[0, 2]], // 0110 TR+BR
  [[3, 0]], // 0111 TR+BR+BL
  [[3, 0]], // 1000 TL
  [[0, 2]], // 1001 TL+BL
  [[3, 0], [2, 1]], // 1010 saddle
  [[0, 1]], // 1011 TL+BL+BR
  [[3, 1]], // 1100 TL+TR
  [[2, 1]], // 1101 TL+TR+BL
  [[3, 2]], // 1110 TL+TR+BR
  [], // 1111
];

// interpolate the 0-crossing along a cell edge between two corner samples
function lerpEdge(x0: number, y0: number, v0: number, x1: number, y1: number, v1: number): Pt {
  const denom = v0 - v1;
  const t = Math.abs(denom) < 1e-6 ? 0.5 : v0 / denom; // where field hits 0
  const tc = Math.max(0, Math.min(1, t));
  return { x: x0 + (x1 - x0) * tc, y: y0 + (y1 - y0) * tc };
}

/** Marching squares → array of closed loops (each a list of points). */
export function contour(field: Field, opts: MarchOptions = {}): Pt[][] {
  const cell = Math.max(2, opts.cell ?? 6);
  const b = field.bounds();
  const w = b.maxX - b.minX;
  const h = b.maxY - b.minY;
  if (w <= 0 || h <= 0) return [];

  const cols = Math.ceil(w / cell) + 1;
  const rows = Math.ceil(h / cell) + 1;
  if (cols * rows > 400_000) return []; // safety cap

  // sample the field once per grid vertex
  const val = new Float32Array(cols * rows);
  for (let j = 0; j < rows; j++) {
    const y = b.minY + j * cell;
    for (let i = 0; i < cols; i++) {
      val[j * cols + i] = field.eval(b.minX + i * cell, y);
    }
  }
  const at = (i: number, j: number) => val[j * cols + i];

  // collect loose segments (each: two points); we key endpoints to stitch them.
  const segs: [Pt, Pt][] = [];

  for (let j = 0; j < rows - 1; j++) {
    for (let i = 0; i < cols - 1; i++) {
      const x0 = b.minX + i * cell;
      const y0 = b.minY + j * cell;
      const x1 = x0 + cell;
      const y1 = y0 + cell;
      const vTL = at(i, j);
      const vTR = at(i + 1, j);
      const vBR = at(i + 1, j + 1);
      const vBL = at(i, j + 1);
      // inside = field < 0
      let mask = 0;
      if (vTL < 0) mask |= 8;
      if (vTR < 0) mask |= 4;
      if (vBR < 0) mask |= 2;
      if (vBL < 0) mask |= 1;
      if (mask === 0 || mask === 15) continue;

      // point on each edge (lazily)
      const edgePt = (edge: number): Pt => {
        switch (edge) {
          case 0: return lerpEdge(x0, y0, vTL, x1, y0, vTR); // top
          case 1: return lerpEdge(x1, y0, vTR, x1, y1, vBR); // right
          case 2: return lerpEdge(x0, y1, vBL, x1, y1, vBR); // bottom
          default: return lerpEdge(x0, y0, vTL, x0, y1, vBL); // left
        }
      };

      let cases = EDGES[mask];
      // saddle disambiguation via the cell-center sample
      if (mask === 5 || mask === 10) {
        const center = field.eval((x0 + x1) / 2, (y0 + y1) / 2);
        if (mask === 5) cases = center < 0 ? [[3, 0], [2, 1]] : [[3, 2], [0, 1]];
        else cases = center < 0 ? [[3, 2], [0, 1]] : [[3, 0], [2, 1]];
      }
      for (const [ea, eb] of cases) segs.push([edgePt(ea), edgePt(eb)]);
    }
  }

  return stitch(segs, cell);
}

// Stitch loose segments into closed loops by snapping near-equal endpoints together.
function stitch(segs: [Pt, Pt][], cell: number): Pt[][] {
  const eps = cell * 0.5;
  const key = (p: Pt) => `${Math.round(p.x / eps)},${Math.round(p.y / eps)}`;
  // adjacency: endpoint key -> list of {seg index, which end}
  const map = new Map<string, { seg: number; end: 0 | 1 }[]>();
  segs.forEach((s, idx) => {
    for (const end of [0, 1] as const) {
      const k = key(s[end]);
      const arr = map.get(k);
      if (arr) arr.push({ seg: idx, end });
      else map.set(k, [{ seg: idx, end }]);
    }
  });

  const used = new Array(segs.length).fill(false);
  const loops: Pt[][] = [];

  for (let start = 0; start < segs.length; start++) {
    if (used[start]) continue;
    const loop: Pt[] = [];
    let cur = start;
    let end: 0 | 1 = 0;
    let guard = 0;
    while (!used[cur] && guard++ < segs.length + 2) {
      used[cur] = true;
      const a = segs[cur][end];
      const bEnd = (end === 0 ? 1 : 0) as 0 | 1;
      const bPt = segs[cur][bEnd];
      loop.push(a);
      // find an unused segment sharing bPt
      const cands = map.get(key(bPt)) ?? [];
      let next = -1;
      let nextEnd: 0 | 1 = 0;
      for (const c of cands) {
        if (!used[c.seg]) {
          next = c.seg;
          nextEnd = c.end;
          break;
        }
      }
      if (next === -1) break;
      cur = next;
      end = nextEnd;
    }
    if (loop.length >= 3) loops.push(loop);
  }
  return loops;
}

// Chaikin corner-cutting: each pass replaces every point with two points 1/4 and
// 3/4 along its edges, rounding the polyline. Closed-loop variant.
function chaikin(pts: Pt[], passes: number): Pt[] {
  let out = pts;
  for (let p = 0; p < passes; p++) {
    const next: Pt[] = [];
    const n = out.length;
    for (let i = 0; i < n; i++) {
      const a = out[i];
      const b = out[(i + 1) % n];
      next.push({ x: a.x * 0.75 + b.x * 0.25, y: a.y * 0.75 + b.y * 0.25 });
      next.push({ x: a.x * 0.25 + b.x * 0.75, y: a.y * 0.25 + b.y * 0.75 });
    }
    out = next;
  }
  return out;
}

/** Full pipeline: field → contour loops → smoothed → one SVG path `d`. Coordinates
 *  are in the field's own space; the caller sets the SVG viewBox to match. Returns
 *  the path plus the bounds used, so the caller can size the <svg>. */
export function fieldToPath(
  field: Field,
  opts: MarchOptions = {},
): { d: string; minX: number; minY: number; width: number; height: number } {
  const b = field.bounds();
  const loops = contour(field, opts);
  const smooth = opts.smooth ?? 2;
  const parts: string[] = [];
  for (const loop of loops) {
    const s = smooth > 0 ? chaikin(loop, smooth) : loop;
    if (s.length < 3) continue;
    parts.push(
      `M ${fmt(s[0].x)} ${fmt(s[0].y)} ` +
        s.slice(1).map((p) => `L ${fmt(p.x)} ${fmt(p.y)}`).join(" ") +
        " Z",
    );
  }
  return {
    d: parts.join(" "),
    minX: b.minX,
    minY: b.minY,
    width: b.maxX - b.minX,
    height: b.maxY - b.minY,
  };
}

```

### liquid/engine.ts

```ts
// The orchestration layer between the React API and the geometry.
//
// A LiquidEngine holds the current cards (measured rounded boxes) + explicit
// bridges + the fusion params, and turns them into one SVG path via the field +
// marching squares. It is framework-free and stateless beyond its inputs, so both
// the React <LiquidGroup> and the playground drive it the same way. The heavy work
// (grid sample + contour) only runs when something actually changed — the caller
// sets inputs then calls compute(); identical inputs return the cached path.

import { Field, type Shape, type Bridge } from "./sdf";
import { fieldToPath, type MarchOptions } from "./marching-squares";

export interface LiquidBox {
  id: string;
  cx: number;
  cy: number;
  hw: number;
  hh: number;
  /** per-card base corner radius */
  r: number;
}

export interface LiquidParams {
  /** Blend amount — the star knob. Low = crisp inverse-rounded joints; high = goo. */
  k: number;
  /** Grid cell size (px). Smaller = crisper outline, more cost. */
  cell: number;
  /** Chaikin smoothing passes on the traced outline. */
  smooth: number;
}

export interface LiquidPath {
  d: string;
  minX: number;
  minY: number;
  width: number;
  height: number;
}

export const DEFAULT_PARAMS: LiquidParams = { k: 26, cell: 6, smooth: 2 };

export class LiquidEngine {
  private boxes: LiquidBox[] = [];
  private bridges: Bridge[] = [];
  private params: LiquidParams = { ...DEFAULT_PARAMS };
  private cachedPath: LiquidPath | null = null;
  private sig = ""; // signature of the last inputs, to skip redundant recompute

  setBoxes(boxes: LiquidBox[]) {
    this.boxes = boxes;
  }
  setBridges(bridges: Bridge[]) {
    this.bridges = bridges;
  }
  setParams(p: Partial<LiquidParams>) {
    this.params = { ...this.params, ...p };
  }

  private signature(): string {
    const b = this.boxes
      .map((x) => `${x.cx.toFixed(1)},${x.cy.toFixed(1)},${x.hw},${x.hh},${x.r}`)
      .join("|");
    const br = this.bridges
      .map((x) => `${x.ax.toFixed(1)},${x.ay.toFixed(1)},${x.bx.toFixed(1)},${x.by.toFixed(1)},${x.r}`)
      .join("|");
    const p = this.params;
    return `${b}#${br}#${p.k},${p.cell},${p.smooth}`;
  }

  /** Compute the fused path. Returns the cached result if nothing changed. */
  compute(): LiquidPath {
    const sig = this.signature();
    if (sig === this.sig && this.cachedPath) return this.cachedPath;
    this.sig = sig;

    const shapes: Shape[] = [
      ...this.boxes.map<Shape>((b) => ({
        kind: "box",
        cx: b.cx,
        cy: b.cy,
        hw: b.hw,
        hh: b.hh,
        r: b.r,
      })),
      ...this.bridges,
    ];
    const field = new Field(shapes, this.params.k);
    const opts: MarchOptions = { cell: this.params.cell, smooth: this.params.smooth };
    this.cachedPath = fieldToPath(field, opts);
    return this.cachedPath;
  }

  /** Whether the inputs changed since the last compute() (drives the rAF morph). */
  isDirty(): boolean {
    return this.signature() !== this.sig;
  }
}

```

### liquid/LiquidGroup.tsx

```tsx
"use client";

// The reusable liquid-UI API. Drop cards into a <LiquidGroup> and they FUSE: near
// cards merge with a concave (inverse-rounded) joint, and the whole group is drawn
// as ONE smooth SVG "skin" behind the real, accessible card content.
//
//   <LiquidGroup>
//     <LiquidCard id="a" x={20}  y={20} w={220} h={140}>…</LiquidCard>
//     <LiquidCard id="b" x={210} y={90} w={160} h={120}>…</LiquidCard>
//   </LiquidGroup>
//
// The group reads each card's rect from its props (explicit geometry — no DOM
// measurement, so it morphs cleanly and works on the server), feeds them to the
// LiquidEngine (SDF smooth-union + marching squares), and paints the resulting
// path. Content sits on top in normal flow: selectable text, real <img>, links.
// Turn `k` up for a gooey melt, down for crisp geometric joints; add `bridges` for
// deliberate pipes between distant cards.

import {
  Children,
  isValidElement,
  useMemo,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
} from "react";
import { LiquidEngine, DEFAULT_PARAMS, type LiquidBox } from "./engine";
import type { Bridge } from "./sdf";

export interface LiquidCardProps {
  id: string;
  /** top-left position + size, in the group's local px coordinates */
  x: number;
  y: number;
  w: number;
  h: number;
  /** per-card corner radius (defaults to the group's cardRadius) */
  radius?: number;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}

// LiquidCard is a data+content holder; LiquidGroup reads its props and renders the
// actual positioned box. Rendering it directly (outside a group) just lays the box.
export function LiquidCard(props: LiquidCardProps) {
  const { x, y, w, h, className, style, children } = props;
  return (
    <div
      className={className}
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: w,
        height: h,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export interface LiquidGroupProps {
  children: ReactNode;
  /** Blend amount: low = crisp inverse-rounded joints, high = gooey melt. */
  k?: number;
  /** Default per-card corner radius. */
  cardRadius?: number;
  /** Outline crispness (grid cell px) + smoothing passes. */
  cell?: number;
  smooth?: number;
  /** Explicit pipes between card ids, with an optional width. */
  bridges?: { from: string; to: string; width?: number }[];
  /** Fill of the fused skin (any CSS color / gradient via `fillStyle`). */
  fill?: string;
  fillStyle?: CSSProperties;
  className?: string;
  style?: CSSProperties;
  /** Forwarded onto the skin <svg> for the card→detail view transition. */
  viewTransitionName?: string;
}

type CardEl = ReactElement<LiquidCardProps>;

function isLiquidCard(node: ReactNode): node is CardEl {
  return isValidElement(node) && (node.props as LiquidCardProps).id !== undefined;
}

export function LiquidGroup({
  children,
  k = DEFAULT_PARAMS.k,
  cardRadius = 26,
  cell = DEFAULT_PARAMS.cell,
  smooth = DEFAULT_PARAMS.smooth,
  bridges = [],
  fill = "var(--bg-hover)",
  fillStyle,
  className,
  style,
  viewTransitionName,
}: LiquidGroupProps) {
  const cards = useMemo(
    () => Children.toArray(children).filter(isLiquidCard),
    [children],
  );

  // Build boxes (center-based) + bridge capsules from the card rects, then compute
  // the fused path. useMemo so it only recomputes when geometry / params change.
  const { d, viewBox, skinStyle } = useMemo(() => {
    const boxes: LiquidBox[] = cards.map((c) => {
      const p = c.props;
      return {
        id: p.id,
        cx: p.x + p.w / 2,
        cy: p.y + p.h / 2,
        hw: p.w / 2,
        hh: p.h / 2,
        r: p.radius ?? cardRadius,
      };
    });
    const byId = new Map(boxes.map((b) => [b.id, b]));
    const capsules: Bridge[] = [];
    for (const br of bridges) {
      const a = byId.get(br.from);
      const b = byId.get(br.to);
      if (!a || !b) continue;
      capsules.push({
        kind: "bridge",
        ax: a.cx,
        ay: a.cy,
        bx: b.cx,
        by: b.cy,
        r: br.width ? br.width / 2 : Math.min(a.hh, b.hh) * 0.5,
      });
    }

    const engine = new LiquidEngine();
    engine.setBoxes(boxes);
    engine.setBridges(capsules);
    engine.setParams({ k, cell, smooth });
    const path = engine.compute();

    return {
      d: path.d,
      viewBox: `${path.minX} ${path.minY} ${path.width} ${path.height}`,
      // The <svg> is positioned so its viewBox origin lines up with the group's
      // local (0,0): the path is in group coordinates, and the svg is inset by the
      // negative bounds so the bulge that extends past (0,0) is not clipped.
      skinStyle: {
        position: "absolute" as const,
        left: path.minX,
        top: path.minY,
        width: path.width,
        height: path.height,
        overflow: "visible" as const,
        pointerEvents: "none" as const,
      },
    };
  }, [cards, k, cardRadius, cell, smooth, bridges]);

  return (
    <div className={className} style={{ position: "relative", ...style }}>
      {/* the fused skin, behind the content */}
      <svg
        aria-hidden
        viewBox={viewBox}
        style={{ ...skinStyle, viewTransitionName, ...fillStyle }}
      >
        <path d={d} fill={fill} />
      </svg>
      {/* real card content on top, in normal DOM */}
      {cards}
    </div>
  );
}

```

### liquid/LiquidCard.tsx

```tsx
"use client";

// Re-exported from LiquidGroup, where it's defined alongside the group that reads
// its props. Kept as its own module so it can be imported directly and shown as a
// distinct file in the Vault Code tab.
export { LiquidCard, type LiquidCardProps } from "./LiquidGroup";

```

### liquid/scenes.tsx

```tsx
// The scene data shared by the preview card and the playground, in two sizes.
//
// Why two: the desktop compositions live in a wide fixed-px design space (640×360
// for the card, 720×380 for the playground) that gets CSS-scaled to the container.
// On a phone the container is ~326px wide, so that scale collapses to ~0.45 — the
// whole scene shrinks until the 11px labels render at 5px and the 2px content bars
// land under one device pixel. Rescaling alone can't fix that: a wide landscape
// composition is simply the wrong layout for a narrow screen.
//
// So mobile gets its OWN space (COMPACT_VW×COMPACT_VH), sized so the scale lands
// near 1.0 at phone widths — content then renders at roughly its true design size.
// The pieces are re-placed tighter for the narrower box, and the small "appendage"
// pieces are grown so they clear the ~44px touch minimum when dragged.
//
// The card and the playground MUST agree on which set they use: they share a
// view-transition-name for the card→hero morph, and a mismatch would make the
// shape visibly jump mid-transition.

import type { ReactNode } from "react";

// ── Design spaces ────────────────────────────────────────────────────────────
/** Desktop space for the preview card / hero. */
export const CARD_VW = 640;
export const CARD_VH = 360;
/** Desktop space for the draggable playground stage. */
export const PG_VW = 720;
export const PG_VH = 380;

/** The shared mobile space. 16:9 so it matches the card's aspect exactly, and
 *  small enough that `100cqw / COMPACT_*_DIV` lands near 1.0 on a phone. */
export const COMPACT_VW = 360;
export const COMPACT_VH = 202;

/** Divisors for the CSS `scale: calc(100cqw / N)`. The card divides by the width
 *  of the box the shapes actually occupy (not the full space) so the content
 *  fills the frame; the playground divides by its full width so the whole
 *  draggable area stays reachable. */
export const CARD_DIV = 460;
export const PG_DIV = 720;
// Tuned by eye rather than to a pure fit: at a 1.0 scale the scene filled the frame
// edge to edge and felt cramped, so both divisors are pushed past the exact-fit
// value to leave breathing room. The floor on the playground is the touch target —
// its smallest draggable piece is 60 design-px, and 430 keeps that at ~45 CSS px on
// a 390px phone, just above the ~44px minimum.
export const COMPACT_CARD_DIV = 380;
export const COMPACT_PG_DIV = 430;

/** The breakpoint. Matches Tailwind `sm` (and ImageGalaxyCard's mobile check). */
export const MOBILE_QUERY = "(max-width: 639px)";

// ── Types ────────────────────────────────────────────────────────────────────
export interface ScenePiece {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  radius: number;
  content?: ReactNode;
}

export interface SceneSpec {
  k: number;
  /** Grid cell size for the marching-squares sample, in field units. */
  cell: number;
  pieces: ScenePiece[];
}

/** Everything a consumer needs for one size: the space, the CSS divisors, and
 *  the scenes placed inside that space. */
export interface SceneSet {
  vw: number;
  vh: number;
  cardDiv: number;
  pgDiv: number;
  cardRadius: number;
  /** cycling scenes for the preview card / hero */
  card: SceneSpec[];
  /** presets for the draggable playground */
  playground: SceneSpec[];
}

// ── Content ──────────────────────────────────────────────────────────────────
// Content is authored at two sizes too. Because the whole space is CSS-scaled,
// an 11px label in the desktop space renders at ~5px on a phone — so the mobile
// variants use larger design-px values that land near the intended size once the
// compact scale (~1.0) is applied.

const swatch = "rounded-[6px] bg-[var(--bg-hover)]";

const bar = (w: string, h: string) => (
  <div className={`${h} rounded-full bg-[var(--bg-hover)]`} style={{ width: w }} />
);

/** 2×2 tile grid (the "grid panel" body). */
function GridBody({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`grid h-full grid-cols-2 grid-rows-2 ${compact ? "gap-1.5 p-2 pt-2.5" : "gap-1.5 p-2 pt-2.5"}`}
    >
      <div className={swatch} />
      <div className={swatch} />
      <div className={swatch} />
      <div className={swatch} />
    </div>
  );
}

/** A small text label (the "Grid" / "Share" tab). */
function Label({ children, compact = false, center = false }: { children: ReactNode; compact?: boolean; center?: boolean }) {
  return (
    <div
      className={`flex h-full items-center ${center ? "justify-center pl-1" : "px-3 pb-1"}`}
    >
      <span
        className={`font-semibold text-[var(--text-secondary)] ${compact ? "text-[13px]" : "text-[11px]"}`}
      >
        {children}
      </span>
    </div>
  );
}

/** Avatar + two message lines (the chat bubble body). */
function BubbleBody({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`flex h-full items-center ${compact ? "gap-3 px-4" : "gap-2.5 px-4"}`}>
      <div
        className={`${compact ? "size-10" : "size-9"} shrink-0 rounded-full bg-[var(--bg-hover)]`}
      />
      <div className="flex flex-1 flex-col gap-1.5">
        {bar("80%", compact ? "h-2.5" : "h-2")}
        {bar("55%", compact ? "h-2.5" : "h-2")}
      </div>
    </div>
  );
}

/** Overlapping avatar stack + two lines (the share card body). */
function ShareBody({ compact = false }: { compact?: boolean }) {
  const av = `${compact ? "size-9" : "size-8"} rounded-full border-2 border-[var(--bg-surface)] bg-[var(--bg-hover)]`;
  return (
    <div className="flex h-full items-center gap-3 px-4">
      <div className="flex -space-x-2">
        <div className={av} />
        <div className={av} />
        <div className={av} />
      </div>
      <div className="flex flex-1 flex-col gap-1.5">
        {bar("70%", compact ? "h-2.5" : "h-2")}
        {bar("45%", compact ? "h-2.5" : "h-2")}
      </div>
    </div>
  );
}

/** The search-bar input line. */
function SearchBody({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex h-full items-center px-5">
      {bar("55%", compact ? "h-3" : "h-2.5")}
    </div>
  );
}

/** The magnifier glyph on the search "go" button. */
function SearchIcon({ size = 20 }: { size?: number }) {
  return (
    <div className="flex h-full w-full items-center justify-center text-[var(--text-secondary)]">
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.2-3.2" />
      </svg>
    </div>
  );
}

// ── Desktop scenes ───────────────────────────────────────────────────────────
// The card cycles these three; every scene shares the SAME two ids ("main" +
// "tab") so pieces tween 1:1 and content swaps at the morph midpoint.
const CARD_SCENES: SceneSpec[] = [
  // Grid panel — 2×2 tiles + a "Grid" tab fused at the top-left.
  {
    k: 20,
    cell: 6,
    pieces: [
      { id: "main", x: 170, y: 82, w: 300, h: 196, radius: 22, content: <GridBody /> },
      { id: "tab", x: 178, y: 46, w: 92, h: 46, radius: 18, content: <Label>Grid</Label> },
    ],
  },
  // Chat bubble — avatar + message lines, tail fused at the bottom-right.
  {
    k: 30,
    cell: 6,
    pieces: [
      { id: "main", x: 160, y: 128, w: 300, h: 108, radius: 40, content: <BubbleBody /> },
      { id: "tab", x: 428, y: 206, w: 50, h: 50, radius: 14 },
    ],
  },
  // Share card — avatar stack + a "Share" button fused to the right edge (gooey).
  {
    k: 60,
    cell: 6,
    pieces: [
      { id: "main", x: 150, y: 120, w: 280, h: 116, radius: 26, content: <ShareBody /> },
      { id: "tab", x: 418, y: 151, w: 90, h: 54, radius: 18, content: <Label center>Share</Label> },
    ],
  },
];

// The playground's four presets, hand-placed by dragging in the playground
// itself, in the wider 720×380 stage (absolute coords, no auto-centering).
const PG_SCENES: SceneSpec[] = [
  // 1 · Chat bubble — tail fused at the bottom-right (a sent message).
  {
    k: 28,
    cell: 12,
    pieces: [
      { id: "bubble", x: 188, y: 123, w: 300, h: 116, radius: 40, content: <BubbleBody /> },
      { id: "tail", x: 472, y: 212, w: 52, h: 52, radius: 14 },
    ],
  },
  // 2 · Grid panel — a "Grid" tab fused at the top-left.
  {
    k: 20,
    cell: 12,
    pieces: [
      { id: "tab", x: 178, y: 80, w: 92, h: 46, radius: 18, content: <Label>Grid</Label> },
      { id: "panel", x: 247, y: 104, w: 300, h: 196, radius: 22, content: <GridBody /> },
    ],
  },
  // 3 · Share card — a "Share" button fused to the right edge with a gooey neck.
  {
    k: 77,
    cell: 11,
    pieces: [
      { id: "card", x: 176, y: 131, w: 288, h: 120, radius: 26, content: <ShareBody /> },
      { id: "btn", x: 483, y: 165, w: 96, h: 52, radius: 18, content: <Label center>Share</Label> },
    ],
  },
  // 4 · Search bar — a pill input with a round button fused near the right end.
  {
    k: 20,
    cell: 3,
    pieces: [
      { id: "input", x: 208, y: 167, w: 300, h: 64, radius: 32, content: <SearchBody /> },
      { id: "go", x: 452, y: 132, w: 56, h: 56, radius: 26, content: <SearchIcon /> },
    ],
  },
];

// ── Compact (mobile) scenes ──────────────────────────────────────────────────
// Re-placed for the 360×202 space rather than rescaled: the compositions are
// tighter and more vertical, the bodies are proportionally larger relative to the
// frame, and every draggable appendage is at least 60 design-px so it stays a
// comfortable touch target once the ~1.0 compact scale is applied.
//
// `cell` is raised across the board. It's a grid step in FIELD units, so a small
// cell in a small space oversamples badly — the compact space is ~half the width
// of the desktop one, so the same visual crispness needs roughly half the cell
// count, and the weakest devices are the ones running it.
const COMPACT_CARD_SCENES: SceneSpec[] = [
  // Grid panel — tab tucked at the top-left of the body.
  {
    k: 16,
    cell: 5,
    pieces: [
      { id: "main", x: 76, y: 49, w: 208, h: 132, radius: 20, content: <GridBody compact /> },
      { id: "tab", x: 84, y: 21, w: 78, h: 38, radius: 15, content: <Label compact>Grid</Label> },
    ],
  },
  // Chat bubble — tail fused at the bottom-right.
  {
    k: 22,
    cell: 5,
    pieces: [
      { id: "main", x: 64, y: 62, w: 232, h: 92, radius: 32, content: <BubbleBody compact /> },
      { id: "tab", x: 262, y: 128, w: 46, h: 46, radius: 13 },
    ],
  },
  // Share card — button fused to the right edge (gooey).
  {
    k: 44,
    cell: 5,
    pieces: [
      { id: "main", x: 46, y: 60, w: 210, h: 96, radius: 22, content: <ShareBody compact /> },
      { id: "tab", x: 246, y: 78, w: 74, h: 48, radius: 16, content: <Label compact center>Share</Label> },
    ],
  },
];

const COMPACT_PG_SCENES: SceneSpec[] = [
  // 1 · Chat bubble + tail. The tail is the smallest draggable piece anywhere, so
  //     it sets the floor: 64px keeps it a usable target even on a 320px phone.
  {
    k: 22,
    cell: 6,
    pieces: [
      { id: "bubble", x: 52, y: 56, w: 232, h: 92, radius: 32, content: <BubbleBody compact /> },
      { id: "tail", x: 250, y: 120, w: 64, h: 64, radius: 17 },
    ],
  },
  // 2 · Grid panel + tab. The tab is short by nature, so it's the piece most at risk
  //     of becoming an unusable target — 64 tall keeps it draggable, and the panel
  //     drops to meet it so the pair still reads as a tab fused to a panel.
  {
    k: 16,
    cell: 6,
    pieces: [
      { id: "tab", x: 60, y: 18, w: 92, h: 64, radius: 20, content: <Label compact>Grid</Label> },
      { id: "panel", x: 96, y: 62, w: 204, h: 122, radius: 20, content: <GridBody compact /> },
    ],
  },
  // 3 · Share card + button, gooey neck.
  {
    k: 52,
    cell: 6,
    pieces: [
      { id: "card", x: 40, y: 56, w: 204, h: 100, radius: 22, content: <ShareBody compact /> },
      { id: "btn", x: 242, y: 74, w: 82, h: 64, radius: 20, content: <Label compact center>Share</Label> },
    ],
  },
  // 4 · Search bar + go button, both at the 64px floor.
  {
    k: 16,
    cell: 5,
    pieces: [
      { id: "input", x: 42, y: 80, w: 224, h: 64, radius: 32, content: <SearchBody compact /> },
      { id: "go", x: 238, y: 50, w: 64, h: 64, radius: 29, content: <SearchIcon size={22} /> },
    ],
  },
];

// ── The two sets ─────────────────────────────────────────────────────────────
export const DESKTOP_SET: SceneSet = {
  vw: PG_VW,
  vh: PG_VH,
  cardDiv: CARD_DIV,
  pgDiv: PG_DIV,
  cardRadius: 26,
  card: CARD_SCENES,
  playground: PG_SCENES,
};

export const COMPACT_SET: SceneSet = {
  vw: COMPACT_VW,
  vh: COMPACT_VH,
  cardDiv: COMPACT_CARD_DIV,
  pgDiv: COMPACT_PG_DIV,
  cardRadius: 20,
  card: COMPACT_CARD_SCENES,
  playground: COMPACT_PG_SCENES,
};

/** The card/hero uses its own space (640×360) on desktop but shares the compact
 *  space on mobile — so the two sets differ in `vw`/`vh` for the card path. */
export const CARD_SPACE = { vw: CARD_VW, vh: CARD_VH };
export const COMPACT_CARD_SPACE = { vw: COMPACT_VW, vh: COMPACT_VH };

```

### liquid/playground.tsx

```tsx
"use client";

// Liquid UI playground — drag the pieces and watch the fused skin re-flow: a small
// tab fused to a card keeps a concave (inverse-rounded) joint; pull it away and the
// neck stretches then snaps. Remix MORPHS between real UI objects — a chat bubble, a
// grid panel, a share card, a search bar — tweening every piece + the blend, so it
// pours from one shape into the next instead of snapping. Each preset is hand-placed
// with its own corner radii and tight content. The bottom panel tunes the blend /
// detail live. Built on the same <LiquidGroup> the Code tab ships.
//
// The presets live in scenes.tsx in two sizes. On a phone the 720×380 stage scales
// to ~0.45, which turns the 52px tail into a 24px drag target and the 11px labels
// into 5px — so mobile swaps in a compact stage with larger, re-placed pieces. Every
// coordinate below therefore reads the ACTIVE space (vw/vh) rather than a constant.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LiquidGroup, LiquidCard } from "./LiquidGroup";
import { PG_PREVIEW, PG_PANEL, Slider, SegmentedControl, GhostButton } from "../swirl/controls";
import { SectionLabel } from "../section-label";
import { hapticTap } from "../../lib/haptics";
import { useSceneSet } from "./use-compact";
import { COMPACT_SET, type ScenePiece } from "./scenes";

// Mode presets the blend + grid: geometric = tight blend, fine grid (crisp inverse
// fillets); goo = wide blend (organic melt). The compact space is about half the
// width of the desktop one, so its k (a distance in field units) and cell scale
// down with it — otherwise "Goo" at k=64 would swallow the whole compact scene.
const MODES = [
  { id: "geometric", label: "Geometric", k: 22, cell: 5 },
  { id: "goo", label: "Goo", k: 64, cell: 7 },
];
const COMPACT_MODES = [
  { id: "geometric", label: "Geometric", k: 14, cell: 5 },
  { id: "goo", label: "Goo", k: 42, cell: 6 },
];

// ── Remix morph ──────────────────────────────────────────────────────────────
// Remix doesn't snap to the next preset — it TWEENS every piece to its new spot
// (position, size, radius) and blends k, exactly like the hero card. Presets have
// different ids/order, so we tween by ROLE: the largest card (the main body) morphs
// into the next main body, the smaller one (the appendage) into the next appendage.
const REMIX_MS = 620;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

// order a preset's cards as [main, appendage] by area, so we can tween 1:1.
function byRole(cards: ScenePiece[]): ScenePiece[] {
  return [...cards].sort((a, b) => b.w * b.h - a.w * a.h); // [largest = main, ...smaller]
}
// tween two same-length role-ordered card lists; content comes from whichever side
// dominates (target past the midpoint) so labels swap cleanly.
function tweenCards(from: ScenePiece[], to: ScenePiece[], p: number): ScenePiece[] {
  const a = byRole(from);
  const b = byRole(to);
  return a.map((fc, i) => {
    const tc = b[i] ?? fc;
    const src = p < 0.5 ? fc : tc;
    return {
      id: src.id,
      x: lerp(fc.x, tc.x, p),
      y: lerp(fc.y, tc.y, p),
      w: lerp(fc.w, tc.w, p),
      h: lerp(fc.h, tc.h, p),
      radius: lerp(fc.radius, tc.radius, p),
      content: src.content,
    };
  });
}

export function LiquidPlayground() {
  const set = useSceneSet();
  const compact = set === COMPACT_SET;
  const presets = set.playground;
  const { vw: VW, vh: VH } = set;
  const modes = compact ? COMPACT_MODES : MODES;

  const [presetIdx, setPresetIdx] = useState(0);
  const [cards, setCards] = useState<ScenePiece[]>(() => presets[0].pieces.map((c) => ({ ...c })));
  const [mode, setMode] = useState("");
  const [k, setK] = useState(presets[0].k);
  const [cell, setCell] = useState(presets[0].cell);

  // Crossing the breakpoint swaps the whole coordinate space, so the current cards
  // (placed in the OLD space) are meaningless. Reset during render — the standard
  // "adjust state when a prop changes" pattern — rather than in an effect, which
  // would paint one frame of old-space coordinates in the new space first.
  const [activePresets, setActivePresets] = useState(presets);
  if (activePresets !== presets) {
    setActivePresets(presets);
    setPresetIdx(0);
    setCards(presets[0].pieces.map((c) => ({ ...c })));
    setK(presets[0].k);
    setCell(presets[0].cell);
    setMode("");
  }

  const stageRef = useRef<HTMLDivElement>(null);
  // the scaled VW×VH space; its rect reflects the real transform, so pointer→local
  // mapping stays correct at any container width (and in the compact space).
  const spaceRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: string; dx: number; dy: number } | null>(null);
  // active Remix morph: null when idle. rAF tweens cards + k from → to.
  const morph = useRef<{ from: ScenePiece[]; to: ScenePiece[]; fromK: number; toK: number; start: number; raf: number } | null>(null);

  // The render-phase reset above drops the old cards; this cancels the imperative
  // work that can't be touched during render (an in-flight morph rAF, a live drag).
  useEffect(() => {
    if (morph.current?.raf) cancelAnimationFrame(morph.current.raf);
    morph.current = null;
    drag.current = null;
  }, [presets]);

  // Remix: MORPH to the next UI object (tween every piece + blend), like the hero.
  const remix = () => {
    hapticTap();
    const i = (presetIdx + 1) % presets.length;
    const target = presets[i];
    setPresetIdx(i);
    setMode("");
    setCell(target.cell);

    // cancel any in-flight morph and start a fresh one from the CURRENT pieces
    if (morph.current?.raf) cancelAnimationFrame(morph.current.raf);
    const m = {
      from: cards.map((c) => ({ ...c })),
      to: target.pieces.map((c) => ({ ...c })),
      fromK: k,
      toK: target.k,
      start: 0,
      raf: 0,
    };
    morph.current = m;
    const step = (now: number) => {
      if (!m.start) m.start = now;
      const p = ease(Math.min(1, (now - m.start) / REMIX_MS));
      setCards(tweenCards(m.from, m.to, p));
      setK(Math.round(lerp(m.fromK, m.toK, p)));
      if (p < 1) {
        m.raf = requestAnimationFrame(step);
      } else {
        // land exactly on the target
        setCards(target.pieces.map((c) => ({ ...c })));
        setK(target.k);
        morph.current = null;
      }
    };
    m.raf = requestAnimationFrame(step);
  };

  // stop a running morph if the user grabs a piece or the component unmounts.
  useEffect(() => () => { if (morph.current?.raf) cancelAnimationFrame(morph.current.raf); }, []);

  const applyMode = (id: string) => {
    setMode(id);
    const m = modes.find((x) => x.id === id);
    if (m) {
      setK(m.k);
      setCell(m.cell);
    }
  };

  const toLocal = useCallback(
    (clientX: number, clientY: number) => {
      // map against the SCALED SPACE's rect (not the stage), so the mapping is exact
      // whatever the container width or active space.
      const el = spaceRef.current ?? stageRef.current;
      if (!el) return { x: 0, y: 0 };
      const r = el.getBoundingClientRect();
      return {
        x: ((clientX - r.left) / r.width) * VW,
        y: ((clientY - r.top) / r.height) * VH,
      };
    },
    [VW, VH],
  );

  const onPointerDown = (id: string) => (e: React.PointerEvent) => {
    // grabbing a piece cancels any in-flight Remix morph so it doesn't fight the drag
    if (morph.current?.raf) {
      cancelAnimationFrame(morph.current.raf);
      morph.current = null;
    }
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    const p = toLocal(e.clientX, e.clientY);
    const card = cards.find((c) => c.id === id);
    if (!card) return;
    drag.current = { id, dx: p.x - card.x, dy: p.y - card.y };
    hapticTap();
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const p = toLocal(e.clientX, e.clientY);
    const { id, dx, dy } = drag.current;
    // let a piece hang slightly off-stage, proportional to the space so the compact
    // one doesn't allow a piece to wander half its own width out of frame.
    const slack = VW * 0.055;
    setCards((cs) =>
      cs.map((c) =>
        c.id === id
          ? {
              ...c,
              x: Math.max(-slack, Math.min(VW - c.w + slack, p.x - dx)),
              y: Math.max(-slack, Math.min(VH - c.h + slack, p.y - dy)),
            }
          : c,
      ),
    );
  };
  const endDrag = () => {
    drag.current = null;
  };

  // no explicit bridges in these UI presets — proximity fusing does the joins.
  const groupBridges = useMemo(() => [], []);

  // Blend/detail ranges track the space: k is a distance in field units, so the
  // compact space needs a proportionally smaller ceiling to span the same look.
  const kMax = compact ? 60 : 90;
  const cellMin = compact ? 4 : 3;
  const cellMax = compact ? 10 : 14;

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <SectionLabel action={<GhostButton onClick={remix}>Remix</GhostButton>}>
        Implementation
      </SectionLabel>

      {/* Preview stage — drag the pieces. */}
      <div className={`${PG_PREVIEW} touch-none`}>
        <div
          ref={stageRef}
          className="relative w-full"
          style={{ aspectRatio: `${VW} / ${VH}` }}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <div className="absolute inset-0" style={{ containerType: "size" }}>
            {/* Center-anchored scale (matches LiquidPreviewCard): the fixed VW×VH
                space is pinned to the stage center and scaled to fit its width, so
                it never drifts down-right the way an origin-top-left scale does when
                the container width isn't exactly VW. The divisor is the space's own
                width so the WHOLE draggable area stays visible (the card scales
                tighter, to its content box). */}
            <div
              ref={spaceRef}
              className="absolute left-1/2 top-1/2"
              style={{
                width: VW,
                height: VH,
                transform: "translate(-50%, -50%)",
                transformOrigin: "center",
                scale: `calc(100cqw / ${set.pgDiv})`,
              }}
            >
              <LiquidGroup
                k={k}
                cardRadius={set.cardRadius}
                cell={cell}
                smooth={2}
                bridges={groupBridges}
                fill="var(--bg-surface)"
                className="h-full w-full"
              >
                {cards.map((c) => (
                  <LiquidCard key={c.id} id={c.id} x={c.x} y={c.y} w={c.w} h={c.h} radius={c.radius}>
                    <div
                      onPointerDown={onPointerDown(c.id)}
                      className="h-full w-full cursor-grab active:cursor-grabbing"
                    >
                      {c.content}
                    </div>
                  </LiquidCard>
                ))}
              </LiquidGroup>
            </div>
          </div>
        </div>
      </div>

      {/* Panel */}
      <div className={`${PG_PANEL} gap-3.5`}>
        <SegmentedControl
          options={modes.map((m) => ({ id: m.id, label: m.label }))}
          activeId={mode}
          onPick={applyMode}
          fill
        />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Slider label="Blend" value={k} min={0} max={kMax} step={1}
            format={(v) => `${v}`} onChange={(v) => { setMode(""); setK(v); }} />
          <Slider label="Detail" value={cell} min={cellMin} max={cellMax} step={1}
            format={(v) => `${v}px`} onChange={(v) => { setMode(""); setCell(v); }} />
        </div>
      </div>
    </div>
  );
}

```


16. You are given the complete source for a self-contained web visual: "Fade motion".

What it is:
- Thought this was a blur. It's two hundred copies of the word stacked almost invisibly, and the fade is just where a lot of them piled up.
- Did it the dumb way first, two hundred draws a frame, and it choked exactly when you moved your cursor. Now every pixel just walks back up the trail and counts.

How to use this code:
- It is a React + TypeScript component tree (Next.js App Router) that renders to an HTML canvas; the entry point is the playground component.
- Drop the files into a project under the same relative paths, mount the playground component, and it runs as-is. No external assets beyond what's inline.
- To adapt it: change the resolved word/logo, the color controls, or the experiment parameters. Ask me to modify, explain, or port any part.

The full source follows, one file per block:

### smear/shaders.ts

```ts
// Fade motion shaders (WebGL1 / GLSL ES 1.0).
//
// The Canvas 2D version stamped the word ~210 times and let the copies overlap.
// This does the SAME accumulation, but per-pixel and backwards: for each fragment
// we march UP the trail direction, asking "how many copies of the word would have
// covered me?", and combine them with the identical coverage law
//
//     coverage after k overlapping stamps at alpha a  =  1 - (1-a)^k
//
// Marching backward from the pixel is what makes it one draw call instead of 210:
// the CPU version had to touch every pixel of every copy (~400 blits a frame once
// the chromatic pass kicked in, which is what made moving the cursor — the exact
// moment the pass turned on — the slowest thing the card ever did). Here the cost
// is fixed and independent of the copy count.
//
// Depth is a real perspective divide, same as before: a copy `z` behind the plane
// is scaled by focal/(focal+z) about the anchor. We invert that per step, so the
// trail still tapers and converges toward the vanishing point rather than shearing.

export const FULL_VERT = `
attribute vec2 aPosition;
varying vec2 vUv;
void main() {
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

export const TRAIL_FRAG = `
precision highp float;

varying vec2 vUv;

uniform sampler2D uMask;      // the word, white on transparent
uniform vec2  uResolution;    // drawing buffer size, px
uniform float uAspect;        // w/h

// trail
uniform float uEchoes;        // how many copies to accumulate
uniform float uStep;          // spacing between copies, px @ 620h
uniform float uAlpha;         // per-copy alpha
uniform vec2  uFall;          // trail direction (unit-ish)
uniform float uZStep;         // recession per copy

// magnetism: the trail bends toward the cursor as it falls, hard near the word
// and relaxing back to a straight fall further out.
uniform vec2  uMagnet;        // cursor in uv; only meaningful when uMagnetOn > 0
uniform float uMagnetOn;      // eased 0..1 presence
uniform float uSwing;         // how much the cursor twists the near copies (depth coupling)

// The five layers built on top of the raw accumulation. All of them are pure
// arithmetic inside the sampling loop that was already running — none adds a
// texture fetch, which is the only thing that costs real money in a fill-rate
// bound shader like this one.
uniform float uTurb;          // how much the tail wavers (px @ 620h)
uniform float uSpread;        // how much each copy widens as it falls
uniform float uEdge;          // brightness of the true leading edge
uniform float uFringe;        // per-channel ramp offset -> dispersion at the tail

// camera
uniform vec2  uAnchor;        // word centre in uv
uniform float uYaw;
uniform float uPitch;
uniform float uFocal;

// colour
uniform vec3  uTrailHead;     // hsl-ish resolved rgb at the word
uniform vec3  uTrailTail;     // resolved rgb at the tail
uniform vec3  uBleed;
uniform vec3  uHalo;
uniform vec3  uCore;
uniform vec3  uBg;
uniform vec3  uPoolA;
uniform vec3  uPoolB;
uniform float uPoolAlphaA;
uniform float uPoolAlphaB;
uniform vec3  uVignette;
uniform float uSubtract;      // 1.0 = ink on paper, 0.0 = light on dark
uniform float uSoft;          // strength of the two soft word layers
uniform float uNoise;
uniform float uTime;
uniform vec2  uHaloShift;
uniform vec2  uWordShift;     // the bleed/halo offset that sells directional light

// Sample the word mask at a point on the plane, z units back, with the glyph
// scaled up by grow (1.0 = its own size).
// Forward projection is  p' = anchor + rot(p) * focal/(focal+z)
// so to find which mask texel lands on THIS fragment we undo it.
float maskAt(vec2 uv, float z, float grow) {
  vec2 p = uv - uAnchor;
  p.x *= uAspect;                       // work in square space so the turn is even

  float s = (uFocal + z) / uFocal;      // inverse of the perspective divide
  p *= s;

  // Making the SAMPLED glyph bigger means shrinking the lookup toward the anchor.
  p /= max(0.001, grow);

  // undo the in-plane rotation (yaw about y, pitch about x). The forward pass
  // scales x by cos(yaw) and y by cos(pitch), so invert that.
  float cy = max(0.001, cos(uYaw));
  float cp = max(0.001, cos(uPitch));
  p.x /= cy;
  p.y /= cp;

  p.x /= uAspect;
  vec2 t = p + uAnchor;
  if (t.x < 0.0 || t.x > 1.0 || t.y < 0.0 || t.y > 1.0) return 0.0;
  return texture2D(uMask, t).a;
}

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

void main() {
  vec2 uv = vUv;

  // ── the trail ────────────────────────────────────────────────────────────
  // March backward along the fall direction. Each step is one "copy": if the
  // word covers us at that offset, it contributes one more overlapping stamp.
  //
  // Rather than loop uEchoes times (a dynamic bound, illegal in GLSL ES 1.0,
  // and wasteful), we take a FIXED number of samples spread across the trail and
  // weight each by how many copies it stands in for. The accumulation law is
  // smooth in k, so sampling it coarsely and scaling the exponent is
  // indistinguishable from stamping every copy — and it is a constant cost.
  const int SAMPLES = 48;

  // One authored pixel, in uv. The params are written against a 620px-tall card,
  // so a step of 1.0 means one 620th of the height regardless of the real size —
  // that is what keeps the copies overlapping (and the ramp smooth) at every
  // card size instead of combing apart on a tall one.
  float px = 1.0 / 620.0;
  vec2 fall = uFall * uStep * px;
  float perSample = uEchoes / float(SAMPLES); // copies each sample represents

  // Recession per copy, in the SAME uv units the perspective divide works in.
  // This is the one that has to be normalised: uZStep is authored per-copy in
  // card pixels, and feeding raw pixel counts into focal/(focal+z) drove z to
  // ~115 against a focal of 1.6, a ~70x divide that threw every sample far
  // outside the mask — so nothing was found and the trail vanished entirely.
  float zPer = uZStep * px;

  float dens = 0.0;   // accumulated coverage 0..1
  float ramp = 0.0;   // density-weighted position along the trail, for the hue
  float wsum = 0.0;
  // (A) The lowest copy index that covered this pixel. This is the real leading
  // edge of the exposure — the front face of the whole stack — and it is exact
  // rather than assumed, so it follows the trail wherever the bend and the
  // turbulence put it. The Canvas 2D version could only fake this by brightening
  // the first three copies, which pinned a rim to the word instead of to the
  // actual front of the trail.
  float firstHit = 1e9;

  for (int i = 1; i <= SAMPLES; i++) {
    float fi = float(i) * perSample;           // which copy index this is
    float t  = fi / max(1.0, uEchoes);         // 0 at the word, 1 at the tail

    vec2 off = fall * fi;

    // ── magnetism ─────────────────────────────────────────────────────────
    // The trail bends toward the cursor instead of falling dead straight. The
    // pull grows along the trail (t*t), so the copies nearest the word stay put
    // and the far end swings — which is what makes it read as the trail being
    // ATTRACTED rather than the whole word being dragged. Squared so the bend is
    // a curve, not a kink.
    //
    // Free: the sample offset is already a vector, so this is one multiply-add
    // inside a loop that was going to run anyway. No extra texture fetches, which
    // is the only thing that actually costs anything in here.
    vec2 toCur = uMagnet - uAnchor;
    toCur.x *= uAspect;
    // Attraction falls off with distance, so a cursor parked in the far corner
    // relaxes the trail back to vertical instead of hauling it sideways forever.
    float grip = uMagnetOn / (1.0 + dot(toCur, toCur) * 5.0);
    off += toCur * (t * t * grip * 0.55);

    // ── cursor-coupled depth ──────────────────────────────────────────────
    // The recession already exists per copy; coupling it to the cursor makes the
    // near copies swing further than the far ones, so the stack shears in depth
    // and you get a genuine parallax read out of geometry that was already here.
    // (1-t) weights it toward the word end — the near copies are the ones a real
    // parallax would move most.
    float z = zPer * fi * (1.0 + uSwing * (1.0 - t));

    // ── (C) turbulence ────────────────────────────────────────────────────
    // The tail wavers, the head stays crisp. Two sines at incommensurate rates
    // beating against each other, so it never reads as a clean oscillation.
    //
    // The important part is that the phase advances with fi: the displacement
    // differs from copy to copy, so the trail SNAKES along its length instead of
    // sliding sideways as a rigid shape. Weighted t*t so it is nothing at the
    // word and strongest at the far end, which is how smoke and hot air actually
    // behave — the disturbance has had further to travel.
    float wob = sin(fi * 0.105 + uTime * 1.25)
              * sin(fi * 0.037 - uTime * 0.71 + 2.1);
    off += vec2(wob, wob * 0.35) * (t * t * uTurb * px);

    // ── (E) dissipation ───────────────────────────────────────────────────
    // Each copy is sampled slightly larger than the last, so the trail opens up
    // as it falls rather than staying a constant-width ribbon. A long exposure of
    // something emitting light does spread, and it also softens the hard edges of
    // the tail without any blur — the widening copies overlap less exactly, which
    // is its own kind of falloff.
    float grow = 1.0 + t * uSpread;

    float m = maskAt(uv - off, z, grow);
    if (m > 0.0) {
      // coverage contributed by perSample overlapping copies at uAlpha
      float k = 1.0 - pow(1.0 - uAlpha * m, perSample);
      // composite this band OVER what we already have (same as stacking stamps)
      dens += k * (1.0 - dens);
      ramp += t * k;   // t is this copy's position along the trail
      wsum += k;
      firstHit = min(firstHit, fi);   // (A)
    }
  }
  float q = wsum > 0.0 ? ramp / wsum : 0.0;    // mean position along the ramp

  // (A) The leading edge, from the real first-hit index. Decays fast, so it is a
  // thin bright rim on the front of the exposure rather than a general lift of
  // the head — which is what gives the trail a defined front instead of just
  // fading in from nothing.
  float edge = firstHit < 1.0e8 ? exp(-firstHit * 0.085) * uEdge : 0.0;

  // ── the word itself, three layers ────────────────────────────────────────
  // Sampled at z = 0, on the plane. The two soft layers are nudged AWAY from the
  // pointer so the light reads as directional; the core never moves. Now that
  // maskAt takes a scale, the wide layers ask for a genuinely larger glyph rather
  // than faking size with a second offset sample.
  float bleed = maskAt(uv - uWordShift, 0.0, 1.055);
  float halo  = maskAt(uv - uWordShift * 0.45, 0.0, 1.018);
  float core  = maskAt(uv, 0.0, 1.0);

  // ── the atmosphere pool ──────────────────────────────────────────────────
  vec2 pc = uv - uAnchor - uHaloShift;
  pc.x *= uAspect;
  float pd = length(pc) / 0.52;
  float pool = 1.0 - clamp(pd, 0.0, 1.0);
  pool *= pool;

  // ── compose ──────────────────────────────────────────────────────────────
  // (B) Chromatic fringe. Each channel reads the ramp at a slightly different
  // position, as if the three wavelengths had been exposed for slightly different
  // lengths of trail. Red trails a touch behind and blue runs a touch ahead, so
  // the tail separates into colour exactly where the density is thinnest and the
  // separation is visible — and the dense head stays neutral, because there the
  // ramp is flat and all three land in the same place.
  //
  // Three mixes on values already in registers. The Canvas 2D version bought the
  // same idea with a second ~190-blit pass over the whole trail.
  float qr = clamp(q + uFringe, 0.0, 1.0);
  float qb = clamp(q - uFringe, 0.0, 1.0);
  vec3 trailCol = vec3(
    mix(uTrailHead.r, uTrailTail.r, qr),
    mix(uTrailHead.g, uTrailTail.g, q),
    mix(uTrailHead.b, uTrailTail.b, qb)
  );
  // ── both composites, then blended ────────────────────────────────────────
  // uSubtract is CONTINUOUS, not a boolean, and that is the whole point.
  //
  // The presets alternate dark and light, so nearly every crossfade crosses from
  // additive to subtractive. Branching on uSubtract > 0.5 meant the compositing
  // mode SNAPPED at the midpoint of every transition — and the midpoint is the
  // worst possible moment for it, because the background is then a mid-grey where
  // neither mode looks right. That snap, plus the washed-out middle it sat in, is
  // what made the colour change read as broken rather than as a wash.
  //
  // Evaluating both and mixing costs a handful of ALU ops on values already in
  // registers (no extra texture fetches), and in exchange every frame of the
  // transition is a valid image. uSoft and the trail alpha can now ride the same
  // continuous mix instead of jumping with the mode.
  vec3 add = uBg;
  add += uPoolA * pool * uPoolAlphaA;
  add += uPoolB * pool * uPoolAlphaB;
  add += trailCol * dens;
  // (A) the leading edge, lifted toward the core colour so the front of the
  // exposure reads as the hottest part of the light.
  add += mix(trailCol, uCore, 0.5) * edge * dens;
  add += uBleed * bleed * 0.16 * uSoft;
  add += uHalo  * halo  * 0.32 * uSoft;
  add += uCore  * core  * 0.95;

  // INK ON PAPER. Adding light to near-white blows straight out and the trail
  // vanishes, so the same accumulation has to subtract instead — density of
  // pigment, not emission. Multiply is what keeps the ramp readable.
  vec3 sub = uBg;
  sub = mix(sub, sub * uPoolA, pool * uPoolAlphaA);
  sub = mix(sub, sub * uPoolB, pool * uPoolAlphaB);
  sub *= mix(vec3(1.0), trailCol, dens);
  // (A) on paper the leading edge is the DENSEST ink, not the brightest light —
  // the front of the stroke where the pigment pooled.
  sub *= mix(vec3(1.0), trailCol, edge * dens * 0.5);
  sub *= mix(vec3(1.0), uBleed, bleed * 0.16 * uSoft);
  sub *= mix(vec3(1.0), uHalo,  halo  * 0.32 * uSoft);
  sub *= mix(vec3(1.0), uCore,  core  * 0.95);

  vec3 col = mix(add, sub, uSubtract);

  // ── vignette ─────────────────────────────────────────────────────────────
  vec2 vc = uv - vec2(0.5, 0.45);
  vc.x *= uAspect;
  float vd = clamp((length(vc) - 0.16) / 0.56, 0.0, 1.0);
  col *= mix(vec3(1.0), uVignette, vd);

  // ── (D) grain ────────────────────────────────────────────────────────────
  // Wide soft gradients band badly in 8-bit, so some dither is non-negotiable.
  // But a FLAT layer of it reads as a dirty screen sitting in front of the image.
  // Real film grain lives in the emulsion: it is strongest where the exposure
  // actually happened and nearly absent in untouched shadow. Weighting it by the
  // trail's own density is what turns the dither into part of the photograph —
  // the trail comes out looking exposed rather than drawn.
  //
  // A floor keeps just enough everywhere to kill banding in the pool + vignette.
  // The sign rides uSubtract continuously (grain LIFTS out of shadow on a dark
  // ground, DARKENS on paper) so it passes through zero mid-transition instead of
  // inverting in one frame.
  float n = hash(gl_FragCoord.xy + vec2(uTime * 60.0)) - 0.5;
  float grainAmt = uNoise * (0.35 + 1.5 * max(dens, core));
  col += n * grainAmt * mix(1.0, -1.0, uSubtract);

  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

```

### smear/text-mask.ts

```ts
// Rasterizes the word into a white-on-transparent coverage mask. The shader
// treats the silhouette as the thing being stamped, so this is the only CPU work
// in the whole effect and it happens once per word/size/font, never per frame.
//
// The mask is FULL-CANVAS here, unlike the Canvas 2D version's tight crop. The
// crop existed purely to keep 210 CPU blits affordable; the GPU samples a texture
// by uv, so the shader needs the word positioned in the same space it reads.
//
// The bitmap face has a small cap-height for its point size, so it needs a larger
// request than a normal grotesk to sit at the same optical weight.

/** Where the word's centre sits, as a fraction of height. Leaves the trail room
 *  to fall away below it. Must match the anchor the engine hands the shader. */
export const ANCHOR_Y = 0.42;

export function makeWordMask(
  word: string,
  w: number,
  h: number,
  fontFamily: string,
): HTMLCanvasElement {
  const W = Math.max(1, Math.round(w));
  const H = Math.max(1, Math.round(h));

  const out = document.createElement("canvas");
  out.width = W;
  out.height = H;
  const ctx = out.getContext("2d")!;
  ctx.clearRect(0, 0, W, H);

  const text = (word || "").trim();
  if (!text) return out;

  let size = H * 0.34;
  ctx.font = `400 ${size}px ${fontFamily}`;
  const maxW = W * 0.72;
  const measured = ctx.measureText(text).width;
  if (measured > maxW) {
    size *= maxW / measured;
    ctx.font = `400 ${size}px ${fontFamily}`;
  }

  // Real ink bounds, not the em box — the bitmap face leaves a lot of slack above
  // the ascender, and centring on the em box would put the trail's origin
  // somewhere above the letters instead of through them.
  const m = ctx.measureText(text);
  const asc = m.actualBoundingBoxAscent || size * 0.75;
  const desc = m.actualBoundingBoxDescent || size * 0.25;
  const inkMid = (asc - desc) / 2;

  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(text, W / 2, H * ANCHOR_Y + inkMid);

  return out;
}

/** Measured width of the word at a reference size, used to detect a real font
 *  swap. A CSS var resolves to the same family name whether or not the webfont
 *  file has arrived, so comparing NAMES would look identical before and after
 *  load and skip the one rebuild that matters. */
export function measureWord(word: string, fontFamily: string): number {
  const probe = document.createElement("canvas").getContext("2d");
  if (!probe) return 0;
  probe.font = `400 100px ${fontFamily}`;
  return Math.round(probe.measureText(word).width);
}

```

### smear/engine.ts

```ts
// Fade motion — WebGL1.
//
// A word that trails downward into light. Nothing is blurred and no gradient is
// painted: the trail is pure ACCUMULATION. Coverage after k overlapping copies of
// the word at alpha a is
//
//     1 - (1-a)^k
//
// which is why the falloff is fast at first and then a long tail. That law is the
// effect, and it is unchanged from the Canvas 2D original.
//
// What changed is WHERE it is evaluated. The original stamped the word ~210 times
// per frame with drawImage, and the chromatic pass added ~190 more the instant the
// cursor moved — so moving the cursor, the one moment the card had to be
// responsive, was also the moment it got twice as expensive. Long frames then fed
// straight into the dt-scaled followers, so the word lurched instead of tracking.
// Now the accumulation runs per-pixel in a fragment shader: the fragment marches
// UP the trail and asks how many copies would have covered it. One draw call, cost
// independent of the copy count.
//
// On a dark preset it is LIGHT on a dark ground — the trail is the word's own glow
// smeared, so the stack ADDS. On a light preset the same accumulation runs
// SUBTRACTIVELY, as ink density on paper, because adding light to white blows out
// and leaves nothing to see. Either way it reads as one long exposure rather than
// a stack of shadows.
//
// The pointer FOLLOWS. The word turns to face the cursor and the trail reels in as
// you approach; it does not get shoved around, and a small move produces a small
// turn rather than a smear in the opposite direction.

import { FULL_VERT, TRAIL_FRAG } from "./shaders";
import { makeWordMask, measureWord, ANCHOR_Y } from "./text-mask";

export interface FadeParams {
  /** how many copies build the trail */
  echoes: number;
  /** distance between copies, px at a 620px-tall card */
  step: number;
  /** per-copy alpha; the trail builds from overlap, so this stays low */
  alpha: number;
  /** trail direction in radians. 90deg = straight down. */
  angle: number;
  /** how far the hue travels from the word to the end of the trail, degrees */
  hueShift: number;
  /** how much the tail wavers, px at a 620px-tall card. 0 = a rigid trail. */
  turbulence: number;
  /** how much each copy widens as it falls. 0 = a constant-width ribbon. */
  spread: number;
  /** brightness of the trail's true leading edge */
  edge: number;
  /** per-channel offset into the trail ramp — the dispersion at the tail */
  fringe: number;
}

export const DEFAULTS: FadeParams = {
  // Many copies at a near-1px step. Spacing them further apart makes each copy
  // land clear of the last, which reads as stacked ghosts rather than one
  // continuous ramp — the accumulation only works when they overlap heavily.
  echoes: 210,
  step: 1.0,
  alpha: 0.019,
  angle: Math.PI / 2, // straight down
  hueShift: 26,
  // Enough waver to make the tail feel like it is moving through air, well short
  // of the point where the trail stops reading as one continuous stroke.
  //
  // 16 puts about 50px of swing on the tail of a 1344px card, against a trail a
  // few hundred px wide — so the edge of the stroke visibly breathes while the
  // body of it stays coherent. The phase advances per copy (see the shader), so
  // this is the amplitude of a SNAKE along the trail, not a sideways slide of the
  // whole thing; at 9 the undulation was there but too fine to read at all.
  turbulence: 16,
  // A gentle opening. Past ~0.5 the copies overlap so loosely that the ramp
  // starts to look soft rather than dense.
  spread: 0.22,
  edge: 0.5,
  // Small on purpose: this is a fringe at the thin end of the ramp, not a
  // 3D-glasses split. Above ~0.1 it stops reading as dispersion and starts
  // reading as a mistake.
  fringe: 0.045,
};

/** Lowercase, in the site face. The source used shouty uppercase; lowercase sits
 *  far better with the rest of the page and the descenders give the trail
 *  something more interesting to start from. */
const WORD = "motion";

/**
 * A colour preset.
 *
 * `mode` is the load-bearing field, not a style detail. On a dark ground the
 * copies ADD and the trail is light the word emits. On a light ground adding
 * light to near-white paper blows straight out and the trail disappears entirely
 * — so a light preset has to treat the trail as PIGMENT and subtract instead.
 * Same accumulation maths, inverted output. Without that flag a "light mode" is
 * just a washed-out dark mode with an invisible trail.
 */
export interface Palette {
  name: string;
  mode: "add" | "subtract";
  /** page behind everything */
  bg: string;
  /** trail ramp: hue/sat/light at the word, and how each travels to the tail */
  trail: {
    hue: number;
    sat: number;
    light: number;
    dHue: number;
    dSat: number;
    dLight: number;
  };
  /** the three word layers: wide bleed, tight halo, hot core */
  bleed: string;
  halo: string;
  core: string;
  /** the atmosphere pool behind the word */
  pool: [string, string];
  /** vignette edge colour (centre is untouched — it multiplies) */
  vignette: string;
  /**
   * Scales the per-copy alpha for this preset.
   *
   * Subtractive presets need this well below 1. Additive accumulation saturates
   * toward white gracefully, but multiplicative accumulation COMPOUNDS: at the
   * shared 0.019 the paper is driven to 2% by the last copy, so the dense end
   * becomes a flat black slab and the whole accumulation curve — the actual
   * effect — is clipped away. About a third of that keeps the ramp intact.
   */
  alphaScale: number;
}

export const PALETTES: Palette[] = [
  {
    // Dark first — this is the card's resting identity.
    name: "Afterglow",
    mode: "add",
    bg: "#0b0e0c",
    trail: { hue: 132, sat: 46, light: 52, dHue: 26, dSat: -14, dLight: -26 },
    bleed: "hsl(150 45% 40%)",
    halo: "hsl(146 60% 62%)",
    core: "hsl(140 34% 93%)",
    pool: ["rgba(94,214,138,0.16)", "rgba(58,150,110,0.06)"],
    vignette: "#6b7a70",
    alphaScale: 1,
  },
  {
    name: "Graphite",
    mode: "subtract",
    bg: "#ffffff",
    // Denser and longer-travelling than the dark presets: on paper the ink has to
    // do all the work the glow does on black, so it starts darker and lifts further.
    trail: { hue: 250, sat: 14, light: 26, dHue: 8, dSat: -8, dLight: 54 },
    bleed: "hsl(250 16% 58%)",
    halo: "hsl(252 24% 34%)",
    // Not black — a deep indigo reads as chosen where pure black reads default.
    core: "hsl(254 46% 13%)",
    pool: ["rgba(120,120,170,0.07)", "rgba(120,120,170,0.02)"],
    // Barely tinted. A grey vignette multiplies white paper into a dirty wash and
    // the trail's tail vanishes into it — on light presets this has to stay within
    // a couple of percent of the page.
    vignette: "#f6f5fa",
    alphaScale: 0.42,
  },
  {
    name: "Amber",
    mode: "add",
    bg: "#0d0906",
    trail: { hue: 32, sat: 78, light: 52, dHue: -14, dSat: -18, dLight: -28 },
    bleed: "hsl(28 70% 42%)",
    halo: "hsl(36 88% 62%)",
    core: "hsl(44 60% 94%)",
    pool: ["rgba(255,168,66,0.16)", "rgba(168,96,28,0.06)"],
    vignette: "#7a6a56",
    alphaScale: 1,
  },
  {
    name: "Cyanotype",
    mode: "subtract",
    bg: "#fdfeff",
    trail: { hue: 205, sat: 58, light: 30, dHue: -12, dSat: -18, dLight: 52 },
    bleed: "hsl(205 46% 56%)",
    halo: "hsl(206 64% 32%)",
    core: "hsl(210 82% 15%)",
    pool: ["rgba(64,132,196,0.08)", "rgba(64,132,196,0.025)"],
    vignette: "#f2f7fb",
    alphaScale: 0.42,
  },
  {
    name: "Ultramarine",
    mode: "add",
    bg: "#07090f",
    trail: { hue: 224, sat: 64, light: 54, dHue: 26, dSat: -16, dLight: -30 },
    bleed: "hsl(228 58% 44%)",
    halo: "hsl(220 78% 66%)",
    core: "hsl(210 46% 94%)",
    pool: ["rgba(96,150,255,0.16)", "rgba(48,80,180,0.06)"],
    vignette: "#606a86",
    alphaScale: 1,
  },
  {
    name: "Rust",
    mode: "subtract",
    bg: "#fffdfa",
    trail: { hue: 16, sat: 52, light: 32, dHue: 16, dSat: -20, dLight: 52 },
    bleed: "hsl(20 42% 58%)",
    halo: "hsl(16 56% 34%)",
    core: "hsl(10 66% 17%)",
    pool: ["rgba(198,110,70,0.08)", "rgba(198,110,70,0.025)"],
    vignette: "#fbf3ec",
    alphaScale: 0.42,
  },
  {
    name: "Split",
    mode: "add",
    bg: "#0a070c",
    // hue travels a long way, so the head and tail land on opposite sides of the
    // wheel and the trail reads as two colours bleeding through each other
    trail: { hue: 318, sat: 62, light: 54, dHue: -132, dSat: -8, dLight: -26 },
    bleed: "hsl(320 56% 44%)",
    halo: "hsl(318 76% 66%)",
    core: "hsl(300 34% 94%)",
    pool: ["rgba(232,96,208,0.15)", "rgba(72,120,190,0.07)"],
    vignette: "#786080",
    alphaScale: 1,
  },
];

/** How long a palette crossfade takes.
 *
 *  0.34s against the 2s hero cycle: the change is over quickly and the card then
 *  sits on a clean preset for ~83% of each period. Earlier passes at 1.1s and
 *  0.75s were mid-wash for half the time or more, which is what made the cycling
 *  feel sluggish and indecisive — you never saw a colour world, you only ever saw
 *  it turning into the next one. Fast and complete beats slow and permanent. */
const FADE_SECONDS = 0.34;

/** Focal length for the perspective divide, in units of canvas height. Lower is a
 *  wider lens and a stronger taper. Around 1.6 reads like a real lens: enough
 *  convergence to feel dimensional, not so much that it fisheyes. */
const FOCAL = 1.6;

/** Caps on the eased lean, set by setPointer. */
const LEAN_X_MAX = 0.21;
const LEAN_Y_MAX = 0.12;

/** How far the atmosphere pool tracks the pointer, as a fraction of the canvas.
 *  Kept close to the word's own travel: much further and the light source and the
 *  lit object visibly parallax apart. */
const HALO_TRACK_X = 0.07;
const HALO_TRACK_Y = 0.08;

/** The bitmap face. Its hard pixel edges are the reason it suits this: every copy
 *  in the trail keeps a crisp stair-stepped silhouette, so the accumulation stays
 *  legible instead of blurring into a smudge. */
const PIXEL_FONT = "var(--font-mondwest)";

/** Canvas 2D `ctx.font` cannot parse a CSS var() — resolve it to a real family
 *  name once. */
function resolveFamily(cssFamily: string): string {
  const probe = document.createElement("span");
  probe.style.cssText = "position:absolute;visibility:hidden";
  probe.style.fontFamily = cssFamily;
  document.body.appendChild(probe);
  const fam = getComputedStyle(probe).fontFamily || "sans-serif";
  probe.remove();
  return fam;
}

/** A `document.fonts.load` spec for the face this card draws in, so callers can
 *  warm it before the first mask build. */
export function pixelFontSpec(): string {
  return `400 100px ${resolveFamily(PIXEL_FONT)}`;
}

// ── colour helpers ──────────────────────────────────────────────────────────
type RGB = [number, number, number];

function hslToRgb(h: number, s: number, l: number): RGB {
  h = ((h % 360) + 360) % 360;
  s = Math.max(0, Math.min(100, s)) / 100;
  l = Math.max(0, Math.min(100, l)) / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) =>
    l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0), f(8), f(4)];
}

/** Parse the hex / hsl() / rgba() forms the palettes are authored in. Returns
 *  linear-ish 0..1 rgb plus the alpha the source carried (1 when it had none). */
function parseColor(c: string): { rgb: RGB; a: number } {
  const s = c.trim();
  if (s.startsWith("#")) {
    let h = s.slice(1);
    if (h.length === 3) h = h.split("").map((x) => x + x).join("");
    return {
      rgb: [
        parseInt(h.slice(0, 2), 16) / 255,
        parseInt(h.slice(2, 4), 16) / 255,
        parseInt(h.slice(4, 6), 16) / 255,
      ],
      a: 1,
    };
  }
  const hsl = s.match(/^hsl\(\s*([-\d.]+)\s+([\d.]+)%\s+([\d.]+)%\s*\)$/);
  if (hsl) {
    return { rgb: hslToRgb(+hsl[1], +hsl[2], +hsl[3]), a: 1 };
  }
  const rgba = s.match(
    /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/,
  );
  if (rgba) {
    return {
      rgb: [+rgba[1] / 255, +rgba[2] / 255, +rgba[3] / 255],
      a: rgba[4] !== undefined ? +rgba[4] : 1,
    };
  }
  return { rgb: [1, 1, 1], a: 1 };
}

/**
 * A palette with every colour already parsed to numbers.
 *
 * The palettes are authored as CSS strings because that is how a person reads
 * them, but re-parsing ten strings on every frame to crossfade between two of
 * them would be pure waste. Each preset is resolved once, cached, and then the
 * blend is plain arithmetic on floats.
 */
interface ResolvedPalette {
  /** 0 = fully additive (light on dark), 1 = fully subtractive (ink on paper).
   *  A NUMBER, not an enum, so a crossfade between a dark and a light preset can
   *  pass continuously through the middle — the shader evaluates both composites
   *  and mixes by this. */
  subtract: number;
  bg: RGB;
  head: RGB;
  tail: RGB;
  bleed: RGB;
  halo: RGB;
  core: RGB;
  poolA: RGB;
  poolB: RGB;
  poolAlphaA: number;
  poolAlphaB: number;
  vignette: RGB;
  alphaScale: number;
}

const resolvedCache = new Map<string, ResolvedPalette>();

/** Resolve one palette, including its trail ramp endpoints at a given hue travel. */
function resolve(pal: Palette, hueTravel: number): ResolvedPalette {
  const key = `${pal.name}|${hueTravel.toFixed(2)}`;
  const hit = resolvedCache.get(key);
  if (hit) return hit;
  const T = pal.trail;
  const pa = parseColor(pal.pool[0]);
  const pb = parseColor(pal.pool[1]);
  const out: ResolvedPalette = {
    subtract: pal.mode === "subtract" ? 1 : 0,
    bg: parseColor(pal.bg).rgb,
    head: hslToRgb(T.hue, T.sat, T.light),
    tail: hslToRgb(T.hue + hueTravel, T.sat + T.dSat, T.light + T.dLight),
    bleed: parseColor(pal.bleed).rgb,
    halo: parseColor(pal.halo).rgb,
    core: parseColor(pal.core).rgb,
    poolA: pa.rgb,
    poolB: pb.rgb,
    poolAlphaA: pa.a,
    poolAlphaB: pb.a,
    vignette: parseColor(pal.vignette).rgb,
    alphaScale: pal.alphaScale,
  };
  resolvedCache.set(key, out);
  return out;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerp3 = (a: RGB, b: RGB, t: number): RGB => [
  lerp(a[0], b[0], t),
  lerp(a[1], b[1], t),
  lerp(a[2], b[2], t),
];

/**
 * Blend two resolved palettes. EVERY field interpolates — nothing snaps.
 *
 * This used to switch `mode` and `alphaScale` at the midpoint, on the theory that
 * a hard flip would hide there. It does not. The presets alternate dark and light,
 * so nearly every transition crossed a mode boundary, and the midpoint is the
 * worst place to flip: the background is a mid-grey where neither compositing mode
 * looks right, so the change read as a pop inside a washed-out middle. The shader
 * now evaluates both composites and mixes by `subtract`, which lets this be a
 * plain lerp like everything else.
 */
function blend(a: ResolvedPalette, b: ResolvedPalette, t: number): ResolvedPalette {
  return {
    subtract: lerp(a.subtract, b.subtract, t),
    alphaScale: lerp(a.alphaScale, b.alphaScale, t),
    bg: lerp3(a.bg, b.bg, t),
    head: lerp3(a.head, b.head, t),
    tail: lerp3(a.tail, b.tail, t),
    bleed: lerp3(a.bleed, b.bleed, t),
    halo: lerp3(a.halo, b.halo, t),
    core: lerp3(a.core, b.core, t),
    poolA: lerp3(a.poolA, b.poolA, t),
    poolB: lerp3(a.poolB, b.poolB, t),
    poolAlphaA: lerp(a.poolAlphaA, b.poolAlphaA, t),
    poolAlphaB: lerp(a.poolAlphaB, b.poolAlphaB, t),
    vignette: lerp3(a.vignette, b.vignette, t),
  };
}

const UNIFORMS = [
  "uMask", "uResolution", "uAspect",
  "uEchoes", "uStep", "uAlpha", "uFall", "uZStep",
  "uMagnet", "uMagnetOn", "uSwing",
  "uTurb", "uSpread", "uEdge", "uFringe",
  "uAnchor", "uYaw", "uPitch", "uFocal",
  "uTrailHead", "uTrailTail", "uBleed", "uHalo", "uCore", "uBg",
  "uPoolA", "uPoolB", "uPoolAlphaA", "uPoolAlphaB",
  "uVignette", "uSubtract", "uSoft", "uNoise", "uTime",
  "uHaloShift", "uWordShift",
] as const;

export class FadeMotion {
  private host: HTMLElement;
  private canvas: HTMLCanvasElement;
  private gl: WebGLRenderingContext | null = null;
  private prog: WebGLProgram | null = null;
  private quad: WebGLBuffer | null = null;
  private loc: Record<string, WebGLUniformLocation | null> = {};

  private mask: WebGLTexture | null = null;

  readonly params: FadeParams = { ...DEFAULTS };

  /** which preset is showing; remix advances it */
  private paletteIdx = 0;
  /** The preset being crossfaded FROM, and how far through (1 = settled). */
  private fadeFrom = 0;
  private fadeMix = 1;

  // ── hero mode ───────────────────────────────────────────────────────────
  // Off by default. The playground stays a single static preset driven by a real
  // cursor; only the hero card runs itself.
  private hero = false;
  /** seconds until the next palette change */
  private cycleT = 0;
  /** The fake cursor. Hero mode drives `ptr` from this, so every reaction the
   *  real pointer triggers — the turn, the reach, the magnetism, the depth swing
   *  — comes along for free rather than being re-implemented. */
  private ghostX = 0.5;
  private ghostY = ANCHOR_Y;
  /** True only for a REAL pointer. The ghost writes `ptr` so it reuses the whole
   *  reaction chain, which means `ptr` alone can no longer answer "is someone
   *  actually hovering" — and without this distinction the ghost would latch
   *  `ptr` on forever and the release-to-drift behaviour would never fire again. */
  private realPtr = false;

  /** eased pointer lean */
  private leanX = 0;
  private leanY = 0;
  private leanTargetX = 0;
  private leanTargetY = 0;

  /** `near` is 1 at the word and 0 at the far corner. Drives trail LENGTH. */
  private near = 0;
  private nearTarget = 0;

  /** Live pointer position in 0..1, or null. Held so the per-frame step can
   *  recompute targets without needing a fresh event — a hand held still fires no
   *  pointermove at all, and the old code only ever updated on an event. */
  private ptr: { x: number; y: number } | null = null;

  /** Eased cursor position the magnetism pulls toward, and its eased presence.
   *  Followed rather than used raw: the bend arriving a beat after your hand is
   *  what makes the trail feel like it has mass being pulled, instead of a shape
   *  welded to the cursor. Presence fades so leaving relaxes the curve out rather
   *  than dropping it. */
  private magX = 0.5;
  private magY = ANCHOR_Y;
  private magOn = 0;

  /** 0 = fully pointer-driven, 1 = fully autonomous. Eased, never switched. */
  private idleMix = 1;
  /** measured width of WORD at 100px, to detect a real font swap */
  private lastFontWidth = 0;
  /** Drift clock, in seconds. Only advances while the drift is being mixed in, so
   *  the word cannot crawl away from a held-still cursor. */
  private t = 0;
  /** Wall clock, in seconds. ALWAYS advances. Anything that should keep living
   *  while you hover — the grain, the trail's turbulence — has to run off this,
   *  not off the drift clock: `t` is frozen under a hover by design, and driving
   *  the grain from it meant the film stopped moving the instant you touched the
   *  card. Two clocks because they answer two different questions. */
  private tReal = 0;

  private raf = 0;
  private last = 0;
  private running = false;
  private dpr = 1;
  private ro: ResizeObserver | null = null;
  private disposed = false;
  private fontFamily = "sans-serif";

  // mask rebuild guards
  private builtW = 0;
  private builtH = 0;
  private builtFont = "";

  constructor(host: HTMLElement, fontFamily?: string) {
    this.host = host;
    this.fontFamily = fontFamily ?? resolveFamily(PIXEL_FONT);
    this.canvas = document.createElement("canvas");
    this.canvas.style.cssText = "display:block;width:100%;height:100%";
    host.appendChild(this.canvas);

    const gl = this.canvas.getContext("webgl", {
      alpha: false,
      antialias: false,
      premultipliedAlpha: false,
    });
    if (!gl) return;
    this.gl = gl;

    try {
      this.prog = this.build(FULL_VERT, TRAIL_FRAG);
    } catch {
      this.gl = null;
      return;
    }
    for (const u of UNIFORMS) {
      this.loc[u] = gl.getUniformLocation(this.prog, u);
    }

    // full-screen triangle
    this.quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW,
    );

    const bg = parseColor(this.palette.bg).rgb;
    gl.clearColor(bg[0], bg[1], bg[2], 1);

    this.resize();
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(host);
  }

  get ok() {
    return !!this.gl && !!this.prog;
  }

  private build(vs: string, fs: string): WebGLProgram {
    const gl = this.gl!;
    const c = (type: number, src: string) => {
      const sh = gl.createShader(type)!;
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        throw new Error(gl.getShaderInfoLog(sh) || "compile failed");
      }
      return sh;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, c(gl.VERTEX_SHADER, vs));
    gl.attachShader(prog, c(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(prog) || "link failed");
    }
    return prog;
  }

  /** Rasterize the word and upload it. The only CPU work in the effect, and it
   *  runs once per size/font rather than per frame. */
  private buildMask() {
    const gl = this.gl;
    if (!gl || this.disposed) return;
    const W = this.canvas.width;
    const H = this.canvas.height;
    if (!W || !H) return;
    if (W === this.builtW && H === this.builtH && this.fontFamily === this.builtFont) {
      return;
    }
    this.builtW = W;
    this.builtH = H;
    this.builtFont = this.fontFamily;

    const art = makeWordMask(WORD, W, H, this.fontFamily);
    if (!this.mask) this.mask = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.mask);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    // The shader's uv origin is bottom-left; the 2D canvas draws top-down.
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, art);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  }

  private resize() {
    const gl = this.gl;
    if (!gl || this.disposed) return;
    const w = this.host.clientWidth;
    const h = this.host.clientHeight;
    if (!w || !h) return;
    // Capped at 1.5: the shader is fill-rate bound (48 texture fetches a
    // fragment), so pixel count is the one thing that actually costs here.
    this.dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const cw = Math.round(w * this.dpr);
    const ch = Math.round(h * this.dpr);
    if (this.canvas.width !== cw || this.canvas.height !== ch) {
      this.canvas.width = cw;
      this.canvas.height = ch;
      gl.viewport(0, 0, cw, ch);
      this.buildMask();
    }
    if (!this.running) this.draw(0);
  }

  setParams(p: Partial<FadeParams>) {
    Object.assign(this.params, p);
    if (!this.running) this.draw(0);
  }

  /** Re-rasterize once the real face has loaded.
   *
   *  The mask is laid out from whatever `measureText` reports at build time, so
   *  if the bitmap face has not arrived yet the word is sized to the fallback's
   *  metrics and stays wrong forever. That only bites on a cold reload, when the
   *  font is not yet in cache, which is exactly when it showed up.
   *
   *  Callers fire this from both `fonts.load()` and `fonts.ready`, so it lands
   *  twice on a cold load. The guard compares MEASURED WIDTH, not the family
   *  name: a CSS var resolves to the same name whether or not the webfont file
   *  has arrived, so a name check would look identical before and after load and
   *  skip the one rebuild that matters. */
  refreshFonts() {
    if (this.disposed || !this.gl) return;
    this.fontFamily = resolveFamily(PIXEL_FONT);
    const w = measureWord(WORD, this.fontFamily);
    if (this.mask && w === this.lastFontWidth) return;
    this.lastFontWidth = w;
    // force a rebuild even though the canvas size has not changed
    this.builtFont = "";
    this.buildMask();
    if (!this.running) this.draw(0);
  }

  /** Pointer in 0..1 relative to the host; null releases it to the idle drift. */
  setPointer(p: { x: number; y: number } | null) {
    if (!p) {
      // Only drop the pointer. The lean targets are deliberately LEFT where the
      // cursor put them: step() cross-fades from them to the drift, so they are
      // the "from" side of the blend. Zeroing them here would reintroduce the
      // jump the fade exists to remove.
      this.ptr = null;
      this.realPtr = false;
      return;
    }
    this.ptr = { x: p.x, y: p.y };
    this.realPtr = true;
    // Targets are recomputed here AND every frame from `ptr` (see step), because
    // a hand held perfectly still fires no pointermove — event-only updates were
    // why the word drifted off a stationary cursor.
    this.applyPointerTargets();
  }

  /** Derive the lean + reach targets from the live pointer position. */
  private applyPointerTargets() {
    const p = this.ptr;
    if (!p) return;
    // A small turn only. With a real perspective divide a little rotation buys a
    // lot of read — the taper does the work, so the angle does not have to.
    this.leanTargetX = (p.x - 0.5) * 0.42;
    this.leanTargetY = (p.y - 0.5) * 0.24;
    // Distance from the word's anchor, normalised so the far corner is ~1. Drives
    // trail LENGTH: close in the trail pulls tight, out at the edge it streams.
    const dx = p.x - 0.5;
    const dy = p.y - ANCHOR_Y;
    this.nearTarget = 1 - Math.min(1, Math.hypot(dx, dy) / 0.62);
  }

  /** Remix: crossfade to the next colour preset. */
  next() {
    // Start the new fade from whatever is CURRENTLY on screen. If a fade is still
    // running, its midpoint blend is the honest starting point — snapping back to
    // the previous preset's endpoint would pop, which is exactly what a spammed
    // remix used to do.
    this.fadeFrom = this.paletteIdx;
    this.fadeMix = this.fadeMix >= 1 ? 0 : this.fadeMix;
    this.paletteIdx = (this.paletteIdx + 1) % PALETTES.length;
    if (!this.running) this.draw(0);
  }

  /**
   * Hero mode: the card runs itself.
   *
   * A ghost cursor moves over it and the palette changes on a timer. Used for the
   * Vault card and the detail hero, where there may be no pointer at all — a
   * static card would show none of what makes this thing worth looking at.
   *
   * A real pointer still wins: `setPointer` overrides the ghost while it is
   * present, so hovering the hero takes control rather than fighting it.
   */
  enableHero(cyclePeriod = 2) {
    this.hero = true;
    this.cyclePeriod = cyclePeriod;
    this.cycleT = cyclePeriod;
  }
  private cyclePeriod = 2;

  get palette(): Palette {
    return PALETTES[this.paletteIdx % PALETTES.length];
  }

  /** The background currently on screen, as a CSS rgb() string, blend included.
   *  Lets the host element track the canvas so the card's frame and its art change
   *  together — otherwise the box stays one fixed grey while the picture inside it
   *  recolours, and the two visibly disagree during every transition. */
  get bgCss(): string {
    const c = this.lastBg;
    return `rgb(${Math.round(c[0] * 255)} ${Math.round(c[1] * 255)} ${Math.round(c[2] * 255)})`;
  }
  private lastBg: RGB = [0, 0, 0];
  /** Called with the live background each frame; the card subscribes to restyle. */
  onBg: ((css: string) => void) | null = null;

  private step(dt: number) {
    // ── hero mode: the ghost cursor ───────────────────────────────────────
    // Imitating someone flicking the card around quickly but lightly. The brief
    // is FAST and WEAK, which are opposite ends of the same knob, so it is built
    // from high frequencies at small amplitudes rather than from one slow sweep
    // scaled down.
    //
    // Three incommensurate sines per axis. Their periods share no common factor,
    // so the path never closes into a loop the eye can learn — the giveaway that
    // something is automated is repetition, not speed. The amplitudes fall as the
    // frequencies rise, which is how real hand jitter is distributed: big
    // movements are slow, small ones are quick.
    //
    // It stays inside a tight box around the word (about a fifth of the card)
    // because a ghost that roams the full frame reads as a demo playing itself,
    // while one that fidgets near the word reads as someone actually toying with
    // it. Only advances while unattended, so a real pointer taking over does not
    // fight a ghost that kept moving underneath.
    if (this.hero && !this.realPtr) {
      const g = this.tReal;
      const gx =
        0.55 * Math.sin(g * 2.30) +
        0.30 * Math.sin(g * 3.70 + 1.1) +
        0.15 * Math.sin(g * 6.10 + 0.4);
      const gy =
        0.55 * Math.cos(g * 1.90 + 2.1) +
        0.30 * Math.sin(g * 4.30 + 0.5) +
        0.15 * Math.cos(g * 7.30 + 1.7);
      // 0.20 / 0.13 of the card, centred on the word's own anchor.
      this.ghostX = 0.5 + gx * 0.20;
      this.ghostY = ANCHOR_Y + gy * 0.13;
      this.ptr = { x: this.ghostX, y: this.ghostY };
      this.applyPointerTargets();
    }

    const hasPointer = !!this.ptr;

    // The cross-fade between pointer control and the autonomous drift.
    //
    // ASYMMETRIC, and this is the important part. Taking over is fast (~0.07s);
    // handing back is slow (~1.4s). A slow takeover meant that for the first
    // half-second of a hover the blend was still mostly DRIFT, so the card kept
    // wandering while the cursor was already on it and clearly not being
    // followed. The pointer has to win essentially at once; only letting go
    // should be gradual, because that is the direction where a fast change would
    // look like a snap.
    const mixTarget = hasPointer ? 0 : 1;
    const mixRate = hasPointer ? 26 : 0.7;
    this.idleMix += (mixTarget - this.idleMix) * Math.min(1, dt * mixRate);
    // Land it exactly, so a residual 0.001 of drift can't keep nudging a word
    // that is supposed to be locked to a stationary cursor.
    if (hasPointer && this.idleMix < 0.002) this.idleMix = 0;

    // The drift clock only advances while the drift is actually being mixed in.
    // Freezing it under a hover is what stops the word crawling away from a
    // held-still cursor, and because it resumes from where it stopped the
    // handover stays continuous — the drift never jumps, it just pauses.
    this.t += dt * this.idleMix;
    this.tReal += dt;

    // Re-derive from the live pointer every frame. pointermove does not fire for
    // a stationary hand, so anything that only updated on events went stale.
    this.applyPointerTargets();

    const m = this.idleMix;
    const driftX = Math.sin(this.t * 0.23) * 0.13;
    const driftY = Math.sin(this.t * 0.31 + 1.7) * 0.07;
    const driftN = 0.22 + Math.sin(this.t * 0.17) * 0.1;
    const tx = this.leanTargetX * (1 - m) + driftX * m;
    const ty = this.leanTargetY * (1 - m) + driftY * m;
    const tn = this.nearTarget * (1 - m) + driftN * m;

    // Frame-rate independent easing. The old form, `v += (target-v) * dt * rate`,
    // is only an approximation of exponential decay and its effective time
    // constant changes with frame length — so a long frame overshot and a short
    // one crawled, which is what made the motion feel like it was lurching
    // rather than tracking. 1-exp(-rate*dt) is the exact solution and behaves
    // identically at any frame rate.
    const ease = (rate: number) => 1 - Math.exp(-rate * dt);

    // Tight while the pointer is on the card, slack once it leaves so the return
    // to drift is a settle rather than a retreat.
    const k = ease(hasPointer ? 16 : 2.2);
    this.leanX += (tx - this.leanX) * k;
    this.leanY += (ty - this.leanY) * k;
    this.near += (tn - this.near) * ease(hasPointer ? 12 : 1.8);

    // Clamp to the documented caps so the halo padding derived from them holds.
    this.leanX = Math.max(-LEAN_X_MAX, Math.min(LEAN_X_MAX, this.leanX));
    this.leanY = Math.max(-LEAN_Y_MAX, Math.min(LEAN_Y_MAX, this.leanY));

    // The magnet target. Slower than the lean (7 vs 16) on purpose: the word
    // turning to face you should feel immediate, but the trail bending after it
    // should feel like something with weight catching up. Same movement, two
    // speeds, which is most of why it reads as physical.
    const mk = ease(7);
    if (this.ptr) {
      this.magX += (this.ptr.x - this.magX) * mk;
      this.magY += (this.ptr.y - this.magY) * mk;
    }
    // Presence eases both ways so the curve relaxes out on leave. Slower to fade
    // than to arrive, matching the lean's asymmetry.
    this.magOn += ((this.ptr ? 1 : 0) - this.magOn) * ease(this.ptr ? 9 : 2.4);

    // ── palette crossfade ─────────────────────────────────────────────────
    // Advanced linearly here (the cycle timer below reads it as raw progress), and
    // SMOOTHSTEPPED where it is consumed. A linear colour mix begins and ends with
    // a visible corner — the change starts and stops abruptly at both ends. Easing
    // it means the wash accelerates in and settles out, which is what makes a fast
    // transition still read as smooth rather than as a cut.
    if (this.fadeMix < 1) {
      this.fadeMix = Math.min(1, this.fadeMix + dt / FADE_SECONDS);
    }

    // Hero mode advances the preset on a timer. Counted down from real elapsed
    // time rather than a frame count, so it changes every two seconds whatever
    // the frame rate — and the countdown only runs once the previous fade has
    // settled, so a slow fade can never be cut off by the next one starting.
    if (this.hero && this.fadeMix >= 1) {
      this.cycleT -= dt;
      if (this.cycleT <= 0) {
        this.cycleT = this.cyclePeriod;
        this.next();
      }
    }
  }

  private draw(dt: number) {
    const gl = this.gl;
    const prog = this.prog;
    if (!gl || !prog) return;
    this.step(dt);
    if (!this.mask) this.buildMask();
    if (!this.mask) return;

    const W = this.canvas.width;
    const H = this.canvas.height;
    const P = this.params;
    const aspect = W / Math.max(1, H);

    // The palette actually on screen. `hueShift` scales each preset's own hue
    // travel rather than replacing it, so the slider still does something on every
    // preset — which means the ramp endpoints depend on it and it has to be
    // resolved here rather than baked into the preset table.
    const hueOf = (p: Palette) => p.trail.dHue * (P.hueShift / 26);
    const to = PALETTES[this.paletteIdx % PALETTES.length];
    const pal =
      this.fadeMix >= 1
        ? resolve(to, hueOf(to))
        : (() => {
            const from = PALETTES[this.fadeFrom % PALETTES.length];
            const m = this.fadeMix;
            // smoothstep: eases in and out, so the wash has no corner at either end
            const eased = m * m * (3 - 2 * m);
            return blend(
              resolve(from, hueOf(from)),
              resolve(to, hueOf(to)),
              eased,
            );
          })();

    gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    const aPos = gl.getAttribLocation(prog, "aPosition");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.mask);
    gl.uniform1i(this.loc.uMask, 0);

    // ── the camera ────────────────────────────────────────────────────────
    // The word is a flat plane standing in space and the trail is its light
    // extruded BACKWARD along the depth axis. The cursor turns that plane.
    //
    // Rotate a real plane away from you and the far edge gets NARROWER than the
    // near one, and that foreshortening is the entire cue that tells an eye it is
    // looking at depth. A shear cannot produce it at any strength, which is why
    // an earlier shear-based version only ever looked more wrong the harder it
    // was pushed.
    //
    // NEGATIVE, so the plane turns to FACE the cursor: a real card pivoting
    // toward you brings its near edge closer and lets the far edge recede.
    gl.uniform1f(this.loc.uYaw, -this.leanX * 0.2);
    gl.uniform1f(this.loc.uPitch, -this.leanY * 0.12);
    gl.uniform1f(this.loc.uFocal, FOCAL);

    // The anchor travels a little too. The plane rotating alone reads as a card
    // on a pin; letting the whole thing shift makes it feel like an object
    // floating in front of the page. Small on purpose, and it moves WITH the
    // pointer while the plane turns to face it, so the two cues reinforce.
    gl.uniform2f(
      this.loc.uAnchor,
      0.5 + this.leanX * 0.05,
      // uv is bottom-up in the shader; the mask was uploaded flipped to match.
      1 - (ANCHOR_Y + this.leanY * 0.05),
    );

    // ── the trail ─────────────────────────────────────────────────────────
    // Falls DOWN the card by default (angle is 90deg) — that downward fall IS
    // the effect, and the cursor only tips it. Pushing the copies purely backward
    // in Z instead is geometrically fine but reads as the word shrinking into the
    // distance rather than trailing, so there is nothing to see.
    //
    // Nothing drags the trail against the pointer's travel any more. A long
    // exposure genuinely does smear backward along the path, but driving that off
    // measured cursor velocity meant a SMALL move produced a real backward shove
    // — the trail moved opposite to the hand, which reads as the card fighting
    // you rather than following. The turn plus the reach carry the response.
    //
    // uv is bottom-up, so a "downward" fall is -y here.
    gl.uniform2f(
      this.loc.uFall,
      Math.cos(P.angle),
      -Math.sin(P.angle),
    );
    gl.uniform1f(this.loc.uStep, P.step);
    gl.uniform1f(this.loc.uZStep, 0.55 * P.step);
    gl.uniform1f(this.loc.uAlpha, P.alpha * pal.alphaScale);

    // Magnetism. uv is bottom-up, so the y target is flipped to match the anchor.
    gl.uniform2f(this.loc.uMagnet, this.magX, 1 - this.magY);
    gl.uniform1f(this.loc.uMagnetOn, this.magOn);
    // Depth swing. Driven off the horizontal lean, so turning the plane and
    // shearing the stack in depth are the same gesture rather than two unrelated
    // reactions — that coherence is what makes it read as one object in space.
    gl.uniform1f(this.loc.uSwing, this.leanX * 2.2);

    // The five layers. Turbulence gets a little push from the pointer's presence
    // so the trail stirs when you are on the card and settles when you leave —
    // the air around it reacting to you, not just the word.
    gl.uniform1f(this.loc.uTurb, P.turbulence * (1 + this.magOn * 0.35));
    gl.uniform1f(this.loc.uSpread, P.spread);
    gl.uniform1f(this.loc.uEdge, P.edge);
    gl.uniform1f(this.loc.uFringe, P.fringe);

    // `near` modulates the length live: the closer the cursor is to the word, the
    // shorter the trail, so approaching it reels the exposure in. Kept to a
    // 0.55–1.15 band — collapse it further and the effect stops being itself,
    // push it higher and the far copies leave the frame.
    const reach = 1.15 - this.near * 0.6;
    gl.uniform1f(this.loc.uEchoes, Math.max(1, P.echoes * reach));

    // ── colour ────────────────────────────────────────────────────────────
    // All already resolved to floats (and blended, mid-crossfade), so this is a
    // straight upload with no per-frame string parsing.
    gl.uniform3fv(this.loc.uTrailHead, pal.head);
    gl.uniform3fv(this.loc.uTrailTail, pal.tail);

    gl.uniform3fv(this.loc.uBleed, pal.bleed);
    gl.uniform3fv(this.loc.uHalo, pal.halo);
    gl.uniform3fv(this.loc.uCore, pal.core);
    gl.uniform3fv(this.loc.uBg, pal.bg);

    gl.uniform3fv(this.loc.uPoolA, pal.poolA);
    gl.uniform3fv(this.loc.uPoolB, pal.poolB);
    gl.uniform1f(this.loc.uPoolAlphaA, pal.poolAlphaA);
    gl.uniform1f(this.loc.uPoolAlphaB, pal.poolAlphaB);
    gl.uniform3fv(this.loc.uVignette, pal.vignette);

    // Publish the live background so the host box can match it. Only fires when it
    // actually changes — during a fade that is every frame, but at rest it is
    // nothing, so this is not a per-frame style write.
    if (
      pal.bg[0] !== this.lastBg[0] ||
      pal.bg[1] !== this.lastBg[1] ||
      pal.bg[2] !== this.lastBg[2]
    ) {
      this.lastBg = [pal.bg[0], pal.bg[1], pal.bg[2]];
      this.onBg?.(this.bgCss);
    }

    // Continuous 0..1, so a dark→light crossfade passes through the middle instead
    // of flipping compositing mode in one frame.
    gl.uniform1f(this.loc.uSubtract, pal.subtract);
    // The soft layers are ADDITIVE ideas: on black they spill light past the
    // glyph. Subtractively they instead darken the paper around it, so at the
    // additive strengths they smear the letterforms into a soft grey blob. Pulled
    // right back on subtract presets — just enough to seat the word on the page.
    // Interpolated by the same factor, so it can no longer jump mid-transition.
    gl.uniform1f(this.loc.uSoft, lerp(1, 0.35, pal.subtract));
    gl.uniform1f(this.loc.uNoise, lerp(0.02, 0.012, pal.subtract));
    // The WALL clock, not the drift clock. The drift clock freezes under a hover
    // by design, and driving the grain and the turbulence from it meant both
    // stopped dead the instant the cursor arrived — the film stopped moving at
    // exactly the moment the card was supposed to feel most alive.
    gl.uniform1f(this.loc.uTime, this.tReal);
    gl.uniform1f(this.loc.uAspect, aspect);
    gl.uniform2f(this.loc.uResolution, W, H);

    // The pool tracks the pointer so it reads as the light SOURCE moving, which
    // is what makes the word look lit from where the cursor is.
    gl.uniform2f(
      this.loc.uHaloShift,
      this.leanX * HALO_TRACK_X,
      -this.leanY * HALO_TRACK_Y,
    );
    // The two soft word layers shift slightly AWAY from the pointer while the
    // core stays put; with the pool tracking the cursor, that offset is what
    // sells directional light — the bleed spills off the far side of the glyph.
    gl.uniform2f(
      this.loc.uWordShift,
      -this.leanX * 0.006,
      this.leanY * 0.006,
    );

    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  renderStill() {
    this.draw(0);
  }

  start() {
    if (this.running || !this.ok || this.disposed) return;
    this.running = true;
    this.last = performance.now();
    const tick = (now: number) => {
      if (!this.running) return;
      // Clamped so a stalled tab cannot fling the eased values across in one
      // step. The easing is exponential (see step), so it is correct at any
      // frame length — this only guards against a multi-second hitch.
      const dt = Math.min((now - this.last) / 1000, 1 / 30);
      this.last = now;
      this.draw(dt);
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  stop() {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  destroy() {
    this.disposed = true;
    this.stop();
    this.ro?.disconnect();
    this.ro = null;
    const gl = this.gl;
    if (gl) {
      if (this.mask) gl.deleteTexture(this.mask);
      if (this.quad) gl.deleteBuffer(this.quad);
      if (this.prog) gl.deleteProgram(this.prog);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    }
    this.gl = null;
    this.canvas.remove();
  }
}

```

### smear/SmearCard.tsx

```tsx
"use client";

// The Vault card + detail hero: a word trailing downward into light.
//
// Nothing is blurred. The word is stamped a couple of hundred times, each copy a
// step further down and each one barely visible, so where many copies overlap it
// reads solid and where few overlap it fades out. Drawn as light on a dark ground
// so the copies ADD — it reads as a long exposure, not a stack of shadows.
//
// Standard live-card lifecycle: built one frame after it nears view, paused
// offscreen / tab-hidden / during a cross-route morph, one still frame under
// reduced motion.

import { useEffect, useRef } from "react";
import { FadeMotion, pixelFontSpec } from "./engine";
import { onTransitionChange } from "../../lib/view-transition";

export function SmearCard({
  bare = false,
  viewTransitionName,
}: { bare?: boolean; viewTransitionName?: string } = {}) {
  void bare;
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let engine: FadeMotion | null = null;
    let raf = 0;
    let created = false;
    let onScreen = false;
    let hidden = false;
    let inTransition = false;

    const running = () => onScreen && !hidden && !inTransition;
    const sync = () => {
      if (!engine || reduced) return;
      if (running()) engine.start();
      else engine.stop();
    };

    const create = () => {
      if (created) return;
      created = true;
      raf = requestAnimationFrame(() => {
        if (!hostRef.current) return;
        engine = new FadeMotion(host);
        if (!engine.ok) return;
        // The card and the detail hero run themselves: a ghost cursor works the
        // effect and the palette washes to the next preset every couple of
        // seconds. Without it a visitor who never hovers (or is on a phone, where
        // there is no hover at all) sees a still frame and none of the reason this
        // exists. The playground deliberately does NOT do this — there the point
        // is that YOU drive it. A real pointer overrides the ghost either way.
        //
        // Not under reduced motion: there the card is one still frame, and a
        // self-running ghost plus a colour cycle is exactly the kind of unrequested
        // movement that setting exists to refuse.
        if (!reduced) engine.enableHero(2);
        // Keep the card's own background in step with the canvas, so the frame and
        // the art change together instead of a fixed grey box disagreeing with the
        // picture inside it through every transition.
        engine.onBg = (css) => {
          host.style.backgroundColor = css;
        };
        // Warm the bitmap face, then re-bake. The mask is laid out from the
        // measured glyph, so baking against a not-yet-loaded font locks in the
        // fallback's metrics and the word stays wrong for the life of the page.
        if (document.fonts?.load) {
          document.fonts
            .load(pixelFontSpec())
            .catch(() => {})
            .then(() => engine?.refreshFonts());
          document.fonts.ready.then(() => engine?.refreshFonts()).catch(() => {});
        }
        if (reduced) engine.renderStill();
        else sync();
      });
    };

    const io = new IntersectionObserver(
      (es) => {
        onScreen = es.some((e) => e.isIntersecting);
        if (onScreen && !created) create();
        if (created) sync();
      },
      { rootMargin: "200px" },
    );
    io.observe(host);

    const onVis = () => {
      hidden = document.hidden;
      sync();
    };
    document.addEventListener("visibilitychange", onVis);
    const offTransition = onTransitionChange((active) => {
      inTransition = active;
      sync();
    });

    const fine = window.matchMedia("(pointer: fine)").matches;
    const onMove = (e: PointerEvent) => {
      if (!engine || reduced) return;
      const r = host.getBoundingClientRect();
      engine.setPointer({
        x: (e.clientX - r.left) / r.width,
        y: (e.clientY - r.top) / r.height,
      });
    };
    const onLeave = () => engine?.setPointer(null);
    if (fine) {
      host.addEventListener("pointermove", onMove);
      host.addEventListener("pointerleave", onLeave);
      // pointerleave is not guaranteed: a cancelled gesture or a capture taken
      // by another element skips it. Without this the engine would keep
      // believing the pointer is still there. This is the correct place to
      // handle that — an inactivity timer in the engine instead fired during
      // ordinary hovering, because a hand held still sends no events at all.
      host.addEventListener("pointercancel", onLeave);
    }

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      offTransition();
      if (fine) {
        host.removeEventListener("pointermove", onMove);
        host.removeEventListener("pointerleave", onLeave);
        host.removeEventListener("pointercancel", onLeave);
      }
      engine?.destroy();
    };
  }, []);

  return (
    <div
      ref={hostRef}
      data-canvas-card
      style={{ viewTransitionName }}
      aria-label="A word trailing downward into light, its fade built from hundreds of overlapping copies"
      className="relative aspect-[1344/620] w-full select-none overflow-hidden rounded-[12px] border border-[var(--border-line)] bg-[var(--bg-hover)]"
    />
  );
}

```

---

## Set 3 (received 2026-07-30, final set)

1. Build this: a wordmark rendered as a dense grid of square tiles: a slow morphing colour wave lights tiles up as it wanders across, and the cursor brushes a soft morphing light blob with occasional sparks.

The complete, self-contained implementation follows, one file per block. It is framework-agnostic core logic — wire it into your own component and mount it on an element.

### tile-field/engine.ts

```ts
const TAU = Math.PI * 2;

type Row = {
  word: string;
  font: (px: number) => string;
  letterTrack: number;
  fillFrac: number;
  bright: boolean;
};

const ROWS: Row[] = [
  {
    word: "humandelta <3",
    font: (px) => `600 ${px}px ui-sans-serif, system-ui, Arial, sans-serif`,
    letterTrack: -0.02,
    fillFrac: 0.92,
    bright: false,
  },
];

const REST = "oklch(0.64 0.006 263)";
const BRAND_HUE = 263;
const GLOW_LCH = "0.42 0.07 263";
const SPARK = "70,100,180";

const MAXSZ = 0.9;
const SPEED = 0.02;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const smoothstep = (x: number, e0: number, e1: number) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};
function hash(x: number, y: number) {
  const r = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return r - Math.floor(r);
}

const HUE_STEPS = 24;
const ALPHA_STEPS = 6;

export type TileFieldOptions = Record<string, never>;

export class TileField {
  private host: HTMLElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private reduced: boolean;

  private dpr = Math.min(2, window.devicePixelRatio || 1);
  private viewW = 0;
  private viewH = 0;
  private cell = 10;
  private time = 0;

  private n = 0;
  private px = new Float32Array(0);
  private py = new Float32Array(0);
  private rowOf = new Uint8Array(0);
  private hueSeed = new Float32Array(0);
  private spark = new Uint8Array(0);
  private lit = new Float32Array(0);
  private seed = new Float32Array(0);

  private hasPointer = false;
  private rawX = 0;
  private rawY = 0;
  private lightX = 0;
  private lightY = 0;
  private lightSpeed = 0;

  private raf = 0;

  private stepL = new Float32Array(HUE_STEPS);
  private stepC = new Float32Array(HUE_STEPS);

  constructor(host: HTMLElement, _opts: TileFieldOptions = {} as TileFieldOptions) {
    this.host = host;

    this.canvas = document.createElement("canvas");
    this.canvas.className = "pointer-events-none absolute inset-0 block h-full w-full";
    this.ctx = this.canvas.getContext("2d")!;
    this.host.appendChild(this.canvas);

    this.reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    this.resize();

    window.addEventListener("pointermove", this.onMove, { passive: true });
    window.addEventListener("pointerleave", this.onLeave);
  }

  resize() {
    const stage = this.host;
    const canvas = this.canvas;
    const ctx = this.ctx;

    const rect = stage.getBoundingClientRect();
    this.viewW = rect.width;
    this.viewH = rect.height;
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.cell = Math.max(2, Math.round(this.viewW / 460));
    const cell = this.cell;
    const viewW = this.viewW;
    const viewH = this.viewH;

    canvas.style.width = Math.round(viewW) + "px";
    canvas.style.height = Math.round(viewH) + "px";
    canvas.width = Math.ceil(viewW * this.dpr);
    canvas.height = Math.ceil(viewH * this.dpr);
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;

    const splits = ROWS.length === 1 ? [1] : [0.62, 0.38];
    const bandTops: number[] = [];
    const bandHeights: number[] = [];
    let acc = 0;
    for (const frac of splits) {
      bandTops.push(acc * viewH);
      bandHeights.push(frac * viewH);
      acc += frac;
    }

    const xs: number[] = [], ys: number[] = [], rw: number[] = [],
      sp: number[] = [], sd: number[] = [], hs: number[] = [];

    ROWS.forEach((row, ri) => {
      const bandTop = bandTops[ri];
      const bandH = bandHeights[ri];
      const sc = document.createElement("canvas");
      sc.width = Math.max(1, Math.floor(viewW));
      sc.height = Math.max(1, Math.floor(bandH));
      const s = sc.getContext("2d")!;
      const sls = s as CanvasRenderingContext2D & { letterSpacing?: string };
      s.fillStyle = "#000";
      s.textAlign = "center";
      s.textBaseline = "middle";

      let fs = bandH * 0.9;
      sls.letterSpacing = `${row.letterTrack * fs}px`;
      s.font = row.font(fs);
      const measured = s.measureText(row.word).width || 1;
      fs *= (viewW * row.fillFrac) / measured;
      sls.letterSpacing = `${row.letterTrack * fs}px`;
      s.font = row.font(fs);
      s.fillText(row.word, viewW / 2, bandH / 2);

      const data = s.getImageData(0, 0, sc.width, sc.height).data;
      const cols = Math.ceil(viewW / cell);
      const rows = Math.ceil(bandH / cell);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const lx = Math.floor(c * cell + cell / 2);
          const ly = Math.floor(r * cell + cell / 2);
          if (lx >= sc.width || ly >= sc.height) continue;
          const a = (data[(ly * sc.width + lx) * 4 + 3] ?? 0) / 255;
          if (a <= 0.5) continue;
          const gx = lx;
          const gy = ly + bandTop;
          xs.push(gx);
          ys.push(gy);
          rw.push(ri);
          sp.push(hash(gx + 7, gy - 3) > 0.82 ? 1 : 0);
          sd.push(hash(gx * 1.3, gy * 0.7));
          hs.push(hash(gx * 0.7 + 11, gy * 1.9 - 5));
        }
      }
    });

    this.n = xs.length;
    this.px = new Float32Array(xs);
    this.py = new Float32Array(ys);
    this.rowOf = new Uint8Array(rw);
    this.spark = new Uint8Array(sp);
    this.seed = new Float32Array(sd);
    this.hueSeed = new Float32Array(hs);
    this.lit = new Float32Array(this.n);

    if (this.reduced && !this.raf) this.renderStatic();
  }

  private distSegSq(qx: number, qy: number, ax: number, ay: number, bx: number, by: number) {
    const dx = bx - ax, dy = by - ay;
    if (dx === 0 && dy === 0) {
      const ex = qx - ax, ey = qy - ay;
      return ex * ex + ey * ey;
    }
    const t = clamp(((qx - ax) * dx + (qy - ay) * dy) / (dx * dx + dy * dy), 0, 1);
    const ex = qx - (ax + dx * t), ey = qy - (ay + dy * t);
    return ex * ex + ey * ey;
  }

  private frame = (t: number) => {
    const ctx = this.ctx;
    const { viewW, viewH, cell, n, px, py, rowOf, hueSeed, spark, lit, seed } = this;

    ctx.clearRect(0, 0, viewW, viewH);
    this.time += SPEED;
    const time = this.time;

    const prevX = this.lightX, prevY = this.lightY;
    if (this.hasPointer) {
      this.lightX += (this.rawX - this.lightX) * 0.5;
      this.lightY += (this.rawY - this.lightY) * 0.5;
    }
    const lightX = this.lightX, lightY = this.lightY;
    const stepDist = Math.hypot(lightX - prevX, lightY - prevY);
    this.lightSpeed = 0.9 * this.lightSpeed + 0.1 * stepDist;
    const lightSpeed = this.lightSpeed;
    const moving = this.hasPointer;

    const reach = clamp(viewH * 0.22 + lightSpeed * 0.9, viewH * 0.18, viewH * 0.42);
    const influence = 1.5 * reach;
    const influenceSq = influence * influence;
    const minX = Math.min(prevX, lightX) - influence;
    const maxX = Math.max(prevX, lightX) + influence;
    const minY = Math.min(prevY, lightY) - influence;
    const maxY = Math.max(prevY, lightY) + influence;

    const T = time;

    const grayP = new Path2D();
    const litList: number[] = [];
    const buckets: Path2D[][] = Array.from({ length: HUE_STEPS }, () =>
      Array.from({ length: ALPHA_STEPS }, () => new Path2D())
    );

    const hueOfStep = new Float32Array(HUE_STEPS);

    for (let i = 0; i < n; i++) {
      const x = px[i], y = py[i];

      let target = 0;
      if (moving && x >= minX && x <= maxX && y >= minY && y <= maxY) {
        const dSq = this.distSegSq(x, y, prevX, prevY, lightX, lightY);
        if (dSq <= influenceSq) {
          const ang = Math.atan2(y - lightY, x - lightX);
          const wobble =
            1 +
            0.30 * Math.sin(3 * ang + time * 1.6) +
            0.16 * Math.sin(5 * ang - time * 1.1 + 1.3);
          const f = clamp(1 - Math.sqrt(dSq) / (reach * wobble), 0, 1);
          target = f * f * (3 - 2 * f);
        }
      }

      const rate = target > lit[i] ? 0.24 : 0.02;
      lit[i] += (target - lit[i]) * rate;

      const u = x / Math.max(viewW, 1);
      const v = y / Math.max(viewH, 1);
      const flow =
        Math.sin((u * 1.6 + 0.4 * Math.sin(T * 0.3)) * TAU + T * 0.8) +
        0.7 * Math.sin((v * 2.1 - u * 0.9) * TAU - T * 0.6 + 1.7) +
        0.5 * Math.sin((u * 3.3 + v * 2.7) * TAU + T * 0.4 + 4.2) +
        0.4 * Math.cos((v * 1.3 - 1.1 * Math.sin(T * 0.2)) * TAU - T * 0.5);
      let colorAmt = smoothstep(flow, 0.1, 1.6);
      colorAmt = Math.max(colorAmt, lit[i]);

      const breathe = 0.5 + 0.5 * Math.sin(seed[i] * TAU + time * 1.3);
      const base = 0.22 + 0.1 * breathe;
      const sz = cell * (base + (MAXSZ - base) * colorAmt);
      const h = sz / 2;
      grayP.rect(x - h, y - h, sz, sz);

      if (colorAmt > 0.04) {

        let hue: number;
        let chroma: number;
        if (ROWS[rowOf[i]].bright) {

          hue = (hueSeed[i] * 360 + time * 26) % 360;
          chroma = 0.19;
        } else {

          const drift = (flow - 0.8) * 16;
          hue = BRAND_HUE + drift + (hueSeed[i] - 0.5) * 8;
          chroma = 0.085;
        }
        const hStep = ((Math.round((hue / 360) * HUE_STEPS) % HUE_STEPS) + HUE_STEPS) % HUE_STEPS;
        const lightness = ROWS[rowOf[i]].bright ? 0.62 : 0.5;
        hueOfStep[hStep] = hue;
        const as = Math.min(ALPHA_STEPS - 1, Math.floor(colorAmt * ALPHA_STEPS));
        buckets[hStep][as].rect(x - h, y - h, sz, sz);

        this.stepL[hStep] = lightness;
        this.stepC[hStep] = chroma;
      }

      if (lit[i] > 0.02) litList.push(i);
    }

    ctx.fillStyle = REST;
    ctx.fill(grayP);

    for (let hsI = 0; hsI < HUE_STEPS; hsI++) {
      const hue = hueOfStep[hsI];
      for (let as = 0; as < ALPHA_STEPS; as++) {
        const p = buckets[hsI][as];
        ctx.globalAlpha = (as + 1) / ALPHA_STEPS;
        ctx.fillStyle = `oklch(${this.stepL[hsI]} ${this.stepC[hsI]} ${hue})`;
        ctx.fill(p);
      }
    }
    ctx.globalAlpha = 1;

    for (const i of litList) {
      const L = lit[i];
      const x = px[i], y = py[i];
      const gsz = cell * (0.7 + (MAXSZ - 0.7) * L);
      const gh = gsz / 2;
      if (spark[i]) {
        const ph = seed[i];
        const tt = 0.00025 * t;
        const amp = (0.45 + ph) * cell * 0.28;
        const jx = x + Math.sin(0.05 * x + 1.3 * tt + ph * TAU) * amp;
        const jy = y + Math.cos(0.04 * y - 0.9 * tt + ph * TAU) * amp;
        ctx.fillStyle = `rgba(${SPARK},${(0.1 * L).toFixed(3)})`;
        ctx.fillRect(jx - gh * 1.5, jy - gh * 1.5, gsz * 1.5, gsz * 1.5);
        ctx.fillStyle = `rgba(${SPARK},${(0.55 * L).toFixed(3)})`;
        ctx.fillRect(jx - gh, jy - gh, gsz, gsz);
      } else {
        ctx.fillStyle = `oklch(${GLOW_LCH} / ${(0.85 * L).toFixed(3)})`;
        ctx.fillRect(x - gh, y - gh, gsz, gsz);
      }
    }

    this.raf = requestAnimationFrame(this.frame);
  };

  renderStatic() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.viewW, this.viewH);
    const grayP = new Path2D();
    for (let i = 0; i < this.n; i++) {
      const sz = this.cell * 0.5;
      const h = sz / 2;
      grayP.rect(this.px[i] - h, this.py[i] - h, sz, sz);
    }
    ctx.fillStyle = REST;
    ctx.fill(grayP);
  }

  private onMove = (e: PointerEvent) => {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (x >= -40 && y >= -40 && x <= rect.width + 40 && y <= rect.height + 40) {
      if (!this.hasPointer) {
        this.hasPointer = true;
        this.lightX = x;
        this.lightY = y;
        this.lightSpeed = 0;
      }
      this.rawX = x;
      this.rawY = y;
    } else {
      this.hasPointer = false;
    }
  };

  private onLeave = () => {
    this.hasPointer = false;
  };

  start() {
    if (this.reduced) return;
    if (!this.raf) this.raf = requestAnimationFrame(this.frame);
  }

  stop() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  destroy() {
    this.stop();
    window.removeEventListener("pointermove", this.onMove);
    window.removeEventListener("pointerleave", this.onLeave);
    this.canvas.remove();
  }
}

```


2. Build this: Minecraft fire on a 2D canvas: a 16x16, 32-frame flipbook drawn as crisp blocks, with a live mutable pixel buffer the cursor can physically edit (shoving lit pixels around and heating them) that heals back toward the animation over time.

The complete, self-contained implementation follows, one file per block. It is framework-agnostic core logic — wire it into your own component and mount it on an element.

### fire-field/engine.ts

```ts
import { isMuted } from "../../lib/sound";

const N = 16;
const FRAMES = 32;
const FPS = 18;

const BURN_RADIUS = 2.8;
const HEAL_RATE = 6.0;
const SWAY_MAX = 2.0;

const FIRE_FRAC = 0.6;

function decodeSheet(img: HTMLImageElement): ImageData[] {
  const c = document.createElement("canvas");
  c.width = N;
  c.height = N * FRAMES;
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, 0, 0);
  const out: ImageData[] = [];
  for (let f = 0; f < FRAMES; f++) out.push(ctx.getImageData(0, f * N, N, N));
  return out;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

export type FireFieldOptions = {

  reduced?: boolean;
};

export class FireField {
  private stage: HTMLElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private reduced: boolean;

  private fireSnd: HTMLAudioElement | null = null;
  private fizzSnd: HTMLAudioElement | null = null;
  private fireWanted = false;
  private lastFizz = 0;

  private off: HTMLCanvasElement;
  private offCtx: CanvasRenderingContext2D;
  private buf: ImageData;

  private grid = new Float32Array(N * N * 4);
  private scratch = new Float32Array(N * N * 4);

  private dist = new Float32Array(N * N);
  private primed = false;

  private swayX = 0;
  private swayTarget = 0;

  private vel = { x: 0, y: 0 };
  private blobPhase = 0;

  private frames: ImageData[] | null = null;
  private netherrack: HTMLImageElement | null = null;

  private box = { x: 0, y: 0, size: 0, dpr: 1 };

  private pcell: { x: number; y: number } | null = null;
  private prevP: { x: number; y: number } | null = null;

  private hovering = false;

  private raf = 0;

  private wantRun = false;
  private last = 0;
  private acc = 0;
  private dead = false;

  constructor(stage: HTMLElement, opts: FireFieldOptions = {}) {
    this.stage = stage;
    this.reduced = !!opts.reduced;

    this.canvas = document.createElement("canvas");
    this.canvas.style.imageRendering = "pixelated";
    this.canvas.className = "pointer-events-none absolute inset-0 block h-full w-full";
    this.ctx = this.canvas.getContext("2d")!;
    this.stage.appendChild(this.canvas);

    try {
      this.fireSnd = new Audio("/vault/fire/fire.ogg");
      this.fireSnd.loop = true;
      this.fireSnd.volume = 0;
      this.fizzSnd = new Audio("/vault/fire/fizz.ogg");
      this.fizzSnd.volume = 0.18;
    } catch {}

    this.off = document.createElement("canvas");
    this.off.width = N;
    this.off.height = N;
    this.offCtx = this.off.getContext("2d")!;
    this.buf = this.offCtx.createImageData(N, N);

    this.resize();

    window.addEventListener("pointermove", this.onMove, { passive: true });
    this.stage.addEventListener("pointerenter", this.onEnter);
    this.stage.addEventListener("pointerleave", this.onCardLeave);
    this.stage.addEventListener("pointerdown", this.onTap, { passive: true });

    loadImage("/vault/fire/netterack.png")
      .then((img) => {
        if (!this.dead) this.netherrack = img;
      })
      .catch(() => {});
    loadImage("/vault/fire/fire_sheet.png")
      .then((img) => {
        if (this.dead) return;
        this.frames = decodeSheet(img);
        if (this.reduced) {
          this.acc = 16;
          this.grid.set(this.frames[16].data);
          this.primed = true;
          this.render();
          return;
        }

        this.kick();
      })
      .catch((e) => console.warn("fire texture:", e));
  }

  private stepAudio = (ms: number) => {
    if (!this.fireSnd) return;
    const target = this.fireWanted && !isMuted() ? 1.0 : 0;

    this.fireSnd.volume += (target - this.fireSnd.volume) * 0.08;
    if (target > 0 && this.fireSnd.paused) this.fireSnd.play().catch(() => {});
    if (this.fireSnd.volume < 0.01 && !this.fireSnd.paused) this.fireSnd.pause();
    void ms;
  };

  private playFizz(ms: number) {
    if (!this.fizzSnd || isMuted()) return;
    if (ms - this.lastFizz < 350) return;
    this.lastFizz = ms;
    try {
      this.fizzSnd.currentTime = 0;
      this.fizzSnd.play().catch(() => {});
    } catch {}
  }

  resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cw = this.stage.clientWidth;
    const ch = Math.max(1, this.stage.clientHeight);
    this.canvas.width = Math.round(cw * dpr);
    this.canvas.height = Math.round(ch * dpr);
    const size = Math.min(cw, ch) * FIRE_FRAC;
    this.box.size = size;
    this.box.x = (cw - size) / 2;
    this.box.y = (ch - size) / 2 - ch * 0.08;
    this.box.dpr = dpr;
    this.ctx.imageSmoothingEnabled = false;
  };

  private onMove = (e: PointerEvent) => {
    const r = this.stage.getBoundingClientRect();
    const px = e.clientX - r.left - this.box.x;
    const py = e.clientY - r.top - this.box.y;
    if (px < 0 || py < 0 || px > this.box.size || py > this.box.size) {
      this.pcell = null;
      return;
    }
    this.pcell = { x: (px / this.box.size) * N, y: (py / this.box.size) * N };
  };
  private onEnter = () => {
    this.hovering = true;
  };
  private onCardLeave = () => {
    this.hovering = false;
    this.pcell = null;
  };

  private idx = (x: number, y: number) => y * N + x;

  private blowAll(ms: number) {
    for (let i = 0; i < N * N; i++) {
      const p = i * 4;
      if (this.grid[p + 3] > 127) {
        this.grid[p] = this.grid[p + 1] = this.grid[p + 2] = this.grid[p + 3] = 0;
        this.dist[i] = 1;
      }
    }
    this.playFizz(ms);
  }

  private onTap = () => {
    this.blowAll(performance.now());
  };

  private stepFire(dt: number, ms: number, src: Uint8ClampedArray) {
    const { grid, scratch, dist } = this;
    this.blobPhase += dt;

    if (!this.primed) {
      grid.set(src);
      this.primed = true;
    }

    if (this.pcell && this.prevP) {
      this.vel.x += ((this.pcell.x - this.prevP.x) / Math.max(dt, 0.001) - this.vel.x) * 0.3;
      this.vel.y += ((this.pcell.y - this.prevP.y) / Math.max(dt, 0.001) - this.vel.y) * 0.3;
    } else {
      this.vel.x *= 0.8;
      this.vel.y *= 0.8;
    }
    this.prevP = this.pcell ? { x: this.pcell.x, y: this.pcell.y } : null;

    this.swayTarget = this.pcell ? ((this.pcell.x - N / 2) / (N / 2)) * SWAY_MAX : 0;
    this.swayX += (this.swayTarget - this.swayX) * Math.min(1, dt * 6);
    this.fireWanted = this.hovering;

    const distDecay = Math.min(1, HEAL_RATE * dt);
    for (let i = 0; i < N * N; i++) {
      const p = i * 4;
      const srcLit = src[p + 3] > 127;
      const d = dist[i];

      if (d < 0.02) {

        if (srcLit) {
          grid[p] = src[p];
          grid[p + 1] = src[p + 1];
          grid[p + 2] = src[p + 2];
          grid[p + 3] = 255;
        } else {
          grid[p] = grid[p + 1] = grid[p + 2] = grid[p + 3] = 0;
        }
        continue;
      }

      const lit = grid[p + 3] > 127;
      if (!lit && srcLit) {
        if (Math.random() < distDecay * 0.6) {
          grid[p] = src[p];
          grid[p + 1] = src[p + 1];
          grid[p + 2] = src[p + 2];
          grid[p + 3] = 255;
          dist[i] = 0;
          continue;
        }
      } else if (lit && !srcLit) {

        grid[p] = grid[p + 1] = grid[p + 2] = grid[p + 3] = 0;
      }
      dist[i] = d * (1 - distDecay);
    }

    let snuffedNow = 0;
    if (this.pcell) {
      const cx = this.pcell.x;
      const cy = this.pcell.y;
      const r = BURN_RADIUS;

      const speed = Math.hypot(this.vel.x, this.vel.y);
      const inv = speed > 0.001 ? 1 / speed : 0;
      const pushX = this.vel.x * inv;
      const pushY = this.vel.y * inv - 0.8;
      const pl = Math.hypot(pushX, pushY) || 1;
      const ux = pushX / pl;
      const uy = pushY / pl;

      const reach = r + 1.2;
      const x0 = Math.max(0, Math.floor(cx - reach));
      const x1 = Math.min(N - 1, Math.ceil(cx + reach));
      const y0 = Math.max(0, Math.floor(cy - reach));
      const y1 = Math.min(N - 1, Math.ceil(cy + reach));

      scratch.set(grid);

      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const dx = x + 0.5 - cx;
          const dy = y + 0.5 - cy;
          const d = Math.hypot(dx, dy);
          if (d > r) continue;
          const i = this.idx(x, y);
          const p = i * 4;
          const fall = 1 - d / r;

          if (grid[p + 3] < 40) continue;

          const moveBy = 1 + Math.round(fall * 3);
          const tx = Math.min(N - 1, Math.max(0, x + Math.round(ux * moveBy)));
          const ty = Math.min(N - 1, Math.max(0, y + Math.round(uy * moveBy)));
          const tp = this.idx(tx, ty) * 4;

          let rr = grid[p];
          let gg = grid[p + 1];
          let bb = grid[p + 2];
          const heat = fall;
          rr = rr + (255 - rr) * heat * 0.6;
          gg = gg + (245 - gg) * heat * 0.45;
          bb = bb + (190 - bb) * heat * 0.3;

          if (rr + gg + bb >= scratch[tp] + scratch[tp + 1] + scratch[tp + 2]) {
            scratch[tp] = rr;
            scratch[tp + 1] = gg;
            scratch[tp + 2] = bb;
          }
          scratch[tp + 3] = 255;
          dist[this.idx(tx, ty)] = 1;

          if (fall > 0.12) {
            scratch[p] = 0;
            scratch[p + 1] = 0;
            scratch[p + 2] = 0;
            scratch[p + 3] = 0;
            dist[i] = 1;
            snuffedNow++;
          }
        }
      }
      grid.set(scratch);
    }

    if (snuffedNow >= 3) this.playFizz(ms);
  }

  private render() {
    if (!this.frames) return;
    const { ctx, canvas, box, off } = this;
    const out = this.buf.data;
    for (let y = 0; y < N; y++) {

      const leanFrac = 1 - y / (N - 1);
      const shift = Math.round(this.swayX * leanFrac);
      for (let x = 0; x < N; x++) {
        const p = this.idx(x, y) * 4;
        const sx = Math.min(N - 1, Math.max(0, x - shift));
        const gp = this.idx(sx, y) * 4;

        out[p] = this.grid[gp];
        out[p + 1] = this.grid[gp + 1];
        out[p + 2] = this.grid[gp + 2];
        out[p + 3] = this.grid[gp + 3];
      }
    }
    this.offCtx.putImageData(this.buf, 0, 0);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false;
    const d = box.dpr;

    if (this.netherrack) {
      const bw = box.size;
      const bx = box.x;
      const by = box.y + box.size;
      ctx.drawImage(this.netherrack, bx * d, by * d, bw * d, bw * d);
    }

    ctx.drawImage(off, box.x * d, box.y * d, box.size * d, box.size * d);
  }

  private frame = (ms: number) => {
    this.raf = 0;
    const dt = this.last ? Math.min(0.05, (ms - this.last) / 1000) : 0.016;
    this.last = ms;
    this.acc = (this.acc + dt * FPS) % FRAMES;
    const f = Math.floor(this.acc) % FRAMES;
    this.stepFire(dt, ms, this.frames![f].data);
    this.stepAudio(ms);
    this.render();
    if (this.wantRun) this.raf = requestAnimationFrame(this.frame);
  };

  private kick() {
    if (!this.raf && this.wantRun && this.frames) {
      this.last = 0;
      this.raf = requestAnimationFrame(this.frame);
    }
  }

  start() {
    if (this.reduced) return;
    this.wantRun = true;
    this.kick();
  }

  stop() {
    this.wantRun = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    if (this.fireSnd && !this.fireSnd.paused) this.fireSnd.pause();
  }

  destroy() {
    this.dead = true;
    this.stop();
    window.removeEventListener("pointermove", this.onMove);
    this.stage.removeEventListener("pointerenter", this.onEnter);
    this.stage.removeEventListener("pointerleave", this.onCardLeave);
    this.stage.removeEventListener("pointerdown", this.onTap);
    if (this.fireSnd) this.fireSnd.src = "";
    if (this.fizzSnd) this.fizzSnd.src = "";
    this.canvas.remove();
  }
}

```


3. Build this: a WebGL fragment shader over a word: a diagonal band sweeps across and assembles the word out of a dense spray of tiny coloured blocks, then rests as solid text while the cursor lights a pool of blocks with a lasting wake.

The complete, self-contained implementation follows, one file per block. It is framework-agnostic core logic — wire it into your own component and mount it on an element.

### pixel-scan/engine.ts

```ts
import { glitchScan, glitchTick } from "../../lib/sound";

const SHADER =  `
precision highp float;
uniform sampler2D src;
uniform vec2 resolution;
uniform vec2 offset;
uniform float time;
uniform float enterTime;
uniform float leaveTime;

uniform int mode;
uniform float speed;
uniform float delay;
uniform float width;
uniform vec3 accent;
uniform vec3 accent2;
uniform vec3 baseCol;
uniform vec2 mouse;
uniform float hover;
uniform float spot;

#define TRAIL 24
uniform vec2 trail[TRAIL];
uniform float trailW[TRAIL];

#define W width
#define LAYERS 3.0

vec4 readTex(vec2 uv) {
  if (uv.x < 0. || uv.x > 1. || uv.y < 0. || uv.y > 1.) return vec4(0);
  return texture2D(src, uv);
}
float hash(vec2 p) { return fract(sin(dot(p, vec2(4859., 3985.))) * 3984.); }
float sdBox(vec2 p, float r) { vec2 q = abs(p) - r; return min(length(q), max(q.y, q.x)); }

float dir = 1.;
vec2 mp = vec2(0.);
vec2 tp[TRAIL];

vec2 pxToP(vec2 px) {
  vec2 uv = (px - offset) / resolution;
  vec2 q = uv * 2. - 1.;
  q.y *= resolution.y / resolution.x;
  return q;
}

float toRangeT(vec2 p, float scale) {
  float d;
  if (mode == 0) d = p.x / (scale * 2.) + .5;
  else if (mode == 1) d = 1. - (p.y / (scale * 2.) + .5);
  else if (mode == 2) d = length(p) / scale;

  else d = dot(p, vec2(0.7071, 0.7071)) / (scale * 2.) + .5;
  d = dir > 0. ? d : (1. - d);
  return d;
}

vec4 cell(vec2 p, vec2 pi, float scale, float t, float edge) {
  vec2 pc = pi + .5;

  vec2 uvc = pc / scale;
  uvc.y /= resolution.y / resolution.x;
  uvc = uvc * 0.5 + 0.5;
  if (uvc.x < 0. || uvc.x > 1. || uvc.y < 0. || uvc.y > 1.) return vec4(0);
  float alpha = smoothstep(.0, .1, texture2D(src, uvc).a);

  float x = toRangeT(pi, scale);
  float n = hash(pi);
  float SPREAD = W * 2.2;
  float anim = smoothstep(W * 2., .0, abs(x + n * SPREAD - t));

  vec2 cellP = pc / scale;
  float spotA = 0.;
  for (int i = 0; i < TRAIL; i++) {
    float w = trailW[i];
    if (w <= 0.) continue;
    vec2 rel = cellP - tp[i];
    float ang = atan(rel.y, rel.x);
    float wob = 1.
      + 0.30 * sin(3. * ang + time * 1.6)
      + 0.16 * sin(5. * ang - time * 1.1 + 1.3);
    float reach = spot * 0.8 * wob;
    spotA = max(spotA, smoothstep(reach, reach * 0.4, length(rel)) * w);
  }
  anim = max(anim, spotA * hover);

  float tone = 0.5 + 0.5 * sin(time * 2.0 + n * 6.2831)
                   + 0.18 * sin(time * 3.7 + n * 12.566);
  tone = clamp(tone, 0., 1.);
  vec3 cellAccent = mix(accent, accent2, tone);
  vec4 color = vec4(mix(baseCol, cellAccent, anim), 1.) * anim;

  float pull = hover * smoothstep(spot * 1.4, 0., length(cellP - mp));
  vec2 mag = normalize(mp - cellP + 1e-5) * pull * 0.18;
  vec2 bp = p - pc - mag;

  float sd = sdBox(bp, .38);
  color *= mix(1., clamp(.3 / abs(sd), 0., 10.), edge * pow(anim, 9.));
  color += vec4(cellAccent, 1.) * anim * smoothstep(.55, .0, abs(sd)) * 0.07;

  return color * alpha;
}

vec4 cellsColor(vec2 p, float scale, float t) {
  vec2 pi = floor(p);
  vec2 d = vec2(0, 1);
  vec4 cc = vec4(0);
  cc += cell(p, pi, scale, t, .2) * 4.;
  cc += cell(p, pi + d.xy, scale, t, .9);
  cc += cell(p, pi - d.xy, scale, t, .9);
  cc += cell(p, pi + d.yx, scale, t, .9);
  cc += cell(p, pi - d.yx, scale, t, .9);
  return cc / 8.;
}

vec4 draw(vec2 uv, vec2 p, float t, float scale) {
  vec4 c = readTex(uv);
  vec2 pi = floor(p * scale);
  float n = hash(pi);
  t = t * (1. + W * 4.) - W * 2.;
  float x = toRangeT(pi, scale);
  float a1 = smoothstep(t, t - W, x + n * W);
  c *= a1;
  c += cellsColor(p * scale, scale, t) * 1.1;
  return c;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - offset) / resolution;
  vec2 p = uv * 2. - 1.;
  p.y *= resolution.y / resolution.x;

  mp = pxToP(mouse);
  for (int i = 0; i < TRAIL; i++) tp[i] = pxToP(trail[i]);

  float t;
  if (leaveTime > 0.) { dir = -1.; t = clamp(leaveTime * speed, 0., 1.); }
  else { t = clamp((enterTime - delay) * speed, 0., 1.); }
  t = (fract(t * .99999) - 0.5) * dir + 0.5;

  for (float i = 0.; i < LAYERS; i++) {
    float s = cos(i) * 11. + 32.;
    gl_FragColor += draw(uv, p, t, abs(s));
  }
  gl_FragColor /= LAYERS;
  gl_FragColor *= smoothstep(0., 0.01, t);
}
`;

const VERT =  `
precision highp float;
attribute vec3 position;
void main() { gl_Position = vec4(position, 1.0); }
`;

const ENTRANCE_SECONDS = 2.6;
const HOVER_EASE = 0.22;
const LIVE_EASE = 0.35;
const SPOT_RADIUS = 0.28;

const TRAIL = 24;
const TRAIL_LIFE = 1.1;
const TRAIL_MIN_PX = 3;

const ACCENT: [number, number, number] = [0.4, 0.75, 1.0];
const ACCENT2: [number, number, number] = [1.0, 0.45, 0.8];
const BASE: [number, number, number] = [0.85, 0.8, 1.0];
const TEXT_COLOR = "#191b24";

const DEFAULT_WORD = "bababooey";

type Three = typeof import("three");

export type PixelScanFieldOptions = {

  word?: string;

  accent?: [number, number, number];
  accent2?: [number, number, number];

  base?: [number, number, number];

  textColor?: string;
};

export class PixelScanField {
  private host: HTMLDivElement;
  private canvas: HTMLCanvasElement;
  private THREE: Three;

  private word: string;
  private accent: [number, number, number];
  private accent2: [number, number, number];
  private base: [number, number, number];
  private textColor: string;

  private dpr = Math.min(2, window.devicePixelRatio || 1);
  private family: string;

  private renderer: InstanceType<Three["WebGLRenderer"]>;
  private scene: InstanceType<Three["Scene"]>;
  private camera: InstanceType<Three["Camera"]>;
  private geo: InstanceType<Three["PlaneGeometry"]>;
  private material: InstanceType<Three["RawShaderMaterial"]>;
  private uniforms: Record<string, { value: unknown }>;

  private texture: InstanceType<Three["CanvasTexture"]>;
  private wordCanvas: HTMLCanvasElement | null = null;
  private wordCtx: CanvasRenderingContext2D | null = null;

  private rect: DOMRect;

  private entranceStart = performance.now();

  private hoverTarget = 0;
  private hoverVal = 0;

  private trailVecs: InstanceType<Three["Vector2"]>[];
  private trailWeights: number[];
  private trailBorn = new Array(TRAIL).fill(-1e9);
  private liveX = -1e4;
  private liveY = -1e4;
  private liveOn = false;
  private head = 1;
  private lastPx = 0;
  private lastPy = 0;

  private targetX = -1e4;
  private targetY = -1e4;

  private startTime = performance.now();
  private lastFrame = this.startTime;
  private raf = 0;
  private running = false;

  constructor(
    host: HTMLDivElement,
    canvas: HTMLCanvasElement,
    THREE: Three,
    opts: PixelScanFieldOptions = {},
  ) {
    this.host = host;
    this.canvas = canvas;
    this.THREE = THREE;
    this.word = opts.word ?? DEFAULT_WORD;
    this.accent = opts.accent ?? ACCENT;
    this.accent2 = opts.accent2 ?? ACCENT2;
    this.base = opts.base ?? BASE;
    this.textColor = opts.textColor ?? TEXT_COLOR;
    this.family = wordFamily(host);

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      alpha: true,
      antialias: false,
    });
    this.renderer.setPixelRatio(this.dpr);

    this.scene = new THREE.Scene();
    this.camera = new THREE.Camera();
    this.geo = new THREE.PlaneGeometry(2, 2);

    this.rect = host.getBoundingClientRect();
    this.texture = this.makeTexture(this.rect.width, this.rect.height);

    this.uniforms = {
      src: { value: this.texture },
      resolution: { value: new THREE.Vector2(this.rect.width * this.dpr, this.rect.height * this.dpr) },
      offset: { value: new THREE.Vector2(0, 0) },
      time: { value: 0 },
      enterTime: { value: 0 },
      leaveTime: { value: 0 },
      mode: { value: 3 },
      speed: { value: 1 },
      delay: { value: 0 },
      width: { value: 0.2 },
      accent: { value: new THREE.Vector3(...this.accent) },
      accent2: { value: new THREE.Vector3(...this.accent2) },
      baseCol: { value: new THREE.Vector3(...this.base) },
      mouse: { value: new THREE.Vector2(-1e4, -1e4) },
      hover: { value: 0 },
      spot: { value: SPOT_RADIUS },
      trail: { value: Array.from({ length: TRAIL }, () => new THREE.Vector2(-1e4, -1e4)) },
      trailW: { value: new Array(TRAIL).fill(0) },
    };

    this.material = new THREE.RawShaderMaterial({
      vertexShader: VERT,
      fragmentShader: SHADER,
      uniforms: this.uniforms,
      transparent: true,
    });
    this.scene.add(new THREE.Mesh(this.geo, this.material));

    this.trailVecs = this.uniforms.trail.value as InstanceType<Three["Vector2"]>[];
    this.trailWeights = this.uniforms.trailW.value as number[];

    this.setSize();

    this.host.addEventListener("pointerenter", this.onEnter);
    this.host.addEventListener("pointerdown", this.onDown);
    this.host.addEventListener("pointerleave", this.onLeave);
    this.host.addEventListener("pointermove", this.onMove);
    window.addEventListener("resize", this.onResize);

    this.canvas.addEventListener("webglcontextlost", this.onContextLost);
    this.canvas.addEventListener("webglcontextrestored", this.onContextRestored);
  }

  private makeTexture(w: number, h: number): InstanceType<Three["CanvasTexture"]> {
    const src = rasteriseWord(w, h, this.dpr, this.family, this.word, this.textColor);
    this.wordCanvas = src;
    this.wordCtx = src.getContext("2d", { willReadFrequently: true });
    const tex = new this.THREE.CanvasTexture(src);

    tex.minFilter = this.THREE.LinearFilter;
    tex.magFilter = this.THREE.LinearFilter;
    tex.generateMipmaps = false;
    tex.needsUpdate = true;
    return tex;
  }

  private overGlyph(bx: number, by: number): boolean {
    if (!this.wordCanvas || !this.wordCtx) return false;
    const cx = Math.round(bx);
    const cy = Math.round(this.wordCanvas.height - by);
    if (cx < 0 || cy < 0 || cx >= this.wordCanvas.width || cy >= this.wordCanvas.height) return false;
    try {
      return this.wordCtx.getImageData(cx, cy, 1, 1).data[3] > 20;
    } catch {
      return false;
    }
  }

  private setSize = () => {
    this.rect = this.host.getBoundingClientRect();
    this.renderer.setSize(this.rect.width, this.rect.height, false);
    (this.uniforms.resolution.value as InstanceType<Three["Vector2"]>).set(
      this.rect.width * this.dpr,
      this.rect.height * this.dpr,
    );
    this.texture.dispose();
    this.texture = this.makeTexture(this.rect.width, this.rect.height);
    this.uniforms.src.value = this.texture;
  };

  private enterTimeVal(): number {
    const e = (performance.now() - this.entranceStart) / 1000;
    if (e >= ENTRANCE_SECONDS) return 2;
    const x = e / ENTRANCE_SECONDS;
    return 1 - (1 - x) * (1 - x);
  }

  private toLocal(ev: PointerEvent) {
    const r = this.host.getBoundingClientRect();
    return {
      x: (ev.clientX - r.left) * this.dpr,
      y: (r.height - (ev.clientY - r.top)) * this.dpr,
    };
  }

  private onEnter = (ev: PointerEvent) => {
    this.hoverTarget = 1;
    this.liveOn = true;
    const l = this.toLocal(ev);
    this.targetX = this.liveX = this.lastPx = l.x;
    this.targetY = this.liveY = this.lastPy = l.y;

    this.entranceStart = performance.now();
    glitchScan(ENTRANCE_SECONDS);
  };
  private onLeave = () => {
    this.hoverTarget = 0;
    this.liveOn = false;
  };
  private onMove = (ev: PointerEvent) => {
    const l = this.toLocal(ev);
    this.targetX = l.x;
    this.targetY = l.y;
    if (this.overGlyph(l.x, l.y)) glitchTick();
  };

  private onDown = (ev: PointerEvent) => {
    if (ev.pointerType === "touch") {
      this.entranceStart = performance.now();
      glitchScan(ENTRANCE_SECONDS);
    }
  };

  private onResize = () => this.setSize();

  private onContextLost = (e: Event) => {
    e.preventDefault();
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  };

  private onContextRestored = () => {
    this.setSize();
    if (this.running && !this.raf) this.raf = requestAnimationFrame(this.tick);
  };

  private tick = () => {
    const now = performance.now();
    this.uniforms.time.value = (now - this.startTime) / 1000;
    this.uniforms.enterTime.value = this.enterTimeVal();

    this.hoverVal += (this.hoverTarget - this.hoverVal) * HOVER_EASE;
    this.uniforms.hover.value = this.hoverVal;

    this.liveX += (this.targetX - this.liveX) * LIVE_EASE;
    this.liveY += (this.targetY - this.liveY) * LIVE_EASE;

    if (this.liveOn) {
      const step = TRAIL_MIN_PX * this.dpr;

      const MAX_PER_FRAME = 4;
      let moved = Math.hypot(this.liveX - this.lastPx, this.liveY - this.lastPy);
      const total = moved;
      let placed = 0;
      while (moved >= step && placed < MAX_PER_FRAME) {
        const f = step / moved;
        this.lastPx += (this.liveX - this.lastPx) * f;
        this.lastPy += (this.liveY - this.lastPy) * f;
        this.head = this.head + 1 >= TRAIL ? 1 : this.head + 1;
        this.trailVecs[this.head].set(this.lastPx, this.lastPy);

        const along = total > 0 ? 1 - moved / total : 1;
        this.trailBorn[this.head] = this.lastFrame + (now - this.lastFrame) * along;
        moved = Math.hypot(this.liveX - this.lastPx, this.liveY - this.lastPy);
        placed++;
      }
    }
    this.lastFrame = now;

    this.trailVecs[0].set(this.liveX, this.liveY);
    this.trailWeights[0] = this.liveOn ? 1 : 0;
    for (let i = 1; i < TRAIL; i++) {
      const age = (now - this.trailBorn[i]) / 1000;

      const d = Math.max(0, Math.min(1, 1 - age / TRAIL_LIFE));
      this.trailWeights[i] = d * d * (3 - 2 * d);
    }
    (this.uniforms.mouse.value as InstanceType<Three["Vector2"]>).set(this.liveX, this.liveY);

    this.renderer.render(this.scene, this.camera);
    this.raf = requestAnimationFrame(this.tick);
  };

  start() {
    if (this.running) return;
    this.running = true;

    const now = performance.now();
    this.lastFrame = now;
    this.raf = requestAnimationFrame(this.tick);
  }

  stop() {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  resize() {
    this.setSize();
  }

  destroy() {
    this.stop();
    this.host.removeEventListener("pointerenter", this.onEnter);
    this.host.removeEventListener("pointerdown", this.onDown);
    this.host.removeEventListener("pointerleave", this.onLeave);
    this.host.removeEventListener("pointermove", this.onMove);
    window.removeEventListener("resize", this.onResize);
    this.canvas.removeEventListener("webglcontextlost", this.onContextLost);
    this.canvas.removeEventListener("webglcontextrestored", this.onContextRestored);
    this.texture.dispose();
    this.geo.dispose();
    this.material.dispose();
    this.renderer.dispose();

    this.renderer.forceContextLoss?.();
    this.renderer.getContext().getExtension("WEBGL_lose_context")?.loseContext();
  }
}

function wordFamily(host: HTMLElement): string {
  const v = getComputedStyle(host).getPropertyValue("--font-kyoto").trim();
  return v ? `${v}, Georgia, serif` : "Georgia, serif";
}

function rasteriseWord(
  w: number,
  h: number,
  dpr: number,
  family: string,
  word: string,
  textColor: string,
): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w * dpr));
  c.height = Math.max(1, Math.round(h * dpr));
  const ctx = c.getContext("2d")!;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);

  const fontPx = w * 0.12;
  ctx.font = `500 ${fontPx}px ${family}`;

  ctx.letterSpacing = `${-fontPx * 0.02}px`;
  ctx.fillStyle = textColor;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(word, w / 2, h / 2 + fontPx * 0.04);
  return c;
}

export function drawStaticWord(
  canvas: HTMLCanvasElement,
  host: HTMLElement,
  word: string = DEFAULT_WORD,
  textColor: string = TEXT_COLOR,
) {
  const r = host.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(r.width * dpr);
  canvas.height = Math.round(r.height * dpr);
  const wordCanvas = rasteriseWord(r.width, r.height, dpr, wordFamily(host), word, textColor);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(wordCanvas, 0, 0);
}

```


4. Build this: a canvas image-pixelization effect: cycle through a set of images, pixelizing each one in to sharp then back out to chunky blocks, with a swap that slides + scales + skews for a hint of 3D motion. The pixelize trick is downscaling the image into a tiny offscreen canvas then drawing it back up with image smoothing off.

The complete, self-contained implementation follows, one file per block. It is framework-agnostic core logic — wire it into your own component and mount it on an element.

### pixel-field/engine.ts

```ts
import { gsap } from "gsap";

const PIXEL_START = 120;
const PIXEL_MIN = 2;

const PIXEL_STEPS = 24;
function buildPixelRamp(): number[] {
  const sizes: number[] = [];
  let prev = Infinity;
  for (let i = 0; i < PIXEL_STEPS; i++) {
    const t = i / (PIXEL_STEPS - 1);

    const size = Math.round(PIXEL_START + (PIXEL_MIN - PIXEL_START) * (t * (2 - t)));
    const clamped = Math.max(PIXEL_MIN, size);
    if (clamped < prev) {
      sizes.push(clamped);
      prev = clamped;
    }
  }
  if (sizes[sizes.length - 1] !== PIXEL_MIN) sizes.push(PIXEL_MIN);
  return sizes;
}
const BASE_PIXEL_SIZES = buildPixelRamp();
const INTERACTION_PIXEL_SIZE = 70;

const IN_DURATION = 0.5;
const OUT_DURATION = 0.35;
const SLIDE_DURATION = 0.5;
const SWAP_SCALE_MIN = 0.15;
const SWAP_SKEW = 0.18;

const INSET = 0.0;

const SCALE = { min: { scale: 0.33, width: 300 }, max: { scale: 1, width: 1400 } };

type DrawParams = {
  drawWidth: number;
  drawHeight: number;
  drawX: number;
  drawY: number;
};

type Particle = {
  x: number;
  y: number;
  color: { r: number; g: number; b: number };
  opacity: number;
  duration: number;
  startTime: number;
  size: number;
};

export type PixelFieldOptions = {

  hold?: number;

  interaction?: boolean;

  onImageChange?: (index: number) => void;
};

export class PixelField {
  private host: HTMLElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private temp: HTMLCanvasElement;
  private tempCtx: CanvasRenderingContext2D;

  private dpr = Math.min(window.devicePixelRatio || 1, 2);
  private cssW = 0;
  private cssH = 0;

  private images: HTMLImageElement[] = [];
  private current = 0;
  private img: HTMLImageElement | null = null;

  private keyed = new Map<HTMLImageElement, HTMLCanvasElement>();

  private basePixelSizes = BASE_PIXEL_SIZES;
  private pixelSizes = BASE_PIXEL_SIZES;
  private interactionPixelSize = INTERACTION_PIXEL_SIZE;
  private lastScale = 0;

  private drawParams: DrawParams | null = null;

  private idx = 0;

  private slideY = 0;
  private swapScale = 1;
  private swapSkew = 0;
  private timeline: gsap.core.Timeline | null = null;
  private raf = 0;
  private running = false;

  private interaction: boolean;
  private hovering = false;
  private mouse: { x: number; y: number } | null = null;
  private lastCell: string | null = null;
  private particles: Particle[] = [];

  private hold: number;
  private onImageChange?: (i: number) => void;

  constructor(host: HTMLElement, sources: HTMLImageElement[], opts: PixelFieldOptions = {}) {
    this.host = host;
    this.images = sources;
    this.img = sources[0] ?? null;
    this.hold = opts.hold ?? 1.6;
    this.interaction = !!opts.interaction;
    this.onImageChange = opts.onImageChange;

    this.canvas = document.createElement("canvas");
    this.canvas.className = "ll-block--canvas-2d";
    this.ctx = this.canvas.getContext("2d")!;
    this.temp = document.createElement("canvas");
    this.tempCtx = this.temp.getContext("2d")!;
    this.host.appendChild(this.canvas);

    this.disableSmoothing(this.ctx);
    this.disableSmoothing(this.tempCtx);
    this.measure();

    if (this.interaction) {
      this.canvas.addEventListener("mouseenter", this.onEnter);
      this.canvas.addEventListener("mouseleave", this.onLeave);
      this.canvas.addEventListener("mousemove", this.onMove);
    }
  }

  private measure() {
    const r = this.host.getBoundingClientRect();
    this.cssW = r.width;
    this.cssH = r.height;
    this.canvas.width = Math.round(this.cssW * this.dpr);
    this.canvas.height = Math.round(this.cssH * this.dpr);
    this.canvas.style.width = `${this.cssW}px`;
    this.canvas.style.height = `${this.cssH}px`;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.disableSmoothing(this.ctx);
    this.scalePixelSizes();
    this.calcDrawParams();
  }

  private disableSmoothing(c: CanvasRenderingContext2D) {
    c.imageSmoothingEnabled = false;

    (c as unknown as Record<string, boolean>).webkitImageSmoothingEnabled = false;
    (c as unknown as Record<string, boolean>).mozImageSmoothingEnabled = false;
    (c as unknown as Record<string, boolean>).msImageSmoothingEnabled = false;
  }

  private calcDrawParams() {
    const img = this.img;
    if (!img) return;

    const boxW = this.cssW * (1 - 2 * INSET);
    const boxH = this.cssH * (1 - 2 * INSET);
    const imgRatio = img.naturalWidth / img.naturalHeight;
    const boxRatio = boxW / boxH;

    const fitW = imgRatio > boxRatio ? boxW : boxH * imgRatio;
    const fitH = imgRatio > boxRatio ? boxW / imgRatio : boxH;
    this.drawParams = {
      drawWidth: fitW,
      drawHeight: fitH,
      drawX: (this.cssW - fitW) / 2,
      drawY: (this.cssH - fitH) / 2,
    };
  }

  private scalePixelSizes() {
    const w = this.cssW;
    if (!w) return;
    let f = SCALE.min.scale;
    if (w >= SCALE.max.width) f = SCALE.max.scale;
    else if (w > SCALE.min.width)
      f =
        SCALE.min.scale +
        ((SCALE.max.scale - SCALE.min.scale) * (w - SCALE.min.width)) /
          (SCALE.max.width - SCALE.min.width);
    if (Math.abs(f - this.lastScale) > 0.01) {
      this.pixelSizes = this.basePixelSizes.map((s) => Math.max(1, Math.round(s * f)));
      this.interactionPixelSize = Math.max(1, Math.round(INTERACTION_PIXEL_SIZE * f));
      this.lastScale = f;
    }
  }

  private pixelSizeNow(): number {
    const max = this.pixelSizes.length - 1;
    const i = Math.min(Math.floor(this.idx), max);
    return this.pixelSizes[i];
  }

  private gridParams(px: number) {
    const { drawX, drawY, drawWidth, drawHeight } = this.drawParams!;
    const blocksX = Math.ceil(drawWidth / px);
    const blocksY = Math.ceil(drawHeight / px);
    const totalWidth = blocksX * px;
    const totalHeight = blocksY * px;
    return {
      blocksX,
      blocksY,
      totalWidth,
      totalHeight,
      offsetX: drawX + (drawWidth - totalWidth) / 2,

      offsetY: drawY + (drawHeight - totalHeight) / 2 + Math.round(this.slideY / px) * px,
    };
  }

  private keyedSource(img: HTMLImageElement): HTMLCanvasElement {
    const cached = this.keyed.get(img);
    if (cached) return cached;
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const cx = c.getContext("2d")!;
    cx.drawImage(img, 0, 0);
    const data = cx.getImageData(0, 0, w, h);
    const d = data.data;
    const T = 236;
    const isWhite = (p: number) => d[p] >= T && d[p + 1] >= T && d[p + 2] >= T;

    const seen = new Uint8Array(w * h);
    const stack: number[] = [];
    const pushIfWhite = (x: number, y: number) => {
      const idx = y * w + x;
      if (seen[idx]) return;
      seen[idx] = 1;
      if (isWhite(idx * 4)) stack.push(idx);
    };
    for (let x = 0; x < w; x++) {
      pushIfWhite(x, 0);
      pushIfWhite(x, h - 1);
    }
    for (let y = 0; y < h; y++) {
      pushIfWhite(0, y);
      pushIfWhite(w - 1, y);
    }
    while (stack.length) {
      const idx = stack.pop()!;
      d[idx * 4 + 3] = 0;
      const x = idx % w;
      const y = (idx / w) | 0;
      if (x > 0) pushIfWhite(x - 1, y);
      if (x < w - 1) pushIfWhite(x + 1, y);
      if (y > 0) pushIfWhite(x, y - 1);
      if (y < h - 1) pushIfWhite(x, y + 1);
    }

    cx.putImageData(data, 0, 0);
    this.keyed.set(img, c);
    return c;
  }

  private draw = () => {
    if (!this.drawParams || !this.img) return;
    const { ctx, cssW, cssH } = this;
    const px = this.pixelSizeNow();
    const { drawWidth, drawHeight } = this.drawParams;

    const tw = Math.max(1, Math.ceil(drawWidth / px));
    const th = Math.max(1, Math.ceil(drawHeight / px));

    ctx.clearRect(0, 0, cssW, cssH);

    if (this.temp.width !== tw || this.temp.height !== th) {
      this.temp.width = tw;
      this.temp.height = th;
    }
    this.tempCtx.clearRect(0, 0, tw, th);
    this.tempCtx.drawImage(this.keyedSource(this.img), 0, 0, tw, th);

    const g = this.gridParams(px);

    const transforming = this.swapScale !== 1 || this.swapSkew !== 0;
    if (transforming) {
      const cx = this.drawParams.drawX + drawWidth / 2;
      const cy = this.drawParams.drawY + drawHeight / 2 + this.slideY;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(this.swapScale, this.swapScale);

      ctx.transform(1, 0, this.swapSkew, 1, 0, 0);
      ctx.translate(-cx, -cy);
    }

    ctx.drawImage(this.temp, 0, 0, tw, th, g.offsetX, g.offsetY, g.totalWidth, g.totalHeight);
    if (transforming) ctx.restore();

    if (this.interaction && this.hovering) this.drawInteraction();
    if (this.particles.length) {
      this.updateParticles();
      this.drawParticles();
    }
  };

  private sampleColor(px: number, cellX: number, cellY: number) {
    const { drawWidth, drawHeight } = this.drawParams!;
    const w = Math.max(1, Math.floor(drawWidth / px));
    const h = Math.max(1, Math.floor(drawHeight / px));
    if (this.temp.width !== w || this.temp.height !== h) {
      this.temp.width = w;
      this.temp.height = h;
      this.tempCtx.clearRect(0, 0, w, h);
      this.tempCtx.drawImage(this.img!, 0, 0, w, h);
    }
    const x = Math.max(0, Math.min(cellX, w - 1));
    const y = Math.max(0, Math.min(cellY, h - 1));
    const d = this.tempCtx.getImageData(x, y, 1, 1).data;
    return { r: d[0], g: d[1], b: d[2] };
  }

  private drawInteraction() {
    if (!this.mouse || !this.drawParams) return;
    const px = this.interactionPixelSize;
    const g = this.gridParams(px);
    const cx = Math.floor((this.mouse.x - g.offsetX) / px);
    const cy = Math.floor((this.mouse.y - g.offsetY) / px);
    const n = Math.max(0, Math.min(cx, g.blocksX - 1));
    const o = Math.max(0, Math.min(cy, g.blocksY - 1));
    const key = `${n},${o}`;
    if (this.lastCell === key) return;
    this.lastCell = key;
    this.spawnParticles(n, o, g, px);
  }

  private spawnParticles(
    cellX: number,
    cellY: number,
    g: ReturnType<PixelField["gridParams"]>,
    px: number,
  ) {
    const now = performance.now();
    const make = (gx: number, gy: number): Particle => ({
      x: g.offsetX + gx * px,
      y: g.offsetY + gy * px,
      color: this.sampleColor(px, gx, gy),
      opacity: 1,
      duration: 600 + Math.random() * 400,
      startTime: now,
      size: px,
    });
    this.particles.push(make(cellX, cellY));

    const neigh: { gx: number; gy: number }[] = [];
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++) {
        const gx = cellX + dx;
        const gy = cellY + dy;
        if ((dx || dy) && gx >= 0 && gx < g.blocksX && gy >= 0 && gy < g.blocksY)
          neigh.push({ gx, gy });
      }
    const count = Math.min(Math.floor(Math.random() * 3) + 1, neigh.length);
    neigh
      .sort(() => Math.random() - 0.5)
      .slice(0, count)
      .forEach((c) => this.particles.push(make(c.gx, c.gy)));
  }

  private updateParticles() {
    const now = performance.now();
    this.particles = this.particles.filter((p) => {
      const age = now - p.startTime;
      if (age >= p.duration) return false;
      p.opacity = 1 - age / p.duration;
      return true;
    });
  }

  private drawParticles() {
    const c = this.ctx;
    for (const p of this.particles) {
      c.fillStyle = `rgba(${p.color.r}, ${p.color.g}, ${p.color.b}, ${p.opacity})`;
      c.fillRect(p.x, p.y, p.size, p.size);
    }
  }

  private onEnter = () => {
    this.hovering = true;
  };
  private onLeave = () => {
    this.hovering = false;
    this.lastCell = null;
    this.mouse = null;
  };
  private onMove = (e: MouseEvent) => {
    if (!this.hovering) return;
    const r = this.canvas.getBoundingClientRect();
    this.mouse = { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  private revealIn(delay = 0) {
    const last = this.pixelSizes.length - 1;

    return gsap.timeline({ delay }).to(this, {
      idx: last,
      duration: IN_DURATION,
      ease: "power3.out",
    });
  }

  private revealOut() {

    return gsap.timeline().to(this, {
      idx: 0,
      duration: OUT_DURATION,
      ease: "power3.in",
    });
  }

  private advance() {
    this.current = (this.current + 1) % this.images.length;
    this.img = this.images[this.current];
    this.calcDrawParams();
    this.onImageChange?.(this.current);
  }

  private cycle(isFirst = false) {
    this.timeline?.kill();
    const tl = gsap.timeline({
      onComplete: () => this.cycle(),
    });
    const dist = this.cssH * 0.6;

    if (isFirst) {
      this.idx = 0;
      tl.add(this.revealIn(0));
    }

    tl.to({}, { duration: this.hold });
    tl.add(this.revealOut());

    tl.to(this, {
      slideY: -dist,
      swapScale: SWAP_SCALE_MIN,
      swapSkew: SWAP_SKEW,
      duration: SLIDE_DURATION * 0.4,
      ease: "power2.in",
      onComplete: () => {
        this.advance();
        this.idx = 0;
        this.slideY = dist;
        this.swapScale = SWAP_SCALE_MIN;
        this.swapSkew = -SWAP_SKEW;
      },
    });

    const growStart = tl.duration();
    tl.to(this, {
      slideY: 0,
      swapScale: 1,
      swapSkew: 0,
      duration: SLIDE_DURATION * 0.6,
      ease: "back.out(1.4)",
    });

    tl.add(this.revealIn(0), growStart + SLIDE_DURATION * 0.12);

    this.timeline = tl;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.timeline?.play();
    if (!this.timeline) this.cycle(true);
    const loop = () => {
      this.draw();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.timeline?.pause();
  }

  renderStill() {
    this.idx = this.pixelSizes.length - 1;
    this.draw();
  }

  resize() {
    this.measure();
    if (!this.running) this.draw();
  }

  destroy() {
    this.stop();
    this.timeline?.kill();
    this.timeline = null;
    this.particles = [];
    if (this.interaction) {
      this.canvas.removeEventListener("mouseenter", this.onEnter);
      this.canvas.removeEventListener("mouseleave", this.onLeave);
      this.canvas.removeEventListener("mousemove", this.onMove);
    }
    this.canvas.remove();
  }
}

```


5. Build this: a live ASCII particle field that spells a word: GPGPU flow-field particles simulated on the GPU, rendered as a grid of ASCII glyphs that drift and react to the cursor.

The complete, self-contained implementation follows, one file per block. It is framework-agnostic core logic — wire it into your own component and mount it on an element.

### ascii-wordmark/shaders.ts

```ts
export const GPGPU_COMPUTE =  `
uniform float uTime;
uniform float uDeltaTime;
uniform float uFlowFieldInfluence;
uniform float uFlowFieldStrength;
uniform float uFlowFieldFrequency;

uniform vec3  uMouse;
uniform float uMouseStrength;
uniform float uMouseSpeed;

uniform sampler2D uBase;

vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
float permute(float x){return floor(mod(((x*34.0)+1.0)*x, 289.0));}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}
float taylorInvSqrt(float r){return 1.79284291400159 - 0.85373472095314 * r;}

vec4 grad4(float j, vec4 ip){
  const vec4 ones = vec4(1.0, 1.0, 1.0, -1.0);
  vec4 p,s;
  p.xyz = floor( fract (vec3(j) * ip.xyz) * 7.0) * ip.z - 1.0;
  p.w = 1.5 - dot(abs(p.xyz), ones.xyz);
  s = vec4(lessThan(p, vec4(0.0)));
  p.xyz = p.xyz + (s.xyz*2.0 - 1.0) * s.www;
  return p;
}

float simplexNoise4d(vec4 v){
  const vec2  C = vec2( 0.138196601125010504, 0.309016994374947451);
  vec4 i  = floor(v + dot(v, C.yyyy) );
  vec4 x0 = v -   i + dot(i, C.xxxx);
  vec4 i0;
  vec3 isX = step( x0.yzw, x0.xxx );
  vec3 isYZ = step( x0.zww, x0.yyz );
  i0.x = isX.x + isX.y + isX.z;
  i0.yzw = 1.0 - isX;
  i0.y += isYZ.x + isYZ.y;
  i0.zw += 1.0 - isYZ.xy;
  i0.z += isYZ.z;
  i0.w += 1.0 - isYZ.z;
  vec4 i3 = clamp( i0, 0.0, 1.0 );
  vec4 i2 = clamp( i0-1.0, 0.0, 1.0 );
  vec4 i1 = clamp( i0-2.0, 0.0, 1.0 );
  vec4 x1 = x0 - i1 + 1.0 * C.xxxx;
  vec4 x2 = x0 - i2 + 2.0 * C.xxxx;
  vec4 x3 = x0 - i3 + 3.0 * C.xxxx;
  vec4 x4 = x0 - 1.0 + 4.0 * C.xxxx;
  i = mod(i, 289.0);
  float j0 = permute( permute( permute( permute(i.w) + i.z) + i.y) + i.x);
  vec4 j1 = permute( permute( permute( permute (
             i.w + vec4(i1.w, i2.w, i3.w, 1.0 ))
           + i.z + vec4(i1.z, i2.z, i3.z, 1.0 ))
           + i.y + vec4(i1.y, i2.y, i3.y, 1.0 ))
           + i.x + vec4(i1.x, i2.x, i3.x, 1.0 ));
  vec4 ip = vec4(1.0/294.0, 1.0/49.0, 1.0/7.0, 0.0) ;
  vec4 p0 = grad4(j0,   ip);
  vec4 p1 = grad4(j1.x, ip);
  vec4 p2 = grad4(j1.y, ip);
  vec4 p3 = grad4(j1.z, ip);
  vec4 p4 = grad4(j1.w, ip);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  p4 *= taylorInvSqrt(dot(p4,p4));
  vec3 m0 = max(0.6 - vec3(dot(x0,x0), dot(x1,x1), dot(x2,x2)), 0.0);
  vec2 m1 = max(0.6 - vec2(dot(x3,x3), dot(x4,x4)            ), 0.0);
  m0 = m0 * m0;
  m1 = m1 * m1;
  return 49.0 * ( dot(m0*m0, vec3( dot( p0, x0 ), dot( p1, x1 ), dot( p2, x2 )))
               + dot(m1*m1, vec2( dot( p3, x3 ), dot( p4, x4 ) ) ) ) ;
}

void main() {
  float time = uTime * 0.2;
  vec2 uv = gl_FragCoord.xy / resolution.xy;
  vec4 particle = texture(uParticles, uv);
  vec4 base = texture(uBase, uv);

  float uRepelStrength = clamp(uMouseSpeed, 0.0, uMouseStrength);
  vec3 particlePos = particle.xyz;
  vec3 dir = normalize(particlePos - uMouse);
  float dist = distance(uMouse, particlePos);
  float repulsionForce = uRepelStrength / (dist * (dist + 1.0));
  vec3 repulsion = dir * repulsionForce * 2.0;
  particle.xyz += repulsion * uRepelStrength;

  if (particle.a >= 1.0) {

    particle.a = mod(particle.a, 1.0);
    particle.xyz = base.xyz;
  } else {

    float strength = simplexNoise4d(vec4(base.xyz, time + 1.0));
    float influence = (uFlowFieldInfluence - 0.5) * (- 2.0);
    strength = smoothstep(influence, 1.0, strength);

    vec3 flowField = vec3(
      simplexNoise4d(vec4(particle.xyz * uFlowFieldFrequency + 0.0, time)),
      simplexNoise4d(vec4(particle.xyz * uFlowFieldFrequency + 1.0, time)),
      simplexNoise4d(vec4(particle.xyz * uFlowFieldFrequency + 2.0, time))
    );
    flowField = normalize(flowField);
    particle.xyz += flowField * uDeltaTime * strength * uFlowFieldStrength;

    particle.a += uDeltaTime * 0.3;
    vec3 toTarget = base.xyz - particle.xyz;
    particle.xyz += toTarget * uDeltaTime * 2.2;
  }

  gl_FragColor = particle;
}
`;

export const PARTICLE_VERT =  `
uniform vec2 uResolution;
uniform float uSize;
uniform float uVisibility;
uniform sampler2D uParticlesTexture;

attribute vec2 aParticlesUv;
attribute float aSize;

varying float vAlpha;

void main() {
  vec4 particle = texture2D(uParticlesTexture, aParticlesUv);

  vec4 modelPosition = modelMatrix * vec4(particle.xyz, 1.0);
  vec4 viewPosition = viewMatrix * modelPosition;
  gl_Position = projectionMatrix * viewPosition;

  vAlpha = uVisibility;
  gl_PointSize = uSize * aSize * uResolution.y * 0.006;
  gl_PointSize *= (1.0 / - viewPosition.z);
}
`;

export const PARTICLE_FRAG =  `
varying float vAlpha;
void main() {

  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  if (d > 0.5) discard;
  float a = smoothstep(0.5, 0.15, d) * vAlpha;

  gl_FragColor = vec4(vec3(1.0), a);
}
`;

export const ASCII_VERT =  `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const TRAIL_LEN = 24;

export const ASCII_FRAG =  `
uniform sampler2D tDiffuse;
uniform vec2 uResolution;
uniform float uAsciiPixelSize;
uniform sampler2D uAsciiTexture;
uniform vec2 uCharCount;
uniform float uAsciiContrast;
uniform float uAsciiBrightness;
uniform float uAsciiMin;
uniform float uAsciiMax;

uniform float uAspect;
uniform vec3  uInk;
uniform vec2  uTrail[${TRAIL_LEN}];
uniform float uTrailAge[${TRAIL_LEN}];
uniform float uTrailOn;

varying vec2 vUv;

void main() {
  vec2 normalizedPixelSize = uAsciiPixelSize / uResolution;
  vec2 uvPixel = normalizedPixelSize * floor(vUv / normalizedPixelSize);
  vec4 texColor = texture2D(tDiffuse, uvPixel);

  float lumaRGB = dot(vec3(0.2126, 0.7152, 0.0722), texColor.rgb);
  float luma = max(lumaRGB, texColor.a);

  luma = (luma - uAsciiMin) / (uAsciiMax - uAsciiMin);
  luma = clamp(luma, 0.0, 1.0);
  luma = luma + uAsciiBrightness;
  luma = (luma - 0.5) * uAsciiContrast + 0.5;
  luma = clamp(luma, 0.0, 1.0);

  vec2 cellUV = fract(vUv / normalizedPixelSize);
  float charIndex = clamp(
    floor(luma * (uCharCount.x - 1.0)),
    0.0,
    uCharCount.x - 1.0
  );
  vec2 asciiUV = vec2(
    (charIndex + cellUV.x) / uCharCount.x,
    cellUV.y
  );
  float character = texture2D(uAsciiTexture, asciiUV).r;

  vec2 cellCenter = uvPixel + normalizedPixelSize * 0.5;

  vec3 inkDeep = vec3(0.14, 0.16, 0.30);
  vec3 inkLift = vec3(0.20, 0.24, 0.42);
  vec3 baseColor = mix(inkDeep, inkLift, smoothstep(0.0, 1.0, cellCenter.x));

  float trail = 0.0;
  float headness = 0.0;
  for (int i = 0; i < ${TRAIL_LEN}; i++) {
    float age = uTrailAge[i];
    if (age >= 1.0) continue;
    vec2 d = (cellCenter - uTrail[i]) * vec2(uAspect, 1.0);
    float rad = 0.16 + age * 0.10;
    float g = smoothstep(rad, 0.0, length(d)) * (1.0 - age);
    if (g > trail) { trail = g; headness = 1.0 - age; }
  }
  trail *= uTrailOn;

  vec3 trailCool = vec3(0.29, 0.23, 1.0);
  vec3 trailHot  = vec3(1.0, 0.32, 0.68);
  vec3 trailColor = mix(trailCool, trailHot, headness);

  vec3 glyphColor = mix(baseColor, trailColor, clamp(trail, 0.0, 1.0));

  float ink = character * smoothstep(0.015, 0.18, luma);
  ink = min(1.0, ink + trail * character * 0.3);

  gl_FragColor = vec4(glyphColor * ink, ink);
}
`;

```

### ascii-wordmark/atlas.ts

```ts
export const RAMP = " .:-=+*#%VAULT";

export function buildAtlas(ramp = RAMP, cell = 64): HTMLCanvasElement {
  const n = ramp.length;
  const c = document.createElement("canvas");
  c.width = cell * n;
  c.height = cell;
  const ctx = c.getContext("2d")!;
  ctx.clearRect(0, 0, c.width, c.height);
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.font = `${Math.floor(cell * 0.74)}px ui-monospace, "SF Mono", Menlo, monospace`;
  for (let i = 0; i < n; i++) {
    const ch = ramp[i];
    if (ch !== " ") ctx.fillText(ch, i * cell + cell / 2, cell / 2 + cell * 0.04);
  }
  return c;
}

```

### ascii-wordmark/word-points.ts

```ts
export interface WordPoints {
  positions: Float32Array;
  count: number;
  aspect: number;
}

export function buildWordPoints(
  word: string,
  size: number,
): WordPoints {
  const count = size * size;

  const W = 1024;
  const H = 320;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  let fontSize = 240;
  ctx.font = `800 ${fontSize}px ui-sans-serif, system-ui, sans-serif`;
  const margin = 80;
  const measured = ctx.measureText(word).width;
  if (measured > W - margin) {
    fontSize = Math.floor(fontSize * ((W - margin) / measured));
    ctx.font = `800 ${fontSize}px ui-sans-serif, system-ui, sans-serif`;
  }
  ctx.fillText(word, W / 2, H / 2);

  const data = ctx.getImageData(0, 0, W, H).data;

  const lit: [number, number][] = [];
  const stride = 2;
  for (let y = 0; y < H; y += stride) {
    for (let x = 0; x < W; x += stride) {
      const a = data[(y * W + x) * 4 + 3];
      if (a > 128) lit.push([x, y]);
    }
  }

  if (lit.length === 0) {
    for (let i = 0; i < 256; i++) lit.push([W / 2, H / 2]);
  }

  const aspect = W / H;
  const positions = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {

    const p = lit[(Math.random() * lit.length) | 0];
    const jx = (Math.random() - 0.5) * stride;
    const jy = (Math.random() - 0.5) * stride;
    const nx = ((p[0] + jx) / W - 0.5) * 2 * aspect;
    const ny = -((p[1] + jy) / H - 0.5) * 2;
    const nz = (Math.random() - 0.5) * 0.08;

    positions[i * 4 + 0] = nx;
    positions[i * 4 + 1] = ny;
    positions[i * 4 + 2] = nz;
    positions[i * 4 + 3] = Math.random();
  }

  return { positions, count, aspect };
}

```

### ascii-wordmark/renderer.ts

```ts
import * as THREE from "three";
import { GPUComputationRenderer } from "three/examples/jsm/misc/GPUComputationRenderer.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import {
  GPGPU_COMPUTE,
  PARTICLE_VERT,
  PARTICLE_FRAG,
  ASCII_VERT,
  ASCII_FRAG,
  TRAIL_LEN,
} from "./shaders";
import { buildAtlas, RAMP } from "./atlas";
import { buildWordPoints } from "./word-points";

const FLOW_INFLUENCE = 0.43;
const FLOW_STRENGTH = 1.09;
const FLOW_FREQUENCY = 0.53;
const MOUSE_STRENGTH = 0.08;
const MOUSE_SPEED_GAIN = 1.5;

const IS_TOUCH =
  typeof window !== "undefined" &&
  (window.matchMedia?.("(pointer: coarse)").matches ?? false);

const FBO_SIZE = IS_TOUCH ? 128 : 200;
const MAX_DPR = IS_TOUCH ? 1.5 : 2;
const RENDER_SCALE = 0.5;
const ASCII_CELL_DIVISOR = 100;

export interface AsciiWordmarkOptions {
  word: string;
  inkColor: string;
}

export class AsciiWordmarkRenderer {
  private host: HTMLElement;
  private opts: AsciiWordmarkOptions;

  private renderer!: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera!: THREE.PerspectiveCamera;
  private composer!: EffectComposer;
  private asciiPass!: ShaderPass;

  private gpgpu!: GPUComputationRenderer;
  private posVar!: ReturnType<GPUComputationRenderer["addVariable"]>;
  private points!: THREE.Points;
  private pointsMat!: THREE.ShaderMaterial;

  private clock = new THREE.Clock();
  private raf = 0;
  private running = false;
  private onScreen = true;
  private disposed = false;

  private mouse = new THREE.Vector3(9999, 9999, 0);
  private prevMouse = new THREE.Vector3(9999, 9999, 0);
  private mouseSpeed = 0;

  private mouseUv = new THREE.Vector2(9999, 9999);
  private onCard = false;

  private trailPos: THREE.Vector2[] = [];
  private trailAge: Float32Array = new Float32Array(TRAIL_LEN).fill(1);
  private trailOn = 0;
  private visibility = 0;
  private wordAspect = 3;
  private readonly WORD_MARGIN = 0.92;

  private io?: IntersectionObserver;
  private ro?: ResizeObserver;

  constructor(host: HTMLElement, opts: AsciiWordmarkOptions) {
    this.host = host;
    this.opts = opts;
  }

  mount(): boolean {
    const { clientWidth: w, clientHeight: h } = this.host;
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);

    this.renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: false,
      powerPreference: "high-performance",
      failIfMajorPerformanceCaveat: false,
    });
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h);
    this.renderer.setClearColor(0x000000, 0);
    this.host.appendChild(this.renderer.domElement);
    Object.assign(this.renderer.domElement.style, {
      position: "absolute",
      inset: "0",
      width: "100%",
      height: "100%",
      display: "block",

      touchAction: "pan-y",
      userSelect: "none",
      WebkitUserSelect: "none",
    });

    const { positions, count, aspect } = buildWordPoints(this.opts.word, FBO_SIZE);
    this.wordAspect = aspect;

    this.camera = new THREE.PerspectiveCamera(35, w / h, 0.1, 100);
    this.frameWord(w / h);
    this.camera.lookAt(0, 0, 0);

    if (!this.initGPGPU(positions)) return false;
    this.initPoints(count);
    this.initComposer(w, h, dpr);

    this.bindEvents();
    return true;
  }

  private initGPGPU(positions: Float32Array): boolean {
    this.gpgpu = new GPUComputationRenderer(FBO_SIZE, FBO_SIZE, this.renderer);

    this.gpgpu.setDataType(THREE.HalfFloatType);

    const baseTex = this.gpgpu.createTexture();
    (baseTex.image.data as Float32Array).set(positions);

    const initTex = this.gpgpu.createTexture();
    (initTex.image.data as Float32Array).set(positions);

    this.posVar = this.gpgpu.addVariable("uParticles", GPGPU_COMPUTE, initTex);
    this.gpgpu.setVariableDependencies(this.posVar, [this.posVar]);

    const u = this.posVar.material.uniforms;
    u.uTime = { value: 0 };
    u.uDeltaTime = { value: 0 };
    u.uBase = { value: baseTex };
    u.uFlowFieldInfluence = { value: FLOW_INFLUENCE };
    u.uFlowFieldStrength = { value: FLOW_STRENGTH };
    u.uFlowFieldFrequency = { value: FLOW_FREQUENCY };
    u.uMouse = { value: new THREE.Vector3(9999, 9999, 0) };
    u.uMouseStrength = { value: MOUSE_STRENGTH };
    u.uMouseSpeed = { value: 0 };

    const err = this.gpgpu.init();
    if (err) {

      console.warn("[ascii-wordmark] GPGPU unsupported, skipping:", err);
      return false;
    }
    return true;
  }

  private initPoints(count: number) {
    const geo = new THREE.BufferGeometry();

    const uvs = new Float32Array(count * 2);
    const sizes = new Float32Array(count);
    let i = 0;
    for (let y = 0; y < FBO_SIZE; y++) {
      for (let x = 0; x < FBO_SIZE; x++) {
        uvs[i * 2] = (x + 0.5) / FBO_SIZE;
        uvs[i * 2 + 1] = (y + 0.5) / FBO_SIZE;
        sizes[i] = 0.6 + Math.random() * 0.8;
        i++;
      }
    }

    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    geo.setAttribute("aParticlesUv", new THREE.BufferAttribute(uvs, 2));
    geo.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
    geo.setDrawRange(0, count);

    this.pointsMat = new THREE.ShaderMaterial({
      vertexShader: PARTICLE_VERT,
      fragmentShader: PARTICLE_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uResolution: { value: new THREE.Vector2() },
        uSize: { value: 4 },
        uVisibility: { value: 0 },
        uParticlesTexture: { value: null },
      },
    });

    this.points = new THREE.Points(geo, this.pointsMat);
    this.points.frustumCulled = false;
    this.scene.add(this.points);
  }

  private initComposer(w: number, h: number, dpr: number) {
    const bw = Math.max(2, Math.round(w * RENDER_SCALE));
    const bh = Math.max(2, Math.round(h * RENDER_SCALE));

    this.composer = new EffectComposer(this.renderer);
    this.composer.setPixelRatio(dpr);
    this.composer.setSize(w, h);
    this.composer.addPass(new RenderPass(this.scene, this.camera));

    const atlas = buildAtlas(RAMP);
    const atlasTex = new THREE.CanvasTexture(atlas);
    atlasTex.minFilter = THREE.LinearFilter;
    atlasTex.magFilter = THREE.LinearFilter;

    const cell = (bw * dpr) / ASCII_CELL_DIVISOR;

    const ink = new THREE.Color(this.opts.inkColor);

    this.trailPos = Array.from({ length: TRAIL_LEN }, () => new THREE.Vector2(9999, 9999));
    this.trailAge = new Float32Array(TRAIL_LEN).fill(1);

    this.asciiPass = new ShaderPass({
      uniforms: {
        tDiffuse: { value: null },
        uResolution: { value: new THREE.Vector2(bw * dpr, bh * dpr) },
        uAsciiPixelSize: { value: cell },
        uAsciiTexture: { value: atlasTex },
        uCharCount: { value: new THREE.Vector2(RAMP.length, 1) },
        uAsciiContrast: { value: 1.4 },
        uAsciiBrightness: { value: 0.12 },
        uAsciiMin: { value: 0.0 },
        uAsciiMax: { value: 1.0 },
        uAspect: { value: w / h },
        uInk: { value: new THREE.Vector3(ink.r, ink.g, ink.b) },
        uTrail: { value: this.trailPos },
        uTrailAge: { value: this.trailAge },
        uTrailOn: { value: 0 },
      },
      vertexShader: ASCII_VERT,
      fragmentShader: ASCII_FRAG,
    });
    this.asciiPass.renderToScreen = true;
    this.composer.addPass(this.asciiPass);

    this.pointsMat.uniforms.uResolution.value.set(w * dpr, h * dpr);
  }

  private bindEvents() {
    const onPointerMove = (e: PointerEvent) => {
      const r = this.host.getBoundingClientRect();

      const nx = ((e.clientX - r.left) / r.width) * 2 - 1;
      const ny = -(((e.clientY - r.top) / r.height) * 2 - 1);
      const v = new THREE.Vector3(nx, ny, 0.5).unproject(this.camera);
      const dir = v.sub(this.camera.position).normalize();
      const dist = -this.camera.position.z / dir.z;
      this.mouse.copy(this.camera.position).add(dir.multiplyScalar(dist));

      this.mouseUv.set((e.clientX - r.left) / r.width, 1 - (e.clientY - r.top) / r.height);
      this.onCard = true;
    };
    const onPointerLeave = () => {
      this.mouse.set(9999, 9999, 0);
      this.mouseUv.set(9999, 9999);
      this.onCard = false;
    };

    this.host.addEventListener("pointermove", onPointerMove);
    this.host.addEventListener("pointerleave", onPointerLeave);
    this.cleanupFns.push(() => {
      this.host.removeEventListener("pointermove", onPointerMove);
      this.host.removeEventListener("pointerleave", onPointerLeave);
    });

    const onVis = () => (document.hidden ? this.stop() : this.maybeStart());
    document.addEventListener("visibilitychange", onVis);
    this.cleanupFns.push(() => document.removeEventListener("visibilitychange", onVis));

    this.io = new IntersectionObserver(
      (es) => {
        this.onScreen = es[0]?.isIntersecting ?? true;
        this.onScreen ? this.maybeStart() : this.stop();
      },
      { threshold: 0.01 },
    );
    this.io.observe(this.host);

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(this.host);
  }

  private cleanupFns: (() => void)[] = [];

  private frameWord(viewportAspect: number) {
    const halfV = THREE.MathUtils.degToRad(this.camera.fov) / 2;
    const tanV = Math.tan(halfV);
    const distForHeight = 1.0 / tanV;
    const distForWidth = this.wordAspect / (tanV * viewportAspect);
    const dist = Math.max(distForHeight, distForWidth) * this.WORD_MARGIN;
    this.camera.position.set(0, 0, dist);
  }

  private resize() {
    if (this.disposed) return;
    const { clientWidth: w, clientHeight: h } = this.host;
    if (w === 0 || h === 0) return;
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h);
    this.composer.setPixelRatio(dpr);
    this.composer.setSize(w, h);
    this.camera.aspect = w / h;
    this.frameWord(w / h);
    this.camera.updateProjectionMatrix();

    const bw = Math.max(2, Math.round(w * RENDER_SCALE));
    const bh = Math.max(2, Math.round(h * RENDER_SCALE));
    this.asciiPass.uniforms.uResolution.value.set(bw * dpr, bh * dpr);
    this.asciiPass.uniforms.uAsciiPixelSize.value = (bw * dpr) / ASCII_CELL_DIVISOR;
    this.asciiPass.uniforms.uAspect.value = w / h;
    this.pointsMat.uniforms.uResolution.value.set(w * dpr, h * dpr);
  }

  start() {
    this.onScreen = true;
    this.maybeStart();
  }

  private maybeStart() {
    if (this.disposed || this.running || !this.onScreen || document.hidden) return;
    this.running = true;
    this.clock.getDelta();
    this.raf = requestAnimationFrame(this.loop);
  }

  stop() {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  private advanceTrail(dt: number) {
    const TRAIL_LIFE = 0.75;
    for (let i = 0; i < TRAIL_LEN; i++) {
      this.trailAge[i] = Math.min(1, this.trailAge[i] + dt / TRAIL_LIFE);
    }
    if (this.onCard) {

      for (let i = TRAIL_LEN - 1; i > 0; i--) {
        this.trailPos[i].copy(this.trailPos[i - 1]);
        this.trailAge[i] = this.trailAge[i - 1];
      }
      this.trailPos[0].copy(this.mouseUv);
      this.trailAge[0] = 0;
    }

    this.asciiPass.uniforms.uTrailAge.value = this.trailAge;
  }

  private loop = () => {
    if (!this.running) return;
    const dt = Math.min(this.clock.getDelta(), 1 / 30);
    const t = this.clock.elapsedTime;

    this.mouseSpeed = this.mouse.distanceTo(this.prevMouse);
    if (this.mouse.x > 9000) this.mouseSpeed = 0;
    this.prevMouse.copy(this.mouse);

    const cu = this.posVar.material.uniforms;
    cu.uTime.value = t;
    cu.uDeltaTime.value = dt;
    cu.uMouse.value.copy(this.mouse);
    cu.uMouseSpeed.value = this.mouseSpeed * MOUSE_SPEED_GAIN;
    this.gpgpu.compute();

    this.pointsMat.uniforms.uParticlesTexture.value =
      this.gpgpu.getCurrentRenderTarget(this.posVar).texture;

    this.visibility = Math.min(1, this.visibility + dt * 0.9);
    this.pointsMat.uniforms.uVisibility.value = this.visibility;

    const au = this.asciiPass.uniforms;
    this.advanceTrail(dt);

    this.trailOn += ((this.onCard ? 1 : 0) - this.trailOn) * Math.min(1, dt * 6);
    au.uTrailOn.value = this.trailOn;

    this.composer.render();
    this.raf = requestAnimationFrame(this.loop);
  };

  dispose() {
    this.disposed = true;
    this.stop();
    this.cleanupFns.forEach((fn) => fn());
    this.io?.disconnect();
    this.ro?.disconnect();
    this.points?.geometry.dispose();
    this.pointsMat?.dispose();
    this.asciiPass?.uniforms.uAsciiTexture.value?.dispose?.();
    this.gpgpu?.dispose?.();
    this.composer?.dispose?.();
    this.renderer?.dispose();
    this.renderer?.forceContextLoss?.();
    if (this.renderer?.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
  }
}

```


6. Build this: a live ASCII particle field that spells a word: GPGPU flow-field particles simulated on the GPU, rendered as a grid of ASCII glyphs that drift and react to the cursor.

The complete, self-contained implementation follows, one file per block. It is framework-agnostic core logic — wire it into your own component and mount it on an element.

### ascii-wordmark/shaders.ts

```ts
export const GPGPU_COMPUTE =  `
uniform float uTime;
uniform float uDeltaTime;
uniform float uFlowFieldInfluence;
uniform float uFlowFieldStrength;
uniform float uFlowFieldFrequency;

uniform vec3  uMouse;
uniform float uMouseStrength;
uniform float uMouseSpeed;

uniform sampler2D uBase;

vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
float permute(float x){return floor(mod(((x*34.0)+1.0)*x, 289.0));}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}
float taylorInvSqrt(float r){return 1.79284291400159 - 0.85373472095314 * r;}

vec4 grad4(float j, vec4 ip){
  const vec4 ones = vec4(1.0, 1.0, 1.0, -1.0);
  vec4 p,s;
  p.xyz = floor( fract (vec3(j) * ip.xyz) * 7.0) * ip.z - 1.0;
  p.w = 1.5 - dot(abs(p.xyz), ones.xyz);
  s = vec4(lessThan(p, vec4(0.0)));
  p.xyz = p.xyz + (s.xyz*2.0 - 1.0) * s.www;
  return p;
}

float simplexNoise4d(vec4 v){
  const vec2  C = vec2( 0.138196601125010504, 0.309016994374947451);
  vec4 i  = floor(v + dot(v, C.yyyy) );
  vec4 x0 = v -   i + dot(i, C.xxxx);
  vec4 i0;
  vec3 isX = step( x0.yzw, x0.xxx );
  vec3 isYZ = step( x0.zww, x0.yyz );
  i0.x = isX.x + isX.y + isX.z;
  i0.yzw = 1.0 - isX;
  i0.y += isYZ.x + isYZ.y;
  i0.zw += 1.0 - isYZ.xy;
  i0.z += isYZ.z;
  i0.w += 1.0 - isYZ.z;
  vec4 i3 = clamp( i0, 0.0, 1.0 );
  vec4 i2 = clamp( i0-1.0, 0.0, 1.0 );
  vec4 i1 = clamp( i0-2.0, 0.0, 1.0 );
  vec4 x1 = x0 - i1 + 1.0 * C.xxxx;
  vec4 x2 = x0 - i2 + 2.0 * C.xxxx;
  vec4 x3 = x0 - i3 + 3.0 * C.xxxx;
  vec4 x4 = x0 - 1.0 + 4.0 * C.xxxx;
  i = mod(i, 289.0);
  float j0 = permute( permute( permute( permute(i.w) + i.z) + i.y) + i.x);
  vec4 j1 = permute( permute( permute( permute (
             i.w + vec4(i1.w, i2.w, i3.w, 1.0 ))
           + i.z + vec4(i1.z, i2.z, i3.z, 1.0 ))
           + i.y + vec4(i1.y, i2.y, i3.y, 1.0 ))
           + i.x + vec4(i1.x, i2.x, i3.x, 1.0 ));
  vec4 ip = vec4(1.0/294.0, 1.0/49.0, 1.0/7.0, 0.0) ;
  vec4 p0 = grad4(j0,   ip);
  vec4 p1 = grad4(j1.x, ip);
  vec4 p2 = grad4(j1.y, ip);
  vec4 p3 = grad4(j1.z, ip);
  vec4 p4 = grad4(j1.w, ip);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  p4 *= taylorInvSqrt(dot(p4,p4));
  vec3 m0 = max(0.6 - vec3(dot(x0,x0), dot(x1,x1), dot(x2,x2)), 0.0);
  vec2 m1 = max(0.6 - vec2(dot(x3,x3), dot(x4,x4)            ), 0.0);
  m0 = m0 * m0;
  m1 = m1 * m1;
  return 49.0 * ( dot(m0*m0, vec3( dot( p0, x0 ), dot( p1, x1 ), dot( p2, x2 )))
               + dot(m1*m1, vec2( dot( p3, x3 ), dot( p4, x4 ) ) ) ) ;
}

void main() {
  float time = uTime * 0.2;
  vec2 uv = gl_FragCoord.xy / resolution.xy;
  vec4 particle = texture(uParticles, uv);
  vec4 base = texture(uBase, uv);

  float uRepelStrength = clamp(uMouseSpeed, 0.0, uMouseStrength);
  vec3 particlePos = particle.xyz;
  vec3 dir = normalize(particlePos - uMouse);
  float dist = distance(uMouse, particlePos);
  float repulsionForce = uRepelStrength / (dist * (dist + 1.0));
  vec3 repulsion = dir * repulsionForce * 2.0;
  particle.xyz += repulsion * uRepelStrength;

  if (particle.a >= 1.0) {

    particle.a = mod(particle.a, 1.0);
    particle.xyz = base.xyz;
  } else {

    float strength = simplexNoise4d(vec4(base.xyz, time + 1.0));
    float influence = (uFlowFieldInfluence - 0.5) * (- 2.0);
    strength = smoothstep(influence, 1.0, strength);

    vec3 flowField = vec3(
      simplexNoise4d(vec4(particle.xyz * uFlowFieldFrequency + 0.0, time)),
      simplexNoise4d(vec4(particle.xyz * uFlowFieldFrequency + 1.0, time)),
      simplexNoise4d(vec4(particle.xyz * uFlowFieldFrequency + 2.0, time))
    );
    flowField = normalize(flowField);
    particle.xyz += flowField * uDeltaTime * strength * uFlowFieldStrength;

    particle.a += uDeltaTime * 0.3;
    vec3 toTarget = base.xyz - particle.xyz;
    particle.xyz += toTarget * uDeltaTime * 2.2;
  }

  gl_FragColor = particle;
}
`;

export const PARTICLE_VERT =  `
uniform vec2 uResolution;
uniform float uSize;
uniform float uVisibility;
uniform sampler2D uParticlesTexture;

attribute vec2 aParticlesUv;
attribute float aSize;

varying float vAlpha;

void main() {
  vec4 particle = texture2D(uParticlesTexture, aParticlesUv);

  vec4 modelPosition = modelMatrix * vec4(particle.xyz, 1.0);
  vec4 viewPosition = viewMatrix * modelPosition;
  gl_Position = projectionMatrix * viewPosition;

  vAlpha = uVisibility;
  gl_PointSize = uSize * aSize * uResolution.y * 0.006;
  gl_PointSize *= (1.0 / - viewPosition.z);
}
`;

export const PARTICLE_FRAG =  `
varying float vAlpha;
void main() {

  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  if (d > 0.5) discard;
  float a = smoothstep(0.5, 0.15, d) * vAlpha;

  gl_FragColor = vec4(vec3(1.0), a);
}
`;

export const ASCII_VERT =  `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const TRAIL_LEN = 24;

export const ASCII_FRAG =  `
uniform sampler2D tDiffuse;
uniform vec2 uResolution;
uniform float uAsciiPixelSize;
uniform sampler2D uAsciiTexture;
uniform vec2 uCharCount;
uniform float uAsciiContrast;
uniform float uAsciiBrightness;
uniform float uAsciiMin;
uniform float uAsciiMax;

uniform float uAspect;
uniform vec3  uInk;
uniform vec2  uTrail[${TRAIL_LEN}];
uniform float uTrailAge[${TRAIL_LEN}];
uniform float uTrailOn;

varying vec2 vUv;

void main() {
  vec2 normalizedPixelSize = uAsciiPixelSize / uResolution;
  vec2 uvPixel = normalizedPixelSize * floor(vUv / normalizedPixelSize);
  vec4 texColor = texture2D(tDiffuse, uvPixel);

  float lumaRGB = dot(vec3(0.2126, 0.7152, 0.0722), texColor.rgb);
  float luma = max(lumaRGB, texColor.a);

  luma = (luma - uAsciiMin) / (uAsciiMax - uAsciiMin);
  luma = clamp(luma, 0.0, 1.0);
  luma = luma + uAsciiBrightness;
  luma = (luma - 0.5) * uAsciiContrast + 0.5;
  luma = clamp(luma, 0.0, 1.0);

  vec2 cellUV = fract(vUv / normalizedPixelSize);
  float charIndex = clamp(
    floor(luma * (uCharCount.x - 1.0)),
    0.0,
    uCharCount.x - 1.0
  );
  vec2 asciiUV = vec2(
    (charIndex + cellUV.x) / uCharCount.x,
    cellUV.y
  );
  float character = texture2D(uAsciiTexture, asciiUV).r;

  vec2 cellCenter = uvPixel + normalizedPixelSize * 0.5;

  vec3 inkDeep = vec3(0.14, 0.16, 0.30);
  vec3 inkLift = vec3(0.20, 0.24, 0.42);
  vec3 baseColor = mix(inkDeep, inkLift, smoothstep(0.0, 1.0, cellCenter.x));

  float trail = 0.0;
  float headness = 0.0;
  for (int i = 0; i < ${TRAIL_LEN}; i++) {
    float age = uTrailAge[i];
    if (age >= 1.0) continue;
    vec2 d = (cellCenter - uTrail[i]) * vec2(uAspect, 1.0);
    float rad = 0.16 + age * 0.10;
    float g = smoothstep(rad, 0.0, length(d)) * (1.0 - age);
    if (g > trail) { trail = g; headness = 1.0 - age; }
  }
  trail *= uTrailOn;

  vec3 trailCool = vec3(0.29, 0.23, 1.0);
  vec3 trailHot  = vec3(1.0, 0.32, 0.68);
  vec3 trailColor = mix(trailCool, trailHot, headness);

  vec3 glyphColor = mix(baseColor, trailColor, clamp(trail, 0.0, 1.0));

  float ink = character * smoothstep(0.015, 0.18, luma);
  ink = min(1.0, ink + trail * character * 0.3);

  gl_FragColor = vec4(glyphColor * ink, ink);
}
`;

```

### ascii-wordmark/atlas.ts

```ts
export const RAMP = " .:-=+*#%VAULT";

export function buildAtlas(ramp = RAMP, cell = 64): HTMLCanvasElement {
  const n = ramp.length;
  const c = document.createElement("canvas");
  c.width = cell * n;
  c.height = cell;
  const ctx = c.getContext("2d")!;
  ctx.clearRect(0, 0, c.width, c.height);
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.font = `${Math.floor(cell * 0.74)}px ui-monospace, "SF Mono", Menlo, monospace`;
  for (let i = 0; i < n; i++) {
    const ch = ramp[i];
    if (ch !== " ") ctx.fillText(ch, i * cell + cell / 2, cell / 2 + cell * 0.04);
  }
  return c;
}

```

### ascii-wordmark/word-points.ts

```ts
export interface WordPoints {
  positions: Float32Array;
  count: number;
  aspect: number;
}

export function buildWordPoints(
  word: string,
  size: number,
): WordPoints {
  const count = size * size;

  const W = 1024;
  const H = 320;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  let fontSize = 240;
  ctx.font = `800 ${fontSize}px ui-sans-serif, system-ui, sans-serif`;
  const margin = 80;
  const measured = ctx.measureText(word).width;
  if (measured > W - margin) {
    fontSize = Math.floor(fontSize * ((W - margin) / measured));
    ctx.font = `800 ${fontSize}px ui-sans-serif, system-ui, sans-serif`;
  }
  ctx.fillText(word, W / 2, H / 2);

  const data = ctx.getImageData(0, 0, W, H).data;

  const lit: [number, number][] = [];
  const stride = 2;
  for (let y = 0; y < H; y += stride) {
    for (let x = 0; x < W; x += stride) {
      const a = data[(y * W + x) * 4 + 3];
      if (a > 128) lit.push([x, y]);
    }
  }

  if (lit.length === 0) {
    for (let i = 0; i < 256; i++) lit.push([W / 2, H / 2]);
  }

  const aspect = W / H;
  const positions = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {

    const p = lit[(Math.random() * lit.length) | 0];
    const jx = (Math.random() - 0.5) * stride;
    const jy = (Math.random() - 0.5) * stride;
    const nx = ((p[0] + jx) / W - 0.5) * 2 * aspect;
    const ny = -((p[1] + jy) / H - 0.5) * 2;
    const nz = (Math.random() - 0.5) * 0.08;

    positions[i * 4 + 0] = nx;
    positions[i * 4 + 1] = ny;
    positions[i * 4 + 2] = nz;
    positions[i * 4 + 3] = Math.random();
  }

  return { positions, count, aspect };
}

```

### ascii-wordmark/renderer.ts

```ts
import * as THREE from "three";
import { GPUComputationRenderer } from "three/examples/jsm/misc/GPUComputationRenderer.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import {
  GPGPU_COMPUTE,
  PARTICLE_VERT,
  PARTICLE_FRAG,
  ASCII_VERT,
  ASCII_FRAG,
  TRAIL_LEN,
} from "./shaders";
import { buildAtlas, RAMP } from "./atlas";
import { buildWordPoints } from "./word-points";

const FLOW_INFLUENCE = 0.43;
const FLOW_STRENGTH = 1.09;
const FLOW_FREQUENCY = 0.53;
const MOUSE_STRENGTH = 0.08;
const MOUSE_SPEED_GAIN = 1.5;

const IS_TOUCH =
  typeof window !== "undefined" &&
  (window.matchMedia?.("(pointer: coarse)").matches ?? false);

const FBO_SIZE = IS_TOUCH ? 128 : 200;
const MAX_DPR = IS_TOUCH ? 1.5 : 2;
const RENDER_SCALE = 0.5;
const ASCII_CELL_DIVISOR = 100;

export interface AsciiWordmarkOptions {
  word: string;
  inkColor: string;
}

export class AsciiWordmarkRenderer {
  private host: HTMLElement;
  private opts: AsciiWordmarkOptions;

  private renderer!: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera!: THREE.PerspectiveCamera;
  private composer!: EffectComposer;
  private asciiPass!: ShaderPass;

  private gpgpu!: GPUComputationRenderer;
  private posVar!: ReturnType<GPUComputationRenderer["addVariable"]>;
  private points!: THREE.Points;
  private pointsMat!: THREE.ShaderMaterial;

  private clock = new THREE.Clock();
  private raf = 0;
  private running = false;
  private onScreen = true;
  private disposed = false;

  private mouse = new THREE.Vector3(9999, 9999, 0);
  private prevMouse = new THREE.Vector3(9999, 9999, 0);
  private mouseSpeed = 0;

  private mouseUv = new THREE.Vector2(9999, 9999);
  private onCard = false;

  private trailPos: THREE.Vector2[] = [];
  private trailAge: Float32Array = new Float32Array(TRAIL_LEN).fill(1);
  private trailOn = 0;
  private visibility = 0;
  private wordAspect = 3;
  private readonly WORD_MARGIN = 0.92;

  private io?: IntersectionObserver;
  private ro?: ResizeObserver;

  constructor(host: HTMLElement, opts: AsciiWordmarkOptions) {
    this.host = host;
    this.opts = opts;
  }

  mount(): boolean {
    const { clientWidth: w, clientHeight: h } = this.host;
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);

    this.renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: false,
      powerPreference: "high-performance",
      failIfMajorPerformanceCaveat: false,
    });
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h);
    this.renderer.setClearColor(0x000000, 0);
    this.host.appendChild(this.renderer.domElement);
    Object.assign(this.renderer.domElement.style, {
      position: "absolute",
      inset: "0",
      width: "100%",
      height: "100%",
      display: "block",

      touchAction: "pan-y",
      userSelect: "none",
      WebkitUserSelect: "none",
    });

    const { positions, count, aspect } = buildWordPoints(this.opts.word, FBO_SIZE);
    this.wordAspect = aspect;

    this.camera = new THREE.PerspectiveCamera(35, w / h, 0.1, 100);
    this.frameWord(w / h);
    this.camera.lookAt(0, 0, 0);

    if (!this.initGPGPU(positions)) return false;
    this.initPoints(count);
    this.initComposer(w, h, dpr);

    this.bindEvents();
    return true;
  }

  private initGPGPU(positions: Float32Array): boolean {
    this.gpgpu = new GPUComputationRenderer(FBO_SIZE, FBO_SIZE, this.renderer);

    this.gpgpu.setDataType(THREE.HalfFloatType);

    const baseTex = this.gpgpu.createTexture();
    (baseTex.image.data as Float32Array).set(positions);

    const initTex = this.gpgpu.createTexture();
    (initTex.image.data as Float32Array).set(positions);

    this.posVar = this.gpgpu.addVariable("uParticles", GPGPU_COMPUTE, initTex);
    this.gpgpu.setVariableDependencies(this.posVar, [this.posVar]);

    const u = this.posVar.material.uniforms;
    u.uTime = { value: 0 };
    u.uDeltaTime = { value: 0 };
    u.uBase = { value: baseTex };
    u.uFlowFieldInfluence = { value: FLOW_INFLUENCE };
    u.uFlowFieldStrength = { value: FLOW_STRENGTH };
    u.uFlowFieldFrequency = { value: FLOW_FREQUENCY };
    u.uMouse = { value: new THREE.Vector3(9999, 9999, 0) };
    u.uMouseStrength = { value: MOUSE_STRENGTH };
    u.uMouseSpeed = { value: 0 };

    const err = this.gpgpu.init();
    if (err) {

      console.warn("[ascii-wordmark] GPGPU unsupported, skipping:", err);
      return false;
    }
    return true;
  }

  private initPoints(count: number) {
    const geo = new THREE.BufferGeometry();

    const uvs = new Float32Array(count * 2);
    const sizes = new Float32Array(count);
    let i = 0;
    for (let y = 0; y < FBO_SIZE; y++) {
      for (let x = 0; x < FBO_SIZE; x++) {
        uvs[i * 2] = (x + 0.5) / FBO_SIZE;
        uvs[i * 2 + 1] = (y + 0.5) / FBO_SIZE;
        sizes[i] = 0.6 + Math.random() * 0.8;
        i++;
      }
    }

    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    geo.setAttribute("aParticlesUv", new THREE.BufferAttribute(uvs, 2));
    geo.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
    geo.setDrawRange(0, count);

    this.pointsMat = new THREE.ShaderMaterial({
      vertexShader: PARTICLE_VERT,
      fragmentShader: PARTICLE_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uResolution: { value: new THREE.Vector2() },
        uSize: { value: 4 },
        uVisibility: { value: 0 },
        uParticlesTexture: { value: null },
      },
    });

    this.points = new THREE.Points(geo, this.pointsMat);
    this.points.frustumCulled = false;
    this.scene.add(this.points);
  }

  private initComposer(w: number, h: number, dpr: number) {
    const bw = Math.max(2, Math.round(w * RENDER_SCALE));
    const bh = Math.max(2, Math.round(h * RENDER_SCALE));

    this.composer = new EffectComposer(this.renderer);
    this.composer.setPixelRatio(dpr);
    this.composer.setSize(w, h);
    this.composer.addPass(new RenderPass(this.scene, this.camera));

    const atlas = buildAtlas(RAMP);
    const atlasTex = new THREE.CanvasTexture(atlas);
    atlasTex.minFilter = THREE.LinearFilter;
    atlasTex.magFilter = THREE.LinearFilter;

    const cell = (bw * dpr) / ASCII_CELL_DIVISOR;

    const ink = new THREE.Color(this.opts.inkColor);

    this.trailPos = Array.from({ length: TRAIL_LEN }, () => new THREE.Vector2(9999, 9999));
    this.trailAge = new Float32Array(TRAIL_LEN).fill(1);

    this.asciiPass = new ShaderPass({
      uniforms: {
        tDiffuse: { value: null },
        uResolution: { value: new THREE.Vector2(bw * dpr, bh * dpr) },
        uAsciiPixelSize: { value: cell },
        uAsciiTexture: { value: atlasTex },
        uCharCount: { value: new THREE.Vector2(RAMP.length, 1) },
        uAsciiContrast: { value: 1.4 },
        uAsciiBrightness: { value: 0.12 },
        uAsciiMin: { value: 0.0 },
        uAsciiMax: { value: 1.0 },
        uAspect: { value: w / h },
        uInk: { value: new THREE.Vector3(ink.r, ink.g, ink.b) },
        uTrail: { value: this.trailPos },
        uTrailAge: { value: this.trailAge },
        uTrailOn: { value: 0 },
      },
      vertexShader: ASCII_VERT,
      fragmentShader: ASCII_FRAG,
    });
    this.asciiPass.renderToScreen = true;
    this.composer.addPass(this.asciiPass);

    this.pointsMat.uniforms.uResolution.value.set(w * dpr, h * dpr);
  }

  private bindEvents() {
    const onPointerMove = (e: PointerEvent) => {
      const r = this.host.getBoundingClientRect();

      const nx = ((e.clientX - r.left) / r.width) * 2 - 1;
      const ny = -(((e.clientY - r.top) / r.height) * 2 - 1);
      const v = new THREE.Vector3(nx, ny, 0.5).unproject(this.camera);
      const dir = v.sub(this.camera.position).normalize();
      const dist = -this.camera.position.z / dir.z;
      this.mouse.copy(this.camera.position).add(dir.multiplyScalar(dist));

      this.mouseUv.set((e.clientX - r.left) / r.width, 1 - (e.clientY - r.top) / r.height);
      this.onCard = true;
    };
    const onPointerLeave = () => {
      this.mouse.set(9999, 9999, 0);
      this.mouseUv.set(9999, 9999);
      this.onCard = false;
    };

    this.host.addEventListener("pointermove", onPointerMove);
    this.host.addEventListener("pointerleave", onPointerLeave);
    this.cleanupFns.push(() => {
      this.host.removeEventListener("pointermove", onPointerMove);
      this.host.removeEventListener("pointerleave", onPointerLeave);
    });

    const onVis = () => (document.hidden ? this.stop() : this.maybeStart());
    document.addEventListener("visibilitychange", onVis);
    this.cleanupFns.push(() => document.removeEventListener("visibilitychange", onVis));

    this.io = new IntersectionObserver(
      (es) => {
        this.onScreen = es[0]?.isIntersecting ?? true;
        this.onScreen ? this.maybeStart() : this.stop();
      },
      { threshold: 0.01 },
    );
    this.io.observe(this.host);

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(this.host);
  }

  private cleanupFns: (() => void)[] = [];

  private frameWord(viewportAspect: number) {
    const halfV = THREE.MathUtils.degToRad(this.camera.fov) / 2;
    const tanV = Math.tan(halfV);
    const distForHeight = 1.0 / tanV;
    const distForWidth = this.wordAspect / (tanV * viewportAspect);
    const dist = Math.max(distForHeight, distForWidth) * this.WORD_MARGIN;
    this.camera.position.set(0, 0, dist);
  }

  private resize() {
    if (this.disposed) return;
    const { clientWidth: w, clientHeight: h } = this.host;
    if (w === 0 || h === 0) return;
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h);
    this.composer.setPixelRatio(dpr);
    this.composer.setSize(w, h);
    this.camera.aspect = w / h;
    this.frameWord(w / h);
    this.camera.updateProjectionMatrix();

    const bw = Math.max(2, Math.round(w * RENDER_SCALE));
    const bh = Math.max(2, Math.round(h * RENDER_SCALE));
    this.asciiPass.uniforms.uResolution.value.set(bw * dpr, bh * dpr);
    this.asciiPass.uniforms.uAsciiPixelSize.value = (bw * dpr) / ASCII_CELL_DIVISOR;
    this.asciiPass.uniforms.uAspect.value = w / h;
    this.pointsMat.uniforms.uResolution.value.set(w * dpr, h * dpr);
  }

  start() {
    this.onScreen = true;
    this.maybeStart();
  }

  private maybeStart() {
    if (this.disposed || this.running || !this.onScreen || document.hidden) return;
    this.running = true;
    this.clock.getDelta();
    this.raf = requestAnimationFrame(this.loop);
  }

  stop() {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  private advanceTrail(dt: number) {
    const TRAIL_LIFE = 0.75;
    for (let i = 0; i < TRAIL_LEN; i++) {
      this.trailAge[i] = Math.min(1, this.trailAge[i] + dt / TRAIL_LIFE);
    }
    if (this.onCard) {

      for (let i = TRAIL_LEN - 1; i > 0; i--) {
        this.trailPos[i].copy(this.trailPos[i - 1]);
        this.trailAge[i] = this.trailAge[i - 1];
      }
      this.trailPos[0].copy(this.mouseUv);
      this.trailAge[0] = 0;
    }

    this.asciiPass.uniforms.uTrailAge.value = this.trailAge;
  }

  private loop = () => {
    if (!this.running) return;
    const dt = Math.min(this.clock.getDelta(), 1 / 30);
    const t = this.clock.elapsedTime;

    this.mouseSpeed = this.mouse.distanceTo(this.prevMouse);
    if (this.mouse.x > 9000) this.mouseSpeed = 0;
    this.prevMouse.copy(this.mouse);

    const cu = this.posVar.material.uniforms;
    cu.uTime.value = t;
    cu.uDeltaTime.value = dt;
    cu.uMouse.value.copy(this.mouse);
    cu.uMouseSpeed.value = this.mouseSpeed * MOUSE_SPEED_GAIN;
    this.gpgpu.compute();

    this.pointsMat.uniforms.uParticlesTexture.value =
      this.gpgpu.getCurrentRenderTarget(this.posVar).texture;

    this.visibility = Math.min(1, this.visibility + dt * 0.9);
    this.pointsMat.uniforms.uVisibility.value = this.visibility;

    const au = this.asciiPass.uniforms;
    this.advanceTrail(dt);

    this.trailOn += ((this.onCard ? 1 : 0) - this.trailOn) * Math.min(1, dt * 6);
    au.uTrailOn.value = this.trailOn;

    this.composer.render();
    this.raf = requestAnimationFrame(this.loop);
  };

  dispose() {
    this.disposed = true;
    this.stop();
    this.cleanupFns.forEach((fn) => fn());
    this.io?.disconnect();
    this.ro?.disconnect();
    this.points?.geometry.dispose();
    this.pointsMat?.dispose();
    this.asciiPass?.uniforms.uAsciiTexture.value?.dispose?.();
    this.gpgpu?.dispose?.();
    this.composer?.dispose?.();
    this.renderer?.dispose();
    this.renderer?.forceContextLoss?.();
    if (this.renderer?.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
  }
}

```


7. Build this: a perspective field of small images drifting behind text: each image sits at a random position and a depth (z under CSS perspective), continuously auto-drifts vertically with parallax by depth, grows as it descends and shrinks going up, and wraps infinitely (exits one edge, re-enters the other). Far images are dimmed by a white overlay. Plain DOM transforms, no WebGL.

The complete, self-contained implementation follows, one file per block. It is framework-agnostic core logic — wire it into your own component and mount it on an element.

### image-galaxy/engine.ts

```ts
const lerp = (a: number, b: number, t: number) => (1 - t) * a + t * b;

const CONFIG = {
  speed: 1.1,
  ease: 0.16,
  scaleEase: 0.25,
  scrollMultiplier: 0.9,
  scaleMin: 0.5,
  scaleMax: 1.4,
};

const Z_POOL = [-200, -150, -100, -50, 0, 50, 100, 150, 200];

const SPEED_POOL = [0.55, 0.75, 1, 1.3, 1.6];

export interface GalaxyParticle {
  x: number;
  y: number;
  speed: number;
  z: number;
  opacity: number;
}

export function buildParticles(n: number): GalaxyParticle[] {

  const cols = Math.max(3, Math.round(Math.sqrt(n) * 1.4));
  const left = 8;
  const span = 100 - left * 2;
  const step = cols > 1 ? span / (cols - 1) : 0;
  const rows = Math.ceil(n / cols);

  const slots = Array.from({ length: n }, (_, i) => i).sort(
    () => 0.5 - Math.random(),
  );

  return Array.from({ length: n }, (_, i) => {
    const z = Z_POOL[i % Z_POOL.length];
    const opacity = z < 0 ? Math.max(0.6, 1 + z / 400) : 1;

    const slot = slots[i];
    const col = slot % cols;
    const row = Math.floor(slot / cols);

    const x = left + col * step + (Math.random() - 0.5) * step * 0.5;

    const y = ((row + 0.5) / rows) * 100 + (Math.random() - 0.5) * (100 / rows) * 0.6;

    return {
      x: Math.max(2, Math.min(96, x)),
      y: ((y % 100) + 100) % 100,
      speed: SPEED_POOL[i % SPEED_POOL.length],
      z,
      opacity,
    };
  });
}

interface Node {
  el: HTMLElement;
  overlay: HTMLElement | null;
  speed: number;
  z: number;
  extra: number;
  height: number;
  top: number;
  position: number;
  currentScale: number;
  isBefore: boolean;
  isAfter: boolean;
}

export class ImageGalaxy {
  private container: HTMLElement;
  private nodes: Node[] = [];
  private defs: GalaxyParticle[];

  private scroll = { current: 0, target: 0, last: 0 };
  private directionSign = 1;
  private direction: "up" | "down" = "down";
  private containerHeight = 0;
  private containerOffsetHeight = 0;

  private raf = 0;
  private running = false;
  private disposed = false;
  private lastTime = 0;

  constructor(
    container: HTMLElement,
    images: HTMLElement[],
    overlays: (HTMLElement | null)[],
    defs?: GalaxyParticle[],
  ) {
    this.container = container;
    this.defs = defs ?? buildParticles(images.length);
    this.nodes = images.map((el, i) => ({
      el,
      overlay: overlays[i] ?? null,
      speed: 1,
      z: 0,
      extra: 0,
      height: 0,
      top: 0,
      position: 0,
      currentScale: 1,
      isBefore: false,
      isAfter: false,
    }));
    this.layout();
  }

  layout() {
    const rect = this.container.getBoundingClientRect();
    const small = window.innerWidth < 700;
    this.nodes.forEach((node, i) => {
      const d = this.defs[i];
      if (!d) {
        node.el.style.display = "none";
        return;
      }
      if (node.overlay) node.overlay.style.opacity = `${1 - d.opacity}`;

      const left = small ? (i % 4) * 25 + (d.x % 20) : d.x;
      node.el.style.left = `${left}%`;
      node.el.style.top = `${d.y}%`;
      node.speed = d.speed;
      node.z = d.z;
      node.el.style.transform = "translate3d(0, 0px, 0)";
      const box = node.el.getBoundingClientRect();
      node.extra = 0;
      node.height = box.height;
      node.top = box.top - rect.top;
      node.position = 0;
      node.currentScale = 1;
    });
    this.containerHeight = this.container.clientHeight;
    this.containerOffsetHeight = this.containerHeight * 0.1;
    this.scroll = { current: 0, target: 0, last: 0 };
  }

  addScroll(velocity: number, direction: number) {
    const v = Math.max(-60, Math.min(60, velocity));
    this.scroll.target += v * CONFIG.scrollMultiplier;
    this.direction = direction > 0 ? "down" : "up";
    if (direction !== 0) this.directionSign = Math.sign(direction);
  }

  start() {
    if (this.running || this.disposed) return;
    this.running = true;
    this.lastTime = 0;
    this.raf = requestAnimationFrame(this.tick);
  }

  stop() {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  private tick = (now: number) => {
    if (!this.running) return;

    const dt = this.lastTime ? Math.min(2, (now - this.lastTime) / 16.667) : 1;
    this.lastTime = now;
    this.update(dt);
    this.raf = requestAnimationFrame(this.tick);
  };

  private update(dt: number) {
    this.scroll.target += CONFIG.speed * dt * this.directionSign;
    this.scroll.current = lerp(this.scroll.current, this.scroll.target, CONFIG.ease);
    this.direction = this.scroll.current < this.scroll.last ? "down" : "up";

    for (const t of this.nodes) {
      t.position = -this.scroll.current * t.speed - t.extra;
      const bottom = t.position + t.top + t.height;
      t.isBefore = bottom < -this.containerOffsetHeight;
      t.isAfter = bottom > this.containerHeight + this.containerOffsetHeight;

      if (this.direction === "up" && t.isBefore) {
        t.extra = t.extra - this.containerHeight - this.containerOffsetHeight;
        t.isBefore = false;
        t.isAfter = false;
      }
      if (this.direction === "down" && t.isAfter) {
        t.extra = t.extra + this.containerHeight;
        t.isBefore = false;
        t.isAfter = false;
      }

      const top = t.position + t.top;
      const f = Math.max(0, Math.min(1, top / this.containerHeight));
      const targetScale = CONFIG.scaleMin + f * (CONFIG.scaleMax - CONFIG.scaleMin);
      t.currentScale = lerp(t.currentScale, targetScale, CONFIG.scaleEase);

      t.el.style.transform = `translate3d(0, ${t.position}px, ${t.z}px) scale(${t.currentScale})`;
    }

    this.scroll.last = this.scroll.current;
  }

  destroy() {
    this.disposed = true;
    this.stop();
    this.nodes = [];
  }
}

```


8. Build this: a word rendered as frosted glass with labeled collaborator cursors flying around it. The frosted word is three stacked layers: a sharp copy masked to fade out toward the bottom, a blurred copy masked the opposite way, and a rounded glass-chip overlay (faint white gradient fill, light top-brighter border, layered inset + drop shadows), tilted a hair with a soft radial glow behind. The cursors are Figma-style pointer arrows with colored name pills that drift on looping elliptical paths and scatter away from the real pointer when it enters, easing back when it leaves. Plain DOM + CSS, no framework.

The complete, self-contained implementation follows, one file per block. It is framework-agnostic core logic — wire it into your own component and mount it on an element.

### cursors/FrostedWord.tsx

```ts
"use client";

export function FrostedWord({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={`relative inline-block ${className}`}>
      {}
      <span
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 -z-[1] h-[130px] w-[540px] max-w-[130%] -translate-x-1/2 -translate-y-1/2"
        style={{
          background:
            "radial-gradient(ellipse 100% 100% at 50% 50%, var(--bg-page) 0%, transparent 70%)",
          filter: "blur(30px)",
        }}
      />
      {}
      <span
        className="relative inline-block"
        style={{ transform: "translateX(-1px) translateY(-2px) rotate(-1deg)" }}
      >
        {}
        <span
          aria-hidden
          className="absolute inset-0 text-[var(--text-primary)] opacity-[0.14]"
          style={{ filter: "blur(9px)" }}
        >
          {children}
        </span>
        {/* deep chromatic twin: a further, softer offset in the opposite direction
            from the near twin — a second refraction plane for more depth */}
        <span
          aria-hidden
          className="absolute inset-0 text-[var(--text-primary)] opacity-[0.16]"
          style={{
            transform: "translate(-1.5px, 3px)",
            filter: "blur(5px)",
            maskImage: "linear-gradient(186deg, transparent 20%, black 100%)",
            WebkitMaskImage: "linear-gradient(186deg, transparent 20%, black 100%)",
          }}
        >
          {children}
        </span>
        {}
        <span
          className="relative z-10"
          style={{
            maskImage:
              "linear-gradient(186deg, black 0%, black 40%, transparent 100%)",
            WebkitMaskImage:
              "linear-gradient(186deg, black 0%, black 40%, transparent 100%)",
          }}
        >
          {children}
        </span>
        {/* blurred layer: fades in toward the bottom */}
        <span
          aria-hidden
          className="absolute inset-0"
          style={{
            filter: "blur(2px)",
            maskImage:
              "linear-gradient(186deg, transparent 0%, black 60%, black 100%)",
            WebkitMaskImage:
              "linear-gradient(186deg, transparent 0%, black 60%, black 100%)",
          }}
        >
          {children}
        </span>
        {}
        <span
          aria-hidden
          className="absolute inset-0 text-[var(--text-primary)] opacity-[0.28]"
          style={{
            transform: "translate(1.5px, 2px)",
            filter: "blur(3.5px)",
            maskImage: "linear-gradient(186deg, transparent 30%, black 100%)",
            WebkitMaskImage: "linear-gradient(186deg, transparent 30%, black 100%)",
          }}
        >
          {children}
        </span>
        {/* top sheen: a bright specular highlight only on the upper third */}
        <span
          aria-hidden
          className="absolute inset-0 opacity-70"
          style={{
            color: "rgba(255,255,255,0.9)",
            maskImage: "linear-gradient(180deg, black 0%, transparent 30%)",
            WebkitMaskImage: "linear-gradient(180deg, black 0%, transparent 30%)",
          }}
        >
          {children}
        </span>
        {}
        <span
          aria-hidden
          className="pointer-events-none absolute"
          style={{
            inset: "-4px -8px",
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.42) 0%, rgba(255,255,255,0.14) 38%, rgba(255,255,255,0.08) 62%, rgba(255,255,255,0.24) 100%)",
            border: "1px solid rgba(0,0,0,0.06)",
            borderTopColor: "rgba(255,255,255,0.75)",
            borderRadius: "10px",
            boxShadow:
              "inset 0 1px 0 rgba(255,255,255,0.55), inset 0 -1px 1px rgba(0,0,0,0.05), inset 0 0 0 3px rgba(255,255,255,0.14), inset 0 0 0 4px rgba(0,0,0,0.045), inset 0 8px 16px rgba(255,255,255,0.18), 0 1px 3px rgba(0,0,0,0.07), 0 6px 16px rgba(0,0,0,0.07)",
          }}
        />
        {}
        <span
          aria-hidden
          className="pointer-events-none absolute"
          style={{
            inset: "-4px -8px",
            borderRadius: "10px",
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.7), transparent 12%)",
            mixBlendMode: "overlay",
          }}
        />
      </span>
    </span>
  );
}

```

### cursors/engine.ts

```ts
const ARROW_PATH =
  "M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-4.86a.5.5 0 0 1 .35-.15h6.87c.48 0 .72-.58.38-.92L5.94 2.47a.5.5 0 0 0-.44.74Z";

export interface CursorDef {
  name: string;
  color: string;
}

interface CursorNode {
  root: HTMLDivElement;
  blush: HTMLDivElement;
  color: string;

  cx: number;
  cy: number;
  rx: number;
  ry: number;
  phase: number;
  speed: number;

  x: number;
  y: number;
  tx: number;
  ty: number;
}

const TWO_PI = Math.PI * 2;

export class FlyingCursors {
  private host: HTMLElement;
  private defs: CursorDef[];
  private nodes: CursorNode[] = [];
  private raf = 0;
  private running = false;
  private disposed = false;
  private t = 0;

  private pointer = { x: -9999, y: -9999, active: false };

  private ro?: ResizeObserver;
  private cleanup: (() => void)[] = [];

  constructor(host: HTMLElement, defs: CursorDef[]) {
    this.host = host;
    this.defs = defs;
    this.build();
    this.bindEvents();
    this.layout();
  }

  private build() {
    for (const def of this.defs) {

      const blush = document.createElement("div");
      const SIZE = 300;
      Object.assign(blush.style, {
        position: "absolute",
        left: `${-SIZE / 2}px`,
        top: `${-SIZE / 2}px`,
        width: `${SIZE}px`,
        height: `${SIZE}px`,
        borderRadius: "50%",
        background: `radial-gradient(circle, ${def.color} 0%, transparent 74%)`,
        opacity: "0.72",
        filter: "blur(26px)",
        pointerEvents: "none",
        willChange: "transform",
        mixBlendMode: "soft-light",
        zIndex: "2",
      });
      this.host.appendChild(blush);

      const root = document.createElement("div");
      Object.assign(root.style, {
        position: "absolute",
        left: "0",
        top: "0",
        pointerEvents: "none",
        willChange: "transform",
        zIndex: "3",
      });

      root.innerHTML = `
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
             style="display:block; filter:drop-shadow(0 2px 3px rgba(0,0,0,0.22))">
          <path d="${ARROW_PATH}" fill="${def.color}" stroke="#fff" stroke-width="1.4" stroke-linejoin="round"/>
        </svg>
        <span style="
          position:absolute; left:16px; top:17px; white-space:nowrap;
          padding:1.5px 6px; border-radius:8px; border-top-left-radius:2px;
          font-size:9.5px; font-weight:600; letter-spacing:-0.01em;
          line-height:1.35; color:#fff; background:${def.color};
          box-shadow:0 2px 6px rgba(0,0,0,0.16), inset 0 1px 0 rgba(255,255,255,0.22);
          font-family:var(--font-neue-montreal), ui-sans-serif, system-ui, sans-serif;
        ">${def.name}</span>
      `;
      this.host.appendChild(root);
      this.nodes.push({
        root,
        blush,
        color: def.color,
        cx: 0.5,
        cy: 0.5,
        rx: 0.3,
        ry: 0.3,
        phase: 0,
        speed: 1,
        x: 0,
        y: 0,
        tx: 0,
        ty: 0,
      });
    }
  }

  private bindEvents() {
    const onMove = (e: PointerEvent) => {
      const r = this.host.getBoundingClientRect();
      this.pointer.x = e.clientX - r.left;
      this.pointer.y = e.clientY - r.top;
      this.pointer.active = true;
    };
    const onLeave = () => {
      this.pointer.active = false;
    };
    this.host.addEventListener("pointermove", onMove);
    this.host.addEventListener("pointerleave", onLeave);
    this.cleanup.push(() => {
      this.host.removeEventListener("pointermove", onMove);
      this.host.removeEventListener("pointerleave", onLeave);
    });

    this.ro = new ResizeObserver(() => this.layout());
    this.ro.observe(this.host);
  }

  private layout() {
    const w = this.host.clientWidth;
    const h = this.host.clientHeight;
    if (!w || !h) return;
    const n = this.nodes.length;
    this.nodes.forEach((node, i) => {
      node.cx = (0.32 + 0.36 * ((i + 0.5) / n)) * w;
      node.cy = (0.34 + 0.32 * (i % 2)) * h;
      node.rx = (0.16 + 0.06 * (i % 2)) * w;
      node.ry = (0.2 + 0.05 * ((i + 1) % 2)) * h;
      node.phase = (i / n) * TWO_PI;
      node.speed = 0.5 + 0.18 * i;
    });
  }

  start() {
    if (this.running || this.disposed) return;
    this.running = true;
    this.raf = requestAnimationFrame(this.loop);
  }

  stop() {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  private loop = () => {
    if (!this.running) return;
    this.t += 0.006;

    for (const node of this.nodes) {

      const a = this.t * node.speed + node.phase;
      let bx = node.cx + Math.cos(a) * node.rx;
      let by = node.cy + Math.sin(a * 1.15) * node.ry;

      if (this.pointer.active) {
        const dx = bx - this.pointer.x;
        const dy = by - this.pointer.y;
        const dist = Math.hypot(dx, dy) || 1;
        const push = Math.max(0, 1 - dist / 220) * 120;
        bx += (dx / dist) * push;
        by += (dy / dist) * push;
      }

      node.tx = bx;
      node.ty = by;

      node.x += (node.tx - node.x) * 0.12;
      node.y += (node.ty - node.y) * 0.12;
      node.root.style.transform = `translate3d(${node.x.toFixed(1)}px, ${node.y.toFixed(1)}px, 0)`;

      node.blush.style.transform = `translate3d(${node.x.toFixed(1)}px, ${node.y.toFixed(1)}px, 0)`;
    }

    this.raf = requestAnimationFrame(this.loop);
  };

  destroy() {
    this.disposed = true;
    this.stop();
    this.cleanup.forEach((fn) => fn());
    this.ro?.disconnect();
    this.nodes.forEach((n) => {
      n.root.parentNode?.removeChild(n.root);
      n.blush.parentNode?.removeChild(n.blush);
    });
    this.nodes = [];
  }
}

```


9. Build this: a 3D gun (any glTF model) floating over a scene, wrapped in a golden loot beam like a Fortnite legendary drop. Load the glTF (it may be a SkinnedMesh, so bind the outline to the same skeleton), keep the model's original texture and add a thin bright-yellow SILHOUETTE outline (drei-style screen-space back-face hull offset along the clip-space normal, so the line is constant width from any angle). The loot beam is a single tall additive quad drawn entirely in a fragment shader: a few soft vertical gaussian columns with graded brightness, a soft envelope tying them into one shaft, a vertical fade (bright at the gun, gone at the top), living flowing-noise flicker + a slow pulse + two bright energy bands rising up it, and a gentle sway that grows with height. Add a concentrated golden radial glow plane behind the model, a bit of light, a gentle bob, a very weak cursor magnetism (the model leans a hair toward the pointer, the beam leans + the glow distorts slightly), and an optional hover-swell looping sound gated behind the first user gesture. three.js, framework-free.

The complete, self-contained implementation follows, one file per block. It is framework-agnostic core logic — wire it into your own component and mount it on an element.

### gold-scar/engine.ts

```ts
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { toCreasedNormals } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { mediaUrl } from "../../lib/video-sources";
import { isMuted } from "../../lib/sound";

const MODEL_URL = mediaUrl("/vault/gold-scar/scar.glb");
const SOUND_URL = mediaUrl("/vault/gold-scar/chest.mp3");

const MAGNET_EASE = 0.05;

export class GoldScar {
  private host: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;

  private pivot = new THREE.Group();
  private model: THREE.Group | null = null;
  private aura?: THREE.Mesh;
  private backGlow?: THREE.Mesh;
  private outlineMats: THREE.ShaderMaterial[] = [];
  private baseY = 0;

  private restX = 0;
  private restY = 0;
  private curX = 0;
  private curY = 0;
  private pointer = { x: 0, y: 0, inside: false };
  private smoothPointerX = 0;

  private snd: HTMLAudioElement | null = null;
  private hoverInt = 0;

  private coarse =
    typeof window !== "undefined" &&
    !window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  private tapPulse = 0;

  private modelReady = false;
  private bgReady = false;
  private revealed = false;

  private raf = 0;
  private running = false;
  private disposed = false;
  private clock = new THREE.Clock();

  private ro?: ResizeObserver;
  private cleanup: (() => void)[] = [];

  constructor(host: HTMLElement) {
    this.host = host;
    const w = host.clientWidth || 1;
    const h = host.clientHeight || 1;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    this.renderer.setPixelRatio(dpr);
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setSize(w, h);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    const canvas = this.renderer.domElement;
    Object.assign(canvas.style, {
      position: "absolute",
      inset: "0",
      width: "100%",
      height: "100%",
      display: "block",
      cursor: "grab",
      touchAction: "pan-y",

      opacity: "0",
      transition: "opacity 450ms var(--ease-out, ease-out)",
    });
    host.appendChild(canvas);

    this.camera = new THREE.PerspectiveCamera(30, w / h, 0.1, 100);
    this.camera.position.set(0, 0, 6);

    this.scene.add(this.pivot);
    this.addLights();
    this.addBackGlow();
    this.addBeam();
    this.loadModel();
    this.bindEvents();
  }

  private addLights() {
    this.scene.add(new THREE.AmbientLight(0xffffff, 1.5));

    const key = new THREE.DirectionalLight(0xfff4d8, 4.0);
    key.position.set(2, 3, 5);
    this.scene.add(key);

    const fill = new THREE.DirectionalLight(0xffffff, 2.4);
    fill.position.set(0, 0, 6);
    this.scene.add(fill);

    const rim = new THREE.DirectionalLight(0xffe9a8, 1.6);
    rim.position.set(-3, 1, -2);
    this.scene.add(rim);
  }

  private addBackGlow() {
    const size = 256;
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const ctx = c.getContext("2d")!;
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);

    g.addColorStop(0, "rgba(255,215,40,0.95)");
    g.addColorStop(0.22, "rgba(255,200,25,0.55)");
    g.addColorStop(0.5, "rgba(255,190,20,0.12)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;

    const geo = new THREE.PlaneGeometry(2.4, 1.2);
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      opacity: 0.55,
    });
    const glow = new THREE.Mesh(geo, mat);
    glow.position.set(0.1, 0.0, -0.5);
    this.backGlow = glow;
    this.scene.add(glow);
  }

  private addBeam() {
    const geo = new THREE.PlaneGeometry(4.5, 6, 1, 1);
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uIntensity: { value: 1 },
        uPointer: { value: 0 },
        uCore: { value: new THREE.Color("#ffe63a") },
        uGold: { value: new THREE.Color("#ffd21e") },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        precision highp float;
        uniform float uTime;
        uniform float uIntensity;
        uniform float uPointer;
        uniform vec3 uCore;
        uniform vec3 uGold;
        varying vec2 vUv;

        float hash(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
        float noise(vec2 p){
          vec2 i = floor(p), f = fract(p);
          f = f*f*(3.0-2.0*f);
          float a=hash(i), b=hash(i+vec2(1,0)), c=hash(i+vec2(0,1)), d=hash(i+vec2(1,1));
          return mix(mix(a,b,f.x), mix(c,d,f.x), f.y);
        }

        void main() {
          float t = uTime;
          float y = vUv.y;

          float sway = sin(t * 0.7 + y * 2.0) * 0.035 * y
                     + sin(t * 1.7 + y * 5.0) * 0.012 * y;
          float x = (vUv.x - 0.5) - sway - uPointer * 0.025 * y;

          float base = smoothstep(0.0, 0.06, y);
          float top  = 1.0 - smoothstep(0.55, 1.0, y);
          float vert = base * top;

          float widen = 1.0 + y * 0.30;
          float envelope = smoothstep(0.20 * widen, 0.0, abs(x)) * 0.4;

          float cols = 0.0;
          cols += 0.30 * exp(-pow((x + 0.12) / (0.030 * widen), 2.0));
          cols += 0.75 * exp(-pow((x + 0.05) / (0.032 * widen), 2.0));
          cols += 1.00 * exp(-pow((x - 0.01) / (0.034 * widen), 2.0));
          cols += 0.30 * exp(-pow((x - 0.08) / (0.030 * widen), 2.0));
          cols += 0.30 * exp(-pow((x - 0.15) / (0.028 * widen), 2.0));

          float flow = noise(vec2(x * 6.0, y * 5.0 - t * 1.1));
          float flicker = 0.74 + 0.26 * flow;
          float pulse = 0.9 + 0.1 * sin(t * 1.3);

          float r1 = sin((fract(y - t * 0.28) ) * 3.14159);
          float r2 = sin((fract(y - t * 0.16 + 0.5)) * 3.14159);
          float risers = (pow(max(r1,0.0), 6.0) + pow(max(r2,0.0), 6.0) * 0.7) * 0.35;

          float core = cols;
          float beam = (cols + envelope) * vert * flicker * pulse;
          beam += risers * cols * vert;

          float pool = smoothstep(0.30, 0.0, length(vec2(x * 1.6, y - 0.02))) * (1.0 - smoothstep(0.0, 0.28, y));
          beam += pool * 0.5;

          beam *= uIntensity * 0.6;

          vec3 col = mix(uGold, uCore, clamp(core, 0.0, 1.0));
          float a = clamp(beam, 0.0, 1.0);
          gl_FragColor = vec4(col * beam, a);
        }`,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: true,
      side: THREE.FrontSide,
    });
    this.aura = new THREE.Mesh(geo, mat);

    this.aura.position.set(0.1, 3.0, -1.5);
    this.aura.renderOrder = 0;
    this.scene.add(this.aura);
  }

  private loadModel() {
    const loader = new GLTFLoader();
    loader.setCrossOrigin("anonymous");
    loader.setMeshoptDecoder(MeshoptDecoder);
    loader.load(
      MODEL_URL,
      (gltf) => {
        if (this.disposed) return;
        const model = gltf.scene;

        const meshes: THREE.Mesh[] = [];
        model.traverse((o) => {
          if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh);
        });

        const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
        for (const mesh of meshes) {
          const skinned = mesh as THREE.SkinnedMesh;
          const outlineGeo = toCreasedNormals(mesh.geometry, Math.PI / 3);
          const isSkinned = !!skinned.isSkinnedMesh && !!skinned.skeleton;
          const mat = this.makeOutlineMaterial(size, isSkinned);
          let outline: THREE.Mesh;
          if (isSkinned) {
            const so = new THREE.SkinnedMesh(outlineGeo, mat);
            so.bind(skinned.skeleton, skinned.bindMatrix);
            outline = so;
          } else {
            outline = new THREE.Mesh(outlineGeo, mat);
          }
          outline.renderOrder = -1;
          mesh.add(outline);
          this.outlineMats.push(mat);
        }

        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        const size3 = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size3.x, size3.y, size3.z) || 1;
        model.position.sub(center);
        const inner = new THREE.Group();
        inner.add(model);
        const s = 1.55 / maxDim;
        inner.scale.setScalar(s);
        this.pivot.add(inner);
        this.model = model;

        this.pivot.position.set(0.1, 0.08, 0);
        this.baseY = this.pivot.position.y;
        this.restY = this.curY = 4.37;
        this.restX = this.curX = 0.147;
        this.modelReady = true;
        this.maybeReveal();
      },
      undefined,
      () => {

        this.modelReady = true;
        this.maybeReveal();
      },
    );
  }

  markBackdropReady() {
    this.bgReady = true;
    this.maybeReveal();
  }

  private maybeReveal() {
    if (this.revealed || this.disposed) return;
    if (!this.modelReady || !this.bgReady) return;
    this.revealed = true;
    this.renderer.render(this.scene, this.camera);

    requestAnimationFrame(() => {
      this.renderer.domElement.style.opacity = "1";
    });
  }

  private makeOutlineMaterial(size: THREE.Vector2, skinned: boolean): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color("#ffef7a") },
        uThickness: { value: 4.0 },
        uSize: { value: size.clone() },
      },
      vertexShader: `
        #include <common>
        #include <skinning_pars_vertex>
        uniform float uThickness;
        uniform vec2 uSize;
        void main() {
          #include <beginnormal_vertex>
          #include <skinbase_vertex>
          #include <skinnormal_vertex>
          #include <begin_vertex>
          #include <skinning_vertex>
          #include <project_vertex>

          vec4 clipN = projectionMatrix * modelViewMatrix * vec4(objectNormal, 0.0);
          vec2 offset = normalize(clipN.xy) * uThickness / uSize * gl_Position.w * 2.0;
          gl_Position.xy += offset;
        }`,
      fragmentShader: `
        uniform vec3 uColor;
        void main() { gl_FragColor = vec4(uColor, 1.0); }`,
      side: THREE.BackSide,
      defines: skinned ? { USE_SKINNING: "" } : {},
    });
  }

  private bindEvents() {
    const host = this.host;

    const onMove = (e: PointerEvent) => {
      const rect = host.getBoundingClientRect();
      this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.pointer.y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      this.pointer.inside = true;
    };
    const onLeave = () => {
      this.pointer.inside = false;
    };

    const onTap = () => {
      if (this.coarse) this.tapPulse = 1;
    };

    host.addEventListener("pointermove", onMove);
    host.addEventListener("pointerleave", onLeave);
    host.addEventListener("pointerdown", onTap);
    this.cleanup.push(() => {
      host.removeEventListener("pointermove", onMove);
      host.removeEventListener("pointerleave", onLeave);
      host.removeEventListener("pointerdown", onTap);
    });

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(host);
  }

  private resize() {
    if (this.disposed) return;
    const w = this.host.clientWidth;
    const h = this.host.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();

    const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    for (const m of this.outlineMats) m.uniforms.uSize.value.copy(size);
  }

  private initSound() {
    if (this.snd) return;
    this.snd = new Audio(SOUND_URL);
    this.snd.loop = true;
    this.snd.volume = 0;
    this.snd.crossOrigin = "anonymous";
  }

  private updateSound() {
    if (!this.snd) return;

    const peak = this.coarse ? 0.4 : 0.9;
    const target = isMuted() ? 0 : this.hoverInt * peak;
    this.snd.volume += (target - this.snd.volume) * 0.08;
    if (target > 0.01 && this.snd.paused) this.snd.play().catch(() => {});
    if (this.snd.volume < 0.01 && !this.snd.paused) this.snd.pause();
  }

  start() {
    if (this.running || this.disposed) return;
    this.initSound();
    this.running = true;
    this.clock.getDelta();
    this.raf = requestAnimationFrame(this.loop);
  }

  stop() {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    if (this.snd && !this.snd.paused) this.snd.pause();
  }

  private loop = () => {
    if (!this.running) return;
    const t = this.clock.getElapsedTime();

    const PULL = 0.40;
    const leanY = this.pointer.inside ? this.pointer.x * PULL : 0;
    const leanX = this.pointer.inside ? -this.pointer.y * PULL * 0.6 : 0;
    this.curY += (this.restY + leanY - this.curY) * MAGNET_EASE;
    this.curX += (this.restX + leanX - this.curX) * MAGNET_EASE;
    this.pivot.rotation.x = this.curX;
    this.pivot.rotation.y = this.curY;
    this.pivot.position.y = this.baseY + Math.sin(t * 0.9) * 0.022;

    let want = 0;
    if (this.coarse) {
      this.tapPulse *= 0.985;
      if (this.tapPulse < 0.001) this.tapPulse = 0;
      want = this.tapPulse;
    } else if (this.pointer.inside) {
      const dist = Math.hypot(this.pointer.x, this.pointer.y);
      want = Math.max(0.25, 1 - dist * 0.7);
    }
    this.hoverInt += (want - this.hoverInt) * 0.05;

    const pTargetX = this.pointer.inside ? this.pointer.x : 0;
    this.smoothPointerX += (pTargetX - this.smoothPointerX) * 0.07;

    if (this.aura) {
      const u = (this.aura.material as THREE.ShaderMaterial).uniforms;
      u.uTime.value = t;
      u.uIntensity.value = 1.0 + this.hoverInt * 0.35 + Math.sin(t * 0.8) * 0.05;
      u.uPointer.value = this.smoothPointerX;
    }

    if (this.backGlow) {
      const m = this.backGlow.material as THREE.MeshBasicMaterial;
      m.opacity = 0.5 + Math.sin(t * 1.1) * 0.05 + this.hoverInt * 0.14;
      const breathe = 1.0 + Math.sin(t * 0.9) * 0.02;
      const sx = breathe + this.smoothPointerX * 0.06;
      const sy = breathe - this.smoothPointerX * 0.04;
      this.backGlow.scale.set(sx, sy, 1);
    }

    this.updateSound();

    if (this.revealed) this.renderer.render(this.scene, this.camera);
    this.raf = requestAnimationFrame(this.loop);
  };

  renderStill() {
    if (!this.revealed) return;
    this.renderer.render(this.scene, this.camera);
  }

  destroy() {
    this.disposed = true;
    this.stop();
    this.cleanup.forEach((fn) => fn());
    this.ro?.disconnect();
    if (this.snd) {
      this.snd.pause();
      this.snd.src = "";
      this.snd = null;
    }
    this.scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.geometry?.dispose?.();
        const m = mesh.material as THREE.Material | THREE.Material[];
        Array.isArray(m) ? m.forEach((x) => x.dispose()) : m?.dispose?.();
      }
    });
    this.renderer.dispose();
    this.renderer.forceContextLoss?.();
    const canvas = this.renderer.domElement;
    canvas.parentNode?.removeChild(canvas);
  }
}

```


10. Build this: a cloud of images orbiting on an invisible sphere in 3D: each image is a textured plane scattered at a random point on a sphere, all inside one group that slowly auto-rotates (and you can drag to spin). Every plane is billboarded to always face the camera (its quaternion = the inverse of the group's), planes nearer the camera scale up (depth), and the hovered plane scales up further, all eased. Raycast for hover. Pure three.js meshes, no shaders.

The complete, self-contained implementation follows, one file per block. It is framework-agnostic core logic — wire it into your own component and mount it on an element.

### image-sphere/engine.ts

```ts
import * as THREE from "three";

const RADIUS = 180;
const PLANE_SIZE = 50;
const AUTO_ROT_Y = 0.0005;
const AUTO_ROT_X = 0.0002;
const DRAG_EASE = 0.2;
const HOVER_SCALE = 1.2;
const SCALE_EASE = 0.1;
const OPACITY_EASE = 0.12;
const INERTIA_DECAY = 0.94;
const FLICK_SCALE = 0.9;

const CLICK_SLOP = 6;
const FOCUS_EASE = 0.14;
const FOCUS_DISTANCE = 300;
const FOCUS_FILL = 0.62;
const BACKDROP_DIM = 0.16;

export interface ImageSphereOptions {
  distance?: number;
  fov?: number;
}

type PlaneMesh = THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;

export class ImageSphere {
  private host: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private group = new THREE.Group();
  private planes: PlaneMesh[] = [];

  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2(-2, -2);
  private hovered: PlaneMesh | null = null;
  private focused: PlaneMesh | null = null;

  private rotationX = 0;
  private rotationY = 0;
  private currentRotationX = 0;
  private currentRotationY = 0;
  private baseRotationX = 0;
  private baseRotationY = 0;

  private dragging = false;
  private startX = 0;
  private startY = 0;

  private velX = 0;
  private velY = 0;
  private lastDX = 0;
  private lastDY = 0;

  private invQuat = new THREE.Quaternion();
  private worldPos = new THREE.Vector3();
  private homePos = new THREE.Vector3();
  private centerPos = new THREE.Vector3();
  private tmpPos = new THREE.Vector3();

  private raf = 0;
  private running = false;
  private disposed = false;

  private ro?: ResizeObserver;
  private cleanup: (() => void)[] = [];

  constructor(host: HTMLElement, imageUrls: string[], opts: ImageSphereOptions = {}) {
    this.host = host;
    const w = host.clientWidth || 1;
    const h = host.clientHeight || 1;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    this.renderer.setPixelRatio(dpr);
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setSize(w, h);
    const canvas = this.renderer.domElement;
    Object.assign(canvas.style, {
      position: "absolute",
      inset: "0",
      width: "100%",
      height: "100%",
      display: "block",
      cursor: "grab",
    });
    host.appendChild(canvas);

    this.camera = new THREE.PerspectiveCamera(opts.fov ?? 25, w / h, 0.1, 2000);
    this.camera.position.z = opts.distance ?? 520;
    this.scene.add(this.group);

    this.loadPlanes(imageUrls);
    this.bindEvents();
  }

  private loadPlanes(urls: string[]) {
    const loader = new THREE.TextureLoader();
    loader.crossOrigin = "anonymous";
    urls.forEach((url) => {
      loader.load(url, (tex) => {
        if (this.disposed) return;
        tex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
        tex.minFilter = THREE.LinearMipMapLinearFilter;
        tex.magFilter = THREE.LinearFilter;
        tex.colorSpace = THREE.SRGBColorSpace;

        const aspect = (tex.image.width || 1) / (tex.image.height || 1);
        const geo = new THREE.PlaneGeometry(PLANE_SIZE * aspect, PLANE_SIZE);
        const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true });

        mat.depthWrite = false;
        const plane = new THREE.Mesh(geo, mat) as PlaneMesh;

        plane.userData = { isHovered: false, opacity: 0, focus: 0, aspect };
        mat.opacity = 0;

        const phi = (Math.random() * 2 - 1) * Math.PI;
        const theta = Math.random() * Math.PI * 2;
        const r = RADIUS + (Math.random() - 0.5) * 80;
        plane.position.set(
          r * Math.sin(phi) * Math.cos(theta),
          r * Math.sin(phi) * Math.sin(theta),
          r * Math.cos(phi),
        );

        plane.userData.home = plane.position.clone();

        this.group.add(plane);
        this.planes.push(plane);

        if (!this.running) this.renderStill();
      });
    });
  }

  private bindEvents() {
    const host = this.host;
    const localMouse = (clientX: number, clientY: number) => {
      const rect = host.getBoundingClientRect();
      this.mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -(((clientY - rect.top) / rect.height) * 2 - 1);
    };

    let downX = 0;
    let downY = 0;
    const onDown = (e: PointerEvent) => {
      this.dragging = true;
      this.startX = e.clientX;
      this.startY = e.clientY;
      downX = e.clientX;
      downY = e.clientY;
      this.velX = this.velY = 0;
      this.lastDX = this.lastDY = 0;
      this.renderer.domElement.style.cursor = "grabbing";
    };
    const onMove = (e: PointerEvent) => {
      localMouse(e.clientX, e.clientY);
      if (this.dragging) {
        const dx = e.clientX - this.startX;
        const dy = e.clientY - this.startY;
        this.rotationY += dx * 1.0;
        this.rotationX -= dy * 1.0;
        this.lastDX = dx;
        this.lastDY = dy;
        this.startX = e.clientX;
        this.startY = e.clientY;
      }
    };
    const release = () => {
      if (!this.dragging) return;
      this.dragging = false;

      this.velY = this.lastDX * FLICK_SCALE;
      this.velX = -this.lastDY * FLICK_SCALE;
      this.renderer.domElement.style.cursor = "grab";
    };
    const onUp = (e: PointerEvent) => {
      const moved = Math.hypot(e.clientX - downX, e.clientY - downY);
      release();

      if (moved <= CLICK_SLOP && this.running) {

        this.velX = this.velY = 0;
        localMouse(e.clientX, e.clientY);
        const hit = this.pick();
        if (this.focused) this.focused = hit === this.focused ? null : hit;
        else this.focused = hit;
      }
    };
    const onLeave = () => {
      release();
      this.mouse.set(-2, -2);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && this.focused) this.focused = null;
    };
    window.addEventListener("keydown", onKey);
    this.cleanup.push(() => window.removeEventListener("keydown", onKey));

    host.addEventListener("pointerdown", onDown);
    host.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    host.addEventListener("pointerleave", onLeave);
    this.cleanup.push(() => {
      host.removeEventListener("pointerdown", onDown);
      host.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      host.removeEventListener("pointerleave", onLeave);
    });

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(host);
  }

  private resize() {
    if (this.disposed) return;
    const w = this.host.clientWidth;
    const h = this.host.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private pick(): PlaneMesh | null {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const hits = this.raycaster.intersectObjects(this.planes, false);
    return (hits.length > 0 ? hits[0].object : null) as PlaneMesh | null;
  }

  private hoverDetection() {
    const next = this.pick();
    if (next !== this.hovered) {
      if (this.hovered) this.hovered.userData.isHovered = false;
      this.hovered = next;
      if (this.hovered) this.hovered.userData.isHovered = true;
    }
  }

  start() {
    if (this.running || this.disposed) return;
    this.running = true;
    this.raf = requestAnimationFrame(this.loop);
  }

  stop() {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  private loop = () => {
    if (!this.running) return;

    if (!this.dragging && (this.velX !== 0 || this.velY !== 0)) {
      this.rotationY += this.velY;
      this.rotationX -= this.velX;
      this.velX *= INERTIA_DECAY;
      this.velY *= INERTIA_DECAY;
      if (Math.abs(this.velX) < 0.01) this.velX = 0;
      if (Math.abs(this.velY) < 0.01) this.velY = 0;
    }

    this.baseRotationY += AUTO_ROT_Y;
    this.baseRotationX += AUTO_ROT_X;
    this.currentRotationX += (this.rotationX - this.currentRotationX) * DRAG_EASE;
    this.currentRotationY += (this.rotationY - this.currentRotationY) * DRAG_EASE;
    this.group.rotation.x = this.baseRotationX + this.currentRotationX * 0.002;
    this.group.rotation.y = this.baseRotationY + this.currentRotationY * 0.002;

    if (!this.dragging && !this.focused) this.hoverDetection();
    else if (this.focused && this.hovered) {
      this.hovered.userData.isHovered = false;
      this.hovered = null;
    }
    const anyFocused = this.focused !== null;

    this.centerPos.set(0, 0, this.camera.position.z - FOCUS_DISTANCE);
    const viewH = 2 * FOCUS_DISTANCE * Math.tan((this.camera.fov * Math.PI) / 360);
    const focusScale = (viewH * FOCUS_FILL) / PLANE_SIZE;

    this.invQuat.copy(this.group.quaternion).invert();
    for (const plane of this.planes) {
      plane.quaternion.copy(this.invQuat);

      const focusTarget = plane === this.focused ? 1 : 0;
      const f = plane.userData.focus + (focusTarget - plane.userData.focus) * FOCUS_EASE;
      plane.userData.focus = f;

      if (f > 0.0005) {
        this.tmpPos.copy(this.centerPos);
        this.group.worldToLocal(this.tmpPos);
        plane.position.copy(plane.userData.home).lerp(this.tmpPos, f);
      } else if (plane.position.x !== plane.userData.home.x || plane.position.z !== plane.userData.home.z) {
        plane.position.copy(plane.userData.home);
      }

      plane.getWorldPosition(this.worldPos);
      const depth = this.worldPos.z;

      const zScale = 0.8 + depth / 2000;
      let target = plane.userData.isHovered ? zScale * HOVER_SCALE : zScale;
      target = target + (focusScale - target) * f;
      const s = plane.scale.x + (target - plane.scale.x) * SCALE_EASE;
      plane.scale.set(s, s, s);

      let wantOpacity = 1;
      if (anyFocused) wantOpacity = BACKDROP_DIM + (1 - BACKDROP_DIM) * f;
      const o = plane.userData.opacity + (wantOpacity - plane.userData.opacity) * OPACITY_EASE;
      plane.userData.opacity = o;
      plane.material.opacity = o;

      plane.renderOrder = f > 0.5 ? 1 : 0;
    }

    this.renderer.render(this.scene, this.camera);
    this.raf = requestAnimationFrame(this.loop);
  };

  renderStill() {
    this.invQuat.copy(this.group.quaternion).invert();
    for (const plane of this.planes) {
      plane.quaternion.copy(this.invQuat);
      plane.getWorldPosition(this.worldPos);
      const zScale = 0.8 + this.worldPos.z / 2000;
      plane.scale.set(zScale, zScale, zScale);
      plane.userData.opacity = 1;
      plane.material.opacity = 1;
    }
    this.renderer.render(this.scene, this.camera);
  }

  destroy() {
    this.disposed = true;
    this.stop();
    this.cleanup.forEach((fn) => fn());
    this.ro?.disconnect();
    for (const plane of this.planes) {
      plane.geometry.dispose();
      const mat = plane.material as THREE.MeshBasicMaterial;
      mat.map?.dispose();
      mat.dispose();
    }
    this.renderer.dispose();
    this.renderer.forceContextLoss?.();
    const canvas = this.renderer.domElement;
    canvas.parentNode?.removeChild(canvas);
  }
}

```


11. Build this: a short lowercase sentence (e.g. "design is how it works") laid out as adjacent SOLID-COLOR tiles packed edge-to-edge into one seamless horizontal bar — each word in its own rectangle, auto-sized to the word with even padding, uniform height, no gaps, the whole bar rounded as one unit. Each tile carries a bold, saturated, slightly-clashing swatch (near-black, red, lilac, green, violet, yellow…) with an auto-contrast text color baked in (white on the dark swatches, near-black on the bright ones) — no muted filler. On reveal the tiles FLY IN to assemble the bar: each wipes open left-to-right via clip-path (clip-path, NOT scaleX, so the text never distorts) with a small rise + fade, staggered. Then it idly SHUFFLES: each tile re-rolls to a different swatch on its own timer (color transitions eased), and hovering a tile re-rolls it immediately. Set in a tight grotesque. Plain DOM/CSS: a flex row of spans + a rAF loop, no canvas, no framework. Reduced-motion shows the assembled bar, static.

The complete, self-contained implementation follows, one file per block. It is framework-agnostic core logic — wire it into your own component and mount it on an element.

### design-tiles/palette.ts

```ts
export const WORDS = ["design", "is", "how", "it", "works"];

export type Swatch = { bg: string; fg: string };

export const SWATCHES: Swatch[] = [
  { bg: "#0a0a0a", fg: "#ffffff" },
  { bg: "#ff2e20", fg: "#0a0a0a" },
  { bg: "#f0c2f7", fg: "#0a0a0a" },
  { bg: "#22e58b", fg: "#0a0a0a" },
  { bg: "#7c4dff", fg: "#ffffff" },
  { bg: "#ffe14d", fg: "#0a0a0a" },
  { bg: "#18b6ff", fg: "#0a0a0a" },
  { bg: "#ff7a1a", fg: "#0a0a0a" },
  { bg: "#ff4fa3", fg: "#0a0a0a" },
];

export function randomSwatch(exclude?: Swatch): Swatch {
  if (SWATCHES.length < 2 || !exclude) {
    return SWATCHES[(Math.random() * SWATCHES.length) | 0];
  }
  let s = exclude;
  while (s === exclude) s = SWATCHES[(Math.random() * SWATCHES.length) | 0];
  return s;
}

export function randomSwatchAvoiding(used: Swatch[]): Swatch {
  const free = SWATCHES.filter((s) => !used.includes(s));
  const pool = free.length > 0 ? free : SWATCHES;
  return pool[(Math.random() * pool.length) | 0];
}

export const INITIAL: Swatch[] = [
  SWATCHES[0],
  SWATCHES[1],
  SWATCHES[2],
  SWATCHES[3],
  SWATCHES[4],
];

```

### design-tiles/engine.ts

```ts
import { WORDS, INITIAL, randomSwatchAvoiding, type Swatch } from "./palette";
import { measureWord, REF_FS, BASELINE_Y, type WordMetrics } from "./measure";

const SVGNS = "http://www.w3.org/2000/svg";

const FLY_STAGGER = 130;
const FLY_MS = 760;
const SHUFFLE_MIN = 1300;
const SHUFFLE_MAX = 3200;
const COLOR_MS = 520;

const PAD_Y = 6;
const PAD_X = 2;

const BAND_ASCENT = 82;
const BAND_DESCENT = 26;

type LetterRect = {
  el: SVGRectElement;
  x0: number;
  x1: number;
  baseY: number;
  baseH: number;
  hovered: boolean;
};

type Tile = {
  outer: HTMLSpanElement;
  svg: SVGSVGElement;
  rects: LetterRect[];
  textEl: SVGTextElement;
  word: string;
  swatch: Swatch;
  nextShuffle: number;
};

export class DesignTiles {
  private host: HTMLElement;
  private root: HTMLDivElement;
  private bar: HTMLDivElement;
  private tiles: Tile[] = [];
  private fontFamily = "sans-serif";

  private raf = 0;
  private running = false;
  private disposed = false;
  private revealed = false;
  private now = 0;

  private ro?: ResizeObserver;
  private cleanup: (() => void)[] = [];

  constructor(host: HTMLElement) {
    this.host = host;

    const root = document.createElement("div");
    Object.assign(root.style, {
      position: "absolute",
      inset: "0",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "var(--font-kyoto), var(--font-neue-montreal), system-ui, sans-serif",
      userSelect: "none",
    });
    root.setAttribute("aria-label", WORDS.join(" "));

    this.fontFamily =
      getComputedStyle(root).fontFamily || "var(--font-kyoto), sans-serif";

    const bar = document.createElement("div");

    Object.assign(bar.style, { display: "flex", alignItems: "center" });

    WORDS.forEach((word, i) => {
      const sw = INITIAL[i] ?? randomSwatchAvoiding([]);

      const outer = document.createElement("span");
      Object.assign(outer.style, {
        display: "grid",
        gridTemplateColumns: "0fr",

        transition: `grid-template-columns ${FLY_MS}ms cubic-bezier(.16,1,.3,1)`,
      });
      const clip = document.createElement("span");
      clip.style.overflow = "hidden";

      const svg = document.createElementNS(SVGNS, "svg");
      Object.assign(svg.style, {
        display: "block",

        height: "clamp(1.6rem, 4vw, 2.9rem)",
        opacity: "0",
        transition: `opacity ${Math.round(FLY_MS * 0.8)}ms ease`,
      });

      const gBg = document.createElementNS(SVGNS, "g");
      const textEl = document.createElementNS(SVGNS, "text");
      textEl.setAttribute("font-family", this.fontFamily);
      textEl.setAttribute("font-weight", "500");
      textEl.setAttribute("font-size", String(REF_FS));
      textEl.setAttribute("dominant-baseline", "alphabetic");
      textEl.style.fill = sw.fg;
      textEl.style.transition = `fill ${COLOR_MS}ms ease`;
      textEl.textContent = word;

      svg.appendChild(gBg);
      svg.appendChild(textEl);
      clip.appendChild(svg);
      outer.appendChild(clip);
      bar.appendChild(outer);

      this.tiles.push({
        outer,
        svg,
        rects: [],
        textEl,
        word,
        swatch: sw,
        nextShuffle: 0,
      });
    });

    root.appendChild(bar);
    host.appendChild(root);
    this.root = root;
    this.bar = bar;

    this.layout();
    this.bindEvents();
  }

  private layout() {
    for (const tile of this.tiles) {
      const m = measureWord(tile.word, this.fontFamily, "500");

      for (const r of tile.rects) r.el.remove();
      tile.rects = [];
      if (!m) {

        this.buildFallback(tile);
        continue;
      }
      this.buildRects(tile, m);
    }
  }

  private buildRects(tile: Tile, m: WordMetrics) {
    const gBg = tile.svg.firstChild as SVGGElement;

    const bandTop = BASELINE_Y - BAND_ASCENT;
    const bandBottom = BASELINE_Y + BAND_DESCENT;

    for (let i = 0; i < m.glyphs.length; i++) {
      const g = m.glyphs[i];
      if (g.ch === " ") continue;
      const top = Math.max(bandTop, g.top - PAD_Y);
      const bottom = Math.min(bandBottom, g.bottom + PAD_Y);

      const next = m.glyphs[i + 1];
      const right = next ? next.x : g.x + g.w;
      const left = g.x - (i === 0 ? PAD_X : 0);
      const width = right - left + PAD_X;
      const rect = document.createElementNS(SVGNS, "rect");
      rect.setAttribute("x", String(left));
      rect.setAttribute("y", String(top));
      rect.setAttribute("width", String(width));
      rect.setAttribute("height", String(bottom - top));
      rect.style.fill = tile.swatch.bg;

      rect.style.transition = `fill ${COLOR_MS}ms ease, y 160ms ease, height 160ms ease`;
      gBg.appendChild(rect);
      tile.rects.push({
        el: rect,
        x0: left,
        x1: left + width,
        baseY: top,
        baseH: bottom - top,
        hovered: false,
      });
    }

    tile.textEl.setAttribute("x", "0");
    tile.textEl.setAttribute("y", String(BASELINE_Y));
    const vbX = -PAD_X;
    const vbW = m.width + PAD_X * 2;
    const vbY = bandTop;
    const vbH = bandBottom - bandTop;
    tile.svg.setAttribute("viewBox", `${vbX} ${vbY} ${vbW} ${vbH}`);
    tile.svg.setAttribute("preserveAspectRatio", "xMidYMid meet");

    tile.svg.removeAttribute("width");
    tile.svg.removeAttribute("height");
    tile.svg.style.width = "auto";
  }

  private buildFallback(tile: Tile) {
    const gBg = tile.svg.firstChild as SVGGElement;
    const rect = document.createElementNS(SVGNS, "rect");
    rect.setAttribute("x", "0");
    rect.setAttribute("y", "0");
    rect.setAttribute("width", "100");
    rect.setAttribute("height", "100");
    rect.style.fill = tile.swatch.bg;
    gBg.appendChild(rect);
    tile.rects.push({ el: rect, x0: 0, x1: 100, baseY: 0, baseH: 100, hovered: false });
    tile.svg.setAttribute("viewBox", "0 0 100 100");
  }

  private bindEvents() {
    this.tiles.forEach((tile) => {

      const onEnter = () => this.recolor(tile);
      tile.svg.addEventListener("pointerenter", onEnter);

      const onMove = (e: PointerEvent) => this.hoverLetter(tile, e);
      const onLeave = () => this.clearHover(tile);
      tile.svg.addEventListener("pointermove", onMove);
      tile.svg.addEventListener("pointerleave", onLeave);
      this.cleanup.push(() => {
        tile.svg.removeEventListener("pointerenter", onEnter);
        tile.svg.removeEventListener("pointermove", onMove);
        tile.svg.removeEventListener("pointerleave", onLeave);
      });
    });

    this.ro = new ResizeObserver(() => this.layout());
    this.ro.observe(this.host);
  }

  private hoverLetter(tile: Tile, e: PointerEvent) {
    const rect = tile.svg.getBoundingClientRect();
    if (rect.width < 1) return;
    const vb = tile.svg.viewBox.baseVal;
    const scale = vb.width / rect.width;
    const grow = 2 * scale;
    const px = vb.x + ((e.clientX - rect.left) / rect.width) * vb.width;

    for (const r of tile.rects) {
      const isHit = px >= r.x0 && px < r.x1;
      if (isHit === r.hovered) continue;
      r.hovered = isHit;
      if (isHit) {
        r.el.style.y = `${r.baseY - grow / 2}px`;
        r.el.style.height = `${r.baseH + grow}px`;
      } else {
        r.el.style.y = `${r.baseY}px`;
        r.el.style.height = `${r.baseH}px`;
      }
    }
  }

  private clearHover(tile: Tile) {
    for (const r of tile.rects) {
      if (!r.hovered) continue;
      r.hovered = false;
      r.el.style.y = `${r.baseY}px`;
      r.el.style.height = `${r.baseH}px`;
    }
  }

  private recolor(tile: Tile) {
    const used = this.tiles.filter((t) => t !== tile).map((t) => t.swatch);
    const sw = randomSwatchAvoiding(used);
    tile.swatch = sw;
    for (const r of tile.rects) r.el.style.fill = sw.bg;
    tile.textEl.style.fill = sw.fg;
  }

  refreshFont() {
    this.fontFamily = getComputedStyle(this.root).fontFamily || this.fontFamily;
    for (const tile of this.tiles) tile.textEl.setAttribute("font-family", this.fontFamily);
    this.layout();
  }

  private reveal() {
    if (this.revealed) return;
    this.revealed = true;
    this.tiles.forEach((tile, i) => {
      const delay = i * FLY_STAGGER;
      const t = window.setTimeout(() => {
        tile.outer.style.gridTemplateColumns = "1fr";
        tile.svg.style.opacity = "1";
      }, delay);
      this.cleanup.push(() => window.clearTimeout(t));
    });
    const assembledAt = this.tiles.length * FLY_STAGGER + FLY_MS;
    this.tiles.forEach((tile) => {
      tile.nextShuffle =
        performance.now() + assembledAt + SHUFFLE_MIN + Math.random() * (SHUFFLE_MAX - SHUFFLE_MIN);
    });
  }

  start() {
    if (this.running || this.disposed) return;
    this.running = true;
    this.reveal();
    this.raf = requestAnimationFrame(this.loop);
  }

  stop() {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  private loop = () => {
    if (!this.running) return;
    this.now = performance.now();
    for (const tile of this.tiles) {
      if (tile.nextShuffle === 0) continue;
      if (this.now >= tile.nextShuffle) {
        this.recolor(tile);
        tile.nextShuffle = this.now + SHUFFLE_MIN + Math.random() * (SHUFFLE_MAX - SHUFFLE_MIN);
      }
    }
    this.raf = requestAnimationFrame(this.loop);
  };

  renderStill() {
    this.revealed = true;
    this.tiles.forEach((tile) => {
      tile.outer.style.transition = "none";
      tile.outer.style.gridTemplateColumns = "1fr";
      tile.svg.style.transition = "none";
      tile.svg.style.opacity = "1";
    });
  }

  destroy() {
    this.disposed = true;
    this.stop();
    this.ro?.disconnect();
    this.cleanup.forEach((fn) => fn());
    this.root.parentNode?.removeChild(this.root);
    void this.bar;
  }
}

```


12. Build this: a scatter of die-cut VINYL WORD STICKERS you can grab and FLING around, each word set in a DIFFERENT font (a mini type specimen). The sticker look is generated on canvas, not baked into art: render the word to an offscreen canvas, then DILATE its silhouette outward by the border width (stamp the filled word in white many times around a ring of that radius — this grows an even outline that follows the true letter shapes, counters and all), fill that white = the die-cut base, draw the colored word on top, and put ONE soft drop shadow under the whole thing so it lifts off the page. Each sticker is an absolutely-positioned canvas at a scattered position + slight rotation. Drag with the pointer (cursor grab→grabbing), track pointer velocity, and on release THROW it with momentum: integrate position each frame, decay by friction, add a little spin, and BOUNCE off the card edges (flip + damp velocity) until it settles; a tap (no drag) gives a small wobble. Framework-free: a canvas renderer + a rAF physics loop, no canvas/physics library. Warm the (webfont) faces before rendering so the die-cut hugs the real glyphs, not a fallback. Reduced-motion shows a static scatter.

The complete, self-contained implementation follows, one file per block. It is framework-agnostic core logic — wire it into your own component and mount it on an element.

### word-stickers/stickers.ts

```ts
export interface StickerDef {
  word: string;
  font: string;
  weight: number;
  fill: string;
  outline: string;
  x: number;
  y: number;
  rot: number;
}

const FONT = "var(--font-mondwest)";

export const STICKERS: StickerDef[] = [
  { word: "wow", font: FONT, weight: 400, outline: "#ff2e6e", fill: "#2b0b4f", x: 0.17, y: 0.28, rot: 0 },
  { word: "design", font: FONT, weight: 400, outline: "#7c4dff", fill: "#eaff5a", x: 0.66, y: 0.24, rot: 0 },
  { word: "vault", font: FONT, weight: 400, outline: "#00b3a4", fill: "#ff3d6e", x: 0.82, y: 0.7, rot: 0 },
  { word: "yes!", font: FONT, weight: 400, outline: "#ff7a1a", fill: "#0a2f6b", x: 0.3, y: 0.74, rot: 0 },
  { word: "arlan", font: FONT, weight: 400, outline: "#ffd21e", fill: "#c81e5b", x: 0.52, y: 0.55, rot: 0 },
  { word: "ship it", font: FONT, weight: 400, outline: "#1668ff", fill: "#7dffb0", x: 0.2, y: 0.55, rot: 0 },
];

```

### word-stickers/sticker-render.ts

```ts
export interface RenderedSticker {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
}

export interface RenderOpts {
  word: string;
  font: string;
  weight: number;
  fill: string;
  outline: string;
  fontSizePx: number;
  border?: number;
  dpr?: number;
}

export function renderSticker(opts: RenderOpts): RenderedSticker {
  const dpr = opts.dpr ?? Math.min(window.devicePixelRatio || 1, 2);
  const size = opts.fontSizePx;
  const border = opts.border ?? Math.max(6, Math.round(size * 0.16));
  const fontStr = `${opts.weight} ${size}px ${opts.font}`;

  const meas = document.createElement("canvas").getContext("2d")!;
  meas.font = fontStr;
  const m = meas.measureText(opts.word);
  const ascent = m.actualBoundingBoxAscent || size * 0.8;
  const descent = m.actualBoundingBoxDescent || size * 0.2;
  const textW = m.width;
  const textH = ascent + descent;

  const pad = border + 4;
  const cssW = Math.ceil(textW + pad * 2);
  const cssH = Math.ceil(textH + pad * 2);

  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(cssW * dpr);
  canvas.height = Math.ceil(cssH * dpr);
  const ctx = canvas.getContext("2d")!;
  ctx.scale(dpr, dpr);
  ctx.textBaseline = "alphabetic";
  ctx.font = fontStr;

  const bx = pad;
  const by = pad + ascent;

  const base = document.createElement("canvas");
  base.width = canvas.width;
  base.height = canvas.height;
  const bctx = base.getContext("2d")!;
  bctx.scale(dpr, dpr);
  bctx.font = fontStr;
  bctx.textBaseline = "alphabetic";
  bctx.fillStyle = opts.outline;

  for (let r = border; r > 0.5; r -= 1) {
    const stamps = Math.max(16, Math.ceil(r * 3));
    for (let a = 0; a < stamps; a++) {
      const ang = (a / stamps) * Math.PI * 2;
      bctx.fillText(opts.word, bx + Math.cos(ang) * r, by + Math.sin(ang) * r);
    }
  }

  bctx.fillText(opts.word, bx, by);

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(base, 0, 0);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  ctx.fillStyle = opts.fill;
  ctx.font = fontStr;
  ctx.textBaseline = "alphabetic";
  ctx.fillText(opts.word, bx, by);

  return { canvas, width: cssW, height: cssH };
}

```

### word-stickers/engine.ts

```ts
import { STICKERS, type StickerDef } from "./stickers";
import { renderSticker } from "./sticker-render";
import { StickerGL } from "./gl-sticker";

function resolveFamily(cssFamily: string): string {
  const probe = document.createElement("span");
  probe.style.fontFamily = cssFamily;
  probe.style.position = "absolute";
  probe.style.visibility = "hidden";
  probe.textContent = "Ag";
  document.body.appendChild(probe);
  const fam = getComputedStyle(probe).fontFamily || "sans-serif";
  document.body.removeChild(probe);
  return fam;
}

const FRICTION = 0.92;
const BOUNCE = 0.55;
const MIN_VEL = 0.05;
const THROW_SCALE = 0.7;
const GRAB_SCALE = 1.12;
const SCALE_EASE = 0.12;
const DRAG_EASE = 0.1;
const PEEL_EASE = 0.1;

const APPEAR_EASE = 0.09;
const APPEAR_STAGGER_MS = 140;

const PEEL_ELEVATION = 0.4;
const PEEL_PULLBACK = 0.16;

interface Item {
  def: StickerDef;
  art: HTMLCanvasElement;
  hit: HTMLDivElement;
  tex: WebGLTexture | null;
  w: number;
  h: number;
  x: number;
  y: number;
  tx: number;
  ty: number;
  vx: number;
  vy: number;
  scale: number;
  dragging: boolean;

  peel: number;
  grabU: number;
  grabV: number;
  anchorU: number;
  anchorV: number;
  offX: number;
  offY: number;

  appear: number;
  appearAt: number;
}

export class WordStickers {
  private host: HTMLElement;
  private items: Item[] = [];
  private W = 1;
  private H = 1;
  private dpr = 1;

  private gl: StickerGL | null = null;
  private useGL = false;

  private raf = 0;
  private running = false;
  private disposed = false;
  private laidOut = false;
  private entranceStarted = false;
  private now = 0;

  private drag: {
    item: Item;
    dx: number;
    dy: number;
    lastX: number;
    lastY: number;
    moved: number;
    pointerId: number;
  } | null = null;

  private ro?: ResizeObserver;
  private cleanup: (() => void)[] = [];

  constructor(host: HTMLElement) {
    this.host = host;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.measure();

    const gl = new StickerGL();
    if (gl.available) {
      this.gl = gl;
      this.useGL = true;
      gl.resize(this.W, this.H, this.dpr);
      host.appendChild(gl.canvas);
    }

    for (const def of STICKERS) {
      const fontSizePx = this.stickerFontPx();
      const r = renderSticker({
        word: def.word,
        font: resolveFamily(def.font),
        weight: def.weight,
        fill: def.fill,
        outline: def.outline,
        fontSizePx,
      });

      const art = r.canvas;
      let tex: WebGLTexture | null = null;
      if (this.useGL && this.gl) {
        tex = this.gl.makeTexture(art, r.width, r.height).tex;
      } else {

        Object.assign(art.style, {
          position: "absolute",
          width: `${r.width}px`,
          height: `${r.height}px`,
          left: "0",
          top: "0",
          pointerEvents: "none",
        });
        art.setAttribute("aria-hidden", "true");
        host.appendChild(art);
      }

      const hit = document.createElement("div");
      Object.assign(hit.style, {
        position: "absolute",
        left: "0",
        top: "0",
        width: `${r.width}px`,
        height: `${r.height}px`,
        cursor: "grab",
        touchAction: "none",
      });
      hit.setAttribute("aria-hidden", "true");
      host.appendChild(hit);

      const item: Item = {
        def,
        art,
        hit,
        tex,
        w: r.width,
        h: r.height,
        x: def.x * this.W - r.width / 2,
        y: def.y * this.H - r.height / 2,
        tx: 0,
        ty: 0,
        vx: 0,
        vy: 0,
        scale: 1,
        dragging: false,
        peel: 0,
        grabU: 0.5,
        grabV: 0.5,
        anchorU: 0.5,
        anchorV: 0.5,
        offX: 0,
        offY: 0,
        appear: 0,
        appearAt: 0,
      };
      item.tx = item.x;
      item.ty = item.y;
      this.clampInside(item);
      this.placeItem(item);
      this.items.push(item);
      this.bindDrag(item);
    }

    this.ro = new ResizeObserver(() => this.onResize());
    this.ro.observe(host);
  }

  private measure() {
    this.W = this.host.clientWidth || 1;
    this.H = this.host.clientHeight || 1;
  }

  private stickerFontPx() {
    const w = this.W > 40 ? this.W : 640;
    return Math.max(32, Math.min(66, w * 0.088));
  }

  private onResize() {
    const prevW = this.W;
    const prevH = this.H;
    this.measure();
    if (this.W < 2 || this.H < 2) return;
    this.gl?.resize(this.W, this.H, this.dpr);
    const sx = this.W / (prevW || 1);
    const sy = this.H / (prevH || 1);
    for (const it of this.items) {
      it.x *= sx;
      it.y *= sy;
      it.tx = it.x;
      it.ty = it.y;
    }
    this.rerenderAll();
  }

  private effScale(it: Item) {
    const a = it.appearAt > 0 ? it.appear : 1;
    return it.scale * a;
  }

  private placeItem(it: Item) {
    const s = this.effScale(it);
    const t = `translate(${it.x}px, ${it.y}px)${s !== 1 ? ` scale(${s})` : ""}`;
    it.hit.style.transform = t;
    if (!this.useGL) it.art.style.transform = t;
  }

  private clampInside(it: Item) {
    it.x = Math.max(0, Math.min(this.W - it.w, it.x));
    it.y = Math.max(0, Math.min(this.H - it.h, it.y));
  }

  private bindDrag(it: Item) {
    const onDown = (e: PointerEvent) => {
      e.preventDefault();
      this.host.appendChild(it.hit);
      it.dragging = true;
      it.vx = it.vy = 0;
      it.hit.style.cursor = "grabbing";
      it.hit.style.zIndex = "10";

      const r = this.rect();

      const gx = (e.clientX - r.left - it.x) / it.w;
      const gy = (e.clientY - r.top - it.y) / it.h;
      it.grabU = Math.min(1, Math.max(0, gx));
      it.grabV = Math.min(1, Math.max(0, gy));

      it.anchorU = 1 - it.grabU;
      it.anchorV = 1 - it.grabV;

      this.drag = {
        item: it,
        dx: e.clientX - r.left - it.x,
        dy: e.clientY - r.top - it.y,
        lastX: e.clientX,
        lastY: e.clientY,
        moved: 0,
        pointerId: e.pointerId,
      };
      it.hit.setPointerCapture?.(e.pointerId);
    };
    it.hit.addEventListener("pointerdown", onDown);
    this.cleanup.push(() => it.hit.removeEventListener("pointerdown", onDown));

    const onMove = (e: PointerEvent) => {
      if (!this.drag || this.drag.item !== it) return;
      const r = this.rect();
      it.tx = e.clientX - r.left - this.drag.dx;
      it.ty = e.clientY - r.top - this.drag.dy;
      this.drag.moved += Math.hypot(e.clientX - this.drag.lastX, e.clientY - this.drag.lastY);
      this.drag.lastX = e.clientX;
      this.drag.lastY = e.clientY;
    };
    it.hit.addEventListener("pointermove", onMove);
    this.cleanup.push(() => it.hit.removeEventListener("pointermove", onMove));

    const onUp = (e: PointerEvent) => {
      if (!this.drag || this.drag.item !== it) return;
      it.dragging = false;
      it.hit.style.cursor = "grab";
      it.hit.style.zIndex = "";
      it.vx *= THROW_SCALE;
      it.vy *= THROW_SCALE;
      it.hit.releasePointerCapture?.(e.pointerId);
      this.drag = null;
    };
    it.hit.addEventListener("pointerup", onUp);
    it.hit.addEventListener("pointercancel", onUp);
    this.cleanup.push(() => {
      it.hit.removeEventListener("pointerup", onUp);
      it.hit.removeEventListener("pointercancel", onUp);
    });
  }

  private rect() {
    return this.host.getBoundingClientRect();
  }

  start() {
    if (this.running || this.disposed) return;
    const prevW = this.W;
    this.measure();
    if (!this.laidOut || Math.abs(this.W - prevW) > 2) {
      this.layout();
      this.laidOut = true;
    }

    if (!this.entranceStarted) {
      this.entranceStarted = true;
      const order = [...this.items].sort((a, b) => a.def.x - b.def.x);
      const t0 = performance.now() + 150;
      order.forEach((it, i) => (it.appearAt = t0 + i * APPEAR_STAGGER_MS));
    }
    this.running = true;
    this.raf = requestAnimationFrame(this.loop);
  }

  stop() {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  private layout() {
    if (this.W < 2 || this.H < 2) return;
    this.gl?.resize(this.W, this.H, this.dpr);
    this.rerenderAll();
    for (const it of this.items) {
      it.x = it.def.x * this.W - it.w / 2;
      it.y = it.def.y * this.H - it.h / 2;
      it.tx = it.x;
      it.ty = it.y;
      it.vx = it.vy = 0;
      it.scale = 1;
      this.clampInside(it);
      this.placeItem(it);
    }
    this.drawGL();
  }

  private loop = () => {
    if (!this.running) return;
    this.now = performance.now();

    for (const it of this.items) {

      if (it.appearAt > 0 && this.now >= it.appearAt && it.appear < 1) {
        it.appear += (1 - it.appear) * APPEAR_EASE;
        if (it.appear > 0.999) it.appear = 1;
      }

      const targetScale = it.dragging ? GRAB_SCALE : 1;
      if (Math.abs(targetScale - it.scale) > 0.001) it.scale += (targetScale - it.scale) * SCALE_EASE;

      const peelTarget = it.dragging ? 1 : 0;
      if (Math.abs(peelTarget - it.peel) > 0.001) it.peel += (peelTarget - it.peel) * PEEL_EASE;

      if (it.dragging) {

        const nx = it.x + (it.tx - it.x) * DRAG_EASE;
        const ny = it.y + (it.ty - it.y) * DRAG_EASE;
        it.vx = nx - it.x;
        it.vy = ny - it.y;
        it.x = nx;
        it.y = ny;
        this.placeItem(it);
        continue;
      }

      const appearing = it.appearAt > 0 && it.appear < 1;
      const moving = Math.abs(it.vx) >= MIN_VEL || Math.abs(it.vy) >= MIN_VEL;
      if (!moving && it.peel < 0.001 && Math.abs(it.scale - 1) < 0.001 && !appearing) continue;

      it.x += it.vx;
      it.y += it.vy;
      if (it.x < 0) { it.x = 0; it.vx = -it.vx * BOUNCE; }
      else if (it.x > this.W - it.w) { it.x = this.W - it.w; it.vx = -it.vx * BOUNCE; }
      if (it.y < 0) { it.y = 0; it.vy = -it.vy * BOUNCE; }
      else if (it.y > this.H - it.h) { it.y = this.H - it.h; it.vy = -it.vy * BOUNCE; }
      it.vx *= FRICTION;
      it.vy *= FRICTION;
      this.placeItem(it);
    }

    this.drawGL();
    this.raf = requestAnimationFrame(this.loop);
  };

  private drawGL() {
    if (!this.useGL || !this.gl) return;
    this.gl.beginFrame();
    for (const it of this.items) {
      if (!it.tex) continue;
      this.gl.drawSticker({
        x: it.x,
        y: it.y,
        w: it.w,
        h: it.h,
        scale: this.effScale(it),
        grabU: it.grabU,
        grabV: it.grabV,
        anchorU: it.anchorU,
        anchorV: it.anchorV,
        fraction: it.peel,
        elevation: PEEL_ELEVATION,
        pullback: PEEL_PULLBACK,
        dragOffX: 0,
        dragOffY: 0,
        tex: it.tex,
      });
    }
  }

  renderStill() {
    for (const it of this.items) {
      it.vx = it.vy = 0;
      it.scale = 1;
      it.peel = 0;
      it.appear = 1;
      this.placeItem(it);
    }
    this.entranceStarted = true;
    this.drawGL();
  }

  refreshFonts() {
    this.measure();
    this.gl?.resize(this.W, this.H, this.dpr);
    this.rerenderAll();
    this.drawGL();
  }

  private rerenderAll() {
    const fontSizePx = this.stickerFontPx();
    for (const it of this.items) {
      const r = renderSticker({
        word: it.def.word,
        font: resolveFamily(it.def.font),
        weight: it.def.weight,
        fill: it.def.fill,
        outline: it.def.outline,
        fontSizePx,
      });
      it.w = r.width;
      it.h = r.height;
      it.hit.style.width = `${r.width}px`;
      it.hit.style.height = `${r.height}px`;
      if (this.useGL && this.gl) {
        it.tex = this.gl.makeTexture(r.canvas, r.width, r.height).tex;
      } else {
        const ctx = it.art.getContext("2d")!;
        it.art.width = r.canvas.width;
        it.art.height = r.canvas.height;
        it.art.style.width = `${r.width}px`;
        it.art.style.height = `${r.height}px`;
        ctx.clearRect(0, 0, it.art.width, it.art.height);
        ctx.drawImage(r.canvas, 0, 0);
      }
      this.clampInside(it);
      this.placeItem(it);
    }
  }

  destroy() {
    this.disposed = true;
    this.stop();
    this.cleanup.forEach((fn) => fn());
    this.ro?.disconnect();
    for (const it of this.items) {
      it.hit.parentNode?.removeChild(it.hit);
      if (!this.useGL) it.art.parentNode?.removeChild(it.art);
    }
    this.gl?.canvas.parentNode?.removeChild(this.gl.canvas);
    this.gl?.destroy();
  }
}

```


13. Build this: a display-only card that cycles through vivid, uniquely-colored panels one at a time — each panel a bold background with a short line of serif text in a contrasting (also unique) color. The signature is a WebGL MASK-REVEAL-BLUR of the whole line at once: render the sentence to an offscreen canvas (wrapped, centered), upload it as a texture, and draw it on a fullscreen quad through a fragment shader driven by uProgress (0=hidden, 1=revealed) and uMaxBlur (~7 texels). In the shader, a soft noise-perturbed diagonal front sweeps across the line as uProgress rises (smoothstep dissolve, not a hard wipe), and each pixel is sampled with a multi-tap blur whose radius = uMaxBlur*(1-reveal) — so the line dissolves in through a cloudy front while un-blurring into focus. Animate uProgress 0→1 fast on enter, hold, then 1→0 out, cross-fade the panel background color, and reveal the next sentence. Loop. Framework-free WebGL (one shader, one quad) + a rAF loop; falls back to a CSS blur/opacity fade if WebGL is unavailable. Reduced-motion shows the line fully resolved.

The complete, self-contained implementation follows, one file per block. It is framework-agnostic core logic — wire it into your own component and mount it on an element.

### blur-reveal/panels.ts

```ts
export interface Panel {
  line: string;
  bg: string;
  fg: string;
}

export const PANELS: Panel[] = [
  { line: "make it obvious", bg: "#0b3d3a", fg: "#f7c948" },
  { line: "then make it fast", bg: "#ff4d4d", fg: "#fff0e6" },
  { line: "sweat the details", bg: "#1b1440", fg: "#a78bfa" },
  { line: "ship it anyway", bg: "#f2e9d8", fg: "#c2410c" },
  { line: "keep it honest", bg: "#0891b2", fg: "#fef9c3" },
  { line: "cut what is dull", bg: "#18181b", fg: "#f472b6" },
];

```

### blur-reveal/text-texture.ts

```ts
export interface TextTexture {
  canvas: HTMLCanvasElement;
  cssW: number;
  cssH: number;
}

export interface TextOpts {
  line: string;
  font: string;
  fill: string;
  cardW: number;
  cardH: number;
  dpr?: number;
}

export function renderText(o: TextOpts): TextTexture {
  const dpr = o.dpr ?? Math.min(window.devicePixelRatio || 1, 2);
  const cssW = Math.max(1, Math.round(o.cardW));
  const cssH = Math.max(1, Math.round(o.cardH));

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  const ctx = canvas.getContext("2d")!;
  ctx.scale(dpr, dpr);

  ctx.fillStyle = o.fill;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const maxW = cssW * 0.86;
  let fontSize = Math.min(58, cssW * 0.1);
  for (let i = 0; i < 24; i++) {
    ctx.font = `500 ${fontSize}px ${o.font}`;
    if (ctx.measureText(o.line).width <= maxW || fontSize <= 16) break;
    fontSize -= 2;
  }
  ctx.fillText(o.line, cssW / 2, cssH / 2);

  return { canvas, cssW, cssH };
}

```

### blur-reveal/reveal-shader.ts

```ts
export const REVEAL_VERT =  `
  attribute vec2 aPosition;
  attribute vec2 aUV;
  varying vec2 vUV;
  void main(){
    vUV = aUV;
    gl_Position = vec4(aPosition, 0.0, 1.0);
  }
`;

export const REVEAL_FRAG =  `
  precision highp float;
  uniform sampler2D uTex;
  uniform vec2  uTexel;
  uniform float uProgress;
  uniform float uMaxBlur;
  uniform vec3  uEdge;
  uniform float uTime;
  uniform float uAspect;
  uniform float uSeed;
  varying vec2 vUV;

  float hash(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
  float noise(vec2 p){
    vec2 i = floor(p), f = fract(p);
    f = f*f*(3.0-2.0*f);
    float a = hash(i), b = hash(i+vec2(1,0)), c = hash(i+vec2(0,1)), d = hash(i+vec2(1,1));
    return mix(mix(a,b,f.x), mix(c,d,f.x), f.y);
  }

  vec4 blurTex(vec2 uv, float radius){
    if (radius < 0.35) return texture2D(uTex, uv);
    vec2 r1 = uTexel * radius;
    vec2 r2 = uTexel * radius * 2.0;
    vec4 sum = texture2D(uTex, uv) * 1.0;
    float wsum = 1.0;

    for (int i = 0; i < 8; i++){
      float a = float(i) * 0.785398;
      vec2 dir = vec2(cos(a), sin(a));
      sum += texture2D(uTex, uv + dir * r1) * 0.75; wsum += 0.75;
      sum += texture2D(uTex, uv + dir * r2) * 0.5;  wsum += 0.5;
    }
    return sum / wsum;
  }

  float fbm(vec2 p){
    float v = 0.0, amp = 0.5;
    for (int i = 0; i < 4; i++){
      v += amp * noise(p);
      p *= 2.03;
      amp *= 0.5;
    }
    return v;
  }

  void main(){

    if (uProgress >= 0.999) { gl_FragColor = texture2D(uTex, vUV); return; }

    float p = uProgress * 1.3;

    vec2 sd = vec2(uSeed * 1.7, uSeed * -1.3);
    vec2 rc = (vUV - 0.5) * vec2(uAspect, 1.0);
    rc += vec2(sin(uSeed * 2.3), cos(uSeed * 1.9)) * 0.12;
    float radial = length(rc) * 0.9;
    vec2 warp = vec2(fbm(vUV * 3.2 + sd + uTime * 0.05 + 11.0),
                     fbm(vUV * 3.2 - sd - uTime * 0.04 - 7.0)) - 0.5;
    float turb = fbm(vUV * 5.5 + warp * 1.7 + sd + uTime * 0.06);
    float mask = mix(radial, turb, 0.7);

    float reveal = smoothstep(p + 0.34, p - 0.34, mask);
    if (reveal <= 0.0) discard;

    float blurAmt = smoothstep(p - 0.5, p + 0.34, mask);

    vec2 drift = (-rc * 0.010 + vec2(0.0, 0.006)) * blurAmt;
    float grow = 1.0 + 0.03 * blurAmt;
    vec2 suv = (vUV - 0.5) / grow + 0.5 + drift;

    float radius = blurAmt * uMaxBlur;
    vec4 tex = blurTex(suv, radius);

    float fw = 0.30;
    float flare = smoothstep(p - fw, p, mask) * smoothstep(p + fw, p, mask);
    flare *= 1.0 - smoothstep(0.8, 1.0, uProgress);

    vec4 wide = blurTex(suv, uMaxBlur * 1.3);
    float halo = wide.a;

    vec3 rgb = tex.rgb;

    vec3 glow = mix(uEdge, vec3(1.0), 0.3);
    rgb += glow * flare * (tex.a * 0.6 + halo * 0.5);
    float alpha = max(tex.a * reveal, halo * flare * 0.5);

    gl_FragColor = vec4(rgb, alpha);
  }
`;

```

### blur-reveal/gl.ts

```ts
import { REVEAL_VERT, REVEAL_FRAG } from "./reveal-shader";

export class RevealGL {
  readonly canvas: HTMLCanvasElement;
  private gl: WebGLRenderingContext;
  private prog: WebGLProgram;
  private quad: WebGLBuffer;
  private loc: Record<string, WebGLUniformLocation | null> = {};
  private aPos = 0;
  private aUV = 0;
  private tex: WebGLTexture | null = null;
  private texW = 1;
  private texH = 1;
  private ok = false;

  constructor() {
    this.canvas = document.createElement("canvas");
    Object.assign(this.canvas.style, {
      position: "absolute",
      inset: "0",
      width: "100%",
      height: "100%",
      display: "block",
    });
    const gl = this.canvas.getContext("webgl", { alpha: true, premultipliedAlpha: false });
    if (!gl) {
      this.gl = null as unknown as WebGLRenderingContext;
      this.prog = null as unknown as WebGLProgram;
      this.quad = null as unknown as WebGLBuffer;
      return;
    }
    this.gl = gl;
    this.prog = this.build(REVEAL_VERT, REVEAL_FRAG);
    this.aPos = gl.getAttribLocation(this.prog, "aPosition");
    this.aUV = gl.getAttribLocation(this.prog, "aUV");
    for (const u of ["uTex", "uTexel", "uProgress", "uMaxBlur", "uEdge", "uTime", "uAspect", "uSeed"]) {
      this.loc[u] = gl.getUniformLocation(this.prog, u);
    }

    const data = new Float32Array([
      -1, -1, 0, 1,
       1, -1, 1, 1,
      -1,  1, 0, 0,
       1,  1, 1, 0,
    ]);
    this.quad = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    this.ok = true;
  }

  get available() {
    return this.ok;
  }

  private build(vs: string, fs: string): WebGLProgram {
    const gl = this.gl;
    const c = (type: number, src: string) => {
      const sh = gl.createShader(type)!;
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        throw new Error(gl.getShaderInfoLog(sh) || "shader compile failed");
      }
      return sh;
    };
    const p = gl.createProgram()!;
    gl.attachShader(p, c(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, c(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(p) || "program link failed");
    }
    return p;
  }

  setTexture(art: HTMLCanvasElement) {
    if (!this.ok) return;
    const gl = this.gl;
    if (this.tex) gl.deleteTexture(this.tex);
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, art);
    this.tex = tex;
    this.texW = art.width;
    this.texH = art.height;
  }

  resize(w: number, h: number, dpr: number) {
    this.canvas.width = Math.max(1, Math.round(w * dpr));
    this.canvas.height = Math.max(1, Math.round(h * dpr));
    if (this.ok) this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }

  draw(
    progress: number,
    maxBlur: number,
    edge: [number, number, number],
    time: number,
    aspect: number,
    seed: number,
  ) {
    if (!this.ok || !this.tex) return;
    const gl = this.gl;
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    gl.enableVertexAttribArray(this.aPos);
    gl.vertexAttribPointer(this.aPos, 2, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(this.aUV);
    gl.vertexAttribPointer(this.aUV, 2, gl.FLOAT, false, 16, 8);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.uniform1i(this.loc.uTex, 0);
    gl.uniform2f(this.loc.uTexel, 1 / this.texW, 1 / this.texH);
    gl.uniform1f(this.loc.uProgress, progress);
    gl.uniform1f(this.loc.uMaxBlur, maxBlur);
    gl.uniform3f(this.loc.uEdge, edge[0], edge[1], edge[2]);
    gl.uniform1f(this.loc.uTime, time);
    gl.uniform1f(this.loc.uAspect, aspect);
    gl.uniform1f(this.loc.uSeed, seed);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  destroy() {
    if (!this.ok) return;
    const gl = this.gl;
    if (this.tex) gl.deleteTexture(this.tex);
    gl.getExtension("WEBGL_lose_context")?.loseContext();
  }
}

```

### blur-reveal/engine.ts

```ts
import { PANELS } from "./panels";
import { RevealGL } from "./gl";
import { renderText } from "./text-texture";

const HOLD_MS = 900;
const OUT_HOLD_MS = 40;
const BG_MS = 320;
const MAX_BLUR = 18;

const K_IN = 42;
const K_OUT = 60;
const DAMP = 1.0;

const REVEALED_AT = 0.992;
const GONE_AT = 0.02;

function resolveFamily(cssFamily: string): string {
  const probe = document.createElement("span");
  probe.style.cssText = "position:absolute;visibility:hidden";
  probe.style.fontFamily = cssFamily;
  probe.textContent = "Ag";
  document.body.appendChild(probe);
  const fam = getComputedStyle(probe).fontFamily || "serif";
  document.body.removeChild(probe);
  return fam;
}

function springStep(
  pos: number,
  vel: number,
  target: number,
  k: number,
  damp: number,
  dt: number,
): [number, number] {
  const c = 2 * Math.sqrt(k) * damp;
  const accel = -k * (pos - target) - c * vel;
  const v = vel + accel * dt;
  const x = pos + v * dt;
  return [x, v];
}

function hexToRgb(hex: string): [number, number, number] {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export class BlurReveal {
  private host: HTMLElement;
  private stage: HTMLDivElement;
  private gl: RevealGL | null = null;
  private useGL = false;
  private fallback: HTMLDivElement | null = null;
  private fontFamily = "serif";

  private index = 0;
  private W = 1;
  private H = 1;
  private dpr = 1;

  private raf = 0;
  private running = false;
  private disposed = false;
  private now = 0;
  private last = 0;
  private clock = 0;

  private phase: "in" | "hold" | "out" = "in";
  private phaseStart = 0;
  private progress = 0;
  private vel = 0;
  private target = 1;
  private edge: [number, number, number] = [1, 1, 1];
  private seed = Math.random() * 100;

  private ro?: ResizeObserver;

  constructor(host: HTMLElement) {
    this.host = host;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.measure();

    const stage = document.createElement("div");
    Object.assign(stage.style, {
      position: "absolute",
      inset: "0",
      background: PANELS[0].bg,
      transition: `background-color ${BG_MS}ms ease`,
      overflow: "hidden",
      fontFamily: "var(--font-neue-corp), system-ui, sans-serif",
    });
    host.appendChild(stage);
    this.stage = stage;
    this.fontFamily = resolveFamily("var(--font-neue-corp), system-ui, sans-serif");

    const gl = new RevealGL();
    if (gl.available) {
      this.gl = gl;
      this.useGL = true;
      gl.resize(this.W, this.H, this.dpr);
      stage.appendChild(gl.canvas);
    }

    this.ro = new ResizeObserver(() => this.onResize());
    this.ro.observe(host);
  }

  private measure() {
    this.W = this.host.clientWidth || 1;
    this.H = this.host.clientHeight || 1;
  }

  private onResize() {
    this.measure();
    if (this.W < 2 || this.H < 2) return;
    this.gl?.resize(this.W, this.H, this.dpr);
    this.mountPanel(this.index);
  }

  refreshFont() {
    this.fontFamily = resolveFamily("var(--font-neue-corp), system-ui, sans-serif");
    this.mountPanel(this.index);
  }

  private mountPanel(i: number) {
    const p = PANELS[i];
    this.stage.style.background = p.bg;
    this.edge = hexToRgb(p.fg);
    if (this.useGL && this.gl) {
      const t = renderText({
        line: p.line,
        font: this.fontFamily,
        fill: p.fg,
        cardW: this.W,
        cardH: this.H,
        dpr: this.dpr,
      });
      this.gl.setTexture(t.canvas);
    } else {
      this.mountFallback(p.line, p.fg);
    }
  }

  private mountFallback(line: string, fg: string) {
    if (!this.fallback) {
      const el = document.createElement("div");
      Object.assign(el.style, {
        position: "absolute",
        inset: "0",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "8% 10%",
        fontStyle: "italic",
        fontWeight: "500",
        fontSize: "clamp(1.9rem, 7vw, 4rem)",
        textAlign: "center",
        transition: "opacity 300ms ease, filter 300ms ease",
      });
      this.stage.appendChild(el);
      this.fallback = el;
    }
    this.fallback.textContent = line;
    this.fallback.style.color = fg;
  }

  start() {
    if (this.running || this.disposed) return;
    this.running = true;
    this.mountPanel(this.index);
    this.phase = "in";
    this.phaseStart = performance.now();
    this.last = this.phaseStart;
    this.progress = 0;
    this.vel = 0;
    this.target = 1;
    this.raf = requestAnimationFrame(this.loop);
  }

  stop() {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  private loop = () => {
    if (!this.running) return;
    this.now = performance.now();

    const dt = Math.min(0.05, Math.max(0.001, (this.now - this.last) / 1000));
    this.last = this.now;
    this.clock += dt;

    const k = this.target > 0.5 ? K_IN : K_OUT;
    [this.progress, this.vel] = springStep(this.progress, this.vel, this.target, k, DAMP, dt);

    if (this.phase === "in") {

      if (this.progress >= REVEALED_AT) {
        this.phase = "hold";
        this.phaseStart = this.now;
      }
    } else if (this.phase === "hold") {
      if (this.now - this.phaseStart >= HOLD_MS) {
        this.phase = "out";
        this.phaseStart = this.now;
        this.target = 0;
      }
    } else {

      if (this.progress <= GONE_AT && this.now - this.phaseStart >= OUT_HOLD_MS) {
        this.index = (this.index + 1) % PANELS.length;
        this.seed = Math.random() * 100;
        this.mountPanel(this.index);
        this.phase = "in";
        this.phaseStart = this.now;
        this.progress = 0;
        this.vel = 0;
        this.target = 1;
      }
    }

    const clampP = Math.max(0, Math.min(1, this.progress));
    if (this.useGL && this.gl) {
      this.gl.draw(clampP, MAX_BLUR, this.edge, this.clock, this.W / Math.max(1, this.H), this.seed);
    } else if (this.fallback) {

      this.fallback.style.opacity = String(clampP);
      this.fallback.style.filter = `blur(${(1 - clampP) * 10}px)`;
    }

    this.raf = requestAnimationFrame(this.loop);
  };

  renderStill() {
    this.measure();
    this.gl?.resize(this.W, this.H, this.dpr);
    this.mountPanel(this.index);
    this.progress = 1;
    if (this.useGL && this.gl) this.gl.draw(1, 0, this.edge, 0, this.W / Math.max(1, this.H), this.seed);
    else if (this.fallback) { this.fallback.style.opacity = "1"; this.fallback.style.filter = "none"; }
  }

  destroy() {
    this.disposed = true;
    this.stop();
    this.ro?.disconnect();
    this.gl?.destroy();
    this.stage.parentNode?.removeChild(this.stage);
  }
}

```


14. Build this: a stylized portrait that CYCLES through several art styles of the SAME photo (LEGO, Minecraft, Roblox) and melts back to the REAL photo along a soft cursor trail. You supply the real photo plus one AI-restyled version per style, all framing the same pose. The card auto-cycles the styles (each held ~2.8s then a quick ~0.4s crossfade), the background + a cursor-following glow take each style's colour and crossfade with it, the tile does a gentle 3D tilt + parallax toward the cursor, and when idle an autonomous virtual cursor wanders the face so it keeps revealing on its own. Two WebGL passes per frame. (1) A persistent cursor-trail buffer on a small ping-pong half-float render target: each frame the cursor paints a soft noise-warped spot into the red channel (distance-to-pointer through smoothstep, perturbed by Perlin noise); the buffer decays and neighbour taps erode it so a trail lingers and fades. (2) The display pass: crossfade the current + next style textures (cover-fit, center-crop), read the trail buffer, and where it is hot the reveal snaps to a grid of MERGED rounded-corner blocks (a union of rounded-box SDFs per revealed cell, blocks bounce in on the front) that mix to the crisp real photo. Framework-free WebGL1 (two programs, a full-screen triangle, a half-float ping-pong pair) + a rAF loop; the tile tilt, glow and background colour are reported to the host each frame and applied with CSS. Reduced-motion renders one static frame.

First make the images. Take a clear photo of yourself, then ask an AI image model (e.g. ChatGPT / an image model) to restyle that SAME photo into each style, keeping the pose and framing. The exact prompts used here were literally:
  - "make me a lego"
  - "make me a minecraft"
  - "make me a roblox"
You end up with your real photo + one restyled image per style, all the same square crop. Those are the textures the effect below cycles and reveals.

The complete, self-contained implementation follows, one file per block. It is framework-agnostic core logic — wire it into your own component and mount it on an element.

### lego/shaders.ts

```ts
const CNOISE3 = `
vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}
vec3 fade(vec3 t) {return t*t*t*(t*(t*6.0-15.0)+10.0);}
float cnoise(vec3 P){
  vec3 Pi0 = floor(P); vec3 Pi1 = Pi0 + vec3(1.0);
  Pi0 = mod(Pi0, 289.0); Pi1 = mod(Pi1, 289.0);
  vec3 Pf0 = fract(P); vec3 Pf1 = Pf0 - vec3(1.0);
  vec4 ix = vec4(Pi0.x, Pi1.x, Pi0.x, Pi1.x);
  vec4 iy = vec4(Pi0.yy, Pi1.yy);
  vec4 iz0 = Pi0.zzzz; vec4 iz1 = Pi1.zzzz;
  vec4 ixy = permute(permute(ix) + iy);
  vec4 ixy0 = permute(ixy + iz0); vec4 ixy1 = permute(ixy + iz1);
  vec4 gx0 = ixy0 / 7.0; vec4 gy0 = fract(floor(gx0) / 7.0) - 0.5;
  gx0 = fract(gx0); vec4 gz0 = vec4(0.5) - abs(gx0) - abs(gy0);
  vec4 sz0 = step(gz0, vec4(0.0));
  gx0 -= sz0 * (step(0.0, gx0) - 0.5); gy0 -= sz0 * (step(0.0, gy0) - 0.5);
  vec4 gx1 = ixy1 / 7.0; vec4 gy1 = fract(floor(gx1) / 7.0) - 0.5;
  gx1 = fract(gx1); vec4 gz1 = vec4(0.5) - abs(gx1) - abs(gy1);
  vec4 sz1 = step(gz1, vec4(0.0));
  gx1 -= sz1 * (step(0.0, gx1) - 0.5); gy1 -= sz1 * (step(0.0, gy1) - 0.5);
  vec3 g000 = vec3(gx0.x,gy0.x,gz0.x); vec3 g100 = vec3(gx0.y,gy0.y,gz0.y);
  vec3 g010 = vec3(gx0.z,gy0.z,gz0.z); vec3 g110 = vec3(gx0.w,gy0.w,gz0.w);
  vec3 g001 = vec3(gx1.x,gy1.x,gz1.x); vec3 g101 = vec3(gx1.y,gy1.y,gz1.y);
  vec3 g011 = vec3(gx1.z,gy1.z,gz1.z); vec3 g111 = vec3(gx1.w,gy1.w,gz1.w);
  vec4 norm0 = taylorInvSqrt(vec4(dot(g000,g000), dot(g010,g010), dot(g100,g100), dot(g110,g110)));
  g000 *= norm0.x; g010 *= norm0.y; g100 *= norm0.z; g110 *= norm0.w;
  vec4 norm1 = taylorInvSqrt(vec4(dot(g001,g001), dot(g011,g011), dot(g101,g101), dot(g111,g111)));
  g001 *= norm1.x; g011 *= norm1.y; g101 *= norm1.z; g111 *= norm1.w;
  float n000 = dot(g000, Pf0);
  float n100 = dot(g100, vec3(Pf1.x, Pf0.yz));
  float n010 = dot(g010, vec3(Pf0.x, Pf1.y, Pf0.z));
  float n110 = dot(g110, vec3(Pf1.xy, Pf0.z));
  float n001 = dot(g001, vec3(Pf0.xy, Pf1.z));
  float n101 = dot(g101, vec3(Pf1.x, Pf0.y, Pf1.z));
  float n011 = dot(g011, vec3(Pf0.x, Pf1.yz));
  float n111 = dot(g111, Pf1);
  vec3 fade_xyz = fade(Pf0);
  vec4 n_z = mix(vec4(n000,n100,n010,n110), vec4(n001,n101,n011,n111), fade_xyz.z);
  vec2 n_yz = mix(n_z.xy, n_z.zw, fade_xyz.y);
  return 2.2 * mix(n_yz.x, n_yz.y, fade_xyz.x);
}
`;

export const FULL_VERT = `
attribute vec2 aPosition;
varying vec2 vUv;
void main() {
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

export const TRAIL_FRAG = `
precision highp float;
${CNOISE3}
varying vec2 vUv;
uniform vec2 uResolution;
uniform sampler2D uMap;
uniform vec2  uPointer;
uniform float uActive;
uniform float uDt;
uniform float uTime;
uniform float uSize;

void main() {
  vec2 uv = vUv;
  vec2 texel = vec2(1.0) / uResolution;

  vec2 t = texel * (uDt * 16.0);
  float c1 = texture2D(uMap, uv + t).r;
  float c2 = texture2D(uMap, uv - t).r;
  float c3 = texture2D(uMap, uv + t * vec2(-1.0, 1.0)).r;
  float c4 = texture2D(uMap, uv + t * vec2(1.0, -1.0)).r;
  float faded = min(min(c1, c2), min(c3, c4)) * (1.0 - uDt * 0.35);

  float d = distance(uv, uPointer);
  d += cnoise(vec3(uv * 2.0, uTime * 0.6)) * 0.45 * uSize;
  float paint = smoothstep(uSize, uSize * 0.2, d) * uActive;

  float v = max(faded, paint);
  gl_FragColor = vec4(v, 0.0, 0.0, 1.0);
}
`;

export const LEGO_FRAG = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uStyleA;
uniform sampler2D uStyleB;
uniform float uStyleMix;
uniform float uZoomA;
uniform float uZoomB;
uniform sampler2D uReal;
uniform sampler2D uTrail;
uniform vec2  uCover;
uniform vec2  uRealShift;
uniform float uRealZoom;
uniform vec2  uParallax;

vec2 cover(vec2 uv) { return (uv - 0.5) * uCover / 1.12 + 0.5 + uParallax; }

const float REVEAL_GRID = 24.0;

float sdRoundBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
}

float cellVal(vec2 gc) {
  vec2 uv = (gc + 0.5) / REVEAL_GRID;
  return texture2D(uTrail, uv).r;
}

float cellOn(float v) { return step(0.5, v); }

float cellPop(float v) {

  return smoothstep(0.5, 0.62, v) * (1.0 - smoothstep(0.62, 0.82, v));
}

float smin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

void main() {

  float push = uStyleMix * (1.0 - uStyleMix) * 4.0;
  float pz = 1.0 + 0.025 * push;
  vec2 uvA = cover((vUv - 0.5) / (uZoomA * pz) + 0.5);
  vec2 uvB = cover((vUv - 0.5) / (uZoomB * pz) + 0.5);

  vec3 style = mix(texture2D(uStyleA, uvA).rgb, texture2D(uStyleB, uvB).rgb, uStyleMix);

  vec2 realUV = cover((vUv - 0.5) / uRealZoom + 0.5) + uRealShift;
  vec3 realCrisp = texture2D(uReal, realUV).rgb;

  vec2 g = vUv * REVEAL_GRID;
  vec2 base = floor(g);
  float sd = 1e9;
  for (int j = -2; j <= 2; j++) {
    for (int i = -2; i <= 2; i++) {
      vec2 gc = base + vec2(float(i), float(j));
      float v = cellVal(gc);
      if (cellOn(v) > 0.5) {
        vec2 c = gc + 0.5;

        float hs = 0.62 + 0.14 * cellPop(v);
        float d = sdRoundBox(g - c, vec2(hs), 0.3);
        sd = smin(sd, d, 0.16);
      }
    }
  }

  float m = 1.0 - smoothstep(-0.06, 0.06, sd);

  vec3 outc = mix(style, realCrisp, m);

  float e = 0.03;
  float sdx = 1e9, sdy = 1e9;
  for (int j = -2; j <= 2; j++) {
    for (int i = -2; i <= 2; i++) {
      vec2 gc = base + vec2(float(i), float(j));
      float v = cellVal(gc);
      if (cellOn(v) > 0.5) {
        vec2 c = gc + 0.5;
        float hs = 0.62 + 0.14 * cellPop(v);
        sdx = smin(sdx, sdRoundBox(g + vec2(e, 0.0) - c, vec2(hs), 0.3), 0.16);
        sdy = smin(sdy, sdRoundBox(g + vec2(0.0, e) - c, vec2(hs), 0.3), 0.16);
      }
    }
  }
  vec2 nrm = normalize(vec2(sdx - sd, sdy - sd) + 1e-6);
  float lightBias = dot(nrm, normalize(vec2(-1.0, 1.0)));

  float band = smoothstep(0.0, -0.05, sd) * smoothstep(-0.16, -0.05, sd);
  outc *= 1.0 - band * 0.26 * clamp(-lightBias, 0.0, 1.0);
  outc += band * 0.13 * clamp(lightBias, 0.0, 1.0) * m;

  gl_FragColor = vec4(outc, 1.0);
}
`;

```

### lego/engine.ts

```ts
import { FULL_VERT, TRAIL_FRAG, LEGO_FRAG } from "./shaders";
import { mediaUrl } from "../../lib/video-sources";

const REAL_URL = mediaUrl("/lego/real.webp");

type Style = {
  url: string;
  bg: [number, number, number];
  glow: [number, number, number];
  zoom?: number;
};
const STYLES: Style[] = [

  { url: mediaUrl("/lego/lego.webp"), bg: [253, 246, 216], glow: [255, 222, 80], zoom: 1.12 },

  { url: mediaUrl("/lego/minecraft.webp"), bg: [231, 244, 224], glow: [126, 211, 90] },

  { url: mediaUrl("/lego/roblox.webp"), bg: [240, 238, 240], glow: [226, 78, 78] },
];
const STYLE_HOLD = 2.8;
const STYLE_FADE = 0.28;

export type LegoFrameState = {
  tiltX: number;
  tiltY: number;
  glowX: number;
  glowY: number;
  glowI: number;
  bg: string;
  glowColor: string;
};

const TRAIL_RES = 220;
const TRAIL_SIZE = 0.13;
const TRAIL_SIZE_AUTO = 0.2;

const REAL_ZOOM = 1.12;

const REAL_SHIFT: [number, number] = [-0.01, 0.05];

export class LegoReveal {
  private host: HTMLElement;
  private canvas: HTMLCanvasElement;
  private gl: WebGLRenderingContext | null = null;
  private display: WebGLProgram | null = null;
  private trail: WebGLProgram | null = null;
  private dLoc: Record<string, WebGLUniformLocation | null> = {};
  private tLoc: Record<string, WebGLUniformLocation | null> = {};
  private quad: WebGLBuffer | null = null;

  private styleTex: (WebGLTexture | null)[] = STYLES.map(() => null);
  private realTex: WebGLTexture | null = null;
  private blackTex: WebGLTexture | null = null;
  private styleAR = 1;

  private styleIdx = 0;
  private styleClock = 0;
  private styleMix = 0;

  private rtA: { fb: WebGLFramebuffer; tex: WebGLTexture } | null = null;
  private rtB: { fb: WebGLFramebuffer; tex: WebGLTexture } | null = null;
  private hasTrail = false;

  private raf = 0;
  private running = false;
  private visible = false;
  private painted = false;
  private destroyed = false;
  private last = 0;
  private time = 0;
  private idle = 3;

  private w = 0;
  private h = 0;
  private dpr = 1;

  private px = 0.5;
  private py = 0.5;
  private tpx = 0.5;
  private tpy = 0.5;
  private active = 0;

  private autoActive = 0;
  private revealSize = TRAIL_SIZE;

  private parx = 0;
  private pary = 0;

  private tiltX = 0;
  private tiltY = 0;
  private glowX = 0.5;
  private glowY = 0.5;
  private glowI = 0;
  private onFrame?: (s: LegoFrameState) => void;

  onReady?: () => void;

  ok = false;

  constructor(host: HTMLElement, onFrame?: (s: LegoFrameState) => void) {
    this.host = host;
    this.onFrame = onFrame;
    this.canvas = document.createElement("canvas");
    Object.assign(this.canvas.style, {
      position: "absolute",
      inset: "0",
      width: "100%",
      height: "100%",
      display: "block",
      opacity: "0",
    });
    host.appendChild(this.canvas);

    const gl = this.canvas.getContext("webgl", {
      alpha: false,
      antialias: false,
      premultipliedAlpha: false,
    });
    if (!gl) return;
    this.gl = gl;
    gl.clearColor(0.06, 0.06, 0.07, 1);

    try {
      this.display = this.build(FULL_VERT, LEGO_FRAG);
      this.trail = this.build(FULL_VERT, TRAIL_FRAG);
    } catch {
      this.gl = null;
      return;
    }

    for (const u of ["uStyleA", "uStyleB", "uStyleMix", "uZoomA", "uZoomB", "uReal", "uTrail", "uCover", "uRealShift", "uRealZoom", "uParallax"]) {
      this.dLoc[u] = gl.getUniformLocation(this.display, u);
    }
    for (const u of ["uResolution", "uMap", "uPointer", "uActive", "uDt", "uTime", "uSize"]) {
      this.tLoc[u] = gl.getUniformLocation(this.trail, u);
    }

    const aPosD = gl.getAttribLocation(this.display, "aPosition");
    this.quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);

    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(aPosD);
    gl.vertexAttribPointer(aPosD, 2, gl.FLOAT, false, 0, 0);

    this.setupTrail();

    const ph = this.placeholder([40, 40, 45, 255]);
    this.styleTex = STYLES.map(() => ph);
    this.realTex = ph;
    this.blackTex = this.placeholder([0, 0, 0, 255]);

    this.loadTexture(STYLES[0].url, (t, ar) => {
      this.styleTex[0] = t;
      this.styleAR = ar;
      this.onReady?.();
      this.onReady = undefined;
      if (!this.running) this.renderOnce();
    });
    for (let i = 1; i < STYLES.length; i++) {
      const idx = i;
      this.loadTexture(STYLES[idx].url, (t) => {
        this.styleTex[idx] = t;
      });
    }
    this.loadTexture(REAL_URL, (t) => {
      this.realTex = t;
      if (!this.running) this.renderOnce();
    });

    this.canvas.addEventListener("pointermove", this.onMove);
    this.canvas.addEventListener("pointerenter", this.onEnter);
    this.canvas.addEventListener("pointerleave", this.onLeave);

    this.resize();
    this.ok = true;
  }

  private build(vs: string, fs: string): WebGLProgram {
    const gl = this.gl!;
    const c = (type: number, src: string) => {
      const sh = gl.createShader(type)!;
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        throw new Error(gl.getShaderInfoLog(sh) || "compile failed");
      }
      return sh;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, c(gl.VERTEX_SHADER, vs));
    gl.attachShader(prog, c(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(prog) || "link failed");
    }
    return prog;
  }

  private placeholder(rgba: number[]): WebGLTexture | null {
    const gl = this.gl;
    if (!gl) return null;
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(rgba));
    return t;
  }

  private setupTrail() {
    const gl = this.gl!;
    const ext = gl.getExtension("OES_texture_half_float");
    gl.getExtension("OES_texture_half_float_linear");
    const type = ext ? ext.HALF_FLOAT_OES : gl.UNSIGNED_BYTE;
    const make = () => {
      const tex = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, TRAIL_RES, TRAIL_RES, 0, gl.RGBA, type, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      const fb = gl.createFramebuffer()!;
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      return ok ? { fb, tex } : null;
    };
    const a = make();
    const b = make();
    if (a && b) {
      this.rtA = a;
      this.rtB = b;
      this.hasTrail = true;

      for (const rt of [a, b]) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, rt.fb);
        gl.viewport(0, 0, TRAIL_RES, TRAIL_RES);
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.clearColor(0.06, 0.06, 0.07, 1);
    }
  }

  private loadTexture(url: string, done: (t: WebGLTexture, ar: number) => void) {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const gl = this.gl;
      if (!gl || this.destroyed) return;
      const tex = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      done(tex, (img.naturalWidth || 1) / (img.naturalHeight || 1));
    };
    img.src = url;
  }

  private onMove = (e: PointerEvent) => {
    const r = this.canvas.getBoundingClientRect();
    this.tpx = (e.clientX - r.left) / r.width;
    this.tpy = 1 - (e.clientY - r.top) / r.height;
    this.active = 1;
    this.wake();
  };
  private onEnter = () => {
    this.active = 1;
    this.wake();
  };
  private onLeave = () => {
    this.active = 0;
  };

  private wake() {
    if (this.visible && !this.running) this.startLoop();
  }

  resize() {
    const r = this.host.getBoundingClientRect();
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.w = r.width;
    this.h = r.height;
    const cw = Math.max(1, Math.round(this.w * this.dpr));
    const ch = Math.max(1, Math.round(this.h * this.dpr));
    if (this.canvas.width !== cw || this.canvas.height !== ch) {
      this.canvas.width = cw;
      this.canvas.height = ch;
      this.gl?.viewport(0, 0, cw, ch);
      if (!this.running) this.renderOnce();
    }
  }

  private coverScale(imgAR: number): [number, number] {
    const cardAR = this.w / Math.max(1, this.h);
    if (cardAR > imgAR) return [1, imgAR / cardAR];
    return [cardAR / imgAR, 1];
  }

  setVisible(v: boolean) {
    if (!this.ok) return;
    this.visible = v;
    if (v) {
      this.resize();
      this.startLoop();
    } else {
      this.pause();
    }
  }

  private startLoop() {
    if (!this.ok || this.running) return;
    this.running = true;
    this.resize();
    this.last = 0;
    const loop = (now: number) => {
      if (!this.running) return;
      this.frame(now);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  private pause() {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  renderStill() {
    this.resize();
    this.renderDisplay();
  }

  private renderOnce() {
    if (this.running) return;
    requestAnimationFrame(() => this.renderDisplay());
  }

  private frame(now: number) {
    const dt = this.last ? Math.min(0.05, (now - this.last) / 1000) : 0.016;
    this.last = now;
    this.time += dt;
    this.idle = this.active ? 0 : this.idle + dt;

    this.styleClock += dt;
    if (this.styleClock < STYLE_HOLD) {
      this.styleMix = 0;
    } else if (this.styleClock < STYLE_HOLD + STYLE_FADE) {

      const t = (this.styleClock - STYLE_HOLD) / STYLE_FADE;
      this.styleMix = t * t * t * (t * (t * 6 - 15) + 10);
    } else {

      this.styleIdx = (this.styleIdx + 1) % STYLES.length;
      this.styleClock = 0;
      this.styleMix = 0;
    }

    const auto = Math.min(1, Math.max(0, this.idle - 0.4) / 0.9);
    const T = this.time;

    const FX = 0.5;
    const FY = 0.66;
    const ax =
      FX +
      0.16 * Math.sin(T * 1.15) +
      0.09 * Math.sin(T * 2.6 + 1.0) +
      0.05 * Math.cos(T * 4.1 + 0.4);
    const ay =
      FY +
      0.13 * Math.cos(T * 0.95 + 2.1) +
      0.07 * Math.sin(T * 2.2 + 0.5) +
      0.04 * Math.cos(T * 3.7 + 1.7);

    const cx = this.active ? this.tpx : this.tpx * (1 - auto) + ax * auto;
    const cy = this.active ? this.tpy : this.tpy * (1 - auto) + ay * auto;

    const rev = Math.max(this.active, auto);

    this.revealSize = TRAIL_SIZE + (TRAIL_SIZE_AUTO - TRAIL_SIZE) * (auto * (1 - this.active));

    this.px += (cx - this.px) * 0.4;
    this.py += (cy - this.py) * 0.4;
    this.autoActive = rev;

    const P = 0.02 + (0.07 - 0.02) * (auto * (1 - this.active));
    const targX = -(this.px - 0.5) * 2.0 * P * Math.max(rev, this.active);
    const targY = (this.py - 0.5) * 2.0 * P * Math.max(rev, this.active);
    this.parx += (targX - this.parx) * 0.045;
    this.pary += (targY - this.pary) * 0.045;

    const MAXDEG = 7.0 + 5.0 * (auto * (1 - this.active));
    const targRY = (this.px - 0.5) * 2.0 * MAXDEG;
    const targRX = (this.py - 0.5) * 2.0 * MAXDEG;
    this.tiltY += (targRY - this.tiltY) * 0.06;
    this.tiltX += (targRX - this.tiltX) * 0.06;

    const gTargX = this.px;
    const gTargY = 1.0 - this.py;
    this.glowX += (gTargX - this.glowX) * 0.08;
    this.glowY += (gTargY - this.glowY) * 0.08;

    const gTargI = 0.28 + 0.72 * rev + 0.4 * this.active;
    this.glowI += (gTargI - this.glowI) * 0.09;

    const cur = STYLES[this.styleIdx];
    const nxt = STYLES[(this.styleIdx + 1) % STYLES.length];
    const rgb = (a: [number, number, number], b: [number, number, number]) => {
      const m = this.styleMix;
      const r = Math.round(a[0] + (b[0] - a[0]) * m);
      const g = Math.round(a[1] + (b[1] - a[1]) * m);
      const bl = Math.round(a[2] + (b[2] - a[2]) * m);
      return `rgb(${r}, ${g}, ${bl})`;
    };

    this.onFrame?.({
      tiltX: this.tiltX,
      tiltY: this.tiltY,
      glowX: this.glowX,
      glowY: this.glowY,
      glowI: this.glowI,
      bg: rgb(cur.bg, nxt.bg),
      glowColor: rgb(cur.glow, nxt.glow),
    });

    if (this.hasTrail) this.stepTrail(dt);
    this.renderDisplay();

  }

  private stepTrail(dt: number) {
    const gl = this.gl!;
    if (!this.rtA || !this.rtB) return;
    gl.useProgram(this.trail);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.rtB.fb);
    gl.viewport(0, 0, TRAIL_RES, TRAIL_RES);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.rtA.tex);
    gl.uniform1i(this.tLoc.uMap, 0);
    gl.uniform2f(this.tLoc.uResolution, TRAIL_RES, TRAIL_RES);
    gl.uniform2f(this.tLoc.uPointer, this.px, this.py);
    gl.uniform1f(this.tLoc.uActive, this.autoActive);
    gl.uniform1f(this.tLoc.uDt, dt);
    gl.uniform1f(this.tLoc.uTime, this.time);
    gl.uniform1f(this.tLoc.uSize, this.revealSize);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    const t = this.rtA;
    this.rtA = this.rtB;
    this.rtB = t;
  }

  private renderDisplay() {
    const gl = this.gl;
    if (!gl || !this.display) return;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.useProgram(this.display);

    const texA = this.styleTex[this.styleIdx] ?? this.blackTex;
    const texB = this.styleTex[(this.styleIdx + 1) % STYLES.length] ?? texA;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texA);
    gl.uniform1i(this.dLoc.uStyleA, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, texB);
    gl.uniform1i(this.dLoc.uStyleB, 1);
    gl.uniform1f(this.dLoc.uStyleMix, this.styleMix);
    gl.uniform1f(this.dLoc.uZoomA, STYLES[this.styleIdx].zoom ?? 1);
    gl.uniform1f(this.dLoc.uZoomB, STYLES[(this.styleIdx + 1) % STYLES.length].zoom ?? 1);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this.realTex);
    gl.uniform1i(this.dLoc.uReal, 2);
    gl.activeTexture(gl.TEXTURE3);
    gl.bindTexture(gl.TEXTURE_2D, this.hasTrail && this.rtA ? this.rtA.tex : this.blackTex);
    gl.uniform1i(this.dLoc.uTrail, 3);
    const [cx, cy] = this.coverScale(this.styleAR);
    gl.uniform2f(this.dLoc.uCover, cx, cy);
    gl.uniform2f(this.dLoc.uRealShift, REAL_SHIFT[0], REAL_SHIFT[1]);
    gl.uniform1f(this.dLoc.uRealZoom, REAL_ZOOM);
    gl.uniform2f(this.dLoc.uParallax, this.parx, this.pary);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    if (!this.painted) {
      this.painted = true;
      this.canvas.style.opacity = "1";
    }
  }

  destroy() {
    this.destroyed = true;
    this.visible = false;
    this.pause();
    this.canvas.removeEventListener("pointermove", this.onMove);
    this.canvas.removeEventListener("pointerenter", this.onEnter);
    this.canvas.removeEventListener("pointerleave", this.onLeave);
    const gl = this.gl;
    if (gl) {
      const uniq = new Set<WebGLTexture>();
      [...this.styleTex, this.realTex, this.blackTex, this.rtA?.tex ?? null, this.rtB?.tex ?? null].forEach(
        (t) => t && uniq.add(t),
      );
      uniq.forEach((t) => gl.deleteTexture(t));
      [this.rtA?.fb, this.rtB?.fb].forEach((f) => f && gl.deleteFramebuffer(f));
      if (this.quad) gl.deleteBuffer(this.quad);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    }
    this.canvas.remove();
  }
}

```


15. Build this: a display-only card with two small Kyoto-serif text blocks in OPPOSITE CORNERS (top-left + bottom-right) that MATERIALIZE THROUGH A WEBGL MASK REVEAL — the same cloudy fbm dissolve + localized un-blur the blur-reveal card uses. The two corner blocks are drawn to one offscreen 2D-canvas texture (warm-gray monochrome ink on a putty plate) and uploaded to a fragment shader. Reveal: a purely 2D fractal noise field (domain-warped fbm, no column wipe) with a soft radial bias sweeps a feathered front across the plane so the text dissolves in as wispy tendrils blooming from center; where the front is passing, the texture is sampled with a multi-tap ring blur whose radius decays to zero behind it, so each part un-blurs into focus as it is uncovered, plus a subtle drift+grow so emerging text settles into place. A per-cycle seed offsets the noise so no two reveals dissolve the same. Progress is driven by a critically-damped SPRING toward a target (1 in/hold, 0 out; the exit spring is stiffer, so it clears quicker than it arrives); phase machine reveal -> hold -> clear -> swap-next-pair -> repeat, rotating a small pool of phrase pairs so different words appear each cycle. The whole plate leans subtly toward the cursor via one SHARED texture-space parallax offset (not per-letter), eased, pointer-only (rests still with no cursor). Framework-free WebGL1 + a rAF loop; DPR-capped, pauses offscreen / when hidden; reduced-motion renders one static resolved frame; falls back gracefully if WebGL is absent.

The complete, self-contained implementation follows, one file per block. It is framework-agnostic core logic — wire it into your own component and mount it on an element.

### text-reveal/reveal-gl.ts

```ts
const VERT =  `
  attribute vec2 aPosition;
  attribute vec2 aUV;
  varying vec2 vUV;
  void main(){
    vUV = aUV;
    gl_Position = vec4(aPosition, 0.0, 1.0);
  }
`;

const FRAG =  `
  precision highp float;
  uniform sampler2D uTex;
  uniform vec2  uTexel;
  uniform float uProgress;
  uniform float uMaxBlur;
  uniform vec3  uEdge;
  uniform float uTime;
  uniform float uAspect;
  uniform float uSeed;
  uniform vec2  uParTL;
  uniform vec2  uParBR;
  uniform vec2  uCursor;
  uniform float uHover;
  uniform float uReverse;
  varying vec2 vUV;

  float hash(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
  float noise(vec2 p){
    vec2 i = floor(p), f = fract(p);
    f = f*f*(3.0-2.0*f);
    float a = hash(i), b = hash(i+vec2(1,0)), c = hash(i+vec2(0,1)), d = hash(i+vec2(1,1));
    return mix(mix(a,b,f.x), mix(c,d,f.x), f.y);
  }

  vec4 blurTex(vec2 uv, float radius){
    if (radius < 0.35) return texture2D(uTex, uv);
    vec2 r1 = uTexel * radius;
    vec2 r2 = uTexel * radius * 2.0;
    vec4 sum = texture2D(uTex, uv) * 1.0;
    float wsum = 1.0;
    for (int i = 0; i < 8; i++){
      float a = float(i) * 0.785398;
      vec2 dir = vec2(cos(a), sin(a));
      sum += texture2D(uTex, uv + dir * r1) * 0.75; wsum += 0.75;
      sum += texture2D(uTex, uv + dir * r2) * 0.5;  wsum += 0.5;
    }
    return sum / wsum;
  }

  float fbm(vec2 p){
    float v = 0.0, amp = 0.5;
    for (int i = 0; i < 4; i++){
      v += amp * noise(p);
      p *= 2.03;
      amp *= 0.5;
    }
    return v;
  }

  void main(){

    float region = smoothstep(0.35, 0.65, (vUV.x + vUV.y) * 0.5);
    vec2 par = mix(uParTL, uParBR, region);
    vec2 baseUV = vUV + par;

    if (uProgress >= 0.999) { gl_FragColor = texture2D(uTex, baseUV); return; }

    float p = uProgress * 1.3;

    vec2 sd = vec2(uSeed * 1.7, uSeed * -1.3);
    vec2 rc = (vUV - 0.5) * vec2(uAspect, 1.0);

    float diag = (vUV.x + vUV.y) * 0.5;
    diag = smoothstep(0.18, 0.82, diag);

    diag = mix(diag, 1.0 - diag, uReverse);
    diag += (fbm(vUV * 1.3 + sd) - 0.5) * 0.08;

    vec2 warp = vec2(fbm(vUV * 3.2 + sd + uTime * 0.05 + 11.0),
                     fbm(vUV * 3.2 - sd - uTime * 0.04 - 7.0)) - 0.5;
    float turb = fbm(vUV * 5.5 + warp * 1.7 + sd + uTime * 0.06);

    float stipple = noise(vUV * vec2(uAspect, 1.0) * 46.0 + sd * 3.0);

    float mask = mix(diag, turb, 0.28);
    mask = mix(mask, stipple, 0.14);

    vec2 cur = (vUV - uCursor) * vec2(uAspect, 1.0);
    float near = 1.0 - smoothstep(0.0, 0.32, length(cur));
    mask -= near * uHover * 0.28;

    float reveal = smoothstep(p + 0.22, p - 0.22, mask);
    if (reveal <= 0.0) discard;

    float blurAmt = smoothstep(p - 0.34, p + 0.22, mask);

    vec2 drift = (-rc * 0.010 + vec2(0.0, 0.006)) * blurAmt;
    float grow = 1.0 + 0.03 * blurAmt;
    vec2 suv = (baseUV - 0.5) / grow + 0.5 + drift;

    float radius = blurAmt * uMaxBlur;
    vec4 tex = blurTex(suv, radius);

    float fw = 0.30;
    float flare = smoothstep(p - fw, p, mask) * smoothstep(p + fw, p, mask);
    flare *= 1.0 - smoothstep(0.8, 1.0, uProgress);

    float ab = flare * 2.0 * uTexel.x * uMaxBlur;
    if (ab > 0.0001) {
      tex.r = blurTex(suv + vec2(ab, 0.0), radius).r;
      tex.b = blurTex(suv - vec2(ab, 0.0), radius).b;
    }

    vec4 wide = blurTex(suv, uMaxBlur * 1.3);
    float halo = wide.a;

    vec3 rgb = tex.rgb;
    vec3 glow = mix(uEdge, vec3(1.0), 0.3);
    rgb += glow * flare * (tex.a * 0.6 + halo * 0.5);
    float alpha = max(tex.a * reveal, halo * flare * 0.5);

    gl_FragColor = vec4(rgb, alpha);
  }
`;

export class RevealGL {
  readonly canvas: HTMLCanvasElement;
  private gl: WebGLRenderingContext;
  private prog: WebGLProgram;
  private quad: WebGLBuffer;
  private loc: Record<string, WebGLUniformLocation | null> = {};
  private aPos = 0;
  private aUV = 0;
  private tex: WebGLTexture | null = null;
  private texW = 1;
  private texH = 1;
  private ok = false;

  constructor() {
    this.canvas = document.createElement("canvas");
    Object.assign(this.canvas.style, {
      position: "absolute",
      inset: "0",
      width: "100%",
      height: "100%",
      display: "block",
    });
    const gl = this.canvas.getContext("webgl", { alpha: true, premultipliedAlpha: false });
    if (!gl) {
      this.gl = null as unknown as WebGLRenderingContext;
      this.prog = null as unknown as WebGLProgram;
      this.quad = null as unknown as WebGLBuffer;
      return;
    }
    this.gl = gl;
    this.prog = this.build(VERT, FRAG);
    this.aPos = gl.getAttribLocation(this.prog, "aPosition");
    this.aUV = gl.getAttribLocation(this.prog, "aUV");
    for (const u of [
      "uTex", "uTexel", "uProgress", "uMaxBlur", "uEdge", "uTime", "uAspect", "uSeed",
      "uParTL", "uParBR", "uCursor", "uHover", "uReverse",
    ]) {
      this.loc[u] = gl.getUniformLocation(this.prog, u);
    }
    const data = new Float32Array([
      -1, -1, 0, 1,
       1, -1, 1, 1,
      -1,  1, 0, 0,
       1,  1, 1, 0,
    ]);
    this.quad = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    this.ok = true;
  }

  get available() {
    return this.ok;
  }

  private build(vs: string, fs: string): WebGLProgram {
    const gl = this.gl;
    const c = (type: number, src: string) => {
      const sh = gl.createShader(type)!;
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        throw new Error(gl.getShaderInfoLog(sh) || "shader compile failed");
      }
      return sh;
    };
    const p = gl.createProgram()!;
    gl.attachShader(p, c(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, c(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(p) || "program link failed");
    }
    return p;
  }

  setTexture(art: HTMLCanvasElement) {
    if (!this.ok) return;
    const gl = this.gl;
    if (this.tex) gl.deleteTexture(this.tex);
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, art);
    this.tex = tex;
    this.texW = art.width;
    this.texH = art.height;
  }

  resize(w: number, h: number, dpr: number) {
    this.canvas.width = Math.max(1, Math.round(w * dpr));
    this.canvas.height = Math.max(1, Math.round(h * dpr));
    if (this.ok) this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }

  draw(
    progress: number,
    maxBlur: number,
    edge: [number, number, number],
    time: number,
    aspect: number,
    seed: number,
    parTL: [number, number],
    parBR: [number, number],
    cursor: [number, number],
    hover: number,
    reverse: number,
  ) {
    if (!this.ok || !this.tex) return;
    const gl = this.gl;
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    gl.enableVertexAttribArray(this.aPos);
    gl.vertexAttribPointer(this.aPos, 2, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(this.aUV);
    gl.vertexAttribPointer(this.aUV, 2, gl.FLOAT, false, 16, 8);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.uniform1i(this.loc.uTex, 0);
    gl.uniform2f(this.loc.uTexel, 1 / this.texW, 1 / this.texH);
    gl.uniform1f(this.loc.uProgress, progress);
    gl.uniform1f(this.loc.uMaxBlur, maxBlur);
    gl.uniform3f(this.loc.uEdge, edge[0], edge[1], edge[2]);
    gl.uniform1f(this.loc.uTime, time);
    gl.uniform1f(this.loc.uAspect, aspect);
    gl.uniform1f(this.loc.uSeed, seed);
    gl.uniform2f(this.loc.uParTL, parTL[0], parTL[1]);
    gl.uniform2f(this.loc.uParBR, parBR[0], parBR[1]);
    gl.uniform2f(this.loc.uCursor, cursor[0], cursor[1]);
    gl.uniform1f(this.loc.uHover, hover);
    gl.uniform1f(this.loc.uReverse, reverse);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  destroy() {
    if (!this.ok) return;
    const gl = this.gl;
    if (this.tex) gl.deleteTexture(this.tex);
    gl.getExtension("WEBGL_lose_context")?.loseContext();
  }
}

export interface CornerText {
  top: string[];
  bottom: string[];
  font: string;
  fill: string;
  cardW: number;
  cardH: number;
  dpr?: number;
}

export function renderCornerText(o: CornerText): HTMLCanvasElement {
  const dpr = o.dpr ?? Math.min(window.devicePixelRatio || 1, 2);
  const cssW = Math.max(1, Math.round(o.cardW));
  const cssH = Math.max(1, Math.round(o.cardH));

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  const ctx = canvas.getContext("2d")!;
  ctx.scale(dpr, dpr);
  ctx.fillStyle = o.fill;
  ctx.textBaseline = "top";

  const pad = Math.round(cssW * 0.035);

  const maxLineW = cssW * 0.52;
  const allLines = [...o.top, ...o.bottom];
  let fontSize = Math.max(24, Math.min(40, cssW * 0.03));
  for (let i = 0; i < 24; i++) {
    ctx.font = `500 ${fontSize}px ${o.font}`;
    const widest = Math.max(...allLines.map((l) => ctx.measureText(l).width));
    if (widest <= maxLineW || fontSize <= 15) break;
    fontSize -= 1;
  }
  const lineH = fontSize * 1.42;
  ctx.font = `500 ${fontSize}px ${o.font}`;

  ctx.textAlign = "left";
  o.top.forEach((line, i) => {
    ctx.fillText(line, pad, pad + i * lineH);
  });

  ctx.textAlign = "right";
  const bottomBlockH = o.bottom.length * lineH;
  const startY = cssH - pad - bottomBlockH;
  o.bottom.forEach((line, i) => {
    ctx.fillText(line, cssW - pad, startY + i * lineH);
  });

  return canvas;
}

```

### text-reveal/TextRevealCard.tsx

```ts
"use client";

import { useEffect, useRef } from "react";
import { RevealGL, renderCornerText } from "./reveal-gl";

const TEXT_PAIRS: { top: string[]; bottom: string[] }[] = [
  {
    top: ["The text fades in on its own,", "one corner at a time."],
    bottom: ["Then it clears the same way,", "and quietly starts over."],
  },
  {
    top: ["Type can move like weather,", "rolling in from an edge."],
    bottom: ["It gathers, holds for a beat,", "then rolls back out again."],
  },
  {
    top: ["Small things, done really well,", "read as calm, not loud."],
    bottom: ["Motion with a clear direction", "always feels intentional."],
  },
];

const BG = "#fdfdfb";
const INK = "#242320";
const EDGE = "#f2f1ec";

const WHITE_WASH = [
  "radial-gradient(55% 75% at 18% 12%, rgba(255,255,255,0.95), transparent 60%)",
  "radial-gradient(48% 66% at 82% 22%, rgba(255,255,255,0.80), transparent 62%)",
  "radial-gradient(65% 55% at 50% 0%,  rgba(255,255,255,0.70), transparent 55%)",
  "radial-gradient(42% 52% at 8% 85%,  rgba(255,255,255,0.75), transparent 60%)",
  "radial-gradient(52% 60% at 92% 88%, rgba(255,255,255,0.65), transparent 62%)",
  "radial-gradient(38% 38% at 65% 55%, rgba(255,255,255,0.55), transparent 70%)",
  "radial-gradient(85% 46% at 50% 100%,rgba(255,255,255,0.55), transparent 55%)",
  "radial-gradient(28% 28% at 30% 45%, rgba(255,255,255,0.45), transparent 72%)",
].join(", ");

const GRAIN_SVG =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http:`,
  );

const HOLD_MS = 320;
const OUT_HOLD_MS = 80;
const MAX_BLUR = 16;
const K_IN = 16;
const K_OUT = 22;
const DAMP = 1.12;

const REVEALED_AT = 0.95;
const GONE_AT = 0.02;
const PARALLAX_AMP = 0.006;

const TL_ANCHOR: [number, number] = [0.16, 0.18];
const BR_ANCHOR: [number, number] = [0.84, 0.82];

function hexToRgb(hex: string): [number, number, number] {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function resolveFamily(cssFamily: string): string {
  const probe = document.createElement("span");
  probe.style.cssText = "position:absolute;visibility:hidden";
  probe.style.fontFamily = cssFamily;
  probe.textContent = "Ag";
  document.body.appendChild(probe);
  const fam = getComputedStyle(probe).fontFamily || "serif";
  document.body.removeChild(probe);
  return fam;
}

function springStep(pos: number, vel: number, target: number, k: number, damp: number, dt: number): [number, number] {
  const c = 2 * Math.sqrt(k) * damp;
  const accel = -k * (pos - target) - c * vel;
  const v = vel + accel * dt;
  return [pos + v * dt, v];
}

export function TextRevealCard({ bare = false }: { bare?: boolean } = {}) {
  void bare;
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let W = host.clientWidth || 1;
    let H = host.clientHeight || 1;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let fontFamily = resolveFamily("var(--font-kyoto), Georgia, serif");
    const edge = hexToRgb(EDGE);

    const gl = new RevealGL();
    const useGL = gl.available;
    if (useGL) {
      gl.resize(W, H, dpr);
      host.appendChild(gl.canvas);
    }

    let index = 0;
    let seed = 1.7;

    const mount = () => {
      if (!useGL) return;
      const pair = TEXT_PAIRS[index];
      const art = renderCornerText({
        top: pair.top,
        bottom: pair.bottom,
        font: fontFamily,
        fill: INK,
        cardW: W,
        cardH: H,
        dpr,
      });
      gl.setTexture(art);
    };
    mount();

    let pTgtX = 0.5, pTgtY = 0.5;
    let pCurX = 0.5, pCurY = 0.5;
    let cursorUV: [number, number] = [-1, -1];
    let hoverTgt = 0, hoverCur = 0;
    const onMove = (e: PointerEvent) => {
      const b = host.getBoundingClientRect();
      const ux = (e.clientX - b.left) / b.width;
      const uy = (e.clientY - b.top) / b.height;
      pTgtX = ux; pTgtY = uy;
      cursorUV = [ux, uy];
      hoverTgt = 1;
    };
    const onLeave = () => { pTgtX = 0.5; pTgtY = 0.5; hoverTgt = 0; };
    host.addEventListener("pointermove", onMove);
    host.addEventListener("pointerleave", onLeave);

    let phase: "in" | "hold" | "out" = "in";
    let phaseStart = 0;
    let progress = 0;
    let vel = 0;
    let target = 1;
    let clock = 0;
    let last = 0;
    let raf = 0;
    let running = false;
    let held = 0;

    const loop = () => {
      if (!running) return;
      const now = performance.now();
      const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
      last = now;
      clock += dt;

      const k = target > 0.5 ? K_IN : K_OUT;
      [progress, vel] = springStep(progress, vel, target, k, DAMP, dt);

      if (phase === "in") {
        if (progress >= REVEALED_AT) { phase = "hold"; phaseStart = now; }
      } else if (phase === "hold") {
        if (now - phaseStart >= HOLD_MS) { phase = "out"; phaseStart = now; target = 0; }
      } else {
        if (progress <= GONE_AT && now - phaseStart >= OUT_HOLD_MS) {
          index = (index + 1) % TEXT_PAIRS.length;
          seed = ((seed * 1.618) % 7) + 0.3;
          mount();
          phase = "in"; phaseStart = now; progress = 0; vel = 0; target = 1;
        }
      }

      const pk = 1 - Math.pow(0.0009, dt);
      pCurX += (pTgtX - pCurX) * pk;
      pCurY += (pTgtY - pCurY) * pk;
      hoverCur += (hoverTgt - hoverCur) * (1 - Math.pow(0.002, dt));

      const amp = PARALLAX_AMP * hoverCur;
      const parTL: [number, number] = [
        (pCurX - TL_ANCHOR[0]) * amp,
        (pCurY - TL_ANCHOR[1]) * amp,
      ];
      const parBR: [number, number] = [
        (pCurX - BR_ANCHOR[0]) * amp,
        (pCurY - BR_ANCHOR[1]) * amp,
      ];

      const p = Math.max(0, Math.min(1, progress));

      const reverse = phase === "out" ? 1 : 0;
      if (useGL) gl.draw(p, MAX_BLUR, edge, clock, W / Math.max(1, H), seed, parTL, parBR, cursorUV, hoverCur, reverse);

      if (useGL) {
        held += ((phase === "hold" ? 1 : 0) - held) * (1 - Math.pow(0.02, dt));
        const breathe = Math.sin(clock * 0.45) * 0.5 + 0.5;
        const s = 1 + held * breathe * 0.0015;
        const b = 1 + held * (breathe - 0.5) * 0.012;
        gl.canvas.style.transform = `scale(${s.toFixed(4)})`;
        gl.canvas.style.filter = `brightness(${b.toFixed(3)})`;
      }

      raf = requestAnimationFrame(loop);
    };

    const start = () => {
      if (running) return;
      running = true;
      phase = "in"; phaseStart = performance.now(); last = phaseStart;
      progress = 0; vel = 0; target = 1;
      raf = requestAnimationFrame(loop);
    };
    const stop = () => {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      last = 0;
    };

    const renderStill = () => {
      if (useGL) gl.draw(1, 0, edge, 0, W / Math.max(1, H), seed, [0, 0], [0, 0], [-1, -1], 0, 0);
    };

    let onScreen = false;
    let hidden = false;
    const sync = () => {
      if (reduced) return;
      if (onScreen && !hidden) start();
      else stop();
    };

    const io = new IntersectionObserver(
      (es) => { onScreen = es[0]?.isIntersecting ?? false; sync(); },
      { threshold: 0.15 },
    );
    io.observe(host);

    const onVis = () => { hidden = document.hidden; sync(); };
    document.addEventListener("visibilitychange", onVis);

    let resizeT = 0;
    const ro = new ResizeObserver(() => {
      window.clearTimeout(resizeT);
      resizeT = window.setTimeout(() => {
        W = host.clientWidth || 1;
        H = host.clientHeight || 1;
        if (W < 2 || H < 2) return;
        gl.resize(W, H, dpr);
        mount();
      }, 120);
    });
    ro.observe(host);

    if (document.fonts?.load) {
      document.fonts.load(`500 1em "${fontFamily}"`).then(() => {
        fontFamily = resolveFamily("var(--font-kyoto), Georgia, serif");
        mount();
      }, () => {});
    }

    if (reduced) renderStill();

    return () => {
      stop();
      io.disconnect();
      ro.disconnect();
      window.clearTimeout(resizeT);
      document.removeEventListener("visibilitychange", onVis);
      host.removeEventListener("pointermove", onMove);
      host.removeEventListener("pointerleave", onLeave);
      gl.destroy();
    };
  }, []);

  return (
    <div
      ref={hostRef}
      data-canvas-card
      aria-label="Two small text blocks in opposite corners that materialize through a soft cloudy mask, then clear and repeat with new words."
      className="relative mx-auto aspect-[1344/620] w-full select-none overflow-hidden rounded-[12px] border"
      style={{ backgroundColor: BG, borderColor: EDGE }}
      aria-hidden
    >
      {}
      <div
        className="textreveal-wash pointer-events-none absolute"
        style={{ inset: "-8%", backgroundImage: WHITE_WASH }}
      />
      {}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: `url("${GRAIN_SVG}")`,
          backgroundSize: "140px 140px",
          opacity: 0.05,
          mixBlendMode: "multiply",
        }}
      />
    </div>
  );
}

```


16. Build this: a crisp word sitting in a soft gradient-mapped GLOW on light paper — the 'blur glow' text look done live in WebGL (no assets). Rasterize the word to a white silhouette mask at a LOCKED cap-height (fit by height so every cycled word is the same size). Build the halo with a real MULTI-PASS GAUSSIAN BLOOM: blur + downsample the mask into ~4 progressively smaller framebuffers, each a separable H-then-V 9-tap Gaussian (small buffers = a huge smooth halo, no ring banding). Give the blur a VARIABLE FOCUS: keep the middle of the word sharp and blur harder toward both ends (a depth-of-field), driven by the word's measured x-extent. In the composite pass, sum the blur levels with falling weights into one grayscale glow field, apply a gamma so the coloured band hugs the letters, then GRADIENT-MAP its luminance (inverted: paper→light end, cores→dark end) through a 5-stop ramp. Draw the sharp word on top in the palette's INK colour (not plain black), letting the glow bleed into the letter edges, and blend dense monochrome film GRAIN over everything with a soft-light formula (like a 50% noise layer). Animate: the bloom BREATHES on a slow sine, the hue DRIFTS a touch, the cursor lights a local HOT-SPOT, and the word CROSS-DISSOLVES (eased) through a cycle, each settling into a different colour world. Ship several 5-stop palettes, each with its own ink + light paper colour (no dark mode). Framework-free WebGL1 + a rAF loop; DPR-capped at 1.5, pauses offscreen, one static frame under reduced motion.

The complete, self-contained implementation follows, one file per block. It is framework-agnostic core logic — wire it into your own component and mount it on an element.

### blur-glow/params.ts

```ts
export type Stop = { pos: number; color: [number, number, number] };

export interface Palette {
  name: string;
  stops: Stop[];
  ink: [number, number, number];
  paper: [number, number, number];
}

const rgb = (hex: string): [number, number, number] => [
  parseInt(hex.slice(1, 3), 16) / 255,
  parseInt(hex.slice(3, 5), 16) / 255,
  parseInt(hex.slice(5, 7), 16) / 255,
];

export const PALETTES: Palette[] = [
  {

    name: "Ultraviolet",
    stops: [
      { pos: 0.0, color: rgb("#0c0622") },
      { pos: 0.22, color: rgb("#5b1fd6") },
      { pos: 0.46, color: rgb("#ff3bd4") },
      { pos: 0.72, color: rgb("#ffcf4d") },
      { pos: 1.0, color: rgb("#faf7ff") },
    ],
    ink: rgb("#2a0f66"),
    paper: rgb("#faf7ff"),
  },
  {

    name: "Molten",
    stops: [
      { pos: 0.0, color: rgb("#28060a") },
      { pos: 0.22, color: rgb("#d21414") },
      { pos: 0.46, color: rgb("#ff6a1f") },
      { pos: 0.72, color: rgb("#ffcf52") },
      { pos: 1.0, color: rgb("#fff7ec") },
    ],
    ink: rgb("#7a1410"),
    paper: rgb("#fff7ec"),
  },
  {

    name: "Bubblegum",
    stops: [
      { pos: 0.0, color: rgb("#2a0718") },
      { pos: 0.22, color: rgb("#ff1e8e") },
      { pos: 0.46, color: rgb("#ff7ab0") },
      { pos: 0.72, color: rgb("#ffe0b0") },
      { pos: 1.0, color: rgb("#fff5fa") },
    ],
    ink: rgb("#8a0e52"),
    paper: rgb("#fff5fa"),
  },
  {

    name: "Electric",
    stops: [
      { pos: 0.0, color: rgb("#04102e") },
      { pos: 0.22, color: rgb("#1550ff") },
      { pos: 0.46, color: rgb("#25c8ff") },
      { pos: 0.72, color: rgb("#bff0ff") },
      { pos: 1.0, color: rgb("#f4faff") },
    ],
    ink: rgb("#0a2b8c"),
    paper: rgb("#f4faff"),
  },
  {

    name: "Jade",
    stops: [
      { pos: 0.0, color: rgb("#03170f") },
      { pos: 0.22, color: rgb("#0f7a4a") },
      { pos: 0.46, color: rgb("#1fd88a") },
      { pos: 0.72, color: rgb("#b8f5d8") },
      { pos: 1.0, color: rgb("#f3fbf6") },
    ],
    ink: rgb("#0a3d28"),
    paper: rgb("#f3fbf6"),
  },
  {

    name: "Sunburst",
    stops: [
      { pos: 0.0, color: rgb("#04161c") },
      { pos: 0.22, color: rgb("#0e7d86") },
      { pos: 0.46, color: rgb("#f2a20c") },
      { pos: 0.72, color: rgb("#ffe27a") },
      { pos: 1.0, color: rgb("#fefaf0") },
    ],
    ink: rgb("#0a3a40"),
    paper: rgb("#fefaf0"),
  },
];

export function paletteUniforms(p: Palette): {
  positions: number[];
  colors: number[];
  ink: number[];
  paper: number[];
} {
  const positions: number[] = [];
  const colors: number[] = [];
  for (let i = 0; i < 5; i++) {
    const s = p.stops[Math.min(i, p.stops.length - 1)];
    positions.push(s.pos);
    colors.push(s.color[0], s.color[1], s.color[2]);
  }
  return { positions, colors, ink: p.ink, paper: p.paper };
}

export interface PaletteUniforms {
  positions: number[];
  colors: number[];
  ink: number[];
  paper: number[];
}

const LUMA: readonly [number, number, number] = [0.2126, 0.7152, 0.0722];

function satPreserveLerp(x: number[], y: number[], t: number): number[] {
  const out = x.map((v, i) => v + (y[i] - v) * t);
  const bell = Math.sin(Math.PI * t);
  if (bell < 1e-4) return out;
  const satOf = (c0: number, c1: number, c2: number) => {
    const mx = Math.max(c0, c1, c2);
    return mx === 0 ? 0 : (mx - Math.min(c0, c1, c2)) / mx;
  };

  for (let i = 0; i + 2 < out.length; i += 3) {
    const r = out[i], g = out[i + 1], b = out[i + 2];
    const target = Math.max(
      satOf(x[i], x[i + 1], x[i + 2]),
      satOf(y[i], y[i + 1], y[i + 2]),
    );
    const s = satOf(r, g, b);
    if (s < 1e-4 || target < 1e-4) continue;
    const k = (s + (target - s) * bell) / s;
    const L = LUMA[0] * r + LUMA[1] * g + LUMA[2] * b;
    out[i] = Math.min(1, Math.max(0, L + (r - L) * k));
    out[i + 1] = Math.min(1, Math.max(0, L + (g - L) * k));
    out[i + 2] = Math.min(1, Math.max(0, L + (b - L) * k));
  }
  return out;
}

export function lerpPaletteUniforms(a: PaletteUniforms, b: PaletteUniforms, t: number): PaletteUniforms {
  const lerpArr = (x: number[], y: number[]) => x.map((v, i) => v + (y[i] - v) * t);
  return {

    positions: lerpArr(a.positions, b.positions),
    colors: satPreserveLerp(a.colors, b.colors, t),
    ink: satPreserveLerp(a.ink, b.ink, t),
    paper: satPreserveLerp(a.paper, b.paper, t),
  };
}

export const WORDS = ["hello", "pookie", "monkey"];

export const HOLD_SCALE = [1.45, 0.9, 1.0];

export const GRAIN = 0.4;

export const MORPH_LEAD = 0.78;
export const MORPH_LAG = 1.3;

export const CAST_DIR: readonly [number, number] = [0.38, 0.92];
export const CAST_STEP: readonly [number, number, number, number] = [0.0008, 0.0022, 0.0042, 0.0075];

export const LETTER_SPREAD = 0.45;

export const WARP_RADIUS = 0.2;
export const WARP_AMP = 0.013;
export const WARP_SWIRL = 0.6;

export const WARP_DRAG = 0.26;

export const WARP_STRETCH = 0.5;

export const BREATH = 0.22;

```

### blur-glow/text-mask.ts

```ts
export interface WordMask {
  canvas: HTMLCanvasElement;
  x0: number;
  x1: number;
}

export function makeWordMask(
  word: string,
  w: number,
  h: number,
  fontFamily: string,
): WordMask {
  const W = Math.max(1, Math.round(w));
  const H = Math.max(1, Math.round(h));

  const out = document.createElement("canvas");
  out.width = W;
  out.height = H;
  const ctx = out.getContext("2d")!;
  ctx.clearRect(0, 0, W, H);

  const text = (word || "").trim();
  if (!text) return { canvas: out, x0: 0.45, x1: 0.55 };

  const cx = W / 2;
  const cy = H * 0.52;
  const maxW = W * 0.66;

  const LOCK = H * 0.34;

  let size = LOCK;
  ctx.font = `600 ${size}px ${fontFamily}`;
  let measured = ctx.measureText(text).width;
  if (measured > maxW) {
    size *= maxW / measured;
    ctx.font = `600 ${size}px ${fontFamily}`;
    measured = ctx.measureText(text).width;
  }

  ctx.textAlign = "left";
  ctx.textBaseline = "middle";

  const ls = size * 0.015;
  const chars = [...text];
  const widths = chars.map((c) => ctx.measureText(c).width);
  const total = widths.reduce((a, b) => a + b, 0) + ls * (chars.length - 1);
  let x = cx - total / 2;
  const left = x;

  const last = Math.max(1, chars.length - 1);
  for (let i = 0; i < chars.length; i++) {
    const idx = i / last;
    ctx.fillStyle = `rgba(${Math.round(idx * 255)}, 0, 0, 1)`;
    ctx.fillText(chars[i], x, cy);
    x += widths[i] + ls;
  }
  return { canvas: out, x0: left / W, x1: (left + total) / W };
}

```

### blur-glow/shaders.ts

```ts
export const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

export const BLUR_FRAG = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec2 vUv;
uniform sampler2D uTex;
uniform vec2 uDir;
uniform float uMorph;
uniform sampler2D uTexB;
uniform float uUseMorph;
uniform float uPartOut;
uniform float uPartIn;
uniform float uLetterSpread;

uniform vec2  uFocus;
uniform float uFocusAmt;

float bhash(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
float bvnoise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f*f*(3.0-2.0*f);
  float a = bhash(i), b2 = bhash(i+vec2(1.0,0.0));
  float c = bhash(i+vec2(0.0,1.0)), d = bhash(i+vec2(1.0,1.0));
  return mix(mix(a,b2,u.x), mix(c,d,u.x), u.y);
}
float bfbm(vec2 p){
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++){ v += a * bvnoise(p); p = p * 2.0 + 11.0; a *= 0.5; }
  return v;
}

float bTransition(vec2 uv, float m){

  vec2 q = vec2(bfbm(uv * 2.1 + 3.7), bfbm(uv * 2.1 - 1.3));
  float n = bfbm(uv * 3.0 + q * 1.1);
  float bias = (uv.x * 0.8 + uv.y * 0.2) * 0.30;
  float field = clamp(n * 0.74 + bias, 0.0, 1.0);
  const float BAND = 0.26;

  float thr = mix(1.0 + BAND, -BAND, m);
  return smoothstep(thr - BAND, thr + BAND, field);
}

float bLetterPhase(sampler2D tex, vec2 uv, float m, float spread){
  float idx = texture2D(tex, uv).r;
  return clamp((m * (1.0 + spread)) - idx * spread, 0.0, 1.0);
}
vec4 samp(vec2 uv){
  if (uUseMorph > 0.5) {

    vec4 aTex = texture2D(uTex, uv);
    vec4 bTex = texture2D(uTexB, uv);
    float outM = bTransition(uv, bLetterPhase(uTex,  uv, uPartOut, uLetterSpread));
    float inM  = bTransition(uv, bLetterPhase(uTexB, uv, uPartIn,  uLetterSpread));
    return max(aTex * (1.0 - outM), bTex * inM);
  }
  return texture2D(uTex, uv);
}
void main(){

  float mid = (uFocus.x + uFocus.y) * 0.5;
  float halfW = max(0.001, (uFocus.y - uFocus.x) * 0.5);
  float ends = clamp(abs(vUv.x - mid) / halfW, 0.0, 1.6);
  float focus = 1.0 + uFocusAmt * ends * ends;
  vec2 dir = uDir * focus;

  float w0 = 0.2270270270;
  float w1 = 0.1945945946;
  float w2 = 0.1216216216;
  float w3 = 0.0540540541;
  float w4 = 0.0162162162;
  vec4 c = samp(vUv) * w0;
  c += samp(vUv + dir * 1.0) * w1;
  c += samp(vUv - dir * 1.0) * w1;
  c += samp(vUv + dir * 2.0) * w2;
  c += samp(vUv - dir * 2.0) * w2;
  c += samp(vUv + dir * 3.0) * w3;
  c += samp(vUv - dir * 3.0) * w3;
  c += samp(vUv + dir * 4.0) * w4;
  c += samp(vUv - dir * 4.0) * w4;
  gl_FragColor = c;
}`;

export const COMPOSITE_FRAG = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec2 vUv;

uniform sampler2D uMask;
uniform sampler2D uMaskB;
uniform sampler2D uL0;
uniform sampler2D uL1;
uniform sampler2D uL2;
uniform sampler2D uL3;
uniform vec2  uRes;
uniform float uMorph;
uniform float uPartOut;
uniform float uPartIn;
uniform float uLetterSpread;
uniform float uFront;
uniform vec2  uCursor;
uniform float uCursorOn;
uniform float uWarpRadius;
uniform float uWarpAmp;
uniform float uWarpSwirl;
uniform vec2  uWarpVel;
uniform float uWarpDrag;
uniform float uWarpStretch;
uniform float uPhase;
uniform float uBloom;
uniform vec2  uCast0;
uniform vec2  uCast1;
uniform vec2  uCast2;
uniform vec2  uCast3;

uniform float uPos[5];
uniform vec3  uCol[5];
uniform vec3  uInk;
uniform vec3  uPaper;
uniform float uGrain;

float hash(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }

float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f*f*(3.0-2.0*f);
  float a = hash(i), b2 = hash(i+vec2(1.0,0.0));
  float c = hash(i+vec2(0.0,1.0)), d = hash(i+vec2(1.0,1.0));
  return mix(mix(a,b2,u.x), mix(c,d,u.x), u.y);
}
float fbm(vec2 p){
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++){ v += a * vnoise(p); p = p * 2.0 + 11.0; a *= 0.5; }
  return v;
}

float transitionMask(vec2 uv, float m){

  vec2 q = vec2(fbm(uv * 2.1 + 3.7), fbm(uv * 2.1 - 1.3));
  float n = fbm(uv * 3.0 + q * 1.1);
  float bias = (uv.x * 0.8 + uv.y * 0.2) * 0.30;
  float field = clamp(n * 0.74 + bias, 0.0, 1.0);
  const float BAND = 0.26;
  float thr = mix(1.0 + BAND, -BAND, m);
  return smoothstep(thr - BAND, thr + BAND, field);
}

float letterPhase(sampler2D tex, vec2 uv, float m, float spread){
  float idx = texture2D(tex, uv).r;

  float local = (m * (1.0 + spread)) - idx * spread;
  return clamp(local, 0.0, 1.0);
}
float coverA(vec2 uv){ return texture2D(uMask, uv).a; }
float coverB(vec2 uv){ return texture2D(uMaskB, uv).a; }

float cover(vec2 uv){
  float outM = transitionMask(uv, letterPhase(uMask,  uv, uPartOut, uLetterSpread));
  float inM  = transitionMask(uv, letterPhase(uMaskB, uv, uPartIn,  uLetterSpread));

  return max(coverA(uv) * (1.0 - outM), coverB(uv) * inM);
}

vec3 gradientMap(float x){
  vec3 c = uCol[0];
  c = mix(c, uCol[1], smoothstep(uPos[0], uPos[1], x));
  c = mix(c, uCol[2], smoothstep(uPos[1], uPos[2], x));
  c = mix(c, uCol[3], smoothstep(uPos[2], uPos[3], x));
  c = mix(c, uCol[4], smoothstep(uPos[3], uPos[4], x));
  return c;
}

vec3 softLight(vec3 base, float g){
  vec3 s = vec3(g);
  vec3 lo = 2.0*base*s + base*base*(1.0 - 2.0*s);
  vec3 hi = 2.0*base*(1.0 - s) + sqrt(base)*(2.0*s - 1.0);
  return mix(lo, hi, step(0.5, s));
}

vec2 warpUV(vec2 uv){
  if (uCursorOn < 0.001) return uv;
  float asp = uRes.x / max(1.0, uRes.y);
  vec2 d = (uv - uCursor) * vec2(asp, 1.0);
  float r = length(d);
  float R = uWarpRadius;
  if (r > R || r < 1e-5) return uv;
  float f = 1.0 - r / R;
  f = f * f * (3.0 - 2.0 * f);
  vec2 dir = d / r;
  vec2 swirl = vec2(-dir.y, dir.x);
  vec2 push = mix(dir, swirl, uWarpSwirl);

  push += uWarpVel * uWarpDrag;

  float speed = length(uWarpVel);
  if (speed > 0.02) {
    vec2 vdir = uWarpVel / speed;
    float along = dot(d / r, vdir);
    float stretch = 1.0 + uWarpStretch * clamp(speed, 0.0, 1.0) * (along * along - 0.35);
    f *= clamp(stretch, 0.0, 2.2);
  }

  float ripple = 1.0 + 0.16 * sin(r / R * 3.1416 - uPhase * 5.0);

  float lead = 0.5 + 0.5 * dot(normalize(d + 1e-6), normalize(uWarpVel + 1e-6));
  float visc = mix(1.15, 0.85, lead);

  return uv + push * (f * ripple * visc * uWarpAmp * uCursorOn) / vec2(asp, 1.0);
}

void main(){

  vec2 uv = warpUV(vUv);

  float cd = distance(vUv * uRes, uCursor * uRes);
  float hot = uCursorOn * smoothstep(min(uRes.x, uRes.y) * uWarpRadius * 2.4, 0.0, cd);

  float b = 1.0 + (uBloom - 1.0) * 1.25 + 0.14 * hot;

  float glow =
      1.00 * cover(uv)
    + 0.92 * texture2D(uL0, uv + uCast0).a
    + 0.78 * texture2D(uL1, vUv + uCast1).a * b
    + 0.58 * texture2D(uL2, vUv + uCast2).a * b
    + 0.40 * texture2D(uL3, vUv + uCast3).a * b;
  glow = clamp(glow / 2.45, 0.0, 1.0);

  float field = pow(glow, 0.6);

  field = clamp(field + hot * 0.16 * field, 0.0, 1.0);

  if (uFront > 0.001) {
    vec2 q = vec2(fbm(uv * 2.1 + 3.7), fbm(uv * 2.1 - 1.3));
    float n = fbm(uv * 3.0 + q * 1.1);
    float fieldN = clamp(n * 0.74 + (uv.x * 0.8 + uv.y * 0.2) * 0.30, 0.0, 1.0);
    float thrIn = mix(1.26, -0.26, uPartIn);
    float edge = 1.0 - smoothstep(0.0, 0.30, abs(fieldN - thrIn));

    field = clamp(field + edge * uFront * 0.30 * smoothstep(0.02, 0.45, glow), 0.0, 1.0);
  }

  float drift = 0.022 * sin(uPhase + uv.x * 3.0 + uv.y * 2.0);

  float t = clamp(1.0 - field + drift - hot * 0.10, 0.0, 1.0);
  vec3 col = gradientMap(t);

  vec3 bounced = mix(uPaper, uCol[2], texture2D(uL3, vUv + uCast3).a * 0.16);
  col = mix(bounced, col, smoothstep(0.0, 0.06, field));

  float softCov = clamp(texture2D(uL0, uv).a * 1.05 + cover(uv) * 0.25, 0.0, 1.0);

  float interior = smoothstep(0.18, 0.62, softCov);

  vec3 bodyCol = mix(uInk, uCol[1], 0.5);
  bodyCol = mix(bodyCol, uCol[2], (1.0 - interior) * 0.5);

  float solid = smoothstep(0.35, 0.95, cover(uv));
  bodyCol = mix(mix(bodyCol, uCol[2], 0.30), mix(bodyCol, uInk, 0.22), solid);
  col = mix(col, bodyCol, interior * 0.9);

  float g = hash(gl_FragCoord.xy);
  vec3 grained = softLight(col, g);
  col = mix(col, grained, uGrain * (0.5 + 0.7 * field));

  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

```

### blur-glow/engine.ts

```ts
import { VERT, BLUR_FRAG, COMPOSITE_FRAG } from "./shaders";
import { makeWordMask } from "./text-mask";
import {
  PALETTES,
  WORDS,
  GRAIN,
  MORPH_LEAD,
  MORPH_LAG,
  CAST_DIR,
  CAST_STEP,
  HOLD_SCALE,
  LETTER_SPREAD,
  BREATH,
  WARP_RADIUS,
  WARP_AMP,
  WARP_SWIRL,
  WARP_DRAG,
  WARP_STRETCH,
  paletteUniforms,
  lerpPaletteUniforms,
  type PaletteUniforms,
} from "./params";

const FONT = "var(--font-pangram)";
const FOCUS_AMT = 1.5;

const MORPH_SEC = 0.8;
const HOLD_MS = 700;

const LEVELS = [
  { scale: 0.5, radius: 2 },
  { scale: 0.25, radius: 3 },
  { scale: 0.125, radius: 3 },
  { scale: 0.0625, radius: 3 },
];

type Target = { fb: WebGLFramebuffer; tex: WebGLTexture; w: number; h: number };

export class BlurGlow {
  private host: HTMLElement;
  private canvas: HTMLCanvasElement;
  private gl: WebGLRenderingContext | null = null;

  private blurProg: WebGLProgram | null = null;
  private compProg: WebGLProgram | null = null;
  private quad: WebGLBuffer | null = null;

  private maskA: WebGLTexture | null = null;
  private maskB: WebGLTexture | null = null;
  private focusA: [number, number] = [0.35, 0.65];
  private focusB: [number, number] = [0.35, 0.65];
  private levels: { out: Target; tmp: Target }[] = [];

  private blurU: Record<string, WebGLUniformLocation | null> = {};
  private compU: Record<string, WebGLUniformLocation | null> = {};

  private fontFamily = "sans-serif";
  private raf = 0;
  private running = false;
  private destroyed = false;
  private start0 = 0;
  private lastT = 0;
  private revealed = false;

  private wordIdx = 0;
  private paletteIdx = 0;
  private morph = 0;
  private morphEased = 0;
  private morphGlow = 0;
  private morphBody = 0;
  private morphing = false;
  private holdUntil = 0;

  private paletteFrom: PaletteUniforms = paletteUniforms(PALETTES[0]);
  private paletteTo: PaletteUniforms = paletteUniforms(PALETTES[0]);

  private curX = 0.5;
  private curY = 0.5;
  private tgtX = 0.5;
  private tgtY = 0.5;
  private curOn = 0;
  private tgtOn = 0;

  private velX = 0;
  private velY = 0;
  private prevX = 0.5;
  private prevY = 0.5;

  constructor(host: HTMLElement) {
    this.host = host;
    this.canvas = document.createElement("canvas");
    Object.assign(this.canvas.style, {
      display: "block",
      width: "100%",
      height: "100%",
      opacity: "0",
      transition: "opacity 0.4s ease",
    });
    host.appendChild(this.canvas);

    const gl = this.canvas.getContext("webgl", {
      alpha: false,
      antialias: false,
      premultipliedAlpha: false,
      powerPreference: "low-power",
    }) as WebGLRenderingContext | null;
    if (!gl) return;
    this.gl = gl;

    this.buildPrograms();
    if (!this.blurProg || !this.compProg) return;
    this.resolveFont();
    this.resize();

    host.addEventListener("pointermove", this.onMove);
    host.addEventListener("pointerleave", this.onLeave);
  }

  private compile(type: number, src: string): WebGLShader | null {
    const gl = this.gl!;
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.warn("[blur-glow] shader:", gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  }
  private link(vs: string, fs: string): WebGLProgram | null {
    const gl = this.gl!;
    const v = this.compile(gl.VERTEX_SHADER, vs);
    const f = this.compile(gl.FRAGMENT_SHADER, fs);
    if (!v || !f) return null;
    const p = gl.createProgram()!;
    gl.attachShader(p, v);
    gl.attachShader(p, f);
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      console.warn("[blur-glow] link:", gl.getProgramInfoLog(p));
      return null;
    }
    return p;
  }

  private buildPrograms() {
    const gl = this.gl!;
    this.quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);

    this.blurProg = this.link(VERT, BLUR_FRAG);
    this.compProg = this.link(VERT, COMPOSITE_FRAG);
    if (!this.blurProg || !this.compProg) return;

    const BU = (n: string) => gl.getUniformLocation(this.blurProg!, n);
    this.blurU = {
      uTex: BU("uTex"),
      uTexB: BU("uTexB"),
      uDir: BU("uDir"),
      uMorph: BU("uMorph"),
      uUseMorph: BU("uUseMorph"),
      uFocus: BU("uFocus"),
      uFocusAmt: BU("uFocusAmt"),
      uPartOut: BU("uPartOut"),
      uPartIn: BU("uPartIn"),
      uLetterSpread: BU("uLetterSpread"),
    };
    const CU = (n: string) => gl.getUniformLocation(this.compProg!, n);
    this.compU = {
      uMask: CU("uMask"),
      uMaskB: CU("uMaskB"),
      uL0: CU("uL0"),
      uL1: CU("uL1"),
      uL2: CU("uL2"),
      uL3: CU("uL3"),
      uRes: CU("uRes"),
      uMorph: CU("uMorph"),
      uCursor: CU("uCursor"),
      uCursorOn: CU("uCursorOn"),
      uWarpRadius: CU("uWarpRadius"),
      uWarpAmp: CU("uWarpAmp"),
      uWarpSwirl: CU("uWarpSwirl"),
      uWarpVel: CU("uWarpVel"),
      uWarpDrag: CU("uWarpDrag"),
      uWarpStretch: CU("uWarpStretch"),
      uPhase: CU("uPhase"),
      uBloom: CU("uBloom"),
      uCast0: CU("uCast0"),
      uCast1: CU("uCast1"),
      uCast2: CU("uCast2"),
      uCast3: CU("uCast3"),
      uPartOut: CU("uPartOut"),
      uPartIn: CU("uPartIn"),
      uLetterSpread: CU("uLetterSpread"),
      uFront: CU("uFront"),
      uPos: CU("uPos[0]"),
      uCol: CU("uCol[0]"),
      uInk: CU("uInk"),
      uPaper: CU("uPaper"),
      uGrain: CU("uGrain"),
    };
  }

  private bindQuad(prog: WebGLProgram) {
    const gl = this.gl!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    const loc = gl.getAttribLocation(prog, "aPos");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  }

  private uploadPalette(u: { positions: number[]; colors: number[]; ink: number[]; paper: number[] }) {
    const gl = this.gl;
    if (!gl || !this.compProg) return;
    gl.useProgram(this.compProg);
    gl.uniform1fv(this.compU.uPos!, new Float32Array(u.positions));
    gl.uniform3fv(this.compU.uCol!, new Float32Array(u.colors));
    gl.uniform3fv(this.compU.uInk!, new Float32Array(u.ink));
    gl.uniform3fv(this.compU.uPaper!, new Float32Array(u.paper));
    this.canvas.style.background = `rgb(${u.paper.map((c) => Math.round(c * 255)).join(",")})`;
  }

  private applyPalette(i: number) {
    const idx = i % PALETTES.length;
    this.paletteFrom = paletteUniforms(PALETTES[idx]);
    this.paletteTo = this.paletteFrom;
    this.uploadPalette(this.paletteFrom);
  }

  private resolveFont() {
    if (typeof document === "undefined") return;
    try {
      const probe = document.createElement("span");
      probe.style.cssText = "position:absolute;visibility:hidden;font-family:" + FONT;
      probe.textContent = "Ag";
      document.body.appendChild(probe);
      this.fontFamily =
        getComputedStyle(probe).fontFamily.split(",")[0].replace(/["']/g, "").trim() || "sans-serif";
      document.body.removeChild(probe);
    } catch {}
  }

  private makeTarget(w: number, h: number): Target {
    const gl = this.gl!;
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fb = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { fb, tex, w, h };
  }
  private freeLevels() {
    const gl = this.gl;
    if (!gl) return;
    for (const lv of this.levels) {
      gl.deleteFramebuffer(lv.out.fb);
      gl.deleteTexture(lv.out.tex);
      gl.deleteFramebuffer(lv.tmp.fb);
      gl.deleteTexture(lv.tmp.tex);
    }
    this.levels = [];
  }
  private allocLevels() {
    this.freeLevels();
    const W = this.canvas.width;
    const H = this.canvas.height;
    this.levels = LEVELS.map((l) => {
      const w = Math.max(2, Math.round(W * l.scale));
      const h = Math.max(2, Math.round(H * l.scale));
      return { out: this.makeTarget(w, h), tmp: this.makeTarget(w, h) };
    });
  }

  private uploadMask(src: HTMLCanvasElement, existing: WebGLTexture | null): WebGLTexture {
    const gl = this.gl!;
    const tex = existing ?? gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);

    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return tex;
  }
  private buildMask() {
    const gl = this.gl;
    if (!gl) return;
    const m = makeWordMask(WORDS[this.wordIdx % WORDS.length], this.canvas.width, this.canvas.height, this.fontFamily);
    this.maskA = this.uploadMask(m.canvas, this.maskA);
    this.focusA = [m.x0, m.x1];
  }

  private buildMaskB() {
    const gl = this.gl;
    if (!gl) return;
    const next = (this.wordIdx + 1) % WORDS.length;
    const m = makeWordMask(WORDS[next], this.canvas.width, this.canvas.height, this.fontFamily);
    this.maskB = this.uploadMask(m.canvas, this.maskB);
    this.focusB = [m.x0, m.x1];
  }

  private resize() {
    const gl = this.gl;
    if (!gl) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const r = this.host.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width * dpr));
    const h = Math.max(1, Math.round(r.height * dpr));
    if (this.canvas.width === w && this.canvas.height === h && this.levels.length) return;
    this.canvas.width = w;
    this.canvas.height = h;
    this.allocLevels();
    this.buildMask();

    this.buildMaskB();

    if (!this.morphing) this.applyPalette(this.paletteIdx);
  }

  private beginMorph() {

    this.morph = 0;
    this.morphing = true;

    this.paletteFrom = paletteUniforms(PALETTES[this.paletteIdx % PALETTES.length]);
    this.paletteTo = paletteUniforms(PALETTES[(this.paletteIdx + 1) % PALETTES.length]);
  }
  private finishMorph() {
    this.wordIdx = (this.wordIdx + 1) % WORDS.length;
    const t = this.maskA;
    this.maskA = this.maskB;
    this.maskB = t;
    this.focusA = this.focusB;
    this.morph = 0;
    this.morphing = false;

    this.buildMaskB();

    this.paletteIdx = (this.paletteIdx + 1) % PALETTES.length;
    this.paletteFrom = this.paletteTo;
    this.uploadPalette(this.paletteTo);
  }

  private render(bloom: number, phase: number) {
    const gl = this.gl;
    if (!gl || !this.blurProg || !this.compProg || !this.levels.length) return;

    gl.useProgram(this.blurProg);
    this.bindQuad(this.blurProg);
    gl.disable(gl.BLEND);

    const m = this.morph;
    const em = m * m * m * (m * (m * 6 - 15) + 10);

    this.morphGlow = Math.pow(em, MORPH_LEAD);
    this.morphBody = Math.pow(em, MORPH_LAG);
    this.morphEased = em;

    const clocks = (base: number): [number, number] => [
      Math.min(1, base * (1 + BREATH)),
      Math.max(0, Math.min(1, base * (1 + BREATH) - BREATH)),
    ];
    const [glowOut, glowIn] = clocks(this.morphGlow);
    const [bodyOut, bodyIn] = clocks(this.morphBody);

    const front = this.morphing ? Math.sin(Math.PI * em) : 0;
    const fx0 = this.focusA[0] + (this.focusB[0] - this.focusA[0]) * em;
    const fx1 = this.focusA[1] + (this.focusB[1] - this.focusA[1]) * em;
    gl.uniform2f(this.blurU.uFocus!, fx0, fx1);
    gl.uniform1f(this.blurU.uFocusAmt!, FOCUS_AMT);

    gl.uniform1f(this.blurU.uMorph!, this.morphGlow);
    gl.uniform1f(this.blurU.uPartOut!, glowOut);
    gl.uniform1f(this.blurU.uPartIn!, glowIn);
    gl.uniform1f(this.blurU.uLetterSpread!, LETTER_SPREAD);
    for (let i = 0; i < this.levels.length; i++) {
      const lv = this.levels[i];
      const r = LEVELS[i].radius;
      const srcTex = i === 0 ? this.maskA! : this.levels[i - 1].out.tex;
      const useMorph = i === 0 && this.morphing ? 1 : 0;

      gl.bindFramebuffer(gl.FRAMEBUFFER, lv.tmp.fb);
      gl.viewport(0, 0, lv.tmp.w, lv.tmp.h);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, srcTex);
      gl.uniform1i(this.blurU.uTex!, 0);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this.maskB ?? this.maskA!);
      gl.uniform1i(this.blurU.uTexB!, 1);
      gl.uniform1f(this.blurU.uUseMorph!, useMorph);
      gl.uniform2f(this.blurU.uDir!, r / lv.tmp.w, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      gl.bindFramebuffer(gl.FRAMEBUFFER, lv.out.fb);
      gl.viewport(0, 0, lv.out.w, lv.out.h);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, lv.tmp.tex);
      gl.uniform1i(this.blurU.uTex!, 0);
      gl.uniform1f(this.blurU.uUseMorph!, 0);
      gl.uniform2f(this.blurU.uDir!, 0, r / lv.out.h);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.useProgram(this.compProg);
    this.bindQuad(this.compProg);

    if (this.morphing) {
      this.uploadPalette(lerpPaletteUniforms(this.paletteFrom, this.paletteTo, this.morphEased));
    }

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.maskA!);
    gl.uniform1i(this.compU.uMask!, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.maskB ?? this.maskA!);
    gl.uniform1i(this.compU.uMaskB!, 1);
    const levelUnits = ["uL0", "uL1", "uL2", "uL3"];
    for (let i = 0; i < this.levels.length; i++) {
      gl.activeTexture(gl.TEXTURE2 + i);
      gl.bindTexture(gl.TEXTURE_2D, this.levels[i].out.tex);
      gl.uniform1i(this.compU[levelUnits[i]]!, 2 + i);
    }
    gl.uniform2f(this.compU.uRes!, this.canvas.width, this.canvas.height);
    gl.uniform1f(this.compU.uMorph!, this.morphBody);
    gl.uniform1f(this.compU.uPartOut!, bodyOut);
    gl.uniform1f(this.compU.uPartIn!, bodyIn);
    gl.uniform1f(this.compU.uLetterSpread!, LETTER_SPREAD);
    gl.uniform1f(this.compU.uFront!, front);
    gl.uniform2f(this.compU.uCursor!, this.curX, this.curY);
    gl.uniform1f(this.compU.uCursorOn!, this.curOn);
    gl.uniform1f(this.compU.uWarpRadius!, WARP_RADIUS);
    gl.uniform1f(this.compU.uWarpAmp!, WARP_AMP);
    gl.uniform1f(this.compU.uWarpSwirl!, WARP_SWIRL);
    gl.uniform2f(this.compU.uWarpVel!, this.velX, this.velY);
    gl.uniform1f(this.compU.uWarpDrag!, WARP_DRAG);
    gl.uniform1f(this.compU.uWarpStretch!, WARP_STRETCH);
    gl.uniform1f(this.compU.uPhase!, phase);
    gl.uniform1f(this.compU.uBloom!, bloom);

    const aspect = this.canvas.width / Math.max(1, this.canvas.height);
    const casts = [this.compU.uCast0, this.compU.uCast1, this.compU.uCast2, this.compU.uCast3];
    for (let i = 0; i < casts.length; i++) {
      const s = CAST_STEP[i];
      gl.uniform2f(casts[i]!, (CAST_DIR[0] * s) / aspect, CAST_DIR[1] * s);
    }
    gl.uniform1f(this.compU.uGrain!, GRAIN);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    this.reveal();
  }

  private holdFor(i: number) {
    return HOLD_MS * (HOLD_SCALE[i % WORDS.length] ?? 1);
  }

  private frame = (now: number) => {
    if (!this.running || this.destroyed) return;
    if (!this.start0) {
      this.start0 = now;
      this.lastT = now;
      this.holdUntil = now + this.holdFor(this.wordIdx);
    }
    const t = (now - this.start0) / 1000;
    const dt = Math.min(0.05, Math.max(0.001, (now - this.lastT) / 1000));
    this.lastT = now;

    this.curX = this.tgtX;
    this.curY = this.tgtY;

    this.curOn += (this.tgtOn - this.curOn) * (1 - Math.pow(1 - 0.42, dt * 60));

    const vx = (this.curX - this.prevX) / dt;
    const vy = (this.curY - this.prevY) / dt;
    this.prevX = this.curX;
    this.prevY = this.curY;
    const vk = 1 - Math.pow(1 - 0.5, dt * 60);
    this.velX += (vx - this.velX) * vk;
    this.velY += (vy - this.velY) * vk;
    const vmag = Math.hypot(this.velX, this.velY);
    const VMAX = 2.2;
    if (vmag > VMAX) {
      this.velX = (this.velX / vmag) * VMAX;
      this.velY = (this.velY / vmag) * VMAX;
    }

    if (!this.morphing && now >= this.holdUntil) this.beginMorph();
    if (this.morphing) {

      this.morph = Math.min(1, this.morph + dt / MORPH_SEC);
      if (this.morph >= 1) {
        this.finishMorph();
        this.holdUntil = now + this.holdFor(this.wordIdx);
      }
    }

    const bloom = 1.0 + 0.16 * Math.sin(t * 0.6);
    const phase = t * 0.5;
    this.render(bloom, phase);
    this.raf = requestAnimationFrame(this.frame);
  };

  private reveal() {
    if (this.revealed) return;
    this.revealed = true;
    this.canvas.style.opacity = "1";
  }

  private onMove = (e: PointerEvent) => {
    const r = this.host.getBoundingClientRect();
    this.tgtX = (e.clientX - r.left) / r.width;
    this.tgtY = 1 - (e.clientY - r.top) / r.height;
    this.tgtOn = 1;
  };
  private onLeave = () => {
    this.tgtOn = 0;
  };

  start() {
    if (this.running || !this.gl || !this.compProg) return;
    this.running = true;
    this.start0 = 0;
    this.raf = requestAnimationFrame(this.frame);
  }
  stop() {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  renderStill(instant = false) {
    if (!this.gl || !this.compProg) return;
    if (instant && !this.revealed) {
      this.canvas.style.transition = "none";
      this.revealed = true;
      this.canvas.style.opacity = "1";
    }
    this.render(1.0, 0);
  }
  refreshFont() {
    this.resolveFont();

    this.buildMask();
    this.buildMaskB();
    if (!this.running) this.renderStill();
  }
  onResize() {
    this.resize();
    if (!this.running) this.renderStill();
  }
  destroy() {
    this.destroyed = true;
    this.stop();
    this.host.removeEventListener("pointermove", this.onMove);
    this.host.removeEventListener("pointerleave", this.onLeave);
    const gl = this.gl;
    if (gl) {
      this.freeLevels();
      if (this.maskA) gl.deleteTexture(this.maskA);
      if (this.maskB) gl.deleteTexture(this.maskB);
      if (this.quad) gl.deleteBuffer(this.quad);
      if (this.blurProg) gl.deleteProgram(this.blurProg);
      if (this.compProg) gl.deleteProgram(this.compProg);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    }
    this.canvas.remove();
  }
}

```


17. Build this: a plain white card that drops a TRAIL of tiny, compressed monospace badges behind the cursor as it moves. Each badge is a small die-cut box in a different vivid colour (lime, hot pink, cyan, orange, violet, yellow…) with BLACK text of a typography/design term inside (kerning, baseline, bezier, gamut…). Very compact: ~11px mono text, 1px vertical / 4px horizontal padding, small radius, no border. The trail SPAWNS on the raw pointer path — a new badge drops at the cursor at most every ~90ms AND only after the cursor has travelled a min distance, so a still cursor can't stack badges in place. Each badge fades + scales in (~140ms), holds (~620ms), then fades out (~260ms) and is removed. HARD NON-OVERLAP: before spawning, AABB-test the candidate rect (inflated by a small gap) against every live badge and SKIP the drop if it would collide — density self-limits near clusters, badges never touch. Words are drawn from a shuffled bag (no back-to-back repeats) and colours step through the palette so neighbours differ. DOM badges (not canvas) for crisp text at any DPR and trivial CSS transitions; a rAF loop publishes the live set each frame. Pauses offscreen / when the tab is hidden. Pointer-fine only — touch and reduced-motion show a few static example badges instead of the trail. Light mode, no title row, no detail page.

The complete, self-contained implementation follows, one file per block. It is framework-agnostic core logic — wire it into your own component and mount it on an element.

### badge-trail/badges.ts

```ts
export const WORDS = [
  "kerning",
  "baseline",
  "leading",
  "tracking",
  "x-height",
  "ligature",
  "serif",
  "grotesk",
  "bezier",
  "raster",
  "vector",
  "stroke",
  "gamut",
  "bleed",
  "weight",
  "grid",
  "hue",
  "counter",
  "ascender",
  "hinting",
  "widow",
  "orphan",
  "gutter",
  "opacity",
];

export const COLORS = [
  "#c6ff3d",
  "#ff3d81",
  "#38e0ff",
  "#ff8a3d",
  "#b56bff",
  "#ffe234",
  "#ff5c5c",
  "#3dffb0",
  "#4d8dff",
  "#ff5cf0",
];

const HUE_STEP = 24;

function hslHex(h: number, s = 0.85, l = 0.62): string {
  h = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0,
    g = 0,
    b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const hex = (v: number) =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

export function makeHueWalker(seedHue: number) {
  let h = seedHue;
  return (intensity = 1) => {
    h += HUE_STEP;
    const t = Math.max(0, Math.min(1, intensity));
    const s = 0.32 + 0.53 * t;
    const l = 0.78 - 0.16 * t;
    return hslHex(h, s, l);
  };
}

```

### badge-trail/BadgeTrailCard.tsx

```ts
"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { WORDS, COLORS, makeHueWalker } from "./badges";

function useMedia(query: string, server: boolean): boolean {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(query);
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => window.matchMedia(query).matches,
    () => server,
  );
}

function useReducedMotion(): boolean {
  return useMedia("(prefers-reduced-motion: reduce)", false);
}

function useFinePointer(): boolean {

  return useMedia("(hover: hover) and (pointer: fine)", true);
}

const FONT_PX = 11;
const CHAR_W = 6.6;
const PAD_X = 4;
const PAD_Y = 1;
const RADIUS = 3;
const GAP = 3;

const DROP_MS = 45;
const MIN_TRAVEL = 14;
const APPEAR_MS = 110;
const HOLD_MS = 480;
const FADE_MS = 240;
const LIFE_MS = APPEAR_MS + HOLD_MS + FADE_MS;
const MAX_LIVE = 22;

const SLAM_OFFSET = 5;
const SLAM_OVERSHOOT = 1.03;

const IDLE_WOBBLE = 0.35;
const IDLE_BREATH = 0.01;

const SPECIAL_EVERY = 15;

const SCRAMBLE_MS = 130;
const SCRAMBLE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/#*";

const SPEED_FULL = 40;
const INTENSITY_FLOOR = 0.35;

const REPEL_PX = 3;
const REPEL_RANGE = 64;
const REPEL_CHASE = 0.16;
const REPEL_DECAY = 0.05;

const GHOST_IDLE_MS = 600;

const GHOST_FX = 0.00156;
const GHOST_FX2 = 0.00465;
const GHOST_AX = 0.3;
const GHOST_AX2 = 0.11;
const GHOST_FY = 0.00219;
const GHOST_FY2 = 0.0063;
const GHOST_AY = 0.3;
const GHOST_AY2 = 0.12;
const GHOST_BLEND_MS = 420;

type Badge = {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
  color: string;
  born: number;

  dirX: number;
  dirY: number;

  exitRot: number;

  seed: number;

  depth: number;

  special: boolean;

  scram: string;

  offX: number;
  offY: number;
  tgtX: number;
  tgtY: number;
};

const badgeH = FONT_PX + PAD_Y * 2;
const badgeW = (text: string) => Math.round(text.length * CHAR_W) + PAD_X * 2;

function hits(x: number, y: number, w: number, h: number, b: Badge): boolean {
  return (
    x < b.x + b.w + GAP &&
    x + w + GAP > b.x &&
    y < b.y + b.h + GAP &&
    y + h + GAP > b.y
  );
}

function shuffled(n: number, rnd: () => number): number[] {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function BadgeTrailCard({ bare = false }: { bare?: boolean } = {}) {
  void bare;
  const hostRef = useRef<HTMLDivElement>(null);
  const [badges, setBadges] = useState<Badge[]>([]);
  const reduced = useReducedMotion();
  const fine = useFinePointer();

  useEffect(() => {
    const host = hostRef.current;
    if (!host || reduced) return;

    const rnd = Math.random;

    let onScreen = false;
    let hidden = false;
    let raf = 0;
    let seq = 0;
    const live: Badge[] = [];

    let rpx = -1;
    let rpy = -1;
    let px = -1;
    let py = -1;
    let lastDropT = 0;
    let lastDropX = 0;
    let lastDropY = 0;
    let haveLast = false;

    let leftAt = -Infinity;
    let blendFromX = 0;
    let blendFromY = 0;

    let bag: number[] = [];
    const nextWord = () => {
      if (bag.length === 0) bag = shuffled(WORDS.length, rnd);
      return WORDS[bag.pop()!];
    };

    const nextColor = makeHueWalker(rnd() * 360);

    let prevPx = -1;
    let prevPy = -1;
    let dropCount = 0;

    const onMove = (e: PointerEvent) => {
      const r = host.getBoundingClientRect();
      rpx = e.clientX - r.left;
      rpy = e.clientY - r.top;
    };

    const onDown = (e: PointerEvent) => {
      const r = host.getBoundingClientRect();
      rpx = e.clientX - r.left;
      rpy = e.clientY - r.top;
      if (e.pointerType === "touch") e.preventDefault();
    };
    const onLeave = () => {

      if (px >= 0) {
        blendFromX = px;
        blendFromY = py;
      }
      rpx = -1;
      rpy = -1;
      leftAt = performance.now();
    };

    const ghostPoint = (t: number, w: number, h: number): [number, number] => {
      const gx =
        w * 0.5 +
        (Math.sin(t * GHOST_FX) * GHOST_AX + Math.sin(t * GHOST_FX2 + 2.3) * GHOST_AX2) * w;
      const gy =
        h * 0.5 +
        (Math.sin(t * GHOST_FY + 1.7) * GHOST_AY + Math.cos(t * GHOST_FY2 + 0.6) * GHOST_AY2) * h;
      return [gx, gy];
    };

    let lastNow = 0;
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (!onScreen || hidden) return;

      const dtFrames = lastNow ? Math.min(4, (now - lastNow) / 16.6667) : 1;
      lastNow = now;

      const r = host.getBoundingClientRect();
      if (rpx >= 0) {

        px = rpx;
        py = rpy;
      } else if (now - leftAt >= GHOST_IDLE_MS) {

        const [gx, gy] = ghostPoint(now, r.width, r.height);
        const k = Math.min(1, (now - leftAt - GHOST_IDLE_MS) / GHOST_BLEND_MS);
        if (isFinite(leftAt) && k < 1) {
          px = blendFromX + (gx - blendFromX) * k;
          py = blendFromY + (gy - blendFromY) * k;
        } else {
          px = gx;
          py = gy;
        }
      } else {

        px = -1;
        py = -1;
      }

      for (let i = live.length - 1; i >= 0; i--) {
        if (now - live[i].born >= LIFE_MS) live.splice(i, 1);
      }

      if (px >= 0 && live.length < MAX_LIVE) {
        const traveled = haveLast ? Math.hypot(px - lastDropX, py - lastDropY) : Infinity;
        if (now - lastDropT >= DROP_MS && traveled >= MIN_TRAVEL) {
          const text = nextWord();
          const w = badgeW(text);
          const h = badgeH;

          let x = px - w / 2;
          let y = py - h / 2;
          x = Math.max(0, Math.min(r.width - w, x));
          y = Math.max(0, Math.min(r.height - h, y));

          const collides = live.some((b) => hits(x, y, w, h, b));
          if (!collides) {

            let dx = prevPx >= 0 ? px - prevPx : 0;
            let dy = prevPy >= 0 ? py - prevPy : -1;
            const speed = Math.hypot(prevPx >= 0 ? px - prevPx : 0, prevPy >= 0 ? py - prevPy : 0);
            const dm = Math.hypot(dx, dy) || 1;
            dx /= dm;
            dy /= dm;

            const intensity =
              INTENSITY_FLOOR + (1 - INTENSITY_FLOOR) * Math.max(0, Math.min(1, speed / SPEED_FULL));
            const cxn = x + w / 2;
            const cyn = y + h / 2;

            for (const b of live) {
              const bx = b.x + b.w / 2;
              const by = b.y + b.h / 2;
              const vx = bx - cxn;
              const vy = by - cyn;
              const d = Math.hypot(vx, vy) || 1;
              if (d < REPEL_RANGE) {
                const push = REPEL_PX * (1 - d / REPEL_RANGE);
                b.tgtX += (vx / d) * push;
                b.tgtY += (vy / d) * push;
              }
            }
            live.push({
              id: seq++,
              x,
              y,
              w,
              h,
              text,
              color: nextColor(intensity),
              born: now,
              dirX: dx,
              dirY: dy,
              exitRot: (rnd() < 0.5 ? -1 : 1) * (4 + rnd() * 5),
              seed: rnd() * 1000,
              depth: 0,
              special: dropCount % SPECIAL_EVERY === SPECIAL_EVERY - 1,
              scram: text,
              offX: 0,
              offY: 0,
              tgtX: 0,
              tgtY: 0,
            });
            dropCount++;
            lastDropT = now;
            lastDropX = px;
            lastDropY = py;
            haveLast = true;
          }
        }
      }
      prevPx = px;
      prevPy = py;

      const n = live.length;
      const chaseK = 1 - Math.pow(1 - REPEL_CHASE, dtFrames);
      const decayK = 1 - Math.pow(1 - REPEL_DECAY, dtFrames);
      for (let i = 0; i < n; i++) {
        const b = live[i];

        b.depth = n > 1 ? 1 - i / (n - 1) : 0;

        b.offX += (b.tgtX - b.offX) * chaseK;
        b.offY += (b.tgtY - b.offY) * chaseK;
        b.tgtX *= 1 - decayK;
        b.tgtY *= 1 - decayK;

        const age = now - b.born;
        if (age < SCRAMBLE_MS && b.text.length > 1) {
          const prog = age / SCRAMBLE_MS;
          const locked = Math.floor(prog * b.text.length);
          let s = "";
          for (let c = 0; c < b.text.length; c++) {
            s +=
              c < locked
                ? b.text[c]
                : SCRAMBLE_CHARS[(Math.floor(rnd() * SCRAMBLE_CHARS.length))];
          }
          b.scram = s;
        } else {
          b.scram = b.text;
        }
      }

      setBadges(live.slice());
    };

    const io = new IntersectionObserver(
      (es) => {
        onScreen = es[0]?.isIntersecting ?? false;
      },
      { threshold: 0.15 },
    );
    io.observe(host);
    const onVis = () => {
      hidden = document.hidden;
    };
    document.addEventListener("visibilitychange", onVis);

    const onMoveGuarded = (e: PointerEvent) => {
      onMove(e);
      if (e.pointerType === "touch") e.preventDefault();
    };
    host.addEventListener("pointermove", onMoveGuarded, { passive: false });
    host.addEventListener("pointerdown", onDown, { passive: false });
    host.addEventListener("pointerleave", onLeave);
    host.addEventListener("pointerup", onLeave);
    host.addEventListener("pointercancel", onLeave);
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      host.removeEventListener("pointermove", onMoveGuarded);
      host.removeEventListener("pointerdown", onDown);
      host.removeEventListener("pointerleave", onLeave);
      host.removeEventListener("pointerup", onLeave);
      host.removeEventListener("pointercancel", onLeave);
    };
  }, [reduced]);

  const STATIC: Array<{ text: string; color: string }> = [
    { text: "kerning", color: COLORS[0] },
    { text: "baseline", color: COLORS[2] },
    { text: "bezier", color: COLORS[4] },
    { text: "gamut", color: COLORS[6] },
  ];

  return (
    <div
      ref={hostRef}
      data-canvas-card
      aria-label="A white card that drops a trail of small coloured monospace badges of typography terms as you move the cursor over it. On touch, drag a finger across it to lay the trail."
      className="relative mx-auto aspect-[1344/620] w-full cursor-crosshair select-none overflow-hidden rounded-[12px] border border-[var(--border-line)] bg-white"
      style={{
        fontFamily: "var(--font-neue-mono)",

        ...(!fine && !reduced ? { touchAction: "none" as const } : null),
      }}
    >
      {reduced ? (
        <div className="absolute inset-0 flex flex-wrap content-center items-center justify-center gap-2 px-8">
          {STATIC.map((b, i) => (
            <span
              key={i}
              style={{
                fontFamily: "var(--font-neue-mono)",
                fontSize: FONT_PX,
                lineHeight: 1,
                padding: `${PAD_Y}px ${PAD_X}px`,
                borderRadius: RADIUS,
                background: b.color,
                color: "#000",
                textTransform: "uppercase",
              }}
            >
              {b.text}
            </span>
          ))}
        </div>
      ) : (
        (() => {
          const clock = performanceNowSafe();
          return (
            <>
              {badges.map((b) => {
                const m = badgeMotion(b, clock);

                const depthScale = 1 - b.depth * 0.06;
                const depthDim = 1 - b.depth * 0.12;
                return (
                  <span
                    key={b.id}
                    style={{
                      position: "absolute",
                      left: b.x,
                      top: b.y,
                      fontFamily: "var(--font-neue-mono)",
                      fontSize: FONT_PX,
                      lineHeight: 1,
                      whiteSpace: "nowrap",
                      padding: `${PAD_Y}px ${PAD_X}px`,
                      borderRadius: RADIUS,

                      background: b.special ? "transparent" : b.color,
                      boxShadow: b.special
                        ? `inset 0 0 0 1px ${b.color}`
                        : "0 1px 2px -1px rgba(20,20,30,0.35)",
                      color: b.special ? b.color : "#000",
                      textTransform: "uppercase",
                      opacity: m.opacity * depthDim,

                      transform: `translate(${m.dx + b.offX}px, ${m.dy + b.offY}px) scale(${m.scale * depthScale}) rotate(${m.rot}deg)`,
                      transformOrigin: "center",
                      pointerEvents: "none",
                      willChange: "opacity, transform",
                    }}
                  >
                    {b.scram}
                  </span>
                );
              })}
            </>
          );
        })()
      )}
    </div>
  );
}

// performance.now() guarded for the (impossible here, but cheap) case it's unavailable.
function performanceNowSafe(): number {
  return typeof performance !== "undefined" ? performance.now() : 0;
}

// Derive a badge's per-frame motion from its age + seed. Combines four layers:
//   #1 slam entrance   — enters offset back along cursor travel, springs to place (WEAK)
//   #2 flick exit      — collapses thinner + rotates as it dies (different verb from entrance)
//   #4 idle wobble     — sub-pixel positional wobble + scale breath while held
// Returns the composited dx/dy (px), scale, rotation (deg) and opacity.
function badgeMotion(
  b: Badge,
  clock: number,
): { dx: number; dy: number; scale: number; rot: number; opacity: number } {
  const age = clock - b.born;
  let opacity = 1;
  let scale = 1;
  let rot = 0;
  let dx = 0;
  let dy = 0;

  if (age < APPEAR_MS) {

    const t = age / APPEAR_MS;
    const spring = 1 - Math.pow(1 - t, 3);
    opacity = Math.min(1, t * 1.4);

    const base = 0.9 + 0.1 * spring;
    scale = base + (SLAM_OVERSHOOT - 1) * Math.sin(Math.PI * t);
    const back = (1 - spring) * SLAM_OFFSET;
    dx = -b.dirX * back;
    dy = -b.dirY * back;
  } else if (age > APPEAR_MS + HOLD_MS) {

    const t = Math.min(1, (age - APPEAR_MS - HOLD_MS) / FADE_MS);
    const e = t * t;
    opacity = 1 - t;
    scale = 1 - 0.2 * e;
    rot = b.exitRot * e;
  }

  if (age >= APPEAR_MS) {
    const idle = opacity;
    const p = clock * 0.004 + b.seed;
    dx += Math.sin(p) * IDLE_WOBBLE * idle;
    dy += Math.cos(p * 1.3 + 0.7) * IDLE_WOBBLE * idle;
    scale += Math.sin(p * 0.9) * IDLE_BREATH * idle;
  }

  return { dx, dy, scale, rot, opacity };
}
```


18. Build this: a scene of overlapping WORD-SHAPED embroidered patches stitched onto fabric, rendered live in WebGL. Each patch is cut to the OUTLINE of its word: the colored cloth is the word's silhouette DILATED outward (a fat patch hugging the glyphs), with dark satin lettering on top and a white MERROWED BORDER bead tracing the rim; the patches overlap and cast tight drop shadows on the cloth background. BUILD IT AS TWO TEXTURES + one shader. (1) A CPU 'scene' pass (2D canvas) builds an ART texture (RGB: fabric bg, then per word — fill the dilated silhouette with the cloth color, paint the white border band, paint the dark ink glyphs — composited front-to-back so a nearer patch hides the ink/border of patches behind it) and a FIELD texture (RGBA: R = blurred patch coverage / puff ramp, G = ink-letter mask, B = merrowed-border ring, A = per-pixel SATIN-STITCH RUN ANGLE). The dilate is a cheap morphological grow (stamp the glyph at ringed offsets). The satin angle is the KEY realism cue: compute it from the GRADIENT of a heavily-blurred glyph field so stitches run ALONG each stroke, and from the coverage-rim gradient on the border so stitches WRAP the rim (a real merrow). Upload the field as RAW rgba pixels (no premultiply) so the alpha-packed angle survives. (2) The fragment shader lights the pre-colored ART as thread: sample a fabric-WEAVE grayscale texture (tiled) as a bump-normal so each thread catches light, add the patch PUFF bevel from the coverage ramp (N·L lighting), render tight bright/dark SATIN BANDS perpendicular to the per-pixel run angle (this is what makes it read as sewn, not printed), an inner shadow at the patch edge, fine thread noise, and composite over the dark fabric with a tight contact drop shadow. Hover sweeps the light toward the cursor to relight the stitching. Framework-free WebGL1 (two textures, one quad) + a rAF loop; idle-defers the CPU scene build, pauses offscreen / when hidden, reveals on first paint (no flash), reduced-motion draws one static frame.

You need ONE asset: a small seamless grayscale FABRIC-WEAVE texture (512x512), tiled as the thread bump-map. You can use the exact one this effect ships — download it here:
  https://pub-58a0dfd4417141169bd84ab545cd7830.r2.dev/vault/embroidery-weave.webp
Save it into your project (the engine expects it at /vault/embroidery-weave.webp) and load it into the shader with REPEAT wrap. To make your own instead: take any dense canvas/linen weave image, crop a clean interior square (no seams/edges), high-pass it to keep only the fine weave, center it around mid-gray, and make it seamlessly tileable (offset-and-cosine blend).

The complete, self-contained implementation follows, one file per block. It is framework-agnostic core logic — wire it into your own component and mount it on an element.

### folder-embroidery/patches.ts

```ts
export type WordPatch = {
  word: string;

  cx: number;
  cy: number;
  scale: number;
  rotDeg: number;
  fill: [number, number, number];
  ink: [number, number, number];
  border: [number, number, number];
  stitchDeg: number;
};

export const WORDS: WordPatch[] = [
  {
    word: "made",
    cx: 0.44, cy: 0.29, scale: 0.32, rotDeg: -4,
    fill: [0.42, 0.62, 0.92],
    ink: [0.09, 0.09, 0.1],
    border: [0.97, 0.97, 0.98],
    stitchDeg: 70,
  },
  {
    word: "with",
    cx: 0.6, cy: 0.51, scale: 0.28, rotDeg: 3,
    fill: [0.96, 0.82, 0.36],
    ink: [0.09, 0.09, 0.1],
    border: [0.98, 0.98, 0.96],
    stitchDeg: 20,
  },
  {
    word: "love",
    cx: 0.48, cy: 0.72, scale: 0.34, rotDeg: -2,
    fill: [0.9, 0.62, 0.82],
    ink: [0.09, 0.09, 0.1],
    border: [0.98, 0.97, 0.98],
    stitchDeg: 100,
  },
];

export const FABRIC: [number, number, number] = [0.16, 0.13, 0.2];

```

### folder-embroidery/scene.ts

```ts
import { WORDS, FABRIC, type WordPatch } from "./patches";

export type Scene = {
  art: HTMLCanvasElement;

  field: { data: Uint8Array; width: number; height: number };
};

export async function makeScene(
  w: number,
  h: number,
  fontFamily: string,
): Promise<Scene> {
  const W = Math.max(1, Math.round(w));
  const H = Math.max(1, Math.round(h));
  const mk = () => {
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    return c;
  };

  const borderPx = Math.max(3, H * 0.018);
  const bevelPx = Math.max(1.5, H * 0.007);

  const cover = mk();
  const coverX = cover.getContext("2d")!;
  const ink = mk();
  const inkX = ink.getContext("2d")!;
  const ring = mk();
  const ringX = ring.getContext("2d")!;
  const dir = mk();
  const dirX = dir.getContext("2d")!;

  const art = mk();
  const artX = art.getContext("2d")!;

  artX.fillStyle = rgb(FABRIC);
  artX.fillRect(0, 0, W, H);

  coverX.globalCompositeOperation = "lighten";
  inkX.globalCompositeOperation = "lighten";
  ringX.globalCompositeOperation = "lighten";

  for (const wp of WORDS) {

    const glyph = mk();
    const gx = glyph.getContext("2d")!;
    drawWord(gx, wp, W, H, fontFamily);

    const sil = mk();
    const sx = sil.getContext("2d")!;
    dilate(sx, glyph, borderPx * 2.1);

    const inner = mk();
    const ix = inner.getContext("2d")!;
    dilate(ix, glyph, borderPx * 1.05);
    const bandC = mk();
    const bx = bandC.getContext("2d")!;
    bx.drawImage(sil, 0, 0);
    bx.globalCompositeOperation = "destination-out";
    bx.drawImage(inner, 0, 0);
    bx.globalCompositeOperation = "source-over";

    const layer = mk();
    const lx = layer.getContext("2d")!;
    lx.drawImage(sil, 0, 0);
    lx.globalCompositeOperation = "source-in";
    lx.fillStyle = rgb(wp.fill);
    lx.fillRect(0, 0, W, H);
    lx.globalCompositeOperation = "source-over";

    paintMasked(lx, bandC, wp.border);

    paintMasked(lx, glyph, wp.ink);

    artX.drawImage(layer, 0, 0);

    coverX.drawImage(sil, 0, 0);

    punchThenAdd(inkX, sil, glyph);
    punchThenAdd(ringX, sil, bandC);

    dirX.drawImage(glyph, 0, 0);
  }

  const puff = mk();
  const px = puff.getContext("2d")!;
  px.filter = `blur(${bevelPx.toFixed(2)}px)`;
  px.drawImage(cover, 0, 0);
  px.filter = "none";

  const gsrc = mk();
  const gx2 = gsrc.getContext("2d")!;
  gx2.filter = `blur(${Math.max(2, H * 0.02).toFixed(2)}px)`;
  gx2.drawImage(dir, 0, 0);
  gx2.filter = "none";
  const rsrc = mk();
  const rx2 = rsrc.getContext("2d")!;
  rx2.filter = `blur(${Math.max(2, H * 0.016).toFixed(2)}px)`;
  rx2.drawImage(cover, 0, 0);
  rx2.filter = "none";

  const cData = px.getImageData(0, 0, W, H).data;
  const iData = inkX.getImageData(0, 0, W, H).data;
  const rData = ringX.getImageData(0, 0, W, H).data;
  const gData = gx2.getImageData(0, 0, W, H).data;
  const rimData = rx2.getImageData(0, 0, W, H).data;
  const p = new Uint8Array(W * H * 4);

  const grad = (a: Uint8ClampedArray, x: number, y: number) => {
    const at = (xx: number, yy: number) => {
      xx = xx < 0 ? 0 : xx >= W ? W - 1 : xx;
      yy = yy < 0 ? 0 : yy >= H ? H - 1 : yy;
      return a[(yy * W + xx) * 4 + 3];
    };
    return [at(x + 1, y) - at(x - 1, y), at(x, y + 1) - at(x, y - 1)] as const;
  };
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const isBorder = rData[i + 3] > 40 && iData[i + 3] < 40;

      const [dx, dy] = isBorder ? grad(rimData, x, y) : grad(gData, x, y);

      let ang = Math.atan2(dy, dx) + Math.PI / 2;

      ang = ((ang % Math.PI) + Math.PI) % Math.PI;
      p[i] = cData[i + 3];
      p[i + 1] = iData[i + 3];
      p[i + 2] = rData[i + 3];
      p[i + 3] = Math.round((ang / Math.PI) * 255);
    }
  }

  return { art, field: { data: p, width: W, height: H } };
}

function rgb(c: [number, number, number]): string {
  const to = (v: number) => Math.round(Math.max(0, Math.min(1, v)) * 255);
  return `rgb(${to(c[0])},${to(c[1])},${to(c[2])})`;
}

function paintMasked(
  ctx: CanvasRenderingContext2D,
  mask: HTMLCanvasElement,
  color: [number, number, number],
) {
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;
  const t = document.createElement("canvas");
  t.width = W;
  t.height = H;
  const tx = t.getContext("2d")!;
  tx.drawImage(mask, 0, 0);
  tx.globalCompositeOperation = "source-in";
  tx.fillStyle = rgb(color);
  tx.fillRect(0, 0, W, H);
  ctx.drawImage(t, 0, 0);
}

function dilate(
  ctx: CanvasRenderingContext2D,
  src: HTMLCanvasElement,
  r: number,
) {
  const steps = 28;
  for (let s = 1; s >= 0.5; s -= 0.5) {
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      ctx.drawImage(src, Math.cos(a) * r * s, Math.sin(a) * r * s);
    }
  }
  ctx.drawImage(src, 0, 0);
}

function punchThenAdd(
  acc: CanvasRenderingContext2D,
  sil: HTMLCanvasElement,
  add: HTMLCanvasElement,
) {
  acc.globalCompositeOperation = "destination-out";
  acc.drawImage(sil, 0, 0);
  acc.globalCompositeOperation = "lighten";
  acc.drawImage(add, 0, 0);
}

function drawWord(
  ctx: CanvasRenderingContext2D,
  wp: WordPatch,
  W: number,
  H: number,
  fontFamily: string,
) {
  const size = wp.scale * H;
  ctx.save();
  ctx.translate(wp.cx * W, wp.cy * H);
  ctx.rotate((wp.rotDeg * Math.PI) / 180);
  ctx.font = `800 ${size}px ${fontFamily}`;
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(wp.word, 0, 0);
  ctx.restore();
}

```

### folder-embroidery/shaders.ts

```ts
export const EMB_VERT = `
attribute vec2 aPosition;
attribute vec2 aUV;
varying vec2 vUV;
void main() {
  vUV = aUV;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

export const EMB_FRAG = `

precision highp float;

varying vec2 vUV;

uniform sampler2D uArt;
uniform sampler2D uField;
uniform sampler2D uWeave;
uniform vec2  uTexel;
uniform vec2  uLight;
uniform float uLightZ;
uniform vec2  uWash;
uniform float uHover;
uniform float uPress;
uniform vec2  uPressPos;
uniform float uAspect;
uniform vec3  uFabric;
uniform float uDepth;
uniform float uWeaveScale;

float hash(vec2 p){
  p = mod(p, 137.0);
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
float noise(vec2 p){

  p = mod(p, 137.0);
  vec2 i = floor(p), f = fract(p);
  float a = hash(i), b = hash(i+vec2(1.,0.)), c = hash(i+vec2(0.,1.)), d = hash(i+vec2(1.,1.));
  vec2 u = f*f*(3.-2.*f);
  return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
}

float weaveAt(vec2 uv){ return texture2D(uWeave, fract(uv * vec2(uAspect,1.0) * uWeaveScale)).r; }

void main() {
  vec2 uv = vUV;
  vec2 texel = uTexel;

  vec4 fld = texture2D(uField, uv);
  float cover = fld.r;
  float inkM  = fld.g;
  float ringM = fld.b;
  float stitchAng = fld.a * 3.14159;

  vec2 dp = uv * vec2(uAspect, 1.0);
  float bw = weaveAt(uv + vec2(0.37, 0.11));
  float blotch = noise(dp * 3.0) * 0.1 + noise(dp * 7.0) * 0.05;
  vec3 fabric = uFabric * (0.72 + bw * 0.6 + (blotch - 0.075));
  fabric += (noise(dp * 240.0) - 0.5) * 0.025;
  vec3 col = fabric;

  float pdist = distance(uv * vec2(uAspect, 1.0), uPressPos * vec2(uAspect, 1.0));
  float pressLocal = uPress * (1.0 - smoothstep(0.0, 0.5, pdist));

  float lift = 1.0 - pressLocal * 0.85;
  vec2 shOff = vec2(6.0, -6.0) * texel * lift;
  float shc = texture2D(uField, uv - shOff).r;
  col = mix(col, col * mix(0.42, 0.62, pressLocal), smoothstep(0.2, 0.8, shc) * 0.8);

  if (cover < 0.004) { gl_FragColor = vec4(col, 1.0); return; }

  float w0 = weaveAt(uv);
  float wL = weaveAt(uv - vec2(1.,0.)*texel), wR = weaveAt(uv + vec2(1.,0.)*texel);
  float wD = weaveAt(uv - vec2(0.,1.)*texel), wU = weaveAt(uv + vec2(0.,1.)*texel);
  vec2 wslope = vec2(wR - wL, wU - wD) * 22.0;
  vec3 Nw = normalize(vec3(-wslope.x, -wslope.y, 1.0));

  float cL = texture2D(uField, uv - vec2(1.,0.)*texel).r, cR = texture2D(uField, uv + vec2(1.,0.)*texel).r;
  float cD = texture2D(uField, uv - vec2(0.,1.)*texel).r, cU = texture2D(uField, uv + vec2(0.,1.)*texel).r;
  vec2 pslope = vec2(cR - cL, cU - cD) * uDepth * 16.0;
  vec3 Np = vec3(-pslope.x, -pslope.y, 1.0);
  float bevel = clamp(length(pslope), 0.0, 1.0);
  vec3 N = normalize(Np + Nw * 2.0);

  vec3 L = normalize(vec3(uLight, uLightZ));
  float diff = dot(N, L);
  float hi = pow(max(diff, 0.0), 1.25);
  float sh = pow(max(-diff, 0.0), 1.1);

  vec3 art = texture2D(uArt, uv).rgb;
  vec3 c = art * (0.72 + w0 * 0.6);

  float sc = cos(stitchAng), ss = sin(stitchAng);

  float across = (dp.x * ss - dp.y * sc);
  float rows = across * 260.0;

  float TWO_PI = 6.2831853;
  float satin = sin(mod(rows, TWO_PI));

  float ridge = 0.5 + 0.5 * satin;
  ridge = pow(ridge, 1.4);
  float jit = noise(vec2(floor(rows), (dp.x*sc+dp.y*ss)*90.0)) * 0.25;
  float satinShade = mix(0.82, 1.14, clamp(ridge + jit*ridge, 0.0, 1.0));

  float clothFace = cover * (1.0 - inkM);
  c *= mix(1.0, satinShade, clothFace * 0.9 + ringM * 0.6);

  c *= 1.0 - inkM * 0.05;

  c += hi * 0.46 * (0.5 + bevel * 0.5);
  c -= sh * 0.36;

  float edge = 1.0 - smoothstep(0.0, 0.32, cover);
  c *= 1.0 - edge * 0.28 * cover;

  c += (noise(dp * 380.0) - 0.5) * 0.045;

  if (uHover > 0.001) {
    float d = distance(dp, uWash * vec2(uAspect, 1.0));
    float halo = 1.0 - smoothstep(0.0, 0.42, d);
    float crown = smoothstep(0.72, 1.0, ridge);
    float glint = halo * halo * (0.35 + crown * 0.9) * uHover;
    c += glint * 0.16 * cover;
  }

  c *= 1.0 - pressLocal * 0.16 * cover;

  c = clamp(c, 0.0, 1.0);

  float aa = smoothstep(0.06, 0.2, cover);
  gl_FragColor = vec4(mix(col, c, aa), 1.0);
}
`;

```

### folder-embroidery/engine.ts

```ts
import { EMB_VERT, EMB_FRAG } from "./shaders";
import { makeScene } from "./scene";
import { FABRIC } from "./patches";
import { mediaUrl } from "../../lib/video-sources";

const REST_ANGLE = (73 * Math.PI) / 180;
const LIGHT_Z = 0.55;

const WEAVE_URL = mediaUrl("/vault/embroidery-weave.webp");
const WEAVE_SCALE = 15;

export class Embroidery {
  private host: HTMLElement;
  private canvas: HTMLCanvasElement;
  private gl: WebGLRenderingContext | null = null;
  private prog: WebGLProgram | null = null;
  private loc: Record<string, WebGLUniformLocation | null> = {};
  private quad: WebGLBuffer | null = null;
  private artTex: WebGLTexture | null = null;
  private fieldTex: WebGLTexture | null = null;
  private weave: WebGLTexture | null = null;
  private texW = 1;
  private texH = 1;

  private raf = 0;
  private running = false;
  private awake = false;

  private w = 0;
  private h = 0;
  private dpr = 1;
  private fontFamily = "var(--font-neue-corp), sans-serif";

  private builtW = 0;
  private builtH = 0;
  private builtFont = "";
  private buildScheduled = 0;
  private destroyed = false;
  private painted = false;

  private hover = 0;
  private hoverTarget = 0;
  private wx = 0.5;
  private wy = 0.55;
  private twx = 0.5;
  private twy = 0.55;

  private press = 0;
  private pressVel = 0;
  private pressKick = 0;
  private px = 0.5;
  private py = 0.5;

  ok = false;

  constructor(host: HTMLElement, fontFamily?: string) {
    this.host = host;
    if (fontFamily) this.fontFamily = fontFamily;
    this.canvas = document.createElement("canvas");
    Object.assign(this.canvas.style, {
      position: "absolute",
      inset: "0",
      width: "100%",
      height: "100%",
      display: "block",
      opacity: "0",
    });
    host.appendChild(this.canvas);

    const gl = this.canvas.getContext("webgl", {
      alpha: false,
      antialias: false,
      premultipliedAlpha: false,
    });
    if (!gl) return;
    this.gl = gl;

    try {
      this.prog = this.build(EMB_VERT, EMB_FRAG);
    } catch {
      this.gl = null;
      return;
    }

    const p = this.prog;
    for (const u of [
      "uArt", "uField", "uWeave", "uTexel", "uLight", "uLightZ", "uWash", "uHover",
      "uPress", "uPressPos", "uAspect", "uFabric", "uDepth", "uWeaveScale",
    ]) {
      this.loc[u] = gl.getUniformLocation(p, u);
    }
    const aPos = gl.getAttribLocation(p, "aPosition");
    const aUV = gl.getAttribLocation(p, "aUV");
    const data = new Float32Array([
      -1, -1, 0, 1,
       1, -1, 1, 1,
      -1,  1, 0, 0,
       1,  1, 1, 0,
    ]);
    this.quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    gl.useProgram(p);
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(aUV);
    gl.vertexAttribPointer(aUV, 2, gl.FLOAT, false, 16, 8);

    gl.clearColor(FABRIC[0] * 0.8, FABRIC[1] * 0.8, FABRIC[2] * 0.8, 1);

    this.resize();
    this.weave = this.newPlaceholder([150, 150, 150, 255]);
    this.loadWeave();
    void this.buildSceneNow();

    this.canvas.addEventListener("pointermove", this.onMove);
    this.ok = true;
  }

  private newPlaceholder(rgba: number[]): WebGLTexture | null {
    const gl = this.gl;
    if (!gl) return null;
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(rgba));
    return t;
  }

  private loadWeave() {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const g = this.gl;
      if (!g || !this.weave || this.destroyed) return;
      g.bindTexture(g.TEXTURE_2D, this.weave);
      g.pixelStorei(g.UNPACK_FLIP_Y_WEBGL, true);
      g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, g.RGBA, g.UNSIGNED_BYTE, img);
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.REPEAT);
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.REPEAT);
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR);
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.LINEAR);
      g.pixelStorei(g.UNPACK_FLIP_Y_WEBGL, false);
      if (!this.running) this.render();
    };
    img.src = WEAVE_URL;
  }

  private build(vs: string, fs: string): WebGLProgram {
    const gl = this.gl!;
    const c = (type: number, src: string) => {
      const sh = gl.createShader(type)!;
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        throw new Error(gl.getShaderInfoLog(sh) || "compile failed");
      }
      return sh;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, c(gl.VERTEX_SHADER, vs));
    gl.attachShader(prog, c(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(prog) || "link failed");
    }
    return prog;
  }

  setFont(family: string) {
    if (family === this.fontFamily) return;
    this.fontFamily = family;
    this.scheduleBuild();
  }

  setPatch(_i: number) {
    void _i;
  }

  setHover(v: number) {
    this.hoverTarget = Math.max(0, Math.min(1, v));
    this.wake();
  }

  pressTap(x = 0.5, y = 0.5) {
    this.px = x;
    this.py = 1 - y;
    this.pressKick = 1;
    this.wake();
  }

  private wake() {
    if (this.awake && !this.running) this.start();
    else if (!this.running) this.render();
  }

  private onMove = (e: PointerEvent) => {
    const r = this.canvas.getBoundingClientRect();
    this.twx = (e.clientX - r.left) / r.width;
    this.twy = 1 - (e.clientY - r.top) / r.height;
    this.wake();
  };

  resize() {
    const r = this.host.getBoundingClientRect();
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.w = r.width;
    this.h = r.height;
    const cw = Math.max(1, Math.round(this.w * this.dpr));
    const ch = Math.max(1, Math.round(this.h * this.dpr));
    if (this.canvas.width !== cw || this.canvas.height !== ch) {
      this.canvas.width = cw;
      this.canvas.height = ch;
      this.gl?.viewport(0, 0, cw, ch);
      this.scheduleBuild();
    }
  }

  private maskSize(): [number, number] {
    const MAX_W = 1400;
    const mw = Math.max(2, Math.min(MAX_W, Math.round(this.w * this.dpr)));
    const mh = Math.max(2, Math.round(mw * (this.h / Math.max(1, this.w))));
    return [mw, mh];
  }

  private scheduleBuild() {
    if (!this.gl || this.destroyed) return;
    const [mw, mh] = this.maskSize();
    if (mw === this.builtW && mh === this.builtH && this.fontFamily === this.builtFont) return;
    if (this.buildScheduled) return;
    const run = () => {
      this.buildScheduled = 0;
      void this.buildSceneNow();
    };
    const ric = (window as unknown as {
      requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number;
    }).requestIdleCallback;
    this.buildScheduled = ric ? ric(run, { timeout: 200 }) : window.setTimeout(run, 0);
  }

  private uploadCanvas(tex: WebGLTexture, canvas: HTMLCanvasElement) {
    const gl = this.gl!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
  }

  private uploadPixels(tex: WebGLTexture, px: { data: Uint8Array; width: number; height: number }) {
    const gl = this.gl!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, px.width, px.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, px.data);
  }

  private async buildSceneNow() {
    const gl = this.gl;
    if (!gl || this.destroyed) return;
    if (this.buildScheduled) {
      const cic = (window as unknown as { cancelIdleCallback?: (id: number) => void }).cancelIdleCallback;
      if (cic) cic(this.buildScheduled);
      else window.clearTimeout(this.buildScheduled);
      this.buildScheduled = 0;
    }
    const [mw, mh] = this.maskSize();
    this.builtW = mw;
    this.builtH = mh;
    this.builtFont = this.fontFamily;
    const scene = await makeScene(mw, mh, this.fontFamily);
    if (!this.gl || this.destroyed) return;
    if (!this.artTex) this.artTex = gl.createTexture();
    if (!this.fieldTex) this.fieldTex = gl.createTexture();
    this.uploadCanvas(this.artTex, scene.art);
    this.uploadPixels(this.fieldTex, scene.field);
    this.texW = scene.field.width;
    this.texH = scene.field.height;
    if (!this.running) this.render();
  }

  start() {
    if (!this.ok) return;
    this.awake = true;
    if (this.running) return;
    this.running = true;
    this.resize();
    const loop = () => {
      if (!this.running) return;
      this.frame();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    this.awake = false;
    this.pause();
  }

  private pause() {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  private frame() {
    const k = 0.12;
    this.hover += (this.hoverTarget - this.hover) * k;
    this.wx += (this.twx - this.wx) * k;
    this.wy += (this.twy - this.wy) * k;

    this.pressKick *= 0.8;
    if (this.pressKick < 0.002) this.pressKick = 0;
    this.pressVel += (this.pressKick - this.press) * 0.28;
    this.pressVel *= 0.6;
    this.press += this.pressVel;
    this.render();
  }

  renderStill() {
    this.resize();
    void this.buildSceneNow();
    this.render();
  }

  private render() {
    const gl = this.gl;
    if (!gl || !this.prog || !this.artTex || !this.fieldTex) return;

    const ang = REST_ANGLE + (this.wx - 0.5) * 1.4 * this.hover;
    gl.useProgram(this.prog);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.artTex);
    gl.uniform1i(this.loc.uArt, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.fieldTex);
    gl.uniform1i(this.loc.uField, 1);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this.weave);
    gl.uniform1i(this.loc.uWeave, 2);
    gl.uniform1f(this.loc.uWeaveScale, WEAVE_SCALE);
    gl.uniform2f(this.loc.uTexel, 1 / this.texW, 1 / this.texH);
    gl.uniform2f(this.loc.uLight, Math.cos(ang), Math.sin(ang));
    gl.uniform1f(this.loc.uLightZ, LIGHT_Z);
    gl.uniform2f(this.loc.uWash, this.wx, this.wy);
    gl.uniform1f(this.loc.uHover, this.hover);
    gl.uniform1f(this.loc.uPress, Math.max(0, Math.min(1, this.press)));
    gl.uniform2f(this.loc.uPressPos, this.px, this.py);
    gl.uniform1f(this.loc.uAspect, this.w / Math.max(1, this.h));
    gl.uniform3f(this.loc.uFabric, FABRIC[0], FABRIC[1], FABRIC[2]);
    gl.uniform1f(this.loc.uDepth, 1.15);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    if (!this.painted) {
      this.painted = true;
      this.canvas.style.opacity = "1";
    }

    if (
      Math.abs(this.hover - this.hoverTarget) < 0.002 &&
      this.hoverTarget < 0.002 &&
      Math.abs(this.wx - this.twx) < 0.001 &&
      Math.abs(this.wy - this.twy) < 0.001 &&
      this.pressKick === 0 &&
      Math.abs(this.press) < 0.002 &&
      Math.abs(this.pressVel) < 0.002
    ) {
      this.pause();
    }
  }

  destroy() {
    this.destroyed = true;
    if (this.buildScheduled) {
      const cic = (window as unknown as { cancelIdleCallback?: (id: number) => void }).cancelIdleCallback;
      if (cic) cic(this.buildScheduled);
      else window.clearTimeout(this.buildScheduled);
      this.buildScheduled = 0;
    }
    this.stop();
    this.canvas.removeEventListener("pointermove", this.onMove);
    const gl = this.gl;
    if (gl) {
      if (this.artTex) gl.deleteTexture(this.artTex);
      if (this.fieldTex) gl.deleteTexture(this.fieldTex);
      if (this.weave) gl.deleteTexture(this.weave);
      if (this.quad) gl.deleteBuffer(this.quad);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    }
    this.canvas.remove();
  }
}

```

   19. Build this: a word rendered as flowing LIQUID CHROME on black — polished, glassy metal with a bright/dark horizon reflection, sparks, and a reflection that streams as the cursor moves. BUILD IT WITH A HEIGHT-FIELD + ENV-MAP (matcap) SHADER, no 3D scene. (1) Rasterize the word to a coverage mask on a 2D canvas, then build a ROUND liquid HEIGHT FIELD by blurring that mask WIDE (a big soft blur — the wide blur is what makes the metal read as fat liquid bulges, not a thin bevel). Pack R = crisp coverage, G = blurred height, upload as a texture. (2) In the fragment shader, take the surface NORMAL as the gradient of the height field (N = normalize(vec3(-dh/dx, -dh/dy, 1))). Reflect the view vector (0,0,1) off N and TILT the reflected vector by the cursor position; use the reflected ray's vertical component to index a 5-stop CHROME RAMP (sky / bright-horizon / dark-horizon / ground / base) — that sharp bright-to-dark horizon band IS the chrome reflection. Sharpen the horizon so the reflection line reads crisp. Add a FRESNEL rim (edges of the bulge catch a bright reflection), a horizontal sky-streak, star SPARKS at the brightest high-curvature ridges (twinkling on a sine so they pop in/out), fine grain, and composite over black with a soft liquid antialiased edge. The cursor tilt makes the whole reflection flow across the letters — the signature interaction. Ship a few ramp presets (silver-teal, gold, iridescent), each just 5 colors + a spark tint, so it recolors trivially. Framework-free WebGL1 (one shader, one quad) + a rAF loop; idle-defers the CPU height build, pauses offscreen / when hidden, reveals on first paint, reduced-motion draws one static frame.

The complete, self-contained implementation follows, one file per block. It is framework-agnostic core logic — wire it into your own component and mount it on an element.

### chrome/params.ts

```ts
export type ChromeRamp = {
  name: string;

  stops: [number, number, number][];
  spark: [number, number, number];
};

export const RAMPS: ChromeRamp[] = [
  {

    name: "Silver Teal",
    stops: [
      [0.62, 0.78, 0.85],
      [0.98, 1.0, 1.0],
      [0.03, 0.06, 0.08],
      [0.1, 0.34, 0.4],
      [0.5, 0.72, 0.78],
    ],
    spark: [0.85, 0.97, 1.0],
  },
  {
    name: "Gold",
    stops: [
      [0.95, 0.82, 0.4],
      [1.0, 0.98, 0.85],
      [0.14, 0.08, 0.0],
      [0.6, 0.4, 0.05],
      [0.9, 0.72, 0.3],
    ],
    spark: [1.0, 0.95, 0.7],
  },
  {

    name: "Iridescent",
    stops: [
      [0.55, 0.5, 0.95],
      [0.95, 0.85, 1.0],
      [0.04, 0.02, 0.1],
      [0.9, 0.3, 0.6],
      [0.3, 0.8, 0.85],
    ],
    spark: [1.0, 0.9, 1.0],
  },
  {

    name: "Rose Gold",
    stops: [
      [0.95, 0.72, 0.68],
      [1.0, 0.92, 0.9],
      [0.12, 0.04, 0.05],
      [0.72, 0.34, 0.32],
      [0.9, 0.6, 0.56],
    ],
    spark: [1.0, 0.9, 0.88],
  },
  {

    name: "Gunmetal",
    stops: [
      [0.52, 0.56, 0.62],
      [0.9, 0.93, 0.98],
      [0.02, 0.03, 0.04],
      [0.16, 0.2, 0.26],
      [0.42, 0.47, 0.53],
    ],
    spark: [0.85, 0.9, 1.0],
  },
  {

    name: "Toxic",
    stops: [
      [0.55, 0.9, 0.3],
      [0.95, 1.0, 0.85],
      [0.02, 0.08, 0.02],
      [0.2, 0.5, 0.08],
      [0.45, 0.82, 0.35],
    ],
    spark: [0.9, 1.0, 0.75],
  },
  {

    name: "Molten",
    stops: [
      [1.0, 0.55, 0.2],
      [1.0, 0.92, 0.6],
      [0.12, 0.01, 0.0],
      [0.55, 0.1, 0.04],
      [0.9, 0.42, 0.16],
    ],
    spark: [1.0, 0.85, 0.5],
  },
  {

    name: "Sapphire",
    stops: [
      [0.35, 0.55, 0.98],
      [0.85, 0.95, 1.0],
      [0.01, 0.02, 0.08],
      [0.08, 0.16, 0.55],
      [0.28, 0.45, 0.9],
    ],
    spark: [0.82, 0.92, 1.0],
  },
];

export const DEFAULT_RAMP = 0;
export const WORD = "metal";

export const FONT_CSS = "var(--font-neue-montreal)";
export const FONT_WEIGHT = 600;

```

### chrome/text-mask.ts

```ts
import { FONT_WEIGHT as WEIGHT } from "./params";

export async function makeChromeField(
  word: string,
  blurPx: number,
  w: number,
  h: number,
  fontFamily: string,
): Promise<HTMLCanvasElement> {
  const W = Math.max(1, Math.round(w));
  const H = Math.max(1, Math.round(h));

  const crisp = document.createElement("canvas");
  crisp.width = W;
  crisp.height = H;
  const cx = crisp.getContext("2d")!;

  const text = (word || "").trim();
  if (text) {

    let size = H * 0.56;
    cx.font = `${WEIGHT} ${size}px ${fontFamily}`;
    const maxW = W * 0.82;
    const measured = cx.measureText(text).width;
    if (measured > maxW) {
      size *= maxW / measured;
      cx.font = `${WEIGHT} ${size}px ${fontFamily}`;
    }
    cx.fillStyle = "#fff";
    cx.textAlign = "center";
    cx.textBaseline = "middle";

    const ls = size * -0.05;
    const chars = [...text];
    const widths = chars.map((c) => cx.measureText(c).width);
    const total = widths.reduce((a, b) => a + b, 0) + ls * (chars.length - 1);
    let x = W / 2 - total / 2;
    cx.textAlign = "left";
    for (let i = 0; i < chars.length; i++) {
      cx.fillText(chars[i], x, H * 0.5);
      x += widths[i] + ls;
    }
  }

  const wide = blurTo(crisp, W, H, Math.max(0.5, blurPx * 1.15));

  const tight = blurTo(crisp, W, H, Math.max(0.5, blurPx * 0.4));

  const cData = cx.getImageData(0, 0, W, H).data;
  const wData = wide.getContext("2d")!.getImageData(0, 0, W, H).data;
  const tData = tight.getContext("2d")!.getImageData(0, 0, W, H).data;
  const out = document.createElement("canvas");
  out.width = W;
  out.height = H;
  const ox = out.getContext("2d")!;
  const packed = ox.createImageData(W, H);
  const p = packed.data;
  for (let i = 0; i < p.length; i += 4) {
    p[i] = cData[i + 3];
    p[i + 1] = wData[i + 3];
    p[i + 2] = tData[i + 3];
    p[i + 3] = 255;
  }
  ox.putImageData(packed, 0, 0);
  return out;
}

function blurTo(
  src: HTMLCanvasElement,
  W: number,
  H: number,
  px: number,
): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const x = c.getContext("2d")!;
  x.filter = `blur(${px.toFixed(2)}px)`;
  x.drawImage(src, 0, 0);
  x.filter = "none";
  return c;
}

```

### chrome/shaders.ts

```ts
export const CHROME_VERT = `
attribute vec2 aPosition;
attribute vec2 aUV;
varying vec2 vUV;
void main() {
  vUV = aUV;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

export const CHROME_FRAG = `
precision highp float;

varying vec2 vUV;

uniform sampler2D uField;
uniform vec2  uTexel;
uniform vec2  uTilt;
uniform float uAspect;
uniform float uTime;

uniform vec3  uS0;
uniform vec3  uS1;
uniform vec3  uS2;
uniform vec3  uS3;
uniform vec3  uS4;
uniform vec3  uSpark;

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  float a = hash(i), b = hash(i+vec2(1.,0.)), c = hash(i+vec2(0.,1.)), d = hash(i+vec2(1.,1.));
  vec2 u = f*f*(3.-2.*f);
  return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
}

float heightAt(vec2 uv){
  vec4 f = texture2D(uField, uv);
  return f.g + f.b * 0.18;
}

vec3 ramp(float t){
  t = clamp(t, 0.0, 1.0);
  float x = t * 4.0;
  vec3 col = uS0;
  col = mix(col, uS1, smoothstep(0.0, 1.0, clamp(x - 0.0, 0.0, 1.0)));
  col = mix(col, uS2, smoothstep(0.0, 1.0, clamp(x - 1.0, 0.0, 1.0)));
  col = mix(col, uS3, smoothstep(0.0, 1.0, clamp(x - 2.0, 0.0, 1.0)));
  col = mix(col, uS4, smoothstep(0.0, 1.0, clamp(x - 3.0, 0.0, 1.0)));
  return col;
}

float envT(vec2 env){
  float t = clamp(0.5 - env.y * 0.9, 0.0, 1.0);
  t = t + (t - 0.5) * 0.35 * (1.0 - abs(env.x));
  return clamp(t, 0.0, 1.0);
}

vec3 toneMap(vec3 c){
  return c / (c + vec3(0.85)) * 1.85;
}

float fbm(vec2 p){
  return noise(p) * 0.6 + noise(p * 2.1 + 4.0) * 0.3 + noise(p * 4.3 + 9.0) * 0.1;
}

vec3 background(vec2 uv){
  vec2 p = uv * vec2(uAspect, 1.0);
  float t = uTime * 0.08;

  float f1 = fbm(p * 1.4 + vec2(t, -t * 0.7));
  float f2 = fbm(p * 1.9 + vec2(-t * 0.8, t) + f1);

  vec3 poolA = uS0   * 0.16;
  vec3 poolB = uS3   * 0.5;
  vec3 poolC = uSpark* 0.1;
  vec3 col = uS4 * 0.04 + vec3(0.015);
  col = mix(col, poolA, smoothstep(0.35, 0.75, f1));
  col = mix(col, poolB, smoothstep(0.4, 0.85, f2));
  col = mix(col, poolC, smoothstep(0.6, 0.95, f1 * f2 * 1.6));

  vec2 c = (uv - vec2(0.5, 0.44)) * vec2(uAspect, 1.0);
  float radial = 1.0 - smoothstep(0.0, 0.95, length(c));
  col += (uS0 * 0.08 + vec3(0.02)) * radial;

  vec3 studioTint = mix(uS0, uS1, 0.4);

  float horizon = 1.0 - smoothstep(0.0, 0.16, abs(uv.y - 0.30));
  col += studioTint * 0.09 * horizon * 0.6;

  float ray = uv.x * uAspect * 0.5 + uv.y - fract(uTime * 0.03) * 2.0;
  col += studioTint * 0.07 * (1.0 - smoothstep(0.0, 0.22, abs(ray - 0.4))) * 0.5 * radial;

  float temp = clamp((uv.x - uv.y) * 0.5 + 0.5, 0.0, 1.0);
  col += mix(uS0 * 0.03, uSpark * 0.03, temp) * radial;

  col *= mix(0.45, 1.0, radial);

  col += (noise(p * 320.0) - 0.5) * 0.012;
  return col;
}

void main() {
  vec2 uv = vUV;

  vec2 wuv = uv - uTilt * 0.012;

  float crisp = texture2D(uField, wuv).r;
  float height = heightAt(wuv);

  vec3 bg = background(uv);

  float shadow = 0.0;
  shadow += texture2D(uField, wuv - vec2(0.004, 0.03)).g * 0.5;
  shadow += texture2D(uField, wuv - vec2(0.006, 0.055)).g * 0.3;
  shadow += texture2D(uField, wuv - vec2(0.008, 0.085)).g * 0.2;
  bg *= 1.0 - clamp(shadow, 0.0, 1.0) * 0.6;

  if (height < 0.01) {
    gl_FragColor = vec4(bg, 1.0);
    return;
  }

  float g1 = 1.6, g2 = 3.4;

  float aL = heightAt(wuv - vec2(g1,0.)*uTexel), aR = heightAt(wuv + vec2(g1,0.)*uTexel);
  float aD = heightAt(wuv - vec2(0.,g1)*uTexel), aU = heightAt(wuv + vec2(0.,g1)*uTexel);

  float bL = heightAt(wuv - vec2(g2,0.)*uTexel), bR = heightAt(wuv + vec2(g2,0.)*uTexel);
  float bD = heightAt(wuv - vec2(0.,g2)*uTexel), bU = heightAt(wuv + vec2(0.,g2)*uTexel);
  vec2 slope = (vec2(aR - aL, aU - aD) * 0.6 + vec2(bR - bL, bU - bD) * 0.4) * 22.0;
  vec3 N = normalize(vec3(-slope.x, -slope.y, 1.0));

  vec3 V = vec3(0.0, 0.0, 1.0);
  vec3 R = reflect(-V, N);

  float tt = uTime;
  vec2 fp = uv * vec2(uAspect, 1.0) * 1.6;
  vec2 flow = vec2(
    fbm(fp + vec2(tt * 0.25, height * 3.0)) - 0.5,
    fbm(fp + vec2(-tt * 0.2 + 5.0, tt * 0.15)) - 0.5
  ) * 0.55;
  flow += vec2(sin(tt * 0.31) * 0.1, cos(tt * 0.24) * 0.08);
  vec2 env = R.xy + uTilt + flow;

  vec3 sharpRefl = ramp(envT(env));
  vec3 blurRefl = vec3(0.0);
  const int NB = 6;
  for (int i = 0; i < NB; i++) {
    float a = float(i) / float(NB) * 6.2831853;
    vec2 j = vec2(cos(a), sin(a)) * 0.14;
    blurRefl += ramp(envT(env + j));
  }
  blurRefl /= float(NB);

  float rough = 0.4 + 0.25 * clamp(length(slope), 0.0, 1.0);
  vec3 metal = mix(sharpRefl, blurRefl, rough);

  float tMid = envT(env);
  vec3 envColor = background(clamp(uv + env * 0.35, 0.0, 1.0));
  float envMix = (1.0 - abs(tMid - 0.5) * 2.0) * 0.3;
  metal = mix(metal, metal + envColor * 2.0, envMix);

  float streak = smoothstep(0.35, 0.5, abs(env.x + sin(env.y*3.0)*0.1));
  metal += (1.0 - streak) * 0.1 * uS1;

  float fres = pow(1.0 - N.z, 2.2);
  metal += fres * uS1 * 0.45;

  vec3 keyDir = normalize(vec3(cos(tt * 0.22) * 0.7, 0.5 + sin(tt * 0.18) * 0.3, 0.9));
  vec3 Hh = normalize(keyDir + V);

  vec3 Na = normalize(vec3(N.x * 0.6, N.y, N.z));
  float ndh = max(dot(Na, Hh), 0.0);
  float spec = pow(ndh, 120.0);
  metal += spec * uSpark * 1.3;

  metal += pow(max(dot(N, Hh), 0.0), 16.0) * uS1 * 0.25;

  float sweepPos = fract(uTime * 0.16);
  float diag = (uv.x * uAspect + (1.0 - uv.y)) * 0.42;
  float band = 1.0 - smoothstep(0.0, 0.06, abs(diag - sweepPos * 1.4 + 0.2));
  float facing = clamp(N.x * -0.6 + N.y * 0.6 + 0.4, 0.0, 1.0);
  metal += band * facing * uSpark * 0.5;

  float curv = length(slope);
  float bright = smoothstep(0.62, 1.0, tMid) * smoothstep(0.4, 1.2, curv);
  float tw = 0.5 + 0.5 * sin(uTime * 2.0 + height * 40.0 + uv.x * 30.0);
  metal += bright * tw * tw * uSpark * 1.1;

  float ao = smoothstep(0.15, 0.7, texture2D(uField, wuv).g);
  metal *= 0.7 + ao * 0.3;

  float face = smoothstep(0.3, 0.55, crisp);
  metal *= 0.86 + face * 0.14;

  metal += (noise(uv * vec2(uAspect,1.0) * 520.0) - 0.5) * 0.035;

  vec3 c = toneMap(metal);

  c += (hash(uv * 1024.0 + fract(uTime)) - 0.5) * (1.5 / 255.0);
  c = clamp(c, 0.0, 1.0);

  float aa = smoothstep(0.16, 0.4, height);
  gl_FragColor = vec4(mix(bg, c, aa), 1.0);
}
`;

```

### chrome/engine.ts

```ts
import { CHROME_VERT, CHROME_FRAG } from "./shaders";
import { makeChromeField } from "./text-mask";
import { RAMPS, DEFAULT_RAMP, WORD, FONT_CSS, type ChromeRamp } from "./params";

function rampToFloats(r: ChromeRamp): number[] {
  const out: number[] = [];
  for (const s of r.stops) out.push(s[0], s[1], s[2]);
  out.push(r.spark[0], r.spark[1], r.spark[2]);
  return out;
}

export class Chrome {
  private host: HTMLElement;
  private canvas: HTMLCanvasElement;
  private gl: WebGLRenderingContext | null = null;
  private prog: WebGLProgram | null = null;
  private loc: Record<string, WebGLUniformLocation | null> = {};
  private quad: WebGLBuffer | null = null;
  private tex: WebGLTexture | null = null;
  private texW = 1;
  private texH = 1;

  private raf = 0;
  private running = false;
  private awake = false;

  private w = 0;
  private h = 0;
  private dpr = 1;
  private fontFamily = `${FONT_CSS}, sans-serif`;
  private word = WORD;
  private rampIdx = DEFAULT_RAMP;

  private curRamp: number[] = rampToFloats(RAMPS[DEFAULT_RAMP]);
  private targetRamp: number[] = rampToFloats(RAMPS[DEFAULT_RAMP]);

  private builtW = 0;
  private builtH = 0;
  private builtFont = "";
  private builtWord = "";
  private buildScheduled = 0;
  private destroyed = false;
  private painted = false;
  private t0 = performance.now();

  private tx = 0;
  private ty = 0;
  private ttx = 0;
  private tty = 0;

  ok = false;

  constructor(host: HTMLElement, fontFamily?: string) {
    this.host = host;
    if (fontFamily) this.fontFamily = fontFamily;
    this.canvas = document.createElement("canvas");
    Object.assign(this.canvas.style, {
      position: "absolute",
      inset: "0",
      width: "100%",
      height: "100%",
      display: "block",
      opacity: "0",
    });
    host.appendChild(this.canvas);

    const gl = this.canvas.getContext("webgl", {
      alpha: false,
      antialias: false,
      premultipliedAlpha: false,
    });
    if (!gl) return;
    this.gl = gl;

    try {
      this.prog = this.build(CHROME_VERT, CHROME_FRAG);
    } catch {
      this.gl = null;
      return;
    }

    const p = this.prog;
    for (const u of [
      "uField", "uTexel", "uTilt", "uAspect", "uTime",
      "uS0", "uS1", "uS2", "uS3", "uS4", "uSpark",
    ]) {
      this.loc[u] = gl.getUniformLocation(p, u);
    }
    const aPos = gl.getAttribLocation(p, "aPosition");
    const aUV = gl.getAttribLocation(p, "aUV");
    const data = new Float32Array([
      -1, -1, 0, 1,
       1, -1, 1, 1,
      -1,  1, 0, 0,
       1,  1, 1, 0,
    ]);
    this.quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    gl.useProgram(p);
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(aUV);
    gl.vertexAttribPointer(aUV, 2, gl.FLOAT, false, 16, 8);

    gl.clearColor(0.045, 0.048, 0.055, 1);

    this.resize();
    void this.buildFieldNow();

    this.canvas.addEventListener("pointermove", this.onMove);
    this.canvas.addEventListener("pointerleave", this.onLeave);
    this.ok = true;
  }

  private build(vs: string, fs: string): WebGLProgram {
    const gl = this.gl!;
    const c = (type: number, src: string) => {
      const sh = gl.createShader(type)!;
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        throw new Error(gl.getShaderInfoLog(sh) || "compile failed");
      }
      return sh;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, c(gl.VERTEX_SHADER, vs));
    gl.attachShader(prog, c(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(prog) || "link failed");
    }
    return prog;
  }

  setFont(family: string) {
    if (family === this.fontFamily) return;
    this.fontFamily = family;
    this.scheduleBuild();
  }

  setWord(word: string) {
    if (word === this.word) return;
    this.word = word;
    this.scheduleBuild();
  }

  setRamp(i: number) {
    this.rampIdx = ((i % RAMPS.length) + RAMPS.length) % RAMPS.length;

    this.targetRamp = rampToFloats(RAMPS[this.rampIdx]);
    this.wake();
  }

  private wake() {
    if (this.awake && !this.running) this.start();
    else if (!this.running) this.render();
  }

  private onMove = (e: PointerEvent) => {
    const r = this.canvas.getBoundingClientRect();

    this.ttx = ((e.clientX - r.left) / r.width - 0.5) * 0.9;
    this.tty = ((e.clientY - r.top) / r.height - 0.5) * 0.9;
    this.wake();
  };

  private onLeave = () => {
    this.ttx = 0;
    this.tty = 0;
    this.wake();
  };

  resize() {
    const r = this.host.getBoundingClientRect();
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.w = r.width;
    this.h = r.height;
    const cw = Math.max(1, Math.round(this.w * this.dpr));
    const ch = Math.max(1, Math.round(this.h * this.dpr));
    if (this.canvas.width !== cw || this.canvas.height !== ch) {
      this.canvas.width = cw;
      this.canvas.height = ch;
      this.gl?.viewport(0, 0, cw, ch);
      this.scheduleBuild();
    }
  }

  private maskSize(): [number, number] {
    const MAX_W = 1400;
    const mw = Math.max(2, Math.min(MAX_W, Math.round(this.w * this.dpr)));
    const mh = Math.max(2, Math.round(mw * (this.h / Math.max(1, this.w))));
    return [mw, mh];
  }

  private scheduleBuild() {
    if (!this.gl || this.destroyed) return;
    const [mw, mh] = this.maskSize();
    if (
      mw === this.builtW && mh === this.builtH &&
      this.fontFamily === this.builtFont && this.word === this.builtWord
    ) {
      return;
    }
    if (this.buildScheduled) return;
    const run = () => {
      this.buildScheduled = 0;
      void this.buildFieldNow();
    };
    const ric = (window as unknown as {
      requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number;
    }).requestIdleCallback;
    this.buildScheduled = ric ? ric(run, { timeout: 200 }) : window.setTimeout(run, 0);
  }

  private async buildFieldNow() {
    const gl = this.gl;
    if (!gl || this.destroyed) return;
    if (this.buildScheduled) {
      const cic = (window as unknown as { cancelIdleCallback?: (id: number) => void }).cancelIdleCallback;
      if (cic) cic(this.buildScheduled);
      else window.clearTimeout(this.buildScheduled);
      this.buildScheduled = 0;
    }
    const [mw, mh] = this.maskSize();
    this.builtW = mw;
    this.builtH = mh;
    this.builtFont = this.fontFamily;
    this.builtWord = this.word;
    const blur = Math.max(1.5, mh * 0.012);
    const art = await makeChromeField(this.word, blur, mw, mh, this.fontFamily);
    if (!this.gl || this.destroyed) return;
    if (!this.tex) this.tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, art);
    this.texW = art.width;
    this.texH = art.height;
    if (!this.running) this.render();
  }

  start() {
    if (!this.ok) return;
    this.awake = true;
    if (this.running) return;
    this.running = true;
    this.resize();
    const loop = () => {
      if (!this.running) return;
      this.frame();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    this.awake = false;
    this.pause();
  }

  private pause() {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  private frame() {
    const k = 0.1;
    this.tx += (this.ttx - this.tx) * k;
    this.ty += (this.tty - this.ty) * k;

    const ck = 0.08;
    for (let i = 0; i < this.curRamp.length; i++) {
      this.curRamp[i] += (this.targetRamp[i] - this.curRamp[i]) * ck;
    }
    this.render();
  }

  private rampSettling(): boolean {
    for (let i = 0; i < this.curRamp.length; i++) {
      if (Math.abs(this.curRamp[i] - this.targetRamp[i]) > 0.002) return true;
    }
    return false;
  }

  renderStill() {
    this.resize();
    void this.buildFieldNow();
    this.render();
  }

  private render() {
    const gl = this.gl;
    if (!gl || !this.prog || !this.tex) return;

    gl.useProgram(this.prog);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.uniform1i(this.loc.uField, 0);
    gl.uniform2f(this.loc.uTexel, 1 / this.texW, 1 / this.texH);
    gl.uniform2f(this.loc.uTilt, this.tx, this.ty);
    gl.uniform1f(this.loc.uAspect, this.w / Math.max(1, this.h));
    gl.uniform1f(this.loc.uTime, (performance.now() - this.t0) / 1000);

    const r = this.curRamp;
    gl.uniform3f(this.loc.uS0, r[0], r[1], r[2]);
    gl.uniform3f(this.loc.uS1, r[3], r[4], r[5]);
    gl.uniform3f(this.loc.uS2, r[6], r[7], r[8]);
    gl.uniform3f(this.loc.uS3, r[9], r[10], r[11]);
    gl.uniform3f(this.loc.uS4, r[12], r[13], r[14]);
    gl.uniform3f(this.loc.uSpark, r[15], r[16], r[17]);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    if (!this.painted) {
      this.painted = true;
      this.canvas.style.opacity = "1";
    }

    if (
      !this.awake &&
      !this.rampSettling() &&
      Math.abs(this.tx - this.ttx) < 0.001 &&
      Math.abs(this.ty - this.tty) < 0.001
    ) {
      this.pause();
    }
  }

  destroy() {
    this.destroyed = true;
    if (this.buildScheduled) {
      const cic = (window as unknown as { cancelIdleCallback?: (id: number) => void }).cancelIdleCallback;
      if (cic) cic(this.buildScheduled);
      else window.clearTimeout(this.buildScheduled);
      this.buildScheduled = 0;
    }
    this.stop();
    this.canvas.removeEventListener("pointermove", this.onMove);
    this.canvas.removeEventListener("pointerleave", this.onLeave);
    const gl = this.gl;
    if (gl) {
      if (this.tex) gl.deleteTexture(this.tex);
      if (this.quad) gl.deleteBuffer(this.quad);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    }
    this.canvas.remove();
  }
}

```



20. Build this: a dense grid of CIRCLES that touch, with a symbol cut OUT of them as negative space — nothing is ever drawn on top, the glyph is the HOLE and the flat background shows through the mesh. THE GRID: ~42 circles across, on a square lattice at EXACTLY the pitch, so neighbours meet. The little concave diamonds between every four touching circles are the texture, and they only exist when the circles actually meet — pull them apart even slightly and the field stops being one connected surface and turns into polka dots on a background. The grid is INSET with a clear margin on all four sides (pitch derived from the width INCLUDING a 0.75-pitch margin per side, then only WHOLE rows fitted into the remaining height and centred) — a grid that bleeds off the edge produces half-circles at the frame, which read as a rendering bug rather than a crop. TWO STATES, CONTINUOUSLY BETWEEN: a cell is not simply present or absent. It opens from a solid disc into a RING by boring a hole outward from its centre, and every intermediate radius is valid, so a cell animates its own state change instead of snapping. Rings are punched as reverse-wound inner circles into ONE accumulating Path2D under the even-odd rule and the whole field is filled in a SINGLE submission — not a stroked pass per cell. That is the difference between a smooth card and a stuttering one: a few thousand per-cell draw calls is what makes this lag, one composite path is what fixes it. THE SYMBOL: rasterize the glyph on a 2D canvas AT GRID RESOLUTION (one sample per cell, not big-then-downsampled) and remove every circle the glyph covers. Size it to about 58% of the grid height with a margin of intact lattice all round, so it reads as a hole punched in a surface rather than a frame. Only bold, closed, high-contrast forms survive at this cell count — thin strokes and fine joins (arrows, punctuation, most lowercase) dissolve into noise. SIX SCENES ON TWO INDEPENDENT PATTERN AXES: one letter (A) and five full-bleed patterns (rings, columns, checker, boxes, bars). The scene CARVES; a second pattern (drift / grain / swell / streak) simultaneously TEXTURES whichever cells the carve leaves standing, so two patterns are legible at once. The pair is always chosen to differ in AXIS from the cut — a diagonal texture under a square cut, rings under a brick cut — because two patterns on the same axis just read as one blurry pattern. The single letter is the only contained figure in the cycle, which is what gives it weight: surrounded by five moments where the whole surface reorganises, one centred shape lands as an event rather than another slide. THE TRANSITIONS: each scene arrives with both its own TIMING and its own MOTION. Timing is a per-cell delay — a diagonal wipe front, a ripple expanding from the centre, a per-cell random scatter, a collapse where the centre goes last out and first in, and a left-to-right column shutter. Motion is the second axis and is what stops every transition looking like the same fade reordered: as a cell changes it also travels — leaning along the wipe direction, lifting vertically on the ripple, flicking off at its own angle on the scatter, swelling before it pops on the collapse, sinking downward on the columns. Cells interpolate FROM their previous state TO the next one; starting every cell from zero makes open rings snap shut on the first morph frame, which reads as a glitch before the transition rather than as the transition. Keep the travel SMALL (well under one cell) and cap the swell so a growing cell never collides with its neighbour; the lattice has to stay legible throughout, otherwise cells read as loose particles instead of a surface. Each cell only moves during a short slice of the morph, so the field is completely still during the hold and every change is over quickly. Two-tone palettes cross-blend as scenes change, and the circle colour and background colour are always a matched pair so the glyph keeps reading as negative space. A pointer brush retracts circles near the cursor with a squared falloff, so you can rub the mesh away and watch it flow back. Framework-free Canvas 2D (arc() gives perfect edges for free, no shader) + a rAF loop; DPR-capped, pauses offscreen / when hidden / during route transitions, one static frame under reduced motion.

The complete, self-contained implementation follows, one file per block. It is framework-agnostic core logic — wire it into your own component and mount it on an element.

### dotcut/scenes.ts

```ts
export interface Scene {

  kind: "text" | "rings" | "checker" | "bars" | "columns" | "boxes";
  value?: string;

  transition: TransitionKind;

  palette: number;

  style?: StyleKind;
}

export type TransitionKind =

  | "wipe"

  | "ripple"

  | "scatter"

  | "collapse"

  | "columns";

export function cellMotion(
  kind: TransitionKind,

  t: number,

  dir: number,
  rand: number,
): { scale: number; dx: number; dy: number; spin: number } {

  const u = Math.sin(Math.min(1, Math.max(0, t)) * Math.PI);
  switch (kind) {
    case "wipe":

      return { scale: 1, dx: u * 0.16 * -dir, dy: 0, spin: 0 };
    case "ripple":

      return { scale: 1 - u * 0.10, dx: 0, dy: u * -0.13, spin: 0 };
    case "scatter":

      return {
        scale: 1,
        dx: u * 0.18 * Math.cos(rand * Math.PI * 2),
        dy: u * 0.18 * Math.sin(rand * Math.PI * 2),
        spin: 0,
      };
    case "collapse":

      return { scale: 1 - u * 0.18, dx: 0, dy: 0, spin: 0 };
    case "columns":

      return { scale: 1, dx: 0, dy: u * 0.22, spin: 0 };
  }
}

export type StyleKind = "drift" | "grain" | "swell" | "streak" | null;

function smooth01(v: number, e0: number, e1: number): number {
  const t = Math.min(1, Math.max(0, (v - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

function hash2(x: number, y: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

export const SCENES: Scene[] = [
  { kind: "text", value: "A", transition: "wipe", palette: 0, style: "drift" },
  { kind: "rings", transition: "ripple", palette: 1, style: "grain" },
  { kind: "columns", transition: "columns", palette: 2, style: "streak" },
  { kind: "checker", transition: "scatter", palette: 3, style: "swell" },
  { kind: "boxes", transition: "collapse", palette: 4, style: "grain" },
  { kind: "bars", transition: "wipe", palette: 5, style: "drift" },
];

export function styleField(
  scene: Scene,
  cols: number,
  rows: number,
  t: number,
  out: Float32Array,

  prev?: Scene,
) {
  const cx = (cols - 1) / 2;
  const cy = (rows - 1) / 2;
  const maxR = Math.hypot(cols, rows) / 2;

  const FLIP = 0.32;

  const stateOf = (style: StyleKind | undefined, x: number, y: number): number => {
    switch (style) {
      case "drift": {

        const a = Math.sin(x * 0.41 + y * 0.23);
        const b = Math.sin(x * 0.17 - y * 0.53 + 2.1);
        return smooth01((a + b) * 0.5, -0.15, 0.75);
      }
      case "grain": {

        const n =
          hash2(x, y) * 0.55 +
          hash2(x + 1, y) * 0.15 +
          hash2(x, y + 1) * 0.15 +
          hash2(x + 1, y + 1) * 0.15;
        return smooth01(n, 0.34, 0.86);
      }
      case "swell": {

        const d = Math.hypot(x - cx, y - cy) / maxR;
        const warp = Math.sin(Math.atan2(y - cy, x - cx) * 3.0) * 0.14;
        return smooth01(1 - (d + warp), 0.28, 0.92);
      }
      case "streak": {

        const s = Math.sin(x * 0.28 + y * 0.62);
        const cut = Math.sin(x * 0.09 - y * 0.11 + 1.3) * 0.5 + 0.5;
        return smooth01(s * cut, -0.05, 0.7);
      }
      default:
        return 0;
    }
  };

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {

      let order = 0;
      switch (scene.style) {
        case "drift":

          order = (x / cols) * 0.75 + Math.sin(y * 0.5) * 0.12 + 0.12;
          break;
        case "grain":
          order = (x / cols) * 0.55 + (y / rows) * 0.25 + hash2(x, y) * 0.2;
          break;
        case "swell":
          order = Math.hypot(x - cx, y - cy) / maxR;
          break;
        case "streak":
          order = (x / cols) * 0.8 + (y / rows) * 0.2;
          break;
      }

      const from = stateOf(prev?.style ?? scene.style, x, y);
      const to = stateOf(scene.style, x, y);
      const u = Math.min(1, Math.max(0, (t - order * (1 - FLIP)) / FLIP));
      const eased = u * u * (3 - 2 * u);
      out[y * cols + x] = from + (to - from) * eased;
    }
  }
}

export const PALETTES: [string, string][] = [
  ["#8aa9ff", "#1f45f5"],
  ["#ffd166", "#e5484d"],
  ["#b8f2c9", "#0f8a5f"],
  ["#ffc2e2", "#c81d77"],
  ["#c7d2fe", "#4338ca"],
  ["#fde68a", "#b45309"],
];

export function rasterize(
  scene: Scene,
  cols: number,
  rows: number,
  fontFamily: string,
): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(new ArrayBuffer(cols * rows)).fill(1);

  const cx = (cols - 1) / 2;
  const cy = (rows - 1) / 2;

  if (scene.kind === "checker") {

    const b = Math.max(2, Math.round(cols / 14));
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if ((Math.floor(x / b) + Math.floor(y / b)) % 2 === 0) out[y * cols + x] = 0;
      }
    }
    return out;
  }

  if (scene.kind === "bars") {

    const period = 3;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if (Math.floor((x + y) / period) % 2 === 0) out[y * cols + x] = 0;
      }
    }
    return out;
  }

  if (scene.kind === "columns") {

    const bw = 4;
    const bh = 3;
    for (let y = 0; y < rows; y++) {
      const band = Math.floor(y / bh);
      const shift = band % 2 === 0 ? 0 : bw / 2;
      for (let x = 0; x < cols; x++) {
        if (Math.floor((x + shift) / bw) % 2 === 0) out[y * cols + x] = 0;
      }
    }
    return out;
  }

  if (scene.kind === "boxes") {

    const period = 2.5;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const d = Math.max(Math.abs(x - cx), Math.abs(y - cy));
        if (Math.floor(d / period) % 2 === 0) out[y * cols + x] = 0;
      }
    }
    return out;
  }

  if (scene.kind === "rings") {

    const maxR = Math.hypot(cols, rows) / 2;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const d = Math.hypot(x - cx, y - cy) / maxR;
        if (Math.floor(d * 6.0) % 2 === 0) out[y * cols + x] = 0;
      }
    }
    return out;
  }

  const cv = document.createElement("canvas");
  cv.width = cols;
  cv.height = rows;
  const ctx = cv.getContext("2d", { willReadFrequently: true });
  if (!ctx) return out;

  const text = (scene.value || "").trim();
  if (!text) return out;

  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, cols, rows);
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  let size = rows * 0.80;
  ctx.font = `600 ${size}px ${fontFamily}`;
  const maxW = cols * 0.36;
  const m = ctx.measureText(text);
  if (m.width > maxW) {
    size *= maxW / m.width;
    ctx.font = `600 ${size}px ${fontFamily}`;
  }

  const maxH = rows * 0.58;
  const mm = ctx.measureText(text);
  const gh = mm.actualBoundingBoxAscent + mm.actualBoundingBoxDescent;
  if (gh > maxH) {
    size *= maxH / gh;
    ctx.font = `600 ${size}px ${fontFamily}`;
  }
  ctx.fillText(text, cols / 2, rows / 2 + rows * 0.02);

  const data = ctx.getImageData(0, 0, cols, rows).data;
  for (let i = 0; i < cols * rows; i++) {

    if (data[i * 4] > 110) out[i] = 0;
  }
  return out;
}

export function cellDelay(
  kind: TransitionKind,
  x: number,
  y: number,
  cols: number,
  rows: number,
  rand: number,
): number {
  const fx = cols > 1 ? x / (cols - 1) : 0;
  const fy = rows > 1 ? y / (rows - 1) : 0;
  switch (kind) {
    case "wipe":

      return Math.min(1, Math.max(0, (fx * 0.75 + fy * 0.25) * 0.85 + rand * 0.15));
    case "ripple": {
      const d = Math.hypot(fx - 0.5, fy - 0.5) / 0.707;
      return Math.min(1, d * 0.9 + rand * 0.10);
    }
    case "scatter":
      return rand;
    case "collapse": {

      const d = Math.hypot(fx - 0.5, fy - 0.5) / 0.707;
      return Math.min(1, (1 - d) * 0.85 + rand * 0.15);
    }
    case "columns":

      return Math.min(1, fx * 0.9 + rand * 0.10);
  }
}

```

### dotcut/engine.ts

```ts
import {
  PALETTES,
  SCENES,
  cellDelay,
  cellMotion,
  rasterize,
  styleField,
  type Scene,
} from "./scenes";

const COLS = 42;

const HOLD_MS = 600;
const MORPH_MS = 520;

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

function hash(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

export interface DotCutParams {

  cols: number;

  squareness: number;

  hold: number;

  morph: number;

  brush: number;

  fill: number;
}

export const DEFAULTS: DotCutParams = {
  cols: COLS,
  squareness: 0,
  hold: HOLD_MS,
  morph: MORPH_MS,

  brush: 1.6,

  fill: 1.0,
};

export class DotCut {
  private host: HTMLElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null = null;

  readonly params: DotCutParams = { ...DEFAULTS };

  private cols = COLS;
  private rows = 12;
  private pitch = 10;
  private ox = 0;
  private oy = 0;

  private target = new Uint8Array(0);

  private live = new Float32Array(0);

  private from = new Float32Array(0);

  private delay = new Float32Array(0);

  private rnd = new Float32Array(0);

  private prog = new Float32Array(0);

  private dir = new Float32Array(0);

  private bore = new Float32Array(0);

  private styleT = 0;

  private sceneIdx = 0;
  private phase: "hold" | "morph" = "hold";
  private phaseT = 0;
  private clock = 0;

  private paletteMix = 1;
  private prevPalette = 0;

  private prevScene = 0;

  private pointer: { x: number; y: number } | null = null;
  private raf = 0;
  private last = 0;
  private running = false;
  private dpr = 1;
  private ro: ResizeObserver | null = null;
  private disposed = false;
  private fontFamily = "sans-serif";

  constructor(host: HTMLElement, fontFamily?: string) {
    this.host = host;
    if (fontFamily) this.fontFamily = fontFamily;
    this.canvas = document.createElement("canvas");
    this.canvas.style.cssText = "display:block;width:100%;height:100%";
    host.appendChild(this.canvas);
    this.ctx = this.canvas.getContext("2d");
    if (!this.ctx) return;

    this.resize();
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(host);
  }

  get ok() {
    return !!this.ctx;
  }

  private applyScene(scene: Scene, instant: boolean) {
    const next = rasterize(scene, this.cols, this.rows, this.fontFamily);
    this.from.set(this.live);
    this.target = next;
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        const i = y * this.cols + x;
        this.delay[i] = cellDelay(
          scene.transition,
          x,
          y,
          this.cols,
          this.rows,
          this.rnd[i],
        );
      }
    }
    if (instant) {
      for (let i = 0; i < next.length; i++) this.live[i] = next[i];
      this.from.set(this.live);
    }
  }

  private resize() {
    const ctx = this.ctx;
    if (!ctx || this.disposed) return;
    const w = this.host.clientWidth;
    const h = this.host.clientHeight;
    if (!w || !h) return;

    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);

    const margin = 0.75;
    this.cols = Math.max(6, Math.round(this.params.cols));
    this.pitch = w / (this.cols + 2 * margin);
    this.rows = Math.max(3, Math.floor((h - 2 * margin * this.pitch) / this.pitch));

    this.ox = (w - this.cols * this.pitch) / 2;
    this.oy = (h - this.rows * this.pitch) / 2;

    const n = this.cols * this.rows;
    this.target = new Uint8Array(n);
    this.live = new Float32Array(n);
    this.from = new Float32Array(n);
    this.delay = new Float32Array(n);
    this.rnd = new Float32Array(n);
    this.prog = new Float32Array(n);
    this.dir = new Float32Array(n);
    this.bore = new Float32Array(n);
    for (let i = 0; i < n; i++) this.rnd[i] = hash(i * 1.37 + 0.5);

    this.applyScene(SCENES[this.sceneIdx], true);
    if (!this.running) this.draw(0);
  }

  setParams(p: Partial<DotCutParams>) {
    const needsGrid = p.cols !== undefined && p.cols !== this.params.cols;
    Object.assign(this.params, p);
    if (needsGrid) this.resize();
  }

  setPointer(p: { x: number; y: number } | null) {
    this.pointer = p;
  }

  advance() {
    this.prevScene = this.sceneIdx;
    this.sceneIdx = (this.sceneIdx + 1) % SCENES.length;
    this.prevPalette = SCENES[(this.sceneIdx - 1 + SCENES.length) % SCENES.length].palette;
    this.paletteMix = 0;
    this.phase = "morph";
    this.phaseT = 0;
    this.styleT = 0;
    this.applyScene(SCENES[this.sceneIdx], false);
  }

  private step(dt: number) {
    this.clock += dt;
    this.phaseT += dt * 1000;

    if (this.phase === "hold" && this.phaseT >= this.params.hold) {
      this.advance();
    } else if (this.phase === "morph" && this.phaseT >= this.params.morph) {
      this.phase = "hold";
      this.phaseT = 0;
    }

    const p = this.phase === "morph" ? Math.min(1, this.phaseT / this.params.morph) : 1;
    const n = this.cols * this.rows;
    for (let i = 0; i < n; i++) {

      const d = this.delay[i];
      const local = Math.min(1, Math.max(0, (p - d * 0.72) / 0.28));
      const e = easeOut(local);
      this.live[i] = this.from[i] + (this.target[i] - this.from[i]) * e;

      const changing = this.from[i] !== this.target[i] && this.phase === "morph";
      this.prog[i] = changing ? local : 0;
      this.dir[i] = this.target[i] > this.from[i] ? 1 : -1;
    }

    this.paletteMix = Math.min(1, this.paletteMix + dt * 2.2);

    this.styleT =
      this.phase === "morph"
        ? Math.min(1, this.styleT + dt / (this.params.morph / 1000))
        : 1;
    styleField(
      SCENES[this.sceneIdx],
      this.cols,
      this.rows,
      this.styleT,
      this.bore,
      SCENES[this.prevScene],
    );
  }

  private draw(dt: number) {
    const ctx = this.ctx;
    if (!ctx) return;
    this.step(dt);

    const W = this.canvas.width;
    const H = this.canvas.height;
    const s = this.dpr;
    const scene = SCENES[this.sceneIdx];

    const [cA, bA] = PALETTES[this.prevPalette % PALETTES.length];
    const [cB, bB] = PALETTES[scene.palette % PALETTES.length];
    const m = easeInOut(this.paletteMix);
    const circle = mixHex(cA, cB, m);
    const back = mixHex(bA, bB, m);

    ctx.fillStyle = back;
    ctx.fillRect(0, 0, W, H);

    const pitch = this.pitch * s;
    const r = pitch / 2;
    const sq = Math.max(0, Math.min(1, this.params.squareness));

    ctx.fillStyle = circle;

    const solidPath = new Path2D();

    const stroke = Math.max(1.1 * s, r * 0.30);
    const brush = this.params.brush;

    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        const i = y * this.cols + x;
        let v = this.live[i];
        if (v <= 0.004) continue;

        if (this.pointer && brush > 0) {
          const d = Math.hypot(x + 0.5 - this.pointer.x, y + 0.5 - this.pointer.y);
          if (d < brush) v *= Math.min(1, (d / brush) ** 2);
        }
        if (v <= 0.004) continue;

        const mo = cellMotion(scene.transition, this.prog[i], this.dir[i], this.rnd[i]);

        const cx = this.ox * s + (x + 0.5) * pitch + mo.dx * pitch;
        const cy = this.oy * s + (y + 0.5) * pitch + mo.dy * pitch;

        const pop = 1;
        const rr = r * v * pop * mo.scale * this.params.fill;
        if (rr <= 0.3) continue;

        const canRing = rr > 3.2 * s;
        const bore = canRing ? (rr - stroke) * this.bore[i] : 0;

        solidPath.moveTo(cx + rr, cy);
        if (sq < 0.02) {
          solidPath.arc(cx, cy, rr, 0, Math.PI * 2);
        } else {

          roundedSquare(solidPath, cx, cy, rr, sq);
        }
        if (bore > 0.4) {

          solidPath.moveTo(cx + bore, cy);
          solidPath.arc(cx, cy, bore, 0, Math.PI * 2, true);
        }
      }
    }

    ctx.fill(solidPath, "evenodd");
  }

  renderStill() {
    this.phase = "hold";
    this.phaseT = 0;
    this.paletteMix = 1;
    this.applyScene(SCENES[this.sceneIdx], true);
    this.draw(0);
  }

  start() {
    if (this.running || !this.ok || this.disposed) return;
    this.running = true;
    this.last = performance.now();
    const tick = (now: number) => {
      if (!this.running) return;
      const dt = Math.min((now - this.last) / 1000, 1 / 30);
      this.last = now;
      this.draw(dt);
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  stop() {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  destroy() {
    this.disposed = true;
    this.stop();
    this.ro?.disconnect();
    this.ro = null;
    this.ctx = null;
    this.canvas.remove();
  }

  toCell(px: number, py: number) {
    return { x: (px - this.ox) / this.pitch, y: (py - this.oy) / this.pitch };
  }
}

function roundedSquare(

  ctx: Pick<CanvasRenderingContext2D, "moveTo" | "lineTo" | "closePath">,
  cx: number,
  cy: number,
  r: number,
  sq: number,
) {
  const n = 2 + sq * 8;
  const steps = 22;
  ctx.moveTo(cx + r, cy);
  for (let i = 1; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    const c = Math.cos(t);
    const s = Math.sin(t);
    const x = Math.sign(c) * Math.pow(Math.abs(c), 2 / n) * r;
    const y = Math.sign(s) * Math.pow(Math.abs(s), 2 / n) * r;
    ctx.lineTo(cx + x, cy + y);
  }
  ctx.closePath();
}

function mixHex(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const r = Math.round((((pa >> 16) & 255) * (1 - t) + ((pb >> 16) & 255) * t));
  const g = Math.round((((pa >> 8) & 255) * (1 - t) + ((pb >> 8) & 255) * t));
  const bl = Math.round(((pa & 255) * (1 - t) + (pb & 255) * t));
  return `rgb(${r},${g},${bl})`;
}

```
