// Scene: a pixel fire on a low-resolution grid, with a live buffer the cursor shoves around
// that heals back toward the simulation. props: cols, palette.
//
// The original drop drives a game's sprite sheet; that art is not ours to redistribute, so
// the flames here are simulated instead — the classic "cool as it rises" cellular fire, which
// gives the same chunky flipbook look from nothing but a palette. The interaction (push the
// lit pixels around, watch them heal) is the drop's idea, kept.

const W = 48;
const H = 64;

// A hot palette: black through deep red, orange, yellow, white.
function ramp(): Uint8ClampedArray {
  const p = new Uint8ClampedArray(256 * 4);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    // three segments, so the fire keeps a visible ember/flame/core structure
    const r = Math.min(255, t * 3 * 255);
    const g = Math.max(0, Math.min(255, (t - 0.28) * 2.4 * 255));
    const b = Math.max(0, Math.min(255, (t - 0.7) * 3.6 * 255));
    p[i * 4] = r; p[i * 4 + 1] = g; p[i * 4 + 2] = b;
    p[i * 4 + 3] = i < 12 ? 0 : 255;   // the coolest cells are transparent, not black
  }
  return p;
}

export default {
  async mount(host: HTMLElement, props: Record<string, unknown>) {
    host.style.background = String(props.bg ?? "#0a0a0d");
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    Object.assign(canvas.style, {
      position: "absolute", inset: "0", width: "100%", height: "100%",
      imageRendering: "pixelated", display: "block",
    });
    host.appendChild(canvas);
    const ctx = canvas.getContext("2d")!;
    const img = ctx.createImageData(W, H);
    const pal = ramp();

    // heat field, one byte per cell; the bottom row is the fuel
    const heat = new Uint8ClampedArray(W * H);
    const idx = (x: number, y: number) => y * W + x;
    const seedRow = () => {
      for (let x = 0; x < W; x++) heat[idx(x, H - 1)] = 160 + Math.random() * 95;
    };
    seedRow();

    // pointer, in grid space: pushes heat sideways and adds some, like a hand through flame
    let px = -1, py = -1;
    const onMove = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      px = Math.floor(((e.clientX - r.left) / r.width) * W);
      py = Math.floor(((e.clientY - r.top) / r.height) * H);
    };
    host.addEventListener("pointermove", onMove);
    host.addEventListener("pointerleave", () => { px = py = -1; });

    // an autonomous hand, so the interaction reads with nobody at the mouse
    const t0 = performance.now();
    let raf = 0;
    const frame = (now: number) => {
      const t = (now - t0) / 1000;
      if (px < 0) {
        px = Math.round(W * (0.5 + Math.sin(t * 0.9) * 0.3));
        py = Math.round(H * (0.55 + Math.cos(t * 1.3) * 0.22));
      }

      seedRow();
      // propagate: each cell cools as it rises, with a random sideways drift
      for (let y = 0; y < H - 1; y++) {
        for (let x = 0; x < W; x++) {
          const src = idx((x + ((Math.random() * 3) | 0) - 1 + W) % W, y + 1);
          const decay = 2 + ((Math.random() * 5) | 0);
          heat[idx(x, y)] = Math.max(0, heat[src] - decay);
        }
      }

      // the cursor: shove heat away from it and light what it touches
      if (px >= 0 && py >= 0) {
        const R = 6;
        for (let dy = -R; dy <= R; dy++) {
          for (let dx = -R; dx <= R; dx++) {
            const x = px + dx, y = py + dy;
            if (x < 0 || y < 0 || x >= W || y >= H) continue;
            const d = Math.hypot(dx, dy);
            if (d > R) continue;
            const fall = 1 - d / R;
            const tx = Math.max(0, Math.min(W - 1, x + Math.round(dx * fall * 1.6)));
            const ty = Math.max(0, Math.min(H - 1, y + Math.round(dy * fall * 1.6) - 1));
            heat[idx(tx, ty)] = Math.max(heat[idx(tx, ty)], heat[idx(x, y)] * (0.7 + fall * 0.6));
            if (fall > 0.35) heat[idx(x, y)] *= 0.35;   // and cool where it passed
          }
        }
      }

      for (let i = 0; i < W * H; i++) {
        const c = heat[i] * 4;
        img.data[i * 4] = pal[c];
        img.data[i * 4 + 1] = pal[c + 1];
        img.data[i * 4 + 2] = pal[c + 2];
        img.data[i * 4 + 3] = pal[c + 3];
      }
      ctx.putImageData(img, 0, 0);
      raf = requestAnimationFrame(frame);
    };

    return {
      start: () => { raf = requestAnimationFrame(frame); },
      destroy: () => {
        cancelAnimationFrame(raf);
        host.removeEventListener("pointermove", onMove);
        canvas.remove();
      },
    };
  },
};
