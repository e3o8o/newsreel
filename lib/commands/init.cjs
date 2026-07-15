'use strict';
// Scaffold a newsreel.config.json from the bundled example.
//
//   newsreel init [--config ./newsreel.config.json] [--force]
//
// The example is copied verbatim, comments and all: the loader strips // and /* */ and
// trailing commas, so the inline documentation survives in a working config. What lands is
// then parsed and validated, so `init` can never leave a config the CLI would reject.

const fs = require('fs');
const path = require('path');
const { configPath, readConfig } = require('../config.cjs');
const { validateConfig } = require('../validate.cjs');
const { ensureDir, fail } = require('../util.cjs');

const EXAMPLE = path.join(__dirname, '..', '..', 'assets', 'newsreel.config.example.jsonc');

function run({ args }) {
    const dest = configPath(args);

    if (fs.existsSync(dest) && !args.force) {
        fail(`${dest} already exists.\n` +
            `Pass --force to overwrite it, or --config <path> to write somewhere else.`);
    }
    if (!fs.existsSync(EXAMPLE)) {
        fail(`The bundled example is missing at ${EXAMPLE}\nThis ships with newsreel; reinstall the package.`);
    }

    ensureDir(path.dirname(dest));
    fs.copyFileSync(EXAMPLE, dest);

    // 🧪 Prove the scaffold is loadable and valid rather than trusting it. If the bundled
    //    example ever drifts from the validator, this is where it surfaces.
    const cfg = readConfig(dest);
    validateConfig(cfg, dest);

    const rel = path.relative(process.cwd(), dest) || dest;
    console.log(`\nWrote ${dest}\n`);
    console.log('It is a working, commented reference config. Now:');
    console.log('  1. set "project" and "baseUrl" to your app (never production)');
    console.log('  2. set "auth.loginPath" / "auth.readyPath" for your sign-in flow');
    console.log('  3. replace "shots" with what you want to film');
    console.log('  4. pick a background:  newsreel presets');
    console.log('');
    console.log('Then:');
    console.log(`  newsreel login --config ${rel}     # log in once by hand`);
    console.log(`  newsreel run   --config ${rel}     # capture -> cards -> assemble`);
    console.log('');
    console.log(`Add "${path.basename(cfg.output && cfg.output.workDir || '.newsreel')}/" to .gitignore: ` +
        'it holds the saved session and the intermediates.\n');
}

module.exports = { run };
