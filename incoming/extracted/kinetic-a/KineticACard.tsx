"use client";

// The kinetic-typography Vault card: a bold letter warped through a tile grid in
// duotone (see ./engine.ts). Thin wrapper — mounts the framework-free engine,
// keeps it in sync with `params`, and pauses it offscreen or when the tab is
// hidden. Used both as the gallery card and the detail-page hero (share a
// view-transition-name so the card morphs into the hero).

import { useEffect, useRef, type CSSProperties } from "react";
import { KineticA as Engine, type KineticParams } from "./engine";
import { onTransitionChange } from "../../lib/view-transition";

// The card's default look: ink on paper, a calm ripple with a blue edge-split.
// The playground passes its own live params instead.
export const DEFAULT_PARAMS: KineticParams = {
  text: "a",
  paper: "#fcfcfc",
  ink: "#1b1b1b",
  accent: "#3b82f6",
  tiles: 34,
  offset: 26,
  speed: 0.02,
  spread: 0.025,
  chroma: 0.35,
  shade: 0.35,
  grain: 0.7,
};

export function KineticACard({
  flush = false,
  params = DEFAULT_PARAMS,
  viewTransitionName,
}: {
  /** Playground mode: round only the TOP so the control panel tucks under the
   *  flat bottom (matches PG_PREVIEW + PG_PANEL used by the other playgrounds). */
  flush?: boolean;
  params?: KineticParams;
  viewTransitionName?: string;
} = {}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<Engine | null>(null);

  // Mount once; lifecycle wiring lives here.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const engine = new Engine(stage, params);
    engineRef.current = engine;

    // Repaint the letter once the heavy display face loads (first paint may have
    // used the fallback).
    if (typeof document !== "undefined" && document.fonts) {
      const fam = getComputedStyle(document.documentElement)
        .getPropertyValue("--font-woodland")
        .split(",")[0]
        .trim();
      if (fam) {
        document.fonts.load(`700 64px ${fam}`).then(() => engine.refreshLetter()).catch(() => {});
      }
    }

    if (reduced) {
      engine.renderStatic();
      return () => {
        engine.destroy();
        engineRef.current = null;
      };
    }

    let onScreen = true;
    let hidden = false;
    let inTransition = false;
    // Freeze the rAF loop while a cross-route morph is running — the browser is
    // compositing page snapshots then, so a live canvas underneath only steals
    // the main thread / GPU (and can't visibly update anyway).
    const running = () => onScreen && !hidden && !inTransition;
    const sync = () => {
      if (running()) engine.start();
      else engine.stop();
    };
    sync();

    const ro = new ResizeObserver(() => engine.resize());
    ro.observe(stage);
    const io = new IntersectionObserver((es) => {
      onScreen = es[0]?.isIntersecting ?? true;
      sync();
    });
    io.observe(stage);
    const onVis = () => {
      hidden = document.hidden;
      sync();
    };
    document.addEventListener("visibilitychange", onVis);
    const offTransition = onTransitionChange((active) => {
      inTransition = active;
      sync();
    });

    return () => {
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      offTransition();
      engine.destroy();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Push live param changes to the running engine (playground drives this).
  useEffect(() => {
    engineRef.current?.setParams(params);
  }, [params]);

  // The engine paints its own paper colour, so the frame bg only shows for the
  // split second before mount. In `flush` (playground) mode the bottom is square
  // and the panel tucks under it; otherwise it's a fully-rounded card.
  // flush = the PG_PREVIEW recipe: a FULLY-rounded box at z-10, so PG_PANEL's
  // -mt-5 slides up BEHIND it and the preview keeps its own rounded bottom.
  const shape = flush
    ? "relative z-10 rounded-xl border"
    : "rounded-[12px] border";

  const style: CSSProperties | undefined = viewTransitionName
    ? { viewTransitionName, background: params.paper }
    : { background: params.paper };

  return (
    <div
      ref={stageRef}
      data-canvas-card
      style={style}
      className={`relative mx-auto aspect-video w-full select-none overflow-hidden border-[var(--border-line)] ${shape}`}
    />
  );
}

