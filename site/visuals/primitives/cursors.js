// src/cursors/engine.ts
var ARROW_PATH = "M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-4.86a.5.5 0 0 1 .35-.15h6.87c.48 0 .72-.58.38-.92L5.94 2.47a.5.5 0 0 0-.44.74Z";
var TWO_PI = Math.PI * 2;
var FlyingCursors = class {
  host;
  defs;
  nodes = [];
  raf = 0;
  running = false;
  disposed = false;
  t = 0;
  pointer = { x: -9999, y: -9999, active: false };
  ro;
  cleanup = [];
  constructor(host, defs) {
    this.host = host;
    this.defs = defs;
    this.build();
    this.bindEvents();
    this.layout();
  }
  build() {
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
        zIndex: "2"
      });
      this.host.appendChild(blush);
      const root = document.createElement("div");
      Object.assign(root.style, {
        position: "absolute",
        left: "0",
        top: "0",
        pointerEvents: "none",
        willChange: "transform",
        zIndex: "3"
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
        ty: 0
      });
    }
  }
  bindEvents() {
    const onMove = (e) => {
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
  layout() {
    const w = this.host.clientWidth;
    const h = this.host.clientHeight;
    if (!w || !h) return;
    const n = this.nodes.length;
    this.nodes.forEach((node, i) => {
      node.cx = (0.32 + 0.36 * ((i + 0.5) / n)) * w;
      node.cy = (0.34 + 0.32 * (i % 2)) * h;
      node.rx = (0.16 + 0.06 * (i % 2)) * w;
      node.ry = (0.2 + 0.05 * ((i + 1) % 2)) * h;
      node.phase = i / n * TWO_PI;
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
  loop = () => {
    if (!this.running) return;
    this.t += 6e-3;
    for (const node of this.nodes) {
      const a = this.t * node.speed + node.phase;
      let bx = node.cx + Math.cos(a) * node.rx;
      let by = node.cy + Math.sin(a * 1.15) * node.ry;
      if (this.pointer.active) {
        const dx = bx - this.pointer.x;
        const dy = by - this.pointer.y;
        const dist = Math.hypot(dx, dy) || 1;
        const push = Math.max(0, 1 - dist / 220) * 120;
        bx += dx / dist * push;
        by += dy / dist * push;
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
};

// src/cursors/frosted.ts
var CSS = `
.fw-root { position: relative; display: inline-block; }
.fw-glow { pointer-events: none; position: absolute; left: 50%; top: 50%; z-index: -1;
  height: 130px; width: 540px; max-width: 130%; transform: translate(-50%, -50%);
  background: radial-gradient(ellipse 100% 100% at 50% 50%, var(--fw-page) 0%, transparent 70%);
  filter: blur(30px); }
.fw-tilt { position: relative; display: inline-block;
  transform: translateX(-1px) translateY(-2px) rotate(-1deg); }
.fw-layer { position: absolute; inset: 0; }
.fw-soft { color: var(--fw-ink); opacity: 0.14; filter: blur(9px); }
.fw-deep { color: var(--fw-ink); opacity: 0.16; transform: translate(-1.5px, 3px); filter: blur(5px);
  -webkit-mask-image: linear-gradient(186deg, transparent 20%, black 100%);
  mask-image: linear-gradient(186deg, transparent 20%, black 100%); }
.fw-sharp { position: relative; z-index: 10;
  -webkit-mask-image: linear-gradient(186deg, black 0%, black 40%, transparent 100%);
  mask-image: linear-gradient(186deg, black 0%, black 40%, transparent 100%); }
.fw-blur { filter: blur(2px);
  -webkit-mask-image: linear-gradient(186deg, transparent 0%, black 60%, black 100%);
  mask-image: linear-gradient(186deg, transparent 0%, black 60%, black 100%); }
.fw-near { color: var(--fw-ink); opacity: 0.28; transform: translate(1.5px, 2px); filter: blur(3.5px);
  -webkit-mask-image: linear-gradient(186deg, transparent 30%, black 100%);
  mask-image: linear-gradient(186deg, transparent 30%, black 100%); }
.fw-sheen { opacity: 0.7; color: rgba(255,255,255,0.9);
  -webkit-mask-image: linear-gradient(180deg, black 0%, transparent 30%);
  mask-image: linear-gradient(180deg, black 0%, transparent 30%); }
.fw-chip { pointer-events: none; position: absolute; inset: -4px -8px;
  background: linear-gradient(180deg, rgba(255,255,255,0.42) 0%, rgba(255,255,255,0.14) 38%,
    rgba(255,255,255,0.08) 62%, rgba(255,255,255,0.24) 100%);
  border: 1px solid rgba(0,0,0,0.06); border-top-color: rgba(255,255,255,0.75);
  border-radius: 10px;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.55), inset 0 -1px 1px rgba(0,0,0,0.05),
    inset 0 0 0 3px rgba(255,255,255,0.14), inset 0 0 0 4px rgba(0,0,0,0.045),
    inset 0 8px 16px rgba(255,255,255,0.18), 0 1px 3px rgba(0,0,0,0.07), 0 6px 16px rgba(0,0,0,0.07); }
.fw-gloss { pointer-events: none; position: absolute; inset: -4px -8px; border-radius: 10px;
  background: linear-gradient(180deg, rgba(255,255,255,0.7), transparent 12%);
  mix-blend-mode: overlay; }
`;
var injected = false;
function frostedWord(text, opts = {}) {
  if (!injected) {
    const style = document.createElement("style");
    style.textContent = CSS;
    document.head.appendChild(style);
    injected = true;
  }
  const root = document.createElement("span");
  root.className = "fw-root";
  root.style.setProperty("--fw-ink", opts.ink ?? "#1b1b1e");
  root.style.setProperty("--fw-page", opts.page ?? "#f4f4f6");
  const glow = document.createElement("span");
  glow.className = "fw-glow";
  glow.setAttribute("aria-hidden", "true");
  root.appendChild(glow);
  const tilt = document.createElement("span");
  tilt.className = "fw-tilt";
  root.appendChild(tilt);
  const layer = (cls, withText = true) => {
    const el = document.createElement("span");
    el.className = cls;
    if (withText) el.textContent = text;
    tilt.appendChild(el);
    return el;
  };
  layer("fw-layer fw-soft");
  layer("fw-layer fw-deep");
  layer("fw-sharp");
  layer("fw-layer fw-blur");
  layer("fw-layer fw-near");
  layer("fw-layer fw-sheen");
  layer("fw-chip", false);
  layer("fw-gloss", false);
  return root;
}

// src/shared/ghost.ts
function ghostPointer(host, opts = {}) {
  const target = opts.target ?? host;
  const speed = opts.speed ?? 1;
  const bx = opts.boxX ?? 0.32;
  const by = opts.boxY ?? 0.28;
  let raf = 0;
  const t0 = performance.now();
  const tick = (now) => {
    const t = (now - t0) / 1e3 * speed;
    const r = host.getBoundingClientRect();
    const gx = 0.55 * Math.sin(t * 1.15) + 0.3 * Math.sin(t * 2.6 + 1) + 0.15 * Math.cos(t * 4.1 + 0.4);
    const gy = 0.55 * Math.cos(t * 0.95 + 2.1) + 0.3 * Math.sin(t * 2.2 + 0.5) + 0.15 * Math.cos(t * 3.7 + 1.7);
    const clientX = r.left + r.width * (0.5 + gx * bx);
    const clientY = r.top + r.height * (0.5 + gy * by);
    const ev = () => new PointerEvent("pointermove", { clientX, clientY, bubbles: true, pointerType: "mouse" });
    if (target === "hit") {
      const el = document.elementFromPoint(clientX, clientY);
      (el || host).dispatchEvent(ev());
    } else {
      target.dispatchEvent(ev());
    }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return { stop: () => cancelAnimationFrame(raf) };
}

// src/cursors/adapter.ts
var DEFAULT_DEFS = [
  { name: "Maija", color: "#7c4dff" },
  { name: "Karo", color: "#12a150" },
  { name: "JP", color: "#ff7a1a" }
];
var adapter_default = {
  async mount(host, props) {
    const page = String(props.page ?? "#f4f4f6");
    host.style.background = page;
    const center = document.createElement("div");
    Object.assign(center.style, {
      position: "absolute",
      inset: "0",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "var(--font-neue-montreal)",
      fontWeight: "700",
      fontSize: "clamp(3rem, 9vw, 7.5rem)",
      letterSpacing: "-0.03em",
      color: String(props.ink ?? "#1b1b1e"),
      zIndex: "1"
    });
    center.appendChild(
      frostedWord(String(props.word ?? "together"), {
        ink: String(props.ink ?? "#1b1b1e"),
        page
      })
    );
    host.appendChild(center);
    let defs = DEFAULT_DEFS;
    if (Array.isArray(props.names) && props.names.length) {
      const colors = Array.isArray(props.colors) ? props.colors : [];
      defs = props.names.map((name, i) => ({
        name,
        color: colors[i] ?? DEFAULT_DEFS[i % DEFAULT_DEFS.length].color
      }));
    }
    const engine = new FlyingCursors(host, defs);
    const ghost = ghostPointer(host, { speed: 0.5, boxX: 0.4, boxY: 0.35 });
    return {
      start: () => engine.start(),
      destroy: () => {
        ghost.stop();
        engine.destroy();
      }
    };
  }
};
export {
  adapter_default as default
};
