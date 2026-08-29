/**
 * Proportion and speed, the two places where primary-school arithmetic
 * usually turns into a memorised formula. Both are the same relationship
 * seen twice, so both are handled here.
 */

/**
 * くらべる量 = もとにする量 × 割合.
 * Give any two and the third comes out; `unknown` says which one to fill in.
 */
export function solveProportion(base, ratio, compare, unknown) {
  if (unknown === "compare") return { base, ratio, compare: base * ratio };
  if (unknown === "ratio") return { base, ratio: base === 0 ? NaN : compare / base, compare };
  return { base: ratio === 0 ? NaN : compare / ratio, ratio, compare };
}

/** 1割 / 1分 / 1厘 — the Japanese units a primary textbook still uses. */
export function buai(ratio) {
  if (!Number.isFinite(ratio)) return "—";
  const r = Math.round(ratio * 1000) / 1000;
  const wari = Math.floor(r * 10 + 1e-9);
  const bu = Math.floor(r * 100 + 1e-9) - wari * 10;
  const rin = Math.round(r * 1000) - wari * 100 - bu * 10;
  if (r === 0) return "0割";
  let out = "";
  if (wari) out += `${wari}割`;
  if (bu) out += `${bu}分`;
  if (rin) out += `${rin}厘`;
  return out || "0割";
}

/* ------------------------------------------------------- 旅人算 / ダイヤグラム -- */

/**
 * A traveller is a straight line on a distance-time graph: where they start
 * and how fast they go. Everything the classic problems ask about is the
 * point where two of these lines cross.
 */
export function meetingPoint(p, q) {
  const dv = p.speed - q.speed;
  if (Math.abs(dv) < 1e-12) return null;
  const t = (q.start - p.start) / dv;
  if (t < 0) return { time: t, pos: p.start + p.speed * t, past: true };
  return { time: t, pos: p.start + p.speed * t, past: false };
}

export const TRAVEL_PRESETS = [
  {
    key: "meet",
    label: "出会い算",
    question:
      "1800 m はなれた 2 地点から、太郎さんは分速 70 m、花子さんは分速 50 m で向かい合って同時に出発します。何分後に出会いますか。",
    hint: "近づく速さは 70 + 50 = 分速 120 m。1800 ÷ 120 = 15 分後。グラフでは 2 本の線が交わる点です。",
    a: { name: "太郎", start: 0, speed: 70, delay: 0 },
    b: { name: "花子", start: 1800, speed: -50, delay: 0 },
    tMax: 24,
    xMax: 1800,
  },
  {
    key: "chase",
    label: "追いつき算",
    question:
      "妹が分速 60 m で家を出ました。8 分後に兄が分速 100 m で追いかけます。兄は何分後に妹に追いつきますか。",
    hint: "差は 60 × 8 = 480 m。ちぢまる速さは 100 − 60 = 分速 40 m。480 ÷ 40 = 12 分（兄が出てから）。",
    a: { name: "妹", start: 0, speed: 60, delay: 0 },
    b: { name: "兄", start: 0, speed: 100, delay: 8 },
    tMax: 26,
    xMax: 1600,
  },
  {
    key: "round",
    label: "往復して出会う",
    question:
      "1200 m の道を、A さんは分速 80 m、B さんは分速 40 m で両はしから同時に出発し、反対のはしに着いたら折り返します。2 回目に出会うのは何分後ですか。",
    hint: "近づく速さは 80 + 40 = 分速 120 m。1 回目は 1200 ÷ 120 = 10 分後。そのあとは 2 人合わせて往復ぶんの 2400 m 進むごとに出会うので、20 分おき — 2 回目は 30 分後です。",
    a: { name: "A", start: 0, speed: 80, delay: 0, turnAt: 1200 },
    b: { name: "B", start: 1200, speed: -40, delay: 0, turnAt: 0 },
    tMax: 40,
    xMax: 1200,
  },
];

/**
 * Position over time, folded back at the walls when the traveller turns
 * around — the zig-zag that makes 往復 problems readable at a glance.
 */
export function positionAt(tr, t, xMax) {
  const el = t - (tr.delay || 0);
  if (el <= 0) return tr.start;
  if (tr.turnAt === undefined) return tr.start + tr.speed * el;
  // reflect the free-running position into [0, xMax]
  const raw = tr.start + tr.speed * el;
  const span = 2 * xMax;
  let m = ((raw % span) + span) % span;
  return m > xMax ? span - m : m;
}

/** Times in (0, tMax] where the two travellers are at the same place. */
export function crossings(a, b, tMax, xMax, steps = 4000) {
  const gap = (t) => positionAt(a, t, xMax) - positionAt(b, t, xMax);
  const out = [];
  let prevT = 0;
  let prev = gap(0);
  for (let i = 1; i <= steps; i++) {
    const t = (tMax * i) / steps;
    const cur = gap(t);
    if (cur === 0) {
      out.push(t);
    } else if (Number.isFinite(prev) && prev !== 0 && (prev < 0) !== (cur < 0)) {
      let lo = prevT;
      let hi = t;
      for (let k = 0; k < 60; k++) {
        const mid = (lo + hi) / 2;
        if ((gap(lo) < 0) !== (gap(mid) < 0)) hi = mid;
        else lo = mid;
      }
      out.push((lo + hi) / 2);
    }
    prevT = t;
    prev = cur;
  }
  return out;
}
