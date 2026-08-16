const MAX_STEPS = 100000;

export function computeSequence(start) {
  const n0 = Math.trunc(start);
  if (!Number.isFinite(n0) || n0 < 1) return null;

  const seq = [n0];
  let n = n0;
  let steps = 0;
  while (n !== 1 && steps < MAX_STEPS) {
    n = n % 2 === 0 ? n / 2 : 3 * n + 1;
    seq.push(n);
    steps++;
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
    steps,
    maxValue,
    maxStep,
    converged: n === 1,
  };
}

export function findRecordHolders(limit) {
  const n = Math.trunc(limit);
  if (!Number.isFinite(n) || n < 1) return [];

  const records = [];
  let bestSteps = -1;

  for (let start = 1; start <= n; start++) {
    let value = start;
    let steps = 0;
    while (value !== 1) {
      value = value % 2 === 0 ? value / 2 : 3 * value + 1;
      steps++;
    }
    if (steps > bestSteps) {
      bestSteps = steps;
      records.push({ start, steps });
    }
  }

  return records;
}
