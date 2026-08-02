#!/usr/bin/env node
'use strict';
// newsreel — the CLI surface. Parse a command, load the config, dispatch.
//
// Nothing project-specific lives here or anywhere else in the package: it all comes from
// newsreel.config.json.

const { loadConfig, parseArgs, DEFAULT_CONFIG } = require('../lib/config.cjs');
const { fail } = require('../lib/util.cjs');
const pkg = require('../package.json');

// `config: true` -> the command gets the loaded+validated config bundle.
// `config: false` -> it gets { args } only.
const COMMANDS = {
    init: {
        config: false,
        mod: '../lib/commands/init.cjs',
        blurb: 'Scaffold a newsreel.config.json from the bundled example',
        usage: ['--generated       an all-generated video: no app, no login, runs immediately',
                '--config <path>   where to write it (default ' + DEFAULT_CONFIG + ')',
                '--force           overwrite an existing file'],
    },
    prompt: {
        config: false,
        mod: '../lib/commands/prompt.cjs',
        blurb: 'Print the agent brief: hand it to an agent and it can drive newsreel',
        usage: ['--copy            copy it to the clipboard instead (macOS)'],
    },
    presets: {
        config: false,
        mod: '../lib/commands/presets.cjs',
        blurb: 'List the background presets for style.background.preset',
        usage: ['--json            print the raw preset data'],
    },
    voices: {
        // The bundled voices are useful before a config exists (they are what you point
        // voice.profile AT), so this must not require one.
        config: false,
        mod: '../lib/commands/voices.cjs',
        blurb: 'List the bundled narration voices, and install them into Voicebox',
        usage: ['--install         create the ones the server does not have',
                '--base-url <url>  Voicebox address (default http://127.0.0.1:17493)'],
    },
    login: {
        config: true,
        // Logging in is how you get far enough into an app to write the shot list, so this one
        // cannot require shots to exist yet.
        skipShots: true,
        mod: '../lib/commands/login.cjs',
        blurb: 'Open a headed browser; log in by hand; save the session',
        usage: ['--timeout <sec>   how long to wait for auth.readyPath (default 480)'],
    },
    capture: {
        config: true,
        mod: '../lib/commands/capture.cjs',
        blurb: 'Record one clip per shot, reusing the saved session',
        usage: ['--only <shotId>   re-record a single shot', '--headless        no visible browser', '--slow-mo <ms>    pacing between actions (default 500)'],
    },
    cinema: {
        config: true,
        mod: '../lib/commands/cinema.cjs',
        blurb: 'Debug one shot\'s camera pass: render it standalone and print the plan',
        usage: ['--only <shotId>   which shot (default: the first with a camera)'],
    },
    cards: {
        config: true,
        mod: '../lib/commands/cards.cjs',
        blurb: 'Render the title/closing cards and one lower-third per shot',
    },
    assemble: {
        config: true,
        mod: '../lib/commands/assemble.cjs',
        blurb: 'ffmpeg cut: styled frame + speed-fit + voiceover + music + thumbnail',
        usage: ['--date <YYYY-MM-DD>  output folder name (default today)'],
    },
    compose: {
        config: true,
        mod: '../lib/commands/compose.cjs',
        blurb: 'Remotion cut: animated cards/lower-thirds + Ken Burns + voiceover + music',
        usage: ['--date <YYYY-MM-DD>  output folder name (default today)'],
    },
    run: {
        config: true,
        mod: '../lib/commands/run.cjs',
        blurb: 'capture -> cards -> assemble',
        usage: ['(takes every flag the three steps take)'],
    },
};

const PAD = Math.max(...Object.keys(COMMANDS).map((k) => k.length));

function usage() {
    const lines = [
        '',
        `newsreel ${pkg.version} — ${pkg.description}`,
        '',
        'USAGE',
        '  newsreel <command> [--config ./newsreel.config.json] [options]',
        '',
        'COMMANDS',
    ];
    for (const [name, c] of Object.entries(COMMANDS)) lines.push(`  ${name.padEnd(PAD)}  ${c.blurb}`);
    lines.push(
        '',
        'QUICKSTART (no app needed)',
        '  newsreel init --generated     # a video made entirely of bundled scenes',
        '  newsreel run                  # finished mp4, no login and no keys',
        '',
        'QUICKSTART (filming your app)',
        '  newsreel init                 # scaffold a config, then fill it in',
        '  newsreel presets              # pick a background and a music bed',
        '  newsreel voices --install     # put the bundled narration voices in Voicebox',
        '  newsreel login                # log in once by hand; the session is saved',
        '  newsreel run                  # capture -> cards -> assemble',
        '',
        'WORKING WITH AN AGENT',
        '  newsreel prompt --copy        # the brief, on your clipboard; paste it and describe the video',
        '',
        'REQUIREMENTS',
        '  ffmpeg + ffprobe on PATH (or FFMPEG_PATH / FFPROBE_PATH)',
        '  Playwright installed in the project being filmed:',
        '    npm i -D @playwright/test && npx playwright install chromium',
        '',
        `Run "newsreel <command> --help" for a command's options.`,
        '',
    );
    console.log(lines.join('\n'));
}

function commandUsage(name) {
    const c = COMMANDS[name];
    const lines = ['', `newsreel ${name} — ${c.blurb}`, '', 'OPTIONS'];
    if (c.config) lines.push(`  --config <path>   the config to use (default ${DEFAULT_CONFIG})`);
    for (const u of c.usage || []) lines.push(`  ${u}`);
    lines.push('');
    console.log(lines.join('\n'));
}

async function main() {
    const argv = process.argv.slice(2);
    const first = argv[0];

    if (!first || first === 'help' || first === '--help' || first === '-h') {
        // "newsreel help capture" documents that one command.
        const topic = argv[1];
        if (topic && COMMANDS[topic]) commandUsage(topic);
        else usage();
        return;
    }
    if (first === '--version' || first === '-v' || first === 'version') {
        console.log(pkg.version);
        return;
    }
    if (first.startsWith('-')) {
        usage();
        fail(`Expected a command, got "${first}".`);
    }

    const spec = COMMANDS[first];
    if (!spec) {
        usage();
        fail(`Unknown command "${first}". Expected one of: ${Object.keys(COMMANDS).join(', ')}`);
    }

    const rest = argv.slice(1);
    if (rest.includes('--help') || rest.includes('-h')) { commandUsage(first); return; }

    const cmd = require(spec.mod);
    // Config commands get the validated bundle; the rest just get their flags.
    await cmd.run(spec.config ? loadConfig(rest, { skipShots: spec.skipShots }) : { args: parseArgs(rest) });
}

main().catch((e) => {
    // fail() already exited for anything we diagnosed. Anything reaching here is unexpected:
    // show the message, plus ffmpeg's stderr when it is an ffmpeg failure.
    const extra = e && e.stderr ? `\n${e.stderr.toString().slice(0, 400)}` : '';
    fail(`newsreel failed: ${e && e.message ? e.message : e}${extra}`);
});
