'use strict';
// Narrate a list of sections in place: for each one, synth its `vo` text and record the
// audio file + measured duration. Shared by assemble (ffmpeg cut) and compose (Remotion
// cut) so both renderers hear exactly the same voice pipeline.
//
// Narration is by far the slow step -- a local cloned voice measured 60-120s PER LINE on a
// laptop, so a 17-line video is a ten-minute wait. That cost is per LINE, not per run, so
// results are cached by (provider, voice, narrator, text): re-cutting a video after changing
// one line, a scene, or the music re-speaks only what actually changed. Delete the cache
// directory to force a fresh read.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { synth } = require('./voice/index.cjs');

const WORDS_PER_SEC = 2.6; // ~156wpm, used only when voice.provider is "none"

const words = (t) => String(t || '').trim().split(/\s+/).filter(Boolean).length;

// Identity of a spoken line. The profile is included because the same words in another voice
// are a different recording, and the provider because switching engines must not reuse audio.
function cacheKey(voice, text, narrator) {
    const id = JSON.stringify({
        provider: voice?.provider || 'none',
        profile: voice?.profileId || voice?.profile || null,
        voiceId: voice?.voiceId || null,
        narrator: narrator || null,
        text: String(text || ''),
    });
    return crypto.createHash('sha1').update(id).digest('hex').slice(0, 16);
}

function findCached(dir, key) {
    if (!fs.existsSync(dir)) return null;
    // the provider picks the container, so match on the stem
    const hit = fs.readdirSync(dir).find((f) => f.startsWith(`${key}.`));
    return hit ? path.join(dir, hit) : null;
}

async function narrate(sections, { ff, voice, tmp, cacheDir }) {
    const dir = cacheDir || path.join(tmp, 'vo-cache');
    fs.mkdirSync(dir, { recursive: true });

    const total = sections.length;
    let reused = 0;
    for (let i = 0; i < total; i++) {
        const s = sections[i];
        const provider = voice?.provider || 'voice';
        const who = s.narrator ? ` (${s.narrator})` : '';
        const key = cacheKey(voice, s.vo, s.narrator);
        const cached = s.vo ? findCached(dir, key) : null;

        if (cached) {
            s.voFile = cached;
            s.voDur = ff.duration(cached);
            reused++;
            console.log(`  [${i + 1}/${total}] "${s.name}"${who} ... ${s.voDur.toFixed(1)}s audio (cached)`);
            continue;
        }

        process.stdout.write(`  [${i + 1}/${total}] narrating "${s.name}"${who} via ${provider} ... `);
        const started = Date.now();
        const beat = setInterval(() => {
            process.stdout.write(`${Math.round((Date.now() - started) / 1000)}s `);
        }, 15000);
        const out = await synth(voice, s.vo, path.join(dir, key), s.narrator);
        clearInterval(beat);

        // A provider may hand back a path it owns (Voicebox writes into its own store), so
        // copy it into the cache rather than assuming the name we asked for.
        if (out && path.dirname(out) !== dir) {
            const dest = path.join(dir, `${key}${path.extname(out) || '.wav'}`);
            try {
                fs.copyFileSync(out, dest);
                s.voFile = dest;
            } catch {
                s.voFile = out; // uncacheable, but usable
            }
        } else {
            s.voFile = out;
        }

        s.voDur = s.voFile ? ff.duration(s.voFile) : words(s.vo) / WORDS_PER_SEC + 0.6;
        const took = ` (${Math.round((Date.now() - started) / 1000)}s)`;
        console.log(`${s.voFile ? `${s.voDur.toFixed(1)}s audio` : 'estimated'}${took}`);
    }
    if (reused) console.log(`  (${reused}/${total} reused from ${path.relative(process.cwd(), dir) || dir})`);
    return sections;
}

module.exports = { narrate, WORDS_PER_SEC, cacheKey };
