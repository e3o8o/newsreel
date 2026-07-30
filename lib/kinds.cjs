'use strict';
// Video kinds: what a video is FOR decides how it should look and move.
//
// A weekly report and a launch ad are not the same object. The report wants a calm surface
// and room to read a number; the ad wants heat and pace. Shipping one house style for both
// is how every video ends up the same blue, which reads as nobody having chosen.
//
// So a kind is a recipe: a family of backgrounds to pick from (never a single fixed one), an
// accent, a music bed, pacing, and the scene styles that suit it. Everything here is a
// DEFAULT -- anything set explicitly in the config wins, always.

const KINDS = {
    report: {
        about: 'The weekly shipping report. Calm, legible, unhurried.',
        backgrounds: ['granite', 'arctic-lens', 'soft-linen', 'deep-ocean', 'tidal-pool'],
        accent: '#22c55e',
        theme: 'dark',
        track: 'calm',
        maxSpeed: 3,
        padding: 64,
        radius: 16,
        // scenes that suit it, for `init` and for whoever is choosing shots
        scenes: ['typer', 'text-reveal', 'blur-glow', 'tile-field', 'dotcut'],
    },
    demo: {
        about: 'A product walkthrough. Confident, focused on the screen.',
        backgrounds: ['tidal-pool', 'lagoon', 'granite', 'arctic-lens', 'deep-ocean'],
        accent: '#0ea5e9',
        theme: 'dark',
        track: 'driving',
        maxSpeed: 2.5,
        padding: 56,
        radius: 14,
        scenes: ['typer', 'liquid', 'squircle', 'materials', 'blur-reveal'],
    },
    ad: {
        about: 'A short, loud piece. Heat, pace, and a call to action.',
        backgrounds: ['forge', 'neon-pulse', 'ripe-mango', 'dawn-fire', 'coral-bloom', 'twilight'],
        accent: '#f59e0b',
        theme: 'dark',
        track: 'upbeat',
        maxSpeed: 3,
        padding: 88,
        radius: 22,
        scenes: ['swirl', 'chroma', 'chrome', 'kinetic', 'fire', 'design-tiles', 'cta'],
    },
    launch: {
        about: 'A launch film. Premium, deliberate, a little cinematic.',
        backgrounds: ['gemstone', 'twilight', 'neon-pulse', 'sunrise', 'sherbet'],
        accent: '#a78bfa',
        theme: 'dark',
        track: 'driving',
        maxSpeed: 2.5,
        padding: 80,
        radius: 20,
        scenes: ['chrome', 'emboss', 'blur-glow', 'fade', 'aurora', 'cursors', 'cta'],
    },
};

const kindIds = () => Object.keys(KINDS);
const getKind = (id) => KINDS[String(id || '').trim().toLowerCase()] || null;

// The style a config should render with: the kind's recipe underneath, the config on top.
// The background is picked from the kind's FAMILY rather than fixed, so two ads look like
// siblings instead of copies. The pick is persisted per video by lib/style.cjs.
function styleForKind(kindId, style = {}) {
    const k = getKind(kindId);
    if (!k) return style;
    const out = { ...style };
    if (out.accent === undefined) out.accent = k.accent;
    if (out.theme === undefined) out.theme = k.theme;
    if (out.padding === undefined) out.padding = k.padding;
    if (out.radius === undefined) out.radius = k.radius;
    if (out.background === undefined) out.background = { family: k.backgrounds };
    return out;
}

module.exports = { KINDS, kindIds, getKind, styleForKind };
