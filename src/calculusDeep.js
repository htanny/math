/**
 * The parts of differentiation that get memorised rather than understood:
 * where a derivative fails to exist, what the limit definition actually does,
 * why the product rule has two terms, and why the chain rule multiplies.
 */

/* ------------------------------------------- where differentiation fails -- */

/**
 * Each entry is continuous at 0 but tests a different way of failing to be
 * differentiable there, so the one-sided secant slopes tell them apart.
 */
export const ROUGH_FUNCTIONS = [
  {
    key: "abs",
    label: "|x|",
    f: (x) => Math.abs(x),
    at: 0,
    domain: [-1.5, 1.5],
    verdict: "corner",
    note: "左からは −1、右からは +1 に近づきます。両側の極限が違うので微分できません（尖点）。",
  },
  {
    key: "sqrtabs",
    label: "√|x|",
    f: (x) => Math.sqrt(Math.abs(x)),
    at: 0,
    domain: [-1.5, 1.5],
    verdict: "vertical",
    note: "両側とも傾きが無限に大きくなります。極限が有限の値に定まらないので微分できません（垂直接線）。",
  },
  {
    key: "xsin",
    label: "x sin(1/x)",
    f: (x) => (x === 0 ? 0 : x * Math.sin(1 / x)),
    at: 0,
    domain: [-0.6, 0.6],
    verdict: "oscillate",
    note: "割線の傾きが −1 と +1 のあいだで振動し続け、どこにも収束しません。連続だが微分できない例です。",
  },
  {
    key: "x2sin",
    label: "x² sin(1/x)",
    f: (x) => (x === 0 ? 0 : x * x * Math.sin(1 / x)),
    at: 0,
    domain: [-0.6, 0.6],
    verdict: "differentiable",
    note: "振動しますが振幅が x² で潰れるため、傾きは 0 に収束します。微分可能（ただし導関数は 0 で不連続）。",
  },
  {
    key: "smooth",
    label: "x²（比較用）",
    f: (x) => x * x,
    at: 0,
    domain: [-1.5, 1.5],
    verdict: "differentiable",
    note: "両側とも 0 に収束します。ふつうに微分できる関数の様子。",
  },
];

export function roughByKey(key) {
  return ROUGH_FUNCTIONS.find((r) => r.key === key) || ROUGH_FUNCTIONS[0];
}

/** Secant slope from one side: (f(a+h) - f(a)) / h, signed h. */
export function oneSidedSlope(f, a, h) {
  if (h === 0) return NaN;
  return (f(a + h) - f(a)) / h;
}

/** Slopes for a shrinking sequence of h, both signs, for the table. */
export function slopeLadder(f, a, hStart = 0.5, steps = 8, ratio = 0.25) {
  const rows = [];
  let h = hStart;
  for (let i = 0; i < steps; i++) {
    rows.push({
      h,
      left: oneSidedSlope(f, a, -h),
      right: oneSidedSlope(f, a, h),
    });
    h *= ratio;
  }
  return rows;
}

/* --------------------------------------------- the limit definition, shown -- */

/**
 * The algebra of lim (f(x+h) - f(x)) / h, written out. Each function carries
 * its own steps because seeing h cancel is the whole point; a generic
 * numeric-only view would hide exactly the step that matters.
 */
export const DEFINITION_CASES = [
  {
    key: "sq",
    label: "f(x) = x²",
    f: (x) => x * x,
    df: (x) => 2 * x,
    result: "2x",
    steps: [
      { expr: "( (x + h)² − x² ) / h", note: "定義の式" },
      { expr: "( x² + 2xh + h² − x² ) / h", note: "展開する" },
      { expr: "( 2xh + h² ) / h", note: "x² が消える" },
      { expr: "2x + h", note: "h で約分 ← ここが山場" },
      { expr: "2x", note: "h → 0" },
    ],
    approx: (x, h) => 2 * x + h,
    approxLabel: "2x + h",
  },
  {
    key: "cube",
    label: "f(x) = x³",
    f: (x) => x ** 3,
    df: (x) => 3 * x * x,
    result: "3x²",
    steps: [
      { expr: "( (x + h)³ − x³ ) / h", note: "定義の式" },
      { expr: "( x³ + 3x²h + 3xh² + h³ − x³ ) / h", note: "展開する" },
      { expr: "( 3x²h + 3xh² + h³ ) / h", note: "x³ が消える" },
      { expr: "3x² + 3xh + h²", note: "h で約分" },
      { expr: "3x²", note: "h → 0" },
    ],
    approx: (x, h) => 3 * x * x + 3 * x * h + h * h,
    approxLabel: "3x² + 3xh + h²",
  },
  {
    key: "recip",
    label: "f(x) = 1/x",
    f: (x) => 1 / x,
    df: (x) => -1 / (x * x),
    result: "−1/x²",
    steps: [
      { expr: "( 1/(x + h) − 1/x ) / h", note: "定義の式" },
      { expr: "( ( x − (x + h) ) / ( x(x + h) ) ) / h", note: "通分する" },
      { expr: "( −h / ( x(x + h) ) ) / h", note: "分子を整理" },
      { expr: "−1 / ( x(x + h) )", note: "h で約分" },
      { expr: "−1 / x²", note: "h → 0" },
    ],
    approx: (x, h) => -1 / (x * (x + h)),
    approxLabel: "−1 / (x(x + h))",
  },
  {
    key: "sqrt",
    label: "f(x) = √x",
    f: Math.sqrt,
    df: (x) => 1 / (2 * Math.sqrt(x)),
    result: "1 / (2√x)",
    steps: [
      { expr: "( √(x + h) − √x ) / h", note: "定義の式" },
      { expr: "( (x + h) − x ) / ( h ( √(x+h) + √x ) )", note: "分子を有理化する" },
      { expr: "h / ( h ( √(x+h) + √x ) )", note: "分子を整理" },
      { expr: "1 / ( √(x+h) + √x )", note: "h で約分" },
      { expr: "1 / (2√x)", note: "h → 0" },
    ],
    approx: (x, h) => 1 / (Math.sqrt(x + h) + Math.sqrt(x)),
    approxLabel: "1 / (√(x+h) + √x)",
  },
];

export function definitionByKey(key) {
  return DEFINITION_CASES.find((c) => c.key === key) || DEFINITION_CASES[0];
}

/* ------------------------------------------------ product rule, by areas -- */

export const PRODUCT_PAIRS = [
  {
    key: "x_sin",
    label: "f = x + 1,  g = sin x + 1.5",
    f: (x) => x + 1,
    df: () => 1,
    g: (x) => Math.sin(x) + 1.5,
    dg: Math.cos,
    fLabel: "x + 1",
    gLabel: "sin x + 1.5",
    domain: [0, 3],
  },
  {
    key: "sq_exp",
    label: "f = x² + 0.5,  g = e^(x/2)",
    f: (x) => x * x + 0.5,
    df: (x) => 2 * x,
    g: (x) => Math.exp(x / 2),
    dg: (x) => Math.exp(x / 2) / 2,
    fLabel: "x² + 0.5",
    gLabel: "e^(x/2)",
    domain: [0, 2.2],
  },
  {
    key: "lin_lin",
    label: "f = x + 1,  g = 3 − x",
    f: (x) => x + 1,
    df: () => 1,
    g: (x) => 3 - x,
    dg: () => -1,
    fLabel: "x + 1",
    gLabel: "3 − x",
    domain: [0, 2.5],
  },
];

export function productByKey(key) {
  return PRODUCT_PAIRS.find((p) => p.key === key) || PRODUCT_PAIRS[0];
}

/**
 * The three pieces the rectangle gains when x moves by dx. The corner piece
 * df*dg is second order — it is what vanishes in the limit, leaving
 * (fg)' = f'g + fg'.
 */
export function productPieces(pair, x, dx) {
  const f0 = pair.f(x);
  const g0 = pair.g(x);
  const f1 = pair.f(x + dx);
  const g1 = pair.g(x + dx);
  const df = f1 - f0;
  const dg = g1 - g0;
  const total = f1 * g1 - f0 * g0;
  return {
    f0,
    g0,
    f1,
    g1,
    df,
    dg,
    fdg: f0 * dg,
    gdf: g0 * df,
    corner: df * dg,
    total,
    // (fg)' from the rule, against the actual difference quotient
    ruleSlope: pair.df(x) * g0 + f0 * pair.dg(x),
    actualSlope: dx === 0 ? NaN : total / dx,
  };
}

/* ------------------------------------------------------------ chain rule -- */

export const CHAIN_CASES = [
  {
    key: "sin_sq",
    label: "y = sin(x²)",
    inner: (x) => x * x,
    dInner: (x) => 2 * x,
    outer: Math.sin,
    dOuter: Math.cos,
    innerLabel: "u = x²",
    outerLabel: "y = sin u",
    dInnerLabel: "du/dx = 2x",
    dOuterLabel: "dy/du = cos u",
    domain: [-2, 2],
  },
  {
    key: "sq_sin",
    label: "y = (sin x)²",
    inner: Math.sin,
    dInner: Math.cos,
    outer: (u) => u * u,
    dOuter: (u) => 2 * u,
    innerLabel: "u = sin x",
    outerLabel: "y = u²",
    dInnerLabel: "du/dx = cos x",
    dOuterLabel: "dy/du = 2u",
    domain: [-Math.PI, Math.PI],
  },
  {
    key: "exp_neg_sq",
    label: "y = e^(−x²)",
    inner: (x) => -x * x,
    dInner: (x) => -2 * x,
    outer: Math.exp,
    dOuter: Math.exp,
    innerLabel: "u = −x²",
    outerLabel: "y = eᵘ",
    dInnerLabel: "du/dx = −2x",
    dOuterLabel: "dy/du = eᵘ",
    domain: [-2, 2],
  },
];

export function chainByKey(key) {
  return CHAIN_CASES.find((c) => c.key === key) || CHAIN_CASES[0];
}

/** The three linked increments: dx pushes u, u pushes y. */
export function chainStep(c, x, dx) {
  const u = c.inner(x);
  const y = c.outer(u);
  const u2 = c.inner(x + dx);
  const y2 = c.outer(u2);
  const du = u2 - u;
  const dy = y2 - y;
  return {
    x,
    u,
    y,
    du,
    dy,
    dInner: c.dInner(x),
    dOuter: c.dOuter(u),
    product: c.dOuter(u) * c.dInner(x),
    actual: dx === 0 ? NaN : dy / dx,
  };
}
