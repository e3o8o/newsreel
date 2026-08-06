// Scene: lifeline — milestones on a dashed horizontal rail, swept in left to
// right with lifeline's slow-open easing while the track glides to keep the
// newest entry in frame, ending settled. Visual language and timing derived
// from evilrabbit/lifeline (MIT, (c) 2026 Evil Rabbit — see LICENSE).
//
// props: title, entries[] of { date, title, detail?, tag?, color? },
// start/end (ISO, default first/last entry), unit ("week" | "day"),
// theme (dark|light), accent, sweepSeconds (pin the sweep length).
// Actions: hold, resume.

import { LifelineScene, type LifelineSceneMarker } from "./lifeline";
// @ts-expect-error esbuild text loader
import lifelineCss from "./lifeline.css";

interface LifelineEntry {
  date: string;
  title: string;
  detail?: string;
  tag?: string;
  color?: string;
}

const DAY_MS = 86_400_000;

function parseDate(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return null;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function monthShort(utc: number) {
  return new Date(utc).toLocaleString("en-US", { month: "short", timeZone: "UTC" });
}

// "Jun 6" — the label for units that carry an entry.
function fullLabel(utc: number) {
  return `${monthShort(utc)} ${new Date(utc).getUTCDate()}`;
}

// Quiet units get just the day number, month spelled on the first unit
// and at each month turn — the journey starter's dayLabel approach.
function shortLabel(utc: number, prevUtc: number | null) {
  const day = new Date(utc).getUTCDate();
  const turned =
    prevUtc === null ||
    new Date(prevUtc).getUTCMonth() !== new Date(utc).getUTCMonth();
  return turned ? `${monthShort(utc)} ${day}` : `${day}`;
}

function readEntries(raw: unknown): { entry: LifelineEntry; utc: number }[] {
  if (!Array.isArray(raw)) return [];
  const out: { entry: LifelineEntry; utc: number }[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const entry = item as LifelineEntry;
    const utc = parseDate(entry.date);
    if (utc === null || typeof entry.title !== "string") continue;
    out.push({ entry, utc });
  }
  out.sort((a, b) => a.utc - b.utc);
  return out;
}

function buildMarkers(props: Record<string, unknown>): LifelineSceneMarker[] {
  const entries = readEntries(props.entries);
  if (entries.length === 0) return [];

  const unit = props.unit === "day" ? "day" : "week";
  const unitMs = unit === "day" ? DAY_MS : 7 * DAY_MS;
  const startUtc = parseDate(props.start) ?? entries[0].utc;
  const endUtc = Math.max(
    parseDate(props.end) ?? entries[entries.length - 1].utc,
    entries[entries.length - 1].utc,
  );

  const unitOf = (utc: number) =>
    Math.max(1, Math.floor((utc - startUtc) / unitMs) + 1);
  const lastUnit = unitOf(endUtc);

  // Group entries by unit; several entries in one week stack as lines.
  const byUnit = new Map<number, { entry: LifelineEntry; utc: number }[]>();
  for (const item of entries) {
    const idx = unitOf(item.utc);
    const list = byUnit.get(idx) ?? [];
    list.push(item);
    byUnit.set(idx, list);
  }

  // Dense axis, one marker per unit, empty units included so gaps read as
  // time passing — lifeline's defineLifeline behavior.
  const markers: LifelineSceneMarker[] = [];
  let prevRep: number | null = null;
  for (let idx = 1; idx <= lastUnit; idx++) {
    const rep = startUtc + (idx - 1) * unitMs;
    const group = byUnit.get(idx);
    if (group) {
      const first = group[0];
      markers.push({
        id: `unit-${idx}`,
        label: fullLabel(first.utc),
        tag: first.entry.tag ?? (unit === "week" ? `W${idx}` : `D${idx}`),
        lines: group.map(({ entry }) => ({
          text: entry.title,
          ...(entry.detail !== undefined && { detail: entry.detail }),
        })),
        ...(first.entry.color !== undefined && { color: first.entry.color }),
      });
    } else {
      markers.push({ id: `unit-${idx}`, label: shortLabel(rep, prevRep), lines: [] });
    }
    prevRep = rep;
  }
  return markers;
}

export default {
  async mount(host: HTMLElement, props: Record<string, unknown>) {
    const style = document.createElement("style");
    style.textContent = lifelineCss as string;
    host.appendChild(style);

    const scene = new LifelineScene(host, buildMarkers(props), {
      ...(typeof props.title === "string" && { title: props.title }),
      theme: props.theme === "light" ? "light" : "dark",
      accent: String(props.accent ?? "#34d399"),
      ...(Number(props.sweepSeconds) > 0 && {
        sweepMs: Number(props.sweepSeconds) * 1000,
      }),
    });

    return {
      start: () => scene.start(),
      action: async (name: string) => {
        if (name === "hold") scene.hold();
        if (name === "resume") scene.resume();
      },
      destroy: () => scene.destroy(),
    };
  },
};
