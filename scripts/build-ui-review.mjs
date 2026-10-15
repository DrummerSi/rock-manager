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
const openingScreens = ['fidelity-training-event','fidelity-hud-mood','fidelity-rehearsal-status','fidelity-signed-album-status','fidelity-singer-guidance','fidelity-name-guidance','bandmate-speaking','bandmate-gift','bandmate-training-calendar','bandmate-training-complete','venue-cafe','venue-book','venue-result','media-radio','media-press-kit','media-gifts','media-advert','media-store','media-news','media-magazine','media-review','media-store-promotion','media-sales-chart','activity-agenda', 'design-empty', 'design-studio', 'design-release', 'design-saved', 'tutorial-media', 'missions', 'tutorial-city', 'tutorial-rehearsal', 'tutorial-publisher', 'tutorial-studio',
  'tutorial-mixer', 'tutorial-label', 'demo-rejected', 'tutorial-retry', 'session-musician', 'contract-signed', 'mixer-controls-corrected', 'mixer-settings', 'mixer-settings-native-reference'];
for (const name of openingScreens) {
  if (fs.existsSync(`test-results/${name}.png`)) fs.copyFileSync(`test-results/${name}.png`, `${output}/${name}.png`);
  else if (!fs.existsSync(`${output}/${name}.png`)) throw new Error(`Missing review capture: ${name}`);
}
fs.writeFileSync(path.join(output, 'index.html'), `<!doctype html><html lang="en"><meta charset="utf-8">
<title>Rock Manager visual review</title><style>body{background:#202020;color:#eee;font:16px Arial;margin:30px;max-width:1700px}section{margin:40px 0}.pair{display:grid;grid-template-columns:1fr 1fr;gap:24px}figure{margin:0}img{max-width:100%;width:800px;height:auto}figcaption{margin:12px 0;color:#ccc}</style>
<h1>Rock Manager visual review</h1><p>Original references are the game's bundled help screenshots. They are cropped and reduced in resolution, and show different game states. Recreation screenshots are captured at 800×600. Targeted test runs refresh their captures; earlier verified captures are retained for other screens. Compare composition and controls; this is not a pixel-diff or proof of identical runtime rendering.</p>
<h2>Original Windows runtime comparison</h2><p>The user supplied 14 captures of the original game. Their executable and image digests have been checked. The full reference gallery is <a href="../original/runtime/reference/index.html">here</a>. These crops preserve the original 800×600 pixels and contain no audio. Bands, looping music and fader states differ; fixed regions are compared separately.</p>
<div class="pair"><figure><figcaption>Original mixer</figcaption><img src="../original/runtime/reference/stage/native-002.png"></figure><figure><figcaption>Recreated mixer</figcaption><img src="mixer-controls-corrected.png"></figure></div>
<div class="pair"><figure><figcaption>Original Corky Settings</figcaption><img src="../original/runtime/reference/stage/native-006.png"></figure><figure><figcaption>Recreated Corky Settings</figcaption><img src="mixer-settings-native-reference.png"></figure></div>
${screens.map((s) => `<section><h2>${s.title}</h2><div class="pair"><figure><figcaption>Original help reference</figcaption><img src="${s.original}"></figure><figure><figcaption>Recreation, captured in Edge</figcaption><img src="${s.current}"></figure></div></section>`).join('\n')}
<h2>Design Studio and release booking</h2><div class="pair"><figure><figcaption>Original cover designer</figcaption><img src="../original/runtime/reference/stage/native-012.png"></figure><figure><figcaption>Recreated cover designer (different band)</figcaption><img src="design-studio.png"></figure></div><div class="pair"><figure><figcaption>Original release booking</figcaption><img src="../original/runtime/reference/stage/native-013.png"></figure><figure><figcaption>Recreated release booking</figcaption><img src="design-release.png"></figure></div><h2>Venues and promotion</h2><p>Original venue and media captures use different dates, money, expressions and band members. The recreation uses source environments, registered neutral actor composites and source dialog layouts; dynamic text rasterization remains approximate.</p><div class="pair"><figure><figcaption>Original Café Lizette</figcaption><img src="../original/runtime/reference/stage/native-005.png"></figure><figure><figcaption>Recreated Café Lizette</figcaption><img src="venue-cafe.png"></figure></div><div class="pair"><figure><figcaption>Original Radio FM</figcaption><img src="../original/runtime/reference/stage/native-008.png"></figure><figure><figcaption>Recreated Radio FM</figcaption><img src="media-radio.png"></figure></div><div class="pair"><figure><figcaption>Original Record Store chart</figcaption><img src="../original/runtime/reference/stage/native-014.png"></figure><figure><figcaption>Recreated chart (different week)</figcaption><img src="media-sales-chart.png"></figure></div><h2>Mission01 opening and tutorial captures</h2><p>Recovered event-card text and trigger sequence; reconstructed layout. Opening/tutorial states still need matching original references.</p>
${openingScreens.map((name) => `<figure><figcaption>${name}</figcaption><img src="${name}.png"></figure>`).join('\n')}
<p>Playable through cover design, release, gigs, promotion and dated sales/charts. Remaining work includes the complete needs engine, further random media activities, legacy text rasterization, exact auto-layout metrics, animated office actors and advanced mixer DSP. Calendar controls below the city are prototype utilities.</p></html>`);
console.log(`Visual review: ${output}/index.html`);

