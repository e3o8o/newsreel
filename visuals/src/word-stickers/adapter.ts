// Scene: die-cut vinyl word stickers scattered on a surface, flung around by the ghost
// pointer. props: words[], dark.
//
// The drop's WebGL peel renderer is not included in it; the engine's own DOM/canvas path
// covers everything else, so the stub in gl-sticker.ts is all that was missing.

import { WordStickers } from "./engine";
import { STICKERS } from "./stickers";

export default {
  async mount(host: HTMLElement, props: Record<string, unknown>) {
    if (Array.isArray(props.words) && props.words.length) {
      (props.words as string[]).slice(0, STICKERS.length).forEach((w, i) => {
        STICKERS[i].word = w;
      });
    }
    host.style.background = String(props.bg ?? "#f3f3f6");
    const engine = new WordStickers(host);

    // Drag one sticker around on a loop, so the physics reads without a hand on the mouse.
    let raf = 0;
    const t0 = performance.now();
    const fling = () => {
      const t = (now: number) => {
        const el = host.querySelector("div[style*='cursor: grab']") as HTMLElement | null;
        if (el) {
          const r = host.getBoundingClientRect();
          const k = ((now - t0) / 1000) * 0.6;
          const x = r.left + r.width * (0.5 + Math.sin(k) * 0.3);
          const y = r.top + r.height * (0.5 + Math.cos(k * 1.3) * 0.24);
          el.dispatchEvent(new PointerEvent("pointermove", { clientX: x, clientY: y, bubbles: true, pointerType: "mouse" }));
        }
        raf = requestAnimationFrame(t);
      };
      raf = requestAnimationFrame(t);
    };

    return {
      start: () => {
        engine.start();
        fling();
      },
      destroy: () => {
        cancelAnimationFrame(raf);
        engine.destroy();
      },
    };
  },
};
