import fs from 'node:fs';
import {indexedCast,bitmap,xmedStyle,digest} from './director-cast.mjs';
const wanted=new Map([['illustration_no money01',36],['d_paper02',0],['Rehearsal01NamePic',36],['mission01_demoillustration01',36],['frame02 large environment',36],['frame02 large environment_rotated-3',36],...Array.from({length:9},(_,i)=>['mission'+String(i+1).padStart(2,'0'),36])]);
const formattingNames=new Set(['MixerExitFormatting','DefaultFormatting','PublishFormatting','Publish2Formatting','MissionIntroFormatting','MissionIntro2Formatting','MissionTotalPointsFormatting','MissionScrollFormat','MissionIntro2Text','TestEnterField','ScrollItemField']);
for(const prefix of ['newsintro01_','magazineintro01_'])for(let i=0;i<9;i++)wanted.set(prefix+String(i).padStart(4,'0'),36);
for(const name of ['meter01_background01','meter01_line01Left','meter01_line01Mid','meter01_line01Right'])wanted.set(name,36);
const recovered=[],formatting=[];
for(const [index,override]of [['analysis/original/scripts/installed/RockMaterial.cxt/metadata.json'],['analysis/original/scripts/installed/RockUtil.cxt/metadata.json'],['analysis/original/scripts/cd/Mission.dxr/metadata.json','E:/Games/Rock Manager/Mission.dxr']]){
  const cast=indexedCast(index,override);
  for(const member of [...cast.members].sort((a,b)=>cast.slots.indexOf(a.id)-cast.slots.indexOf(b.id))){
    const name=member.data.info?.name??'';
    if(member.data.type===15&&formattingNames.has(name)){const entry=xmedStyle(cast,member);if(entry)formatting.push(entry);}
    if(member.data.type!==1||!wanted.has(name)||recovered.some(r=>r.name===name))continue;
    const result=bitmap(cast,member,wanted.get(name));if(!result)continue;const {bytes,...evidence}=result;
    const path=`media/SourceWindows/${name.replaceAll(' ','_')}__m${member.id}.png`;fs.mkdirSync('analysis/original/media/SourceWindows',{recursive:true});fs.writeFileSync('analysis/original/'+path,bytes);recovered.push({name,path,...evidence});
  }
}
fs.writeFileSync('analysis/original/source-window-assets.json',JSON.stringify({recovered,formatting},null,2));
const cardPath='analysis/original/data/DataDBEC00.json',cardBytes=fs.readFileSync(cardPath),table=JSON.parse(cardBytes).data.EventCardOKCancel,cards={};
for(const id of ['ECOCAlbumDiscardDemo','ECOCAlbumDiscard','ECOCAskQuitGame','ECOCContractAlreadyGot','ECContractNoDemo','ECContractNoBand']){
 const i=table.ID.indexOf(id);cards[id]=Object.fromEntries(['name','Headline','comment','question','Caption','Gfx','icon','dataMemberName'].map(k=>[k,table[k][i]]));
 cards[id].confirm=table.ButtonOK.name[i];cards[id].cancel=table.ButtonCancel.name[i];
}
fs.writeFileSync('analysis/original/source-confirmations.json',JSON.stringify({source:cardPath,sourceSHA256:digest(cardBytes),cards},null,2));
console.log(JSON.stringify({recovered:recovered.map(x=>({name:x.name,width:x.width,height:x.height})),formatting:formatting.map(x=>({name:x.name,width:x.width,height:x.height,styles:x.styles.map(({rawValues,...s})=>s),runs:x.runs}))},null,2));
