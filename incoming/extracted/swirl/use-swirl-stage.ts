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

