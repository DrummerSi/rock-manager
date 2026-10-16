import Phaser from 'phaser';
import data from '../generated/game-data.json' with {type:'json'};
import {BrowserSaveStore} from '../game/storage';
import {missionPreviewPaths} from '../game/song-audio';
import {hasAudioData,retainAudioData} from '../game/audio-data';
import {preloadSpriteAtlases,registerSpriteAtlasKeys} from '../game/sprite-atlases';

/** Load the small logo first, then display it while the game assets load. */
export class PreloadScene extends Phaser.Scene {
  constructor(){super('Preload');}

  preload():void {
    if(!this.textures.exists('preload-logo'))this.load.image('preload-logo',import.meta.env.BASE_URL+'assets/logo.png');
  }

  create():void {
    this.cameras.main.setBackgroundColor('#170f19');
    if(this.textures.exists('preload-logo'))this.add.image(400,250,'preload-logo');
    const bar=this.add.graphics(),percentage=this.add.text(400,448,'0%',{
      fontFamily:'Arial',fontSize:'13px',color:'#c9b98f',letterSpacing:2,
    }).setOrigin(.5);
    const draw=(amount:number)=>{
      const width=Math.floor(316*Phaser.Math.Clamp(amount,0,1));
      bar.clear();
      bar.fillStyle(0x09070b).fillRoundedRect(238,407,324,20,5);
      bar.lineStyle(1,0x78613e).strokeRoundedRect(238,407,324,20,5);
      bar.fillStyle(0x302331).fillRoundedRect(242,411,316,12,2);
      if(width){
        bar.fillStyle(0xb58d48).fillRect(242,411,width,12);
        bar.fillStyle(0xe2c583).fillRect(242,411,width,4);
        bar.fillStyle(0x79582f).fillRect(242,421,width,2);
      }
      percentage.setText(Math.floor(amount*100)+'%');
    };
    draw(0);
    const failed=new Set<string>(this.textures.exists('preload-logo')?[]:['preload-logo']);
    const missionId=new BrowserSaveStore().load(data.allMusicians)?.missionId??'Mission01';
    const previews=missionPreviewPaths(missionId);
    const onError=(file:Phaser.Loader.File)=>failed.add(file.key);
    const complete=()=>{
      this.load.off('progress',draw);this.load.off('loaderror',onError);
      if(failed.size){
        bar.setVisible(false);percentage.setVisible(false);
        this.add.text(400,403,'Some files could not be loaded.\nCheck your connection and try again.',{
          fontFamily:'Arial',fontSize:'14px',color:'#e0d9cb',align:'center',lineSpacing:6,
        }).setOrigin(.5);
        const retry=this.add.rectangle(400,470,150,36,0x302331).setStrokeStyle(1,0xb58d48).setInteractive({useHandCursor:true});
        this.add.text(400,470,'Retry',{fontFamily:'Arial',fontSize:'14px',color:'#e2c583'}).setOrigin(.5);
        retry.on('pointerover',()=>retry.setFillStyle(0x453348));
        retry.on('pointerout',()=>retry.setFillStyle(0x302331));
        retry.once('pointerup',()=>this.scene.restart());return;
      }
      for(const path of previews){
        const key='song-preview:'+path,bytes=this.cache.binary.get(key) as ArrayBuffer|undefined;
        if(bytes){retainAudioData(path,bytes);this.cache.binary.remove(key);}
      }
      registerSpriteAtlasKeys(this.textures);draw(1);
      this.input.enabled=false;
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE,()=>this.scene.start('Game',{fadeIn:true}));
      this.cameras.main.fadeOut(400,0,0,0);
    };
    this.load.on('progress',draw);this.load.on('loaderror',onError);this.load.once('complete',complete);
    this.events.once('shutdown',()=>{
      this.load.off('progress',draw);this.load.off('loaderror',onError);this.load.off('complete',complete);
    });
    preloadSpriteAtlases(this);
    if(!this.cache.audio.exists('ambience'))this.load.audio('ambience',import.meta.env.BASE_URL+'assets/city-ambience.wav');
    for(const path of previews){
      const key='song-preview:'+path;
      if(!hasAudioData(path)&&!this.cache.binary.exists(key))this.load.binary(key,import.meta.env.BASE_URL+'assets/'+path);
    }
    // Phaser also completes an empty queue on a fully cached retry.
    this.load.start();
  }
}
