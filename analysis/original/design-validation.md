# Design Studio and album release validation

The canvas Design Studio uses recovered original media, not substituted artwork:
14 background choices (including none), four artist treatments, six effects and
14 bitmap logo fonts (plus no logo). Each font comes from its original Director
cast with source glyph rectangles, registration points and kerning. Musician
poses use the original instrument suffixes and eight authored placement layouts.
The cover layers are background, musicians, effects and logo. Effects therefore
leave the logo's colour unchanged. Unsupported original band configurations
retain the original absent musician layer.

The design chooser, CD frame, calendar frame, release event icon, arrows and
scroll thumb use original bitmaps. A palette decoding error found during visual
review was corrected: the agenda background declares Director grayscale palette
-3, not the default Windows palette. Native 011–013 supplied by the user guide
composition; the review gallery includes matching prototype states. Bands and
calendar dates differ. This is not a claim of complete pixel equivalence.

Booking uses the recovered selection prices and quality/image-style rules.
The suggested release is six days ahead; tomorrow is permitted. A signed demo
is required, confirming charges the full cover cost exactly once, and cancellation
charges nothing. Confirmed artwork snapshots the band and choices, is persisted,
and opens read-only afterward. Advancing to its release date marks the album
available by date; no invented sales, charts or publicity are generated.
Existing version-one saves migrate album to null without discarding a recorded
song, contract, band or cash. The original Media tutorial follows successful
booking. Actual promotion/venue interfaces are a subsequent implementation.

Validation covers renderer-independent prerequisites, affordability, invalid
choices/dates, original quality weighting, immutable demo quality, duplicate
booking protection and corrupt save rejection. The browser test selects a
Curtain / All musicians / Scratches / Gothic cover, cancels booking, drags its
release to tomorrow, confirms the 3,500 charge, reloads the saved sleeve, and
advances to release. Captures are in analysis/ui-review after running
scripts/build-ui-review.mjs.

Remaining fidelity limits: browser glyph resampling and dynamic UI text have
not been proven identical to Director; the grayscale luminance conversion uses
standard browser coefficients rather than a verified Director conversion;
original temporary mood modifiers are not yet modelled. Only one current album
and its release booking are implemented. Tour conflicts and the shared agenda
for future gigs/press bookings will need integration when those systems exist.

Evidence: design-assets-evidence.json, design-layouts-evidence.json,
DataDesignAndStage00.json, Main.dxr/00031-DlgDesignScript.lingo,
Main.dxr/00049-unnamed.lingo, VeryGeneral.cxt/00067-RenderFontScript.lingo,
RockGeneral.cxt/00135-AgendaScript.lingo and 00133-AgendaStuff.lingo.
