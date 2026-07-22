import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, Easing } from 'remotion';
import { palette } from './data';

const ease = Easing.bezier(0.16, 1, 0.3, 1);

// Animated lower-third: chip pops in, caption slides in after it, both slide away
// just before the cut so every shot gets a clean exit.
export const LowerThird: React.FC<{ tag: string; caption: string }> = ({ tag, caption }) => {
    const frame = useCurrentFrame();
    const { durationInFrames } = useVideoConfig();
    const outStart = durationInFrames - 18;

    const enter = (from: number, to: number, a: number, b: number) =>
        interpolate(frame, [from, to], [a, b], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: ease,
        });
    const exit = interpolate(frame, [outStart, durationInFrames - 4], [0, 90], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.bezier(0.6, 0, 0.9, 0.4),
    });

    return (
        <div
            style={{
                position: 'absolute',
                left: 64,
                right: 64,
                bottom: 40,
                display: 'flex',
                alignItems: 'center',
                gap: 26,
                padding: '22px 34px',
                borderRadius: 20,
                background: palette.cardSoft,
                boxShadow: '0 18px 60px rgba(20, 8, 40, 0.4)',
                translate: `0px ${enter(6, 26, 110, 0) + exit}px`,
                opacity: enter(6, 22, 0, 1),
            }}
        >
            {tag ? (
                <span
                    style={{
                        background: palette.chip,
                        color: palette.accentInk,
                        fontWeight: 800,
                        fontSize: 24,
                        letterSpacing: '0.08em',
                        padding: '10px 22px',
                        borderRadius: 12,
                        whiteSpace: 'nowrap',
                        textTransform: 'uppercase',
                        scale: String(enter(10, 26, 0.6, 1)),
                    }}
                >
                    {tag}
                </span>
            ) : null}
            <span
                style={{
                    color: palette.ink,
                    fontSize: 34,
                    fontWeight: 600,
                    opacity: enter(16, 32, 0, 1),
                    translate: `${enter(16, 32, 24, 0)}px 0px`,
                }}
            >
                {caption}
            </span>
        </div>
    );
};
