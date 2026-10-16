import type {ActorMood} from './actor-portrait';

export interface IntroPicture {
  name:string; key:string; anchor:[number,number]; dimensions:[number,number];
  nativeDimensions:[number,number]; registration:[number,number];
  /** Original score dimensions differ for the building; scaling rounding is unverified. */
  scaled?:boolean;
  /** A film-loop still is retained until its internal SCVW timing is decoded. */
  stillFromFilmLoop?:boolean;
}
export interface IntroSegment {
  audioKey:string; pictureName?:string; picture?:IntroPicture; frame?:number;
  border?:IntroPicture;
  actorId?:string; mood?:ActorMood;
  /** No invented scene transition for a clip whose frame action is not yet decoded. */
  holdPreviousPicture?:boolean;
  sourceNote?:string;
}
const picture=(name:string,key:string,anchor:[number,number],dimensions:[number,number],registration:[number,number],nativeDimensions=dimensions):IntroPicture=>
  ({name,key,anchor,dimensions,nativeDimensions,registration,...(nativeDimensions[0]!==dimensions[0]||nativeDimensions[1]!==dimensions[1]?{scaled:true}:{})});
const office=()=>picture('background01','mission34-background01-1620',[288,252],[314,210],[157,105]);
const boardroom=(anchor:[number,number])=>picture('background01','mission34-background01-1647',anchor,[334,240],[167,120]);
// Mission.dxr score: each new photo has its own registered frame. Older
// photos remain underneath it; the Mission01 frame positions do not apply.
const borders:Record<number,[number,number,'normal'|'left'|'right']>={
  18:[289,256,'left'],21:[292,256,'normal'],24:[289,257,'right'],26:[289,260,'left'],28:[289,257,'right'],30:[302,264,'normal'],
  53:[288,256,'left'],55:[292,256,'normal'],57:[291,257,'right'],59:[296,261,'left'],61:[291,257,'right'],
  111:[292,256,'normal'],124:[302,253,'left'],129:[288,256,'left'],131:[298,256,'normal'],135:[306,263,'normal'],244:[293,256,'right'],
  69:[288,256,'left'],71:[293,261,'normal'],96:[292,256,'normal'],103:[307,260,'right'],
};
function introBorder(frame:number|undefined):IntroPicture|undefined{
  const row=frame===undefined?undefined:borders[frame];if(!row)return;
  const [x,y,kind]=row;
  return kind==='left'?picture('frame02 large environment_rotated-3','source-window-frame02_large_environment_rotated-3',[x,y],[341,241],[171,120])
    :kind==='right'?picture('frame02 large environment_rotated5','source-window-frame02_large_environment_rotated5',[x,y],[346,250],[174,126])
    :picture('frame02 large environment','source-window-frame02_large_environment',[x,y],[329,224],[164,112]);
}

/** Source: mission34-assets.json, original Mission.dxr score sprite initializers
 * and CD Voice/Swa filenames. Audio runs in numbered part order; advance on
 * actual audio completion, never a guessed number of score frames.
 *
 * This is an explicit partial cutscene reconstruction: the original full
 * actor body animation and frame-action scene transitions remain separate.
 */
export function introSegments(missionId:string):IntroSegment[]{
  let segments:IntroSegment[];
  if(missionId==='Mission03')segments=[
    {audioKey:'intro03_01r04',frame:18,picture:picture('global building08','mission34-global_building08-1534',[284,252],[314,210],[162,113],[325,227])},
    {audioKey:'intro03_02r04',frame:21,picture:office(),actorId:'record04',mood:'normal'},
    {audioKey:'intro03_03r04',frame:24,picture:boardroom([285,253]),actorId:'mission03_globalboss02',mood:'Happy'},
    {audioKey:'intro03_04r04',frame:26,picture:picture('colosseum01','mission34-colosseum01-1628',[282,257],[328,228],[162,115])},
    {audioKey:'intro03_05r04',frame:28,picture:boardroom([285,253]),actorId:'mission03_globalboss02',mood:'normal'},
    {audioKey:'intro03_06r04',holdPreviousPicture:true,sourceNote:'CD part06 recovered; corresponding score frame action is not decoded. Hold the last verified scene.'},
    {audioKey:'intro03_07a16',frame:30,picture:picture('background01','mission34-background01-1620',[298,260],[314,210],[157,105]),actorId:'mission03_brother01',mood:'Happy'},
    {audioKey:'intro03_08a28',actorId:'mission03_brother02',holdPreviousPicture:true,sourceNote:'Speaker identity follows original a28 voice and existing brother02 Speak initializer; transition frame unverified.'},
    {audioKey:'intro03_09a16',actorId:'mission03_brother01',holdPreviousPicture:true},
    {audioKey:'intro03_10a28',actorId:'mission03_brother02',holdPreviousPicture:true},
    {audioKey:'intro03_11a16',actorId:'mission03_brother01',holdPreviousPicture:true},
  ];
  else if(missionId==='Mission04')segments=[
    {audioKey:'intro04_01g01',frame:53,picture:{...picture('ship01_0000','mission34-ship01_0000-1686',[283,252],[324,228],[162,114]),stillFromFilmLoop:true},sourceNote:'Score uses ship wateranim01 SCVW. This is its first recovered bitmap, not a claim of original loop playback.'},
    {audioKey:'intro04_02g01',frame:55,picture:office(),actorId:'gangsta01',mood:'normal'},
    {audioKey:'intro04_03g01',frame:57,picture:boardroom([286,252]),actorId:'mission04_gangsta02',mood:'normal'},
    {audioKey:'intro04_04g01',frame:59,picture:picture('mission04_daughter01','mission34-mission04_daughter01-1661',[291,257],[324,228],[162,114])},
    {audioKey:'intro04_05g01',frame:61,picture:boardroom([286,253]),actorId:'mission04_gangsta02',mood:'Angry'},
    {audioKey:'intro04_06g01',holdPreviousPicture:true,sourceNote:'Original CD and score initializer contain part06; its frame action is not decoded.'},
  ];
  else if(missionId==='Mission05')segments=[
    {audioKey:'intro05_01a24',frame:69,picture:picture('magazine cover01','mission34-magazine_cover01-1438',[283,252],[324,228],[162,114])},
    {audioKey:'intro05_02a24',frame:71,picture:picture('background01','mission34-background01-1588',[289,257],[314,210],[157,105]),actorId:'mission05_singer01',mood:'Angry'},
    ...['03a26','04a24','05a26','06a24','07a26','08a24'].map(part=>({audioKey:'intro05_'+part,actorId:part.endsWith('a26')?'mission05_guitarist01':'mission05_singer01',holdPreviousPicture:true})),
  ];
  else if(missionId==='Mission06')segments=[
    {audioKey:'intro06_01a32',frame:96,picture:office(),actorId:'mission06_nicke01',mood:'normal'},
    {audioKey:'intro06_02a32',actorId:'mission06_nicke01',holdPreviousPicture:true},
    {audioKey:'intro06_03a32',frame:103,picture:boardroom([302,255]),actorId:'mission06_nicke02',mood:'normal'},
  ];
  else if(missionId==='Mission07')segments=[
    {audioKey:'intro07_01a18',frame:111,picture:office(),actorId:'mission07_spacecadet_roy01',mood:'normal'},
    ...['02a23','03a18','04a23'].map(part=>({audioKey:'intro07_'+part,actorId:part.endsWith('a23')?'mission07_spacecadet_lina01':'mission07_spacecadet_roy01',holdPreviousPicture:true})),
    {audioKey:'intro07_05a18',frame:124,picture:picture('mission 07 garbage can01','mission34-mission_07_garbage_can01-1345',[297,249],[324,228],[162,114])},
  ];
  else if(missionId==='Mission08')segments=[
    {audioKey:'intro08_01r04',frame:129,picture:picture('global building08','mission34-global_building08-1534',[283,252],[314,210],[162,113],[325,227])},
    {audioKey:'intro08_02r04',frame:131,picture:picture('background01','mission34-background01-1620',[294,252],[314,210],[157,105]),actorId:'record04',mood:'Happy'},
    {audioKey:'intro08_03r04',frame:135,picture:picture('rainbowzoom01','mission34-rainbowzoom01-1522',[302,259],[314,210],[157,105])},
    {audioKey:'intro08_04r04',frame:244,picture:boardroom([288,252]),actorId:'mission03_globalboss02',mood:'Angry'},
    {audioKey:'intro08_05r04',actorId:'mission03_globalboss02',holdPreviousPicture:true},
  ];
  else return[];
  return segments.map(segment=>({...segment,pictureName:segment.picture?.name,border:introBorder(segment.frame)}));
}
