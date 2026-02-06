import { Assets, Texture } from 'pixi.js';
import type { BuildingType } from '../../types';
import { ASSET_KEYS } from './AssetManifest';

export type TileId =
  | 'grass'
  | 'grassAlt'
  | 'path'
  | 'pathEdge'
  | 'water'
  | 'flower'
  | 'floor'
  | 'floorAlt';

export type WorldPropType =
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

const TILE_KEY_MAP: Record<TileId, string> = {
  grass: ASSET_KEYS.tiles.grass1,
  grassAlt: ASSET_KEYS.tiles.grass2,
  path: ASSET_KEYS.tiles.path1,
  pathEdge: ASSET_KEYS.tiles.pathEdge,
  water: ASSET_KEYS.tiles.water1,
  flower: ASSET_KEYS.tiles.flower1,
  floor: ASSET_KEYS.tiles.path1,
  floorAlt: ASSET_KEYS.tiles.path2,
};

const BUILDING_KEY_MAP: Record<BuildingType, string> = {
  hub: ASSET_KEYS.buildings.glass,
  workshop: ASSET_KEYS.buildings.industrial,
  library: ASSET_KEYS.buildings.purple,
  cafe: ASSET_KEYS.buildings.industrial,
  greenhouse: ASSET_KEYS.buildings.glass,
  postoffice: ASSET_KEYS.buildings.purple,
};

const PROP_KEY_MAP: Record<WorldPropType, string> = {
  tree_small: ASSET_KEYS.props.treeSmall,
  tree_medium: ASSET_KEYS.props.treeMedium,
  tree_large: ASSET_KEYS.props.treeLarge,
  bush_1: ASSET_KEYS.props.bush1,
  bush_2: ASSET_KEYS.props.bush2,
  flowers_patch: ASSET_KEYS.props.flowersPatch,
  bench: ASSET_KEYS.props.bench,
  lamp: ASSET_KEYS.props.lamp,
  fountain: ASSET_KEYS.props.fountain,
  fence: ASSET_KEYS.props.fence,
  desk: ASSET_KEYS.props.desk,
  computer: ASSET_KEYS.props.computer,
  whiteboard: ASSET_KEYS.props.whiteboard,
  bookshelf: ASSET_KEYS.props.bookshelf,
  shelf: ASSET_KEYS.props.shelf,
};

const PROP_SIZES: Record<WorldPropType, { w: number; h: number }> = {
  tree_small: { w: 32, h: 48 },
  tree_medium: { w: 40, h: 56 },
  tree_large: { w: 48, h: 64 },
  bush_1: { w: 32, h: 24 },
  bush_2: { w: 40, h: 28 },
  flowers_patch: { w: 32, h: 16 },
  bench: { w: 32, h: 16 },
  lamp: { w: 16, h: 32 },
  fountain: { w: 64, h: 48 },
  fence: { w: 32, h: 16 },
  desk: { w: 48, h: 32 },
  computer: { w: 16, h: 16 },
  whiteboard: { w: 64, h: 40 },
  bookshelf: { w: 48, h: 48 },
  shelf: { w: 48, h: 32 },
};

export function getTileTexture(id: TileId): Texture {
  const key = TILE_KEY_MAP[id];
  const texture = Assets.get(key) as Texture | undefined;
  if (!texture) {
    throw new Error(`Missing tile texture: ${id}`);
  }
  return texture;
}

export function getBuildingSize(type: BuildingType): { w: number; h: number } {
  const texture = Assets.get(BUILDING_KEY_MAP[type]) as Texture | undefined;
  if (!texture) {
    return { w: 80, h: 80 };
  }
  return { w: texture.width, h: texture.height };
}

export function getBuildingTexture(type: BuildingType): Texture {
  const key = BUILDING_KEY_MAP[type];
  const texture = Assets.get(key) as Texture | undefined;
  if (!texture) {
    throw new Error(`Missing building texture: ${type}`);
  }
  return texture;
}

export function getPropSize(type: WorldPropType): { w: number; h: number } {
  return PROP_SIZES[type];
}

export function getPropTexture(type: WorldPropType): Texture {
  const key = PROP_KEY_MAP[type];
  const texture = Assets.get(key) as Texture | undefined;
  if (!texture) {
    throw new Error(`Missing prop texture: ${type}`);
  }
  return texture;
}
