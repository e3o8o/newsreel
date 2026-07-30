"use client";

// Renders one composed line of ransom-note cutouts. Each glyph is an <img> of a real
// torn-paper letter, sized to a shared line height (width follows the sprite's aspect),
// tilted / baseline-bounced / scaled per the composition. Spaces become a gap.
//
// Appear vocabulary is "slam & settle": a scrap punches in slightly too big with extra
// tilt and overshoots flat, like it's being pressed / taped onto the page (scale + rotate,
// no vertical drop). `direction` lets the same line animate OUT (fade + shrink) so the card
// can crossfade one phrase into the next with no blank gap.
//
// Each scrap also carries a per-letter parallax `depth` (data-depth) + its resting rotation
// (data-rot) so a cursor engine can lean the whole collage toward the pointer.

import { type CSSProperties, useEffect, useRef, useState } from "react";
import { spriteUrl, variantsFor, type Placed, type Variant } from "./manifest";
import { hapticTap } from "../../lib/haptics";

// Back-out overshoot: scrap springs past its size then settles flat — the "tape-down" snap.
const SLAM_EASE = "cubic-bezier(.34,1.56,.64,1)";
// A calm ease-OUT for the box-width glide. The slam ease overshoots, which on `width` shoved
// neighbors wider-then-back; width should settle monotonically so the row never jitters.
const WIDTH_EASE = "cubic-bezier(.22,.61,.36,1)";
// Switch (phrase→phrase) vertical-pass motion: a soft rise + un-blur in, a quick lift-blur out.
const RISE_EASE = "cubic-bezier(.16,1,.3,1)"; // expo-out — fast start, long glide, no overshoot
const IN_MS = 460; // per-scrap rise-in duration (slower than a slam → smoother, feathered)
const OUT_MS = 240; // lift-blur-out duration (whole line together)
const STAGGER_MS = 26; // left-to-right cascade step on the rise-in
const SWAP_MS = 260; // click-swap flip duration

export function RansomLine({
  placed,
  lineH,
  revealed = true,
  direction = "in",
  staggerStart = 0,
  nowrap = false,
  className = "",
}: {
  placed: Placed[];
  /** cap height of a letter in px (the sprites are 220px tall; width scales to aspect) */
  lineH: number;
  /** when false, letters sit hidden (for an entrance animation) */
  revealed?: boolean;
  /** "in" = slam/settle to rest; "out" = fade + shrink away (for the crossfade) */
  direction?: "in" | "out";
  /** index offset so multiple lines can stagger continuously */
  staggerStart?: number;
  /** keep the whole line on one row (no wrapping) — the caller sizes it to fit */
  nowrap?: boolean;
  className?: string;
}) {
  let gi = staggerStart;
  return (
    <div
      className={`flex items-center justify-center ${nowrap ? "flex-nowrap" : "flex-wrap"} ${className}`}
      style={{ gap: `${lineH * 0.04}px` }}
    >
      {placed.map((p, i) => {
        if (p.kind === "space") {
          return <span key={i} style={{ width: `${lineH * 0.32}px` }} aria-hidden />;
        }
        return (
          <Scrap key={i} p={p} lineH={lineH} revealed={revealed} direction={direction} idx={gi++} />
        );
      })}
    </div>
  );
}

// One cutout letter. Owns two things beyond rendering:
//  • the entrance/exit slam (inner <img> transform, staggered per idx),
//  • click-to-swap — clicking flips the scrap to a DIFFERENT variant of the same character
//    with a quick spin/scale flip (old image flips out, new one slams in over it).
// The outer <span> is the parallax lean layer the cursor engine writes --px/--py/--pr/--ps to.
function Scrap({
  p,
  lineH,
  revealed,
  direction,
  idx,
}: {
  p: Placed;
  lineH: number;
  revealed: boolean;
  direction: "in" | "out";
  idx: number;
}) {
  // A click-chosen override variant, or null to show the composed one. Derived (no effect):
  // when the composition changes (re-roll / phrase switch), p.variant changes identity and
  // the override is dropped so the fresh cutout shows.
  const [override, setOverride] = useState<{ base: Variant; picked: Variant } | null>(null);
  const variant = override && override.base === p.variant ? override.picked : p.variant!;
  // During a swap: `incoming` = the new width target (box glides to it); `outgoing` = the OLD
  // cutout, rendered as an overlay that flips OUT on top of the already-promoted base.
  const [incoming, setIncoming] = useState<Variant | null>(null);
  const [outgoing, setOutgoing] = useState<Variant | null>(null);
  const swapTimer = useRef<number | null>(null);
  useEffect(() => () => {
    if (swapTimer.current) window.clearTimeout(swapTimer.current);
  }, []);

  const h = lineH * p.scale;
  const aspect = (vr: Variant) => (vr.w / vr.h) * h;
  const w = aspect(variant); // width of the currently-shown variant
  // While swapping, the box targets the INCOMING variant's width immediately (on click), so
  // it glides to the real size right away and neighbors slide along with it — no end-of-swap
  // jump. The two images inside keep their own true widths so neither distorts mid-animation.
  const boxW = incoming ? aspect(incoming) : w;

  const baseY = (p.dy * lineH).toFixed(2);
  const leanTransform = `translate(var(--px, 0px), calc(${baseY}px + var(--py, 0px))) rotate(var(--pr, 0deg)) scale(var(--ps, 1))`;
  const restInner = `translateY(0px) rotate(${p.rot}deg) scale(1)`;
  // Switch vocabulary — a soft VERTICAL PASS with a feathered blur (the note re-assembling):
  //   • in  → the scrap rises from just below, un-blurs and settles (staggered L→R);
  //   • out → the scrap lifts up, blurs and fades away (peeled off the board).
  const RISE = Math.max(10, lineH * 0.18);
  const hiddenInner =
    direction === "in"
      ? `translateY(${RISE.toFixed(1)}px) rotate(${(p.rot * 1.25).toFixed(2)}deg) scale(0.96)`
      : `translateY(${(-RISE * 0.8).toFixed(1)}px) rotate(${(p.rot * 0.8).toFixed(2)}deg) scale(0.98)`;
  // drop-shadow is constant (the paper contact); the blur is what animates on the switch.
  const SHADOW = "drop-shadow(0 2px 3px rgba(20,20,25,0.16)) drop-shadow(0 6px 10px rgba(20,20,30,0.10))";
  const blurAmt = revealed ? 0 : direction === "in" ? 3.5 : 5;

  const swap = () => {
    if (incoming) return; // already mid-swap
    const all = variantsFor(p.ch);
    const others = all.filter((v) => v.file !== variant.file);
    if (!others.length) return; // only one cutout for this letter — nothing to swap to
    hapticTap();
    const next = others[Math.floor(Math.random() * others.length)];
    // Promote immediately: the BASE image now shows `next` (fully opaque, at rest), and the
    // OLD variant becomes a transient overlay that flips OUT on top of it. So when the overlay
    // is removed at the end, the base is already the final letter — no empty blink frame.
    setOverride({ base: p.variant!, picked: next });
    setOutgoing(variant); // the letter we're leaving, flips out over the new base
    setIncoming(next); // (kept for the box-width target)
    swapTimer.current = window.setTimeout(() => {
      setOutgoing(null);
      setIncoming(null);
    }, SWAP_MS);
  };

  const outerStyle: CSSProperties = {
    transform: leanTransform,
    // No CSS transition here: the magnetism/drag/breathe hook eases every value per frame in
    // JS, so a CSS transition on top would just add lag and fight the spring. When the hook is
    // inactive (reduced-motion / touch) the vars stay 0 and this is a plain static transform.
    willChange: "transform",
    marginRight: `${p.mx * lineH}px`,
    lineHeight: 0,
    cursor: "grab",
    touchAction: "none", // let the scrap own drag gestures (no scroll hijack fighting)
  };
  const wrapStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    width: `${boxW}px`,
    height: `${h}px`,
    transformOrigin: "center center",
    transform: revealed ? restInner : hiddenInner,
    opacity: revealed ? 1 : 0,
    transition:
      direction === "in"
        ? // rise + un-blur + fade in, per-letter staggered L→R on a smooth ease-out.
          `transform ${IN_MS}ms ${RISE_EASE} ${idx * STAGGER_MS}ms, opacity ${Math.round(IN_MS * 0.7)}ms ease ${idx * STAGGER_MS}ms, filter ${IN_MS}ms ease ${idx * STAGGER_MS}ms, width ${SWAP_MS}ms ${WIDTH_EASE}`
        : // lift + blur + fade out, quick, all letters together (no cascade) so it clears fast.
          `transform ${OUT_MS}ms cubic-bezier(.4,0,.7,1), opacity ${OUT_MS}ms ease, filter ${OUT_MS}ms ease, width ${SWAP_MS}ms ${WIDTH_EASE}`,
    filter: `${SHADOW} blur(${blurAmt}px)`,
    willChange: "transform, opacity, filter, width",
  };

  // Each image keeps its OWN true aspect width (centered in the box) so the animating box
  // width never stretches/distorts a scrap. Both are absolute + centered so they overlap.
  const imgBase = (vr: Variant): CSSProperties => ({
    position: "absolute",
    top: "50%",
    left: "50%",
    width: `${aspect(vr)}px`,
    height: `${h}px`,
    transition: `transform ${SWAP_MS}ms ${SLAM_EASE}, opacity ${SWAP_MS}ms ease`,
  });

  return (
    <span
      style={outerStyle}
      data-depth={p.depth ?? 0.5}
      onPointerDown={(e) => {
        // don't begin a native text selection / image drag when grabbing a scrap
        e.preventDefault();
      }}
      onClick={(e) => {
        // a real drag sets data-dragging on this element (see use-magnetism); a click that
        // follows a drag should NOT swap — only a genuine tap does.
        if (e.currentTarget.dataset.dragging) return;
        swap();
      }}
    >
      <span style={wrapStyle}>
        {/* BASE: always the shown variant, fully at rest. During a swap it's already the NEW
            cutout underneath, so removing the overlay reveals it with no empty frame. */}
        <img
          src={spriteUrl(variant.file)}
          alt={p.ch}
          draggable={false}
          decoding="async"
          className="select-none"
          style={{
            ...imgBase(variant),
            transform: "translate(-50%,-50%)",
            // during a swap the new letter slams in via the overlay, so keep the base itself
            // steady (no reverse transition = no blink); at rest it's just the letter.
            transition: "none",
          }}
        />
        {/* OVERLAY: the OLD cutout, flipping OUT on top of the already-swapped base (spin +
            shrink + fade). When it finishes and unmounts, the new base is simply revealed. */}
        {outgoing && (
          <img
            src={spriteUrl(outgoing.file)}
            alt=""
            aria-hidden
            draggable={false}
            decoding="async"
            className="select-none"
            style={{
              ...imgBase(outgoing),
              animation: `ransom-swap-out ${SWAP_MS}ms ${SLAM_EASE} both`,
            }}
          />
        )}
      </span>
    </span>
  );
}

// A RansomLine that manages its OWN entrance: mounts hidden, then slams in on the next
// frame. Remount it (change its `key`) to replay the slam — used by the playground's
// Re-roll / live edits so a fresh composition punches back in with no shared reveal state.
export function SlammingLine(props: Omit<Parameters<typeof RansomLine>[0], "revealed">) {
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    const r = requestAnimationFrame(() => setRevealed(true));
    return () => cancelAnimationFrame(r);
  }, []);
  return <RansomLine {...props} revealed={revealed} />;
}

