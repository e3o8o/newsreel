// Scene: Apple's corners. The same control drawn twice — a plain border-radius and a real
// squircle — with the superellipse exponent animating so the corner visibly eases in and out
// of the kink. props: label, exponent, compare.
//
// Uses the drop's own path generator; only the demo chrome is new.

import { squirclePath, roundRectPath } from "./superellipse";

const W = 340;
const H = 116;

export default {
  async mount(host: HTMLElement, props: Record<string, unknown>) {
    host.style.background = "radial-gradient(120% 120% at 50% 0%, #ffffff 0%, #eaecf1 65%)";

    const row = document.createElement("div");
    Object.assign(row.style, {
      position: "absolute", inset: "0", display: "flex", alignItems: "center",
      justifyContent: "center", gap: "clamp(24px, 5vw, 72px)",
      fontFamily: "var(--font-neue-corp)",
    });
    host.appendChild(row);

    const svgNS = "http://www.w3.org/2000/svg";
    const make = (caption: string) => {
      const cell = document.createElement("div");
      Object.assign(cell.style, { display: "flex", flexDirection: "column", alignItems: "center", gap: "18px" });
      const svg = document.createElementNS(svgNS, "svg");
      svg.setAttribute("width", String(W));
      svg.setAttribute("height", String(H));
      svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
      const fill = document.createElementNS(svgNS, "path");
      fill.setAttribute("fill", "url(#sq-grad)");
      const grad = document.createElementNS(svgNS, "linearGradient");
      grad.setAttribute("id", "sq-grad");
      grad.setAttribute("x1", "0"); grad.setAttribute("y1", "0");
      grad.setAttribute("x2", "0"); grad.setAttribute("y2", "1");
      grad.innerHTML = '<stop offset="0" stop-color="#ffffff"/><stop offset="0.52" stop-color="#f4f4f5"/><stop offset="1" stop-color="#e9eaec"/>';
      const defs = document.createElementNS(svgNS, "defs");
      defs.appendChild(grad);
      const stroke = document.createElementNS(svgNS, "path");
      stroke.setAttribute("fill", "none");
      stroke.setAttribute("stroke", "#b6b9c0");
      stroke.setAttribute("stroke-width", "1.5");
      svg.append(defs, fill, stroke);

      const label = document.createElement("div");
      label.textContent = caption;
      Object.assign(label.style, {
        font: "500 13px/1 ui-monospace, SF Mono, Menlo, monospace",
        letterSpacing: "0.08em", textTransform: "uppercase", color: "#8a8d96",
      });

      const inner = document.createElement("div");
      Object.assign(inner.style, {
        position: "absolute", inset: "0", display: "grid", placeItems: "center",
        font: "600 19px/1 var(--font-neue-corp)", color: "#1c1d22", letterSpacing: "-0.01em",
      });
      inner.textContent = String(props.label ?? "Get the app");

      const stack = document.createElement("div");
      Object.assign(stack.style, { position: "relative", width: `${W}px`, height: `${H}px` });
      stack.append(svg, inner);
      cell.append(stack, label);
      return { cell, fill, stroke };
    };

    const plain = make("border-radius");
    const sq = make("squircle");
    row.append(plain.cell, sq.cell);

    const radius = 34;
    plain.fill.setAttribute("d", roundRectPath(W, H, radius));
    plain.stroke.setAttribute("d", roundRectPath(W, H, radius));

    let raf = 0;
    const t0 = performance.now();
    const frame = (now: number) => {
      // ease the exponent between a circle (2) and a boxy superellipse so the corner
      // continuously demonstrates what the knob does
      const t = (now - t0) / 1000;
      const e = 3.4 + Math.sin(t * 0.5) * 1.6; // ~1.8 .. 5.0, through the iOS 5.0 value
      const d = squirclePath({ width: W, height: H, radius, smoothing: 1, exponent: e });
      sq.fill.setAttribute("d", d);
      sq.stroke.setAttribute("d", d);
      raf = requestAnimationFrame(frame);
    };

    return {
      start: () => { raf = requestAnimationFrame(frame); },
      destroy: () => { cancelAnimationFrame(raf); row.remove(); },
    };
  },
};
