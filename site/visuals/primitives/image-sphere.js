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

// visuals/src/image-sphere/adapter.ts
var adapter_default = {
  async mount(host, props) {
    const count = typeof props.count === "number" ? Math.max(8, Math.min(220, props.count)) : 84;
    const spin = typeof props.spin === "number" ? props.spin : 0.16;
    const tilt = typeof props.tilt === "number" ? props.tilt : 0.38;
    const bg = typeof props.bg === "string" ? props.bg : "#06070c";
    const fov = typeof props.fov === "number" ? props.fov : 900;
    const imgs = await sourceImages(props.sources, 12, (i) => plate(i * 29 + 5, 260, 340));
    const [c, ctx] = canvas(1, 1);
    Object.assign(c.style, { position: "absolute", inset: "0", width: "100%", height: "100%" });
    host.appendChild(c);
    const GOLDEN = Math.PI * (3 - Math.sqrt(5));
    const pts = Array.from({ length: count }, (_, i) => {
      const y = 1 - i / (count - 1) * 2;
      const r = Math.sqrt(Math.max(0, 1 - y * y));
      const th = GOLDEN * i;
      return { x: Math.cos(th) * r, y, z: Math.sin(th) * r, img: imgs[i % imgs.length] };
    });
    let W = 0, H = 0, dpr = 1, radius = 0;
    const fit = () => {
      const b = host.getBoundingClientRect();
      dpr = Math.min(2, window.devicePixelRatio || 1);
      W = Math.max(1, b.width);
      H = Math.max(1, b.height);
      c.width = Math.round(W * dpr);
      c.height = Math.round(H * dpr);
      radius = typeof props.radius === "number" ? props.radius : Math.min(W, H) * 0.42;
    };
    fit();
    let raf = 0, drag = 0, vel = 0, held = false, lastX = 0;
    const t0 = performance.now();
    let last = t0;
    const down = (e) => {
      held = true;
      lastX = e.clientX;
      vel = 0;
    };
    const move = (e) => {
      if (!held) return;
      const d = (e.clientX - lastX) / 260;
      lastX = e.clientX;
      drag += d;
      vel = d * 60;
    };
    const up = () => {
      held = false;
    };
    c.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    const draw = (now) => {
      const t = (now - t0) / 1e3;
      const dt = Math.min(0.05, (now - last) / 1e3);
      last = now;
      if (!held) {
        drag += vel * dt;
        vel *= Math.pow(0.06, dt);
      }
      const ang = t * spin * Math.PI * 2 + drag;
      const ca = Math.cos(ang), sa = Math.sin(ang);
      const ct = Math.cos(tilt), st = Math.sin(tilt);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);
      const drawn = pts.map((p) => {
        const x1 = p.x * ca + p.z * sa;
        const z1 = -p.x * sa + p.z * ca;
        const y2 = p.y * ct - z1 * st;
        const z2 = p.y * st + z1 * ct;
        return { p, x: x1 * radius, y: y2 * radius, z: z2 * radius };
      }).sort((a, b) => b.z - a.z);
      for (const d of drawn) {
        const depth = fov / (fov + d.z + radius);
        const iw = d.p.img.width || 260;
        const ih = d.p.img.height || 340;
        const w = 96 * depth, h = ih / iw * w;
        const x = W / 2 + d.x * depth, y = H / 2 + d.y * depth;
        const back = (d.z + radius) / (radius * 2);
        ctx.globalAlpha = 0.2 + (1 - back) * 0.8;
        ctx.save();
        ctx.shadowColor = "rgba(0,0,0,.45)";
        ctx.shadowBlur = 14 * depth;
        ctx.drawImage(d.p.img, x - w / 2, y - h / 2, w, h);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(draw);
    };
    const onResize = () => fit();
    window.addEventListener("resize", onResize);
    return {
      start: () => {
        raf = requestAnimationFrame(draw);
      },
      action: async (name, args) => {
        if (name === "spin") vel += Number(args?.by ?? 3);
      },
      destroy: () => {
        cancelAnimationFrame(raf);
        window.removeEventListener("resize", onResize);
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        c.remove();
      }
    };
  }
};
export {
  adapter_default as default
};
