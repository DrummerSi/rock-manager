import Phaser from 'phaser';
import evidence from '../generated/native-fonts.json' with { type: 'json' };

type Atlas = typeof evidence.atlases[number];
type Glyph = Atlas['glyphs'][number];
const glyphMaps = new Map<string, Map<number, Glyph>>();
const kerningMaps = new Map<string, Map<string, number>>();
const tinted = new WeakMap<Phaser.Textures.TextureManager, Map<string, HTMLCanvasElement>>();
function fontAtlas(label: NativeText): Atlas | undefined {
    const family = label.style.fontFamily.split(',')[0].replaceAll('"', '').replaceAll("'", '').trim();
    const size = Math.round(parseFloat(String(label.style.fontSize)));
    const bold = /bold|700/i.test(label.style.fontStyle);
    // Source DlgHeadlineData has antialias0; source button fields have
    // Courier New14bold antialias1. Other rich-text profiles remain unverified.
    const verifiedHeading = family === 'Verdana' && size === 11 && bold;
    const sourceControl = family === 'Courier New' && size === 14 && bold;
    if (label.nativeAntialias === null && !verifiedHeading && !sourceControl) return undefined;
    const antialias = label.nativeAntialias ?? sourceControl;
    return evidence.atlases.find(a => a.family.toLowerCase() === family.toLowerCase() && a.size === size && (a.weight === 700) === bold && a.antialias === antialias);
}
function maps(atlas: Atlas) {
    if (!glyphMaps.has(atlas.id)) {
        glyphMaps.set(atlas.id, new Map(atlas.glyphs.map(g => [g.code, g])));
        kerningMaps.set(atlas.id, new Map(atlas.kerning.map(p => [`${p.first}:${p.second}`, p.amount])));
    }
    return { glyphs: glyphMaps.get(atlas.id)!, kerning: kerningMaps.get(atlas.id)! };
}
function measure(value: string, atlas: Atlas, spacing: number): number {
    const { glyphs } = maps(atlas);
    let width = 0, last = 0;
    for (const character of value) {
        const code = character.codePointAt(0)!;
        const glyph = glyphs.get(code) ?? glyphs.get(63)!;
        // Native XMED samples use glyph advances plus explicit tracking.
        // Applying modern GDI pair kerning shifts "Well" after the initial W.
        if (last) width += spacing;
        width += glyph.advance; last = code;
    }
    return Math.max(0, width);
}
function wrap(value: string, maxWidth: number, atlas: Atlas, spacing: number): string[] {
    const paragraphs = value.replaceAll('\r\n', '\n').replaceAll('\r', '\n').split('\n');
    if (!maxWidth) return paragraphs;
    const lines: string[] = [];
    for (const paragraph of paragraphs) {
        let line = '';
        for (const word of paragraph.trim().split(/\s+/)) {
            const candidate = line ? `${line} ${word}` : word;
            if (line && measure(candidate, atlas, spacing) > maxWidth) { lines.push(line); line = ''; }
            if (measure(word, atlas, spacing) <= maxWidth) { line = line ? `${line} ${word}` : word; continue; }
            for (const character of word) {
                if (line && measure(line + character, atlas, spacing) > maxWidth) { lines.push(line); line = ''; }
                line += character;
            }
        }
        lines.push(line);
    }
    return lines;
}
function tintedAtlas(scene: Phaser.Scene, atlas: Atlas, color: string): HTMLCanvasElement {
    const textures = scene.textures;
    if (!tinted.has(textures)) tinted.set(textures, new Map());
    const cache = tinted.get(textures)!, key = atlas.id + ':' + color;
    const existing = cache.get(key);
    if (existing) return existing;
    const source = textures.get(`native-font-${atlas.id}`).getSourceImage() as HTMLImageElement;
    const canvas = document.createElement('canvas'); canvas.width = source.width; canvas.height = source.height;
    const context = canvas.getContext('2d')!;
    context.drawImage(source, 0, 0);
    context.globalCompositeOperation = 'source-in'; context.fillStyle = color; context.fillRect(0, 0, canvas.width, canvas.height);
    cache.set(key, canvas);
    return canvas;
}

/** Phaser Text API backed by original-platform GDI glyphs for recovered profiles. */
export class NativeText extends Phaser.GameObjects.Text {
    private nativeReady = false;
    nativeFontId: string | null = null;
    nativeAntialias: boolean | null = null;
    setNativeAntialias(value: boolean | null): this { this.nativeAntialias = value; return this.updateText(); }
    constructor(scene: Phaser.Scene, x: number, y: number, value: string, style: Phaser.Types.GameObjects.Text.TextStyle) {
        super(scene, x, y, value, style);
        this.nativeReady = true;
        this.updateText();
    }
    override updateText(): this {
        // Phaser invokes updateText from its constructor before our fields exist.
        if (!this.nativeReady || !this.style || !this.scene) return super.updateText();
        const atlas = fontAtlas(this);
        if (!atlas || !this.scene.textures.exists(`native-font-${atlas.id}`) || this.style.strokeThickness || this.style.rtl || this.style.wordWrapCallback
            || typeof this.style.color !== 'string' || this.style.resolution !== 1 || /italic/i.test(this.style.fontStyle)) {
            this.nativeFontId = null;
            return super.updateText();
        }
        this.nativeFontId = atlas.id;
        const lines = wrap(this.text, this.style.wordWrapWidth ?? 0, atlas, this.letterSpacing);
        const widths = lines.map(line => measure(line, atlas, this.letterSpacing));
        const textWidth = Math.max(0, ...widths);
        const step = Math.max(1, atlas.lineHeight + this.lineSpacing);
        const left = this.padding.left ?? 0, right = this.padding.right ?? 0, top = this.padding.top ?? 0, bottom = this.padding.bottom ?? 0;
        this.width = this.style.fixedWidth || Math.max(1, textWidth + left + right);
        this.height = this.style.fixedHeight || Math.max(1, atlas.lineHeight + (lines.length - 1) * step + top + bottom);
        const canvas = this.canvas, context = this.context;
        canvas.width = Math.ceil(this.width); canvas.height = Math.ceil(this.height);
        this.frame.setSize(canvas.width, canvas.height);
        this.updateDisplayOrigin();
        context.imageSmoothingEnabled = false;
        if (this.style.backgroundColor) { context.fillStyle = this.style.backgroundColor; context.fillRect(0, 0, canvas.width, canvas.height); }
        const color = this.style.color || '#ffffff';
        const image = tintedAtlas(this.scene, atlas, color);
        const { glyphs } = maps(atlas);
        for (let index = 0; index < lines.length; index++) {
            let x = left;
            const available = this.width - left - right;
            if (this.style.align === 'center') x += Math.round((available - widths[index]) / 2);
            else if (this.style.align === 'right') x += available - widths[index];
            let last = 0;
            for (const character of lines[index]) {
                const code = character.codePointAt(0)!, glyph = glyphs.get(code) ?? glyphs.get(63)!;
                if (last) x += this.letterSpacing;
                context.drawImage(image, glyph.x, glyph.y, glyph.width, glyph.height,
                    Math.round(x + glyph.offsetX), Math.round(top + index * step + glyph.offsetY), glyph.width, glyph.height);
                x += glyph.advance; last = code;
            }
        }
        const texture = this.texture as Phaser.Textures.CanvasTexture;
        texture.refresh();
        if (this.input && !this.input.customHitArea) {
            const hit = this.input.hitArea as Phaser.Geom.Rectangle;
            hit.width = this.width; hit.height = this.height;
        }
        return this;
    }
}

export function nativeText(scene: Phaser.Scene, x: number, y: number, value: string, style: Phaser.Types.GameObjects.Text.TextStyle): NativeText {
    const label = new NativeText(scene, x, y, value, style);
    scene.add.existing(label);
    return label;
}
