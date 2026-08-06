import React from 'react';
import {
    AbsoluteFill,
    Freeze,
    useCurrentFrame,
    useVideoConfig,
    interpolate,
    Easing,
    staticFile,
} from 'remotion';
import { Video } from '@remotion/media';
import { Backdrop } from './Backdrop';
import { LowerThird } from './LowerThird';
import { palette } from './data';
import type { ShotSection } from './data';

// One app shot: the capture in a rounded frame on the backdrop, an animated
// lower-third, Ken Burns motion, and a freeze on the last frame once the clip ends.
export const ShotScene: React.FC<{ shot: ShotSection }> = ({ shot }) => {
    const frame = useCurrentFrame();
    const { durationInFrames, width, height, fps } = useVideoConfig();

    // The frame the clip sits in: side margins, and the bottom strip reserved for the
    // lower-third so the caption never covers app content. The clip scales to fit the
    // space above that strip, keeping its aspect ratio.
    const lowerZone = 158;
    const frameTop = 44;
    const availW = width - 194;
    const availH = height - frameTop - lowerZone;
    const fit = Math.min(availW / width, availH / height);
    const frameW = Math.round(width * fit);
    const frameH = Math.round(height * fit);

    const frozen = frame >= shot.liveFrames;

    // Motion: "in" pushes toward the focus and stays; "in-out" pushes in over the first
    // 45% and eases back out before the cut, so the shot never ends mid-drift.
    let scale = 1;
    if (shot.motion) {
        const peak = Math.round(durationInFrames * 0.45);
        const stops = shot.motion.type === 'in-out'
            ? { at: [0, peak, durationInFrames - 6], val: [1, shot.motion.to, 1] }
            : { at: [0, peak], val: [1, shot.motion.to] };
        scale = interpolate(frame, stops.at, stops.val, {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: Easing.bezier(0.37, 0, 0.63, 1),
        });
    }
    const [fx, fy] = shot.motion ? shot.motion.focus : [0.5, 0.5];
    const tx = (0.5 - fx) * frameW * (scale - 1);
    const ty = (0.5 - fy) * frameH * (scale - 1);

    const video = (
        <Video
            src={staticFile(shot.clip)}
            trimBefore={Math.round(shot.trimBeforeSec * fps)}
            playbackRate={shot.playbackRate}
            muted
            style={{ width: frameW, height: frameH, display: 'block' }}
        />
    );

    return (
        <Backdrop>
            <AbsoluteFill style={{ alignItems: 'center' }}>
                <div
                    style={{
                        position: 'absolute',
                        top: frameTop,
                        left: (width - frameW) / 2,
                        width: frameW,
                        height: frameH,
                        borderRadius: palette.frameRadius,
                        overflow: 'hidden',
                        background: palette.card,
                        boxShadow: '0 34px 110px rgba(20, 8, 40, 0.5)',
                        opacity: interpolate(frame, [0, 10], [0, 1], {
                            extrapolateRight: 'clamp',
                        }),
                    }}
                >
                    <div
                        style={{
                            width: frameW,
                            height: frameH,
                            scale: String(scale),
                            translate: `${tx}px ${ty}px`,
                        }}
                    >
                        {frozen ? <Freeze frame={shot.liveFrames - 1}>{video}</Freeze> : video}
                    </div>
                </div>
                <LowerThird tag={shot.tag} caption={shot.caption} />
            </AbsoluteFill>
        </Backdrop>
    );
};
