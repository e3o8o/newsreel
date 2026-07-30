// src/shared/source.ts
var SANS = "'Helvetica Neue', Helvetica, Arial, sans-serif";
var MONO = "'SF Mono', ui-monospace, Menlo, Consolas, monospace";

// src/ghost-reveal/adapter.ts
var ramp = (deg, feather) => `linear-gradient(${deg}deg, #000 0%, #000 ${33.3 - feather}%, rgba(0,0,0,0) ${33.3 + feather}%, rgba(0,0,0,0) 100%)`;
var SETUP = (feather) => ({
  right: { img: ramp(90, feather), size: "300% 100%", hidden: "100% 0", shown: "0% 0" },
  left: { img: ramp(270, feather), size: "300% 100%", hidden: "0% 0", shown: "100% 0" },
  down: { img: ramp(180, feather), size: "100% 300%", hidden: "0 100%", shown: "0 0" },
  up: { img: ramp(0, feather), size: "100% 300%", hidden: "0 0", shown: "0 100%" }
});
var adapter_default = {
  async mount(host, props) {
    const text = typeof props.text === "string" ? props.text : "materialise";
    const sub = typeof props.sub === "string" ? props.sub : "a feathered mask, not a fade";
    const dir = ["left", "right", "up", "down"].includes(props.direction) ? props.direction : "right";
    const accent = typeof props.accent === "string" ? props.accent : "#7c3aed";
    const feather = typeof props.feather === "number" ? Math.min(32, Math.max(0, props.feather)) : 14;
    const loop = props.loop !== false;
    const s = SETUP(feather)[dir];
    const stage = document.createElement("div");
    Object.assign(stage.style, {
      position: "absolute",
      inset: "0",
      display: "grid",
      placeItems: "center",
      background: typeof props.bg === "string" ? props.bg : "#0b0d12",
      fontFamily: SANS,
      color: "#fff"
    });
    host.appendChild(stage);
    const panel = document.createElement("div");
    Object.assign(panel.style, {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: "18px",
      padding: "56px 72px",
      borderRadius: "20px",
      background: "linear-gradient(140deg, rgba(255,255,255,.10), rgba(255,255,255,.03))",
      boxShadow: "inset 0 1px 0 rgba(255,255,255,.14)",
      maskImage: s.img,
      WebkitMaskImage: s.img,
      maskSize: s.size,
      WebkitMaskSize: s.size,
      maskRepeat: "no-repeat",
      WebkitMaskRepeat: "no-repeat",
      maskPosition: s.hidden,
      WebkitMaskPosition: s.hidden,
      transition: "mask-position 1500ms cubic-bezier(.4,0,.1,1), -webkit-mask-position 1500ms cubic-bezier(.4,0,.1,1)"
    });
    panel.innerHTML = `<div style="font:600 74px/1 ${SANS};letter-spacing:-.045em">${text}</div><div style="font:500 13px/1 ${MONO};letter-spacing:.16em;text-transform:uppercase;color:${accent}">${sub}</div>`;
    stage.appendChild(panel);
    const setPos = (v) => {
      panel.style.maskPosition = v;
      panel.style.setProperty("-webkit-mask-position", v);
    };
    let timer = 0, shown = false;
    const flip = () => {
      shown = !shown;
      setPos(shown ? s.shown : s.hidden);
    };
    return {
      start: () => {
        requestAnimationFrame(() => requestAnimationFrame(flip));
        if (loop) timer = window.setInterval(flip, 2800);
      },
      action: async (name) => {
        if (name === "reveal" || name === "toggle") flip();
      },
      destroy: () => {
        clearInterval(timer);
        stage.remove();
      }
    };
  }
};
export {
  adapter_default as default
};
