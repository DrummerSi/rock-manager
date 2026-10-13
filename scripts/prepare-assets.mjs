import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

const root = path.resolve('analysis/original');
const fixture = JSON.parse(fs.readFileSync(path.join(root, 'data/mission01-recovered.json'), 'utf8'));
const media = JSON.parse(fs.readFileSync(path.join(root, 'media-manifest.json'), 'utf8'));
const destination = path.resolve('public/assets');
fs.mkdirSync(destination, { recursive: true });
fs.mkdirSync('src/generated', { recursive: true });
const images = {};
const provenance = [];
const rawUi = JSON.parse(fs.readFileSync(path.join(root, 'ui-raw-bitmaps.json'), 'utf8')).recovered;
const cityEvidence = JSON.parse(fs.readFileSync(path.join(root, 'city-animation-evidence.json'), 'utf8'));
const tutorialMedia = JSON.parse(fs.readFileSync(path.join(root, 'tutorial-media-evidence.json'), 'utf8')).recovered;
const tutorialGameplay = JSON.parse(fs.readFileSync(path.join(root, 'tutorial-gameplay-evidence.json'), 'utf8'));
for (const entry of tutorialMedia) {
  const key = entry.name.replaceAll(' ', '_').toLowerCase();
  const filename = `${key}.png`;
  fs.copyFileSync(path.join(root, entry.path), path.join(destination, filename));
  images[key] = filename;
  provenance.push({ key, ...entry, importRule: 'Retained original BITD decode; tutorial-media-evidence.json' });
}
const tutorialIcons = { mixer: 'icon_mixer02', 'mixer-title': 'icon_mixer01', recorder: 'icon_recorder02', preview: 'icon_recorder01', 'golden-record': 'icon_golden_record02', contract: 'icon_paragraph02', money: 'icon_money02' };
for (const [key, name] of Object.entries(tutorialIcons)) {
  images[`ui-${key}`] = images[name];
}
fs.mkdirSync(path.join(destination, 'music'), { recursive: true });
for (const audio of tutorialGameplay.audio) fs.copyFileSync(path.join(root, 'media/tutorial-audio', audio.file), path.join(destination, 'music', audio.file));
const cityFrame = JSON.parse(fs.readFileSync(path.join(root, 'city-frame-evidence.json'), 'utf8'));
for (const mask of cityFrame.masks) {
  const raw = Buffer.from(mask.rawHex, 'hex');
  const bytes = [];
  if (mask.encoding === 'raw') bytes.push(...raw);
  else for (let offset = 0; offset < raw.length;) {
    const count = raw[offset++];
    if (count < 128) for (let i = 0; i <= count; i++) bytes.push(raw[offset++]);
    else if (count > 128) {
      const value = raw[offset++];
      for (let i = 0; i < 257 - count; i++) bytes.push(value);
    }
  }
  if (bytes.length !== mask.stride * mask.height) throw new Error(`Invalid city mask: ${mask.key}`);
  const png = new PNG({ width: mask.width, height: mask.height });
  for (let y = 0; y < mask.height; y++) for (let x = 0; x < mask.width; x++) {
    const black = (bytes[y * mask.stride + (x >> 3)] >> (7 - (x & 7))) & 1;
    const index = (y * mask.width + x) * 4;
    png.data[index] = png.data[index + 1] = png.data[index + 2] = 0;
    png.data[index + 3] = black ? 255 : 0;
  }
  const filename = `${mask.key}.png`;
  fs.writeFileSync(path.join(destination, filename), PNG.sync.write(png));
  images[mask.key] = filename;
  provenance.push({ key: mask.key, memberChunkId: mask.memberId, source: cityFrame.source,
    sourceSha256: cityFrame.sourceSHA256, importRule: 'Recovered one-bit BITD, white matte transparent; city-frame-evidence.json' });
}

function select(key, name, width) {
  const entry = media.find((x) => x.originalMemberName?.toLowerCase() === name.toLowerCase()
    && x.path.endsWith('.png') && (!width || x.width === width));
  if (!entry) throw new Error(`Missing recovered asset: ${name}`);
  const filename = `${key}.png`;
  const sourcePath = path.join(root, entry.path);
  const raw = rawUi.find((r) => r.name.toLowerCase() === name.toLowerCase());
  if (raw) {
    const png = new PNG({ width: raw.width, height: raw.height });
    const bytes = Buffer.from(raw.rawHex, 'hex');
    for (let y = 0; y < raw.height; y++) for (let x = 0; x < raw.width; x++) {
      const index = (y * raw.width + x) * 4;
      if (raw.depth === 32) {
        const offset = y * raw.stride + x * 4;
        png.data[index] = bytes[offset + 1]; png.data[index + 1] = bytes[offset + 2];
        png.data[index + 2] = bytes[offset + 3]; png.data[index + 3] = bytes[offset];
        if (png.data[index] === 255 && png.data[index + 1] === 255 && png.data[index + 2] === 255) png.data[index + 3] = 0;
        continue;
      }
      const pixel = bytes.readUInt16BE(y * raw.stride + x * 2);
      png.data[index] = Math.floor(((pixel >> 10) & 31) * 255 / 31);
      png.data[index + 1] = Math.floor(((pixel >> 5) & 31) * 255 / 31);
      png.data[index + 2] = Math.floor((pixel & 31) * 255 / 31);
      png.data[index + 3] = (pixel & 0x7fff) === 0x7fff ? 0 : 255;
    }
    fs.writeFileSync(path.join(destination, filename), PNG.sync.write(png));
  } else if (key === 'hud') {
    // InterfaceBarScript uses Director ink=0 (opaque copy). The decoder
    // preserves an unused all-zero alpha byte; browsers require alpha=255.
    const png = PNG.sync.read(fs.readFileSync(sourcePath));
    for (let i = 3; i < png.data.length; i += 4) png.data[i] = 255;
    fs.writeFileSync(path.join(destination, filename), PNG.sync.write(png));
  } else if (/^(panel|dialog|inner|city-sprite)-/.test(key)) {
    const png = PNG.sync.read(fs.readFileSync(sourcePath));
    // The surround tiles have a white matte, used as a color key by Director.
    for (let i = 0; i < png.data.length; i += 4) {
      if (png.data[i] === 255 && png.data[i + 1] === 255 && png.data[i + 2] === 255) png.data[i + 3] = 0;
    }
    fs.writeFileSync(path.join(destination, filename), PNG.sync.write(png));
  } else fs.copyFileSync(sourcePath, path.join(destination, filename));
  images[key] = filename;
  provenance.push({ key, ...entry, importRule: raw ? `Retained raw BITD interleaved ${raw.depth}-bit; ui-raw-bitmaps.json` : key === 'hud' ? 'Director opaque copy ink' : /^(panel|dialog|inner)-/.test(key) ? 'white matte color key' : 'unchanged recovered PNG' });
}

select('city', 'city_background01');
const citySprites = [...cityEvidence.buildings, ...cityEvidence.tracks.flatMap((t) => t.sequence.map((s) => s.sprite).filter(Boolean))];
for (const sprite of new Map(citySprites.filter((s) => s.path).map((s) => [s.name, s])).values()) select(`city-sprite-${sprite.name}`, sprite.name);
const cursors = Object.fromEntries(JSON.parse(fs.readFileSync(path.join(root, 'city-cursor-evidence.json'), 'utf8')).cursors.map((c) => {
  const filename = `${c.name.replaceAll(' ', '_')}.png`;
  fs.copyFileSync(path.join(root, c.path), path.join(destination, filename));
  const kind = c.name.includes('inactive') ? 'default' : c.name.includes('enter') ? 'building' : 'active';
  return [kind, { file: filename, x: c.hotspotX, y: c.hotspotY }];
}));
select('hud', 'interface main01', 800);
select('city-frame-bottom', 'main interface01', 722);
select('logo', 'main menu rocklogo01');
select('rehearsal', 'replokalsikon01');
select('room', 'instrumentpos_background01');
select('room-portraits', 'instrumentpos_portrait_frames01');
select('musician-paper', 'background_paper01');
select('musician-frame', 'portrait_frame_large01');
select('portrait-empty', 'portrait_empty01');
select('portrait-studio-musician', 'portrait_actor00', 93);
select('portrait_actorempty_small', 'portrait_actorEmpty_small');
select('header-menu', 'interface main menu icon01');
select('header-band', 'CPicon_bandchoice01');
select('meter-bg', 'meter01_background01');
select('meter-fill', 'meter01_line01');
select('scroll-up', 'RockScrollArrowUp');
select('scroll-down', 'RockScrollArrowDown');
select('scroll-thumb', 'RockScrollBarPic');
select('small-arrow-up', 'RockSmallArrowUp');
select('small-arrow-down', 'RockSmallArrowDown');
for (const [key, name] of Object.entries({ accept: 'icon_accept01', cancel: 'icon_cancel01', rename: 'icon_text01', effect: 'icon_effect01', globe: 'icon_globe01', skull: 'icon_skull01', megaphone: 'icon_megaphone01', microphone: 'icon_microphone01', note: 'icon_note01', garbage: 'icon_garbage can01', cd: 'icon_cd02',
  guitar: 'icon_guitar02', bass: 'icon_bass guitar02', drums: 'icon_drums02', keyboards: 'icon_keyboard02', vocals: 'icon_microphone02' })) {
  const found = media.find((m) => m.originalMemberName?.toLowerCase() === name.toLowerCase());
  if (found) select(`ui-${key}`, found.originalMemberName);
}
const uiMetadata = JSON.parse(fs.readFileSync(path.join(root, 'ui-layout-recovery.json'), 'utf8'));
const instrumentSprites = uiMetadata.filter((m) => m.name?.startsWith('instrumentpos_') && m.regX !== undefined
  && !['instrumentpos_background01', 'instrumentpos_portrait_frames01'].includes(m.name));
for (const sprite of instrumentSprites) select(sprite.name, sprite.name);
for (const side of ['TL', 'TR', 'BL', 'BR', 'T', 'B', 'L', 'R']) select(`button-${side}`, `RockButtonEdge${side}`);
for (const side of ['TL', 'TR', 'BL', 'BR', 'T', 'B', 'L', 'R']) select(`panel-${side}`, `RockSrndEdge${side}`);
for (const side of ['TL', 'TR', 'BL', 'BR', 'T', 'B', 'L', 'R']) {
  select(`dialog-${side}`, `RockDialogEdge${side}`);
  select(`inner-${side}`, `RockFrame2Edge${side}`);
}
for (const side of ['TL', 'TR', 'BL', 'BR']) select(`button-dark-${side}`, `RockButtonDarkEdge${side}`);

const musicians = fixture.availableMusicians.map((m) => {
  select(`portrait-${m.ID}`, `Portrait_${m.Gfx}_normal_Large`);
  select(`icon-${m.ID}`, `Portrait_${m.Gfx}_normal_Medium`);
  select(`portrait_${m.Gfx.toLowerCase()}_small`, `portrait_${m.Gfx}_small`);
  const pose = media.find((x) => x.originalMemberName?.toLowerCase() === `pose_${m.Gfx}_06z`.toLowerCase())
    ?? media.find((x) => x.originalMemberName?.toLowerCase() === `pose_${m.Gfx}_06`.toLowerCase());
  if (pose) select(`pose-${m.ID}`, pose.originalMemberName);
  const skills = Object.fromEntries(Object.entries(m.InstrumentalSkills).map(([key, val]) => [key, Number(val)]));
  const genres = Object.entries(m.MusicStyle).sort((a, b) => Number(b[1]) - Number(a[1]));
  return {
    id: m.ID, name: m.name, age: Number(m.Age), salary: Number(m.WantedSalary),
    description: m.comment, genre: genres[0][0], musicality: Number(m.Musicality.Current),
    style: Object.fromEntries(Object.entries(m.MusicStyle).map(([key, value]) => [key, Number(value)])),
    smallPortrait: `portrait_${m.Gfx.toLowerCase()}_small`,
    mood: Number(m.Mood?.Current ?? 0.65), health: Number(m.Health?.Current ?? 1), charisma: Number(m.Charisma?.Current ?? m.Charisma ?? 0), skills, instrumentGraphics: m.InstrumentGFX ?? {},
  };
});
fs.copyFileSync(path.join(root, 'media/audio-sample/CityAmbience01.wav'), path.join(destination, 'city-ambience.wav'));
const songTable = JSON.parse(fs.readFileSync(path.join(root, 'data/DataSongs00.json'), 'utf8')).data.Song;
const allowedSongs = fixture.mission.AvailableSongs.match(/Sng\d+/g);
const songs = songTable.ID.flatMap((id, i) => allowedSongs.includes(id) ? [{ id, name: songTable.name[i],
  description: songTable.comment[i], genre: songTable.Genre[i], price: Number(songTable.PriceModel.BasePrice[i]),
  royalty: Number(songTable.PriceModel.Royalty[i]), quality: Number(songTable.quality[i]) }] : []);
const gameData = {
  city: cityEvidence, cityFrame: cityFrame.masks.map(({ key, x, y }) => ({ key, x, y })), cursors,
  tutorialGameplay, tutorialMedia: tutorialMedia.map(({ name, width, height, regX, regY }) => ({ key: name.replaceAll(' ', '_').toLowerCase(), width, height, regX, regY })),
  iconRegistrations: Object.fromEntries([...provenance.filter((p) => p.key.startsWith('ui-')).map((p) => [p.key.slice(3),
    JSON.parse(fs.readFileSync(path.join(root, 'ui-icon-registrations.json'), 'utf8')).registrations.find((r) => r.name === p.originalMemberName) ?? { regX: 0, regY: 0 }]),
    ...Object.entries(tutorialIcons).map(([key, name]) => [key, tutorialMedia.find((m) => m.name.replaceAll(' ', '_').toLowerCase() === name)])]),
  mission: { id: 'Mission01', name: fixture.mission.name, startMoney: Number(fixture.mission.StartMoney),
    intro: fixture.mission.IntroText.replaceAll('\\n', '\n'),
    objectives: ['Put a band together', 'Get a song license', 'Record a demo', 'Sign a record contract', 'Make the Top 10'] },
  musicians, songs, images, missions: JSON.parse(fs.readFileSync(path.join(root, 'data/missions.json'), 'utf8')).missions.filter((m) => m.name).map((m) => ({ id: m.ID, name: m.name })),
  tutorials: JSON.parse(fs.readFileSync(path.join(root, 'opening-ui-evidence.json'), 'utf8')).cards,
  menuText: JSON.parse(fs.readFileSync(path.join(root, 'opening-ui-evidence.json'), 'utf8')).menuText,
  instrumentSprites: instrumentSprites.map(({ name, regX, regY }) => ({ name, regX, regY })),
  hotspots: [...fs.readFileSync(path.join(root, 'data/city-hotspots.txt'), 'utf8')
    .matchAll(/#(\w+)\s*:\s*rect\((\d+),\s*(\d+),\s*(\d+),\s*(\d+)\)/g)]
    .map((m) => ({ id: m[1], rect: m.slice(2).map(Number) })),
};
fs.writeFileSync('src/generated/game-data.json', JSON.stringify(gameData, null, 2));
fs.writeFileSync(path.join(destination, 'provenance.json'), JSON.stringify(provenance, null, 2));
console.log(`Prepared ${Object.keys(images).length} original images, ${musicians.length} musicians and one audio track.`);
