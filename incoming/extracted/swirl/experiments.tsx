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

