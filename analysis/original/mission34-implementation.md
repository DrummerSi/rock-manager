# Mission03/04 implementation and verification

The next catalog entries after First Steps are Mission03 **A Family Affair** and Mission04 **Hey Princess**. The original catalog contains no Mission02 entry. Original CD snapshots `V:/Data/M03.dat` and `M04.dat` were recovered read-only and verified byte-identical to the retained templates. See `mission34-audio.json` for hashes and `mission-catalog-evidence.json` for source tables.

## Implemented principal paths

- Source starting bands, instrument slots, cash, eligible recruits/songs, snapshot overrides, source intro speech/pictures, ending artwork and mission selection.
- Mission03 owned Supermarket Love, Global Records prearranged contract/debt, demo approval without a second advance, brother mood/relationship story, fixed day70 gala and scenario failure cards.
- Mission04 Nadia's starting overrides, Sergey feedback, source hype/delay TV invitation, all three copyright-card buttons, cancellable/editable TV calendar, appearance completion and Nadia departure/firing failures.
- Save validation/migration supports all three playable missions. Story queues, triggers, appointments and endings persist. This is one current-save slot, not a cumulative campaign profile.
- All four original studios, labels and session musicians are recovered. Album-cover pose selection now includes the additional mission musicians, including Nadia’s original singer/microphone poses. Additional eligible songs have original recording stems and publisher previews. Source voices use original X/Y/Z variant selection and recovered lip cues. Story cards resolve RepTV, HmGangsta01, HmJudge and HmRecord04 to the original Media01, Gangsta01, ECcourt01 and Record04 animated casts at their native 314×210 dimensions.
- Graphics/city ambience preload; other audio remains on demand with session memory caching.

## Simulation verification

`npm test`: 80 passing tests. Three integration paths use actual recruitment, licensing, rental, demo, contract, cover, release, training, gifts, adverts, press kits, gigs and daily simulation. No arbitrary cash, chart, sales or hype injection is used in these integration paths.

Mission03 cared-for path reaches day70 solvent with both brothers remaining. Mission04's paid campaign reinvests real royalties, buys adverts on days5,6,8,9,10,11,12, receives the invitation on day20, attends TV on day22 and wins on day23. These dates describe the deterministic test strategy; the player can choose different dates/actions. A source negative publicity effect on the copyright card accounts for the extra day compared with an earlier test strategy.

## Browser verification

The full 45-test regression run passed 44 tests, including the genuine fresh Mission01 canvas completion, all six focused Mission03/04 tests, the no-bulk-audio startup check, and the rendered pixel scan of all38 animated casts. The one failure was the rename test failing to reach its expected modal after immediate pointer events; its helper now uses a35ms press/release interval and explicitly waits for each expected window. Follow-up results are recorded below after the final checks.

Focused scenario coverage includes original mission selection/starting data/narration, seven-channel Studio02 recording, Global Records approval without another advance, earned-model-fixture gala and TV endings with reload, TV calendar cancellation/date editing, and Nadia’s departure/failure card lifecycle. These focused fixtures are not represented as fresh whole-canvas playthroughs. Screenshots from this run were inspected, including the corrected TV host scene and seven-channel studio.

## Boundaries

No native Mission03/04 runtime playthrough was observed. Source expressions include malformed predicates and timing inconsistencies, retained in the separate findings reports. This work does not establish pixel-perfect native fidelity across every branch.

Original intro audio and verified pictures are sequenced, while full character/cutscene compositing and the ship film-loop timing remain unfinished. Mission04's full crime/video and reporter-romance mechanics are not implemented. Both publishers currently expose the mission-eligible song catalog rather than their separate original inventories. One source card references `a29new007`, absent from the mounted CD; no replacement was invented. The specialized contextual failure explanations are not all included in the generic outro.

See `mission03-findings.md`, `mission04-findings.md`, `mission34-assets.json`, `feedback-audio-evidence.json`, and the test artifacts for source evidence and bounded verification.
