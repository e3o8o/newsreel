// Scene: dotcut — a lattice of touching circles with a glyph and patterns cut
// out as negative space, cycling six scenes with per-cell transitions.
// props: letter, cols, hold, morph.

import { DotCut } from "./engine";
import { SCENES } from "./scenes";

export default {
  async mount(host: HTMLElement, props: Record<string, unknown>) {
    if (typeof props.letter === "string" && props.letter) {
      SCENES[0].value = props.letter.slice(0, 1).toUpperCase();
    }
    const stage = document.createElement("div");
    Object.assign(stage.style, { position: "absolute", inset: "0" });
    host.appendChild(stage);
    const engine = new DotCut(stage, "-apple-system, 'Helvetica Neue', Arial, sans-serif");
    if (!engine.ok) throw new Error("dotcut: canvas unavailable");
    engine.setParams({
      ...(typeof props.cols === "number" && { cols: props.cols }),
      ...(typeof props.hold === "number" && { hold: props.hold }),
      ...(typeof props.morph === "number" && { morph: props.morph }),
    });
    return {
      start: () => engine.start(),
      action: async (name: string) => {
        if (name === "advance") engine.advance();
      },
      destroy: () => engine.destroy(),
    };
  },
};
