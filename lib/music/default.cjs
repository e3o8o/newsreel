'use strict';
// The bundled default bed: a real instrumental, not the procedural drone. Used when the config
// has no `music` block, so every project gets actual music for free without configuring one.
// Generated once (BlockRun MiniMax Music) and committed here so it costs nothing to reuse.
// Override per project with music.provider "file" (your own track) or "mirelo" (a fresh one).
const path = require('path');
const fs = require('fs');

const TRACK = path.join(__dirname, '..', '..', 'assets', 'default-music.mp3');

module.exports = {
    name: 'default',
    setup: () => {
        if (!fs.existsSync(TRACK)) throw new Error(`bundled default music missing at ${TRACK}`);
        return { path: TRACK };
    },
    source: (m) => m.path,
};
