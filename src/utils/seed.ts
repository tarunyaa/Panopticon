/**
 * Deterministic seeded random number generator
 * Uses a simple hash function to generate consistent results from string seeds
 */

/**
 * Hash a string to a number (simple DJB2 hash)
 */
export function hashString(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
  }
  return hash >>> 0; // Convert to unsigned 32-bit integer
}

/**
 * Create a seeded random number generator
 * Returns a function that produces consistent pseudo-random numbers
 */
export function seededRandom(seed: number): () => number {
  let state = seed;

  return () => {
    // Simple LCG (Linear Congruential Generator)
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}

/**
 * Pick a random item from an array using a seeded RNG
 */
export function pick<T>(rng: () => number, items: readonly T[]): T {
  const index = Math.floor(rng() * items.length);
  return items[index];
}

/**
 * Pick a random item from an array with weighted probabilities
 */
export function pickWeighted<T>(
  rng: () => number,
  items: readonly { value: T; weight: number }[]
): T {
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
  let random = rng() * totalWeight;

  for (const item of items) {
    random -= item.weight;
    if (random <= 0) {
      return item.value;
    }
  }

  return items[items.length - 1].value;
}

/**
 * Generate a random number in a range using seeded RNG
 */
export function randomInRange(rng: () => number, min: number, max: number): number {
  return min + rng() * (max - min);
}

/**
 * Generate a random integer in a range using seeded RNG
 */
export function randomIntInRange(rng: () => number, min: number, max: number): number {
  return Math.floor(randomInRange(rng, min, max + 1));
}
