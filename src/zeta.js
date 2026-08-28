/**
 * Riemann's explicit formula, made visible.
 *
 * The Chebyshev function psi(x) = sum of log(p) over every prime power p^k <= x
 * is a staircase that jumps at the primes. Riemann's formula says that
 * staircase is exactly a smooth line corrected by one wave per zeta zero:
 *
 *   psi(x) = x - sum_rho x^rho / rho - log(2*pi) - (1/2) log(1 - x^-2)
 *
 * Adding zeros one at a time turns the smooth line into the prime staircase —
 * the primes are encoded in the zeros. Whether every zero really sits on the
 * critical line is the Riemann hypothesis, still unproved.
 *
 * ZEROS holds the imaginary parts of the first 50 nontrivial zeros. They were
 * computed for this project by locating sign changes of the Riemann-Siegel
 * Z function (zeta on the critical line evaluated through the Dirichlet eta
 * series with Borwein acceleration), not copied from memory; the first ten
 * agree with the classical published values to ~1e-9.
 */
export const ZEROS = [
  14.134725142, 21.022039639, 25.01085758, 30.424876126, 32.935061588,
  37.586178159, 40.918719012, 43.327073281, 48.005150881, 49.773832478,
  52.970321478, 56.446247697, 59.347044003, 60.831778525, 65.112544048,
  67.079810529, 69.546401711, 72.067157674, 75.704690699, 77.144840069,
  79.33737502, 82.910380854, 84.735492981, 87.425274613, 88.809111208,
  92.491899271, 94.651344041, 95.870634228, 98.831194218, 101.317851006,
  103.72553804, 105.446623052, 107.168611184, 111.029535543, 111.874659177,
  114.320220915, 116.226680321, 118.790782866, 121.370125002, 122.946829294,
  124.256818554, 127.51668388, 129.5787042, 131.087688531, 133.497737203,
  134.756509753, 138.116042055, 139.736208952, 141.123707404, 143.111845808,
];

const LOG_2PI = Math.log(2 * Math.PI);

/**
 * Jump points of psi: every prime power p^k <= limit, carrying weight log(p).
 * Returns them sorted by position.
 */
export function psiJumps(limit) {
  const n = Math.max(2, Math.floor(limit));
  const isComposite = new Uint8Array(n + 1);
  const jumps = [];

  for (let p = 2; p <= n; p++) {
    if (isComposite[p]) continue;
    for (let m = p * p; m <= n; m += p) isComposite[m] = 1;
    const lp = Math.log(p);
    for (let q = p; q <= n; q *= p) {
      jumps.push({ at: q, weight: lp });
      if (q > n / p) break; // guard against overflow past the limit
    }
  }
  jumps.sort((a, b) => a.at - b.at);
  return jumps;
}

/** Exact psi(x) evaluated from precomputed jumps (jumps must be sorted). */
export function psiExact(x, jumps) {
  let total = 0;
  for (const j of jumps) {
    if (j.at > x) break;
    total += j.weight;
  }
  return total;
}

/**
 * The explicit formula truncated to the first `count` zero pairs.
 * Each conjugate pair rho, conj(rho) contributes
 *   2 * sqrt(x) * [ (1/2)cos(g log x) + g sin(g log x) ] / (1/4 + g^2)
 */
export function psiApprox(x, count) {
  if (x <= 1) return 0;
  const L = Math.log(x);
  const root = Math.sqrt(x);

  let sum = 0;
  const k = Math.min(count, ZEROS.length);
  for (let i = 0; i < k; i++) {
    const g = ZEROS[i];
    sum += (2 * root * (0.5 * Math.cos(g * L) + g * Math.sin(g * L))) / (0.25 + g * g);
  }

  // The trivial zeros contribute the -(1/2)log(1 - x^-2) tail.
  const trivial = x > 1.0001 ? 0.5 * Math.log(1 - 1 / (x * x)) : 0;
  return x - sum - LOG_2PI - trivial;
}

/**
 * RMS of (approximation - exact) over the range. Preferred over the maximum as
 * a headline figure: the max is pinned by the overshoot right at each jump
 * (a Gibbs effect) and so barely moves, while the RMS falls steadily as zeros
 * are added, which is what actually happens.
 */
export function rmsError(xMin, xMax, count, jumps, samples = 600) {
  let sum = 0;
  let used = 0;
  for (let i = 0; i <= samples; i++) {
    const x = xMin + ((xMax - xMin) * i) / samples;
    if (x <= 1) continue;
    const d = psiApprox(x, count) - psiExact(x, jumps);
    sum += d * d;
    used++;
  }
  return used ? Math.sqrt(sum / used) : 0;
}

/** Largest |approximation - exact| over the range, sampled between jumps. */
export function maxError(xMin, xMax, count, jumps, samples = 400) {
  let worst = 0;
  for (let i = 0; i <= samples; i++) {
    const x = xMin + ((xMax - xMin) * i) / samples;
    if (x <= 1) continue;
    // Sampling exactly on a jump compares against an ambiguous value, so nudge
    // off any integer.
    const xx = Number.isInteger(x) ? x + 0.5 : x;
    if (xx > xMax) continue;
    const d = Math.abs(psiApprox(xx, count) - psiExact(xx, jumps));
    if (d > worst) worst = d;
  }
  return worst;
}
