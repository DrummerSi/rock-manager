# City surround recovery

The original `Main.dxr` first score frame references RockMaterial slots 157
and 159 for the city sides. Both sprites are located at (400,300), with
background-transparent ink 36. Their cast registration points put the left
40x547 bitmap at (0,53) and the right 38x600 bitmap at (762,0).

The previous exported PNGs were entirely black. The retained BITD payloads
are one-bit masks: the left is PackBits compressed and the right is raw.
Decoding MSB-first, with one as black and zero as transparent white matte,
reveals the side margins and matching lower curves ending at y=550.
These are source pixels, not generated outlines. The opaque 800x144 header
covers the upper mask portions; the city remains at its recovered y=130.

`city-frame-evidence.json` retains source hashes, score records, registration
points, BITD bytes and placement. `scripts/recover-city-frame.mjs` reproduces
that evidence; normal asset preparation uses the retained bytes without the CD.

The black bottom bitmap is RockMaterial slot 158, member chunk 123, 722x50.
Its registration point places it at (40,550) for a sprite location (400,300).
Its first score frame has zero dimensions, so its original runtime visibility
is not established. The reconstruction uses that black bitmap beneath the
prototype transport controls. Those controls remain reconstruction utilities,
not recovered original game UI. The earlier purple footer has been removed.

Browser regression checks cover black side margins, visible city pixels just
above both lower curves, black pixels at their ends, and the bottom asset.
The updated rendered screen is `analysis/ui-review/city.png`.
