'use strict';
// Small shared primitives. No config, no I/O beyond mkdir.

const fs = require('fs');

// Every "you configured this wrong" exit goes through here so the message is uniform.
function fail(msg) {
    console.error(`\n${msg}\n`);
    process.exit(1);
}

// Dimensions round down to even (h264/yuv420p needs it) but can never reach 0.
const even = (n) => Math.max(2, Math.floor(n / 2) * 2);
// Offsets round down to even too (keeps chroma aligned under overlay) but 0 is legal.
const even0 = (n) => Math.max(0, Math.floor(n / 2) * 2);

const ensureDir = (d) => { fs.mkdirSync(d, { recursive: true }); return d; };

function stamp(d = new Date()) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

module.exports = { fail, even, even0, ensureDir, stamp };
