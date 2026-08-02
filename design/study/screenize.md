# Screenize — Complete Feature Catalog with Implementation Notes

Source: `/Users/elemoghenekaro/Workspace/tasks/projects/screenize` (Swift / macOS 13+, Apache-2.0, dev paused 2026-05-22).
All paths below are repo-relative to that root. Line numbers are from the checkout at commit `027be96`.

Purpose of this document: extract the **algorithms and the data they consume** so they can be reimplemented in `newsreel`
(headless, config-driven CLI: Playwright capture → ffmpeg/Remotion assembly). UI is ignored except where it reveals a
tunable parameter.

---

## 0. Pipeline map (three phases)

```
RECORD                          EDIT/GENERATE                         EXPORT
ScreenCaptureKit frames  ──►  MouseDataSource  ──►  EventTimeline  ──►  Timeline (tracks/segments)
MouseDataRecorder (60Hz)       (positions,           (UnifiedEvent[])     │
ClickEventHandler              clicks, keys,              │               ├─ CameraTrack   (zoom/pan)
KeyboardEventHandler (tap)     drags, UI samples)    IntentClassifier     ├─ CursorTrackV2 (style/scale/click feedback)
ScrollEventHandler                  │                     │               ├─ KeystrokeTrackV2 (badges)
DragEventHandler                    │              ┌──────┴──────┐        └─ AudioTrack   (per-segment volume)
AccessibilityInspector (1Hz)        │              │             │               │
                                    │       ContinuousCamera  SegmentCamera      ▼
                                    │        (Mode A)         (Mode B)     FrameEvaluator.evaluate(at: t)
                              VideoFrameAnalyzer                  │              │
                              (Vision, 1 fps:                     │        Renderer (CoreImage)
                               saliency, optical flow)            │              │
                                                                  ▼        AVAssetWriter / GIFEncoder
                                                            [TimedTransform] @60Hz
```

Entry point that wires it: `Screenize/ViewModels/EditorViewModel+SmartGeneration.swift:16-117`.
Both camera modes share the analysis layer (`EventTimeline` → `IntentClassifier`) and diverge only at planning.
Mode selection is `GenerationSettings.mode` (`.continuous` | `.segmentBased`),
`Screenize/Generators/GenerationSettings.swift:7-10,18`.

**Coordinate convention (gotcha).** `NormalizedPoint` is documented as *0–1, bottom-left origin*
(`Screenize/Core/Coordinates.swift:9-13`), but several comments say top-left
(`Screenize/Timeline/Keyframe.swift:25`, `Screenize/Render/EffectCompositor.swift:327-330`). In practice:
camera/crop math treats y as bottom-left (`TransformApplicator.calculateCropRect`,
`Screenize/Render/TransformApplicator.swift:127-145` uses y directly as CoreImage y), while the keystroke overlay
flips y (`EffectCompositor.swift:330`, `posY = (1 - y) * height`) so its default `y: 0.95` lands at the *bottom*
of the frame. For newsreel: pick one convention (browser-native top-left is easiest) and flip once at the ffmpeg
boundary; do not copy Screenize's mixed convention.

---

## 1. CAMERA MODE A — continuous cursor-follow with spring physics

**What it does.** Produces one unbroken 60 Hz camera path for the whole recording. Position is driven by the cursor
through a *dead zone* (camera holds still while the cursor is in the middle of the frame); zoom is driven separately by
intent-derived waypoints. Output is `[TimedTransform]` = `{time, {zoom, center}}` sampled at 60 Hz.

**Orchestrator:** `Screenize/Generators/ContinuousCamera/ContinuousCameraGenerator.swift:23-107` — 8 steps:
1. Resample mouse via Catmull-Rom only, **no pre-smoothing spring** (`springConfig: nil`, line 33-36). The comment at
   line 30-32 is important: cascading a pre-smoothing spring in front of the camera spring "introduces cascaded latency
   that weakens cursor tracking".
2. `EventTimeline.build` 3. `IntentClassifier.classify` 4. `WaypointGenerator.generate`
5. `SpringDamperSimulator.simulate` 6. zoom-intensity post-scale 7. wrap in a display CameraTrack
8. emit cursor + keystroke tracks.

### 1.1 The spring integrator (the core math)

`Screenize/Generators/ContinuousCamera/SpringDamperSimulator.swift:348-381`

Not a numeric ODE step — an **analytic (exponential-integrator) solution** of the damped harmonic oscillator, assuming
the target is constant across the timestep. This makes it frame-rate independent and unconditionally stable.

Let `x0` = current, `v0` = velocity, `T` = target, `d = x0 - T`, `zo = ζω`.

```
zeta >= 1 (critical/over-damped):
  decay = exp(-zo * dt)
  A = d
  B = v0 + zo*d
  x' = T + (A + B*dt) * decay
  v' = (B - zo*(A + B*dt)) * decay

zeta < 1 (underdamped):
  wd    = ω * sqrt(1 - ζ²)
  decay = exp(-zo * dt)
  A = d
  B = (v0 + zo*d) / wd
  x' = T + decay * (A*cos(wd*dt) + B*sin(wd*dt))
  v' = decay * ( -zo*(A*cos + B*sin) + (-A*wd*sin + B*wd*cos) )
```

**ω is derived from a "response time", not specified directly:** `omega = 2π / response`
(`SpringDamperSimulator.swift:197,248,256,271`). So "response" ≈ the natural oscillation period in seconds.
There is no mass term — mass is folded into ω. Each axis (x, y, zoom) is an independent 1-D spring.

**Integration step:** fixed `dt = 1 / tickRate`, `tickRate = 60.0 Hz`
(`Screenize/Generators/ContinuousCamera/ContinuousCameraTypes.swift:122`). Loop:
`SpringDamperSimulator.swift:77-223`, `while t <= duration + dt*0.5`.

### 1.2 Spring constants (shipped defaults)

`Screenize/Generators/ContinuousCamera/ContinuousCameraTypes.swift:102-164` and mirrored in
`Screenize/Generators/GenerationSettings.swift:30-60` (these are the values exposed to the settings UI).

| Constant | Value | Meaning |
| --- | --- | --- |
| `positionDampingRatio` (ζ) | **0.90** | pan spring, slightly underdamped |
| `positionResponse` | **0.35 s** | pan spring period → ω ≈ 17.95 rad/s |
| `zoomDampingRatio` | **0.90** | zoom spring |
| `zoomResponse` | **0.55 s** | zoom spring period → ω ≈ 11.42 rad/s |
| `tickRate` | **60.0 Hz** | dt = 0.01667 s |
| `minZoom` / `maxZoom` | **1.0 / 2.8** | hard clamp |
| `zoomIntensity` | **1.0** | post-hoc scale, see 1.7 |
| `boundaryStiffness` | **12.0** | soft edge pushback |
| `zoomSettleThreshold` | **0.02** | zoom considered "arrived" below this |
| `urgencyBlendDuration` | **0.5 s** | smoothstep blend between urgency levels |

Note: the design doc `docs/plans/2026-03-09-dead-zone-camera-design.md` specifies `positionDampingRatio = 1.0`
(critically damped) and `gradientBandWidth = 0.10`, `correctionFraction = 0.60`. The **shipped code differs**
(0.90 / 0.25 / 0.45). Trust the code.

### 1.3 Urgency → response multiplier

`ContinuousCameraTypes.swift:64-73` (enum) and `:115-120` (multipliers). Lower multiplier = faster.

| Urgency | Multiplier | Emitted for |
| --- | --- | --- |
| `.immediate` | **0.05** | app switching → effectively an instant cut |
| `.high` | **0.5** | typing |
| `.normal` | **1.0** | clicking, navigating, scrolling, dragging |
| `.lazy` | **2.0** | idle, reading |

Effective zoom spring: `zoomOmega = 2π / (zoomResponse * effectiveZoomMult)` (`SpringDamperSimulator.swift:197`).
Transitions between urgency levels are **smoothstepped** over `urgencyBlendDuration` (0.5 s):
`SpringDamperSimulator.swift:124-133`, `p = linear; blend = p*p*(3 - 2*p)`.

`.immediate` waypoints additionally **teleport** the zoom: `state.zoom = targetZoom; velocityZoom = 0`
(`SpringDamperSimulator.swift:114-118, 200-210`). Activation tolerance is `dt * 0.5` (line 78).

### 1.4 Dead zone position targeting

`Screenize/Generators/ContinuousCamera/DeadZoneTarget.swift:40-141`. Settings at
`ContinuousCameraTypes.swift:19-42`.

```
if zoom <= 1.001: target = (0.5, 0.5); inactive          # whole frame visible, nothing to pan
viewportHalf  = 0.5 / zoom                                # half-extent of visible crop in normalized units
safeFraction  = isTyping ? 0.60 : 0.75                    # safeZoneFractionTyping / safeZoneFraction
correction    = isTyping ? 0.80 : 0.45                    # correctionFractionTyping / correctionFraction
safeHalf      = viewportHalf * safeFraction
gradientHalf  = viewportHalf * 0.25                       # gradientBandWidth
hysteresisHalf= safeHalf * 0.15                           # hysteresisMargin

offset  = cursor - cameraCenter          (per axis)
maxOff  = max(|offsetX|, |offsetY|)      # Chebyshev, NOT Euclidean

# Hysteresis (Schmitt trigger) — prevents chatter at the boundary
if wasActive:  isActive = maxOff >= (safeHalf - hysteresisHalf)
else:          isActive = maxOff >  (safeHalf + hysteresisHalf)

if !isActive:  target = clampCenter(cameraCenter, zoom)   # HOLD STILL

# per axis, when active:
if |offset| <= safeHalf:  axisTarget = cameraPos          # this axis is fine, don't move it
minimalTarget   = cursorPos - sign(offset) * safeHalf     # camera pos that puts cursor exactly on safe-zone edge
idealTarget     = cursorPos                                # camera pos that centers the cursor
correctedTarget = lerp(minimalTarget, idealTarget, correction)   # partial correction — never fully centers

# gradient band: ease in the correction instead of snapping to it
if |offset| < safeHalf + gradientHalf:
    p = (|offset| - safeHalf) / gradientHalf
    axisTarget = cameraPos + (correctedTarget - cameraPos) * (p*p*(3 - 2*p))   # smoothstep
else:
    axisTarget = correctedTarget

target = clampCenter((targetX, targetY), zoom)
```

Key ideas worth porting verbatim: (a) target the *edge of the dead zone*, not the cursor; (b) partial correction so the
camera never "snaps to center"; (c) hysteresis; (d) smoothstep gradient band; (e) Chebyshev activation but per-axis
targeting.

### 1.5 Adaptive response (look-ahead — only possible post-hoc)

`Screenize/Generators/ContinuousCamera/AdaptiveResponse.swift:11-45`. Because this is post-processing, the planner
knows when the next action happens and speeds the camera up so it arrives in time.

```
timeToNext = time of next non-idle, non-reading IntentSpan start   (nil if none)
if nil                         → response = maxResponse (0.50)
if timeToNext <= 0.5           → response = minResponse (0.20)     # responseFastThreshold
if timeToNext >= 2.0           → response = maxResponse (0.50)     # responseSlowThreshold
else linear lerp between them
positionOmega = 2π / response
```

Constants: `deadZoneMinResponse 0.20`, `deadZoneMaxResponse 0.50`, `responseFastThreshold 0.5 s`,
`responseSlowThreshold 2.0 s` (`ContinuousCameraTypes.swift:34-41`, `GenerationSettings.swift:53-54,133-134`).

### 1.6 Position-target arbitration per tick

`SpringDamperSimulator.swift:230-274`. Three mutually exclusive regimes, checked in order:

1. **Zoom transitioning** (`|zoom - targetZoom| > zoomSettleThreshold(0.02)`): position targets the *waypoint center*
   directly and uses the **zoom** spring params (`omega = 2π/(zoomResponse*urgencyMult)`, `zeta = zoomDampingRatio`).
   Rationale (`SpringDamperSimulator.swift:157-160`): pan and zoom must arrive together or the move looks broken.
2. **Startup bias active** (`t < startupState.releaseTime`): position targets `initialCenter` with base
   `positionResponse` / `positionDampingRatio`.
3. **Steady state**: dead-zone target with adaptive response.

### 1.6.1 Startup camera policy

`Screenize/Generators/ContinuousCamera/StartupCameraPolicy.swift:12-79`. Camera opens at screen center rather than
snapping to wherever the pointer happened to be. Constants `ContinuousCameraTypes.swift:47-58`:
`initialCenter = (0.5, 0.5)`, `deliberateMotionDistance = 0.08`, `deliberateMotionWindow = 0.35 s`,
`jitterDistance = 0.02`.

Release time = **min** of: first click, first drag start, first typing span start, first non-shortcut keyDown, and the
first "deliberate motion" (`:61-79` — first sample within 0.35 s of start whose distance from the anchor is
≥ 0.08; samples under 0.02 are ignored as capture jitter). Design rationale:
`docs/superpowers/specs/2026-03-11-smart-generation-startup-center-bias-design.md`.

### 1.7 Edge clamping (two mechanisms)

**Hard clamp** — `ShotPlanner.clampCenter`, `Screenize/Generators/SmartGeneration/Planning/ShotPlanner.swift:462-470`.
This is the "visible crop never leaves the frame" rule, and it is dead simple:

```
if zoom <= 1.0: return (0.5, 0.5)
halfCrop = 0.5 / zoom
x = clamp(center.x, halfCrop, 1 - halfCrop)
y = clamp(center.y, halfCrop, 1 - halfCrop)
```

Applied at every waypoint, every simulation tick, and again at evaluation time
(`Screenize/Render/FrameEvaluator+Transform.swift:82-90`) and again in pixel space
(`TransformApplicator.calculateCropRect`, `Screenize/Render/TransformApplicator.swift:140-143`). Belt and braces.

**Soft pushback** — `SpringDamperSimulator.clampState`, `SpringDamperSimulator.swift:277-318`. Instead of hard-stopping
(which kills momentum and looks like a wall), overflow past the clamp applies progressive velocity damping:

```
maxOverflow = 0.03           # hard cap on how far outside the camera may stray
stiffness   = boundaryStiffness = 12.0
overflow    = position - clampedPosition
if |overflow| > 0.0001:
    overflowRatio = min(1, |overflow| / 0.03)
    dampFactor    = overflowRatio * 0.5
    velocity  *= max(0, 1 - dampFactor * dt * stiffness)
    velocity  -= overflow * stiffness * 0.3 * dt
    if |overflow| > 0.03: position = clamped + sign(overflow)*0.03
zoom clamp: [minZoom, maxZoom], with velocity zeroed in the offending direction (:282-288)
```

### 1.8 Post-hoc zoom intensity

`ContinuousCameraGenerator.applyZoomIntensity`, `:113-125`:
`newZoom = max(1.0, 1.0 + (zoom - 1.0) * intensity)`, then re-clamp the center for the new zoom.
A single user dial that scales the whole camera's "aggressiveness" without re-simulating. Directly portable and a
very good idea for a config-driven tool.

### 1.9 MicroTracker (built, then disabled)

`Screenize/Generators/ContinuousCamera/MicroTracker.swift:23-103`. Layer-2 idle re-centering: when cursor velocity
< `idleVelocityThreshold` (0.02 normalized units/s) it springs a correction offset toward the cursor
(`response 3.0 s`, `ζ 1.0`); when active it decays the correction to zero at `response*0.5`. **Not called by the
current pipeline** — the dead zone made it redundant (`docs/plans/2026-03-09-dead-zone-camera-design.md`, "What Gets
Removed"). Useful reference if newsreel wants gentle drift-to-center during long pauses.

---

## 2. CAMERA MODE B — per-activity segment planner

**What it does.** Instead of one continuous path, produces **discrete editable segments**, each with an explicit
`startTransform` / `endTransform`. A separate spring pass then bakes each segment into per-frame samples. This is the
mode whose data model maps most directly onto a newsreel "shot script".

**Orchestrator:** `Screenize/Generators/SegmentCamera/SegmentCameraGenerator.swift:20-107`.

### 2.1 Scene construction and merging

`Screenize/Generators/SegmentCamera/SegmentPlanner.swift:14-136`.

- Each `IntentSpan` becomes one `CameraScene` (`:26-34`).
- Focus regions: if the span has an accessibility element, use its frame; otherwise a 0.01×0.01 point rect at the focus
  position (`:54-84`).
- **Merge rule** (`:89-125`) — deliberately conservative, merge only when *both*:
  - centroid distance of focus regions **< 0.05** normalized, AND
  - gap between previous end and current start **< 0.5 s**.
  (Rationale in `docs/superpowers/specs/2026-03-11-spring-target-segments-design.md`: earlier versions merged 3 clicks
  across the screen into one 4-second blob and the camera visibly did nothing.)

### 2.2 Transition / hold split — the segment-duration algorithm

`SegmentPlanner.buildSegments`, `:182-280`. Constants at `:140-146`.

| Constant | Value | Role |
| --- | --- | --- |
| `splitDistanceThreshold` | **0.05** | min center delta to warrant a move |
| `splitZoomThreshold` | **0.1** | min zoom delta to warrant a move |
| `arrivalRadius` | **0.08** | how close the cursor must get to count as "arrived" |
| `minTransitionDuration` | **0.15 s** | floor |
| `maxTransitionDuration` | **0.8 s** | ceiling |
| `minHoldDuration` | **0.1 s** | below this, skip the hold and let the transition fill the span |
| `fallbackSpeedFactor` | **1.0** | seconds per normalized unit, when the cursor never arrives |

```
for each shot plan:
    zoom   = max(1.0, 1.0 + (idealZoom - 1.0) * zoomIntensity)
    center = clampCenter(idealCenter, zoom)
    end    = {zoom, center};  start = previousEnd ?? end

    needsSplit = previousEnd != nil
                 && ( dist(start.center, end.center) > 0.05 || |start.zoom - end.zoom| > 0.1 )

    if needsSplit:
        travel = cursorTravelTime(start.center → end.center, within [spanStart, spanEnd])
        transitionEnd = spanStart + travel
        if (spanEnd - transitionEnd) >= 0.1:
            emit .manual(start → end)   over [spanStart, transitionEnd]     # MOVE
            emit .manual(end   → end)   over [transitionEnd, spanEnd]       # HOLD
        else:
            emit .manual(start → end)   over [spanStart, spanEnd]           # move only
    else:
        emit .manual(start → end)       over [spanStart, spanEnd]           # hold only
    previousEnd = end

# finally: forbid overlaps — clamp each start to previous end, floor duration at 0.01 s (:269-277)
```

`cursorTravelTime` (`:149-175`) scans real mouse samples in `[searchStart, searchEnd]` for the first sample within
`arrivalRadius` of the target and returns `clamp(elapsed, 0.15, 0.8)`. If the cursor never arrives (target came from an
accessibility element, not the pointer), fall back to `clamp(distance * 1.0, 0.15, 0.8)` seconds.

**Why this matters for newsreel:** the transition duration is derived from *how fast the user actually moved*, not from
a fixed constant. In a scripted Playwright world you know the target ahead of time, so the analogue is: derive the
transition duration from the distance the camera must travel, floored at 0.15 s and ceiled at 0.8 s.
Design rationale: `docs/superpowers/specs/2026-03-13-transition-hold-segment-split-design.md`.

### 2.3 Segment spring pass

`Screenize/Generators/SegmentCamera/SegmentSpringSimulator.swift:35-168`. Config `:11-19` (same defaults as Mode A:
0.90/0.35, 0.90/0.55, 60 Hz, 1.0–2.8).

- Target = the segment's `endTransform`. **Velocity carries across segment boundaries** — no explicit crossfade needed
  (`:64-71`, and the whole point per `2026-03-11-spring-target-segments-design.md`).
- **Hold-segment damping** (`:77-91`): if `start ≈ end` (all deltas < 0.001), pre-multiply all three velocities by
  **0.3** on entry to kill the post-transition overshoot/jitter.
- **Duration-scaled response** (`:96-102`) — the spring stretches to fill the available time:
  ```
  adaptedPosResponse  = max(0.15, max(positionResponse, segmentDuration * 0.40) * speedFactor)
  adaptedZoomResponse = max(0.15, max(zoomResponse,     segmentDuration * 0.45) * speedFactor)
  ```
- **Cursor-speed coupling** (`speedFactor`, `:23-31`): faster cursor ⇒ faster camera, so the cursor doesn't outrun the
  crop.
  ```
  speed <= 0.3  → 1.0
  speed >= 0.8  → 0.5
  else linear:  1.0 - ((speed-0.3)/0.5) * 0.5
  ```
  Speed source: `SegmentCameraGenerator.cursorSpeeds`, `:112-145` — **net displacement** (straight line first→last),
  not path length, over the first **0.3 s** of the segment (or the segment length if shorter), in normalized units/s.
  Rationale: `docs/superpowers/specs/2026-03-13-smart-generation-quality-improvements-design.md`.
- Each simulated segment is rewritten from `.manual` to `.continuous(transforms:)` (`:162-164`), so at render time both
  modes evaluate identically.
- Results are cached in `SpringSimulationCache` (`Screenize/Render/SpringSimulationCache.swift:7-44`); the whole cache
  is invalidated on any edit because velocity is shared across segments.

---

## 3. Activity detection — the IntentClassifier (shared by both modes)

`Screenize/Generators/SmartGeneration/Analysis/IntentClassifier.swift`. Purely rule-based, no ML.
Settings mirror: `Screenize/Generators/GenerationSettings.swift:100-116`.

### 3.1 Constants (`IntentClassifier.swift:12-61`)

| Constant | Value | Used by |
| --- | --- | --- |
| `typingSessionTimeout` | **1.5 s** | max gap between keyDowns inside one typing session |
| `navigatingClickWindow` | **2.0 s** | max inter-click time to group clicks |
| `navigatingClickDistance` | **0.5** | max inter-click normalized distance to group clicks |
| `navigatingMinClicks` | **2** | (declared; grouping emits per-click spans, see 3.5) |
| `idleThreshold` | **5.0 s** | declared; gap filling actually uses `continuationGapThreshold` |
| `continuationGapThreshold` | **1.5 s** | gap ≤ this may extend the previous span instead of inserting idle |
| `continuationMaxDistance` | **0.20** | …but only if the two spans are spatially this close |
| `scrollMergeGap` | **1.0 s** | max gap to merge scroll events into one span |
| `pointSpanDuration` | **0.5 s** | synthetic duration given to instantaneous events (click, switch) |
| `contextChangeWindow` | **0.8 s** | window to associate a post-click UI change with the click |
| `typingAnticipation` | **0.4 s** | shift typing spans earlier |
| `clickAnticipation` | **0.15 s** | shift click spans earlier |
| `dragAnticipation` | **0.25 s** | shift drag spans earlier |
| `scrollAnticipation` | **0.25 s** | shift scroll spans earlier |
| `switchAnticipation` | **0.25 s** | shift switching spans earlier |

**Anticipation** shifts *both* start and end by the same amount, so the camera arrives *before* the action rather than
chasing it (`docs/superpowers/specs/2026-03-12-camera-anticipation-design.md`). `max(0, …)` guards the recording start.

### 3.2 Overall flow (`:66-112`)

Each intent type is detected **independently over the whole timeline**, then merged:
1. `detectTypingSpans`, `detectDraggingSpans`, `detectScrollingSpans`, `detectSwitchingSpans`
2. `detectClickSpans` — excluding any time already covered by typing or dragging (`:94-100`)
3. concatenate, sort by start
4. `resolveOverlaps` — earlier-starting span wins; the later one is trimmed to start at the earlier one's end, and
   dropped entirely if trimming empties it (`:572-599`)
5. `fillGaps` — see 3.6

If there are no actionable events at all (mouseMove and uiStateChange do not count), the entire recording is one idle
span (`:74-83`).

### 3.3 TYPING (`:116-193`)

- Source events: `keyDown` where `!modifiers.hasShortcutModifiers` — i.e. **⌘C is not typing**, plain `a` is (`:121-126`).
- Sessionization: walk keyDowns in time order; if `gap > 1.5 s`, close the session and start a new one (`:134-148`).
- Span = `[firstKey - 0.4 s, lastKey]`. Note the end is **not** extended.
- Confidence from key count: `>3 → 0.9`, `>1 → 0.7`, else `0.5` (`:181`).
- Focus position priority (`:202-222`): caret bounds midpoint from the nearest `UIStateSample` → that sample's cursor
  position (if in 0–1) → last mouse position before typing → (0.5, 0.5).
- **Typing sub-context** (`:224-275`) drives which zoom range applies. Decision order:
  1. accessibility role in `{AXTextField, AXSearchField, AXSecureTextField, AXComboBox}` → `.textField`
  2. bundle id / app name contains `terminal|iterm|warp|alacritty|wezterm|hyper` → `.terminal`
  3. contains `xcode|visual studio code|vscode|code|codium|cursor|zed|sublime|nova|jetbrains|intellij|pycharm|goland|clion|rider` → `.codeEditor`
  4. role `AXTextArea` + `word|pages|writer|notes|notion|craft|obsidian|rich|document` → `.richTextEditor`; else `.codeEditor`
  5. default `.textField`
  App name is sampled from events within `[typingStart-0.5, typingEnd+0.5]` (`:234-239`).

### 3.4 DRAGGING (`:296-323`)

One span per `dragStart` event, `[startTime - 0.25, endTime - 0.25]`, confidence **0.95**, focus = drag start position.
`DragType` maps 1:1 to `DragContext` (`.selection` / `.move` / `.resize`) — in practice the recorder only ever emits
`.selection` (`Screenize/Core/Recording/EventHandlers/DragEventHandler.swift:74`).

### 3.5 SCROLLING (`:327-370`)

Greedy run-merge over scroll events: start a run at the first scroll; **close and emit** when
`event.time - lastScrollTime > 1.0 s`; emit the trailing run at the end. Span shifted by −0.25 s, confidence 0.9,
focus = position of the **first** event of the run.

### 3.6 SWITCHING (`:374-411`)

Walk all events, extracting an app identifier per event (`:541-561`: metadata bundle id → element application name →
click's bundle id). When it changes to a non-equivalent app, emit a span
`[switchTime - 0.5 - 0.25, switchTime + 0.5 - 0.25]`, confidence 0.85. Debounce: a new switch is ignored if it is within
`pointSpanDuration * 0.5 = 0.25 s` of the previous one (`:390-394`).

App-identity matching is fuzzy (`:715-783`): normalize case/whitespace; compare full string, last dot-component,
alphanumeric-compacted forms, and word tokens ≥3 chars (excluding `app, co, com, corp, io, llc, net, org`); finally
substring containment when both compacted forms are ≥5 chars. This exists so `com.apple.Safari` and `Safari` match.

### 3.7 CLICKING / NAVIGATING (`:415-477`)

Only `leftDown` events, minus those inside typing/dragging spans. Group consecutive clicks when **both**
`Δt <= 2.0 s` and `distance <= 0.5`. Then — and this is the counter-intuitive part — `emitClickGroup` (`:455-477`)
emits **one span per click**, not one per group: `[t - 0.15, t + 0.5 - 0.15]`, confidence 0.9. The grouping only exists
so the group boundary logic runs; the `.navigating` intent is defined in the enum and has its own zoom range but is
never emitted by this classifier.

**Post-click context change** (`:480-512`): find the last `UIStateSample` at/before the click and the first one within
0.8 s after; if the app changed between them, bail; otherwise run `UIStateSample.detectContextChange`
(`Screenize/Models/MouseEvent.swift:281-309`):
```
areaRatio = currentElementArea / previousElementArea
ratio > 3.0        → .expansion(ratio)      # e.g. a modal/panel opened
ratio < 1/3.0      → .contraction(ratio)
current role ∈ {AXSheet, AXDialog, AXPopover, AXMenu} and previous wasn't → .modalOpened
```
This is fed to `ShotPlanner` to *reduce* zoom when the area of interest just got bigger (see 4.2).

### 3.8 Gap filling (`:603-695`)

For each gap between spans:
```
if gapLength <= 1.5 s AND previous exists
   AND intentsCompatibleForContinuation(prev.intent, next.intent)
   AND distance(prev.focus, next.focus) < 0.20:
        extend the previous span's end to the gap end     # treat as one continuous action
else:
        insert an .idle span, inheriting the previous span's focus position
```
Compatibility table (`:676-695`): typing↔typing only when the sub-context matches; clicking↔navigating in any
combination; dragging↔dragging; scrolling↔scrolling; reading↔reading. Everything else is incompatible.
A trailing idle span is appended to reach `duration`. Idle spans get confidence 0.8.

---

## 4. Zoom level per activity — ShotPlanner

`Screenize/Generators/SmartGeneration/Planning/ShotPlanner.swift`. Used by Mode B directly and by Mode A via
`WaypointGenerator.plannedTransform` (`Screenize/Generators/ContinuousCamera/WaypointGenerator.swift:208-264`).

### 4.1 Zoom ranges (`ShotSettings`, `:537-554`; UI mirror `GenerationSettings.swift:64-95`)

| Intent | Range | Notes |
| --- | --- | --- |
| typing / codeEditor | **2.0 – 2.5** | |
| typing / textField | **2.2 – 2.8** | tightest — a search box is small |
| typing / terminal | **1.6 – 2.0** | terminals are dense, don't over-zoom |
| typing / richTextEditor | **1.8 – 2.2** | |
| clicking | **1.5 – 2.5** | widest range; element size decides |
| navigating | **1.5 – 1.8** | |
| dragging | **1.3 – 1.6** | need to see source and destination |
| scrolling | **1.3 – 1.5** | |
| reading | **1.0 – 1.3** | |
| switching | **1.0** (fixed) | full frame for a context change |
| idle | **1.0** (fixed) | |

Globals: `targetAreaCoverage 0.7`, `workAreaPadding 0.08`, `minZoom 1.0`, `maxZoom 2.8`, `idleZoomDecay 0.5`.

### 4.2 Choosing the actual zoom inside the range (`computeZoom`, `:166-228`)

Four fallbacks, in priority order. The core formula in the first three is
**`zoom = targetAreaCoverage / areaSize`** — i.e. "make the thing of interest fill 70 % of the frame".

1. **Element-based** (`.element`, `:174-188`) — accessibility element frame, normalized:
   `areaSize = max(w + 2*0.08, h + 2*0.08)`; `zoom = 0.7 / areaSize`; clamp to the intent range then to [1.0, 2.8].
2. **UIStateSample fallback** (`:190-205`) — same math using the nearest UI-state element frame or a click's element.
3. **Activity bounding box** (`.activityBBox`, `:207-218`) — needs ≥2 intent-relevant positions
   (`relevantPositions`, `:108-132`: clicks for clicking/navigating; dragStart+dragEnd for dragging; all event positions
   otherwise). BBox is padded by 0.08 and clipped to [0,1] (`:231-245`); `areaSize = max(bbox.w, bbox.h)`;
   `zoom = 0.7 / areaSize`.
4. **Single event** (`.singleEvent`) → range **lower** bound. **Nothing** (`.intentMidpoint`) → range midpoint.

Then, if the scene carries a post-click context change (`adjustZoomForContextChange`, `:66-83`):
```
.expansion(ratio):  zoom *= max(0.5, 1/sqrt(ratio))   # pull back, at most 2× out
.modalOpened:       zoom  = range.lowerBound          # modals need room
.contraction/.none: unchanged
```

`classifyShotType` (`:523-531`): `zoom > 2.0 → closeUp`, `> 1.0 → medium`, else `wide`. Cosmetic/diagnostic only.

### 4.3 Choosing the center (`:282-414`)

- **Typing** (`:318-366`): first caret bounds midpoint in the scene → first event position → last cursor focus region →
  (0.5, 0.5). Then `constrainCenterToShowElement` (`:420-459`) shifts the center the minimum amount needed to keep the
  padded (0.08) element rect inside the viewport; if the element is bigger than the viewport, snap to the element's
  midpoint. Then `clampCenter`.
  The comment at `:328-329` explains why the *first* caret and not the last: the camera starts at `idealCenter` and pans
  forward with the text.
- **Everything else** (`:369-414`): unweighted geometric centroid of intent-relevant positions (falls back to focus
  region midpoints). If there is **no** accessibility element info, blend 30 % toward the Vision saliency center of the
  nearest analyzed frame (`weight = 0.3`, `:404-410`; saliency lookup `:475-496`, and note the y-flip at `:495` because
  Vision reports top-left origin).
- **Idle / switching** use the same activity-center path — the comment at `:291-293` warns that hard-coding (0.5, 0.5)
  for these caused visible snaps on real recordings.

### 4.4 Idle scene inheritance (`:89-102` and `ShotPlan.inheriting`, `Types/ShotPlan.swift:31-50`)

An idle scene *after* an action inherits the previous non-idle scene's **center**, with zoom decayed toward 1.0:
`decayedZoom = 1.0 + (prevZoom - 1.0) * idleZoomDecay(0.5)`. Leading idle scenes (before any action) stay at zoom 1.0
centered — the establishing shot. Mode A has the same rule in `WaypointGenerator.resolveIdleZoom` (`:429-447`).

---

## 5. Waypoint generation and merge/optimization (Mode A)

`Screenize/Generators/ContinuousCamera/WaypointGenerator.swift:20-97`.

- A `t=0` waypoint `{zoom 1.0, center (0.5,0.5), urgency .lazy, source .idle}` is prepended if the first span starts
  after 0.001 s (`:33-36`, `:552-560`).
- Two passes: first compute non-idle transforms, then emit entry waypoints (so idle can look backwards at real
  neighbours).
- **Entry lead time** (`:116-126`, values `ContinuousCameraTypes.swift:152-159`) shifts the waypoint *further* earlier,
  on top of the classifier's anticipation:
  `.immediate 0.24 s`, `.high 0.16 s`, `.normal 0.08 s`, `.lazy 0.0 s`.
  Total lead for typing is therefore 0.4 + 0.16 = **0.56 s**; for a click 0.15 + 0.08 = **0.23 s**.
- **Coalescing** (`sortAndCoalesce`, `:456-482`): sort by time, tie-break by descending urgency; waypoints within
  **0.0001 s** collapse to the higher-urgency one.
- **Zoom-transition optimization** (`optimizeZoomTransitions`, `:505-549`; thresholds `:488-492`). Removes the
  distracting zoom-out-zoom-in yo-yo between two nearby actions. Scan every consecutive triple
  (active, passive, active):
  ```
  guard |first.zoom - third.zoom| < 0.30                 # zoomSimilarityThreshold
  d = euclidean(first.center, third.center)
  gap = third.time - first.time
  if d < 0.15                        → delete the middle waypoint      # nearThreshold
  elif d < 0.35 and gap < 1.5 s      → delete the middle waypoint      # farThreshold / quickThreshold
  else                               → middle.zoom = max(first.zoom * 0.70, 1.0)   # partial pull-back
  after a deletion, rewind the scan index by 1 so chains re-evaluate
  ```
  "Active" = clicking, navigating, scrolling, typing, dragging. "Passive" = idle, reading, switching (`:495-502`).
- Also present but **not wired into `generate()`**: `typingDetailWaypoints` (`:266-310`, caret-following mid-span
  waypoints gated by `typingDetailMinInterval 0.2 s` and `typingDetailMinDistance 0.025`) and
  `activityDetailWaypoints` (`:312-357`, gated by `max(0.12, 0.2*0.75)` and `max(0.02, 0.025*0.8)`, with first/last
  anchors always kept). Dead code today, but a ready-made design for "add a keyframe per meaningful sub-event".

---

## 6. Keyframes / timeline data model

This is the piece newsreel would *generate* from its shot script, so the schema matters most here.

### 6.1 Top-level

`Screenize/Timeline/Timeline.swift:4-200`
```
Timeline {
  tracks: [AnySegmentTrack]      # tagged union, {"type": "...", "data": {...}}
  duration: seconds
  trimStart: seconds
  trimEnd: seconds?              # nil = duration
}
```
Trim helpers `:31-49`. Default track set is `[camera, cursor, keystroke]` (`:53-64`); audio tracks are added on demand.
Track accessors are computed properties that find-or-insert by `trackType` (`:68-174`).

`AnySegmentTrack` Codable envelope: `Screenize/Timeline/Track.swift:279-399` — `{"type": "transform"|"cursor"|
"keystroke"|"audio", "data": <track>}`.

### 6.2 Tracks (`Screenize/Timeline/Track.swift`)

| Track | Fields | Overlap policy |
| --- | --- | --- |
| `CameraTrack` (`:24-96`) | `id, name, isEnabled, segments[]` | **forbidden** — `addSegment`/`updateSegment` return false on overlap (`:90-95`) |
| `CursorTrackV2` (`:98-176`) | `+ useSmoothCursor, springConfig, scale (default 2.5)` | forbidden |
| `KeystrokeTrackV2` (`:178-219`) | `id, name, isEnabled, segments[]` | **allowed** — badges may stack (`:199-203`), `activeSegments(at:)` returns all |
| `AudioTrack` (`:223-277`) | `+ audioSource (.system\|.microphone)` | forbidden |

Segments are always kept sorted by `startTime` in every initializer and mutator.
`activeSegment(at: t)` is a half-open test: `t >= start && t < end`.

### 6.3 Segments (`Screenize/Timeline/Segments.swift`)

```
CameraSegment { id: UUID, startTime, endTime, kind }                       # :99-134
CameraSegmentKind =                                                        # :44-97
    | .continuous(transforms: [TimedTransform])      # baked 60Hz samples
    | .manual(startTransform: TransformValue, endTransform: TransformValue)
TimedTransform { time, transform: {zoom: CGFloat, center: {x,y}} }         # Types/TimedTransform.swift
```
**There is no per-keyframe easing on camera segments any more.** The `interpolation` field was removed and is only
decoded-and-discarded for backward compat (`:58, :76-77`); `transitionToNext {duration, easing}` likewise
(`:5-8, :124`). Interpolation is either (a) the baked spring samples, or (b) a hard-coded `.easeInOut` fallback in
`FrameEvaluator` (`Screenize/Render/FrameEvaluator+Transform.swift:41`). This is a deliberate simplification:
springs replaced easing curves. **For newsreel, that is the key schema decision** — either ship easing per keyframe, or
ship baked samples, not both.

```
CursorSegment    { id, startTime, endTime, style, visible, scale=2.5, clickFeedback }   # :138-181
KeystrokeSegment { id, startTime, endTime, displayText, position=(0.5,0.95),
                   fadeInDuration=0.15, fadeOutDuration=0.3 }                            # :185-211
AudioSegment     { id, startTime, endTime, volume=1.0, isMuted=false }                   # :215-236
CursorFollowConfig  { deadZone 0.04, springDamping 0.9, response 0.25,
                      lookAhead 0.04, maxSpeed 5.0 }                                     # :11-25 (declared, unused)
ClickFeedbackConfig { mouseDownScale 0.75, mouseDownDuration 0.10,
                      mouseUpDuration 0.25, mouseUpSpring .spring(0.92, 0.25) }          # :28-40
```

### 6.4 Legacy keyframe model (still compiled, useful as a schema reference)

`Screenize/Timeline/Keyframe.swift` — the pre-segment model, `TimedKeyframe { id, time, easing }`:
- `TransformKeyframe` (`:21-52`): `time, zoom (min 1.0), center (clamped), easing (default .springDefault)`.
- `CursorStyleKeyframe` (`:148-173`): `style, visible, scale (min 0.5), easing (.springSnappy)`.
- `KeystrokeKeyframe` (`:178-242`): `displayText, duration 1.5, fadeIn 0.15, fadeOut 0.3, position (0.5,0.95),
  easing .easeOut`, with `opacity(at:)` at `:226-241`.
- `TransformValue.interpolated` is naive lerp of zoom and center (`:59-67`).
- `TransformValue.interpolatedForWindowMode` (`:75-99`) is the interesting one: in window/framed mode the visible
  position is `center × zoom`, so lerping center and zoom independently *skews* the motion. Instead lerp the
  **anchor** `A = center * zoom`, then `center' = A' / zoom'`. Anyone compositing a scaled window over a background
  will hit this exact bug.
- `LegacyTrack.swift` holds `TransformTrack`/`CursorTrack`/`KeystrokeTrack` + `AnyTrack` for reading v1 projects.

### 6.5 Easing curves

`Screenize/Timeline/EasingCurve.swift:6-404`. Cases: `.linear`, `.easeIn`, `.easeOut`, `.easeInOut`,
`.cubicBezier(p1x,p1y,p2x,p2y)`, `.spring(dampingRatio, response)`.

- Polynomials (`:31-48`): easeIn `t²`; easeOut `t(2-t)`; easeInOut `2t²` / `-1+(4-2t)t`.
- **Spring as an easing curve** (`:212-248`): evaluate the damped-oscillator step response at `actualTime = t*duration`
  and **normalize by its own value at `t = 1`** so the curve still lands exactly on 1.0:
  ```
  omega = 2π / max(0.01, response)
  raw(τ) = ζ>=1 : 1 - (1 + ζω·τ)·e^(-ζω·τ)
           ζ<1  : 1 - e^(-ζω·τ)·( cos(ω_d·τ) + (ζω/ω_d)·sin(ω_d·τ) ),  ω_d = ω√(1-ζ²)
  value(t) = raw(t·duration) / raw(duration)
  ```
  Note this is *duration-aware*: the same curve behaves differently over a 0.2 s vs a 2 s segment.
- `applyUnclamped` (`:66-94`) — same but allows overshoot >1, used for the click-release bounce.
- **`derivative(t, duration)`** (`:102-133`, spring case `:137-169`) — analytic derivative of every curve. Only consumer
  today is motion-blur intensity in `FrameEvaluator+Transform.swift:45,66-73`. Worth keeping: it lets you compute
  instantaneous velocity from a keyframe pair without finite differences.
- Cubic bezier uses 10 iterations of Newton-Raphson with ε = 0.0001 to invert x(t) (`:252-293`).
- Presets (`:298-316`): `springDefault (ζ 1.0, r 0.8)`, `springSmooth (1.0, 1.0)`, `springBouncy (0.75, 0.9)`,
  `springSnappy (0.95, 0.5)`; CSS bezier presets at `:303-306`.
- JSON encoding (`:347-404`): `{"type":"spring","dampingRatio":…,"response":…}` etc.; unknown types decode to `.linear`.

### 6.6 Evaluation

`Screenize/Render/FrameEvaluator.swift:72-83` → `{transform, cursor, keystrokes}` at time `t`.
- `.continuous`: binary search + **linear** interpolation between the two bracketing samples
  (`FrameEvaluator+Transform.swift:95-150`). Velocities come from finite differences of the same pair
  (`:134-141`) and feed motion blur.
- `.manual` with no spring cache: `.easeInOut` over the segment, with analytic derivative for velocity (`:35-79`).
- `.manual` with spring cache: treated as `.continuous` (`:22-27`).

---

## 7. CLICK EFFECTS — ripple does NOT exist in the code

The README (line 34), `CLAUDE.md` (lines 145-153), and the marketing site all claim "ripple animations on clicks".
`grep -rn "ripple\|Ripple" --include="*.swift" Screenize/` returns **zero hits**. `RippleGenerator.swift`,
`RippleTrack`, and `RippleKeyframe` were deleted during the segment-pipeline rewrite —
`docs/plans/2026-03-07-remove-segment-pipeline-plan.md:534` explicitly lists `RippleGenerator.swift` for deletion.
The docs were never updated. **There is no ripple algorithm to port from this repo.**

The only ripple geometry in the repo is a pure-CSS marketing mockup,
`website/src/components/mockups/ClickEffectsMockup.astro:192-271` — still a usable spec if newsreel wants one:
```
element:  30×30 px circle, border-radius 50%, 2px solid <accent>, transparent fill,
          centered on the click point (translate -50%,-50%)
keyframes ripple-expand:  0%  → scale(0.5), opacity 0.6
                         100% → scale(2.5), opacity 0
duration 2s, ease-out       # i.e. 15px → 75px diameter
```

### What Screenize actually ships as click feedback: a cursor scale "punch"

`Screenize/Render/FrameEvaluator+ClickState.swift:55-146`, config `Segments.swift:28-40`.

```
mouseDownScale    = 0.75     # shrink to 75%
mouseDownDuration = 0.10 s   # press animation
mouseUpDuration   = 0.25 s   # release animation
mouseUpSpring     = .spring(dampingRatio: 0.92, response: 0.25)   # slight overshoot >1.0

press  (elapsed < 0.10):  scale = 1.0 + (0.75 - 1.0) * easeOutQuad(elapsed / 0.10)
hold   (elapsed >= 0.10): scale = 0.75
release(elapsed < 0.25):  scale = 0.75 + (1.0 - 0.75) * springUnclamped(elapsed/0.25, duration: 0.25)
after:                    scale = 1.0
easeOutQuad(t) = 1 - (1-t)²
```
Left and right buttons are evaluated independently and the value **furthest from 1.0** wins (`:65-67`).
Button state is found by binary search over a time-sorted `mouseButtonEvents` array, then walking backwards for the last
down/up of each button (`:11-50, :86-107`).

**Zoom normalization** (`Screenize/Render/EffectCompositor.swift:10-22`) — the punch would look weaker when the frame is
zoomed, so the depth is boosted by √zoom:
```
depth      = 1 - rawScale
adjusted   = depth * sqrt(max(1, zoom))
finalScale = max(0.1, 1 - adjusted)
```

---

## 8. KEYSTROKE OVERLAY (badges)

### 8.1 Capture

`Screenize/Core/Recording/EventHandlers/KeyboardEventHandler.swift:29-122`. A `CGEvent.tapCreate` session tap
(`.listenOnly`, `.headInsertEventTap`) on keyDown+keyUp. Per event it records
`{timestamp (relative), keyCode, character (via keyboardGetUnicodeString, max 4 UTF-16 units), modifiers}`.
Requires the Input Monitoring permission (preflight at `:31-37`).
Modifier flags model: `Screenize/Models/MouseEvent.swift:153-192` (command/shift/option/control/function/capsLock).

### 8.2 Badge synthesis (the combination logic)

`Screenize/Generators/SmartGeneration/Emission/KeystrokeTrackEmitter.swift:9-159`.
Settings `:165-172` and `GenerationSettings.swift:139-147`.

| Setting | Default |
| --- | --- |
| `enabled` | true |
| `shortcutsOnly` | **true** — plain characters are NOT shown, only chords |
| `displayDuration` | **1.5 s** |
| `fadeInDuration` | **0.15 s** |
| `fadeOutDuration` | **0.3 s** |
| `minInterval` | **0.05 s** — auto-repeat / key-mash suppression |

Algorithm:
1. Collect all `keyDown` events from the `EventTimeline`.
2. **Strip the trailing stop-recording hotkey** (`:31-42`): if the last event is ⌘⇧ with keyCode 19 (`2`), drop it; for
   old recordings where keyCode was lost, drop a trailing ⌘⇧ within 0.5 s of the end. (newsreel doesn't need this, but
   the *idea* — suppress the operator's own control keys — does apply.)
3. Per event:
   - `displayName(keyCode, character)` (`:90-145`). Returns **nil for bare modifier presses**
     (keyCodes 54/55 ⌘, 56/60 ⇧, 58/61 ⌥, 59/62 ⌃, 63 fn) so they never produce a badge of their own — this *is* the
     collapse mechanism. Named keys: 36 ↩, 48 ⇥, 49 space, 51 ⌫, 53 esc, 71 clear, 76 enter, 117 ⌦,
     123-126 ← → ↓ ↑, F1–F12 (122,120,99,118,96,97,98,100,101,109,103,111), 115/119/116/121 home/end/pgup/pgdn.
   - Default branch: uppercase the produced character. **Control-key repair** (`:135-141`): ⌃ produces control
     characters U+0001–U+001A, so add 0x40 to recover the letter (0x03 → 'C').
   - Skip if `shortcutsOnly && !modifiers.hasModifiers`.
   - Skip if `event.time - lastSegment.startTime < 0.05` (auto-repeat).
4. `displayText = modifierSymbols + keyName`, where symbols are emitted in **macOS canonical order ⌃⌥⇧⌘**
   (`:150-159`) regardless of press order. So Shift+Cmd+Z always renders `⇧⌘Z`.
5. Segment = `[t, t + 1.5]`, fades 0.15/0.3.

**Note:** modifiers come from the *flags of the keyDown event itself*, so there is no state machine tracking held
modifiers — one event, one badge. That is why the collapse is trivial.

### 8.3 Opacity envelope

`Screenize/Render/FrameEvaluator+Keystroke.swift:24-37` (and identically `Keyframe.swift:226-241`):
```
elapsed  = t - start;  remaining = end - t
if elapsed   < fadeIn (0.15):  opacity = elapsed / fadeIn        # linear in
if remaining < fadeOut (0.3):  opacity = remaining / fadeOut     # linear out
else opacity = 1.0
```
Purely linear — no easing on the fade.

### 8.4 Badge rendering ("pill")

`Screenize/Render/EffectCompositor.swift:283-389`. All sizes are relative to frame height, so badges scale with output
resolution:
```
fontSize     = max(24, frameHeight * 0.03)          # system font, weight .medium, white
cornerRadius = fontSize * 0.4
paddingH     = fontSize * 0.8
paddingV     = fontSize * 0.4
pillW = textWidth + 2*paddingH ;  pillH = textHeight + 2*paddingV
background   = NSColor(white: 0.1, alpha: 0.75), continuous rounded rect
position     = center at (0.5, 0.95) normalized, y flipped → bottom-center of frame
```
Pills are rendered fully opaque into a bitmap and **cached by display text** (LRU, max 32 entries, invalidated when the
frame size changes, `:43-48, :285-308`); opacity is applied per frame via `CIColorMatrix` scaling all four RGBA channels
(premultiplied alpha) rather than re-rasterizing (`:312-325`).

**Stacking:** multiple active badges are simply composited over one another at the *same* position
(`:262-279`) — they overlap rather than stack vertically. Given `minInterval 0.05 s` and a 1.5 s duration, rapid
shortcuts will pile up. This is a real weakness; newsreel should offset each concurrent badge (or queue them).

---

## 9. CURSOR: rendering, smoothing, motion blur

### 9.1 Custom cursor rendering

`Screenize/Render/CursorImageProvider.swift` — cursors are **drawn as vector paths in Core Graphics at the exact target
pixel height**, not scaled bitmaps, so they stay sharp at any zoom. (`EffectCompositor.getCursorImage` at `:115-152` is
the older NSCursor-bitmap path, still present but superseded.)

- Base design box: 17×25 for the arrow (`:25`); minimum raster height 8 px (`:26`); LRU cache keyed by
  `(style, ceil(pixelHeight))`, max 64 (`:12-19, :50-57`).
- Arrow path (`:158-166`), in design units, is worth copying directly:
  `(1.5,1) → (1.5,18.5) → (5.5,14.5) → (9.5,22.5) → (12,21.5) → (8,13.5) → (13.5,13.5) → close`
  drawn as: drop shadow (offset 0,−1.5, blur 3.0, black @ 0.35) → black fill → **white stroke, width 1.5, round joins**.
  That black-fill/white-stroke combination is what makes a cursor legible over any background.
- Hotspots are normalized fractions of the design box (`:63-83`): arrow `(1.5/17, 1/25)`, pointer `(6.25/19, 1/24)`,
  context menu `(1.5/25, 1/25)`, everything else centered.
- Other styles: I-beam 10×18 with bezier serifs, black 2.5 outline + white 1.2 fill (`:197-248`); crosshair 22×22 with
  4 arms (len 7, gap 2.5) and a 2 px center dot (`:252-300`); hand cursors in
  `Screenize/Render/CursorImageProvider+HandCursors.swift`.

### 9.2 Cursor size

`Screenize/Render/EffectCompositor.swift:199-253`. The cursor is drawn **after** the zoom transform, at output
resolution, so it never inherits upscaling blur:
```
baseCursorHeight  = 28.0 px  (design reference)
effectiveScale    = userScale * zoomNormalizedClickScale(clickScale, zoom)
cursorPixelHeight = 28.0 * effectiveScale * zoomLevel * outputScale
outputScale       = outputHeight / sourceHeight        (screen mode; window mode uses the fit scale)
```
Default user scale: **2.5** on the track (`Track.swift:116`), **2.0** from the smart generator
(`CursorEmissionSettings.cursorScale`, `Emission/CursorTrackEmitter.swift:36`).
Placement: `finalX = outputX - hotspotX*w`, `finalY = outputY - h + hotspotY*h` (bottom-left origin conversion,
`:238-241`).

### 9.3 Smoothing of the raw cursor path

`Screenize/Render/MousePositionInterpolator.swift:23-47`. Two pipelines:

**Spring pipeline (default):** `Catmull-Rom resample → spring follow → dedup`.
**Legacy pipeline (springConfig == nil):** `Gaussian pre-filter (radius 3) → Catmull-Rom → idle stabilization → dedup`.

*Catmull-Rom resample* (`:52-101`, curve at `:324-349`) — cardinal spline with **tension 0.2** (not the usual 0.5;
comment at `FrameEvaluator+Cursor.swift:114` says 0.5 was too loose and 0.2 hugs the real path):
```
m1 = tension * (p2 - p0)
m2 = tension * (p3 - p1)
h(t) = (2t³-3t²+1)·p1 + (t³-2t²+t)·m1 + (-2t³+3t²)·p2 + (t³-t²)·m2
```
Sampled at `frameDuration = 1/outputFrameRate`. Endpoints use **reflected virtual points**
(`p_{-1} = 2p0 - p1`, `:177-203`) so the spline doesn't flatten at the ends. The analytic derivative
(`:297-321`) gives per-sample velocity for free.

*Gaussian pre-filter* (`:127-172`): radius 3, `σ = radius/2 = 1.5`, normalized kernel, edge-clamped, applied to x and y
independently.

*Spring follow* — `Screenize/Render/SpringCursorSimulator.swift:63-176`. Same analytic solver as the camera
(`:227-298`). Config `:30-36`:

| Constant | Value |
| --- | --- |
| `dampingRatio` | **0.90** |
| `response` | **0.06 s** (ω ≈ 104.7 rad/s — very snappy) |
| `adaptiveResponse` | true |
| `adaptiveMaxVelocity` | **4.0** normalized units/s |
| `adaptiveMinScale` | **0.4** |

Adaptive response (`:211-222`): `scale = 1 - (1 - 0.4) * min(speed/4.0, 1)`, `response' = 0.06 * scale`.
Fast flicks get up to 2.5× snappier so the drawn cursor doesn't lag behind the real one.

*Idle stabilization* (`:126-141`): when the frame-to-frame implied velocity < **0.3** units/s, ramp
`idleBlend += dt * 3.0` capped at **0.95** and lerp the target toward the current smoothed position — freezing
sub-pixel jitter. Any real motion resets `idleBlend = 0`.
The legacy variant (`MousePositionInterpolator.stabilizeIdlePositions`, `:210-255`) uses an exponential-decay blend
instead: threshold **0.001**, `decayRate 8.0`, `blend += (1-blend)*(1 - e^{-8·dt})` while idle, `blend *= e^{-8·dt}`
while moving, released below 0.01.

*Camera-relative smoothing* (`SpringCursorSimulator.swift:59-61, 111-165`): when camera transforms are supplied, the
spring runs in **camera-relative space** (`target - cameraCenter`) and the result is converted back. Without this the
cursor visibly "slides" across the frame during a pan, because a world-space spring lags in a moving reference frame.
This is a genuinely non-obvious fix (`docs/plans/2026-03-07-dual-layer-camera-design.md`, "Cursor Rendering").

*Dedup* (`:277-292`): sort by timestamp, drop anything closer than `frameDuration * 0.5`.

At evaluation time the cursor position is interpolated again with Catmull-Rom (tension 0.2) via binary search
(`Screenize/Render/FrameEvaluator+Cursor.swift:37-135`).

### 9.4 Motion blur on fast transitions

Settings: `Screenize/Render/MotionBlurSettings.swift:6-65`.

| Preset | intensity | zoomThreshold | panThreshold | maxRadius |
| --- | --- | --- | --- | --- |
| `default` / `enabled` | **0.2** | **1.0** /s | **0.25** /s | **10.0** px |
| `subtle` | 0.15 | 1.0 | 0.3 | 8.0 |
| `strong` | 0.5 | 0.5 | 0.15 | 20.0 |

Applied in `Screenize/Render/TransformApplicator.swift:75-120`, **after** crop+scale, to the whole frame:
```
shouldZoomBlur = zoomVelocity > zoomThreshold        # zoom units per second
shouldPanBlur  = panVelocity  > panThreshold         # normalized units per second
if neither: skip

if shouldPanBlur && panVelocity > zoomVelocity * 0.3:      # pan-dominant
    baseRadius = (panVelocity - panThreshold) * 30.0
    angle      = panDirection            # atan2(dy, dx), radians
else:                                                       # zoom-dominant
    baseRadius = (zoomVelocity - zoomThreshold) * 8.0
    angle      = 0                       # horizontal
radius = min(baseRadius * intensity, maxRadius)
if radius <= 2.0: skip                   # sub-2px blur is invisible, not worth the filter
CIMotionBlur(inputRadius: radius, inputAngle: angle)
```
Velocities come from the timeline, not the pixels: finite differences of adjacent `TimedTransform` samples
(`FrameEvaluator+Transform.swift:134-141`) or `easing.derivative * Δvalue / duration` for manual segments (`:66-73`).
The blur is a **directional blur of the composited frame**, i.e. a cheap approximation, not accumulation of
sub-frame samples. Note the cursor and keystroke overlays are composited *after* the transform
(`Renderer.swift:96-165`) and therefore are **never** motion-blurred.

---

## 10. FRAME / STYLE (backgrounds, corners, shadows, padding)

These only apply in **window mode** (`isWindowMode == captureMeta.displayID == nil`,
`Screenize/Project/ScreenizeProject.swift:97-99`). Screen recordings are rendered edge-to-edge.

Settings (`Screenize/Project/RenderSettings.swift:30-49`):

| Setting | Default |
| --- | --- |
| `backgroundEnabled` | false |
| `backgroundStyle` | `.gradient(defaultGradient)` |
| `cornerRadius` | **22.0** |
| `shadowRadius` | **40.0** |
| `shadowOpacity` | **0.7** |
| `padding` | **40.0** |
| `windowInset` | **0.0** (trim borders off the captured window) |

### 10.1 Composition order

`Screenize/Render/WindowModeRenderer.swift:49-132`:
1. normalize the source extent origin to (0,0) — CIImage scales about its origin and a non-zero origin causes drift
   (`:56-67`)
2. apply `windowInset` crop, re-normalize origin (`:69-91`)
3. render/fetch the cached background at output size (`:93-102, 144-161`; cache key = style + size)
4. window transform (fit scale + zoom + offset) — `WindowTransformApplicator`
5. **effects with scale-corrected radii** (`:114-128`):
   ```
   baseScale  = min((outW - 2*padding)/srcW, (outH - 2*padding)/srcH)
   finalScale = baseScale * transform.zoom
   effectiveCornerRadius = cornerRadius * finalScale
   effectiveShadowRadius = shadowRadius * finalScale
   ```
   This is the detail that makes zoomed framing look right: corner radius and shadow must scale with the window or the
   corners visibly change shape as you zoom.
6. composite window over background.

### 10.2 Rounded corners + shadow

`Screenize/Render/WindowEffectApplicator.swift:30-186`.
- **Corners**: build an 8-bit grayscale mask via CGContext — black fill, then a white
  `Path(roundedRect:cornerRadius:style: .continuous)` (Apple's squircle, not a circular arc) — then
  `CIBlendWithMask(image, background: clear, mask)` (`:76-142`).
- **Shadow** (`:145-186`): tinted silhouette `CIImage(color: black @ shadowOpacity)` combined with the window through
  **`CISourceInCompositing`** — the comment at `:157-159` is worth heeding: using luminance instead of alpha gives the
  wrong silhouette. Then `CIGaussianBlur(radius)`, then translate by `(0, -shadowOffsetY)` with
  `shadowOffsetY = 10` (default param, `:35`; negative y because CoreImage y is up). Window is composited over shadow.

### 10.3 Backgrounds

`Screenize/Render/BackgroundRenderer.swift:28-125`. Three kinds:
- `.solid(Color)` → `CIImage(color:)` cropped to size.
- `.gradient(GradientStyle)` → **`CILinearGradient`** between `colors.first` and `colors.last` — note only two stops are
  honored even though the model allows N (`:57-58`). Start/end are `UnitPoint`s converted to pixels **with a y flip**
  (`:65-76`).
- `.image(URL)` → scale-to-fill (`scale = max(sx, sy)`), center-crop, translate back to origin (`:91-119`).

Gradient presets (`Screenize/Models/BackgroundStyle.swift:81-113`), all topLeading→bottomTrailing:

| Name | Colors |
| --- | --- |
| `defaultGradient` | `#667eea → #764ba2` |
| `sunset` | `#ff6b6b → #feca57` |
| `ocean` | `#667eea → #00d2d3` |
| `forest` | `#11998e → #38ef7d` |
| `midnight` | `#232526 → #414345` |

`BackgroundStyle` serializes as a single string: `"solid:#RRGGBB"` / `"gradient:<hex,hex>|sx,sy|ex,ey"` /
`"image:<url>"` (`:8-40, 48-50, 118-156`).

---

## 11. EXPORT

`Screenize/Render/ExportEngine.swift:53-73` dispatches to video or GIF.

### 11.1 Video pipeline (AVFoundation + CoreImage/Metal)

`Screenize/Render/ExportEngine+VideoExport.swift:20-178`:
1. `VideoFrameExtractor` → natural size + frame rate
2. load raw + smoothed mouse data (`MouseDataConverter`)
3. output size from `outputResolution.size(sourceSize:)`
4. `RenderPipelineFactory.createExportPipeline` → `(FrameEvaluator, Renderer)` with a Metal-backed `CIContext`
5. `SequentialFrameReader` over the trim range, wrapped in `CFRFrameReader`
6. `AVAssetWriter` + `AVAssetWriterInputPixelBufferAdaptor` (BGRA, Metal-compatible, IOSurface-backed)
7. **audio is written concurrently with video** in a separate `Task` — the comment at `:99-101` records a real
   deadlock: `AVAssetWriter` blocks when one input starves while another fills, so both must be fed in parallel
8. `processFrames` uses `requestMediaDataWhenReady` on a dedicated queue; for each output index,
   `idealTime = trimStart + i/outputFrameRate`, pull the CFR frame, `evaluator.evaluate(at:)`,
   `renderer.renderToPixelBuffer`.

**Rendering order (portable):** `Renderer.render`, `Screenize/Render/Renderer.swift:69-168` —
(1) transform (crop→scale→motion blur, or window-mode composite), (2) **cursor composited after the transform** at
output resolution, (3) **keystroke overlay composited last**, in fixed screen space. Overlays are never zoomed, never
blurred, never resampled. This is exactly how a headless pipeline should be layered.

Output targets: `CVPixelBuffer` (`:178-238`), `MTLTexture` (`:250-268`), `CGImage` (`:277-289`).

### 11.2 Formats and settings (`Screenize/Project/RenderSettings.swift`)

- **Resolutions** (`:147-196`): original, 4K UHD 3840×2160, QHD 2560×1440, FHD 1920×1080, HD 1280×720, or custom.
  Custom is validated to 2…7680 × 2…4320 and **rounded up to even** dimensions (`:188-195`).
- **Frame rates** (`:200-236`): original, 24, 30, 60, 120, **240**; custom validated 1…240 (`:232-235`).
- **Codecs** (`:240-284`): `h264` / `hevc` (default) → `.mp4`; `proRes422` / `proRes4444` → `.mov`.
- **Quality → bitrate** (`:288-319`): `bitrate = width * height * multiplier`, multiplier
  low 2.0 / medium 4.0 / high 8.0 (default) / original 12.0. (Note: frame rate is *not* in the formula.)
- **Color spaces** (`:384-449`): auto/sRGB, Display P3, BT.709, BT.2020. Each maps to a `CGColorSpace` for CIContext
  rendering plus AVFoundation `colorPrimaries` / `transferFunction` / `YCbCrMatrix`.
  Transfer function is **always** `ITU_R_709_2` (`:428-430`) — so BT.2020 here is wide-gamut primaries, not HDR/PQ.
  Primaries: 709 for sRGB/BT709, `P3_D65` for Display P3, `ITU_R_2020` for BT2020; matrix 709 except BT2020.
- **Audio** (`Screenize/Render/AudioMixer.swift:12-17`): AAC, 48 kHz, 2 ch, 128 kbps. System and mic are separate
  sidecar files, mixed with independent volumes (`systemAudioVolume`, `microphoneAudioVolume`, both default 1.0) or
  passed through when only one exists (`ExportEngine+VideoExport.swift:260-295`).

### 11.3 GIF

`Screenize/Render/ExportEngine+GIFExport.swift:9-138` + `Screenize/Render/GIFEncoder.swift:7-96`
(ImageIO `CGImageDestination`, `UTType.gif`).
`GIFSettings` (`RenderSettings.swift:339-379`): `frameRate 15`, `loopCount 0` (infinite), `maxWidth 640`.
Presets: compact 10 fps/480, balanced 15/640, highQuality 20/960. `effectiveSize` scales by width and forces an **even**
height (`:359-366`). Loop count is set once as a file property; delay per frame is set as both `GIFDelayTime` and
`GIFUnclampedDelayTime`. The whole render pipeline is constructed at the *GIF* output size, so overlays are laid out for
the small frame rather than downscaled.

---

## 12. RECORDING / EVENT CAPTURE

### 12.1 Screen capture

ScreenCaptureKit. `Screenize/Core/Capture/CaptureConfiguration.swift`:
`width/height` (target size × `scaleFactor`, default **2.0** for Retina), `frameRate` (default 60),
`pixelFormat kCVPixelFormatType_32BGRA`, `showsCursor` **false** (the cursor is re-drawn synthetically at export —
this is the key trick that lets the cursor be smoothed, scaled and styled), `capturesAudio` true.
`config.minimumFrameInterval = CMTime(1, frameRate)` (`:65`). Presets: 4K60/2.0, 1080p30/1.0, 720p30/1.0 (`:41-58`).
Windows smaller than 50×50 and Screenize's own / Dock / Control Center / WindowManager windows are filtered from the
source list (`Screenize/App/CaptureSettings.swift:64-80`).

### 12.2 Variable frame rate

`Screenize/Core/Recording/VFRRecordingManager.swift` (the current path; `CFRRecordingManager` is deprecated,
`CFRRecordingManager.swift:9`). Frames are written **at their real capture PTS**, rebased so the first frame is t=0
(`:30-34`), and **duplicate frames are skipped by comparing IOSurface IDs** (`:36-37`) — a static screen writes almost
nothing. Encoder: HEVC in `.mov`, keyframe interval = frameRate (1 s), bitrate
`20 Mbps × max(1, frameRate/60)` (`:89-103`). System audio goes to a **sidecar file**, not the video container
(`:108-114`).

Playback/export re-derives a constant-rate stream: `Screenize/Render/CFRFrameReader.swift:33-56` holds the latest
frame whose PTS ≤ the requested time and buffers a one-frame lookahead, so consumers see a gap-free stream at any
requested fps. **This hold-last-frame idea is directly reusable** if newsreel ever captures at variable rate.

### 12.3 Input events

`Screenize/Core/Recording/MouseDataRecorder.swift`.

| Stream | Mechanism | Rate / threshold | File |
| --- | --- | --- | --- |
| Cursor position | `Timer` polling `NSEvent.mouseLocation` | `1/min(captureFrameRate, 120)` — **60 Hz default, capped at 120 Hz** (`:49-51`) | `:255-286` |
| UI state | `Timer` + AXUIElement hit-test | **1 Hz** (`:24`) | `:229-253` |
| Clicks | `NSEvent` global+local monitor, down/up paired | min duration **50 ms** (`ClickEventHandler.swift:96`) | `EventHandlers/ClickEventHandler.swift` |
| Keys | `CGEvent` session tap | every keyDown/keyUp | `EventHandlers/KeyboardEventHandler.swift` |
| Scroll | `NSEvent .scrollWheel` | ignores `|Δ| <= 0.1` on both axes (`ScrollEventHandler.swift:38`) | `EventHandlers/ScrollEventHandler.swift` |
| Drag | `NSEvent .leftMouseDragged` | emitted only if total distance **>= 10 px** (`DragEventHandler.swift:66`) | `EventHandlers/DragEventHandler.swift` |

- Timestamps are `ProcessInfo.processInfo.systemUptime - recordingStartTime` (monotonic, seconds, relative to
  recording start) — used consistently everywhere.
- Per-sample velocity in px/s is computed at capture time (`:263-270`) but the analysis layer recomputes its own.
- Pending clicks/drags are finalized **before** monitors are removed so in-flight mouseUps still land
  (`:99-102`); unfinished clicks get `duration = recordingDuration - start` rather than a fake 0.1 s
  (`ClickEventHandler.swift:110-131`).
- Accessibility: `AccessibilityInspector.elementAt(screenPoint:)` and `focusedElementCaretBounds()` supply
  `{role, subrole, title, applicationName, frame, isClickable}` and caret rects — these are what make element-sized
  zoom possible.

### 12.4 On-disk formats

**Legacy v2** — one JSON blob `<video>.mouse.json` / `<video>_mouse.json`
(`Screenize/Models/MouseEvent.swift:322-520`, `MouseRecording`):
```
{ positions[{timestamp,x,y,velocity}], clicks[{id,timestamp,x,y,type,duration,targetElement}],
  scrollEvents[{timestamp,x,y,deltaX,deltaY,isTrackpad}],
  keyboardEvents[{timestamp,type,keyCode,character,modifiers{...}}],
  dragEvents[{startTimestamp,endTimestamp,startX,startY,endX,endY,type}],
  uiStateSamples[{timestamp,cursorPosition,elementInfo,caretBounds}],
  screenBounds, recordingDuration, frameRate, scaleFactor, createdAt }
```
Coordinates here are **capture-relative pixels**. Query helpers (binary search by time, range filters) at `:377-519`.

**v4 "polyrecorder" event streams** — the canonical format, one file per stream inside the package
(`Screenize/Models/EventStream.swift:7-72`, writer `Screenize/Core/Recording/EventStreamWriter.swift:11-179`):
```
metadata.json      { formatVersion 2, recorderName, recorderVersion, createdAt(ISO8601),
                     processTimeStartMs, processTimeEndMs, unixTimeStartMs,
                     display{ widthPx, heightPx, scaleFactor } }
mousemoves-0.json  [{ type:"mouseMoved", processTimeMs, unixTimeMs, x, y, cursorId, activeModifiers[], button }]
mouseclicks-0.json [{ type:"mouseDown"|"mouseUp", processTimeMs, unixTimeMs, x, y, button:"left"|"right",
                      activeModifiers[], element{Role,Subrole,Title,AppName,FrameX/Y/W/H,IsClickable} }]
keystrokes-0.json  [{ type:"keyDown"|"keyUp", processTimeMs, unixTimeMs, keyCode, character,
                      isARepeat, activeModifiers[] }]
uistates-0.json    [{ processTimeMs, unixTimeMs, cursorX, cursorY, element…, caretX/Y/W/H }]
```
Design notes worth stealing: **two clocks per event** (monotonic `processTimeMs` for timeline math, `unixTimeMs` for
correlating with other tools); coordinates are **display-local pixels with top-left origin** and are multiplied by
`scaleFactor` on write (`EventStreamWriter.swift:91-92`); a click is stored as *two* events (down and up) rather than
one with a duration; `activeModifiers` is a string array (`["command","shift",…]`,
`Screenize/Models/EventStream.swift:76-87`).

**Adapter back to normalized space** — `Screenize/Models/EventStreamAdapter.swift:22-135`:
```
timelineSec = (processTimeMs - metadata.processTimeStartMs) / 1000
xNorm       = x / display.widthPx
yNorm       = 1.0 - (y / display.heightPx)          # flip to bottom-left origin
```
**Drag synthesis** (`:139-227`) — the v4 stream has no drag events, so they are inferred: pair each left mouseDown with
the next left mouseUp, gather ≥2 mouse moves in between, compute the max displacement from the down position, and emit a
drag if it exceeds `dragDistanceThreshold = 0.02` normalized (≈30 px on a 1512 px display). End position = last move in
range.

**Project package** — `MyProject.screenize/` containing `project.json` (`ScreenizeProject` v5:
`{id, version, name, createdAt, modifiedAt, media, captureMeta, timeline, renderSettings, frameAnalysisCache,
frameAnalysisVersion, interop, generationSettings}`, `Screenize/Project/ScreenizeProject.swift:6-100`) and
`recording/` with the video, sidecar audio and event streams. Media paths are stored **relative** and resolved at load.

### 12.5 Building the unified analysis stream

`Screenize/Generators/SmartGeneration/Analysis/EventTimeline.swift:22-110`.
All sources merged into one time-sorted `[UnifiedEvent { time, kind, position, metadata }]`.
- Mouse moves are **downsampled to ~10 Hz** (`mouseMoveDownsampleInterval = 0.1 s`, `:18, :29-42`) — the classifier
  does not need 60 Hz.
- Keyboard events and UI samples have no position of their own, so they inherit the **last mouse position at or before**
  their timestamp (`:62-64, :91-92, :159-164`).
- Drags emit both `dragStart` and `dragEnd`.
- Range queries use binary search for the lower bound then a linear scan (`:121-142`).

---

## 13. Other user-facing behavior

- **Presets**: `RenderSettingsPreset {id, name, settings, createdAt, sortOrder}`
  (`Screenize/Project/RenderSettingsPreset.swift:4-39`), persisted as
  `~/Library/Application Support/Screenize/render_presets.json` (`Screenize/Project/PresetManager.swift:72-82`).
  Presets capture the *entire* `RenderSettings` blob — resolution, codec, quality, color space, background, corners,
  shadow, padding, motion blur, audio volumes. Reorderable with recomputed `sortOrder` (`:64-68, 85-89`).
- **Generation settings**: `GenerationSettings` (`Screenize/Generators/GenerationSettings.swift:16-147`) is stored
  app-wide and **optionally overridden per project** (`ScreenizeProject.generationSettings: GenerationSettings?`,
  resolved by `GenerationSettingsManager.effectiveSettings(for:)`). Every camera constant listed in this document is
  exposed there. That "global defaults + per-project override, all one Codable struct" shape is exactly what a
  config-driven CLI wants.
- **Per-segment overrides** (editor): start/end zoom and start/end center per `.manual` camera segment, plus
  "copy from previous / next segment" to chain holds
  (`Screenize/Views/Inspector/InspectorView+CameraSection.swift:57-127`). Zoom slider range is 1–5 (`:168`).
  `.continuous` segments expose nothing — they are a black box (`:29`).
- **Selective regeneration**: `runSmartGeneration(for: Set<TrackType>)` regenerates only chosen tracks and preserves the
  rest (`EditorViewModel+SmartGeneration.swift:9-13, 88-93`).
- **Audio**: separate system and mic tracks, per-segment `volume` + `isMuted`, plus global
  `includeSystemAudio` / `includeMicrophoneAudio` / volume multipliers in `RenderSettings`.
- **Trim**: `trimStart` / `trimEnd` on the Timeline drive both the frame reader range and the audio time range.
- **Frame analysis cache**: `VideoFrameAnalyzer` (`Screenize/Analysis/VideoFrameAnalyzer.swift`) samples **1 fps**
  (`AnalysisSettings.sampleRate = 1.0`, `:34-41`) and computes per frame:
  Vision feature-print distance → `similarity`, frame difference → `changeAmount`, optical flow →
  `motionVector` + `isScrolling` (thresholds `scrollThreshold 50`, `scrollDirectionCoherence 0.8`), and
  `saliencyCenter`. Cached into `project.frameAnalysisCache` with a `frameAnalysisVersion` for invalidation. Only
  `saliencyCenter` is actually consumed (30 % center blend, §4.3).
- **Localization**: 6 languages; every user-visible string goes through `L10n.string(key, defaultValue:)`.
- **Global hotkey** ⌘⇧2 to toggle recording (`Screenize/App/GlobalHotkeyManager.swift`), which is why the emitter
  strips a trailing ⌘⇧-keyCode-19 badge.

---

## 14. What transfers to a headless pipeline

### Directly liftable (pure math over event data — no macOS API)

| Algorithm | Source | Why it ports |
| --- | --- | --- |
| **Analytic spring step** | `SpringDamperSimulator.swift:348-381` | ~20 lines of `exp/cos/sin`, frame-rate independent, exact. Reimplement in TS verbatim. Use `ω = 2π/response` so the config knob stays human-meaningful. |
| **Dead-zone targeting + hysteresis + smoothstep band** | `DeadZoneTarget.swift:40-141` | Pure geometry in normalized space. The single highest-value idea here: target the dead-zone edge with partial correction, never the cursor. |
| **`clampCenter`** (`halfCrop = 0.5/zoom`) | `ShotPlanner.swift:462-470` | Three lines; guarantees the crop never leaves the frame. Apply at every stage, like Screenize does. |
| **Soft boundary pushback** | `SpringDamperSimulator.swift:277-318` | Prevents the "hitting a wall" look at frame edges. |
| **Adaptive response from look-ahead** | `AdaptiveResponse.swift:11-45` | newsreel *is* fully scripted, so `timeToNextAction` is known exactly — this is easier there than in Screenize. |
| **Urgency multipliers + smoothstep blending** | `ContinuousCameraTypes.swift:115-120`, `SpringDamperSimulator.swift:124-133` | Maps cleanly onto "shot kinds" in a script. |
| **`zoom = targetAreaCoverage / max(w,h)`** | `ShotPlanner.swift:166-228` | The whole zoom-sizing model. In newsreel the element rect comes free from Playwright (`boundingBox()`), which is *strictly better* input than macOS accessibility. |
| **Per-activity zoom ranges + context-change pullback** | `ShotPlanner.swift:66-83, 537-554` | Ship as a config table; the `1/sqrt(expansionRatio)` pullback is a nice touch for modals. |
| **Transition/hold split + travel-time clamp** | `SegmentPlanner.swift:140-280` | Best fit for a shot-script model: each shot = optional move segment + hold segment, move duration clamped 0.15–0.8 s. |
| **Velocity carry-over across segments + hold damping (×0.3)** | `SegmentSpringSimulator.swift:64-102` | Removes the need for explicit crossfades between shots. |
| **Duration-scaled + speed-coupled response** | `SegmentSpringSimulator.swift:23-31, 96-102` | `max(base, duration*0.4)` makes the move fill its slot instead of snapping and waiting. |
| **Zoom-transition optimizer (yo-yo removal)** | `WaypointGenerator.swift:505-549` | Applies to any generated shot list, scripted or observed. |
| **Idle inheritance with decay** (`1 + (z-1)*0.5`) | `ShotPlanner.swift:89-102` | Keeps the camera from slamming back to 1.0 between beats. |
| **Anticipation / lead time** | `IntentClassifier.swift:49-61`, `WaypointGenerator.swift:116-126` | Trivially portable and disproportionately effective: typing 0.4+0.16 s, click 0.15+0.08 s, drag/scroll/switch 0.25 s. |
| **Catmull-Rom resample, tension 0.2, reflected endpoints** | `MousePositionInterpolator.swift:52-101, 177-203, 324-349` | Needed if newsreel synthesizes cursor paths between scripted points. |
| **Cursor spring with adaptive response** | `SpringCursorSimulator.swift:30-36, 211-222` | ζ 0.90 / response 0.06 s / adaptive to 0.4× at 4.0 units/s. |
| **Camera-relative cursor smoothing** | `SpringCursorSimulator.swift:111-165` | Non-obvious; without it the cursor slides during pans. |
| **Idle stabilization blends** | `SpringCursorSimulator.swift:126-141`, `MousePositionInterpolator.swift:210-255` | Kills sub-pixel jitter when the pointer is parked. |
| **Easing library incl. duration-aware normalized spring and analytic derivatives** | `EasingCurve.swift:25-293` | Drop-in for a Remotion/keyframe layer. The `raw(t·D)/raw(D)` normalization trick is the important part. |
| **Motion-blur trigger + radius formula** | `TransformApplicator.swift:75-120`, `MotionBlurSettings.swift:6-65` | Thresholds and the ×30 / ×8 radius scalings map onto any directional-blur filter, e.g. ffmpeg or a Remotion shader. Skip-below-2px is a good cheap guard. |
| **Keystroke badge synthesis** | `KeystrokeTrackEmitter.swift:90-159` | Modifier→symbol table, canonical ⌃⌥⇧⌘ order, nil-for-bare-modifier collapse, control-char repair, 0.05 s repeat suppression, 1.5 s / 0.15 / 0.3 envelope. Keycodes are macOS-specific but the *structure* is exactly right. |
| **Pill geometry as a function of frame height** | `EffectCompositor.swift:340-389` | `font = max(24, h*0.03)`, `radius = font*0.4`, `padH = font*0.8`, `padV = font*0.4`, bg `rgba(26,26,26,0.75)` — reproduce in CSS/SVG in one line each. |
| **Click "punch" scale envelope** | `FrameEvaluator+ClickState.swift:113-140` | 0.75 / 0.10 s easeOutQuad down, 0.25 s spring(0.92, 0.25) up, plus the √zoom depth normalization. |
| **Overlay compositing order** | `Renderer.swift:69-168` | Transform first, then cursor, then badges — overlays never zoom or blur. This is the rule that makes overlays look crisp. |
| **Window-mode anchor interpolation** (`A = center*zoom`) | `Keyframe.swift:75-99` | Required whenever you scale a framed window over a background. |
| **Style geometry** | `RenderSettings.swift:36-49`, `WindowModeRenderer.swift:114-128` | corner 22, shadow 40 @ 0.7, padding 40, shadow offset y 10, **and the `radius * finalScale` correction**. |
| **Gradient presets** | `BackgroundStyle.swift:81-113` | Five hex pairs; use as-is. |
| **Config shape**: one Codable settings struct, global default + per-project override | `GenerationSettings.swift:16-147`, `PresetManager.swift` | Precisely the newsreel config model. |
| **Two-clock event schema** (`processTimeMs` + `unixTimeMs`, normalized-by-display coords) | `EventStream.swift:7-72`, `EventStreamWriter.swift:80-179` | Good schema for newsreel's own capture log. |
| **Held-frame CFR reader** | `CFRFrameReader.swift:33-56` | If capture is variable-rate, this converts to CFR without decoding twice. |

### macOS-specific — replace, don't port

| Concern | Screenize | newsreel equivalent |
| --- | --- | --- |
| Screen/window capture | ScreenCaptureKit, `SCStream`, IOSurface dedup | Playwright video / `page.screenshot()` loop / CDP screencast |
| Input capture | `CGEvent.tapCreate`, `NSEvent` monitors, TCC permissions | You *author* the actions — synthesize the event log from the script; no permissions, no polling, no jitter |
| Element geometry | AXUIElement hit-testing, `AXTextField`/`AXTextArea` roles, caret bounds | `locator.boundingBox()`, DOM roles, `getClientRects()` for carets. Strictly more reliable |
| Typing sub-context detection | app bundle-id / role keyword matching (`IntentClassifier.swift:224-275`) | Not needed — the script declares the shot type. Keep only the *zoom range table*, drop the inference |
| App-switch detection + fuzzy bundle-id matching | `IntentClassifier.swift:374-411, 715-783` | Page/route navigation is an explicit event in the script |
| Drag inference from down/move/up | `EventStreamAdapter.swift:150-227` | Scripted drags are explicit |
| Cursor images | `CGContext` vector paths, `NSCursor` hotspots | Redraw the same paths as SVG — the coordinates in `CursorImageProvider.swift:158-166` transfer verbatim; only the drawing API changes |
| Rendering | CoreImage filters (`CIMotionBlur`, `CIGaussianBlur`, `CIBlendWithMask`, `CISourceInCompositing`, `CILinearGradient`) on Metal | ffmpeg filters (`crop`,`scale`,`zoompan`,`gblur`,`overlay`) or Remotion/CSS. Note `Path(…, style: .continuous)` squircles have no ffmpeg equivalent — approximate with CSS `border-radius` or an SVG mask |
| Encoding | AVAssetWriter, AAC 48k/128k, ProRes | ffmpeg `libx264`/`libx265`/`prores_ks`, `aac` |
| Color management | `CGColorSpace` + AVFoundation primaries/transfer/matrix | ffmpeg `-colorspace/-color_primaries/-color_trc`. Note Screenize always uses the 709 transfer function — no HDR |
| Vision saliency & optical flow | `VNGenerateAttentionBasedSaliencyImageRequest`, feature prints | Drop it. The 30 % saliency blend only fires when element info is missing, and in a browser you always have element info |
| GIF | ImageIO `CGImageDestination` | ffmpeg `palettegen`/`paletteuse` (better quality than ImageIO's default quantization) |

### Traps and gaps found in the code — do better than Screenize

1. **Ripple is vaporware.** README/CLAUDE.md/website advertise it; the code has none. Build it fresh (the CSS mockup in
   `website/src/components/mockups/ClickEffectsMockup.astro:263-271` is the only spec: scale 0.5→2.5, opacity 0.6→0,
   2 s ease-out, 30 px ring, 2 px border).
2. **Badges overlap instead of stacking.** `EffectCompositor.renderKeystrokeOverlay:262-279` composites every active
   badge at the same point. With `minInterval 0.05 s` and 1.5 s duration, fast shortcuts turn to mush. Offset or queue.
3. **Mixed y-origin conventions** (§0). Pick one and convert at the boundary.
4. **Design docs have drifted from the code** — `2026-03-09-dead-zone-camera-design.md` lists ζ 1.0 / gradient 0.10 /
   correction 0.60 where the code ships 0.90 / 0.25 / 0.45. Use the code values in this document.
5. **Dead code that is nonetheless a good design**: `MicroTracker` (idle re-centering),
   `WaypointGenerator.typingDetailWaypoints` / `activityDetailWaypoints` (mid-span anchor keyframes),
   `CursorFollowConfig`, `.navigating` and `.reading` intents (defined with zoom ranges but never emitted).
6. **Bitrate ignores frame rate** (`ExportQuality.bitRate`, `RenderSettings.swift:314-318`) — a 240 fps export gets the
   same bitrate as 24 fps. Fix in newsreel.
7. **Motion blur is a post-hoc directional blur of the final frame**, not accumulated sub-frame sampling. Cheap and
   convincing, but it does not blur overlays and cannot blur *content* motion (only camera motion). Acceptable
   trade-off; just know what it is.
8. **Only 2 gradient stops are honored** despite the model allowing N (`BackgroundRenderer.swift:57-58`).
9. **`navigatingMinClicks` and `idleThreshold` are declared but unused**; `emitClickGroup` emits one span per click
   regardless of grouping (`IntentClassifier.swift:455-477`). Grouping only gates the `.navigating` label that is never
   produced.
