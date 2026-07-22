// Typed view over data.json, which `newsreel compose` regenerates on every run.
// All timing is precomputed there (durations, live frames, playback rates) so these
// components stay pure presentation.

import raw from './data.json';

export type Palette = {
    bgGradient: string;
    bgGlow: string;
    card: string;
    cardSoft: string;
    ink: string;
    inkSoft: string;
    accent: string;
    accentInk: string;
    chip: string;
    frameRadius: number;
    font: string;
};

export type Motion = {
    type: 'in' | 'in-out';
    to: number;
    focus: [number, number];
};

export type CardSection = {
    kind: 'card';
    id: string;
    kicker: string;
    title: string;
    bullets: string[];
    voice: string | null;
    durationInFrames: number;
};

export type ShotSection = {
    kind: 'shot';
    id: string;
    clip: string;
    voice: string | null;
    durationInFrames: number;
    trimBeforeSec: number;
    playbackRate: number;
    liveFrames: number;
    tag: string;
    caption: string;
    motion: Motion | null;
};

export type Section = CardSection | ShotSection;

export type Data = {
    fps: number;
    width: number;
    height: number;
    voiceDelayFrames: number;
    palette: Palette;
    music: { file: string | null };
    sections: Section[];
};

export const data = raw as Data;
export const palette = data.palette;
export const totalFrames = data.sections.reduce((acc, s) => acc + s.durationInFrames, 0);
