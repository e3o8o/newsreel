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
var SANS = "'Helvetica Neue', Helvetica, Arial, sans-serif";
var MONO = "'SF Mono', ui-monospace, Menlo, Consolas, monospace";
function setFont(ctx, px, family, weight = 400) {
  for (const f of [`${weight} ${px}px ${family}`, `${weight} ${px}px sans-serif`, `${px}px sans-serif`]) {
    ctx.font = f;
    if (ctx.font.includes(`${px}px`)) return;
  }
}

// src/loot-beam/adapter.ts
var RARITY = {
  common: { hue: 210, name: "Common" },
  rare: { hue: 205, name: "Rare" },
  epic: { hue: 280, name: "Epic" },
  legendary: { hue: 42, name: "Legendary" }
};
function solid(shape) {
  if (shape === "cube") {
    const v2 = [
      [-1, -1, -1],
      [1, -1, -1],
      [1, 1, -1],
      [-1, 1, -1],
      [-1, -1, 1],
      [1, -1, 1],
      [1, 1, 1],
      [-1, 1, 1]
    ];
    return {
      verts: v2,
      faces: [[0, 1, 2, 3], [5, 4, 7, 6], [4, 0, 3, 7], [1, 5, 6, 2], [4, 5, 1, 0], [3, 2, 6, 7]]
    };
  }
  if (shape === "crown") {
    const n = 8, v2 = [], f = [];
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2;
      v2.push([Math.cos(a), -0.8, Math.sin(a)]);
      v2.push([Math.cos(a) * 1.05, i % 2 ? 0.5 : 1.05, Math.sin(a) * 1.05]);
    }
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      f.push([i * 2, j * 2, j * 2 + 1, i * 2 + 1]);
    }
    return { verts: v2, faces: f };
  }
  const v = [[0, 1.5, 0], [1, 0.15, 0], [0, 0.15, 1], [-1, 0.15, 0], [0, 0.15, -1], [0, -1.35, 0]];
  return {
    verts: v,
    faces: [[0, 1, 2], [0, 2, 3], [0, 3, 4], [0, 4, 1], [5, 2, 1], [5, 3, 2], [5, 4, 3], [5, 1, 4]]
  };
}
var adapter_default = {
  async mount(host, props) {
    const rarity = RARITY[String(props.rarity || "legendary")] || RARITY.legendary;
    const hue = rarity.hue;
    const label = typeof props.label === "string" ? props.label : "Ancient Relic";
    const bg = typeof props.bg === "string" ? props.bg : "#07060a";
    const showMotes = props.motes !== false;
    const { verts, faces } = solid(String(props.shape || "gem"));
    const [c, ctx] = canvas(1, 1);
    Object.assign(c.style, { position: "absolute", inset: "0", width: "100%", height: "100%" });
    host.appendChild(c);
    const r = rng(19);
    const motes = Array.from({ length: 70 }, () => ({
      x: r(),
      y: r(),
      sp: 0.05 + r() * 0.16,
      sz: 0.6 + r() * 2.4,
      ph: r() * 6.3
    }));
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
    let raf = 0;
    const t0 = performance.now();
    const draw = (now) => {
      const t = (now - t0) / 1e3;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);
      const cx = W / 2, cy = H * 0.52;
      const scale = Math.min(W, H) * 0.16;
      const beamW = scale * 2.6;
      const shaft = ctx.createLinearGradient(0, 0, 0, H);
      shaft.addColorStop(0, `hsla(${hue}, 92%, 62%, 0)`);
      shaft.addColorStop(0.35, `hsla(${hue}, 96%, 66%, .18)`);
      shaft.addColorStop(0.78, `hsla(${hue}, 100%, 70%, .34)`);
      shaft.addColorStop(1, `hsla(${hue}, 100%, 74%, .05)`);
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = shaft;
      ctx.beginPath();
      ctx.moveTo(cx - beamW * 0.34, 0);
      ctx.lineTo(cx + beamW * 0.34, 0);
      ctx.lineTo(cx + beamW, H * 0.9);
      ctx.lineTo(cx - beamW, H * 0.9);
      ctx.closePath();
      ctx.fill();
      const pulse = 1 + Math.sin(t * 1.7) * 0.06;
      const pool = ctx.createRadialGradient(cx, H * 0.86, 2, cx, H * 0.86, beamW * 1.5 * pulse);
      pool.addColorStop(0, `hsla(${hue}, 100%, 72%, .5)`);
      pool.addColorStop(1, `hsla(${hue}, 100%, 60%, 0)`);
      ctx.fillStyle = pool;
      ctx.beginPath();
      ctx.ellipse(cx, H * 0.86, beamW * 1.5 * pulse, beamW * 0.36 * pulse, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      const ay = t * 0.7, ax = 0.42 + Math.sin(t * 0.5) * 0.06;
      const bob = Math.sin(t * 1.25) * scale * 0.16;
      const proj = verts.map(([x, y, z]) => {
        const x1 = x * Math.cos(ay) + z * Math.sin(ay);
        const z1 = -x * Math.sin(ay) + z * Math.cos(ay);
        const y2 = y * Math.cos(ax) - z1 * Math.sin(ax);
        const z2 = y * Math.sin(ax) + z1 * Math.cos(ax);
        const d = 5.2 / (5.2 + z2);
        return { x: cx + x1 * scale * d, y: cy + y2 * scale * d + bob, z: z2 };
      });
      for (const pass of [1, 0]) {
        const ordered = faces.map((f) => ({ f, z: f.reduce((s, i) => s + proj[i].z, 0) / f.length })).sort((a, b) => b.z - a.z);
        for (const { f, z } of ordered) {
          ctx.beginPath();
          ctx.moveTo(proj[f[0]].x, proj[f[0]].y);
          for (let i = 1; i < f.length; i++) ctx.lineTo(proj[f[i]].x, proj[f[i]].y);
          ctx.closePath();
          if (pass) {
            ctx.strokeStyle = `hsla(${hue}, 100%, 78%, .85)`;
            ctx.lineWidth = 9;
            ctx.lineJoin = "round";
            ctx.stroke();
          } else {
            const l = 26 + (1 - (z + 1.6) / 3.2) * 46;
            ctx.fillStyle = `hsl(${hue} ${58 + l * 0.3}% ${l}%)`;
            ctx.fill();
            ctx.strokeStyle = `hsla(${hue}, 100%, 86%, .35)`;
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
      }
      if (showMotes) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        for (const m of motes) {
          const y = (m.y - t * m.sp) % 1;
          const yy = (y < 0 ? y + 1 : y) * H * 0.92;
          const spread = beamW * (0.3 + yy / H * 0.8);
          const x = cx + (m.x - 0.5) * 2 * spread + Math.sin(t * 0.9 + m.ph) * 9;
          ctx.fillStyle = `hsla(${hue}, 100%, 82%, ${0.16 + Math.sin(t * 2 + m.ph) * 0.14 + 0.2})`;
          ctx.beginPath();
          ctx.arc(x, yy, m.sz, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
      const nameSize = Math.max(20, W * 0.026);
      setFont(ctx, Math.max(11, W * 0.011), MONO, 600);
      ctx.textAlign = "center";
      ctx.fillStyle = `hsl(${hue} 90% 68%)`;
      ctx.fillText(rarity.name.toUpperCase(), cx, H * 0.955 - nameSize * 1.15);
      setFont(ctx, nameSize, SANS, 600);
      ctx.fillStyle = "rgba(255,255,255,.94)";
      ctx.fillText(label, cx, H * 0.955);
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
