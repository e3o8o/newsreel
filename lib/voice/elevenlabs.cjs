'use strict';
// ElevenLabs: hosted, needs a key in voice.apiKeyEnv (env var, or a KEY=value line in the
// project's .env).

const fs = require('fs');
const { readEnv } = require('../config.cjs');
const { fail } = require('../util.cjs');

async function elevenlabs({ key, voiceId, model }, text, out) {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: { 'xi-api-key': key, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, model_id: model, voice_settings: { stability: 0.5, similarity_boost: 0.75 } }),
    });
    if (!res.ok) {
        const body = (await res.text()).slice(0, 200);
        // ⚠️ 402 on the free tier means a community/library voice. Premade voices only
        //    (Sarah, Matilda, Bella, ...); list what your key may use via GET /v1/voices.
        const hint = res.status === 402
            ? '\nThe free tier cannot use community library voices. Pick a premade voice (GET /v1/voices).'
            : '';
        throw new Error(`ElevenLabs TTS ${res.status}: ${body}${hint}`);
    }
    fs.writeFileSync(out, Buffer.from(await res.arrayBuffer()));
}

module.exports = {
    name: 'elevenlabs',
    setup: (c) => {
        const envName = c.req('voice.apiKeyEnv');
        const key = readEnv(envName, c.root);
        if (!key) {
            fail(`voice.provider is "elevenlabs" but ${envName} is not set.\n` +
                `Export it, or put ${envName}=... in the project's .env.\n` +
                `Or set voice.provider to "voicebox" (local), "say" (keyless, macOS), or "none" in ${c.file}.`);
        }
        return {
            key,
            voiceId: c.req('voice.voiceId'),
            model: c.get('voice.model', 'eleven_multilingual_v2'),
        };
    },
    synth: async (v, text, outBase) => {
        const out = `${outBase}.mp3`;
        await elevenlabs(v, text, out);
        return out;
    },
};
