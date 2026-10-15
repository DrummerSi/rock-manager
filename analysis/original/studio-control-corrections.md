# Studio and mixer corrections

The earlier tutorial walkthrough missed control fidelity and inactive Settings.

Current native-reference correction: see studio-validation.md. Fourteen user
captures now establish original visual states. The mixer needs its original
outer dialog and rack rails; these are restored, superseding the earlier
removal below. Settings dimensions/buttons follow captured geometry, fixed
black stat-label glyphs come from the original screenshot, and the WebGL camera
matches RGB555 output. Dynamic fonts, animated faces and legacy audio equality
remain unverified.

Follow-up correction, 2026-10-13: the previous implementation also discarded
the populated alpha plane in the mixer's 32-bit BITDs. White-matte replacement
does not preserve soft edges, shadows or the active mute/power glow. Recovery
now retains original alpha for every populated plane. Mute02 has 60 completely
transparent pixels and 255 partially transparent pixels; the browser regression
check verifies both counts. Empty alpha planes in other casts retain their
previous matte/opaque handling.

The Settings musician sheet now uses the original musician_paper01 bitmap,
portrait frame and meter02 background/Left/Mid/Right sprites. Offsets come from
DlgMusicianStudioInfoData. setMixerMusicianInfoSheet displays the first name,
age, genre, skill and charisma; the invented instrument/percentage text is
removed. Exact legacy text rasterization remains unverified.

DlgMixerFXScript's Preview renders one selected channel with effects and
PlayDirect:1. Its kill handler kills the sound object. Browser Settings preview
now follows that isolation and one-shot lifetime, ignores the desk mute/fader,
and stops on every exit from Settings, including opening the session chooser.
Closing while a decode is pending invalidates that playback request too.

Mixer loops share a scheduled start and a bar/BPM-derived period. Source cue
files are retained with their hashes and boundary arrays; the last sample
boundary trims source playback before tempo scaling. The CD contains some
inconsistent declared cue counts, which are retained without silently rewriting
the source boundaries. Original per-slice musician timing errors are not yet
replicated, and tempo scaling currently uses playback rate rather than the
legacy processor's pitch-preserving slice treatment.

Verification now includes four OfflineAudioContext renders of the actual guitar
Ogg through the production audio graph: dry, delay, chorus and phaser. Each effect
produces a measured waveform difference, all outputs have nonzero RMS, and each
one-shot releases its nodes at completion. UI checks verify exactly one preview
track, zero tracks after close, and five looping tracks on the desk. All 11
browser tests and 13 model tests passed; the focused audio/control checks passed
again after cue-boundary integration. Original Windows runtime comparison and
bit-exact legacy DSP remain outstanding.

- Replaced the studio photo's generic black inset with the original `frame01`
  bitmap at (149,178), including its light border and shadow. Photo ink is opaque;
  the surround's outer white matte is transparent.
- Studio chooser uses the source 200px text bound, 22px heading offset and 9px
  text inset. Arrows sit 8px after the text. Record/Cancel are centered on InfoDlg,
  23px below ChooseSong's top. This removes their previous overlap.
- Removed added studio funds/rental explanations, mixer band/rental text, numeric
  pan/volume labels, loop IDs, instructions and the invented mixer title/frame.
- Mixer score places the control panel at loc(174,282), giving top-left(67,127);
  master at (286,370), Play at (102,397), Stop at (153,397).
- ChannelScript places pan at (369+60n,253), mute at (318+60n,323), volume at
  (311+60n,436), and portraits at (328+60n,161). City portrait regPoint is (23,25).
- Knobs use each frame's registration point around a fixed anchor, with a
  stationary drag region. PotentiometerScript uses horizontal dragging, one
  animation frame per mouse pixel. Browser checks verify unchanged anchors.
- Mute01 is 41x23/reg(19,11); Mute02 is 41x25/reg(19,13). Both render from the
  same anchor. Toggle/press/release uses original sprites without rebuilding
  the window. Audio gain ramps over 5ms to avoid a hard mute edge.
- Settings hit regions use the existing channel artwork rather than duplicating
  its baked button. Portrait and instrument also open Settings. Its origin
  (102,77), musician sheet and effect offsets follow DlgMixerFXData.
- Preview/OK follow DataDialogs00.DlgMixerFX. Loop choice, non-vocal session
  selection and effects controls work. Strawberry offers Delay and Timeshift;
  Garage offers Delay only. Delay uses source note subdivisions/ranges; browser
  chorus/phaser processing implements timeshift controls. Legacy Xtra DSP is
  not asserted bit-exact.

Sources: Mixer.dxr ChannelScript, PotentiometerScript, FXDelayScript,
FXTimeShiftScript, FXGfxScript; Main.dxr DlgStudioScript; retained
tutorial-layout-evidence.json, tutorial-gameplay-evidence.json and
tutorial-media-evidence.json with original source hashes.

Verification: 13 model tests pass, including corrupt effect-save validation.
Focused browser tests pass for the successful contract flow, rejection/session
route, Settings preview, mute and fixed knob anchors. The contract/control tests
were rerun after the final Play/Stop placement correction. Screenshots were
inspected visually; full native-runtime/font equality is not claimed.
