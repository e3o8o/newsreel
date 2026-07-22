import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate } from 'remotion';
import { palette } from './data';

// Shared backdrop with a slow drifting glow so even card scenes have life.
// The glow layer is oversized so the drift never pulls its hard edge into frame.
export const Backdrop: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
    const frame = useCurrentFrame();

    return (
        <AbsoluteFill style={{ background: palette.bgGradient, fontFamily: palette.font }}>
            <div
                style={{
                    position: 'absolute',
                    left: '-30%',
                    top: '-30%',
                    width: '160%',
                    height: '160%',
                    background: palette.bgGlow,
                    translate: `${interpolate(frame, [0, 900], [0, 160])}px ${interpolate(
                        frame,
                        [0, 900],
                        [0, 60],
                    )}px`,
                }}
            />
            {children}
        </AbsoluteFill>
    );
};
