# Feedback and promotion correction pass

Original evidence is retained in `feedback-audio-evidence.json` (502 exact-byte English voice, crowd, venue and UI audio files) and `activity-assets-evidence.json` (Director bitmap and palette recovery). SWA files contain MPEG Layer III streams, so retaining bytes with an MP3 extension allows browser decoding without recompression.

Implemented media/label greetings, media gift/press-kit reactions, original date/event-card sounds, and concert crowd response selected by satisfaction and venue occupancy (with original venue-specific fallback). No generic button-click sound was invented. Publisher dialogue and lip sync are not implemented. Recording previews honor the Sound off setting. Feedback stops on dialog transitions; pending decodes cannot start a stale voice.

Legacy silent saves enable feedback once without changing band, contract, cover, date or cash. Explicit subsequent mute is saved. Browser diagnostics distinguish decoded waveform RMS, live output RMS, AudioContext state and load failures. Live Web Audio signal checks do not establish physical loudspeaker output.

Time starts automatically at the nominal source cadence of three seconds per day. Modals, tutorials and hidden tabs pause progression. Original Director uses movie-loop frame counters, spreads daily subscribers across frames and can advance on its first active frame; this recreation retains its existing single daily settlement and starts after a full interval. Tour acceleration remains unimplemented.

Frame imports now honor Director white color-key ink even when recovered RGBA contains opaque alpha. All four outer corners have six transparent matte pixels and zero opaque white pixels. Promotion descriptions are bounded to their panels, category rows use source 42px content height, and advert surround includes the complete duration heading. Headline font is source-confirmed Verdana 11 bold; rich-text run fonts remain unverified, so this is not a claim of pixel-perfect equivalence.

Validation: 22 simulation checks passed. The full 15-test browser suite passed, followed by five promotion/audio/automatic-time/mute checks. Character and crowd checks observe nonzero live Web Audio output. Browser screenshots are retained in `test-results` and copied into `analysis/ui-review`. Browser and Tauri release compilation passed; native Tauri runtime was not exercised.
