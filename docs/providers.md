# Voice and music


Both are pluggable adapters. Both are validated at startup, before anything renders, so a typo
or a dead server costs a second rather than a full assemble.

### Voice

| Provider | Hosted | Key | Notes |
| --- | --- | --- | --- |
| `none` | | | Default. No narration; section lengths are estimated from the text. |
| `say` | | | macOS built-in. `voiceId` is a `say` voice name (`say -v '?'`). |
| `voicebox` | | | A local [Voicebox](https://voicebox.sh) server. Nothing leaves the machine. |
| `elevenlabs` | yes | `voice.apiKeyEnv` | Needs `voiceId` and `model`. |

| `dir` | | | Pre-recorded files from `voice.dir`: one `vo-<section>.mp3/wav/m4a/aiff` per section. |

`voicebox` resolves `voice.profile` (a name, case-insensitive, or an id) against `GET /profiles`
at startup. That call doubles as the reachability probe, so an unreachable server fails the run
with install instructions instead of quietly swapping in another voice. Set `voice.baseUrl` if
it does not listen on `http://127.0.0.1:17493`. The request carries the profile's own engine
(`default_engine`/`preset_engine` from the profile list, or `voice.engine` to override):
Voicebox's `/generate` otherwise defaults to its qwen engine, and preset profiles reject that
with a 400.

**Free narration with no cloning:** Voicebox bundles Kokoro-82M (Apache 2.0, CPU-realtime,
about 50 preset voices). Create a preset profile once --
`POST /profiles {"name": "Narrator", "voice_type": "preset", "preset_engine": "kokoro",
"preset_voice_id": "bm_george", "default_engine": "kokoro"}` -- and point `voice.profile` at
it. No samples, no cloud, no cost. `GET /profiles/presets/kokoro` lists the voices.

`dir` is the bring-your-own escape hatch: a studio read, a paid TTS run from another tool, a
colleague's voiceover. Files are matched by section name (`vo-_title`, `vo-<shotId>`,
`vo-_closing`); the run fails naming the missing file if one is absent. Both renderers measure
the files and fit sections to them exactly as with generated audio.

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

