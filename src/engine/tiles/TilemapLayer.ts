import { Container, Sprite } from 'pixi.js';
import type { TileId } from '../assets/PixelTextures';
import { getTileTexture } from '../assets/PixelTextures';

/**
 * Simple tilemap renderer using individual sprites.
 */
export class TilemapLayer extends Container {
  constructor(map: TileId[][], tileSize: number) {
    super();

    for (let y = 0; y < map.length; y += 1) {
      const row = map[y];
      for (let x = 0; x < row.length; x += 1) {
        const tile = row[x];
        const sprite = new Sprite(getTileTexture(tile));
        sprite.x = x * tileSize;
        sprite.y = y * tileSize;
        sprite.width = tileSize;
        sprite.height = tileSize;
        this.addChild(sprite);
      }
    }
  }
}
