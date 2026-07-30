"use client";

// A playful hover-reveal button: a styled pill at rest that, on hover (or tap on
// touch), reveals a short video over itself — bigger than the pill, centered, no
// box/background of its own. The content lives entirely in the clip.
//
// Clips can be TRANSPARENT (alpha): pass `alpha` and the component loads the
// alpha source set (VP9-alpha .webm for Chrome/Firefox, HEVC-alpha .hevc.mp4 for
// Safari) so only the shape floats over the page.
//
// Playback:
//   • forward plays ONCE and holds on the last frame (no loop) when a reverse
//     clip is supplied; otherwise it loops while hovered.
//   • on leave, if a reverse clip exists, it REWINDS FROM THE CURRENT POSITION —
//     the reversed clip is seeked to the mirror of the forward time (D - t) and
//     played, so stopping mid-clip rolls back from exactly there, then hides.
//   • without a reverse clip, it just snaps away.
// Honors prefers-reduced-motion (no reveal).

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { videoSources, mediaUrl } from "../../lib/video-sources";
import { buttonHover, buttonClick, type ButtonSound } from "../../lib/sound";
import { hapticHover, hapticTap } from "../../lib/haptics";

type Variant = "light" | "blue" | "dark";
type Phase = "idle" | "fwd" | "rev";

const BASE =
  "relative z-0 inline-flex cursor-pointer items-center justify-center overflow-hidden rounded-full px-5 py-2.5";

function pill(variant: Variant): { className: string; style: CSSProperties; overlays?: ReactNode; labelStyle?: CSSProperties } {
  if (variant === "blue") {
    return {
      className: `${BASE} text-[15px] font-medium text-white`,
      style: {
        background: "linear-gradient(180deg, #3CB2CD 0%, #1D6EB1 100%)",
        boxShadow:
          "rgba(142,217,255,0.5) 0px -1px 4.1px 0.5px inset, rgb(190,226,255) 0px 0px 4px 0px inset, rgba(43,162,189,0.5) 0px -36px 14.2px -28px inset",
      },
      labelStyle: { textShadow: "0px 1px 2px rgba(0,0,0,0.5)" },
      overlays: (
        <span
          aria-hidden
          className="pointer-events-none absolute left-2.5 right-2.5 top-[-4.5px] h-7 rounded-[500px] bg-gradient-to-t from-white/0 to-white opacity-70 blur-[1px]"
        />
      ),
    };
  }
  if (variant === "dark") {
    return {
      className: `${BASE} text-[14px] font-normal leading-[20px] tracking-[0.02em] text-white/90 backdrop-blur-[6px]`,
      style: { background: "transparent" },
      overlays: (
        <span aria-hidden className="pointer-events-none absolute inset-0" style={{ background: "rgba(0,0,0,0.56)" }}>
          <span className="absolute inset-0" style={{ opacity: 0.12, background: "linear-gradient(180deg, #fff 0%, rgba(255,255,255,0) 100%)" }} />
          <span className="absolute inset-0" style={{ opacity: 0.32, background: "radial-gradient(65.62% 65.62% at 50% 50%, #000 0%, rgba(0,0,0,0) 100%)" }} />
          <span
            className="absolute inset-0"
            style={{
              opacity: 0.24,
              padding: "1px",
              background: "linear-gradient(180deg, #fff 0%, #999 55%, #fff 80%, #999 95%)",
              WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
              WebkitMaskComposite: "xor",
              mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
              maskComposite: "exclude",
            }}
          />
        </span>
      ),
    };
  }
  return {
    className: `${BASE} border border-[var(--border-line)] text-[15px] font-medium text-[#1b1b1b] backdrop-blur-[2px]`,
    style: {
      background: "linear-gradient(180deg, #fff 0%, rgba(255,255,255,0) 100%), #f1f0ea",
      boxShadow: "0 -1px 1.5px 0 rgba(71,58,45,0.12) inset, 0 1.5px 6px rgba(71,58,45,0.06)",
    },
  };
}

function sourcesFor(base: string, alpha: boolean): ReactNode {
  if (alpha) {
    return (
      <>
        <source src={mediaUrl(`${base}.alpha.webm`)} type="video/webm" />
        <source src={mediaUrl(`${base}.alpha.hevc.mp4`)} type='video/mp4; codecs="hvc1"' />
      </>
    );
  }
  return videoSources(base).map((s) => <source key={s.src} src={s.src} type={s.type} />);
}

export function HoverVideoButton({
  label,
  video,
  reverseVideo,
  poster,
  width = 320,
  variant = "light",
  speed = 1,
  alpha = false,
  offsetX = 0,
  offsetY = 0,
  sound,
}: {
  label: string;
  /** forward clip base path without extension, e.g. "/buttons/boop" */
  video: string;
  /** reversed clip base; if set, leave rewinds from the current position */
  reverseVideo?: string;
  poster?: string;
  width?: number;
  variant?: Variant;
  speed?: number;
  alpha?: boolean;
  /** nudge the overlay horizontally (px); positive = right */
  offsetX?: number;
  /** nudge the overlay vertically (px); positive = down */
  offsetY?: number;
  /** per-button synthesized voice for hover + click cues */
  sound?: ButtonSound;
}) {
  const wrapRef = useRef<HTMLElement | null>(null);
  const fwdRef = useRef<HTMLVideoElement>(null);
  const revRef = useRef<HTMLVideoElement>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [reduced] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const hoverable = useRef(true);

  useEffect(() => {
    hoverable.current = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  }, []);

  // --- magnetism (a bit of cursor-follow) + accumulating click-pop scale ---
  // Both are driven by one rAF loop writing the wrapper transform directly, so
  // there are no per-move re-renders. `pop` is a spring toward 0; each click adds
  // an impulse, so spam-clicking stacks the scale up (then it settles back).
  const magTarget = useRef({ x: 0, y: 0 });
  const magCur = useRef({ x: 0, y: 0 });
  const popTarget = useRef(0); // accumulates on click, decays back to 0
  const popPos = useRef(0); // actual scale offset, springs toward the target
  const popVel = useRef(0);
  const rafRef = useRef(0);

  const tick = () => {
    const el = wrapRef.current;
    if (!el) {
      rafRef.current = 0;
      return;
    }
    const tx = magTarget.current.x;
    const ty = magTarget.current.y;
    magCur.current.x += (tx - magCur.current.x) * 0.2;
    magCur.current.y += (ty - magCur.current.y) * 0.2;
    // pop: the target bumps up on each click and decays back; the actual scale
    // springs toward it (slightly underdamped, so each click gives a little bounce).
    popTarget.current *= 0.9;
    if (popTarget.current < 0.001) popTarget.current = 0;
    popVel.current += (popTarget.current - popPos.current) * 0.22;
    popVel.current *= 0.68;
    popPos.current += popVel.current;
    const s = 1 + popPos.current;
    el.style.transform = `translate(${magCur.current.x.toFixed(2)}px, ${magCur.current.y.toFixed(2)}px) scale(${s.toFixed(3)})`;
    const restMag = Math.abs(tx - magCur.current.x) < 0.08 && Math.abs(ty - magCur.current.y) < 0.08;
    const restPop =
      popTarget.current === 0 && Math.abs(popPos.current) < 0.001 && Math.abs(popVel.current) < 0.001;
    if (restMag && restPop && tx === 0 && ty === 0) {
      el.style.transform = "";
      rafRef.current = 0;
    } else {
      rafRef.current = requestAnimationFrame(tick);
    }
  };
  const wake = () => {
    if (!rafRef.current) rafRef.current = requestAnimationFrame(tick);
  };
  const popClick = () => {
    if (reduced) return;
    popTarget.current = Math.min(popTarget.current + 0.06, 0.28); // subtle stack (decays back)
    wake();
  };

  // Magnetism only: while the cursor is in the box, the button drifts a little
  // toward it. The hover REVEAL itself triggers on the pill (below), not here.
  useEffect(() => {
    if (reduced) return;
    const box = wrapRef.current?.parentElement;
    if (!box) return;
    const STRENGTH = 0.1;
    const MAX = 9;
    const clamp = (v: number) => Math.max(-MAX, Math.min(MAX, v));
    const onMove = (e: PointerEvent) => {
      const r = box.getBoundingClientRect();
      magTarget.current.x = clamp((e.clientX - (r.left + r.width / 2)) * STRENGTH);
      magTarget.current.y = clamp((e.clientY - (r.top + r.height / 2)) * STRENGTH);
      wake();
    };
    const onLeave = () => {
      magTarget.current.x = 0;
      magTarget.current.y = 0;
      wake();
    };
    box.addEventListener("pointermove", onMove);
    box.addEventListener("pointerleave", onLeave);
    return () => {
      box.removeEventListener("pointermove", onMove);
      box.removeEventListener("pointerleave", onLeave);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced]);

  // Reveal on the pill itself (not a bigger area).
  const enter = () => {
    if (reduced) return;
    setPhase("fwd");
  };
  const leave = () => {
    if (reduced) return;
    setPhase(reverseVideo ? "rev" : "idle");
  };

  useEffect(() => {
    if (reduced) return;
    const fwd = fwdRef.current;
    const rev = revRef.current;
    if (!fwd) return;

    if (phase === "fwd") {
      rev?.pause();
      fwd.currentTime = 0;
      fwd.playbackRate = speed;
      fwd.play().catch(() => {});
    } else if (phase === "rev" && rev) {
      // rewind from where the forward clip currently is: mirror the time.
      const D = fwd.duration || rev.duration || 0;
      const t = Math.min(fwd.currentTime || 0, D);
      fwd.pause();
      rev.currentTime = Math.max(0, D - t);
      rev.playbackRate = speed * 1.3; // exit 30% faster than the entrance
      rev.play().catch(() => {});
    } else {
      // idle: pause, and snap the FORWARD clip back to frame 0 (its deflated /
      // resting frame). Otherwise, when the reverse ends and the forward layer
      // becomes visible again under the hide, it would flash the mid-inflate
      // frame we left off at. Do NOT reset the REVERSE clip — its frame 0 is the
      // puffed state, which would flash instead.
      fwd.pause();
      fwd.currentTime = 0;
      rev?.pause();
    }
  }, [phase, speed, reduced]);

  // Spring the SPEED itself: while the forward clip plays, ride playbackRate on a
  // damped wobble around the set speed (a springy entrance), then EASE IT DOWN
  // into the final frame so the puff decelerates as it settles. Your speed holds
  // for the middle; the spring is early, the slowdown is the tail.
  useEffect(() => {
    if (reduced || phase !== "fwd") return;
    const el = fwdRef.current;
    if (!el) return;
    const AMP = 0.6, DECAY = 3.5, FREQ = 11; // entrance spring
    const TAIL = 0.6, SLOW = 0.62;           // tail slowdown (start, amount)
    let raf = 0;
    const tick = () => {
      if (el.ended) return;
      const D = el.duration || 1;
      const p = Math.min(1, (el.currentTime || 0) / D); // progress 0..1
      const wobble = 1 + AMP * Math.exp(-DECAY * p) * Math.sin(FREQ * p);
      const tp = Math.max(0, (p - TAIL) / (1 - TAIL)); // 0..1 across the tail
      const ease = tp * tp * (3 - 2 * tp);             // smoothstep
      const slow = 1 - SLOW * ease;                    // 1 -> 1-SLOW near the end
      el.playbackRate = Math.max(0.25, speed * wobble * slow);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase, speed, reduced]);

  // Warm the clips up shortly after mount: a quick muted play -> pause forces the
  // browser to download AND decode the first frames, so the first hover plays
  // instantly instead of waiting on the network/decoder. The videos are hidden
  // (overlay opacity 0 at rest), so this is invisible.
  useEffect(() => {
    if (reduced) return;
    let cancelled = false;
    const warm = (v: HTMLVideoElement | null) => {
      if (!v) return;
      v.muted = true;
      const p = v.play();
      if (p) {
        p.then(() => {
          if (cancelled) return;
          v.pause();
          v.currentTime = 0;
        }).catch(() => {});
      }
    };
    const id = window.setTimeout(() => {
      warm(fwdRef.current);
      warm(revRef.current);
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [reduced]);

  // touch: tapping outside the pill resets (rewinds)
  useEffect(() => {
    if (phase === "idle" || hoverable.current) return;
    const onDoc = (e: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) leave();
    };
    document.addEventListener("pointerdown", onDoc);
    return () => document.removeEventListener("pointerdown", onDoc);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const setWrap = (el: HTMLElement | null) => {
    wrapRef.current = el;
  };

  const fwd = (
    <video
      ref={fwdRef}
      muted
      playsInline
      preload="auto"
      loop={!reverseVideo}
      poster={poster}
      className="block h-auto w-full"
      style={{ opacity: phase === "rev" ? 0 : 1 }}
    >
      {sourcesFor(video, alpha)}
    </video>
  );
  const rev = reverseVideo ? (
    <video
      ref={revRef}
      muted
      playsInline
      preload="auto"
      onEnded={() => setPhase("idle")}
      className="absolute inset-0 block h-auto w-full"
      style={{ opacity: phase === "rev" ? 1 : 0 }}
    >
      {sourcesFor(reverseVideo, alpha)}
    </video>
  ) : null;

  // A real CSS button at rest; the clip plays over it on hover. Instant swap.
  const p = pill(variant);
  const visible = phase !== "idle" && !reduced;

  return (
    <div
      ref={setWrap}
      className="relative inline-flex cursor-pointer"
      onPointerEnter={() => {
        if (!hoverable.current) return;
        enter();
        if (sound) buttonHover(sound);
        hapticHover();
      }}
      onPointerLeave={() => hoverable.current && leave()}
      onPointerDown={() => {
        if (sound) buttonClick(sound);
        hapticTap();
        popClick();
      }}
    >
      <button
        type="button"
        onClick={() => {
          if (hoverable.current) return;
          if (phase === "fwd") leave();
          else enter();
        }}
        className={p.className}
        style={{ ...p.style, opacity: visible ? 0 : 1 }}
      >
        {p.overlays}
        <span className="relative z-10" style={p.labelStyle}>
          {label}
        </span>
      </button>

      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 z-10"
        style={{
          width: `min(${width}px, 78vw)`,
          opacity: visible ? 1 : 0,
          transform: `translate(calc(-50% + ${offsetX}px), calc(-50% + ${offsetY}px))`,
        }}
      >
        {fwd}
        {rev}
      </div>
    </div>
  );
}

