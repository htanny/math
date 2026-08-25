// Locate the first N nontrivial zeros of zeta on the critical line.
// Z(t) = e^{i*theta(t)} * zeta(1/2 + i t) is real-valued, so its sign changes
// mark the zeros. zeta is evaluated through the Dirichlet eta series with
// Borwein acceleration.

// Borwein's error bound degrades as |t| grows on the critical line, so the
// term count has to scale with t (the usual rule of thumb is ~0.9|t| + digits).
function termsFor(t) {
  return Math.max(40, Math.ceil(0.9 * Math.abs(t)) + 30);
}

const cache = new Map();
function coeffs(n) {
  let d = cache.get(n);
  if (!d) {
    d = borweinD(n);
    cache.set(n, d);
  }
  return d;
}

// Borwein d_k coefficients, built from the ratio recurrence so no factorial
// ever has to be formed explicitly.
function borweinD(n) {
  const d = new Array(n + 1);
  let b = 1 / n; // b_0
  let sum = b;
  d[0] = n * sum;
  for (let i = 0; i < n; i++) {
    b = (b * 4 * (n + i) * (n - i)) / ((2 * i + 1) * (2 * i + 2));
    sum += b;
    d[i + 1] = n * sum;
  }
  return d;
}

/** zeta(sigma + i t) as [re, im]. */
function zeta(sigma, t) {
  const n = termsFor(t);
  const D = coeffs(n);
  const dn = D[n];

  // eta(s) = -1/d_n * sum_{k=0}^{n-1} (-1)^k (d_k - d_n) / (k+1)^s
  let er = 0;
  let ei = 0;
  for (let k = 0; k < n; k++) {
    const coef = ((k % 2 === 0 ? 1 : -1) * (D[k] - dn)) / dn;
    const m = k + 1;
    const lm = Math.log(m);
    const mag = Math.pow(m, -sigma);
    // (k+1)^{-s} = m^{-sigma} * (cos(t ln m) - i sin(t ln m))
    er += -coef * mag * Math.cos(t * lm);
    ei += coef * mag * Math.sin(t * lm);
  }

  // divide by (1 - 2^{1-s})
  const p = Math.pow(2, 1 - sigma);
  const l2 = Math.log(2);
  const ar = 1 - p * Math.cos(t * l2);
  const ai = p * Math.sin(t * l2);
  const den = ar * ar + ai * ai;
  return [(er * ar + ei * ai) / den, (ei * ar - er * ai) / den];
}

/** Riemann-Siegel theta, asymptotic expansion (accurate well past t = 10). */
function theta(t) {
  return (
    (t / 2) * Math.log(t / (2 * Math.PI)) -
    t / 2 -
    Math.PI / 8 +
    1 / (48 * t) +
    7 / (5760 * t * t * t)
  );
}

/** Z(t), real-valued on the critical line. */
function Z(t) {
  const [zr, zi] = zeta(0.5, t);
  const th = theta(t);
  const c = Math.cos(th);
  const s = Math.sin(th);
  return { z: zr * c - zi * s, imag: zr * s + zi * c };
}

const want = Number(process.argv[2] || 50);
const zeros = [];
let prevT = 10;
let prev = Z(prevT).z;
let maxImag = 0;

for (let t = 10.001; t < 400 && zeros.length < want; t += 0.01) {
  const cur = Z(t).z;
  if (prev === 0 || (prev < 0) !== (cur < 0)) {
    // bisect
    let lo = prevT;
    let hi = t;
    let flo = prev;
    for (let i = 0; i < 80; i++) {
      const mid = (lo + hi) / 2;
      const fm = Z(mid).z;
      if ((flo < 0) !== (fm < 0)) hi = mid;
      else {
        lo = mid;
        flo = fm;
      }
    }
    const root = (lo + hi) / 2;
    const chk = Z(root);
    maxImag = Math.max(maxImag, Math.abs(chk.imag));
    zeros.push(root);
  }
  prevT = t;
  prev = cur;
}

console.log(`found ${zeros.length} zeros; max |Im(e^{i0}zeta)| at roots = ${maxImag.toExponential(2)}`);
console.log(zeros.map((z) => z.toFixed(9)).join(", "));

// sanity: the classical first ten, to catch a broken evaluator outright
const KNOWN = [
  14.134725142, 21.02203964, 25.01085758, 30.424876126, 32.935061588,
  37.586178159, 40.918719012, 43.327073281, 48.005150881, 49.773832478,
];
let worst = 0;
KNOWN.forEach((k, i) => {
  worst = Math.max(worst, Math.abs(k - zeros[i]));
});
console.log("max deviation from the classical first ten:", worst.toExponential(2));
