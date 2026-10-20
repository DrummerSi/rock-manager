import fs from 'node:fs';
import crypto from 'node:crypto';
const root='analysis/original', source='E:/Games/Rock Manager/RockMaterial.cxt';
const bytes=fs.readFileSync(source), metadata=JSON.parse(fs.readFileSync(`${root}/scripts/installed/RockMaterial.cxt/metadata.json`));
const sha=buffer=>crypto.createHash('sha256').update(buffer).digest('hex');
const map=metadata.chunks.find(c=>c.fourCC==='mmap').data.mapArray;
const activities=JSON.parse(fs.readFileSync(`${root}/activity-assets-evidence.json`));
const fonts=JSON.parse(fs.readFileSync(`${root}/native-font-evidence.json`));
const names=['DlgEventCardBaseData','DlgEventCardNoPicData','DlgEventCardSmallPicData','DlgEventCardLargePicData','DlgRockData','DlgButton2Data','DlgButtonPairData','DlgRehearsal01Data','DlgInfoFrameData'];
const layouts=activities.texts.filter(t=>names.includes(t.name)).map(t=>({...t,textSHA256:sha(Buffer.from(t.text,'latin1'))}));
const formats=['EventCardNoPicFormatting','EventCardSmallPicFormatting','EventCardLargePicFormatting','EventCardSmallPicCaptionFormatting','RehearsalAlbumFormatting'];
const richText=formats.map(name=>{
 const member=metadata.chunks.find(c=>c.data?.info?.name===name);
 if(!member)return {name,missing:true};
 const chunk=map[member.id], raw=bytes.subarray(chunk.offset+8,chunk.offset+8+chunk.len), specific=raw.subarray(12+member.data.infoLen);
 return {name,source,sourceSHA256:sha(bytes),memberId:member.id,castSHA256:sha(raw),cachedTextRect:{height:specific.readUInt32BE(48),width:specific.readUInt32BE(52)},font:fonts.richTextFormats.find(f=>f.memberName===name)};
});
const table=JSON.parse(fs.readFileSync(`${root}/data/DataDBEC00.json`)).data.EventCardOKCancel;
const training=['ECOCTrainingDone','ECOCTrainingMediaDone'].map(id=>{const i=table.ID.indexOf(id);return Object.fromEntries(Object.entries(table).filter(([,v])=>Array.isArray(v)).map(([k,v])=>[k,v[i]]));});
const dialogs=JSON.parse(fs.readFileSync(`${root}/data/DataDialogs00.json`)).data.Dialog;
const bandIndex=dialogs.ID.indexOf('DlgRehearsal01');
const bandPanel={loc:dialogs.loc[bandIndex],icon:dialogs.icon[bandIndex],buttons:Object.fromEntries(['ButtonOK','ButtonCancel','Button3'].map(name=>[name,Object.fromEntries(Object.entries(dialogs[name]).map(([key,values])=>[key,values[bandIndex]??null]))])),
 albumInfo:{offset:[462,46],icon:'icon_cd02',format:'RehearsalAlbumFormatting',width:189,fontFamily:'Verdana',fontSize:11,bold:false,letterSpacing:-1,
 rows:[['szidRecordCompany','CPContractor Record.name or -'],['szidRoyalty','CPContractPriceModel.Royalty as percent or -'],['szidAdvancePay','record.Advance or -'],['szidAlbumRecorded','Yes iff focusedAlbum exists'],['szidSleeveDesigned','Yes iff DesignSettings.count>0; No if album has no design; - if no album'],['szidReleaseDate','ReleaseDate if>0 else -'],['szidVideo','VideoConcept.name else -'],['szidCopiesSold','album.Sales else -'],['szidRevenue','album.getRevenue(#DisregardPublisher)'],['szidToPublisher','revenue*Song.PriceModel.Royalty'],['szidToRecord','CPContractPriceModel.Royalty*(revenue-toPublisher)'],['szidEarned','revenue-toPublisher-toRecord'],['szidIncludingAdvance','revenue-toPublisher-toRecord-record.Advance']],trailingBlankLines:7},
 rules:['setBandInfo immediately exits; no active source BandInfo panel.','ButtonCancel togglesmixdown.wav and starts disabled without focusedAlbum.','Button3 changes band name; no ChooseSong button exists.','ButtonOK checks singeravailability and unchangedbandname tutorial before close.','setAlbumInfo release-only initial block overwritten by finalcontract/album rows.']};
const result={schemaVersion:1,kind:'Static recovered Director layout and Lingo evidence; no original runtime measurement claimed',layouts,richText,training,bandPanel,
 portraitFrame:activities.recovered.find(a=>a.name==='portrait_frame_large01'),
 rules:{baseContentOffset:[17,46],outerBottomRightPadding:[20,20],automaticCenter:[400,305],smallPictureInfoGap:7,smallPictureRegistration:[49,52],albumConcertSmallPicture:[93,98],humanFaceOffset:[3,3],captionOffsetBelowFrame:1,buttonOffsetBelowTop:13,buttonHeight:33},
 sources:['analysis/original/scripts/installed/RockUtil.cxt/00084-DlgEventCardAncestorScript.lingo','analysis/original/scripts/installed/RockUtil.cxt/00087-DlgEventCardOKCancelScript.lingo','analysis/original/scripts/installed/RockUtil.cxt/00041-TextFormatterScript.lingo','analysis/original/scripts/cd/Main.dxr/00014-DlgRehearsal01Script.lingo'],
 limitations:['CASt cached text rect width recovered; height68 is template height, runtime text substitution changes it. Paragraph spacing14 is measured for matching Verdana11 native text, not an event-card-specific runtime measurement. Native font revision AA uncertainty documented separately.']};
fs.writeFileSync(`${root}/event-card-layout-evidence.json`,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({layouts:layouts.length,formats:richText.map(f=>({name:f.name,rect:f.cachedTextRect})),training:training.map(t=>t.ID)}));
