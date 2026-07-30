"use client";

// A live, display-only Vault card: short phrases assembled as a ransom note out of real
// torn-paper cutout letters. Each phrase SLAMS in letter-by-letter (scale + tilt overshoot,
// like it's taped down), holds, then CROSSFADES straight into the next — the outgoing line
// shrinks/fades out while the incoming line is already slamming in over it, so there's no
// blank gap. Moving the cursor magnetizes each scrap toward the pointer by its own proximity
// (near letters lean + lift, far ones stay put). Pauses when offscreen / hidden.

import { useEffect, useMemo, useRef, useState } from "react";
import { RansomLine } from "./RansomLine";
import { useMagnetism } from "./use-magnetism";
import { composeLine, hashSeed, lineWidth, DEFAULT_JITTER, type Placed } from "./manifest";

// kept short so they compose cleanly on one card and stay readable
const PHRASES = ["stay weird", "make stuff", "be kind", "trust me", "keep going", "no rules"];

// cycle timing
const REVEAL_HOLD = 1800; // ms held fully revealed (quicker resting state)
const CROSS_OVERLAP = 150; // ms after the old line lifts off before the new one rises in
const OUT_MS = 260; // how long the outgoing line stays mounted while it lifts + blurs away

type Slot = { key: number; phraseIdx: number; placed: Placed[]; direction: "in" | "out"; revealed: boolean };

export function RansomNoteCard({
  bare = false,
  viewTransitionName,
}: {
  bare?: boolean;
  viewTransitionName?: string;
} = {}) {
  void bare;
  const hostRef = useRef<HTMLDivElement>(null);
  const [avail, setAvail] = useState(900);

  // The card renders 1 or 2 stacked lines: the current one (slamming in / resting) and,
  // briefly during a switch, the outgoing one (fading out underneath). A monotonic key
  // guarantees React remounts each line so its enter transition re-fires. The counter lives
  // in a ref and is only ever bumped inside effects/handlers (never during render).
  const seq = useRef(1);
  const makeSlot = (phraseIdx: number): Slot => ({
    key: seq.current++,
    phraseIdx,
    placed: composeLine(PHRASES[phraseIdx].toUpperCase(), hashSeed(PHRASES[phraseIdx]), DEFAULT_JITTER),
    direction: "in",
    revealed: false,
  });
  // Initial slot built without touching the ref (key 0), so nothing is read during render.
  const [slots, setSlots] = useState<Slot[]>(() => [
    {
      key: 0,
      phraseIdx: 0,
      placed: composeLine(PHRASES[0].toUpperCase(), hashSeed(PHRASES[0]), DEFAULT_JITTER),
      direction: "in",
      revealed: false,
    },
  ]);

  // fit the CURRENT phrase to ONE row: comfortable target height, scaled down if it would
  // overflow the card's usable width (padding leaves ~86% for the letters). The outgoing
  // line reuses this height (it's leaving, exact fit doesn't matter).
  const current = slots[slots.length - 1];
  const lineH = useMemo(() => {
    const usable = avail * 0.86;
    const target = Math.max(34, Math.min(80, Math.round(avail * 0.062)));
    const natural = lineWidth(current.placed, target);
    return natural > usable ? Math.max(30, Math.floor((target * usable) / natural)) : target;
  }, [current.placed, avail]);

  // ── cycle: slam in → hold → crossfade to next ──────────────────────────────
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const ro = new ResizeObserver(() => setAvail(host.clientWidth));
    ro.observe(host);

    if (reduced) {
      // static: just show the current phrase revealed, no cycling. Deferred a frame so it
      // isn't a synchronous set in the effect body (avoids a cascading render).
      const raf = requestAnimationFrame(() =>
        setSlots((s) => [{ ...s[s.length - 1], revealed: true }]),
      );
      return () => {
        cancelAnimationFrame(raf);
        ro.disconnect();
      };
    }

    let onScreen = false;
    let hidden = false;
    let hovering = false; // freeze the phrase while the cursor is on the card
    let running = false;
    const timers = new Set<number>();
    const after = (fn: () => void, ms: number) => {
      const id = window.setTimeout(() => {
        timers.delete(id);
        fn();
      }, ms);
      timers.add(id);
      return id;
    };
    const clearTimers = () => {
      for (const id of timers) window.clearTimeout(id);
      timers.clear();
    };

    const revealCurrent = () => {
      // flip the just-mounted line to revealed so it slams in.
      setSlots((s) => s.map((sl, i) => (i === s.length - 1 ? { ...sl, revealed: true } : sl)));
    };

    const toNext = () => {
      if (!running) return;
      setSlots((s) => {
        const cur = s[s.length - 1];
        const nextIdx = (cur.phraseIdx + 1) % PHRASES.length;
        // mark current as leaving (out), add the next as an incoming hidden line on top.
        const leaving: Slot = { ...cur, direction: "out", revealed: false };
        const incoming = makeSlot(nextIdx);
        return [leaving, incoming];
      });
      // drop the outgoing line once it's faded, and slam the incoming one in.
      after(() => setSlots((s) => s.slice(-1)), OUT_MS);
      after(revealCurrent, CROSS_OVERLAP);
      // schedule the next switch.
      after(toNext, CROSS_OVERLAP + REVEAL_HOLD);
    };

    const start = () => {
      if (running) return;
      running = true;
      // reveal whatever's current, then begin the loop.
      revealCurrent();
      after(toNext, REVEAL_HOLD);
    };
    const stop = () => {
      running = false;
      clearTimers();
    };
    // Freeze the auto-cycle while hovering, so a phrase never switches out from under the
    // cursor mid-interaction (the letters you're leaning / dragging stay put). Because a
    // switch only ever fires from a queued timer, stopping before it fires leaves the current
    // phrase fully settled; leaving resumes the loop and the next switch happens then.
    const sync = () => (onScreen && !hidden && !hovering ? start() : stop());

    const io = new IntersectionObserver(
      (es) => {
        onScreen = es[0]?.isIntersecting ?? false;
        sync();
      },
      { threshold: 0.2 },
    );
    io.observe(host);
    const onVis = () => {
      hidden = document.hidden;
      sync();
    };
    document.addEventListener("visibilitychange", onVis);

    // pause on hover, resume on leave (pointer devices only — a touch has no lingering hover)
    const canHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const onEnter = () => {
      hovering = true;
      sync();
      // if a crossfade was mid-flight when the pointer arrived, collapse to a single clean,
      // fully-revealed line so it freezes tidily (no half-faded outgoing scrap left behind).
      setSlots((s) => {
        if (s.length === 1 && s[0].revealed && s[0].direction === "in") return s;
        const cur = s[s.length - 1];
        return [{ ...cur, direction: "in", revealed: true }];
      });
    };
    const onLeave = () => {
      hovering = false;
      sync();
    };
    if (canHover) {
      host.addEventListener("pointerenter", onEnter);
      host.addEventListener("pointerleave", onLeave);
    }

    return () => {
      stop();
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      host.removeEventListener("pointerenter", onEnter);
      host.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  // cursor magnetism: each scrap reacts to the pointer's proximity to ITSELF (near letters
  // lean toward it + lift, far ones stay put) — a per-letter field, not a flat card tilt.
  useMagnetism(hostRef);

  return (
    <div
      ref={hostRef}
      data-canvas-card
      aria-label="Short phrases spelled out as a ransom note from torn-paper cutout letters, revealing one letter at a time."
      style={viewTransitionName ? { viewTransitionName } : undefined}
      className="relative mx-auto flex aspect-[1344/620] w-full select-none items-center justify-center overflow-hidden rounded-[12px] border border-[var(--border-line)] bg-[var(--bg-page)] px-10 sm:px-16"
    >
      {/* Stacked lines: outgoing (leaving) sits under the incoming during a crossfade.
          Absolute so both occupy the same centered box; the current one is last. */}
      {slots.map((sl) => (
        <div key={sl.key} className="absolute inset-0 flex items-center justify-center px-10 sm:px-16">
          <RansomLine
            placed={sl.placed}
            lineH={lineH}
            revealed={sl.revealed}
            direction={sl.direction}
            nowrap
          />
        </div>
      ))}
    </div>
  );
}

