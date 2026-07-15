'use strict';
// Loading newsreel.config.json — the single seam between this generic pipeline and a project.
//
// Nothing in lib/ may hardcode a route, port, org, selector, or project name; it all comes
// from here.
//
// Path convention: relative paths in the config resolve against the CONFIG FILE's directory
// (i.e. the project root, where newsreel.config.json lives), never against process.cwd().

const fs = require('fs');
const path = require('path');
const { fail } = require('./util.cjs');
const { validateConfig } = require('./validate.cjs');

const DEFAULT_CONFIG = './newsreel.config.json';

// Strip // and /* */ comments and trailing commas. String-aware, so the "//" inside
// "http://localhost:3000" survives (a naive regex stripper corrupts every baseUrl).
function stripJsonc(src) {
    let out = '';
    let inStr = false, quote = '', esc = false, inLine = false, inBlock = false;
    for (let i = 0; i < src.length; i++) {
        const c = src[i], n = src[i + 1];
        if (inLine) {
            if (c === '\n') { inLine = false; out += c; }
            continue;
        }
        if (inBlock) {
            if (c === '*' && n === '/') { inBlock = false; i++; }
            continue;
        }
        if (inStr) {
            out += c;
            if (esc) esc = false;
            else if (c === '\\') esc = true;
            else if (c === quote) inStr = false;
            continue;
        }
        if (c === '"' || c === "'") { inStr = true; quote = c; out += c; continue; }
        if (c === '/' && n === '/') { inLine = true; i++; continue; }
        if (c === '/' && n === '*') { inBlock = true; i++; continue; }
        out += c;
    }
    return out.replace(/,(\s*[}\]])/g, '$1');
}

function parseArgs(argv = process.argv.slice(2)) {
    const args = {};
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (!a.startsWith('--')) continue;
        const eq = a.indexOf('=');
        if (eq > -1) { args[a.slice(2, eq)] = a.slice(eq + 1); continue; }
        const next = argv[i + 1];
        if (next && !next.startsWith('--')) args[a.slice(2)] = argv[++i];
        else args[a.slice(2)] = true;
    }
    return args;
}

function dig(obj, dotted) {
    return dotted.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

// Where --config points, resolved. Shared by loadConfig and `init`.
function configPath(args) {
    if (args.config === true) fail(`--config needs a path: --config ${DEFAULT_CONFIG}`);
    return path.resolve(String(args.config || DEFAULT_CONFIG));
}

// Read and parse, without validating. `init` uses this to check what it just wrote.
function readConfig(file) {
    if (!fs.existsSync(file)) {
        fail(`Config not found: ${file}\n` +
            `Pass --config <path>, or scaffold one:\n  newsreel init`);
    }
    try {
        return JSON.parse(stripJsonc(fs.readFileSync(file, 'utf8')));
    } catch (e) {
        return fail(`Config is not valid JSON: ${file}\n  ${e.message}\n` +
            `(// and /* */ comments and trailing commas are allowed and stripped before parsing.)`);
    }
}

// Load newsreel.config.json, validate it, and return an accessor bundle.
//   .req(key)  -> value, or a clear exit naming the missing key and the file
//   .get(k, d) -> value or default
//   .resolve(p)-> absolute path, relative paths anchored at the config's directory
function loadConfig(argv = process.argv.slice(2)) {
    const args = parseArgs(argv);
    const file = configPath(args);
    const cfg = readConfig(file);
    if (!cfg || typeof cfg !== 'object' || Array.isArray(cfg)) fail(`Config must be a JSON object: ${file}`);

    // ⚠️ Up front, before any browser opens or any credit could be spent: a config typo must
    //    cost a second, not a capture session. Provider secrets and server reachability are
    //    NOT checked here (they need env/network); voice/music setup does that, still before
    //    anything renders.
    validateConfig(cfg, file);

    const root = path.dirname(file);
    return {
        cfg,
        args,
        file,
        root,
        resolve: (p) => (path.isAbsolute(p) ? p : path.join(root, p)),
        get: (k, d) => {
            const v = dig(cfg, k);
            return v === undefined ? d : v;
        },
        req: (k) => {
            const v = dig(cfg, k);
            if (v === undefined || v === null || v === '') {
                fail(`Missing required config key "${k}" in ${file}\n` +
                    `See the Configuration section of the newsreel README, or scaffold a\n` +
                    `fresh reference config next to it:  newsreel init --config ./example.json`);
            }
            return v;
        },
    };
}

// Read an env var, falling back to a .env file at the project root (KEY=value lines).
// Keeps secrets out of the config while still working with the common .env workflow.
function readEnv(name, root) {
    if (process.env[name]) return process.env[name].trim();
    const dotenv = path.join(root, '.env');
    if (fs.existsSync(dotenv)) {
        const m = fs.readFileSync(dotenv, 'utf8').match(new RegExp(`^${name}=(.*)$`, 'm'));
        if (m) return m[1].trim().replace(/^["']|["']$/g, '');
    }
    return null;
}

module.exports = { stripJsonc, parseArgs, dig, loadConfig, readConfig, configPath, readEnv, DEFAULT_CONFIG };
