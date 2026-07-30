// Scene: a perspective field of images drifting behind text, parallaxed by depth and
// wrapping forever. props: images[] (urls), text, count.
//
// The drop's engine is already framework-free and needs no changes; it just needs pictures.
// With none supplied it generates its own — soft gradient plates, so the card demonstrates
// the motion without shipping stock photography.

import { ImageGalaxy, buildParticles } from "./engine";

function plate(i: number): string {
  const c = document.createElement("canvas");
  c.width = 320; c.height = 400;
  const ctx = c.getContext("2d")!;
  const h = (i * 47) % 360;
  const g = ctx.createLinearGradient(0, 0, 320, 400);
  g.addColorStop(0, `hsl(${h} 70% 62%)`);
  g.addColorStop(1, `hsl(${(h + 48) % 360} 66% 38%)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 320, 400);
  // a soft highlight so each plate has a little form rather than reading as flat paper
  const r = ctx.createRadialGradient(110, 90, 10, 160, 200, 260);
  r.addColorStop(0, "rgba(255,255,255,0.35)");
  r.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = r;
  ctx.fillRect(0, 0, 320, 400);
  return c.toDataURL("image/png");
}

export default {
  async mount(host: HTMLElement, props: Record<string, unknown>) {
    host.style.background = String(props.bg ?? "#f2f2f5");
    host.style.overflow = "hidden";

    const stage = document.createElement("div");
    Object.assign(stage.style, {
      position: "absolute", inset: "0",
      perspective: "1200px", transformStyle: "preserve-3d",
    });
    host.appendChild(stage);

    const count = Number(props.count ?? 14);
    const urls: string[] = Array.isArray(props.images) && (props.images as string[]).length
      ? (props.images as string[])
      : Array.from({ length: count }, (_, i) => plate(i));

    const els: HTMLElement[] = [];
    const overlays: (HTMLElement | null)[] = [];
    for (let i = 0; i < count; i++) {
      const wrap = document.createElement("div");
      Object.assign(wrap.style, {
        position: "absolute", width: "13%", aspectRatio: "4 / 5",
        borderRadius: "10px", overflow: "hidden",
        boxShadow: "0 12px 30px rgba(20,20,40,0.16)",
        willChange: "transform",
      });
      const img = document.createElement("img");
      img.src = urls[i % urls.length];
      Object.assign(img.style, { width: "100%", height: "100%", objectFit: "cover", display: "block" });
      const veil = document.createElement("div");
      Object.assign(veil.style, {
        position: "absolute", inset: "0", background: "#ffffff", opacity: "0", pointerEvents: "none",
      });
      wrap.append(img, veil);
      stage.appendChild(wrap);
      els.push(wrap);
      overlays.push(veil);
    }

    // the word that sits in front of the field
    const label = document.createElement("div");
    label.textContent = String(props.text ?? "drift");
    Object.assign(label.style, {
      position: "absolute", inset: "0", display: "grid", placeItems: "center",
      font: "700 clamp(2.5rem, 8vw, 6rem) var(--font-neue-corp)",
      letterSpacing: "-0.03em", color: "#15161c", zIndex: "5", pointerEvents: "none",
      mixBlendMode: "multiply",
    });
    host.appendChild(label);

    const engine = new ImageGalaxy(stage, els, overlays, buildParticles(count));
    return {
      start: () => engine.start(),
      destroy: () => { engine.destroy(); stage.remove(); label.remove(); },
    };
  },
};
