import type { TileId } from '../engine/assets/PixelTextures';
import { seededRandom } from '../utils/seed';

export const WORLD_TILE_SIZE = 16;
export const WORLD_COLS = 56;
export const WORLD_ROWS = 34;
export const WORLD_WIDTH = WORLD_COLS * WORLD_TILE_SIZE;
export const WORLD_HEIGHT = WORLD_ROWS * WORLD_TILE_SIZE;

function createBlankWorld(): TileId[][] {
  const rng = seededRandom(42);
  const tiles: TileId[][] = [];

  for (let y = 0; y < WORLD_ROWS; y += 1) {
    const row: TileId[] = [];
    for (let x = 0; x < WORLD_COLS; x += 1) {
      row.push(rng() > 0.2 ? 'grass' : 'grassAlt');
    }
    tiles.push(row);
  }

  return tiles;
}

function paintRect(tiles: TileId[][], tile: TileId, x0: number, y0: number, w: number, h: number): void {
  for (let y = y0; y < y0 + h; y += 1) {
    for (let x = x0; x < x0 + w; x += 1) {
      if (tiles[y] && tiles[y][x]) {
        tiles[y][x] = tile;
      }
    }
  }
}

function scatterTiles(
  tiles: TileId[][],
  tile: TileId,
  x0: number,
  y0: number,
  w: number,
  h: number,
  density: number,
  seed: number,
): void {
  const rng = seededRandom(seed);
  for (let y = y0; y < y0 + h; y += 1) {
    for (let x = x0; x < x0 + w; x += 1) {
      if (rng() < density && tiles[y] && tiles[y][x]) {
        tiles[y][x] = tile;
      }
    }
  }
}

export function buildWorldLayout(): TileId[][] {
  const tiles = createBlankWorld();

  // Main path spine
  paintRect(tiles, 'path', 6, 13, 44, 3);
  paintRect(tiles, 'path', 18, 8, 3, 20);
  paintRect(tiles, 'path', 32, 10, 3, 18);
  paintRect(tiles, 'path', 44, 12, 3, 16);

  // Side plaza near bottom
  paintRect(tiles, 'pathEdge', 8, 22, 10, 6);

  // Pond
  paintRect(tiles, 'water', 6, 24, 6, 5);

  // Flower patches
  scatterTiles(tiles, 'flower', 2, 2, 12, 10, 0.12, 1337);
  scatterTiles(tiles, 'flower', 42, 2, 12, 10, 0.12, 7331);
  scatterTiles(tiles, 'flower', 20, 22, 14, 8, 0.1, 9001);

  return tiles;
}
