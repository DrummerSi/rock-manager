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

function select(key, name, width) {
  const entry = media.find((x) => x.originalMemberName?.toLowerCase() === name.toLowerCase()
    && x.path.endsWith('.png') && (!width || x.width === width));
  if (!entry) throw new Error(`Missing recovered asset: ${name}`);
  const filename = `${key}.png`;
  const sourcePath = path.join(root, entry.path);
  if (key === 'hud') {
    // InterfaceBarScript uses Director ink=0 (opaque copy). The decoder
    // preserves an unused all-zero alpha byte; browsers require alpha=255.
    const png = PNG.sync.read(fs.readFileSync(sourcePath));
    for (let i = 3; i < png.data.length; i += 4) png.data[i] = 255;
    fs.writeFileSync(path.join(destination, filename), PNG.sync.write(png));
  } else if (key.startsWith('panel-')) {
    const png = PNG.sync.read(fs.readFileSync(sourcePath));
    // The surround tiles have a white matte, used as a color key by Director.
    for (let i = 0; i < png.data.length; i += 4) {
      if (png.data[i] === 255 && png.data[i + 1] === 255 && png.data[i + 2] === 255) png.data[i + 3] = 0;
    }
    fs.writeFileSync(path.join(destination, filename), PNG.sync.write(png));
  } else fs.copyFileSync(sourcePath, path.join(destination, filename));
  images[key] = filename;
  provenance.push({ key, ...entry, importRule: key === 'hud' ? 'Director opaque copy ink' : key.startsWith('panel-') ? 'white matte color key' : 'unchanged recovered PNG' });
}

select('city', 'city_background01');
select('hud', 'interface main01', 800);
select('logo', 'main menu rocklogo01');
select('rehearsal', 'replokalsikon01');
for (const side of ['TL', 'TR', 'BL', 'BR', 'T', 'B', 'L', 'R']) select(`button-${side}`, `RockButtonEdge${side}`);
for (const side of ['TL', 'TR', 'BL', 'BR', 'T', 'B', 'L', 'R']) select(`panel-${side}`, `RockSrndEdge${side}`);

const musicians = fixture.availableMusicians.map((m) => {
  select(`portrait-${m.ID}`, `Portrait_${m.Gfx}_normal_Large`);
  select(`icon-${m.ID}`, `Portrait_${m.Gfx}_normal_Medium`);
  const pose = media.find((x) => x.originalMemberName?.toLowerCase() === `pose_${m.Gfx}_06z`.toLowerCase())
    ?? media.find((x) => x.originalMemberName?.toLowerCase() === `pose_${m.Gfx}_06`.toLowerCase());
  if (pose) select(`pose-${m.ID}`, pose.originalMemberName);
  const skills = Object.fromEntries(Object.entries(m.InstrumentalSkills).map(([key, val]) => [key, Number(val)]));
  const genres = Object.entries(m.MusicStyle).sort((a, b) => Number(b[1]) - Number(a[1]));
  return {
    id: m.ID, name: m.name, age: Number(m.Age), salary: Number(m.WantedSalary),
    description: m.comment, genre: genres[0][0], musicality: Number(m.Musicality.Current),
    mood: Number(m.Mood?.Current ?? 0.65), health: Number(m.Health?.Current ?? 1), skills,
  };
});
fs.copyFileSync(path.join(root, 'media/audio-sample/CityAmbience01.wav'), path.join(destination, 'city-ambience.wav'));
const gameData = {
  mission: { id: 'Mission01', name: fixture.mission.name, startMoney: Number(fixture.mission.StartMoney),
    intro: fixture.mission.IntroText.replaceAll('\\n', '\n'),
    objectives: ['Put a band together', 'Get a song license', 'Record a demo', 'Sign a record contract', 'Make the Top 10'] },
  musicians, images,
  hotspots: [...fs.readFileSync(path.join(root, 'data/city-hotspots.txt'), 'utf8')
    .matchAll(/#(\w+)\s*:\s*rect\((\d+),\s*(\d+),\s*(\d+),\s*(\d+)\)/g)]
    .map((m) => ({ id: m[1], rect: m.slice(2).map(Number) })),
};
fs.writeFileSync('src/generated/game-data.json', JSON.stringify(gameData, null, 2));
fs.writeFileSync(path.join(destination, 'provenance.json'), JSON.stringify(provenance, null, 2));
console.log(`Prepared ${Object.keys(images).length} original images, ${musicians.length} musicians and one audio track.`);
