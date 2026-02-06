import { hashString, seededRandom, pick } from './seed';
import type { CharacterStyle, BodyType, PaletteType, HairType, AccessoryType, PropType, IdleVariant } from '../types';

// Options for each style attribute
const BODY_TYPES: readonly BodyType[] = ['round', 'tall', 'bigHead', 'hoodie', 'coat', 'robot'];
const PALETTES: readonly PaletteType[] = ['warm', 'cool', 'neutral', 'bright'];
const HAIR_TYPES: readonly HairType[] = ['short', 'bun', 'curly', 'none'];
const ACCESSORIES: readonly AccessoryType[] = ['glassesRound', 'glassesSquare', 'headphones', 'beanie', 'cap', 'none'];
const PROPS: readonly PropType[] = ['coffee', 'book', 'laptop', 'clipboard', 'wrench', 'plant', 'none'];
const IDLE_VARIANTS: readonly IdleVariant[] = [0, 1, 2];

/**
 * Generate a deterministic character style from a character ID
 */
export function makeCharacterStyle(characterId: string): CharacterStyle {
  const seed = hashString(characterId);
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
 * Color palettes - pixel art limited palette
 */
export const PALETTE_COLORS: Record<PaletteType, { skin: string; body: string; accent: string }> = {
  warm: { skin: '#FFD5B8', body: '#E07050', accent: '#FF9060' },
  cool: { skin: '#FFE4D6', body: '#5088C0', accent: '#70A8E0' },
  neutral: { skin: '#F0C8A0', body: '#60A060', accent: '#80C880' },
  bright: { skin: '#D4A07A', body: '#A070C0', accent: '#FFD050' },
};

/**
 * Get the animation class for an idle variant - pixel steps()
 */
export function getIdleAnimationClass(variant: IdleVariant): string {
  return `animate-pixel-idle-${variant}`;
}

/**
 * Generate multiple unique character styles
 */
export function generateCharacterStyles(count: number, prefix = 'char'): Map<string, CharacterStyle> {
  const styles = new Map<string, CharacterStyle>();

  for (let i = 0; i < count; i++) {
    const id = `${prefix}-${String(i + 1).padStart(3, '0')}`;
    styles.set(id, makeCharacterStyle(id));
  }

  return styles;
}
