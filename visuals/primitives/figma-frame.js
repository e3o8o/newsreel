// src/shared/source.ts
var SANS = "'Helvetica Neue', Helvetica, Arial, sans-serif";
var MONO = "'SF Mono', ui-monospace, Menlo, Consolas, monospace";

// src/figma-frame/adapter.ts
var px = (n) => `${Math.round(n)}px`;
var adapter_default = {
  async mount(host, props) {
    const accent = typeof props.accent === "string" ? props.accent : "#0d99ff";
    const label = typeof props.label === "string" ? props.label : "Hero / Card";
    const title = typeof props.title === "string" ? props.title : "Selection";
    const body = typeof props.body === "string" ? props.body : "Every handle, badge and tab is a positioned box. The border is one animated stroke.";
    const cycle = props.cycle !== false;
    const stage = document.createElement("div");
    Object.assign(stage.style, {
      position: "absolute",
      inset: "0",
      display: "grid",
      placeItems: "center",
      background: "#f6f7f9",
      fontFamily: SANS,
      color: "#14161a"
    });
    host.appendChild(stage);
    const wrap = document.createElement("div");
    Object.assign(wrap.style, { position: "relative" });
    stage.appendChild(wrap);
    const card = document.createElement("div");
    Object.assign(card.style, {
      width: px(typeof props.width === "number" ? props.width : 520),
      height: px(typeof props.height === "number" ? props.height : 300),
      borderRadius: "14px",
      background: "#fff",
      boxSizing: "border-box",
      padding: "34px 36px",
      display: "flex",
      flexDirection: "column",
      gap: "12px",
      boxShadow: "0 1px 2px rgba(0,0,0,.06), 0 16px 40px rgba(15,18,34,.10)",
      transition: "width 620ms cubic-bezier(.2,0,0,1), height 620ms cubic-bezier(.2,0,0,1)"
    });
    card.innerHTML = `<div style="font:600 26px/1.1 ${SANS};letter-spacing:-.03em">${title}</div><div style="font:400 15px/1.55 ${SANS};color:#52525b;max-width:38ch">${body}</div>`;
    wrap.appendChild(card);
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    Object.assign(svg.style, { position: "absolute", inset: "-1px", overflow: "visible", pointerEvents: "none" });
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", "100%");
    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("x", "0");
    rect.setAttribute("y", "0");
    rect.setAttribute("width", "100%");
    rect.setAttribute("height", "100%");
    rect.setAttribute("rx", "14");
    rect.setAttribute("fill", "none");
    rect.setAttribute("stroke", accent);
    rect.setAttribute("stroke-width", "2");
    rect.setAttribute("stroke-dasharray", "7 5");
    svg.appendChild(rect);
    wrap.appendChild(svg);
    const handles = [];
    for (const [x, y] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
      const h = document.createElement("div");
      Object.assign(h.style, {
        position: "absolute",
        width: "9px",
        height: "9px",
        borderRadius: "2px",
        background: "#fff",
        boxShadow: `0 0 0 1.5px ${accent}, 0 1px 3px rgba(0,0,0,.18)`,
        left: x ? "100%" : "0",
        top: y ? "100%" : "0",
        transform: "translate(-50%,-50%)",
        pointerEvents: "none"
      });
      wrap.appendChild(h);
      handles.push(h);
    }
    const tab = document.createElement("div");
    Object.assign(tab.style, {
      position: "absolute",
      left: "0",
      top: "-26px",
      padding: "3px 7px",
      borderRadius: "4px",
      background: accent,
      color: "#fff",
      font: `500 11px/1 ${MONO}`,
      letterSpacing: ".02em",
      whiteSpace: "nowrap",
      pointerEvents: "none"
    });
    tab.textContent = label;
    wrap.appendChild(tab);
    const badge = document.createElement("div");
    Object.assign(badge.style, {
      position: "absolute",
      left: "50%",
      top: "100%",
      marginTop: "9px",
      transform: "translateX(-50%)",
      padding: "3px 8px",
      borderRadius: "4px",
      background: accent,
      color: "#fff",
      font: `500 11px/1 ${MONO}`,
      whiteSpace: "nowrap",
      pointerEvents: "none"
    });
    wrap.appendChild(badge);
    let raf = 0, dash = 0, timer = 0, step = 0;
    const SIZES = [[520, 300], [420, 380], [600, 260], [520, 300]];
    const tick = () => {
      dash = (dash + 0.35) % 12;
      rect.setAttribute("stroke-dashoffset", String(-dash));
      const b = card.getBoundingClientRect();
      badge.textContent = `${Math.round(b.width)} \xD7 ${Math.round(b.height)}`;
      raf = requestAnimationFrame(tick);
    };
    return {
      start: () => {
        raf = requestAnimationFrame(tick);
        if (cycle) {
          timer = window.setInterval(() => {
            step = (step + 1) % SIZES.length;
            card.style.width = px(SIZES[step][0]);
            card.style.height = px(SIZES[step][1]);
          }, 1900);
        }
      },
      action: async (name) => {
        if (name === "resize") {
          step = (step + 1) % SIZES.length;
          card.style.width = px(SIZES[step][0]);
          card.style.height = px(SIZES[step][1]);
        }
      },
      destroy: () => {
        cancelAnimationFrame(raf);
        clearInterval(timer);
        stage.remove();
      }
    };
  }
};
export {
  adapter_default as default
};
