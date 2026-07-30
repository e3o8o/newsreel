'use strict';
// The bundled beds: real instrumentals, not the procedural drone. Used when the config has no
// `music` block, so every project gets actual music for free without configuring one.
// Generated once (BlockRun MiniMax Music) and committed here so they cost nothing to reuse.
// Override per project with music.provider "file" (your own track) or "mirelo" (a fresh one).
//
// Three moods, because one bed cannot serve a calm weekly report AND a fast ad. Pick with
// music.track; the default stays "calm" so existing configs sound exactly as they did.
const path = require('path');
const fs = require('fs');
const { fail } = require('../util.cjs');

const TRACKS = {
    calm: { file: 'default-music.mp3', about: 'mellow, ~90 BPM. Weekly reports, walkthroughs.' },
    upbeat: { file: 'music-upbeat.mp3', about: 'energetic, ~124 BPM. Ads, launch videos, fast cuts.' },
    driving: { file: 'music-driving.mp3', about: 'confident mid-tempo, ~104 BPM. Demos, product tours.' },
};

const trackPath = (name) => path.join(__dirname, '..', '..', 'assets', TRACKS[name].file);

module.exports = {
    name: 'default',
    tracks: () => Object.entries(TRACKS).map(([id, t]) => ({ id, about: t.about })),
    setup: (c) => {
        // the kind's bed unless the config names one: an ad should not open on the
        // report's mellow track just because that is the global default
        const { getKind } = require('../kinds.cjs');
        const k = getKind(c.get('video.kind'));
        const track = String(c.get('music.track', (k && k.track) || 'calm'));
        if (!TRACKS[track]) {
            const list = Object.entries(TRACKS).map(([id, t]) => `  "${id}" - ${t.about}`).join('\n');
            fail(`music.track "${track}" is not a bundled track. Available:\n${list}\n` +
                `For your own audio use music.provider "file" with music.path.`);
        }
        const p = trackPath(track);
        if (!fs.existsSync(p)) throw new Error(`bundled music track "${track}" missing at ${p}`);
        return { path: p, track };
    },
    source: (m) => m.path,
};
