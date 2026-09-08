/**
 * 平方根と数直線（中3）。
 *
 * √2 は「1.41421356…」という文字列として覚えられがちですが、それは答えでは
 * なく答えの写しです。本当のところは 2 つあって、どちらも図で見えます。
 *
 *   1. √n は数直線上の決まった 1 点で、定規とコンパスで作図できる。
 *      テオドロスの渦巻き —— 直角をはさむ辺が √k と 1 の直角三角形の斜辺が
 *      √(k+1) —— を巻いていくと、√1, √2, √3, … が一度に全部手に入ります。
 *   2. その位置は、上と下から挟んでいくといくらでも細かく決まる。
 *      1 < √2 < 2、1.4 < √2 < 1.5、1.41 < √2 < 1.42 …… 一桁ずつ、
 *      幅がちょうど 1/10 になっていきます。
 */

/**
 * テオドロスの渦巻き。原点から k 番目の点までの距離がちょうど √k。
 *
 * P₁ = (1, 0) から始め、次の点は「いまの半径に垂直な向きへ 1 だけ進んだ先」。
 * 直角三角形の直角をはさむ辺が √k と 1 なので、斜辺は √(k+1) になります。
 */
export function spiral(n) {
  const pts = [[1, 0]];
  for (let k = 1; k < n; k++) {
    const [x, y] = pts[k - 1];
    const r = Math.hypot(x, y);
    // 半径に垂直な単位ベクトル（左回り）
    pts.push([x - y / r, y + x / r]);
  }
  return pts;
}

/** 渦巻きの k 番目の三角形: 原点・Pk・P(k+1)。直角は Pk のところ。 */
export function spiralTriangles(n) {
  const pts = spiral(n);
  const out = [];
  for (let k = 0; k + 1 < pts.length; k++) {
    out.push({ o: [0, 0], a: pts[k], b: pts[k + 1], leg: k + 1, hyp: k + 2 });
  }
  return out;
}

/**
 * 一桁ずつの挟み撃ち。
 *
 * 各段階で、二乗が n 以下になる最大の小数を下からの、その次を上からの
 * 見積もりにします。区間の幅は 1 → 0.1 → 0.01 と、ちょうど 1/10 ずつ。
 */
export function digitSqueeze(n, stages) {
  const out = [];
  let lo = 0;
  for (let s = 0; s <= stages; s++) {
    const step = Math.pow(10, -s);
    // この段階の刻みで、二乗が n を超えない最大の値
    let d = 0;
    while ((lo + (d + 1) * step) ** 2 <= n) d++;
    lo = lo + d * step;
    const hi = lo + step;
    out.push({
      stage: s,
      step,
      lo: round(lo, s),
      hi: round(hi, s),
      loSq: round(lo, s) ** 2,
      hiSq: round(hi, s) ** 2,
    });
  }
  return out;
}

/** 段階 s の刻み（10^-s）にきっちり丸める。浮動小数のごみを持ち越さない。 */
function round(v, s) {
  const f = Math.pow(10, s);
  return Math.round(v * f) / f;
}

/** 平方数なら整数、そうでなければ null。√n が有理数になるのはこの場合だけ。 */
export function perfectSquareRoot(n) {
  const r = Math.round(Math.sqrt(n));
  return r * r === n ? r : null;
}

/** √n を a√b（b は平方因数を持たない）の形に。√8 → 2√2。 */
export function simplifySurd(n) {
  let outside = 1;
  let inside = n;
  for (let d = 2; d * d <= inside; d++) {
    while (inside % (d * d) === 0) {
      inside /= d * d;
      outside *= d;
    }
  }
  return { outside, inside };
}

export const SURD_PRESETS = [2, 3, 5, 7, 8, 10, 12, 17];
