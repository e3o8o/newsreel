// src/galaxy/engine.ts
var lerp = (a, b, t) => (1 - t) * a + t * b;
var CONFIG = {
  speed: 1.1,
  ease: 0.16,
  scaleEase: 0.25,
  scrollMultiplier: 0.9,
  scaleMin: 0.5,
  scaleMax: 1.4
};
var Z_POOL = [-200, -150, -100, -50, 0, 50, 100, 150, 200];
var SPEED_POOL = [0.55, 0.75, 1, 1.3, 1.6];
function buildParticles(n) {
  const cols = Math.max(3, Math.round(Math.sqrt(n) * 1.4));
  const left = 8;
  const span = 100 - left * 2;
  const step = cols > 1 ? span / (cols - 1) : 0;
  const rows = Math.ceil(n / cols);
  const slots = Array.from({ length: n }, (_, i) => i).sort(
    () => 0.5 - Math.random()
  );
  return Array.from({ length: n }, (_, i) => {
    const z = Z_POOL[i % Z_POOL.length];
    const opacity = z < 0 ? Math.max(0.6, 1 + z / 400) : 1;
    const slot = slots[i];
    const col = slot % cols;
    const row = Math.floor(slot / cols);
    const x = left + col * step + (Math.random() - 0.5) * step * 0.5;
    const y = (row + 0.5) / rows * 100 + (Math.random() - 0.5) * (100 / rows) * 0.6;
    return {
      x: Math.max(2, Math.min(96, x)),
      y: (y % 100 + 100) % 100,
      speed: SPEED_POOL[i % SPEED_POOL.length],
      z,
      opacity
    };
  });
}
var ImageGalaxy = class {
  container;
  nodes = [];
  defs;
  scroll = { current: 0, target: 0, last: 0 };
  directionSign = 1;
  direction = "down";
  containerHeight = 0;
  containerOffsetHeight = 0;
  raf = 0;
  running = false;
  disposed = false;
  lastTime = 0;
  constructor(container, images, overlays, defs) {
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
      isAfter: false
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
      const left = small ? i % 4 * 25 + d.x % 20 : d.x;
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
  addScroll(velocity, direction) {
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
  tick = (now) => {
    if (!this.running) return;
    const dt = this.lastTime ? Math.min(2, (now - this.lastTime) / 16.667) : 1;
    this.lastTime = now;
    this.update(dt);
    this.raf = requestAnimationFrame(this.tick);
  };
  update(dt) {
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
};

// src/galaxy/adapter.ts
function plate(i) {
  const c = document.createElement("canvas");
  c.width = 320;
  c.height = 400;
  const ctx = c.getContext("2d");
  const h = i * 47 % 360;
  const g = ctx.createLinearGradient(0, 0, 320, 400);
  g.addColorStop(0, `hsl(${h} 70% 62%)`);
  g.addColorStop(1, `hsl(${(h + 48) % 360} 66% 38%)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 320, 400);
  const r = ctx.createRadialGradient(110, 90, 10, 160, 200, 260);
  r.addColorStop(0, "rgba(255,255,255,0.35)");
  r.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = r;
  ctx.fillRect(0, 0, 320, 400);
  return c.toDataURL("image/png");
}
var adapter_default = {
  async mount(host, props) {
    host.style.background = String(props.bg ?? "#f2f2f5");
    host.style.overflow = "hidden";
    const stage = document.createElement("div");
    Object.assign(stage.style, {
      position: "absolute",
      inset: "0",
      perspective: "1200px",
      transformStyle: "preserve-3d"
    });
    host.appendChild(stage);
    const count = Number(props.count ?? 14);
    const urls = Array.isArray(props.images) && props.images.length ? props.images : Array.from({ length: count }, (_, i) => plate(i));
    const els = [];
    const overlays = [];
    for (let i = 0; i < count; i++) {
      const wrap = document.createElement("div");
      Object.assign(wrap.style, {
        position: "absolute",
        width: "13%",
        aspectRatio: "4 / 5",
        borderRadius: "10px",
        overflow: "hidden",
        boxShadow: "0 12px 30px rgba(20,20,40,0.16)",
        willChange: "transform"
      });
      const img = document.createElement("img");
      img.src = urls[i % urls.length];
      Object.assign(img.style, { width: "100%", height: "100%", objectFit: "cover", display: "block" });
      const veil = document.createElement("div");
      Object.assign(veil.style, {
        position: "absolute",
        inset: "0",
        background: "#ffffff",
        opacity: "0",
        pointerEvents: "none"
      });
      wrap.append(img, veil);
      stage.appendChild(wrap);
      els.push(wrap);
      overlays.push(veil);
    }
    const label = document.createElement("div");
    label.textContent = String(props.text ?? "drift");
    Object.assign(label.style, {
      position: "absolute",
      inset: "0",
      display: "grid",
      placeItems: "center",
      font: "700 clamp(2.5rem, 8vw, 6rem) var(--font-neue-corp)",
      letterSpacing: "-0.03em",
      color: "#15161c",
      zIndex: "5",
      pointerEvents: "none",
      mixBlendMode: "multiply"
    });
    host.appendChild(label);
    const engine = new ImageGalaxy(stage, els, overlays, buildParticles(count));
    return {
      start: () => engine.start(),
      destroy: () => {
        engine.destroy();
        stage.remove();
        label.remove();
      }
    };
  }
};
export {
  adapter_default as default
};
