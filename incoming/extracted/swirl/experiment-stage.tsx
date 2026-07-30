"use client";

// A compact swirl canvas for the experiments below the main rebuild. Same
// engine, smaller frame. The wrapper matches the main playground's canvas box
// (z-10, shadow, full rounding) so a control Panel can tuck under it. It
// forwards pointer moves (cursor bend) and clicks (shockwave) to the stage.

import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { useSwirlStage, type StageConfig, type StageEvents } from "./use-swirl-stage";

export function ExperimentStage({
  config,
  trackPointer = false,
  burstOnClick = false,
  onClick,
  replayKey,
  events,
  children,
}: {
  config: StageConfig;
  /** Forward normalized pointer (-1..1) to the stage each move (cursor bend). */
  trackPointer?: boolean;
  /** Spawn a shockwave on pointer down at the click point. */
  burstOnClick?: boolean;
  /** Extra click callback (e.g. bump a counter). */
  onClick?: () => void;
  /** Replay the entrance whenever this value changes (e.g. a pattern switch). */
  replayKey?: string | number;
  /** Lifecycle hooks (entrance start / settle / visibility) — e.g. for sound. */
  events?: StageEvents;
  /** Overlay (e.g. a hint line) rendered above the canvas. */
  children?: ReactNode;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cfg = useRef<StageConfig>(config);
  // Sync live config (colors, pattern, sliders) into the ref the frame loop
  // reads every frame, so panel controls update the effect without re-init.
  cfg.current = config;
  const [failed, setFailed] = useState(false);
  // The canvas fades in (opacity only) once it has painted AND is in view, and
  // fades back out when scrolled off the play band, so the idle state shows the
  // dashed placeholder rather than a frozen frame.
  const [painted, setPainted] = useState(false);
  const [inView, setInView] = useState(false);

  // Merge the caller's events with our reveal tracking; keep in a ref so the
  // stage reads the latest without re-initializing.
  const eventsRef = useRef<StageEvents>({});
  eventsRef.current = {
    ...events,
    onFirstFrame: () => {
      setPainted(true);
      events?.onFirstFrame?.();
    },
    onVisible: (v) => {
      setInView(v);
      events?.onVisible?.(v);
    },
  };

  const stage = useSwirlStage(canvasRef, cfg, () => setFailed(true), eventsRef);

  // Restart the formation when replayKey changes (the word condenses again).
  useEffect(() => {
    if (replayKey !== undefined) stage.current.replay();
  }, [replayKey, stage]);

  const norm = (e: PointerEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * 2 - 1,
      y: ((e.clientY - rect.top) / rect.height) * 2 - 1,
    };
  };

  // last pointer position (normalized) for a cheap speed estimate, used to drive
  // the cursor-move sound
  const prevPt = useRef<{ x: number; y: number } | null>(null);
  const handleMove = (e: PointerEvent) => {
    const p = norm(e);
    if (trackPointer) stage.current.setPointer(p);
    const onMove = eventsRef.current.onPointerMove;
    if (onMove) {
      const prev = prevPt.current;
      const speed = prev ? Math.min(1, Math.hypot(p.x - prev.x, p.y - prev.y) * 6) : 0;
      onMove(speed);
    }
    prevPt.current = p;
  };
  const wantsMove = trackPointer || !!events?.onPointerMove;
  const wantsDown = burstOnClick || !!events?.onPointerDown;

  return (
    <div
      // Idle backdrop reads like the Vault "more soon" cards: a light page-bg
      // panel with a dashed hairline border. Before the swirl paints / when it's
      // scrolled off the play band you see that, not a black box. Once the canvas
      // fades in it covers the panel; the solid border returns under it.
      className={`relative z-10 overflow-hidden rounded-xl ${
        painted && inView
          ? "border border-[var(--border-line)] bg-[color-mix(in_srgb,var(--bg-page)_97%,#000)]"
          : "border border-dashed border-[var(--border-line)] bg-[var(--bg-page)]"
      }`}
    >
      {failed ? (
        <div className="flex aspect-[16/9] w-full items-center justify-center px-6 text-center text-[12px] text-[var(--text-tertiary)]">
          WebGL2 unavailable here.
        </div>
      ) : (
        <canvas
          ref={canvasRef}
          style={{ opacity: painted && inView ? 1 : 0 }}
          className={`block aspect-[16/9] w-full transition-opacity duration-500 ease-[var(--ease-out)] motion-reduce:transition-none ${burstOnClick ? "cursor-pointer" : ""}`}
          onPointerMove={wantsMove ? handleMove : undefined}
          onPointerLeave={
            wantsMove
              ? () => {
                  if (trackPointer) stage.current.setPointer(null);
                  prevPt.current = null;
                }
              : undefined
          }
          onPointerDown={
            wantsDown
              ? (e) => {
                  const p = norm(e);
                  if (burstOnClick) stage.current.burst(p.x, p.y);
                  eventsRef.current.onPointerDown?.();
                  onClick?.();
                }
              : undefined
          }
        />
      )}
      {children}
    </div>
  );
}

