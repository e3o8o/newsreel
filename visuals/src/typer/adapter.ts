// Scene: the typer — lines reveal character by character, each glyph rippling
// through pill/highlight/border states. props: lines[], theme (dark|light),
// accent, fps, holdSeconds (then out+in loop when loop:true).

import { TyperGroup } from "./typer";
// @ts-expect-error esbuild text loader
import typerCss from "./typer.css";

export default {
  async mount(host: HTMLElement, props: Record<string, unknown>) {
    const dark = props.theme !== "light";
    const fg = dark ? "#f4f4f5" : "#1b1b1b";
    const bg = dark ? "#101014" : "#fcfcfc";
    const accent = String(props.accent ?? "#34d399");

    const style = document.createElement("style");
    style.textContent = typerCss as string;
    host.appendChild(style);
    host.style.background = bg;

    const block = document.createElement("div");
    Object.assign(block.style, {
      position: "absolute",
      inset: "0",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: "0.35em",
      textAlign: "center",
      fontFamily: "var(--font-neue-corp)",
      fontWeight: "600",
      fontSize: "clamp(2rem, 5.5vw, 4.6rem)",
      letterSpacing: "-0.02em",
    });
    const lines = Array.isArray(props.lines) ? (props.lines as string[]) : ["type it in", "not fade it in"];
    const els: HTMLElement[] = lines.map((line) => {
      const el = document.createElement("span");
      el.setAttribute("data-typer", "");
      el.dataset.typerType = "initial";
      el.style.setProperty("--typer-fg", fg);
      el.style.setProperty("--typer-bg", bg);
      el.style.setProperty("--typer-accent", accent);
      el.style.setProperty("--typer-accent-ink", bg);
      el.textContent = line;
      block.appendChild(el);
      return el;
    });
    host.appendChild(block);

    const group = new TyperGroup(els, { fps: Number(props.fps ?? 20), cycles: 3 }, 0.18);
    let timer = 0;
    return {
      start: () => {
        group.in();
        // loop mode: out then in again on a cadence, so long holds stay alive
        if (props.loop) {
          const hold = Number(props.holdSeconds ?? 3.4) * 1000;
          timer = window.setInterval(() => {
            group.out();
            window.setTimeout(() => group.in(), 1100);
          }, hold + 1100);
        }
      },
      action: async (name: string) => {
        if (name === "out") group.out();
        if (name === "in") group.in();
      },
      destroy: () => {
        if (timer) window.clearInterval(timer);
        group.destroy();
      },
    };
  },
};
