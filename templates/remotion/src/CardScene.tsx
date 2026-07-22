import React from 'react';
import {
    AbsoluteFill,
    useCurrentFrame,
    useVideoConfig,
    interpolate,
    Easing,
} from 'remotion';
import { Backdrop } from './Backdrop';
import { palette } from './data';
import type { CardSection } from './data';

const ease = Easing.bezier(0.16, 1, 0.3, 1);

// Title and closing cards: kicker drops in, headline slides up, bullets stagger in.
export const CardScene: React.FC<{ card: CardSection }> = ({ card }) => {
    const frame = useCurrentFrame();
    const { durationInFrames, width } = useVideoConfig();
    const fadeOut = interpolate(frame, [durationInFrames - 12, durationInFrames - 2], [1, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });

    return (
        <Backdrop>
            <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', opacity: fadeOut }}>
                <div
                    style={{
                        width: Math.min(1220, width - 220),
                        borderRadius: 28,
                        padding: '72px 88px',
                        background: palette.cardSoft,
                        boxShadow: '0 40px 120px rgba(20, 8, 40, 0.45)',
                        scale: String(
                            interpolate(frame, [0, 24], [0.96, 1], {
                                extrapolateRight: 'clamp',
                                easing: ease,
                            }),
                        ),
                        opacity: interpolate(frame, [0, 16], [0, 1], {
                            extrapolateRight: 'clamp',
                        }),
                    }}
                >
                    <div
                        style={{
                            color: palette.accent,
                            fontSize: 26,
                            fontWeight: 700,
                            letterSpacing: '0.3em',
                            textTransform: 'uppercase',
                            opacity: interpolate(frame, [4, 20], [0, 1], {
                                extrapolateLeft: 'clamp',
                                extrapolateRight: 'clamp',
                            }),
                            translate: `0px ${interpolate(frame, [4, 20], [14, 0], {
                                extrapolateLeft: 'clamp',
                                extrapolateRight: 'clamp',
                                easing: ease,
                            })}px`,
                        }}
                    >
                        {card.kicker}
                    </div>
                    <h1
                        style={{
                            color: palette.ink,
                            fontSize: 84,
                            lineHeight: 1.05,
                            margin: '18px 0 34px 0',
                            fontWeight: 800,
                            opacity: interpolate(frame, [10, 28], [0, 1], {
                                extrapolateLeft: 'clamp',
                                extrapolateRight: 'clamp',
                            }),
                            translate: `0px ${interpolate(frame, [10, 28], [26, 0], {
                                extrapolateLeft: 'clamp',
                                extrapolateRight: 'clamp',
                                easing: ease,
                            })}px`,
                        }}
                    >
                        {card.title}
                    </h1>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                        {card.bullets.map((b, i) => {
                            const start = 26 + i * 9;
                            return (
                                <div
                                    key={b}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'baseline',
                                        gap: 18,
                                        opacity: interpolate(frame, [start, start + 14], [0, 1], {
                                            extrapolateLeft: 'clamp',
                                            extrapolateRight: 'clamp',
                                        }),
                                        translate: `${interpolate(frame, [start, start + 14], [-26, 0], {
                                            extrapolateLeft: 'clamp',
                                            extrapolateRight: 'clamp',
                                            easing: ease,
                                        })}px 0px`,
                                    }}
                                >
                                    <span style={{ color: palette.accent, fontSize: 30, fontWeight: 800 }}>
                                        ▸
                                    </span>
                                    <span style={{ color: palette.inkSoft, fontSize: 34, lineHeight: 1.3 }}>
                                        {b}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </AbsoluteFill>
        </Backdrop>
    );
};
