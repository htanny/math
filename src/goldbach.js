/**
 * Goldbach's conjecture (1742, still open): every even number greater than 2
 * is the sum of two primes. Plotting g(n) — the number of such representations
 * — against n produces the "Goldbach comet", a spray of points that separates
 * into clean bands according to n's small prime factors.
 */

export const MAX_LIMIT = 60000;

let sieveCache = { limit: 0, isPrime: null, primes: null };

/** Sieve of Eratosthenes, memoised and reused when the limit only grows. */
export function primesUpTo(limit) {
  const n = Math.max(2, Math.trunc(limit));
  if (sieveCache.limit >= n) return sieveCache;

  const isPrime = new Uint8Array(n + 1).fill(1);
  isPrime[0] = 0;
  if (n >= 1) isPrime[1] = 0;
  for (let p = 2; p * p <= n; p++) {
    if (!isPrime[p]) continue;
    for (let m = p * p; m <= n; m += p) isPrime[m] = 0;
  }
  const primes = [];
  for (let p = 2; p <= n; p++) if (isPrime[p]) primes.push(p);

  sieveCache = { limit: n, isPrime, primes };
  return sieveCache;
}

/**
 * Which band a given even n falls into. The split by small prime factors is
 * what makes the comet separate into strands: n divisible by 3 has markedly
 * more representations, because p and n-p then avoid one fewer residue class.
 */
export function bandOf(n) {
  if (n % 3 === 0) return "div3";
  if (n % 5 === 0) return "div5";
  return "other";
}

export const BANDS = {
  div3: { label: "3の倍数", color: "--series-1" },
  div5: { label: "5の倍数（3では割れない）", color: "--series-2" },
  other: { label: "3でも5でも割れない", color: "--series-3" },
};

/**
 * g(n) for every even n in 4..limit, where g counts unordered pairs of primes
 * summing to n. Built by walking prime pairs rather than re-testing each n.
 */
export function goldbachCounts(limit) {
  const n = Math.min(Math.max(4, Math.trunc(limit)), MAX_LIMIT);
  const { primes } = primesUpTo(n);
  const counts = new Uint32Array(n + 1);

  for (let i = 0; i < primes.length; i++) {
    const p = primes[i];
    if (p * 2 > n) break;
    for (let j = i; j < primes.length; j++) {
      const s = p + primes[j];
      if (s > n) break;
      counts[s]++;
    }
  }

  const points = [];
  let min = { n: 0, g: Infinity };
  let max = { n: 0, g: -1 };
  let violations = 0;

  for (let e = 4; e <= n; e += 2) {
    const g = counts[e];
    if (g === 0) violations++;
    if (g < min.g) min = { n: e, g };
    if (g > max.g) max = { n: e, g };
    points.push({ n: e, g, band: bandOf(e) });
  }

  return { points, min, max, violations, limit: n };
}

/** Every unordered prime pair summing to n. */
export function pairsFor(n) {
  const t = Math.trunc(n);
  if (!Number.isFinite(t) || t < 4 || t % 2 !== 0) return null;
  const { isPrime } = primesUpTo(t);
  const out = [];
  for (let p = 2; p <= t / 2; p++) {
    if (isPrime[p] && isPrime[t - p]) out.push([p, t - p]);
  }
  return out;
}
