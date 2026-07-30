// Scene: embroidered word patches stitched onto fabric; the ghost pointer
// sweeps the light so the satin stitching relights. props: words[] (3).

import { Embroidery } from "./engine";
import { WORDS } from "./patches";
import { ghostPointer } from "../shared/ghost";

export default {
  async mount(host: HTMLElement, props: Record<string, unknown>) {
    if (Array.isArray(props.words) && props.words.length === 3) {
      (props.words as string[]).forEach((w, i) => {
        WORDS[i].word = w;
      });
    }
    const engine = new Embroidery(host, "-apple-system, 'Helvetica Neue', Arial, sans-serif");
    if (!engine.ok) throw new Error("embroidery: WebGL unavailable");
    engine.setHover(1);
    const canvas = host.querySelector("canvas");
    const ghost = canvas ? ghostPointer(host, { target: canvas, speed: 0.45 }) : null;
    return {
      start: () => engine.start(),
      destroy: () => {
        ghost?.stop();
        engine.destroy();
      },
    };
  },
};
