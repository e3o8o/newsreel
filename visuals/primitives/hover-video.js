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
var SANS = "'Helvetica Neue', Helvetica, Arial, sans-serif";

// src/hover-video/adapter.ts
var DEFAULT = [
  { label: "Motion", hue: 268 },
  { label: "Type", hue: 22 },
  { label: "Colour", hue: 168 }
];
function clipCanvas(hue, w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  const r = rng(hue + 3);
  const blobs = Array.from({ length: 5 }, () => ({
    x: r(),
    y: r(),
    rad: 0.22 + r() * 0.3,
    sx: (r() - 0.5) * 0.5,
    sy: (r() - 0.5) * 0.5,
    hue: hue + (r() - 0.5) * 90
  }));
  return {
    canvas: c,
    // t is the clip's own clock, which is what the rate spring scales
    draw(t) {
      ctx.fillStyle = `hsl(${hue} 60% 12%)`;
      ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = "lighter";
      for (const b of blobs) {
        const x = (b.x + Math.sin(t * b.sx + b.y * 6) * 0.3) * w;
        const y = (b.y + Math.cos(t * b.sy + b.x * 6) * 0.3) * h;
        const g = ctx.createRadialGradient(x, y, 1, x, y, b.rad * w);
        g.addColorStop(0, `hsla(${b.hue}, 92%, 62%, .85)`);
        g.addColorStop(1, "hsla(0,0%,0%,0)");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      }
      ctx.globalCompositeOperation = "source-over";
    }
  };
}
var adapter_default = {
  async mount(host, props) {
    const items = Array.isArray(props.items) && props.items.length ? props.items : DEFAULT;
    const clips = Array.isArray(props.clips) ? props.clips.filter((c) => typeof c === "string") : [];
    const accent = typeof props.accent === "string" ? props.accent : "#fff";
    const stage = document.createElement("div");
    Object.assign(stage.style, {
      position: "absolute",
      inset: "0",
      display: "flex",
      gap: "22px",
      alignItems: "center",
      justifyContent: "center",
      flexWrap: "wrap",
      background: typeof props.bg === "string" ? props.bg : "#0a0b10",
      fontFamily: SANS,
      color: accent
    });
    host.appendChild(stage);
    const OPEN_W = 300, OPEN_H = 190;
    const pills = items.map((item, i) => {
      const pill = document.createElement("div");
      Object.assign(pill.style, {
        position: "relative",
        width: "168px",
        height: "56px",
        borderRadius: "999px",
        overflow: "hidden",
        cursor: "pointer",
        display: "grid",
        placeItems: "center",
        background: "rgba(255,255,255,.07)",
        boxShadow: "inset 0 0 0 1px rgba(255,255,255,.16)",
        transition: "width 520ms cubic-bezier(.2,0,0,1), height 520ms cubic-bezier(.2,0,0,1),border-radius 520ms cubic-bezier(.2,0,0,1)"
      });
      const media = document.createElement("div");
      Object.assign(media.style, {
        position: "absolute",
        inset: "0",
        opacity: "0",
        transition: "opacity 340ms ease"
      });
      pill.appendChild(media);
      let video = null;
      let clip = null;
      if (clips[i]) {
        video = document.createElement("video");
        Object.assign(video, { src: clips[i], loop: true, muted: true, playsInline: true });
        Object.assign(video.style, { width: "100%", height: "100%", objectFit: "cover" });
        media.appendChild(video);
      } else {
        clip = clipCanvas(item.hue, OPEN_W, OPEN_H);
        Object.assign(clip.canvas.style, { width: "100%", height: "100%", objectFit: "cover" });
        media.appendChild(clip.canvas);
      }
      const label = document.createElement("span");
      Object.assign(label.style, {
        position: "relative",
        font: `500 15px/1 ${SANS}`,
        letterSpacing: "-.01em",
        textShadow: "0 1px 8px rgba(0,0,0,.6)",
        pointerEvents: "none"
      });
      label.textContent = item.label;
      pill.appendChild(label);
      stage.appendChild(pill);
      const state = { rate: 0, target: 0, t: Math.random() * 10 };
      const open = () => {
        state.target = 1;
        pill.style.width = `${OPEN_W}px`;
        pill.style.height = `${OPEN_H}px`;
        pill.style.borderRadius = "18px";
        media.style.opacity = "1";
        video?.play().catch(() => {
        });
      };
      const close = () => {
        state.target = 0;
        pill.style.width = "168px";
        pill.style.height = "56px";
        pill.style.borderRadius = "999px";
        media.style.opacity = "0";
      };
      pill.addEventListener("pointerenter", open);
      pill.addEventListener("pointerleave", close);
      return { pill, state, clip, video, open, close };
    });
    const dot = document.createElement("div");
    Object.assign(dot.style, {
      position: "absolute",
      width: "13px",
      height: "13px",
      borderRadius: "999px",
      background: "#fff",
      boxShadow: "0 0 0 3px rgba(255,255,255,.22), 0 2px 8px rgba(0,0,0,.5)",
      left: "0",
      top: "0",
      opacity: "0",
      pointerEvents: "none",
      zIndex: "5",
      transition: "transform 620ms cubic-bezier(.3,0,0,1), opacity 300ms ease"
    });
    stage.appendChild(dot);
    let raf = 0, last = performance.now(), tour = 0, at = -1;
    const tick = (now) => {
      const dt = Math.min(0.05, (now - last) / 1e3);
      last = now;
      for (const p of pills) {
        p.state.rate += (p.state.target - p.state.rate) * Math.min(1, dt * 6);
        p.state.t += dt * p.state.rate;
        if (p.video) p.video.playbackRate = Math.max(0.05, p.state.rate);
        else if (p.state.rate > 5e-3) p.clip.draw(p.state.t);
      }
      raf = requestAnimationFrame(tick);
    };
    const visit = (i) => {
      if (at >= 0) pills[at].close();
      at = i;
      const b = pills[i].pill.getBoundingClientRect();
      const s = stage.getBoundingClientRect();
      dot.style.transform = `translate(${b.left - s.left + b.width / 2}px, ${b.top - s.top + b.height * 0.62}px)`;
      dot.style.opacity = "1";
      pills[i].open();
    };
    return {
      start: () => {
        raf = requestAnimationFrame(tick);
        let i = 0;
        visit(0);
        tour = window.setInterval(() => visit(++i % pills.length), 2400);
      },
      action: async (name, args) => {
        if (name === "hover") visit(Number(args?.index ?? 0) % pills.length);
        if (name === "leave" && at >= 0) {
          pills[at].close();
          at = -1;
          dot.style.opacity = "0";
        }
      },
      destroy: () => {
        cancelAnimationFrame(raf);
        clearInterval(tour);
        stage.remove();
      }
    };
  }
};
export {
  adapter_default as default
};
