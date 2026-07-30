// src/aurora/adapter.ts
var NS = "http://www.w3.org/2000/svg";
var VBW = 1271;
var VBH = 599;
var STOPS = [
  [0, "#340B05"],
  [0.1827, "#0358F7"],
  [0.2837, "#5092C7"],
  [0.4135, "#E1ECFE"],
  [0.5866, "#FFD400"],
  [0.6827, "#FA3D1D"],
  [0.8029, "#FD02F5"],
  [1, "#FFC0FD00"]
];
function bellHeights(n, peak, valley) {
  const mid = (n - 1) / 2;
  return Array.from({ length: n }, (_, i) => {
    const t = mid === 0 ? 0 : Math.abs(i - mid) / mid;
    const eased = 1 - Math.pow(t, 1.24);
    return peak * VBH * (valley + (1 - valley) * eased);
  });
}
function el(name, attrs = {}) {
  const e = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  return e;
}
function defs(id, blur, stops) {
  const d = el("defs");
  const grad = el("linearGradient", { id: `${id}-grad`, x1: 0, y1: 1, x2: 0, y2: 0 });
  for (const [offset, color] of stops) grad.appendChild(el("stop", { offset, "stop-color": color }));
  const f = el("filter", { id: `${id}-blur`, x: "-50%", y: "-50%", width: "200%", height: "200%" });
  f.appendChild(el("feGaussianBlur", { stdDeviation: blur }));
  d.append(grad, f);
  return d;
}
function bars(id, n, blur, stops) {
  const svg = el("svg", { viewBox: `0 0 ${VBW} ${VBH}`, preserveAspectRatio: "none", fill: "none" });
  svg.appendChild(defs(id, blur, stops));
  const colW = VBW / n;
  bellHeights(n, 0.98, 0.55).forEach((h, i) => {
    const g = el("g", { filter: `url(#${id}-blur)` });
    g.appendChild(el("rect", { x: i * colW, y: VBH - h, width: colW * 1.23, height: h, fill: `url(#${id}-grad)` }));
    svg.appendChild(g);
  });
  return svg;
}
function peaked(id, blur, stops) {
  const svg = el("svg", { viewBox: `0 0 ${VBW} ${VBH}`, preserveAspectRatio: "none", fill: "none" });
  svg.appendChild(defs(id, blur * 1.6, stops));
  const d = `M0 ${VBH} C ${VBW * 0.2} ${VBH * 0.75}, ${VBW * 0.32} ${VBH * 0.12}, ${VBW * 0.5} ${VBH * 0.1} C ${VBW * 0.68} ${VBH * 0.12}, ${VBW * 0.8} ${VBH * 0.75}, ${VBW} ${VBH} Z`;
  const g = el("g", { filter: `url(#${id}-blur)` });
  g.appendChild(el("path", { d, fill: `url(#${id}-grad)` }));
  svg.appendChild(g);
  return svg;
}
function dodge(id, blur, stops) {
  const svg = el("svg", { viewBox: `0 0 ${VBW} ${VBH}`, preserveAspectRatio: "none", fill: "none" });
  svg.appendChild(defs(id, blur * 2.2, stops));
  const g = el("g", { filter: `url(#${id}-blur)`, style: "mix-blend-mode: color-dodge" });
  g.appendChild(el("ellipse", { cx: VBW / 2, cy: VBH * 1.05, rx: VBW * 0.46, ry: VBH * 0.78, fill: `url(#${id}-grad)` }));
  svg.appendChild(g);
  return svg;
}
var adapter_default = {
  async mount(host, props) {
    host.style.background = String(props.bg ?? "#07070b");
    const blur = Number(props.blur ?? 15);
    const n = Number(props.bars ?? 9);
    const stops = Array.isArray(props.palette) && props.palette.length ? props.palette.map((c, i2, a) => [i2 / (a.length - 1), c]) : STOPS;
    const stage = document.createElement("div");
    Object.assign(stage.style, { position: "absolute", inset: "0", overflow: "hidden" });
    host.appendChild(stage);
    const makers = [
      () => bars(`a${Date.now()}`, n, blur, stops),
      () => peaked(`b${Date.now()}`, blur, stops),
      () => dodge(`c${Date.now()}`, blur, stops)
    ];
    let i = 0;
    let current = null;
    const show = () => {
      const wrap = document.createElement("div");
      Object.assign(wrap.style, {
        position: "absolute",
        inset: "0",
        transformOrigin: "bottom",
        transform: "scaleY(0)",
        opacity: "0",
        transition: "transform 1100ms cubic-bezier(0.16,1,0.3,1), opacity 500ms ease",
        willChange: "transform"
      });
      const svg = makers[i % makers.length]();
      Object.assign(svg.style, { width: "100%", height: "100%" });
      wrap.appendChild(svg);
      stage.appendChild(wrap);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        wrap.style.transform = "scaleY(1)";
        wrap.style.opacity = "1";
      }));
      const old = current;
      if (old) {
        old.style.opacity = "0";
        setTimeout(() => old.remove(), 600);
      }
      current = wrap;
      i++;
    };
    let timer = 0;
    return {
      start: () => {
        show();
        const every = Number(props.cycleSeconds ?? 4) * 1e3;
        timer = window.setInterval(show, every);
      },
      action: async (name) => {
        if (name === "next") show();
      },
      destroy: () => {
        if (timer) window.clearInterval(timer);
        stage.remove();
      }
    };
  }
};
export {
  adapter_default as default
};
