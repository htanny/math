/**
 * The central limit theorem, approached from both ends: a Galton board,
 * where the bell curve is built one ball at a time, and sample means taken
 * from deliberately un-bell-shaped sources.
 */

export function normalPdf(x, mu, sigma) {
  const z = (x - mu) / sigma;
  return Math.exp(-0.5 * z * z) / (sigma * Math.sqrt(2 * Math.PI));
}

export function binomialPmf(rows, k) {
  // log-gamma free: rows stays small enough for exact products
  let c = 1;
  for (let i = 0; i < k; i++) c = (c * (rows - i)) / (i + 1);
  return c * Math.pow(0.5, rows);
}

/** One ball: count how many times it bounced right. */
export function dropBall(rows) {
  let k = 0;
  for (let i = 0; i < rows; i++) if (Math.random() < 0.5) k++;
  return k;
}

/** The path a ball takes, as (row, slot) pairs — for the animation. */
export function ballPath(rows) {
  const path = [[0, 0]];
  let slot = 0;
  for (let i = 0; i < rows; i++) {
    if (Math.random() < 0.5) slot++;
    path.push([i + 1, slot]);
  }
  return path;
}

/* ------------------------------------------------ sources for sample means -- */

export const SOURCES = [
  {
    key: "uniform",
    label: "一様（0〜1のどこも同じ）",
    sample: () => Math.random(),
    mean: 0.5,
    sd: 1 / Math.sqrt(12),
    range: [0, 1],
    note: "平らな分布。1個ずつではまったく山になりません。",
  },
  {
    key: "die",
    label: "サイコロの目（1〜6）",
    sample: () => 1 + Math.floor(Math.random() * 6),
    mean: 3.5,
    sd: Math.sqrt(35 / 12),
    range: [0.5, 6.5],
    note: "6本の棒。n を増やすと和の分布が山になっていきます。",
  },
  {
    key: "bimodal",
    label: "二山（両はしばかり出る）",
    sample: () => (Math.random() < 0.5 ? Math.random() * 0.2 : 0.8 + Math.random() * 0.2),
    mean: 0.5,
    sd: Math.sqrt(0.16 + 0.01 / 3),
    range: [0, 1],
    note: "まん中がまったく出ない分布からでも、標本平均はまん中に山を作ります。",
  },
  {
    key: "skew",
    label: "右に長く裾を引く（指数）",
    sample: () => -Math.log(1 - Math.random()),
    mean: 1,
    sd: 1,
    range: [0, 5],
    note: "左右非対称な分布。n が小さいうちは平均の分布も歪んだままです。",
  },
];

export function sourceByKey(key) {
  return SOURCES.find((s) => s.key === key) || SOURCES[0];
}

/** `trials` sample means, each of `n` draws. */
export function sampleMeans(source, n, trials) {
  const out = new Float64Array(trials);
  for (let t = 0; t < trials; t++) {
    let sum = 0;
    for (let i = 0; i < n; i++) sum += source.sample();
    out[t] = sum / n;
  }
  return out;
}

export function histogram(values, lo, hi, bins) {
  const counts = new Array(bins).fill(0);
  const w = (hi - lo) / bins;
  for (const v of values) {
    let i = Math.floor((v - lo) / w);
    if (i < 0) i = 0;
    if (i >= bins) i = bins - 1;
    counts[i]++;
  }
  return { counts, lo, hi, w };
}

export function meanSd(values) {
  const n = values.length;
  if (!n) return { mean: 0, sd: 0 };
  let s = 0;
  for (const v of values) s += v;
  const mean = s / n;
  let q = 0;
  for (const v of values) q += (v - mean) * (v - mean);
  return { mean, sd: Math.sqrt(q / n) };
}
