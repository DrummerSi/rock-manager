import fs from 'node:fs';
import path from 'node:path';
const output = 'analysis/ui-review';
fs.mkdirSync(output, { recursive: true });
const screens = [
  { title: 'Main menu', original: 'huvudmeny.jpg', current: 'main-menu.png' },
  { title: 'City header', original: 'staden.jpg', current: 'city.png' },
  { title: 'Band window and signed contract status', original: 'replokal.jpg', current: 'band-with-contract.png' },
  { title: 'Musician selection', original: 'artist_hire.jpg', current: 'recruitment.png' },
  { title: 'Recording studio', original: 'studio.jpg', current: 'studio.png' },
  { title: 'Mixer', original: 'mixer.jpg', current: 'mixer.png' },
  { title: 'Record label', original: 'skivbolag.jpg', current: 'label.png' },
  { title: 'Contract proposal', original: 'kontrakt.jpg', current: 'contract.png' },
];
for (const screen of screens) {
  fs.copyFileSync(path.join('E:/Games/Rock Manager/HelpfilesEng/pics', screen.original), path.join(output, screen.original));
  const capture = path.join('test-results', screen.current);
  if (fs.existsSync(capture)) fs.copyFileSync(capture, path.join(output, screen.current));
  else if (!fs.existsSync(path.join(output, screen.current))) throw new Error(`Missing review capture: ${screen.current}`);
}
const openingScreens = ['missions', 'tutorial-city', 'tutorial-rehearsal', 'tutorial-publisher', 'tutorial-studio',
  'tutorial-mixer', 'tutorial-label', 'demo-rejected', 'tutorial-retry', 'session-musician', 'contract-signed', 'mixer-controls-corrected', 'mixer-settings'];
for (const name of openingScreens) {
  if (fs.existsSync(`test-results/${name}.png`)) fs.copyFileSync(`test-results/${name}.png`, `${output}/${name}.png`);
  else if (!fs.existsSync(`${output}/${name}.png`)) throw new Error(`Missing review capture: ${name}`);
}
fs.writeFileSync(path.join(output, 'index.html'), `<!doctype html><html lang="en"><meta charset="utf-8">
<title>Rock Manager visual review</title><style>body{background:#202020;color:#eee;font:16px Arial;margin:30px;max-width:1700px}section{margin:40px 0}.pair{display:grid;grid-template-columns:1fr 1fr;gap:24px}figure{margin:0}img{max-width:100%;width:800px;height:auto}figcaption{margin:12px 0;color:#ccc}</style>
<h1>Rock Manager visual review</h1><p>Original references are the game's bundled help screenshots. They are cropped and reduced in resolution, and show different game states. Recreation screenshots are captured at 800×600. Targeted test runs refresh their captures; earlier verified captures are retained for other screens. Compare composition and controls; this is not a pixel-diff or proof of identical runtime rendering.</p>
${screens.map((s) => `<section><h2>${s.title}</h2><div class="pair"><figure><figcaption>Original help reference</figcaption><img src="${s.original}"></figure><figure><figcaption>Recreation, captured in Edge</figcaption><img src="${s.current}"></figure></div></section>`).join('\n')}
<h2>Mission01 opening and tutorial captures</h2><p>Recovered event-card text and trigger sequence; reconstructed layout. Matching original runtime screenshots are still needed.</p>
${openingScreens.map((name) => `<figure><figcaption>${name}</figcaption><img src="${name}.png"></figure>`).join('\n')}
<p>Playable through a signed record contract. Remaining work includes cover design/release, gigs, sales/charts, legacy text rasterization, exact auto-layout metrics, animated office actors and advanced mixer DSP. Calendar controls below the city are prototype utilities.</p></html>`);
console.log(`Visual review: ${output}/index.html`);

