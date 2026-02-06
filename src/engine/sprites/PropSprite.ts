import { Container, Graphics, Sprite } from 'pixi.js';
import { getPropSize, getPropTexture } from '../assets/PixelTextures';

export type PropType =
  | 'tree_small'
  | 'tree_medium'
  | 'tree_large'
  | 'bush_1'
  | 'bush_2'
  | 'flowers_patch'
  | 'bench'
  | 'lamp'
  | 'fountain'
  | 'fence'
  | 'desk'
  | 'computer'
  | 'whiteboard'
  | 'bookshelf'
  | 'shelf';

/**
 * Simple prop sprites drawn with Graphics.
 */
export class PropSprite extends Container {
  constructor(type: PropType) {
    super();

    const texture = getPropTexture(type);
    const sprite = new Sprite(texture);
    const size = getPropSize(type);

    sprite.anchor.set(0.5, 1);
    this.addChild(sprite);

    if (type !== 'whiteboard' && type !== 'fence' && type !== 'lamp') {
      const shadow = new Graphics();
      shadow.ellipse(0, 2, size.w * 0.3, 4);
      shadow.fill({ color: 0x000000, alpha: 0.12 });
      this.addChildAt(shadow, 0);
    }
  }
}
