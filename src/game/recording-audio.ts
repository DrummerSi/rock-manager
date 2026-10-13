import { defaultEffects } from './recording';
import type { MixChannel } from './recording';

/** Original stems on one musical clock. Legacy musician jitter and Xtra DSP are not bit-exact. */
export class RecordingAudio {
  private context?: AudioContext | OfflineAudioContext;
  private buffers = new Map<string, AudioBuffer>();
  private tracks: { index: number; filename: string; duration: number; source: AudioBufferSourceNode; gain: GainNode; pan: StereoPannerNode;
    delay: DelayNode; feedback: GainNode; dry: GainNode; wet: GainNode;
    shiftDelay: DelayNode; shiftDry: GainNode; shiftWet: GainNode; phaseWet: GainNode;
    lfo: OscillatorNode; depth: GainNode; phaseLfo: OscillatorNode; phaseDepth: GainNode; nodes: AudioNode[] }[] = [];
  private generation = 0;
  private master = 0.5;
  private bpm = 120;
  private previewChannel: number | null = null;
  playing = false;
  constructor(context?: AudioContext | OfflineAudioContext) { this.context = context; }
  get diagnostics() { return { mode: this.previewChannel === null ? 'mix' : 'instrument', tracks: this.tracks.map((t) => ({ channel: t.index, file: t.filename, duration: t.duration, loop: t.source.loop })) }; }

  async play(channels: MixChannel[], filenames: (string | null)[], bpm = 120, options: { previewChannel?: number; bars?: number; beatsPerBar?: number; sourceEnds?: (number | null)[] } = {}): Promise<boolean> {
    this.stop();
    this.previewChannel = options.previewChannel ?? null;
    this.bpm = bpm;
    const generation = this.generation;
    const context = this.context ??= new AudioContext();
    if (context instanceof AudioContext) await context.resume();
    const buffers = await Promise.all(filenames.map(async (filename) => {
      if (!filename) return null;
      if (!this.buffers.has(filename)) {
        const response = await fetch(`${import.meta.env.BASE_URL}assets/music/${filename}`);
        if (!response.ok) throw new Error(`Unable to load track ${filename}.`);
        this.buffers.set(filename, await context.decodeAudioData(await response.arrayBuffer()));
      }
      return this.buffers.get(filename)!;
    }));
    if (generation !== this.generation) return false;
    const start = context.currentTime + 0.05;
    this.tracks = buffers.flatMap((buffer, index) => {
      if (!buffer) return [];
      const source = context.createBufferSource(), gain = context.createGain(), pan = context.createStereoPanner();
      source.buffer = buffer; source.loop = this.previewChannel === null;
      const duration = (options.bars ?? 8) * (options.beatsPerBar ?? 4) * 60 / bpm;
      // Director renders every loop to its bar count and BPM before the sequencer starts.
      // Trim encoder padding and use the same period for all channels.
      const sourceEnd = Math.min(buffer.duration, options.sourceEnds?.[index] ?? buffer.duration);
      source.loopStart = 0; source.loopEnd = sourceEnd;
      source.playbackRate.value = sourceEnd / duration;
      const delay = context.createDelay(2), feedback = context.createGain(), dry = context.createGain(), wet = context.createGain(), bus = context.createGain();
      source.connect(dry).connect(bus); source.connect(delay).connect(wet).connect(bus); delay.connect(feedback).connect(delay);
      const shiftDelay = context.createDelay(0.1), shiftDry = context.createGain(), shiftWet = context.createGain(), phaseWet = context.createGain(), shiftBus = context.createGain();
      bus.connect(shiftDry).connect(shiftBus); bus.connect(shiftDelay).connect(shiftWet).connect(shiftBus);
      const lfo = context.createOscillator(), depth = context.createGain();
      lfo.connect(depth).connect(shiftDelay.delayTime); lfo.start(start);
      const phaseLfo = context.createOscillator(), phaseDepth = context.createGain();
      phaseLfo.connect(phaseDepth); phaseLfo.start(start);
      const filters = [500, 900, 1600, 2300].map((frequency) => { const f = context.createBiquadFilter(); f.type = 'allpass'; f.frequency.value = frequency; phaseDepth.connect(f.frequency); return f; });
      bus.connect(filters[0]); for (let i = 1; i < filters.length; i++) filters[i - 1].connect(filters[i]);
      filters[filters.length - 1].connect(phaseWet).connect(shiftBus);
      shiftBus.connect(gain).connect(pan).connect(context.destination);
      if (source.loop) source.start(start); else source.start(start, 0, sourceEnd);
      if (!source.loop) source.onended = () => { if (generation === this.generation) this.stop(); };
      return [{ index, filename: filenames[index]!, duration, source, gain, pan, delay, feedback, dry, wet, shiftDelay, shiftDry, shiftWet, phaseWet, lfo, depth, phaseLfo, phaseDepth,
        nodes: [delay, feedback, dry, wet, bus, shiftDelay, shiftDry, shiftWet, phaseWet, shiftBus, lfo, depth, phaseLfo, phaseDepth, ...filters] }];
    });
    this.playing = true; this.update(channels);
    return true;
  }

  update(channels: MixChannel[], master = this.master): void {
    this.master = master;
    this.tracks.forEach((track) => {
      const channel = channels[track.index];
      // FX preview renders the instrument directly, independently of mixer mute/fader/pan.
      const gain = this.previewChannel !== null ? master : channel && channel.musicianId && !channel.muted ? channel.volume / 100 * master : 0;
      track.gain.gain.setTargetAtTime(gain, this.context!.currentTime, 0.005);
      track.pan.pan.value = this.previewChannel !== null ? 0 : (channel?.pan ?? 0) / 100;
      const effects = channel?.effects ?? defaultEffects();
      const delay = effects.delay, shift = effects.timeShift;
      // FXDelayScript note subdivisions and normalized control ranges.
      const subdivision = [1 / 8, 1 / 6, 1 / 4, 1 / 3, 1 / 2, 2 / 3, 1][Math.round(delay.time * 6)];
      track.delay.delayTime.value = Math.min(2, 60 / this.bpm * subdivision);
      track.feedback.gain.value = delay.active ? delay.decay * 0.5 : 0;
      track.dry.gain.value = delay.active ? 1 - delay.mix : 1;
      track.wet.gain.value = delay.active ? delay.mix : 0;
      // WebAudio chorus/phaser equivalents; the original Xtra DSP is not bit-exact.
      track.shiftDry.gain.value = shift.active ? 1 - shift.mix : 1;
      track.shiftWet.gain.value = shift.active && !shift.mode ? shift.mix : 0;
      track.phaseWet.gain.value = shift.active && shift.mode ? shift.mix : 0;
      track.shiftDelay.delayTime.value = 0.015;
      track.depth.gain.value = shift.depth * 0.01;
      track.lfo.frequency.value = shift.freq * 2.5;
      track.phaseDepth.gain.value = shift.depth * 400;
      track.phaseLfo.frequency.value = (1 - shift.freq) * 2.5;
    });
  }

  stop(): void {
    this.generation++; this.playing = false;
    for (const track of this.tracks) {
      try { track.source.stop(); } catch { /* An empty channel has never started. */ }
      track.source.disconnect(); track.gain.disconnect(); track.pan.disconnect();
      track.lfo.stop(); track.phaseLfo.stop(); for (const node of track.nodes) node.disconnect();
    }
    this.tracks = [];
  }

  destroy(): void { this.stop(); if (this.context instanceof AudioContext) void this.context.close(); }
}
