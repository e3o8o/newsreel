// visuals/src/squircle/superellipse.ts
var DEFAULT_EXPONENT = 5;
var n = (v) => v.toFixed(4);
var CORNER = [
  [[0.3, 0], [0.473, 0], [0.619, 0.039]],
  [[0.804, 0.088], [0.912, 0.196], [0.961, 0.381]],
  [[1, 0.527], [1, 0.7], [1, 1]]
];
function rot90([x, y], k) {
  switch ((k % 4 + 4) % 4) {
    case 1:
      return [y, -x];
    case 2:
      return [-x, -y];
    case 3:
      return [-y, x];
    default:
      return [x, y];
  }
}
function cornerCubics(sx, sy, radius, k) {
  const put = (p) => {
    const [rx, ry] = rot90(p, k);
    return `${n(sx + rx * radius)} ${n(sy + ry * radius)}`;
  };
  return CORNER.map(([c1, c2, end]) => `C ${put(c1)} ${put(c2)} ${put(end)}`).join(" ");
}
function cornerSampled(sx, sy, radius, k, exponent) {
  const STEPS = 32;
  const e = 2 / exponent;
  const pts = [];
  for (let i = 1; i <= STEPS; i++) {
    const t = i / STEPS * (Math.PI / 2);
    const ux = Math.pow(Math.sin(t), e);
    const uy = 1 - Math.pow(Math.cos(t), e);
    const [rx, ry] = rot90([ux, uy], k);
    pts.push(`L ${n(sx + rx * radius)} ${n(sy + ry * radius)}`);
  }
  return pts.join(" ");
}
function squirclePath({ width, height, radius, smoothing, exponent = DEFAULT_EXPONENT }) {
  const budget = Math.min(width, height) / 2;
  const s = Math.max(0, Math.min(1, smoothing));
  const r = Math.max(0, Math.min(radius, budget)) * (0.4 + 0.6 * s);
  if (r <= 0) {
    return `M 0 0 L ${n(width)} 0 L ${n(width)} ${n(height)} L 0 ${n(height)} Z`;
  }
  const useBezier = Math.abs(exponent - DEFAULT_EXPONENT) < 0.05;
  const corner = (sx, sy, k) => useBezier ? cornerCubics(sx, sy, r, k) : cornerSampled(sx, sy, r, k, exponent);
  return [
    `M ${n(r)} 0`,
    `L ${n(width - r)} 0`,
    corner(width - r, 0, 0),
    `L ${n(width)} ${n(height - r)}`,
    corner(width, height - r, 3),
    `L ${n(r)} ${n(height)}`,
    corner(r, height, 2),
    `L 0 ${n(r)}`,
    corner(0, r, 1),
    "Z"
  ].join(" ");
}
function roundRectPath(w, h, r) {
  const rr = Math.max(0, Math.min(r, Math.min(w, h) / 2));
  return `M ${rr} 0 L ${w - rr} 0 A ${rr} ${rr} 0 0 1 ${w} ${rr} L ${w} ${h - rr} A ${rr} ${rr} 0 0 1 ${w - rr} ${h} L ${rr} ${h} A ${rr} ${rr} 0 0 1 0 ${h - rr} L 0 ${rr} A ${rr} ${rr} 0 0 1 ${rr} 0 Z`;
}

// visuals/src/squircle/adapter.ts
var W = 340;
var H = 116;
var adapter_default = {
  async mount(host, props) {
    host.style.background = "radial-gradient(120% 120% at 50% 0%, #ffffff 0%, #eaecf1 65%)";
    const row = document.createElement("div");
    Object.assign(row.style, {
      position: "absolute",
      inset: "0",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: "clamp(24px, 5vw, 72px)",
      fontFamily: "var(--font-neue-corp)"
    });
    host.appendChild(row);
    const svgNS = "http://www.w3.org/2000/svg";
    const make = (caption) => {
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
      grad.setAttribute("x1", "0");
      grad.setAttribute("y1", "0");
      grad.setAttribute("x2", "0");
      grad.setAttribute("y2", "1");
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
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "#8a8d96"
      });
      const inner = document.createElement("div");
      Object.assign(inner.style, {
        position: "absolute",
        inset: "0",
        display: "grid",
        placeItems: "center",
        font: "600 19px/1 var(--font-neue-corp)",
        color: "#1c1d22",
        letterSpacing: "-0.01em"
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
    const frame = (now) => {
      const t = (now - t0) / 1e3;
      const e = 3.4 + Math.sin(t * 0.5) * 1.6;
      const d = squirclePath({ width: W, height: H, radius, smoothing: 1, exponent: e });
      sq.fill.setAttribute("d", d);
      sq.stroke.setAttribute("d", d);
      raf = requestAnimationFrame(frame);
    };
    return {
      start: () => {
        raf = requestAnimationFrame(frame);
      },
      destroy: () => {
        cancelAnimationFrame(raf);
        row.remove();
      }
    };
  }
};
export {
  adapter_default as default
};
