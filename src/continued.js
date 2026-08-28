/**
 * Continued fractions and phyllotaxis.
 *
 * Placing seed k at angle 2*pi*alpha*k and radius proportional to sqrt(k) packs
 * them evenly exactly when alpha is hard to approximate by rationals. The
 * continued fraction says how hard: a large partial quotient means a nearby
 * good rational, which shows up as seeds lining up into visible spokes. The
 * golden ratio's expansion is all 1s — the worst possible approximations, and
 * so the best packing. Sunflowers use it.
 */

export const PHI = (1 + Math.sqrt(5)) / 2;
export const GOLDEN = 1 / PHI; // 0.6180339887..., the golden angle as a turn fraction

/** Continued fraction expansion [a0; a1, a2, ...] of x. */
export function continuedFraction(x, maxTerms = 12) {
  const terms = [];
  let v = x;
  for (let i = 0; i < maxTerms; i++) {
    const a = Math.floor(v);
    terms.push(a);
    const frac = v - a;
    // Below this the remaining float noise would invent spurious huge terms.
    if (frac < 1e-12) break;
    v = 1 / frac;
    if (!Number.isFinite(v) || v > 1e15) break;
  }
  return terms;
}

/** Convergents p/q of a continued fraction, with the error of each. */
export function convergents(terms, x) {
  const out = [];
  let pPrev = 1;
  let p = terms[0];
  let qPrev = 0;
  let q = 1;
  out.push({ p, q, value: p / q, error: Math.abs(x - p / q), term: terms[0] });

  for (let i = 1; i < terms.length; i++) {
    const a = terms[i];
    const pNext = a * p + pPrev;
    const qNext = a * q + qPrev;
    pPrev = p;
    p = pNext;
    qPrev = q;
    q = qNext;
    if (!Number.isFinite(p) || !Number.isFinite(q) || q > 1e15) break;
    out.push({ p, q, value: p / q, error: Math.abs(x - p / q), term: a });
  }
  return out;
}

/** Seed positions for a spiral of n seeds at turn fraction alpha, unit radius. */
export function seedPositions(alpha, n) {
  const pts = new Float64Array(n * 2);
  const TAU = Math.PI * 2;
  for (let k = 0; k < n; k++) {
    const r = Math.sqrt((k + 0.5) / n);
    const a = TAU * alpha * k;
    pts[k * 2] = r * Math.cos(a);
    pts[k * 2 + 1] = r * Math.sin(a);
  }
  return pts;
}

/**
 * Smallest distance between any two seeds, scaled by sqrt(n) so the number is
 * comparable across seed counts. Bigger means better packing; the golden angle
 * maximises it.
 */
export function minSpacing(pts, n) {
  let best = Infinity;
  for (let i = 0; i < n; i++) {
    const xi = pts[i * 2];
    const yi = pts[i * 2 + 1];
    for (let j = i + 1; j < n; j++) {
      const dx = pts[j * 2] - xi;
      const dy = pts[j * 2 + 1] - yi;
      const d2 = dx * dx + dy * dy;
      if (d2 < best) best = d2;
    }
  }
  return Math.sqrt(best) * Math.sqrt(n);
}

export const ALPHA_PRESETS = [
  { value: GOLDEN, label: "黄金比 1/φ", note: "連分数が全部1 — 最も有理数で近似しにくく、最も詰まる" },
  { value: 1 / Math.sqrt(2), label: "1/√2", note: "[0;1,2,2,2,…] 周期的" },
  { value: 1 / Math.PI, label: "1/π", note: "大きな項が現れると隙間が空く" },
  { value: 1 / Math.E, label: "1/e", note: "[0;2,1,2,1,1,4,1,1,6,…]" },
  { value: Math.PI - 3, label: "π − 3", note: "[0;7,15,1,292,…] 292 が 355/113 の精度を生む" },
  { value: 0.5, label: "1/2", note: "有理数 — 2本の直線に潰れる" },
  { value: 1 / 3, label: "1/3", note: "有理数 — 3本の直線に潰れる" },
];
