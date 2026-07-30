// Scene: a frosted-glass word with labelled collaborator cursors drifting
// around it on looping paths, scattering from the ghost pointer.
// props: word, names[], colors[], page, ink.

import { FlyingCursors, type CursorDef } from "./engine";
import { frostedWord } from "./frosted";
import { ghostPointer } from "../shared/ghost";

const DEFAULT_DEFS: CursorDef[] = [
  { name: "Maija", color: "#7c4dff" },
  { name: "Karo", color: "#12a150" },
  { name: "JP", color: "#ff7a1a" },
];

export default {
  async mount(host: HTMLElement, props: Record<string, unknown>) {
    const page = String(props.page ?? "#f4f4f6");
    host.style.background = page;

    const center = document.createElement("div");
    Object.assign(center.style, {
      position: "absolute",
      inset: "0",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "var(--font-neue-montreal)",
      fontWeight: "700",
      fontSize: "clamp(3rem, 9vw, 7.5rem)",
      letterSpacing: "-0.03em",
      color: String(props.ink ?? "#1b1b1e"),
      zIndex: "1",
    });
    center.appendChild(
      frostedWord(String(props.word ?? "together"), {
        ink: String(props.ink ?? "#1b1b1e"),
        page,
      }),
    );
    host.appendChild(center);

    let defs = DEFAULT_DEFS;
    if (Array.isArray(props.names) && props.names.length) {
      const colors = Array.isArray(props.colors) ? (props.colors as string[]) : [];
      defs = (props.names as string[]).map((name, i) => ({
        name,
        color: colors[i] ?? DEFAULT_DEFS[i % DEFAULT_DEFS.length].color,
      }));
    }
    const engine = new FlyingCursors(host, defs);
    const ghost = ghostPointer(host, { speed: 0.5, boxX: 0.4, boxY: 0.35 });
    return {
      start: () => engine.start(),
      destroy: () => {
        ghost.stop();
        engine.destroy();
      },
    };
  },
};
