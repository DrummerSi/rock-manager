# Mission04 — Hey Princess

Static source audit, 2026-10-15. Original inputs were read only. `scripts/recover-scenario04.mjs` produces `mission04-recovered.json`, containing complete original mission/trigger/card rows and a decoded autoload snapshot. `scripts/director-vlist.mjs` is a bounded decoder; it does not evaluate any original Lingo expressions.

## Numbering

There is no Mission02 record in the shipped retained English `DataDBRest00.dat` Mission table. Its source order is Mission01,03,04,05,06,07,08,09,00,10. The second and third actual scenarios are therefore Mission03 and Mission04. A `mission02` bitmap and developer `Mis02-tst.sav` references do not establish a playable Mission02. Do not invent its objectives or state.

## Exact starting state

English `DataDBRest00.json`, Mission04: title **Hey Princess**, StartMoney **120000**, autoLoad **M04.dat**. Objective prose: hire musicians for Nadia's band; license a song; release record; get **45% hype**; get Nadia on TV. Intro names Sergey Spektor and Nadia and offers $120,000.

Autoload recovered from **E:/Games/Rock Manager/Plugins/Swedish/M04.dat**. The installed Swedish snapshot is explicitly identified in the JSON with its SHA256. The CD V drive was absent on this date, including through host execution. This snapshot contains identifiers/numbers rather than translated display names; equivalence with an English CD snapshot has not been independently byte-verified.

Only Nadia (`RMCPernille`) is in the band, Vocals, spatialPos5. No owned songs, recorded albums or merchandise. Band live reputation0. Nadia: Alive1, InBand1, Health.Current.8, Mood.Current.5, musicality.1, charisma.2, patience.19, salary400, self-perception.4, eccentricity0, BandInfluence1. Saved NeedParty.Current.07 and NeedDrugs.Current.0003. A constant Lonely mood modifier -.16 is present; NeedParty/NeedDrugs modifier records have empty property lists. The snapshot's player cash200000 is **not the new-game cash**: RockScript `08466`, lines385–387 explicitly removes all wealth after loading and grants mission.StartMoney120000. `ClassMission.start` sets dates relative to current game start, so snapshot dates are not a calendar start prescription.

Available musicians source17: Jerka,Kanga,Johnbenny,Tony,Gurra,Conny,Gullan,Krille,Sussie,Jamie,Idha,Mark,Raymond,Roberto,Martin,Lina,Pernille. Never available: Lelle,Eddie,Sonny,Nille,Nick. `ClassPlayer.beforeMissionStart` merges musicians across available missions before applying exclusions; the listed roster is not necessarily the final roster after campaign unlocks.

AvailablePlaces explicitly Publish01,Publish02,Gangsta01. `ClassMission.start` disables all other places initially when this list is nonempty. NeverAvailablePlaces Live06,Tour01. General lock-up triggers open other places through gameplay. Songs03,04,07,09,16,01,02,10,11,17,18. MaxNumMusicians0 is source default, not a zero-member limit. NextMissions is empty and does not itself specify a successor.

## Real victory path: raw 0.15, displayed as 45%

`DataDBRest04.Trigger.TRMis4Media01RqNadia01` checks **album.getTotalHype() >= .15**, activates `...01b`, and disables itself. `...01b` waits for **date > activationDate+6**, then for Nadia.getIsOccupied()==0; it queues `ECOCMis4Media01RqNadia` with DontCloseOnOK1 and disables itself. `ClassAlbum.getTotalHype` returns raw Hype directly. `OneGraphScript.getValueOfDate` maps raw 0–0.33 to 0–100% for the Agenda legend: raw 0.15 displays as 45%. The briefing and trigger therefore agree; the previous interpretation of a discrepancy was incorrect.

TV request: You Bet! (ButtonOK) creates DivEvent ID **DivEventWin**, formatAgFmConcert, start **today+2**, duration1, visible1, NeededIDs **NotOnTour, RMCPernille**, then opens bookDialog and activates02/03 completion triggers. No cash reward. No Way! queues `ECOCMis4Media01IgnoredGameOver`; only acknowledging its Dunno button calls mission.failed().

Completion02 listens for DivEvent with option.ID DivEventWin and queues `ECOCMis4Complete`, disabling fallback03. Fallback03 polls and queues the same card if date>event.startDate. `ClassDivEvent.eventChangeState` passes stop through ancestor. Success is latched **only on Complete.ButtonOK**, which calls mission.succeeded(). The congratulations are spoken by Sergey (`g01new01042`). No raw 0.45 check, album sales target, TV video shoot or additional score threshold exists in this completion chain.

## Failure paths

Nadia kicked: messageKickBandmember with option.IDPernille -> GameOverFireNadia -> ButtonOK failed(FireNadia). Nadia quit: QuitBand -> NadiaQuitBand -> ButtonOK failed(NadiaQuit). These are distinct events; do not infer one from every source state lacking Nadia.

Design exit: ExitPlace Design01 with **active SleeveAngry modifier on Nadia** -> NoNadiaCover -> ButtonOK failed(). Source `Main/00031-DlgDesignScript`, lines357–380: DEDArtists01(all band) no mood modifier; DEDArtists02/03 singer gets+.1/+.2 but others get-.1/-.2; DEDArtists04(no band) all musicians getSleeveAngry-.1. Thus no-band cover is fatal for Nadia; a replacement singer can also alter who gets the penalty. The check is modifier identity, not just cover-name text.

NoMoney and GameOver cards have failed(NoMoney)/failed(GameOver), but existence of these cards does not prove independent timers or a Sergey-strike counter. Original mandatory-payment failure remains `ClassPlayer.transactMoney`/ECOCOutOfMoney. We found no source rule converting repeated warnings into automatic failure. Do not invent a mission deadline.

## Source scripted events

All exact expressions/buttons remain in recovered JSON. Important mechanics:

- DeclareMissionVar starts HypeCnt,noHypeCnt,inactiveCnt,happycnt0; MoneyCheck1; GangKillNotWanted=[Pernille].
- Nadia mood<=.3 or>=.7 produces a one-time Sergey complaint/praise respectively.
- Bad concert rating<=1 -> complaint, acknowledgment NadiaMood-.1/10days. Good concert rating>=4 after15days has30% chance of praise. Native Concert.getRating is quality*5 (not rounded).
- Album hype<=.05 for14 consecutive timer days gives50% chance bad-media card, then resets counter; >=.07 for14days gives30% good-media card, then resets. Bad-media acknowledgment NadiaMood-.05/10days.
- Cash<10000 warns once; acknowledgment NadiaMood-.05/10days. MoneyBag only tests while date<=activation+15 and Nadia unoccupied andcash<=5000; occupied branch disables trigger. Acceptance gives15000. Its original “AllLikeNadia” attitude modifier is **-.1**, despite name; do not flip its sign to match prose.
- Inactivity source is counterintuitive: no upcoming concert/media event resets counter; an upcoming event at least10days away also resets. Only remaining branch tests inactiveCnt>=10. Preserve this or report a deliberate gameplay fix; do not silently replace with conventional idle timer.
- ChartEnter once begins Rockets plagiarism dispute. DemandRoyalty activates a+2day branch: if hype>=.1,75% chance offered15000; below.1,40% chance (60% refusal). Court activates+7day branch: LegalSafe1 guarantees win, otherwise50%. Court win30000, mood+.15/10days and positive exposure; loss mood-.15 (no duration specified) and negative exposure. Taking15000 gives+.1/10days andpositive exposure; ignoring -.1/10days andnegative exposure. Source branches have some deactivate placement asymmetries retained in expressions.
- Gift to another musician while Nadia free and at least3days since last gift to Nadia arms jealousy+2days. A gift to Nadia cancels. Card-.025mood/10days. Any GiveTraining to another musician uses same logic but+5days and-.05mood; native nameHoliday is misleading because trigger accepts all training.
- First Gangsta01 Action starts organised-crime sequence: after>=3days choose random band member excludingNadia, scare them;2days later if stillband Nadia fights them;5days later if actor exists they disappear and Die(Murder) immediately. Cards apply additional mood/vacation effects on acknowledgment. This is not harmless flavor text.
- Leaving mixer with Nadia musicality<=.45 selects strongest musician and complains unless that strongest is Nadia; all-band attitude towardNadia -.1/10days on acknowledgment.
- After40days while Nadia free and hype<=.1: romance with magazine reporter, NadiaMood+.15/10days andRepZM+.2/30days. Separate initial KissMediaNo checks whenever Nadiafree, fires only if hype>=.1, **then disables either way**; Nadia-.15/10days andRepTV-.2/30days.
- GoodGig rating>=3 once; special concert card suppresses genericcomment flag and grants others+.05/10days.
- MusicianTooHappy begins after10days; Nadia free and other happiest member mood>=.6 triggers tantrum and restarts activationdate; happycnt increments. Original stop branch only executes when threshold no longer met andhappycnt>=1.
- Nadia asks to fire disliked or weaker musicians. Original WantFireMusician1/2 attitude conditions include malformed trailing `)`/dynamic property paths, so runtime interpretation remains uncertain. The first approval card changes moods/attitudes but does **not** fire anyone; second card explicitly calls selectedMusician.Fire(FiredByPlayer). Do not silently make both cards fire.
- Video intro: ExitPlace from Design with album.ReleaseDate>0 and contracted record: queue introductory card, makeVideo01available, disable. Training info card is exactly activation+1day.

## Assets/voices and implementation limits

Required new main actor is Nadia Gfxactor29, Sergey is HmGangsta01; TV reporterRepTV, magazineRepZM, judgeHmjudge, optional random band members, plagiarism small art `live smashed demo01` and `gangsta_legal01`. Source card ExecuteThis retains all exact voices (a29*,g01new01024–42,m01new018,ad01ea01010/11 andgeneric a¤¤ templates). Intro art mission04 already recovered. Outro graphics need source mission04_success01/failure01 extraction; do not reuse Mission01 art without evidence.

The initial TypeScript scenario04 helper implements the TV win/fail chain, mood/money/media/concert feedback, copyright choice timing, jealousy, organised-crime disappearance state and introductory cards. It deliberately does not evaluate arbitrary source expressions. Remaining adaptation limits: no runtime-native parser for malformed attitude rules; some detailed attitude/vacation/reporter/exposure card effects still need direct adapters; corpse exclusion should use persisted scenario vars `dead:<id>` alongside fired flag; source card context/name-pronoun expansion belongs renderer. These are explicit omissions, not claims of complete original simulation parity. General gain/source rules remain existing subsystem responsibilities.

## Native musician quit audit

ClassRealMusician.Report (00101, lines319-345) reacts only to downward Mood interval crossings: quit interval queues ECOCQuitNow, Furious queues ECOCWantQuit. DynamicTriggerVar.checkAndTrig defaults onlyReportMostExtremeTrigger1, so a direct fall into quit skips the lesser warning. Raw source thresholds are .01 and .1; helper uses below-threshold intervals (source sorted-property insertion tie behavior is not independently runtime-verified). Generic QuitNow ExecuteThis runs on card display: Speak(a-dynamic-aa0600y), then quitBand; its OK button has no actions. WantQuit speaks aa0500y and never removes the actor. quitBand removes availability and actor-targeted modifiers then emits QuitBand; mission-specific failure requires acknowledgment of the subsequent failure card. Native NeededToShow waits while InBand and occupied. Native occupied classes are BandTour, VideoProduction, Training, Kidnapped, Away; ordinary Concert and DivEvent are not on that list. Current helper represents only Training because remaining occupied classes lack runtime state models; it scopes behavior to03/04 to preserve old01saves. Per-actor lastMood is persisted in scenario.vars so daily checks and reload do not repeat a crossing. Display-time cleanup and failure dispatch remain distinct from daily queueing. Source evidence in DataDBEC00 generic card rows and RockGeneral00101/00020; four dedicated tests exercise this flow.
