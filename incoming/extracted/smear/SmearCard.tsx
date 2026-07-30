"use client";

// The Vault card + detail hero: a word trailing downward into light.
//
// Nothing is blurred. The word is stamped a couple of hundred times, each copy a
// step further down and each one barely visible, so where many copies overlap it
// reads solid and where few overlap it fades out. Drawn as light on a dark ground
// so the copies ADD — it reads as a long exposure, not a stack of shadows.
//
// Standard live-card lifecycle: built one frame after it nears view, paused
// offscreen / tab-hidden / during a cross-route morph, one still frame under
// reduced motion.

import { useEffect, useRef } from "react";
import { FadeMotion, pixelFontSpec } from "./engine";
import { onTransitionChange } from "../../lib/view-transition";

export function SmearCard({
  bare = false,
  viewTransitionName,
}: { bare?: boolean; viewTransitionName?: string } = {}) {
  void bare;
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let engine: FadeMotion | null = null;
    let raf = 0;
    let created = false;
    let onScreen = false;
    let hidden = false;
    let inTransition = false;

    const running = () => onScreen && !hidden && !inTransition;
    const sync = () => {
      if (!engine || reduced) return;
      if (running()) engine.start();
      else engine.stop();
    };

    const create = () => {
      if (created) return;
      created = true;
      raf = requestAnimationFrame(() => {
        if (!hostRef.current) return;
        engine = new FadeMotion(host);
        if (!engine.ok) return;
        // The card and the detail hero run themselves: a ghost cursor works the
        // effect and the palette washes to the next preset every couple of
        // seconds. Without it a visitor who never hovers (or is on a phone, where
        // there is no hover at all) sees a still frame and none of the reason this
        // exists. The playground deliberately does NOT do this — there the point
        // is that YOU drive it. A real pointer overrides the ghost either way.
        //
        // Not under reduced motion: there the card is one still frame, and a
        // self-running ghost plus a colour cycle is exactly the kind of unrequested
        // movement that setting exists to refuse.
        if (!reduced) engine.enableHero(2);
        // Keep the card's own background in step with the canvas, so the frame and
        // the art change together instead of a fixed grey box disagreeing with the
        // picture inside it through every transition.
        engine.onBg = (css) => {
          host.style.backgroundColor = css;
        };
        // Warm the bitmap face, then re-bake. The mask is laid out from the
        // measured glyph, so baking against a not-yet-loaded font locks in the
        // fallback's metrics and the word stays wrong for the life of the page.
        if (document.fonts?.load) {
          document.fonts
            .load(pixelFontSpec())
            .catch(() => {})
            .then(() => engine?.refreshFonts());
          document.fonts.ready.then(() => engine?.refreshFonts()).catch(() => {});
        }
        if (reduced) engine.renderStill();
        else sync();
      });
    };

    const io = new IntersectionObserver(
      (es) => {
        onScreen = es.some((e) => e.isIntersecting);
        if (onScreen && !created) create();
        if (created) sync();
      },
      { rootMargin: "200px" },
    );
    io.observe(host);

    const onVis = () => {
      hidden = document.hidden;
      sync();
    };
    document.addEventListener("visibilitychange", onVis);
    const offTransition = onTransitionChange((active) => {
      inTransition = active;
      sync();
    });

    const fine = window.matchMedia("(pointer: fine)").matches;
    const onMove = (e: PointerEvent) => {
      if (!engine || reduced) return;
      const r = host.getBoundingClientRect();
      engine.setPointer({
        x: (e.clientX - r.left) / r.width,
        y: (e.clientY - r.top) / r.height,
      });
    };
    const onLeave = () => engine?.setPointer(null);
    if (fine) {
      host.addEventListener("pointermove", onMove);
      host.addEventListener("pointerleave", onLeave);
      // pointerleave is not guaranteed: a cancelled gesture or a capture taken
      // by another element skips it. Without this the engine would keep
      // believing the pointer is still there. This is the correct place to
      // handle that — an inactivity timer in the engine instead fired during
      // ordinary hovering, because a hand held still sends no events at all.
      host.addEventListener("pointercancel", onLeave);
    }

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      offTransition();
      if (fine) {
        host.removeEventListener("pointermove", onMove);
        host.removeEventListener("pointerleave", onLeave);
        host.removeEventListener("pointercancel", onLeave);
      }
      engine?.destroy();
    };
  }, []);

  return (
    <div
      ref={hostRef}
      data-canvas-card
      style={{ viewTransitionName }}
      aria-label="A word trailing downward into light, its fade built from hundreds of overlapping copies"
      className="relative aspect-[1344/620] w-full select-none overflow-hidden rounded-[12px] border border-[var(--border-line)] bg-[var(--bg-hover)]"
    />
  );
}

