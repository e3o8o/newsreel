// Scene: ASCII vortex title. A soup of aphorism text swirls, then the word
// condenses out of it. props: word, style, ink (stops), logoColor, bg,
// turbulence, zoom, wave.

import { SwirlStage, type StageConfig } from "./stage";
import { DEFAULT_TEXT } from "./default-text";
import type { FontStyle } from "./block-font";
import type { WavePattern } from "./vortex-field";

export default {
  async mount(host: HTMLElement, props: Record<string, unknown>) {
    const canvas = document.createElement("canvas");
    Object.assign(canvas.style, { position: "absolute", inset: "0", width: "100%", height: "100%" });
    host.style.background = String(props.bg ?? "#0b0e14");
    host.appendChild(canvas);

    const cfg: StageConfig = {
      word: String(props.word ?? "financecrew"),
      style: (props.style as FontStyle) ?? "slant",
      inkStops: Array.isArray(props.ink) ? (props.ink as string[]) : ["#34d399", "#818cf8", "#f472b6"],
      logoColor: String(props.logoColor ?? "#f8fafc"),
      gradient: true,
      gradientAngle: 0.6,
      gradientFlow: Number(props.flow ?? 0.06),
      bg: String(props.bg ?? "#0b0e14"),
      text: String(props.text ?? DEFAULT_TEXT),
      scanlines: Number(props.scanlines ?? 0.45),
      aberration: 1,
      curvature: 1,
      zoom: Number(props.zoom ?? 1.05),
      trail: false,
      shock: false,
      turbulence: Number(props.turbulence ?? 0.3),
      wavePattern: (props.wave as WavePattern) ?? "wavefront",
    };
    const stage = new SwirlStage(canvas, cfg);
    if (!stage.ok) throw new Error("swirl: WebGL2 unavailable");
    return {
      start: () => stage.start(),
      action: async (name: string) => {
        if (name === "replay") stage.replay();
      },
      destroy: () => stage.destroy(),
    };
  },
};
