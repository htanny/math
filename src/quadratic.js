/**
 * y = ax² — the core of 中3 の関数.
 *
 * What a printed page cannot show is that the rate of change depends on
 * *where* you measure it. On a line it is one number for the whole line; on a
 * parabola every interval has its own, and the exam shortcut 変化の割合 =
 * a(p+q) is exactly that fact written down. So the rate is computed here two
 * ways — from the definition and from the shortcut — and the view shows both.
 *
 * The second idea is that "where the parabola meets the line" and "the
 * solutions of ax² = mx + n" are the same question asked twice.
 */

export const fy = (a, x) => a * x * x;

/** The definition: (f(q) − f(p)) / (q − p). Undefined when p = q. */
export function rateFromDefinition(a, p, q) {
  if (p === q) return NaN;
  return (fy(a, q) - fy(a, p)) / (q - p);
}

/** The shortcut every 中3 textbook gives: a(p + q). */
export const rateShortcut = (a, p, q) => a * (p + q);

/** The line through (p, f(p)) and (q, f(q)). */
export function secant(a, p, q) {
  const slope = rateFromDefinition(a, p, q);
  return { slope, intercept: fy(a, p) - slope * p };
}

/** Slope of the tangent at x — where the secant is heading as q → p. */
export const tangentSlope = (a, x) => 2 * a * x;

/* ------------------------------------------------ parabola meets a line -- */

/** ax² = mx + n rearranges to ax² − mx − n = 0, so D = m² + 4an. */
export const discriminant = (a, m, n) => m * m + 4 * a * n;

/**
 * Where y = ax² meets y = mx + n, left to right.
 *
 * Returned as the roots of the same quadratic the student would solve by
 * hand, so the picture and the algebra cannot disagree.
 */
export function intersections(a, m, n) {
  if (a === 0) return m === 0 ? [] : [{ x: -n / m, y: 0 }];
  const d = discriminant(a, m, n);
  if (d < 0) return [];
  const r = Math.sqrt(d);
  const xs = d === 0 ? [m / (2 * a)] : [(m - r) / (2 * a), (m + r) / (2 * a)];
  xs.sort((u, v) => u - v);
  return xs.map((x) => ({ x, y: fy(a, x) }));
}

/**
 * Area of △OAB, O the origin and A, B the two intersections.
 *
 * The exam derivation splits the triangle along the y-axis, giving
 * ½ · |n| · |x_A − x_B|; `shoelace` below is the independent check.
 */
export function triangleArea(a, m, n) {
  const pts = intersections(a, m, n);
  if (pts.length < 2) return null;
  return (Math.abs(n) * Math.abs(pts[1].x - pts[0].x)) / 2;
}

export function shoelace(pts) {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % pts.length];
    s += p.x * q.y - q.x * p.y;
  }
  return Math.abs(s) / 2;
}

/** The a values a textbook actually uses. 0 is absent: y = 0x² is a line. */
export const A_VALUES = [-2, -1.5, -1, -0.75, -0.5, -0.25, 0.25, 0.5, 0.75, 1, 1.5, 2];

export const LINE_PRESETS = [
  {
    key: "classic",
    label: "y = x² と y = x + 2",
    a: 1,
    m: 1,
    n: 2,
    note:
      "交点は (−1, 1) と (2, 4)。x 座標の −1 と 2 は x² = x + 2、つまり " +
      "x² − x − 2 = 0 の解そのものです。△OAB の面積は 3。",
  },
  {
    key: "tangent",
    label: "接する（D = 0）",
    a: 1,
    m: 2,
    n: -1,
    note:
      "D = m² + 4an = 4 − 4 = 0 なので交点は 1 個。放物線と直線が接する、" +
      "というのは重解を持つことの図での言い方です。",
  },
  {
    key: "none",
    label: "交わらない（D < 0）",
    a: 1,
    m: 1,
    n: -1,
    note:
      "D = 1 − 4 = −3 < 0。交点がないことと、二次方程式に実数解がないことは、" +
      "同じことを図と式で言っているだけです。",
  },
  {
    key: "down",
    label: "上に凸（a < 0）",
    a: -1,
    m: 1,
    n: -2,
    note:
      "交点は (−2, −4) と (1, −1)。a が負でも話は同じで、x 座標の −2 と 1 は " +
      "−x² = x − 2、つまり x² + x − 2 = 0 の解です。△OAB の面積は 3。",
  },
];
