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

// Validate the voice config and resolve everything the provider needs. Async because
// voicebox probes its server here, so a dead server fails before any rendering happens.
async function voiceSetup(c) {
    const provider = c.get('voice.provider', 'none');
    const p = get(provider);
    return { provider, ...(await p.setup(c)) };
}

// One narration line -> one audio file (or null when there is no narration at all).
async function synth(voice, text, outBase) {
    return get(voice.provider).synth(voice, text, outBase);
}

module.exports = { voiceSetup, synth, names };
