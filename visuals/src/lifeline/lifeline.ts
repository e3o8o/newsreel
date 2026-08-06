// Lifeline — the engine. Builds the marker columns and the dashed rail as
// plain DOM, then drives the intro sweep: one rAF loop advances a single
// progress scalar on lifeline's eased slow-start curve, the rail scales with
// it, the track translates toward its settled position, and each marker's
// fade is a CSS animation whose delay was computed by inverting the same
// curve at the marker's track offset.
//
// The width heuristic and the rAF loop body are adapted from
// evilrabbit/lifeline (MIT, (c) 2026 Evil Rabbit — see LICENSE):
// getMarkerWidth from lifeline-utils.ts with the people/company branches
// dropped (this scene's markers carry text only), the sweep loop from
// use-lifeline-scroll.ts lines 504-549 with the interaction machinery
// dropped. One deliberate change from the component: when the track fits
// the stage, lifeline jumps the rail to its settled state; a video wants
// the draw, so the progress stays time-driven and only the travel is zero.

import {
  clamp,
  getFadeScale,
  getRailDuration,
  getTransitionMarkerFadeDuration,
  LIFELINE_LABELS_MS,
  snapToDevicePixel,
  timeAtTrackProgress,
  trackProgressAtTime,
} from "./intro-timing";

export interface LifelineSceneMarker {
  id: string;
  label: string; // the date row ("May 4", or a bare day number on quiet units)
  tag?: string; // the row above the date ("W1"); empty on quiet units
  lines: { text: string; detail?: string }[];
  color?: string; // tints this marker's tick and tag
}

export interface LifelineSceneOptions {
  title?: string;
  theme: "dark" | "light";
  accent: string;
  sweepMs?: number; // pin the sweep; defaults to lifeline's track-length heuristic
}

const TRACK_INSET = 96; // px from the stage's left edge to the track head
const TRACK_TAIL = 96; // px kept clear at the right edge once settled

function hasMarkerContent(marker: LifelineSceneMarker) {
  return marker.lines.length > 0;
}

// getMarkerWidth from lifeline-utils.ts, events-only.
function getMarkerWidth(marker: LifelineSceneMarker, next?: LifelineSceneMarker) {
  const hasContent = hasMarkerContent(marker);

  if (!next) return hasContent ? 360 : 80;
  if (!hasContent) return 80;

  // gap in axis units to the next marker; the dense axis makes it 1.
  return Math.min(420, Math.max(290, 1 * 36));
}

function buildColumn(marker: LifelineSceneMarker, width: number, accent: string) {
  const col = document.createElement("div");
  col.className = "lifeline-col";
  col.style.width = `${width}px`;
  const hasContent = hasMarkerContent(marker);
  if (!hasContent) col.setAttribute("data-empty", "");

  const inner = document.createElement("div");
  inner.style.position = "relative";

  const tick = document.createElement("span");
  tick.className = "lifeline-tick";
  inner.appendChild(tick);

  const tag = document.createElement("p");
  tag.className = "lifeline-tag";
  tag.textContent = marker.tag ?? "";
  inner.appendChild(tag);

  const date = document.createElement("p");
  date.className = "lifeline-date";
  date.textContent = marker.label;
  inner.appendChild(date);

  if (hasContent) {
    const tint = marker.color ?? accent;
    col.setAttribute("data-color", "");
    col.style.setProperty("--ll-entry-color", tint);

    const lines = document.createElement("div");
    lines.className = "lifeline-lines";
    for (const line of marker.lines) {
      const title = document.createElement("p");
      title.className = "lifeline-line";
      title.textContent = line.text;
      lines.appendChild(title);
      if (line.detail) {
        const detail = document.createElement("p");
        detail.className = "lifeline-detail";
        detail.textContent = line.detail;
        lines.appendChild(detail);
      }
    }
    inner.appendChild(lines);
  }

  col.appendChild(inner);
  return { col, inner };
}

export class LifelineScene {
  private root: HTMLElement;
  private track: HTMLElement;
  private rail: HTMLElement;
  private head: HTMLElement | null = null;
  private columns: { inner: HTMLElement; delay: number; fade: number }[] = [];
  private widths: number[] = [];
  private railMs: number;
  private maxTranslate = 0;
  private rafId = 0;
  private startTime = 0;
  private started = false;
  private holdStart = 0;

  constructor(
    host: HTMLElement,
    markers: LifelineSceneMarker[],
    opts: LifelineSceneOptions,
  ) {
    this.root = document.createElement("div");
    this.root.className = "lifeline-root";
    this.root.setAttribute("data-theme", opts.theme);

    if (opts.title) {
      this.head = document.createElement("p");
      this.head.className = "lifeline-head";
      this.head.textContent = opts.title;
      this.root.appendChild(this.head);
    }

    this.track = document.createElement("div");
    this.track.className = "lifeline-track";

    this.rail = document.createElement("div");
    this.rail.className = "lifeline-rail";
    const line = document.createElement("div");
    line.className = "lifeline-rail-line lifeline-rail-intro";
    this.rail.appendChild(line);
    this.track.appendChild(this.rail);

    this.widths = markers.map((marker, index) =>
      getMarkerWidth(marker, markers[index + 1]),
    );
    const totalWidth = this.widths.reduce((sum, width) => sum + width, 0);
    this.track.style.width = `${totalWidth}px`;
    this.railMs = opts.sweepMs ?? getRailDuration(totalWidth);
    const fadeScale = getFadeScale(this.railMs);

    markers.forEach((marker, index) => {
      const { col, inner } = buildColumn(marker, this.widths[index], opts.accent);
      const offset = this.widths
        .slice(0, index)
        .reduce((sum, width) => sum + width, 0);
      const delay =
        totalWidth > 0
          ? timeAtTrackProgress(offset / totalWidth, this.widths, this.railMs)
          : 0;
      const fade = Math.round(getTransitionMarkerFadeDuration(index) * fadeScale);
      this.columns.push({ inner, delay, fade });
      this.track.appendChild(col);
    });

    this.root.appendChild(this.track);
    host.appendChild(this.root);

    const stageWidth = host.clientWidth || 1440;
    this.maxTranslate = Math.max(
      0,
      TRACK_INSET + totalWidth - (stageWidth - TRACK_TAIL),
    );
  }

  start() {
    if (this.rafId) return;

    const step = (now: number) => {
      if (!this.started) {
        this.started = true;
        this.startTime = now;
        this.root.style.setProperty("--lifeline-intro-progress", "0");
        this.applyTranslate(0);
        // The fade clocks start with the sweep clock: the animation-delay
        // classes land on the same frame the rAF loop takes its zero.
        this.root.style.setProperty("--lifeline-labels-ms", `${LIFELINE_LABELS_MS}ms`);
        if (this.head) this.head.classList.add("lifeline-labels-intro");
        for (const { inner, delay, fade } of this.columns) {
          inner.style.animationDelay = `${delay}ms`;
          inner.style.setProperty("--lifeline-marker-fade-ms", `${fade}ms`);
          inner.classList.add("lifeline-marker-intro");
        }
      }

      if (this.holdStart) {
        this.rafId = requestAnimationFrame(step);
        return;
      }

      const elapsed = now - this.startTime;
      const progress = clamp(
        trackProgressAtTime(elapsed, this.widths, this.railMs),
        0,
        1,
      );

      this.root.style.setProperty("--lifeline-intro-progress", String(progress));
      this.applyTranslate(progress * this.maxTranslate);

      if (progress < 1) {
        this.rafId = requestAnimationFrame(step);
        return;
      }

      this.root.style.setProperty("--lifeline-intro-progress", "1");
      this.applyTranslate(this.maxTranslate);
      this.rafId = 0;
    };

    this.rafId = requestAnimationFrame(step);
  }

  // Pause the sweep mid-travel (a `timeline` beat holding on an entry
  // while the narration names it), and pick it back up. The hold class
  // freezes the CSS fade clocks too, so delay-phase markers stay pending.
  hold() {
    if (this.holdStart) return;
    this.holdStart = performance.now();
    this.root.classList.add("lifeline-hold");
  }

  resume() {
    if (!this.holdStart) return;
    this.startTime += performance.now() - this.holdStart;
    this.holdStart = 0;
    this.root.classList.remove("lifeline-hold");
  }

  destroy() {
    cancelAnimationFrame(this.rafId);
    this.rafId = 0;
    this.root.remove();
  }

  private applyTranslate(px: number) {
    this.track.style.transform = `translate3d(${-snapToDevicePixel(px)}px, 0, 0)`;
  }
}
