/**
 * Aliquot sequences: repeatedly replace n with s(n), the sum of its proper
 * divisors. Every sequence is believed to either reach 1 or fall into a cycle
 * (the Catalan-Dickson conjecture) — but nobody has proved it, and 276 is the
 * smallest starting value whose fate is still unknown.
 */

// Values are kept inside this bound so trial division stays interactive and
// every intermediate sum stays a safe integer.
export const VALUE_CAP = 1e12;
export const STEP_CAP = 260;

/** Sum of the divisors of n excluding n itself. s(1) = 0. */
export function properDivisorSum(n) {
  if (n <= 1) return 0;
  let sum = 1;
  const limit = Math.floor(Math.sqrt(n));
  for (let d = 2; d <= limit; d++) {
    if (n % d === 0) {
      sum += d;
      const q = n / d;
      if (q !== d) sum += q;
    }
  }
  return sum;
}

/**
 * Classification of how a sequence ended.
 * "terminal"  — reached 1
 * "perfect"   — 1-cycle (a perfect number, e.g. 6)
 * "amicable"  — 2-cycle (e.g. 220 ⇄ 284)
 * "sociable"  — cycle of length >= 3
 * "open"      — hit the value or step cap; undecided by this tool
 */
export function classify(status, cycleLength) {
  if (status === "terminated") return "terminal";
  if (status === "cycle") {
    if (cycleLength === 1) return "perfect";
    if (cycleLength === 2) return "amicable";
    return "sociable";
  }
  return "open";
}

export function aliquotSequence(start) {
  const n0 = Math.trunc(start);
  if (!Number.isFinite(n0) || n0 < 1) return null;

  const seq = [n0];
  const seen = new Map([[n0, 0]]);
  let status = "truncated";
  let cycle = null;
  let cycleStart = -1;

  while (true) {
    const cur = seq[seq.length - 1];

    if (cur === 1) {
      status = "terminated";
      break;
    }
    if (seq.length > STEP_CAP) {
      status = "truncated";
      break;
    }

    const next = properDivisorSum(cur);
    seq.push(next);

    if (next > VALUE_CAP) {
      status = "overflow";
      break;
    }
    if (seen.has(next)) {
      cycleStart = seen.get(next);
      cycle = seq.slice(cycleStart, seq.length - 1);
      status = "cycle";
      break;
    }
    seen.set(next, seq.length - 1);
  }

  let maxValue = n0;
  let maxStep = 0;
  for (let i = 1; i < seq.length; i++) {
    if (seq[i] > maxValue) {
      maxValue = seq[i];
      maxStep = i;
    }
  }

  return {
    start: n0,
    sequence: seq,
    steps: seq.length - 1,
    maxValue,
    maxStep,
    status,
    cycle,
    // True when the starting value is itself part of the cycle, i.e. it really
    // is a perfect/amicable/sociable number rather than merely falling into one.
    startInCycle: cycleStart === 0,
    classification: classify(status, cycle ? cycle.length : 0),
  };
}

/* ------------------------------------------------------------------ scan -- */

// Scanning a whole range one trial division at a time is far too slow, so the
// divisor sums are sieved once and reused. Anything that escapes the sieve is
// reported as undecided rather than silently guessed at.
const SIEVE_LIMIT = 1_000_000;
let sieve = null;

function buildSieve() {
  if (sieve) return sieve;
  const s = new Int32Array(SIEVE_LIMIT + 1);
  for (let d = 1; d <= SIEVE_LIMIT >> 1; d++) {
    for (let m = 2 * d; m <= SIEVE_LIMIT; m += d) s[m] += d;
  }
  sieve = s;
  return s;
}

const SCAN_STEP_CAP = 120;

/**
 * Classify every starting value in 1..limit and count the outcomes.
 * Returns { counts, longest } where longest is the run with the most steps
 * among those that actually settled.
 */
export function scanRange(limit) {
  const n = Math.min(Math.max(Math.trunc(limit) || 0, 1), 50000);
  const s = buildSieve();

  const counts = { terminal: 0, perfect: 0, amicable: 0, sociable: 0, open: 0 };
  let longest = { start: 1, steps: 0 };

  for (let start = 1; start <= n; start++) {
    const seen = new Map([[start, 0]]);
    let cur = start;
    let steps = 0;
    let status = "truncated";
    let cycleLength = 0;

    while (true) {
      if (cur === 1) {
        status = "terminated";
        break;
      }
      if (steps >= SCAN_STEP_CAP || cur > SIEVE_LIMIT) {
        status = "truncated";
        break;
      }
      const next = s[cur];
      steps++;
      if (seen.has(next)) {
        cycleLength = steps - seen.get(next);
        status = "cycle";
        break;
      }
      seen.set(next, steps);
      cur = next;
    }

    const kind = classify(status, cycleLength);
    counts[kind]++;
    if (kind !== "open" && steps > longest.steps) longest = { start, steps };
  }

  return { counts, longest, limit: n };
}
