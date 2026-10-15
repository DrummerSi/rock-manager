import Phaser from 'phaser';
import { button, frame, title } from './canvas-ui';
import { nativeText } from './native-text';
import { originalImageKey } from './agenda';

export interface EventCardOptions {
    headline: string;
    text: string;
    icon?: string;
    portraitKey?: string;
    pictureKind?: 'human' | 'album' | 'concert' | 'illustration';
    pictureRegistration?: {x:number; y:number};
    caption?: string;
    windowTitle?: string;
    question?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    confirmIcon?: string;
    cancelIcon?: string;
    onConfirm: () => void;
    onCancel?: () => void;
}
export interface EventCardBounds {
    bounds: Phaser.Geom.Rectangle;
    buttonY: number;
    buttonCenter: Phaser.Math.Vector2;
    portraitRect?: Phaser.Geom.Rectangle;
}
/** Director's content-sized NoPic/SmallPic event-card layouts. */
export function renderEventCard(scene: Phaser.Scene, parent: Phaser.GameObjects.Container, options: EventCardOptions): EventCardBounds {
    const content = scene.add.container();
    const hasPortrait = Boolean(options.portraitKey && scene.textures.exists(options.portraitKey));
    const infoX = hasPortrait ? 107 + 7 : 0;
    const infoWidth = hasPortrait ? 199 : 305;
    const makeText = (x: number, y: number, value: string, bold = false, width = infoWidth, size = 11) => {
        const label = nativeText(scene, x, y, value.replaceAll('\\n', '\n').replaceAll('\x96','–'), {
            fontFamily: 'Verdana', fontSize: size, fontStyle: bold ? 'bold' : '', color: '#f5f5f5',
            wordWrap: {width,useAdvancedWrap:true}, lineSpacing: 1,
        }).setNativeAntialias(false);
        content.add(label); return label;
    };
    const headline=makeText(infoX,0,options.headline,true);
    const body=makeText(infoX,headline.height+15,options.text);
    let infoHeight=body.y+body.height;
    if(options.question) {
        const question=makeText(infoX,infoHeight+15,options.question);
        infoHeight=question.y+question.height;
    }
    let portraitHeight=0;
    let pictureBounds: Phaser.Geom.Rectangle | undefined;
    if(hasPortrait) {
        // Source pictures use center registration49,52; source album/concert
        // small artwork is93x98. Frame remains its recovered107x112 size.
        content.add(scene.add.image(0,0,originalImageKey(scene,'portrait_frame_large01')).setOrigin(0));
        const registration=options.pictureRegistration??{x:46,y:49};
        const image=scene.add.image(49-registration.x,52-registration.y,options.portraitKey!).setOrigin(0);
        if(options.pictureKind==='album'||options.pictureKind==='concert')image.setDisplaySize(93,98);
        content.add(image);
        pictureBounds=new Phaser.Geom.Rectangle(image.x,image.y,image.displayWidth,image.displayHeight);
        portraitHeight=112;
        if(options.caption) {
            const caption=makeText(0,113,options.caption,false,90,9);
            portraitHeight=caption.y+caption.height;
        }
    }
    const contentWidth=infoX+infoWidth, contentHeight=Math.ceil(Math.max(infoHeight,portraitHeight));
    const width=17+contentWidth+20, height=46+contentHeight+13+33+20;
    const x=Math.round(400-width/2), y=Math.round(305-height/2);
    parent.setData('eventCardBounds',{x,y,width,height});
    const window=scene.add.container(x,y); parent.add(window);
    frame(scene,window,0,0,width,height,'dialog',false,'#505050');
    const icon=(options.icon??'icon_megaphone01').replace(/^icon_/,'').replace(/01$/,'');
    title(scene,window,0,0,options.windowTitle??options.headline,icon);
    content.setPosition(17,46);window.add(content);
    const confirmLabel=options.confirmLabel??'OK', confirmIcon=options.confirmIcon??'accept';
    const measureButton=(label:string,icon:string)=>{
        const caption=nativeText(scene,0,0,label,{fontFamily:'Courier New',fontSize:'14px',fontStyle:'bold'});
        const width=Math.ceil(29+scene.textures.get('ui-'+icon).getSourceImage().width+caption.width);
        caption.destroy();return width;
    };
    const buttonWidth=measureButton(confirmLabel,confirmIcon), localButtonY=46+contentHeight+13;
    const cancelLabel=options.cancelLabel??'Cancel',cancelIcon=options.cancelIcon??'cancel';
    const cancelWidth=options.onCancel?measureButton(cancelLabel,cancelIcon):0;
    const pairWidth=buttonWidth+(options.onCancel?4+cancelWidth:0);
    const localButtonX=17+(contentWidth-pairWidth)/2;
    button(scene,window,localButtonX,localButtonY,buttonWidth,confirmLabel,options.onConfirm,true,33,confirmIcon);
    if(options.onCancel)button(scene,window,localButtonX+buttonWidth+4,localButtonY,cancelWidth,cancelLabel,options.onCancel,true,33,cancelIcon);
    parent.setData('eventCardButtons',{confirm:{x:x+localButtonX+buttonWidth/2,y:y+localButtonY+16},
        ...(options.onCancel?{cancel:{x:x+localButtonX+buttonWidth+4+cancelWidth/2,y:y+localButtonY+16}}:{})});
    return {bounds:new Phaser.Geom.Rectangle(x,y,width,height),buttonY:y+localButtonY,
        buttonCenter:new Phaser.Math.Vector2(x+localButtonX+buttonWidth/2,y+localButtonY+16),
        portraitRect:pictureBounds?new Phaser.Geom.Rectangle(x+17+pictureBounds.x,y+46+pictureBounds.y,pictureBounds.width,pictureBounds.height):undefined};
}
