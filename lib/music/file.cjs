'use strict';
// A local audio file, used as-is. Looped/trimmed/ducked like every other bed.

const fs = require('fs');
const { fail } = require('../util.cjs');

module.exports = {
    name: 'file',
    setup: (c) => {
        // Relative paths resolve against the config file's directory, not the shell's cwd.
        const at = c.resolve(c.req('music.path'));
        if (!fs.existsSync(at)) {
            fail(`music.path not found: ${at}\nRelative paths resolve against ${c.root}.`);
        }
        return { path: at };
    },
    source: (m) => m.path,
};
