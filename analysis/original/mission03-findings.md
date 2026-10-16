# Mission03: A Family Affair

All findings here are static recovered original-data/script evidence. No Mission03 native runtime playthrough was observed. `scripts/recover-mission03.mjs` reproducibly flattens all 30 triggers and 30 event cards into `mission03-rules-evidence.json` and decodes the retained save template into `mission03-autoload-evidence.json`. Expressions remain data and are never executed by the extractor.

## Starting state

Original catalog `DataDBRest00.dat` Mission03 has StartMoney 100000 and autoLoad `M03.dat`. The actual retained template `.local/original-runtime/Plugins/Swedish/M03.dat` SHA256 `5fecdaa01b2f7d8c5cb56857d23d25e097b435a2e6d20426c005b218bb43fd93` contains:

- Band Morning Glory: RMCLelle (Lol Golander, actor16) on Vocals/spatial5; RMCNille (Nelly Golander, actor28) on Guitar/spatial1. Three other slots empty.
- OwnedSongs [Sng18] (Supermarket Love). Context.Song is Sng19, a stale-looking focus; ownership grants only Sng18. No album/demo is saved.
- Player CPContractor Record04; CPContractPriceModel BasePrice 60000, Royalty .1, UnitPrice0. Record04.Advance100000 and Available1. Advance/debt is separate from current cash; do not pay a second 60000 at start.
- Lelle Health .5/Mood .5; Nille Health .6/Mood .508. Lelle saved Party need .25/Drugs .0229; Nille .291/.0153. Other unmentioned properties inherit source musician records.
- Concert1: Venue Live06, fixed StartDate70, duration1, neededIDs[Band], visible1, Moveable0. Its price model is BasePrice100000/Royalty.7/UnitPrice380; this is saved event metadata, not evidence to charge the player a new upfront booking fee.
- `TRMis3StartDeclareVariables` on activation saves original band name, zeroes brother gift/training counters, sets GangKillNotWanted to both brothers, and adds reciprocal `Mis3Bros` attitudes +2 for100days. Base reciprocal attitudes are -2 in DataMusicians00. Failing to install starting modifiers makes the brothers hate each other immediately.

Initially available places are Studios01–04, Record04 and Publishers01–02. NeverAvailable includes Live05/06, Media01, Tour01, Gangsta01, Video01. Initial musician eligibility has 14 IDs; Eddie/Sonny/Pernille/Nick excluded. Songs eligible01,02,03,10,11,17,18. After LeaveMixer, Record04 and Live01–05 become available regardless which song was recorded.

## Actual victory and failure

`TRMis3Succeeded`: on message `#Concert`, if `option.Venue == #Live06`, Mission.succeeded immediately. `RockGeneral.cxt/01130-EventsManagerScript.lingo` startEvent lines160–165 first calls eventChangeState(#start), then sends #Event and the event class symbol. Victory is therefore **concert start**, not booking, concert result, top10, sales threshold or live quality. `00046-ClassConcertScript` start requires a focused album object, otherwise queues ECOCConcertCancelNoAlbum and returns #DontStart. Browser demo models that original focused album before release. The template fixes this start to mission day70.

QuitBand or KickBandMember for either brother queues ECOCMis3GameOverLeaveBand; CancelContract queues ECOCMis3CancelContract. These cards call Mission.failed only when OK is acknowledged, with reasons GameOver/CancelContract. ECOCMis3NoMoney similarly calls failed(NoMoney). No Mission03 timer predicate directly fails at day70. No-sales at day30 gives warning and mood/relationship penalties, not failure. Briefing objectives (record Supermarket Love, label approval, release, make cash) are not separate victory predicates in recovered data.

## Relationship and timed story rules

- Gift count increments on GiveGift only if the other brother is unoccupied. Training count increments on GiveTraining under same condition, capped2. On ExitToCity, difference >=2 queues jealousy of disadvantaged brother and resets counters. Gift reset leaves favored brother1/other0. Source training reset has asymmetric typo: both branches leave Lelle1/Nille0. Jealousy OK: favored brother attitude to disadvantaged -.2/100days and Mood +.6/2days; disadvantaged Mood -.1/10days. Do not replace source positive .6 with an assumed negative penalty.
- #Training (event start, not booking/completion) for either brother gives reciprocal BrosRest attitude +.2/100days. ConcertStop gives reciprocal +(.05 * rating)/100days only when >=.10; rating=5*satisfaction.
- ExitToCity restores original Morning Glory name if changed and queues NameChange. OK gives both Mood-.1/10days and reciprocal attitudes-.2/100days.
- LeaveMixer with a non-Sng18 album queues NellyAngry once. OK both Mood-.3/30days and reciprocal attitudes-.2/100days.
- ExitPlace Design01 checks each brother's SleeveAngry modifier. OK gives focused brother Mood-.1/10days plus source relationship decrement. This card compares ID to #Nille (not RMCNille), so normal Nille takes else branch; raw expression retained.
- At day2: Whip and Carrot informational card. At >=15 when both unoccupied: SmallArtistFight01, then activate SmallArtistfight2. First fight OK reciprocal-.1/100days. On ExitToCity >=15 after activation, if vocalist and Nille free and either brother attitude<-.5: fight02; both Mood-.1/8days and reciprocal-.2/100days; activate fight3. After another15 days, condition Nille→Lelle<-.7 OR current vocalist→Nille<-.7: fight03; both Mood-.1/10days, reciprocal-.2/100days.
- At day15 activate Muttonfight2; after1day bothfree queues MuttonFight and activates fight3; after2days queues opponent response (fight3 does not require brothersfree). First card exposes intensity.3/quality.3 for1day starting tomorrow. Apologize queues peace after1day: both Mood-.4/30days and negative exposure. Escalate queues war after1day: both Mood+.1/10days/positive exposure, then article2days later with same apology/escalate choice. Escalation leads artist fear after2days, then TV offer after2days. TV refusal after2days negative exposure; accept after2days tests Band.getLivePerformance >=.5, win bothMood+.2/10days +reciprocal.2/60days +positive exposure; lose bothMood-.4/30days +negative exposure.
- Band live performance: each musician (.5*Musicality+.4*Charisma+.6*Mood)/1.5, weighted by instrument influence Vocals1/Guitar.75/Keyboards.6/Drums.25/Bass.5/Wind.1; clamp-map [.2,.75]→[0,1].
- At >=30 if albumsSold==0: sales warning; bothMood-.1/5days/reciprocal-.2/100days. NoHype card exists but no trigger in DataDBRest03 references it.
- First concert reminder is >=40days from activation; it activates second reminder, whose predicate is **>=60days from its own activation**, so day100 if first fired40. Text claims ten days remain, inconsistent with code and day70 gala. Reconstruction preserves code, flags inconsistency.

`00044-ClassTriggerScript.activate` sets TriggerActivateDate when activating (except loading) and does not reset already-active triggers. This establishes relative dates above. Director symbols case-insensitive; script/data capitalization variants refer to same IDs.

## Assets/audio additions over Mission01

Songs03 and18 are newly eligible. Each source has13 stem IDs: `{03,18}{Dr1,Dr2,Dr3,Kb1,Kb2,Kb3,Bs1,Bs2,Bs3,Gt1,Gt2,Gt3,Vc}`, CD `Sound/Music/Sliced/Mp3/*.ogg` and paired `Sound/Music/Sliced/*.txt` cues. Publisher previews are Sound/Music/03pre.wav and18pre.wav. Sng18 default Mx18,135BPM,8bars,4/4, SongType.7, quality.8. All original loop rows retained in DataSongs00.json.

Actor voices16/28, Record04 voices r04, Mutton opponent ad05, TV m01, snare press stinger are required. Raw card ExecuteThis fields preserve exact speech selectors, including dynamic `¤¤¤ea0400x`, `¤¤¤ea71001`, `¤¤¤ea14001`, `¤¤¤ea0500x`, `a28ea0500x`, `ad05ea01002..5`, `m01new002`, `r04new01031/35/41`. Do not treat x wildcard variants as literal filenames. Original intro score Mission.dxr label03 frames18–52 includes record04/globalboss and actor16/28, with Intro03_* narration; `mission34-assets.json` retains score initializer parameters, exact imagery and audio names.

## Source integrity and implementation boundaries

Primary data hashes: DataDBRest03 `0b00996258b9481ea28d03674142111b12b530f4915ed3c256f699fd32baf6cc`; DataDBEC03 `8521198714ab0f47ae537e4943fc653e2ab5f7ed71c1cf4875fea650a945a61e`. Catalog/hash/source paths are included in mission03-rules-evidence.json. Script metadata sidecars identify original cast source/hash.

Source expression strings contain extra right parentheses (band-name and small-fight predicates), one trailing comma in NellyAngry CreateModifier, and stale/undefined `tmp` in Muttonfight3. Native executor tolerance is unobserved; scenario03.ts implements intended comparisons and defined story card routing rather than claiming these expressions executed successfully in native runtime. The JS PRNG is persisted/reproducible, not bit-identical to Director's process-global random. General needs, salary, release, audience simulation remain shared engine responsibilities. Gala original 100000 event BasePrice is not applied as an invented expense. No runtime-validated assertion of exact Mission03 difficulty/balance is made.

## Reconstruction model playability verification

`tests/mission34-flow.test.ts` adds a fresh actual-M03-template run using only exported purchase/record/release/care/calendar actions and daily advancement, without injecting money, quality, hype or musician stats. This is a reconstruction model observation, not a native gameplay observation. Add Tony guitar, Corky drums, Teddy bass; record the already-owned Supermarket Love in Global Studios; obtain prearranged Global approval (no new advance); choose Moon/all-musicians/Lensflare/Font04, release day2; send three free press kits; buy14days record-store discount starting1. Train both brothers in media for3days starting1,11,21,31,41,51; book free Café Lizette gigs5,15,25,35,45,55,65; give each a stereo on day18; apologize during Mutton feud. Daily save validation succeeds, every mandatory salary is paid, both brothers stay above the native .01 quit threshold, and the fixed gala wins day70 with positive cash. The measured first probe finished with20565 before later concert-message integration; tests deliberately assert solvency and care thresholds rather than a brittle exact balance.

Actual English CD files `V:/Data/M03.dat` and M04.dat were subsequently recovered and compared in `mission34-audio.json`: both are byte-identical to retained Swedish-plugin copies. There is no language-dependent starting-state discrepancy. Added songs03/04/07/09/16/18 contain144 additional Ogg stems with full ffmpeg decode verification (zero failures), six preview WAV files also decode successfully; all264 playable stems retain original cue TXT bytes.
