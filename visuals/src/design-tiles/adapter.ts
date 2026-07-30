// Scene: a short sentence packed edge to edge as solid colour tiles, flying in with
// clip-path wipes then idly re-rolling its swatches. props: words[].
//
// The glyph-measurement module the drop imports is written here (measure.ts) rather than
// shipped with it, so nothing external is needed.

import { DesignTiles } from "./engine";
import { WORDS } from "./palette";

export default {
  async mount(host: HTMLElement, props: Record<string, unknown>) {
    if (Array.isArray(props.words) && props.words.length) {
      WORDS.splice(0, WORDS.length, ...(props.words as string[]));
    }
    host.style.background = String(props.bg ?? "#fbfbfc");
    const engine = new DesignTiles(host);
    // The drop sizes itself for a page column (clamp() caps it at ~46px tall); a 1440-wide
    // frame wants the bar to actually fill it.
    const scale = () => {
      const bar = host.firstElementChild as HTMLElement | null;  // the engine's own root
      if (!bar) return;
      const w = bar.getBoundingClientRect().width || 1;
      const target = host.clientWidth * 0.82;
      bar.style.transformOrigin = "center";
      bar.style.transform = `scale(${Math.max(1, Math.min(6, target / w))})`;
    };
    return {
      start: () => {
        engine.start();
        // after the fly-in has laid the tiles out
        setTimeout(scale, 400);
        setTimeout(scale, 1600);
      },
      destroy: () => engine.destroy(),
    };
  },
};
