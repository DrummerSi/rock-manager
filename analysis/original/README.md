# Rock Manager original-game recovery

Analysis date: 2026-10-12. Original installation: `E:/Games/Rock Manager`; English CD mounted at `V:/`.

No application implementation was created and no original game was executed. Outputs here are recovered scripts, source data, media samples and analysis records. Selected source hashes were checked after extraction and matched the initial hashes.

## Results

- 463 reconstructed Lingo scripts, with matching bytecode listings, from 11 Director files and the EXE's embedded bootstrap. `recovery-manifest.json` records source paths, SHA-256 and counts.
- 36 English `Data*.dat` payloads decoded to JSON under `data/`. Lingo expression strings are preserved, not evaluated. `data/mission01-recovered.json` combines Mission01, its nine available musicians and its mission-specific triggers.
- 2,801 PNG files: 700 from Actor01, 1,243 from city01 and 858 from the installed RockMaterial cast. All pass Pillow's PNG integrity verification. Three visual samples were inspected; runtime visual equivalence has not been established.
- One usable linked audio sample: `media/audio-sample/CityAmbience01.wav`, decoded from the CD's SWA file as stereo 44.1 kHz PCM, approximately 14.24 seconds. FFmpeg successfully decoded the resulting WAV. Two WAV exports from VeryGeneral are empty `SoundNotFound` placeholders, not recovered playable sounds.
- CD inventory: 7,272 files, including 5,353 SWA, 988 OGG and 31 WAV files. These counts describe extensions, not independently verified codecs or unique assets. Most CD media has not been converted.

## Startup map

1. The native EXE loads the Director runtime and invokes its `ProjectorMain` export. Prior Ghidra evidence: launcher `FUN_20001710`, runtime loader `FUN_20001850`.
2. Embedded bootstrap script 5 reads the application's INI or a command-line-selected INI, builds `gSystem`, installs preferences/search paths and opens the configured startup movie. Recovered under `scripts/installed/RockManager.exe-bootstrap/`. The embedded movie starts at source file offset 2,817,342. Absolute imap/mmap offsets were relocated in an in-memory copy for parsing; the EXE was not patched.
3. `Start.dxr` script 6 calls XferScript and StartScript. Plugin transfer is conditional. StartScript 124 requests a CD/language check; CheckForCorrectCDScript 125 verifies RockCD.INF against the requested language. The mounted CD reports English. Script 130 calls `goNextMovie`; script 6 reads preference `Next`, which is `Intro` in the installed INIs.
4. `Intro.dxr` scripts 3-5 size/play the intro video and allow a key or mouse click to skip to the Load marker. Script 6 constructs/initializes RockScript if needed, then goes to Mission on a first run; otherwise it sets `m_justStartedGame` and goes to Main.
5. RockScript initialization creates the game services and either loads Auto.sav or starts the configured first mission, defaulting to Mission01. A separate developer keyboard branch exists; it is not the ordinary startup path.
6. `Mission.dxr` Dir script 1 pauses the game timer and opens the mission introduction. `RockUtil.cxt` DlgMissionIntroScript 53 displays the current mission's name, introduction and criteria. Its OK action starts that mission and requests Main.
7. `Main.dxr` Dir script 1 constructs the scrolling city/interface bar, activates the game timer, emits ExitToCity and conditionally opens the main menu. DlgMainMenuScript 38 opens MissionChoose for a new game; MissionChoose script 40 sets the selected mission and requests Mission.

The shared initialization can instantiate a mission before its briefing, and briefing confirmation calls startMission again. Do not collapse these into an assumed single initialization without checking the state effects.

## Mission01: First Steps

Source: `V:/Data/DataDBRest00.dat`, corroborated by the class definitions and RockScript startup consumer.

- Starting money: **100,000**, credited by RockScript.start after removing the current wealth.
- Goal text: form a band, get a song license, record a demo, sign a contract and reach the Top 10.
- Available musicians: Glen Jeffries, Billy "Alba" Watt, Tony "Bubba" McDougall, Teddy "Stetson" Helmot, Corky Jones, Sharon Martin, Charlotte Johnson, Raymond Schneider and Marty Anderson. Internal IDs and all recovered attributes are in `mission01-recovered.json`.
- Available songs: Sng01, Sng02, Sng10, Sng11 and Sng17.
- No mission template autoload: `autoLoad` is empty. StartValues and initial SucceedCriteria/FailCriteria are empty lists. Success is implemented by triggers rather than a nonempty initial criteria list.
- TRMis1Succeeded reacts to ChartEnter for Media05, activates TRMis1Succeeded02, and that trigger succeeds the mission once the date reaches its activation date plus one. DataBuildings identifies Media05 as Record Store.
- Tutorial triggers guide entry/exit of city, rehearsal, publisher, mixer and label, followed by marketing/chart/calendar advice. Trigger expressions are statically recovered; they were not run.

## Initial simulation findings

- RockScript.new uses `secsPerDay` if configured; otherwise the published-game default is three seconds per day. It multiplies this by the Director frame tempo.
- RockTimer assigns most registered objects to random frame groups, defaults priority to 50, sorts each group's objects and iterates in reverse order. It does not update every system in a single fixed sequence at midnight.
- RockDateScript explicitly registers in group 1 with priority 100, advances the date by one day per callback and updates its relative day number. It initially uses the host system date; mission start establishes day zero.
- ClassMissionScript maintains elapsed days and album-sales variables and activates the mission's starting triggers.
- ClassRealMusicianScript checks relationships when a band member is unoccupied. Mood and attitudes influence quarrel risk. A separate Pay handler charges the requested salary; its exact invocation schedule still needs tracing.
- ClassAlbumScript aggregates sales/hype from audience groups. Its callback reduces freshness by 0.006, clamped at zero, after graphs have started. This is not proof of the complete record-sales formula.
- ClassPlayerScript keeps category/subcategory accounts and updates wealth/graphs through transactMoney. It updates accounting totals before its affordability guard; an unsuccessful transaction can therefore differ from a naive cash-only implementation. This needs a behavioral check before choosing compatibility behavior.

## Extraction and decoding limitations

The Director decoder is ProjectorRays WASM package 1.1.1. Its reconstructed Lingo may contain decompiler artifacts, especially chunk mutation statements. Bytecode listings are retained for checking disputed expressions. The media decoder is the downloaded shockwave-extractor/LibreShockwave utility, built using the installed Java 21. Its temporary extraction driver was adjusted to append member chunk IDs to filenames for the city/interface exports and to retain white pixels in 16-bit images. Actor01 was the initial unmodified-driver sample. Tools were built in temporary storage, outside application source.

PNG files are decoded image candidates, not finished Phaser sprites. Director ink modes, color keys, masks, registration points and animation sequences remain to be mapped. White regions were not blindly removed from city/interface images. Duplicate member names were preserved using IDs. Members without an embedded BITD chunk are skipped by this extraction path; output counts are not proof that every cast member is recovered.

The DAT decoder handles the observed uncompressed integer/string/list/property-list records and resolves integer property keys using the accompanying dictionary. It starts at the observed payload offset 92. Original encoded expressions and scalar strings are retained. String views preserve bytes via Latin-1; rendering/transcoding still needs reconciliation with the recorded Windows platform and translation files. Reference/header/trailer fields are only partly interpreted; trailing bytes are preserved in each JSON record. This is not a general-purpose or fully verified vList reader. M03-M09 template savegames were not decoded in this pass; Mission01 does not autoload one.

REA/Ghidra also inspected the original vList Xtra without executing it. Evidence `ev_b8709de2b43ff2fde68707090c34c594a79585fb3b4e118841b4db0365db7828` identifies version 1.5.8 and its read/write, compression, encryption and symbol-table APIs; the full string evidence is under `evidence/`.

## Next implementation target

Build Mission01 briefing and the city/rehearsal recruitment flow around recovered data, then implement a controllable simulation clock. Before claiming gameplay parity, reconcile object update ordering, input/dialog pauses, animation masks and the salary schedule. Broader media extraction can now use the demonstrated pipeline; no TypeScript/Phaser/Tauri application has been written yet.

Tool references: https://github.com/dirtools/ProjectorRays-wasm and https://github.com/bmdragos/shockwave-extractor .
