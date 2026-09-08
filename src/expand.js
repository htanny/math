/**
 * 展開と因数分解を、長方形の面積として見る（中3）。
 *
 * (x + a)(x + b) = x² + (a + b)x + ab は、たてが x + a、よこが x + b の
 * 長方形を 4 つに切ったもの、というだけの話です。x² と ab が向かい合い、
 * ax と bx が残り —— 真ん中の係数が a + b になるのは、その 2 枚がどちらも
 * たて（またはよこ）が x だからです。
 *
 * 因数分解はその逆で、「面積 x² + px + q の長方形を組み直す」＝
 * 「たして p、かけて q になる 2 数を探す」。同じ絵を逆から見ています。
 */

/** 展開した 4 枚のタイル。w・h は辺の意味、area は係数つきの項。 */
export function tiles(a, b) {
  return [
    { key: "xx", w: "x", h: "x", coef: 1, term: "x²", wv: (x) => x, hv: (x) => x },
    { key: "bx", w: String(b), h: "x", coef: b, term: `${b}x`, wv: () => b, hv: (x) => x },
    { key: "ax", w: "x", h: String(a), coef: a, term: `${a}x`, wv: (x) => x, hv: () => a },
    { key: "ab", w: String(b), h: String(a), coef: a * b, term: String(a * b), wv: () => b, hv: () => a },
  ];
}

/** 展開の結果の係数: x² + px + q。 */
export const expandCoefs = (a, b) => ({ p: a + b, q: a * b });

/** "x² + 5x + 6" のような表示。0 の項は落とし、負は − で書く。 */
export function quadraticString(p, q) {
  const term = (c, suffix) => {
    if (c === 0) return "";
    const sign = c < 0 ? " − " : " + ";
    const mag = Math.abs(c);
    const body = suffix === "x" && mag === 1 ? "x" : `${mag}${suffix}`;
    return sign + body;
  };
  return `x²${term(p, "x")}${term(q, "")}`;
}

/** "(x + 2)(x + 3)"。負のときは (x − 2) と書く。 */
export function factoredString(a, b) {
  const f = (v) => (v < 0 ? `(x − ${-v})` : v === 0 ? "x" : `(x + ${v})`);
  return `${f(a)}${f(b)}`;
}

/**
 * q の約数の組をすべて（負も含む）。因数分解で「かけて q」を探す道具。
 *
 * q = 0 のときは空。0 をかけて 0 になる組は無数にあり、探す対象ではなく、
 * 「x が共通因数だから x でくくる」という別の話になるためです（下で別扱い）。
 */
export function factorPairs(q) {
  if (q === 0) return [];
  const out = [];
  const limit = Math.abs(q);
  for (let d = 1; d <= limit; d++) {
    if (q % d !== 0) continue;
    out.push([d, q / d]);
    out.push([-d, -(q / d)]);
  }
  return out;
}

/**
 * x² + px + q を (x + a)(x + b) に。整数で割り切れなければ null。
 *
 * 「かけて q」の組を並べ、そのなかから「たして p」のものを選びます。
 * 教室でやる手順そのままなので、候補を全部返して表に出せます。
 */
export function factorQuadratic(p, q) {
  // 定数項がなければ x でくくるだけ: x² + px = x(x + p)
  if (q === 0) return { a: 0, b: p };
  for (const [a, b] of factorPairs(q)) {
    if (a + b === p) return { a, b };
  }
  return null;
}

/** 候補の表: かけて q になる組と、その和。 */
export function candidateTable(p, q) {
  // 定数項がないときは探すまでもない。共通因数の x でくくって終わり。
  if (q === 0) return [{ a: 0, b: p, sum: p, hit: true }];
  const seen = new Set();
  const rows = [];
  for (const [a, b] of factorPairs(q)) {
    const key = [a, b].sort((u, v) => u - v).join(",");
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({ a, b, sum: a + b, hit: a + b === p });
  }
  return rows.sort((u, v) => u.a - v.a);
}

/**
 * 和と差の積を、切って移す形で。
 *
 * x² から a² を取り除くと L 字が残ります。これを高さ x − a のところで切り、
 * 上の (x − a) × a を 90° 回して右へつけると、(x + a) × (x − a) の長方形に
 * なります。面積は動かしていないので、x² − a² = (x + a)(x − a)。
 *
 * 負の長さは描けないので、この形だけは 4 枚のタイルではなくこの図で扱います。
 */
export function cutAndMove(x, a) {
  return {
    lShapeArea: x * x - a * a,
    bottom: { w: x, h: x - a },
    top: { w: x - a, h: a },
    // 回したあとの置き場所: 下の長方形の右側
    movedTo: { x, y: 0, w: a, h: x - a },
    rectangle: { w: x + a, h: x - a },
  };
}

export const PATTERNS = [
  {
    key: "general",
    label: "(x + a)(x + b)",
    mode: "tiles",
    a: 2,
    b: 3,
    note:
      "4 枚のうち ax と bx はどちらも辺の片方が x なので、合わせると (a + b)x。" +
      "真ん中の係数が和になるのはこのためです。",
  },
  {
    key: "square",
    label: "(x + a)² — 和の平方",
    mode: "tiles",
    a: 3,
    b: 3,
    note:
      "a = b にすると正方形になり、細長い 2 枚が合同になります。だから真ん中は 2ax。" +
      "角の小さな正方形が a² です。",
  },
  {
    key: "diff",
    label: "(x + a)(x − a) — 和と差の積",
    mode: "diff",
    a: 3,
    b: 3,
    note:
      "こちらだけは 4 枚に切る図が使えません。−a は長さとして描けないからです。" +
      "代わりに、x² から a² を取り除いた L 字を切って組みかえます。" +
      "面積は動かしていないので、x² − a² = (x + a)(x − a)。",
  },
];

export const FACTOR_PRESETS = [
  { p: 5, q: 6, note: "たして 5、かけて 6 → 2 と 3。" },
  { p: 7, q: 12, note: "たして 7、かけて 12 → 3 と 4。" },
  { p: -5, q: 6, note: "かけて正、たして負なので、2 数はどちらも負。−2 と −3。" },
  { p: 1, q: -6, note: "かけて負なので符号が違います。3 と −2。" },
  { p: 6, q: 9, note: "3 と 3。(x + 3)² の形になります。" },
  { p: 0, q: -9, note: "たして 0 → 3 と −3。(x + 3)(x − 3)、和と差の積です。" },
  { p: 5, q: 0, note: "定数項がないので探すまでもなく、共通因数の x でくくって x(x + 5)。" },
  { p: 3, q: 5, note: "かけて 5 になるのは 1×5 と (−1)×(−5) だけ。和は 6 か −6 で、3 になりません。" },
];
