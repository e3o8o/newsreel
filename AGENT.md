# newsreel, for an agent

Hand this file to a coding agent and it has everything it needs. Nothing here assumes the
agent has seen the repository. `npx newsreel prompt` prints it.

---

You are making a narrated video with **newsreel**, a CLI that drives a real browser, narrates
locally, and cuts the result with ffmpeg. You write **one JSON file**. The CLI does the rest.

## What you need

- Node 18+, and `ffmpeg` on PATH (`brew install ffmpeg`).
- `playwright` in the project, plus its browser: `npm i -D playwright && npx playwright install chromium`.
  Only needed for shots that film an app or a generated scene, which is nearly always.
- Nothing else. No accounts, no API keys. Narration and music are local and bundled.

## The fastest working video

```bash
npx newsreel init --generated
npx newsreel run
```

That scaffolds a config whose every shot is a scene newsreel draws itself, so it needs no app,
no login and no keys, and it produces a finished mp4 plus a poster frame. Run it first: if it
works, the toolchain is wired up, and any later failure is about the config rather than the
install.

## The two kinds of shot

Every entry in `shots[]` is one of these.

**A generated scene** — newsreel draws it. No app involved.

```json
{ "id": "open", "type": "generated", "scene": "swirl", "props": { "word": "launch" },
  "duration": 7, "caption": "Lower third", "narration": "Spoken over this section." }
```

**A captured route** — Playwright opens your app and films it.

```json
{ "id": "invoices", "route": "/invoices", "duration": 8,
  "caption": "Invoices", "narration": "Spoken over this section.",
  "actions": [ { "type": "waitFor", "selector": "table tbody tr" },
               { "type": "click", "selector": "text=New invoice" },
               { "type": "type", "selector": "#amount", "value": "1200" } ] }
```

Action types: `waitFor`, `click`, `fill`, `type`, `press`, `wait`, `scroll`. Selectors go
straight to `page.locator()`, so CSS and Playwright engines (`text=`, `role=button[name=Save]`)
both work.

The moment one shot has a `route`, the config also needs `baseUrl` and an `auth` block, and
somebody has to run `newsreel login` once by hand. All-generated configs need none of that.

## The config

```json
{
  "project": "Acme",
  "baseUrl": "http://localhost:3000",
  "output": { "videoDir": "videos", "workDir": ".newsreel" },
  "auth": { "storageState": ".newsreel/auth-state.json",
            "loginPath": "/sign-in", "readyPath": "/dashboard" },
  "video": { "kind": "demo", "title": "What shipped", "subtitle": "March" },
  "voice": { "provider": "voicebox", "narrator": "narrator-george" },
  "shots": [ ... ],
  "closingCard": { "title": "Thanks", "subtitle": "acme.com" }
}
```

Relative paths resolve against the config file, never the shell's cwd. Comments and trailing
commas are allowed; the loader strips them.

**`video.kind`** is the highest-leverage line in the file. It sets the palette family, accent,
music bed, pacing and title-card layout in one word:

| kind | for | feels like |
| --- | --- | --- |
| `report` | a weekly shipping report | calm, legible, unhurried |
| `demo` | a product walkthrough | confident, focused on the screen |
| `ad` | a short loud piece | heat and pace, ends on a call to action |
| `launch` | a launch film | premium, deliberate, a little cinematic |

The background is rolled from the kind's family rather than fixed, so two ads come out
siblings instead of copies. The roll is saved in `workDir/.style-roll`; pin it with
`style.background.preset` when you want it stable. `newsreel presets` lists all of them.

**`voice.provider`**: `voicebox` (local, keyless, three bundled voices — install them with
`newsreel voices --install`), `say` (macOS), `elevenlabs` (hosted, needs a key), or `none`
(no audio; section lengths are estimated from the text). Set `narrator` per shot to have two
voices trade sections. Narration is cached by its text, so re-cutting a video costs nothing.

## Commands

```
newsreel init [--generated]   scaffold a config
newsreel presets              list backgrounds
newsreel voices [--install]   list the bundled voices, put them in Voicebox
newsreel login                open a browser, log in by hand, save the session
newsreel run                  capture -> cards -> assemble
newsreel capture|cards|assemble    the three steps on their own
```

`--config <path>` works on all of them. `capture --only <shotId>` re-records one shot.

## Writing the narration

This is what makes the video good or bad, so spend the effort here.

- **One idea per shot.** Sections are cut to the length of their own narration, so a shot's
  length is decided by what you wrote, not by a duration you guessed.
- **Say what changed and why it matters**, not what is on screen. "Reconciliation now matches
  on amount and date together" beats "here is the reconciliation page".
- **Numbers are checkable, adjectives are not.** Prefer the number.
- **Read it out loud.** Anything you stumble over, the narrator will too.
- Keep a shot's narration to one or two sentences. Four shots of one sentence beat one shot
  of four.

## Choosing scenes

`visuals/LOOKBOOK.md` inside the package lists all 35 with their props and what each is for.
A few reliable picks: `swirl` and `pixel-scan` for an opener, `typer` and `text-reveal` for a
statement, `design-tiles` for a dense typographic beat, `aurora` and `galaxy` for a background
under a long narration, `loot-beam` for a release, `cta` to close.

Two rules worth obeying: **at most two title styles in one video**, or it reads as a sampler
reel rather than a designed piece; and **alternate dark and light scenes** so the cuts have
contrast.

## Things that will bite you

- **Do not point `baseUrl` at production.** Capture clicks real buttons.
- **Capture runs headed on purpose.** Auth providers sit behind bot management and flag
  headless browsers, so a session that works in a visible browser is rejected in a hidden one.
  Do not add `--headless` to quieten it.
- **Wait on a selector, never a timeout,** and never on `networkidle`. A dev server returns 200
  with the shell painted and the data fifteen seconds out.
- **Re-seed before re-capturing.** Interactive shots consume seeded state.
- **Playwright means web only.** A native dialog, a terminal or an OS interaction has to be
  recorded by hand.
- If a shot opens on a loading skeleton, set `trimBefore` on it: the blank-lead trim keys on
  structure, and a skeleton is structured, so it survives the trim.

## When you are done

Report the output path, the runtime, and each section's length (the assemble step prints all
three). If any shot failed, say which and why: a failing shot is skipped, not fatal, so a
video can finish while quietly missing a scene.
