'use strict';
// 🔌 mirelo (api.mirelo.ai) generates a bed from a text prompt.
//
// 💰 THIS ONE COSTS MONEY. Two protections, both load-bearing:
//    1. The free preflight always runs first and the price is logged BEFORE anything is spent,
//       so a run can never silently burn credits.
//    2. The result is cached under output.workDir keyed by (prompt, durationMs, loop) — exactly
//       what changes the audio — so re-runs reuse the bed and spend nothing.
//
// Buy a SHORT loop (music.durationMs) and let fitBed tile it. Buying the full video length
// instead re-spends on every narration tweak, because the length is part of the cache key.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { readEnv } = require('../config.cjs');
const { ensureDir, fail } = require('../util.cjs');

const MIRELO_BASE = 'https://api.mirelo.ai/v2/text-to-sfx/v1.6';
const DEFAULT_DURATION_MS = 30000;

// ⚠️ mirelo's documented duration_ms bounds. Looped beds may be far longer than one-shots.
const DUR_LOOP = { min: 3000, max: 600000 };
const DUR_ONCE = { min: 1000, max: 60000 };

// Verified contract:
//   GET  /preflight?duration_ms=X&num_samples=Y -> {"credits":N,"estimated_ms":N}  (free)
//   POST /sync  {prompt,duration_ms,loop,num_samples} -> {"result_urls":["<wav url>"]}
// The url is a short-lived presigned S3 link (~1h), so the FILE is what gets cached, never the
// url. Output is mono 44.1k WAV; fitBed() re-rates it to stereo.
async function mireloGenerate(m, out) {
    // 💰 Preflight is free. Always price the job and say so BEFORE spending anything.
    const pre = await fetch(`${MIRELO_BASE}/preflight?duration_ms=${m.durationMs}&num_samples=1`, {
        headers: { Authorization: `Bearer ${m.key}` },
    });
    if (!pre.ok) {
        const body = (await pre.text()).slice(0, 200);
        const hint = pre.status === 401 || pre.status === 403
            ? `\nCheck ${m.envName}; mirelo rejected the key.` : '';
        throw new Error(`mirelo preflight ${pre.status}: ${body}${hint}`);
    }
    const { credits, estimated_ms: est } = await pre.json();
    console.log(`music: mirelo generating ${(m.durationMs / 1000).toFixed(1)}s ` +
        `(loop=${m.loop}) -> ${credits} credits, est ${((est || 0) / 1000).toFixed(1)}s.`);
    console.log(`       caching to ${path.basename(out)}; re-runs reuse it and spend nothing.`);

    const res = await fetch(`${MIRELO_BASE}/sync`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${m.key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: m.prompt, duration_ms: m.durationMs, loop: m.loop, num_samples: 1 }),
    });
    if (!res.ok) throw new Error(`mirelo /sync ${res.status}: ${(await res.text()).slice(0, 200)}`);

    const j = await res.json();
    const url = Array.isArray(j.result_urls) ? j.result_urls[0] : null;
    if (!url) throw new Error(`mirelo /sync returned no result_urls (keys: ${Object.keys(j).join(', ')})`);

    const dl = await fetch(url);
    if (!dl.ok) throw new Error(`mirelo result download ${dl.status}`);
    fs.writeFileSync(out, Buffer.from(await dl.arrayBuffer()));
}

module.exports = {
    name: 'mirelo',
    setup: (c) => {
        const envName = c.get('music.apiKeyEnv', 'MIRELO_API_KEY');
        const key = readEnv(envName, c.root);
        if (!key) {
            fail(`music.provider is "mirelo" but ${envName} is not set.\n` +
                `Export it, or put ${envName}=... in the project's .env.\n` +
                `Or set music.provider to "procedural" (keyless), "file", or "none" in ${c.file}.`);
        }
        const loop = c.get('music.loop', true) !== false;
        const durationMs = Math.round(Number(c.get('music.durationMs', DEFAULT_DURATION_MS)));
        const lim = loop ? DUR_LOOP : DUR_ONCE;
        if (!isFinite(durationMs) || durationMs < lim.min || durationMs > lim.max) {
            fail(`music.durationMs must be ${lim.min}-${lim.max} when music.loop is ${loop} ` +
                `(got ${c.get('music.durationMs', DEFAULT_DURATION_MS)}) in ${c.file}`);
        }
        return { key, envName, loop, durationMs, prompt: c.req('music.prompt') };
    },
    // Only mirelo is cached, because only mirelo costs money. The cache key is exactly what
    // changes the audio.
    source: async (m, { workDir }) => {
        const dir = ensureDir(path.join(workDir, 'music'));
        const key = crypto.createHash('sha1')
            .update(JSON.stringify([m.prompt, m.durationMs, m.loop]))
            .digest('hex').slice(0, 12);
        const out = path.join(dir, `mirelo-${key}.wav`);
        if (fs.existsSync(out)) {
            console.log(`music: reusing cached mirelo bed ${path.basename(out)} (0 credits).`);
            return out;
        }
        await mireloGenerate(m, out);
        return out;
    },
};
