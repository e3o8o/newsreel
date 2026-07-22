import React from 'react';
import { Composition } from 'remotion';
import { Main } from './Main';
import { data, totalFrames } from './data';

export const RemotionRoot: React.FC = () => {
    return (
        <Composition
            id="Launch"
            component={Main}
            durationInFrames={totalFrames}
            fps={data.fps}
            width={data.width}
            height={data.height}
        />
    );
};
