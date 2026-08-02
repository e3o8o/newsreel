# Cinema: Screen-Studio-class camera work for newsreel

## Thesis

Recordly and Screenize spend most of their code *inferring* what the user did — polling cursors at 30–60 Hz, tapping global events, clustering clicks, classifying trajectories — and then rendering a camera as a function of that inferred stream. newsreel executes the script, so at the moment of every action it holds the ground truth those apps reconstruct: the element's `boundingBox()`, the pointer path (because we synthesize it), exact timestamps, the typed text and per-key cadence. The design is therefore: **capture writes a ground-truth events sidecar next to each clip; a deterministic planner turns the sidecar into an inspectable camera plan; a Chromium canvas compositor re-renders each clip with the camera transform, a drawn cursor, click effects and keystroke badges, driven frame-by-frame and encoded by ffmpeg.** Nothing is inferred, everything is a pure function of (clip, sidecar, config), the plan JSON is overridable per shot, and because narration is cached and the pass is cached by content hash, a camera tweak re-renders in seconds without re-capturing. Every existing config renders byte-identically until a new key is used.

Coordinate convention, stated once: **normalized 0..1, top-left origin, in layout-viewport space** (which equals recorded-frame space because `capture.zoom` scaling is uniform). No flips anywhere; canvas is top-left native. Do not import Screenize's mixed y conventions.

---

## Architecture decision

**Primary path: (a) a Chromium canvas re-render pass** — `lib/camera/render.cjs` drives a committed compositor bundle (same authoring pattern as `visuals/`: esbuild at authoring time, bundle committed, served by the existing `startVisualsServer`). Per shot it:

1. Pre-transcodes the source webm to an **intra-only CFR proxy** (`ffmpeg -i shot.webm -ss <trim> -vf fps=30 -c:v mjpeg -q:v 3` or libx264 `-g 1 -preset ultrafast`). This solves three problems at once: VP8 seek imprecision, Playwright's variable-frame-rate recording (held-frame CFR semantics, same idea as Screenize's `CFRFrameReader`), and decode speed.
2. Opens one Playwright page (viewport = capture viewport, DSF 1) on `cinema.html`, which loads the proxy into a `<video>`, and per output frame: seek to `t_src`, await `seeked`, draw the frame through the camera transform onto a canvas, draw motion blur, cursor, click effects, then badges.
3. Screenshots each frame (JPEG q≈90) and pipes them into `ffmpeg -f image2pipe -framerate 30 ... -c:v libx264` producing `<workDir>/cinema/<id>-<hash>.mp4` at viewport size.

The pass runs **inside assemble/compose, per section, after narration is measured**, so it knows the final `(trimStart, speed, durOut)` and renders in *output time*: `t_src = trimStart + t_out * speed`. Springs, effect envelopes and badges animate in output time (a ripple is 600 ms on screen regardless of the clip's speed-fit); the underlying UI motion is sped exactly as today. Assemble then treats the processed clip as a normal clip with `clipStart = 0, speed = 1` — the styled frame / mask / lower-third chain is untouched.

**What each renderer gets**

- **assemble** (the light path): invokes the pass for shots with camera/cursor/keys enabled; its per-section ffmpeg chain simplifies for those sections (no `setpts`, no `zoompan` motion — camera replaces `shots[].motion`, with a warning if both are set). If Playwright is missing it warns once and renders today's output (mirrors the existing degraded frame-assets path).
- **compose** (Remotion): consumes the *same* pre-rendered clips — `data.json` entries get `trimBeforeSec: 0, playbackRate: 1, motion: null`, clip = processed file. One implementation, both paths identical in look. Remotion's Ken Burns remains for non-camera shots.
- **generated shots**: always camera-off (they are self-driving full compositions; the ghost pointer lives inside the page, invisible to Playwright). Open question below on exporting the ghost path later.

**Rejected alternatives**

- **(b) Do it in Remotion**: `compose` requires `npm install` in the workDir; putting the only camera implementation there abandons the flagship zero-dependency `assemble` path, and per-frame spring state (velocity carry across segments) fights Remotion's stateless `interpolate(frame)` model — you'd pre-bake transforms into data.json anyway, at which point Remotion is just a slower screenshot loop than the one we control. Kept only as a consumer of pre-rendered clips.
- **(c) ffmpeg-only (`zoompan` / `sendcmd`)**: `zoompan` cannot express spring dynamics (closed-form per-frame x/y/z would be a multi-kilobyte expression, and still no cursor, no effects, no badges, no text). A per-frame `sendcmd` crop script gets the camera but nothing else, and composing a cursor overlay would require generating a transparent overlay video — in Chromium — so you've built path (a) with extra steps. The existing `motion: "in"` zoompan stays as-is for the no-Playwright fallback; no attempt to grow it.
- **Real-time re-record (`canvas.captureStream` + MediaRecorder)**: non-deterministic timing, dropped frames under load; export and preview must agree — Recordly's content-time-delta rule (`modernFrameRenderer.ts:3765`) exists precisely because wall-clock rendering diverges. Frame-by-frame or nothing.
- **Draw the cursor at capture time (inject a fake DOM cursor)**: bakes the cursor into footage, forfeiting smoothing/squash/re-styling and contradicting the single most important architectural decision in both study apps (cursor never baked; Recordly §3.1). Rejected outright.

**Cost model**: per camera shot, one fast proxy transcode + `durOut × 30` screenshots + one encode. Measured expectations: 100–150 ms/screenshot at 1440×900 headless ⇒ a 7 s section ≈ 25–35 s. Bounded by: pass only runs for camera-enabled shots; sections render concurrently (2–3 pages, one browser); **content-hash cache** — `sha1(events file, resolved camera+cursor+keys config, trimStart, speed, durOut, fps, W, H)` — so a narration edit elsewhere re-renders nothing, and a config tweak re-renders only affected shots.

---

## Clock and the trim trap

- Sidecar `t = 0` is **recording start of the raw webm**, approximated as `Date.now()` when `newPage()` resolves; the honest uncertainty (~50–100 ms) is stored as `clock.uncertaintyMs`. This error is absorbed by design: camera anticipation is ≥ 150 ms, the cursor is drawn (there is no real cursor to disagree with), and click effects landing ±3 frames from the UI's reaction are imperceptible.
- **Cross-check (Phase 1 measures, Phase 3 may apply):** the sidecar records `clock.navSettledT` (goto + auth handshake complete). `firstContentTime()` finds the first painted frame in the video. `offset = firstContentTime*1000 − navSettledT` bounds the true drift; if it is consistently > 120 ms, apply it as a correction in the pass.
- **The trap**: assemble trims the blank lead with `-ss clipStart`, shifting the clip's t=0. The sidecar must NOT be rewritten. Rule: **the sidecar stays on the raw-clip clock forever; every consumer maps** `t_out = (t_event/1000 − trimStart) / speed`, using the `trimStart` it computed itself. Because the pass is invoked *by* assemble/compose with their own `clipStart`, and its output begins at that trim with content on frame 0, `firstContentTime` on the processed clip returns ≈ 0 — and assemble skips re-trimming pass output anyway (it knows). Double-trim is structurally impossible.
- Events with `t < trimStart` (the park move during page load) are dropped by the mapper.

---

## Schema 1: the events sidecar

Written by capture as `<workDir>/clips/<shotId>.events.json`, one per captured shot, alongside `<shotId>.webm`. All coordinates normalized 0..1 top-left against `layoutViewport`. All times integer ms from recording start. `events` sorted by `t`/`t0`.

```jsonc
{
  "schema": 1,
  "shot": "invoices",
  "createdAt": "2026-08-02T12:00:00Z",
  "viewport":       { "width": 1440, "height": 900 },   // recorded frame size (recordVideo size)
  "layoutViewport": { "width": 1440, "height": 900 },   // page CSS px; differs when capture.zoom != 1
  "captureZoom": 1,
  "clock": {
    "basis": "recordStart",            // t=0 == page open (recordVideo start)
    "recordStartAt": 1785672000123,    // Date.now() at newPage()
    "uncertaintyMs": 80,
    "navSettledT": 1450                // goto + handshake done; cross-check vs firstContentTime
  },
  "start": { "x": 0.50, "y": 0.55 },   // park position; first sample of the cursor track
  "events": [
    // Pointer transit. Emitted before every targeted action; includes both endpoints.
    // path samples at ~60 Hz: [tMs, x, y]. reason: "click"|"dblclick"|"type"|"fill"|"press"|"scroll"|"park".
    { "type": "move", "t0": 2050, "t1": 2440, "from": [0.50, 0.55], "to": [0.62, 0.41],
      "reason": "click",
      "path": [[2050, 0.500, 0.550], [2066, 0.503, 0.548], [2082, 0.509, 0.545]] },

    // Click / double click. box = element boundingBox normalized; cursorStyle from
    // getComputedStyle(el).cursor mapped onto {arrow,pointer,text,crosshair,grab,not-allowed}.
    { "type": "click", "t": 2460, "at": [0.62, 0.41], "button": "left", "count": 1,
      "selector": "[data-testid=approve]",
      "box": { "x": 0.58, "y": 0.38, "w": 0.08, "h": 0.06 },
      "cursorStyle": "pointer" },
    { "type": "dblclick", "t": 4100, "at": [0.30, 0.52], "button": "left", "count": 2,
      "selector": "text=Report.pdf", "box": { "x": 0.26, "y": 0.50, "w": 0.10, "h": 0.04 },
      "cursorStyle": "arrow" },

    // Typing burst (the `type` action): real per-key timestamps, recorded as each key is sent.
    { "type": "typeBurst", "t0": 5000, "t1": 6480, "selector": "#query",
      "box": { "x": 0.12, "y": 0.10, "w": 0.30, "h": 0.05 },
      "text": "Acme",
      "keys": [ { "t": 5000, "key": "A" }, { "t": 5110, "key": "c" },
                { "t": 5195, "key": "m" }, { "t": 5290, "key": "e" } ] },

    // fill: instantaneous value set (no cadence); planner treats it as a brief field focus.
    { "type": "fill", "t": 7100, "selector": "#amount", "text": "1200",
      "box": { "x": 0.12, "y": 0.22, "w": 0.20, "h": 0.05 } },

    // press: chord or named key. combo keeps Playwright syntax; badge text derived at render.
    { "type": "keyChord", "t": 7300, "combo": "Meta+a", "selector": null, "box": null },

    // scroll: wheel deltas in CSS px; element scrolls carry the element's box.
    { "type": "scroll", "t0": 8000, "t1": 8000, "at": [0.50, 0.50], "delta": [0, 300],
      "selector": null, "box": null },

    // waitFor with settle time: when the awaited element became visible. The planner treats
    // settledT as "content arrived here" (hold wide before it, focus candidate after it).
    { "type": "waitFor", "t": 900, "settledT": 1900, "state": "visible",
      "selector": "[data-testid=invoice-row]",
      "box": { "x": 0.05, "y": 0.30, "w": 0.90, "h": 0.08 } },

    // Capture's 1200 ms end-of-shot tail marker (planner may start its release here).
    { "type": "settle", "t": 9600 }
  ]
}
```

### How capture is instrumented (no semantic changes)

All in `lib/telemetry.cjs` + a thin wrapper around `runAction` in `capture.cjs`:

- **Recorder**: an object holding `recordStartAt`, the current pointer position, and the events array; `flush()` writes the sidecar after the shot's tail wait, before `page.close()`.
- **Eased pointer path**: before `click`/`dblclick`/`type`/`fill`/`press`(with selector)/`scroll`(with selector), resolve `box = await locator.boundingBox()`, target = box center (± small jitter, ≤ 8 px, seeded per shot for determinism). Generate the path in Node: duration `= clamp(0.20 + dist_norm * 0.55, 0.25, 0.80)` s (same clamp family as the camera's travel rule), samples at 60 Hz along `easeInOutCubic` with a 2-point perpendicular bow (quadratic bezier, bow = 6% of distance) so transits arc instead of ruling straight lines. Drive the real pointer with `page.mouse.move(x, y)` per sample (hover states and tooltips fire on camera); record the same samples verbatim — ground truth by construction. Then the action runs exactly as today (`locator.click()` etc. — Playwright will not move the mouse again; it is already on target).
- **Typing per-key cadence**: replace `pressSequentially` with an equivalent loop — `locator.focus()`, then per character `keyboard.press(ch)` (or `keyboard.insertText` for non-key characters), recording `Date.now()` per key, waiting `delay` (default 90 ms) between. Identical observable semantics (focus first, per-key events, never clears the field).
- **slowMo**: telemetry mode sets `slowMo: 0` — the 500 ms uniform stall would otherwise multiply across per-sample `mouse.move` calls. Pacing is re-created explicitly: 250 ms settle before each transit, 600 ms after each click, and the eased transits themselves. Net shot length stays in the same band; pacing becomes designed rather than uniform.
- **cursorStyle**: one `locator.evaluate(el => getComputedStyle(el).cursor)` per targeted action, mapped onto the sidecar enum (default `arrow`).
- **Activation**: telemetry (and the slowMo change) turn on iff the resolved config enables any cinema feature (`video.camera`, `shots[].camera`, `style.cursor/clicks/keys`) or `capture.telemetry: true` is set explicitly (record now, decide later). Otherwise capture is byte-identical to today.
- **Generated shots**: never instrumented; `playGeneratedShot` untouched.
- Failure containment: telemetry errors (`boundingBox()` null on a detached element, etc.) degrade to recording the action without a box — a missing box only means the planner falls back to the click point with the intent range's lower bound. A failing sidecar write logs and never fails the shot.
- New optional action `{ "type": "dblclick", "selector": ... }` is added to `ACTION_TYPES` (validator + runAction), since the event type exists; cheap and useful for demos.

---

## Schema 2: the camera plan

Emitted by the planner to `<workDir>/cinema/<shotId>.camera.json` on every pass (inspectable, diffable); the same shape is accepted inline as a per-shot override. **Times are output seconds** (post trim, post speed-fit). Segments are sorted, contiguous, non-overlapping; first `t0 = 0`, last `t1 = durOut`. The spring pass bakes them into per-frame transforms — explicit easing per keyframe deliberately does not exist (Screenize's lesson: springs replaced easing; ship one or the other, not both).

```jsonc
{
  "schema": 1,
  "shot": "invoices",
  "mode": "segments",                          // "segments" | "follow"
  "clip": { "trimStart": 1.43, "speed": 1.62, "durOut": 6.20, "fps": 30 },
  "config": { "intensity": 1.0, "maxZoom": 2.2 },   // resolved values the plan was built with
  "segments": [
    { "t0": 0.00, "t1": 1.10,
      "from": { "zoom": 1.00, "cx": 0.50, "cy": 0.50 },
      "to":   { "zoom": 1.00, "cx": 0.50, "cy": 0.50 }, "why": "establish" },
    { "t0": 1.10, "t1": 1.52,
      "from": { "zoom": 1.00, "cx": 0.50, "cy": 0.50 },
      "to":   { "zoom": 1.90, "cx": 0.62, "cy": 0.41 }, "why": "click [data-testid=approve]" },
    { "t0": 1.52, "t1": 3.60,
      "from": { "zoom": 1.90, "cx": 0.62, "cy": 0.41 },
      "to":   { "zoom": 1.90, "cx": 0.62, "cy": 0.41 }, "why": "hold" },
    { "t0": 3.60, "t1": 4.40,
      "from": { "zoom": 1.90, "cx": 0.62, "cy": 0.41 },
      "to":   { "zoom": 1.45, "cx": 0.56, "cy": 0.45 }, "why": "typeBurst #query (merged)" },
    { "t0": 4.40, "t1": 6.20,
      "from": { "zoom": 1.45, "cx": 0.56, "cy": 0.45 },
      "to":   { "zoom": 1.00, "cx": 0.50, "cy": 0.50 }, "why": "release" }
  ]
}
```

`why` is documentation only (never parsed) — it is what makes the plan agent-editable. Override handling: a user/agent plan is normalized (sorted, clamped via `clampCenter`, gaps filled with holds, `zoom` clamped to `[1, maxZoom]` with a warning) and then baked by the same spring pass, so overrides inherit the house motion for free.

### Planner rules (Mode B analog — the default)

Pure function `plan(events, clip, cfg)` in `lib/camera/plan.cjs`. All events first mapped to output time; events outside `[0, durOut]` dropped.

1. **Intent extraction** (no inference needed — one intent per ground-truth event):
   `click`/`dblclick` → click intent at `box` (fallback: point). `typeBurst`/`fill` → typing intent at the field's box, span `[t0, t1]`. `scroll` → scroll intent. `waitFor.settledT` → content-arrival marker (never zoom before the first one). `settle` → release candidate.
2. **Zoom sizing** (`zoom = targetAreaCoverage / areaSize` — the whole model): `areaSize = max(w + 0.16, h + 0.16)` (0.08 padding per side); `zoom = clamp(coverage 0.7 / areaSize, intentRange)`, then `zoom = 1 + (zoom − 1) × intensity`, then clamp `[1, maxZoom]`. Intent ranges (Screenize defaults): click **1.5–2.5**, typing-field **2.2–2.8**, typing-textarea **1.8–2.2**, scroll **1.3–1.5**, establish/idle **1.0**. Guard: if the target box's max dimension > 0.6 (a giant container), zoom = 1.0 — the analog of the modal pull-back without needing modal detection.
3. **Center**: box center, then shift minimally so the 0.08-padded box fits the viewport (`constrainCenterToShowElement`), then `clampCenter`: `halfCrop = 0.5/zoom; c = clamp(c, halfCrop, 1 − halfCrop)` per axis. Applied again at every spring tick and once more in pixel space (belt and braces, as Screenize does).
4. **Anticipation**: shift each intent span earlier — click **0.15 s**, typing **0.4 s**, scroll **0.25 s** (both ends, floored at 0).
5. **Merge**: consecutive intents merge when `gap ≤ 2.0 s` AND `centerDistance ≤ 0.20`; merged focus covers the union of boxes (zoom recomputed from the union). Point-span intents get a synthetic **0.5 s** duration before merging.
6. **Transition/hold split** per planned target: `move = clamp(max(dist × 1.0 s, |Δzoom| × 0.35 s), 0.15, 0.8)`; if the remaining span ≥ **0.1 s**, emit MOVE then HOLD, else MOVE fills the span. Skip the split entirely when `dist ≤ 0.05` and `|Δzoom| ≤ 0.1` (not worth a move).
7. **Yo-yo removal** over (active, passive, active) triples: if `|z1 − z3| < 0.30` and centers within **0.15** → delete the middle; within **0.35** and gap **< 1.5 s** → delete; else middle zoom = `max(z1 × 0.70, 1)`.
8. **Idle pull-back**: a gap > **1.5 s** with no intent decays zoom to `1 + (z − 1) × 0.5`, center inherited (never snap to 0.5 — visible snap, per Screenize's comment). **Release**: if ≥ **1.2 s** remains after the last intent (including narration hold time), pull to zoom 1.0 center 0.5 over `min(1.0 s, remaining)`; controlled by `camera.holdLastFrame` (during frozen-frame holds the camera keeps moving — the hold is where the pull-back lives).
9. **Establish**: segment 0 is always zoom 1.0 at center until the first intent's anticipated start (min 0.3 s; if the first intent is earlier, it still starts from 1.0/center — the startup-bias rule).

### The spring bake (shared by segments, follow, and overrides)

`lib/camera/spring.cjs` — the analytic damped-harmonic step, both regimes, exactly as specified in the study docs (Screenize `SpringDamperSimulator.swift:348-381`; ω = 2π/response, no mass term):

```
d = x0 − T ; zo = ζω ; decay = e^(−zo·dt)
ζ ≥ 1:  B = v0 + zo·d          x' = T + (d + B·dt)·decay
        v' = (B − zo·(d + B·dt))·decay
ζ < 1:  wd = ω√(1−ζ²) ; B = (v0 + zo·d)/wd
        x' = T + decay·(d·cos(wd·dt) + B·sin(wd·dt))
        v' = decay·(−zo·(d·cos + B·sin) + (−d·wd·sin + B·wd·cos))
```

Fixed `dt = 1/fps` (30), three independent axes (cx, cy, zoom). Constants: ζ **0.90**, position response **0.35 s**, zoom response **0.55 s**. Per segment: target = segment `to`; **velocity carries across boundaries** (no crossfades needed); hold segments (from ≈ to, deltas < 0.001) damp velocities ×**0.3** on entry; response stretches to fill the slot: `max(0.15, max(base, segDur × 0.40)) ` for position, `× 0.45` for zoom. Clamps at every tick: `clampCenter(c, zoom)` with **soft pushback** instead of a hard stop (overflow cap 0.03, stiffness 12: `v *= max(0, 1 − min(1, |ovf|/0.03) × 0.5 × dt × 12); v −= ovf × 12 × 0.3 × dt`). Output: `transforms[frame] = {zoom, cx, cy}` plus finite-difference velocities for motion blur.

**Mode A (follow)** is a config option (`camera.mode: "follow"`), built from the same parts: dense cursor track → dead-zone target (safe fraction 0.75 / 0.60 typing; correction 0.45 / 0.80; gradient band 0.25 of viewport-half; hysteresis 0.15 of safe-half; Chebyshev activation, per-axis targeting) → adaptive response from scripted look-ahead (`timeToNext ≤ 0.5 s → 0.20 s`, `≥ 2.0 s → 0.50 s`, lerp between) → same spring. Zoom waypoints come from the same intent extraction. Ships later (Phase 6); segments mode is the default and the better fit for scripted content.

### Camera transform in the compositor

Per frame: `scale = zoom`, source crop of size `1/zoom` centered on `(cx, cy)` (already clamped), i.e. `drawImage(video, cx·W − W/(2z), cy·H − H/(2z), W/z, H/z, 0, 0, W, H)`. Equivalent margin form: focus confined to `[1/(2·scale), 1 − 1/(2·scale)]` — same constraint, one convention.

---

## Cursor presentation

- **Assets**: fresh SVGs in `assets/cursors/` drawn from Screenize's vector specs (Apache-2.0; the arrow path in a 17×25 design box: `(1.5,1) (1.5,18.5) (5.5,14.5) (9.5,22.5) (12,21.5) (8,13.5) (13.5,13.5)`, black fill + white 1.5 stroke round-joined + drop shadow (0,−1.5, blur 3, black 0.35) — the black/white combination is what keeps it legible on any background). Set: `arrow`, `pointer` (hand), `text` (I-beam), `dot` (accent-tinted disc). Hotspots as normalized fractions of the design box: arrow `(0.088, 0.04)`, pointer `(0.33, 0.042)`, text/dot centered.
- **Style selection**: `style.cursor.style: "auto"` uses the sidecar's per-action `cursorStyle` (resolved like Recordly's `findLatestStableCursorType`: latest non-click event's style, so clicks don't flicker the shape); `"arrow"`/`"dot"` pin one shape.
- **Position**: dense track = concatenation of `move.path` samples with holds in the gaps; binary search + lerp at `t_src` (Recordly's interpolator). Then a per-axis spring chases it — constants from Recordly smoothing 0.67: **k ≈ 358, c ≈ 60.5, m ≈ 1.40 (ζ ≈ 0.855)**, slight overshoot-and-settle. The spring runs in **camera-relative space** (target − cameraCenter, result converted back) — without this the cursor visibly slides during pans (Screenize's non-obvious fix). Discontinuity rule: if `|Δt| > 100 ms` (a cut or hold boundary), snap instead of animating.
- **Size and layering**: drawn **after** the camera transform, in screen space, at `h = 28 px × scale(default 2.0) × max(0.55, viewportW/1920) × zoom` — rasterized from SVG at the exact target size each time it changes (crisp at any zoom, Screenize's approach; visual result equals Recordly's inside-the-transform placement).
- **Click squash**: `scale = max(0.72, 1 − sin(p·π) × 0.08 × bounce)` over a **350 ms** window, `bounce` default 2.5, depth boosted by **√zoom** so the punch reads when zoomed.
- **Hide**: `style.cursor.show: false` (or `"style": "none"`). Cursor-only mode (cursor + effects at zoom 1, no camera) is valid and cheap.

## Click effects and keystroke badges

**Click effects** (`style.clicks`), anchored at the click event's position (not the smoothed cursor), starting `bounceDuration/2` after the click; `p` counts 1→0 over `durationMs` (default 600):

- **ripple**: `radius = max(0.5, (1 − p³) × cursorH × 1.95 × scale)`, `alpha = clamp(p³ × 0.6 × opacity, 0, 1)`, `strokeWidth = max(1, 2·p³)` — one expanding, fading ring.
- **spotlight**: `base = max(12, cursorH × 0.55 × scale)`; `glow = base + (1−p) × cursorH × scale`; `inner = max(base × 0.72, glow × 0.76)`; strokes at `alpha × 0.28` (w `max(1.25, sw×0.68)`) and `alpha × 0.5` (w `max(1.5, sw×0.75)`), `sw = max(2, cursorH × 0.08)`, `alpha = p × opacity` — two converging rings.
- Default effect `ripple`, color defaults to `style.accent`. Effects render inside the camera transform's screen space at the transformed point, scaled by zoom (they belong to the content).

**Keystroke badges** (`style.keys`) — designed fresh; both study apps fail here (Recordly never shipped it; Screenize's badges overlap at one point). Rendered **after** the camera transform, fixed screen space, never zoomed or blurred (the Screenize layering rule that keeps overlays crisp).

- **Chord badges** from `keyChord` events: parse Playwright combo syntax; modifiers rendered in canonical order **⌃⌥⇧⌘** regardless of written order (`"Shift+Meta+z"` → `⇧⌘Z`); named keys mapped (`Enter ↩, Backspace ⌫, Escape esc, Tab ⇥, Arrow* ←→↑↓, Delete ⌦, Space ␣`); bare-modifier presses produce no badge (the collapse mechanism). `symbols: "text"` renders `Ctrl+Shift+Z` for non-mac audiences. Repeat suppression: a chord identical to the previous one within **300 ms** refreshes that badge's clock instead of spawning (and gains a small `×2` count tag at 3+).
- **Typing pill** from `typeBurst`: ONE pill per burst — never per-letter badges. Appears at `t0` with the field's placeholder-style empty state, fills character-by-character on the real key cadence (mapped to output time), holds **900 ms** after the last key, then fades. Long text elides head (`…acme corporation`).
- **Envelope**: fade in 0.15 s, hold to `durationMs` (default 1500), fade out 0.3 s, both linear.
- **Pill geometry** (function of frame height, so it scales with resolution): `font = max(24, H × 0.03)` medium-weight system stack, white; `cornerRadius = font × 0.4`; `padH = font × 0.8`; `padV = font × 0.4`; background `rgba(26,26,26,0.75)`.
- **Stacking (the fix)**: one row anchored at `position` (default `[0.5, 0.90]`, bottom-center of the clip — the lower-third lives *below* the clip in the styled frame, so no collision). Newest badge takes the anchor; existing badges slide left with an 8 px gap (150 ms ease). Max 3 visible; a fourth evicts the oldest immediately. The typing pill occupies the anchor slot exclusively while active.

## Motion blur

Screenize's model (post-hoc directional blur from *timeline* velocity, not pixels), implemented as multi-draw accumulation since canvas 2D has no directional blur: when `panVelocity > 0.25 units/s` or `zoomVelocity > 1.0 /s` (from spring finite differences), compute `radiusPx = min((v − threshold) × 30 [pan] or × 8 [zoom], 10) × (camera.motionBlur / 0.35)`; skip below 2 px; draw the transformed frame `K = min(8, ceil(radius/2))` extra times along the previous→current transform delta with cosine-tapered alphas summing to 1. One decoded frame, K cheap draws — no extra seeks. Cursor and badges are composited after and never blurred. `motionBlur: 0` disables.

---

## Schema 3: config surface

```jsonc
{
  "capture": {
    "telemetry": true            // optional force; auto-on when any cinema key below is present
  },
  "video": {
    "camera": {                  // ABSENT => no camera pass, output identical to today
      "mode": "auto",            // "auto" (segment planner) | "follow" | "off"
      "intensity": 1.0,          // 0..2, scales (zoom-1) post-plan; 0 = flat camera
      "maxZoom": 2.2,            // 1..4
      "response": 0.35,          // seconds; pan spring period (advanced)
      "zoomResponse": 0.55,      // seconds (advanced)
      "motionBlur": 0.35,        // 0..2; 0 = off
      "holdLastFrame": true      // release to 1.0 during narration holds
    }
  },
  "style": {
    "cursor": {                  // presence enables the drawn cursor (works without camera)
      "show": true,
      "style": "auto",           // "auto" | "arrow" | "dot" | "none"
      "scale": 2.0,              // 0.5..6 (x 28 px base at 1920-width reference)
      "smoothing": 0.67,         // 0..2; 0 = raw path
      "clickBounce": 2.5,        // 0..5
      "color": null              // dot tint; null = accent
    },
    "clicks": {
      "effect": "ripple",        // "ripple" | "spotlight" | "none"
      "color": null,             // hex; null = style.accent
      "scale": 1.0,              // 0.5..2
      "opacity": 1.0,            // 0..1
      "durationMs": 600          // 120..1200
    },
    "keys": {
      "show": true,
      "chords": true,
      "typing": "pill",          // "pill" | "none"
      "symbols": "mac",          // "mac" | "text"
      "durationMs": 1500,        // 300..4000
      "position": [0.5, 0.90]    // normalized, in clip space
    }
  },
  "shots": [
    { "id": "a", "camera": "auto" },                       // default when video.camera present
    { "id": "b", "camera": "off" },                        // opt out (e.g. long scroll tours)
    { "id": "c", "camera": { "mode": "follow" } },
    { "id": "d", "camera": { "segments": [ /* schema 2 */ ] } }   // explicit override
  ]
}
```

**Precedence**: `shots[].camera` > `video.camera` > kind camera defaults (which apply **only once `video.camera` exists** — kinds tune, they never activate; that is the backward-compatibility line). Activation rule for the render pass per shot: `video.camera` present and shot not `"off"`, or `shots[].camera` set, or any of `style.cursor/clicks/keys` present.

**Kind camera defaults** (merged under the user's `video.camera`/`style.*` in `kinds.cjs`, same pattern as `styleForKind`):

| kind   | intensity | maxZoom | response | zoomResponse | motionBlur | clicks              | cursor.scale | feel |
|--------|-----------|---------|----------|--------------|------------|---------------------|--------------|------|
| report | 0.8       | 1.8     | 0.45     | 0.70         | 0.15       | spotlight, 0.8 op   | 1.8          | calm |
| demo   | 1.0       | 2.2     | 0.35     | 0.55         | 0.35       | ripple              | 2.0          | focused (the shipped constants) |
| ad     | 1.2       | 2.6     | 0.25     | 0.40         | 0.50       | ripple ×1.2 scale   | 2.2          | punchy |
| launch | 1.05      | 2.4     | 0.50     | 0.75         | 0.45       | spotlight           | 2.0          | cinematic |

**Validation** (`validate.cjs` additions, same collect-then-report style):
- Enums: `camera.mode`, `cursor.style`, `clicks.effect`, `keys.typing`, `keys.symbols`; per-shot `camera` is `"auto" | "off"` | object.
- Ranges as annotated above; `keys.position` a `[0..1, 0..1]` pair; `durationMs` bounds.
- Segments override: array of objects; each needs numeric `t0 < t1 ≥ 0`, `from`/`to` objects with `zoom ≥ 1`, `cx/cy ∈ [0,1]`; `zoom > maxZoom` warns (clamped), overlap/gap warns (normalized).
- Cross-key warnings: `shots[i].motion` ignored when that shot has camera enabled; `style.keys` without any `type`/`press` action in the config ("no key events will be recorded"); `shots[].camera` set while `video.camera` absent is fine (per-shot enable) — but warn if the shot is `type: "generated"` (camera never applies).
- `capture.telemetry` boolean.
- New top-level shapes appended to `TOP_LEVEL`-adjacent checks (they live under existing `video`/`style`/`capture` keys, so no new top-level entries).

**Backward compatibility contract**: no cinema keys → capture takes the exact current code path (slowMo 500, no sidecar), assemble/compose build the exact current filter graphs. The test suite pins this (Phase 5).

---

## Phase plan

Module layout: `lib/telemetry.cjs`; `lib/camera/{spring,plan,follow,render,index}.cjs`; compositor source `visuals/src/cinema/` → committed bundle `visuals/cinema/{cinema.html,compositor.js}` (served by `startVisualsServer`, which gains an extra-mount option so `/clips/` maps to the workDir); cursor art `assets/cursors/`; hooks in `capture.cjs`, `assemble.cjs`, `compose.cjs`, `validate.cjs`, `kinds.cjs`. New debug command `newsreel cinema --only <id>` (renders one shot's pass + prints the plan path).

**Phase 1 — Telemetry at capture.**
Build `lib/telemetry.cjs` (path synthesis, recorder, sidecar writer), instrument `runAction`, per-key typing loop, park move, explicit pacing + slowMo 0 under telemetry, `capture.telemetry` key, `dblclick` action, sidecar schema v1.
*Tests (dependency-free)*: path generator — monotone timestamps, exact endpoints, 60 Hz cadence, duration clamp `[0.25, 0.8]`, deterministic under fixed seed; event builder — normalization against layoutViewport (capture.zoom 0.8 case), sort order, schema shape; chord/burst event construction from action lists. If Playwright is present, an integration test captures one shot against a `data:` URL page with a button + input and asserts the sidecar has move→click→typeBurst with boxes; skipped otherwise (existing ffmpeg-skip pattern).
*Risks*: pacing change alters clip lengths for telemetry runs (accepted, gated); recordStart uncertainty (measured via `navSettledT` vs `firstContentTime` in this phase); `boundingBox()` returning null mid-animation (degrade to point).

**Phase 2 — Camera math + planner (pure).**
`spring.cjs` (analytic step, soft pushback, clampCenter), `plan.cjs` (intents → segments, merge/split/yo-yo/idle/release, output-time mapping), plan JSON writer/reader + override normalizer.
*Tests (pure, always run)*: spring — settles within ε of target by 3×response, no NaN at dt extremes, velocity continuity across segment boundaries, hold damping kills overshoot, clamp respected at every tick; planner goldens from synthetic sidecars — single click at a known box ⇒ expected zoom (coverage formula) and center (clamped), anticipation ≤ click time, travel clamp `[0.15, 0.8]`; two clicks 1 s / 0.05 apart ⇒ merged; corner click at zoom 2 ⇒ center (0.25, 0.25); yo-yo triple ⇒ middle deleted; trailing 2 s ⇒ release segment; trim/speed mapping (event at raw 3.0 s, trim 1.0, speed 2 ⇒ t_out 1.0).
*Risks*: feel tuning — mitigated by shipping the study constants verbatim and exposing only `intensity`/`response`.

**Phase 3 — The compositor + camera-only rendering, wired into assemble.**
Proxy transcode, `cinema.html` + `compositor.js` (video seek loop, camera transform, motion blur), screenshot→image2pipe encoder, content-hash cache, assemble integration (invoke per section post-narration; simplified filter chain for processed clips; degraded no-Playwright warning), `newsreel cinema` debug command.
*Tests*: extend `test/run.cjs` — synthesize a 4-quadrant color clip (lavfi, the harness already builds composite clips); fixed plan `zoom 2 @ (0.25, 0.25)` ⇒ render ⇒ `probeText` signalstats on the output frame asserts the top-left quadrant's luma fills the frame; `zoom 1` frame ⇒ luma matches source; hold-frame beyond clip end ⇒ last-frame luma persists; cache — second invocation with identical inputs performs no encode (mtime assert). Playwright+ffmpeg gated.
*Risks*: **this phase owns the hardest problem** (below); screenshot throughput (mitigations: JPEG, concurrency, cache); yuv color drift in assertions (assert luma bands, not exact RGB).

**Phase 4 — Cursor + click effects.**
Cursor SVGs, sprite raster cache, track interpolation, camera-relative spring, squash, ripple/spotlight, √zoom punch, `style.cursor/clicks` config + validation.
*Tests*: pure — spring constants for smoothing 0.67 ⇒ k≈358/c≈60.5/m≈1.40 (ζ≈0.855 ± 0.01); squash floor exactly 0.72 at bounce 3.5; ripple radius/alpha at p ∈ {1, 0.5, 0} match formulas. Pixel — `dot` cursor over a black clip at a known parked position ⇒ bright pixels in a 20×20 crop at the expected screen point (and at zoom 2, at the transformed point); ripple ⇒ ring luma present at computed radius at t = 300 ms, absent at t = 700 ms.
*Risks*: cursor lag/overshoot feel at 1.5–3× section speeds (envelopes run in output time by design; verify on a real capture); hover-state flicker from synthetic transits.

**Phase 5 — Keystroke badges + backward-compat pinning.**
Chord parser/formatter (canonical ⌃⌥⇧⌘, named-key map, text mode), typing pill, row stacking/eviction, `style.keys` config + validation; compose integration (processed clips into `public/`, data.json rewrite); the backward-compat test.
*Tests*: pure — `"Shift+Meta+z"` ⇒ `⇧⌘Z`; `"Control+Shift+T"` text mode ⇒ `Ctrl+Shift+T`; bare `"Meta"` ⇒ no badge; burst ⇒ exactly one pill with per-key reveal times; repeat chord within 300 ms ⇒ one badge; 4 chords ⇒ oldest evicted. Pixel — badge at (0.5, 0.90) ⇒ pill-shaped bright region in crop; badge unmoved between zoom 1 and zoom 2 frames (the overlay-after-transform assertion). Compat — a config with zero cinema keys ⇒ capture plan contains slowMo 500 and no sidecar; assemble's planned sections (speed/dur/clipStart) equal a pinned golden.
*Risks*: text width measurement stability across Chromium versions (use system font stack + generous padding); badge/lower-third collision if someone sets `position` low (validator warns below y 0.95).

**Phase 6 — Kinds, follow mode, polish.**
Kind camera tables in `kinds.cjs`; Mode A follow (`follow.cjs`: dead zone, hysteresis, adaptive look-ahead response); idle micro-drift; optional `capture.supersample: 2` (record at 2× viewport with DSF 2 so zooms magnify real pixels, not upscale); docs (`docs/rendering.md`, AGENT.md, example config), LOOKBOOK-style before/after clips.
*Tests*: kind resolution (demo defaults equal shipped constants; user keys win); dead-zone goldens (cursor inside safe zone ⇒ target unchanged; outside ⇒ target at zone edge with correction 0.45; hysteresis prevents chatter across ±0.01 oscillation); supersample ⇒ output still viewport-sized and even.
*Risks*: follow mode may read worse than segments on scripted content (ship behind the flag, judge on real captures — cuttable without loss); supersample doubles capture cost (opt-in only).

**The single hardest problem**: the deterministic, frame-exact, acceptably fast re-render loop — specifically seeking Playwright's VFR VP8 webm to exact output-frame times inside `<video>` while screenshotting at a rate that keeps a 6-shot video under ~3 minutes of camera work. Everything else is pure math with constants this document already fixes. The intra-only CFR proxy is the load-bearing mitigation (exact seeks, cheap decode, VFR normalized); the fallbacks, in order: mjpeg proxy + `requestVideoFrameCallback` verification, frame-sequence extraction served over the local HTTP server, and (last resort, authoring-time bundle) a WebCodecs demuxer like Recordly's — the architecture is unchanged under any of them.

---

## Steal list

| Algorithm / constant | Source (study-doc reference) | Lands in newsreel |
|---|---|---|
| Analytic spring step (both regimes, ω = 2π/response) | screenize `SpringDamperSimulator.swift:348-381` | `lib/camera/spring.cjs` |
| Camera constants ζ 0.90, response 0.35/0.55, 60 Hz→dt=1/fps | screenize `ContinuousCameraTypes.swift:102-164` | `lib/camera/spring.cjs` defaults / `video.camera` |
| `clampCenter` (`halfCrop = 0.5/zoom`) ≡ margin `1/(2·scale)` | screenize `ShotPlanner.swift:462-470`; recordly `focusUtils.ts:42-52` | `lib/camera/spring.cjs` (`clampCenter`) |
| Soft boundary pushback (overflow 0.03, stiffness 12) | screenize `SpringDamperSimulator.swift:277-318` | `lib/camera/spring.cjs` |
| Zoom sizing `zoom = 0.7 / (maxDim + 2×0.08)` | screenize `ShotPlanner.swift:166-228` | `lib/camera/plan.cjs` |
| Per-intent zoom ranges table | screenize `ShotPlanner.swift:537-554` | `lib/camera/plan.cjs` constants |
| Anticipation leads (click 0.15 s, typing 0.4 s, scroll 0.25 s) | screenize `IntentClassifier.swift:49-61` | `lib/camera/plan.cjs` |
| Merge rule (gap + distance) / continuation distance 0.20 | screenize `SegmentPlanner.swift:89-125`, `IntentClassifier.swift:34-38` | `lib/camera/plan.cjs` |
| Transition/hold split, travel clamp 0.15–0.8 s, min hold 0.1 s | screenize `SegmentPlanner.swift:140-280` | `lib/camera/plan.cjs` |
| Velocity carry across segments + hold damping ×0.3 | screenize `SegmentSpringSimulator.swift:64-102` | `lib/camera/spring.cjs` bake loop |
| Duration-scaled response `max(base, dur×0.40/0.45)` | screenize `SegmentSpringSimulator.swift:96-102` | `lib/camera/spring.cjs` bake loop |
| Yo-yo (zoom-out/in) optimizer thresholds 0.30/0.15/0.35/1.5 s | screenize `WaypointGenerator.swift:505-549` | `lib/camera/plan.cjs` |
| Idle inheritance with decay `1+(z−1)×0.5` | screenize `ShotPlanner.swift:89-102` | `lib/camera/plan.cjs` |
| Dead zone + hysteresis + smoothstep band (Mode A) | screenize `DeadZoneTarget.swift:40-141` | `lib/camera/follow.cjs` (Phase 6) |
| Adaptive response from look-ahead (0.20–0.50 s) | screenize `AdaptiveResponse.swift:11-45` | `lib/camera/follow.cjs` |
| Post-hoc zoom intensity `1+(z−1)×i` | screenize `ContinuousCameraGenerator.swift:113-125` | `camera.intensity`, `lib/camera/plan.cjs` |
| Click-cluster merge constants (2500/500 ms) as sanity bounds | recordly `zoomSuggestionUtils.ts:299-357` | cross-check for merge defaults in `plan.cjs` |
| Zoom strength envelope + `easeOutZoom = bezier(0.16,1,0.3,1)` | recordly `zoomRegionUtils.ts:37-72`, `mathUtils.ts:61-63` | not used for camera (springs won); kept as reference for compose card motion |
| Cursor spring config table (0.67 ⇒ k≈358, c≈60.5, m≈1.40) | recordly `motionSmoothing.ts:222-273` | `visuals/src/cinema/cursor.ts` (constants re-derived, see license note) |
| Cursor interpolation (binary search + lerp, skip-click shape rule) | recordly `cursorRenderer.ts:693-808` | `visuals/src/cinema/cursor.ts` |
| Camera-relative cursor smoothing | screenize `SpringCursorSimulator.swift:111-165` | `visuals/src/cinema/cursor.ts` |
| Seek-discontinuity snap (>100 ms) | recordly `cursorRenderer.ts:1400-1416` | `visuals/src/cinema/cursor.ts` |
| Cursor size `28 px × scale × max(0.55, W/1920)` (× zoom, post-transform) | recordly `cursorRenderer.ts:810-815`; screenize `EffectCompositor.swift:199-253` | `visuals/src/cinema/cursor.ts` |
| Arrow/I-beam/hand vector paths + hotspots + black-fill/white-stroke | screenize `CursorImageProvider.swift:158-166, 63-83` | `assets/cursors/*.svg` |
| Click squash `max(0.72, 1 − sin(pπ)·0.08·bounce)`, 350 ms | recordly `cursorRenderer.ts:1431-1434` | `visuals/src/cinema/cursor.ts` |
| √zoom punch-depth normalization | screenize `EffectCompositor.swift:10-22` | `visuals/src/cinema/cursor.ts` |
| Ripple / spotlight geometry + envelopes | recordly `cursorRenderer.ts:843-987` | `visuals/src/cinema/effects.ts` |
| Effect delay = bounce/2, anchored at click sample | recordly `cursorRenderer.ts:989-1023, 1357-1367` | `visuals/src/cinema/effects.ts` |
| Motion-blur trigger (pan 0.25/s, zoom 1.0/s), radius ×30/×8, cap 10 px, skip <2 px | screenize `TransformApplicator.swift:75-120`, `MotionBlurSettings.swift:6-65` | `visuals/src/cinema/blur.ts` (as multi-draw accumulation) |
| Cosine-tapered accumulation weights | recordly `temporalMotionBlur.ts:88-132` | `visuals/src/cinema/blur.ts` |
| Overlay-after-transform layering (cursor→badges never zoomed/blurred) | screenize `Renderer.swift:69-168`; recordly scene graph §6.6 | compositor draw order |
| Badge synthesis structure (modifier order ⌃⌥⇧⌘, nil-for-bare-modifier, repeat suppression) | screenize `KeystrokeTrackEmitter.swift:90-159` | `visuals/src/cinema/keys.ts` (chord logic redesigned; stacking fixed) |
| Pill geometry (`font = max(24, H×0.03)`, radius/pad ratios, bg 0.1@0.75) | screenize `EffectCompositor.swift:283-389` | `visuals/src/cinema/keys.ts` |
| Badge opacity envelope (linear 0.15 in / 0.3 out) | screenize `FrameEvaluator+Keystroke.swift:24-37` | `visuals/src/cinema/keys.ts` |
| Two-clock event schema idea + display-normalized coords | screenize `EventStream.swift:7-72`, `EventStreamWriter.swift:80-179` | sidecar `clock` block |
| Sidecar-next-to-video pattern, sorted/normalized samples | recordly `electron/ipc/utils.ts:66-68`, `cursor/telemetry.ts:32-81` | `<id>.events.json` writer |
| Held-frame CFR conversion | screenize `CFRFrameReader.swift:33-56` | the intra-only CFR proxy transcode |
| Cursor-style-from-element (replace native monitor with `getComputedStyle(el).cursor`) | recordly doc §15 "Needs re-derivation" | `lib/telemetry.cjs` |
| Content-time (not wall-clock) spring stepping | recordly `modernFrameRenderer.ts:3765-3803` | compositor frame loop |
| Catmull-Rom resample tension 0.2 + reflected endpoints (if path smoothing ever needed) | screenize `MousePositionInterpolator.swift:52-101, 177-203` | reserve for `lib/telemetry.cjs` path gen v2 |

License note: Screenize is Apache-2.0 — porting path data and constants is fine with attribution. **Recordly is AGPL-3.0 — no verbatim code may enter this MIT package.** Everything taken from it here is numeric constants and formulas re-implemented from the study document's math, which is the intended use of that document; keep it that way in review.

---

## Open questions

1. **Clock correction**: is `newPage()`-based recordStart (±~80 ms) good enough in practice, or should Phase 3 apply the `navSettledT` ↔ `firstContentTime` correction automatically? Decide from Phase 1 measurements on a real app capture.
2. **Generated scenes**: should the harness export its ghost-pointer path (`window.__NEWSREEL_EVENTS__` at teardown) so generated shots can get the drawn cursor + effects too? Cheap to add later; the sidecar schema already fits.
3. **Scroll tracking**: v1 records the wheel event only. A page-side rAF sampler of `scrollY` would let the camera track long scrolls (a `scrollTrack` event type). Worth it for demo kind?
4. **Supersampled capture** (`capture.supersample: 2`): recording at 2× viewport makes zooms genuinely sharp instead of upscaled. Should `launch` kind default to it despite the capture cost?
5. **Cursor motion blur** (Recordly's velocity-scaled sprite blur): skipped in v1 (springs at 30 fps read fine). Revisit if fast transits strobe.
6. **Follow mode's fate**: if Phase 6 evaluation shows segments beat follow on every scripted capture, delete `follow.cjs` rather than maintain two camera brains (Screenize's MicroTracker precedent: built, then made redundant).
7. **Default-on ambition**: once stable, should `video.kind` imply a camera default (breaking the "nothing activates implicitly" rule at a major version)? Today's answer is no; revisit after real-world use.
