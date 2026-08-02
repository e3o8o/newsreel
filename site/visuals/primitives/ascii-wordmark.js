// visuals/src/shared/source.ts
function rng(seed) {
  let s = seed >>> 0 || 2654435769;
  s = Math.imul(s ^ s >>> 16, 569420461) >>> 0;
  s = Math.imul(s ^ s >>> 15, 1935289751) >>> 0;
  s = (s ^ s >>> 15) >>> 0 || 1831565813;
  const next = () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
  for (let i = 0; i < 8; i++) next();
  return next;
}
function canvas(w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return [c, c.getContext("2d")];
}
var MONO = "'SF Mono', ui-monospace, Menlo, Consolas, monospace";
function setFont(ctx, px, family, weight = 400) {
  for (const f of [`${weight} ${px}px ${family}`, `${weight} ${px}px sans-serif`, `${px}px sans-serif`]) {
    ctx.font = f;
    if (ctx.font.includes(`${px}px`)) return;
  }
}

// visuals/src/ascii-wordmark/adapter.ts
var DEFAULT_RAMP = " .:-=+*#%@";
var adapter_default = {
  async mount(host, props) {
    const word = (typeof props.word === "string" ? props.word : "ascii").slice(0, 14);
    const cols = typeof props.cols === "number" ? Math.max(40, props.cols) : 112;
    const ramp = typeof props.ramp === "string" && props.ramp.length > 1 ? props.ramp : DEFAULT_RAMP;
    const hue = typeof props.hue === "number" ? props.hue : 150;
    const bg = typeof props.bg === "string" ? props.bg : "#05070a";
    const flow = typeof props.flow === "number" ? props.flow : 1;
    const want = typeof props.count === "number" ? props.count : 6e3;
    const [c, ctx] = canvas(1, 1);
    Object.assign(c.style, { position: "absolute", inset: "0", width: "100%", height: "100%" });
    host.appendChild(c);
    let W = 0, H = 0, dpr = 1, cw = 0, ch = 0, rows = 0;
    let avg = 1;
    let ps = [];
    let dens = new Float32Array(0);
    const r = rng(23);
    const build = () => {
      const b = host.getBoundingClientRect();
      dpr = Math.min(2, window.devicePixelRatio || 1);
      W = Math.max(1, b.width);
      H = Math.max(1, b.height);
      c.width = Math.round(W * dpr);
      c.height = Math.round(H * dpr);
      cw = W / cols;
      ch = cw * 1.86;
      rows = Math.max(1, Math.ceil(H / ch));
      dens = new Float32Array(cols * rows);
      const [off, o] = canvas(cols, rows);
      const px = Math.min(rows * 0.5, cols * 1.35 / Math.max(1, word.length));
      setFont(o, px, MONO, 700);
      o.fillStyle = "#fff";
      o.textAlign = "center";
      o.textBaseline = "middle";
      o.fillText(word, cols / 2, rows / 2);
      const data = o.getImageData(0, 0, cols, rows).data;
      const lit = [];
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          if (data[(y * cols + x) * 4 + 3] > 120) lit.push([x, y]);
        }
      }
      ps = [];
      if (!lit.length) return;
      avg = Math.max(1, want / lit.length);
      for (let i = 0; i < want; i++) {
        const [lx, ly] = lit[Math.floor(r() * lit.length)];
        const hx = (lx + r()) * cw, hy = (ly + r()) * ch;
        ps.push({ x: r() * W, y: r() * H, vx: 0, vy: 0, hx, hy });
      }
    };
    build();
    const field = (x, y, t) => {
      const a = Math.sin(x * 64e-4 + t * 0.55) + Math.cos(y * 52e-4 - t * 0.4);
      const b = Math.cos(x * 41e-4 - t * 0.35) + Math.sin(y * 73e-4 + t * 0.5);
      return [b * 26 * flow, -a * 26 * flow];
    };
    let raf = 0;
    const t0 = performance.now();
    let last = t0;
    const draw = (now) => {
      const t = (now - t0) / 1e3;
      const dt = Math.min(0.05, (now - last) / 1e3);
      last = now;
      const pull = Math.min(1, Math.max(0, (t - 0.4) / 1.6));
      const swirl = 1 - pull * 0.9;
      const K = 34;
      const C = 2 * Math.sqrt(K);
      dens.fill(0);
      for (const p of ps) {
        const [fx, fy] = field(p.x, p.y, t);
        p.vx += (fx * swirl + ((p.hx - p.x) * K - p.vx * C) * pull) * dt;
        p.vy += (fy * swirl + ((p.hy - p.y) * K - p.vy * C) * pull) * dt;
        const drag = Math.pow(0.12, dt);
        p.vx *= drag;
        p.vy *= drag;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        const gx = Math.floor(p.x / cw), gy = Math.floor(p.y / ch);
        if (gx >= 0 && gx < cols && gy >= 0 && gy < rows) dens[gy * cols + gx] += 1;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);
      setFont(ctx, ch * 0.92, MONO, 500);
      ctx.textBaseline = "top";
      ctx.textAlign = "left";
      const top = ramp.length - 1;
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const d = dens[y * cols + x];
          if (d < 0.5) continue;
          const i = Math.min(top, Math.round(Math.sqrt(d / avg) * top * 0.62));
          const gl = ramp[i];
          if (gl === " ") continue;
          const lum = 40 + i / top * 46;
          ctx.fillStyle = `hsl(${hue + i / top * 44} 84% ${lum}%)`;
          ctx.fillText(gl, x * cw, y * ch);
        }
      }
      raf = requestAnimationFrame(draw);
    };
    const onResize = () => build();
    window.addEventListener("resize", onResize);
    return {
      start: () => {
        raf = requestAnimationFrame(draw);
      },
      action: async (name) => {
        if (name === "scatter") {
          for (const p of ps) {
            p.vx += (r() - 0.5) * 2400;
            p.vy += (r() - 0.5) * 2400;
          }
        }
      },
      destroy: () => {
        cancelAnimationFrame(raf);
        window.removeEventListener("resize", onResize);
        c.remove();
      }
    };
  }
};
export {
  adapter_default as default
};
