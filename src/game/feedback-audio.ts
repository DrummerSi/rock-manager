import videoRules from './video-rules.json';
import evidence from '../generated/feedback-audio.json';
import { audioData } from './audio-data';

export interface FeedbackAudioSource { key: string; path: string }

// Director keeps speech, independent effects and place ambience separately.
export class FeedbackAudio {
  private entries = new Map<string, FeedbackAudioSource>(evidence.recovered.map(entry=>[entry.key.toLowerCase(),entry]));
  private context?: AudioContext;
  private cache = new Map<string, Promise<AudioBuffer>>();
  private active?: AudioBufferSourceNode;
  private sources = new Set<AudioBufferSourceNode>();
  private analyser?: AnalyserNode;
  private output?: GainNode;
  private place?: AudioBufferSourceNode;
  private placeKey = '';
  private placeGeneration = 0;
  private effectGeneration = 0;
  private generation = 0;
  private muted = false;
  private voice = { key: '', startedAt: 0, duration: 0 };
  private last = { key: '', status: 'idle', rms: 0, error: '' };
  /** Additional recovered originals use the same prepared feedback asset path. */
  registerSources(entries: readonly FeedbackAudioSource[]) { for(const entry of entries)this.entries.set(entry.key.toLowerCase(),entry); }
  get diagnostics() {
    const samples = new Float32Array(this.analyser?.fftSize ?? 0);
    this.analyser?.getFloatTimeDomainData(samples);
    let energy = 0; for (const sample of samples) energy += sample * sample;
    return { ...this.last, outputRms: samples.length ? Math.sqrt(energy / samples.length) : 0,
      context: this.context?.state ?? 'uncreated', playing: Boolean(this.active), place: this.placeKey, placePlaying: Boolean(this.place) };
  }
  get playback() { return { key: this.voice.key, playing: Boolean(this.active), startedAt:this.voice.startedAt, duration:this.voice.duration,
    positionSeconds: this.active ? Math.max(0, Math.min(this.voice.duration, (this.context?.currentTime ?? 0) - this.voice.startedAt)) : 0 }; }
  unlock() {
    this.context ??= new AudioContext();
    if (!this.analyser) { this.analyser = this.context.createAnalyser(); this.output = this.context.createGain(); this.output.gain.value = this.muted ? 0 : 1; this.analyser.connect(this.output).connect(this.context.destination); }
    void this.context.resume().catch(error => { this.last.error = String(error); });
  }
  setMuted(value: boolean) { this.muted = value; if (this.output) this.output.gain.value = value ? 0 : 1; }
  stop() { this.generation++; if (this.active) { try { this.active.stop(); } catch { /* Already ended. */ } } this.active = undefined; this.voice.key = ''; this.last.status = 'stopped'; }
  stopPlace() { this.placeGeneration++; if (this.place) { try { this.place.stop(); } catch { /* Already ended. */ } } this.place=undefined; this.placeKey=''; }
  /** Source DlgRockAncestor requests one non-looping PlaceID sound; absent files are silence. */
  async playPlace(key: string | null) {
    if (key === this.placeKey) return;
    this.stopPlace();
    if (!key || !this.entries.has(key.toLowerCase())) return;
    this.placeKey=key; this.unlock(); const generation=this.placeGeneration;
    try {
      const buffer=await this.load(key);
      if(generation!==this.placeGeneration)return;
      const source=this.context!.createBufferSource(),gain=this.context!.createGain();
      source.buffer=buffer; gain.gain.value=evidence.volumeDefaults.placeAmbience/100;
      source.connect(gain).connect(this.analyser!); this.place=source;this.sources.add(source);
      source.onended=()=>{this.sources.delete(source);gain.disconnect();source.disconnect();if(this.place===source)this.place=undefined;};
      source.start();
    } catch(error) {if(generation===this.placeGeneration){this.placeKey='';this.last.error=String(error);}}
  }
  private load(key: string): Promise<AudioBuffer> {
    const entry=this.entries.get(key.toLowerCase());
    if(!entry)return Promise.reject(new Error(`Missing recovered audio: ${key}`));
    let pending=this.cache.get(entry.key);
    if(!pending){pending=audioData(`feedback/${entry.path.split('/').at(-1)}`)
      .then(buffer=>this.context!.decodeAudioData(buffer)).catch(error=>{this.cache.delete(entry.key);throw error;});this.cache.set(entry.key,pending);}
    return pending;
  }
  async play(key: string, effect = false, normalizedGain?: number) {
    if (this.muted || !key) return;
    this.unlock();
    if (!effect) this.stop();
    const generation = effect ? this.effectGeneration : this.generation;
    const entry = this.entries.get(key.toLowerCase());
    if (!entry) return;
    this.last = { key, status: 'loading', rms: 0, error: '' };
    try {
      const buffer = await this.load(key);
      if (generation !== (effect ? this.effectGeneration : this.generation)) return;
      const source = this.context!.createBufferSource(), gain = this.context!.createGain();
      source.buffer = buffer; gain.gain.value = normalizedGain === undefined
        ? (effect ? entry.key === evidence.ui.dateTick ? evidence.volumeDefaults.dateTick : evidence.volumeDefaults.effects : evidence.volumeDefaults.speech) / 100
        : Math.max(0,Math.min(1,normalizedGain));
      source.connect(gain).connect(this.analyser!);
      const samples = buffer.getChannelData(0);
      let energy = 0; for (const sample of samples) energy += sample * sample;
      this.last = { key, status: 'playing', rms: Math.sqrt(energy / samples.length), error: '' };
      if (!effect) { this.active = source; this.voice = { key:entry.key, startedAt: this.context!.currentTime, duration: buffer.duration }; }
      this.sources.add(source);
      source.onended = () => { this.sources.delete(source); gain.disconnect(); source.disconnect(); if (this.active === source) { this.active = undefined; this.last.status = 'ended'; } };
      source.start();
    } catch (error) { if(generation===(effect?this.effectGeneration:this.generation))this.last = { key, status: 'failed', rms: 0, error: String(error) }; }
  }
  choose(keys: readonly string[]) { if (keys.length) void this.play(keys[Math.floor(Math.random() * keys.length)]); }
  template(template: string) {
    const variable = /[xyz]$/i.test(template), max = /z$/i.test(template) ? 5 : /y$/i.test(template) ? 3 : 2;
    const prefix = variable ? template.slice(0, -1).toLowerCase() : template.toLowerCase();
    const keys = [...this.entries.values()].filter(entry => variable
      ? entry.key.toLowerCase().startsWith(prefix) && /^[1-5]$/.test(entry.key.slice(prefix.length)) && Number(entry.key.slice(prefix.length)) <= max
      : entry.key.toLowerCase() === prefix).map(entry => entry.key);
    this.choose(keys);
  }
  greeting(id: string, mood = .5) {
    const cue = evidence.semanticCues[id as keyof typeof evidence.semanticCues]??(id==='Media01'?videoRules.speech:undefined);
    if (cue) this.choose(mood < .35 ? cue.greeting.Angry : mood >= .65 ? cue.greeting.Happy : cue.greeting.normal);
  }
  labelSpeech(id:string,kind:'contractGreeting'|'contract'|'nextContract') {
    const cue=evidence.semanticCues[id as keyof typeof evidence.semanticCues];
    if(cue&&kind in cue)this.choose((cue as unknown as Record<string,{Happy:string[]}>)[kind].Happy);
  }
  gift(id: string, amount: number, kit: boolean) {
    const cue = evidence.semanticCues[id as keyof typeof evidence.semanticCues]??(id==='Media01'?videoRules.speech:undefined);
    if (cue && 'gift' in cue) this.choose(kit ? cue.pressKit : amount <= -.2 ? cue.gift.BribeHi : amount < 0 ? cue.gift.BribeLo : cue.gift.otherwise);
  }
  concert(venue: string, satisfaction: number, fill: number) {
    const band = (n: number) => n < .25 ? 1 : n < .75 ? 2 : 3;
    const candidates = evidence.crowd.filter(c => c.satisfactionBand === band(satisfaction) && c.audienceBand === band(fill));
    const cue = candidates.find(c => c.venue === venue) ?? candidates.find(c => c.venue === null);
    if (cue) void this.play(cue.key);
  }
  destroy() { this.stop(); this.stopPlace(); this.effectGeneration++; for(const source of this.sources){try{source.stop();}catch{/* Already ended. */}}this.sources.clear();this.setMuted(true);void this.context?.close(); }
}
