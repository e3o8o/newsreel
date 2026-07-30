// A synthetic wandering pointer for capture: several drops light up under a
// cursor, and the harness has no human. Dispatches real pointermove events over
// the host (window- or element-level listeners both see what they expect), on
// the layered-sines wander the drops themselves use for their idle cursors.

export interface GhostHandle {
  stop(): void;
}

export function ghostPointer(
  host: HTMLElement,
  opts: {
    target?: EventTarget;   // where to dispatch (default: the host)
    speed?: number;         // wander speed multiplier
    boxX?: number;          // wander half-width as a fraction of host width
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
    target.dispatchEvent(
      new PointerEvent("pointermove", { clientX, clientY, bubbles: true, pointerType: "mouse" }),
    );
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return { stop: () => cancelAnimationFrame(raf) };
}
