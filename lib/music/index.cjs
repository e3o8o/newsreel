'use strict';
// The ambient bed under the narration. Not a step; the assemble command drives this.
//
// Every provider is one file implementing one interface:
//
//   module.exports = {
//       name,                     // the value of music.provider in the config
//       setup(c),                 // validate + resolve; may fail() with instructions. Runs
//                                 // BEFORE anything renders, and long before mirelo could
//                                 // spend a credit. Returns the provider's state.
//       async source(m, opts)     // -> a path to the raw bed, or null for "no bed".
//                                 // opts: { ff, workDir, tmp, seconds }
//   }
//
// Adding a provider: drop the file in this folder and add it to PROVIDERS below.
//
// The whole `music` block is optional. An ABSENT block means "procedural", which is exactly
// what the pipeline did before `music` existed, so old configs are unaffected.
//
// Providers return a raw bed; fitBed() below then loops/trims it to the video's length, ducks
// it to music.gainDb and fades both ends, so every provider mixes identically.

const path = require('path');
const { fail } = require('../util.cjs');

const PROVIDERS = [
    require('./none.cjs'),
    require('./procedural.cjs'),
    require('./default.cjs'),
    require('./file.cjs'),
    require('./mirelo.cjs'),
];

const byName = new Map(PROVIDERS.map((p) => [p.name, p]));
const names = () => PROVIDERS.map((p) => p.name);

const DEFAULT_GAIN_DB = -14;
const FADE = 2;                    // seconds of fade at each end of the bed

function get(name) {
    const p = byName.get(name);
    if (!p) {
        return fail(`music.provider must be one of ${names().map((n) => `"${n}"`).join(', ')} (got "${name}")`);
    }
    return p;
}

// Validate the music config and resolve everything the provider needs. Called early by the
// assemble command so a bad block fails before any rendering (or spending) happens.
function musicSetup(c) {
    // ♻️ No block at all -> the bed the pipeline always had.
    // ♻️ No block at all -> the bundled real instrumental (was the procedural drone).
    const provider = c.get('music.provider', 'default');
    const p = get(provider);
    if (provider === 'none') return { provider }; // no bed, so no level to validate

    const gainDb = Number(c.get('music.gainDb', DEFAULT_GAIN_DB));
    if (!isFinite(gainDb)) fail(`music.gainDb must be a number of dB (e.g. -18) in ${c.file}`);

    return { provider, gainDb, ...p.setup(c) };
}

// Loop/trim the bed to the video's length, duck it, fade both ends, normalise the format.
// ⚠️ gainDb applies to the bed AS DELIVERED; nothing is loudness-normalised. Providers differ:
//    measured at the default -18 dB, the procedural drone peaks about -35 dBFS while mirelo beds
//    came back at -32 to -25 dBFS depending only on the prompt. So a mirelo/file bed usually
//    wants a LOWER gainDb than the procedural default. Check a cut before shipping it.
function fitBed(ff, src, { seconds, gainDb }, out) {
    const d = seconds.toFixed(2);
    const fade = Math.min(FADE, seconds / 3);
    ff.run(['-y', '-loglevel', 'error',
        // -stream_loop tiles a short bed over a long video; -t bounds the infinite input.
        '-stream_loop', '-1', '-i', src,
        '-af', `volume=${gainDb}dB,afade=t=in:st=0:d=${fade.toFixed(2)},` +
            `afade=t=out:st=${Math.max(0, seconds - fade).toFixed(2)}:d=${fade.toFixed(2)}`,
        '-t', d, '-ar', '44100', '-ac', '2', out]);
}

// The bed for a video of `seconds`, ready to mix. Returns null when there is no bed.
async function musicBed(m, opts) {
    const src = await get(m.provider).source(m, opts);
    if (!src) return null;
    const out = path.join(opts.tmp, 'music.wav');
    fitBed(opts.ff, src, { seconds: opts.seconds, gainDb: m.gainDb }, out);
    return out;
}

module.exports = { musicSetup, musicBed, names, DEFAULT_GAIN_DB };
