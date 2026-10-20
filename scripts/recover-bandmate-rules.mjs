import fs from 'node:fs';
import crypto from 'node:crypto';
const base = 'analysis/original/data/';
const action = JSON.parse(fs.readFileSync(base + 'DataDBRest00.json')).data.Action;
const musicians = JSON.parse(fs.readFileSync(base + 'DataMusicians00.json')).data.RealMusician;
const categories = JSON.parse(fs.readFileSync(base + 'DataActionCategories00.json')).data.ActionCategory;
const row = (data, index) => Object.fromEntries(Object.entries(data).map(([key, value]) => [key, Array.isArray(value) ? value[index] : row(value, index)]));
const propList = value => Object.fromEntries([...value.matchAll(/#([A-Za-z0-9]+):\s*(-?[\d.]+)/g)].map(m => [m[1], Number(m[2])]));
const wanted = ['ActCatMusicianGifts', 'ActCatMusicianTrain', 'ActCatMusicianRelations', 'ActCatMusicianKick'];
const cats = categories.ID.map((id, i) => ({ id, name: categories.name[i], comment: categories.comment[i], graphics: categories.Gfx[i], actions: [...categories.Actions[i].matchAll(/#(\w+)/g)].map(m => m[1]) })).filter(c => wanted.includes(c.id));
const ids = new Set(cats.flatMap(c => c.actions));
const actions = action.ID.map((id, i) => row(action, i)).filter(a => ids.has(a.ID)).map(a => {
  const duration = a.PreExecuteThis.match(/SetTrainDuration\(me,\s*(\d+),\s*#(\w+)\)/);
  const modifier = a.ExecuteThis.match(/createmodifier\s*\(#Gift,0,#mood,([\d.]+),(\d+)\)/i);
  return { id: a.ID, name: a.name, description: a.comment.replace(/\u0096/g, '–'), graphics: a.Gfx, price: Number(a.price),
    duration: duration ? Number(duration[1]) : 0, trainingType: duration?.[2] ?? null,
    once: a.PreExecuteThis.includes('getOKToGive'), moodBoost: modifier ? Number(modifier[1]) : 0,
    boostDays: modifier ? Number(modifier[2]) : 0, sourceExecute: a.ExecuteThis, sourcePreExecute: a.PreExecuteThis };
});
const actors = musicians.ID.map((id, i) => {
  const m = row(musicians, i);
  return { id, graphics: m.Gfx, mood: Number(m.Mood.Current), health: Number(m.Health.Current), musicality: Number(m.Musicality.Current), charisma: Number(m.Charisma), patience: Number(m.Patience.Current), age: Number(m.Age), attitudes: propList(m.Attitudes.Attitudes), needs: propList(m.Needs.NeedsInitList) };
});
const mission = JSON.parse(fs.readFileSync(base + 'mission01-recovered.json')).mission;
const missionMusicians = [...mission.AvailableMusicians.matchAll(/#(\w+)/g)].map(m => m[1]);
const rules = { missionMusicians, categories: cats, actions, musicians: actors };
fs.writeFileSync('src/game/bandmate-rules.json', JSON.stringify(rules, null, 2) + '\n');
const paths = ['analysis/original/scripts/cd/Main.dxr/00016-DlgRehearsal01ArtistScript.lingo', 'analysis/original/scripts/installed/RockGeneral.cxt/00101-ClassRealMusicianScript.lingo', 'analysis/original/scripts/installed/RockGeneral.cxt/00069-ClassTrainingScript.lingo', 'analysis/original/scripts/installed/RockGeneral.cxt/00154-ModifierScript.lingo', 'analysis/original/scripts/installed/RockGeneral.cxt/00055-ClassNeedsScript.lingo', 'analysis/original/scripts/installed/RockGeneral.cxt/00054-ClassNeedScript.lingo', ...['00050-ClassNeedVacationScript', '00051-ClassNeedLiveScript', '00053-ClassNeedPartyScript', '00020-ClassDynamicTriggerVarScript', '00118-ConcertCalcs'].map(name => 'analysis/original/scripts/installed/RockGeneral.cxt/' + name + '.lingo'), ...['DataDBRest00', 'DataMusicians00', 'DataActionCategories00'].map(f => base + f + '.json')];
fs.writeFileSync('analysis/original/bandmate-rules-evidence.json', JSON.stringify({ method: 'Static original decoded Director tables and decompiled script evidence; never execute original expression strings.', sources: paths.map(path => ({ path, sha256: crypto.createHash('sha256').update(fs.readFileSync(path)).digest('hex') })), findings: { trainingBooking: 'Default starts current day + 2; completion at start + duration.', trainingBoost: 'Mood factor 1 + .2*(mood-.5), upper limit 1, native temporary modifiers fade linearly.', gifts: 'Physical gifts once per musician, attitude>=0 accepted; rejected costs money but adds no modifier.', booze: 'Deferred until ExitToCity; native Needs.satisfy sets Current to -amount*LoseFact, not subtracts from previous value. Native party/vacation LoseFact is zero, so reset to zero.', needs: 'NeedsInitList scales growth rate and maximum; initial current is zero. AutoXGain uses Current += .1*maximum*(1-Current/maximum). Need mood penalty exactly -.1*max(Current-.2,0); Vacation also applies same health penalty. No NeedDrugs exists in any of the 27 source musicians NeedsInitList, so native conditional drug-reset branch is a no-op for this recovered roster.', scope: 'No invented instrumental skill boost: music lessons change Musicality, not InstrumentalSkills.' }, rules }, null, 2) + '\n');
console.log(`Recovered ${actions.length} actions for ${actors.length} musicians.`);
