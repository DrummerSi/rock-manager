# Animation white artifacts: corrected compositing rule

The previous claim that the artifacts were fixed was unsupported. The previous
tests checked selected captures and cue state, rather than testing transparency
throughout animation playback. Exterior-only white removal left enclosed white
islands opaque. That reproduces Director ink8 (Matte), not the game's ink36
(Background Transparent).

The original `Main.dxr` score uses ink36 and indexed white0 for every active
FaceAnim channel120–124. The independent audit retains all19 score frames and
35 active sprite records, their raw bytes, file ranges and hashes in
`actor-score-ink-evidence.json`. Regenerate using:

```powershell
node scripts/audit-actor-score-ink.mjs
```

`RockUtil.cxt/00063-RenderMusicianScript.lingo` also uses `copyPixels` with ink36
for each registered backdrop/body/eyes/mouth member. The original
[Director dictionary](https://www.manualshelf.com/manual/macromedia/director-mx-lingo-dictionary/user-guide-english/page-313.html)
documents background transparency as a color key. Connectivity or a near-white
threshold is not part of that rule.

Animation recovery now keys every exact-white pixel, including enclosed pixels,
in animation backdrops and move layers. Nonwhite colors remain intact. Static
mood portraits are separate originals and are not modified by this rule. Atlas
URLs now include their content hash so updated exports have new browser URLs.

The actual WebGL component was exercised with all17 characters through80 source
speech-cue samples. Before correction:133,919 stray-white pixel observations,
with1,732 in the worst sampled frame. After correction:0, with no browser errors.
The retained reports are `animation-before-browser-audit.json` and
`animation-after-browser-audit.json`; corresponding captures are in
`analysis/ui-review/animation-before-first.png` and `animation-after-first.png`.
These are measured samples, not a claim of complete game rendering equivalence.

`tests/browser/animation-matte.spec.ts` checks actual canvas pixels through80
speech samples and every supported idle mood, then checks every atlas pixel.
The fixture uses the production portrait component and RGB555 output pipeline.
The full original pose-transition and blinking state machine remains unfinished.
