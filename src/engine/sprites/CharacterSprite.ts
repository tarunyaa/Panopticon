import { AnimatedSprite, Container, Graphics, Rectangle, Text, TextStyle, Texture } from 'pixi.js';
import { Assets } from 'pixi.js';
import type { BodyType, HairType, IdleVariant, CharacterStatus, AccessoryType, PropType } from '../../types';

interface CharacterSpriteOptions {
  bodyWidth: number;
  bodyHeight: number;
  bodyColor: string;
  skinColor: string;
  accentColor: string;
  bodyType: BodyType;
  hairType: HairType;
  accessoryType: AccessoryType;
  propType: PropType;
  idleVariant: IdleVariant;
  scale?: number;
  interactive?: boolean;
  textureKey?: string;
  sheetConfig?: {
    frameWidth: number;
    frameHeight: number;
    row: number;
    frames: number;
  };
}

// Status emoji lookup
const STATUS_EMOJI: Record<CharacterStatus, string> = {
  working: '\u2699',  // gear
  done: '\u2714',     // check
  waiting: '\u23F3',  // hourglass
  idle: '\u00B7',     // middle dot (subtle)
};

/**
 * Pixi Container representing a character with body, head, hair, shadow, status bubble.
 * All drawn via Graphics (no PNGs needed).
 */
export class CharacterSprite extends Container {
  private shadow: Graphics;
  private body: Graphics | null = null;
  private head: Graphics | null = null;
  private hair: Graphics | null = null;
  private eyes: Graphics | null = null;
  private face: Graphics | null = null;
  private accessory: Graphics | null = null;
  private prop: Graphics | null = null;
  private avatarSprite: AnimatedSprite | null = null;
  private statusBubble: Container;
  private statusText: Text;
  private hoverOutline: Graphics;

  private idleTime = 0;
  private idleVariant: IdleVariant;
  private blinkTimer = 0;
  private blinkInterval: number;
  private isBlinking = false;

  private bodyHeight: number;
  private headHeight: number;
  private usesTexture: boolean;

  constructor(opts: CharacterSpriteOptions) {
    super();

    this.idleVariant = opts.idleVariant;
    this.usesTexture = Boolean(opts.textureKey);
    this.bodyHeight = opts.bodyHeight;
    this.headHeight = this.getHeadSize(opts.bodyType, opts.bodyWidth).h;
    this.blinkInterval = 2000 + Math.random() * 3000;

    const s = opts.scale ?? 1;
    this.scale.set(s);

    const bw = opts.bodyWidth;
    const bh = opts.bodyHeight;
    const headSize = this.getHeadSize(opts.bodyType, bw);

    // Shadow (ellipse at feet)
    this.shadow = new Graphics();
    this.shadow.ellipse(0, 0, bw * 0.45, 4);
    this.shadow.fill({ color: 0x000000, alpha: 0.15 });
    this.shadow.y = 0;
    this.addChild(this.shadow);

    let bodyDims = { w: bw, h: bh };

    if (opts.textureKey) {
      const texture = Assets.get(opts.textureKey) as Texture | undefined;
      if (!texture) {
        throw new Error(`Missing avatar texture: ${opts.textureKey}`);
      }
      const sheet = opts.sheetConfig;
      if (!sheet) {
        throw new Error(`Missing sheetConfig for avatar: ${opts.textureKey}`);
      }
      const frames = this.buildFrames(texture, sheet.frameWidth, sheet.frameHeight, sheet.row, sheet.frames);
      this.avatarSprite = new AnimatedSprite(frames);
      this.avatarSprite.anchor.set(0.5, 1);
      this.avatarSprite.animationSpeed = 0.12;
      this.avatarSprite.play();
      this.addChild(this.avatarSprite);
      bodyDims = { w: sheet.frameWidth, h: sheet.frameHeight };
      this.bodyHeight = sheet.frameHeight;
      this.headHeight = Math.round(sheet.frameHeight * 0.55);
      if (bw > 0) {
        this.shadow.scale.x = (sheet.frameWidth / bw) * 0.9;
      }
    } else {
      // Body
      this.body = new Graphics();
      bodyDims = this.getBodyDims(opts.bodyType, bw, bh);
      this.drawBody(opts.bodyType, bodyDims.w, bodyDims.h, opts.bodyColor, opts.accentColor);
      this.body.y = -bodyDims.h;
      this.body.x = -bodyDims.w / 2;
      this.addChild(this.body);

      // Head
      this.head = new Graphics();
      this.head.rect(0, 0, headSize.w, headSize.h);
      this.head.fill(opts.skinColor);
      this.head.x = -headSize.w / 2;
      this.head.y = this.body.y - headSize.h + 6;
      this.addChild(this.head);

      // Eyes
      this.eyes = new Graphics();
      this.drawEyes(headSize.w, headSize.h);
      this.eyes.x = this.head.x;
      this.eyes.y = this.head.y;
      this.addChild(this.eyes);

      // Face details
      this.face = new Graphics();
      this.drawFace(headSize.w, headSize.h);
      this.face.x = this.head.x;
      this.face.y = this.head.y;
      this.addChild(this.face);

      // Hair
      this.hair = new Graphics();
      this.drawHair(opts.hairType, headSize.w, headSize.h, opts.accentColor);
      this.hair.x = this.head.x;
      this.hair.y = this.head.y;
      this.addChild(this.hair);

      // Accessories (glasses, hats, headphones)
      this.accessory = new Graphics();
      this.drawAccessory(opts.accessoryType, headSize.w, headSize.h, opts.accentColor);
      this.accessory.x = this.head.x;
      this.accessory.y = this.head.y;
      this.addChild(this.accessory);

      // Props (small handheld)
      this.prop = new Graphics();
      this.drawProp(opts.propType, bodyDims.w, bodyDims.h, opts.accentColor);
      this.prop.x = 0;
      this.prop.y = this.body.y + bodyDims.h * 0.6;
      this.addChild(this.prop);
    }

    // Hover outline (hidden by default)
    this.hoverOutline = new Graphics();
    this.hoverOutline.visible = false;
    this.addChild(this.hoverOutline);
    this.drawHoverOutline(bodyDims.w, bodyDims.h, this.headHeight);

    // Status bubble
    this.statusBubble = new Container();
    this.statusBubble.y = -bodyDims.h - this.headHeight - 12;

    const bubbleBg = new Graphics();
    bubbleBg.roundRect(-8, -8, 16, 16, 2);
    bubbleBg.fill({ color: 0xffffff, alpha: 0.85 });
    bubbleBg.stroke({ color: 0x2b2b2b, width: 1 });
    this.statusBubble.addChild(bubbleBg);

    this.statusText = new Text({
      text: '',
      style: new TextStyle({ fontSize: 10, fontFamily: 'system-ui' }),
    });
    this.statusText.anchor.set(0.5);
    this.statusBubble.addChild(this.statusText);
    this.statusBubble.visible = false;
    this.addChild(this.statusBubble);

    // Interactivity
    if (opts.interactive) {
      this.eventMode = 'static';
      this.cursor = 'pointer';
      this.on('pointerenter', () => { this.hoverOutline.visible = true; });
      this.on('pointerleave', () => { this.hoverOutline.visible = false; });
    }

    // Randomize initial idle phase
    this.idleTime = Math.random() * Math.PI * 2;
  }

  private getHeadSize(bodyType: BodyType, bw: number): { w: number; h: number } {
    switch (bodyType) {
      case 'bigHead': return { w: bw + 6, h: 20 };
      case 'robot': return { w: bw + 2, h: 16 };
      default: return { w: bw + 4, h: 18 };
    }
  }

  private getBodyDims(bodyType: BodyType, bw: number, bh: number): { w: number; h: number } {
    switch (bodyType) {
      case 'tall': return { w: bw - 2, h: Math.max(16, bh - 10) };
      case 'bigHead': return { w: bw - 4, h: Math.max(14, bh - 12) };
      case 'robot': return { w: bw - 2, h: Math.max(16, bh - 10) };
      default: return { w: bw - 2, h: Math.max(16, bh - 10) };
    }
  }

  private drawBody(bodyType: BodyType, w: number, h: number, color: string, accent: string): void {
    this.body.rect(0, 0, w, h);
    this.body.fill(color);

    // Body type details
    switch (bodyType) {
      case 'hoodie': {
        // Hood shape on top
        this.body.rect(2, 0, w - 4, 6);
        this.body.fill(color);
        this.body.rect(2, h - 6, w - 4, 2);
        this.body.fill({ color: 0x000000, alpha: 0.1 });
        break;
      }
      case 'coat': {
        // Lapel lines
        this.body.rect(w / 2 - 1, 0, 2, h);
        this.body.fill({ color: 0x000000, alpha: 0.1 });
        this.body.rect(2, h - 6, w - 4, 2);
        this.body.fill({ color: 0x000000, alpha: 0.1 });
        break;
      }
      case 'robot': {
        // Antenna
        this.body.rect(w / 2 - 1, -4, 2, 4);
        this.body.fill(0x666666);
        this.body.rect(w / 2 - 2, -6, 4, 3);
        this.body.fill(0x888888);
        this.body.rect(3, 4, w - 6, 4);
        this.body.fill({ color: 0x000000, alpha: 0.15 });
        break;
      }
      default: {
        // Shirt stripe
        this.body.rect(2, h * 0.4, w - 4, 3);
        this.body.fill(accent);
        break;
      }
    }
  }

  private drawEyes(headW: number, headH: number): void {
    const eyeY = headH * 0.5;
    const eyeSpacing = headW * 0.22;
    // Left eye
    this.eyes.rect(Math.round(headW / 2 - eyeSpacing - 2), Math.round(eyeY), 3, 3);
    this.eyes.fill(0x2b2b2b);
    // Right eye
    this.eyes.rect(Math.round(headW / 2 + eyeSpacing - 1), Math.round(eyeY), 3, 3);
    this.eyes.fill(0x2b2b2b);
  }

  private drawFace(headW: number, headH: number): void {
    // Blush cheeks
    this.face.rect(3, headH - 6, 3, 2);
    this.face.fill({ color: 0xE8A598, alpha: 0.6 });
    this.face.rect(headW - 6, headH - 6, 3, 2);
    this.face.fill({ color: 0xE8A598, alpha: 0.6 });

    // Small mouth
    this.face.rect(Math.round(headW / 2) - 2, Math.round(headH * 0.7), 4, 1);
    this.face.fill(0x5a3a3a);
  }

  private drawHair(hairType: HairType, headW: number, _headH: number, color: string): void {
    switch (hairType) {
      case 'short':
        // Spiky top
        this.hair.rect(1, -2, headW - 2, 4);
        this.hair.fill(color);
        this.hair.rect(3, -4, 4, 3);
        this.hair.fill(color);
        this.hair.rect(headW - 7, -4, 4, 3);
        this.hair.fill(color);
        break;
      case 'bun':
        // Top bun
        this.hair.rect(headW / 2 - 4, -6, 8, 6);
        this.hair.fill(color);
        this.hair.rect(2, 0, headW - 4, 4);
        this.hair.fill(color);
        break;
      case 'curly':
        // Curly all around
        this.hair.rect(-2, -2, headW + 4, 5);
        this.hair.fill(color);
        this.hair.rect(0, -4, headW, 3);
        this.hair.fill(color);
        break;
      case 'none':
        break;
    }
  }

  private drawAccessory(type: AccessoryType, headW: number, headH: number, color: string): void {
    switch (type) {
      case 'glassesRound': {
        this.accessory.rect(4, headH * 0.45, 6, 5);
        this.accessory.rect(headW - 10, headH * 0.45, 6, 5);
        this.accessory.fill({ color: 0x2b2b2b });
        this.accessory.rect(headW / 2 - 2, headH * 0.5, 4, 1);
        this.accessory.fill({ color: 0x2b2b2b });
        break;
      }
      case 'glassesSquare': {
        this.accessory.rect(3, headH * 0.45, 7, 5);
        this.accessory.rect(headW - 10, headH * 0.45, 7, 5);
        this.accessory.fill({ color: 0x2b2b2b });
        this.accessory.rect(headW / 2 - 2, headH * 0.5, 4, 1);
        this.accessory.fill({ color: 0x2b2b2b });
        break;
      }
      case 'headphones': {
        this.accessory.rect(2, headH * 0.3, 3, 9);
        this.accessory.rect(headW - 5, headH * 0.3, 3, 9);
        this.accessory.fill({ color: 0x2b2b2b });
        this.accessory.rect(4, headH * 0.2, headW - 8, 2);
        this.accessory.fill({ color: 0x2b2b2b });
        break;
      }
      case 'beanie': {
        this.accessory.rect(2, -2, headW - 4, 6);
        this.accessory.fill(color);
        this.accessory.rect(headW / 2 - 2, -5, 4, 3);
        this.accessory.fill({ color: 0xffffff, alpha: 0.7 });
        break;
      }
      case 'cap': {
        this.accessory.rect(2, -1, headW - 4, 4);
        this.accessory.fill(color);
        this.accessory.rect(headW / 2 - 8, 2, 16, 2);
        this.accessory.fill({ color: 0x2b2b2b, alpha: 0.2 });
        break;
      }
      case 'none':
        break;
    }
  }

  private drawProp(type: PropType, bodyW: number, bodyH: number, color: string): void {
    if (type === 'none') return;

    const x = bodyW / 2 + 2;
    const y = bodyH * 0.4;
    switch (type) {
      case 'coffee':
        this.prop.rect(x, y, 4, 5);
        this.prop.fill(0x8B6B4A);
        this.prop.rect(x + 4, y + 1, 2, 2);
        this.prop.fill(0x8B6B4A);
        break;
      case 'book':
        this.prop.rect(x, y, 6, 5);
        this.prop.fill(0x5088C0);
        break;
      case 'laptop':
        this.prop.rect(x, y, 6, 4);
        this.prop.fill(0x333333);
        this.prop.rect(x + 1, y + 1, 4, 2);
        this.prop.fill(0x60A060);
        break;
      case 'clipboard':
        this.prop.rect(x, y, 5, 6);
        this.prop.fill(0xD0C8B8);
        this.prop.rect(x + 1, y + 1, 3, 1);
        this.prop.fill(0x2b2b2b);
        break;
      case 'wrench':
        this.prop.rect(x, y + 1, 5, 2);
        this.prop.fill(0x888888);
        this.prop.rect(x + 4, y, 2, 4);
        this.prop.fill(0x888888);
        break;
      case 'plant':
        this.prop.rect(x + 1, y + 2, 4, 3);
        this.prop.fill(0x8B6B4A);
        this.prop.rect(x, y, 6, 2);
        this.prop.fill(color);
        break;
    }
  }

  private drawHoverOutline(bw: number, bh: number, headH: number): void {
    const pad = 3;
    this.hoverOutline.rect(
      -bw / 2 - pad,
      -bh - headH - pad,
      bw + pad * 2,
      bh + headH + pad * 2,
    );
    this.hoverOutline.stroke({ color: 0xffd050, width: 2 });
  }

  setStatus(status: CharacterStatus): void {
    const emoji = STATUS_EMOJI[status];
    if (status === 'idle') {
      this.statusBubble.visible = false;
    } else {
      this.statusBubble.visible = true;
      this.statusText.text = emoji;
    }
  }

  updateAnimation(dt: number): void {
    // Idle bob
    this.idleTime += dt * 0.05;
    const bobAmplitudes = [1.5, 2.0, 1.0];
    const amp = bobAmplitudes[this.idleVariant];
    const bob = Math.sin(this.idleTime) * amp;

    if (this.avatarSprite) {
      this.avatarSprite.y = bob;
    } else if (this.body && this.head && this.eyes && this.face && this.hair && this.accessory && this.prop) {
      // Apply to body and above (not shadow)
      this.body.y = -this.bodyHeight + bob;
      this.head.y = this.body.y - this.getHeadSize('round', 20).h + 6 + bob * 0.5;
      this.eyes.y = this.head.y;
      this.face.y = this.head.y;
      this.hair.y = this.head.y;
      this.accessory.y = this.head.y;
      this.prop.y = this.body.y + this.bodyHeight * 0.6 + bob * 0.2;
    }

    // Blink
    if (this.eyes) {
      this.blinkTimer += dt * 16.67;
      if (this.isBlinking) {
        if (this.blinkTimer > 100) {
          this.eyes.visible = true;
          this.isBlinking = false;
          this.blinkTimer = 0;
          this.blinkInterval = 2000 + Math.random() * 3000;
        }
      } else if (this.blinkTimer > this.blinkInterval) {
        this.eyes.visible = false;
        this.isBlinking = true;
        this.blinkTimer = 0;
      }
    }
  }

  private buildFrames(
    texture: Texture,
    frameWidth: number,
    frameHeight: number,
    row: number,
    frames: number,
  ): Texture[] {
    const result: Texture[] = [];
    for (let i = 0; i < frames; i += 1) {
      result.push(
        new Texture({
          source: texture.source,
          frame: new Rectangle(i * frameWidth, row * frameHeight, frameWidth, frameHeight),
        }),
      );
    }
    return result;
  }
}
