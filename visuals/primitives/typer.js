// src/typer/typer.ts
var clamp = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v;
var roundToStep = (v, step) => Math.round(v / step) * step;
var remap = (v, inLo, inHi, outLo, outHi) => (v - inLo) * (outHi - outLo) / (inHi - inLo) + outLo;
function bezierEase(x, x1, y1, x2, y2, eps = 1e-6) {
  const bx = (t2) => 3 * (1 - t2) ** 2 * t2 * x1 + 3 * (1 - t2) * t2 ** 2 * x2 + t2 ** 3;
  const by = (t2) => 3 * (1 - t2) ** 2 * t2 * y1 + 3 * (1 - t2) * t2 ** 2 * y2 + t2 ** 3;
  const bxDeriv = (t2) => 3 * (1 - t2) ** 2 * x1 + 6 * (1 - t2) * t2 * (x2 - x1) + 3 * t2 ** 2 * (1 - x2);
  let t = x;
  for (let i = 0; i < 8; i++) {
    const dx = bx(t) - x;
    if (Math.abs(dx) < eps) return by(t);
    const d = bxDeriv(t);
    if (Math.abs(d) < 1e-6) break;
    t -= dx / d;
  }
  let lo = 0, hi = 1;
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
var ALL_VARIATIONS = [
  "charFill",
  "charInverse",
  "charAccent",
  "charAccentInverse",
  "charAccentFill",
  "charBorder"
];
var Typer = class {
  element;
  originalContent;
  source;
  length;
  fps;
  cycles;
  cycleLength;
  frames;
  frame = 0;
  loop = null;
  delay;
  delayTimer = null;
  charNodes = [];
  type = "initial";
  divisor;
  denominator;
  variations;
  initVisible;
  constructor(element, opts = {}) {
    this.element = element;
    this.originalContent = element.innerHTML;
    this.source = element.textContent || "";
    this.length = this.source.replace(/\s/g, "").length;
    this.fps = opts.fps ?? 20;
    this.cycles = opts.cycles ?? 3;
    this.cycleLength = opts.cycleLength ?? 0.5;
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
  build() {
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
  reset(text) {
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
  setType(t) {
    if (t === this.type && t !== "inout") return;
    this.type = t;
    this.element.dataset.typerType = t;
    this.stopLoop();
    this.frame = 0;
    this.applyFrame();
    if (t !== "initial" && this.charNodes.length) this.startLoop();
  }
  startLoop() {
    if (this.loop || this.delayTimer || !this.charNodes.length) return;
    if (this.type === "initial") return;
    this.shuffle();
    const begin = () => {
      this.delayTimer = null;
      if (this.loop || this.type === "initial") return;
      this.applyFrame();
      this.loop = window.setInterval(() => this.tick(), 1e3 / this.fps);
    };
    if (this.delay > 0) {
      this.delayTimer = window.setTimeout(begin, this.delay * 1e3);
    } else {
      begin();
    }
  }
  stopLoop() {
    if (this.delayTimer) {
      window.clearTimeout(this.delayTimer);
      this.delayTimer = null;
    }
    if (this.loop) {
      window.clearInterval(this.loop);
      this.loop = null;
    }
  }
  tick() {
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
  applyFrame() {
    if (!this.length || !this.charNodes.length) return;
    if (this.type === "initial") {
      this.charNodes.forEach((n) => this.setClass(n, "char charInit"));
      return;
    }
    const phase = this.type === "inout" && this.frame > this.frames ? "out" : this.type === "inout" ? "in" : this.type;
    const progress = (this.type === "inout" && phase === "out" ? this.frame - this.frames : this.frame) / this.denominator;
    for (const node of this.charNodes) {
      let p = progress - node.cp;
      p = roundToStep(p, 0.1);
      p = clamp(p, 0, 1);
      let variation = "charInit";
      if (p > 0) {
        const idx = Math.round(remap(p, 0, 1, 0, this.cycles));
        variation = this.variations[idx % this.variations.length];
      }
      if (p >= 1) variation = "";
      const midClass = variation ? `char ${variation}` : "char";
      let cls;
      if (phase === "in") {
        cls = p <= 0 ? "char charInit" : p >= 1 ? "char" : midClass;
      } else {
        cls = p <= 0 ? "char" : p >= 1 ? "char charInit" : midClass;
      }
      this.setClass(node, cls);
    }
  }
  setClass(node, cls) {
    if (cls === node.currentClass) return;
    node.currentClass = cls;
    node.el.className = cls;
  }
  shuffle() {
    this.variations.sort(() => 0.5 - Math.random());
  }
  destroy() {
    this.stopLoop();
    this.element.innerHTML = this.originalContent;
    delete this.element.dataset.typerType;
  }
};
var TyperGroup = class {
  typers = [];
  constructor(elements, opts = {}, stagger = 0.15) {
    this.typers = elements.map(
      (el, i) => new Typer(el, { ...opts, delay: i * stagger })
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
};

// src/typer/typer.css
var typer_default = `/* Typer \u2014 the styling for the character reveal. The engine (typer.ts) swaps each
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

/* not yet revealed \u2192 transparent (holds the layout, shows nothing). */
[data-typer] .word .char.charInit {
  color: transparent;
}

/* \u2500\u2500 Solid pill: ink block, knockout text. Adjacent fills merge into one bar. \u2500\u2500 */
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

/* \u2500\u2500 Inverse: ink knockout, no rounding (a hard block). \u2500\u2500 */
[data-typer] .word .char.charInverse {
  color: var(--typer-bg);
  background: var(--typer-fg);
}

/* \u2500\u2500 Accent: colored LETTERS on the page (no pill) \u2014 the accent reaching the
      text itself, not just a fill. \u2500\u2500 */
[data-typer] .word .char.charAccent {
  color: var(--typer-accent);
  background: transparent;
}

/* \u2500\u2500 Accent inverse: an accent PILL with knockout text sitting on it. Merges into
      a bar like the ink fill. \u2500\u2500 */
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

/* \u2500\u2500 Accent fill: a briefly solid block of pure accent (both fill and text). \u2500\u2500 */
[data-typer] .word .char.charAccentFill {
  color: var(--typer-accent);
  background: var(--typer-accent);
}

/* \u2500\u2500 Outlined pill: an ACCENT border box around ink text; a run merges like the
      solid pill, but by dropping the inner vertical borders instead of the fill. \u2500\u2500 */
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

`;

// src/typer/adapter.ts
var adapter_default = {
  async mount(host, props) {
    const dark = props.theme !== "light";
    const fg = dark ? "#f4f4f5" : "#1b1b1b";
    const bg = dark ? "#101014" : "#fcfcfc";
    const accent = String(props.accent ?? "#34d399");
    const style = document.createElement("style");
    style.textContent = typer_default;
    host.appendChild(style);
    host.style.background = bg;
    const block = document.createElement("div");
    Object.assign(block.style, {
      position: "absolute",
      inset: "0",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: "0.35em",
      textAlign: "center",
      fontFamily: "var(--font-neue-corp)",
      fontWeight: "600",
      fontSize: "clamp(2rem, 5.5vw, 4.6rem)",
      letterSpacing: "-0.02em"
    });
    const lines = Array.isArray(props.lines) ? props.lines : ["type it in", "not fade it in"];
    const els = lines.map((line) => {
      const el = document.createElement("span");
      el.setAttribute("data-typer", "");
      el.dataset.typerType = "initial";
      el.style.setProperty("--typer-fg", fg);
      el.style.setProperty("--typer-bg", bg);
      el.style.setProperty("--typer-accent", accent);
      el.style.setProperty("--typer-accent-ink", bg);
      el.textContent = line;
      block.appendChild(el);
      return el;
    });
    host.appendChild(block);
    const group = new TyperGroup(els, { fps: Number(props.fps ?? 20), cycles: 3 }, 0.18);
    let timer = 0;
    return {
      start: () => {
        group.in();
        if (props.loop) {
          const hold = Number(props.holdSeconds ?? 3.4) * 1e3;
          timer = window.setInterval(() => {
            group.out();
            window.setTimeout(() => group.in(), 1100);
          }, hold + 1100);
        }
      },
      action: async (name) => {
        if (name === "out") group.out();
        if (name === "in") group.in();
      },
      destroy: () => {
        if (timer) window.clearInterval(timer);
        group.destroy();
      }
    };
  }
};
export {
  adapter_default as default
};
