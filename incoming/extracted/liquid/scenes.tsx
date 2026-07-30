// The scene data shared by the preview card and the playground, in two sizes.
//
// Why two: the desktop compositions live in a wide fixed-px design space (640×360
// for the card, 720×380 for the playground) that gets CSS-scaled to the container.
// On a phone the container is ~326px wide, so that scale collapses to ~0.45 — the
// whole scene shrinks until the 11px labels render at 5px and the 2px content bars
// land under one device pixel. Rescaling alone can't fix that: a wide landscape
// composition is simply the wrong layout for a narrow screen.
//
// So mobile gets its OWN space (COMPACT_VW×COMPACT_VH), sized so the scale lands
// near 1.0 at phone widths — content then renders at roughly its true design size.
// The pieces are re-placed tighter for the narrower box, and the small "appendage"
// pieces are grown so they clear the ~44px touch minimum when dragged.
//
// The card and the playground MUST agree on which set they use: they share a
// view-transition-name for the card→hero morph, and a mismatch would make the
// shape visibly jump mid-transition.

import type { ReactNode } from "react";

// ── Design spaces ────────────────────────────────────────────────────────────
/** Desktop space for the preview card / hero. */
export const CARD_VW = 640;
export const CARD_VH = 360;
/** Desktop space for the draggable playground stage. */
export const PG_VW = 720;
export const PG_VH = 380;

/** The shared mobile space. 16:9 so it matches the card's aspect exactly, and
 *  small enough that `100cqw / COMPACT_*_DIV` lands near 1.0 on a phone. */
export const COMPACT_VW = 360;
export const COMPACT_VH = 202;

/** Divisors for the CSS `scale: calc(100cqw / N)`. The card divides by the width
 *  of the box the shapes actually occupy (not the full space) so the content
 *  fills the frame; the playground divides by its full width so the whole
 *  draggable area stays reachable. */
export const CARD_DIV = 460;
export const PG_DIV = 720;
// Tuned by eye rather than to a pure fit: at a 1.0 scale the scene filled the frame
// edge to edge and felt cramped, so both divisors are pushed past the exact-fit
// value to leave breathing room. The floor on the playground is the touch target —
// its smallest draggable piece is 60 design-px, and 430 keeps that at ~45 CSS px on
// a 390px phone, just above the ~44px minimum.
export const COMPACT_CARD_DIV = 380;
export const COMPACT_PG_DIV = 430;

/** The breakpoint. Matches Tailwind `sm` (and ImageGalaxyCard's mobile check). */
export const MOBILE_QUERY = "(max-width: 639px)";

// ── Types ────────────────────────────────────────────────────────────────────
export interface ScenePiece {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  radius: number;
  content?: ReactNode;
}

export interface SceneSpec {
  k: number;
  /** Grid cell size for the marching-squares sample, in field units. */
  cell: number;
  pieces: ScenePiece[];
}

/** Everything a consumer needs for one size: the space, the CSS divisors, and
 *  the scenes placed inside that space. */
export interface SceneSet {
  vw: number;
  vh: number;
  cardDiv: number;
  pgDiv: number;
  cardRadius: number;
  /** cycling scenes for the preview card / hero */
  card: SceneSpec[];
  /** presets for the draggable playground */
  playground: SceneSpec[];
}

// ── Content ──────────────────────────────────────────────────────────────────
// Content is authored at two sizes too. Because the whole space is CSS-scaled,
// an 11px label in the desktop space renders at ~5px on a phone — so the mobile
// variants use larger design-px values that land near the intended size once the
// compact scale (~1.0) is applied.

const swatch = "rounded-[6px] bg-[var(--bg-hover)]";

const bar = (w: string, h: string) => (
  <div className={`${h} rounded-full bg-[var(--bg-hover)]`} style={{ width: w }} />
);

/** 2×2 tile grid (the "grid panel" body). */
function GridBody({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`grid h-full grid-cols-2 grid-rows-2 ${compact ? "gap-1.5 p-2 pt-2.5" : "gap-1.5 p-2 pt-2.5"}`}
    >
      <div className={swatch} />
      <div className={swatch} />
      <div className={swatch} />
      <div className={swatch} />
    </div>
  );
}

/** A small text label (the "Grid" / "Share" tab). */
function Label({ children, compact = false, center = false }: { children: ReactNode; compact?: boolean; center?: boolean }) {
  return (
    <div
      className={`flex h-full items-center ${center ? "justify-center pl-1" : "px-3 pb-1"}`}
    >
      <span
        className={`font-semibold text-[var(--text-secondary)] ${compact ? "text-[13px]" : "text-[11px]"}`}
      >
        {children}
      </span>
    </div>
  );
}

/** Avatar + two message lines (the chat bubble body). */
function BubbleBody({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`flex h-full items-center ${compact ? "gap-3 px-4" : "gap-2.5 px-4"}`}>
      <div
        className={`${compact ? "size-10" : "size-9"} shrink-0 rounded-full bg-[var(--bg-hover)]`}
      />
      <div className="flex flex-1 flex-col gap-1.5">
        {bar("80%", compact ? "h-2.5" : "h-2")}
        {bar("55%", compact ? "h-2.5" : "h-2")}
      </div>
    </div>
  );
}

/** Overlapping avatar stack + two lines (the share card body). */
function ShareBody({ compact = false }: { compact?: boolean }) {
  const av = `${compact ? "size-9" : "size-8"} rounded-full border-2 border-[var(--bg-surface)] bg-[var(--bg-hover)]`;
  return (
    <div className="flex h-full items-center gap-3 px-4">
      <div className="flex -space-x-2">
        <div className={av} />
        <div className={av} />
        <div className={av} />
      </div>
      <div className="flex flex-1 flex-col gap-1.5">
        {bar("70%", compact ? "h-2.5" : "h-2")}
        {bar("45%", compact ? "h-2.5" : "h-2")}
      </div>
    </div>
  );
}

/** The search-bar input line. */
function SearchBody({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex h-full items-center px-5">
      {bar("55%", compact ? "h-3" : "h-2.5")}
    </div>
  );
}

/** The magnifier glyph on the search "go" button. */
function SearchIcon({ size = 20 }: { size?: number }) {
  return (
    <div className="flex h-full w-full items-center justify-center text-[var(--text-secondary)]">
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.2-3.2" />
      </svg>
    </div>
  );
}

// ── Desktop scenes ───────────────────────────────────────────────────────────
// The card cycles these three; every scene shares the SAME two ids ("main" +
// "tab") so pieces tween 1:1 and content swaps at the morph midpoint.
const CARD_SCENES: SceneSpec[] = [
  // Grid panel — 2×2 tiles + a "Grid" tab fused at the top-left.
  {
    k: 20,
    cell: 6,
    pieces: [
      { id: "main", x: 170, y: 82, w: 300, h: 196, radius: 22, content: <GridBody /> },
      { id: "tab", x: 178, y: 46, w: 92, h: 46, radius: 18, content: <Label>Grid</Label> },
    ],
  },
  // Chat bubble — avatar + message lines, tail fused at the bottom-right.
  {
    k: 30,
    cell: 6,
    pieces: [
      { id: "main", x: 160, y: 128, w: 300, h: 108, radius: 40, content: <BubbleBody /> },
      { id: "tab", x: 428, y: 206, w: 50, h: 50, radius: 14 },
    ],
  },
  // Share card — avatar stack + a "Share" button fused to the right edge (gooey).
  {
    k: 60,
    cell: 6,
    pieces: [
      { id: "main", x: 150, y: 120, w: 280, h: 116, radius: 26, content: <ShareBody /> },
      { id: "tab", x: 418, y: 151, w: 90, h: 54, radius: 18, content: <Label center>Share</Label> },
    ],
  },
];

// The playground's four presets, hand-placed by dragging in the playground
// itself, in the wider 720×380 stage (absolute coords, no auto-centering).
const PG_SCENES: SceneSpec[] = [
  // 1 · Chat bubble — tail fused at the bottom-right (a sent message).
  {
    k: 28,
    cell: 12,
    pieces: [
      { id: "bubble", x: 188, y: 123, w: 300, h: 116, radius: 40, content: <BubbleBody /> },
      { id: "tail", x: 472, y: 212, w: 52, h: 52, radius: 14 },
    ],
  },
  // 2 · Grid panel — a "Grid" tab fused at the top-left.
  {
    k: 20,
    cell: 12,
    pieces: [
      { id: "tab", x: 178, y: 80, w: 92, h: 46, radius: 18, content: <Label>Grid</Label> },
      { id: "panel", x: 247, y: 104, w: 300, h: 196, radius: 22, content: <GridBody /> },
    ],
  },
  // 3 · Share card — a "Share" button fused to the right edge with a gooey neck.
  {
    k: 77,
    cell: 11,
    pieces: [
      { id: "card", x: 176, y: 131, w: 288, h: 120, radius: 26, content: <ShareBody /> },
      { id: "btn", x: 483, y: 165, w: 96, h: 52, radius: 18, content: <Label center>Share</Label> },
    ],
  },
  // 4 · Search bar — a pill input with a round button fused near the right end.
  {
    k: 20,
    cell: 3,
    pieces: [
      { id: "input", x: 208, y: 167, w: 300, h: 64, radius: 32, content: <SearchBody /> },
      { id: "go", x: 452, y: 132, w: 56, h: 56, radius: 26, content: <SearchIcon /> },
    ],
  },
];

// ── Compact (mobile) scenes ──────────────────────────────────────────────────
// Re-placed for the 360×202 space rather than rescaled: the compositions are
// tighter and more vertical, the bodies are proportionally larger relative to the
// frame, and every draggable appendage is at least 60 design-px so it stays a
// comfortable touch target once the ~1.0 compact scale is applied.
//
// `cell` is raised across the board. It's a grid step in FIELD units, so a small
// cell in a small space oversamples badly — the compact space is ~half the width
// of the desktop one, so the same visual crispness needs roughly half the cell
// count, and the weakest devices are the ones running it.
const COMPACT_CARD_SCENES: SceneSpec[] = [
  // Grid panel — tab tucked at the top-left of the body.
  {
    k: 16,
    cell: 5,
    pieces: [
      { id: "main", x: 76, y: 49, w: 208, h: 132, radius: 20, content: <GridBody compact /> },
      { id: "tab", x: 84, y: 21, w: 78, h: 38, radius: 15, content: <Label compact>Grid</Label> },
    ],
  },
  // Chat bubble — tail fused at the bottom-right.
  {
    k: 22,
    cell: 5,
    pieces: [
      { id: "main", x: 64, y: 62, w: 232, h: 92, radius: 32, content: <BubbleBody compact /> },
      { id: "tab", x: 262, y: 128, w: 46, h: 46, radius: 13 },
    ],
  },
  // Share card — button fused to the right edge (gooey).
  {
    k: 44,
    cell: 5,
    pieces: [
      { id: "main", x: 46, y: 60, w: 210, h: 96, radius: 22, content: <ShareBody compact /> },
      { id: "tab", x: 246, y: 78, w: 74, h: 48, radius: 16, content: <Label compact center>Share</Label> },
    ],
  },
];

const COMPACT_PG_SCENES: SceneSpec[] = [
  // 1 · Chat bubble + tail. The tail is the smallest draggable piece anywhere, so
  //     it sets the floor: 64px keeps it a usable target even on a 320px phone.
  {
    k: 22,
    cell: 6,
    pieces: [
      { id: "bubble", x: 52, y: 56, w: 232, h: 92, radius: 32, content: <BubbleBody compact /> },
      { id: "tail", x: 250, y: 120, w: 64, h: 64, radius: 17 },
    ],
  },
  // 2 · Grid panel + tab. The tab is short by nature, so it's the piece most at risk
  //     of becoming an unusable target — 64 tall keeps it draggable, and the panel
  //     drops to meet it so the pair still reads as a tab fused to a panel.
  {
    k: 16,
    cell: 6,
    pieces: [
      { id: "tab", x: 60, y: 18, w: 92, h: 64, radius: 20, content: <Label compact>Grid</Label> },
      { id: "panel", x: 96, y: 62, w: 204, h: 122, radius: 20, content: <GridBody compact /> },
    ],
  },
  // 3 · Share card + button, gooey neck.
  {
    k: 52,
    cell: 6,
    pieces: [
      { id: "card", x: 40, y: 56, w: 204, h: 100, radius: 22, content: <ShareBody compact /> },
      { id: "btn", x: 242, y: 74, w: 82, h: 64, radius: 20, content: <Label compact center>Share</Label> },
    ],
  },
  // 4 · Search bar + go button, both at the 64px floor.
  {
    k: 16,
    cell: 5,
    pieces: [
      { id: "input", x: 42, y: 80, w: 224, h: 64, radius: 32, content: <SearchBody compact /> },
      { id: "go", x: 238, y: 50, w: 64, h: 64, radius: 29, content: <SearchIcon size={22} /> },
    ],
  },
];

// ── The two sets ─────────────────────────────────────────────────────────────
export const DESKTOP_SET: SceneSet = {
  vw: PG_VW,
  vh: PG_VH,
  cardDiv: CARD_DIV,
  pgDiv: PG_DIV,
  cardRadius: 26,
  card: CARD_SCENES,
  playground: PG_SCENES,
};

export const COMPACT_SET: SceneSet = {
  vw: COMPACT_VW,
  vh: COMPACT_VH,
  cardDiv: COMPACT_CARD_DIV,
  pgDiv: COMPACT_PG_DIV,
  cardRadius: 20,
  card: COMPACT_CARD_SCENES,
  playground: COMPACT_PG_SCENES,
};

/** The card/hero uses its own space (640×360) on desktop but shares the compact
 *  space on mobile — so the two sets differ in `vw`/`vh` for the card path. */
export const CARD_SPACE = { vw: CARD_VW, vh: CARD_VH };
export const COMPACT_CARD_SPACE = { vw: COMPACT_VW, vh: COMPACT_VH };

