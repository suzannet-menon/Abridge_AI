// Deterministic 32-bit hash (FNV-1a) from a string.
export function hash(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// Deterministic seeded pick: choose n distinct items from a pool.
// Every candidate is scored by hash(seed + item) instead of walking a single
// PRNG sequence — so even near-identical seeds diverge, and items that share
// substrings never cluster adjacent in the output.
export function pick(seed, pool, n) {
  const scored = [...pool]
    .map(item => ({ item, score: hash((seed >>> 0).toString(36) + '::' + String(item)) }))
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, Math.min(n, scored.length)).map(s => s.item);
}