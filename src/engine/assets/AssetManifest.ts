import { Assets } from 'pixi.js';

let loaded = false;

export const ASSET_KEYS = {
  tiles: {
    grass1: 'tile_grass_1',
    grass2: 'tile_grass_2',
    path1: 'tile_path_1',
    path2: 'tile_path_2',
    pathEdge: 'tile_path_edge',
    water1: 'tile_water_1',
    flower1: 'tile_flower_1',
    flower2: 'tile_flower_2',
  },
  buildings: {
    glass: 'building_glass',
    industrial: 'building_industrial',
    purple: 'building_purple',
  },
  props: {
    treeSmall: 'prop_tree_small',
    treeMedium: 'prop_tree_medium',
    treeLarge: 'prop_tree_large',
    bush1: 'prop_bush_1',
    bush2: 'prop_bush_2',
    flowersPatch: 'prop_flowers_patch',
    bench: 'prop_bench',
    lamp: 'prop_lamp',
    fountain: 'prop_fountain',
    fence: 'prop_fence',
    desk: 'prop_desk',
    computer: 'prop_computer',
    whiteboard: 'prop_whiteboard',
    bookshelf: 'prop_bookshelf',
    shelf: 'prop_shelf',
  },
  characters: {
    avatar1: 'avatar1',
    avatar2: 'avatar2',
    avatar3: 'avatar3',
  },
  ui: {
    home: 'ui_home',
    people: 'ui_people',
    close: 'ui_close',
    running: 'ui_running',
    blocked: 'ui_blocked',
    approval: 'ui_approval',
  },
} as const;

const ASSET_SOURCES: Record<string, string> = {
  [ASSET_KEYS.tiles.grass1]: new URL('../../assets/tiles/grass_1.png', import.meta.url).href,
  [ASSET_KEYS.tiles.grass2]: new URL('../../assets/tiles/grass_2.png', import.meta.url).href,
  [ASSET_KEYS.tiles.path1]: new URL('../../assets/tiles/path_1.png', import.meta.url).href,
  [ASSET_KEYS.tiles.path2]: new URL('../../assets/tiles/path_2.png', import.meta.url).href,
  [ASSET_KEYS.tiles.pathEdge]: new URL('../../assets/tiles/path_edge.png', import.meta.url).href,
  [ASSET_KEYS.tiles.water1]: new URL('../../assets/tiles/water_1.png', import.meta.url).href,
  [ASSET_KEYS.tiles.flower1]: new URL('../../assets/tiles/flower_1.png', import.meta.url).href,
  [ASSET_KEYS.tiles.flower2]: new URL('../../assets/tiles/flower_2.png', import.meta.url).href,

  [ASSET_KEYS.buildings.glass]: new URL('../../assets/buildings/building_glass.png', import.meta.url).href,
  [ASSET_KEYS.buildings.industrial]: new URL('../../assets/buildings/building_industrial.png', import.meta.url).href,
  [ASSET_KEYS.buildings.purple]: new URL('../../assets/buildings/building_purple.png', import.meta.url).href,

  [ASSET_KEYS.props.treeSmall]: new URL('../../assets/props/tree_small.png', import.meta.url).href,
  [ASSET_KEYS.props.treeMedium]: new URL('../../assets/props/tree_medium.png', import.meta.url).href,
  [ASSET_KEYS.props.treeLarge]: new URL('../../assets/props/tree_large.png', import.meta.url).href,
  [ASSET_KEYS.props.bush1]: new URL('../../assets/props/bush_1.png', import.meta.url).href,
  [ASSET_KEYS.props.bush2]: new URL('../../assets/props/bush_2.png', import.meta.url).href,
  [ASSET_KEYS.props.flowersPatch]: new URL('../../assets/props/flowers_patch.png', import.meta.url).href,
  [ASSET_KEYS.props.bench]: new URL('../../assets/props/bench.png', import.meta.url).href,
  [ASSET_KEYS.props.lamp]: new URL('../../assets/props/lamp.png', import.meta.url).href,
  [ASSET_KEYS.props.fountain]: new URL('../../assets/props/fountain.png', import.meta.url).href,
  [ASSET_KEYS.props.fence]: new URL('../../assets/props/fence.png', import.meta.url).href,
  [ASSET_KEYS.props.desk]: new URL('../../assets/props/desk.png', import.meta.url).href,
  [ASSET_KEYS.props.computer]: new URL('../../assets/props/computer.png', import.meta.url).href,
  [ASSET_KEYS.props.whiteboard]: new URL('../../assets/props/whiteboard.png', import.meta.url).href,
  [ASSET_KEYS.props.bookshelf]: new URL('../../assets/props/bookshelf.png', import.meta.url).href,
  [ASSET_KEYS.props.shelf]: new URL('../../assets/props/shelf.png', import.meta.url).href,

  [ASSET_KEYS.characters.avatar1]: new URL('../../assets/characters/avatar1.png', import.meta.url).href,
  [ASSET_KEYS.characters.avatar2]: new URL('../../assets/characters/avatar2.png', import.meta.url).href,
  [ASSET_KEYS.characters.avatar3]: new URL('../../assets/characters/avatar3.png', import.meta.url).href,

  [ASSET_KEYS.ui.home]: new URL('../../assets/ui/icon_home.png', import.meta.url).href,
  [ASSET_KEYS.ui.people]: new URL('../../assets/ui/icon_people.png', import.meta.url).href,
  [ASSET_KEYS.ui.close]: new URL('../../assets/ui/icon_close.png', import.meta.url).href,
  [ASSET_KEYS.ui.running]: new URL('../../assets/ui/icon_running.png', import.meta.url).href,
  [ASSET_KEYS.ui.blocked]: new URL('../../assets/ui/icon_blocked.png', import.meta.url).href,
  [ASSET_KEYS.ui.approval]: new URL('../../assets/ui/icon_approval.png', import.meta.url).href,
};

/**
 * Initialize PixiJS asset system and load all sprite assets.
 */
export async function loadAssets(): Promise<void> {
  if (loaded) return;
  loaded = true;
  await Assets.init({});

  for (const [alias, src] of Object.entries(ASSET_SOURCES)) {
    Assets.add({ alias, src });
  }

  await Assets.load(Object.keys(ASSET_SOURCES));
}
