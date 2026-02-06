import { Container, Graphics, Sprite } from 'pixi.js';
import type { BuildingType } from '../../types';
import { getBuildingSize, getBuildingTexture } from '../assets/PixelTextures';

/**
 * Interactive building exterior sprite drawn via Graphics.
 */
export class BuildingSprite extends Container {
  private hoverOutline: Graphics;
  private size: { w: number; h: number };

  constructor(buildingType: BuildingType) {
    super();

    const size = getBuildingSize(buildingType);
    this.size = size;

    // Shadow
    const shadow = new Graphics();
    shadow.ellipse(0, 0, size.w * 0.35, 8);
    shadow.fill({ color: 0x000000, alpha: 0.12 });
    shadow.y = 4;
    this.addChild(shadow);

    // Main building sprite
    const sprite = new Sprite(getBuildingTexture(buildingType));
    sprite.anchor.set(0.5, 1);
    this.addChild(sprite);

    // Hover outline
    this.hoverOutline = new Graphics();
    this.hoverOutline.rect(-size.w / 2 - 3, -size.h - 3, size.w + 6, size.h + 6);
    this.hoverOutline.stroke({ color: 0xffd050, width: 2 });
    this.hoverOutline.visible = false;
    this.addChild(this.hoverOutline);

    // Interactive
    this.eventMode = 'static';
    this.cursor = 'pointer';
    this.on('pointerenter', () => { this.hoverOutline.visible = true; });
    this.on('pointerleave', () => { this.hoverOutline.visible = false; });
  }

  getBuildingDimensions(): { w: number; h: number } {
    return { w: this.size.w, h: this.size.h };
  }
}
