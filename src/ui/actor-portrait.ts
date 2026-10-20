import Phaser from 'phaser';
import evidence from '../generated/actor-animation.json';
import feedback from '../generated/feedback-audio.json';

export type ActorMood = keyof typeof evidence.moodStates;
export interface ActorPortraitOptions {
  width?: number;
  height?: number;
  kind?: 'media' | 'label' | 'musician';
  mood?: ActorMood;
}
export interface ActorPortrait {
  update(key: string, positionSeconds: number, playing: boolean): void;
  setMood(mood: ActorMood): void;
  destroy(): void;
  readonly diagnostics: { id: string; mouth: string; cueIndex: number; mood: string };
}
type Frame = { sourceRect: number[]; width: number; height: number; regX: number; regY: number };

/** Original Director layers, aligned by registration point; speech follows the
 * retained 12 Hz cue sheet rather than measuring the audio waveform. Atlases
 * must be preloaded under portraits[].atlas.textureKey before creation. */
export function createActorPortrait(scene: Phaser.Scene, layer: Phaser.GameObjects.Container,
  id: string, x: number, y: number, options: ActorPortraitOptions = {}): ActorPortrait {
  const semantic = (feedback.semanticCues as Record<string, { actorId?: string }>)[id];
  const actorId = (semantic?.actorId ?? id).toLowerCase();
  const portrait = evidence.portraits.find(p => p.id === actorId);
  if (!portrait || !scene.textures.exists(portrait.atlas.textureKey)) {
    return { update() {}, setMood() {}, destroy() {}, diagnostics: { id: actorId, mouth: '', cueIndex: -1, mood: options.mood ?? 'normal' } };
  }
  const textureKey = portrait.atlas.textureKey, texture = scene.textures.get(textureKey);
  const frames = portrait.frames as Record<string, Frame>;
  for (const [name, frame] of Object.entries(frames)) {
    if (!texture.has(name)) texture.add(name, 0, ...frame.sourceRect as [number, number, number, number]);
  }
  const group = scene.add.container(x, y);
  layer.add(group);
  const scaleX = (options.width ?? portrait.width) / portrait.width;
  const scaleY = (options.height ?? portrait.height) / portrait.height;
  group.setScale(scaleX, scaleY);
  const images = ['background', 'body', 'eyes', 'mouth'].map(() => {
    const initialFrame=frames.background01?'background01':Object.keys(frames)[0];
    const image = scene.add.image(0, 0, textureKey, initialFrame).setOrigin(0);
    group.add(image);
    return image;
  });
  let mood: ActorMood = options.mood ?? 'normal', previousKey = '', previousCueIndex = -1;
  let mouthOffset = 0, framesLeft = 0, nextFirst = false;
  let destroyed = false;
  const show = (image: Phaser.GameObjects.Image, name?: string) => {
    const frame = name ? frames[name] : undefined;
    if (!frame) { image.setVisible(false); return; }
    image.setTexture(textureKey, name).setPosition(portrait.anchor[0] - frame.regX, portrait.anchor[1] - frame.regY).setVisible(true);
  };
  const moveName = (index: number) => {
    const suffix=String(index).padStart(4,'0');
    return frames[`moves_${suffix}`]?`moves_${suffix}`:`moves01_${suffix}`;
  };
  const idle = () => {
    const state = evidence.moodStates[mood];
    show(images[0], 'background01');
    show(images[1], moveName(3));
    show(images[2], moveName(61 + state.eyes));
    show(images[3], state.mouth === 2 ? undefined : moveName(1 + state.mouth));
  };
  idle();
  return {
    get diagnostics() { return { id: actorId, mouth: images[3].visible ? String(images[3].frame?.name ?? '') : '', cueIndex: previousCueIndex, mood }; },
    update(key, positionSeconds, playing) {
      if (destroyed) return;
      if (!playing || !key) { idle(); previousKey = ''; previousCueIndex = -1; return; }
      if (key !== previousKey) {
        previousKey = key; previousCueIndex = -1; mouthOffset = 0; framesLeft = 0; nextFirst = false;
      }
      const cues = (evidence.cues as Record<string, number[]>)[key];
      if (!cues?.length) { idle(); return; }
      const index = Math.min(cues.length - 1, Math.max(0, Math.floor(positionSeconds * evidence.cueRateHz)));
      if (index === previousCueIndex) return;
      previousCueIndex = index;
      // Director integer() rounds to the nearest integer (not truncation).
      const opening = Phaser.Math.Clamp(Math.round(cues[index] / 33), 0, 3);
      if (opening === 0 || opening > 2) mouthOffset = 0;
      else {
        if (framesLeft <= 0) { nextFirst = !nextFirst; framesLeft = Phaser.Math.Between(13, 27); }
        mouthOffset = nextFirst ? 3 : 0;
      }
      framesLeft--;
      show(images[3], moveName(5 + mouthOffset + opening));
    },
    setMood(next) { mood = next; idle(); previousCueIndex = -1; },
    destroy() { if (!destroyed) { destroyed = true; group.destroy(); } },
  };
}
