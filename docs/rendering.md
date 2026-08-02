# Rendering

How a cut is put together, the two renderers, and how to check the result.

## Why it looks the way it does

Five stages, in order. Each one exists because of something that went wrong without it, which
is documented in [Gotchas](gotchas.md).

| Stage | What happens |
| --- | --- |
| Seed | Optional and app-specific. You run it; the config only records the command. |
| `login` | A headed browser opens, you log in by hand, the session is saved and reused. |
| `capture` | One webm per shot, at a fixed viewport, with dev overlays hidden. |
| `cards` | Title card, closing card, and one lower-third caption per shot, rendered from HTML. |
| `assemble` | Trim, styled frame, speed-fit, voiceover, music bed, hard-cut concat, poster. |

There is no login automation on purpose. It keeps the pipeline agnostic to your auth provider:
Clerk, Auth0, plain sessions, anything you can click through once.


## Composing with Remotion

`newsreel compose` renders the same shots, narration, and music through a generated
[Remotion](https://www.remotion.dev) project instead of ffmpeg filters. What that buys:

- **Animated cards**: the kicker drops in, the headline slides up, bullets stagger in.
- **Animated lower-thirds**: the chip pops, the caption slides in, both exit before the cut.
- **Ken Burns that comes back**: `motion.type "in-out"` pushes toward the focus point over the
  first half and eases back out, so no shot ends mid-drift. `"in"` pushes and stays.
- **Real freezes**: when a clip is shorter than its narration, the scene freezes on the clip's
  final frame at its final zoom rather than crawling below natural speed. Typed input and
  cursor movement stay at 1x when the timing allows it.

```jsonc
"compose": {
  "palette": "sunrise",        // sunrise | deep-ocean | emerald | midnight, or an object
  "tailSeconds": 1.0           // beat after each narration before the cut
}
```

A palette is the whole look: backdrop gradient, panel colours, ink, accent. The thumbnail is
a mid-title still, so it inherits the palette's brightness. To adjust one colour, pass an
object: `{ "base": "sunrise", "accent": "#ffffff" }`.

The project is emitted into `<output.workDir>/remotion/` and is disposable: src and configs
are re-copied from this package's template on every run, `data.json` and `public/` are
regenerated from the config and the measured narration. Edit the config, never the project.
The first run does one `npm install` in there (Remotion is not a dependency of newsreel
itself); node_modules persist for later runs. `npx remotion studio` inside that directory
opens the cut for interactive scrubbing when something looks off.

Clip timing carries over from assemble: the blank page-load lead is auto-trimmed with the
same structure detector, and clips speed up (never above `video.maxSpeed`) to fit their
narration. Two per-shot escape hatches exist for compose: `trimBefore` (seconds) replaces the
auto-trim when a clip's lead is a spinner rather than a blank -- a spinner has structure, so
the detector cannot see it -- and `speed` pins the playback rate for shots that must play in
real time.


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

