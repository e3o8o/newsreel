# Scene lookbook

The generated scenes the harness can capture, what each one feels like, and
when to reach for it. Add a shot with `"type": "generated"`, a `scene` name
from this list, `props`, and a `duration` in seconds. Full contract:
`design/generated-scenes.md`.

Rule of thumb: a video uses at most two title styles, or it reads as a sampler
reel instead of a designed piece. Alternate dark and light scenes so cuts have
contrast, and give every scene at least 5 seconds; most entrances need 2.

| Scene | Feels like | Reach for it when | Key props |
| --- | --- | --- | --- |
| `swirl` | CRT terminal, ASCII vortex condensing into a wordmark | Brand opener, technical audience | `word`, `zoom` (0.8 fits long words), `ink[]`, `turbulence` |
| `chroma` | Neon glow on a deep wall, words dissolving into light | Capability lists, dark punchy beats | `word` or `words[]` (cycles), `split`, `spectral` |
| `fade` | Long-exposure trail, palettes washing | Atmospheric closer | `word`, `cyclePeriod` |
| `kinetic` | A glyph cut into rippling tiles, duotone print | Single-symbol beats (a letter, €) | `text`, `paper`, `ink`, `accent`, `tiles` |
| `typer` | Terminal-adjacent character reveal with pill states | Short promises, lower-third energy | `lines[]`, `theme`, `accent`, `loop` |
| `dotcut` | Circle lattice with negative-space glyph, pattern cycling | Interstitials, single-letter idents | `letter`, `hold`, `morph` |
| `tile-field` | Wordmark as a mosaic lit by a colour wave | Brand texture, quiet beats | `word`, `bg` |
| `blur-reveal` | Vivid panels, one line each, cloudy dissolve | Problem/value statements in sequence | `panels[]` of `{line,bg,fg}` |
| `blur-glow` | Soft gradient-mapped glow on paper | Feeling words, calm light beats | `words[]` (3) |
| `chrome` | Liquid metal on black, reflection streaming | Premium single words | `word`, `ramp`, `cycleRampsSeconds` |
| `cursors` | Frosted-glass word, labelled collaborator cursors | Team/collaboration story | `word`, `names[]`, `colors[]` |
| `embroidery` | Stitched patches on fabric, relit satin | Craft sign-off, warmth | `words[]` (3 patch texts) |
| `cta` | Aurora, logotype, glossy button, URL | The closing call to action | `brand`, `tagline`, `button`, `url` |

Timeline beats (`"timeline": [{ "at": s, "action": name }]`): `swirl` takes
`replay`, `fade` takes `next` (palette), `dotcut` takes `advance` (scene),
`chrome` takes `ramp`, `typer` takes `out`/`in`.

Gotchas that already cost time: Canvas 2D rejects `var()` font strings, so
adapters must pass real family lists; props travel base64url as UTF-8 bytes;
scenes with a cursor reaction get the shared ghost pointer, never a real one.
