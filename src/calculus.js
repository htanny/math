/**
 * The two pillars of school calculus, set up so they can be shown as one
 * picture: the derivative as the limit of a secant slope, and the integral as
 * an area whose rate of growth is the original function.
 */

export const FUNCTIONS = [
  {
    key: "sq",
    label: "x²",
    f: (x) => x * x,
    df: (x) => 2 * x,
    dfLabel: "2x",
    domain: [-3, 3],
  },
  {
    key: "cubic",
    label: "x³ − 3x",
    f: (x) => x * x * x - 3 * x,
    df: (x) => 3 * x * x - 3,
    dfLabel: "3x² − 3",
    domain: [-2.6, 2.6],
  },
  {
    key: "sin",
    label: "sin x",
    f: Math.sin,
    df: Math.cos,
    dfLabel: "cos x",
    domain: [-Math.PI * 2, Math.PI * 2],
  },
  {
    key: "exp",
    label: "eˣ",
    f: Math.exp,
    df: Math.exp,
    dfLabel: "eˣ",
    domain: [-2, 2],
  },
  {
    key: "bell",
    label: "1 / (1 + x²)",
    f: (x) => 1 / (1 + x * x),
    df: (x) => (-2 * x) / ((1 + x * x) * (1 + x * x)),
    dfLabel: "−2x / (1 + x²)²",
    domain: [-3, 3],
  },
];

export function functionByKey(key) {
  return FUNCTIONS.find((fn) => fn.key === key) || FUNCTIONS[0];
}

/** Slope of the secant through x0 and x0 + h. */
export function secantSlope(f, x0, h) {
  if (h === 0) return NaN;
  return (f(x0 + h) - f(x0)) / h;
}

export const RULES = {
  left: { label: "左端", at: (a, w) => a },
  mid: { label: "中点", at: (a, w) => a + w / 2 },
  right: { label: "右端", at: (a, w) => a + w },
};

/**
 * Riemann sum of f over [a, b] with n rectangles.
 * Returns the total and the rectangles themselves for drawing.
 */
export function riemann(f, a, b, n, rule = "mid") {
  const count = Math.max(1, Math.floor(n));
  const w = (b - a) / count;
  const pick = (RULES[rule] || RULES.mid).at;
  const rects = [];
  let total = 0;
  for (let i = 0; i < count; i++) {
    const left = a + i * w;
    const height = f(pick(left, w));
    total += height * w;
    rects.push({ left, w, height });
  }
  return { total, rects, width: w };
}

/**
 * High-resolution reference value for the same integral, by Simpson's rule.
 * Used to report how far the Riemann sum still is from the true area.
 */
export function exactArea(f, a, b, n = 2000) {
  const count = n % 2 === 0 ? n : n + 1;
  const h = (b - a) / count;
  let sum = f(a) + f(b);
  for (let i = 1; i < count; i++) {
    sum += f(a + i * h) * (i % 2 === 0 ? 2 : 4);
  }
  return (sum * h) / 3;
}

/**
 * Cumulative area function S(x) = integral from a to x of f, sampled on a grid.
 * The fundamental theorem says S'(x) = f(x); the view draws a tangent on S
 * whose slope is read straight off the height of f.
 */
export function areaFunction(f, a, b, samples = 600) {
  const xs = new Float64Array(samples + 1);
  const ys = new Float64Array(samples + 1);
  const step = (b - a) / samples;
  let acc = 0;
  xs[0] = a;
  ys[0] = 0;
  for (let i = 1; i <= samples; i++) {
    const x0 = a + (i - 1) * step;
    const x1 = a + i * step;
    acc += ((f(x0) + f(x1)) / 2) * step; // trapezoid
    xs[i] = x1;
    ys[i] = acc;
  }
  return { xs, ys, step };
}

/** Value of the sampled area function at x, by linear interpolation. */
export function areaAt(area, x) {
  const { xs, ys } = area;
  if (x <= xs[0]) return ys[0];
  const last = xs.length - 1;
  if (x >= xs[last]) return ys[last];
  const t = (x - xs[0]) / (xs[1] - xs[0]);
  const i = Math.floor(t);
  const frac = t - i;
  return ys[i] + (ys[i + 1] - ys[i]) * frac;
}
