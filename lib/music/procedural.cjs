'use strict';
// The keyless ffmpeg-synthesised drone: four detuned sines under a tremolo/lowpass/echo
// chain. Instant, free, and what this pipeline used before `music` was configurable, so it
// is also what an absent `music` block resolves to.

const path = require('path');

// The procedural bed's own reference level, applied before music.gainDb ducks it.
// 0.83 is not arbitrary: before `music` existed the bed baked in volume=0.15 and was then
// mixed at 0.7 (effective 0.105). 0.83 * 10^(-18/20) = 0.1045, so the DEFAULT gainDb
// reproduces that old mix to within 0.04 dB and an absent `music` block stays a no-op.
const PROC_REF = 0.83;

function proceduralBed(ff, seconds, out) {
    const d = seconds.toFixed(2);
    ff.run(['-y', '-loglevel', 'error',
        '-f', 'lavfi', '-i', `sine=f=98:r=44100:d=${d}`,
        '-f', 'lavfi', '-i', `sine=f=146.83:r=44100:d=${d}`,
        '-f', 'lavfi', '-i', `sine=f=196:r=44100:d=${d}`,
        '-f', 'lavfi', '-i', `sine=f=293.66:r=44100:d=${d}`,
        '-filter_complex', '[0][1][2][3]amix=inputs=4:normalize=0,tremolo=f=0.12:d=0.5,lowpass=f=620,' +
            `aecho=0.8:0.6:520|680:0.3|0.2,volume=${PROC_REF}[a]`,
        '-map', '[a]', '-ac', '2', out]);
}

module.exports = {
    name: 'procedural',
    setup: () => ({}),
    // Synthesised at exactly the length needed, so there is nothing to cache.
    source: (m, { ff, tmp, seconds }) => {
        const out = path.join(tmp, 'bed-procedural.wav');
        proceduralBed(ff, seconds, out);
        return out;
    },
};
