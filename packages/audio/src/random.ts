/** Deterministic PRNG (mulberry32 seeded from a string hash): the same seed always gives the same sequence. */
export function seededRandom(seed: string | number): () => number {
  const text = String(seed);
  let h = 1779033703 ^ text.length;
  for (let i = 0; i < text.length; i++) {
    h = Math.imul(h ^ text.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** White noise in −1…1 from a seeded generator. */
export function noiseSource(seed: string | number): () => number {
  const r = seededRandom(seed);
  return () => r() * 2 - 1;
}
