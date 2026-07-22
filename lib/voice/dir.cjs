'use strict';
// Pre-recorded narration from a directory: bring your own reads (a studio session, a
// paid TTS run, a colleague's voiceover). One file per section, named vo-<section> with
// an .mp3/.wav/.m4a/.aiff extension — including vo-_title and vo-_closing when the
// cards narrate. The assemble step still measures each file and fits sections to it,
// so externally produced audio behaves exactly like generated audio.

const fs = require('fs');
const path = require('path');
const { fail } = require('../util.cjs');

const EXTS = ['.mp3', '.wav', '.m4a', '.aiff'];

module.exports = {
    name: 'dir',
    setup: (c) => {
        const dir = c.resolve(c.req('voice.dir'));
        if (!fs.existsSync(dir)) {
            fail(`voice.dir not found: ${dir}\nRelative paths resolve against ${c.root}.`);
        }
        return { dir };
    },
    synth: (v, text, outBase) => {
        const base = path.basename(outBase);
        for (const ext of EXTS) {
            const p = path.join(v.dir, base + ext);
            if (fs.existsSync(p)) return p;
        }
        return fail(`voice.dir has no audio for "${base}" in ${v.dir}\n` +
            `Expected ${base}${EXTS.join(' or ')}. One file per section: vo-_title, ` +
            `vo-<shotId> per shot, vo-_closing.`);
    },
};
