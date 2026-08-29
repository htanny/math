/**
 * Where calculus starts paying off: approximating a function by polynomials,
 * using the tangent to hunt a root, turning an integral into a volume, and
 * finding out where e actually comes from.
 */

/* ----------------------------------------------------- Taylor polynomials -- */

function factorial(n) {
  let out = 1;
  for (let i = 2; i <= n; i++) out *= i;
  return out;
}

export const TAYLOR_CASES = [
  {
    key: "sin",
    label: "sin x",
    f: Math.sin,
    // x - x^3/3! + x^5/5! - ...
    coef: (n) => (n % 2 === 0 ? 0 : ((n - 1) / 2) % 2 === 0 ? 1 / factorial(n) : -1 / factorial(n)),
    domain: [-8, 8],
    yRange: [-2.2, 2.2],
    radius: Infinity,
    radiusNote: "収束半径は ∞。次数を上げれば、どこまでも一致していきます。",
  },
  {
    key: "cos",
    label: "cos x",
    f: Math.cos,
    coef: (n) => (n % 2 !== 0 ? 0 : (n / 2) % 2 === 0 ? 1 / factorial(n) : -1 / factorial(n)),
    domain: [-8, 8],
    yRange: [-2.2, 2.2],
    radius: Infinity,
    radiusNote: "収束半径は ∞。",
  },
  {
    key: "exp",
    label: "eˣ",
    f: Math.exp,
    coef: (n) => 1 / factorial(n),
    domain: [-3, 3],
    yRange: [-2, 12],
    radius: Infinity,
    radiusNote: "収束半径は ∞。係数はすべて 1/n!。",
  },
  {
    key: "log1p",
    label: "log(1 + x)",
    f: (x) => (x > -1 ? Math.log(1 + x) : NaN),
    // x - x^2/2 + x^3/3 - ...
    coef: (n) => (n === 0 ? 0 : (n % 2 === 1 ? 1 : -1) / n),
    domain: [-0.95, 2],
    yRange: [-3.5, 1.6],
    radius: 1,
    radiusNote: "収束半径は 1。|x| > 1 では次数を上げるほど暴れます — 近似が効く範囲には限りがあります。",
  },
  {
    key: "geom",
    label: "1 / (1 − x)",
    f: (x) => (Math.abs(x - 1) < 1e-9 ? NaN : 1 / (1 - x)),
    coef: () => 1,
    domain: [-1.6, 0.95],
    yRange: [-2, 12],
    radius: 1,
    radiusNote: "収束半径は 1。等比級数 1 + x + x² + … そのものです。",
  },
];

export function taylorByKey(key) {
  return TAYLOR_CASES.find((t) => t.key === key) || TAYLOR_CASES[0];
}

/** Taylor polynomial of the given degree about 0, evaluated at x. */
export function taylorValue(spec, degree, x) {
  let sum = 0;
  let power = 1;
  for (let n = 0; n <= degree; n++) {
    sum += spec.coef(n) * power;
    power *= x;
  }
  return sum;
}

/** Human-readable first few terms, for showing what is being added. */
export function taylorTerms(spec, degree, max = 6) {
  const terms = [];
  let truncated = false;
  for (let n = 0; n <= degree; n++) {
    const c = spec.coef(n);
    if (c === 0) continue;
    if (terms.length >= max) {
      truncated = true;
      break;
    }
    const sign = c < 0 ? "−" : terms.length ? "+" : "";
    const mag = Math.abs(c);
    const coefStr = Math.abs(mag - 1) < 1e-12 ? "" : formatCoef(mag);
    const xStr = n === 0 ? "1" : n === 1 ? "x" : `x^${n}`;
    terms.push(`${sign} ${coefStr}${coefStr && n > 0 ? "·" : ""}${n === 0 ? "1" : xStr}`.trim());
  }
  if (!terms.length) return "0";
  return terms.join(" ") + (truncated ? " + …" : "");
}

function formatCoef(v) {
  const inv = 1 / v;
  if (Math.abs(inv - Math.round(inv)) < 1e-9) return `1/${Math.round(inv)}`;
  return v.toPrecision(3);
}

/**
 * How far out from 0 the polynomial still tracks f to within `tol`.
 *
 * This is the figure that actually demonstrates the claim "raise the degree
 * and the agreement widens". A max error over the whole plotted domain does
 * not: a low-degree polynomial diverges wildly far from the origin, so that
 * number jumps around instead of falling.
 */
export function taylorAgreementRadius(spec, degree, tol = 0.01, maxX = 12, steps = 1200) {
  const limit = Number.isFinite(spec.radius) ? Math.min(maxX, spec.radius) : maxX;
  const step = limit / steps;
  for (let i = 1; i <= steps; i++) {
    const x = i * step;
    for (const t of [x, -x]) {
      // log(1+x) and 1/(1-x) are one-sided; skip where f is undefined.
      const truth = spec.f(t);
      if (!Number.isFinite(truth)) continue;
      if (Math.abs(truth - taylorValue(spec, degree, t)) > tol) return x;
    }
  }
  return limit;
}

/** Largest |f - Taylor| over an interval, sampled. */
export function taylorMaxError(spec, degree, a, b, samples = 400) {
  let worst = 0;
  for (let i = 0; i <= samples; i++) {
    const x = a + ((b - a) * i) / samples;
    const truth = spec.f(x);
    if (!Number.isFinite(truth)) continue;
    const approx = taylorValue(spec, degree, x);
    if (!Number.isFinite(approx)) continue;
    const d = Math.abs(truth - approx);
    if (d > worst) worst = d;
  }
  return worst;
}

/* -------------------------------------------------------- Newton's method -- */

export const NEWTON_CASES = [
  {
    key: "cubic",
    label: "x³ − 2x − 5 = 0",
    f: (x) => x ** 3 - 2 * x - 5,
    df: (x) => 3 * x * x - 2,
    domain: [-1, 3.2],
    root: 2.0945514815423265,
    note: "ニュートン自身が例に使った方程式です。",
  },
  {
    key: "sqrt2",
    label: "x² − 2 = 0",
    f: (x) => x * x - 2,
    df: (x) => 2 * x,
    domain: [0.2, 3],
    root: Math.SQRT2,
    note: "答えは √2。手計算で平方根を求める古典的な方法そのもの。",
  },
  {
    key: "dottie",
    label: "cos x − x = 0",
    f: (x) => Math.cos(x) - x,
    df: (x) => -Math.sin(x) - 1,
    domain: [-0.5, 2],
    root: 0.7390851332151607,
    note: "電卓で cos を押し続けると辿り着く数（ドッティー数）。",
  },
];

export function newtonByKey(key) {
  return NEWTON_CASES.find((n) => n.key === key) || NEWTON_CASES[0];
}

/**
 * Newton iterates from x0. Each step draws the tangent and takes its x-intercept.
 * The error column is what shows the quadratic convergence: the number of
 * correct digits roughly doubles each line.
 */
export function newtonIterations(spec, x0, steps = 6) {
  const rows = [];
  let x = x0;
  for (let i = 0; i <= steps; i++) {
    const fx = spec.f(x);
    const dfx = spec.df(x);
    const next = dfx === 0 ? NaN : x - fx / dfx;
    rows.push({ i, x, fx, dfx, next, error: Math.abs(x - spec.root) });
    if (!Number.isFinite(next)) break;
    x = next;
  }
  return rows;
}

/* ------------------------------------------------------ solid of revolution -- */

export const REVOLUTION_CASES = [
  {
    key: "sphere",
    label: "√(1 − x²)（球になる）",
    f: (x) => Math.sqrt(Math.max(0, 1 - x * x)),
    domain: [-1, 1],
    defaultRange: [-1, 1],
    exactLabel: "4π/3",
    exact: (4 * Math.PI) / 3,
  },
  {
    key: "cone",
    label: "x（円錐になる）",
    f: (x) => x,
    domain: [0, 2],
    defaultRange: [0, 2],
    exactLabel: "π·2³/3 = 8π/3",
    exact: (Math.PI * 8) / 3,
  },
  {
    key: "sqrt",
    label: "√x（放物面）",
    f: (x) => Math.sqrt(Math.max(0, x)),
    domain: [0, 4],
    defaultRange: [0, 4],
    exactLabel: "8π",
    exact: 8 * Math.PI,
  },
  {
    key: "sin",
    label: "sin x（ビーズ形）",
    f: (x) => Math.sin(x),
    domain: [0, Math.PI],
    defaultRange: [0, Math.PI],
    exactLabel: "π²/2",
    exact: (Math.PI * Math.PI) / 2,
  },
];

export function revolutionByKey(key) {
  return REVOLUTION_CASES.find((r) => r.key === key) || REVOLUTION_CASES[0];
}

/** Disk approximation of the volume, and the disks themselves for drawing. */
export function revolutionDisks(spec, a, b, n) {
  const count = Math.max(1, Math.floor(n));
  const w = (b - a) / count;
  const disks = [];
  let total = 0;
  for (let i = 0; i < count; i++) {
    const left = a + i * w;
    const mid = left + w / 2;
    const r = spec.f(mid);
    total += Math.PI * r * r * w;
    disks.push({ left, w, mid, r });
  }
  return { total, disks, width: w };
}

/* --------------------------------------------------------------- e itself -- */

/**
 * The slope of a^x at x = 0 is ln(a). e is the base where that slope is
 * exactly 1 — which is the same as saying e^x is its own derivative.
 */
export function baseSlopeAtZero(a, h = 1e-6) {
  if (!(a > 0)) return NaN;
  return (Math.pow(a, h) - 1) / h;
}

/** The other classical definition: (1 + 1/n)^n climbing to e. */
export function eLimitRow(n) {
  const value = Math.pow(1 + 1 / n, n);
  return { n, value, gap: Math.E - value };
}
