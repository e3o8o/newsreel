# Recordly — Complete Feature Catalog with Implementation Notes

Source studied: `/Users/elemoghenekaro/Workspace/tasks/projects/recordly` @ `54ae801`, version `1.3.5-beta.2`, AGPL-3.0.
All paths below are repo-relative to that checkout.

Purpose of this document: extract the **algorithms and the data they consume** so the capabilities can be
re-implemented in `newsreel` (headless Playwright capture + ffmpeg/Remotion assembly). UI is ignored except
where it reveals the data model.

---

## 0. Architecture in ~10 lines

1. **Electron main** (`electron/main.ts`, `electron/ipc/**`) owns capture, native helper processes, file IO, project files, ffmpeg.
2. **Capture backends**: macOS ScreenCaptureKit helper (`electron/ipc/recording/mac.ts`), Windows WGC helper (`electron/native/wgc-capture`, `electron/ipc/recording/windows.ts`), Linux/legacy Electron `desktopCapturer` + `MediaRecorder` (`src/hooks/useScreenRecorder.ts`), ffmpeg `gdigrab`/`x11grab` fallback (`electron/ipc/recording/ffmpeg.ts`).
3. **Cursor telemetry** is captured *out of band* in main: a 33 ms poll of `screen.getCursorScreenPoint()` plus global mouse hooks via `uiohook-napi` (`electron/ipc/cursor/telemetry.ts`, `electron/ipc/cursor/interaction.ts`), plus a native "cursor shape" monitor process (`electron/ipc/cursor/monitor.ts`).
4. Telemetry is written as a JSON **sidecar** next to the video: `<video>.cursor.json` (`electron/ipc/utils.ts:66`).
5. **Renderer editor** (`src/components/video-editor/VideoEditor.tsx`, ~7k lines) holds all edit state as plain arrays of time-ranged regions; it is serialised verbatim into `.recordly` project files (`src/components/video-editor/projectPersistence.ts`).
6. **Preview** composites with **PixiJS v8** (WebGL/WebGPU) in `src/components/video-editor/VideoPlayback.tsx` + `src/components/video-editor/videoPlayback/**`.
7. **Export** re-uses the *same* scene code: `src/lib/exporter/modernFrameRenderer.ts` (4k lines) is the Pixi scene, driven frame-by-frame by `src/lib/exporter/modernVideoExporter.ts` (3.6k lines).
8. Decode is **WebCodecs** `VideoDecoder` fed by `web-demuxer` (`src/lib/exporter/streamingDecoder.ts`); encode is WebCodecs `VideoEncoder` muxed by **mediabunny** (`src/lib/exporter/muxer.ts`), or piped raw RGBA to a native ffmpeg encoder ("Breeze"), or fully offloaded to ffmpeg filtergraphs when the layout is static ("Lightning" / native-static-layout, `electron/ipc/nativeVideoExport.ts`).
9. **GIF** goes through `gif.js` web workers (`src/lib/exporter/gifExporter.ts`); **captions** through a bundled `whisper.cpp` runtime + ffmpeg `silencedetect` (`electron/ipc/captions/**`).
10. An **extension host** (`src/lib/extensions/extensionHost.ts`) lets JS plugins draw canvas render hooks at fixed pipeline phases in both preview and export.

Flow: `capture (native helper → .mp4/.webm + .cursor.json + .system/.mic audio sidecars)` → `editor state (regions)` → `per-frame Pixi composite` → `encode+mux`.

---

## 1. Recording metadata format

### 1.1 Cursor telemetry sidecar

File: `<videoPath>.cursor.json` — `electron/ipc/utils.ts:66-68`.

```jsonc
{
  "version": 2,                       // CURSOR_TELEMETRY_VERSION, electron/ipc/constants.ts:29
  "samples": [
    { "timeMs": 0,    "cx": 0.51, "cy": 0.33, "interactionType": "move",  "cursorType": "arrow" },
    { "timeMs": 1240, "cx": 0.62, "cy": 0.41, "interactionType": "click", "cursorType": "pointer" },
    { "timeMs": 1390, "cx": 0.62, "cy": 0.41, "interactionType": "mouseup" }
  ]
}
```

- `timeMs`: milliseconds **from recording start**, pause-compensated (`getCursorCaptureElapsedMs`, `electron/ipc/cursor/telemetry.ts:153-171`).
- `cx`/`cy`: normalised 0..1 **within the captured surface** (display bounds, or window bounds when recording a window — `getNormalizedCursorPoint`, `electron/ipc/cursor/telemetry.ts:173-217`; window bounds are re-polled every 250 ms in `electron/ipc/cursor/bounds.ts:251-265`).
- `interactionType`: `"move" | "click" | "double-click" | "right-click" | "middle-click" | "mouseup"`.
- `cursorType`: `"arrow" | "text" | "pointer" | "crosshair" | "open-hand" | "closed-hand" | "resize-ew" | "resize-ns" | "not-allowed"`.
- Types: `src/components/video-editor/types.ts:19-41` (`CursorTelemetryPoint`).

**Sample rate: 33 ms (~30 Hz)** — `CURSOR_SAMPLE_INTERVAL_MS = 33`, `electron/ipc/constants.ts:30`.
Cap: `MAX_CURSOR_SAMPLES = 60*60*30` (1 h @ 30 Hz), `electron/ipc/constants.ts:31`.

Sampling loop uses **recursive `setTimeout` with drift compensation** rather than `setInterval`, and resets the
baseline if it falls behind by a full interval so it never bursts to catch up
(`startCursorSampling`, `electron/ipc/cursor/telemetry.ts:295-324`).

Normalisation on write: clamp `cx/cy` to `[0,1]`, coerce bad `timeMs` to 0, whitelist enum values, **sort by `timeMs`** — `normalizeCursorTelemetrySamples`, `electron/ipc/cursor/telemetry.ts:32-81`.

### 1.2 Click / mouse events

`electron/ipc/cursor/interaction.ts:205-278`, via `uiohook-napi` global hook:
- `mousedown` → position sampled *at that instant* from `getNormalizedCursorPoint()`, not from the hook's own coords (except Linux, where hook coords feed a 1 s-fresh cache — `setLinuxCursorScreenPoint`).
- Button mapping: `normalizeHookMouseButton` (`:25-39`) — `2|39 → right`, `3|38 → middle`, else left.
- **Double-click detection is app-side**: previous left click within **350 ms** and within **0.04 normalized distance** ⇒ `"double-click"` (`:224-236`).
- `mouseup` pushes a sample with `interactionType: "mouseup"` (used later for drag/text-selection classification).

### 1.3 Cursor *shape* stream

A native helper binary prints lines `STATE:<cursorType>` on stdout; main parses and stores
`currentCursorVisualType`, which is then attached to every subsequent telemetry sample
(`electron/ipc/cursor/monitor.ts:24-51`, `pushCursorSample` at `electron/ipc/cursor/telemetry.ts:237-255`).
macOS + Windows only; Linux always `"arrow"`.

### 1.4 Other sidecars

| File | Contents | Source |
|---|---|---|
| `<video>.system.m4a` / `.system.wav` | system audio | `electron/ipc/constants.ts:23-27` (`COMPANION_AUDIO_LAYOUTS`) |
| `<video>.mic.m4a` / `.mic.wav` | microphone | same |
| `<base>.recordly-session.json` | `{version:2, videoFileName, webcamFileName, timeOffsetMs}` | `electron/ipc/project/session.ts:12-40` |
| `<base>-webcam.<ext>` | webcam track (fallback discovery if no manifest) | `electron/ipc/project/session.ts:89-120` |
| `<name>.recordly` | full project (see §7) | `src/components/video-editor/projectPersistence.ts` |

Note: audio tracks are deliberately **not muxed** into the video at record time ("keeping tracks separate",
`electron/ipc/recording/mac.ts:116-148`) — they stay as sidecars and are mixed at export.

---

## 2. ZOOM

### 2.1 Data model

`src/components/video-editor/types.ts:1-17`:

```ts
type ZoomDepth = 1|2|3|4|5|6;
interface ZoomFocus { cx: number; cy: number }        // normalized 0..1 inside the video content rect
interface ZoomRegion {
  id: string; startMs: number; endMs: number;
  depth: ZoomDepth;
  focus: ZoomFocus;
  mode?: "auto" | "manual";                            // "auto" ⇒ cursor-follow camera enabled
}
```

Depth → scale table (`src/components/video-editor/types.ts:608-615`):

```
1 → 1.25   2 → 1.5   3 → 1.8   4 → 2.2   5 → 3.5   6 → 5.0
```

`DEFAULT_ZOOM_DEPTH = 3` (manual), `DEFAULT_AUTO_ZOOM_DEPTH = 2` (auto-suggested) — `types.ts:617-618`.
So auto zooms land at **1.5×**.

### 2.2 Auto-zoom generation — click clustering

Everything lives in `src/components/video-editor/timeline/zoomSuggestionUtils.ts`.

**Algorithm (`buildInteractionZoomSuggestions`, `:359-439`):**
1. Normalise + sort telemetry (`normalizeCursorTelemetry`, `:106-171`).
2. Detect interaction candidates (`detectInteractionCandidates`, `:219-290`), then **keep only `source === "explicit"`** — i.e. real uiohook click events. Dwell heuristics are computed but *deliberately discarded* for suggestions (`:392-395`).
3. **Cluster clicks**: single-pass agglomeration where consecutive clicks within `CLICK_CLUSTER_MERGE_GAP_MS = 2500` ms extend the current cluster; otherwise flush and start a new one (`buildClickClusters`, `:299-357`). Cluster focus = focus of the **highest-strength click** in the cluster (fallback: centroid of all cluster clicks).
4. Region window = `[firstClickMs - 500, lastClickMs + 500]` (`CLICK_CLUSTER_PAD_MS = 500`, `:65`), clamped to `[0, totalMs]`.
5. Skip any window overlapping an already-reserved span (existing zooms); otherwise reserve it and emit.
6. Sort chronologically. Status enum: `"ok" | "no-telemetry" | "no-interactions" | "no-slots"`.

Emitted regions get `depth = DEFAULT_AUTO_ZOOM_DEPTH (2 → 1.5×)`, `mode: "auto"`, focus clamped by
`clampFocusToDepth` — `src/components/video-editor/VideoEditor.tsx:3851-3874` (`handleZoomSuggested`).

**Click strength** (used to pick the cluster's focus), `zoomSuggestionUtils.ts:232-249`:
```
double-click-like  1500
text-selection     1300
dropdown-open      1200
text-field-click   1100
click-like          900
```

**Post-click behaviour classifier** `classifyPostClickBehavior` (`:450-521`) — pure trajectory analysis on the telemetry:
- explicit `double-click` ⇒ `double-click-like`.
- find a `mouseup` within 3000 ms; if `duration ≥ 200 ms && |Δcx| > 0.03 && |Δcx| > 1.8·|Δcy|` ⇒ `text-selection`.
- take move samples in `(t+100ms, t+2000ms]`; fewer than 3 ⇒ `text-field-click`.
- `maxDist < 0.02` ⇒ `text-field-click`.
- net `Δcy > 0.03` and `Σ|Δcy| > 1.5·Σ|Δcx|` ⇒ `dropdown-open`.
- `Σ|Δcx| > 0.03` and `Σ|Δcx| > 1.8·Σ|Δcy|` ⇒ `text-selection`.
- else `click-like`.

These classes also **back-fill cursor shape** where the native monitor missed it: `text-selection` forces
`cursorType: "text"` over `[t-140, t+1200]`; `text-field-click`/`text-focus-like` over `[t-100, t+900]`;
detected drags (mouseup ≥160 ms later, distance > 0.015) force `"text"` (horizontal-dominant) or `"closed-hand"`
(`normalizeCursorTelemetry`, `:120-168`).

**Dwell detection** (present, used only for the heuristic candidate list) `detectZoomDwellCandidates` (`:173-217`):
split the sample stream wherever consecutive-sample distance exceeds `DWELL_MOVE_THRESHOLD = 0.02`; a run counts
as a dwell if its duration is in `[MIN_DWELL_DURATION_MS 450, MAX_DWELL_DURATION_MS 2600]`; focus = mean of the run,
strength = run duration, centre time = midpoint. Synthetic double-clicks are formed from dwell pairs with
`gap ≤ 450 ms && spatial gap ≤ 0.035 && both strengths ≤ 900` (`:264-287`).

**Auto-apply gate**: fresh recordings auto-run suggestions only if
`sourceWidth/sourceHeight >= MIN_FRESH_RECORDING_AUTO_ZOOM_SOURCE_ASPECT_RATIO = 1.2`
(`:43-60`) — i.e. don't auto-zoom portrait/square captures. Trigger is debounced 500 ms after preview-ready
(`VideoEditor.tsx:3876-3971`); if the aspect check later fails, all `mode === "auto"` regions are stripped (`:3952-3971`).

Manual placement guard (`src/components/video-editor/timeline/hooks/actions/useTimelineZoomActions.ts:42-100`):
default new-zoom length is `min(1000ms, totalMs)`; refuses to place if overlapping an existing zoom or if the gap to
the next zoom/clip edge is smaller than that.

### 2.3 Zoom envelope (strength curve over time)

`computeRegionStrength` — `src/components/video-editor/videoPlayback/zoomRegionUtils.ts:37-72`.

Constants (`videoPlayback/constants.ts` + `zoomRegionUtils.ts:11-14`):
```
TRANSITION_WINDOW_MS            = 1015.05          // default zoom-out duration
ZOOM_IN_TRANSITION_WINDOW_MS    = 1015.05 * 1.5 = 1522.575
ZOOM_OUT_EARLY_START_MS         = 500              // start easing out 500ms before region end
ZOOM_IN_OVERLAP_MS              = 1000             // region "reaches in" 1s before its start...
ZOOM_ANIMATION_LEAD_MS          = 200              // ...and the whole curve is read 200ms early
CHAINED_ZOOM_PAN_GAP_MS         = 1350             // regions closer than this are "connected"
CONNECTED_ZOOM_PAN_DURATION_MS  = 1000
```

Pseudo:
```
adjT       = t - 200
leadInStart= start + 1000 - 1522.575       (= start - 522.575)
zoomInEnd  = leadInStart + zoomInDurationMs
zoomOutStart = end - 500
if (zoomInEnd > zoomOutStart) both collapse to their midpoint    // short regions
leadOutEnd = zoomOutStart + zoomOutDurationMs

adjT < leadInStart || adjT > leadOutEnd  → 0
adjT < zoomInEnd    → easeOutZoom((adjT-leadInStart)/zoomInDurationMs)
adjT <= zoomOutStart→ 1
else                → 1 - easeOutZoom((adjT-zoomOutStart)/zoomOutDurationMs)
```

**Easing**: `easeOutZoom(t) = cubicBezier(0.16, 1, 0.3, 1, t)` — `videoPlayback/mathUtils.ts:61-63`.
That is the classic `easeOutExpo`-ish "Recordly" curve. The bezier solver is Newton (8 iters, 1e-6) then
bisection (10 iters) — `mathUtils.ts:15-50`. Also available: `easeOutExpo` (`1 - 2^(-7t)`), `smoothStep`,
`easeInOutCubic`, `easeOutCubic` (`mathUtils.ts:52-86`).

Named easing presets exist in the schema — `ZoomTransitionEasing = "recordly" | "glide" | "smooth" | "snappy" | "linear"`
(`types.ts:117`), defaults `recordly` for in/out and `glide` for connected (`types.ts:180-182`) — but in this build
the strings are only persisted/validated; the actual per-frame curve is always `easeOutZoom` + the spring.

Durations are user-tunable and clamped to `[60, 4000] ms` on load (`projectPersistence.ts:428-442`).
Defaults: `DEFAULT_ZOOM_IN_DURATION_MS = 1522.575`, `DEFAULT_ZOOM_OUT_DURATION_MS = 1015.05`,
`DEFAULT_ZOOM_IN_OVERLAP_MS = 500`, `DEFAULT_CONNECTED_ZOOM_GAP_MS = 1500`,
`DEFAULT_CONNECTED_ZOOM_DURATION_MS = 1000` (`types.ts:175-182`).

**Region arbitration** `findDominantRegion` (`zoomRegionUtils.ts:187-210`): evaluate strength for every region,
drop zeros, sort by strength desc then by later `startMs`, take the winner. There is no cross-fade between two
different regions — one wins per frame.

**Connected zooms** (`connectZooms`, default `true`): if `nextRegion.startMs - currentRegion.endMs <= 1350 ms`,
the pair is linked (`getConnectedRegionPairs`, `:78-101`). The outgoing region holds strength `1` instead of
easing out; after `transitionEnd = currentEnd + 200 + 1000`, the *next* region's focus/scale is held at strength 1
until it formally starts (`getConnectedRegionHold`, `:169-185`). Net effect: the camera **pans** between two
zoom targets instead of zooming out and back in.

### 2.4 Zoom → transform (the crop math)

`computeZoomTransform` — `src/components/video-editor/videoPlayback/zoomTransform.ts:401-432`:

```
focusStagePx = baseMask.origin + focus * baseMask.size   // baseMask = on-canvas rect of the video content
scale        = 1 + (zoomScale - 1) * progress
finalX       = stageCenterX - focusStagePxX * zoomScale
finalY       = stageCenterY - focusStagePxY * zoomScale
return { scale, x: finalX * progress, y: finalY * progress }
```
Applied as `cameraContainer.scale = scale; cameraContainer.position = (x, y)` — the *whole camera container*
(video + frame + cursor + annotations) is scaled, so overlays inside it inherit the zoom.

Inverse: `computeFocusFromTransform` (`:434-460`).

### 2.5 Edge clamping so the crop never leaves the frame

`src/components/video-editor/videoPlayback/focusUtils.ts`.

Valid focus range for a given scale (`getFocusBoundsForScale`, `:42-52`):
```
margin = 1 / (2 * zoomScale)
cx ∈ [margin, 1 - margin],  cy ∈ [margin, 1 - margin]
```
e.g. at 1.5× focus is confined to `[0.333, 0.667]`; at 5× to `[0.1, 0.9]`.
Hard clamp: `clampFocusToScale` (`:68-79`), applied to every region focus in `getResolvedFocus`
(`zoomRegionUtils.ts:74-76`).

**Soft clamp** `softenFocusToScale` (`:81-96`): near the boundary the focus is eased in with
`easeIntoBoundary(t) = -t³ + 2t²` over a softness band of `min(0.12, range*0.35)` — avoids the camera slamming
into the wall.

**Edge snap** `edgeSnapFocus` (`:115-137`): remaps cursor position through a clamped linear ramp so the camera
pins to the edge when the cursor is within `snapToEdgesRatio` of the border. With `0.25`:
cursor `[0,0.25] → 0`, `[0.25,0.75] → 0→1`, `[0.75,1] → 1`; the result is then mapped into the valid focus bounds.

### 2.6 Cursor-follow camera (why auto zooms feel alive)

`src/components/video-editor/videoPlayback/cursorFollowCamera.ts`.

Only for `region.mode !== "manual"` and only when `zoomClassicMode === false`
(`modernFrameRenderer.ts:3722-3739`). Constants: `SNAP_TO_EDGES_RATIO_MANUAL = 0.25`,
`SNAP_TO_EDGES_RATIO_AUTO = 0.25` (`:14-16`).

Algorithm (`computeCursorFollowFocus`, `:132-201`):
- `zoomStrength < 0.01` ⇒ reset state, return region focus.
- interpolate the cursor at `t` (linear between telemetry samples).
- once `zoomStrength >= 0.99` set `reachedFullZoom`; while zooming **out** (`reachedFullZoom && strength < 0.99`) the camera **freezes** at `frozenFocus` so the zoom-out doesn't drift.
- persistent camera centre with an **inner safe zone**: visible half-span `= 1/(2·max(1,zoomScale))`, safe-zone inset `= visibleSpan · safeZoneRatio`. If the cursor leaves `[focus - half + inset, focus + half - inset]` on an axis, the camera centre jumps to the cursor coordinate on that axis; otherwise it does not move (`recenterFocusWhenCursorLeavesSafeZone`, `:84-121`). Result clamped by `clampFocusToScale`.
- Backwards time (scrub) re-initialises.

The *smoothing* of that step target is done by the camera spring (§2.7), not here.

### 2.7 Camera spring (the actual per-frame motion)

`src/components/video-editor/videoPlayback/motionSmoothing.ts` — a **closed-form damped harmonic oscillator**
(`F = -kx - cv`), analytic for all three regimes, with `ζ = c/(2√(km))`, `ω₀ = √(k/m)`
(`resolveSpringPosition`, `:93-136`; `stepSpringValue`, `:138-220`).

Details worth copying:
- `clampDeltaMs` clamps dt to `[1, 80] ms`, fallback `1000/60` (`:67-73`).
- rest thresholds default `restDelta = 0.0005`, `restSpeed = 0.02`.
- **Overshoot guard**: for `ζ ≥ 1`, if the new value crossed the target, snap to target and zero velocity — prevents "jelly" wobble when the target itself moves every frame (`:184-193`).
- Velocity is derived analytically by forward-differencing the closed form with `ε = 0.0001` (`:195-205`).

`getZoomSpringConfig(smoothness = 0.5)` — `:275-307`:
```
scaled = clamp(smoothness,0,1) * 2
stiffness = 100 / scaled      // at 0.5 → 100
damping   = 21
mass      = 1.0 * scaled      // at 0.5 → 1.0
restDelta = 0.0005, restSpeed = 0.015
// ζ ≈ 1.05 — barely overdamped
smoothness == 0 → { stiffness 1000, damping 100, mass 1 }  (effectively instant)
```
`DEFAULT_ZOOM_SMOOTHNESS = 0.5` (`types.ts:154`) and it is **forced to the default on project load**
(`projectPersistence.ts:944`).

Per-project multipliers (clamped `[0.25, 3]`, `projectPersistence.ts:935-943`):
`cameraSpringStiffnessMultiplier = 1`, `cameraSpringDampingMultiplier = 1.13`, `cameraSpringMassMultiplier = 1.12`.

**Where it is applied** (`modernFrameRenderer.ts:3700-3810` `updateAnimationState`):
1. `findDominantRegion(zoomRegions, t, {connectZooms, zoomInDurationMs, zoomOutDurationMs})`.
2. If a region is active: `zoomScale = ZOOM_DEPTH_SCALES[depth]`; focus = cursor-follow focus (auto) or region focus (manual).
3. `projectedTransform = computeZoomTransform(...)` — the *ideal* transform for this frame.
4. Three independent springs (`scale`, `x`, `y`) chase that ideal, stepped with **content time delta** (`timeMs - lastContentTimeMs`), *not* wall clock, so export and preview agree regardless of render speed (`:3765-3803`).
5. `zoomClassicMode` bypasses the springs entirely and applies the raw eased transform.

### 2.8 Motion blur during camera moves

Two independent systems.

**(a) Velocity-based blur (preview + default export)** — `videoPlayback/zoomTransform.ts:90-557`.
Per frame it builds a quad from the previous and current transforms (`computeTransformQuad`, `:127-161`), then:
- classify the step as `"move"` or `"zoom"` (`classifyMotionMode`, `:289-322`) using pan velocity (px/s) and zoom velocity (`|ln(diag_now/diag_prev)| / dt`); both thresholds default `0`, so anything moving blurs; ties broken by which distance is larger.
- `fpsScale = (1/max(1/240, dt)) / 60` (`resolveFpsScale`, `:245-248`) so blur is frame-rate independent.
- **Directional blur** (`pixi-filters` `MotionBlurFilter`): `velocity = moveDelta * amount * fpsScale * (maxDirectionalBlurPx/41.8)`; `kernelSize = 13`; `offset = -|velocity| / 32`; suppressed below magnitude `0.01`.
- **Radial/zoom blur** (`ZoomBlurFilter`): `strength = |1 - diag_now/diag_prev| * amount * fpsScale * (maxRadialBlurStrength/1)`, `innerRadius 0`, `radius -1`. Its **centre is inferred geometrically**: take the 4 corner motion segments (prev corner → current corner), intersect the first two non-degenerate ones as infinite lines, clamp to ±1 stage size — that's the zoom origin (`inferZoomCenterFromQuads`, `:194-243`).
- `dt` clamped to `[1, 80] ms`.

Tuning defaults `DEFAULT_ZOOM_MOTION_BLUR_TUNING` (`types.ts:166-174`):
```
panVelocityThreshold  0        zoomVelocityThreshold  0
maxDirectionalBlurPx  41.8     maxRadialBlurStrength  1
panResponsePerSecond  11       zoomResponsePerSecond  9
zoomSafeZoneRadiusPx  6
```
`DEFAULT_ZOOM_MOTION_BLUR = 0.35` (`types.ts:155`), persisted range `[0,2]`.

**(b) Temporal (multi-sample) motion blur** — `src/lib/exporter/temporalMotionBlur.ts`, driver at
`modernFrameRenderer.ts:3068-3154`. Currently gated off by `TEMPORAL_ZOOM_MOTION_BLUR_ENABLED = false`
(`modernFrameRenderer.ts:105`) but fully implemented and the better algorithm for a headless renderer:
- Build a symmetric sample plan across a shutter window: `shutterWindowUs = frameDurationUs * shutterFraction`, `offsets = linspace(-w/2, +w/2, sampleCount)` (`buildTemporalSampleOffsetsUs`, `:88-105`).
- Weights: cosine taper `cos(normalizedDistance · π/2)` raised to `weightCurvePower = 1.2 + 0.9·amount`, plus a floor of `0.22`, normalised to sum 1 (`buildTemporalSamplePlanUs`, `:107-132`).
- Auto config from a single `amount ∈ [0,2]`: `sampleCount` ramps `3 → 5` (always odd), `shutterFraction` ramps `0.24 → 0.62` (`getTemporalMotionBlurConfig`, `:50-86`). Manual overrides allow `sampleCount ∈ [3,61]` (odd) and `shutterFraction ∈ [0.18, 3]`; defaults if overridden: `13` / `0.94`.
- Render: for each offset, re-render the *whole scene* at `t + offset` (cursor and background timelines offset too) and accumulate into a canvas with `globalCompositeOperation = "lighter"` and `globalAlpha = weight`. Overlays (captions/annotations) are excluded from the samples and composited once at the end.

---

## 3. CURSOR

### 3.1 Capture — see §1. Key points for a port

- Positions come from an **OS poll**, not from video frames. The screen recording never contains the real cursor (macOS SCK excludes it; Windows WGC + `ShowCursor(False)`; ffmpeg fallbacks use `-draw_mouse 0`).
- Cursor **hiding** on Windows is a brute-force `ShowCursor(False)` loop, up to 32 iterations, executed via an embedded Python `ctypes` snippet with a PowerShell `Add-Type`/P-Invoke fallback (`electron/cursorHider.ts:3-133`). Linux has no hiding (README "Limitations").
- The cursor is therefore **re-drawn on top of the footage** at render time — it is never baked in. This is the single most important architectural decision to copy.

### 3.2 Position interpolation

`interpolateCursorPosition` — `src/components/video-editor/videoPlayback/cursorRenderer.ts:693-731`:
binary search for the bracketing samples, **linear interpolation**, clamp at both ends. Duplicated verbatim in
`modernFrameRenderer.ts:3424-3485` (`getCursorPosition`) and `cursorLoopTelemetry.ts:12-47`.

Cursor **shape** at time t: `findLatestStableCursorType` (`cursorRenderer.ts:770-808`) — binary search then scan
backwards for the most recent sample that has a `cursorType` and is **not** a click event (clicks would flicker the
shape). Falls back to `"arrow"`.

Latest click: `findLatestInteractionSample` (`:750-768`) — reverse scan for the most recent click-family event ≤ t.

### 3.3 Smoothing (spring)

`SmoothedCursorState` — `cursorRenderer.ts:1028-1112`. Two independent springs (x, y) chasing the interpolated
target, stepped with the **video** time delta.

`getCursorSpringConfig(smoothing, tuning)` — `motionSmoothing.ts:222-273`. `smoothing ∈ [0, 2]`, split at `0.5`:

```
smoothing == 0            → { stiffness 1000, damping 100, mass 1, restDelta 1e-4, restSpeed 1e-3 }

smoothing ∈ (0, 0.5]      n = smoothing / 0.5
  stiffness = (760 - n*420) * 1.12      // DEFAULT_CURSOR_STIFFNESS_BOOST = 1.12 → 851.2 … 380.8
  damping   = 34 + n*24                 // 34 … 58
  mass      = 0.85 + n*0.55             // 0.85 … 1.40
  restDelta = 0.0002, restSpeed = 0.01

smoothing ∈ (0.5, 2]      n = (smoothing - 0.5) / 1.5
  stiffness = (340 - n*180) * 1.12      // 380.8 … 179.2
  damping   = 58 + n*22                 // 58 … 80
  mass      = 1.35 + n*0.45             // 1.35 … 1.80
```
Multipliers `stiffnessMultiplier / dampingMultiplier / massMultiplier` are each clamped to `[0.25, 3]` (`:29-36`).

**Defaults**: `DEFAULT_CURSOR_SMOOTHING = 0.67` (`types.ts:149`) ⇒ n = 0.1133 ⇒
`stiffness ≈ 358, damping ≈ 60.5, mass ≈ 1.40` ⇒ ζ = 60.5 / (2√(358·1.40)) ≈ **0.855** (slightly underdamped, so the
cursor eases past and settles). Preset multipliers on top of that (`cursorMotionPresets.ts`):
- `focused`: stiffness ×1.35, damping ×0.79, mass ×1.29 (zoom in/out 200 ms)
- `smooth`: stiffness ×0.92, damping ×1.36, mass ×1.29 (zoom in/out 1522.575 / 1015.05 ms)
Both share `cursorSize 2.5, cursorSmoothing 0.67, cursorMotionBlur 0.4, cursorClickBounce 3.5, cursorClickBounceDuration 350`.
`focused` is the default preset (`projectPersistence.ts:86`).

**Discontinuity handling** (`cursorRenderer.ts:1400-1416`): if `|t - lastRenderedT| > CURSOR_TIME_DISCONTINUITY_MS = 100`
(a seek), the spring **snaps** instead of animating. Same on `freeze` and on backwards time.

### 3.4 Size scaling

`cursorRenderer.ts:810-815, 1347-1349, 1435`:
```
REFERENCE_WIDTH = 1920
MIN_CURSOR_VIEWPORT_SCALE = 0.55
viewportScale = max(0.55, viewport.width / 1920)
h = dotRadius * viewportScale                       // dotRadius default 28 (DEFAULT_CURSOR_CONFIG)
scaledH = h * getCursorStyleSizeMultiplier(style)
```
The exporter passes `dotRadius = 28 * cursorSize` (`modernFrameRenderer.ts:597`). `DEFAULT_CURSOR_SIZE = 3.0`
(`types.ts:148`); preset value `2.5`; persisted range `[0.5, 10]` (`projectPersistence.ts:841-843`).
Style multiplier: `tahoe = 1`, `macos = (851/958)/(386/746) ≈ 1.717` — derived from the non-shadow pixel bounds of
each pointer asset (`uploadedCursorAssets.ts:24-32, 80-91`).

**Important**: `viewport.width` is the *on-canvas video content rect* (`maskRect`), so the cursor scales with the
video's rendered size — but **not** with zoom, because the cursor lives inside `cameraContainer` and inherits the
camera scale. At 2× zoom the cursor is drawn 2× larger on screen, matching real optics.

### 3.5 Custom cursor rendering

Cursors are SVG assets rendered as Pixi sprites (preview/export) or `drawImage` on a 2D context
(`drawCursorOnCanvas`, `cursorRenderer.ts:1625-1701`).

- Styles: `"macos" | "tahoe" | "tahoe-inverted"` (stateful — one asset per `cursorType`), `"dot" | "figma"` (single asset), plus extension-contributed packs (`types.ts:58`). Default `"tahoe"`.
- Asset filenames encode the **hotspot as a percentage**: `pointer-1__14-6.svg` ⇒ anchor `(0.14, 0.06)` (`uploadedCursorAssets.ts:42-78`). Sprite `anchor` is set to that, so `position` = the true hotspot.
- Aspect ratio preserved: `width = height * asset.aspectRatio`.
- **Alpha trimming**: loaded bitmaps are cropped to their alpha bounding box and the hotspot re-derived, so padded SVGs don't offset the pointer (`trimCanvasToAlpha`, `:352-457`).
- **Shadow**: a duplicate tinted sprite drawn behind, `color 0x000000`, `alpha 0.35`, offset `(0, +2)`, Pixi `BlurFilter` `blur 3, quality 4, padding 12` (`:120-125, 1172-1184`). The 2D-canvas path instead uses `ctx.filter = "drop-shadow(0px 2px 3px rgba(0,0,0,0.35))"` (`:119, 1690-1692`). The `figma` style skips the separate shadow.
- Global alpha `dotAlpha = 0.95`.

### 3.6 Cursor motion blur

`applyCursorMotionBlur` — `cursorRenderer.ts:1559-1586`:
```
CURSOR_MOTION_BLUR_BASE_MULTIPLIER = 0.08
velocityScale = (1000 / dtMs) * motionBlur * 0.08
velocity      = (dx, dy) * velocityScale          // dx,dy in canvas px since last frame
magnitude     = hypot(velocity)
filter.velocity   = magnitude > 0.05 ? velocity : 0
filter.kernelSize = magnitude > 3 ? 9 : magnitude > 1 ? 7 : 5
filter.offset     = magnitude > 0.5 ? -0.25 : 0
```
`DEFAULT_CURSOR_MOTION_BLUR = 0.4` (`types.ts:150`), range `[0,2]`. Disabled while frozen/seeking.

### 3.7 Cursor sway (tilt on fast movement)

`src/components/video-editor/videoPlayback/cursorSway.ts`:
```
CURSOR_SWAY_MAX_ROTATION      = π/18   (10°)
CURSOR_SWAY_SPEED_REFERENCE   = 1400   px/s
CURSOR_SWAY_VERTICAL_WEIGHT   = 0.65
CURSOR_SWAY_INTENSITY_SCALE   = 3
CURSOR_SWAY_SLIDER_SCALE      = 2      (UI slider 0..1 → value 0..2)

distance      = hypot(dx,dy)                 ; bail if < 0.01
speed         = distance / (clampDt/1000)
speedFactor   = clamp(speed / 1400, 0, 1)
directionBias = clamp((dx + dy*0.65) / distance, -1, 1)
rotation      = directionBias * speedFactor * (π/18) * sway * 3
```
The raw rotation is then **spring-smoothed** with a derived config
(`getCursorSwaySpringConfig`, `cursorRenderer.ts:817-836`): base = `getCursorSpringConfig(clamp(smoothing*0.7 + 0.18, 0.15, 2))`,
then `damping ×0.9`, `mass = max(0.55, mass*0.8)`, `restDelta 0.0005`, `restSpeed 0.02`.
`DEFAULT_CURSOR_SWAY = 0.4` (`types.ts:153`), range `[0,2]`.

### 3.8 Cursor visibility / crop projection

`projectCursorPositionToViewport` (`videoPlayback/cursorViewport.ts:21-57`): when the scene has a source crop,
`projected = (cursor - crop.origin) / crop.size`; if it falls outside `[0,1]` (± 1e-6) the cursor sprite is hidden,
but a click effect at a visible location can still render (`cursorRenderer.ts:1368-1392`).

`showCursor` toggles the overlay; `loopCursor` (below) is a separate mode.

### 3.9 Cursor loop mode

`src/components/video-editor/videoPlayback/cursorLoopTelemetry.ts` (317 lines). For loop-friendly exports it
synthesises a tail on the telemetry that returns the cursor to its **starting position**:
```
LOOP_CURSOR_FREEZE_DURATION_MS = 670    // hold at rest before returning
LOOP_CURSOR_RETURN_STEPS       = 20     // synthetic samples along the return path
LOOP_CURSOR_SETTLE_DURATION_MS = 120
CURSOR_TRAILING_MOVEMENT_EPSILON = 0.0015   // what counts as "still moving"
easing: easeOutQuint(p) = 1 - (1-p)^5
```
`findLastMovingSampleTime` reverse-scans for the last sample whose delta exceeded the epsilon. While loop mode is
on, auto zoom suggestions are disabled (`useTimelineZoomActions.ts:115-118`).

---

## 4. CLICK EFFECTS

Three styles + none: `CursorClickEffectStyle = "none" | "spotlight" | "ripple" | "echo"` (legacy `"burst"` maps to
`"echo"`) — `types.ts:61-79`. Defaults (`types.ts:62-66`):
```
DEFAULT_CURSOR_CLICK_EFFECT             = "none"
DEFAULT_CURSOR_CLICK_EFFECT_COLOR       = "#2563EB"
DEFAULT_CURSOR_CLICK_EFFECT_SCALE       = 1        (range 0.5 … 2)
DEFAULT_CURSOR_CLICK_EFFECT_OPACITY     = 1        (range 0 … 1)
DEFAULT_CURSOR_CLICK_EFFECT_DURATION_MS = 600      (range 120 … 1200)
```

### 4.1 Timing

`getCursorVisualState` — `cursorRenderer.ts:989-1023`:
```
age            = t - lastClick.timeMs
clickEffectDelay = clickBounceDuration * 0.5          // effect starts halfway through the bounce
effectAge      = age - clickEffectDelay
clickProgress  = (effectAge in [0, durationMs]) ? 1 - effectAge/durationMs : 0     // 1 → 0
clickBounceProgress = (age <= bounceDuration) ? 1 - age/bounceDuration : 0
```
Note `clickProgress` counts **down** from 1, so `reveal = 1 - clickProgress` counts up. Effect is anchored to the
**click sample's** position, not the smoothed cursor (`:1357-1367`).

### 4.2 Shapes (`drawClickEffectGraphics`, `:859-911`; canvas twin `drawClickEffectOnCanvas`, `:913-987`)

Common:
```
color        = parseInt(hex)
baseRadius   = max(12, cursorSize * 0.55 * effectScale)     // cursorSize = scaledH, the drawn cursor height
strokeWidth  = max(2, cursorSize * 0.08)
alpha        = clickProgress * effectOpacity
reveal       = 1 - clickProgress
```

**ripple** (`getExtensionStyleRippleMetrics`, `:843-857`) — a single expanding, fading ring:
```
eased  = 1 - clickProgress^3                 // 0 → 1, ease-out cubic on radius
fade   = clickProgress^3                     // 1 → 0, ease-in cubic on alpha
radius      = max(0.5, eased * cursorSize * 1.95 * effectScale)
alpha       = clamp(fade * 0.6 * effectOpacity, 0, 1)
strokeWidth = max(1, 2 * fade)
```

**spotlight** — two concentric shrinking rings (a converging "focus" gesture):
```
glowRadius  = baseRadius + reveal * cursorSize * effectScale
innerRadius = max(baseRadius*0.72, glowRadius*0.76)
stroke glow : width max(1.25, strokeWidth*0.68), alpha*0.28
stroke inner: width max(1.5,  strokeWidth*0.75), alpha*0.5
```

**echo** — two rings plus a filled dot:
```
outerRadius = baseRadius + reveal * cursorSize * 1.22 * effectScale
innerRadius = max(baseRadius*0.58, outerRadius*0.62)
stroke outer: strokeWidth,                alpha*0.72
stroke inner: max(1.4, strokeWidth*0.72), alpha*0.42
fill  dot   : radius max(3, baseRadius*0.18), alpha*0.14
```

### 4.3 Click bounce (the cursor squashes)

`cursorRenderer.ts:1431-1434`:
```
bounceScale = max(0.72, 1 - sin(clickBounceProgress * π) * (0.08 * clickBounce))
sprite.height = scaledH * bounceScale ; sprite.width = scaledH * bounceScale * aspect
```
A half-sine over the bounce window — shrink then recover. `DEFAULT_CURSOR_CLICK_BOUNCE = 2.5` (`types.ts:151`,
preset uses `3.5`), range `[0,5]`; `DEFAULT_CURSOR_CLICK_BOUNCE_DURATION = 350 ms` (`types.ts:152`), range `[60,500]`.
With bounce 3.5 the max shrink is `1 - 0.08*3.5 = 0.72` — exactly the floor.

### 4.4 Extension-driven click effects

`notifyCursorInteraction` (`src/lib/extensions/renderHooks.ts:205-222`) pushes `{timeMs, cx, cy, interactionType}`
into a live list; each frame `executeExtensionCursorEffects` (`:228-271`) calls every registered effect with
`elapsedMs` until it returns `false` or `MAX_EFFECT_DURATION_MS = 2000` elapses. The exporter feeds it from
telemetry within a 100 ms window of the current frame (`modernFrameRenderer.ts:3487-3527`).

---

## 5. KEYSTROKE OVERLAY

**Not implemented in this build.** There is a typed hole for it and nothing fills it:

- API surface exists: `getKeystrokesInRange(startMs, endMs): Array<{timeMs, key, modifiers: string[]}>` — `src/lib/extensions/types.ts:513-525`, implemented at `src/lib/extensions/extensionHost.ts:966-975`.
- Backing store: `private _keystrokeEvents: Array<{timeMs, key, modifiers}>` — `extensionHost.ts:180`, setter `setKeystrokeEvents` at `:527-529`.
- **`setKeystrokeEvents` has zero call sites in the repo** (verified by grep). So the array is always empty and any extension-built ⌘C badge would render nothing.
- `uiohook-napi` is already loaded and would provide `keydown`/`keyup` globally (`electron/ipc/cursor/interaction.ts:187-200` only subscribes `mousedown`/`mouseup`/`mousemove`), so the capture side is one `hook.on("keydown", …)` away.

Implication for newsreel: there is **no algorithm to port here** — chord grouping, badge layout, hold/repeat
suppression, and timing all have to be designed fresh. The only inherited contract is the event shape
`{ timeMs, key, modifiers[] }` and the "query by time range" access pattern.

---

## 6. BACKGROUND / FRAME

### 6.1 Padded layout (the core geometry)

`computePaddedLayout` — `src/components/video-editor/videoPlayback/layoutUtils.ts:41-142`. This is the function
newsreel needs most.

```
PADDING_SCALE_FACTOR = 0.2          // padding slider 0..100 maps to 0..20% of canvas per side
BASE_PREVIEW_WIDTH/HEIGHT = 1920 x 1080

padFrac(side) = clamp(percent, 0, max) / 100 * 0.2
availableFracW = 1 - leftPadFrac - rightPadFrac
availableFracH = 1 - topPadFrac - bottomPadFrac
maxDisplay = canvas * availableFrac

croppedVideo = video * crop.size
screenFrac   = 1 - insets.left - insets.right      // device-frame screen cutout
fullFrameVideo = croppedVideo / screenFrac
scale = min(maxDisplayW / fullFrameVideoW, maxDisplayH / fullFrameVideoH)   // contain-fit
```
Then `centerOffset` centres the *device frame* in the padded box, and `spriteX = centerOffset - crop.origin * fullVideoDisplay`
positions the untrimmed video sprite so the crop lands correctly.

**Asymmetric / advanced padding**: when `padding.linked === false`, vertical padding may exceed 100 up to
`ADVANCED_VERTICAL_PADDING_MAX = 250` (`types.ts:505`), and vertical placement switches to a directional formula
that slides the frame within the free vertical travel (`layoutUtils.ts:104-116`):
```
verticalTravel   = canvasH - fullFrameDisplayH
centeredOffsetY  = verticalTravel / 2
directionalY     = centeredOffsetY + ((topPct - bottomPct) / 250) * centeredOffsetY
frameOffsetY     = clamp(directionalY, 0, verticalTravel)
```
`DEFAULT_PADDING = {top:20, bottom:20, left:20, right:20, linked:true}` (`types.ts:515-521`) ⇒ 4% of the canvas per side.

### 6.2 Rounded corners — squircle, not a rounded rect

`src/lib/geometry/squircle.ts`. Superellipse with `SQUIRCLE_EXPONENT = 4.5`, tessellated at
`SQUIRCLE_SEGMENTS_PER_CORNER = 10` per corner (40 points total):
```
exponent = 2 / 4.5
p(θ) = ( cx + sign(cosθ)·r·|cosθ|^exp , cy + sign(sinθ)·r·|sinθ|^exp )
```
`radius` clamped to `min(w,h)/2`; radii ≤ 0.5 px degrade to a plain rectangle.
Three emitters: `getSquircleSvgPath`, `drawSquircleOnCanvas`, `drawSquircleOnGraphics` (Pixi mask).
Border radius is resolution-scaled: `scalePreviewBorderRadius = borderRadius * min(w/1920, h/1080)`
(`layoutUtils.ts:9-16`). Default `borderRadius = 12.5` (`projectPersistence.ts:953`).

### 6.3 Drop shadow — 3 stacked rasterised layers

`src/lib/exporter/shadowProfile.ts`:
```ts
VIDEO_SHADOW_LAYER_PROFILES = [
  { offsetScale: 12, alphaScale: 0.7, blurScale: 48 },
  { offsetScale:  4, alphaScale: 0.5, blurScale: 16 },
  { offsetScale:  2, alphaScale: 0.3, blurScale:  8 },
];
WEBCAM_SHADOW_LAYER_PROFILES = [ { offsetScale: 0.06, alphaScale: 1, blurScale: 0.22 } ];
getShadowFilterPadding(blur, offsetY) = ceil(max(0, blur*2 + |offsetY|))
```
Each layer at strength `s` renders the squircle silhouette in black with
`offsetY = offsetScale*s`, `alpha = alphaScale*s`, `blur = blurScale*s`
(`modernFrameRenderer.ts:3672-3698`). Webcam layers scale by `min(w,h)` of the bubble instead of absolute px
(`modernFrameRenderer.ts:2635-2653`).
Default `shadowIntensity = 0.67` (`projectPersistence.ts:900`).

### 6.4 Background sources

`setupBackground` — `modernFrameRenderer.ts:1149-1323`. Dispatch on the `wallpaper` string:
1. **Video wallpaper** (`.mp4/.webm/.mov/.mkv/.avi/.m4v`, `src/lib/wallpapers.ts:9`): decoded via `ForwardFrameSource` (WebCodecs) with an `HTMLVideoElement` fallback; loops.
2. **Image** (`file://`, `data:`, `/`, `http`): loaded and drawn **cover** (`drawSourceCoverToCanvas`).
3. **Solid** — starts with `#`: `fillRect`.
4. **Gradient** — `linear-gradient(...)` / `radial-gradient(...)`: regex-extract the params, split on `,`, skip `to …`/`…deg` tokens, and place each parsed colour at stop `index/(n-1)`. Linear is always **top→bottom** (`createLinearGradient(0,0,0,H)`); radial is centred with radius `max(W,H)/2`. Angles in the CSS string are ignored.
5. Anything else → `fillStyle = wallpaper`.
6. On any failure → black.

**Background blur**: `createPreblurredBackgroundCanvas` pre-blurs once at setup rather than per frame
(`:1401-1419`); `backgroundBlur` persisted range `[0, 8]`, default 0 (legacy `showBlur:true` → 2)
(`projectPersistence.ts:409-415`).

25 bundled wallpapers listed in `src/lib/wallpapers.ts:11-37` (Tahoe / Sequoia / Sonoma / Ventura macOS-style,
glassmorphism, one animated `wispysky.mp4`). Default `/wallpapers/tahoe-light.jpg`. Runtime discovery scans the
app's `wallpapers` directory and intersects with the curated list (`getAvailableWallpapers`, `:126-158`).

### 6.5 Device frames (browser chrome / bezels)

Frames are **extension contributions**, not built-ins (`ContributedFrame`, `src/lib/extensions/types.ts`);
`editor.frame` stores an id like `"recordly.frames/browser-dark"` (`projectPersistence.ts:130-131`).
A frame supplies either a raster `filePath` or a resolution-independent `draw(ctx, w, h)` plus
`screenInsets: {top,right,bottom,left}` as fractions of the frame. `setupFrame` (`modernFrameRenderer.ts:2127-2160`)
loads it; `updateFrameLayout` (`:3595-3670`) derives the frame rect from the video mask rect:
```
frameWidth  = screenWidth  / (1 - insets.left - insets.right)
frameHeight = screenHeight / (1 - insets.top  - insets.bottom)
frameX = maskRect.x - insets.left * frameWidth
```
`draw()` frames are rasterised to a canvas at the exact target size and cached until the size changes.

### 6.6 Scene graph / composite order

`modernFrameRenderer.ts:515-660` (`initialize`):
```
stage
├─ backgroundContainer            (wallpaper sprite, pre-blurred)
├─ cameraContainer                ← ZOOM/PAN APPLIED HERE (scale + position)
│   ├─ videoShadowLayers  (3)
│   ├─ videoEffectsContainer      (filterArea = full canvas; holds zoom+motion blur filters)
│   │   └─ videoContainer         (mask = squircle Graphics)
│   │       └─ video sprite
│   ├─ frameContainer             (device frame)
│   ├─ cursorContainer            (PixiCursorOverlay: click graphics, shadow sprites, cursor sprites)
│   └─ annotationContainer
└─ overlayContainer               ← NOT zoomed
    ├─ webcamRootContainer        (webcam shadow layers + masked webcam sprite)
    └─ captionContainer
```
So: **cursor and annotations zoom with the scene; webcam and captions do not.** Extension hook phases mirror this
split exactly (`post-video`/`post-zoom`/`post-cursor` inside the transform; `post-webcam`/`post-annotations`/`final`
outside — `EXTENSIONS.md` "Inside vs Outside the Scene Transform").

---

## 7. TIMELINE / EDITING MODEL

Everything is a flat array of **time-ranged regions with string ids**. No keyframes anywhere; the only continuous
curves are derived (zoom strength envelope, springs). This is exactly what a shot-script generator wants.

### 7.1 Project file (`.recordly`)

`src/components/video-editor/projectPersistence.ts:84-163`:
```jsonc
{
  "version": 1,                 // PROJECT_VERSION
  "projectId": "…",             // optional
  "videoPath": "/abs/path/recording-….mp4",
  "editor": { /* ProjectEditorState, all fields optional on read */ }
}
```
Legacy extension `.openscreen` is also accepted (`electron/ipc/constants.ts:5`).
`normalizeProjectEditor` (`:342-1111`) is a 770-line pure function that fills defaults and clamps every field —
it is effectively the schema spec. Atomic writes via `electron/ipc/project/atomicSave.ts`.

### 7.2 Region types

| Type | Fields | Where |
|---|---|---|
| `ZoomRegion` | `id, startMs, endMs, depth 1-6, focus{cx,cy}, mode?` | `types.ts:10-17` |
| `ClipRegion` | `id, startMs, endMs, speed, muted?, showSourceAudio?` | `types.ts:218-225` |
| `TrimRegion` | `id, startMs, endMs` (legacy; complement of clips) | `types.ts:212-216` |
| `SpeedRegion` | `id, startMs, endMs, speed ∈ {0.25,0.5,0.75,1.25,1.5,1.75,2}` | `types.ts:589-606` |
| `AnnotationRegion` | `id, startMs, endMs, type: text\|image\|figure\|blur, content, position{x,y}%, size{w,h}%, style{…}, zIndex, trackIndex?, figureData?, blurIntensity?, blurColor?` | `types.ts:445-461` |
| `AudioRegion` | `id, startMs, endMs, audioPath, volume, normalize?, trackIndex?` | `types.ts:527-535` |
| `CaptionCue` | `id, startMs, endMs, text, words?: [{text,startMs,endMs,leadingSpace?}]` | `types.ts:537-550` |
| `CropRegion` | `x, y, width, height` (all 0..1 of source) | `types.ts:491-503` |
| `WebcamOverlaySettings` | see §11 | `types.ts:129-146` |

All times are **integer milliseconds** (rounded on normalise). All spatial coords are normalised 0..1 except
annotation position/size which are **percent 0..100**.

### 7.3 Clips are the trim + speed model

`src/components/video-editor/types.ts:227-392`. A `ClipRegion` occupies `[startMs, endMs]` on the **timeline**
and consumes `[startMs, startMs + (endMs-startMs)*speed]` of the **source**:
```
getClipSourceEndMs(clip)               = startMs + displayDuration * speed
mapTimelineTimeToSourceTime(t, clips)  = clip.startMs + (t - clip.startMs) * speed
mapSourceTimeToTimelineTime(t, clips)  = clip.startMs + (t - clip.startMs) / speed
```
Times outside any clip snap to the **nearest clip boundary** (`clampToNearestClipBoundary`, `:253-277`).
`clipsToTrims` / `trimsToClips` (`:357-392`) convert between "kept segments" and "removed gaps".
`getTimelineDurationMs` = max of source duration and all clip ends.

Changing a clip's speed **rescales the zoom regions inside it** so the zooms stay on the same content:
`scaleFactor = oldSpeed/newSpeed`, `zoom.startMs → clip.startMs + (zoom.startMs - clip.startMs)*scaleFactor`
(`clipSpeedChange.ts:29-100`); blocked if it would overlap the next clip or cause zoom overlap.

### 7.4 Tracks / rows

`src/components/video-editor/timeline/core/constants.ts` + `model/timelineModel.ts:45-110`:
rows `row-zoom`, `row-clip`, `row-captions`, `row-source-audio`, and *indexed* rows
`row-annotation-<n>` / `row-audio-<n>` (from each region's `trackIndex`). `buildTimelineItems` flattens every
region array into a single `TimelineRenderItem[]` with `{id, rowId, span, label, variant}`. Drag/drop is
constrained so a region can only change row *within its own family* (`resolveDropRowId`, `:139-162`).

### 7.5 Undo/redo & dirty tracking

`editorHistory.ts` (snapshot stack over the whole editor state) and `projectDirtyState.ts`. Presets:
`editorPreferences.ts` persists a `PersistedEditorControls` subset to `recordly.editor.preferences` and named
presets to `recordly.editor.presets` (`:92-93`), each preset a full `EditorPresetSnapshot`.

---

## 8. EXPORT

### 8.1 Three routes

`src/lib/exporter/backendPolicy.ts:31-…`, `ExportBackendPreference = "auto" | "webcodecs" | "breeze"`,
`ExportPipelineModel = "modern" | "legacy"`.

| Route | What renders | What encodes | When |
|---|---|---|---|
| `native-static-layout` ("Lightning", beta) | **ffmpeg filtergraph only** | ffmpeg (`h264_nvenc` / D3D11 / CUDA compositor) | no zooms/cursor/annotations that need per-frame compositing, supported crop/speed |
| `breeze-stream` | PixiJS per frame → raw RGBA piped to ffmpeg | ffmpeg (`h264_videotoolbox` / `h264_nvenc` / `libx264`) | macOS/Windows default (`shouldPreferNativeAutoBackend`) |
| `webcodecs` | PixiJS per frame → `VideoFrame` | WebCodecs `VideoEncoder` + mediabunny mux | fallback / Linux |

Decode is always `StreamingVideoDecoder` — `web-demuxer` + `VideoDecoder`, **forward-only, no seeking**
(`src/lib/exporter/streamingDecoder.ts`, `decodeAll(frameRate, trimRegions, speedRegions, cb)` at `:195`).
It computes trim segments and splits them by speed, then emits `(videoFrame, exportTsUs, sourceTsMs, cursorTsMs)` —
note the **separate cursor timestamp**, so cursor animation stays on the source clock while output frames advance on
the timeline clock.

### 8.2 Native static-layout ffmpeg filtergraphs (most portable to newsreel)

`electron/ipc/nativeVideoExport.ts`. All of these produce the padded/rounded/shadowed "styled frame" **without a
canvas**:

- `buildNativeStaticBackgroundRenderArgs` (`:381-474`) — renders a **single background PNG** containing wallpaper + blur + the 3-layer shadow:
  - wallpaper: `scale=W:H:force_original_aspect_ratio=increase,crop=W:H,setsar=1,format=rgba`
  - blur: `gblur=sigma=min(96, blurPx):steps=2`
  - per shadow layer: `lut=y=val*alpha` on the mask, `pad` by `getShadowFilterPadding(blur, offsetY)` with the offset baked into `y`, `gblur=sigma=blur:steps=2`, `format=gray`, then `color=black` + `alphamerge`, then `overlay` at `(offsetX-padding, offsetY-padding)`.
- `createNativeSquircleMaskPgmBuffer` (`:220-263`) — rasterises the squircle to a **P5 PGM** alpha mask by point-in-polygon testing against `getSquirclePathPoints`. That mask is reused for both the shadow silhouette and the video corner rounding.
- `buildNativePrecompositedStaticLayoutArgs` (`:476-541`) — per chunk: CUDA-decode → `scale_cuda` to content size → `hwdownload` → `format=rgba` → `alphamerge` with the looped PGM mask → `overlay` onto the looped static background PNG → `format=yuv420p` → `h264_nvenc`.
- `buildNativeCudaOverlayStaticLayoutArgs` (`:316-346`) and `buildNativeCudaScaleCpuPadStaticLayoutArgs` (`:348-379`) — simpler colour-background variants (`overlay_cuda`, or `pad`).
- Work is chunked at `STATIC_LAYOUT_CHUNK_DURATION_SEC = 120` (`modernVideoExporter.ts:299`) and concatenated with `-f concat -c copy` (`buildNativeConcatArgs`, `:543-561`).
- Raw-frame input path: `-f rawvideo -pix_fmt rgba -s WxH -framerate N -i pipe:0 -vf vflip` (the `vflip` compensates for GL origin), GOP `= fps*5` (`buildNativeVideoExportArgs`, `:278-314`).

Encoder preference by platform (`:117-128`):
`darwin: [h264_videotoolbox, libx264]`, `win32: [h264_nvenc, h264_qsv, h264_amf, h264_mf, libx264]`,
`linux: [h264_nvenc, h264_qsv, libx264]`.
x264 presets by mode: `fast → ultrafast+zerolatency`, `balanced → medium`, `quality → slow` (`:130-140`).
Rate control: `-b:v B -maxrate 1.2B -bufsize 2*maxrate`, floor 1.5 Mbps (`:142-155`).

### 8.3 Resolution / fps / bitrate

`ExportMp4FrameRate = 24 | 30 | 60` (default 30). `ExportQuality = "medium" | "good" | "high" | "source"`
(default `"source"`). `src/lib/exporter/types.ts:173-211`.

Dimensions — `src/components/video-editor/exportDimensions.ts`:
- All dimensions forced **even** (`normalizeEvenDimension`, `:34-36`).
- `aspectRatio === "native"` ⇒ use the cropped source size verbatim; otherwise fit the target ratio inside the source's long/short sides (`calculateMp4SourceDimensions`, `:59-85`).
- Quality scale: `medium 0.6`, `good 0.75`, `high 0.9`, `source 1.0` (`calculateMp4ExportDimensions`, `:87-104`).
- Aspect presets: `native, 16:9, 9:16, 1:1, 4:3, 4:5, 16:10, 10:16` + arbitrary `W:H` custom (`src/utils/aspectRatioUtils.ts`).

Bitrate — `src/lib/exporter/exportBitrate.ts`:
```
base (quality != source): ≤720p → 10 Mbps ; ≤1080p → 20 Mbps ; else 30 Mbps
base (quality == source): >1440p → 80 ; >1080p → 50 ; else 30 Mbps
fpsMultiplier   = sqrt(max(1, fps/30))
modeMultiplier  = fast 0.1 | balanced 0.75 | quality 1
MIN_MP4_BITRATE = 2 Mbps
// native-static-layout additionally clamps into a floor/cap scaled by sqrt(W*H*fps / (1920*1080*30)):
floor: source 22 / high 16 / good 12 / medium 8  Mbps
cap:   source 36 / high 28 / good 20 / medium 14 Mbps
```

Muxing — `src/lib/exporter/muxer.ts`: mediabunny `Mp4OutputFormat`, either a `BufferTarget` (small outputs) or a
`StreamTarget` that writes **16 MiB chunks** over IPC to a main-process temp file
(`EXPORT_STREAM_CHUNK_BYTES = 16*1024*1024`, `:19`) — avoids multi-GB `ArrayBuffer`s in the renderer.
Result is `{tempFilePath}` or `{blob}` (`types.ts:147-165`).

### 8.4 GIF export

`src/lib/exporter/gifExporter.ts` — `gif.js` with:
```
workers = clamp(hardwareConcurrency - 1, 1, 8)
quality = 10, dither = "FloydSteinberg", background "#000000", transparent null
repeat  = loop ? 0 : 1
frameDelay = round(1000 / frameRate)
```
Frame rates `15 | 20 | 25 | 30` (default 15). Size presets `medium → maxHeight 720`, `large → 1080`,
`original → ∞`; downscale preserves aspect and forces even dimensions
(`calculateOutputDimensions`, `:107-131`; `GIF_SIZE_PRESETS`, `types.ts:213-217`).
It reuses the **legacy** `FrameRenderer` (`src/lib/exporter/frameRenderer.ts`), adding `renderer.getCanvas()` per
frame via `gif.addFrame(canvas, {delay, copy:true})`.

### 8.5 Progress model

`ExportProgress` (`types.ts:24-38`): `{currentFrame, totalFrames, percentage, estimatedTimeRemaining, renderFps,
renderBackend, encodeBackend, encoderName, phase: "preparing"|"extracting"|"finalizing"|"saving", renderProgress,
audioProgress}`. Rolling FPS over a 1 s window. Detailed timing telemetry in `ExportMetrics` (`:116-145`) —
decode loop / render / encode-wait / native write, peak queue sizes, finalisation stage breakdown.

---

## 9. AUDIO

### 9.1 Capture

- macOS: ScreenCaptureKit helper writes `system` and `mic` to separate `.m4a` files; requires macOS 14+; mic TCC is requested explicitly (`electron/ipc/register/recording.ts:680-735`).
- Windows: native WASAPI helper writes `.system.wav` / `.mic.wav` (`:494-517`).
- Fallback: browser `MediaRecorder` sidecar for the mic when native mic capture is unavailable (`microphoneFallbackRequired`, `:568-594`).
- Tracks are **never muxed at record time** — kept as sidecars (`electron/ipc/recording/mac.ts:116-148`).

### 9.2 Recording-time filters

`electron/ipc/recording/audioFilters.ts`:
```
WINDOWS_NATIVE_MIC_PRE_FILTERS      = ["adeclip=threshold=1"]
BROWSER_MIC_SIDECAR_BASE_FILTERS    = ["adeclip=threshold=1",
                                       "adeclick=w=40:o=75:t=3:b=2",
                                       "highpass=f=85", "lowpass=f=9500",
                                       "afftdn=nr=10:nf=-45:tn=1"]
BROWSER_MIC_SIDECAR_NO_AGC_GAIN     = ["speechnorm=p=0.92:e=12:c=2:r=0.0005:f=0.001",
                                       "alimiter=limit=0.92:level=0"]
default browser sidecar             = BASE + ["alimiter=limit=0.92:level=0"]
```
Comments record the reasoning: no automatic loudness normalization on native mic (it amplified headset noise);
Chromium AGC disabled because it caused crackle, level restored offline with bounded speech expansion + limiter.

### 9.3 A/V sync

`electron/ipc/recording/audioFilters.ts:31-142` (`getAudioSyncAdjustment`):
```
delta = videoDur - audioDur  (ms)
|delta| <= 20 ms      → none
delta < 0 (audio longer) → none   (anchor at start; trailing overrun trimmed downstream)
tempoRatio = clamp(audioDur/videoDur, 0.5, 2)
relative <= 3% or |delta| <= 1500ms → "tempo"
delta > MAX_AUDIO_SYNC_DELAY_MS (15000) → "pad"
else → "delay"
```
Applied as `adelay=D|D`, `apad=pad_dur=…`, chained `atempo` (decomposed into ≤2× / ≥0.5× stages by
`buildAtempoFilters`, `:6-29`), `volume=…`, and always terminated with
`aresample=async=1:first_pts=0, asetpts=PTS-STARTPTS` (`appendSyncedAudioFilter`, `:101-142`).
Pause segments are cut with a generated `aselect`-style filter (`buildPausedAudioFilter`, `:191-…`).

### 9.4 Export audio routing

`src/lib/exporter/audioRoutingEngine.ts` — `buildResolvedAudioPlan` resolves a set of `ResolvedAudioTrack`
`{id, kind: user|system|mic|mixed|embedded, sourceRef{path,startDelayMs}, gain, timelineBinding{startMs,endMs}}`.
Track kind is inferred from the filename (`.mic.` / `.system.` / else mixed, `:32-37`). If dedicated system/mic
sidecars exist, the embedded track is muted in preview and excluded from export. Gains clamp to `[0,2]` for source
tracks, `[0,1]` for user regions and master. `normalize` applies `SOURCE_AUDIO_NORMALIZE_GAIN`.

Export-side audio modes (`electron/ipc/nativeVideoExport.ts:14-17`):
`"none" | "copy-source" | "trim-source" | "edited-track"`; the edited track is either a filtergraph fast path
(`buildEditedTrackSourceAudioFilter`, `:623-702`, tempo limited to `[0.5, 2]`) or an offline Web Audio render in
the renderer (`src/lib/exporter/audioEncoder.ts`, 1.8k lines) when speed regions / multiple regions make the
filtergraph impractical (`editedTrackStrategy.ts`).

Waveforms for the timeline are generated in a worker with a cache
(`src/components/video-editor/audio/waveform/{WaveformGenerator.ts, waveform.worker.ts, waveformCache.ts}`),
default 2048 peaks (`timeline/core/constants.ts:12`).

---

## 10. CAPTIONS

Pipeline: extract audio → **whisper.cpp** (bundled runtime, `ggml-small.bin` downloaded from HuggingFace,
`electron/ipc/constants.ts:19-22`) → parse → **re-segment on real silence**.

`electron/ipc/captions/silence.ts`:
```
SILENCE_NOISE_DB       = -30      // ffmpeg silencedetect noise floor
SILENCE_DETECT_MIN_S   = 0.5      // minimum silence ffmpeg reports
DEFAULT_SPLIT_SILENCE_MS = 1500   // pause length that actually breaks a phrase
DEFAULT_EDGE_PAD_MS      = 80     // padding kept around each phrase
DEFAULT_MIN_SPEECH_MS    = 150    // shorter speech regions dropped as artifacts
```
Rationale in the file header: Whisper breaks on its own internal boundaries, not on real pauses, so cues cover
silence and continuous speech gets chopped. Re-segmenting against ground-truth silence also **drops
hallucinations** (a region with no speech disappears).

Rendering — `src/lib/exporter/captionRenderer.ts` + `src/components/video-editor/captionStyle.ts`:
```
CAPTION_FONT_WEIGHT = 400 ; CAPTION_LINE_HEIGHT = 1.32
referenceWidth = 1920 * (62/100)                       // DEFAULT maxWidth = 62%
fontSize = max(14, settings.fontSize * (containerW*maxWidth% / referenceWidth))
padding  = { x: fontSize*1.1, y: fontSize*0.78 }
radius   = boxRadius * (fontSize / 30)
centerY  = H - H*bottomOffset/100 - boxHeight/2
box      = squircle, fill rgba(0,0,0,backgroundOpacity)
```
Defaults (`types.ts:571-585`): `fontSize 30, bottomOffset 3%, maxWidth 62%, maxRows 1, animationStyle "fade",
boxRadius 17.5, textColor #FFFFFF, inactiveTextColor #A3A3A3, backgroundOpacity 0.9`.
Animations: `none | fade | rise | pop`, enter/exit both `CAPTION_ENTER_MS = 180` and symmetric
(`captionLayout.ts:61-65`); phrases break at `CAPTION_BLOCK_GAP_BREAK_MS = 500`.
Per-word highlighting is **implemented but disabled** — `getCaptionWordVisualState` always returns
`{isInactive:false, opacity:1}` because "word-level timings from the transcriber are unreliable"
(`captionStyle.ts:50-57`). Word-level layout, paging and per-word timing fallback (`flattenCaptionWords`,
`captionLayout.ts:155-217`) all still exist.

Caption sidecar export (SRT/VTT) via `electron/ipc/register/exportCaptionSidecars.ts`.

---

## 11. WEBCAM OVERLAY

`WebcamOverlaySettings` — `types.ts:129-146`; math in `src/components/video-editor/webcamOverlay.ts`.

```
DEFAULT_WEBCAM_SIZE 40 (% of min(containerW, containerH), range 10..100)
DEFAULT_WEBCAM_CORNER_RADIUS 90 (range 0..160)
DEFAULT_WEBCAM_SHADOW 0.67 (0..1)
DEFAULT_WEBCAM_MARGIN 24 (0..96)
DEFAULT_WEBCAM_REACT_TO_ZOOM true
MIN_WEBCAM_OVERLAY_SIZE_PX 56
mirror default true
```
- Size: `min(W,H) * size% * zoomScaleFactor`, clamped to `[56, min(W,H) - 2*margin]` (`:56-79`).
- **React to zoom**: `scaleFactor = reactToZoom ? 1/zoomScale : 1` (`:51-54`) — the bubble shrinks as the camera zooms in so it keeps a constant *apparent* size relative to the un-zoomed frame.
- Position: 9 presets + `custom`; preset → unit anchor `(0..1, 0..1)` (`:9-33`), final `pos = margin + availableSpace * anchor` (`:118-155`).
- Crop: normalized `CropRegion` on the webcam source, with an aspect-matching helper that adjusts the height % so a cropped bubble isn't distorted (`getCropMatchedWebcamHeightPercent`, `:198-231`).
- Mask: squircle; shadow: single scaled layer (§6.3).
- Time alignment: `timeOffsetMs` from the recording session manifest; `getWebcamMediaTargetTimeSeconds` in `src/lib/mediaTiming.ts`.

---

## 12. ANNOTATIONS

`src/lib/exporter/annotationRenderer.ts` (513 lines) + `src/components/video-editor/AnnotationOverlay.tsx`.
Types: `text | image | figure | blur` (`types.ts:394`).

- Coordinates are **percent of a 1920×1080 reference** (`BASE_PREVIEW_WIDTH/HEIGHT`, `types.ts:396-397`), scaled at render time by `calculateAnnotationScaleFactor()`.
- Text style defaults (`types.ts:473-483`): `#ffffff`, transparent bg, `fontSize 32`, `"SF Pro Display"`, bold, center, `borderRadius 8`. Custom fonts supported (`src/lib/customFonts.ts`, `AddCustomFontDialog.tsx`).
- `figure` = arrow, 8 directions, `DEFAULT_FIGURE_DATA = {arrowDirection:"right", color:"#2563EB", strokeWidth:4}` (`types.ts:485-489`); SVG paths in `ArrowSvgs.tsx` parsed by `parseSvgPath` (`annotationRenderer.ts:121-144`).
- `blur` = privacy redaction, `BLUR_ANNOTATION_STRENGTH = 20` (range 1..100), composited through a separate CPU path (`composeBlurAnnotationFrame`, `modernFrameRenderer.ts:1545-1584`) because it needs pixel readback.
- `zIndex` + `trackIndex` for stacking and timeline row assignment.

---

## 13. EXTENSION SYSTEM (render-hook API)

`EXTENSIONS.md`, `src/lib/extensions/**`, `electron/extensions/**`.

Manifest `recordly-extension.json` (`id, name, version semver, description, main, permissions[], contributes?`);
permissions gate `render | cursor | audio | timeline | ui | assets | export`.

**Render hook phases** (dispatched identically in preview and export):
`background` (reserved), `post-video`, `post-zoom`, `post-cursor` (all inside the camera transform),
`post-webcam`, `post-annotations`, `final` (outside).

`RenderHookContext` gives `{width, height, timeMs, durationMs, cursor{cx,cy,interactionType}, smoothedCursor{cx,cy,trail[]},
ctx: CanvasRenderingContext2D, videoLayout{maskRect, borderRadius, padding}, zoom{scale, focusX, focusY, progress},
sceneTransform{scale,x,y}, shadow{enabled,intensity}}` plus scene colour sampling helpers:
`getPixelColor`, `getAverageSceneColor`, `getEdgeAverageColor(edgeWidth=4)`,
`getDominantColors(count=5)` — the last quantises to **5 bits/channel** and buckets by
`(qr<<10)|(qg<<5)|qb` on a strided grid (`src/lib/extensions/renderHooks.ts:101-137`). Handy for
"pick an accent colour from the footage".

Cursor coordinates handed to extensions are re-normalised from *video space* to *canvas space* via
`mapCursorToCanvasNormalized` (`src/lib/extensions/cursorCoordinates.ts:28-63`):
`pixel = maskRect.origin + cursor * maskRect.size ; normalized = pixel / canvasSize`.

Extensions can also contribute frames, wallpapers, cursor styles, sounds, settings panels, and can draw Phosphor
icons via `api.drawIcon(ctx, name, x, y, size, color, weight)`.

---

## 14. MISCELLANEOUS FEATURES

- **Countdown** before recording — full-screen overlay window, 180×180 rounded card, `rgba(0,0,0,0.85)` + `backdrop-filter: blur(20px)`, 100 px numerals, Escape/click cancels (`src/components/countdown/CountdownOverlay.tsx`).
- **Recording HUD** — floating always-on-top bar with mouse pass-through regions (`src/components/launch/hudMousePassthrough.ts`, `hudViewportBounds.ts`, `electron/hudOverlayBounds.ts`), floating webcam preview bubble (`floatingWebcamPreview.ts`).
- **Pause/resume** — telemetry clock compensates (`pauseCursorCaptureAtBoundary`, `resumeCursorCapture`, `electron/ipc/cursor/telemetry.ts:121-171`); audio pause segments cut with ffmpeg filters.
- **Auto-recording retention** — `AUTO_RECORDING_RETENTION_COUNT = 20`, `AUTO_RECORDING_MAX_AGE_MS = 14 days` (`electron/ipc/constants.ts:15-16`), pruned by `electron/ipc/recording/prune.ts`.
- **Local media HTTP server** (`electron/mediaServer.ts`) so `<video>` can load local files despite Chromium `file://` restrictions; `resolveVideoUrl` prefers it, falls back to a `file://` URL (`projectPersistence.ts:320-330`).
- **Presets/themes** — editor presets (§7.5), cursor motion presets (`cursorMotionPresets.ts`), light/dark theme (`src/contexts/ThemeContext.tsx`).
- **Shortcuts** — configurable, persisted to `shortcuts.json` (`src/lib/shortcuts.ts`, `src/contexts/ShortcutsContext.tsx`).
- **i18n** — 11 locales (`src/i18n/locales/*`), checked by `scripts/i18n-check.mjs`.
- **Auto-update** — `electron-updater` (`electron/updater.ts`) with a custom toast window.
- **Scene transitions** — none. There is no cross-fade/wipe between clips; adjacent clips butt-join. The only "transition" is the connected-zoom pan (§2.3).

---

## 15. WHAT TRANSFERS TO A HEADLESS PIPELINE

### Directly liftable (pure functions, no DOM, no OS)

| Algorithm | File | Note |
|---|---|---|
| Click clustering → zoom windows | `timeline/zoomSuggestionUtils.ts:299-439` | newsreel already knows *where* it clicked via Playwright; feed synthetic click events with element-centre focus and the same 2500/500 ms constants. |
| Post-click behaviour classifier | `zoomSuggestionUtils.ts:450-521` | Useful to pick zoom depth/duration per interaction *kind*. Playwright can supply the kind directly (`fill` vs `click` vs `selectOption`), which is strictly better than inferring it from a trajectory. |
| Zoom strength envelope | `videoPlayback/zoomRegionUtils.ts:37-72` | The whole lead-in/hold/lead-out envelope with `ZOOM_ANIMATION_LEAD_MS 200`, `ZOOM_IN_OVERLAP_MS 1000`, `ZOOM_OUT_EARLY_START_MS 500`. |
| `easeOutZoom = cubicBezier(0.16, 1, 0.3, 1)` + solver | `videoPlayback/mathUtils.ts:15-63` | ~40 lines, zero deps. |
| Focus clamping (`margin = 1/(2·scale)`), soft clamp, edge snap | `videoPlayback/focusUtils.ts` | This is the "crop never leaves the frame" guarantee. Essential. |
| `computeZoomTransform` / `computeFocusFromTransform` | `videoPlayback/zoomTransform.ts:401-460` | Trivially becomes an ffmpeg `crop=w:h:x:y` per frame, or a Remotion transform. |
| Closed-form spring solver + overshoot guard | `videoPlayback/motionSmoothing.ts:93-220` | Deterministic given a fixed dt — perfect for offline rendering. Use dt = 1/fps. |
| Spring config tables (cursor + camera) | `motionSmoothing.ts:222-307` | Copy the constants verbatim; they are tuned. |
| Cursor-follow camera safe-zone recentre | `videoPlayback/cursorFollowCamera.ts:84-201` | Needs a cursor track; newsreel can synthesise one from Playwright mouse moves. |
| Cursor interpolation + shape resolution | `videoPlayback/cursorRenderer.ts:693-808` | Binary search + lerp; the "skip click events when resolving shape" rule matters. |
| Click effect geometry (ripple/spotlight/echo) | `cursorRenderer.ts:843-987` | `drawClickEffectOnCanvas` is already a plain 2D-canvas function — drop-in for node-canvas / Remotion / an SVG generator. |
| Click bounce `max(0.72, 1 - sin(p·π)·0.08·bounce)` | `cursorRenderer.ts:1431-1434` | One line. |
| Cursor sway | `videoPlayback/cursorSway.ts` | One function, 6 constants. |
| Squircle path generation | `lib/geometry/squircle.ts` | Emits SVG path / canvas path / point list. `getSquircleSvgPath` is immediately usable in Remotion or as an ffmpeg alpha mask. |
| `computePaddedLayout` | `videoPlayback/layoutUtils.ts:41-142` | The exact contain-fit + padding + device-frame-inset math. |
| Shadow layer profiles + ffmpeg realisation | `exporter/shadowProfile.ts` + `electron/ipc/nativeVideoExport.ts:381-474` | The ffmpeg version (`lut` → `pad` → `gblur` → `alphamerge` → `overlay`) is literally an ffmpeg recipe you can paste. |
| Squircle mask → PGM buffer | `nativeVideoExport.ts:220-263` | Generate a P5 PGM alpha mask, feed it to ffmpeg `alphamerge`. Ideal for a CLI. |
| Temporal motion blur sample plan | `exporter/temporalMotionBlur.ts` | Cosine-tapered weights over a shutter window. Cheap in an offline renderer (you can afford 13 samples); much better than a screen-space directional blur. |
| Timeline data model + clip↔source time mapping | `video-editor/types.ts:227-392` | This *is* newsreel's shot-script IR. `mapTimelineTimeToSourceTime` / `mapSourceTimeToTimelineTime` handle speed ramps and trims in 10 lines each. |
| Bitrate / dimension / aspect tables | `exporter/exportBitrate.ts`, `exportDimensions.ts`, `utils/aspectRatioUtils.ts` | Pure lookup + arithmetic. Even-dimension normalisation is a real ffmpeg requirement. |
| Silence-based caption re-segmentation | `electron/ipc/captions/silence.ts` | Already ffmpeg-native (`silencedetect`, `-30 dB`, 0.5 s), and it doubles as a hallucination filter. |
| Audio sync / atempo decomposition / mic filter chains | `electron/ipc/recording/audioFilters.ts` | Pure ffmpeg filter strings. |
| Caption box layout + squircle background | `exporter/captionRenderer.ts`, `captionStyle.ts` | Plain 2D canvas; the font-size-relative padding formula is worth copying. |
| Webcam bubble sizing/positioning incl. `1/zoomScale` react-to-zoom | `video-editor/webcamOverlay.ts` | Pure math. |

### Needs re-derivation, but the *contract* transfers

- **Cursor track**: Recordly polls the OS at 30 Hz. newsreel must synthesise the track from its own script — but it should emit the **same schema** (`{timeMs, cx, cy, interactionType, cursorType}` sorted by `timeMs`) so every downstream algorithm above works unchanged. Playwright gives you exact element rects, so you can generate *better* paths (e.g. spring-interpolate between targets ahead of time and emit samples at the output fps, skipping the smoothing spring entirely — or keep the spring and emit sparse waypoints for a more organic feel).
- **Cursor shape**: a native monitor process is not portable. Derive `cursorType` from the DOM instead: `getComputedStyle(el).cursor` at the target element, mapped onto the same nine-value enum. That is strictly more reliable than Recordly's back-fill heuristics.
- **Motion blur**: the preview path uses `pixi-filters` `MotionBlurFilter` / `ZoomBlurFilter`. In a headless pipeline prefer the **temporal** approach (`temporalMotionBlur.ts`) which just needs "render the scene N times per output frame and accumulate with weights" — trivial in Remotion, and expressible in ffmpeg with `tmix`/`framerate` tricks if you render at N× fps and downsample.
- **Compositing**: PixiJS scene graph → either (a) Remotion/React with the same layer order (§6.6), or (b) ffmpeg `filter_complex` following the `buildNativePrecompositedStaticLayoutArgs` pattern: pre-render the static background+shadow to one PNG, pre-render the squircle mask to one PGM, then per-frame `crop` (zoom) → `scale` → `alphamerge` → `overlay`. Cursor/click overlays become a separate transparent PNG sequence or an `overlay` of a generated APNG/WebM with alpha.
- **Zoom → ffmpeg**: `computeZoomTransform` returns `{scale, x, y}` in canvas space. For ffmpeg it is cleaner to convert to a source-space crop: `cropW = srcW/scale, cropH = srcH/scale, cropX = clamp(focusX*srcW - cropW/2, 0, srcW-cropW)`. The `focusUtils` margin clamp is the same constraint expressed in normalized space, so either representation works — but do the clamp in focus space (as Recordly does) so the *easing* target is already legal and the spring never has to fight a wall.

### Desktop-specific — do not port

- ScreenCaptureKit / WGC / `desktopCapturer` capture, window-bounds polling (`electron/ipc/cursor/bounds.ts`), `uiohook-napi` global hooks.
- Cursor hiding (`electron/cursorHider.ts` — Python `ctypes` / PowerShell `ShowCursor` loops). In Playwright there is no OS cursor in the frame at all, so this problem simply doesn't exist.
- CUDA / D3D11 / VideoToolbox native compositors (`electron/native/**`), NVENC tuning, GPU probes.
- Electron IPC export streaming, mediabunny `StreamTarget`, WebCodecs decode/encode (ffmpeg replaces all of it).
- The extension host, marketplace, settings panels, HUD, project browser, i18n, auto-update.

### Gaps you must design yourself

1. **Keystroke overlay** — §5: only a typed hole exists; no capture, no chord logic, no badge rendering, no timing.
2. **Scene transitions** — none exist (no cross-fade, wipe, or slide between clips).
3. **Named easing curves** — `"glide" / "smooth" / "snappy" / "linear"` are persisted but unimplemented; only `easeOutZoom` ships.
4. **Per-word caption highlighting** — implemented then deliberately disabled (`captionStyle.ts:50-57`). If newsreel drives the script it knows word timings exactly, so this becomes viable again.
5. **Multi-source / picture-in-picture beyond one webcam bubble**, and **B-roll / card inserts** — no concept of them in the model.
