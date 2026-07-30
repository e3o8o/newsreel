// Scene: a word trailing downward into light (long-exposure accumulation),
// palettes washing every couple of seconds, ghost cursor built in.
// props: word, cyclePeriod.

import { FadeMotion, setFadeWord, pixelFontSpec } from "./engine";

export default {
  async mount(host: HTMLElement, props: Record<string, unknown>) {
    setFadeWord(String(props.word ?? "financecrew"));
    const engine = new FadeMotion(host);
    if (!engine.ok) throw new Error("fade: WebGL unavailable");
    engine.enableHero(Number(props.cyclePeriod ?? 2.4));
    engine.onBg = (css) => {
      host.style.backgroundColor = css;
    };
    if (document.fonts?.load) {
      try {
        await document.fonts.load(pixelFontSpec());
      } catch { /* fallback metrics are acceptable */ }
      engine.refreshFonts();
    }
    return {
      start: () => engine.start(),
      action: async (name: string) => {
        if (name === "next") engine.next();
      },
      destroy: () => engine.destroy(),
    };
  },
};
