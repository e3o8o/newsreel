// Vanilla port of the swirl orchestration (originally a React hook,
// use-swirl-stage.ts in the source drop). Same pipeline: glyph atlas ->
// composeField -> instanced draw -> CRT pass. The capture harness always
// wants the loop running, so the IntersectionObserver play-band is gone;
// everything else is the hook's effect body, verbatim where possible.

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
  rows?: string[];
  word?: string;
  style?: FontStyle;
  inkStops: string[];
  logoColor: string;
  gradient: boolean;
  gradientAngle: number;
  gradientFlow: number;
  gradientMode?: InkMode;
  bg: string;
  text: string;
  scanlines: number;
  aberration: number;
  curvature: number;
  zoom: number;
  trail: boolean;
  trailStrength?: number;
  trailFlare?: string;
  shock: boolean;
  turbulence: number;
  wavePattern: WavePattern;
}

const BASE_ROWS = 22;
const VEL_SMOOTH = 5.0;
const SHOCK_LIFE = 2.4;

function resolveTarget(c: StageConfig): Target {
  if (c.rows && c.rows.length) return makeTarget(c.rows);
  return makeTarget(renderWord(c.word ?? " ", c.style ?? "slant"));
}

function targetKey(c: StageConfig): string {
  return c.rows ? "rows:" + c.rows.join("|") : `word:${c.word}:${c.style}`;
}

export class SwirlStage {
  private canvas: HTMLCanvasElement;
  private cfg: StageConfig;
  private r: Renderer | null = null;
  private raf = 0;
  private destroyed = false;

  private glyphs: string[] = [];
  private lookup: Record<string, number> = Object.create(null);
  private spaceSlot = 0;

  private source: string[] = [];
  private lastText = "";
  private target!: Target;
  private lastTargetKey = "";
  private lastZoom = 1;

  private atlas: GlyphAtlas | null = null;
  private grid: FieldGrid | null = null;
  private buffers: FieldBuffers | null = null;
  private lastCw = -1;
  private lastCh = -1;

  private pointer = { x: 0, y: 0, active: false };
  private trail = makeTrailField();
  private velX = 0;
  private velY = 0;
  private prevPx = 0;
  private prevPy = 0;
  private havePrev = false;
  private shocks: Shock[] = [];

  private startTime = 0;
  private prevTime = 0;

  ok = false;

  constructor(canvas: HTMLCanvasElement, cfg: StageConfig) {
    this.canvas = canvas;
    this.cfg = cfg;
    const r = createRenderer(canvas);
    if (!r) return;
    this.r = r;

    for (let code = 32; code <= 126; code++) this.addGlyph(String.fromCharCode(code));
    for (const cc of "█▓") this.addGlyph(cc);
    this.addGlyph(" ");
    this.spaceSlot = this.lookup[" "];

    this.source = cfg.text.split("\n").map((e) => e.replace(/\t/g, "    "));
    this.lastText = cfg.text;
    this.target = resolveTarget(cfg);
    this.lastTargetKey = targetKey(cfg);
    this.lastZoom = cfg.zoom;
    this.ok = true;
  }

  private addGlyph(cc: string) {
    if (this.lookup[cc] !== undefined) return;
    this.lookup[cc] = this.glyphs.length;
    this.glyphs.push(cc);
  }

  private slotOf = (cc: string, weight: number) => {
    const i = this.lookup[cc];
    return weight * this.glyphs.length + (i === undefined ? this.spaceSlot : i);
  };

  setConfig(patch: Partial<StageConfig>) {
    Object.assign(this.cfg, patch);
  }

  replay() {
    this.startTime = 0;
  }

  setPointer(p: { x: number; y: number } | null) {
    if (p) {
      this.pointer.x = p.x;
      this.pointer.y = p.y;
      this.pointer.active = true;
    } else this.pointer.active = false;
  }

  burst(x: number, y: number) {
    this.shocks.push({ x, y, age: 0 });
    if (this.shocks.length > 4) this.shocks.shift();
  }

  private rebuild(cw: number, ch: number) {
    const { round, max, floor } = Math;
    const c = this.cfg;
    const r = this.r!;
    const rows = max(8, round(BASE_ROWS / max(0.3, c.zoom)));
    this.atlas = buildAtlas(r.gl, r.glyphTex, r.scratch, this.glyphs, max(8, round(ch / rows)));
    const gridRows = max(this.target.rows.length, Math.ceil(ch / this.atlas.inkSize) + 1);
    const contentH = gridRows * this.atlas.inkSize;
    const cols = floor(cw / this.atlas.advance);
    this.grid = {
      cols,
      rows: gridRows,
      inkSize: this.atlas.inkSize,
      vOffset: round((ch - contentH) / 2),
      targetX: max(0, round((cols - (this.target.rows[0]?.length ?? 0)) / 2)),
      targetY: max(0, round((gridRows - this.target.rows.length) / 2)),
    };
    this.buffers = makeBuffers(gridRows * cols);
    r.allocCells(this.buffers);
    r.resizeTargets(cw, ch);
  }

  private frame = (time: number) => {
    if (this.destroyed || !this.r) return;
    const { round } = Math;
    const c = this.cfg;
    if (c.text !== this.lastText) {
      this.lastText = c.text;
      this.source = c.text.split("\n").map((e) => e.replace(/\t/g, "    "));
      this.lastCw = -1;
    }
    const tk = targetKey(c);
    if (tk !== this.lastTargetKey) {
      this.lastTargetKey = tk;
      this.target = resolveTarget(c);
      this.lastCw = -1;
      this.startTime = 0;
    }
    if (c.zoom !== this.lastZoom) {
      this.lastZoom = c.zoom;
      this.lastCw = -1;
    }

    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cw = round(rect.width * dpr);
    const ch = round(rect.height * dpr);
    if (cw > 0 && ch > 0 && (cw !== this.lastCw || ch !== this.lastCh)) {
      this.rebuild(cw, ch);
      this.lastCw = cw;
      this.lastCh = ch;
    }

    if (this.grid && this.atlas && this.buffers) {
      if (this.startTime === 0) this.startTime = time;
      if (this.prevTime === 0) this.prevTime = time;
      const elapsed = time - this.startTime;
      const dt = Math.min(0.05, Math.max(0.001, (time - this.prevTime) / 1000));
      this.prevTime = time;

      if (c.trail) {
        if (this.pointer.active) {
          const vSp = 1 - Math.exp(-VEL_SMOOTH * dt);
          if (this.havePrev) {
            this.velX += ((this.pointer.x - this.prevPx) / dt - this.velX) * vSp;
            this.velY += ((this.pointer.y - this.prevPy) / dt - this.velY) * vSp;
          }
          this.prevPx = this.pointer.x;
          this.prevPy = this.pointer.y;
          this.havePrev = true;
          depositTrail(this.trail, this.pointer.x, this.pointer.y, this.velX, this.velY, dt);
        } else {
          this.havePrev = false;
          this.velX *= Math.exp(-VEL_SMOOTH * dt);
          this.velY *= Math.exp(-VEL_SMOOTH * dt);
        }
        stepTrail(this.trail, dt);
      }

      if (this.shocks.length) {
        for (const s of this.shocks) s.age += dt;
        for (let i = this.shocks.length - 1; i >= 0; i--) {
          if (this.shocks[i].age > SHOCK_LIFE) this.shocks.splice(i, 1);
        }
      }

      const stops = (c.gradient ? c.inkStops : c.inkStops.slice(0, 1)).map(hexToRgb01);
      const paint: InkPaint = {
        stops: stops.length ? (stops as [number, number, number][]) : [[1, 1, 1]],
        angle: c.gradientAngle,
        flow: c.gradient ? elapsed * 0.001 * c.gradientFlow : 0,
        gradient: c.gradient && stops.length > 1,
        mode: c.gradientMode ?? "rows",
      };
      const bg = hexToRgb01(c.bg);
      const count = composeField({
        grid: this.grid,
        atlas: this.atlas,
        buffers: this.buffers,
        source: this.source.length ? this.source : [""],
        target: this.target,
        elapsed,
        paint,
        logo: hexToRgb01(c.logoColor),
        slotOf: this.slotOf,
        trail: c.trail ? this.trail : undefined,
        trailStrength: c.trailStrength,
        trailFlare: c.trailFlare ? hexToRgb01(c.trailFlare) : undefined,
        shocks: c.shock && this.shocks.length ? this.shocks : undefined,
        turbulence: c.turbulence,
        wavePattern: c.wavePattern,
      });
      this.r.drawField(count, this.grid, this.buffers, bg);
      this.r.drawCrt(elapsed * 0.001, cw, ch, {
        scanline: c.scanlines,
        aberration: c.aberration,
        curvature: c.curvature,
        bg,
      });
    }
    this.raf = requestAnimationFrame(this.frame);
  };

  start() {
    if (this.raf || !this.ok) return;
    this.prevTime = 0;
    this.raf = requestAnimationFrame(this.frame);
  }

  stop() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  destroy() {
    this.destroyed = true;
    this.stop();
    this.r?.dispose();
  }
}
