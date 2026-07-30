'use strict';
// Config validation, run once at load.
//
// Two rules here:
//   1. Every message names the offending key by its full path ("shots[2].actions[1].selector")
//      and says what would have gone wrong.
//   2. Collect everything, then report once. Fixing configs one exit at a time is miserable.
//
// This checks SHAPE only: types, enums, ranges, references. Secrets and server reachability
// need env/network and stay in the provider setup functions, which still run before anything
// renders (and before mirelo could spend a credit).

const { fail } = require('./util.cjs');
const { presetIds, findPreset } = require('./style.cjs');
const { paletteIds } = require('./palettes.cjs');
// ⚠️ the leaf provider, not music/index.cjs: index pulls in mirelo -> config.cjs -> this
//    file, and the cycle leaves readEnv undefined at require time.
const { tracks: bundledTracks } = require('./music/default.cjs');

const VOICE_PROVIDERS = ['elevenlabs', 'voicebox', 'say', 'dir', 'none'];
const MUSIC_PROVIDERS = ['default', 'mirelo', 'file', 'procedural', 'none'];
const ACTION_TYPES = ['waitFor', 'click', 'fill', 'type', 'wait', 'scroll', 'press'];
const MOTION_TYPES = ['in', 'in-out'];
const THEMES = ['dark', 'light'];
const BG_TYPES = ['gradient', 'solid'];
const HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
// Shot ids become filenames (<id>.webm, lower-<id>.png, seg-<id>.mp4) and section names.
// Leading alphanumeric keeps them clear of the internal "_title"/"_closing" sections and of
// anything that could walk a path.
const SHOT_ID = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

const TOP_LEVEL = ['project', 'baseUrl', 'output', 'auth', 'seed', 'capture', 'style', 'voice', 'music', 'video', 'compose', 'shots', 'closingCard'];

const isObj = (v) => v != null && typeof v === 'object' && !Array.isArray(v);
const isStr = (v) => typeof v === 'string' && v.trim() !== '';
const isNum = (v) => typeof v === 'number' && isFinite(v);

function validateConfig(cfg, file, opts = {}) {
    const errs = [];
    const warns = [];
    const bad = (key, msg) => errs.push({ key, msg });

    // -- required scalars ---------------------------------------------------------------
    if (!isStr(cfg.project)) bad('project', 'required; a non-empty string (the kicker on every card).');

    // ⚠️ `new URL("localhost:3000")` SUCCEEDS -- it parses as protocol "localhost:" -- so a
    //    missing scheme has to be caught by checking the protocol, not by catching a throw.
    //    Left unchecked it sails through here and resurfaces as a confusing cascade of
    //    unresolvable routes.
    let baseOk = false;
    if (!isStr(cfg.baseUrl)) {
        bad('baseUrl', 'required; the URL the app runs at for capture, e.g. "http://localhost:3000". Never production.');
    } else {
        let u = null;
        try { u = new URL(cfg.baseUrl); } catch { /* reported below */ }
        if (!u || !['http:', 'https:'].includes(u.protocol)) {
            bad('baseUrl', `"${cfg.baseUrl}" is not an http(s) URL. Include the scheme, e.g. "http://localhost:3000".`);
        } else baseOk = true;
    }

    // -- output -------------------------------------------------------------------------
    if (!isObj(cfg.output)) {
        bad('output', 'required; an object with "workDir" and "videoDir".');
    } else {
        if (!isStr(cfg.output.workDir)) {
            bad('output.workDir', 'required; where intermediates live (clips, cards, cached beds). ' +
                'Point it at a persistent directory, never a session scratchpad, or they vanish between runs.');
        }
        if (!isStr(cfg.output.videoDir)) bad('output.videoDir', 'required; the finished video lands in <videoDir>/<date>/.');
        if (cfg.output.reportDir !== undefined && !isStr(cfg.output.reportDir)) {
            bad('output.reportDir', 'must be a string when set (used by you for the written report; the CLI never writes there).');
        }
    }

    // -- auth ---------------------------------------------------------------------------
    if (!isObj(cfg.auth)) {
        bad('auth', 'required; an object with "storageState" (or "profile"), "loginPath" and "readyPath".');
    } else {
        if (cfg.auth.profile !== undefined && !isStr(cfg.auth.profile)) {
            bad('auth.profile', 'must be a directory path string when set, e.g. ".newsreel/chrome-profile". ' +
                'Sets persistent-profile mode: sign in once, the profile absorbs token rotation (Clerk dev instances need this).');
        } else if (!isStr(cfg.auth.profile) && !isStr(cfg.auth.storageState)) {
            bad('auth.storageState', 'required unless auth.profile is set; where the saved session is written, e.g. ".newsreel/auth-state.json".');
        }
        if (!isStr(cfg.auth.loginPath)) bad('auth.loginPath', 'required; the sign-in path, e.g. "/sign-in".');
        // ⚠️ login polls `new URL(page.url()).pathname.startsWith(readyPath)`. Without a leading
        //    slash that comparison can never match and the login just times out.
        if (!isStr(cfg.auth.readyPath)) bad('auth.readyPath', 'required; the path that means "logged in", e.g. "/dashboard".');
        else if (!cfg.auth.readyPath.startsWith('/')) {
            bad('auth.readyPath', `"${cfg.auth.readyPath}" must start with "/". It is compared against the URL pathname, ` +
                'so without the leading slash login would wait forever and save nothing.');
        }
    }

    // -- seed (informational; the CLI never runs it) --------------------------------------
    if (cfg.seed !== undefined) {
        if (!isObj(cfg.seed)) bad('seed', 'must be an object when set, e.g. { "command": "npm run seed:demo" }.');
        else if (cfg.seed.command !== undefined && !isStr(cfg.seed.command)) {
            bad('seed.command', 'must be a string when set. Note the CLI never runs it: seeding is app-specific, so you run it.');
        }
    }

    // -- capture --------------------------------------------------------------------------
    const vp = isObj(cfg.capture) ? cfg.capture.viewport : undefined;
    let W = 1440, H = 900;
    if (cfg.capture !== undefined && !isObj(cfg.capture)) {
        bad('capture', 'must be an object when set, with "viewport" and/or "hideCss".');
    } else if (vp !== undefined) {
        if (!isObj(vp)) {
            bad('capture.viewport', 'must be an object: { "width": 1440, "height": 900 }.');
        } else {
            for (const dim of ['width', 'height']) {
                const v = vp[dim];
                if (!isNum(v) || v < 100) bad(`capture.viewport.${dim}`, `must be a number of at least 100 (got ${JSON.stringify(v)}).`);
                // ⚠️ The canvas goes straight into h264/yuv420p, which rejects odd dimensions.
                //    Caught here it is a one-line fix; caught at assembly it is a cryptic ffmpeg error.
                else if (v % 2 !== 0) bad(`capture.viewport.${dim}`, `must be even (got ${v}); h264/yuv420p cannot encode an odd ${dim}.`);
                else if (dim === 'width') W = v; else H = v;
            }
        }
    }
    if (isObj(cfg.capture) && cfg.capture.hideCss !== undefined && typeof cfg.capture.hideCss !== 'string') {
        bad('capture.hideCss', 'must be a string of CSS injected into every shot, e.g. "nextjs-portal { display: none !important; }".');
    }
    if (isObj(cfg.capture) && cfg.capture.zoom !== undefined) {
        const z = cfg.capture.zoom;
        if (!isNum(z) || z < 0.3 || z > 2) {
            bad('capture.zoom', `must be a number between 0.3 and 2 (got ${JSON.stringify(z)}); it emulates browser zoom, e.g. 0.8 to fit more UI on camera.`);
        }
    }

    // -- style ----------------------------------------------------------------------------
    if (cfg.style !== undefined && !isObj(cfg.style)) {
        bad('style', 'must be an object when set.');
    } else if (isObj(cfg.style)) {
        const s = cfg.style;
        const bg = s.background;
        if (bg !== undefined && !isObj(bg)) {
            bad('style.background', 'must be an object: { "preset": "deep-ocean" } or ' +
                '{ "type": "gradient", "from": "#…", "to": "#…" } or { "type": "solid", "color": "#…" }.');
        } else if (isObj(bg)) {
            if (bg.preset !== undefined) {
                if (!isStr(bg.preset)) bad('style.background.preset', 'must be a preset id string.');
                else if (!findPreset(bg.preset)) {
                    bad('style.background.preset', `"${bg.preset}" is not a known preset.\n` +
                        `      Run "newsreel presets" for all ${presetIds().length}. Close matches: ${suggest(bg.preset)}`);
                }
                for (const k of ['from', 'to', 'color']) {
                    if (bg[k] !== undefined) warns.push(`style.background.${k} is ignored because style.background.preset is set.`);
                }
            } else {
                if (bg.type !== undefined && !BG_TYPES.includes(bg.type)) {
                    bad('style.background.type', `must be ${BG_TYPES.map((t) => `"${t}"`).join(' or ')} (got ${JSON.stringify(bg.type)}).`);
                }
                for (const k of ['from', 'to', 'color']) {
                    if (bg[k] !== undefined && !HEX.test(String(bg[k]))) {
                        bad(`style.background.${k}`, `must be a hex colour like "#0f172a" (got ${JSON.stringify(bg[k])}).`);
                    }
                }
                if (bg.type === 'gradient' && bg.to === undefined && bg.from !== undefined) {
                    warns.push('style.background.type is "gradient" but there is no "to"; it will render as the flat "from" colour.');
                }
                if (bg.from === undefined && bg.color === undefined && Object.keys(bg).length) {
                    warns.push('style.background has no "preset", "from" or "color"; falling back to the default #0f172a.');
                }
            }
            if (bg.angle !== undefined && !isNum(bg.angle)) bad('style.background.angle', 'must be a number of degrees, e.g. 135.');
        }
        if (s.padding !== undefined) {
            if (!isNum(s.padding) || s.padding < 0) bad('style.padding', `must be a number >= 0 (got ${JSON.stringify(s.padding)}).`);
            // The clip is scaled to fit inside the padding; past half the short edge there is no room left.
            else if (s.padding * 2 >= Math.min(W, H)) {
                bad('style.padding', `${s.padding} leaves no room inside a ${W}x${H} viewport ` +
                    `(needs 2*padding < ${Math.min(W, H)}). Lower it, or raise capture.viewport.`);
            }
        }
        if (s.radius !== undefined && (!isNum(s.radius) || s.radius < 0)) bad('style.radius', `must be a number >= 0 (got ${JSON.stringify(s.radius)}).`);
        if (s.shadow !== undefined && (!isNum(s.shadow) || s.shadow < 0 || s.shadow > 1)) {
            bad('style.shadow', `must be a number from 0 to 1 (got ${JSON.stringify(s.shadow)}).`);
        }
        if (s.accent !== undefined && !HEX.test(String(s.accent))) bad('style.accent', `must be a hex colour like "#22c55e" (got ${JSON.stringify(s.accent)}).`);
        if (s.theme !== undefined && !THEMES.includes(s.theme)) bad('style.theme', `must be ${THEMES.map((t) => `"${t}"`).join(' or ')} (got ${JSON.stringify(s.theme)}).`);
    }

    // -- voice / music (shape only; keys and servers are checked at setup) -----------------
    if (cfg.voice !== undefined && !isObj(cfg.voice)) bad('voice', 'must be an object when set.');
    else if (isObj(cfg.voice) && cfg.voice.provider !== undefined && !VOICE_PROVIDERS.includes(cfg.voice.provider)) {
        bad('voice.provider', `must be one of ${VOICE_PROVIDERS.map((p) => `"${p}"`).join(', ')} (got ${JSON.stringify(cfg.voice.provider)}).`);
    }
    if (cfg.music !== undefined && !isObj(cfg.music)) bad('music', 'must be an object when set. Omit it entirely for the procedural bed.');
    else if (isObj(cfg.music)) {
        if (cfg.music.provider !== undefined && !MUSIC_PROVIDERS.includes(cfg.music.provider)) {
            bad('music.provider', `must be one of ${MUSIC_PROVIDERS.map((p) => `"${p}"`).join(', ')} (got ${JSON.stringify(cfg.music.provider)}).`);
        }
        if (cfg.music.gainDb !== undefined && !isNum(cfg.music.gainDb)) {
            bad('music.gainDb', `must be a number of dB, e.g. -18 (got ${JSON.stringify(cfg.music.gainDb)}).`);
        }
        if (cfg.music.track !== undefined) {
            const ids = bundledTracks().map((t) => t.id);
            if (!isStr(cfg.music.track) || !ids.includes(cfg.music.track)) {
                bad('music.track', `must be one of ${ids.map((i) => `"${i}"`).join(', ')} ` +
                    `(got ${JSON.stringify(cfg.music.track)}). Run "newsreel presets" for what each sounds like. ` +
                    `Only applies to the bundled "default" provider; use "file" for your own audio.`);
            } else if (cfg.music.provider !== undefined && cfg.music.provider !== 'default') {
                warns.push(`music.track is ignored because music.provider is "${cfg.music.provider}" (it selects a BUNDLED track).`);
            }
        }
        if (cfg.music.startAt !== undefined && (!isNum(cfg.music.startAt) || cfg.music.startAt < 0)) {
            bad('music.startAt', `must be seconds >= 0 (got ${JSON.stringify(cfg.music.startAt)}); it skips the track's intro so the bed opens on its groove.`);
        }
    }

    // -- video ------------------------------------------------------------------------------
    if (cfg.video !== undefined && !isObj(cfg.video)) {
        bad('video', 'must be an object when set.');
    } else if (isObj(cfg.video)) {
        const v = cfg.video;
        if (v.targetSeconds !== undefined && (!isNum(v.targetSeconds) || v.targetSeconds < 0)) {
            bad('video.targetSeconds', `must be a number >= 0; it is a soft target and only warns (got ${JSON.stringify(v.targetSeconds)}).`);
        }
        if (v.maxSpeed !== undefined && (!isNum(v.maxSpeed) || v.maxSpeed < 1)) {
            bad('video.maxSpeed', `must be a number >= 1; clips speed up to this to fit their narration (got ${JSON.stringify(v.maxSpeed)}).`);
        }
        if (v.title !== undefined && !isStr(v.title)) bad('video.title', 'must be a non-empty string when set.');
        if (v.narration !== undefined && !isStr(v.narration)) bad('video.narration', 'must be a non-empty string when set (the title card\'s voiceover).');
        if (v.narrator !== undefined && !isStr(v.narrator)) bad('video.narrator', 'must be a Voicebox profile name when set (who reads the title card).');
        if (v.thumbnail !== undefined && typeof v.thumbnail !== 'boolean') bad('video.thumbnail', `must be true or false (got ${JSON.stringify(v.thumbnail)}).`);
    }

    // -- compose (the Remotion renderer) ---------------------------------------------------
    if (cfg.compose !== undefined && !isObj(cfg.compose)) {
        bad('compose', 'must be an object when set, e.g. { "palette": "sunrise" }.');
    } else if (isObj(cfg.compose)) {
        const co = cfg.compose;
        if (co.palette !== undefined && !isStr(co.palette) && !isObj(co.palette)) {
            bad('compose.palette', `must be a palette name (${paletteIds().join(', ')}) or an object of colour overrides.`);
        } else if (isStr(co.palette) && !paletteIds().includes(co.palette)) {
            bad('compose.palette', `"${co.palette}" is not a known palette. ` +
                `Named palettes: ${paletteIds().join(', ')}.${near(co.palette, paletteIds())}`);
        }
        if (co.tailSeconds !== undefined && (!isNum(co.tailSeconds) || co.tailSeconds < 0)) {
            bad('compose.tailSeconds', `must be a number of seconds >= 0 (got ${JSON.stringify(co.tailSeconds)}).`);
        }
    }

    // -- shots --------------------------------------------------------------------------
    if (!Array.isArray(cfg.shots) || !cfg.shots.length) {
        // `login` skips this: it is what you run to reach the screens you then write shots for.
        if (!opts.skipShots) {
            bad('shots', 'required; a non-empty array. Each entry is one scene: { "id", "route", "caption", "narration", "actions" }.');
        }
    } else {
        const seen = new Map();
        cfg.shots.forEach((s, i) => {
            const at = `shots[${i}]`;
            if (!isObj(s)) { bad(at, 'must be an object.'); return; }

            if (!isStr(s.id)) bad(`${at}.id`, 'required; names this shot\'s clip and lower-third.');
            else if (!SHOT_ID.test(s.id)) {
                bad(`${at}.id`, `"${s.id}" must start with a letter or digit and use only letters, digits, ".", "_" or "-". ` +
                    'It becomes a filename.');
            } else if (seen.has(s.id)) {
                // ⚠️ Duplicate ids silently overwrite each other's clip: capture writes <id>.webm.
                bad(`${at}.id`, `"${s.id}" is already used by shots[${seen.get(s.id)}]. Ids must be unique; ` +
                    'both shots write the same clip file and one would be lost.');
            } else seen.set(s.id, i);

            // Two shot kinds: "capture" (the default; films the app at `route`) and
            // "generated" (records a packaged scene from the visuals harness).
            if (s.type !== undefined && !['capture', 'generated'].includes(s.type)) {
                bad(`${at}.type`, `must be "capture" or "generated" when set (got ${JSON.stringify(s.type)}).`);
            }
            if (s.type === 'generated') {
                if (!isStr(s.scene)) bad(`${at}.scene`, 'required for a generated shot; a scene name from the visuals registry, e.g. "swirl".');
                if (s.props !== undefined && !isObj(s.props)) bad(`${at}.props`, 'must be an object when set; passed to the scene as-is.');
                if (s.duration !== undefined && (!isNum(s.duration) || s.duration < 1 || s.duration > 120)) {
                    bad(`${at}.duration`, `must be a number of seconds from 1 to 120 (got ${JSON.stringify(s.duration)}); how long the scene stays on camera.`);
                }
                if (s.timeline !== undefined) {
                    if (!Array.isArray(s.timeline)) bad(`${at}.timeline`, 'must be an array of { "at": seconds, "action": name } when set.');
                    else s.timeline.forEach((b, j) => {
                        if (!isObj(b) || !isNum(b.at) || b.at < 0 || !isStr(b.action)) {
                            bad(`${at}.timeline[${j}]`, 'must be { "at": seconds >= 0, "action": "name", "args"?: any }.');
                        }
                    });
                }
                if (s.route !== undefined) warns.push(`${at}.route is ignored on a generated shot (the scene comes from the harness).`);
            } else if (!isStr(s.route)) {
                bad(`${at}.route`, 'required; the path to film, e.g. "/reconciliation".');
            // Only worth checking against a baseUrl that is itself valid; otherwise every shot
            // would report the same downstream symptom of one broken key.
            } else if (baseOk) {
                try { new URL(s.route, cfg.baseUrl); } catch {
                    bad(`${at}.route`, `"${s.route}" is not resolvable against baseUrl "${cfg.baseUrl}".`);
                }
            }
            for (const k of ['caption', 'narration', 'tag', 'narrator']) {
                if (s[k] !== undefined && !isStr(s[k])) bad(`${at}.${k}`, 'must be a non-empty string when set.');
            }
            // A per-shot narrator only means something when a provider can resolve voices by
            // name; voicebox can, the others read everything in the configured voice.
            if (isStr(s.narrator) && isObj(cfg.voice) && cfg.voice.provider && cfg.voice.provider !== 'voicebox') {
                warns.push(`${at}.narrator ("${s.narrator}") is ignored: voice.provider "${cfg.voice.provider}" has one voice. ` +
                    'Per-shot narrators need voice.provider "voicebox".');
            }
            if (!isStr(s.caption) && !isStr(s.narration)) {
                warns.push(`${at} ("${s.id || i}") has neither caption nor narration: no lower-third, and its length ` +
                    'falls back to the minimum.');
            }

            if (s.actions !== undefined && !Array.isArray(s.actions)) {
                bad(`${at}.actions`, `must be an array when set. Supported types: ${ACTION_TYPES.join(', ')}.`);
            } else if (Array.isArray(s.actions)) {
                s.actions.forEach((a, j) => validateAction(a, `${at}.actions[${j}]`, bad));
            }

            validateMotion(s.motion, `${at}.motion`, bad);
            if (s.trimBefore !== undefined && (!isNum(s.trimBefore) || s.trimBefore < 0)) {
                bad(`${at}.trimBefore`, `must be a number of seconds >= 0 (got ${JSON.stringify(s.trimBefore)}); ` +
                    'it overrides the automatic blank-lead trim for this clip (overrides the automatic blank-lead trim for this clip).');
            }
            if (s.speed !== undefined && (!isNum(s.speed) || s.speed < 0.5)) {
                bad(`${at}.speed`, `must be a number >= 0.5 (got ${JSON.stringify(s.speed)}); ` +
                    'it pins this clip\'s playback rate instead of fitting to narration (overrides the automatic blank-lead trim for this clip).');
            }
        });
    }

    // -- closingCard --------------------------------------------------------------------
    if (cfg.closingCard !== undefined && !isObj(cfg.closingCard)) {
        bad('closingCard', 'must be an object when set. Omit it to end on the last shot.');
    } else if (isObj(cfg.closingCard)) {
        // ⚠️ A closingCard without a title is silently dropped at render AND at assembly.
        if (!isStr(cfg.closingCard.title)) {
            bad('closingCard.title', 'required when closingCard is set (the card is skipped without it). ' +
                'Omit the whole closingCard block to end on the last shot.');
        }
        if (cfg.closingCard.lines !== undefined) {
            if (!Array.isArray(cfg.closingCard.lines)) bad('closingCard.lines', 'must be an array of strings when set.');
            else cfg.closingCard.lines.forEach((l, i) => {
                if (!isStr(l)) bad(`closingCard.lines[${i}]`, `must be a non-empty string (got ${JSON.stringify(l)}).`);
            });
        }
        if (cfg.closingCard.narration !== undefined && !isStr(cfg.closingCard.narration)) {
            bad('closingCard.narration', 'must be a non-empty string when set; it defaults to the title plus the lines.');
        }
        if (cfg.closingCard.narrator !== undefined && !isStr(cfg.closingCard.narrator)) {
            bad('closingCard.narrator', 'must be a Voicebox profile name when set (who reads the closing card).');
        }
    }

    // -- unknown top-level keys ----------------------------------------------------------
    // ⚠️ Not fatal (forward compatibility), but a typo'd block is invisible otherwise: "voise"
    //    would just mean no narration, and you would only notice in the finished cut.
    for (const k of Object.keys(cfg)) {
        if (TOP_LEVEL.includes(k) || k.startsWith('_') || k.startsWith('//')) continue;
        warns.push(`unknown top-level key "${k}" is ignored.${near(k, TOP_LEVEL)}`);
    }

    for (const w of warns) console.warn(`WARN: ${w}`);

    if (errs.length) {
        const lines = errs.map((e) => `  ${e.key}\n      ${e.msg}`).join('\n');
        fail(`${errs.length} problem${errs.length > 1 ? 's' : ''} in ${file}\n\n${lines}\n\n` +
            `See the Configuration section of the newsreel README.`);
    }
}

function validateMotion(m, at, bad) {
    if (m === undefined || m === null) return;
    const spec = typeof m === 'string' ? { type: m } : m;
    if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
        bad(at, 'must be a motion type string or an object, e.g. { "type": "in-out", "to": 1.07, "focus": [0.4, 0.35] }.');
        return;
    }
    if (spec.type !== undefined && !MOTION_TYPES.includes(spec.type)) {
        bad(`${at}.type`, `must be ${MOTION_TYPES.map((t) => `"${t}"`).join(' or ')} (got ${JSON.stringify(spec.type)}).${near(spec.type, MOTION_TYPES)}`);
    }
    // Zooming crops; past ~1.3 the lower-third starts losing its context.
    if (spec.to !== undefined && (typeof spec.to !== 'number' || !isFinite(spec.to) || spec.to < 1 || spec.to > 1.3)) {
        bad(`${at}.to`, `must be a number from 1 to 1.3 (got ${JSON.stringify(spec.to)}); it is the zoom peak.`);
    }
    if (spec.focus !== undefined) {
        const f = spec.focus;
        const okPair = Array.isArray(f) && f.length === 2 &&
            f.every((v) => typeof v === 'number' && isFinite(v) && v >= 0 && v <= 1);
        if (!okPair) {
            bad(`${at}.focus`, `must be [x, y] with both from 0 to 1 (got ${JSON.stringify(f)}); ` +
                'fractions of the frame the motion pushes toward.');
        }
    }
}

function validateAction(a, at, bad) {
    if (!a || typeof a !== 'object' || Array.isArray(a)) {
        bad(at, `must be an object, e.g. { "type": "click", "selector": "[data-testid=confirm]" }.`);
        return;
    }
    if (!ACTION_TYPES.includes(a.type)) {
        bad(`${at}.type`, `must be one of ${ACTION_TYPES.join(', ')} (got ${JSON.stringify(a.type)}).${near(a.type, ACTION_TYPES)}`);
        return;
    }
    // Selector-bearing actions: required for these, optional for press/scroll.
    if (['waitFor', 'click', 'fill', 'type'].includes(a.type) && !isStr(a.selector)) {
        bad(`${at}.selector`, `required for a "${a.type}" action. CSS or any Playwright engine, e.g. "text=Confirm".`);
    }
    if (['press', 'scroll'].includes(a.type) && a.selector !== undefined && !isStr(a.selector)) {
        bad(`${at}.selector`, 'must be a non-empty string when set.');
    }
    if (['fill', 'type'].includes(a.type) && a.value === undefined) bad(`${at}.value`, `required for a "${a.type}" action.`);
    if (a.type === 'type' && a.delay !== undefined && (!isNum(a.delay) || a.delay < 0)) {
        bad(`${at}.delay`, `must be a number of milliseconds per keystroke >= 0 (got ${JSON.stringify(a.delay)}).`);
    }
    if (a.type === 'press' && !isStr(a.key)) bad(`${at}.key`, 'required for a "press" action, e.g. "Enter".');
    if (a.type === 'wait' && a.ms !== undefined && (!isNum(a.ms) || a.ms < 0)) {
        bad(`${at}.ms`, `must be a number of milliseconds >= 0 (got ${JSON.stringify(a.ms)}).`);
    }
    if (a.timeout !== undefined && (!isNum(a.timeout) || a.timeout <= 0)) {
        bad(`${at}.timeout`, `must be a positive number of milliseconds (got ${JSON.stringify(a.timeout)}).`);
    }
    if (a.type === 'waitFor' && a.state !== undefined && !['attached', 'detached', 'visible', 'hidden'].includes(a.state)) {
        bad(`${at}.state`, `must be "attached", "detached", "visible" or "hidden" (got ${JSON.stringify(a.state)}).`);
    }
}

// --- did-you-mean -------------------------------------------------------------------

function distance(a, b) {
    const m = a.length, n = b.length;
    let prev = Array.from({ length: n + 1 }, (_, j) => j);
    for (let i = 1; i <= m; i++) {
        const cur = [i];
        for (let j = 1; j <= n; j++) {
            cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        }
        prev = cur;
    }
    return prev[n];
}

// "" when nothing is close enough, so it can be concatenated unconditionally.
function near(value, candidates) {
    const v = String(value == null ? '' : value).toLowerCase();
    if (!v) return '';
    const hits = candidates.filter((c) => distance(v, c.toLowerCase()) <= Math.max(2, Math.floor(c.length / 4)));
    return hits.length ? ` Did you mean ${hits.map((h) => `"${h}"`).join(' or ')}?` : '';
}

function suggest(value) {
    const v = String(value || '').toLowerCase();
    const ids = presetIds();
    const ranked = ids.map((id) => [id, distance(v, id.toLowerCase())]).sort((a, b) => a[1] - b[1]).slice(0, 3);
    return ranked.map(([id]) => `"${id}"`).join(', ');
}

module.exports = { validateConfig, VOICE_PROVIDERS, MUSIC_PROVIDERS, ACTION_TYPES };
