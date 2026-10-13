import Phaser from 'phaser';
import data from '../generated/game-data.json';
import { advanceDay, calendarDate, candidates, licenseSong, newGame, recruit, SLOT_INSTRUMENTS, SLOT_NAMES } from '../game/model';
import type { GameState, Instrument, Musician } from '../game/model';
import { BrowserSaveStore } from '../game/storage';
import { button, COLORS, frame, meter, text, title } from '../ui/canvas-ui';
import { cursorStyle } from '../ui/cursors';
import { initialCityAnimation, tickCityAnimation } from '../game/city-animation';
import type { CityAnimationState } from '../game/city-animation';
import { chooseSessionMusician, contractOffers, evaluateDemo, finishRecording, signContract, startRecording, updateChannel } from '../game/recording';
import { RecordingAudio } from '../game/recording-audio';
import { channelSettingsWindow, contractWindow, labelWindow, mixerWindow, sessionWindow, studioWindow } from '../ui/tutorial-windows';

type Modal = 'briefing' | 'rehearsal' | 'recruit' | 'rename' | 'menu' | 'help' | 'reset' | 'publisher' | 'songs' | 'missions' | 'quit' | 'studio' | 'mixer' | 'settings' | 'finish-demo' | 'replace-demo' | 'session' | 'label' | 'contract' | 'rejection' | null;
const musicians: Musician[] = data.musicians;
const money = (value: number) => value.toLocaleString('en-GB');

export class GameScene extends Phaser.Scene {
  private state!: GameState;
  private storage = new BrowserSaveStore();
  private world!: Phaser.GameObjects.Container;
  private hud!: Phaser.GameObjects.Container;
  private modalLayer?: Phaser.GameObjects.Container;
  private parentModalLayer?: Phaser.GameObjects.Container;
  private parentModalKind: Modal = null;
  private selectedStudioId = 'Studio01';
  private selectedLabelId = 'Record01';
  private offerIndex = 4;
  private selectedChannel = 0;
  private sessionReturn: 'mixer' | 'settings' = 'mixer';
  private recordingAudio = new RecordingAudio();
  private mixerMaster = 0.5;
  private recruitDragging = false;
  private recruitDragOffset = 0;
  private recruitMaxOffset = 0;
  private modal: Modal = null;
  private tutorialLayer?: Phaser.GameObjects.Container;
  private tutorialId: string | null = null;
  private tutorialButtonY = 0;
  private statusLabel!: Phaser.GameObjects.Text;
  private moneyLabel!: Phaser.GameObjects.Text;
  private dateLabel!: Phaser.GameObjects.Text;
  private scroll = 200;
  private running = false;
  private clock = 0;
  private selectedSlot = 0;
  private recruitOffset = 0;
  private selectedId = '';
  private selectedSongId = '';
  private selectedInstrument: Instrument = 'Guitar';
  private nameDraft = '';
  private ambient?: Phaser.Sound.BaseSound;
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private hasSaved = false;
  private notice = '';
  private noticeUntil = 0;
  private handledKeyEvents = new WeakSet<KeyboardEvent>();
  private cityClock = 0;
  private cityLayers: { placeId: string | null; image: Phaser.GameObjects.Image;
    track: typeof data.city.tracks[number] | null; state: CityAnimationState }[] = [];
  private cityZones: { id: string; zone: Phaser.GameObjects.Rectangle }[] = [];

  constructor() { super('Game'); }

  preload(): void {
    const progress = this.add.graphics();
    this.add.text(400, 270, 'ROCK MANAGER', { fontFamily: 'Georgia', fontSize: '28px', color: '#dfc18a' }).setOrigin(0.5);
    this.add.text(400, 310, 'Loading First Steps…', { fontFamily: 'Arial', fontSize: '16px', color: '#c2b6b3' }).setOrigin(0.5);
    this.load.on('progress', (amount: number) => {
      progress.clear().fillStyle(0x3d2837).fillRect(240, 344, 320, 6)
        .fillStyle(0xdfc18a).fillRect(240, 344, 320 * amount, 6);
    });
    for (const [key, filename] of Object.entries(data.images)) this.load.image(key, `${import.meta.env.BASE_URL}assets/${filename}`);
    this.load.audio('ambience', `${import.meta.env.BASE_URL}assets/city-ambience.wav`);
  }

  create(): void {
    this.children.removeAll(true);
    this.state = this.storage.load(musicians) ?? newGame(data.mission.startMoney);
    this.hasSaved = this.state.started;
    this.world = this.add.container(-this.scroll, 130);
    this.world.add(this.add.image(0, 0, 'city').setOrigin(0));
    this.input.setDefaultCursor(cursorStyle('default'));
    this.input.setPollAlways();
    for (const building of data.city.buildings) {
      if (!building.path) continue;
      const image = this.add.image(600 - building.regX, 210 - building.regY, `city-sprite-${building.name}`).setOrigin(0);
      this.world.add(image);
      this.cityLayers.push({ placeId: building.name.toLowerCase(), image, track: null, state: initialCityAnimation() });
      const track = data.city.tracks.find((t) => t.placeId === building.name.toLowerCase());
      if (track) this.addCityTrack(track);
    }
    for (const track of data.city.tracks.filter((t) => !t.placeId)) this.addCityTrack(track);
    for (const hotspot of data.hotspots) {
      const [left, top, right, bottom] = hotspot.rect;
      const zone = this.add.rectangle(left, top, right - left, bottom - top, 0xdfc18a, 0).setOrigin(0);
      this.world.add(zone);
      zone.setInteractive({ cursor: cursorStyle('building') });
      this.cityZones.push({ id: hotspot.id, zone });
      zone.on('pointerover', () => {
        if (this.modal) return;
        this.toast(this.placeName(hotspot.id), 900);
      });
      zone.on('pointerup', () => {
        if (!this.isPlaceAvailable(hotspot.id)) return;
        if (!this.modal && hotspot.id === 'publish01') {
          if (this.state.tutorialEnabled && !this.state.seenTutorials.includes('ECOCMis1IntroducePublisher')) {
            this.toast('Visit the Practice Room first.'); return;
          }
          this.open('publisher'); return;
        }
        if (!this.modal && (hotspot.id === 'studio01' || hotspot.id === 'studio04')) {
          this.selectedStudioId = hotspot.id === 'studio01' ? 'Studio01' : 'Studio04';
          this.open(this.state.recording ? 'mixer' : 'studio'); return;
        }
        if (!this.modal && (hotspot.id === 'record01' || hotspot.id === 'record03')) {
          this.selectedLabelId = hotspot.id === 'record01' ? 'Record01' : 'Record03'; this.open('label'); return;
        }
        if (!this.modal) this.toast(`${this.placeName(hotspot.id)} is not included in this opening prototype yet.`, 4000);
      });
    }
    this.refreshCity();
    this.hud = this.add.container(0, 0).setDepth(20);
    this.drawHud();
    this.cursors = this.input.keyboard?.createCursorKeys();
    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => this.keyInput(event));
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!this.recruitDragging || this.modal !== 'recruit') return;
      const offset = Math.round(Phaser.Math.Clamp((pointer.y - this.recruitDragOffset - 414) / 60, 0, 1) * this.recruitMaxOffset);
      if (offset !== this.recruitOffset) { this.recruitOffset = offset; this.open('recruit'); }
    });
    this.input.on('pointerup', () => { this.recruitDragging = false; });
    this.input.on('gameout', () => { this.recruitDragging = false; });
    this.events.once('shutdown', () => this.input.keyboard?.removeAllListeners());
    this.events.once('shutdown', () => this.recordingAudio.destroy());
    this.ambient = this.sound.add('ambience', { loop: true, volume: 0.18 });
    this.open('menu');
    if (import.meta.env.DEV) {
      Object.assign(window, { __rockManager: { snapshot: () => ({ ...structuredClone(this.state), modal: this.modal,
        running: this.running, tutorialId: this.tutorialId, tutorialButtonY: this.tutorialButtonY, scene: 'Game',
        backgroundModal: this.parentModalKind, recruitOffset: this.recruitOffset, recruitMaxOffset: this.recruitMaxOffset,
        selectedStudioId: this.selectedStudioId, selectedLabelId: this.selectedLabelId, offerIndex: this.offerIndex, previewPlaying: this.recordingAudio.playing, recordingPlayback: this.recordingAudio.diagnostics,
        mixerKnobs: (this.modalLayer?.list ?? []).filter((object) => object instanceof Phaser.GameObjects.Image && object.name.startsWith('mixer-knob-')).map((object) => {
          const sprite = object as Phaser.GameObjects.Image;
          const reg = data.tutorialMedia.find((m) => m.key === sprite.texture.key)!;
          return { name: sprite.name, key: sprite.texture.key, x: sprite.x, y: sprite.y, anchorX: sprite.x + reg.regX, anchorY: sprite.y + reg.regY };
        }),
        availablePlaces: this.cityZones.filter((z) => this.isPlaceAvailable(z.id)).map((z) => z.id),
        cityFrames: this.cityLayers.filter((l) => l.track).map((l) => ({ name: l.track!.name, offset: l.state.offset, visible: l.image.visible })),
        loadedTextures: Object.keys(data.images).length }) } });
    }
  }

  private isPlaceAvailable(id: string): boolean {
    if (!this.state.started) return false;
    if (id === 'publish01') return !this.state.tutorialEnabled || this.state.seenTutorials.includes('ECOCMis1IntroducePublisher');
    if (id === 'studio01' || id === 'studio04') return this.state.ownedSongs.length > 0
      && (!this.state.tutorialEnabled || this.state.seenTutorials.includes('ECOCMis1IntroduceStudio'));
    if (id === 'record01' || id === 'record03') return Boolean(this.state.demo)
      && (!this.state.tutorialEnabled || this.state.seenTutorials.includes('ECOCMis1IntroduceLabel'));
    return false;
  }

  private addCityTrack(track: typeof data.city.tracks[number]): void {
    const sprite = track.sequence.find((s) => s.offset === 0)?.sprite;
    const image = this.add.image(sprite ? 600 - sprite.regX : 0, sprite ? 210 - sprite.regY : 0,
      sprite?.path ? `city-sprite-${sprite.name}` : 'city').setOrigin(0).setVisible(Boolean(sprite?.path));
    this.world.add(image);
    this.cityLayers.push({ placeId: track.placeId, image, track, state: initialCityAnimation() });
  }

  private refreshCity(): void {
    for (const layer of this.cityLayers) {
      const available = !layer.placeId || this.isPlaceAvailable(layer.placeId);
      const sprite = layer.track?.sequence.find((s) => s.offset === layer.state.offset)?.sprite;
      layer.image.setVisible(available && (!layer.track || Boolean(sprite?.path)));
    }
    for (const { id, zone } of this.cityZones) {
      if (this.isPlaceAvailable(id)) zone.setInteractive({ cursor: cursorStyle('building') });
      else zone.disableInteractive();
    }
  }

  private animateCity(delta: number): void {
    this.cityClock += Math.min(delta, 100);
    while (this.cityClock >= 1000 / data.city.movieFPS) {
      this.cityClock -= 1000 / data.city.movieFPS;
      for (const layer of this.cityLayers) {
        if (!layer.track || (layer.placeId && !this.isPlaceAvailable(layer.placeId))) continue;
        const previous = layer.state.offset;
        layer.state = tickCityAnimation(layer.state, layer.track.sequence);
        if (previous === layer.state.offset) continue;
        const sprite = layer.track.sequence.find((s) => s.offset === layer.state.offset)?.sprite;
        if (!sprite?.path) { layer.image.setVisible(false); continue; }
        layer.image.setTexture(`city-sprite-${sprite.name}`).setPosition(600 - sprite.regX, 210 - sprite.regY).setVisible(true);
      }
    }
  }

  private placeName(id: string): string {
    const names: Record<string, string> = {
      design01: 'Album artwork', gangsta01: 'Sergey Spektor', publish01: 'Song publisher',
      record01: 'Record label', record02: 'Record label', record03: 'Record label', record04: 'Global Records',
      media01: 'Television', media02: 'Radio FM', media03: 'Music press', media04: 'Zero Magazine',
      media05: 'Record store / charts', tour01: 'Spotlight Tours', video01: 'Music video studio',
    };
    return names[id] ?? (id.startsWith('studio') ? 'Recording studio' : 'Concert venue');
  }

  private drawHud(): void {
    this.hud.removeAll(true);
    this.hud.add(this.add.image(0, 0, 'hud').setOrigin(0));
    text(this, this.hud, 337, 28, 'Band', 12, '#b4b4b4').setFontFamily('Courier New').setFontStyle('bold');
    for (let slot = 0; slot < 5; slot++) {
      const x = 272 + slot * 50;
      const member = this.state.band[slot];
      if (member) this.hud.add(this.add.image(x, 51, `icon-${member.musicianId}`).setOrigin(0).setDisplaySize(46, 47));
      const hit = this.add.rectangle(x, 50, 48, 49, 0xffffff, 0).setOrigin(0).setInteractive({ cursor: cursorStyle('active') });
      this.hud.add(hit);
      hit.on('pointerup', () => { if (!this.modal && this.state.started) { this.selectedSlot = slot; this.open('rehearsal'); } });
    }
    text(this, this.hud, 698, 32, 'Assets', 11, '#b4b4b4').setFontFamily('Courier New').setFontStyle('bold');
    text(this, this.hud, 698, 80, 'Date', 11, '#b4b4b4').setFontFamily('Courier New').setFontStyle('bold');
    this.moneyLabel = text(this, this.hud, 711, 54, `$${money(this.state.money)}`, 12, '#eeeeee').setOrigin(0.5, 0).setFontFamily('Courier New').setFontStyle('bold');
    this.dateLabel = text(this, this.hud, 711, 104, this.headerDate(), 12, '#eeeeee').setOrigin(0.5, 0).setFontFamily('Courier New').setFontStyle('bold');
    this.hud.add(this.add.image(273, 20, 'rehearsal').setOrigin(0));
    const rehearsalHit = this.add.rectangle(270, 19, 253, 80, 0xffffff, 0).setOrigin(0).setInteractive({ cursor: cursorStyle('active') });
    this.hud.add(rehearsalHit);
    rehearsalHit.on('pointerup', () => { if (!this.modal && this.state.started) this.open('rehearsal'); });
    text(this, this.hud, 83, 118, 'Main menu', 10, '#b4b4b4').setOrigin(0.5).setFontFamily('Courier New').setFontStyle('bold');
    const menuHit = this.add.rectangle(33, 20, 101, 94, 0xffffff, 0).setOrigin(0).setInteractive({ cursor: cursorStyle('active') });
    this.hud.add(menuHit);
    menuHit.on('pointerup', () => { if (!this.modal) this.open('menu'); });
    // Keep prototype transport controls inside the recovered surround. The
    // original BITD masks supply the sides and lower curves, without stretching.
    this.hud.add(this.add.image(40, 550, 'city-frame-bottom').setOrigin(0));
    this.statusLabel = text(this, this.hud, 95, 561, '', 12, COLORS.muted, 320);
    button(this, this.hud, 45, 556, 42, '‹', () => { this.scroll = Math.max(0, this.scroll - 80); }, this.modal === null, 28);
    button(this, this.hud, 425, 556, 42, '›', () => { this.scroll = Math.min(400, this.scroll + 80); }, this.modal === null, 28);
    button(this, this.hud, 480, 556, 110, this.running ? 'Pause' : 'Play', () => {
      this.running = !this.running; this.clock = 0; this.drawHud();
    }, this.modal === null && this.state.started, 28);
    button(this, this.hud, 600, 556, 155, 'Advance one day', () => this.tickDay(), this.modal === null && this.state.started, 28);
    for (const mask of data.cityFrame) {
      const image = this.add.image(mask.x, mask.y, mask.key).setOrigin(0);
      // The opaque header covers the upper portion in the original score.
      image.setCrop(0, 144 - mask.y, image.width, image.height - (144 - mask.y));
      this.hud.add(image);
    }
    this.updateStatus();
  }

  private save(): void {
    this.hasSaved = this.storage.save(this.state);
    if (!this.hasSaved) this.toast('Browser storage is unavailable. This session cannot be saved.', 6000);
  }

  private toast(message: string, duration = 3000): void {
    this.notice = message; this.noticeUntil = this.time.now + duration; this.updateStatus();
  }

  private updateStatus(): void {
    if (!this.statusLabel) return;
    const filled = this.state.band.filter(Boolean).length;
    this.statusLabel.setText(this.time.now < this.noticeUntil ? this.notice
      : `${data.mission.name}  ·  Day ${this.state.day}  ·  Band ${filled}/5  ·  ${this.hasSaved ? 'Saved' : 'New mission'}`);
  }

  private tickDay(): void {
    const result = advanceDay(this.state, musicians);
    this.state = result.state;
    this.save();
    this.moneyLabel.setText(`$${money(this.state.money)}`);
    this.dateLabel.setText(this.headerDate());
    if (result.unpaid) this.toast(`Cannot cover ${money(result.unpaid)} in weekly wages.`, 4500);
    else if (result.wages) this.toast(`Payday: ${money(result.wages)} paid in weekly wages.`, 4500);
  }

  private headerDate(): string {
    const [year, month, day] = this.state.startDate.split('-').map(Number);
    return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit', timeZone: 'UTC' })
      .format(new Date(Date.UTC(year, month - 1, day + this.state.day)));
  }

  private toggleSound(): void {
    this.state = { ...this.state, muted: !this.state.muted };
    if (this.state.muted) this.ambient?.stop();
    else if (!this.ambient?.isPlaying) this.ambient?.play();
    this.save(); this.drawHud();
  }

  private open(kind: Modal): void {
    const previous = this.modal;
    const bandChild = kind === 'recruit' || kind === 'rename' || kind === 'songs';
    const child = bandChild || kind === 'contract' || kind === 'rejection' || kind === 'session' || kind === 'settings' || kind === 'finish-demo' || kind === 'replace-demo';
    const isParent = previous === 'rehearsal' || previous === 'label' || previous === 'mixer' || previous === 'studio';
    if (child && isParent) {
      this.parentModalLayer = this.modalLayer; this.parentModalLayer?.setDepth(49); this.modalLayer = undefined;
      this.parentModalKind = previous;
      const suspend = (container: Phaser.GameObjects.Container) => {
        for (const child of container.list) {
          if (child.input) child.disableInteractive();
          if (child instanceof Phaser.GameObjects.Container) suspend(child);
        }
      };
      if (this.parentModalLayer) suspend(this.parentModalLayer);
    } else if (!child) {
      this.parentModalLayer?.destroy(true); this.parentModalLayer = undefined; this.recruitDragging = false;
      this.parentModalKind = null;
    }
    if (this.modal === 'settings' || kind !== 'mixer' && kind !== 'session' && kind !== 'finish-demo') this.recordingAudio.stop();
    this.modalLayer?.destroy(true); this.modalLayer = undefined;
    this.modal = kind; this.clock = 0;
    this.refreshCity();
    this.drawHud();
    if (!kind) {
      // Recover pending event cards after a reload between saving an action and
      // acknowledging its popup. State and seenTutorials are both persisted.
      if (this.state.contract && !this.state.seenTutorials.includes('ECOCMis1IntroduceSleeve')) this.showTutorial('ECOCMis1IntroduceSleeve');
      else if (this.state.demo && !this.state.seenTutorials.includes('ECOCMis1IntroduceLabel')) this.showTutorial('ECOCMis1IntroduceLabel');
      else if (this.state.ownedSongs.length && this.state.seenTutorials.includes('ECOCMis1IntroducePublisher') && !this.state.seenTutorials.includes('ECOCMis1IntroduceStudio')) this.showTutorial('ECOCMis1IntroduceStudio');
      else if (previous === 'finish-demo' && this.state.demo) this.showTutorial('ECOCMis1IntroduceLabel');
      else if (previous === 'label' || previous === 'contract' || previous === 'rejection') {
        this.showTutorial(this.state.contract ? 'ECOCMis1IntroduceSleeve' : 'ECOCMis1NoContract');
      }
      else if (previous === 'publisher' && this.state.ownedSongs.length) this.showTutorial('ECOCMis1IntroduceStudio');
      else if (previous === 'rehearsal') this.showTutorial('ECOCMis1IntroducePublisher');
      else if (this.state.started) this.showTutorial('ECOCMis1IntroduceCity');
      return;
    }
    const layer = this.add.container(0, 0).setDepth(50);
    this.modalLayer = layer;
    const shade = this.add.rectangle(0, 0, 800, 600, 0x080508, 0.25).setOrigin(0).setInteractive();
    layer.add(shade);
    if (kind === 'menu') frame(this, layer, 90, 230, 620, 184, 'dialog');
    else if (kind === 'recruit') frame(this, layer, 293, 95, 358, 483, 'dialog');
    else if (kind === 'rehearsal') frame(this, layer, 60, 77, 683, 462, 'dialog');
    else if (['studio', 'mixer', 'settings', 'label', 'contract', 'session'].includes(kind)) { /* Native window functions compose their own recovered frames. */ }
    else frame(this, layer, 48, 154, 704, 396, 'dialog');
    if (kind === 'publisher' || kind === 'songs') this.songDialog(layer, kind === 'publisher');
    if (kind === 'briefing') this.briefing(layer);
    if (kind === 'rehearsal') this.rehearsal(layer);
    if (kind === 'recruit') this.recruitment(layer);
    if (kind === 'rename') this.rename(layer);
    if (kind === 'menu') this.menu(layer);
    if (kind === 'help') this.help(layer);
    if (kind === 'reset') this.resetConfirmation(layer);
    if (kind === 'missions') this.missionSelection(layer);
    if (kind === 'quit') this.quitConfirmation(layer);
    if (kind === 'studio') this.studio(layer);
    if (kind === 'mixer') this.mixer(layer);
    if (kind === 'settings') this.channelSettings(layer);
    if (kind === 'label') this.label(layer);
    if (kind === 'contract') this.contract(layer);
    if (kind === 'session') this.sessionMusician(layer);
    if (kind === 'finish-demo' || kind === 'replace-demo' || kind === 'rejection') this.recordingConfirmation(layer, kind);
    if (kind === 'rehearsal') this.showTutorial('ECOCMis1IntroduceRehearsal');
    if (kind === 'mixer') this.showTutorial('ECOCMis1IntroduceMixer');
  }

  private showTutorial(id: string): void {
    if (!this.state.tutorialEnabled || this.state.seenTutorials.includes(id) || this.tutorialId) return;
    const card = data.tutorials.find((c) => c.id === id);
    if (!card) return;
    this.tutorialId = id; this.clock = 0;
    const content = card.text.replaceAll('<¤CBand.name>', this.state.bandName);
    const measure = this.add.text(0, 0, content, { fontFamily: 'Arial, sans-serif', fontSize: '15px',
      wordWrap: { width: 526, useAdvancedWrap: true }, lineSpacing: 4 });
    const height = measure.height + 137; measure.destroy();
    const top = 305 - height / 2;
    this.tutorialButtonY = top + height - 49;
    const layer = this.add.container(0, 0).setDepth(100); this.tutorialLayer = layer;
    layer.add(this.add.rectangle(0, 0, 800, 600, 0x000000, 0.25).setOrigin(0).setInteractive());
    frame(this, layer, 110, top, 580, height, 'dialog');
    if (this.textures.exists('ui-megaphone')) layer.add(this.add.image(121, top + 12, 'ui-megaphone').setOrigin(0.5));
    text(this, layer, 140, top + 5, 'Info', 14, '#eeeeee').setFontFamily('Courier New').setFontStyle('bold');
    text(this, layer, 127, top + 46, card.title, 19, '#eeeeee').setFontFamily('Courier New').setFontStyle('bold');
    text(this, layer, 127, top + 81, content, 15, '#eeeeee', 526).setLineSpacing(4);
    button(this, layer, 342, this.tutorialButtonY, 116, 'OK', () => this.dismissTutorial(), true, 36, 'accept');
  }

  private dismissTutorial(): void {
    if (!this.tutorialId) return;
    this.state = { ...this.state, seenTutorials: [...this.state.seenTutorials, this.tutorialId] };
    this.tutorialId = null; this.tutorialLayer?.destroy(true); this.tutorialLayer = undefined; this.clock = 0;
    this.save();
    this.refreshCity();
  }

  private studio(layer: Phaser.GameObjects.Container): void {
    const studio = data.tutorialGameplay.studios.find((s) => s.id === this.selectedStudioId)!;
    const songs = data.songs.filter((s) => this.state.ownedSongs.includes(s.id));
    if (!songs.some((s) => s.id === this.selectedSongId)) this.selectedSongId = this.state.selectedSong ?? songs[0]?.id ?? '';
    studioWindow(this, layer, this.state, studio, songs, this.selectedSongId,
      (id) => { this.selectedSongId = id; this.open('studio'); },
      () => { if (this.state.demo) this.open('replace-demo'); else this.beginRecording(); }, () => this.open(null));
  }

  private beginRecording(): void {
    try {
      this.state = startRecording(this.state, data.tutorialGameplay, this.selectedStudioId, this.selectedSongId);
      this.save(); this.open('mixer');
    } catch (error) { this.toast((error as Error).message, 6000); }
  }

  private mixer(layer: Phaser.GameObjects.Container): void {
    if (!this.state.recording) { this.open(null); return; }
    const recording = this.state.recording;
    this.selectedStudioId = recording.studioId;
    const studio = data.tutorialGameplay.studios.find((s) => s.id === recording.studioId)!;
    const song = data.songs.find((s) => s.id === recording.songId)!;
    mixerWindow(this, layer, this.state, musicians, studio, song, this.recordingAudio.playing, this.mixerMaster,
      (index, patch) => {
        this.state = updateChannel(this.state, index, patch, data.tutorialGameplay); this.save();
        this.recordingAudio.update(this.state.recording!.channels, this.mixerMaster);
      }, (index) => {
        this.selectedChannel = index;
        if (this.state.recording!.channels[index].musicianId) this.open('settings');
        else { this.sessionReturn = 'mixer'; this.open('session'); }
      },
      () => void this.previewRecording(), () => { this.recordingAudio.stop(); this.open('mixer'); },
      (value) => { this.mixerMaster = value; this.recordingAudio.update(this.state.recording!.channels, value); },
      () => this.open('finish-demo'));
  }

  private channelSettings(layer: Phaser.GameObjects.Container): void {
    const recording = this.state.recording!;
    const channel = recording.channels[this.selectedChannel];
    const studio = data.tutorialGameplay.studios.find((s) => s.id === recording.studioId)!;
    channelSettingsWindow(this, layer, this.state, musicians, channel, studio.availableEffects,
      (effects) => { this.state = updateChannel(this.state, this.selectedChannel, { effects }, data.tutorialGameplay); this.save(); this.recordingAudio.update(this.state.recording!.channels, this.mixerMaster); },
      (direction) => {
        const loops = data.tutorialGameplay.loops.filter((l) => l.songId === recording.songId && l.instrument === channel.instrument);
        const index = Phaser.Math.Clamp(loops.findIndex((l) => l.id === channel.loopId) + direction, 0, loops.length - 1);
        this.state = updateChannel(this.state, this.selectedChannel, { loopId: loops[index].id }, data.tutorialGameplay); this.save(); this.open('settings');
      }, () => { this.sessionReturn = 'settings'; this.open('session'); }, () => void this.previewRecording(), () => this.open('mixer'));
  }

  private async previewRecording(): Promise<void> {
    const recording = this.state.recording;
    if (!recording || this.tutorialId) return;
    this.ambient?.stop();
    const previewChannel = this.modal === 'settings' ? this.selectedChannel : undefined;
    const filenames = recording.channels.map((channel, index) => {
      if (previewChannel !== undefined && index !== previewChannel) return null;
      if (!channel.musicianId) return null;
      const loop = data.tutorialGameplay.loops.find((l) => l.id === channel.loopId)!;
      let filename = `${loop.file}.ogg`;
      if (channel.instrument === 'Vocals') {
        const prefixes = data.tutorialGameplay.voicePrefixes as Record<string, string>;
        filename = `${loop.file}${prefixes[channel.musicianId] ?? 'a01'}.ogg`;
        if (!data.tutorialGameplay.audio.some((a) => a.file === filename)) filename = `${loop.file}a01.ogg`;
      }
      return filename;
    });
    try {
      const song = data.tutorialGameplay.defaults.find((s) => s.id === recording.songId)!;
      const sourceEnds = filenames.map((filename) => {
        const audio = data.tutorialGameplay.audio.find((a) => a.file === filename);
        return audio ? audio.cues[audio.cues.length - 1] / audio.sampleRate : null;
      });
      if (await this.recordingAudio.play(recording.channels, filenames, song.bpm, { previewChannel, bars: song.numBars, beatsPerBar: song.timeSignature[0] * 4 / song.timeSignature[1], sourceEnds }) && this.modal === 'mixer') this.open('mixer');
    } catch (error) { this.recordingAudio.stop(); this.toast((error as Error).message, 6000); }
  }

  private sessionMusician(layer: Phaser.GameObjects.Container): void {
    const recording = this.state.recording!;
    const studio = data.tutorialGameplay.studios.find((s) => s.id === recording.studioId)!;
    sessionWindow(this, layer, this.state, studio, recording.channels[this.selectedChannel], (id) => {
      try {
        const playing = this.recordingAudio.playing;
        this.state = chooseSessionMusician(this.state, data.tutorialGameplay, this.selectedChannel, id);
        this.save(); this.open(this.sessionReturn); if (playing) void this.previewRecording();
      } catch (error) { this.toast((error as Error).message, 6000); }
    }, () => this.open(this.sessionReturn));
  }

  private label(layer: Phaser.GameObjects.Container): void {
    const label = data.tutorialGameplay.labels.find((s) => s.id === this.selectedLabelId)!;
    labelWindow(this, layer, this.state, label, () => {
      const result = evaluateDemo(this.state, label, musicians);
      if (!result.accepted) { this.open('rejection'); return; }
      const offers = contractOffers(label, result.like);
      // Director's one-based Steps.count / 2 initial selection.
      this.offerIndex = Math.max(0, Math.trunc(offers.length / 2) - 1); this.open('contract');
    }, () => this.open(null));
  }

  private contract(layer: Phaser.GameObjects.Container): void {
    const label = data.tutorialGameplay.labels.find((s) => s.id === this.selectedLabelId)!;
    const offers = contractOffers(label, evaluateDemo(this.state, label, musicians).like);
    contractWindow(this, layer, label, offers[this.offerIndex], this.offerIndex, offers.length,
      (index) => { this.offerIndex = index; this.open('contract'); }, () => {
        try {
          this.state = signContract(this.state, label, musicians, this.offerIndex); this.save(); this.open('label');
          this.toast(`Signed with ${label.name}. Advance ${money(this.state.contract!.advance)} received.`, 8000);
        } catch (error) { this.toast((error as Error).message, 6000); }
      }, () => this.open('label'));
  }

  private recordingConfirmation(layer: Phaser.GameObjects.Container, kind: 'finish-demo' | 'replace-demo' | 'rejection'): void {
    title(this, layer, 48, 154, kind === 'rejection' ? 'Demo feedback' : kind === 'replace-demo' ? 'Replace demo?' : 'Finish recording?', 'recorder');
    const label = data.tutorialGameplay.labels.find((s) => s.id === this.selectedLabelId)!;
    const content = kind === 'rejection' ? `${label.name} are not ready to offer you a contract.\n\n${evaluateDemo(this.state, label, musicians).reason}\n\nYou can try the other label, change your band, or record another song.`
      : kind === 'replace-demo' ? 'Starting a new recording will replace your current demo when you finish the mix. The studio rental will be charged again.'
        : 'When you click OK, this demo is finished and its mix cannot be changed.\n\nYou can then take it to Rebel Records or Rainbow Records.';
    text(this, layer, 82, 216, content, 17, '#eeeeee', 623);
    button(this, layer, 82, 494, 180, kind === 'rejection' ? 'Leave label' : 'Cancel', () => this.open(kind === 'rejection' ? null : kind === 'replace-demo' ? 'studio' : 'mixer'), true, 33, 'cancel');
    button(this, layer, 549, 494, 167, kind === 'rejection' ? 'Back' : 'OK', () => {
      if (kind === 'rejection') { this.open('label'); return; }
      if (kind === 'replace-demo') { this.beginRecording(); return; }
      try {
        this.state = finishRecording(this.state, data.tutorialGameplay, musicians, data.songs); this.save(); this.open(null);
        this.toast('Demo recorded. Visit Rebel Records or Rainbow Records.', 8000);
      } catch (error) { this.toast((error as Error).message, 6000); }
    }, true, 33, 'accept');
  }

  private briefing(layer: Phaser.GameObjects.Container): void {
    title(this, layer, 48, 154, data.mission.name, 'effect');
    layer.add(this.add.image(80, 181, 'logo').setOrigin(0).setDisplaySize(174, 160));
    text(this, layer, 280, 179, 'MISSION 01', 12, COLORS.gold);
    text(this, layer, 280, 201, data.mission.name, 30);
    text(this, layer, 280, 244, data.mission.intro, 15, COLORS.cream, 424);
    text(this, layer, 280, 375, 'YOUR OBJECTIVES', 12, COLORS.gold);
    data.mission.objectives.forEach((objective, i) => text(this, layer, 280, 397 + i * 19, `${i + 1}. ${objective}`, 14));
    this.character(layer, musicians[0].id, 166, 473, 106, 138);
    text(this, layer, 82, 486, `Starting funds: ${money(data.mission.startMoney)}`, 13, COLORS.gold);
    button(this, layer, 546, 495, 164, 'Begin mission', () => {
      this.state = { ...this.state, started: true }; this.save(); this.open(null);
      this.toast('Open Rehearsal to put your band together.', 6000);
    }, true, 33, 'accept');
  }

  private rehearsal(layer: Phaser.GameObjects.Container): void {
    title(this, layer, 60, 77, this.state.bandName, 'microphone');
    layer.add(this.add.image(90, 258, 'room').setOrigin(0));
    const drawInstrument = (name: string) => {
      const sprite = data.instrumentSprites.find((s) => s.name === name);
      if (sprite) layer.add(this.add.image(296 - sprite.regX, 322 - sprite.regY, name).setOrigin(0));
    };
    if (!this.state.band[2]) drawInstrument('instrumentpos_03_drums_black_standard');
    this.state.band.forEach((member, slot) => {
      if (!member) return;
      const musician = musicians.find((m) => m.id === member.musicianId)!;
      const graphic = musician.instrumentGraphics?.[member.instrument];
      if (graphic && graphic !== 'empty') drawInstrument(`instrumentpos_${String(slot + 1).padStart(2, '0')}_${graphic}`);
    });
    layer.add(this.add.image(87, 108, 'room-portraits').setOrigin(0));
    const positions = [[49, 313], [30, 67], [177, 34], [351, 50], [347, 310]];
    let wageBill = 0;
    for (let slot = 0; slot < 5; slot++) {
      const [px, py] = positions[slot];
      const x = 60 + px, y = 77 + py;
      const member = this.state.band[slot];
      if (member) {
        const m = musicians.find((x) => x.id === member.musicianId)!;
        wageBill += m.salary;
        layer.add(this.add.image(x, y, `portrait-${m.id}`).setOrigin(0));
      } else {
        layer.add(this.add.image(x, y, 'portrait-empty').setOrigin(0));
      }
      const hit = this.add.rectangle(x, y, 93, 98, 0xffffff, 0).setOrigin(0).setInteractive({ cursor: cursorStyle('active') });
      layer.add(hit);
      hit.on('pointerover', () => hit.setFillStyle(0xffffff, 0.05));
      hit.on('pointerout', () => hit.setFillStyle(0xffffff, 0));
      hit.on('pointerup', () => {
        this.selectedSlot = slot; this.recruitOffset = 0;
        if (member) { this.selectedId = member.musicianId; this.selectedInstrument = member.instrument; }
        else this.selectedId = '';
        this.open('recruit');
      });
    }
    layer.add(this.add.image(524, 124, 'ui-cd').setOrigin(0).setScale(0.65));
    text(this, layer, 550, 132, 'Album status', 11, '#eeeeee').setFontFamily('Verdana').setFontStyle('bold');
    frame(this, layer, 522, 145, 198, 306, 'inner');
    const song = data.songs.find((s) => s.id === this.state.selectedSong);
    const label = data.tutorialGameplay.labels.find((l) => l.id === this.state.contract?.labelId);
    text(this, layer, 531, 155, `Record company:\n${label?.name ?? 'Unsigned'}\nRoyalty: ${this.state.contract ? Math.round(this.state.contract.royalty * 100) + '%' : '—'}\nAdvance: ${this.state.contract ? '$' + money(this.state.contract.advance) : '—'}\n\nDemo recorded: ${this.state.demo ? 'Yes' : 'No'}\nStudio session: ${this.state.recording ? 'In progress' : '—'}\nCover designed: —\nRelease date: —\nVideo: —\n\nCopies sold: —\nRevenue: —`, 11, '#cccccc', 178).setFontFamily('Courier New').setLineSpacing(2);
    text(this, layer, 531, 352, `Weekly wages: $${money(wageBill)}\n\n${song?.name ?? 'No licensed song'}`, 12, '#cccccc', 178);
    button(this, layer, 522, 458, 196, 'Choose song', () => this.open('songs'), true, 34, 'note');
    button(this, layer, 75, 500, 220, 'Change band name', () => { this.nameDraft = this.state.bandName; this.open('rename'); }, true, 34, 'rename');
    button(this, layer, 632, 500, 101, 'OK', () => this.open(null), true, 34, 'accept');
  }

  private songDialog(layer: Phaser.GameObjects.Container, publisher: boolean): void {
    const pool = data.songs.filter((s) => publisher ? !this.state.ownedSongs.includes(s.id) : this.state.ownedSongs.includes(s.id));
    if (!pool.some((s) => s.id === this.selectedSongId)) this.selectedSongId = pool[0]?.id ?? '';
    const selected = pool.find((s) => s.id === this.selectedSongId);
    title(this, layer, 48, 154, publisher ? 'Melody Publishing' : 'Your songs', 'note');
    text(this, layer, 76, 222, publisher ? `Available funds: ${money(this.state.money)}` : 'Choose the song your band will work on.', 14, COLORS.muted);
    pool.forEach((song, i) => {
      const row = this.add.rectangle(76, 262 + i * 38, 288, 35, song.id === this.selectedSongId ? 0x624651 : 0x181818).setOrigin(0);
      layer.add(row);
      text(this, layer, 85, 270 + i * 38, song.name, 13, COLORS.cream, 210);
      if (publisher) text(this, layer, 309, 270 + i * 38, money(song.price), 12, COLORS.gold);
      row.setInteractive({ cursor: cursorStyle('active') }).on('pointerup', () => { this.selectedSongId = song.id; this.open(publisher ? 'publisher' : 'songs'); });
    });
    if (selected) {
      text(this, layer, 390, 262, selected.name, 21, COLORS.gold, 315);
      text(this, layer, 390, 311, selected.description, 14, COLORS.cream, 315);
      text(this, layer, 390, 417, `${selected.genre}  ·  Royalty ${Math.round(selected.royalty * 100)}%`, 14, COLORS.muted);
      meter(this, layer, 390, 445, 'Song quality', selected.quality, 310);
      if (publisher) text(this, layer, 390, 468, `License: ${money(selected.price)}`, 14, COLORS.gold);
    } else text(this, layer, 76, 278, publisher ? 'All available songs have been licensed.' : 'Visit Melody Publishing in the city to license a song.', 16, COLORS.cream, 560);
    button(this, layer, 76, 499, 125, 'Cancel', () => this.open(publisher ? null : 'rehearsal'), true, 38, 'cancel');
    button(this, layer, 541, 499, 175, publisher ? 'Buy license' : 'Select song', () => {
      if (!selected) return;
      this.state = publisher ? licenseSong(this.state, data.songs, selected.id) : { ...this.state, selectedSong: selected.id };
      this.save(); this.open(publisher ? null : 'rehearsal');
      this.toast(publisher ? `Licensed ${selected.name} for ${money(selected.price)}.` : `${selected.name} selected.`);
    }, Boolean(selected) && (!publisher || this.state.money >= selected!.price), 38, 'accept');
    if (selected && publisher && this.state.money < selected.price) text(this, layer, 385, 504, 'Insufficient funds', 12, COLORS.muted);
  }

  private recruitment(layer: Phaser.GameObjects.Container): void {
    const existing = this.state.band[this.selectedSlot];
    const pool = existing ? [musicians.find((m) => m.id === existing.musicianId)!] : candidates(this.state, musicians, this.selectedSlot);
    const rows = pool.flatMap((m) => (SLOT_INSTRUMENTS[this.selectedSlot] as readonly Instrument[])
      .filter((instrument) => m.skills[instrument] > 0 && (!existing || instrument === existing.instrument))
      .map((instrument) => ({ m, instrument })));
    if (!rows.some((r) => r.m.id === this.selectedId && r.instrument === this.selectedInstrument)) {
      this.selectedId = rows[0]?.m.id ?? ''; this.selectedInstrument = rows[0]?.instrument ?? 'Guitar';
    }
    const selected = pool.find((m) => m.id === this.selectedId);
    title(this, layer, 293, 95, existing ? 'Band member' : 'Choose Musician', 'microphone');
    layer.add(this.add.image(315, 130, 'musician-paper').setOrigin(0));
    if (selected) {
      layer.add(this.add.image(325, 138, 'musician-frame').setOrigin(0));
      // Frame has a 3px border and an 8px shadow; the shadow is not padding.
      layer.add(this.add.image(328, 141, `portrait-${selected.id}`).setOrigin(0));
      text(this, layer, 437, 138, selected.name, 14, '#111111', 185).setFontFamily('Courier New').setFontStyle('bold');
      for (const [i, label] of ['Age', 'Instrument', 'Musicality', 'Star quality', 'Style'].entries())
        text(this, layer, 437, 158 + i * 16, label, 11, '#111111').setFontFamily('Courier New').setFontStyle('bold');
      text(this, layer, 517, 158, `${selected.age} years`, 12, '#111111').setFontFamily('Courier New');
      text(this, layer, 517, 174, this.selectedInstrument.toLowerCase(), 12, '#111111').setFontFamily('Courier New');
      text(this, layer, 517, 222, selected.genre, 12, '#111111').setFontFamily('Courier New');
      for (const [i, val] of [selected.musicality, selected.charisma ?? 0].entries()) {
        layer.add(this.add.image(517, 190 + i * 16, 'meter-bg').setOrigin(0));
        const fill = this.add.image(519, 192 + i * 16, 'meter-fill').setOrigin(0);
        fill.setCrop(0, 0, 92 * Phaser.Math.Clamp(val, 0, 1), 7); layer.add(fill);
      }
      text(this, layer, 330, 252, selected.description, 11, '#242424', 285).setLineSpacing(1);
    }
    text(this, layer, 320, 368, 'Musician', 11, '#eeeeee').setFontFamily('Verdana').setFontStyle('bold');
    text(this, layer, 520, 368, 'Price/week', 11, '#eeeeee').setFontFamily('Verdana').setFontStyle('bold');
    frame(this, layer, 316, 383, 280, 140, 'inner');
    const scrollRows = (amount: number) => { this.recruitOffset = Phaser.Math.Clamp(this.recruitOffset + amount, 0, Math.max(0, rows.length - 4)); this.open('recruit'); };
    this.recruitMaxOffset = Math.max(0, rows.length - 4);
    const scrollSurface = this.add.zone(316, 383, 280, 140).setOrigin(0).setInteractive();
    layer.add(scrollSurface);
    scrollSurface.on('wheel', (_p: unknown, _dx: number, dy: number) => scrollRows(Math.sign(dy)));
    const visible = rows.slice(this.recruitOffset, this.recruitOffset + 4);
    visible.forEach(({ m, instrument }, i) => {
      const y = 388 + i * 32;
      const row = this.add.rectangle(321, y, 270, 31, m.id === this.selectedId && instrument === this.selectedInstrument ? 0x393939 : 0x000000).setOrigin(0);
      layer.add(row);
      layer.add(this.add.image(324, y + 2, `icon-${m.id}`).setOrigin(0).setDisplaySize(25, 27));
      const instrumentKey = `ui-${instrument.toLowerCase()}`;
      if (this.textures.exists(instrumentKey)) layer.add(this.add.image(354, y + 2, instrumentKey).setOrigin(0).setDisplaySize(26, 25));
      text(this, layer, 385, y + 8, m.name, 10, '#eeeeee', 154).setFontFamily('Courier New').setLineSpacing(0);
      text(this, layer, 552, y + 8, `$${money(m.salary)}`, 11, '#eeeeee').setFontFamily('Courier New');
      let rowPressed = false;
      row.on('pointerdown', () => { rowPressed = true; });
      row.on('pointerout', () => { rowPressed = false; });
      row.setInteractive({ cursor: cursorStyle('active') }).on('pointerup', () => {
        if (!rowPressed) return;
        rowPressed = false;
        this.selectedId = m.id; this.selectedInstrument = instrument; this.open('recruit');
      });
      row.on('wheel', (_p: unknown, _dx: number, dy: number) => scrollRows(Math.sign(dy)));
    });
    for (const [key, y, direction] of [['scroll-up', 383, -1], ['scroll-down', 496, 1]] as const) {
      const arrow = this.add.image(600, y, key).setOrigin(0).setInteractive({ cursor: cursorStyle('active') });
      layer.add(arrow); arrow.on('pointerup', () => scrollRows(direction));
    }
    layer.add(this.add.rectangle(612, 411, 6, 83, 0x313131).setOrigin(0));
    const track = this.add.zone(600, 411, 33, 85).setOrigin(0).setInteractive({ cursor: cursorStyle('active') });
    layer.add(track);
    track.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.recruitOffset = Math.round(Phaser.Math.Clamp((pointer.y - 423) / 60, 0, 1) * this.recruitMaxOffset); this.open('recruit');
    });
    const thumbY = 414 + (this.recruitMaxOffset ? this.recruitOffset / this.recruitMaxOffset * 60 : 0);
    const thumb = this.add.image(604, thumbY, 'scroll-thumb').setOrigin(0).setInteractive({ cursor: cursorStyle('active') });
    layer.add(thumb);
    thumb.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.recruitDragging = true; this.recruitDragOffset = pointer.y - thumbY;
    });
    button(this, layer, 341, 529, 125, existing ? 'Remove' : 'Hire', () => {
      if (!selected) return;
      this.state = existing ? { ...this.state, band: this.state.band.map((m, i) => i === this.selectedSlot ? null : m) }
        : recruit(this.state, musicians, this.selectedSlot, selected.id, this.selectedInstrument);
      this.save(); this.open('rehearsal');
    }, Boolean(selected), 36, existing ? 'garbage' : 'accept');
    button(this, layer, 478, 529, 140, 'Cancel', () => this.open('rehearsal'), true, 36, 'cancel');
  }

  private character(layer: Phaser.GameObjects.Container, id: string, x: number, y: number, width: number, height: number): void {
    const key = this.textures.exists(`pose-${id}`) ? `pose-${id}` : `portrait-${id}`;
    const image = this.add.image(x, y, key).setOrigin(0.5, 1);
    const factor = Math.min(width / image.width, height / image.height);
    image.setScale(factor); layer.add(image);
  }

  private rename(layer: Phaser.GameObjects.Container): void {
    title(this, layer, 48, 154, 'Change Band Name', 'rename');
    text(this, layer, 90, 194, 'Name your band', 28);
    text(this, layer, 90, 246, 'Type a name. Press Enter to save or Escape to cancel.', 15, COLORS.muted);
    frame(this, layer, 90, 295, 620, 64, 'inner');
    text(this, layer, 112, 314, `${this.nameDraft}▏`, 22, COLORS.gold);
    text(this, layer, 90, 379, `${this.nameDraft.length}/28 characters`, 13, COLORS.muted);
    button(this, layer, 90, 477, 146, 'Cancel', () => this.open('rehearsal'), true, 38, 'cancel');
    button(this, layer, 555, 477, 156, 'OK', () => this.saveName(), this.nameDraft.trim().length > 0, 38, 'accept');
  }

  private saveName(): void {
    if (!this.nameDraft.trim()) return;
    this.state = { ...this.state, bandName: this.nameDraft.trim() };
    this.save(); this.open('rehearsal');
  }

  private menu(layer: Phaser.GameObjects.Container): void {
    layer.add(this.add.image(106, 125, 'logo').setOrigin(0));
    text(this, layer, 370, 258, data.menuText.title, 15, '#eeeeee', 315).setFontFamily('Courier New').setFontStyle('bold');
    text(this, layer, 370, 281, data.menuText.text, 12, '#eeeeee', 310).setFontFamily('Courier New').setLineSpacing(2);
    button(this, layer, 103, 352, 142, 'Continue', () => this.open(this.state.recording ? 'mixer' : null), this.state.started, 38, 'accept');
    button(this, layer, 251, 352, 142, 'New game', () => this.open('missions'), true, 38, 'effect');
    button(this, layer, 399, 352, 170, 'Web site', () => {}, false, 38, 'globe');
    button(this, layer, 575, 352, 122, 'Quit', () => this.open('quit'), true, 38, 'skull');
    button(this, layer, 103, 431, 174, this.state.muted ? 'Sound off' : 'Sound on', () => { this.toggleSound(); this.open('menu'); }, true, 34);
    button(this, layer, 288, 431, 174, 'Fullscreen', () => this.scale.toggleFullscreen(), true, 34);
    button(this, layer, 473, 431, 224, 'How to play', () => this.open('help'), true, 34);
  }

  private missionSelection(layer: Phaser.GameObjects.Container): void {
    title(this, layer, 48, 154, 'Choose Mission', 'effect');
    frame(this, layer, 80, 213, 430, 260, 'inner');
    data.missions.slice(0, 9).forEach((mission, i) => {
      const y = 222 + i * 27;
      const row = this.add.rectangle(86, y, 418, 26, mission.id === 'Mission01' ? 0x393939 : 0x000000).setOrigin(0);
      layer.add(row);
      text(this, layer, 95, y + 5, mission.name, 13, mission.id === 'Mission01' ? '#eeeeee' : '#666666').setFontFamily('Courier New');
    });
    text(this, layer, 537, 238, 'First Steps', 22, COLORS.gold);
    text(this, layer, 537, 282, 'Form a band, release a record and get on the Top 10.\n\nThis recreation currently supports Mission01.', 15, COLORS.cream, 178);
    button(this, layer, 90, 493, 143, 'Cancel', () => this.open('menu'), true, 38, 'cancel');
    button(this, layer, 530, 493, 181, 'First Steps', () => this.open(this.state.started ? 'reset' : 'briefing'), true, 38, 'accept');
  }

  private quitConfirmation(layer: Phaser.GameObjects.Container): void {
    text(this, layer, 80, 160, 'Quit game?', 15, '#eeeeee').setFontFamily('Courier New').setFontStyle('bold');
    text(this, layer, 90, 230, 'Your progress will be saved. In the browser, close the tab to exit. You can return to the main menu here.', 18, COLORS.cream, 610);
    button(this, layer, 90, 477, 180, 'Cancel', () => this.open('menu'), true, 38, 'cancel');
    button(this, layer, 500, 477, 211, 'Main menu', () => { this.running = false; this.save(); this.open('menu'); }, true, 38, 'accept');
  }

  private help(layer: Phaser.GameObjects.Container): void {
    text(this, layer, 90, 191, 'First Steps', 28, COLORS.gold);
    text(this, layer, 90, 239,
      'Hire one to five musicians in the Practice Room and name your band. Buy a song license at Melody Publishing.\n\nChoose Strawberry Studios or Garage Studio, pay the rental and mix your demo. Drag volume and pan controls; click portraits to hire session musicians. Finish the mix, then submit your demo to Rebel Records or Rainbow Records.\n\nLabels judge the band’s style, song and recording quality. A stronger lineup, another song or a better studio may help after rejection. Negotiate advance versus royalty before signing.\n\nProgress saves in this browser. Wages are paid weekly; time pauses in dialogs. Cover design, release and charts are the next stage.',
      16, COLORS.cream, 610);
    button(this, layer, 562, 492, 150, 'Back', () => this.open('menu'));
  }

  private resetConfirmation(layer: Phaser.GameObjects.Container): void {
    text(this, layer, 90, 200, 'Start First Steps again?', 28, COLORS.gold);
    text(this, layer, 90, 260, 'This replaces the saved band and starts the mission with 100,000.', 18, COLORS.cream, 590);
    button(this, layer, 90, 478, 160, 'Keep playing', () => this.open('menu'));
    button(this, layer, 530, 478, 180, 'Start new mission', () => {
      this.state = newGame(data.mission.startMoney); this.running = false; this.clock = 0;
      this.ambient?.stop(); this.hasSaved = false;
      this.storage.save(this.state); this.open('briefing');
    });
  }

  private keyInput(event: KeyboardEvent): void {
    // Phaser can revisit queued DOM events when the input display list changes.
    // Consume each event once while still permitting distinct key-repeat events.
    if (this.handledKeyEvents.has(event)) return;
    this.handledKeyEvents.add(event);
    if (this.tutorialId) {
      if (event.key === 'Enter' || event.key === 'Escape') this.dismissTutorial();
      return;
    }
    if (this.modal === 'rename') {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
        event.preventDefault(); this.nameDraft = ''; this.open('rename'); return;
      }
      if (event.key === 'Enter') { this.saveName(); return; }
      if (event.key === 'Escape') { this.open('rehearsal'); return; }
      if (event.key === 'Backspace') { event.preventDefault(); this.nameDraft = this.nameDraft.slice(0, -1); this.open('rename'); }
      else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && this.nameDraft.length < 28) {
        this.nameDraft += event.key; this.open('rename');
      }
      return;
    }
    if (event.key === 'Escape' && this.state.started) {
      const back: Partial<Record<NonNullable<Modal>, Modal>> = { recruit: 'rehearsal', songs: 'rehearsal', session: this.sessionReturn, settings: 'mixer',
        mixer: 'finish-demo', 'finish-demo': 'mixer', 'replace-demo': 'studio', contract: 'label', rejection: 'label' };
      this.open(this.modal ? back[this.modal] ?? null : 'menu');
    }
    if (event.key === ' ' && !this.modal && this.state.started) {
      event.preventDefault(); this.running = !this.running; this.clock = 0; this.drawHud();
    }
  }

  update(_time: number, delta: number): void {
    if (!this.state) return;
    if (!this.modal && !this.tutorialId) {
      if (document.visibilityState === 'visible') this.animateCity(delta);
      const pointer = this.input.activePointer;
      const hoverCity = pointer.y > 144 && pointer.y < 564 && pointer.x >= 0 && pointer.x <= 800;
      const direction = this.cursors?.left.isDown ? -1 : this.cursors?.right.isDown ? 1
        : hoverCity && pointer.x < 45 ? -1 : hoverCity && pointer.x > 755 ? 1 : 0;
      this.scroll = Phaser.Math.Clamp(this.scroll + direction * Math.min(delta, 60) * 0.23, 0, 400);
      if (this.running && document.visibilityState === 'visible') {
        this.clock += Math.min(delta, 100);
        if (this.clock >= 3000) { this.clock -= 3000; this.tickDay(); }
      }
    }
    this.world.x = -this.scroll;
    this.updateStatus();
  }
}

