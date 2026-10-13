# Remaining Mission01 gameplay evidence

All findings below are static observations of recovered Director Lingo and decoded CD tables. No original runtime was launched or observed during this investigation. Expressions in tables are retained source strings, not executed evidence. This document describes the original rules; it does not certify current application coverage.

## Venues and gigs

Sources: `scripts/cd/Main.dxr/00018-DlgLiveScript.lingo`, `00019-DlgConcertResultScript.lingo`; `scripts/installed/RockGeneral.cxt/00027-ClassLiveScript.lingo`, `00046-ClassConcertScript.lingo`, `00118-ConcertCalcs.lingo`, `00016-ClassBandScript.lingo`; `data/DataBuildings00.json` (`data.Live`), `DataMediaTargets00.json`, `DataAudience00.json`.

Booking requires a band, a demo, sufficient money for the venue's BasePrice, and no conflicting nearby concerts at that venue. The dialog checks spacing around today's date against MinDaysBetweenConcerts, then creates a one-day Concert initially at today+2; the calendar booking dialog selects the actual date. Rent is charged on BookedOK, not after the performance. The venue must accept the demo: the best media-target evaluation uses music weight 1, image weight 0, song-type and quality weights 1 and freshness weight 0.3. Acceptance is `totalSubZero + 0.2*LiveReputation + 0.01*totalHype >= 0`, otherwise localized DemoFeedback is shown.

| Mission01 venue | Capacity | Rent | Ticket price | Band share | Regular fraction | Minimum spacing |
|---|---:|---:|---:|---:|---:|---:|
| Live01 Café Lizette | 240 | 0 | 50 | 0.50 | 0.30 | 5 days |
| Live02 The Rock Pit | 340 | 5,000 | 90 | 0.50 | 0.20 | 8 days |
| Live03 Mirror Ball | 460 | 10,000 | 150 | 0.40 | 0.40 | 12 days |
| Live04 Avenue | 750 | 20,000 | 120 | 0.60 | 0.20 | 16 days |

Mission01 permanently excludes Live05/06. Eligibility is not equivalent to accepting every venue simply because it is unlocked.

At event start, no current album cancels the concert. At stop, the band must be able to perform. Guaranteed visitors are capacity*Regulars, distributed proportionally across reached audience groups. Additional visitors per group are group size times `clamp(reach*PopulationFactor*groupBandHype*0.02*(1+0.3*LiveReputation)*albumFreshness,0,1)`. `calcAudienceSatisfaction` scales attendance to venue size and computes performance/group satisfaction. Its entire chain includes musician performance, group attitudes, exposure and merchandise; do not replace it with an arbitrary attendance randomizer.

Venue ticket revenue is capped attendance*ticket price; band income is that amount*Royalty. The result dialog credits rounded band income, with optional mission concertMoneyFactor, and reports net after previously paid rent. Current active result code computes merchandise income but does not credit it; the obsolete zz result does. Preserve this distinction. Live reputation changes by `clamp((averageSatisfaction-0.2)*wantedAttendance/500,-0.5,0.5)`, using attendance demand before the venue capacity cap, with final reputation bounded [-1,1]. Musician moods and audience exposures also change.

Implementation prerequisites: persistent calendar events, occupancy/cancellation, band live reputation, audience-group reach/hype/attitudes, result dialog and source venue environments. These dependencies are not established merely by having hiring/demo/contract state.

## Sleeve design and release

Sources: `scripts/cd/Main.dxr/00031-DlgDesignScript.lingo`; `scripts/installed/RockGeneral.cxt/00018-ClassAlbumReleaseScript.lingo`, `00041-ClassAlbumScript.lingo`; `data/DataDesignAndStage00.json` (`DesignCategory`, `DesignElement`), `DataDialogs00.json`, `DataDBRest00.json` trigger expressions.

Four sleeve categories are DCDesignBG, DCDesignFont, DCDesignArtist and DCDesignFX. Their `elements` lists preserve original chooser order, including no-design choices. Each selected element has its own Gfx, price, quality delta and six-component Style. Preview composition is real source media, not a procedural replacement. Total price is the sum of selected elements. Example backgrounds: Brick wall 500; Forest 1,000; Curtain 1,500; Speaker stack 2,000 and quality+0.1; Skyline 2,500.

Confirmation requires a current album signed to a label, no existing ReleaseDate, and enough money. It creates a one-day AlbumRelease initially at today+6 and adds NotOnTour to neededIDs. Calendar confirmation sets album.ReleaseDate to the selected date and charges design once. It is permissible to choose no artwork: the source has a specific image_nodesign01_small01 path.

Design affects gameplay, not just artwork. Non-artist elements add their quality deltas. Artist choice supplies musician exposure weights: DEDArtists01 all=1; DEDArtists02 vocals=2, others=1; DEDArtists03 vocals=2, others=0; DEDArtists04 everyone=0. Quality then adds `0.1*(weightedCharisma-0.5)` and clamps [0,1]. Album image style becomes the exposure-weighted musician style plus the selected non-artist Style vectors, individually clamped [0,1]. Saving the selected composition and its immutable calculated values is necessary to avoid applying these additions twice.

AlbumRelease stop notifies all reporters and audience groups. Album ReleaseDate is booked ahead; getAlbumIsReleased returns ReleaseDate>0 and today>=ReleaseDate. `ClassAlbum` and `ClassGroup` contain sales/penetration/freshness, not the release dialog. Freshness decays 0.006 per day. Store charts compare the current album's last seven days of sales against recovered chart entries. Avoid declaring Top10 success merely on scheduling release.

## Newspaper and radio promotion

Sources: `scripts/cd/Main.dxr/00021-DlgMediaScript.lingo`, `00022-DlgMediaAdScript.lingo`, `00041-DlgMediaProposalScript.lingo`; `scripts/installed/RockGeneral.cxt/00021-ClassReporterScript.lingo`, `00031-ClassMediaScript.lingo`, `00071-ClassExpoAdScript.lingo`, `00072-ClassExpoMediaActivityScript.lingo`, `00073-ClassExpoRotationScript.lingo`, `00074-ClassExpoReviewScript.lingo`; `data/DataBuildings00.json` (`data.media`, lower-case), `DataMediaEvents00.json`, `DataMediaActivities00.json`, `DataActionCategories00.json`, `DataDBRest00.json` actions.

Mission01 permits Media02 Radio FM, Media03 City News, Media04 Zer0 Magazine and Media05 Record Store; Media01 TV24 is permanently excluded. Each media place has actions, a reporter and advertising template IDs. Press kits are explicit reporter state, keyed to the current album/video, not a global promoted flag. ActMediaGivePressKit is disabled without a scheduled ReleaseDate or when that reporter already has the kit; its source expression calls givePressKit(#Album). General actions charge their table price before execution.

Advertisements are scheduled ExpoAd events, paid upfront as chosen duration*daily template price. Duration changes consult closestPossibleDate and agenda channel availability. Source confirmation emits BookExpoAd twice; this is an observed quirk, not justification for charging twice.

| Place | Source advert | Daily price | Intensity |
|---|---|---:|---:|
| Radio FM | AdFM01 15 s spot | 10,000 | 0.20 |
| Radio FM | AdFM02 40 sec. spot | 18,000 | 0.40 |
| Radio FM | AdFM03 60 sec. spot | 30,000 | 0.80 |
| City News | AdCN01 Classified | 5,000 | 0.20 |
| City News | AdCN02 Half page | 16,000 | 0.40 |
| City News | AdCN03 Full page | 25,000 | 0.80 |
| Zer0 Magazine | AdZM01 Classified | 3,000 | 0.10 |
| Zer0 Magazine | AdZM02 Half page | 9,000 | 0.30 |
| Zer0 Magazine | AdZM03 Full page | 20,000 | 0.70 |

ExpoAd quality per audience group is mean(templateQuality, group's album liking), with liking floored at -1. Reporter favor includes accumBribes, accumAds and AvoidExpo; each has source daily decay. These values interact with album liking/hype and availability, so spending does not automatically guarantee review/rotation.

Reporter daily checks require the band in town, a current album, a press kit and no AvoidExpo. Paper reviews can occur once per outlet while today<ReleaseDate+15, with random(100) compared against `100*(AddedExpoProbability+likesBand)/15`. Source reviews additionally apply a +/-0.1 variation. Radio playlist cycles run every seven days; rotation uses `likesBand + convValToRange(totalAlbumHype,[MinHype,0.5],[0,1])`, accepted if >=0, creating a seven-day ExpoRotation with intensity0.2*rotation. Radio exposure gives album music weight1, image weight0.2, type/quality1, freshness0.3. TV differs and requires a video; do not reuse its rules for radio.

Implementation prerequisites: persistent per-reporter press kits/favor/reviews, date-driven ads/rotation, audience exposure updates, album release state and daily sales. A button that deducts money and directly increments sales is not equivalent to recovered promotion.

## Unlocks, tutorials and remaining uncertainty

`DataDBRest00.json` Trigger rows: recording unlocks labels and disables Design01; SignContract enables Design01 and restricts labels to the contracted one; exiting a label unlocks venues (even if refused). Exiting Design with ReleaseDate>0 unlocks media, while permanent Mission01 exclusions still apply. `opening-ui-evidence.json` records tutorial triggers: mixer exit introduces labels, contract success introduces sleeves, design exit with scheduled release introduces media, then timed chart/calendar introductions. Gigs remain an alternate way to improve a refused band's reputation.

Raw dialog layouts are retained in RockMaterial STXT and their origins in DataDialogs00. Environment/actor casts for venue/media interiors may require additional CD extraction; source Gfx names alone do not prove a rendered reconstruction. The complete audience exposure, sales and event conflict algorithms require further bounded tracing before claiming full original simulation fidelity. This investigation establishes their entry points and direct rules, not live behavior or a finished implementation.
