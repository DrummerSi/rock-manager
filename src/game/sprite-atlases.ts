import Phaser from 'phaser';
import manifest from '../generated/sprite-atlases.json';

/** Load each file once; publish the original keys after loading completes. */
export function preloadSpriteAtlases(scene:Phaser.Scene):void {
  const base=import.meta.env.BASE_URL+'assets/';
  for(const page of manifest.pages)scene.load.atlas(page.key,base+page.image+'?v='+page.version,base+page.json+'?v='+page.version);
  for(const image of manifest.standalone)scene.load.image(image.aliases[0],base+image.file+'?v='+image.version);
}

/** A keyed view into an atlas, sharing its GPU source rather than uploading
 * another texture. Legacy canvas compositors receive a lazy, exact crop.
 * Existing registration points and all Image/setTexture call sites stay valid.
 */
function aliasTexture(manager:Phaser.Textures.TextureManager,key:string,source:Phaser.Textures.Texture,frameName:string):void {
  if(manager.exists(key))return;
  const frame=source.get(frameName),texture=manager.create(key,[],frame.width,frame.height)!;
  texture.source=[frame.source];
  texture.add('__BASE',0,frame.cutX,frame.cutY,frame.cutWidth,frame.cutHeight);
  let crop:HTMLCanvasElement|undefined;
  texture.getSourceImage=()=>{
    if(!crop){
      crop=document.createElement('canvas');crop.width=frame.cutWidth;crop.height=frame.cutHeight;
      crop.getContext('2d')!.drawImage(frame.source.image as CanvasImageSource,frame.cutX,frame.cutY,frame.cutWidth,frame.cutHeight,0,0,frame.cutWidth,frame.cutHeight);
    }
    return crop;
  };
  const destroy=texture.destroy.bind(texture);
  texture.destroy=()=>{texture.source=[];crop=undefined;destroy();};
  manager.emit(Phaser.Textures.Events.ADD,key,texture);
  manager.emit(Phaser.Textures.Events.ADD_KEY+key,texture);
}

export function registerSpriteAtlasKeys(manager:Phaser.Textures.TextureManager):void {
  for(const page of manifest.pages){
    const source=manager.get(page.key);
    for(const [key,frame] of Object.entries(page.aliases))aliasTexture(manager,key,source,frame);
  }
  for(const image of manifest.standalone){
    const source=manager.get(image.aliases[0]);
    for(const key of image.aliases.slice(1))aliasTexture(manager,key,source,'__BASE');
  }
}
