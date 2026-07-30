// Scene: chromatic glow word on a deep wall. Optionally cycles a word list
// through the preset colour worlds with the disperse-and-reform transition.
// props: word | words[] (cycle), spectral, split.

import { ChromaGlow, type ChromaParams } from "./engine";
import { defaultChromaParams, CHROMA_PRESETS } from "./params";

export default {
  async mount(host: HTMLElement, props: Record<string, unknown>) {
    const params: ChromaParams = {
      ...defaultChromaParams(),
      word: String(props.word ?? "financecrew"),
      ...(typeof props.split === "number" && { split: props.split }),
      ...(typeof props.spectral === "number" && { spectral: props.spectral }),
    };
    const engine = new ChromaGlow(host, params);
    if (!engine.ok) throw new Error("chroma: WebGL unavailable");
    // ⚠️ Canvas 2D rejects var() font strings; hand the engine a real stack.
    engine.setFont("-apple-system, 'Helvetica Neue', Arial, sans-serif");

    const words = Array.isArray(props.words) ? (props.words as string[]) : null;
    if (words && words.length) {
      // pair each word with a preset colour world, looping the dark presets
      const darks = CHROMA_PRESETS.filter((p) => !p.params.invert);
      engine.enableCycle(words, words.map((_, i) => darks[i % darks.length].params));
    }

    return {
      start: () => engine.start(),
      destroy: () => engine.destroy(),
    };
  },
};
