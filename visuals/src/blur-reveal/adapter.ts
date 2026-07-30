// Scene: vivid colour panels cycling one line each through the cloudy
// mask-reveal-blur. props: panels[] of {line,bg,fg}.

import { BlurReveal } from "./engine";
import { PANELS } from "./panels";

export default {
  async mount(host: HTMLElement, props: Record<string, unknown>) {
    if (Array.isArray(props.panels) && props.panels.length) {
      PANELS.splice(
        0,
        PANELS.length,
        ...(props.panels as { line: string; bg: string; fg: string }[]),
      );
    }
    const engine = new BlurReveal(host);
    return {
      start: () => engine.start(),
      destroy: () => engine.destroy(),
    };
  },
};
