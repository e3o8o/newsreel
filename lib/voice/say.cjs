'use strict';
// macOS `say`: the keyless fallback. Nothing to install, no key, no server.

const { execFileSync } = require('child_process');

// ⚠️ `say` accepts an unknown -v silently (exit 0, default voice), so a voiceId left over
//    from the elevenlabs provider would swap the voice with no signal at all. Check it up
//    front against `say -v '?'` instead of trusting the exit code.
function sayVoice(voice) {
    if (!voice) return null;
    let names = [];
    try {
        names = execFileSync('say', ['-v', '?'], { stdio: ['ignore', 'pipe', 'ignore'] })
            .toString().split('\n').map((l) => l.trim().split(/\s+/)[0]).filter(Boolean);
    } catch {
        return voice; // cannot enumerate; let `say` decide
    }
    if (names.includes(voice)) return voice;
    console.warn(`WARN: "${voice}" is not a macOS 'say' voice; using the system default.\n` +
        `      Pick one from: say -v '?'  (e.g. Samantha)`);
    return null;
}

function sayTts(voice, text, out) {
    execFileSync('say', voice ? ['-v', voice, '-o', out, text] : ['-o', out, text],
        { stdio: ['ignore', 'pipe', 'pipe'] });
}

module.exports = {
    name: 'say',
    setup: (c) => ({ voiceId: sayVoice(c.get('voice.voiceId', null)) }),
    synth: (v, text, outBase) => {
        const out = `${outBase}.aiff`;
        sayTts(v.voiceId, text, out);
        return out;
    },
};
