"use client";

// Liquid UI playground — drag the pieces and watch the fused skin re-flow: a small
// tab fused to a card keeps a concave (inverse-rounded) joint; pull it away and the
// neck stretches then snaps. Remix MORPHS between real UI objects — a chat bubble, a
// grid panel, a share card, a search bar — tweening every piece + the blend, so it
// pours from one shape into the next instead of snapping. Each preset is hand-placed
// with its own corner radii and tight content. The bottom panel tunes the blend /
// detail live. Built on the same <LiquidGroup> the Code tab ships.
//
// The presets live in scenes.tsx in two sizes. On a phone the 720×380 stage scales
// to ~0.45, which turns the 52px tail into a 24px drag target and the 11px labels
// into 5px — so mobile swaps in a compact stage with larger, re-placed pieces. Every
// coordinate below therefore reads the ACTIVE space (vw/vh) rather than a constant.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LiquidGroup, LiquidCard } from "./LiquidGroup";
import { PG_PREVIEW, PG_PANEL, Slider, SegmentedControl, GhostButton } from "../swirl/controls";
import { SectionLabel } from "../section-label";
import { hapticTap } from "../../lib/haptics";
import { useSceneSet } from "./use-compact";
import { COMPACT_SET, type ScenePiece } from "./scenes";

// Mode presets the blend + grid: geometric = tight blend, fine grid (crisp inverse
// fillets); goo = wide blend (organic melt). The compact space is about half the
// width of the desktop one, so its k (a distance in field units) and cell scale
// down with it — otherwise "Goo" at k=64 would swallow the whole compact scene.
const MODES = [
  { id: "geometric", label: "Geometric", k: 22, cell: 5 },
  { id: "goo", label: "Goo", k: 64, cell: 7 },
];
const COMPACT_MODES = [
  { id: "geometric", label: "Geometric", k: 14, cell: 5 },
  { id: "goo", label: "Goo", k: 42, cell: 6 },
];

// ── Remix morph ──────────────────────────────────────────────────────────────
// Remix doesn't snap to the next preset — it TWEENS every piece to its new spot
// (position, size, radius) and blends k, exactly like the hero card. Presets have
// different ids/order, so we tween by ROLE: the largest card (the main body) morphs
// into the next main body, the smaller one (the appendage) into the next appendage.
const REMIX_MS = 620;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

// order a preset's cards as [main, appendage] by area, so we can tween 1:1.
function byRole(cards: ScenePiece[]): ScenePiece[] {
  return [...cards].sort((a, b) => b.w * b.h - a.w * a.h); // [largest = main, ...smaller]
}
// tween two same-length role-ordered card lists; content comes from whichever side
// dominates (target past the midpoint) so labels swap cleanly.
function tweenCards(from: ScenePiece[], to: ScenePiece[], p: number): ScenePiece[] {
  const a = byRole(from);
  const b = byRole(to);
  return a.map((fc, i) => {
    const tc = b[i] ?? fc;
    const src = p < 0.5 ? fc : tc;
    return {
      id: src.id,
      x: lerp(fc.x, tc.x, p),
      y: lerp(fc.y, tc.y, p),
      w: lerp(fc.w, tc.w, p),
      h: lerp(fc.h, tc.h, p),
      radius: lerp(fc.radius, tc.radius, p),
      content: src.content,
    };
  });
}

export function LiquidPlayground() {
  const set = useSceneSet();
  const compact = set === COMPACT_SET;
  const presets = set.playground;
  const { vw: VW, vh: VH } = set;
  const modes = compact ? COMPACT_MODES : MODES;

  const [presetIdx, setPresetIdx] = useState(0);
  const [cards, setCards] = useState<ScenePiece[]>(() => presets[0].pieces.map((c) => ({ ...c })));
  const [mode, setMode] = useState("");
  const [k, setK] = useState(presets[0].k);
  const [cell, setCell] = useState(presets[0].cell);

  // Crossing the breakpoint swaps the whole coordinate space, so the current cards
  // (placed in the OLD space) are meaningless. Reset during render — the standard
  // "adjust state when a prop changes" pattern — rather than in an effect, which
  // would paint one frame of old-space coordinates in the new space first.
  const [activePresets, setActivePresets] = useState(presets);
  if (activePresets !== presets) {
    setActivePresets(presets);
    setPresetIdx(0);
    setCards(presets[0].pieces.map((c) => ({ ...c })));
    setK(presets[0].k);
    setCell(presets[0].cell);
    setMode("");
  }

  const stageRef = useRef<HTMLDivElement>(null);
  // the scaled VW×VH space; its rect reflects the real transform, so pointer→local
  // mapping stays correct at any container width (and in the compact space).
  const spaceRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: string; dx: number; dy: number } | null>(null);
  // active Remix morph: null when idle. rAF tweens cards + k from → to.
  const morph = useRef<{ from: ScenePiece[]; to: ScenePiece[]; fromK: number; toK: number; start: number; raf: number } | null>(null);

  // The render-phase reset above drops the old cards; this cancels the imperative
  // work that can't be touched during render (an in-flight morph rAF, a live drag).
  useEffect(() => {
    if (morph.current?.raf) cancelAnimationFrame(morph.current.raf);
    morph.current = null;
    drag.current = null;
  }, [presets]);

  // Remix: MORPH to the next UI object (tween every piece + blend), like the hero.
  const remix = () => {
    hapticTap();
    const i = (presetIdx + 1) % presets.length;
    const target = presets[i];
    setPresetIdx(i);
    setMode("");
    setCell(target.cell);

    // cancel any in-flight morph and start a fresh one from the CURRENT pieces
    if (morph.current?.raf) cancelAnimationFrame(morph.current.raf);
    const m = {
      from: cards.map((c) => ({ ...c })),
      to: target.pieces.map((c) => ({ ...c })),
      fromK: k,
      toK: target.k,
      start: 0,
      raf: 0,
    };
    morph.current = m;
    const step = (now: number) => {
      if (!m.start) m.start = now;
      const p = ease(Math.min(1, (now - m.start) / REMIX_MS));
      setCards(tweenCards(m.from, m.to, p));
      setK(Math.round(lerp(m.fromK, m.toK, p)));
      if (p < 1) {
        m.raf = requestAnimationFrame(step);
      } else {
        // land exactly on the target
        setCards(target.pieces.map((c) => ({ ...c })));
        setK(target.k);
        morph.current = null;
      }
    };
    m.raf = requestAnimationFrame(step);
  };

  // stop a running morph if the user grabs a piece or the component unmounts.
  useEffect(() => () => { if (morph.current?.raf) cancelAnimationFrame(morph.current.raf); }, []);

  const applyMode = (id: string) => {
    setMode(id);
    const m = modes.find((x) => x.id === id);
    if (m) {
      setK(m.k);
      setCell(m.cell);
    }
  };

  const toLocal = useCallback(
    (clientX: number, clientY: number) => {
      // map against the SCALED SPACE's rect (not the stage), so the mapping is exact
      // whatever the container width or active space.
      const el = spaceRef.current ?? stageRef.current;
      if (!el) return { x: 0, y: 0 };
      const r = el.getBoundingClientRect();
      return {
        x: ((clientX - r.left) / r.width) * VW,
        y: ((clientY - r.top) / r.height) * VH,
      };
    },
    [VW, VH],
  );

  const onPointerDown = (id: string) => (e: React.PointerEvent) => {
    // grabbing a piece cancels any in-flight Remix morph so it doesn't fight the drag
    if (morph.current?.raf) {
      cancelAnimationFrame(morph.current.raf);
      morph.current = null;
    }
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    const p = toLocal(e.clientX, e.clientY);
    const card = cards.find((c) => c.id === id);
    if (!card) return;
    drag.current = { id, dx: p.x - card.x, dy: p.y - card.y };
    hapticTap();
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const p = toLocal(e.clientX, e.clientY);
    const { id, dx, dy } = drag.current;
    // let a piece hang slightly off-stage, proportional to the space so the compact
    // one doesn't allow a piece to wander half its own width out of frame.
    const slack = VW * 0.055;
    setCards((cs) =>
      cs.map((c) =>
        c.id === id
          ? {
              ...c,
              x: Math.max(-slack, Math.min(VW - c.w + slack, p.x - dx)),
              y: Math.max(-slack, Math.min(VH - c.h + slack, p.y - dy)),
            }
          : c,
      ),
    );
  };
  const endDrag = () => {
    drag.current = null;
  };

  // no explicit bridges in these UI presets — proximity fusing does the joins.
  const groupBridges = useMemo(() => [], []);

  // Blend/detail ranges track the space: k is a distance in field units, so the
  // compact space needs a proportionally smaller ceiling to span the same look.
  const kMax = compact ? 60 : 90;
  const cellMin = compact ? 4 : 3;
  const cellMax = compact ? 10 : 14;

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <SectionLabel action={<GhostButton onClick={remix}>Remix</GhostButton>}>
        Implementation
      </SectionLabel>

      {/* Preview stage — drag the pieces. */}
      <div className={`${PG_PREVIEW} touch-none`}>
        <div
          ref={stageRef}
          className="relative w-full"
          style={{ aspectRatio: `${VW} / ${VH}` }}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <div className="absolute inset-0" style={{ containerType: "size" }}>
            {/* Center-anchored scale (matches LiquidPreviewCard): the fixed VW×VH
                space is pinned to the stage center and scaled to fit its width, so
                it never drifts down-right the way an origin-top-left scale does when
                the container width isn't exactly VW. The divisor is the space's own
                width so the WHOLE draggable area stays visible (the card scales
                tighter, to its content box). */}
            <div
              ref={spaceRef}
              className="absolute left-1/2 top-1/2"
              style={{
                width: VW,
                height: VH,
                transform: "translate(-50%, -50%)",
                transformOrigin: "center",
                scale: `calc(100cqw / ${set.pgDiv})`,
              }}
            >
              <LiquidGroup
                k={k}
                cardRadius={set.cardRadius}
                cell={cell}
                smooth={2}
                bridges={groupBridges}
                fill="var(--bg-surface)"
                className="h-full w-full"
              >
                {cards.map((c) => (
                  <LiquidCard key={c.id} id={c.id} x={c.x} y={c.y} w={c.w} h={c.h} radius={c.radius}>
                    <div
                      onPointerDown={onPointerDown(c.id)}
                      className="h-full w-full cursor-grab active:cursor-grabbing"
                    >
                      {c.content}
                    </div>
                  </LiquidCard>
                ))}
              </LiquidGroup>
            </div>
          </div>
        </div>
      </div>

      {/* Panel */}
      <div className={`${PG_PANEL} gap-3.5`}>
        <SegmentedControl
          options={modes.map((m) => ({ id: m.id, label: m.label }))}
          activeId={mode}
          onPick={applyMode}
          fill
        />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Slider label="Blend" value={k} min={0} max={kMax} step={1}
            format={(v) => `${v}`} onChange={(v) => { setMode(""); setK(v); }} />
          <Slider label="Detail" value={cell} min={cellMin} max={cellMax} step={1}
            format={(v) => `${v}px`} onChange={(v) => { setMode(""); setCell(v); }} />
        </div>
      </div>
    </div>
  );
}

