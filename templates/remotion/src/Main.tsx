import React from 'react';
import { Series, Sequence, staticFile, interpolate } from 'remotion';
import { Audio } from '@remotion/media';
import { CardScene } from './CardScene';
import { ShotScene } from './ShotScene';
import { data, totalFrames } from './data';

export const Main: React.FC = () => {
    return (
        <>
            <Series>
                {data.sections.map((s) => (
                    <Series.Sequence key={s.id} name={s.id} durationInFrames={s.durationInFrames}>
                        {s.kind === 'card' ? (
                            <CardScene card={s} settled={s.id === '_title'} />
                        ) : (
                            <ShotScene shot={s} />
                        )}
                        {s.voice ? (
                            // Narration starts a short beat into each section so cuts never clip a word.
                            <Sequence from={data.voiceDelayFrames} layout="none">
                                <Audio src={staticFile(s.voice)} />
                            </Sequence>
                        ) : null}
                    </Series.Sequence>
                ))}
            </Series>
            {data.music.file ? (
                // The bed arrives already gain-staged and faded to the exact total length
                // (newsreel's music providers do that), so it plays at unity volume with a
                // short safety fade at the very end.
                <Audio
                    src={staticFile(data.music.file)}
                    volume={(f) =>
                        interpolate(f, [0, totalFrames - 15, totalFrames - 3], [1, 1, 0], {
                            extrapolateLeft: 'clamp',
                            extrapolateRight: 'clamp',
                        })
                    }
                />
            ) : null}
        </>
    );
};
