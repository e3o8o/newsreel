// Scene: kinetic typography — a letter or short word cut into tiles, rippling
// on interference waves, duotone with a chromatic split.
// props: text, paper, ink, accent, tiles, offset, chroma.

import { KineticA, type KineticParams } from "./engine";

const DEFAULTS: KineticParams = {
  text: "a",
  paper: "#fcfcfc",
  ink: "#1b1b1b",
  accent: "#3b82f6",
  tiles: 34,
  offset: 26,
  speed: 0.02,
  spread: 0.025,
  chroma: 0.35,
  shade: 0.35,
  grain: 0.7,
};

export default {
  async mount(host: HTMLElement, props: Record<string, unknown>) {
    const stage = document.createElement("div");
    Object.assign(stage.style, { position: "absolute", inset: "0" });
    host.appendChild(stage);
    const params: KineticParams = {
      ...DEFAULTS,
      ...(typeof props.text === "string" && { text: props.text }),
      ...(typeof props.paper === "string" && { paper: props.paper }),
      ...(typeof props.ink === "string" && { ink: props.ink }),
      ...(typeof props.accent === "string" && { accent: props.accent }),
      ...(typeof props.tiles === "number" && { tiles: props.tiles }),
      ...(typeof props.offset === "number" && { offset: props.offset }),
      ...(typeof props.chroma === "number" && { chroma: props.chroma }),
    };
    const engine = new KineticA(stage as HTMLDivElement, params);
    return {
      start: () => engine.start(),
      destroy: () => engine.destroy(),
    };
  },
};
