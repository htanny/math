/**
 * Motion turned into a graph — the shape of entrance-exam problem where the
 * answer is not a number but a broken line, and the whole difficulty is that
 * the figure on the page is not moving.
 *
 * Two situations, one idea: freeze the motion at time t, measure something,
 * and plot it. Here the measured thing is either the area two figures share,
 * or the depth of water in a tank with partitions.
 */

/* --------------------------------------------------- overlapping figures -- */

export function polyArea2(poly) {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x0, y0] = poly[i];
    const [x1, y1] = poly[(i + 1) % poly.length];
    s += x0 * y1 - x1 * y0;
  }
  return Math.abs(s) / 2;
}

/**
 * Sutherland–Hodgman. Valid when the clip polygon is convex, which is why
 * every figure below is stored as a list of convex pieces rather than as one
 * outline — an L-shape would break this otherwise.
 */
export function clipConvex(subject, clip) {
  let out = subject;
  for (let i = 0; i < clip.length && out.length; i++) {
    const a = clip[i];
    const b = clip[(i + 1) % clip.length];
    const side = (p) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
    const input = out;
    out = [];
    for (let k = 0; k < input.length; k++) {
      const p = input[k];
      const q = input[(k + 1) % input.length];
      const sp = side(p);
      const sq = side(q);
      if (sp >= 0) out.push(p);
      if ((sp > 0 && sq < 0) || (sp < 0 && sq > 0)) {
        const t = sp / (sp - sq);
        out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
      }
    }
  }
  return out;
}

const shift = (poly, dx) => poly.map(([x, y]) => [x + dx, y]);

/** Total shared area of two figures, each a list of convex pieces. */
export function overlapArea(fixedPieces, movingPieces, dx) {
  let total = 0;
  for (const m of movingPieces) {
    const moved = shift(m, dx);
    for (const f of fixedPieces) {
      const cut = clipConvex(moved, f);
      if (cut.length >= 3) total += polyArea2(cut);
    }
  }
  return total;
}

const rect = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];

export const OVERLAP_CASES = [
  {
    key: "sq-sq",
    label: "正方形 × 小さい正方形",
    fixed: { pieces: [rect(0, 0, 6, 6)], outline: rect(0, 0, 6, 6), label: "1辺 6cm" },
    moving: { pieces: [rect(0, 1, 4, 4)], outline: rect(0, 1, 4, 4), label: "1辺 4cm" },
    from: -4,
    to: 6,
    note:
      "小さいほうが完全に中に入っているあいだは、重なりが増えも減りもしません。" +
      "グラフの真ん中が平らになるのはそのためです（台形のグラフ）。",
  },
  {
    key: "sq-sq-same",
    label: "同じ大きさの正方形",
    fixed: { pieces: [rect(0, 0, 6, 6)], outline: rect(0, 0, 6, 6), label: "1辺 6cm" },
    moving: { pieces: [rect(0, 0, 6, 6)], outline: rect(0, 0, 6, 6), label: "1辺 6cm" },
    from: -6,
    to: 6,
    note:
      "同じ大きさだと「ぴったり重なる」のは一瞬だけ。だから平らな部分がなく、" +
      "とがった山（三角形のグラフ）になります。前の例と見くらべてください。",
  },
  {
    key: "sq-tri",
    label: "正方形 × 直角三角形",
    fixed: { pieces: [rect(0, 0, 6, 6)], outline: rect(0, 0, 6, 6), label: "1辺 6cm" },
    moving: {
      pieces: [[[0, 1], [4, 1], [4, 5]]],
      outline: [[0, 1], [4, 1], [4, 5]],
      label: "直角をはさむ辺 4cm",
    },
    from: -4,
    to: 6,
    note:
      "三角形が入ってくるところは、重なりの横はばが増えると同時に高さも増えるので、" +
      "面積は<strong>2次の増え方</strong>になります。グラフがふくらんだ曲線になるのはそのためです。",
  },
  {
    key: "L-sq",
    label: "L字 × 正方形",
    fixed: {
      pieces: [rect(0, 0, 3, 6), rect(3, 0, 3, 3)],
      outline: [[0, 0], [6, 0], [6, 3], [3, 3], [3, 6], [0, 6]],
      label: "L字（6cm の正方形から 3cm 角を取った形）",
    },
    moving: { pieces: [rect(0, 0, 3, 5)], outline: rect(0, 0, 3, 5), label: "たて 5cm・よこ 3cm" },
    from: -3,
    to: 6,
    note:
      "重なれる高さが、左の柱では 5cm、段の右では 3cm しかありません。" +
      "そのため傾きが 5 → −2 → −3 と 3 回変わります。" +
      "へこんだ形は凸な部分に分けてから重なりを求めています。",
  },
];

export function overlapCaseByKey(key) {
  return OVERLAP_CASES.find((c) => c.key === key) || OVERLAP_CASES[0];
}

/** The moving figure travels at 1 cm per second, so time and position agree. */
export const positionAt = (spec, t) => spec.from + t;
export const durationOf = (spec) => spec.to - spec.from;
export const areaAt = (spec, t) => overlapArea(spec.fixed.pieces, spec.moving.pieces, positionAt(spec, t));

/**
 * Where the graph bends.
 *
 * Candidates come from geometry — a corner of one figure reaching the line of
 * an edge of the other — but a candidate is only a real bend if the slope
 * actually changes there, so each one is confirmed by comparing the slope on
 * either side. Listing candidates alone would mark corners where nothing
 * happens.
 */
export function breakpoints(spec, tol = 1e-6) {
  const span = durationOf(spec);
  const cands = new Set();
  const edgesOf = (pieces) =>
    pieces.flatMap((p) => p.map((a, i) => [a, p[(i + 1) % p.length]]));
  const fixedEdges = edgesOf(spec.fixed.pieces);
  const movingEdges = edgesOf(spec.moving.pieces);
  const fixedPts = spec.fixed.pieces.flat();
  const movingPts = spec.moving.pieces.flat();

  const add = (dx) => {
    const t = dx - spec.from;
    if (t > 1e-9 && t < span - 1e-9) cands.add(Math.round(t * 1e9) / 1e9);
  };
  // a moving corner reaching the line of a fixed edge
  for (const v of movingPts) {
    for (const [a, b] of fixedEdges) {
      if (Math.abs(b[1] - a[1]) < 1e-12) continue; // horizontal: no single crossing time
      const x = a[0] + ((v[1] - a[1]) * (b[0] - a[0])) / (b[1] - a[1]);
      add(x - v[0]);
    }
  }
  // a fixed corner reaching the line of a moving edge
  for (const v of fixedPts) {
    for (const [a, b] of movingEdges) {
      if (Math.abs(b[1] - a[1]) < 1e-12) continue;
      const x = a[0] + ((v[1] - a[1]) * (b[0] - a[0])) / (b[1] - a[1]);
      add(v[0] - x);
    }
  }

  const h = span * 1e-4;
  const slope = (t) => (areaAt(spec, t + h) - areaAt(spec, t - h)) / (2 * h);
  return [...cands]
    .sort((a, b) => a - b)
    .filter((t) => Math.abs(slope(t + 2 * h) - slope(t - 2 * h)) > tol);
}

/** Straight or curved, decided from the quadratic term over the interval. */
export function segmentKind(spec, t0, t1) {
  const m = (t0 + t1) / 2;
  const q = t0 + (t1 - t0) * 0.25;
  const r = t0 + (t1 - t0) * 0.75;
  const [a0, aq, am, ar, a1] = [t0, q, m, r, t1].map((t) => areaAt(spec, t));
  const straight = Math.abs(am - (a0 + a1) / 2);
  const scale = Math.max(1e-9, Math.abs(a1 - a0), Math.abs(am));
  if (straight / scale < 1e-6) return { kind: "直線", curvature: 0 };
  // second difference of equally spaced samples: constant for a quadratic
  return { kind: "曲線", curvature: aq - 2 * am + ar };
}

/* ------------------------------------------------------------ water tanks -- */

export const TANK_CASES = [
  {
    key: "one",
    label: "仕切り 1 枚",
    widths: [30, 20],
    depth: 20,
    walls: [10],
    height: 20,
    rate: 200,
    note:
      "左のへやが 10cm までたまると、水は仕切りをこえて右へ流れます。" +
      "そのあいだ左の水面は動かないので、グラフは平らになります。",
  },
  {
    key: "two",
    label: "仕切り 2 枚",
    widths: [20, 15, 15],
    depth: 20,
    walls: [8, 12],
    height: 18,
    rate: 200,
    note:
      "仕切りが 2 枚あると、のぼる → 止まる → のぼる → 止まる → のぼる、と 5 つの区間になります。" +
      "のぼる部分の傾きが少しずつゆるくなるのは、水を受ける底面積が広がっていくからです。",
  },
  {
    key: "wide",
    label: "右のへやが広い",
    widths: [20, 30],
    depth: 20,
    walls: [12],
    height: 20,
    rate: 200,
    note:
      "右が広いぶん、仕切りをこえてから満ちるまでが長くなります。" +
      "平らな部分の長さは、右のへやの底面積に比例します。",
  },
];

export function tankCaseByKey(key) {
  return TANK_CASES.find((c) => c.key === key) || TANK_CASES[0];
}

/**
 * Pour into the leftmost room at a constant rate and let it spill rightwards.
 *
 * The state is a stack of pools: the one at the top is filling, and every
 * pool below it is held at the top of the wall it spilled over. A pool stops
 * rising when it reaches a wall (and a new pool starts beyond it) or when it
 * comes back up to the level of the pool behind it (and the two merge).
 */
export function simulateTank(spec) {
  const { widths, depth, walls, height, rate } = spec;
  const n = widths.length;
  const areaOf = (lo, hi) => {
    let s = 0;
    for (let i = lo; i <= hi; i++) s += widths[i] * depth;
    return s;
  };

  let pools = [{ lo: 0, hi: 0, level: 0 }];
  let t = 0;
  const segments = [];

  for (let guard = 0; guard < 200; guard++) {
    const top = pools[pools.length - 1];
    const area = areaOf(top.lo, top.hi);
    const cands = [{ h: height, kind: "full" }];
    if (top.hi < n - 1) cands.push({ h: walls[top.hi], kind: "spill" });
    if (pools.length > 1) cands.push({ h: walls[pools[pools.length - 2].hi], kind: "merge" });
    const next = cands
      .filter((c) => c.h > top.level + 1e-12)
      .sort((a, b) => a.h - b.h)[0];
    if (!next) break;

    const dt = ((next.h - top.level) * area) / rate;
    segments.push({
      t0: t,
      t1: t + dt,
      pools: pools.map((p) => ({ ...p })),
      rising: pools.length - 1,
      risingArea: area,
      left0: pools[0].level,
      left1: pools.length === 1 ? next.h : pools[0].level,
    });

    t += dt;
    top.level = next.h;
    if (next.kind === "full") break;
    if (next.kind === "spill") {
      pools.push({ lo: top.hi + 1, hi: top.hi + 1, level: 0 });
    } else {
      const below = pools[pools.length - 2];
      pools.splice(pools.length - 2, 2, { lo: below.lo, hi: top.hi, level: top.level });
    }
  }

  return {
    segments,
    tFull: t,
    totalVolume: areaOf(0, n - 1) * height,
    baseArea: (lo, hi) => areaOf(lo, hi),
  };
}

/** Level in every room at time t, and the depth in the room being poured into. */
export function tankStateAt(sim, spec, t) {
  const levels = new Array(spec.widths.length).fill(0);
  const seg = sim.segments.find((s) => t >= s.t0 - 1e-9 && t <= s.t1 + 1e-9) ||
    sim.segments[sim.segments.length - 1];
  if (!seg) return { levels, left: 0 };
  const tt = Math.max(seg.t0, Math.min(seg.t1, t));
  seg.pools.forEach((p, i) => {
    const lvl = i === seg.rising ? p.level + (spec.rate * (tt - seg.t0)) / seg.risingArea : p.level;
    for (let k = p.lo; k <= p.hi; k++) levels[k] = lvl;
  });
  return { levels, left: levels[0] };
}

/** Water actually in the tank at time t — has to equal rate × t. */
export function tankVolumeAt(sim, spec, t) {
  const { levels } = tankStateAt(sim, spec, t);
  return levels.reduce((s, l, i) => s + l * spec.widths[i] * spec.depth, 0);
}
