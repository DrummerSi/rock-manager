# Rehearsal UI reconstruction evidence

Source: E:/Games/Rock Manager/RockMaterial.cxt, SHA-256 f5b45fc84530cd25af57c2df56965085d259d4515f19e8aed78c7d5996b5727b. STXT text and bitmap-specific metadata recovered with ProjectorRays 1.1.1; bitmap header offsets corroborated against LibreShockwave BitmapInfo.parse. Raw text/header records are in ui-layout-recovery.json. Original files unchanged.

## Rehearsal

DataDialogs00 loc is (60,77). All following positions relative to that origin. Background instrumentpos_background01, 419x204, at (30,181). Portrait-frame overlay instrumentpos_portrait_frames01, 426x390, at (27,31). Portrait top-left positions: slot1 (49,313), slot2 (30,67), slot3 (177,34), slot4 (351,50), slot5 (347,310). Album info at (462,46); rename button at (15,423); OK right edge 673 at same y; play/cancel immediately to its left. Main room uses current large portraits, not standing actor sprites. HelpfilesEng/pics/replokal.jpg visually corroborates this.

Main.dxr DlgRehearsal01Script.refresh generates instruments at shared registration anchor (236,245). Actual top-left = anchor - regPoint. Metadata includes registration outside bounds/negative values and must not be clamped. Drums black_standard: 160x105, reg(123,112), resulting top-left (113,133). Slot constraints: 1/2 guitar, brass, keyboards; 3 drums; 4 bass; 5 vocals (ChooseScript.new).

## Choose musician

DataDialogs00 loc (293,95). Sheet at (22,35), background_paper01 316x226. Photo frame107x112 at sheet(10,8); formatted information at sheet(15,8). Musicality and charisma meters at sheet(202,60) and (202,76), respectively. List at (23,272), outer frame local rect(0,16,280,156), inner inset5, scroller further inset2. Pair Hire/Cancel midpoint x179,y434. Whole dialog auto-sizes to content plus surround; exact runtime dimensions remain unobserved. HelpfilesEng/pics/artist_hire.jpg is scaled to 310x440 and shows paper sheet above narrow black list.

List is sorted by WantedSalary ascending, excludes hired/nonmission musicians, and includes a row per allowed instrument/musician combination, not one row per musician (ChooseScript.prepareScrollList). Selection displays age, instrument, musicality, star quality, style and comment (RockUtil setMusicianInfoSheet). Hiring sets NowPlaying, spatialPos and InBand, adds musician to band, sets context and sends HireBandMember.

## Button compositing

Original createWnd: WndAPI 00011-unnamed.lingo. DlgButton2Data text is Courier New bold14, #AAAAAA; hover white. Disabled text blend50; background swaps RockButtonDarkStyle; icon swaps _dimmed and mouse disabled (DialogRollOverButton2BH).

Normal skin is asymmetric: TL14x14; TR18x14; BL14x19; BR18x19. Corner placements respectively (0,0),(w-18,0),(0,h-19),(w-18,h-19). T x14..w-18 y0 height2; B x14..w-18 y h-7 height7; L x0 width2 y14..h-19; R x w-6 width6 y14..h-19. Preserve outside transparency. Fill black rect(14,2,w-18,h-6); duplicate RockButtonStyle record varies right fill inset14 versus18. Source creates stretched edge spans, not tiled edges.

Existing canvas-ui.frame incorrectly assumes common corner14 and spans width-28 and height-28. Corners end at right18/bottom19, so this creates overlapping/incomplete joins. Full rectangular black fill obscures rounded transparent corners. Existing hover gold, Arial text and alpha press effect differ from recovered behavior.

Original bitmap PNG alpha is meaningful. Button TL has alpha0 and255 plus partial coverage; room background and frame overlay have broad varying alpha ranges. Preserve these PNGs unchanged, unlike interface main01's unused zero alpha byte. Do not blindly force room alpha opaque or key white.
