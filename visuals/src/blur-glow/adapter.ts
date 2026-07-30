// Scene: a crisp word in a gradient-mapped glow on light paper, morphing
// through a word list, each in its own colour world. props: words[] (3).

import { BlurGlow } from "./engine";
import { WORDS } from "./params";

export default {
  async mount(host: HTMLElement, props: Record<string, unknown>) {
    if (Array.isArray(props.words) && props.words.length) {
      WORDS.splice(0, WORDS.length, ...(props.words as string[]).slice(0, 3));
      while (WORDS.length < 3) WORDS.push(WORDS[WORDS.length - 1]);
    }
    const engine = new BlurGlow(host);
    return {
      start: () => engine.start(),
      destroy: () => engine.destroy(),
    };
  },
};
