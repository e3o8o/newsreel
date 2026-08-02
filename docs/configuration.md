# Configuration

The full config contract. Everything project-specific lives in one `newsreel.config.json`;
`npx newsreel init` writes a commented working copy of all of this.


One file per project. `newsreel init` writes a commented reference copy. Comments and
trailing commas are fine: the loader strips them before parsing, so the documentation can live
next to the values.

The config is discovered as **`newsreel.config.json`** in the current directory. Every command
takes `--config <path>` to point somewhere else, which is also how you keep more than one (a
short cut and a long cut, say) side by side.

The config is validated in full when it loads, before a browser opens or a credit is spent.
Errors are reported together, each naming the key and what would have broken.

### Top level

| Key | Required | What it is |
| --- | --- | --- |
| `project` | yes | The kicker printed on every card. |
| `baseUrl` | yes | Where the app runs for capture. An http(s) URL. Never production. |
| `output.workDir` | yes | Persistent intermediates: session, clips, cards, cached bed. |
| `output.videoDir` | yes | Finished videos land in `<videoDir>/<YYYY-MM-DD>/`. |
| `output.reportDir` | no | Where you keep the written report. The CLI never writes here. |
| `auth.storageState` | yes* | Where the saved session is written. *Not needed with `auth.profile`. |
| `auth.profile` | no | A persistent Chromium profile directory; see the session-modes note below. |
| `auth.loginPath` | yes | Your sign-in path, e.g. `/sign-in`. |
| `auth.readyPath` | yes | The path that means "logged in". Must start with `/`. |
| `seed.command` | no | Informational only. The CLI never runs it. |
| `capture.viewport` | no | `{ width, height }`, default `1440x900`. Both must be even. |
| `capture.zoom` | no | Browser-zoom emulation, 0.3 to 2. At `0.8` more UI fits on camera. |
| `capture.hideCss` | no | CSS injected into every shot, to keep dev chrome off camera. |
| `style.*` | no | The styled frame (assemble). See below. |
| `voice.*` | no | Narration. Default `none`. See the provider matrix. |
| `music.*` | no | The bed. Omit the block entirely for `procedural`. |
| `video.*` | no | Title, target length, max speed, poster. |
| `compose.*` | no | The Remotion renderer's palette and pacing. See Composing below. |
| `shots[]` | yes | The scenes. The only part that changes each cycle. |
| `closingCard` | no | A card for non-visual wins. Omit to end on the last shot. |

`seed.command` is recorded, not executed. Demo data is inherently app-specific, so you run the
command yourself before capturing. Re-run it before every clean re-capture: interactive shots
consume seeded state, and each confirm burns a pair.

**Session modes.** With `auth.storageState` (the default), every shot records in a fresh
context seeded from a saved state file; that suits cookie sessions that stay valid at rest.
With `auth.profile`, `login` signs you into a persistent Chromium profile and every shot is a
page inside it. Use the profile when the auth provider rotates tokens on use -- Clerk dev
instances do -- because a static state file goes stale after its first handshake, while a real
profile absorbs each rotation. One sign-in keeps the profile valid across runs.

### style

| Key | Default | What it is |
| --- | --- | --- |
| `background` | `#0f172a` | `{ preset }`, or `{ type: "gradient", from, to, angle }`, or `{ type: "solid", color }`. |
| `padding` | `0` | Margin around the clip. `2 * padding` must be less than the short edge. |
| `radius` | `0` | Corner radius on the clip. |
| `shadow` | `0.35` | 0 to 1. The alpha of a fixed `0 24px 64px` drop shadow. |
| `accent` | `#22c55e` | Cards and lower-thirds. |
| `theme` | `dark` | `dark` or `light`. Drives the card and caption palette. |

### video

| Key | Default | What it is |
| --- | --- | --- |
| `title` | `What shipped this week` | The title card headline. |
| `narration` | `title` | The title card's voiceover. |
| `targetSeconds` | none | A soft target. Only warns; narration drives real length. |
| `maxSpeed` | `3` | Clips speed between 1.5x and this to fit their narration. |
| `thumbnail` | `true` | Writes `thumbnail.jpg` from the title card. |

### shots[]

| Key | Required | What it is |
| --- | --- | --- |
| `id` | yes | Names the clip and lower-third. Unique; it becomes a filename. |
| `route` | yes | The path to film, resolved against `baseUrl`. |
| `caption` | no | The lower-third text. Omit for a clip with no caption. |
| `narration` | no | Drives this section's length and its voiceover. Falls back to `caption`. |
| `tag` | no | The coloured label on the caption. Defaults to `id`. |
| `actions[]` | no | What to do on the page. |
| `motion` | no | Ken Burns for this shot: `{ "type": "in-out" \| "in", "to": 1.07, "focus": [x, y] }`. |
| `trimBefore` | no | Seconds to cut from the clip's start (compose), when the auto-trim can't see the lead. |
| `speed` | no | Pin this clip's playback rate (compose) instead of fitting it to the narration. |

Actions: `waitFor`, `click`, `fill`, `type`, `wait`, `scroll`, `press`.

| Type | Keys |
| --- | --- |
| `waitFor` | `selector`, optional `state` (`visible` default), `timeout` |
| `click` | `selector`, `timeout` |
| `fill` | `selector`, `value`, `timeout` |
| `type` | `selector`, `value`, optional `delay` ms/keystroke (default 90), `timeout` |
| `press` | `key`, optional `selector`, `timeout` |
| `wait` | `ms` (default 1000) |
| `scroll` | optional `selector` (scrolls it into view), else `x` / `y` wheel deltas |

`fill` sets the value in one go; `type` presses real keys one `delay` apart. Use `type` when
typing should read on camera or when a debounced autocomplete only opens on genuine key
events. `type` appends -- when the field pre-fills, clear it first with
`{ "type": "press", "key": "Meta+a" }` then `{ "type": "press", "key": "Backspace" }`.

`selector` accepts CSS or any Playwright engine: `text=Confirm`, `role=button[name=Save]`.

```jsonc
{
  "id": "reconcile",
  "tag": "Reconciliation",
  "route": "/reconciliation",
  "caption": "One-click reconciliation",
  "narration": "Matching a payment to its invoice is now a single click.",
  "actions": [
    { "type": "waitFor", "selector": "[data-testid=perfect-match]" },
    { "type": "click", "selector": "[data-testid=confirm-match]" },
    { "type": "wait", "ms": 1500 }
  ]
}
```

## Backgrounds

`newsreel presets` lists 16 gradients and 12 solids, each usable by id:

```jsonc
"style": { "background": { "preset": "deep-ocean" } }
```

The palette is BetterShot's, lifted from its source as values rather than forked as code, so the
frames match its look. `angle` overrides a gradient preset's own angle. For something custom:

```jsonc
"style": { "background": { "type": "gradient", "from": "#0f172a", "to": "#334155", "angle": 135 } }
"style": { "background": { "type": "solid", "color": "#0f172a" } }
```

