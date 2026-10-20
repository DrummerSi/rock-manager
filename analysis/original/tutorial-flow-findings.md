# Mission01: musicians through a record contract

The playable reconstruction now follows the recovered tutorial through hiring,
song licensing, studio rental, mixing a demo, label submission, negotiation and
signing. It also handles refusal, returning to the studio, cancelling a replacement,
paid session musicians and resuming saved progress. The post-contract sleeve-design
card is shown; sleeve design/release/chart gameplay is the next milestone.

## Evidence and implemented rules

| Step | Original evidence | Behavior used |
| --- | --- | --- |
| Hire musicians | Main.dxr DlgRehearsal01ChooseScript; Mission01.AvailableMusicians | One to five members, instrument eligibility, salary ordering, no upfront hiring fee |
| Buy a song | Main.dxr DlgPublishScript; DataSongs00 | Original five Mission01 licenses and prices |
| Studio entry | Main.dxr 00020-DlgStudioScript.lingo; DataBuildings00.Studio | Requires a musician, a licensed song and enough cash; charges once before the mixer |
| Mixer | Mixer.dxr 00041-MixerScript.lingo, 00052-ChannelScript.lingo | Channel count, initial tracks, volume/pan/mute, vocal weighting and final quality |
| Session musicians | RockUtil.cxt 00051-DlgMixerChooseMusicianScript.lingo; DataHumans00.StudioMusician | Larry 3,000 / musicality .5; Tony 7,000 / .8; Hasselhoff 16,000 / 1; charged on selecting a different session musician |
| Labels | RockGeneral.cxt 00029-ClassRecordScript.lingo, 00088-unnamed.lingo, 00109-unnamed.lingo | Best target by average liking; rejection when negative criterion penalties remain |
| Negotiation | ClassRecordScript.getOffer; Main.dxr 00025-DlgRecordContractScript.lingo | One-percent royalty steps linked inversely to advances; nearest-thousand advance rounding |
| Signing | Main.dxr DlgRecordScript.signContract; ClassRecordScript.signContract | Immediate advance, royalty and album commitment, persisted signed demo |
| Tutorial cards | opening-ui-evidence.json, DataDBRest trigger tables | EnterMixer → mixer introduction; LeaveMixer → labels; ExitRecord → retry or sleeve introduction |

Strawberry Studios (Studio01) costs 6,000, quality .5, five channels. Garage
Studio (Studio04) costs 2,000, quality .2, four channels. These are rent payments,
not invented per-day recording fees. Original game time is stopped in the mixer;
ClassAlbum.recorded adds a one-day agenda entry but does not advance the clock.

Final demo quality is clamped to 0–1:

`channelCountBonus + (.25 × songQuality + weightedMusicality + .25 × studioQuality) / 1.5`

One through five audible channels have bonuses `[-.3, -.2, -.1, 0, 0]`.
Channels below volume 30 receive proportionally lower weight. Vocals receive
1.3 times the weight. The shipped effects helper applies missing-instrument
quality penalties before this assignment, but the assignment overwrites those
penalties. Its song-type reductions remain; the reconstruction preserves that
distinction rather than applying the same penalties twice.

At label submission, the original replaces the album's musical style with the
current band's instrument-influence-weighted style. Album image style retains
the band style from recording. Each target checks their mean against its style
centers/tolerances, plus song type and quality. The target with the highest
average liking is selected; all its negative individual scores and negative
aggregate scores contribute to rejection. Live reputation and hype bonuses are
zero in this milestone because gigs/promotion are not implemented.

Rebel Records has three targets (minimum qualities .50, .40, .45), advances
20,000–80,000, royalties 5–15%, and a three-album commitment. Rainbow Records
has one target (minimum quality .57), advances 10,000–50,000, royalties 10–20%,
and a one-album commitment. A label's headline MinQuality differs from its
targets and is not substituted for the actual acceptance criteria.

The implementation was independently reviewed against the recovered scripts.
Advance rounding follows Director 5+ integer(float) nearest-round semantics,
also corroborated by [ScummVM's Director integer builtin](https://github.com/scummvm/scummvm/blob/master/engines/director/lingo/lingo-builtins.cpp).

## Retained artifacts and presentation

- `tutorial-gameplay-evidence.json`: source hashes, studio/label/target tables,
  session musicians, song defaults/loops and 120 original Ogg audio hashes.
- `tutorial-layout-evidence.json`: original Studio/Record/Contract/Mixer chooser
  STXT and DataDialogs definitions, including icons, captions and origins.
- `tutorial-media-evidence.json`: native mixer controls/knobs, studio images,
  contract document and label Actor-cast art with registration points and hashes.
- `scripts/cd/Mixer.dxr`, `Record01.cxt`, `Record03.cxt`: newly recovered
  metadata/scripts bound to the original CD files. Mixer contains 29 unique
  scripts; ProjectorRays reports duplicate cast script lists, so the recovery
  reports unique script IDs.
- `media/tutorial-audio`: original Ogg stems. RealMusician.PreInit derives the
  voice prefix from Gfx (for example actor10 → a10); session players use a01.

Mixer, studio, label and proposal windows use the recovered artwork. Label
offices combine their own palette-based background, body and mouth frames using
source registration points; they are static poses rather than recreated animation.
Small real-musician portraits come from the already recovered city cast.
Legacy font rasterization and all auto-layout metrics are not proven exact.

Browser preview mixes the original stems with volume, panning, muting and a
master level. Original slice jitter, pitch/timing DSP, delay/effects and musician
reactions remain outside this milestone. Recording after signing is currently
blocked; the original instead permits discarding a signed album after a warning.
Existing saves migrate missing recording/demo/contract fields; paid sessions and
pending label/sleeve tutorials survive reload. Tauri allows same-origin audio
fetches under CSP and uses the same static web build.

## Verification

Twelve simulation tests cover rental, eligibility, quality, session charges,
acceptance/refusal, offer rounding, signing, persistence and existing hiring/payroll.
Nine browser tests passed. New canvas walkthroughs cover the full successful
chain, real audio decoding/play/stop, slider/mute input, paid-session reload,
pending-card reload, cancellation, rejection/retry and session re-selection.
Those two walkthroughs were rerun after the final native-control layout fixes.
The browser build and Windows Tauri build are checked separately; the packaged
desktop application has not been runtime-tested in this pass.
