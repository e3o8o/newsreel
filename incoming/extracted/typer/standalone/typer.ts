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

