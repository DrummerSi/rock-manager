# Audio preloading

## Current playtest behavior — 15 October 2026

At the user's request, bulk audio preloading has been removed. Graphics and city ambience still preload; speech, effects, previews and music stems load on demand. The shared compressed-byte cache and decoded-buffer caches remain for reuse during the same visit. This removes the1985-file/about102MiB audio requirement before the menu. Staged loading, persistent caching and atlases are deferred.

TypeScript checking passed. The replacement browser check passed in9.1seconds: no feedback/music requests before the menu, followed by an on-demand Intro01_01 request and nonzero actual narration output RMS. Output: `test-results-audio-demand`.

## Previous full-preload experiment

The game previously preloaded images and city ambience, but FeedbackAudio and RecordingAudio fetched their files when first played. A slow connection could postpone a voice until after its dialog had closed and cancelled it.

GameScene now adds every prepared feedback/source-window sound and music stem to the Phaser loading queue. The1985 unique compressed files (about102MiB, plus the separately preloaded city ambience) must finish before create opens the menu. Progress includes these downloads. Loader errors block gameplay and show a canvas Retry button; successfully loaded files are reused on retry.

`src/game/audio-data.ts` retains compressed bytes in memory. Feedback playback, instrument playback and OfflineAudioContext WAV export use that store. Each decode receives a copy because decodeAudioData detaches its input. Decoded buffers remain cached in their existing audio controllers; all speech is not expanded to PCM at startup. Browser user-gesture audio unlocking still applies. This makes playback independent of the connection after loading, not an installable offline/PWA cache across page reloads.

Verification: TypeScript passed and all54 model/audio tests passed, including reuse after buffer detachment. `tests/browser/audio-preload.spec.ts` passed both browser cases in24.5seconds, with actual Edge/WebAudio output:

- Hold back the original narration download until all1984 other audio requests finish: loading remains visible and the game/menu is unavailable. Release it, disconnect networking, then start the briefing: original narration decodes and produces nonzero output RMS.
- Reject an audio download through Phaser's automatic retries: gameplay stays blocked and a Retry screen appears. Restore the request and press Retry: the menu opens. Disconnect networking again, play an instrument preview, return to the five-track mix and export a WAV with nonzero PCM RMS.

Artifacts: `test-results-audio-preload-final/`, including loading/error/briefing captures and `offline-mix.wav`. The initial error-path test assumed Phaser would make only one attempt; Phaser automatically retries failed loads. The final test keeps rejecting until the user presses Retry and passes. The initial successful delayed-download/offline-narration result was retained under `test-results-audio-preload/`.

Production check: `npm run tauri -- build --no-bundle` exited0, including asset preparation, TypeScript, browser production build and Windows release compilation. Temporary test server5174 was stopped. No manual desktop playback claim is made.
