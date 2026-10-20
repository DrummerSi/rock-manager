import fs from 'node:fs';
const data = JSON.parse(fs.readFileSync('src/generated/game-data.json', 'utf8'));
fs.mkdirSync('analysis/ui-review', { recursive: true });
fs.writeFileSync('analysis/ui-review/city-animations.html', `<!doctype html><html lang="en"><meta charset="utf-8"><title>Rock City animation review</title>
<style>body{background:#201320;color:#eee;font:16px Arial;margin:24px}canvas{max-width:100%;height:auto;image-rendering:pixelated}button{padding:8px 20px}</style>
<h1>Rock City: recovered animation layers</h1><p>This inspection preview shows all 25 building layers and 16 animation tracks. The playable mission only shows unlocked building layers. Frame order, pauses and registration points come from the original cast; movie configuration is 30 fps and animation steps occur every three ticks. Cars intentionally wait roughly 45 and 90 seconds.</p>
<canvas width="1200" height="420"></canvas><p><button id="pause">Pause animation</button></p><p id="status">Loading original graphics…</p>
<script>
const data=${JSON.stringify({ city: data.city, images: data.images })};
const canvas=document.querySelector('canvas'),ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;
const images=new Map();let playing=true,clock=0,last=0;
document.querySelector('#pause').onclick=()=>{playing=!playing;document.querySelector('#pause').textContent=playing?'Pause animation':'Resume animation';};
const tracks=data.city.tracks.map(track=>({track,cursor:0,delay:0,pause:0,offset:0}));
function tick(s){if(s.delay){s.delay--;return;}s.delay=2;if(s.pause){s.pause--;return;}const entry=s.track.sequence[s.cursor];s.offset=entry.offset;s.pause=entry.pause;s.cursor=(s.cursor+1)%s.track.sequence.length;}
function sprite(s){if(!s?.path)return;const image=images.get('city-sprite-'+s.name);if(image)ctx.drawImage(image,600-s.regX,210-s.regY);}
function render(now){const delta=last?Math.min(now-last,100):0;last=now;if(playing){clock+=delta;while(clock>=1000/data.city.movieFPS){clock-=1000/data.city.movieFPS;tracks.forEach(tick);}}
ctx.clearRect(0,0,1200,420);ctx.drawImage(images.get('city'),0,0);for(const b of data.city.buildings){sprite(b);const t=tracks.find(s=>s.track.placeId===b.name.toLowerCase());if(t)sprite(t.track.sequence.find(e=>e.offset===t.offset)?.sprite);}for(const t of tracks.filter(s=>!s.track.placeId))sprite(t.track.sequence.find(e=>e.offset===t.offset)?.sprite);requestAnimationFrame(render);}
const keys=new Set(['city',...data.city.buildings.filter(s=>s.path).map(s=>'city-sprite-'+s.name),...data.city.tracks.flatMap(t=>t.sequence.filter(s=>s.sprite?.path).map(s=>'city-sprite-'+s.sprite.name))]);
Promise.all([...keys].map(key=>new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>{images.set(key,image);resolve();};image.onerror=reject;image.src='../../public/assets/'+data.images[key];}))).then(()=>{document.querySelector('#status').textContent='Recovered graphics loaded. All layers enabled for inspection.';requestAnimationFrame(render);}).catch(()=>document.querySelector('#status').textContent='Open this file from the repository; its images are in public/assets.');
</script></html>`);
console.log('City animation review: analysis/ui-review/city-animations.html');
