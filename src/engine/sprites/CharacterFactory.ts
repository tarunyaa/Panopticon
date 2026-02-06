import { hashString, seededRandom, pick } from '../../utils/seed';
import type { BodyType, PaletteType, HairType, AccessoryType, PropType, IdleVariant, CharacterStyle } from '../../types';
import { PALETTE_COLORS } from '../../utils/styleGen';
import { CharacterSprite } from './CharacterSprite';
import { ASSET_KEYS } from '../assets/AssetManifest';

const BODY_TYPES: readonly BodyType[] = ['round', 'tall', 'bigHead', 'hoodie', 'coat', 'robot'];
const PALETTES: readonly PaletteType[] = ['warm', 'cool', 'neutral', 'bright'];
const HAIR_TYPES: readonly HairType[] = ['short', 'bun', 'curly', 'none'];
const ACCESSORIES: readonly AccessoryType[] = ['glassesRound', 'glassesSquare', 'headphones', 'beanie', 'cap', 'none'];
const PROPS: readonly PropType[] = ['coffee', 'book', 'laptop', 'clipboard', 'wrench', 'plant', 'none'];
const IDLE_VARIANTS: readonly IdleVariant[] = [0, 1, 2];

// Body type dimensions (width, height)
const BODY_DIMS: Record<BodyType, { w: number; h: number }> = {
  round:   { w: 24, h: 32 },
  tall:    { w: 20, h: 36 },
  bigHead: { w: 28, h: 32 },
  hoodie:  { w: 26, h: 34 },
  coat:    { w: 24, h: 36 },
  robot:   { w: 24, h: 34 },
};

/**
 * Port of styleGen.ts - deterministic character style from ID.
 */
function makeStyle(id: string): CharacterStyle {
  const seed = hashString(id);
  const rng = seededRandom(seed);

  return {
    bodyType: pick(rng, BODY_TYPES),
    palette: pick(rng, PALETTES),
    hair: pick(rng, HAIR_TYPES),
    accessory: pick(rng, ACCESSORIES),
    prop: pick(rng, PROPS),
    aiHint: 'none',
    idleVariant: pick(rng, IDLE_VARIANTS),
  };
}

/**
 * Create a CharacterSprite from an ID + metadata.
 */
export function createCharacter(
  id: string,
  opts?: { scale?: number; interactive?: boolean },
): CharacterSprite {
  const style = makeStyle(id);
  const palette = PALETTE_COLORS[style.palette];
  const dims = BODY_DIMS[style.bodyType];
  const avatarIndex = (Math.abs(hashString(id)) % 3) + 1;
  const avatarKey = ASSET_KEYS.characters[`avatar${avatarIndex}` as keyof typeof ASSET_KEYS.characters];

  const sprite = new CharacterSprite({
    bodyWidth: dims.w,
    bodyHeight: dims.h,
    bodyColor: palette.body,
    skinColor: palette.skin,
    accentColor: palette.accent,
    bodyType: style.bodyType,
    hairType: style.hair,
    accessoryType: style.accessory,
    propType: style.prop,
    textureKey: avatarKey,
    sheetConfig: {
      frameWidth: 64,
      frameHeight: 64,
      row: 2,
      frames: 4,
    },
    idleVariant: style.idleVariant,
    scale: opts?.scale ?? 1,
    interactive: opts?.interactive ?? false,
  });

  return sprite;
}
