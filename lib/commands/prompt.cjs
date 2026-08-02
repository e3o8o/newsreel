'use strict';
// Print the agent brief: everything an agent needs to drive newsreel, with no assumption that
// it has seen the repository.
//
//   newsreel prompt              print it
//   newsreel prompt --copy       copy it to the clipboard (macOS)
//
// It exists as a command rather than only a file in the repo because the common case is
// someone who installed the package and wants to hand the brief to an agent without going
// and finding it on GitHub.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { fail } = require('../util.cjs');

const BRIEF = path.join(__dirname, '..', '..', 'AGENT.md');

function run({ args }) {
    if (!fs.existsSync(BRIEF)) {
        fail(`The agent brief is missing at ${BRIEF}\nThis ships with newsreel; reinstall the package.`);
    }
    const text = fs.readFileSync(BRIEF, 'utf8');

    if (args.copy) {
        try {
            execFileSync('pbcopy', { input: text });
            console.log(`\nCopied the agent brief to the clipboard (${text.split('\n').length} lines).`);
            console.log('Paste it into an agent and describe the video you want.\n');
            return;
        } catch {
            // ⚠️ pbcopy is macOS only. Falling through to stdout beats failing: the user still
            //    gets the brief, just with their own copy step.
            console.error('(no pbcopy on this system; printing instead)\n');
        }
    }
    process.stdout.write(text.endsWith('\n') ? text : `${text}\n`);
}

module.exports = { run };
