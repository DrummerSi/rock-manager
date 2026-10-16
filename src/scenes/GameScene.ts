import {loadCareer,saveCareer,recordCareer,careerAvailability,careerTotal,type Career} from '../game/career';
import venueCards from '../game/venue-cards.json';
import {TOUR_RULES,tourAvailable,tourQuote,bookTour,cancelTour} from '../game/tour';
import {emptyTourDraft,tourWindow,tourCityWindow,tourStageWindow,tourExpenseWindow,tourBookingWindow,tourOngoingWindow,tourResultWindow} from '../ui/tour-windows';
import {GANGSTA_RULES,gangstaAvailable,gangstaActions,gangstaPrice,canUseGangsta,useGangsta,bookSecurity,resolveGangstaCard,gangstaSpeech} from '../game/gangsta';
import {gangstaWindow,gangstaTargetWindow} from '../ui/gangsta-windows';
import {VIDEO_RULES,videoAvailable,currentVideo,canBookVideo,bookVideo} from '../game/video';
import {videoWindow,videoBookingWindow} from '../ui/video-windows';
import { NativeText } from '../ui/native-text';
import actorAssets from '../generated/actor-animation.json';
import { renderEventCard } from '../ui/event-card';
import { mission01RehearsalExit, pendingMission01Guidance } from '../game/mission01-tutorial';
import missionCards from '../game/mission01-cards.json' with {type:'json'};
import { evaluateMissionProgress, recordMissionFailure, confirmMissionFailure, acknowledgeMissionResult, missionObjectives, missionEnding, MISSION_ENDINGS } from '../game/mission-progress';
import {missionResultWindow} from '../ui/mission-windows';
import {publisherWindow,bandNameWindow,missionIntroWindow,missionChooseWindow,mixerExitWindow,mainMenuWindow} from '../ui/source-windows';
import {nativeMeter} from '../ui/native-meter';
import {renderMixWav} from '../game/render-mix';
import {labelRefusalWindow} from '../ui/label-refusal-window';
import sourceConfirmations from '../generated/source-confirmations.json';
import originalText from '../game/original-text.json' with {type:'json'};
import { availableBandmateActions, bandmateConcerns, bandmateStats, bandmateMood, bandmateGreeting, effectiveMusicians, bandmateOccupied, giveBandmateGift, trainBandmate, canTrainBandmate, changeBandmateRelations, fireBandmate, applyBandmateExitToCity, BANDMATE_RULES } from '../game/bandmates';
import { bandmateWindow, bandmateActionWindow, bandmateTrainingWindow } from '../ui/bandmate-windows';
import { createActorPortrait, type ActorPortrait, type ActorMood } from '../ui/actor-portrait';
import { PUBLICITY_RULES, bookConcert, bookAdvert, givePressKit, giveVideo, giveGift, canBookCalendar, venueAcceptance,venueBookingIssue, chartRows, currentWeekSales } from '../game/publicity';
import { activityEvents, venueWindow, mediaWindow, concertBookWindow, advertWindow, mediaActionWindow, chartWindow, agendaWindow, resultWindow } from '../ui/activity-windows';
import { defaultDesign, designCategories, designCost, bookRelease, type DesignSelection } from '../game/design';
import { designWindow, releaseWindow } from '../ui/design-windows';
import Phaser from 'phaser';
import data from '../generated/game-data.json' with { type: 'json' };
import { advanceDay, calendarDate, candidates, licenseSong, publisherSongs, newGame, recruit, SLOT_INSTRUMENTS, SLOT_NAMES } from '../game/model';
import musicBusiness from '../generated/music-business.json';
import type { GameState, Instrument, Musician } from '../game/model';
import { BrowserSaveStore } from '../game/storage';
import { infoFrame, button, COLORS, frame, meter, text, title } from '../ui/canvas-ui';
import { cursorStyle } from '../ui/cursors';
import { initialCityAnimation, tickCityAnimation } from '../game/city-animation';
import type { CityAnimationState } from '../game/city-animation';
import { chooseSessionMusician, contractOffers, evaluateDemo, demoRefusalVoice, finishRecording, signContract, startRecording, updateChannel,approveContractDemo,recordableSongIds,currentAlbumSigned,cancelRecordContract } from '../game/recording';
import { FeedbackAudio } from '../game/feedback-audio';
import sourceAudio from '../generated/source-window-audio.json';
import { RecordingAudio } from '../game/recording-audio';
import { NativeDisplay } from '../ui/native-display';
import {missionDefinition,missionCards as scenarioCards,type MissionId,isMissionId} from '../game/mission-catalog';
import {newMission} from '../game/missions';
import {scenarioEvent,scenarioText} from '../game/scenarios';
import type {ScenarioEvent} from '../game/scenario-types';
import {scenarioWindow} from '../ui/scenario-window';
import {introSegments} from '../ui/mission-intro-sequence';
import {scenarioBooking} from '../ui/scenario-booking';
import {completeScenarioQuit,scenarioQuitOccupied} from '../game/scenario-quits';
import { labelSurveyWindow, channelSettingsWindow, contractWindow, labelWindow, mixerWindow, sessionWindow, studioWindow } from '../ui/tutorial-windows';

type Modal = 'venue-notice'|'tour'|'tour-city'|'tour-stage'|'tour-expenses'|'tour-book'|'tour-ongoing'|'tour-result'|'tour-cancel'|'tour-intro'|'tour-complete'|'label-action' | 'label-survey' | 'gangsta' | 'gangsta-action' | 'gangsta-target' | 'gangsta-security' | 'gangsta-card' | 'video' | 'video-book' | 'video-card' | 'scenario-book' | 'scenario-event' | 'mission-result' | 'mission-warning' | 'bandmate' | 'bandmate-action' | 'bandmate-training' | 'training-result' | 'artist-away' | 'briefing' | 'rehearsal' | 'recruit' | 'rename' | 'menu' | 'help' | 'reset' | 'publisher' | 'songs' | 'missions' | 'quit' | 'studio' | 'mixer' | 'settings' | 'finish-demo' | 'replace-demo' | 'session' | 'label' | 'contract' | 'rejection' | 'design' | 'release' | 'venue' | 'concert-book' | 'media' | 'advert' | 'media-action' | 'chart' | 'agenda' | 'activity-result' | null;
const musicians: Musician[] = data.allMusicians;
const money = (value: number) => value.toLocaleString('en-GB');

export class GameScene extends Phaser.Scene {
  private state!: GameState;
  private storage = new BrowserSaveStore();
  private career:Career={version:1,missions:{}};
  private world!: Phaser.GameObjects.Container;
  private hud!: Phaser.GameObjects.Container;
  private modalLayer?: Phaser.GameObjects.Container;
  private parentModalLayer?: Phaser.GameObjects.Container;
  private settingsParentLayer?: Phaser.GameObjects.Container;
  private parentModalKind: Modal = null;
  private selectedStudioId = 'Studio01';
  private selectedLabelId = 'Record01';
  private selectedPublisherId = 'Publish01';
  private offerIndex = 4;
  private designSelection: DesignSelection = defaultDesign();
  private releaseDay = 6;
  private releaseFirstDay = 0;
  private selectedVenueId = 'Live01';
  private selectedMediaId = 'Media02';
  private gangstaOffset=0;
  private gangstaCategoryId='ActCatGangTamper';
  private gangstaActionId='ActGangStreet';
  private gangstaTargetIndex=0;
  private tourDraft=emptyTourDraft();
  private tourCityId='';
  private tourResultIndex=0;
  private tourExpenseIndex=0;
  private tourStageSelection:string[]=[];
  private videoIndex=0;
  private videoCardId='ECOCVideoDone';
  private mediaOffset = 0;
  private selectedActionId = 'ActMediaGivePressKit';
  private selectedAdvertId = 'AdFM01';
  private activityDay = 2;
  private activityDuration = 5;
  private activityFirstDay = -3;
  private bandmateCategoryId = 'ActCatMusicianGifts';
  private bandmateActionId = 'ActGiftDrink01';
  private bandmateModalLayer?: Phaser.GameObjects.Container;
  private actorPortraits: { layer: Phaser.GameObjects.Container; actor: ActorPortrait; speechKey?:string }[] = [];
  private recruitSpeechId = '';
  private trainingResultId = '';
  private activeActivityResultId = '';
  private selectedChannel = 0;
  private sessionReturn: 'mixer' | 'settings' = 'mixer';
  private recordingAudio = new RecordingAudio();
  private labelAuditioning = false;
  private labelAuditionGeneration = 0;
  private labelAuditionTimer?: Phaser.Time.TimerEvent;
  private mixerMaster = 0.5;
  private recruitDragging = false;
  private recruitDragOffset = 0;
  private recruitMaxOffset = 0;
  private modal: Modal = null;
  private tutorialLayer?: Phaser.GameObjects.Container;
  private tutorialId: string | null = null;
  private tutorialButtonY = 0;
  private venueIssue:{cardId:string;reason?:string}={cardId:'ECOCVenueNotLikeStyle'};
  private venueNoticeReturn:Modal='venue';
  private moneyLabel!: Phaser.GameObjects.Text;
  private dateLabel!: Phaser.GameObjects.Text;
  private dateAnimationStarted = -Infinity;
  private scroll = 200;
  private running = true;
  private feedbackAudio = new FeedbackAudio();
  private failedAssets = new Set<string>();
  private clock = 0;
  private selectedSlot = 0;
  private recruitOffset = 0;
  private selectedId = '';
  private selectedSongId = '';
  private publisherOffset = 0;
  private missionOffset = 0;
  private selectedMissionId:MissionId='Mission01';
  private beforeScenarioBooking?:GameState;
  private selectedInstrument: Instrument = 'Guitar';
  private nameDraft = '';
  private ambient?: Phaser.Sound.BaseSound;
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private hasSaved = false;
  private handledKeyEvents = new WeakSet<KeyboardEvent>();
  private cityClock = 0;
  private cityLayers: { placeId: string | null; image: Phaser.GameObjects.Image;
    track: typeof data.city.tracks[number] | null; state: CityAnimationState }[] = [];
  private cityZones: { id: string; zone: Phaser.GameObjects.Rectangle }[] = [];

  constructor() { super('Game'); }

  preload(): void {
    this.failedAssets.clear();
    const progress = this.add.graphics();
    this.add.text(400, 270, 'ROCK MANAGER', { fontFamily: 'Georgia', fontSize: '28px', color: '#dfc18a' }).setOrigin(0.5);
    const status = this.add.text(400, 310, 'Loading First Steps…', { fontFamily: 'Arial', fontSize: '16px', color: '#c2b6b3' }).setOrigin(0.5);
    const onProgress = (amount: number) => {
      progress.clear().fillStyle(0x3d2837).fillRect(240, 344, 320, 6)
        .fillStyle(0xdfc18a).fillRect(240, 344, 320 * amount, 6);
      status.setText(`Loading First Steps… ${Math.floor(amount*100)}%`);
    };
    const onError = (file: Phaser.Loader.File) => { this.failedAssets.add(file.key); };
    this.load.on('progress', onProgress);
    this.load.on('loaderror', onError);
    this.events.once('shutdown', () => { this.load.off('progress', onProgress); this.load.off('loaderror', onError); });
    for (const [key, filename] of Object.entries(data.images)) this.load.image(key, `${import.meta.env.BASE_URL}assets/${filename}`);
    this.load.audio('ambience', `${import.meta.env.BASE_URL}assets/city-ambience.wav`);
  }

  create(): void {
    this.children.removeAll(true);
    if(this.failedAssets.size){
      this.add.text(400,250,'Some game files could not be loaded.\nCheck your connection, then retry.',{fontFamily:'Arial',fontSize:'18px',color:'#eeeeee',align:'center'}).setOrigin(.5);
      this.add.rectangle(400,340,180,44,0x3d2837).setInteractive({cursor:'pointer'}).once('pointerup',()=>this.scene.restart());
      this.add.text(400,340,'Retry loading',{fontFamily:'Arial',fontSize:'18px',color:'#ffffff'}).setOrigin(.5);
      return;
    }
    if (this.game.renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer) {
      this.game.renderer.pipelines.addPostPipeline('NativeDisplay', NativeDisplay);
      this.cameras.main.setPostPipeline('NativeDisplay');
    }
    this.state = evaluateMissionProgress(this.storage.load(musicians) ?? newMission('Mission01',musicians));
    this.selectedMissionId=this.state.missionId;
    this.career=loadCareer(this.state);saveCareer(this.career);
    this.hasSaved = this.state.started;
    this.feedbackAudio.registerSources(sourceAudio.recovered);
    this.feedbackAudio.setMuted(this.state.muted);
    this.recordingAudio.setMuted(this.state.muted);
    this.sound.mute = this.state.muted;
    this.input.on('pointerdown', () => this.feedbackAudio.unlock());
    this.input.keyboard?.on('keydown', () => this.feedbackAudio.unlock());
    this.events.once('shutdown', () => this.feedbackAudio.destroy());
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
        if (!this.modal && (hotspot.id === 'publish01'||hotspot.id==='publish02')) {
          if (this.state.tutorialEnabled && !this.state.seenTutorials.includes('ECOCMis1IntroducePublisher')) {
            this.toast('Visit the Practice Room first.'); return;
          }
          this.selectedPublisherId='Publish'+hotspot.id.slice(-2);this.publisherOffset=0;this.open('publisher'); return;
        }
        if (!this.modal && data.tutorialGameplay.studios.some(s=>s.id.toLowerCase()===hotspot.id)) {
          this.selectedStudioId = 'Studio'+hotspot.id.slice(-2);
          this.open(this.state.recording ? 'mixer' : 'studio'); return;
        }
        if (!this.modal && data.tutorialGameplay.labels.some(s=>s.id.toLowerCase()===hotspot.id)) {
          this.selectedLabelId = 'Record'+hotspot.id.slice(-2); this.open('label'); return;
        }
        if (!this.modal && PUBLICITY_RULES.venues.some(v => v.id.toLowerCase() === hotspot.id)) { this.selectedVenueId = PUBLICITY_RULES.venues.find(v => v.id.toLowerCase() === hotspot.id)!.id; this.open('venue'); return; }
        if (!this.modal && PUBLICITY_RULES.media.some(m => m.id.toLowerCase() === hotspot.id)) { this.selectedMediaId = PUBLICITY_RULES.media.find(m => m.id.toLowerCase() === hotspot.id)!.id; this.mediaOffset = 0; this.open('media'); return; }
        if(!this.modal&&hotspot.id==='gangsta01'){this.gangstaOffset=0;this.open('gangsta');return;}
        if(!this.modal&&hotspot.id==='tour01'){this.open(this.state.tour&&!this.state.tour.completed?'tour-ongoing':'tour');if(!this.state.scenario?.vars.tourIntroduced&&this.modal==='tour')this.open('tour-intro');return;}
        if(!this.modal&&hotspot.id==='video01'){this.videoIndex=0;this.open('video');return;}
        if (!this.modal && hotspot.id === 'design01') { this.designSelection = defaultDesign(this.state.missionId); this.open('design'); return; }
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
    this.ambient = this.sound.add('ambience', { loop: true, volume: 0.35 });
    this.open('menu');
    if (import.meta.env.DEV) {
      Object.assign(window, { __rockManager: { snapshot: () => ({ ...structuredClone(this.state), objectives:missionObjectives(this.state), missionEnding:missionEnding(this.state,data.songs.find(s=>s.id===this.state.demo?.songId)?.name), modal: this.modal,
        dialogTexts: this.dialogTextObjects(this.modalLayer).map(t => ({text:t.text,x:t.x,y:t.y,width:t.width,height:t.height,font:t.style.fontFamily,size:t.style.fontSize,spacing:t.letterSpacing,nativeFont:(t as NativeText).nativeFontId})), running: this.running, feedbackAudio: this.feedbackAudio.diagnostics, speechPlayback: this.feedbackAudio.playback, actors: this.actorPortraits.filter(item => item.layer.scene === this).map(item => item.actor.diagnostics), tutorialId: this.tutorialId, tutorialButtonY: this.tutorialButtonY, scene: 'Game',
        backgroundModal: this.settingsParentLayer ? 'settings' : this.parentModalKind, recruitOffset: this.recruitOffset, recruitMaxOffset: this.recruitMaxOffset,
        cityAudio:{playing:Boolean(this.ambient?.isPlaying&&!this.ambient?.isPaused)},sourceLayout:this.modalLayer?.getData('sourceLayout'),eventCardButtons:this.modalLayer?.getData('eventCardButtons'),eventCardBounds:this.tutorialLayer?.getData('eventCardBounds')??this.modalLayer?.getData('eventCardBounds'), moodPortraits:this.state.band.map(m=>m?{id:m.musicianId,medium:this.moodPortrait(m.musicianId,'medium'),large:this.moodPortrait(m.musicianId,'large')}:null),
        selectedStudioId: this.selectedStudioId, selectedLabelId: this.selectedLabelId, offerIndex: this.offerIndex, previewPlaying: this.recordingAudio.playing, labelAuditioning:this.labelAuditioning, recordingPlayback: this.recordingAudio.diagnostics,
        mixerKnobs: (this.modalLayer?.list ?? []).filter((object) => object instanceof Phaser.GameObjects.Image && object.name.startsWith('mixer-knob-')).map((object) => {
          const sprite = object as Phaser.GameObjects.Image;
          const reg = data.tutorialMedia.find((m) => m.key === sprite.texture.key)!;
          return { name: sprite.name, key: sprite.texture.key, x: sprite.x, y: sprite.y, anchorX: sprite.x + reg.regX, anchorY: sprite.y + reg.regY };
        }),
        availablePlaces: this.cityZones.filter((z) => this.isPlaceAvailable(z.id)).map((z) => z.id),
        cityFrames: this.cityLayers.filter((l) => l.track).map((l) => ({ name: l.track!.name, offset: l.state.offset, visible: l.image.visible })),
        designSelection: [...this.designSelection], releaseDay: this.releaseDay, releaseFirstDay: this.releaseFirstDay, selectedVenueId: this.selectedVenueId, selectedMediaId: this.selectedMediaId, mediaOffset: this.mediaOffset, selectedActionId: this.selectedActionId, selectedAdvertId: this.selectedAdvertId, activityDay: this.activityDay, activityDuration: this.activityDuration, activityFirstDay: this.activityFirstDay, activeActivityResultId: this.activeActivityResultId, loadedTextures: Object.keys(data.images).length }) } });
    }
  }

  private dialogTextObjects(container?: Phaser.GameObjects.Container): Phaser.GameObjects.Text[] {
    return container?.list.flatMap(object=>object instanceof Phaser.GameObjects.Text?[object]:object instanceof Phaser.GameObjects.Container?this.dialogTextObjects(object):[])??[];
  }

  private isPlaceAvailable(id: string): boolean {
    if (!this.state.started || this.missionHasEnded()) return false;
    if(id==='live05'&&this.state.missionId==='Mission01')return false;
    if(id==='media01'&&missionDefinition(this.state.missionId).neverPlaces.includes('Media01'))return false;
    if(id==='gangsta01')return gangstaAvailable(this.state);
    if(id==='tour01')return tourAvailable(this.state);
    if(id==='video01')return videoAvailable(this.state);
    if(this.state.missionId!=='Mission01'){
      const definition=missionDefinition(this.state.missionId),nativeId=data.hotspots.find(p=>p.id===id)?.id??id;
      // Mission03 LeaveMixer explicitly makes Live01–05 available, including
      // Live05 despite its initial NeverAvailable entry.
      const unlockedVenue=this.state.missionId==='Mission03'&&id==='live05'&&Boolean(this.state.demo);
      if(!unlockedVenue&&definition.neverPlaces.some(p=>p.toLowerCase()===nativeId))return false;
      if(['Mission05','Mission06','Mission07','Mission08'].includes(this.state.missionId)&&definition.availablePlaces.some(p=>p.toLowerCase()===id))return true;
      if(id.startsWith('publish'))return true;
      if(id.startsWith('studio'))return this.state.ownedSongs.length>0;
      if(id.startsWith('record'))return this.state.contract?this.state.contract.labelId.toLowerCase()===id:Boolean(this.state.demo);
      if(id==='design01')return Boolean(this.state.demo&&this.state.contract&&this.state.contract.approved!==false);
      if(id.startsWith('live'))return Boolean(this.state.demo);
      if(id==='media03'&&this.state.scenario?.vars.cityNewsClosed)return false;
      if(PUBLICITY_RULES.media.some(m=>m.id.toLowerCase()===id))return Boolean(this.state.album);
      return false;
    }
    if (id === 'publish01') return !this.state.tutorialEnabled || this.state.seenTutorials.includes('ECOCMis1IntroducePublisher');
    if (id === 'studio01' || id === 'studio04') return this.state.ownedSongs.length > 0
      && (!this.state.tutorialEnabled || this.state.seenTutorials.includes('ECOCMis1IntroduceStudio'));
    if (PUBLICITY_RULES.venues.some(v => v.id.toLowerCase() === id)) return Boolean(this.state.demo) && (!this.state.tutorialEnabled || this.state.seenTutorials.includes('ECOCMis1IntroduceSleeve') || this.state.seenTutorials.includes('ECOCMis1NoContract'));
    if (PUBLICITY_RULES.media.some(m => m.id.toLowerCase() === id)) return Boolean(this.state.album) && (!this.state.tutorialEnabled || this.state.seenTutorials.includes('ECOCMis1IntroduceMedia'));
    if (id === 'design01') return Boolean(this.state.demo) && (!this.state.tutorialEnabled || this.state.seenTutorials.includes('ECOCMis1IntroduceSleeve'));
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
      media05: 'Record store / charts', tour01: 'Spotlight Tours', video01: VIDEO_RULES.studio.name,
    };
    return PUBLICITY_RULES.venues.find(v => v.id.toLowerCase() === id)?.name ?? PUBLICITY_RULES.media.find(m => m.id.toLowerCase() === id)?.name ?? names[id] ?? (id.startsWith('studio') ? 'Recording studio' : 'Concert venue');
  }

  private hudText(x: number, y: number, value: string, color: string): Phaser.GameObjects.Text {
    const label = text(this, this.hud, x, y, value, 10, color).setFontFamily('Verdana').setFontStyle('bold').setLineSpacing(0);
    if (label instanceof NativeText) label.setNativeAntialias(true); return label;
  }

  private drawHud(): void {
    this.hud.removeAll(true);
    this.hud.add(this.add.image(0, 0, 'hud').setOrigin(0));
    this.hudText(337, 28, 'Band', '#b4b4b4');
    for (let slot = 0; slot < 5; slot++) {
      const x = 272 + slot * 50;
      const member = this.state.band[slot];
      if (member) this.hud.add(this.add.image(x, 51, this.moodPortrait(member.musicianId, 'medium')).setOrigin(0));
      const hit = this.add.rectangle(x, 50, 48, 49, 0xffffff, 0).setOrigin(0).setInteractive({ cursor: cursorStyle('active') });
      this.hud.add(hit);
      hit.on('pointerup', () => { if (!this.modal && this.state.started) { this.selectedSlot = slot; this.open('rehearsal'); } });
    }
    this.hudText(698, 32, 'Assets', '#b4b4b4');
    const agendaHit = this.add.zone(665, 17, 95, 104).setOrigin(0).setInteractive({ cursor: cursorStyle('active') }); this.hud.add(agendaHit); agendaHit.on('pointerup', () => { if (!this.modal && this.state.started) { this.activityFirstDay = this.state.day - 8; this.open('agenda'); } });
    this.hudText(698, 80, 'Date', '#b4b4b4');
    this.moneyLabel = this.hudText(711, 54, money(this.state.money), '#eeeeee').setOrigin(0.5, 0);
    this.dateLabel = this.hudText(711, 109, this.headerDate(), '#eeeeee').setOrigin(0.5);
    this.animateDate();
    this.hud.add(this.add.image(273, 20, 'rehearsal').setOrigin(0));
    const rehearsalHit = this.add.rectangle(270, 19, 253, 80, 0xffffff, 0).setOrigin(0).setInteractive({ cursor: cursorStyle('active') });
    this.hud.add(rehearsalHit);
    rehearsalHit.on('pointerup', () => { if (!this.modal && this.state.started) this.open('rehearsal'); });
    this.hudText(83, 118, 'Main menu', '#b4b4b4').setOrigin(0.5);
    const menuHit = this.add.rectangle(33, 20, 101, 94, 0xffffff, 0).setOrigin(0).setInteractive({ cursor: cursorStyle('active') });
    this.hud.add(menuHit);
    menuHit.on('pointerup', () => { if (!this.modal) this.open('menu'); });
    // Keep prototype transport controls inside the recovered surround. The
    // original BITD masks supply the sides and lower curves, without stretching.
    this.hud.add(this.add.image(40, 550, 'city-frame-bottom').setOrigin(0));
    for (const mask of data.cityFrame) {
      const image = this.add.image(mask.x, mask.y, mask.key).setOrigin(0);
      // The opaque header covers the upper portion in the original score.
      image.setCrop(0, 144 - mask.y, image.width, image.height - (144 - mask.y));
      this.hud.add(image);
    }
    this.updateStatus();
  }

  private save(): void {
    this.career=recordCareer(this.career,this.state);saveCareer(this.career);
    this.hasSaved = this.storage.save(this.state);
    if (!this.hasSaved) this.toast('Browser storage is unavailable. This session cannot be saved.', 6000);
  }

  // Prototype status/debug messages are not part of the original HUD.
  private toast(message:string,_duration=3000):void {
    if(/(?:cannot afford|can't afford|not enough (?:cash|money)|insufficient funds)/i.test(message)&&this.modal!=='venue-notice'){
      this.venueIssue={cardId:'ECOCNoMoneyWarning'};this.venueNoticeReturn=this.modal;this.open('venue-notice');
    }
  }
  private updateStatus():void {}

  private tickDay(): void {
    if(this.modal&&this.modal!=='tour-ongoing' || this.tutorialId || this.missionHasEnded() || this.state.missionProgress?.pendingFailure) return;
    void this.feedbackAudio.play('Tick', true);
    const oldSales = this.state.publicity.totalSales;
    const oldTourResults=this.state.tour?.results.length??0;
    const result = advanceDay(this.state, musicians);
    this.state = result.state;
    this.save();
    this.moneyLabel.setText(money(this.state.money));
    this.dateAnimationStarted = this.time.now;
    if (result.unpaid) this.toast(`Cannot cover ${money(result.unpaid)} in weekly wages.`, 4500);
    else if (this.state.album?.releaseDay === this.state.day) this.toast('Your album has been released.', 4500);
    else if (result.wages) this.toast(`Payday: ${money(result.wages)} paid in weekly wages.`, 4500);
    else if (this.state.publicity.totalSales > oldSales) this.toast(`${Math.round(this.state.publicity.totalSales - oldSales)} records sold today.`, 4500);
    this.drawHud();
    if((this.state.tour?.results.length??0)>oldTourResults){this.tourResultIndex=oldTourResults;this.open('tour-result');return;}
    if(this.state.tour&&!this.state.tour.seen&&this.state.day>=this.state.tour.startDay){this.open('tour-ongoing');return;}
    if (!this.presentMissionOutcome() && !this.presentNextActivityResult()) this.showProgressTutorial();
  }

  private headerDate(): string {
    const [year, month, day] = this.state.startDate.split('-').map(Number);
    return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' })
      .format(new Date(Date.UTC(year, month - 1, day + this.state.day))).replace(/\/(?=\d{4}$)/, ' ');
  }

  private animateDate(): void {
    // DateDisplayScript.timeTick increments before indexing this source list.
    const scales = [1.1, 1.3, 1.5, 1.3, 1.2, 1.1, 1];
    const frame = Math.floor((this.time.now - this.dateAnimationStarted) * data.city.movieFPS / 1000);
    this.dateLabel?.setScale(frame >= 0 && frame < scales.length - 1 ? scales[frame + 1] : 1);
  }

  private toggleSound(): void {
    this.state = { ...this.state, muted: !this.state.muted };
    this.sound.mute = this.state.muted;
    this.feedbackAudio.setMuted(this.state.muted);
    this.recordingAudio.setMuted(this.state.muted);
    this.save(); this.drawHud();
  }

  private open(kind: Modal): void {
    this.state=evaluateMissionProgress(this.state);
    if(kind===null && this.missionHasEnded())kind='mission-result';
    else if(kind===null && this.state.missionProgress?.pendingFailure)kind='mission-warning';
    const previous = this.modal;
    if(previous!==kind&&this.labelAuditioning){this.labelAuditioning=false;this.labelAuditionGeneration++;this.labelAuditionTimer?.remove();this.labelAuditionTimer=undefined;}
    if(kind)this.ambient?.stop(); // ScrollingCityScript.pause kills city sound under windows.
    if(kind==='publisher'&&previous!=='publisher'){this.selectedSongId='';this.publisherOffset=0;}
    if (previous !== kind) this.feedbackAudio.stop();
    // Native focusChange starts place audio only on a newly opened place;
    // a child takes focus away, and returning does not replay its entrance cue.
    if(previous!==kind){
      this.feedbackAudio.stopPlace();
      const returning=previous==='concert-book'&&kind==='venue';
      if(kind==='venue'&&!returning)void this.feedbackAudio.playPlace(this.selectedVenueId);
      if(kind==='gangsta'&&!['label-action','label-survey','gangsta-action','gangsta-target','gangsta-security'].includes(previous??''))this.feedbackAudio.template(gangstaSpeech(this.state));
      if(kind==='video'&&previous!=='video-book')void this.feedbackAudio.playPlace('Video01');
      if(kind==='studio'&&previous!=='replace-demo')void this.feedbackAudio.playPlace(this.selectedStudioId);
    }
    // These SoundScript objects belong to the dialog, not a render pass.
    if(kind==='briefing'&&previous!==kind&&this.state.missionId==='Mission01')void this.feedbackAudio.play('Intro01_01',false,1);
    if(kind==='mission-result'&&previous!==kind&&this.state.missionProgress?.status==='lost')void this.feedbackAudio.play('A131',false,.7);
    if(kind==='activity-result'&&previous!==kind){
      const review=this.state.publicity.reviews.find(r=>r.id===this.activeActivityResultId);
      if(review&&(review.mediaId==='Media03'||review.mediaId==='Media04'))void this.feedbackAudio.play('Snare',true,.7);
    }
    if (kind === 'media' && previous !== 'media' && previous !== 'media-action' && previous !== 'advert' && previous !== 'chart') this.feedbackAudio.greeting(this.selectedMediaId, this.state.publicity.reporters.find(r => r.mediaId === this.selectedMediaId)?.mood ?? .5);
    if (kind === 'label' && previous !== 'label' && previous !== 'contract' && previous !== 'rejection' && previous !== 'label-action' && previous !== 'label-survey') {
      if(this.state.contract?.labelId===this.selectedLabelId)this.feedbackAudio.labelSpeech(this.selectedLabelId,'contractGreeting');
      else this.feedbackAudio.greeting(this.selectedLabelId);
    }
    if(kind==='contract'&&previous!=='contract')this.feedbackAudio.labelSpeech(this.selectedLabelId,'contract');
    if (kind === 'activity-result') {
      const result = this.state.publicity.concertResults.find(r => r.id === this.activeActivityResultId);
      if (result && !result.cancelled) {
        const venue = PUBLICITY_RULES.venues.find(v => v.id === result.venueId)!;
        this.feedbackAudio.concert(result.venueId, result.satisfaction, result.audience / venue.size);
      }
    }
    const suspend = (container: Phaser.GameObjects.Container) => {
      for (const object of container.list) {
        if (object.input) object.disableInteractive();
        if (object instanceof Phaser.GameObjects.Container) suspend(object);
      }
    };
    if (previous === 'settings' && kind === 'session') {
      this.settingsParentLayer = this.modalLayer;
      this.settingsParentLayer?.setDepth(49.5);
      if (this.settingsParentLayer) suspend(this.settingsParentLayer);
      this.modalLayer = undefined;
    } else {
      this.settingsParentLayer?.destroy(true); this.settingsParentLayer = undefined;
    }
    if (previous === 'bandmate' && (kind === 'bandmate-action' || kind === 'bandmate-training')) {
      this.bandmateModalLayer = this.modalLayer; this.bandmateModalLayer?.setDepth(49.5);
      if (this.bandmateModalLayer) suspend(this.bandmateModalLayer); this.modalLayer = undefined;
    } else if (kind !== 'bandmate-action' && kind !== 'bandmate-training') {
      this.bandmateModalLayer?.destroy(true); this.bandmateModalLayer = undefined;
    }
    const bandChild = kind === 'artist-away' || kind === 'bandmate' || kind === 'bandmate-action' || kind === 'bandmate-training' || kind === 'recruit' || kind === 'rename' || kind === 'songs';
    const child = bandChild || kind === 'venue-notice' || kind === 'contract' || kind === 'rejection' || kind === 'session' || kind === 'settings' || kind === 'finish-demo' || kind === 'replace-demo' || kind === 'release' || ['tour-result','tour-cancel','tour-intro','tour-city','tour-stage','tour-expenses','tour-book','gangsta-action','gangsta-target','gangsta-security','gangsta-card','video-book','video-card','concert-book','advert','media-action','chart'].includes(kind ?? '');
    const isParent = previous === 'tour-ongoing' || previous === 'tour' || previous === 'rehearsal' || previous === 'label' || previous === 'mixer' || previous === 'studio' || previous === 'design' || previous === 'concert-book' || previous === 'venue' || previous === 'media' || previous === 'video' || previous==='gangsta';
    if (child && isParent && previous !== kind) {
      // Replacing the retained parent must also remove its suspended graphics.
      // Calendar redraws keep their existing parent rather than orphaning it.
      this.parentModalLayer?.destroy(true);
      this.parentModalLayer = this.modalLayer; this.parentModalLayer?.setDepth(49); this.modalLayer = undefined;
      this.parentModalKind = previous;
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
      if(!this.ambient?.isPlaying)this.ambient?.play();
      this.state = applyBandmateExitToCity(this.state); this.save();
      if(previous&&previous!=='menu'&&previous!=='briefing')this.dispatchScenario({kind:'city'});
      if(this.presentMissionOutcome())return;
      if(this.state.scenario?.queue.length){this.open('scenario-event');return;}
      if (this.presentNextActivityResult()) return;
      if ((previous === 'media' || previous === 'advert') && this.state.publicity.firstMediaVisitDay === null) { this.state = { ...this.state, publicity: { ...this.state.publicity, firstMediaVisitDay: this.state.day } }; this.save(); }
      const guidance=pendingMission01Guidance(this.state,{previousModal:previous,acknowledgedDays:this.state.tutorialAcknowledgedDays});
      const next=guidance.find(id=>!id.endsWith('RequestCD'));
      if(next)this.showTutorial(next);
      return;
    }
    const layer = this.add.container(0, 0).setDepth(50);
    this.modalLayer = layer;
    const shade = this.add.rectangle(0, 0, 800, 600, 0x080508, ['gangsta-action','gangsta-target','gangsta-security','gangsta-card','video-book','video-card','release','concert-book','advert','media-action','chart','bandmate-action','bandmate-training'].includes(kind) ? 0 : 0.25).setOrigin(0).setInteractive();
    layer.add(shade);
    if (kind.startsWith('tour')||kind === 'menu'||kind==='venue-notice'||kind==='gangsta'||kind==='gangsta-action'||kind==='gangsta-target'||kind==='gangsta-security'||kind==='gangsta-card'||kind==='video'||kind==='video-book'||kind==='video-card'||kind==='scenario-event'||kind==='scenario-book') { /* Source renderers derive their own surround. */ }
    else if (kind === 'recruit') frame(this, layer, 293, 95, 358, 483, 'dialog');
    else if (kind === 'rehearsal') frame(this, layer, 60, 77, 683, 462, 'dialog');
    else if (['label-action','label-survey','quit','reset','finish-demo','replace-demo','rejection','publisher','rename','missions','briefing','studio', 'mixer', 'settings', 'label', 'contract', 'session', 'design', 'release', 'venue', 'concert-book', 'media', 'advert', 'media-action', 'chart', 'agenda', 'activity-result', 'bandmate', 'bandmate-action', 'bandmate-training', 'training-result', 'artist-away', 'mission-result', 'mission-warning'].includes(kind)) { /* Native window functions compose their own recovered frames. */ }
    else frame(this, layer, 48, 154, 704, 396, 'dialog');
    if (kind === 'publisher' || kind === 'songs') this.songDialog(layer, kind === 'publisher');
    if (kind === 'briefing') this.briefing(layer);
    if (kind === 'scenario-event') this.scenarioCard(layer);
    if(kind==='scenario-book')this.bookScenarioAppointment(layer);
    if (kind === 'rehearsal') this.rehearsal(layer);
    if (kind === 'recruit') this.recruitment(layer);
    if (kind === 'bandmate') { this.bandmate(layer); if (previous !== 'bandmate' && previous !== 'bandmate-action' && previous !== 'bandmate-training') this.feedbackAudio.template(bandmateGreeting(this.state, this.selectedId)); }
    if (kind === 'bandmate-action') this.bandmateAction(layer);
    if (kind === 'bandmate-training') this.bandmateTraining(layer);
    if (kind === 'training-result') this.trainingResult(layer);
    if (kind === 'artist-away') renderEventCard(this,layer,{headline:'Gone Fishing',text:'This artist is busy elsewhere.',windowTitle:'Info',icon:'megaphone',onConfirm:()=>this.open('rehearsal')});
    if (kind === 'rename') this.rename(layer);
    if (kind === 'menu') this.menu(layer);
    if (kind === 'help') this.help(layer);
    if (kind === 'mission-result') this.missionResult(layer);
    if (kind === 'mission-warning') this.missionWarning(layer);
    if (kind === 'reset') this.resetConfirmation(layer);
    if (kind === 'missions') this.missionSelection(layer);
    if (kind === 'quit') this.quitConfirmation(layer);
    if (kind === 'design') designWindow(this, layer, this.state, musicians, this.designSelection, (index, direction) => {
      const options = designCategories(this.state.missionId)[index].elements; const next = [...this.designSelection]; next[index] = options[(options.indexOf(next[index]) + direction + options.length) % options.length]; this.designSelection = next; this.open('design');
    }, () => {
      if (!this.state.contract) { this.toast('Sign a record contract before scheduling this album.'); return; }
      if (designCost(this.designSelection) > this.state.money) { this.toast('You cannot afford this cover design.'); return; }
      this.releaseDay = this.closestActivityDay('release', this.state.day + 6, 1); this.releaseFirstDay = this.state.day - 3; this.open('release');
    }, () => this.open(null));
    if (kind === 'release') releaseWindow(this, layer, this.state, musicians, this.designSelection, this.releaseDay, this.releaseFirstDay,
      day => { this.releaseDay = day; this.open('release'); }, direction => { this.releaseFirstDay = Phaser.Math.Clamp(this.releaseFirstDay + direction, this.state.day - 23, this.state.day + 83); this.open('release'); },
      () => { try { this.state = bookRelease(this.state, musicians, this.designSelection, this.releaseDay); this.dispatchScenario({kind:'release'});this.dispatchScenario({kind:'place',placeId:'Design01'});this.save(); this.drawHud(); this.open(null); this.toast('Cover designed and album release scheduled.'); } catch(error) { this.toast((error as Error).message); } }, () => this.open('design'), activityEvents(this.state), day => canBookCalendar(this.state, 'release', day));
    if(kind==='venue-notice'){const card=venueCards.cards.find(c=>c.ID===this.venueIssue.cardId)!;const venue=PUBLICITY_RULES.venues.find(v=>v.id===this.selectedVenueId)!;scenarioWindow(this,layer,{...card,comment:this.venueIssue.reason??card.comment},{expand:t=>t.replace(/<¤CPlace.Name>/gi,venue.name),confirm:()=>this.open(this.venueNoticeReturn)});void this.feedbackAudio.play('_EventCard',true);}
    if (kind === 'venue') venueWindow(this, layer, this.state, this.selectedVenueId, () => {
      const issue=venueBookingIssue(this.state,musicians,this.selectedVenueId);if(issue){this.venueIssue=issue;this.venueNoticeReturn='venue';this.open('venue-notice');return;}
      this.activityDay = this.closestActivityDay('concert', this.state.day + 2, 1); this.activityFirstDay = this.state.day - 3; this.open('concert-book');
    }, () => this.open(null));
    if (kind === 'concert-book') concertBookWindow(this, layer, this.state, this.selectedVenueId, this.activityDay, this.activityFirstDay,
      day => { this.activityDay = day; this.open('concert-book'); }, direction => this.scrollActivityAgenda(direction, 'concert-book'), day => canBookCalendar(this.state, 'concert', day),
      () => {const issue=venueBookingIssue(this.state,musicians,this.selectedVenueId);if(issue){this.venueIssue=issue;this.venueNoticeReturn='concert-book';this.open('venue-notice');return;}this.performActivity(()=>bookConcert(this.state,musicians,this.selectedVenueId,this.activityDay),null,'');}, () => this.open('venue'));
    if (kind === 'media') {
      mediaWindow(this, layer, this.state, this.selectedMediaId, this.mediaOffset,
        offset => { this.mediaOffset = offset; this.open('media'); }, id => this.chooseMediaCategory(id), () => this.open(null));
      const reporter = this.state.publicity.reporters.find(r => r.mediaId === this.selectedMediaId);
      const mood = (reporter?.mood ?? .5) + (reporter?.modifiers.reduce((sum,m) => sum+m.amount,0) ?? 0);
      this.bindActor(layer, this.selectedMediaId, 227, 84, mood < .2 ? 'Angry' : mood < .35 ? 'Annoyed' : mood < .65 ? 'normal' : mood < .8 ? 'Satisfied' : 'Happy');
    }
    if (kind === 'advert') advertWindow(this, layer, this.state, this.selectedMediaId, this.selectedAdvertId, this.activityDuration, this.activityDay, this.activityFirstDay,
      direction => { const choices = PUBLICITY_RULES.media.find(m => m.id === this.selectedMediaId)!.adverts; const index = Phaser.Math.Clamp(choices.indexOf(this.selectedAdvertId) + direction, 0, choices.length - 1); this.selectedAdvertId = choices[index]; this.open('advert'); },
      direction => { this.activityDuration = Phaser.Math.Clamp(this.activityDuration - direction, 1, 100); this.open('advert'); },
      day => { this.activityDay = day; this.open('advert'); }, direction => this.scrollActivityAgenda(direction, 'advert'), day => canBookCalendar(this.state, 'advert', day, this.activityDuration),
      () => this.performActivity(() => bookAdvert(this.state, this.selectedAdvertId, this.activityDay, this.activityDuration), null, 'Advert campaign booked.'), () => this.open('media'));
    if (kind === 'media-action') mediaActionWindow(this, layer, this.state, this.selectedMediaId, this.selectedActionId,
      direction => { const gifts = PUBLICITY_RULES.gifts; const index = Phaser.Math.Clamp(gifts.findIndex(g => g.id === this.selectedActionId) + direction, 0, gifts.length - 1); this.selectedActionId = gifts[index].id; this.open('media-action'); },
      () => this.performActivity(() => this.selectedActionId==='ActMediaTVGiveVideoClip'?giveVideo(this.state,this.selectedMediaId):this.selectedActionId === 'ActMediaGivePressKit' ? givePressKit(this.state, this.selectedMediaId, musicians) : giveGift(this.state, this.selectedActionId, this.selectedMediaId), 'media', this.selectedActionId==='ActMediaTVGiveVideoClip'?'':this.selectedActionId === 'ActMediaGivePressKit' ? 'Press kit delivered.' : 'Gift delivered.'), () => this.open('media'));
    if (kind === 'chart') chartWindow(this, layer, this.selectedMediaId, chartRows(this.state, this.selectedMediaId), () => this.open('media'));
    if(kind==='tour')tourWindow(this,layer,this.state,this.tourDraft,id=>{if(id==='TCRockCity')return;this.tourCityId=id;this.open('tour-city');},amount=>{this.tourDraft.rotation+=amount;this.open('tour');},()=>{this.tourStageSelection=this.tourDraft.stage.length?[...this.tourDraft.stage]:TOUR_RULES.categories.map(c=>c.elements[0]);this.open('tour-stage');},()=>{this.tourExpenseIndex=Math.max(0,TOUR_RULES.expenses.findIndex(e=>e.ID===this.tourDraft.expenseId));this.open('tour-expenses');},()=>{this.activityDay=this.state.day+3;this.activityFirstDay=this.state.day-3;this.open('tour-book');},()=>this.open(null));
    if(kind==='tour-city')tourCityWindow(this,layer,this.tourDraft,this.tourCityId,()=>{const cities=this.tourDraft.cities;this.tourDraft.cities=cities.includes(this.tourCityId)?cities.filter(id=>id!==this.tourCityId):[...cities,this.tourCityId];this.open('tour');},()=>this.open('tour'));
    if(kind==='tour-stage')tourStageWindow(this,layer,this.state,musicians,this.tourStageSelection,(i,id)=>{this.tourStageSelection[i]=id;this.open('tour-stage');},()=>{this.tourDraft.stage=[...this.tourStageSelection];this.open('tour');},()=>this.open('tour'));
    if(kind==='tour-expenses')tourExpenseWindow(this,layer,this.tourExpenseIndex,i=>{this.tourExpenseIndex=i;this.open('tour-expenses');},()=>{this.tourDraft.expenseId=TOUR_RULES.expenses[this.tourExpenseIndex].ID;this.open('tour');},()=>this.open('tour'));
    if(kind==='tour-book')tourBookingWindow(this,layer,this.state,this.tourDraft,this.activityDay,this.activityFirstDay,day=>{this.activityDay=day;this.open('tour-book');},dir=>{this.activityFirstDay+=dir;this.open('tour-book');},()=>{try{this.state=bookTour(this.state,this.tourDraft.cities,this.tourDraft.stage,this.tourDraft.expenseId,this.activityDay);this.save();this.open(null);}catch(e){this.toast((e as Error).message);}},()=>this.open('tour'));
    if(kind==='tour-ongoing')tourOngoingWindow(this,layer,this.state,()=>{this.state={...this.state,tour:{...this.state.tour!,seen:true}};this.save();this.open(this.state.tour!.cancelled?null:'tour-complete');},()=>this.open('tour-cancel'));
    if(kind==='tour-result'){
      tourResultWindow(this,layer,this.state,this.tourResultIndex,()=>{this.state={...this.state,tour:{...this.state.tour!,seenResults:this.tourResultIndex+1}};this.save();this.open('tour-ongoing');});
      const result=this.state.tour!.results[this.tourResultIndex],city=TOUR_RULES.cities.find(c=>c.ID===result.venueId)!;this.feedbackAudio.concert('Live06',result.satisfaction,result.audience/Number(city.size));
    }
    if(kind==='tour-cancel'||kind==='tour-intro'||kind==='tour-complete'){
      const card=TOUR_RULES.cards.find(c=>c.ID===(kind==='tour-cancel'?'ECOCBandTourCancel':kind==='tour-complete'?'ECOCTourComplete':'ECOCIntroduceWorldTour'))!;
      renderEventCard(this,layer,{windowTitle:card.name,headline:card.Headline,text:scenarioText(card.comment,this.state,musicians),question:card.question,icon:card.icon,confirmLabel:card.ButtonOK.name,onConfirm:()=>{if(kind==='tour-cancel'){this.state=cancelTour(this.state);this.save();this.open('tour-ongoing');}else if(kind==='tour-complete')this.open(null);else{this.state.scenario!.vars.tourIntroduced=true;this.save();this.open('tour');}},...(kind==='tour-cancel'?{cancelLabel:card.ButtonCancel.name,onCancel:()=>this.open('tour-ongoing')}:{})});
    }
    if(kind==='gangsta'){
      gangstaWindow(this,layer,this.gangstaOffset,offset=>{this.gangstaOffset=offset;this.open('gangsta');},id=>{
        this.gangstaCategoryId=id;this.gangstaActionId=gangstaActions(this.state,id)[0];
        if(id==='ActCatGangSecurity'){this.activityDay=this.state.day+1;this.activityFirstDay=this.state.day-3;this.open('gangsta-security');}else this.open('gangsta-action');
      },()=>this.open(null));this.bindActor(layer,'gangsta01',162,84);
    }
    if(kind==='gangsta-action'){
      const actions=gangstaActions(this.state,this.gangstaCategoryId),index=actions.indexOf(this.gangstaActionId);
      bandmateActionWindow(this,layer,this.state,this.gangstaCategoryId,this.gangstaActionId,canUseGangsta(this.state,this.gangstaActionId),
        direction=>{this.gangstaActionId=actions[Phaser.Math.Clamp(index+direction,0,actions.length-1)];this.open('gangsta-action');},
        ()=>{if(this.gangstaCategoryId==='ActCatGangMurder'){this.gangstaTargetIndex=0;this.open('gangsta-target');}else this.performGangstaAction();},()=>this.open('gangsta'),
        {previousEnabled:index>0,nextEnabled:index<actions.length-1,actionCount:actions.length,price:gangstaPrice(this.state,this.gangstaActionId)});
    }
    if(kind==='gangsta-target'){
      const members=this.state.band.flatMap(b=>b?[musicians.find(m=>m.id===b.musicianId)!]:[]),person=members[this.gangstaTargetIndex];
      gangstaTargetWindow(this,layer,members,this.gangstaTargetIndex,person?this.moodPortrait(person.id,'large'):'',index=>{this.gangstaTargetIndex=index;this.open('gangsta-target');},()=>this.performGangstaAction(person.id),()=>this.open('gangsta-action'));
    }
    if(kind==='gangsta-security')bandmateTrainingWindow(this,layer,this.state,'ActGangSecurity',7,this.activityDay,this.activityFirstDay,activityEvents(this.state),
      day=>{this.activityDay=day;this.open('gangsta-security');},direction=>this.scrollActivityAgenda(direction,'gangsta-security'),day=>canBookCalendar(this.state,'advert',day,7),
      ()=>{try{this.state=bookSecurity(this.state,this.activityDay,musicians);this.save();this.drawHud();this.open('gangsta');}catch(error){this.toast((error as Error).message);}},()=>this.open('gangsta'));
    if(kind==='gangsta-card')this.gangstaCard(layer);
    if(kind==='video')videoWindow(this,layer,this.videoIndex,index=>{this.videoIndex=index;this.open('video');},()=>this.beginVideoBooking(),()=>this.open(null));
    if(kind==='video-book')videoBookingWindow(this,layer,this.state,this.videoIndex,this.activityDay,this.activityFirstDay,
      day=>{this.activityDay=day;this.open('video-book');},direction=>this.scrollActivityAgenda(direction,'video-book'),
      day=>canBookVideo(this.state,VIDEO_RULES.concepts[this.videoIndex].id,day),
      ()=>this.performActivity(()=>scenarioEvent(bookVideo(this.state,VIDEO_RULES.concepts[this.videoIndex].id,this.activityDay),{kind:'action',actionId:'BookVideoProduction'},musicians),null,''),()=>this.open('video'));
    if(kind==='video-card'){
      const card=VIDEO_RULES.cards.find(c=>c.ID===this.videoCardId)!;
      const bitmap=data.activities.bitmaps.find(b=>b.name===card.Gfx);
      scenarioWindow(this,layer,card,{pictureRegistration:bitmap?{x:bitmap.regX!,y:bitmap.regY!}:undefined,portraitKey:card.Gfx?'activity-'+card.Gfx.replaceAll(' ','_').toLowerCase():undefined,expand:value=>value,confirm:()=>this.dismissVideoCard()});
    }
    if (kind === 'agenda') agendaWindow(this, layer, this.state, this.activityFirstDay, direction => this.scrollActivityAgenda(direction, 'agenda'), () => this.open(null));
    if (kind === 'activity-result') { const result = [...this.state.publicity.concertResults, ...this.state.publicity.reviews].find(r => r.id === this.activeActivityResultId); if (result) resultWindow(this, layer, this.state, musicians, result, () => this.acknowledgeActivityResult()); }
    if (kind === 'studio') this.studio(layer);
    if (kind === 'mixer') this.mixer(layer);
    if (kind === 'settings') this.channelSettings(layer);
    if(kind==='label-action')bandmateActionWindow(this,layer,this.state,'ActCatRecordCancelContract','ActRecordCancelContract',true,()=>{},()=>{this.state=cancelRecordContract(this.state);this.save();this.open(null);},()=>this.open('label'));
    if(kind==='label-survey')labelSurveyWindow(this,layer,this.state,()=>this.open('label'));
    if (kind === 'label') { this.label(layer);const signed=this.state.contract?.labelId===this.selectedLabelId;this.bindActor(layer, this.selectedLabelId, signed?162:167, signed?114:118); }
    if (kind === 'contract') this.contract(layer);
    if (kind === 'session') this.sessionMusician(layer);
    if (kind === 'finish-demo' || kind === 'replace-demo' || kind === 'rejection') this.recordingConfirmation(layer, kind);
    const pending=pendingMission01Guidance(this.state,{currentModal:kind,previousModal:previous,acknowledgedDays:this.state.tutorialAcknowledgedDays});
    const next=pending.find(id=>!id.endsWith('RequestCD'));
    if(next)this.showTutorial(next);
    if(kind==='mixer'&&(previous==='settings'||previous==='session'))void this.previewRecording();
  }


  private showProgressTutorial(): boolean {
    if(this.missionHasEnded() || this.state.missionProgress?.pendingFailure)return this.presentMissionOutcome();
    const pending=pendingMission01Guidance(this.state,{currentModal:this.modal,acknowledgedDays:this.state.tutorialAcknowledgedDays});
    const next=pending.find(id=>!id.endsWith('RequestCD'));
    if(next)this.showTutorial(next);
    return this.tutorialId !== null;
  }

  private closestActivityDay(kind: 'release' | 'concert' | 'advert', suggested: number, duration: number): number {
    for (let day = suggested; day <= this.state.day + 100; day++) if (canBookCalendar(this.state, kind, day, duration)) return day;
    return suggested;
  }
  private scrollActivityAgenda(direction: number, kind: Modal): void {
    this.activityFirstDay = Phaser.Math.Clamp(this.activityFirstDay + direction, this.state.day - (kind==='agenda'?28:23), this.state.day + (kind==='agenda'?12:83)); this.open(kind);
  }
  private performActivity(action: () => GameState, next: Modal, message: string): void {
    try { this.state = action(); this.save(); this.drawHud(); this.open(next); this.toast(message);
      if (next === 'media') {
        const reporter = this.state.publicity.reporters.find(r => r.mediaId === this.selectedMediaId);
        this.feedbackAudio.gift(this.selectedMediaId, reporter?.modifiers.at(-1)?.amount ?? 0, this.selectedActionId === 'ActMediaGivePressKit'||this.selectedActionId==='ActMediaTVGiveVideoClip');
      }
    } catch (error) { this.toast((error as Error).message, 5500); }
  }
  private performGangstaAction(actorId?:string):void {
    try{
      this.state=useGangsta(this.state,this.gangstaActionId,musicians,actorId);this.save();this.drawHud();this.open('gangsta');
      this.feedbackAudio.template(actorId==='RMCPernille'&&this.gangstaCategoryId==='ActCatGangMurder'?'g01new01009':gangstaSpeech(this.state,this.gangstaActionId));
    }catch(error){this.toast((error as Error).message);}
  }
  private dismissGangstaCard():void{this.state=resolveGangstaCard(this.state);this.save();this.drawHud();this.open(null);}
  private gangstaCard(layer:Phaser.GameObjects.Container):void{
    const pending=this.state.gangsta?.queue[0];if(!pending){this.open(null);return;}
    const card=GANGSTA_RULES.cards.find(c=>c.ID.toLowerCase()===pending.id.toLowerCase())!;
    const musician=musicians.find(m=>m.id===pending.actorId),office=/HmGangsta01/i.test(card.Gfx??'');
    const bitmap=data.activities.bitmaps.find(b=>b.name===card.Gfx);
    const artwork=bitmap?'activity-'+bitmap.name.replaceAll(' ','_').toLowerCase():'source-window-'+(card.Gfx??'').replaceAll(' ','_').toLowerCase();
    const recoveredRegistration=bitmap?{x:bitmap.regX!,y:bitmap.regY!}:card.Gfx==='live smashed demo01'?{x:GANGSTA_RULES.artwork['live smashed demo01'].regX,y:GANGSTA_RULES.artwork['live smashed demo01'].regY}:undefined;
    const expand=(value:string)=>scenarioText(value.replace(/missionvar\.my(?:knocked|killed)/gi,'¤CRealMusician'),this.state,musicians,pending.actorId);
    const result=scenarioWindow(this,layer,card,{portraitKey:office?undefined:/^<|^human$/i.test(card.Gfx??'')&&musician?this.moodPortrait(musician.id,'large'):this.textures.exists(artwork)?artwork:undefined,
      pictureRegistration:recoveredRegistration,actorId:office?'gangsta01':undefined,expand,confirm:()=>this.dismissGangstaCard()});
    if(office&&result.portraitRect)this.bindActor(layer,'gangsta01',result.portraitRect.x,result.portraitRect.y);
    const voice=String(card.ExecuteThis??'').match(/g01new\d+/i)?.[0];if(voice)void this.feedbackAudio.play(voice);else if(/playsound/i.test(card.ExecuteThis??''))void this.feedbackAudio.play('Snare',true,.7);
  }
  private beginVideoBooking():void {
    if(!this.state.demo||!this.state.contract||this.state.contract.songId!==this.state.demo.songId){this.videoCardId='ECOCVideoNoAlbum';this.open('video-card');return;}
    if(currentVideo(this.state)){this.videoCardId='ECOCVideoTwo';this.open('video-card');return;}
    const concept=VIDEO_RULES.concepts[this.videoIndex];
    if(this.state.money<concept.price){this.toast('You cannot afford this video.');return;}
    this.activityDay=Array.from({length:97},(_,i)=>this.state.day+4+i).find(day=>canBookVideo(this.state,concept.id,day))??this.state.day+4;
    this.activityFirstDay=this.state.day-3;this.open('video-book');
  }
  private dismissVideoCard():void {
    if(this.videoCardId==='ECOCVideoDone'&&this.state.video){this.state={...this.state,video:{...this.state.video,seen:true}};this.save();this.open(null);}
    else this.open('video');
  }
  private chooseMediaCategory(id: string): void {
    const category = data.activities.tables.ActionCategory.find(c => c.ID === id)!;
    if (category.CategoryType === 'chart') { this.open('chart'); return; }
    if (category.CategoryType === 'Ad') {
      this.selectedAdvertId = PUBLICITY_RULES.media.find(m => m.id === this.selectedMediaId)!.adverts[0]; this.activityDuration = 5;
      this.activityDay = this.closestActivityDay('advert', this.state.day + 5, 5); this.activityFirstDay = this.state.day - 3; this.open('advert'); return;
    }
    this.selectedActionId = id==='ActCatMediaVideo'?'ActMediaTVGiveVideoClip':id === 'ActCatMediaPresskit' ? 'ActMediaGivePressKit' : PUBLICITY_RULES.gifts[0].id; this.open('media-action');
  }
  private presentNextActivityResult(): boolean {
    if(this.state.scenario?.queue.length){this.open('scenario-event');return true;}
    if(currentVideo(this.state)?.completed&&!this.state.video?.seen){this.videoCardId='ECOCVideoDone';this.open('video-card');return true;}
    if(this.state.gangsta?.queue.length){this.open('gangsta-card');return true;}
    const completion = this.state.bandmates.completions.find(c => !c.seen);
    if (completion) { this.trainingResultId = completion.id; this.open('training-result'); return true; }
    const result = [...this.state.publicity.concertResults, ...this.state.publicity.reviews].find(r => !this.state.publicity.seenResults.includes(r.id));
    if (!result) return false; this.activeActivityResultId = result.id; this.open('activity-result'); return true;
  }
  private acknowledgeActivityResult(): void {
    this.state = { ...this.state, publicity: { ...this.state.publicity, seenResults: [...this.state.publicity.seenResults, this.activeActivityResultId] } }; this.save(); this.open(null);
  }

  private showTutorial(id: string): void {
    if ((!this.state.tutorialEnabled && id.startsWith('ECOCMis1')) || (this.state.seenTutorials.includes(id) && !['ECOCNeedSinger','ECOCNoSingersLeft'].includes(id)) || this.tutorialId) return;
    const card = missionCards.find(c=>c.id===id) ?? data.tutorials.find((c) => c.id === id);
    if (!card) return;
    this.tutorialId = id; this.clock = 0; void this.feedbackAudio.play('_EventCard', true);
    const advanceCard=id==='ECOCMis1IntroduceAdvance';
    const content = advanceCard ? `Your label paid a signing advance of ${money(this.state.contract?.advance??0)}. Keep enough cash for weekly wages and promotion.\n\nRecord sales repay the advance before you receive royalties. Live gigs can earn ticket income while your record builds an audience.` : card.text.replace(/<¤Cband.name>/gi, () => this.state.bandName);
    const layer=this.add.container(0,0).setDepth(100); this.tutorialLayer=layer;
    layer.add(this.add.rectangle(0,0,800,600,0x000000,0.25).setOrigin(0).setInteractive());
    this.tutorialButtonY=renderEventCard(this,layer,{headline:advanceCard?'Your signing advance':card.title,text:content,windowTitle:'Info',icon:'icon' in card?String(card.icon):undefined,question:'question' in card ? String(card.question) : undefined,onConfirm:()=>this.dismissTutorial()}).buttonY;
  }

  private dismissTutorial(): void {
    if (!this.tutorialId) return;
    const failure=this.tutorialId==='ECOCNoSingersLeft';
    this.state = { ...this.state, seenTutorials: [...new Set([...this.state.seenTutorials, this.tutorialId])], tutorialAcknowledgedDays:{...this.state.tutorialAcknowledgedDays,[this.tutorialId]:this.state.day} };
    this.tutorialId = null; this.tutorialLayer?.destroy(true); this.tutorialLayer = undefined; this.clock = 0;
    this.save();
    this.refreshCity();
    if(failure){this.state=confirmMissionFailure(recordMissionFailure(this.state,'NoSingersLeft'));this.save();this.open('mission-result');}
  }

  private studio(layer: Phaser.GameObjects.Container): void {
    const studio = data.tutorialGameplay.studios.find((s) => s.id === this.selectedStudioId)!;
    const songs = recordableSongIds(this.state).map(id=>data.songs.find(s=>s.id===id)!);
    if (!songs.some((s) => s.id === this.selectedSongId)) this.selectedSongId = songs.find(s=>s.id===this.state.selectedSong)?.id ?? songs[0]?.id ?? '';
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
    mixerWindow(this, layer, this.state, effectiveMusicians(this.state, musicians), studio, song, this.recordingAudio.playing, this.mixerMaster,
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
    channelSettingsWindow(this, layer, this.state, effectiveMusicians(this.state, musicians), channel, studio.availableEffects,
      (effects) => { this.state = updateChannel(this.state, this.selectedChannel, { effects }, data.tutorialGameplay); this.save(); this.recordingAudio.update(this.state.recording!.channels, this.mixerMaster); },
      (direction) => {
        const loops = data.tutorialGameplay.loops.filter((l) => l.songId === recording.songId && l.instrument === channel.instrument);
        const index = Phaser.Math.Clamp(loops.findIndex((l) => l.id === channel.loopId) + direction, 0, loops.length - 1);
        this.state = updateChannel(this.state, this.selectedChannel, { loopId: loops[index].id }, data.tutorialGameplay); this.save(); this.open('settings');
      }, () => { this.sessionReturn = 'settings'; this.open('session'); }, () => void this.previewRecording(), () => this.open('mixer'));
  }

  private async previewRecording(audition = false): Promise<void> {
    if (this.state.muted) { if(!audition)this.toast('Sound is off. Press M to enable sound.'); return; }
    const recording = audition || this.modal === 'rehearsal' || this.modal === 'mission-result' ? this.state.demo : this.state.recording;
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

  private async saveMixdown():Promise<void>{
    const recording=this.state.recording;if(!recording)return;
    const files=recording.channels.map(channel=>{
      if(!channel.musicianId)return null;const loop=data.tutorialGameplay.loops.find(l=>l.id===channel.loopId)!;
      const prefixes=data.tutorialGameplay.voicePrefixes as Record<string,string>;
      let file=loop.file+(channel.instrument==='Vocals'?(prefixes[channel.musicianId]??'a01'):'')+'.ogg';
      if(!data.tutorialGameplay.audio.some(a=>a.file===file)&&channel.instrument==='Vocals')file=loop.file+'a01.ogg';return file;
    });
    const song=data.tutorialGameplay.defaults.find(s=>s.id===recording.songId)!;
    const sourceEnds=files.map(file=>{const entry=data.tutorialGameplay.audio.find(a=>a.file===file);return entry?entry.cues.at(-1)!/entry.sampleRate:null;});
    try{
      const blob=await renderMixWav(recording.channels,files,song.bpm,song.numBars,song.timeSignature[0]*4/song.timeSignature[1],sourceEnds,this.mixerMaster);
      const url=URL.createObjectURL(blob),download=document.createElement('a');download.href=url;download.download='Song.wav';download.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    }catch(error){this.toast((error as Error).message,6000);}
  }

  private sessionMusician(layer: Phaser.GameObjects.Container): void {
    const recording = this.state.recording!;
    const studio = data.tutorialGameplay.studios.find((s) => s.id === recording.studioId)!;
    sessionWindow(this, layer, this.state, studio, recording.channels[this.selectedChannel], (id,instrument) => {
      try {
        const playing = this.recordingAudio.playing;
        this.state = chooseSessionMusician(this.state, data.tutorialGameplay, this.selectedChannel, id,instrument);
        this.save(); this.open(this.sessionReturn); if (playing) void this.previewRecording();
      } catch (error) { this.toast((error as Error).message, 6000); }
    }, () => this.open(this.sessionReturn));
  }

  private label(layer: Phaser.GameObjects.Container): void {
    const label = data.tutorialGameplay.labels.find((s) => s.id === this.selectedLabelId)!;
    labelWindow(this, layer, this.state, label, () => void this.auditionLabel(layer), () => this.open(null),id=>this.open(id==='ActRecordSurvey'?'label-survey':'label-action'));
  }

  /** DlgRecord.playDemo: block input, play mixdown, WaitScript(3), then decideIfSign. */
  private async auditionLabel(layer:Phaser.GameObjects.Container):Promise<void>{
    if(this.labelAuditioning||!this.state.demo)return;
    this.labelAuditioning=true;const generation=++this.labelAuditionGeneration;
    const label = data.tutorialGameplay.labels.find(s=>s.id===this.selectedLabelId)!;
    const blocker=this.add.zone(0,0,800,600).setOrigin(0).setInteractive();layer.add(blocker);
    this.feedbackAudio.stop();this.feedbackAudio.stopPlace();
    await this.previewRecording(true);
    if(generation!==this.labelAuditionGeneration||this.modal!=='label')return;
    if(!this.state.muted&&!this.recordingAudio.playing){this.labelAuditioning=false;blocker.destroy();return;}
    this.labelAuditionTimer=this.time.delayedCall(3000,()=>{
      this.labelAuditioning=false;this.labelAuditionTimer=undefined;blocker.destroy();this.recordingAudio.stop();
      const result = evaluateDemo(this.state, label, musicians);
      if (!result.accepted) { this.open('rejection'); return; }
      if(this.state.contract?.labelId===label.id){
        if(!currentAlbumSigned(this.state))this.state=approveContractDemo(this.state,label,musicians);
        this.save();this.open('label');this.feedbackAudio.labelSpeech(label.id,'nextContract');
        for(const item of this.actorPortraits)if(item.layer.scene===this&&item.actor.diagnostics.id.toLowerCase()===label.id.toLowerCase())item.actor.setMood('Happy');return;
      }
      const offers = contractOffers(label, result.like);
      // Director's one-based Steps.count / 2 initial selection.
      this.offerIndex = Math.max(0, Math.trunc(offers.length / 2) - 1); this.open('contract');
      for(const item of this.actorPortraits)if(item.layer.scene===this&&item.actor.diagnostics.id.toLowerCase()===label.id.toLowerCase())item.actor.setMood('Happy');
    });
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
    if(kind==='finish-demo'){
      const content=originalText.translations.szidMixerExit.replace(/^"|"$/g,'').replaceAll('""','"').replaceAll('\x85','…').replaceAll('\\n','\n');
      mixerExitWindow(this,layer,content,()=>{
        try{this.state=finishRecording(this.state,data.tutorialGameplay,musicians,data.songs);this.dispatchScenario({kind:'recording'});this.save();this.open(null);this.toast(this.state.contract?.prearranged?'Demo recorded. Visit Global Records for approval.':'Demo recorded. Visit a record label.',8000);}
        catch(error){this.toast((error as Error).message,6000);}
      },()=>this.open('mixer'),()=>void this.saveMixdown());return;
    }
    if(kind==='replace-demo'){
      const card=currentAlbumSigned(this.state)?sourceConfirmations.cards.ECOCAlbumDiscard:sourceConfirmations.cards.ECOCAlbumDiscardDemo;
      const albumName=data.songs.find(s=>s.id===this.state.demo?.songId)?.name??'';
      renderEventCard(this,layer,{headline:card.Headline,text:card.comment.replace('<¤calbum.name>',albumName),question:card.question,windowTitle:card.name,icon:'megaphone',confirmLabel:card.confirm,cancelLabel:card.cancel,onConfirm:()=>this.beginRecording(),onCancel:()=>this.open('studio')});return;
    }
    const label = data.tutorialGameplay.labels.find((s) => s.id === this.selectedLabelId)!;
    const evaluated=evaluateDemo(this.state,label,musicians);
    const refusal=labelRefusalWindow(this,layer,this.selectedLabelId,evaluated.reason,()=>this.open(null));
    this.bindActor(layer,this.selectedLabelId,refusal.portraitRect.x,refusal.portraitRect.y,'Angry');
    this.feedbackAudio.template(demoRefusalVoice(this.selectedLabelId,evaluated.reasonKind,this.state.contract?.labelId===this.selectedLabelId));
  }

  private briefing(layer: Phaser.GameObjects.Container): void {
    missionIntroWindow(this,layer,missionDefinition(this.state.missionId),() => {
      this.state = { ...this.state, started: true }; if(['Mission05','Mission06'].includes(this.state.missionId))this.dispatchScenario({kind:'city'}); this.running = true; this.feedbackAudio.setMuted(this.state.muted); this.sound.mute = this.state.muted; if (!this.state.muted && !this.ambient?.isPlaying) this.ambient?.play(); this.save(); this.open(null);
      if(this.state.missionId==='Mission01')this.toast('Open Rehearsal to put your band together.', 6000);
    });
    if(this.state.missionId!=='Mission01')this.playMissionIntro(layer);
  }

  private dispatchScenario(event:ScenarioEvent):void{
    this.state=evaluateMissionProgress(scenarioEvent(this.state,event,musicians));
  }

  private playMissionIntro(layer:Phaser.GameObjects.Container):void{
    const segments=introSegments(this.state.missionId);let index=0,picture:Phaser.GameObjects.Image|undefined,waiting=false;
    const speakers=new Map<string,{layer:Phaser.GameObjects.Container;actor:ActorPortrait;speechKey?:string}>();
    let lastSpeaker:string|undefined;
    const speaker=(id:string,anchor:number[],mood:ActorMood='normal',newPhoto=false)=>{
      let entry=newPhoto?undefined:speakers.get(id);
      if(!entry){
        const source=actorAssets.portraits.find(p=>p.id===id);if(!source)return;
        entry={layer,actor:createActorPortrait(this,layer,id,anchor[0]-source.anchor[0],anchor[1]-source.anchor[1],{mood}),speechKey:''};
        speakers.set(id,entry);this.actorPortraits.push(entry);
      }
      return entry;
    };
    const next=async()=>{
      if(!layer.scene||index>=segments.length)return;
      const segment=segments[index++];
      if(segment.picture&&this.textures.exists(segment.picture.key)){
        const place=(p:NonNullable<typeof segment.picture>)=>{
          const x=Math.round(p.anchor[0]-p.registration[0]*p.dimensions[0]/p.nativeDimensions[0]);
          const y=Math.round(p.anchor[1]-p.registration[1]*p.dimensions[1]/p.nativeDimensions[1]);
          const image=this.add.image(x,y,p.key).setOrigin(0).setDisplaySize(...p.dimensions);layer.add(image);return image;
        };
        if(segment.border&&this.textures.exists(segment.border.key))place(segment.border);
        picture=place(segment.picture);
      }
      if(segment.actorId){
        const entry=speaker(segment.actorId,segment.picture?.anchor??[298,260],segment.mood,Boolean(segment.picture));
        if(entry){entry.speechKey=segment.audioKey;if(segment.mood)entry.actor.setMood(segment.mood);lastSpeaker=segment.actorId;}
        // Both brothers share this score photo. The second starts Angry but
        // silent, then answers when his original numbered clip begins.
        if(segment.audioKey==='intro03_07a16')speaker('mission03_brother02',[298,260],'Angry');
        if(segment.audioKey==='intro07_01a18')speaker('mission07_spacecadet_lina01',[288,252],'normal');
        if(segment.audioKey==='intro05_02a24')speaker('mission05_guitarist01',[289,257],'normal');
      }else if(lastSpeaker){const entry=speakers.get(lastSpeaker);if(entry)entry.speechKey=segment.audioKey;}
      layer.setData('introSegment',{index,audioKey:segment.audioKey,picture:segment.pictureName??picture?.texture.key,holdPreviousPicture:segment.holdPreviousPicture??false});
      await this.feedbackAudio.play(segment.audioKey,false,1);waiting=true;
    };
    const timer=this.time.addEvent({delay:100,loop:true,callback:()=>{if(waiting&&!this.feedbackAudio.playback.playing){waiting=false;void next();}}});
    layer.once('destroy',()=>timer.remove(false));void next();
  }

  private resolveScenarioCard(choice:string):void{
    const pending=this.state.scenario?.queue[0];if(!pending)return;
    const before=this.state;
    this.dispatchScenario({kind:'card',cardId:pending.id,choice});
    if(pending.id==='ECOCMis4Media01RqNadia'&&choice==='ButtonOK'){
      this.beforeScenarioBooking=before;this.activityDay=this.state.day+2;this.activityFirstDay=this.state.day-3;this.open('scenario-book');return;
    }
    this.save();this.open(null);
    const requestActor:Record<string,string>={ECOCCityRequestCD:'m03',ECOCZer0RequestCD:'m04',ECOCRadioRequestCD:'m02',ECOCTVRequestVideo:'m01'};
    if(choice==='ButtonOK'&&requestActor[pending.id]&&!this.modal)this.feedbackAudio.template(requestActor[pending.id]+'mb0400z');
  }

  private bookScenarioAppointment(layer:Phaser.GameObjects.Container):void{
    const appointment=this.state.scenario?.appointments.find(a=>a.id==='DivEventWin');if(!appointment)return;
    const undo=()=>{if(this.beforeScenarioBooking)this.state=this.beforeScenarioBooking;this.beforeScenarioBooking=undefined;this.open('scenario-event');};
    scenarioBooking(this,layer,this.state,appointment,this.activityDay,this.activityFirstDay,day=>{this.activityDay=day;this.open('scenario-book');},direction=>{this.activityFirstDay+=direction;this.open('scenario-book');},()=>{
      appointment.startDay=this.activityDay;this.beforeScenarioBooking=undefined;this.save();this.open(null);
    },undo,day=>{const state={...this.state,scenario:{...this.state.scenario!,appointments:this.state.scenario!.appointments.filter(a=>a.id!==appointment.id)}};return canBookCalendar(state,'concert',day);});
  }

  private scenarioCard(layer:Phaser.GameObjects.Container):void{
    const pending=this.state.scenario?.queue[0];if(!pending){this.open(null);return;}
    if(pending.id==='ECOCQuitNow'&&pending.speakerId){
      if(scenarioQuitOccupied(this.state,pending.speakerId)){this.open(null);return;}
      this.state=completeScenarioQuit(this.state,pending.speakerId,musicians);this.save();
    }
    const card=scenarioCards.find(c=>c.ID.toLowerCase()===pending.id.toLowerCase());
    if(!card){throw new Error('Missing recovered scenario card: '+pending.id);}
    const gfx=String(card.Gfx??'');
    const picturedId=gfx.match(/<(?:¤#|getobjbyid\(#)(\w+)/i)?.[1];
    const focusId=picturedId??pending.speakerId;
    const musician=musicians.find(m=>m.id.toLowerCase()===focusId?.toLowerCase());
    const song=data.songs.find(s=>s.id===(this.state.album?.songId??this.state.demo?.songId??this.state.selectedSong));
    const expand=(value:string)=>scenarioText(value,this.state,musicians,focusId,card.ID).replace(/<¤C(?:album|song)\.name>/gi,song?.name??'');
    let portraitKey=musician?this.moodPortrait(musician.id,'large'):undefined;
    const officeActor=/RepTV/i.test(gfx)?'media01':/HmGangsta01/i.test(gfx)?'gangsta01':/Hmjudge/i.test(gfx)?'eccourt01':gfx.match(/Hm(Record0[1-4])/i)?.[1]?.toLowerCase()??PUBLICITY_RULES.reporters.find(r=>r.id.toLowerCase()===focusId?.toLowerCase())?.mediaId.toLowerCase();
    if(officeActor)portraitKey=undefined;
    if(gfx&&!gfx.includes('<')&&gfx!=='human'){
      const candidate='source-window-'+gfx.replaceAll(' ','_').toLowerCase();if(this.textures.exists(candidate))portraitKey=candidate;
    }
    const result=scenarioWindow(this,layer,card,{portraitKey,actorId:officeActor,animatePortrait:Boolean(musician),expand,confirm:()=>this.resolveScenarioCard('ButtonOK'),cancel:card.ButtonCancel?.name?()=>this.resolveScenarioCard('ButtonCancel'):undefined,third:card.Button3?.name?()=>this.resolveScenarioCard('Button3'):undefined});
    if(officeActor&&result.portraitRect)this.bindActor(layer,officeActor,result.portraitRect.x,result.portraitRect.y);
    if(musician&&!officeActor&&result.portraitRect&&!card.dataMemberName.toLowerCase().includes('large'))this.bindActor(layer,musician.id,result.portraitRect.x,result.portraitRect.y,bandmateMood(this.state,musician.id));
    const speech=String(card.ExecuteThis??'').match(/speak\s*\([\s\S]*?&QUOTE&"?([^"&]+)/i)?.[1]?.trim();
    if(speech){const actor=actorAssets.staticPortraits.find(p=>p.musicianId===musician?.id)?.actorId;this.feedbackAudio.template(speech.replaceAll('¤¤¤',actor?'a'+actor.slice(-2):'').replaceAll('¤¤',actor?actor.slice(-2):''));}
    void this.feedbackAudio.play('_EventCard',true);
    layer.setData('scenarioCardId',pending.id);
  }

  private bindActor(layer: Phaser.GameObjects.Container, id: string, x: number, y: number, mood?: ActorMood): void {
    for (const object of [...layer.list]) {
      if (!(object instanceof Phaser.GameObjects.Image)) continue;
      const key = object.texture.key;
      if (key === `portrait-${id}` || key === `activity-${id.toLowerCase()}-neutral` || key.startsWith(`${id.toLowerCase()}-moves_`) || key === `${id.toLowerCase()}-background01`) object.destroy();
    }
    this.actorPortraits.push({ layer, actor: createActorPortrait(this, layer, id, x, y, { mood }) });
  }

  private bandmate(layer: Phaser.GameObjects.Container): void {
    const member = this.state.band.find(member => member?.musicianId === this.selectedId);
    if (!member) { this.open('rehearsal'); return; }
    const musician = effectiveMusicians(this.state, musicians).find(m => m.id === this.selectedId)!;
    const rows = bandmateConcerns(this.state, this.selectedId, musicians, originalText.translations, true);
    const concerns = rows.map((row, index) => (index < 2 ? 'Mood: ' : 'Health: ') + row);
    bandmateWindow(this, layer, musician, member.instrument, concerns, categoryId => {
      const actions = availableBandmateActions(this.state, this.selectedId, categoryId);
      if (!actions.length) { this.toast('No more gifts available for this artist.'); return; }
      this.bandmateCategoryId = categoryId; this.bandmateActionId = actions[0].id; this.open('bandmate-action');
    }, () => this.open('rehearsal'),bandmateConcerns(this.state,this.selectedId,musicians,originalText.translations,false).map((row,index)=>(index<2?'Mood: ':'Health: ')+row));
    this.bindActor(layer, this.selectedId, 135, 146, bandmateMood(this.state, this.selectedId));
  }

  private bandmateAction(layer: Phaser.GameObjects.Container): void {
    const actions = availableBandmateActions(this.state, this.selectedId, this.bandmateCategoryId);
    bandmateActionWindow(this, layer, this.state, this.bandmateCategoryId, this.bandmateActionId,
      !bandmateOccupied(this.state, this.selectedId), direction => {
        const index = Phaser.Math.Clamp(actions.findIndex(action => action.id === this.bandmateActionId) + direction, 0, actions.length - 1);
        this.bandmateActionId = actions[index].id; this.open('bandmate-action');
      }, () => {
        if (this.bandmateCategoryId === 'ActCatMusicianTrain') {
          this.activityDay = this.state.day + 2;
          while (!canTrainBandmate(this.state, this.selectedId, this.bandmateActionId, this.activityDay) && this.activityDay <= this.state.day + 100) this.activityDay++;
          this.activityFirstDay = this.state.day - 3; this.open('bandmate-training'); return;
        }
        try {
          this.state = this.bandmateCategoryId === 'ActCatMusicianGifts' ? giveBandmateGift(this.state, this.selectedId, this.bandmateActionId, musicians)
            : this.bandmateCategoryId === 'ActCatMusicianRelations' ? changeBandmateRelations(this.state, this.selectedId, this.bandmateActionId)
            : fireBandmate(this.state, this.selectedId, musicians);
          if(this.bandmateCategoryId==='ActCatMusicianGifts')this.dispatchScenario({kind:'gift',actorId:this.selectedId,actionId:this.bandmateActionId});
          if(this.bandmateCategoryId==='ActCatMusicianKick')this.dispatchScenario({kind:'fire',actorId:this.selectedId});
          this.save(); this.open(this.bandmateCategoryId === 'ActCatMusicianKick' ? 'rehearsal' : 'bandmate');
          const speech = this.state.bandmates.lastSpeech;
          if (speech) this.feedbackAudio.template(speech.template);
        } catch (error) { this.toast((error as Error).message); }
      }, () => this.open('bandmate'));
  }

  private bandmateTraining(layer: Phaser.GameObjects.Container): void {
    const action = BANDMATE_RULES.actions.find(a => a.id === this.bandmateActionId)!;
    bandmateTrainingWindow(this, layer, this.state, this.bandmateActionId, action.duration, this.activityDay, this.activityFirstDay,
      activityEvents(this.state), day => { this.activityDay = day; this.open('bandmate-training'); },
      direction => { this.activityFirstDay = Phaser.Math.Clamp(this.activityFirstDay + direction, this.state.day - 23, this.state.day + 83); this.open('bandmate-training'); },
      day => canTrainBandmate(this.state, this.selectedId, this.bandmateActionId, day), () => {
        try {
          this.state = trainBandmate(this.state, this.selectedId, this.bandmateActionId, this.activityDay, musicians);
          this.dispatchScenario({kind:'training',actorId:this.selectedId,actionId:this.bandmateActionId});
          this.save(); this.open('bandmate');
          this.feedbackAudio.template(this.state.bandmates.lastSpeech!.template);
        } catch (error) { this.toast((error as Error).message); }
      }, () => this.open('bandmate'));
  }

  private trainingResult(layer: Phaser.GameObjects.Container): void {
    const completion = this.state.bandmates.completions.find(c => c.id === this.trainingResultId)!;
    const musician = effectiveMusicians(this.state, musicians).find(m => m.id === completion.musicianId)!;
    const action = BANDMATE_RULES.actions.find(a => a.id === completion.actionId)!;
    const training = this.state.bandmates.training.find(t => t.id === completion.id)!;
    const card = originalText.trainingCards.find(c => c.id === 'ECOCTraining' + training.type + 'Done') ?? originalText.trainingCards[0];
    const content=card.text.replaceAll('<¤CRealMusician.name>',musician.name).replaceAll('<¤Cband.name>',this.state.bandName).replace(/\{x;Pron;[^}]+\}/g,musician.gender==='Female'?'her':'him');
    const layout=renderEventCard(this,layer,{headline:card.headline,text:content,windowTitle:'Artist',icon:'microphone',portraitKey:this.moodPortrait(musician.id,'large'),caption:musician.name,onConfirm:()=>this.acknowledgeTrainingResult()});
    if(layout.portraitRect)this.bindActor(layer,musician.id,layout.portraitRect.x,layout.portraitRect.y,bandmateMood(this.state,musician.id));
    const actorId=actorAssets.staticPortraits.find(p=>p.musicianId===musician.id)?.actorId;
    if(actorId)this.feedbackAudio.template('a'+actorId.slice(-2)+'ea2000x');
    void this.feedbackAudio.play('_EventCard', true);
  }

  private acknowledgeTrainingResult(): void {
    this.state = { ...this.state, bandmates: { ...this.state.bandmates,
      completions: this.state.bandmates.completions.map(c => c.id === this.trainingResultId ? { ...c, seen: true } : c) } };
    this.save(); this.open(null);
  }

  private moodPortrait(id:string,size:'large'|'medium'):string {
    const occupied=bandmateOccupied(this.state,id);
    const current=bandmateMood(this.state,id),mood=occupied?'occupied':current==='Furious'?'Angry':current;
    return actorAssets.staticPortraits.find(p=>p.musicianId===id&&p.size===size&&p.mood.toLowerCase()===mood.toLowerCase())?.textureKey??`${size==='large'?'portrait':'icon'}-${id}`;
  }
  private attemptLeaveRehearsal():void {
    const result=mission01RehearsalExit(this.state,musicians,{bandNameChanged:this.state.bandNameChanged});
    if(result.allowed)this.open(null);else if(result.cardId)this.showTutorial(result.cardId);
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
        layer.add(this.add.image(x, y, this.moodPortrait(m.id, 'large')).setOrigin(0));
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
        if (member && bandmateOccupied(this.state,member.musicianId)) { this.open('artist-away'); return; }
        this.open(member ? 'bandmate' : 'recruit');
      });
    }
    // Original InfoAlbum offset(462,46) inside Rehearsal at(60,77).
    // RehearsalAlbumFormatting:189x224 template plus7 trailing14px lines.
    const albumContent=infoFrame(this,layer,522,123,189,224+7*14,'Album status','cd');
    const label=data.tutorialGameplay.labels.find(l=>l.id===this.state.contract?.labelId), contract=this.state.contract, demo=this.state.demo;
    const song=data.songs.find(s=>s.id===demo?.songId);
    const revenue=this.state.album&&this.state.day>=this.state.album.releaseDay?this.state.publicity.totalSales*18:0;
    const publisher=(song?.royalty??0)*revenue,toLabel=(contract?.royalty??0)*(revenue-publisher),earned=revenue-publisher-toLabel;
    const rows:[string,string][]=[['Record company',label?.name??'-'],['Royalty',contract?(contract.royalty*100).toFixed(1)+'%':'-'],['Advance',contract?money(contract.advance):'-'],['',''],['Album recorded',demo?'Yes':'No'],['Sleeve designed',demo?(this.state.album?'Yes':'No'):'-'],['Release date',this.state.album?calendarDate({...this.state,day:this.state.album.releaseDay}):'-'],['Video',currentVideo(this.state)?.completed?VIDEO_RULES.concepts.find(v=>v.id===this.state.video?.conceptId)?.name??'-':'-'],['',''],['Copies sold',demo?money(Math.ceil(this.state.publicity.totalSales)):'-'],['Revenue',demo?money(revenue):'-'],['To publisher',demo?money(Math.round(publisher)):'-'],['To label',demo&&contract?money(Math.round(toLabel)):'-'],['Earned',demo&&contract?money(Math.round(earned)):'-'],['Incl. advance',demo&&contract?money(Math.round(earned-contract.advance)):'-']];
    rows.forEach(([name,value],i)=>{(text(this,layer,albumContent.x,albumContent.y+i*14,name,11,'#eeeeee').setFontFamily('Verdana').setLetterSpacing(-1) as NativeText).setNativeAntialias(false);(text(this,layer,albumContent.x+100,albumContent.y+i*14,value,11,'#eeeeee').setFontFamily('Verdana').setLetterSpacing(-1) as NativeText).setNativeAntialias(false);});
    button(this,layer,478,500,144,'Play song',()=>{if(this.recordingAudio.playing)this.recordingAudio.stop();else void this.previewRecording();},Boolean(demo),34,'preview');
    button(this, layer, 75, 500, 220, 'Change Band Name', () => { this.nameDraft = this.state.bandName; this.open('rename'); }, true, 34, 'rename');
    button(this, layer, 632, 500, 101, 'OK', () => this.attemptLeaveRehearsal(), true, 34, 'accept');
  }

  private songDialog(layer: Phaser.GameObjects.Container, publisher: boolean): void {
    if(publisher){
      const songs=publisherSongs(this.state,data.songs,this.selectedPublisherId);
      if(!songs.some(s=>s.id===this.selectedSongId))this.selectedSongId=songs[0]?.id??'';
      publisherWindow(this,layer,{title:musicBusiness.publishers.find(p=>p.id===this.selectedPublisherId)!.name,songs,selectedId:this.selectedSongId,offset:this.publisherOffset,funds:this.state.money,
        select:id=>{this.selectedSongId=id;this.open('publisher');void this.feedbackAudio.play(id+'Preview',false,.6);},scroll:offset=>{this.publisherOffset=offset;this.open('publisher');},cancel:()=>this.open(null),buy:()=>{
          const selected=data.songs.find(s=>s.id===this.selectedSongId);if(!selected)return;
          this.state=licenseSong(this.state,data.songs,selected.id,this.selectedPublisherId);this.save();this.open(null);this.toast(`Licensed ${selected.name} for ${money(selected.price)}.`);
        }});return;
    }
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

  private musicianText(layer: Phaser.GameObjects.Container, x: number, y: number, value: string, _size = 11, color = '#eeeeee', width?: number): Phaser.GameObjects.Text {
    const label = text(this, layer, x, y, value, 11, color, width).setFontFamily('Verdana').setLineSpacing(0);
    if (label instanceof NativeText) label.setNativeAntialias(false); return label;
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
      this.bindActor(layer, selected.id, 328, 141);
      if (this.recruitSpeechId !== selected.id) { this.recruitSpeechId = selected.id; this.feedbackAudio.greeting(selected.id); }
      this.musicianText(layer, 437, 138, selected.name, 14, '#111111', 185).setFontFamily('Verdana').setFontStyle('bold');
      for (const [i, label] of ['Age', 'Instrument', 'Musicality', 'Star quality', 'Style'].entries())
        this.musicianText(layer, 437, 158 + i * 16, label, 11, '#111111').setFontFamily('Verdana').setFontStyle('bold');
      this.musicianText(layer, 517, 158, `${selected.age} years`, 12, '#111111').setFontFamily('Verdana');
      this.musicianText(layer, 517, 174, this.selectedInstrument.toLowerCase(), 12, '#111111').setFontFamily('Verdana');
      this.musicianText(layer, 517, 222, selected.genre, 12, '#111111').setFontFamily('Verdana');
      for (const [i, val] of [selected.musicality, selected.charisma ?? 0].entries()) {
        nativeMeter(this,layer,517,190+i*16,val);
      }
      this.musicianText(layer, 330, 252, selected.description, 11, '#242424', 287).setLetterSpacing(-1).setLineSpacing(1);
    }
    this.musicianText(layer, 320, 368, 'Musician', 11, '#eeeeee').setFontFamily('Verdana').setFontStyle('bold');
    this.musicianText(layer, 520, 368, 'Price/week', 11, '#eeeeee').setFontFamily('Verdana').setFontStyle('bold');
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
      this.musicianText(layer, 385, y + 8, m.name, 10, '#eeeeee', 154).setFontFamily('Verdana').setLineSpacing(0);
      this.musicianText(layer, 552, y + 8, `$${money(m.salary)}`, 11, '#eeeeee').setFontFamily('Verdana');
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
        : scenarioEvent(recruit(this.state, musicians, this.selectedSlot, selected.id, this.selectedInstrument),{kind:'action',actionId:'HireBandMember',actorId:selected.id},musicians);
      this.save(); this.open('rehearsal');
      if (!existing) { const cue = data.musicians.find(m => m.id === selected.id); if (cue) this.feedbackAudio.template('a' + (cue.smallPortrait?.match(/actor(\d+)/)?.[1] ?? '01') + 'ra0200X'); }
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
    bandNameWindow(this,layer,this.nameDraft,()=>this.saveName(),()=>this.open('rehearsal'));
  }

  private saveName(): void {
    if (!this.nameDraft.trim()) return;
    this.state = { ...this.state, bandName: this.nameDraft.trim(), bandNameChanged:true };
    this.dispatchScenario({kind:'name'});
    this.save(); this.open('rehearsal');
  }

  private menu(layer: Phaser.GameObjects.Container): void {
    mainMenuWindow(this,layer,{headline:data.menuText.title,comment:data.menuText.text,canContinue:this.state.started,continue:()=>{this.running=!this.missionHasEnded();this.open(this.missionHasEnded()?'mission-result':this.state.recording?'mixer':null);},newGame:()=>this.open('missions'),quit:()=>this.open('quit')});
  }

  private missionSelection(layer: Phaser.GameObjects.Container): void {
    this.career=recordCareer(this.career,this.state);saveCareer(this.career);
    const unlocked=careerAvailability(this.career,this.state.missionId);
    const missions=data.missions.map(m=>({...m,available:m.playable&&unlocked.has(m.id),points:this.career.missions[m.id]?.points}));
    const available=(id:string)=>missions.some(m=>m.id===id&&m.available);
    if(!available(this.selectedMissionId))this.selectedMissionId=this.state.missionId;
    missionChooseWindow(this,layer,missions,this.missionOffset,careerTotal(this.career),()=>{
      if(!available(this.selectedMissionId))return;
      if(this.state.started){this.open('reset');return;}
      this.state=newMission(this.selectedMissionId,musicians);this.save();this.open('briefing');
    },()=>this.open('menu'),offset=>{this.missionOffset=offset;this.open('missions');},this.selectedMissionId,id=>{if(isMissionId(id)&&available(id)){this.selectedMissionId=id;this.open('missions');}});
  }

  private quitConfirmation(layer: Phaser.GameObjects.Container): void {
    const card=sourceConfirmations.cards.ECOCAskQuitGame;
    renderEventCard(this,layer,{headline:card.Headline,text:card.comment,question:card.question,windowTitle:card.name,icon:'skull',confirmLabel:card.confirm,cancelLabel:card.cancel,onConfirm:()=>{this.running=false;this.save();this.open('menu');},onCancel:()=>this.open('menu')});
  }

  private help(layer: Phaser.GameObjects.Container): void {
    title(this,layer,48,154,missionDefinition(this.state.missionId).name,'megaphone');
    const objectives=missionObjectives(this.state);
    objectives.forEach((objective,i)=>{
      (text(this,layer,80,205+i*24,`${objective.done?'Done':'Next'}   ${objective.text}`,11,objective.done?'#eeeeee':'#c2b6b3',620).setFontFamily('Verdana') as NativeText).setNativeAntialias(false);
    });
    const next=this.state.missionId==='Mission03'?'Record Supermarket Love, obtain Global Records approval, release the album and keep the brothers together for the day-70 Global Aid Gala.'
      :this.state.missionId==='Mission04'?"Build Nadia’s band, record and release an album, then promote it and complete the TV appearance when invited."
      :!this.state.album ? 'Hire a singer, license a song, record a demo and sign a label contract. Then design a cover and schedule its release.'
      :this.state.day<this.state.album.releaseDay ? `Your record releases on ${calendarDate({...this.state,day:this.state.album.releaseDay})}. Send press kits and book promotion while you wait.`
      :'Give Radio FM, City News and Zer0 Magazine a press kit. Buy a Record Store campaign and play gigs to attract buyers. Check the Record Store sales chart; radio position alone does not complete this mission.';
    (text(this,layer,80,368,next,11,'#eeeeee',625).setFontFamily('Verdana') as NativeText).setNativeAntialias(false);
    (text(this,layer,80,438,'Time runs in the city and pauses in windows. Click the Date display for bookings. Weekly wages and promotion cost cash; your signing advance is recouped from sales.',11,'#cccccc',625).setFontFamily('Verdana') as NativeText).setNativeAntialias(false);
    button(this,layer,562,492,150,'Back',()=>this.open('menu'));
  }

  private missionHasEnded():boolean {return this.state.missionProgress?.status==='won'||this.state.missionProgress?.status==='lost';}
  private presentMissionOutcome():boolean {
    this.state=evaluateMissionProgress(this.state);
    if(this.missionHasEnded()){this.running=false;this.save();this.open('mission-result');return true;}
    if(this.state.missionProgress?.pendingFailure){this.running=false;this.save();this.open('mission-warning');return true;}
    return false;
  }
  private missionWarning(layer:Phaser.GameObjects.Container):void {
    const card=this.state.missionProgress?.pendingFailure==='NoSingersLeft'?MISSION_ENDINGS.noSingersLeft:MISSION_ENDINGS.outOfMoney;
    const noMoney=this.state.missionProgress?.pendingFailure==='NoMoney';
    renderEventCard(this,layer,{headline:card.headline,text:card.text,windowTitle:'Info',icon:noMoney?'money':'megaphone',portraitKey:noMoney?'source-window-illustration_no_money01':undefined,pictureKind:'illustration',pictureRegistration:{x:51,y:48},onConfirm:()=>this.confirmMissionWarning()});
    void this.feedbackAudio.play('_EventCard',true);
  }
  private confirmMissionWarning():void {this.state=confirmMissionFailure(this.state);this.save();this.open('mission-result');}
  private closeMissionResult():void {this.state=acknowledgeMissionResult(this.state);this.running=false;this.save();this.open('missions');}
  private missionResult(layer:Phaser.GameObjects.Container):void {
    this.running=false;
    const ending=missionEnding(this.state,data.songs.find(s=>s.id===this.state.demo?.songId)?.name);
    missionResultWindow(this,layer,this.state,data.songs.find(s=>s.id===this.state.demo?.songId)?.name??'',()=>this.closeMissionResult());
    if(ending.success)void this.previewRecording();
  }

  private resetConfirmation(layer: Phaser.GameObjects.Container): void {
    renderEventCard(this,layer,{headline:`Start ${missionDefinition(this.selectedMissionId).name}?`,text:`This replaces the saved band and starts the mission with ${money(missionDefinition(this.selectedMissionId).startMoney)}.`,windowTitle:'Confirm',icon:'effect',confirmLabel:'OK',cancelLabel:'Cancel',onCancel:()=>this.open('menu'),onConfirm:()=>{
      this.state = newMission(this.selectedMissionId,musicians); this.running = false; this.clock = 0;
      this.ambient?.stop(); this.hasSaved = false;
      this.save(); this.open('briefing');
    }});
  }

  private keyInput(event: KeyboardEvent): void {
    if(this.labelAuditioning)return;
    if(this.modal==='venue-notice'){if(event.key==='Enter'||event.key==='Escape')this.open(this.venueNoticeReturn);return;}
    // Phaser can revisit queued DOM events when the input display list changes.
    // Consume each event once while still permitting distinct key-repeat events.
    if (this.handledKeyEvents.has(event)) return;
    this.handledKeyEvents.add(event);
    if(this.modal==='scenario-book'){
      if(event.key==='Escape'){if(this.beforeScenarioBooking)this.state=this.beforeScenarioBooking;this.beforeScenarioBooking=undefined;this.open('scenario-event');}return;
    }
    if(this.modal==='scenario-event'){
      if(event.key==='Enter'||event.key==='Escape'){
        const pending=this.state.scenario?.queue[0],card=scenarioCards.find(c=>c.ID.toLowerCase()===pending?.id.toLowerCase());
        this.resolveScenarioCard(event.key==='Escape'&&card?.ButtonCancel?.name?'ButtonCancel':'ButtonOK');
      }
      return;
    }
    if (this.tutorialId) {
      if (event.key === 'Enter' || event.key === 'Escape') this.dismissTutorial();
      return;
    }
    if(this.modal==='gangsta-card'){if(event.key==='Enter'||event.key==='Escape')this.dismissGangstaCard();return;}
    if(this.modal==='video-card'){if(event.key==='Enter'||event.key==='Escape')this.dismissVideoCard();return;}
    if(this.modal==='mission-result'){if(event.key==='Enter'||event.key==='Escape')this.closeMissionResult();return;}
    if(this.modal==='mission-warning'){if(event.key==='Enter'||event.key==='Escape')this.confirmMissionWarning();return;}
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
    // Browser controls stay out of the original four-button menu layout.
    if(!event.ctrlKey&&!event.metaKey&&event.key.toLowerCase()==='m'){this.toggleSound();return;}
    if(event.key==='F11'){event.preventDefault();this.scale.toggleFullscreen();return;}
    if(event.key==='F1'){event.preventDefault();this.open('help');return;}
    if (event.key === 'Escape' && this.state.started) {
      if (this.modal === 'rehearsal') {this.attemptLeaveRehearsal();return;}
      if (this.modal === 'menu') this.running = true;
      if (this.modal === 'activity-result') { this.acknowledgeActivityResult(); return; }
      if (this.modal === 'training-result') { this.acknowledgeTrainingResult(); return; }
      const back: Partial<Record<NonNullable<Modal>, Modal>> = { 'tour-result':'tour-ongoing','tour-cancel':'tour-ongoing','tour-intro':'tour','tour-city':'tour','tour-stage':'tour','tour-expenses':'tour','tour-book':'tour','tour-ongoing':'tour-ongoing','artist-away': 'rehearsal', bandmate: 'rehearsal', 'bandmate-action': 'bandmate', 'bandmate-training': 'bandmate', recruit: 'rehearsal', songs: 'rehearsal', session: this.sessionReturn, settings: 'mixer',
        'label-action':'label','label-survey':'label',mixer: 'finish-demo', 'finish-demo': 'mixer', 'replace-demo': 'studio', contract: 'label', rejection: 'label', release: 'design', 'gangsta-action':'gangsta','gangsta-target':'gangsta-action','gangsta-security':'gangsta', 'video-book':'video', 'concert-book': 'venue', advert: 'media', 'media-action': 'media', chart: 'media' };
      this.open(this.modal ? back[this.modal] ?? null : 'menu');
    }
    if (event.key === ' ' && !this.modal && this.state.started) {
      event.preventDefault(); this.running = !this.running; this.clock = 0; this.drawHud();
    }
  }

  update(_time: number, delta: number): void {
    this.animateDate();
    if (!this.state) return;
    this.actorPortraits = this.actorPortraits.filter(item => item.layer.scene === this);
    const speech = this.feedbackAudio.playback;
    for (const item of this.actorPortraits) item.actor.update(speech.key, speech.positionSeconds,
      speech.playing&&(item.speechKey===undefined||item.speechKey.toLowerCase()===speech.key.toLowerCase()));
    if(this.modal==='tour-ongoing'&&!this.state.tour?.completed&&document.visibilityState==='visible'){
      this.clock+=Math.min(delta,100);if(this.clock>=1000){this.clock=0;this.tickDay();}
    }
    if (!this.modal && !this.tutorialId) {
      if (document.visibilityState === 'visible') this.animateCity(delta);
      const pointer = this.input.activePointer;
      const hoverCity = pointer.y > 144 && pointer.y < 564 && pointer.x >= 0 && pointer.x <= 800;
      const direction = this.cursors?.left.isDown ? -1 : this.cursors?.right.isDown ? 1
        : hoverCity && pointer.x < 45 ? -1 : hoverCity && pointer.x > 755 ? 1 : 0;
      this.scroll = Phaser.Math.Clamp(this.scroll + direction * Math.min(delta, 60) * 0.23, 0, 400);
      if (this.running && !this.missionHasEnded() && !this.state.missionProgress?.pendingFailure && document.visibilityState === 'visible') {
        this.clock += Math.min(delta, 100);
        if (this.clock >= 3000) { this.clock -= 3000; this.tickDay(); }
      }
    }
    this.world.x = -this.scroll;
    this.updateStatus();
  }
}

