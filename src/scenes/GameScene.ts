import Phaser from 'phaser';
import data from '../generated/game-data.json';
import { advanceDay, calendarDate, candidates, newGame, recruit, SLOT_INSTRUMENTS, SLOT_NAMES } from '../game/model';
import type { GameState, Instrument, Musician } from '../game/model';
import { BrowserSaveStore } from '../game/storage';
import { button, COLORS, frame, meter, text } from '../ui/canvas-ui';

type Modal = 'briefing' | 'rehearsal' | 'recruit' | 'rename' | 'menu' | 'help' | 'reset' | null;
const musicians: Musician[] = data.musicians;
const money = (value: number) => value.toLocaleString('en-GB');

export class GameScene extends Phaser.Scene {
  private state!: GameState;
  private storage = new BrowserSaveStore();
  private world!: Phaser.GameObjects.Container;
  private hud!: Phaser.GameObjects.Container;
  private modalLayer?: Phaser.GameObjects.Container;
  private modal: Modal = null;
  private statusLabel!: Phaser.GameObjects.Text;
  private moneyLabel!: Phaser.GameObjects.Text;
  private dateLabel!: Phaser.GameObjects.Text;
  private scroll = 200;
  private running = false;
  private clock = 0;
  private selectedSlot = 0;
  private selectedId = '';
  private selectedInstrument: Instrument = 'Guitar';
  private nameDraft = '';
  private ambient?: Phaser.Sound.BaseSound;
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private hasSaved = false;
  private notice = '';
  private noticeUntil = 0;
  private handledKeyEvents = new WeakSet<KeyboardEvent>();

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
    this.world = this.add.container(-this.scroll, 144);
    this.world.add(this.add.image(0, 0, 'city').setOrigin(0));
    for (const hotspot of data.hotspots) {
      const [left, top, right, bottom] = hotspot.rect;
      const zone = this.add.rectangle(left, top, right - left, bottom - top, 0xdfc18a, 0).setOrigin(0);
      this.world.add(zone);
      zone.setInteractive({ useHandCursor: true });
      zone.on('pointerover', () => {
        if (this.modal) return;
        zone.setStrokeStyle(1, 0xdfc18a, 0.7);
        this.toast(this.placeName(hotspot.id), 900);
      });
      zone.on('pointerout', () => zone.setStrokeStyle());
      zone.on('pointerup', () => {
        if (!this.modal) this.toast(`${this.placeName(hotspot.id)} is not included in this opening prototype yet.`, 4000);
      });
    }
    this.hud = this.add.container(0, 0).setDepth(20);
    this.drawHud();
    this.cursors = this.input.keyboard?.createCursorKeys();
    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => this.keyInput(event));
    this.events.once('shutdown', () => this.input.keyboard?.removeAllListeners());
    this.ambient = this.sound.add('ambience', { loop: true, volume: 0.18 });
    this.open(this.state.started ? 'menu' : 'briefing');
    if (import.meta.env.DEV) {
      Object.assign(window, { __rockManager: { snapshot: () => ({ ...structuredClone(this.state), modal: this.modal,
        running: this.running, scene: 'Game', loadedTextures: Object.keys(data.images).length }) } });
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
    text(this, this.hud, 275, 31, this.state.bandName, 14, COLORS.gold, 245);
    for (let slot = 0; slot < 5; slot++) {
      const x = 272 + slot * 50;
      const member = this.state.band[slot];
      if (member) this.hud.add(this.add.image(x, 51, `icon-${member.musicianId}`).setOrigin(0).setDisplaySize(46, 47));
      else text(this, this.hud, x + 23, 69, '+', 20, '#6f606b').setOrigin(0.5);
      const hit = this.add.rectangle(x, 50, 48, 49, 0xffffff, 0).setOrigin(0).setInteractive({ useHandCursor: true });
      this.hud.add(hit);
      hit.on('pointerup', () => { if (!this.modal && this.state.started) { this.selectedSlot = slot; this.open('rehearsal'); } });
    }
    this.moneyLabel = text(this, this.hud, 670, 53, money(this.state.money), 18, COLORS.cream);
    this.dateLabel = text(this, this.hud, 668, 103, calendarDate(this.state), 12, COLORS.cream);
    this.hud.add(this.add.image(184, 85, 'rehearsal').setScale(0.8));
    const rehearsalHit = this.add.rectangle(112, 46, 138, 70, 0xffffff, 0).setOrigin(0).setInteractive({ useHandCursor: true });
    this.hud.add(rehearsalHit);
    text(this, this.hud, 180, 114, 'REHEARSAL', 11, COLORS.cream).setOrigin(0.5);
    rehearsalHit.on('pointerup', () => { if (!this.modal && this.state.started) this.open('rehearsal'); });
    button(this, this.hud, 538, 36, 104, 'Menu', () => this.open('menu'), this.modal === null || this.modal === 'menu');
    button(this, this.hud, 538, 82, 104, this.state.muted ? 'Sound off' : 'Sound on', () => this.toggleSound(), this.modal === null);
    this.hud.add(this.add.rectangle(0, 564, 800, 36, 0x281421).setOrigin(0));
    this.statusLabel = text(this, this.hud, 56, 575, '', 12, COLORS.muted, 438);
    button(this, this.hud, 5, 568, 42, '‹', () => { this.scroll = Math.max(0, this.scroll - 80); }, this.modal === null, 28);
    button(this, this.hud, 478, 568, 42, '›', () => { this.scroll = Math.min(400, this.scroll + 80); }, this.modal === null, 28);
    button(this, this.hud, 530, 568, 110, this.running ? 'Pause' : 'Play', () => {
      this.running = !this.running; this.clock = 0; this.drawHud();
    }, this.modal === null && this.state.started, 28);
    button(this, this.hud, 647, 568, 148, 'Advance one day', () => this.tickDay(), this.modal === null && this.state.started, 28);
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
    this.moneyLabel.setText(money(this.state.money));
    this.dateLabel.setText(calendarDate(this.state));
    if (result.unpaid) this.toast(`Cannot cover ${money(result.unpaid)} in weekly wages.`, 4500);
    else if (result.wages) this.toast(`Payday: ${money(result.wages)} paid in weekly wages.`, 4500);
  }

  private toggleSound(): void {
    this.state = { ...this.state, muted: !this.state.muted };
    if (this.state.muted) this.ambient?.stop();
    else if (!this.ambient?.isPlaying) this.ambient?.play();
    this.save(); this.drawHud();
  }

  private open(kind: Modal): void {
    this.modalLayer?.destroy(true); this.modalLayer = undefined;
    this.modal = kind; this.clock = 0;
    this.drawHud();
    if (!kind) return;
    const layer = this.add.container(0, 0).setDepth(50);
    this.modalLayer = layer;
    const shade = this.add.rectangle(0, 0, 800, 600, 0x080508, 0.64).setOrigin(0).setInteractive();
    layer.add(shade);
    frame(this, layer, 48, 154, 704, 396);
    if (kind === 'briefing') this.briefing(layer);
    if (kind === 'rehearsal') this.rehearsal(layer);
    if (kind === 'recruit') this.recruitment(layer);
    if (kind === 'rename') this.rename(layer);
    if (kind === 'menu') this.menu(layer);
    if (kind === 'help') this.help(layer);
    if (kind === 'reset') this.resetConfirmation(layer);
  }

  private briefing(layer: Phaser.GameObjects.Container): void {
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
    });
  }

  private rehearsal(layer: Phaser.GameObjects.Container): void {
    text(this, layer, 76, 176, 'REHEARSAL', 12, COLORS.gold);
    text(this, layer, 76, 198, this.state.bandName, 25);
    text(this, layer, 76, 239, 'Choose a position to recruit or inspect a musician.', 14, COLORS.muted);
    let wageBill = 0;
    for (let slot = 0; slot < 5; slot++) {
      const x = 76 + slot * 130;
      const member = this.state.band[slot];
      frame(this, layer, x, 280, 120, 162);
      if (member) {
        const m = musicians.find((x) => x.id === member.musicianId)!;
        wageBill += m.salary;
        layer.add(this.add.image(x + 60, 335, `portrait-${m.id}`).setDisplaySize(74, 78));
        text(this, layer, x + 8, 384, m.name, 12, COLORS.cream, 108);
        text(this, layer, x + 8, 416, `${money(m.salary)} / week`, 11, COLORS.gold);
      } else {
        text(this, layer, x + 60, 325, '+', 40, '#7c6772').setOrigin(0.5);
        text(this, layer, x + 60, 381, 'Empty position', 12, COLORS.muted).setOrigin(0.5);
      }
      const hit = this.add.rectangle(x, 280, 120, 162, 0xffffff, 0).setOrigin(0).setInteractive({ useHandCursor: true });
      layer.add(hit);
      hit.on('pointerover', () => hit.setFillStyle(0xffffff, 0.05));
      hit.on('pointerout', () => hit.setFillStyle(0xffffff, 0));
      hit.on('pointerup', () => {
        this.selectedSlot = slot;
        if (member) { this.selectedId = member.musicianId; this.selectedInstrument = member.instrument; }
        else this.selectedId = '';
        this.open('recruit');
      });
      text(this, layer, x + 60, 450, SLOT_NAMES[slot], 12, COLORS.gold).setOrigin(0.5, 0);
    }
    text(this, layer, 76, 479, `Weekly wages: ${money(wageBill)}`, 13, COLORS.muted);
    button(this, layer, 76, 504, 150, 'Name your band', () => { this.nameDraft = this.state.bandName; this.open('rename'); }, true, 30);
    button(this, layer, 570, 499, 148, 'Back to city', () => this.open(null));
  }

  private recruitment(layer: Phaser.GameObjects.Container): void {
    const existing = this.state.band[this.selectedSlot];
    const pool = existing ? [musicians.find((m) => m.id === existing.musicianId)!] : candidates(this.state, musicians, this.selectedSlot);
    if (!pool.some((m) => m.id === this.selectedId)) this.selectedId = pool[0]?.id ?? '';
    const selected = pool.find((m) => m.id === this.selectedId);
    const instruments = selected ? (SLOT_INSTRUMENTS[this.selectedSlot] as readonly Instrument[])
      .filter((instrument) => selected.skills[instrument] > 0) : [];
    if (!instruments.includes(this.selectedInstrument)) this.selectedInstrument = instruments[0] ?? 'Guitar';
    text(this, layer, 76, 176, existing ? 'BAND MEMBER' : 'RECRUIT A MUSICIAN', 12, COLORS.gold);
    text(this, layer, 76, 198, SLOT_NAMES[this.selectedSlot], 25);
    text(this, layer, 76, 239, 'Musician', 12, COLORS.muted);
    text(this, layer, 285, 239, 'Per week', 12, COLORS.muted);
    pool.forEach((m, i) => {
      const y = 264 + i * 33;
      const bg = this.add.rectangle(76, y, 272, 31, this.selectedId === m.id ? 0x624651 : 0x241621).setOrigin(0);
      layer.add(bg);
      layer.add(this.add.image(80, y + 2, `icon-${m.id}`).setOrigin(0).setDisplaySize(25, 27));
      text(this, layer, 113, y + 7, m.name, 12, COLORS.cream, 163);
      text(this, layer, 298, y + 7, money(m.salary), 12, COLORS.gold);
      bg.setInteractive({ useHandCursor: true }).on('pointerup', () => { this.selectedId = m.id; this.open('recruit'); });
    });
    if (!pool.length) text(this, layer, 76, 280, 'No available musicians can fill this position.', 16, COLORS.muted, 265);
    if (selected) {
      layer.add(this.add.image(381, 182, `portrait-${selected.id}`).setOrigin(0).setDisplaySize(74, 78));
      text(this, layer, 466, 183, selected.name, 19, COLORS.cream, 242);
      text(this, layer, 466, 220, `${selected.age} years  ·  ${selected.genre}`, 13, COLORS.gold);
      text(this, layer, 381, 275, selected.description, 13, COLORS.cream, 329);
      meter(this, layer, 382, 402, 'Musicality', selected.musicality, 310);
      meter(this, layer, 382, 423, 'Mood', selected.mood, 310);
      meter(this, layer, 382, 444, 'Health', selected.health, 310);
      text(this, layer, 382, 467, `Weekly salary: ${money(selected.salary)}`, 13, COLORS.gold);
      instruments.forEach((instrument, i) => button(this, layer, 382 + i * 104, 493, 96,
        `${this.selectedInstrument === instrument ? '• ' : ''}${instrument}`, () => {
          this.selectedInstrument = instrument; this.open('recruit');
        }, !existing, 30));
    }
    button(this, layer, 76, 497, 124, 'Back', () => this.open('rehearsal'));
    if (!existing) button(this, layer, 590, 493, 122, 'Recruit', () => {
      if (!selected) return;
      this.state = recruit(this.state, musicians, this.selectedSlot, selected.id, this.selectedInstrument);
      this.save(); this.open('rehearsal'); this.toast(`${selected.name} joined the band.`);
    }, Boolean(selected));
    else button(this, layer, 590, 493, 122, 'Remove', () => {
      this.state = { ...this.state, band: this.state.band.map((member, index) => index === this.selectedSlot ? null : member) };
      this.save(); this.open('rehearsal');
    });
  }

  private character(layer: Phaser.GameObjects.Container, id: string, x: number, y: number, width: number, height: number): void {
    const key = this.textures.exists(`pose-${id}`) ? `pose-${id}` : `portrait-${id}`;
    const image = this.add.image(x, y, key).setOrigin(0.5, 1);
    const factor = Math.min(width / image.width, height / image.height);
    image.setScale(factor); layer.add(image);
  }

  private rename(layer: Phaser.GameObjects.Container): void {
    text(this, layer, 90, 194, 'Name your band', 28);
    text(this, layer, 90, 246, 'Type a name. Press Enter to save or Escape to cancel.', 15, COLORS.muted);
    frame(this, layer, 90, 295, 620, 64, 'button');
    text(this, layer, 112, 314, `${this.nameDraft}▏`, 22, COLORS.gold);
    text(this, layer, 90, 379, `${this.nameDraft.length}/28 characters`, 13, COLORS.muted);
    button(this, layer, 90, 477, 146, 'Cancel', () => this.open('rehearsal'));
    button(this, layer, 555, 477, 156, 'Save name', () => this.saveName(), this.nameDraft.trim().length > 0);
  }

  private saveName(): void {
    if (!this.nameDraft.trim()) return;
    this.state = { ...this.state, bandName: this.nameDraft.trim() };
    this.save(); this.open('rehearsal');
  }

  private menu(layer: Phaser.GameObjects.Container): void {
    layer.add(this.add.image(99, 197, 'logo').setOrigin(0).setDisplaySize(192, 176));
    text(this, layer, 339, 184, 'ROCK MANAGER', 25, COLORS.gold);
    text(this, layer, 339, 223, `${data.mission.name}  ·  Day ${this.state.day}`, 15, COLORS.muted);
    button(this, layer, 340, 271, 328, 'Continue', () => this.open(null), this.state.started);
    button(this, layer, 340, 318, 328, 'Mission briefing', () => this.open('briefing'));
    button(this, layer, 340, 365, 328, 'New mission', () => this.open('reset'));
    button(this, layer, 340, 412, 158, 'How to play', () => this.open('help'));
    button(this, layer, 510, 412, 158, 'Fullscreen', () => this.scale.toggleFullscreen());
    text(this, layer, 92, 487, 'Mission01 opening prototype — city, recruitment and weekly wages.', 13, COLORS.muted, 616);
  }

  private help(layer: Phaser.GameObjects.Container): void {
    text(this, layer, 90, 191, 'First Steps', 28, COLORS.gold);
    text(this, layer, 90, 239,
      'Open Rehearsal from the top bar. Choose one of the five positions, pick an available musician and recruit them. Each musician can fill only one position.\n\nName your band, return to the city, and use Play or Advance one day. Wages are paid every seventh day. Time pauses while a dialog is open.\n\nYour progress saves in this browser. Arrow keys or the bottom arrows scroll the city. Escape closes dialogs.\n\nRecording, contracts, sales and the remaining mission objectives are the next stage of this recreation.',
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
    if (event.key === 'Escape' && this.state.started) this.open(this.modal ? null : 'menu');
    if (event.key === ' ' && !this.modal && this.state.started) {
      event.preventDefault(); this.running = !this.running; this.clock = 0; this.drawHud();
    }
  }

  update(_time: number, delta: number): void {
    if (!this.state) return;
    if (!this.modal) {
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
