# newsreel

Turn a week of shipped work into a short, styled demo video.

A newsreel was a narrated reel of film, released weekly, showing what happened. This produces
the same thing for your project: narrated footage of the week's work.

Playwright drives your app and records one clip per scene. ffmpeg puts each clip inside a
gradient frame with rounded corners and a soft shadow, speeds it to fit its narration, and
cuts the whole thing together with a title card, lower-third captions, a voiceover and a
music bed. You get an mp4 and a matching poster image.

Everything project-specific lives in one `newsreel.config.json`. Adding a scene is a config
change, not a code change. Everything is free and keyless by default; the hosted voice and
generated music providers are opt-in.

```
newsreel init      # scaffold a config
newsreel login     # log in once, by hand
newsreel run       # capture -> cards -> assemble
```

## Contents

- [Why it looks the way it does](#why-it-looks-the-way-it-does)
- [Requirements](#requirements)
- [Install](#install)
- [Quickstart](#quickstart)
- [Commands](#commands)
- [Configuration](#configuration)
- [Backgrounds](#backgrounds)
- [Voice and music providers](#voice-and-music-providers)
- [Gotchas](#gotchas)
- [Verifying a cut](#verifying-a-cut)
- [Known limits](#known-limits)
- [Adding a provider](#adding-a-provider)
- [The skill folder](#the-skill-folder)
- [Licence](#licence)

## Why it looks the way it does

Five stages, in order. Each one exists because of something that went wrong without it, which
is documented in [Gotchas](#gotchas).

| Stage | What happens |
| --- | --- |
| Seed | Optional and app-specific. You run it; the config only records the command. |
| `login` | A headed browser opens, you log in by hand, the session is saved and reused. |
| `capture` | One webm per shot, at a fixed viewport, with dev overlays hidden. |
| `cards` | Title card, closing card, and one lower-third caption per shot, rendered from HTML. |
| `assemble` | Trim, styled frame, speed-fit, voiceover, music bed, hard-cut concat, poster. |

There is no login automation on purpose. It keeps the pipeline agnostic to your auth provider:
Clerk, Auth0, plain sessions, anything you can click through once.

## Requirements

- Node 18 or newer (the provider adapters use `fetch`).
- `ffmpeg` and `ffprobe` on `PATH`. Override with `FFMPEG_PATH` / `FFPROBE_PATH`.
  On macOS: `brew install ffmpeg`.
- Playwright installed **in the project you are filming**:
  `npm i -D @playwright/test && npx playwright install chromium`.

Playwright is an optional peer dependency, not a bundled one. It is heavy, your project almost
certainly already has it, and a second copy would only be a version fight. It gets resolved at
runtime from your config file's directory, so it works whether this CLI is installed locally,
globally, or run through `npx`. Either `playwright` or `@playwright/test` satisfies it.

## Install

```bash
npm i -D newsreel
```

Or run it without installing:

```bash
npx newsreel init
```

## Quickstart

```bash
# 1. scaffold a commented config in your project root
npx newsreel init

# 2. fill in project, baseUrl, auth paths, and shots[]
#    pick a background while you are there
npx newsreel presets

# 3. seed your demo data, if the app needs it (you run this; see the seed note below)
npm run seed:demo

# 4. log in once by hand. The session is saved and reused by every later run.
npx newsreel login

# 5. capture -> cards -> assemble
npx newsreel run
```

The result:

```
<output.videoDir>/<YYYY-MM-DD>/launch-video.mp4
<output.videoDir>/<YYYY-MM-DD>/thumbnail.jpg
```

Ship `thumbnail.jpg` next to the video and set it as the `<video poster>` or platform
thumbnail. Intermediates (the saved session, clips, cards, any cached music bed) live under
`output.workDir`. Point that at a persistent directory, never a session scratchpad, or they
vanish between runs and a paid music bed gets bought twice. Add it to `.gitignore`.

## Commands

| Command | What it does |
| --- | --- |
| `init` | Scaffold a `newsreel.config.json` from the bundled example. `--force` overwrites. |
| `presets` | List the background presets by id. `--json` for the raw data. |
| `login` | Headed browser, manual login, saves the session. `--timeout <sec>` (default 480). |
| `capture` | Record one clip per shot. `--only <shotId>`, `--headless`, `--slow-mo <ms>`. |
| `cards` | Render the title/closing cards and the lower-thirds. |
| `assemble` | Build the video. `--date <YYYY-MM-DD>` sets the output folder. |
| `run` | `capture` -> `cards` -> `assemble`, with an ffmpeg/Playwright preflight first. |

Every command takes `--config <path>` (default `./newsreel.config.json`). Relative paths inside
the config resolve against the config file's directory, never the shell's working directory, so
the same config works from anywhere.

`run` deliberately excludes `login` (headed and interactive, and the session is reused for
weeks) and seeding (app-specific).

## Configuration

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
| `auth.storageState` | yes | Where the saved session is written. |
| `auth.loginPath` | yes | Your sign-in path, e.g. `/sign-in`. |
| `auth.readyPath` | yes | The path that means "logged in". Must start with `/`. |
| `seed.command` | no | Informational only. The CLI never runs it. |
| `capture.viewport` | no | `{ width, height }`, default `1440x900`. Both must be even. |
| `capture.hideCss` | no | CSS injected into every shot, to keep dev chrome off camera. |
| `style.*` | no | The styled frame. See below. |
| `voice.*` | no | Narration. Default `none`. See the provider matrix. |
| `music.*` | no | The bed. Omit the block entirely for `procedural`. |
| `video.*` | no | Title, target length, max speed, poster. |
| `shots[]` | yes | The scenes. The only part that changes each cycle. |
| `closingCard` | no | A card for non-visual wins. Omit to end on the last shot. |

`seed.command` is recorded, not executed. Demo data is inherently app-specific, so you run the
command yourself before capturing. Re-run it before every clean re-capture: interactive shots
consume seeded state, and each confirm burns a pair.

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

Actions: `waitFor`, `click`, `fill`, `wait`, `scroll`, `press`.

| Type | Keys |
| --- | --- |
| `waitFor` | `selector`, optional `state` (`visible` default), `timeout` |
| `click` | `selector`, `timeout` |
| `fill` | `selector`, `value`, `timeout` |
| `press` | `key`, optional `selector`, `timeout` |
| `wait` | `ms` (default 1000) |
| `scroll` | optional `selector` (scrolls it into view), else `x` / `y` wheel deltas |

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

## Voice and music providers

Both are pluggable adapters. Both are validated at startup, before anything renders, so a typo
or a dead server costs a second rather than a full assemble.

### Voice

| Provider | Hosted | Key | Notes |
| --- | --- | --- | --- |
| `none` | | | Default. No narration; section lengths are estimated from the text. |
| `say` | | | macOS built-in. `voiceId` is a `say` voice name (`say -v '?'`). |
| `voicebox` | | | A local [Voicebox](https://voicebox.sh) server. Nothing leaves the machine. |
| `elevenlabs` | yes | `voice.apiKeyEnv` | Needs `voiceId` and `model`. |

`voicebox` resolves `voice.profile` (a name, case-insensitive, or an id) against `GET /profiles`
at startup. That call doubles as the reachability probe, so an unreachable server fails the run
with install instructions instead of quietly swapping in another voice. Set `voice.baseUrl` if
it does not listen on `http://127.0.0.1:17493`.

### Music

| Provider | Cost | Notes |
| --- | --- | --- |
| `procedural` | free | Default, and what an absent `music` block means. A synthesised drone. |
| `file` | free | A local track. `music.path`, relative to the config. |
| `mirelo` | credits | Generated from `music.prompt` via api.mirelo.ai. Priced and cached. |
| `none` | free | No bed; the narration carries the video. |

Whatever the source, the bed is looped or trimmed to the final length, ducked to `music.gainDb`
(default -18) and faded at both ends.

Keys (`voice.apiKeyEnv`, `music.apiKeyEnv`) are read from the environment, falling back to a
`KEY=value` line in the project's `.env`. They never go in the config.

## Gotchas

Each of these cost real time. They are load-bearing, not decoration.

**White flashes between scenes are not a transition problem.** Every captured clip opens with
the browser's blank page-load: black, then white, then the app. A fade between scenes faded
*through* that white. The fix is to detect the end of the blank lead per clip and `-ss` trim it
before speeding, render over a persistent opaque background, and use hard cuts. There is no
`xfade` or fade-from-transparent anywhere in the pipeline.

**The trim keys on structure, not brightness.** This is what makes it theme-agnostic. A blank
page-load frame is near-uniform whatever colour it is, so its luma range (`YMAX-YMIN`, via
ffmpeg `signalstats`) is about 0, which covers the leading black frames and the white flash with
one test. Any painted UI has text and chrome, so it has a large range. The trim skips leading
frames under a range of 24 and cuts at the first one over it. An earlier version keyed on
brightness instead and only ever worked on dark apps: a light-themed UI sits at a high average
luma and never crosses back down, so nothing was trimmed and the white lead survived into the
cut. Measured on synthetic clips with a known 1.20s lead: blank frames range 0, a dark UI 193, a
light UI 198; both detect 1.20s exactly, while the brightness signal finds the dark one and
misses the light one entirely. `npm test` in this repo asserts all of that.

If no structured frame is ever found the trim returns 0 and cuts nothing, which is the safe
direction.

**Frame 0 is the title card**, a consequence of the hard cuts, so `thumbnail.jpg` matches the
first frame exactly. Ship it and set it as the poster, or players show a black frame before play.

**No ffmpeg `drawtext`.** All text is rendered from HTML in Chromium. Many ffmpeg builds ship
without the drawtext filter, and discovering that at assembly time is miserable. Chromium is
already a dependency of the capture step.

**Re-seed before re-capturing.** Interactive shots consume seeded state; each confirm burns a
pair. `capture --only <shotId>` redoes a single shot.

**Point `workDir` at a persistent directory**, not a session scratchpad, or intermediates vanish
between runs. With `music.provider: "mirelo"` that also means re-spending credits.

**ElevenLabs' free tier cannot use community library voices.** Those return 402, and the error
says so when it happens. Premade voices only (Sarah, Matilda, Bella); list what a key may use via
`GET /v1/voices`.

**Generated music costs money.** `mirelo` bills per generation, so the pipeline always calls the
free preflight first and logs the price before spending, then caches the bed under `workDir` keyed
by prompt, duration and loop. Buy a short loop (`durationMs`) and let the pipeline tile it. Buying
the full video length instead re-spends on every narration tweak, because the length is part of
the cache key.

**`music.gainDb` is not loudness-normalised.** It applies to the bed as delivered. Measured at the
default -18 dB the procedural drone peaks around -35 dBFS, while mirelo beds came back between -32
and -25 dBFS depending only on the prompt. A generated or file bed usually wants a lower `gainDb`
than the procedural default. Listen to a cut before shipping.

**Nothing silently falls back.** A configured-but-unreachable Voicebox fails the run rather than
swapping in another voice, and `say` validates `voice.voiceId` up front because `say` accepts an
unknown `-v` silently and would just use a different voice.

## Verifying a cut

A flash is a frame that is near-uniform **and** bright, so test for exactly that. The older
"peak luma stays dark" check only worked on a dark app, since a light-themed UI legitimately
raises the average. Expect zero.

```bash
ffmpeg -hide_banner -i launch-video.mp4 -vf "signalstats,metadata=print" -f null - 2>&1 | awk '
  match($0,/pts_time:[0-9.]+/) { t=substr($0,RSTART+9,RLENGTH-9) }
  /signalstats.YMIN=/ { split($0,a,"="); ymin=a[2]+0 }
  /signalstats.YAVG=/ { split($0,a,"="); yavg=a[2]+0 }
  /signalstats.YMAX=/ { split($0,a,"="); ymax=a[2]+0; n++;
      if (ymax-ymin < 24 && yavg > 200) { f++; printf "FLASH at %ss\n", t } }
  END { printf "%d frames, %d flashes\n", n, f+0 }'
```

Then check frame 0 is the title card and the length is on target.

## Known limits

- **Card and caption strings cannot carry markup.** Every config string is HTML-escaped and
  renders literally. That is the right default (config strings are prose), but it means raw
  injection is gone: use `style.accent` and the card layout for emphasis. Without escaping,
  `Fix <Button> padding` rendered as `Fix  padding`.
- **A near-uniform app UI would defeat the trim.** Any frame with a luma range under 24 counts as
  blank, so a genuinely flat first frame (a solid splash with no text) is trimmed along with the
  page-load. The cut then starts at the first frame with real content, which is usually what you
  wanted.
- **Clips are downscaled** to fit inside the styled frame's padding, since the canvas stays at
  `capture.viewport`. Raise the viewport if UI text gets soft, or drop `style.padding`.
- **The Voicebox adapter's success path is unverified.** The contract here was corrected against
  a live server rather than taken from the README: `/generate` is asynchronous and returns a job
  record (`status: "generating"`, empty `audio_path`), so the adapter submits, polls
  `GET /history/{id}` until the status settles, and then takes the audio. Profile resolution by
  name, job submission, polling and failure reporting are all verified against a real server.
  Collecting a *completed* generation is not: the only profile on the machine it was tested on
  had no voice samples, so every generation failed by design. That last step follows the server's
  OpenAPI schema and prefers the record's own `audio_path` (Voicebox is local, so the file is
  readable in place) before falling back to `GET /audio/{id}`. Failures surface as the server's
  own message, e.g. `No samples found for profile <id>`.
- **The bundled shadow formula is reference data, not applied.** `assets/bettershot-presets.json`
  carries BetterShot's own size-scaling shadow formula, but the pipeline uses a fixed
  `0 24px 64px` shadow whose alpha is `style.shadow`. The formula is kept for anyone who wants to
  match BetterShot's shadow exactly.

## Adding a provider

Providers are adapters. One file, one interface, one line in a registry. No switch to hunt down.

A voice provider in `lib/voice/`:

```js
module.exports = {
    name: 'myprovider',                    // the value of voice.provider
    async setup(c) { return { /* … */ }; }, // validate + resolve, before anything renders
    async synth(v, text, outBase) { return '/path/to/audio'; }, // or null for no narration
};
```

A music provider in `lib/music/`:

```js
module.exports = {
    name: 'myprovider',                    // the value of music.provider
    setup(c) { return { /* … */ }; },
    async source(m, { ff, workDir, tmp, seconds }) { return '/path/to/bed'; }, // or null
};
```

Then add the `require` to `PROVIDERS` in that folder's `index.cjs`, and the name to the enum in
`lib/validate.cjs`. Providers return a raw bed; looping, trimming, ducking and fading are shared.

## The skill folder

`skill/SKILL.md` is the workflow around the tool: how to decide what goes in a report, what
belongs on the closing card instead of in a shot, and the judgement calls this CLI cannot make
for you. The CLI is the how; that file is the why.

It is written as a [Claude Code](https://claude.com/claude-code) skill, so an agent can load it
and run the whole cycle. It reads fine as plain Markdown if you do not use Claude. It is not
shipped in the npm package.

To use it as a skill, symlink it (which keeps it version-controlled here rather than only in
your home directory):

```bash
mkdir -p ~/.claude/skills/newsreel
ln -s "$PWD/skill/SKILL.md" ~/.claude/skills/newsreel/SKILL.md
```

## Licence

MIT. See [LICENSE](LICENSE).

`assets/bettershot-presets.json` contains colour values and a shadow formula derived from
[BetterShot](https://github.com/KartikLabhshetwar/better-shot) (BSD-3-Clause). The values were
read from its source and re-expressed as data; no BetterShot code is included. Its licence and
copyright notice are reproduced in [LICENSE](LICENSE).

BetterShot itself is worth having for the static screenshots that go alongside a demo video. It
has no CLI, URL scheme or AppleScript surface (verified v0.3.7), so it cannot be scripted into a
pipeline. This package reproduces its look in CSS instead.
