'use strict';
// 🔌 Voicebox (voicebox.sh) runs a local TTS server: keyless, and nothing leaves the machine.
//
// Contract, verified against a live server (v0.x, FastAPI) rather than taken from the README:
//   GET  /profiles                  -> a bare array of {id, name, ...}
//   POST /generate {text,profile_id,language,engine,model_size}
//                                   -> a JOB RECORD, not audio:
//                                      {id, status:"generating", audio_path:"", error:null, ...}
//   GET  /history/{id}              -> the same record, with a terminal status once it settles
//   GET  /audio/{id}                -> the rendered audio for a completed generation
//   GET  /generate/{id}/status      -> the same status as an SSE stream ("data: {...}"). Not
//                                      used here: /history is plain JSON and easier to poll.
//   POST /speak                     -> speaks aloud; not a file source, so never called here.
//
// ⚠️ /generate IS ASYNC. The README implies it answers with the audio, and it does not: it
//    returns immediately with status "generating" and an EMPTY audio_path, then renders in the
//    background. Coding to the README (as this adapter originally did) means every run dies on
//    "neither audio nor a path/url", because "" is correctly rejected as a pointer. So: submit,
//    poll /history until the status settles, then take the audio.
//
// ⚠️ Failures come back as HTTP 200 with status:"failed" and a populated `error` (e.g. "No
//    samples found for profile <id>" when a cloned profile has no voice samples attached). They
//    are not HTTP errors, so they have to be read out of the record or they look like success.
//
// The older README-shaped responses (audio bytes, or JSON pointing straight at a file) are
// still handled, for server versions that answer that way.

const fs = require('fs');
const { fail } = require('../util.cjs');

const VOICEBOX_BASE = 'http://127.0.0.1:17493';
const AUDIO_EXT = {
    'audio/wav': '.wav', 'audio/x-wav': '.wav', 'audio/wave': '.wav', 'audio/vnd.wave': '.wav',
    'audio/mpeg': '.mp3', 'audio/mp3': '.mp3', 'audio/ogg': '.ogg', 'audio/opus': '.opus',
    'audio/flac': '.flac', 'audio/aac': '.aac', 'audio/mp4': '.m4a',
};
const extFor = (ct) => AUDIO_EXT[String(ct || '').split(';')[0].trim().toLowerCase()] || '.wav';

// Never guess about an unreachable server; the user has to install or launch it.
function unreachable(baseUrl, e) {
    const why = (e && e.cause && (e.cause.code || e.cause.message)) || (e && e.message) || 'no response';
    fail(`Voicebox is not reachable at ${baseUrl} (${why}).\n` +
        `Install and launch Voicebox (https://voicebox.sh), then re-run.\n` +
        `If it listens elsewhere, set voice.baseUrl. To go without it, set voice.provider to\n` +
        `"say" (keyless, macOS), "elevenlabs", or "none".`);
}

const norm = (v) => String(v == null ? '' : v).trim().toLowerCase();

// ⚠️ Defensive: accept a bare array or a wrapped list, and entries that are either plain
//    names or objects. Normalises everything to { id, name, engine }.
function profileList(payload) {
    const raw = Array.isArray(payload)
        ? payload
        : (payload && (payload.profiles || payload.data || payload.items || payload.voices)) || [];
    if (!Array.isArray(raw)) return [];
    return raw.map((p) => (typeof p === 'string'
        ? { id: p, name: p, engine: null }
        : {
            id: p.id ?? p.profile_id ?? p.uuid ?? p.name,
            name: p.name ?? p.title ?? p.label ?? p.id,
            // ⚠️ The engine the profile is built for. /generate DEFAULTS to "qwen" when the
            //    request omits engine, and a preset profile (e.g. a bundled Kokoro voice)
            //    rejects that with a 400 -- so the profile's own engine must ride along.
            engine: p.default_engine ?? p.preset_engine ?? null,
        }))
        .filter((p) => p.id != null);
}

// Resolves voice.profile (a name, case-insensitive, or an id) to the id /generate wants.
// Doubles as the reachability probe, so a bad setup fails before anything renders.
async function voiceboxSetup(baseUrl, want, language, engineOverride) {
    let res;
    try {
        res = await fetch(`${baseUrl}/profiles`);
    } catch (e) {
        unreachable(baseUrl, e);
    }
    if (!res.ok) {
        fail(`Voicebox ${baseUrl}/profiles returned ${res.status}.\n` +
            `Is this a Voicebox server? Check voice.baseUrl (default ${VOICEBOX_BASE}).`);
    }
    const list = profileList(await res.json().catch(() => null));
    if (!list.length) {
        fail(`Voicebox has no voice profiles at ${baseUrl}/profiles.\n` +
            `Create one first (a preset voice works: no cloning, no samples needed),\n` +
            `then set voice.profile to its name.`);
    }
    const hit = want
        ? list.find((p) => norm(p.id) === norm(want) || norm(p.name) === norm(want))
        : list[0];
    if (!hit) {
        fail(`Voicebox has no profile "${want}".\nAvailable: ${list.map((p) => p.name).join(', ')}`);
    }
    if (!want) console.log(`voice: no voice.profile set; using Voicebox's first profile "${hit.name}".`);
    return { profileId: hit.id, language, engine: engineOverride || hit.engine || null };
}

// Pointer shapes, for servers that answer with a file location directly. Note `audio_path` is
// also the key the async job record uses, which is why an empty value must never count as a hit.
const POINTER_KEYS = ['path', 'file', 'file_path', 'filepath', 'output_path', 'audio_path',
    'url', 'audio_url', 'audio', 'output', 'result'];

// Anything not in flight. `completed` is the schema's default; the rest are the observed and
// documented ends. Unknown statuses are treated as still-running until the deadline, which
// fails with a diagnosis rather than silently accepting a half-rendered file.
const TERMINAL = ['completed', 'complete', 'done', 'success', 'succeeded', 'failed', 'error', 'cancelled', 'canceled'];
const isFailure = (s) => ['failed', 'error', 'cancelled', 'canceled'].includes(String(s || '').toLowerCase());

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Poll /history/{id} until the generation settles. Local TTS is fast but not instant, and a
// model still loading can take a while, so the deadline is generous.
// ⚠️ 180s suits a hosted API. Voicebox runs the model on this machine, so generation competes
//    with everything else running: measured 102s for one sentence on a loaded laptop, and
//    ~38s per TOKEN once the machine started swapping. Default generously and let a config
//    raise it; a run that dies at 3 minutes has thrown away the whole capture session.
async function settle(baseUrl, id, { timeoutMs = 900000, intervalMs = 500 } = {}) {
    const deadline = Date.now() + timeoutMs;
    let last = null;
    while (Date.now() < deadline) {
        let res;
        try {
            res = await fetch(`${baseUrl}/history/${id}`);
        } catch (e) {
            unreachable(baseUrl, e); // the server went away mid-render
        }
        if (!res.ok) throw new Error(`Voicebox /history/${id} returned ${res.status} while waiting for the generation.`);
        last = await res.json().catch(() => null);
        if (!last || typeof last !== 'object') throw new Error(`Voicebox /history/${id} returned an unreadable record.`);
        if (TERMINAL.includes(String(last.status || '').toLowerCase())) return last;
        await sleep(intervalMs);
    }
    throw new Error(`Voicebox generation ${id} did not finish within ${Math.round(timeoutMs / 1000)}s ` +
        `(last status "${last && last.status}"). Is a TTS model still loading? Check the Voicebox app.`);
}

// A settled record -> a playable file. Prefer the path the server reports (Voicebox is local, so
// it is readable in place and needs no copy); fall back to the audio endpoint.
async function audioFrom(baseUrl, rec, outBase) {
    if (isFailure(rec.status)) {
        // ⚠️ HTTP was 200. The failure only exists in the record.
        throw new Error(`Voicebox generation ${rec.id} ${rec.status}: ${rec.error || 'no error given'}`);
    }
    if (typeof rec.audio_path === 'string' && rec.audio_path && fs.existsSync(rec.audio_path)) {
        return rec.audio_path;
    }
    const dl = await fetch(`${baseUrl}/audio/${rec.id}`);
    if (!dl.ok) {
        throw new Error(`Voicebox /audio/${rec.id} returned ${dl.status} for a "${rec.status}" generation ` +
            `(audio_path was ${JSON.stringify(rec.audio_path)}).`);
    }
    const out = `${outBase}${extFor(dl.headers.get('content-type'))}`;
    fs.writeFileSync(out, Buffer.from(await dl.arrayBuffer()));
    return out;
}

async function voiceboxTts({ baseUrl, profileId, language, timeoutMs, modelSize, engine }, text, outBase) {
    let res;
    try {
        res = await fetch(`${baseUrl}/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                text,
                profile_id: profileId,
                language,
                // ⚠️ Omitting engine means the SERVER default ("qwen"), not the profile's
                //    engine: preset profiles then 400. Send what the profile was built for.
                ...(engine ? { engine } : {}),
                ...(modelSize ? { model_size: modelSize } : {}),
            }),
        });
    } catch (e) {
        unreachable(baseUrl, e);
    }
    if (!res.ok) throw new Error(`Voicebox /generate ${res.status}: ${(await res.text()).slice(0, 200)}`);

    const ct = String(res.headers.get('content-type') || '').toLowerCase();

    // Shape A: the response body IS the audio.
    if (ct.startsWith('audio/') || ct.includes('octet-stream')) {
        const out = `${outBase}${extFor(ct)}`;
        fs.writeFileSync(out, Buffer.from(await res.arrayBuffer()));
        return out;
    }

    const body = await res.text();
    let j = null;
    try { j = JSON.parse(body); } catch { /* not JSON either; fall through to the error */ }

    // Shape B: a JOB RECORD. This is what a real Voicebox server actually returns. Submit ->
    // poll -> collect. A record that already carries a terminal status skips the polling.
    if (j && typeof j === 'object' && j.id && typeof j.status === 'string') {
        const rec = TERMINAL.includes(j.status.toLowerCase()) ? j : await settle(baseUrl, j.id, { timeoutMs });
        return audioFrom(baseUrl, rec, outBase);
    }

    // Shape C: JSON pointing at the rendered file, by url or by local path.
    if (j && typeof j === 'object') {
        const key = POINTER_KEYS.find((k) => typeof j[k] === 'string' && j[k]);
        const at = key ? j[key] : null;
        if (at && /^https?:\/\//i.test(at)) {
            const dl = await fetch(at);
            if (!dl.ok) throw new Error(`Voicebox audio download ${dl.status} from ${at}`);
            const out = `${outBase}${extFor(dl.headers.get('content-type'))}`;
            fs.writeFileSync(out, Buffer.from(await dl.arrayBuffer()));
            return out;
        }
        if (at && fs.existsSync(at)) return at; // a local path; ffmpeg reads it in place
        if (at) throw new Error(`Voicebox /generate pointed at "${at}" (key "${key}") but it does not exist.`);
    }
    throw new Error(`Voicebox /generate returned ${ct || 'an unrecognised body'} that is none of the ` +
        `handled shapes (keys: ${j && typeof j === 'object' ? Object.keys(j).join(', ') || 'none' : 'not JSON'}).\n` +
        `Handled: audio bytes; a job record with {id,status}; or JSON with one of: ${POINTER_KEYS.join(', ')}.`);
}

module.exports = {
    name: 'voicebox',
    setup: async (c) => {
        const baseUrl = String(c.get('voice.baseUrl', VOICEBOX_BASE)).replace(/\/+$/, '');
        // voice.engine: optional override; by default the profile's own engine is used.
        const resolved = await voiceboxSetup(baseUrl, c.get('voice.profile', null),
            c.get('voice.language', 'en'), c.get('voice.engine', null));
        // voice.timeoutMs: how long to wait per narration. Local models on a busy machine are slow.
        // voice.modelSize: which TTS model to generate with ("1.7B" default, "0.6B" smaller).
        //   ⚠️ The big model needs to stay resident. On a machine that cannot hold it, it is
        //   paged per token: measured 33s PER TOKEN (a 2-hour narration) on an 8GB laptop.
        //   Drop to 0.6B there rather than waiting it out.
        return {
            baseUrl,
            timeoutMs: Number(c.get('voice.timeoutMs', 900000)),
            modelSize: c.get('voice.modelSize', null),
            ...resolved,
        };
    },
    synth: (v, text, outBase) => voiceboxTts(v, text, outBase),
};
