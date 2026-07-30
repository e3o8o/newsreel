"use client";

// Squircle demo components, all sharing one glossy neutral surface.
//
// GlossySquircle is a deep stack of ~18 very low-opacity greyscale layers, each
// clipped to the squircle so it follows the corner:
//   surface: porcelain gradient · corner vignette · centre glow · fine grain ·
//            brushed streaks · diagonal light sweep · middle sheen band
//   light:   side edge-lights · top sheen · glass rim · bottom counter-sheen ·
//            light lift · grounding shadow
//   edge:    tri-stop bevel border · inner shadow wall · fresnel edge-brighten ·
//            ambient-occlusion ring · corner glints · double outer hairline
// The button, chat bubbles and segmented control are all built on it, so they read
// as one material.

import { useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Squircle } from "./Squircle";
import { shapePath } from "./superellipse";
import { CONTROL_H, CONTROL_H_SM, radiusFor, TEXT, TRACKING } from "./tokens";

interface Shape {
  radius: number;
  smoothing: number;
  /** Superellipse exponent (squareness): 2=circle, 5=squircle, higher=boxier. */
  exponent?: number;
  compare?: boolean;
}

// The glossy neutral surface. Pass a fixed size (w/h in px) OR omit them to size to
// content — it measures its own box and clips every gloss layer to the exact
// squircle of that size. Give it the corner params + content.
function GlossySquircle({
  w,
  h,
  radius,
  smoothing,
  exponent,
  compare,
  children,
  className = "",
  contentClassName,
  interactive = true,
}: Shape & {
  w?: number;
  h?: number;
  children?: ReactNode;
  className?: string;
  contentClassName?: string;
  /** press feedback (scale + shimmer). Off for passive surfaces like AI bubbles. */
  interactive?: boolean;
}) {
  const auto = w === undefined || h === undefined;
  const measureRef = useRef<HTMLSpanElement>(null);
  const [size, setSize] = useState({ w: w ?? 0, h: h ?? 0 });
  useLayoutEffect(() => {
    if (!auto) return;
    const el = measureRef.current;
    if (!el) return;
    const m = () => setSize((p) =>
      p.w === el.offsetWidth && p.h === el.offsetHeight ? p : { w: el.offsetWidth, h: el.offsetHeight });
    m();
    const ro = new ResizeObserver(m);
    ro.observe(el);
    return () => ro.disconnect();
  }, [auto]);

  const cw = auto ? size.w : (w as number);
  const ch = auto ? size.h : (h as number);
  const clip = cw && ch ? `path("${shapePath({ width: cw, height: ch, radius, smoothing, exponent, plain: compare })}")` : "none";
  const layer = (style: CSSProperties) => (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-0"
      style={{ clipPath: clip, WebkitClipPath: clip, ...style }}
    />
  );

  // double outer hairline only (faint dark contact ring, near-white cut), no shadow
  const HAIRLINE =
    "drop-shadow(0 0 0.5px rgba(0,0,0,0.18)) drop-shadow(0 0.5px 0.5px rgba(255,255,255,0.9))";
  const press = interactive
    ? "active:scale-[0.97] active:brightness-[1.04] transition-[transform,filter] duration-150"
    : "";

  const gloss = (
    <>
      {/* corner vignette */}
      {layer({ background: "radial-gradient(120% 130% at 50% 50%, rgba(0,0,0,0) 62%, rgba(0,0,0,0.045) 100%)" })}
      {/* centre glow */}
      {layer({ background: "radial-gradient(70% 120% at 50% 45%, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0) 70%)" })}
      {/* fine grain */}
      {layer({
        opacity: 0.05,
        mixBlendMode: "overlay",
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
      })}
      {/* brushed streaks */}
      {layer({
        opacity: 0.5,
        mixBlendMode: "overlay",
        backgroundImage:
          "repeating-linear-gradient(90deg, rgba(255,255,255,0.06) 0px, rgba(0,0,0,0.03) 1px, rgba(255,255,255,0.06) 2px)",
      })}
      {/* diagonal light sweep */}
      {layer({
        mixBlendMode: "screen",
        background: "linear-gradient(115deg, rgba(255,255,255,0) 30%, rgba(255,255,255,0.28) 46%, rgba(255,255,255,0) 60%)",
      })}
      {/* middle sheen band */}
      {layer({
        background: "linear-gradient(180deg, rgba(255,255,255,0) 34%, rgba(255,255,255,0.5) 50%, rgba(255,255,255,0) 66%)",
        opacity: 0.45,
      })}
      {/* side edge-lights */}
      {layer({
        background: "linear-gradient(90deg, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0) 8%, rgba(255,255,255,0) 92%, rgba(255,255,255,0.5) 100%)",
        opacity: 0.5,
      })}
      {/* top sheen */}
      {layer({ background: "radial-gradient(78% 82% at 50% -34%, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0.28) 42%, rgba(255,255,255,0) 72%)" })}
      {/* glass rim */}
      {layer({ boxShadow: "inset 0 2px 0 -1px rgba(255,255,255,0.85)" })}
      {/* bottom counter-sheen */}
      {layer({ mixBlendMode: "screen", background: "radial-gradient(90% 60% at 50% 118%, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0) 60%)" })}
      {/* light lift along the bottom */}
      {layer({ mixBlendMode: "screen", boxShadow: "inset 0 -15px 2px -12px rgba(255,255,255,0.25)" })}
      {/* grounding shadow along the bottom */}
      {layer({ mixBlendMode: "color-burn", boxShadow: "inset 0 -6px 5px -2px #d2d2d2" })}
      {/* inner shadow wall */}
      {layer({ boxShadow: "inset 0 0 0 0.5px rgba(0,0,0,0.06)" })}
      {/* fresnel edge-brighten */}
      {layer({ mixBlendMode: "screen", boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.28)" })}
      {/* ambient occlusion ring */}
      {layer({ boxShadow: "inset 0 0 6px 0 rgba(0,0,0,0.05)" })}
      {/* corner glints */}
      {layer({
        mixBlendMode: "screen",
        background:
          "radial-gradient(6px 5px at 14% 14%, rgba(255,255,255,0.75) 0%, rgba(255,255,255,0) 100%), radial-gradient(6px 5px at 86% 14%, rgba(255,255,255,0.75) 0%, rgba(255,255,255,0) 100%)",
      })}
    </>
  );

  const squircleBg = (extraStyle: CSSProperties) => (
    <Squircle
      radius={radius}
      smoothing={smoothing}
      exponent={exponent}
      compare={compare}
      fill="linear-gradient(180deg, #ffffff 0%, #f4f4f5 52%, #ececed 100%)"
      strokeGradient={["#d3d6db", "#b4b7bd", "#7f8288"]}
      strokeWidth={1}
      style={extraStyle}
    >
      {gloss}
    </Squircle>
  );

  // Fixed size: the Squircle is the box; content is centred inside it.
  if (!auto) {
    return (
      <Squircle
        radius={radius}
        smoothing={smoothing}
        exponent={exponent}
        compare={compare}
        contentClassName={contentClassName}
        fill="linear-gradient(180deg, #ffffff 0%, #f4f4f5 52%, #ececed 100%)"
        strokeGradient={["#d3d6db", "#b4b7bd", "#7f8288"]}
        strokeWidth={1}
        className={`${press} ${className}`}
        style={{ width: w, height: h, filter: HAIRLINE }}
      >
        {gloss}
        {children}
      </Squircle>
    );
  }

  // Auto size: the in-flow content (with its own padding) drives the box size; the
  // Squircle background is absolute and sized to the measured content.
  return (
    <span
      className={`relative inline-flex ${press} ${className}`}
      style={{ filter: HAIRLINE }}
    >
      {cw > 0 && ch > 0 && squircleBg({ position: "absolute", inset: 0 })}
      <span ref={measureRef} className={`relative z-[1] inline-flex items-center justify-center ${contentClassName ?? ""}`}>
        {children}
      </span>
    </span>
  );
}

// Debossed neutral label — two-tone near-black ink, cut into the surface with a
// base-occlusion halo, a bottom highlight, a chiselled top-highlight and a faint
// top shadow. Reused by every demo so text reads consistently.
function InkLabel({
  children,
  size = TEXT,
  tracking = TRACKING,
  className = "",
}: {
  children: ReactNode;
  size?: number;
  tracking?: number;
  className?: string;
}) {
  const ls = `${tracking}px`;
  return (
    <span className={`relative inline-flex items-center justify-center whitespace-nowrap ${className}`}>
      <span
        aria-hidden
        className="pointer-events-none absolute font-medium text-black/20 blur-[2px]"
        style={{ fontSize: size, letterSpacing: ls }}
      >
        {children}
      </span>
      <span
        className="relative z-[2] font-medium"
        style={{
          fontSize: size,
          letterSpacing: ls,
          // a hair of horizontal padding so background-clip:text never clips a glyph edge
          padding: "0 0.5px",
          backgroundImage: "linear-gradient(180deg, #14151a 0%, #33353b 100%)",
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          color: "transparent",
          filter:
            "drop-shadow(0 1px 1px rgba(255,255,255,0.8)) drop-shadow(0 -0.5px 0.3px rgba(255,255,255,0.5)) drop-shadow(0 -0.5px 0.5px rgba(0,0,0,0.12))",
        }}
      >
        {children}
      </span>
    </span>
  );
}

// ── Demo 1: the glossy button ────────────────────────────────────────────────
export function SquircleGlossyButton({ smoothing, exponent, compare }: Shape & { label?: string }) {
  const h = CONTROL_H;
  return (
    <GlossySquircle w={132} h={h} radius={radiusFor(h)} smoothing={smoothing} exponent={exponent} compare={compare}>
      <InkLabel>Get the app</InkLabel>
    </GlossySquircle>
  );
}

// ── Demo 2: a chat — user bubble → AI (no bubble) → user bubble ───────────────
export function SquircleChat({ smoothing, exponent, compare }: Shape) {
  // radius keyed to the default control height so bubbles match the family
  const br = radiusFor(CONTROL_H);
  const bubble = (text: string) => (
    <div className="flex justify-end">
      <GlossySquircle
        radius={br}
        smoothing={smoothing}
        exponent={exponent}
        compare={compare}
        interactive={false}
        contentClassName="px-3 py-2"
      >
        <InkLabel>{text}</InkLabel>
      </GlossySquircle>
    </div>
  );
  return (
    <div className="flex w-[300px] flex-col gap-2.5">
      {bubble("hey, what’s a squircle?")}
      {/* AI answer — no bubble, just quiet text */}
      <p className="max-w-[86%] text-[14px] leading-[1.5] text-[var(--text-secondary)]">
        A corner that eases into the edge with no kink, like on iOS.
      </p>
      {bubble("love it")}
    </div>
  );
}

// ── Demo 3: an iOS segmented control (glossy squircle thumb slides under active)
export function SquircleTabs({
  smoothing,
  exponent,
  compare,
  active = 0,
  onChange,
}: Shape & { active?: number; onChange?: (i: number) => void }) {
  const items = ["Design", "Code", "Ship"];
  const W = 224;
  const H = CONTROL_H;
  const pad = 3;
  const seg = (W - pad * 2) / items.length;
  const trackR = radiusFor(H); // the track is a squircle too
  const tr = radiusFor(H - pad * 2); // thumb corner keyed to the thumb's height

  const trackClip = `path("${shapePath({ width: W, height: H, radius: trackR, smoothing, exponent, plain: compare })}")`;

  return (
    <div className="relative" style={{ width: W, height: H }}>
      {/* recessed track — a squircle well the thumb sits inside */}
      <span
        aria-hidden
        className="absolute inset-0"
        style={{
          clipPath: trackClip,
          WebkitClipPath: trackClip,
          background: "linear-gradient(180deg, #e9eaec 0%, #f3f4f5 100%)",
          boxShadow: "inset 0 1px 3px rgba(0,0,0,0.12)",
        }}
      />
      {/* sliding glossy thumb under the active segment */}
      <div
        className="absolute transition-[left] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
        style={{ top: pad, left: pad + active * seg, width: seg, height: H - pad * 2 }}
      >
        <GlossySquircle
          w={seg}
          h={H - pad * 2}
          radius={tr}
          smoothing={smoothing}
          exponent={exponent}
          compare={compare}
          interactive={false}
        />
      </div>
      {/* labels — same tracking whether active or not, so they don't shift width */}
      <div className="absolute inset-0 flex items-center" style={{ padding: pad }}>
        {items.map((it, i) => (
          <button
            key={it}
            type="button"
            onClick={() => onChange?.(i)}
            className="relative z-[1] flex h-full flex-1 items-center justify-center font-medium transition-colors"
            style={{
              fontSize: TEXT,
              letterSpacing: `${TRACKING}px`,
              color: i === active ? "transparent" : "var(--text-secondary)",
            }}
          >
            {i === active ? <InkLabel>{it}</InkLabel> : it}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Demo 4: an iOS toggle switch (glossy squircle thumb slides in a squircle track)
export function SquircleToggle({
  smoothing,
  exponent,
  compare,
  on = true,
  onChange,
}: Shape & { on?: boolean; onChange?: (v: boolean) => void }) {
  const H = CONTROL_H_SM;
  const W = Math.round(H * 1.6);
  const pad = 4;
  const thumb = H - pad * 2;
  const trackR = radiusFor(H);
  const thumbR = radiusFor(thumb);
  const trackClip = `path("${shapePath({ width: W, height: H, radius: trackR, smoothing, exponent, plain: compare })}")`;

  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => onChange?.(!on)}
      className="relative active:brightness-[1.04] transition-[filter] duration-150"
      style={{ width: W, height: H }}
    >
      {/* track — a squircle well; darker when on, recessed light when off */}
      <span
        aria-hidden
        className="absolute inset-0 transition-[background] duration-300"
        style={{
          clipPath: trackClip,
          WebkitClipPath: trackClip,
          background: on
            ? "linear-gradient(180deg, #4b4d52 0%, #3a3c41 100%)"
            : "linear-gradient(180deg, #e5e6e8 0%, #eef0f1 100%)",
          boxShadow: on
            ? "inset 0 1px 2px rgba(0,0,0,0.35)"
            : "inset 0 1px 2px rgba(0,0,0,0.14)",
        }}
      />
      {/* sliding glossy thumb */}
      <div
        className="absolute transition-[left] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
        style={{ top: pad, left: on ? W - pad - thumb : pad, width: thumb, height: thumb }}
      >
        <GlossySquircle
          w={thumb}
          h={thumb}
          radius={thumbR}
          smoothing={smoothing}
          exponent={exponent}
          compare={compare}
          interactive={false}
        />
      </div>
    </button>
  );
}

// A recessed squircle surface — a light inset well with a real squircle border
// (for input fields / menus). Fixed-size (w/h in px). Content is a child that
// overlays the well; it is NOT clipped, so menu rows never get cut.
function RecessedSquircle({
  w,
  h,
  radius,
  smoothing,
  exponent,
  compare,
  children,
  contentClassName = "",
}: Shape & {
  w: number;
  h: number;
  children?: ReactNode;
  contentClassName?: string;
}) {
  const uid = useId().replace(/:/g, "");
  const path = shapePath({ width: w, height: h, radius, smoothing, exponent, plain: compare });
  const clip = `path("${path}")`;
  return (
    <span className="relative inline-flex" style={{ width: w, height: h }}>
      {/* the recessed well: light fill + inset shadow, clipped to the squircle */}
      <span
        aria-hidden
        className="absolute inset-0"
        style={{
          clipPath: clip,
          WebkitClipPath: clip,
          background: "linear-gradient(180deg, #f5f6f7 0%, #ffffff 100%)",
          boxShadow: "inset 0 1.5px 3px rgba(0,0,0,0.10)",
        }}
      />
      {/* a hairline border on the squircle outline — clipped to itself so only the
          inner half shows (uniform on flats + corners) */}
      <svg
        aria-hidden
        width={w}
        height={h}
        viewBox={`0 0 ${w} ${h}`}
        className="pointer-events-none absolute inset-0 z-[1]"
      >
        <clipPath id={`rec-${uid}`}>
          <path d={path} />
        </clipPath>
        <path d={path} fill="none" stroke="#c7cace" strokeWidth={2} clipPath={`url(#rec-${uid})`} />
      </svg>
      {/* content overlays the well; not clipped */}
      <span className={`relative z-[2] flex w-full ${contentClassName}`}>{children}</span>
    </span>
  );
}

// ── Demo 5: a text input — a recessed squircle field with a placeholder ───────
export function SquircleInput({ smoothing, exponent, compare }: Shape) {
  const h = CONTROL_H;
  return (
    <RecessedSquircle
      w={200}
      h={h}
      radius={radiusFor(h)}
      smoothing={smoothing}
      exponent={exponent}
      compare={compare}
      contentClassName="h-full items-center gap-1.5 px-3"
    >
      {/* search glyph */}
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className="shrink-0 text-[var(--text-tertiary)]">
        <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
        <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <span className="text-[var(--text-tertiary)]" style={{ fontSize: TEXT }}>Search</span>
    </RecessedSquircle>
  );
}

// ── Demo 6: a stepper — − / value / + as glossy squircle keys around a readout ─
export function SquircleStepper({ smoothing, exponent, compare }: Shape) {
  const [n, setN] = useState(3);
  const h = CONTROL_H_SM;
  const key = (label: string, onClick: () => void) => (
    <GlossySquircle
      w={h}
      h={h}
      radius={radiusFor(h)}
      smoothing={smoothing}
      exponent={exponent}
      compare={compare}
      className="cursor-pointer"
    >
      {/* label is non-interactive; the covering button on top takes the click */}
      <span className="pointer-events-none">
        <InkLabel>{label}</InkLabel>
      </span>
      <button type="button" onClick={onClick} className="absolute inset-0 z-[4]" aria-label={label} />
    </GlossySquircle>
  );
  return (
    <div className="flex items-center gap-2">
      {key("−", () => setN((v) => Math.max(0, v - 1)))}
      <span className="w-6 text-center font-medium tabular-nums text-[var(--text-primary)]" style={{ fontSize: TEXT }}>{n}</span>
      {key("+", () => setN((v) => v + 1))}
    </div>
  );
}

// ── Demo 7: a dropdown — a glossy squircle field that opens a squircle menu ────
export function SquircleDropdown({ smoothing, exponent, compare }: Shape) {
  const options = ["Squircle", "Rounded", "Circle"];
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState(0);
  const W = 180;
  const r = radiusFor(CONTROL_H);
  return (
    <div className="relative">
      <GlossySquircle
        w={W}
        h={CONTROL_H}
        radius={r}
        smoothing={smoothing}
        exponent={exponent}
        compare={compare}
        className="cursor-pointer"
        contentClassName="justify-between px-3 pointer-events-none"
      >
        <InkLabel>{options[sel]}</InkLabel>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="ml-2 shrink-0 text-[var(--text-secondary)]" style={{ transform: open ? "rotate(180deg)" : undefined, transition: "transform .2s" }}>
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {/* the click target, on top of the gloss + label */}
        <button type="button" onClick={() => setOpen((o) => !o)} className="pointer-events-auto absolute inset-0 z-[4]" aria-haspopup="listbox" aria-expanded={open} />
      </GlossySquircle>

      {open && (
        // opens UPWARD (bottom-full) so it isn't clipped by the preview's bottom edge
        <div className="absolute bottom-full left-0 z-10 mb-2" style={{ width: W }}>
          <RecessedSquircle
            w={W}
            h={options.length * 34 + 8}
            radius={r}
            smoothing={smoothing}
            exponent={exponent}
            compare={compare}
            contentClassName="flex-col p-1"
          >
            {options.map((o, i) => (
              <button
                key={o}
                type="button"
                onClick={() => { setSel(i); setOpen(false); }}
                className="flex h-[34px] w-full items-center rounded-lg px-3 text-left transition-colors hover:bg-black/[0.05]"
                style={{ fontSize: TEXT, color: i === sel ? "var(--text-primary)" : "var(--text-secondary)", fontWeight: i === sel ? 600 : 400 }}
              >
                {o}
              </button>
            ))}
          </RecessedSquircle>
        </div>
      )}
    </div>
  );
}

