/**
 * Two proofs of a² + b² = c², both built so that every intermediate frame of
 * the animation is itself a valid step — nothing changes area at any point,
 * which is the whole content of the theorem.
 */

export function sides(a, b) {
  return { a, b, c: Math.hypot(a, b) };
}

/** Shoelace area, for checking that a stage really did preserve area. */
export function polyArea(poly) {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x0, y0] = poly[i];
    const [x1, y1] = poly[(i + 1) % poly.length];
    s += x0 * y1 - x1 * y0;
  }
  return Math.abs(s) / 2;
}

/* --------------------------------------- proof 1: sliding four triangles -- */

/**
 * Both arrangements live in the same (a+b) square. In one the four triangles
 * leave an a-square and a b-square behind; in the other they leave a single
 * tilted c-square. The triangles are paired so that each one only ever
 * translates — no rotation, no flip — so there is nowhere for area to hide.
 */
export function rearrangement(a, b) {
  const s = a + b;
  const start = [
    [[s, 0], [b, 0], [s, b]],
    [[b, b], [s, b], [b, 0]],
    [[0, b], [0, s], [b, b]],
    [[b, s], [b, b], [0, s]],
  ];
  const end = [
    [[s, 0], [b, 0], [s, b]],
    [[0, s], [a, s], [0, a]],
    [[0, 0], [0, a], [b, 0]],
    [[s, s], [s, b], [a, s]],
  ];
  const shift = start.map((tri, i) => [end[i][0][0] - tri[0][0], end[i][0][1] - tri[0][1]]);
  return {
    side: s,
    start,
    end,
    shift,
    // what is left uncovered in each arrangement
    squaresA: [
      { poly: [[0, 0], [b, 0], [b, b], [0, b]], label: "b²", area: b * b },
      { poly: [[b, b], [s, b], [s, s], [b, s]], label: "a²", area: a * a },
    ],
    squareB: {
      poly: [[b, 0], [s, b], [a, s], [0, a]],
      label: "c²",
      area: a * a + b * b,
    },
  };
}

/**
 * The four triangles part-way between the two arrangements.
 *
 * They are staggered: sliding all at once, they overlap each other in the
 * middle of the animation and it stops being obvious that nothing is being
 * added or removed. One at a time, each move can be followed.
 */
export function rearrangementAt(plan, t, stagger = 0.55) {
  const moving = plan.shift.filter((s) => s[0] !== 0 || s[1] !== 0).length;
  const span = 1 - stagger;
  let order = 0;
  return plan.start.map((tri, i) => {
    const still = plan.shift[i][0] === 0 && plan.shift[i][1] === 0;
    const start = still ? 0 : (stagger * order++) / Math.max(1, moving - 1);
    const ti = Math.max(0, Math.min(1, (t - start) / span));
    return tri.map(([x, y]) => [x + plan.shift[i][0] * ti, y + plan.shift[i][1] * ti]);
  });
}

/* ------------------------------------ proof 2: Euclid, by shearing twice -- */

/**
 * The hypotenuse lies flat, the c-square hangs below it, and the altitude
 * from C splits that square into two rectangles of area b² and a².
 *
 * Each leg-square reaches its rectangle in three area-preserving moves:
 * shear along its own base until its sides stand vertical, drop straight
 * down by c, then shear vertically until its slanted base lies flat on the
 * hypotenuse. Stage 1 keeps the base fixed and slides the far edge along
 * its own line; stage 3 slides points vertically. Both are shears, so the
 * area is not just preserved at the ends but at every moment in between.
 */
export function euclidStages(a, b) {
  const c = Math.hypot(a, b);
  const A = [0, 0];
  const B = [c, 0];
  const C = [(b * b) / c, (a * b) / c];
  const H = [(b * b) / c, 0];

  const add = (p, q) => [p[0] + q[0], p[1] + q[1]];
  const scale = (p, k) => [p[0] * k, p[1] * k];

  // outward normals, pointing away from the third vertex
  const nb = [-a / c, b / c];
  const na = [b / c, a / c];

  const bStages = [
    [A, C, add(C, scale(nb, b)), add(A, scale(nb, b))],
    [A, C, add(C, [0, c]), add(A, [0, c])],
    [add(A, [0, -c]), add(C, [0, -c]), C, A],
    [[0, -c], [H[0], -c], [H[0], 0], [0, 0]],
  ];
  const aStages = [
    [C, B, add(B, scale(na, a)), add(C, scale(na, a))],
    [C, B, add(B, [0, c]), add(C, [0, c])],
    [add(C, [0, -c]), add(B, [0, -c]), B, C],
    [[H[0], -c], [c, -c], [c, 0], [H[0], 0]],
  ];

  return {
    a,
    b,
    c,
    A,
    B,
    C,
    H,
    triangle: [A, B, C],
    cSquare: [[0, 0], [c, 0], [c, -c], [0, -c]],
    bStages,
    aStages,
    captions: [
      "脚の上の正方形。左が b²、右が a² です。",
      "① 底辺をおさえたまま、向かいの辺を自分の線に沿ってすべらせます（せん断）。高さが変わらないので面積はそのまま。",
      "② そのまま真下に c だけ平行移動。斜辺の正方形の中へ入ります。",
      "③ 縦方向にすべらせて、斜めの底辺を斜辺の上に寝かせます。2つの長方形がぴったり c² を埋めました。",
    ],
  };
}

/** Vertex-wise interpolation between consecutive stages; t in [0, 3]. */
export function stageAt(stages, t) {
  const clamped = Math.max(0, Math.min(stages.length - 1 - 1e-9, t));
  const i = Math.floor(clamped);
  const f = clamped - i;
  return stages[i].map((p, k) => [
    p[0] + (stages[i + 1][k][0] - p[0]) * f,
    p[1] + (stages[i + 1][k][1] - p[1]) * f,
  ]);
}
