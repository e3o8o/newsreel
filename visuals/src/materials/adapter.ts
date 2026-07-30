// Scene: the ten button materials from the color-depth study, laid out as a grid on a
// neutral stage. Pure CSS plus the small companion script for the cursor-reactive ones
// (metal, foil) — the ghost pointer drives those. props: label, dark, materials[].

// @ts-expect-error esbuild text loader
import materialsCss from "./color-depth.css";
// @ts-expect-error plain JS companion, bundled alongside
import { initColorDepth } from "./color-depth.js";
import { ghostPointer } from "../shared/ghost";

const ALL = ["glossy", "glow", "metal", "layered", "inset", "glass", "neon", "duotone", "satin", "foil"];

// The five stacked layers foil needs around its label; every other material is one span.
function button(material: string, label: string): HTMLElement {
  const b = document.createElement("button");
  b.className = `depth-btn depth-${material}`;
  const lab = document.createElement("span");
  lab.className = "depth-label";
  lab.textContent = label;
  if (material === "foil") {
    for (const l of ["base", "film", "pearl"]) {
      const s = document.createElement("span");
      s.className = `depth-foil-l depth-foil-${l}`;
      s.setAttribute("aria-hidden", "true");
      b.appendChild(s);
    }
    b.appendChild(lab);
    for (const l of ["shine", "glare"]) {
      const s = document.createElement("span");
      s.className = `depth-foil-l depth-foil-${l}`;
      s.setAttribute("aria-hidden", "true");
      b.appendChild(s);
    }
  } else {
    b.appendChild(lab);
  }
  return b;
}

export default {
  async mount(host: HTMLElement, props: Record<string, unknown>) {
    const style = document.createElement("style");
    style.textContent = materialsCss as string;
    host.appendChild(style);

    const dark = props.dark !== false;
    host.style.background = dark
      ? "radial-gradient(120% 120% at 50% 0%, #1d1f27 0%, #0c0d12 60%)"
      : "radial-gradient(120% 120% at 50% 0%, #ffffff 0%, #eceef3 60%)";

    const grid = document.createElement("div");
    Object.assign(grid.style, {
      position: "absolute",
      inset: "0",
      display: "grid",
      gridTemplateColumns: "repeat(5, auto)",
      alignContent: "center",
      justifyContent: "center",
      gap: "34px 30px",
      padding: "0 6%",
      // the buttons are authored at UI scale; camera wants them larger
      transform: "scale(1.55)",
      transformOrigin: "center",
    });
    const label = String(props.label ?? "Get Started");
    const list = Array.isArray(props.materials) ? (props.materials as string[]) : ALL;
    for (const m of list) grid.appendChild(button(m, label));
    host.appendChild(grid);

    // Glass refracts through an SVG displacement filter that must exist once in the page.
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("id", "liquid-glass-svg");
    svg.setAttribute("width", "0");
    svg.setAttribute("height", "0");
    svg.style.position = "absolute";
    svg.innerHTML = `<filter id="liquid-glass-filter" x="-20%" y="-20%" width="140%" height="140%">
        <feTurbulence type="fractalNoise" baseFrequency="0.008 0.008" numOctaves="2" seed="7" result="n"/>
        <feGaussianBlur in="n" stdDeviation="3" result="nb"/>
        <feDisplacementMap in="SourceGraphic" in2="nb" scale="26" xChannelSelector="R" yChannelSelector="G"/>
      </filter>`;
    host.appendChild(svg);

    // The companion script binds the cursor-reactive materials (metal's glint, foil's
    // sheen). Called here, after the buttons exist -- its own auto-run fired at import.
    initColorDepth(host);
    // "hit": those listeners live on each BUTTON, and events bubble up, never down.
    const ghost = ghostPointer(host, { target: "hit", speed: 0.55, boxX: 0.34, boxY: 0.3 });

    return {
      start: () => { /* materials are CSS-driven; the ghost supplies the light */ },
      destroy: () => {
        ghost.stop();
        grid.remove();
      },
    };
  },
};
