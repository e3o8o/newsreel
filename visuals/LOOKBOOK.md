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
| `ransom` | Letters torn from magazines and taped down crooked | Playful title, a warning, anything hand-made | `text`, `seed` (re-roll the jitter), `tape`, `settle` |
| `pixel-scan` | A diagonal band assembling a word out of coloured blocks | Energetic title, a reveal on a beat | `word`, `cellSize`, `hue`, `sweep` |
| `ascii-wordmark` | A swarm of glyphs caught into the shape of a word | Technical opener with more texture than `swirl` | `word`, `cols`, `ramp`, `count`, `flow` |
| `symbols` | A picture redrawn in four hard bands of glyphs | Turning a screenshot or portrait into type | `source`, `cell`, `bands[4]`, `hue`, `mono` |
| `ghost-reveal` | A panel materialising behind a soft travelling edge | A statement that should arrive, not fade in | `text`, `sub`, `direction`, `feather` |
| `figma-frame` | Vector-editor selection chrome around a live card | Explaining a layout, a design-tool aside | `title`, `body`, `label`, `accent`, `cycle` |
| `hover-video` | Pills opening into moving clips as a pointer tours them | Showing an interaction without filming one | `items[]`, `clips[]`, `accent` |
| `pixel-field` | Images blowing up into blocks as they swap | A montage that should not look like a slideshow | `sources[]`, `hold`, `swap`, `maxBlock` |
| `image-sphere` | A cloud of pictures orbiting, near ones sharp | A portfolio wall, a "everything we shipped" beat | `sources[]`, `count`, `spin`, `tilt` |
| `loot-beam` | An object turning in a shaft of golden light | Marking a release as a prize; a launch beat | `label`, `rarity`, `shape` |
| `style-melt` | A portrait melting from a styled version back to the real one | A before-and-after, an "under the surface" beat | `source`, `grid`, `radius`, `decay` |
| `materials` | Ten button surfaces cycling: glossy, metal, glass, inset | A UI-craft beat, showing depth without a screenshot | `label`, `hold`, `only[]` |
| `liquid` | Two cards fusing, the corner between them bending inward | A merge, a join, two things becoming one | `left`, `right`, `gap`, `blend` |
| `squircle` | A rounded corner easing into the edge instead of kinking | A detail aside; anything about care in the small things | `radius`, `n`, `compare` |
| `text-reveal` | Wispy tendrils condensing into two clean blocks | A soft opener, a section break | `top`, `bottom`, `hold` |
| `emboss` | A word pressed into plaster, lit from a movable angle | A tactile title; a stamp of authority | `word`, `light`, `depth`, `svg` |
| `word-stickers` | Die-cut vinyl words you can grab and fling | Playful list of features or values | `words[]`, `gravity`, `border` |
| `design-tiles` | A sentence packed edge to edge as solid colour tiles | A manifesto line, a dense typographic beat | `text`, `palette[]`, `stagger` |
| `badge-trail` | Small mono badges dropping behind the cursor | Ambient texture behind a voiceover | `words[]`, `life`, `spacing` |
| `galaxy` | A perspective field of images drifting behind text | A background with depth that text still sits on | `images[]`, `text`, `count` |
| `aurora` | Blurred bars, a bezier mountain, a colour-dodge drift | A calm background under a long narration | `treatment`, `hues[]`, `speed` |
| `fire` | A pixel fire on a low-res grid you can shove around | A hot ad beat; anything about heat or urgency | `cols`, `palette`, `wind` |

Timeline beats (`"timeline": [{ "at": s, "action": name }]`): `swirl` takes
`replay`, `fade` takes `next` (palette), `dotcut` takes `advance` (scene),
`chrome` takes `ramp`, `typer` takes `out`/`in`.

Gotchas that already cost time: Canvas 2D rejects `var()` font strings, so
adapters must pass real family lists; props travel base64url as UTF-8 bytes;
scenes with a cursor reaction get the shared ghost pointer, never a real one.
