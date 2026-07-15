'use strict';
// External tool discovery: ffmpeg/ffprobe (system binaries) and Playwright (the host
// project's, never ours). Nothing here is bundled; all of it is resolved at runtime and
// fails with instructions when missing.

const fs = require('fs');
const { execFileSync, spawnSync } = require('child_process');
const { fail } = require('./util.cjs');

// Resolve an external binary: explicit env override, then PATH, then the usual prefixes.
function bin(name, envVar) {
    const override = process.env[envVar];
    if (override) {
        if (fs.existsSync(override)) return override;
        fail(`${envVar}=${override} does not exist.`);
    }
    try {
        const p = execFileSync('which', [name], { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
        if (p) return p;
    } catch { /* not on PATH; fall through to the well-known prefixes */ }
    for (const p of [`/opt/homebrew/bin/${name}`, `/usr/local/bin/${name}`, `/usr/bin/${name}`]) {
        if (fs.existsSync(p)) return p;
    }
    return fail(`${name} not found on PATH. Install it (e.g. brew install ffmpeg) or set ${envVar}=/path/to/${name}.`);
}

// ⚠️ This package is installed next to (or outside) the project it films, but Playwright is
//    installed IN the project. A bare require() would resolve from this package's folder and
//    never find it, so resolve from the project root (the config file's directory) explicitly.
//    Playwright is a deliberately optional peer: it is heavy, the host usually already has it,
//    and bundling a second copy would be a waste and a version fight.
// `soft: true` returns null instead of exiting, for callers that have a fallback.
function chromium(root, { soft = false } = {}) {
    const paths = [root, process.cwd(), __dirname].filter(Boolean);
    for (const mod of ['playwright', '@playwright/test']) {
        try { return require(require.resolve(mod, { paths })).chromium; } catch { /* try next */ }
    }
    if (soft) return null;
    return fail(`Playwright not found from ${root}\n` +
        `Install it in the project:\n  npm i -D @playwright/test && npx playwright install chromium`);
}

// --- ffmpeg wrappers ----------------------------------------------------------------

function makeFf(FF, FP) {
    // Array args (never a shell string) so paths with spaces cannot break the command.
    const run = (args) => execFileSync(FF, args, { stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1 << 26 });
    const duration = (f) => {
        const out = execFileSync(FP, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f], {
            stdio: ['ignore', 'pipe', 'pipe'],
        }).toString().trim();
        const d = parseFloat(out);
        if (!isFinite(d)) throw new Error(`could not read duration of ${f}`);
        return d;
    };
    // ffmpeg writes its analysis to stderr; capture both streams.
    const probeText = (args) => {
        const r = spawnSync(FF, args, { encoding: 'utf8', maxBuffer: 1 << 28 });
        return `${r.stdout || ''}${r.stderr || ''}`;
    };
    return { run, duration, probeText };
}

// Resolve ffmpeg + ffprobe together. Callers that will eventually need them (assemble, run)
// call this up front so a missing binary costs a second, not a whole capture session.
function ffmpeg() {
    return makeFf(bin('ffmpeg', 'FFMPEG_PATH'), bin('ffprobe', 'FFPROBE_PATH'));
}

module.exports = { bin, chromium, makeFf, ffmpeg };
