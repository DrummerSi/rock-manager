import fs from 'node:fs';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {decodeDirectorVList} from './director-vlist.mjs';
const root = 'analysis/original';
const cdRoot=(process.env.ROCK_CD_ROOT??'V:').replaceAll('\\','/').replace(/\/$/,'');
const read = (name) => JSON.parse(fs.readFileSync(`${root}/data/${name}.json`));
const row = (value, index) => Array.isArray(value) ? value[index] : value && typeof value === 'object'
  ? Object.fromEntries(Object.entries(value).map(([key, child]) => [key, row(child, index)])) : value;
const numbers = (object) => Object.fromEntries(Object.entries(object).map(([key, value]) => [key, Number(value)]));
const ids = (text) => text.match(/#([A-Za-z0-9]+)/g)?.map((id) => id.slice(1)) ?? [];
const buildings = read('DataBuildings00'), songs = read('DataSongs00'), targets = read('DataMediaTargets00'), humans = read('DataHumans00');
const studios = buildings.data.Studio.ID.flatMap((id, i) => ['Studio01', 'Studio02','Studio03','Studio04'].includes(id) ? (() => {
  const s = row(buildings.data.Studio, i);
  return [{ id, name: s.name, description: s.comment, price: Number(s.price), quality: Number(s.quality),
    channels: Number(s.NumChannels), sessionMusicians: ids(s.StudioMusicians), availableEffects: ids(s.AvailableFX) }];
})() : []);
const labels = buildings.data.Record.ID.flatMap((id, i) => ['Record01','Record02','Record03','Record04'].includes(id) ? (() => {
  const s = row(buildings.data.Record, i);
  return [{ id, name: s.name, description: s.comment, albums: Number(s.PreferredNumAlbums),
    minimumAdvance: Number(s.MinPriceModel.BasePrice), maximumAdvance: Number(s.PreferredPriceModel.BasePrice),
    minimumRoyalty: Number(s.MinPriceModel.Royalty), maximumRoyalty: Number(s.PreferredPriceModel.Royalty),
    targets: ids(s.MediaTargets).map((id) => {
      const target = row(targets.data.MediaTarget, targets.data.MediaTarget.ID.indexOf(id));
      return { id, style: numbers(target.StyleMix), tolerance: numbers(target.StyleMixTolerance),
        songType: Number(target.SongType), songTypeTolerance: Number(target.SongTypeTolerance), minimumQuality: Number(target.MinQuality) };
    }) }];
})() : []);
const sessionMusicians = humans.data.StudioMusician.ID.map((id, i) => {
  const s = row(humans.data.StudioMusician, i);
  return { id, name: s.name, age: Number(s.Age), genre: s.Genre, charisma: Number(s.Charisma), price: Number(s.WantedSalary), musicality: Number(s.Musicality.Current) };
}).filter((s) => studios.some((studio) => studio.sessionMusicians.includes(s.id)));
const playableMissions=read('missions').missions.filter(m=>['Mission01','Mission03','Mission04','Mission05','Mission06','Mission07','Mission08'].includes(m.ID));
const allowed = [...new Set(playableMissions.flatMap(m=>ids(m.AvailableSongs)))];
const audioDirectory = `${root}/media/tutorial-audio`;
fs.mkdirSync(audioDirectory, { recursive: true });
const sourceDirectory = `${cdRoot}/Sound/Music/Sliced/Mp3`;
// Read before rewriting retained evidence: an unreadable CD must not truncate it.
const sourceNames=fs.readdirSync(sourceDirectory);
const previousAudio=new Set(JSON.parse(fs.readFileSync(root+'/tutorial-gameplay-evidence.json')).audio.map(a=>a.file));
const audio = [];
for (const name of sourceNames) {
  if (!name.toLowerCase().endsWith('.ogg') || !allowed.some((id) => name.startsWith(id.slice(3)))) continue;
  const file = fs.readFileSync(`${sourceDirectory}/${name}`);
  const target = name.toLowerCase();
  fs.writeFileSync(`${audioDirectory}/${target}`, file);
  const cueSource = `${cdRoot}/Sound/Music/Sliced/${name.replace(/\.ogg$/i, '.txt')}`;
  const cueBytes = fs.readFileSync(cueSource);
  const cuePath=`media/tutorial-audio/${name.replace(/\.ogg$/i,'.txt').toLowerCase()}`;
  fs.writeFileSync(`${root}/${cuePath}`,cueBytes);
  const cueValues = cueBytes.toString('ascii').trim().split(/\s+/).map(Number);
  if (cueValues.length < 3 || cueValues.some((value) => !Number.isFinite(value))) throw new Error(`Invalid cues in ${cueSource}`);
  audio.push({ file: target, source: `${sourceDirectory}/${name}`, sha256: crypto.createHash('sha256').update(file).digest('hex'),
    cueSource, cuePath, cueSHA256: crypto.createHash('sha256').update(cueBytes).digest('hex'), sampleRate: 44100, declaredCueCount: cueValues[0], cues: cueValues.slice(1) });
}
const loops = songs.data.loop.ID.flatMap((id, i) => {
  const s = row(songs.data.loop, i);
  if (!allowed.includes(s.BelongsToSong)) return [];
  return [{ id, songId: s.BelongsToSong, name: s.name, file: s.file.toLowerCase(), instrument: s.Instrument,
    style: numbers(s.StyleMix), numBars: Number(s.numBars), bpm: Number(s.BPM) }];
});
const defaults = allowed.map((id) => {
  const s = row(songs.data.Song, songs.data.Song.ID.indexOf(id));
  const mix = row(songs.data.MixerSettings, songs.data.MixerSettings.ID.indexOf(s.MixerDefault));
  return { id, songType: Number(s.SongType), style: numbers(s.StyleMix), bpm: Number(s.BPM), numBars: Number(s.numBars), timeSignature: s.TimeSignature.match(/\d+/g).map(Number),
    channels: ids(mix.channels).map((id) => {
      const channel = row(songs.data.channel, songs.data.channel.ID.indexOf(id));
      return { loopId: channel.LoopID, volume: Math.round(Number(channel.vol) * 100), pan: Math.round(Number(channel.Pan) * 100) };
    }) };
});
const musicianTable = read('DataMusicians00').data.RealMusician;
// ClassRealMusicianScript.PreInit derives RefNr from Gfx, then
// getSoundFilePrefix returns "a" plus its two-digit value.
const voicePrefixes = Object.fromEntries(musicianTable.ID.map((id, i) => [id, `a${musicianTable.Gfx[i].match(/\d{2}/)?.[0] ?? '01'}`]));
const material = JSON.parse(fs.readFileSync(`${root}/scripts/installed/RockMaterial.cxt/metadata.json`));
const materialBytes = fs.readFileSync(material.source);
const map = material.chunks.find((c) => c.fourCC === 'mmap').data.mapArray;
const keys = material.chunks.find((c) => c.fourCC === 'KEY*').data.entries;
const layoutNames = ['DlgStudioData', 'RecordNoContractData', 'RecordContractData', 'DlgMixerChooseMusicianData', 'DlgMixerFXData', 'DlgMusicianStudioInfoData'];
const layouts = material.chunks.filter((c) => c.fourCC === 'CASt' && layoutNames.includes(c.data.info?.name)).map((member) => {
  const chunkId = keys.find((k) => k.castID === member.id && k.fourCC === 'STXT').sectionID;
  const chunk = map[chunkId], bytes = materialBytes.subarray(chunk.offset + 8, chunk.offset + 8 + chunk.len);
  return { name: member.data.info.name, memberId: member.id, chunkId,
    text: bytes.subarray(bytes.readUInt32BE(0), bytes.readUInt32BE(0) + bytes.readUInt32BE(4)).toString('latin1') };
});
fs.writeFileSync(`${root}/tutorial-layout-evidence.json`, JSON.stringify({ source: material.source, sourceSHA256: material.sha256,
  dialogDefinitions: read('DataDialogs00').data.Dialog, layouts }, null, 2));
fs.writeFileSync(`${root}/tutorial-gameplay-evidence.json`, JSON.stringify({
  sources: [buildings, songs, targets, humans].map(({ source, sha256 }) => ({ source, sha256 })),
  studios, labels, sessionMusicians, loops, defaults, audio, voicePrefixes,
  limitations: ['Browser playback preserves source cue end boundaries and aligns bar lengths to song tempo. Original per-slice musician jitter and legacy Xtra DSP are not bit-exact.'],
}, null, 2));
const supplemental=[];
const previewDirectory=`${root}/media/mission34-audio`;
fs.mkdirSync(previewDirectory,{recursive:true});
for(const id of allowed.filter(id=>!['Sng01','Sng02','Sng10','Sng11','Sng17'].includes(id))){
 const source=`${cdRoot}/Sound/Music/${id.slice(3)}pre.wav`,bytes=fs.readFileSync(source),path=`media/mission34-audio/${id.toLowerCase()}-preview.wav`;
 fs.writeFileSync(`${root}/${path}`,bytes);
 const decoder='C:/Program Files/ImageMagick-7.1.1-Q16-HDRI/ffmpeg.exe';
 const decoded=spawnSync(decoder,['-v','error','-i',`${root}/${path}`,'-f','null','-'],{encoding:'utf8',timeout:30000});
 if(decoded.status!==0)throw new Error(`Preview decode failed ${source}: ${decoded.stderr}`);
 supplemental.push({key:`${id}Preview`,path,source,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length,decodeStatus:decoded.status});
}
const autoloadComparisons=[];
for(const number of ['03','04','05','06']){
 const source=`${cdRoot}/Data/M${number}.dat`;
 const decoded=decodeDirectorVList(source),retained=decodeDirectorVList(`.local/original-runtime/Plugins/Swedish/M${number}.dat`);
 const comparison={source,sha256:decoded.sha256,retainedSource:retained.source,retainedSHA256:retained.sha256,byteIdentical:decoded.sha256===retained.sha256,structureIdentical:JSON.stringify(decoded.data)===JSON.stringify(retained.data)};
 autoloadComparisons.push(comparison);
 fs.writeFileSync(`${root}/mission${number}-cd-autoload-evidence.json`,JSON.stringify(decoded,null,2));
}
const addedStems=audio.filter(a=>!previousAudio.has(a.file));
for(const stem of addedStems){
 const decoded=spawnSync('C:/Program Files/ImageMagick-7.1.1-Q16-HDRI/ffmpeg.exe',['-v','error','-i',`${audioDirectory}/${stem.file}`,'-f','null','-'],{encoding:'utf8',timeout:30000});
 if(decoded.status!==0)throw new Error(`Stem decode failed ${stem.file}: ${decoded.stderr}`);
}
fs.writeFileSync(`${root}/mission34-audio.json`,JSON.stringify({allowedSongs:allowed,previews:supplemental,autoloadComparisons,sourceMusicDirectory:sourceDirectory,stemCount:audio.length,
 stemDecodeVerification:{files:addedStems.map(a=>a.file),count:addedStems.length,decoder:'ffmpeg full decode to null',failures:0},
 rule:'All playable mission catalog song stems and every available original vocal variant copied byte-for-byte with source cue tables.'},null,2));
console.log(`Retained ${audio.length} original Ogg tracks, ${supplemental.length} new previews, all four studios/labels; compared native CD starts.`);
