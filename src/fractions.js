/**
 * Exact rational arithmetic, small enough to stay readable. Used by the
 * fraction-division view and by the elimination steps in the simultaneous
 * equations view, both of which have to show answers as fractions rather
 * than as decimals that hide the structure.
 */

export function gcd(a, b) {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) {
    const t = a % b;
    a = b;
    b = t;
  }
  return a || 1;
}

/** Reduced fraction, sign carried by the numerator. */
export function frac(n, d) {
  if (d === 0) return { n: NaN, d: 0 };
  if (d < 0) {
    n = -n;
    d = -d;
  }
  const g = gcd(n, d);
  return { n: n / g, d: d / g };
}

export const fAdd = (p, q) => frac(p.n * q.d + q.n * p.d, p.d * q.d);
export const fSub = (p, q) => frac(p.n * q.d - q.n * p.d, p.d * q.d);
export const fMul = (p, q) => frac(p.n * q.n, p.d * q.d);
export const fDiv = (p, q) => frac(p.n * q.d, p.d * q.n);
export const fVal = (p) => p.n / p.d;

/** "3/4", or just "3" when the denominator is 1. */
export function fStr(p) {
  if (!Number.isFinite(p.n) || p.d === 0) return "—";
  if (p.d === 1) return String(p.n);
  return `${p.n}/${p.d}`;
}

/** "2 と 1/3" — how a Japanese primary-school answer is actually written. */
export function fMixed(p) {
  if (!Number.isFinite(p.n) || p.d === 0) return "—";
  if (p.d === 1) return String(p.n);
  const sign = p.n < 0 ? "−" : "";
  const n = Math.abs(p.n);
  const whole = Math.floor(n / p.d);
  const rest = n - whole * p.d;
  if (whole === 0) return `${sign}${rest}/${p.d}`;
  return `${sign}${whole} と ${rest}/${p.d}`;
}

/**
 * a/b ÷ c/d read as "how many c/d fit inside a/b".
 *
 * `whole` is the number of complete divisor tiles, and `restFrac` is the
 * leftover measured in units of one tile — which is exactly the fractional
 * part of the answer. Saying that out loud is the point of the whole view:
 * the answer counts tiles, it does not count b-ths.
 */
export function divisionTiling(a, b, c, d) {
  const dividend = frac(a, b);
  const divisor = frac(c, d);
  const quotient = fDiv(dividend, divisor);
  const q = fVal(quotient);
  const whole = Math.floor(q + 1e-12);
  const rest = fSub(quotient, frac(whole, 1));
  return {
    dividend,
    divisor,
    quotient,
    reciprocal: frac(divisor.d, divisor.n),
    whole,
    restFrac: rest,
    // how many divisor tiles fit inside 1 — the number the reciprocal names
    perUnit: frac(divisor.d, divisor.n),
  };
}
