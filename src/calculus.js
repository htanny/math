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
    d2f: () => 2,
    dfLabel: "2x",
    d2fLabel: "2",
    domain: [-3, 3],
  },
  {
    key: "cubic",
    label: "x³ − 3x",
    f: (x) => x * x * x - 3 * x,
    df: (x) => 3 * x * x - 3,
    d2f: (x) => 6 * x,
    dfLabel: "3x² − 3",
    d2fLabel: "6x",
    domain: [-2.6, 2.6],
  },
  {
    key: "quartic",
    label: "x⁴ − 4x² + 1",
    f: (x) => x ** 4 - 4 * x * x + 1,
    df: (x) => 4 * x ** 3 - 8 * x,
    d2f: (x) => 12 * x * x - 8,
    dfLabel: "4x³ − 8x",
    d2fLabel: "12x² − 8",
    domain: [-2.4, 2.4],
  },
  {
    key: "sin",
    label: "sin x",
    f: Math.sin,
    df: Math.cos,
    d2f: (x) => -Math.sin(x),
    dfLabel: "cos x",
    d2fLabel: "−sin x",
    domain: [-Math.PI * 2, Math.PI * 2],
  },
  {
    key: "exp",
    label: "eˣ",
    f: Math.exp,
    df: Math.exp,
    d2f: Math.exp,
    dfLabel: "eˣ",
    d2fLabel: "eˣ",
    domain: [-2, 2],
  },
  {
    key: "bell",
    label: "1 / (1 + x²)",
    f: (x) => 1 / (1 + x * x),
    df: (x) => (-2 * x) / ((1 + x * x) * (1 + x * x)),
    d2f: (x) => (2 * (3 * x * x - 1)) / (1 + x * x) ** 3,
    dfLabel: "−2x / (1 + x²)²",
    d2fLabel: "2(3x² − 1) / (1 + x²)³",
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

/* ------------------------------------------------- shape of the graph -- */

/**
 * Sign changes of g on [a, b], refined by bisection. Used for both the
 * stationary points of f (zeros of f') and its inflection points (zeros of
 * f''), so the increase/decrease table can be generated rather than typed in.
 */
export function signChanges(g, a, b, samples = 1200) {
  const out = [];
  const step = (b - a) / samples;

  // A root landing exactly on a sample (x = 0 very often does) makes g exactly
  // 0 there, and then neither straddling pair shows a sign change. Those have
  // to be recorded directly, or symmetric functions silently lose the root at
  // the origin.
  const push = (x) => {
    if (out.some((v) => Math.abs(v - x) < step * 0.75)) return;
    out.push(x);
  };

  let prevX = a;
  let prev = g(a);
  if (prev === 0) push(a);

  for (let i = 1; i <= samples; i++) {
    const x = a + i * step;
    const cur = g(x);
    if (cur === 0) {
      push(x);
    } else if (
      Number.isFinite(prev) &&
      Number.isFinite(cur) &&
      prev !== 0 &&
      (prev < 0) !== (cur < 0)
    ) {
      let lo = prevX;
      let hi = x;
      let flo = prev;
      for (let k = 0; k < 60; k++) {
        const mid = (lo + hi) / 2;
        const fm = g(mid);
        if ((flo < 0) !== (fm < 0)) hi = mid;
        else {
          lo = mid;
          flo = fm;
        }
      }
      push((lo + hi) / 2);
    }
    prevX = x;
    prev = cur;
  }
  return out.sort((p, q) => p - q);
}

/**
 * Stationary points classified by the second derivative, plus inflection
 * points — everything a 増減表 needs.
 */
export function shapeOf(fn) {
  const [a, b] = fn.domain;
  const stationary = signChanges(fn.df, a, b).map((x) => {
    const s = fn.d2f(x);
    return {
      x,
      y: fn.f(x),
      kind: s > 1e-9 ? "min" : s < -1e-9 ? "max" : "flat",
    };
  });
  const inflections = signChanges(fn.d2f, a, b).map((x) => ({ x, y: fn.f(x) }));
  return { stationary, inflections };
}

export const SHAPE_LABEL = {
  min: "極小",
  max: "極大",
  flat: "停留点（極値ではない）",
};

/**
 * Rows of the increase/decrease table: the intervals cut by every stationary
 * and inflection point, with the sign of f' and f'' on each.
 */
export function monotonicityTable(fn) {
  const [a, b] = fn.domain;
  const { stationary, inflections } = shapeOf(fn);
  const cuts = [...stationary.map((p) => p.x), ...inflections.map((p) => p.x)].sort((p, q) => p - q);
  const edges = [a, ...cuts, b];

  const rows = [];
  for (let i = 0; i < edges.length - 1; i++) {
    const lo = edges[i];
    const hi = edges[i + 1];
    if (hi - lo < 1e-9) continue;
    const mid = (lo + hi) / 2;
    rows.push({
      lo,
      hi,
      dfSign: Math.sign(fn.df(mid)),
      d2fSign: Math.sign(fn.d2f(mid)),
    });
  }
  return { rows, stationary, inflections };
}

/* ------------------------------------------------ mean value theorem -- */

/**
 * Points c in (a, b) where the tangent is parallel to the chord — the mean
 * value theorem guarantees at least one exists for a differentiable f.
 */
export function meanValuePoints(fn, a, b) {
  if (!(b > a)) return { slope: NaN, points: [] };
  const slope = (fn.f(b) - fn.f(a)) / (b - a);
  const points = signChanges((x) => fn.df(x) - slope, a, b).map((x) => ({ x, y: fn.f(x) }));
  return { slope, points };
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
