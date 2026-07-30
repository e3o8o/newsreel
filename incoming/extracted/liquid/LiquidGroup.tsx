"use client";

// The reusable liquid-UI API. Drop cards into a <LiquidGroup> and they FUSE: near
// cards merge with a concave (inverse-rounded) joint, and the whole group is drawn
// as ONE smooth SVG "skin" behind the real, accessible card content.
//
//   <LiquidGroup>
//     <LiquidCard id="a" x={20}  y={20} w={220} h={140}>…</LiquidCard>
//     <LiquidCard id="b" x={210} y={90} w={160} h={120}>…</LiquidCard>
//   </LiquidGroup>
//
// The group reads each card's rect from its props (explicit geometry — no DOM
// measurement, so it morphs cleanly and works on the server), feeds them to the
// LiquidEngine (SDF smooth-union + marching squares), and paints the resulting
// path. Content sits on top in normal flow: selectable text, real <img>, links.
// Turn `k` up for a gooey melt, down for crisp geometric joints; add `bridges` for
// deliberate pipes between distant cards.

import {
  Children,
  isValidElement,
  useMemo,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
} from "react";
import { LiquidEngine, DEFAULT_PARAMS, type LiquidBox } from "./engine";
import type { Bridge } from "./sdf";

export interface LiquidCardProps {
  id: string;
  /** top-left position + size, in the group's local px coordinates */
  x: number;
  y: number;
  w: number;
  h: number;
  /** per-card corner radius (defaults to the group's cardRadius) */
  radius?: number;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}

// LiquidCard is a data+content holder; LiquidGroup reads its props and renders the
// actual positioned box. Rendering it directly (outside a group) just lays the box.
export function LiquidCard(props: LiquidCardProps) {
  const { x, y, w, h, className, style, children } = props;
  return (
    <div
      className={className}
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: w,
        height: h,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export interface LiquidGroupProps {
  children: ReactNode;
  /** Blend amount: low = crisp inverse-rounded joints, high = gooey melt. */
  k?: number;
  /** Default per-card corner radius. */
  cardRadius?: number;
  /** Outline crispness (grid cell px) + smoothing passes. */
  cell?: number;
  smooth?: number;
  /** Explicit pipes between card ids, with an optional width. */
  bridges?: { from: string; to: string; width?: number }[];
  /** Fill of the fused skin (any CSS color / gradient via `fillStyle`). */
  fill?: string;
  fillStyle?: CSSProperties;
  className?: string;
  style?: CSSProperties;
  /** Forwarded onto the skin <svg> for the card→detail view transition. */
  viewTransitionName?: string;
}

type CardEl = ReactElement<LiquidCardProps>;

function isLiquidCard(node: ReactNode): node is CardEl {
  return isValidElement(node) && (node.props as LiquidCardProps).id !== undefined;
}

export function LiquidGroup({
  children,
  k = DEFAULT_PARAMS.k,
  cardRadius = 26,
  cell = DEFAULT_PARAMS.cell,
  smooth = DEFAULT_PARAMS.smooth,
  bridges = [],
  fill = "var(--bg-hover)",
  fillStyle,
  className,
  style,
  viewTransitionName,
}: LiquidGroupProps) {
  const cards = useMemo(
    () => Children.toArray(children).filter(isLiquidCard),
    [children],
  );

  // Build boxes (center-based) + bridge capsules from the card rects, then compute
  // the fused path. useMemo so it only recomputes when geometry / params change.
  const { d, viewBox, skinStyle } = useMemo(() => {
    const boxes: LiquidBox[] = cards.map((c) => {
      const p = c.props;
      return {
        id: p.id,
        cx: p.x + p.w / 2,
        cy: p.y + p.h / 2,
        hw: p.w / 2,
        hh: p.h / 2,
        r: p.radius ?? cardRadius,
      };
    });
    const byId = new Map(boxes.map((b) => [b.id, b]));
    const capsules: Bridge[] = [];
    for (const br of bridges) {
      const a = byId.get(br.from);
      const b = byId.get(br.to);
      if (!a || !b) continue;
      capsules.push({
        kind: "bridge",
        ax: a.cx,
        ay: a.cy,
        bx: b.cx,
        by: b.cy,
        r: br.width ? br.width / 2 : Math.min(a.hh, b.hh) * 0.5,
      });
    }

    const engine = new LiquidEngine();
    engine.setBoxes(boxes);
    engine.setBridges(capsules);
    engine.setParams({ k, cell, smooth });
    const path = engine.compute();

    return {
      d: path.d,
      viewBox: `${path.minX} ${path.minY} ${path.width} ${path.height}`,
      // The <svg> is positioned so its viewBox origin lines up with the group's
      // local (0,0): the path is in group coordinates, and the svg is inset by the
      // negative bounds so the bulge that extends past (0,0) is not clipped.
      skinStyle: {
        position: "absolute" as const,
        left: path.minX,
        top: path.minY,
        width: path.width,
        height: path.height,
        overflow: "visible" as const,
        pointerEvents: "none" as const,
      },
    };
  }, [cards, k, cardRadius, cell, smooth, bridges]);

  return (
    <div className={className} style={{ position: "relative", ...style }}>
      {/* the fused skin, behind the content */}
      <svg
        aria-hidden
        viewBox={viewBox}
        style={{ ...skinStyle, viewTransitionName, ...fillStyle }}
      >
        <path d={d} fill={fill} />
      </svg>
      {/* real card content on top, in normal DOM */}
      {cards}
    </div>
  );
}

