import Phaser from 'phaser';

/** Match the RGB555 output observed in the original 16-bit Director runtime. */
export class NativeDisplay extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
  constructor(game: Phaser.Game) {
    super({ game, renderTarget: true, fragShader: `
      precision highp float;
      uniform sampler2D uMainSampler;
      varying vec2 outTexCoord;
      void main() {
        vec4 color = texture2D(uMainSampler, outTexCoord);
        vec3 five = floor(clamp(color.rgb, 0.0, 1.0) * 255.0 / 8.0 + 0.00001);
        color.rgb = (five * 8.0 + floor(five / 4.0)) / 255.0;
        gl_FragColor = color;
      }
    ` });
  }
}
