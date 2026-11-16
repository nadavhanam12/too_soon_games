// Seeded randomness for gameplay (DECISIONS 69). Every gameplay random call goes through rand() (rnd/pick in prims
// use it), so `?seed=<n>` in the address makes a run repeat exactly when the inputs repeat: the bugcheck playthrough
// plays the same seed twice and compares. Without ?seed= each page load picks a fresh seed, so real players still get
// a different run every time. Math.random stays only where it is not gameplay: ids (storage, analytics) and audio noise.

let seed = 0;
let a = 0;

/** Reset the stream to a seed. */
export function setSeed(n: number): void { seed = n >>> 0; a = seed; }
export const getSeed = (): number => seed;

/** mulberry32: a uniform float in [0, 1). */
export function rand(): number {
  a = (a + 0x6d2b79f5) >>> 0;
  let t = a;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

const fromUrl = Number(new URLSearchParams(location.search).get('seed'));
setSeed(Number.isFinite(fromUrl) && fromUrl > 0 ? fromUrl : Math.floor(Math.random() * 2 ** 31) + 1);
