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
function portrait(seed = 1, w = 640, h = 800) {
  const [c, ctx] = canvas(w, h);
  const r = rng(seed);
  const hue = 200 + r() * 120;
  const bg = ctx.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, `hsl(${hue} 34% 22%)`);
  bg.addColorStop(1, `hsl(${(hue + 40) % 360} 40% 12%)`);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  const rim = ctx.createRadialGradient(w * 0.5, h * 0.36, 20, w * 0.5, h * 0.42, w * 0.62);
  rim.addColorStop(0, `hsla(${(hue + 180) % 360}, 80%, 70%, 0.5)`);
  rim.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = rim;
  ctx.fillRect(0, 0, w, h);
  const skin = `hsl(${26 + r() * 14} 44% ${58 + r() * 12}%)`;
  const shade = `hsl(${22 + r() * 10} 40% 38%)`;
  const cx = w * 0.5, cy = h * 0.42, rw = w * 0.21, rh = h * 0.19;
  ctx.fillStyle = `hsl(${hue} 30% 30%)`;
  ctx.beginPath();
  ctx.ellipse(cx, h * 1.06, w * 0.44, h * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = shade;
  ctx.fillRect(cx - rw * 0.34, cy + rh * 0.5, rw * 0.68, rh * 0.9);
  const face = ctx.createLinearGradient(cx - rw, cy - rh, cx + rw, cy + rh);
  face.addColorStop(0, skin);
  face.addColorStop(1, shade);
  ctx.fillStyle = face;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rw, rh, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = `hsl(${20 + r() * 200} 24% ${12 + r() * 14}%)`;
  ctx.beginPath();
  ctx.ellipse(cx + rw * 0.04, cy - rh * 0.36, rw * 1.04, rh * 0.78, 0, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(18,18,24,0.85)";
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(cx + s * rw * 0.38, cy - rh * 0.06, rw * 0.11, rh * 0.07, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = "rgba(80,30,30,0.6)";
  ctx.lineWidth = Math.max(2, w * 8e-3);
  ctx.beginPath();
  ctx.moveTo(cx - rw * 0.24, cy + rh * 0.5);
  ctx.quadraticCurveTo(cx, cy + rh * 0.62, cx + rw * 0.24, cy + rh * 0.5);
  ctx.stroke();
  const vg = ctx.createRadialGradient(w / 2, h / 2, h * 0.28, w / 2, h / 2, h * 0.78);
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, "rgba(0,0,0,0.55)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, w, h);
  return c;
}
var MONO = "'SF Mono', ui-monospace, Menlo, Consolas, monospace";
function setFont(ctx, px, family, weight = 400) {
  for (const f of [`${weight} ${px}px ${family}`, `${weight} ${px}px sans-serif`, `${px}px sans-serif`]) {
    ctx.font = f;
    if (ctx.font.includes(`${px}px`)) return;
  }
}

// visuals/src/symbols/adapter.ts
var BANDS = ["\u2588\u2588\u2593\u2592", "\u25C6\u25C7\u25C8\u25CF", "+\xD7\xF7=", "\xB7\u02D9\u2025:"];
var adapter_default = {
  async mount(host, props) {
    const cell = typeof props.cell === "number" ? Math.max(6, props.cell) : 15;
    const hue = typeof props.hue === "number" ? props.hue : 32;
    const monochrome = props.mono === true;
    const bg = typeof props.bg === "string" ? props.bg : "#08090e";
    const drift = props.drift !== false;
    const bands = Array.isArray(props.bands) && props.bands.length === 4 ? props.bands : BANDS;
    let src = portrait(4);
    let sw = 640, sh = 800;
    if (typeof props.source === "string") {
      const im = await new Promise((res) => {
        const i = new Image();
        i.crossOrigin = "anonymous";
        i.onload = () => res(i);
        i.onerror = () => res(null);
        i.src = props.source;
      });
      if (im) {
        src = im;
        sw = im.naturalWidth;
        sh = im.naturalHeight;
      }
    }
    const [c, ctx] = canvas(1, 1);
    Object.assign(c.style, { position: "absolute", inset: "0", width: "100%", height: "100%" });
    host.appendChild(c);
    let W = 0, H = 0, dpr = 1, cols = 0, rows = 0;
    let lum = new Float32Array(0);
    const build = () => {
      const b = host.getBoundingClientRect();
      dpr = Math.min(2, window.devicePixelRatio || 1);
      W = Math.max(1, b.width);
      H = Math.max(1, b.height);
      c.width = Math.round(W * dpr);
      c.height = Math.round(H * dpr);
      cols = Math.max(1, Math.floor(W / cell));
      rows = Math.max(1, Math.floor(H / cell));
      const [small, s] = canvas(cols, rows);
      const scale = Math.max(cols / sw, rows / sh);
      const dw = sw * scale, dh = sh * scale;
      s.fillStyle = "#000";
      s.fillRect(0, 0, cols, rows);
      s.drawImage(src, (cols - dw) / 2, (rows - dh) / 2, dw, dh);
      const d = s.getImageData(0, 0, cols, rows).data;
      lum = new Float32Array(cols * rows);
      for (let i = 0; i < cols * rows; i++) {
        lum[i] = (0.2126 * d[i * 4] + 0.7152 * d[i * 4 + 1] + 0.0722 * d[i * 4 + 2]) / 255;
      }
    };
    build();
    let raf = 0;
    const t0 = performance.now();
    const draw = (now) => {
      const t = (now - t0) / 1e3;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);
      setFont(ctx, cell * 1.02, MONO, 600);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const ox = (W - cols * cell) / 2, oy = (H - rows * cell) / 2;
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const l = lum[y * cols + x];
          if (l < 0.06) continue;
          const band = l > 0.72 ? 0 : l > 0.46 ? 1 : l > 0.24 ? 2 : 3;
          const set = bands[band];
          const k = drift ? Math.floor(Math.abs(Math.sin(x * 0.7 + y * 0.4 + t * 1.6)) * set.length) : (x + y) % set.length;
          ctx.fillStyle = monochrome ? `hsl(0 0% ${28 + l * 68}%)` : `hsl(${hue + l * 26} 82% ${24 + l * 58}%)`;
          ctx.fillText(
            set[Math.min(set.length - 1, k)],
            ox + x * cell + cell / 2,
            oy + y * cell + cell / 2
          );
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
