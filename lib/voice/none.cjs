'use strict';
// No narration. The assemble command then estimates each section's length from the text
// instead of from a rendered voiceover, and mixes silence so there is still one audio path.

module.exports = {
    name: 'none',
    setup: () => ({ voiceId: null }),
    synth: () => null,
};
