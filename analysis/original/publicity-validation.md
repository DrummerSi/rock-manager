# Publicity, gigs and sales reconstruction validation

`src/game/publicity.ts` is a renderer-independent reconstruction from static recovered Director scripts and immutable decoded CD tables in `src/game/publicity-rules.json`. No original executable was run during this work. The rule JSON retains source table hashes. Original game files were not modified.

## Implemented evidence

- Four Mission01 venues, all twenty audience groups, radio/newspaper outlets, twelve advertising templates, five available gifts, media targets, song royalties, all 77 competing chart songs and their movement patterns are copied from decoded tables. TV, tours and other permanently excluded Mission01 places are not offered.
- Venue acceptance: `ClassLiveScript.willLetBandPlay` / `rDefLikesAlbum`, best media target, music-only style, song-type/quality penalties and live reputation/hype bonus. Venue refusal is an eligibility decision, not just a disabled map icon.
- Booking: `DlgLiveScript`, `DlgBookScript`, `EventsManagerScript`, `DragPlannedItemScript`. Rental is charged only on committed booking; previews/cancelled UI selections make no transaction. Source literal resource intersection makes Concert and AlbumRelease conflict through NotOnTour. Ads have no resource requirements. Calendar capacity is four simultaneous visible events. Future dates may start tomorrow, up to the bounded 100-day search window.
- Concert performance: `ClassBandScript.getLivePerformance`, `ConcertCalcs`, `ClassConcertScript`, active `DlgConcertResultScript`. Audience includes guaranteed regulars plus group reach/hype/freshness; ticket share is paid once at the one-day event's stop. Missing vocals cancels without a new charge. Crowd, musicality, charisma and mood feed satisfaction. Source reputation uses pre-capacity audience demand. Source active result does not credit computed merchandise earnings.
- Exposure: `ClassMediaTargetScript.calcReach`, `ClassAudienceExposureScript.timeTick`, `ClassGroupScript.expose`. Media reach uses age overlap, education/economy/style/type matching. Exposure accumulates, and hype receives diminishing-return intensity*quality influence. No campaign directly increments sales. Store templates AdRS01/02/03 are recovered through ActionCategory ActCatRSSales.Actions because the original Media05.AdvertisingIDs list is empty; they require no reporter.
- Press kits: `ClassReporterScript.givePressKit`. Free, per reporter/per demo, require scheduled album, trigger next-day radio evaluation, source reporter style tolerances are zero. Gifts use source prices, bribe saturation/sensitivity reactions and ten-day mood effects.
- Ads: `DlgMediaAdScript`, `ClassExpoAdScript`. Daily source price times duration paid once upfront, dated daily exposure, source per-group quality blends advert quality and group album liking. The source contains a `buyAd` helper but no recovered call site; no arbitrary extra advertising favor is added.
- Reviews/rotation: `ClassReporterScript`, `ClassExpoReviewScript`, `ClassExpoRotationScript`. Paper reviews are once per outlet, probability-driven during the original release window; the shipped review code overwrites initial liking with vocalist musicality plus random variation. Radio reassesses every seven days after a kit; exposure uses source 0.2 intensity factor. Radio chart rating is intensity/0.2, matching getAlbumRotation, not raw exposure intensity.
- Sales/royalties: `ClassGroupScript.timeTick/buysAlbum`, `ClassAlbumScript.getRevenue`, `ClassRecordScript.timeTick`, `ClassPlayerScript.transactMoney`. Sales require signed released album; hype/WillBuy decay and resistance-driven buying follow source equations. Existing buyers are not charged twice. Freshness falls 0.006 from demo recording onward. Source songwriter royalty and negotiated artist royalty apply; artist earnings repay the advance before cash payment. Entitlement remains fractional; actual money transfer rounds to nearest whole currency as original ClassPlayer does.
- Charts: `ClassChartSongScript`, `ClassChartMovementScript`, `ChartsManagerScript`, `ClassMediaScript.calcChart`. Persistent seeded source movement selection, weekly competing-song lifecycles, source weekly sales/rotation thresholds, cached positions and previous positions. Top ten is computed from actual seven-day sales or normalized radio rotation, never granted merely for buying advertising.
- Source script randomness is replaced with a persisted deterministic generator. This gives repeatable reloads, not byte-identical Director random sequences.

## Validation

Eight tests in `tests/publicity.test.ts` cover native pricing/venue restrictions, conflict rules and four-event capacity, rejected-action immutability, source dated exposure, reporter-specific kits/gift transactions, one-time concert settlement and cancellation, sales/advance recoupment/whole-currency payout, save validation and deterministic reload replay. The exposure equation is checked numerically against source, and scheduled albums are prevented from selling before release. TypeScript checking is run with the shared repository; failures in other agents' concurrently edited files are reported separately.

## Explicit remaining differences and boundaries

- Source dynamic needs, health, instrument skill modifiers, musician absence, stage design, merchandise, tour events and media interview requests are not part of this module. Current musician mood/charisma/musicality values are used. Timed gift modifiers use a fixed ten-day amount rather than reconstructing the complete GrowingValue/modifier engine.
- Concert spacing checks the selected concert dates, whereas the original dialog first checks neighboring venue concerts around today's booking date. The reconstruction enforces the intended venue interval consistently and documents this difference.
- The original game's manager order among timers/exposures/groups varies with object registration. This module deliberately processes concert stops, ad/reporter events, exposures, group purchases, royalties and charts in a stable order. This can shift exposure or purchases by a day relative to a particular original run.
- Current demo/album music style is derived from the band's available state, consistent with the recovered contract code overwriting album music style with band style. The original separate mutable album MusicStyle object and post-recording band changes are not fully reconstructed. Album image style uses the stored design/demo value.
- Group album liking is refreshed from the same source equations daily rather than only from the original AlbumWasReleased notification. Without later band changes these values are identical. Hype/favor are persisted, but full historical multi-album labels/earnings are not supported by the project's current one-album state.
- Default fallback HypeDrop/HypeFactor/WillBuyDrop/WillBuyFactor are used; later plugin/system-preference overrides are not modeled. Mission01 Vars contains no likeness/chart boost, so automatic favorable boosts are not invented.
- Original ties and first-week fake previous positions depend on Director sorted property-list behavior and chart initialization. Stable current/previous reconstruction is retained; exact tie ordering has not been runtime-verified. Chart sources are genuine recovered names/movements, not generated songs.
- Store sales and royalty entitlement use source floating values internally; display code may round them. Gold/platinum thresholds are still language-defined values that have not been recovered, and are not invented here.
- Review text/speech, native actors/environment art and result UI remain the root/UI agents' responsibility. This module exports persistent review/result IDs and acknowledgement storage; tests do not certify pixel-perfect rendering.

## Extra label advances: recovered conditions and unresolved entry point

The tutorial text ECOCMis1IntroduceAdvance says a label may provide further advances for something in return. `DataActionCategories00.json` defines ActCatRecordAdvance with sleeve/video/ad/tour actions. `DataDBRest00.json` Action rows define:

| Action | Additional advance | Required human liking |
|---|---:|---:|
| ActRecordAdvanceSleeve | 10,000 | >=0.4 |
| ActRecordAdvanceStudio | 20,000 | >=0.4 |
| ActRecordAdvanceVideo | 25,000 | >=0.5 |
| ActRecordAdvanceAd | 50,000 | >=0.6 |
| ActRecordAdvanceTour | 75,000 | >=0.8 |

Studio is not included in the recovered advance category's action list. All require the label's accumulated Advance<500,000 and no outstanding condition for the same action. Their negative table prices represent payouts, not fees. DlgRecordScript.DoAction explicitly skips ordinary price deduction for ActCatRecordAdvance. ClassRecordScript.giveConditionalAdvance takes abs(price), credits money, adds to accumulated Advance and activates success/failure triggers. Negotiated royalty is unchanged.

Success means AlbumSleeve / LeaveMixer / BookVideoProduction / BookExpoAd / BookTour respectively. Failure is checked when currentDate>activationDate+5: the extra advance is removed from accumulated Advance and its entire amount is immediately reclaimed; a source warning card is shown. These are conditional obligations, not a free cash button or a new royalty negotiation.

However, the reachable entry point and eligibility calculation are not established in the recovered version. DataBuildings00 Record01/03 Actions contain cancel-contract, demo and survey, with no advance category. A bounded search across recovered scripts and decoded data finds ActCatRecordAdvance only in the category table and DlgRecordScript's special-case payment branch. Advance expressions call CHuman.getLikesBand(); that handler exists on ClassReporter, whereas label bosses HmRecord01/03 are plain ClassHuman. The recovered ClassHuman has no getLikesBand handler; its separate deprecated likesBand handler alerts and returns a random number. No additional label-boss liking implementation or replacement action wiring was found in this search.

Consequently no enabled requestAdvance payout helper has been added: choosing a favorable eligibility score, bypassing the condition deadline or adding the absent source category would be an explicit reconstruction extension. These source definitions can support such an extension once its eligibility/entry-point policy is deliberately specified, but they do not currently justify claiming exact original functional behavior. This is a static evidence gap, not a runtime observation that the original button fails.



## Canvas integration and verification

The Phaser UI now opens the four Mission01 venues, Radio FM, City News,
Zer0 Magazine and Record Store. It uses recovered environment bitmaps, four
neutral source actor composites, original gift pictures, border tiles,
arrow/scroll assets, star meters and both original chart backgrounds.
Confirmed calendar items use the source fixed-event caps; drafts use movable
caps. Concert results combine the original venue feedback background,
instrument-specific musician poses at ActorsLiveField positions, and the
source crowd overlay chosen by attendance.

The Date display opens the shared agenda. Gig and advert booking dialogs
preserve their parent window and block its input. Date conflicts, four-event
capacity, cancellations and affordability are enforced by the model.
Completed gigs and reviews have saved acknowledgement IDs, so closing or
reloading their result screens cannot pay twice. Reporter kits are independent;
a supplied kit disables that outlet's action. Promotion affects audience
exposure and the source purchase equations, rather than directly adding sales.

Existing version-one saves are migrated without changing recorded songs,
contracts, band members, cash or confirmed sleeves. Additional missing
publicity fields receive defaults; invalid defined values still fail validation.
Source chart/calendar/advance tutorial text follows elapsed dates, and the
first media-exit date survives reload. Additional conditional label advances
remain the bounded source uncertainty described above.

Verification: 22 renderer-independent tests and 15 Edge browser tests passed.
The new browser flows cover venue booking/cancel/settlement, radio kits and
gifts, wheel scrolling, advert scheduling/cancel, calendar reload, newspaper
and magazine kits, Store campaign prices, reviews, dated sales, source chart
rendering and migration of pre-publicity saves. Current captures and the
user-supplied native references are paired in analysis/ui-review/index.html.
Original game files are untouched; normal browser/desktop builds use retained
assets and do not require the mounted CD.

Presentation limits remain: dynamic text is rendered by browser canvas rather
than Director's exact text rasterizer, media portraits currently use their
source neutral composition without lip sync (original speech now plays), and further original
random activity prompts and generated concert/review prose are not recreated.
See feedback-validation.md for the subsequent promotion UI, audio and automatic-clock corrections.
Normal tutorial play follows place unlocks; the prototype's tutorial-disabled
mode permits venue browsing once a demo exists.
