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
function plate(seed, w = 320, h = 400) {
  const [c, ctx] = canvas(w, h);
  const r = rng(seed + 7);
  const hue = seed * 47 % 360;
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, `hsl(${hue} 72% 62%)`);
  g.addColorStop(1, `hsl(${(hue + 48) % 360} 66% 36%)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.globalAlpha = 0.5;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    const cx = r() * w, cy = r() * h, rad = (0.12 + r() * 0.22) * w;
    ctx.fillStyle = `hsl(${(hue + 120 + i * 60) % 360} 80% ${55 + i * 8}%)`;
    if (r() < 0.5) ctx.arc(cx, cy, rad, 0, Math.PI * 2);
    else ctx.rect(cx - rad, cy - rad * 0.7, rad * 2, rad * 1.4);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  const hi = ctx.createRadialGradient(w * 0.34, h * 0.22, 8, w * 0.5, h * 0.5, h * 0.7);
  hi.addColorStop(0, "rgba(255,255,255,0.36)");
  hi.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = hi;
  ctx.fillRect(0, 0, w, h);
  return c;
}
async function sourceImages(urls, count, make) {
  const list = Array.isArray(urls) ? urls.filter((u) => typeof u === "string") : [];
  if (!list.length) return Array.from({ length: count }, (_, i) => make(i));
  const loaded = await Promise.all(list.map((src) => new Promise((res) => {
    const im = new Image();
    im.crossOrigin = "anonymous";
    im.onload = () => res(im);
    im.onerror = () => res(null);
    im.src = src;
  })));
  const ok = loaded.filter((x) => !!x);
  return ok.length ? ok : Array.from({ length: count }, (_, i) => make(i));
}

// src/pixel-field/adapter.ts
var easeInOut = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
var adapter_default = {
  async mount(host, props) {
    const hold = typeof props.hold === "number" ? props.hold : 1.5;
    const swap = typeof props.swap === "number" ? props.swap : 1.15;
    const maxBlock = typeof props.maxBlock === "number" ? props.maxBlock : 44;
    const bg = typeof props.bg === "string" ? props.bg : "#0a0a0f";
    const imgs = await sourceImages(props.sources, 5, (i) => plate(i * 13 + 3, 640, 420));
    const [c, ctx] = canvas(1, 1);
    Object.assign(c.style, { position: "absolute", inset: "0", width: "100%", height: "100%" });
    host.appendChild(c);
    const [buf, bctx] = canvas(1, 1);
    let W = 0, H = 0, dpr = 1;
    const fit = () => {
      const b = host.getBoundingClientRect();
      dpr = Math.min(2, window.devicePixelRatio || 1);
      W = Math.max(1, b.width);
      H = Math.max(1, b.height);
      c.width = Math.round(W * dpr);
      c.height = Math.round(H * dpr);
    };
    fit();
    const paint = (img, target, w, h, dx, scale, skew) => {
      const iw = img.naturalWidth || img.width;
      const ih = img.naturalHeight || img.height;
      const k = Math.max(w / iw, h / ih) * scale;
      target.save();
      target.translate(w / 2 + dx, h / 2);
      target.transform(1, 0, skew, 1, 0, 0);
      target.drawImage(img, -iw * k / 2, -ih * k / 2, iw * k, ih * k);
      target.restore();
    };
    let raf = 0;
    const t0 = performance.now();
    const draw = (now) => {
      const t = Math.max(0, (now - t0) / 1e3);
      const cycle = hold + swap;
      const idx = Math.floor(t / cycle);
      const local = t - idx * cycle;
      const p = local < hold ? 0 : easeInOut((local - hold) / swap);
      const a = imgs[idx % imgs.length];
      const b = imgs[(idx + 1) % imgs.length];
      const chunk = 1 + Math.sin(Math.min(1, p) * Math.PI) * maxBlock;
      const bw = Math.max(2, Math.round(W / chunk));
      const bh = Math.max(2, Math.round(H / chunk));
      buf.width = bw;
      buf.height = bh;
      bctx.imageSmoothingEnabled = false;
      bctx.fillStyle = bg;
      bctx.fillRect(0, 0, bw, bh);
      const bufScale = bw / W;
      if (p < 1) {
        bctx.globalAlpha = 1 - p;
        paint(a, bctx, bw, bh, -p * W * 0.35 * bufScale, 1 + p * 0.28, -p * 0.22);
      }
      if (p > 0) {
        bctx.globalAlpha = p;
        paint(b, bctx, bw, bh, (1 - p) * W * 0.35 * bufScale, 1.28 - p * 0.28, (1 - p) * 0.22);
      }
      bctx.globalAlpha = 1;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);
      ctx.drawImage(buf, 0, 0, W, H);
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
