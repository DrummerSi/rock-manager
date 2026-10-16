import type Phaser from 'phaser';
import {pressReviewWindow} from './press-review-window';
import type {ScenarioCard,ScenarioWindowOptions} from './scenario-window';

/** Story event cards use the same original animated news/magazine profile.
 * Card override bypasses the album-review rating lookup entirely. No gameplay
 * state or synthetic review is added to the game model.
 */
export function scenarioPressWindow(scene:Phaser.Scene,parent:Phaser.GameObjects.Container,card:ScenarioCard,options:ScenarioWindowOptions){
  return pressReviewWindow(scene,parent,{band:[],album:null,bandName:''},[],
    {id:'scenario-press-profile',mediaId:/Media04/i.test(card.dataMemberName)?'Media04':'Media03',day:0,rating:0,quality:0},options.confirm,
    {card,pictureKey:options.portraitKey,expand:options.expand,cancel:options.cancel});
}
