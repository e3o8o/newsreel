'use strict';
// Narrate a list of sections in place: for each one, synth its `vo` text and record the
// audio file + measured duration. Shared by assemble (ffmpeg cut) and compose (Remotion
// cut) so both renderers hear exactly the same voice pipeline.
//
// Narration is the slow step (a local TTS model can take ~90s per line), so progress and
// a heartbeat are printed: a silent ten-minute run is indistinguishable from a hung one.

const path = require('path');
const { synth } = require('./voice/index.cjs');

const WORDS_PER_SEC = 2.6; // ~156wpm, used only when voice.provider is "none"

const words = (t) => String(t || '').trim().split(/\s+/).filter(Boolean).length;

async function narrate(sections, { ff, voice, tmp }) {
    const total = sections.length;
    for (let i = 0; i < total; i++) {
        const s = sections[i];
        const provider = voice?.provider || 'voice';
        process.stdout.write(`  [${i + 1}/${total}] narrating "${s.name}" via ${provider} ... `);
        const started = Date.now();
        const beat = setInterval(() => {
            process.stdout.write(`${Math.round((Date.now() - started) / 1000)}s `);
        }, 15000);
        s.voFile = await synth(voice, s.vo, path.join(tmp, `vo-${s.name}`));
        clearInterval(beat);
        s.voDur = s.voFile ? ff.duration(s.voFile) : words(s.vo) / WORDS_PER_SEC + 0.6;
        const took = ` (${Math.round((Date.now() - started) / 1000)}s)`;
        console.log(`${s.voFile ? `${s.voDur.toFixed(1)}s audio` : 'estimated'}${took}`);
    }
    return sections;
}

module.exports = { narrate, WORDS_PER_SEC };
