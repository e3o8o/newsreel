# Gotchas and limits

Every entry here cost real time once.


Each of these cost real time. They are load-bearing, not decoration.

**White flashes between scenes are not a transition problem.** Every captured clip opens with
the browser's blank page-load: black, then white, then the app. A fade between scenes faded
*through* that white. The fix is to detect the end of the blank lead per clip and `-ss` trim it
before speeding, render over a persistent opaque background, and use hard cuts. There is no
`xfade` or fade-from-transparent anywhere in the pipeline.

**A saved session that dies between runs is the auth provider rotating tokens.** Clerk dev
instances hand the browser a dev JWT that rotates on use: a `storageState` file replays the
old one, works once, then every later context bounces to the sign-in page -- which reads as
"login worked but capture is broken". Set `auth.profile` and sign in once; the rotation then
happens inside a persistent profile that stays valid. Related: when a valid session bounces
through the provider's origin and back (a handshake), capture waits up to 25s for the page to
return to `baseUrl` before failing the shot -- re-navigating mid-handshake restarts it.

**A spinner lead defeats the blank-lead trim, on purpose.** The auto-trim cuts leading frames
with no structure. A loading spinner on an app-coloured background *is* structure, so the trim
correctly refuses to guess and keeps it. When a shot opens on a spinner (client-side data
fetch before first paint), watch the clip once and set that shot's `trimBefore` in seconds;
compose then cuts exactly there.

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

