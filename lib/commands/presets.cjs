'use strict';
// List the bundled background presets by id, for style.background.preset.
//
//   newsreel presets           # human-readable
//   newsreel presets --json    # the raw asset, for scripting

const { tracks: bundledTracks } = require('../music/default.cjs');
const { KINDS } = require('../kinds.cjs');
const { presets } = require('../style.cjs');

// A gradient's three stops, drawn as swatches, so a terminal that supports truecolor shows the
// actual colours next to the id. Falls back to plain text everywhere else.
const supportsColor = () => process.stdout.isTTY && !process.env.NO_COLOR;
const swatch = (hex) => {
    if (!supportsColor()) return '';
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    return `\x1b[48;2;${r};${g};${b}m  \x1b[0m`;
};

function run({ args }) {
    const p = presets();
    if (args.json) {
        console.log(JSON.stringify({ gradients: p.gradients, solids: p.solids, shadowFormula: p.shadowFormula }, null, 2));
        return;
    }

    const width = Math.max(...p.all.map((x) => x.id.length));
    console.log(`\nBackground presets — use as: "style": { "background": { "preset": "<id>" } }\n`);

    console.log(`gradients (${p.gradients.length})`);
    for (const g of p.gradients) {
        const bar = g.stops.map(swatch).join('');
        console.log(`  ${g.id.padEnd(width)}  ${bar}  ${g.name} · ${g.angle}deg · ${g.stops.join(' ')}`);
    }

    console.log(`\nsolids (${p.solids.length})`);
    for (const s of p.solids) {
        console.log(`  ${s.id.padEnd(width)}  ${swatch(s.hex)}      ${s.name} · ${s.hex}`);
    }

    console.log(`\n${p.gradients.length} gradients + ${p.solids.length} solids = ${p.all.length} presets.`);
    console.log('Palette derived from BetterShot (KartikLabhshetwar/better-shot), BSD-3-Clause.');
    console.log('Custom instead: { "type": "gradient", "from": "#0f172a", "to": "#334155", "angle": 135 }');
    console.log('           or:  { "type": "solid", "color": "#0f172a" }\n');
}

module.exports = { run: async (c) => {
    await run(c);
    console.log('\nBUNDLED MUSIC TRACKS (music.track, with music.provider "default")');
    for (const t of bundledTracks()) console.log(`  ${t.id.padEnd(10)} ${t.about}`);
    console.log('\nVIDEO KINDS (video.kind) — each picks its background from a family, so two videos of');
    console.log('the same kind look like siblings rather than copies');
    for (const [id, k] of Object.entries(KINDS)) {
        console.log(`  ${id.padEnd(8)} ${k.about}`);
        console.log(`  ${' '.repeat(8)} bed ${k.track} · accent ${k.accent} · backgrounds: ${k.backgrounds.join(', ')}`);
    }
} };
