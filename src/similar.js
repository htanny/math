/**
 * 相似比と、面積比・体積比。
 *
 * 「長さが 2 倍なら面積も 2 倍」は小6から中3までいちばん多い誤答で、
 * 公式を覚え直しても直りません。効くのは、大きいほうが小さいほうの
 * **何個ぶんでできているか** を実際に見ることです。だからここでは比を
 * 計算するのではなく、拡大した図形を合同なピースで敷き詰めます。
 * 三角形なら k² 個、立方体なら k³ 個にきっかりなります。
 */

/* ---------------------------------------------------------------- 平面 -- */

export function polyArea(poly) {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x0, y0] = poly[i];
    const [x1, y1] = poly[(i + 1) % poly.length];
    s += x0 * y1 - x1 * y0;
  }
  return Math.abs(s) / 2;
}

export const scalePoly = (poly, k) => poly.map(([x, y]) => [x * k, y * k]);

/** Side lengths, sorted — enough to tell congruent triangles apart. */
export function sideLengths(poly) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const [x0, y0] = poly[i];
    const [x1, y1] = poly[(i + 1) % poly.length];
    out.push(Math.hypot(x1 - x0, y1 - y0));
  }
  return out.sort((a, b) => a - b);
}

/**
 * A triangle scaled by k, cut into k² copies of the original.
 *
 * Lay a lattice P(i,j) = A + (i/k)(B−A) + (j/k)(C−A) over the big triangle.
 * The upward cells are (i,j)(i+1,j)(i,j+1) — k(k+1)/2 of them — and the
 * downward ones (i+1,j)(i,j+1)(i+1,j+1) — k(k−1)/2. Together k², and every
 * one of them is the original triangle translated or turned half a turn.
 */
export function tileTriangle(tri, k) {
  const [A, B, C] = tri;
  const P = (i, j) => [
    A[0] + ((B[0] - A[0]) * i) / k + ((C[0] - A[0]) * j) / k,
    A[1] + ((B[1] - A[1]) * i) / k + ((C[1] - A[1]) * j) / k,
  ];
  const out = [];
  for (let i = 0; i + 1 <= k; i++) {
    for (let j = 0; i + j + 1 <= k; j++) {
      out.push({ poly: [P(i, j), P(i + 1, j), P(i, j + 1)], flipped: false });
      if (i + j + 2 <= k) {
        out.push({ poly: [P(i + 1, j), P(i, j + 1), P(i + 1, j + 1)], flipped: true });
      }
    }
  }
  return out;
}

/** The same for a parallelogram (a rectangle is one), as a k × k grid. */
export function tileParallelogram(quad, k) {
  const [A, B, , D] = quad;
  const u = [(B[0] - A[0]) / k, (B[1] - A[1]) / k];
  const v = [(D[0] - A[0]) / k, (D[1] - A[1]) / k];
  const P = (i, j) => [A[0] + u[0] * i + v[0] * j, A[1] + u[1] * i + v[1] * j];
  const out = [];
  for (let i = 0; i < k; i++) {
    for (let j = 0; j < k; j++) {
      out.push({ poly: [P(i, j), P(i + 1, j), P(i + 1, j + 1), P(i, j + 1)], flipped: false });
    }
  }
  return out;
}

export const FIGURES = [
  {
    key: "triangle",
    label: "三角形",
    poly: [[0, 0], [4, 0], [1.3, 3.1]],
    tile: tileTriangle,
    note:
      "三角形は、上向き k(k+1)/2 個と下向き k(k−1)/2 個に分かれます。" +
      "足すとちょうど k² 個。下向きが混ざるのは三角形だけの事情で、" +
      "個数が k² になることには関係ありません。",
  },
  {
    key: "rect",
    label: "長方形",
    poly: [[0, 0], [3.6, 0], [3.6, 2.4], [0, 2.4]],
    tile: tileParallelogram,
    note: "たてに k 個、よこに k 個。だから k × k = k² 個。いちばん見やすい形です。",
  },
  {
    key: "para",
    label: "平行四辺形",
    poly: [[0, 0], [3.4, 0], [4.4, 2.4], [1, 2.4]],
    tile: tileParallelogram,
    note: "傾いていても同じこと。k × k の格子に分かれて k² 個になります。",
  },
];

export const figureByKey = (key) => FIGURES.find((f) => f.key === key) || FIGURES[0];

/* ---------------------------------------------------------------- 立体 -- */

/** A box scaled by k, cut into k³ copies of the original box. */
export function tileBox(dims, k) {
  const [w, h, d] = dims;
  const out = [];
  for (let i = 0; i < k; i++) {
    for (let j = 0; j < k; j++) {
      for (let m = 0; m < k; m++) {
        out.push({ at: [i * w, j * h, m * d], dims });
      }
    }
  }
  return out;
}

export const boxVolume = ([w, h, d]) => w * h * d;
export const boxSurface = ([w, h, d]) => 2 * (w * h + h * d + d * w);

export const BOXES = [
  { key: "cube", label: "立方体", dims: [1, 1, 1] },
  { key: "brick", label: "直方体", dims: [1.6, 1, 0.7] },
];

export const boxByKey = (key) => BOXES.find((b) => b.key === key) || BOXES[0];

/**
 * The rule is not about boxes. Each of these is measured from its own formula
 * at size 1 and at size k, so the k² and k³ come out of the geometry rather
 * than being asserted.
 */
export const SOLIDS = [
  {
    key: "cube",
    label: "立方体（1辺 a）",
    volume: (a) => a ** 3,
    surface: (a) => 6 * a * a,
  },
  {
    key: "sphere",
    label: "球（半径 a）",
    volume: (a) => (4 / 3) * Math.PI * a ** 3,
    surface: (a) => 4 * Math.PI * a * a,
  },
  {
    key: "cylinder",
    label: "円柱（半径 a・高さ 2a）",
    volume: (a) => Math.PI * a * a * (2 * a),
    surface: (a) => 2 * Math.PI * a * a + 2 * Math.PI * a * (2 * a),
  },
  {
    key: "cone",
    label: "円錐（半径 a・高さ 2a）",
    volume: (a) => (Math.PI * a * a * (2 * a)) / 3,
    surface: (a) => Math.PI * a * a + Math.PI * a * Math.hypot(a, 2 * a),
  },
  {
    key: "pyramid",
    label: "正四角錐（底辺 a・高さ a）",
    volume: (a) => (a * a * a) / 3,
    surface: (a) => a * a + 2 * a * Math.hypot(a, a / 2),
  },
];

/** Exact ratios for a scale factor k. */
export const ratios = (k) => ({ length: k, area: k * k, volume: k ** 3 });

/** "4 : 9" for 2 : 3 — the way an exam answer is written. */
export function ratioText(p, q, power) {
  return `${p ** power} : ${q ** power}`;
}
