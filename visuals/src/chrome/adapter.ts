// Scene: liquid chrome word on black; the ghost pointer streams the horizon
// reflection across the letters; ramps can auto-cycle.
// props: word, ramp (index), cycleRampsSeconds.

import { Chrome } from "./engine";
import { ghostPointer } from "../shared/ghost";

export default {
  async mount(host: HTMLElement, props: Record<string, unknown>) {
    host.style.background = "#0b0c0e";
    // ⚠️ a real family list: Canvas 2D's font parser rejects var() outright,
    //    which silently rasterizes the word at the default 10px.
    const engine = new Chrome(host, "-apple-system, 'Helvetica Neue', Arial, sans-serif");
    if (!engine.ok) throw new Error("chrome: WebGL unavailable");
    if (typeof props.word === "string" && props.word) engine.setWord(props.word);
    let ramp = Number(props.ramp ?? 0);
    engine.setRamp(ramp);
    const canvas = host.querySelector("canvas");
    const ghost = canvas ? ghostPointer(host, { target: canvas, speed: 0.7 }) : null;
    let timer = 0;
    const cycle = Number(props.cycleRampsSeconds ?? 0);
    return {
      start: () => {
        engine.start();
        if (cycle > 0) {
          timer = window.setInterval(() => engine.setRamp(++ramp), cycle * 1000);
        }
      },
      action: async (name: string) => {
        if (name === "ramp") engine.setRamp(++ramp);
      },
      destroy: () => {
        if (timer) window.clearInterval(timer);
        ghost?.stop();
        engine.destroy();
      },
    };
  },
};
