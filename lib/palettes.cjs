'use strict';
// Named palettes for the compose (Remotion) renderer. A palette is the whole look of a
// cut: backdrop gradient, panel colours, ink, and the accent that carries chips and
// bullets. Keeping them named makes "give this week a different feel" a one-word change
// (compose.palette), and thumbnails inherit the brightness of the backdrop.

const PALETTES = {
    // Bright and warm; thumbnails read loud in a feed. The week-3 FinanceCrew look.
    sunrise: {
        bgGradient: 'linear-gradient(135deg, #ff9a5a 0%, #ff5e62 30%, #ff2e88 65%, #7b2ff7 100%)',
        bgGlow: 'radial-gradient(ellipse at 20% 10%, rgba(255,255,255,0.35), transparent 55%)',
        card: '#16121f',
        cardSoft: 'rgba(22, 18, 31, 0.88)',
        ink: '#fff7ef',
        inkSoft: 'rgba(255, 247, 239, 0.78)',
        accent: '#ffd166',
        accentInk: '#161320',
        chip: '#ffd166',
    },
    // Cool blue-violet; calmer, reads "infrastructure".
    'deep-ocean': {
        bgGradient: 'linear-gradient(135deg, #3a47d5 0%, #3d5af1 45%, #6a5af9 100%)',
        bgGlow: 'radial-gradient(ellipse at 25% 15%, rgba(255,255,255,0.28), transparent 55%)',
        card: '#0d1220',
        cardSoft: 'rgba(13, 18, 32, 0.9)',
        ink: '#f2f6ff',
        inkSoft: 'rgba(242, 246, 255, 0.75)',
        accent: '#4ade80',
        accentInk: '#07130c',
        chip: '#4ade80',
    },
    // Dark green-black; matches dark finance UIs shot-for-shot.
    emerald: {
        bgGradient: 'linear-gradient(135deg, #052e22 0%, #064e3b 55%, #0a6c50 100%)',
        bgGlow: 'radial-gradient(ellipse at 20% 10%, rgba(52, 211, 153, 0.22), transparent 55%)',
        card: '#08110d',
        cardSoft: 'rgba(8, 17, 13, 0.9)',
        ink: '#ecfdf5',
        inkSoft: 'rgba(236, 253, 245, 0.75)',
        accent: '#34d399',
        accentInk: '#04130d',
        chip: '#34d399',
    },
    // Near-black with a hot pink accent; the "launch night" look.
    midnight: {
        bgGradient: 'linear-gradient(135deg, #0b0b13 0%, #171226 60%, #241436 100%)',
        bgGlow: 'radial-gradient(ellipse at 25% 12%, rgba(236, 72, 153, 0.22), transparent 55%)',
        card: '#0a0a12',
        cardSoft: 'rgba(10, 10, 18, 0.92)',
        ink: '#fdf2f8',
        inkSoft: 'rgba(253, 242, 248, 0.72)',
        accent: '#ec4899',
        accentInk: '#14040d',
        chip: '#ec4899',
    },
};

const COMMON = {
    frameRadius: 18,
    font: "'Helvetica Neue', Helvetica, Arial, sans-serif",
};

const paletteIds = () => Object.keys(PALETTES);

// A name, or an object overriding any subset of a named base (default sunrise).
function resolvePalette(spec) {
    if (spec == null) return { ...COMMON, ...PALETTES.sunrise };
    if (typeof spec === 'string') {
        const hit = PALETTES[spec];
        if (!hit) return null;
        return { ...COMMON, ...hit };
    }
    const base = PALETTES[spec.base || 'sunrise'] || PALETTES.sunrise;
    return { ...COMMON, ...base, ...spec, base: undefined };
}

module.exports = { PALETTES, paletteIds, resolvePalette };
