# Studio validation ledger — 2026-10-13

## Runtime comparison status

Original-game screenshot comparison is now **partially verified**. The user
supplied 14 Windows captures, indexed in `runtime/reference/index.json` and
`index.html`. All current PNG hashes match source manifest records, and all
source executable hashes match the installed RockManager.exe. Original files
remain unchanged; derived stage images are lossless 800×600 center crops.

Mixer capture 002 and Corky's Settings capture 006 reveal and now correct:
the omitted mixer dialog and rack rails; mixer OK y=458; Settings width=312 and
bottom=502; Preview x=147/width=125 and OK x=275/width=76; loop icon/heading and
chooser alignment; black musician text; original static stat-label glyphs;
and the authored Genre string (Rock/Punk), rather than a generated dominant
style. HUD money no longer adds a dollar sign; its date shows four digits
with the captured space before the year.

The original uses RGB555 display conversion. Observed paper RGB(181,156,123)
is the 5-bit expansion of source RGB(179,159,126); panel RGB(85,85,85) becomes
(82,82,82). Launch.ini also requests 16-bit output. The WebGL camera now applies
that conversion after blending. Source texture bytes remain intact. Canvas
fallback still renders full colour and is not certified against these samples.

The four English stat labels contain exactly two source colours: black glyphs
and solid paper. Their glyph masks are retained with screenshot hashes in
`native-studio-text-evidence.json`. In the Corky browser capture, the 80×58
stat-label region matches every native pixel; a 4×395 right-border region
matches 99.94% of pixels, with mean per-channel error 0.005/255. These checks
exclude changing meters, loop choices, band members and animated faces. They
do not establish whole-window or font equivalence. Dynamic names/values still
use modern pinned fonts; legacy text rasterization and original DSP remain
unresolved.

The restarted capture manifest contained a nested value/Count wrapper and
an overwritten historical native-002 record. The current image is verified;
the unavailable older version is listed separately in index.json. The helper
now flattens records, serializes a flat object array and chooses a filename
that does not exist. Its round-trip check retains all 15 historical records.
Indexing does not rewrite the user's original manifest.

Captures also cover venues, radio/media, sleeve design, release booking and
charts. Those systems are not implemented by this UI correction. Studio entry
and the musician chooser were not captured; screenshots contain no audio or
interaction trace. Earlier launch limitations below remain historical.

The user confirms
that the original runs normally on their Windows desktop. The tool execution
account is `codexsandboxoffline`, with no readable Explorer Shell Folders/AppData
entry. A workspace copy was launched; the installed original was not modified.

Observed launch failures:

- `runtime/launch-rockeng.png`: RockEng.exe reports that administrator privileges
  are required. This is the launcher's message, not a diagnosis that the original
  game needs elevation on the user's account.
- `runtime/director-dialog.png`: RockManager.exe reports “Unable to find user
  info!”. Recovered bootstrap `00011-SystemScript.lingo`, getUserPath, shows
  that this alert follows a non-string registry lookup of Explorer Shell
  Folders/AppData. The registry entry is absent in this execution account.
- `runtime/launch-director.png` is a black main-window PrintWindow result; it
  contains no usable game reference. Foreground capture was refused because
  this context returned no foreground window.

REA binary_session confirms the original EXE is open as x86 in Ghidra, but
observe_native_ui/capture_native_ui_scenario are unsupported on Windows, and
capture_process_scenario supports Linux/macOS only. No studio runtime behavior
was observed through REA. Elevating the launch command did not supply the missing
profile entry. A temporary sandbox-profile setup was refused by registry access
controls; no AppData value was written.

## Source-backed mismatch corrected

`scripts/installed/RockUtil.cxt/00051-DlgMixerChooseMusicianScript.lingo`:

- Report/select changes the candidate sheet only.
- ButtonOK checks the selected musician, affordability and WantedSalary,
  charges for a changed studio musician, then reports ChoseMusician.
- ButtonCancel closes without hiring or charging.

The recreation previously hired/charged immediately on a row click. It now
keeps selection local to the chooser, requires OK, preserves state on Cancel,
and avoids charging for confirmation of the same musician. The chooser reuses
the Settings paper/photo/meters from DlgMusicianStudioInfoData, displays the
source 240×132 list bound, and removes invented funds/fee instructions. NPC age,
genre and charisma now come from DataHumans00 rather than empty placeholders.

Browser verification selects Hasselhoff, verifies unchanged money/channel,
cancels, reselects and confirms, checks exactly one fee, then confirms the same
musician again without another fee. Settings and effect checks also pass.
All 11 browser tests and 13 model tests pass after these corrections; the Tauri
release executable rebuilt successfully. Its native runtime was not tested here.
`test-results/session-musician.png` is a recreation capture, not an original
runtime reference. Exact typeface rasterization and full native row geometry
remain unverified.

## Remaining studio checks

| Check | Current evidence | Remaining gap |
|---|---|---|
| Desk graphics, mute/power alpha and knob registrations | Original BITD/CAS; native mixer screenshot, RGB555 rendering and browser checks | Complete comparison of matching fader and active-button states |
| Studio and musician sheet positions | Native Settings geometry and exact fixed-label region; recovered source sprites | Studio entry screenshot, dynamic fonts and animated faces |
| Instrument-only preview, one shot, close cleanup | DlgMixerFXScript; browser and offline audio tests | Original audio comparison and pending-decode close interaction |
| Delay/chorus/phaser controls | Source ranges; measured production-graph waveform differences | Legacy processor output comparison |
| Common loop start, cue end and tempo period | Source cues/BPM; WebAudio scheduling | Original slice processing and musician timing errors |
| Selection, confirmation, cancellation, fees | Original chooser script and browser interaction checks | Full native chooser comparison |
| Other unused band members and instrument switching | Original chooser script supports these | Current chooser still supports original channel member/session NPCs only |
| Settings behind musician chooser | Original child-dialog lifecycle; three-layer browser check | Settings now stays above mixer underneath chooser, with its input disabled; native pixel comparison pending |

## Capturing the original on the normal Windows account

Run from the repository in a normal PowerShell terminal:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\record-original-studio.ps1
```

Open the original game normally. While its window is active, Ctrl+Shift+F8 saves
one screenshot; Ctrl+Shift+F9 stops the helper. Capture studio, mixer, Settings,
active effects, the musician chooser, and a selected session musician. Navigate
normally; the helper does not send gameplay input or alter game state.

Captures and SHA-256/source identity records go into
`analysis/original/runtime/reference/`. Only the exact selected executable's
foreground window is captured. A different installation can be selected with
`-ExecutablePath`; the default is E:\Games\Rock Manager\RockManager.exe.
The helper's foreground-capture path produced the verified Windows references
on the user's account. Restarted-manifest flattening and serialization have been
checked separately; this sandbox still cannot capture the user's desktop.

## Confirmed remaining project scope

See `remaining-gameplay-systems.md` for original sources, rules and gaps.
Implementation order after studio comparison:

1. Persisted agenda and event booking, shared by gigs, releases and advertising.
2. Venue booking, acceptance, concert results and reputation; audience formulas
   must be traced before adding attendance and income approximations.
3. Original sleeve composition, design costs/quality/image and album release.
4. Per-reporter press kits, advertising, reviews and radio rotation; trace
   exposure and sales before connecting promotion to charts.
5. Tutorial/unlock triggers, cancellation, save/reload and full browser journeys
   through all systems. Contract signing alone does not complete the game.
