'use strict';
// Narration (text-to-speech). Not a step; the assemble command drives this.
//
// Every provider is one file implementing one interface:
//
//   module.exports = {
//       name,                        // the value of voice.provider in the config
//       async setup(c),              // validate + resolve; may fail() with instructions.
//                                    // Runs BEFORE anything renders, so a typo or a dead
//                                    // server costs a second. Returns the provider's state.
//       async synth(v, text, outBase) // -> a path to the audio, or null for "no narration".
//                                    // outBase has NO extension: the provider picks the
//                                    // container. ffprobe sniffs content, so it is cosmetic.
//   }
//
// Adding a provider: drop the file in this folder and add it to PROVIDERS below. There is no
// switch to hunt through.

const { fail } = require('../util.cjs');

const PROVIDERS = [
    require('./none.cjs'),
    require('./say.cjs'),
    require('./dir.cjs'),
    require('./voicebox.cjs'),
    require('./elevenlabs.cjs'),
];

const byName = new Map(PROVIDERS.map((p) => [p.name, p]));
const names = () => PROVIDERS.map((p) => p.name);

function get(name) {
    const p = byName.get(name);
    if (!p) {
        return fail(`voice.provider must be one of ${names().map((n) => `"${n}"`).join(', ')} (got "${name}")`);
    }
    return p;
}

// Every distinct shots[].narrator in the config. A shot can be voiced by someone other than
// voice.profile -- two narrators trading sections reads as a produced piece rather than a
// read-through -- and each extra voice has to be RESOLVED UP FRONT with the rest of the setup,
// or a typo'd name surfaces halfway through a slow narration run.
function narratorsIn(c) {
    const shots = c.get('shots', []);
    const seen = new Set();
    for (const s of Array.isArray(shots) ? shots : []) {
        if (s && typeof s.narrator === 'string' && s.narrator.trim()) seen.add(s.narrator.trim());
    }
    const card = c.get('closingCard.narrator');
    if (typeof card === 'string' && card.trim()) seen.add(card.trim());
    const title = c.get('video.narrator');
    if (typeof title === 'string' && title.trim()) seen.add(title.trim());
    return [...seen];
}

// Validate the voice config and resolve everything the provider needs. Async because
// voicebox probes its server here, so a dead server fails before any rendering happens.
async function voiceSetup(c) {
    const provider = c.get('voice.provider', 'none');
    const p = get(provider);
    const base = { provider, ...(await p.setup(c)) };
    // Resolve the named narrators too, when the provider knows how (voicebox does).
    const extra = narratorsIn(c);
    if (extra.length && typeof p.setupNarrator === 'function') {
        base.narrators = {};
        for (const name of extra) base.narrators[name] = await p.setupNarrator(c, base, name);
    }
    return base;
}

// One narration line -> one audio file (or null when there is no narration at all).
// `narrator` names an alternate voice resolved at setup; unknown or unsupported falls back to
// the configured one rather than failing a whole render over a cosmetic choice.
async function synth(voice, text, outBase, narrator) {
    const v = narrator && voice.narrators && voice.narrators[narrator]
        ? { ...voice, ...voice.narrators[narrator] }
        : voice;
    return get(voice.provider).synth(v, text, outBase);
}

module.exports = { voiceSetup, synth, names, narratorsIn };
