// Scene: a wordmark rendered as a dense grid of tiles, lit by a wandering
// colour wave; the ghost pointer brushes the light blob across it.
// props: word, bg.

import { TileField, ROWS } from "./engine";
import { ghostPointer } from "../shared/ghost";

export default {
  async mount(host: HTMLElement, props: Record<string, unknown>) {
    if (typeof props.word === "string" && props.word) ROWS[0].word = props.word;
    host.style.background = String(props.bg ?? "#f6f6f8");
    const stage = document.createElement("div");
    Object.assign(stage.style, { position: "absolute", inset: "6% 4%" });
    host.appendChild(stage);
    const engine = new TileField(stage);
    // the engine listens on window and hit-tests against its own canvas rect
    const ghost = ghostPointer(stage, { target: window, speed: 0.8 });
    return {
      start: () => engine.start(),
      destroy: () => {
        ghost.stop();
        engine.destroy();
      },
    };
  },
};
