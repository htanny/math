/**
 * The logistic map x -> r*x*(1-x): the standard textbook example of a simple
 * deterministic rule producing a period-doubling route to chaos.
 */

export const map = (r, x) => r * x * (1 - x);

/** The first n+1 values of the orbit starting at x0, including x0 itself. */
export function orbit(r, x0, n) {
  const out = [x0];
  let x = x0;
  for (let i = 0; i < n; i++) {
    x = map(r, x);
    out.push(x);
  }
  return out;
}

/**
 * The values the orbit settles onto, after discarding the transient.
 * Returns at most `maxPeriod` values; an empty result means it never repeated
 * within tolerance, i.e. the orbit looks chaotic at this resolution.
 */
export function attractor(r, maxPeriod = 64, eps = 1e-9) {
  let x = 0.5;
  for (let i = 0; i < 20000; i++) x = map(r, x);

  const settled = x;
  const values = [settled];
  for (let p = 1; p <= maxPeriod; p++) {
    x = map(r, x);
    if (Math.abs(x - settled) < eps) return values;
    values.push(x);
  }
  return [];
}

/** Cycle length of the attractor, or null when the orbit looks chaotic. */
export function detectPeriod(r, maxPeriod = 64, eps = 1e-9) {
  const values = attractor(r, maxPeriod, eps);
  return values.length ? values.length : null;
}

/**
 * Per-pixel hit counts for the bifurcation diagram over the given window.
 * Row 0 is the top of the plot (x = xMax).
 */
export function bifurcationDensity(rMin, rMax, xMin, xMax, width, height, opts = {}) {
  const settle = opts.settle ?? 700;
  const sample = opts.sample ?? 320;
  const density = new Uint16Array(width * height);
  const xSpan = xMax - xMin || 1;

  for (let px = 0; px < width; px++) {
    const r = rMin + ((px + 0.5) / width) * (rMax - rMin);
    let x = 0.5;
    for (let i = 0; i < settle; i++) x = map(r, x);
    for (let i = 0; i < sample; i++) {
      x = map(r, x);
      if (x < xMin || x > xMax) continue;
      const py = height - 1 - Math.floor(((x - xMin) / xSpan) * height);
      if (py >= 0 && py < height) density[py * width + px]++;
    }
  }
  return density;
}

/**
 * Where each period doubling happens, from period 1->2 onward. These are the
 * classical values; the ratio of successive gaps converges to the Feigenbaum
 * constant delta = 4.669201609...
 */
export const PERIOD_DOUBLINGS = [
  { period: 2, r: 3 },
  { period: 4, r: 3.449489742783178 },
  { period: 8, r: 3.544090359551923 },
  { period: 16, r: 3.564407266095299 },
  { period: 32, r: 3.568759419543901 },
  { period: 64, r: 3.569691609801 },
  { period: 128, r: 3.569891259378 },
];

export const ACCUMULATION_POINT = 3.569945672;
export const FEIGENBAUM_DELTA = 4.669201609;

/** Gap and successive-gap ratio for each period doubling. */
export function feigenbaumRows() {
  return PERIOD_DOUBLINGS.map((entry, i) => {
    const prev = i === 0 ? null : PERIOD_DOUBLINGS[i - 1].r;
    const next = PERIOD_DOUBLINGS[i + 1];
    const gap = prev === null ? null : entry.r - prev;
    const nextGap = next ? next.r - entry.r : null;
    return {
      period: entry.period,
      r: entry.r,
      gap,
      delta: gap !== null && nextGap ? gap / nextGap : null,
    };
  });
}
