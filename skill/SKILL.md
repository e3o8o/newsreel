---
name: newsreel
description: A project-agnostic workflow for producing a weekly shipping report plus a short narrated demo video of what shipped. Covers the report structure, the capture-to-video pipeline (seed, authed session, Playwright capture, cards, styled frame, voiceover, music, assembly, thumbnail), and the hard-won gotchas. The mechanics are packaged as the `newsreel` CLI. Use when writing a shipping/weekly report, producing a demo video of shipped work, or adopting this workflow in a new project.
---

# Newsreel: shipping report + demo video

Turns a week of shipped work into two artifacts: a written shipping report and a short
narrated demo video. A newsreel is a reel of film, narrated, released weekly, showing what
happened, which is exactly the output.

## The split: this skill is the why, the CLI is the how

| Where | What lives there |
| --- | --- |
| This skill | The report rules, the gotchas, the loop, the judgement calls |
| `newsreel` CLI | Every script, the config contract, the providers, the presets |

```bash
npx newsreel init        # scaffold newsreel.config.json
npx newsreel presets     # list the 16 gradients + 12 solids
npx newsreel login       # log in once by hand; the session is saved
npx newsreel capture     # Playwright drives the app, one webm per shot
npx newsreel cards       # title + lower-thirds + closing card as PNGs
npx newsreel assemble    # styled frame, speed-fit, voice, music, thumbnail
npx newsreel run         # capture -> cards -> assemble
```

**Do not copy the CLI's scripts into a project.** Per-project copies drift, which is the
problem the CLI exists to solve. Everything project-specific belongs in the config.

## What ships each cycle

One report and one video per cycle, both covering the same slice, so the report's
"shipped" section and the video's shots match. Weekly works well; the cadence is yours.

## Adopting this in a new project

Everything project-specific lives in one `newsreel.config.json` (`npx newsreel init`
writes it). Three things need filling in:

1. **The config**: base URL, auth, output dirs, branding, voice, music.
2. **A seed command** (optional). Demo data is app-specific, so the config just names a
   command. Skip it if the app already has demo-worthy data.
3. **The shot list**: routes, captions, narration, interactions. The only part that changes
   week to week.

## The report

Use `assets/report-template.md`. It is a status document, not a changelog: lead with what
reached production, then what is queued and what is blocked and why.

- Every claim is checkable: PR numbers, issue IDs, dates.
- Separate **already in production** from **ships with this promotion**. They are different
  states, and conflating them misleads the reader.
- Blocked items name the blocker and who owns it, or they are noise.
- Write it plainly. Sentence-case headings, no decorative bolding, and prefer a period or a
  comma to an em dash. A status report earns trust by being verifiable, not emphatic.
- Screenshots for the report are captured by hand (see Tools).

## The styled frame

Every clip renders inside a gradient background with padding, rounded corners and a soft
shadow, rather than raw full-bleed screen. `style.background` takes a BetterShot preset by
id (`{"preset": "deep-ocean"}`), a custom gradient, or a solid. The presets were lifted from
BetterShot's source (16 gradients, 12 solids, plus its shadow formula as reference data),
which is how the look matches without forking it. Attribution: BetterShot, BSD-3-Clause.

## Gotchas (each one cost real time)

- **White flashes between scenes.** Not a transition problem. Every captured clip starts
  with the browser's blank white page-load, and a fade faded *through* it. Fix: detect and
  trim that blank lead per clip, render over a persistent dark background, and use hard
  cuts, never fade-from-transparent.
- **Trim on structure, not brightness.** The blank lead is found by luma *range* per frame,
  not by how bright the frame is: a blank page-load frame is near-uniform whatever its
  colour (black and white both measure range 0), while painted UI has text and chrome and
  so a large range (measured: dark UI 184, light UI 192). An earlier dark-only signal keyed
  on luma dropping back under ~190, so a light-themed app sitting at ~214 never crossed
  back and nothing was trimmed. If no structured frame is found the trim returns 0 and cuts
  nothing, which is the safe direction.
- **Verify flashes theme-agnostically too.** "Peak luma stays dark" only holds for a dark
  app. A flash is specifically a frame that is near-uniform **and** bright.
- **Black frame before play.** Ship `thumbnail.jpg` (the title card) as the poster. Hard
  cuts also mean frame 0 is the fully-rendered title card.
- **Voice is a provider choice.** `voicebox` is local and keyless (see below). `say` is the
  macOS fallback. `elevenlabs` is hosted, and its free tier (10k chars/month) allows premade
  voices only; library voices return 402. `none` skips narration and estimates section
  lengths from the text.
- **Voicebox `/generate` is async.** It returns a job record with `status: "generating"` and
  an empty `audio_path`, then renders in the background. Poll `GET /history/{id}` until the
  status settles, then take the audio. `GET /generate/{id}/status` is an SSE stream, not
  plain JSON. Failures come back as HTTP **200** with `status: "failed"` and a populated
  `error`, so they have to be read out of the record or they look like success.
- **Generated music costs money.** `music.provider: "mirelo"` bills per generation, so the
  CLI prices every job with the free preflight and logs it before spending, and caches the
  bed by (prompt, duration, loop). Buy a short loop and let the pipeline tile it; buying the
  full video length re-spends on every narration tweak, because the length is part of the
  cache key.
- **Music levels differ wildly by provider.** `gainDb` (default -18) applies to the bed as
  delivered, and nothing is loudness-normalised. At -18 the procedural bed peaked ~-35 dBFS
  while mirelo beds landed ~-32 to -25 dBFS depending only on the prompt, so a generated bed
  usually wants a lower value. Listen before shipping. Omitting the `music` block entirely
  gives the procedural bed; `none` drops the bed.
- **Re-seed before re-capturing.** Interactive shots consume seeded state (each confirm
  burns a pair).
- **Playwright means web apps only.** It cannot drive a native dialog, a terminal, or an
  OS-level interaction. Those need manual recording.
- **Remotion is an optional upgrade, not part of this workflow.** It buys a nicer look at
  the cost of a heavy setup. In Remotion only `<Video>` gets a true full frame; a bare
  `<img>` gets letterboxed, so render cards as short mp4s. Free for small teams, licensed
  for larger orgs.

## Tools

- **BetterShot** (macOS, open-source CleanShot X alternative) for the report's static
  screenshots. As of v0.3.7 it is GUI-only, so it cannot be scripted; the CLI reproduces its
  look instead. Repo: `KartikLabhshetwar/better-shot`.
- **Voicebox** (voicebox.sh) for local, keyless narration and voice cloning. It is a Tauri
  app, but `Voicebox.app/Contents/MacOS/voicebox-server` is a standalone FastAPI binary with
  `--host/--port/--data-dir` flags, so it runs headless with no GUI at all. Read the OpenAPI
  spec off the **running server** (`/openapi.json`), not the repo's `docs/openapi.json`,
  which is badly stale (23 endpoints vs 90 live).
- **Playwright** for capture and card rendering, **ffmpeg** for assembly.

## Voice cloning with Voicebox, headless

Verified end to end. The traps, in order:

1. A model must be downloaded first (`POST /models/download`), or profile creation fails
   with nothing to clone from. `qwen-tts-1.7B` is the cloning model.
2. Reference audio is capped at **30 seconds**. Longer returns
   `400 Audio too long (maximum 30.0 seconds)`.
3. `POST /profiles/{id}/samples` requires a `reference_text`: the transcript of the sample.
   `POST /transcribe` (Whisper) can produce it, but its `model` parameter takes a *size*
   (`base|small|medium|large|turbo`), not a model id.
4. `/transcribe` hardcodes a `.wav` suffix on its temp file, so **non-wav uploads fail to
   decode**. Convert first.
5. `whisper-turbo` hits an MLX threading bug (`There is no Stream(gpu, 2) in current
   thread`) and 500s; `base` and `small` work.
6. Quiet audio makes Whisper hallucinate and loop. Normalize to about -18 LUFS and cut
   leading silence first. A clean 10s segment beats a noisy 25s one.

## The loop, end to end

1. Confirm what actually reached production this cycle (diff the promotion, do not trust
   memory).
2. Draft the report from the template.
3. Update the config's shot list to the demoable changes.
4. Seed, then `npx newsreel run`.
5. Verify: scan for flashes, frame 0 is the title card, length is on target, listen to the
   mix.
6. Ship both, and file them in the project's report and video dirs.
