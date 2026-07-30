// A synthetic wandering pointer for capture: several drops light up under a cursor, and the
// harness has no human. Dispatches real pointermove events on the layered-sines wander the
// drops themselves use for their idle cursors.
//
// `target` decides WHO hears the event, and it matters:
//   - an element  -> dispatched there (engines that listen on their own canvas)
//   - window      -> engines that listen globally and hit-test themselves
//   - "hit"       -> dispatched on whatever sits under the point (elementFromPoint), which is
//                    the only mode that reaches per-element listeners: events bubble UP, so a
//                    listener on a button never sees one fired at its container.

export interface GhostHandle {
  stop(): void;
}

export function ghostPointer(
  host: HTMLElement,
  opts: {
    target?: EventTarget | "hit";
    speed?: number;   // wander speed multiplier
    boxX?: number;    // wander half-width as a fraction of host width
    boxY?: number;
  } = {},
): GhostHandle {
  const target = opts.target ?? host;
  const speed = opts.speed ?? 1;
  const bx = opts.boxX ?? 0.32;
  const by = opts.boxY ?? 0.28;
  let raf = 0;
  const t0 = performance.now();

  const tick = (now: number) => {
    const t = ((now - t0) / 1000) * speed;
    const r = host.getBoundingClientRect();
    const gx =
      0.55 * Math.sin(t * 1.15) + 0.3 * Math.sin(t * 2.6 + 1.0) + 0.15 * Math.cos(t * 4.1 + 0.4);
    const gy =
      0.55 * Math.cos(t * 0.95 + 2.1) + 0.3 * Math.sin(t * 2.2 + 0.5) + 0.15 * Math.cos(t * 3.7 + 1.7);
    const clientX = r.left + r.width * (0.5 + gx * bx);
    const clientY = r.top + r.height * (0.5 + gy * by);
    const ev = () =>
      new PointerEvent("pointermove", { clientX, clientY, bubbles: true, pointerType: "mouse" });
    if (target === "hit") {
      const el = document.elementFromPoint(clientX, clientY);
      (el || host).dispatchEvent(ev());
    } else {
      (target as EventTarget).dispatchEvent(ev());
    }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return { stop: () => cancelAnimationFrame(raf) };
}
