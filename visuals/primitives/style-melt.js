// src/shared/source.ts
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

// src/style-melt/adapter.ts
var posterise = (levels) => (src) => {
  const [c, ctx] = canvas(src.width, src.height);
  ctx.drawImage(src, 0, 0);
  const d = ctx.getImageData(0, 0, c.width, c.height);
  const step = 255 / (levels - 1);
  for (let i = 0; i < d.data.length; i += 4) {
    for (let k = 0; k < 3; k++) d.data[i + k] = Math.round(d.data[i + k] / step) * step;
  }
  ctx.putImageData(d, 0, 0);
  return c;
};
var duotone = (loHue, hiHue) => (src) => {
  const [c, ctx] = canvas(src.width, src.height);
  ctx.drawImage(src, 0, 0);
  const d = ctx.getImageData(0, 0, c.width, c.height);
  for (let i = 0; i < d.data.length; i += 4) {
    const l = (0.2126 * d.data[i] + 0.7152 * d.data[i + 1] + 0.0722 * d.data[i + 2]) / 255;
    const h = loHue + (hiHue - loHue) * l;
    const s = 0.72, li = 0.16 + l * 0.62;
    const q = li < 0.5 ? li * (1 + s) : li + s - li * s;
    const p = 2 * li - q;
    const hk = (h % 360 + 360) % 360 / 360;
    const ch = (tc) => {
      let x = tc;
      if (x < 0) x += 1;
      if (x > 1) x -= 1;
      if (x < 1 / 6) return p + (q - p) * 6 * x;
      if (x < 1 / 2) return q;
      if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
      return p;
    };
    d.data[i] = ch(hk + 1 / 3) * 255;
    d.data[i + 1] = ch(hk) * 255;
    d.data[i + 2] = ch(hk - 1 / 3) * 255;
  }
  ctx.putImageData(d, 0, 0);
  return c;
};
var halftone = (dot) => (src) => {
  const [c, ctx] = canvas(src.width, src.height);
  const [s, sc] = canvas(Math.ceil(src.width / dot), Math.ceil(src.height / dot));
  sc.drawImage(src, 0, 0, s.width, s.height);
  const d = sc.getImageData(0, 0, s.width, s.height).data;
  ctx.fillStyle = "#0d0f14";
  ctx.fillRect(0, 0, c.width, c.height);
  for (let y = 0; y < s.height; y++) {
    for (let x = 0; x < s.width; x++) {
      const i = (y * s.width + x) * 4;
      const l = (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255;
      ctx.fillStyle = `rgb(${d[i]},${d[i + 1]},${d[i + 2]})`;
      ctx.beginPath();
      ctx.arc(x * dot + dot / 2, y * dot + dot / 2, dot / 2 * Math.sqrt(l) * 1.25, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  return c;
};
var blueprint = (src) => {
  const [c, ctx] = canvas(src.width, src.height);
  ctx.drawImage(src, 0, 0);
  const d = ctx.getImageData(0, 0, c.width, c.height);
  const out = ctx.createImageData(c.width, c.height);
  const lum = (i) => 0.2126 * d.data[i] + 0.7152 * d.data[i + 1] + 0.0722 * d.data[i + 2];
  for (let y = 1; y < c.height - 1; y++) {
    for (let x = 1; x < c.width - 1; x++) {
      const i = (y * c.width + x) * 4;
      const gx = lum(i - 4 - c.width * 4) + 2 * lum(i - 4) + lum(i - 4 + c.width * 4) - lum(i + 4 - c.width * 4) - 2 * lum(i + 4) - lum(i + 4 + c.width * 4);
      const gy = lum(i - c.width * 4 - 4) + 2 * lum(i - c.width * 4) + lum(i - c.width * 4 + 4) - lum(i + c.width * 4 - 4) - 2 * lum(i + c.width * 4) - lum(i + c.width * 4 + 4);
      const e = Math.min(255, Math.hypot(gx, gy));
      out.data[i] = 30 + e * 0.5;
      out.data[i + 1] = 70 + e * 0.7;
      out.data[i + 2] = 150 + e * 0.4;
      out.data[i + 3] = 255;
    }
  }
  ctx.putImageData(out, 0, 0);
  return c;
};
var adapter_default = {
  async mount(host, props) {
    const grid = typeof props.grid === "number" ? Math.max(8, props.grid) : 26;
    const radius = typeof props.radius === "number" ? props.radius : 2.4;
    const decay = typeof props.decay === "number" ? props.decay : 0.55;
    const bg = typeof props.bg === "string" ? props.bg : "#08090e";
    let real = portrait(9, 720, 900);
    if (typeof props.source === "string") {
      const im = await new Promise((res) => {
        const i = new Image();
        i.crossOrigin = "anonymous";
        i.onload = () => res(i);
        i.onerror = () => res(null);
        i.src = props.source;
      });
      if (im) {
        const [cc, cx2] = canvas(im.naturalWidth, im.naturalHeight);
        cx2.drawImage(im, 0, 0);
        real = cc;
      }
    }
    const styles = [
      { name: "posterised", img: posterise(4)(real) },
      { name: "halftone", img: halftone(9)(real) },
      { name: "blueprint", img: blueprint(real) },
      { name: "thermal", img: duotone(250, 55)(real) }
    ];
    const [c, ctx] = canvas(1, 1);
    Object.assign(c.style, { position: "absolute", inset: "0", width: "100%", height: "100%" });
    host.appendChild(c);
    let W = 0, H = 0, dpr = 1, cw = 0, chh = 0, cols = 0, rows = 0;
    let heat = new Float32Array(0);
    const fit = () => {
      const b = host.getBoundingClientRect();
      dpr = Math.min(2, window.devicePixelRatio || 1);
      W = Math.max(1, b.width);
      H = Math.max(1, b.height);
      c.width = Math.round(W * dpr);
      c.height = Math.round(H * dpr);
      cols = grid;
      cw = W / cols;
      chh = cw;
      rows = Math.max(1, Math.ceil(H / chh));
      heat = new Float32Array(cols * rows);
    };
    fit();
    const r = rng(31);
    let px = 0.5, py = 0.5, manual = false;
    const onMove = (e) => {
      const b = c.getBoundingClientRect();
      px = (e.clientX - b.left) / b.width;
      py = (e.clientY - b.top) / b.height;
      manual = true;
    };
    c.addEventListener("pointermove", onMove);
    const box = () => {
      const k = Math.max(W / real.width, H / real.height);
      const w = real.width * k, h = real.height * k;
      return { x: (W - w) / 2, y: (H - h) / 2, w, h };
    };
    let raf = 0;
    const t0 = performance.now();
    let last = t0;
    const draw = (now) => {
      const t = Math.max(0, (now - t0) / 1e3);
      const dt = Math.min(0.05, (now - last) / 1e3);
      last = now;
      if (!manual) {
        px = 0.5 + Math.sin(t * 0.75) * 0.3 + Math.sin(t * 1.9) * 0.08;
        py = 0.5 + Math.cos(t * 0.55) * 0.28 + Math.cos(t * 2.3) * 0.06;
      }
      const keep = Math.pow(decay, dt);
      for (let i = 0; i < heat.length; i++) heat[i] *= keep;
      const gx = px * cols, gy = py * rows;
      const rad = Math.ceil(radius) + 1;
      for (let y = Math.floor(gy - rad); y <= gy + rad; y++) {
        for (let x = Math.floor(gx - rad); x <= gx + rad; x++) {
          if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
          const d = Math.hypot(x + 0.5 - gx, y + 0.5 - gy) / radius;
          if (d > 1) continue;
          const add = 1 - d * d;
          const i = y * cols + x;
          if (add > heat[i]) heat[i] = add;
        }
      }
      const b = box();
      const per = 3.2;
      const si = Math.floor(t / per) % styles.length;
      const mix = Math.min(1, Math.max(0, t % per - per + 0.9));
      const cur = styles[si].img;
      const nxt = styles[(si + 1) % styles.length].img;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);
      ctx.drawImage(cur, b.x, b.y, b.w, b.h);
      if (mix > 0) {
        ctx.globalAlpha = mix;
        ctx.drawImage(nxt, b.x, b.y, b.w, b.h);
        ctx.globalAlpha = 1;
      }
      ctx.save();
      ctx.beginPath();
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const hv = heat[y * cols + x];
          if (hv < 0.04) continue;
          const e = Math.min(1, hv * 1.35);
          const pad = (1 - e) * cw * 0.5;
          const rr = Math.max(0, (1 - e) * cw * 0.5 + 2);
          ctx.roundRect(x * cw + pad, y * chh + pad, cw - pad * 2, chh - pad * 2, rr);
        }
      }
      ctx.clip();
      ctx.drawImage(real, b.x, b.y, b.w, b.h);
      ctx.restore();
      setFont(ctx, Math.max(11, W * 0.011), MONO, 600);
      ctx.textAlign = "left";
      ctx.fillStyle = "rgba(255,255,255,.72)";
      ctx.fillText(
        styles[mix > 0.5 ? (si + 1) % styles.length : si].name.toUpperCase(),
        W * 0.04,
        H * 0.94
      );
      raf = requestAnimationFrame(draw);
    };
    const onResize = () => fit();
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
