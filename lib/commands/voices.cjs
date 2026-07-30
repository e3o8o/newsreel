'use strict';
// Install the bundled narration voices into the local Voicebox, so a fresh machine does not
// have to recreate them by hand.
//
//   newsreel voices            list what ships and what the server already has
//   newsreel voices --install  create the missing ones
//
// What "bundled" means here: the PROFILES ship with newsreel, not the TTS models. A preset
// voice is metadata pointing at a voice the Kokoro engine already has, so it costs a few
// hundred bytes; a cloned voice ships as its exported archive with its samples. The engine
// models themselves are Voicebox's own multi-gigabyte download, cached once per machine in
// ~/.cache/huggingface -- nothing here re-fetches them, and nothing can bundle them.

const fs = require('fs');
const path = require('path');
const { fail } = require('../util.cjs');

const VOICES_DIR = path.join(__dirname, '..', '..', 'assets', 'voices');
const DEFAULT_BASE = 'http://127.0.0.1:17493';

const norm = (v) => String(v == null ? '' : v).trim().toLowerCase();

function bundled() {
    const file = path.join(VOICES_DIR, 'voices.json');
    if (!fs.existsSync(file)) fail(`bundled voices missing at ${file} (broken install?)`);
    return JSON.parse(fs.readFileSync(file, 'utf8')).voices;
}

async function serverProfiles(baseUrl) {
    let res;
    try {
        res = await fetch(`${baseUrl}/profiles`);
    } catch (e) {
        fail(`Voicebox is not reachable at ${baseUrl} (${(e && e.message) || 'no response'}).\n` +
            `Install and launch Voicebox (https://voicebox.sh), then re-run.\n` +
            `If it listens elsewhere, pass --base-url http://127.0.0.1:PORT.`);
    }
    if (!res.ok) fail(`Voicebox ${baseUrl}/profiles returned ${res.status}. Is this a Voicebox server?`);
    const list = await res.json();
    return Array.isArray(list) ? list : [];
}

async function createPreset(baseUrl, v) {
    const res = await fetch(`${baseUrl}/profiles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            name: v.name,
            description: v.about || null,
            language: v.language || 'en',
            voice_type: 'preset',
            preset_engine: v.engine,
            preset_voice_id: v.voiceId,
            default_engine: v.engine,
        }),
    });
    if (!res.ok) throw new Error(`${res.status}: ${(await res.text()).slice(0, 160)}`);
    return res.json();
}

async function importArchive(baseUrl, v) {
    const file = path.join(VOICES_DIR, v.archive);
    if (!fs.existsSync(file)) throw new Error(`archive missing: ${file}`);
    const form = new FormData();
    form.append('file', new Blob([fs.readFileSync(file)]), v.archive);
    const res = await fetch(`${baseUrl}/profiles/import`, { method: 'POST', body: form });
    if (!res.ok) throw new Error(`${res.status}: ${(await res.text()).slice(0, 160)}`);
    return res.json();
}

async function run(c) {
    const baseUrl = String(c.args['base-url'] || c.get('voice.baseUrl', DEFAULT_BASE)).replace(/\/+$/, '');
    const want = bundled();
    const have = await serverProfiles(baseUrl);
    const haveNames = new Set(have.map((p) => norm(p.name)));

    const missing = want.filter((v) => !haveNames.has(norm(v.name)));
    console.log(`Voicebox at ${baseUrl}: ${have.length} profile(s) installed.\n`);
    for (const v of want) {
        const there = haveNames.has(norm(v.name));
        const kind = v.kind === 'cloned' ? 'cloned' : `preset ${v.engine}/${v.voiceId}`;
        console.log(`  ${there ? '✓' : '·'} ${v.name.padEnd(18)} ${kind.padEnd(24)} ${v.about || ''}`);
        if (v.note) console.log(`      ${v.note}`);
    }

    if (!missing.length) {
        console.log(`\nAll bundled voices are installed. Use one with voice.profile in your config.`);
        return;
    }
    if (!c.args.install) {
        console.log(`\n${missing.length} not installed. Add them:\n  newsreel voices --install`);
        return;
    }

    console.log('');
    for (const v of missing) {
        process.stdout.write(`  installing ${v.name} ... `);
        try {
            const made = v.kind === 'cloned' ? await importArchive(baseUrl, v) : await createPreset(baseUrl, v);
            console.log(`ok (${(made && (made.id || made.profile_id)) || 'created'})`);
        } catch (e) {
            console.log(`FAILED: ${e.message}`);
        }
    }
    console.log(`\nDone. Set voice.profile (and shots[].narrator) to any of these names.`);
}

module.exports = { run, bundled };
