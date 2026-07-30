// Scene: liquid UI. Two cards fuse into one skin with a concave (inverse-rounded) joint;
// the blend knob eases between crisp geometric joints and a gooey neck while the pieces
// drift, so the fused outline re-flows on camera. props: k, goo, cardRadius.
//
// Vanilla port of the React <LiquidGroup>: the engine (SDF smooth-union + marching squares)
// is already framework-free, so this only owns the DOM and the animation clock.

import { LiquidEngine, type LiquidBox } from "./engine";

const VW = 720;
const VH = 380;

interface Piece extends LiquidBox {
  content?: HTMLElement;
  // per-piece drift so the join is never static
  ax: number; ay: number; fx: number; fy: number; phase: number;
}

const bar = (w: string, h: string) => {
  const d = document.createElement("div");
  Object.assign(d.style, { width: w, height: h, borderRadius: "999px", background: "rgba(20,22,30,0.14)" });
  return d;
};

function bubbleBody(): HTMLElement {
  const wrap = document.createElement("div");
  Object.assign(wrap.style, { display: "flex", height: "100%", alignItems: "center", gap: "14px", padding: "0 22px" });
  const av = document.createElement("div");
  Object.assign(av.style, { width: "44px", height: "44px", flex: "none", borderRadius: "50%", background: "rgba(20,22,30,0.14)" });
  const lines = document.createElement("div");
  Object.assign(lines.style, { display: "flex", flexDirection: "column", gap: "9px", flex: "1" });
  lines.append(bar("78%", "10px"), bar("52%", "10px"));
  wrap.append(av, lines);
  return wrap;
}

export default {
  async mount(host: HTMLElement, props: Record<string, unknown>) {
    host.style.background = String(props.bg ?? "#eef0f5");

    // The fixed design space, centred and scaled to the host (the React version does the same).
    const space = document.createElement("div");
    Object.assign(space.style, {
      position: "absolute", left: "50%", top: "50%", width: `${VW}px`, height: `${VH}px`,
      transformOrigin: "center",
    });
    host.appendChild(space);
    const fit = () => {
      const s = Math.min(host.clientWidth / VW, host.clientHeight / VH) * 0.92;
      // ⚠️ ONE transform. Using the individual `scale` property alongside `transform`
      //    applies scale first, so the -50% translate resolves in scaled units and the
      //    stage slides off-centre. Composing both here is unambiguous.
      space.style.transform = `translate(-50%,-50%) scale(${s})`;
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(host);

    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("aria-hidden", "true");
    Object.assign(svg.style, { position: "absolute", overflow: "visible", pointerEvents: "none" });
    const path = document.createElementNS(svgNS, "path");
    path.setAttribute("fill", String(props.fill ?? "#ffffff"));
    path.setAttribute("filter", "drop-shadow(0 10px 24px rgba(20,22,40,0.10))");
    svg.appendChild(path);
    space.appendChild(svg);

    // Two pieces: a chat-bubble body and its tail, the composition the drop opens with.
    const pieces: Piece[] = [
      { id: "bubble", cx: 300, cy: 178, hw: 150, hh: 56, r: 40, ax: 16, ay: 8, fx: 0.21, fy: 0.33, phase: 0, content: bubbleBody() },
      { id: "tail", cx: 476, cy: 250, hw: 27, hh: 27, r: 14, ax: 30, ay: 22, fx: 0.29, fy: 0.19, phase: 1.7 },
    ];
    for (const p of pieces) {
      if (!p.content) continue;
      Object.assign(p.content.style, { position: "absolute", zIndex: "1" });
      space.appendChild(p.content);
    }

    const engine = new LiquidEngine();
    const goo = props.goo === true;
    const k = Number(props.k ?? (goo ? 64 : 24));
    engine.setParams({ k, cell: Number(props.cell ?? 6), smooth: 2 });

    let raf = 0;
    const t0 = performance.now();
    const frame = (now: number) => {
      const t = (now - t0) / 1000;
      const boxes: LiquidBox[] = pieces.map((p) => {
        const cx = p.cx + Math.sin(t * p.fx * 2 + p.phase) * p.ax;
        const cy = p.cy + Math.cos(t * p.fy * 2 + p.phase) * p.ay;
        if (p.content) {
          Object.assign(p.content.style, {
            left: `${cx - p.hw}px`, top: `${cy - p.hh}px`,
            width: `${p.hw * 2}px`, height: `${p.hh * 2}px`,
          });
        }
        return { id: p.id, cx, cy, hw: p.hw, hh: p.hh, r: p.r };
      });
      engine.setBoxes(boxes);
      const out = engine.compute();
      path.setAttribute("d", out.d);
      svg.setAttribute("viewBox", `${out.minX} ${out.minY} ${out.width} ${out.height}`);
      Object.assign(svg.style, {
        left: `${out.minX}px`, top: `${out.minY}px`,
        width: `${out.width}px`, height: `${out.height}px`,
      });
      raf = requestAnimationFrame(frame);
    };

    return {
      start: () => { raf = requestAnimationFrame(frame); },
      destroy: () => {
        cancelAnimationFrame(raf);
        ro.disconnect();
        space.remove();
      },
    };
  },
};
