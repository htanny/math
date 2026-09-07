/**
 * y = ax² のタブが画面に出す主張を、手で計算できる値と厳密な恒等式で確認する。
 *
 * とくに「変化の割合 = a(p+q)」は、定義どおりの差分商とは別経路で計算しているので、
 * 両者が一致することがそのまま検算になる。
 */
import {
  A_VALUES, LINE_PRESETS, discriminant, fy, intersections, rateFromDefinition,
  rateShortcut, secant, shoelace, tangentSlope, triangleArea,
} from "../src/quadratic.js";

let bad = 0;
const ok = (cond, what, got) => {
  if (cond) return;
  console.log(`  FAIL ${what}${got === undefined ? "" : ` — 実際: ${got}`}`);
  bad++;
};
const near = (a, b, tol, what) => ok(Math.abs(a - b) <= tol, `${what} ≈ ${b}`, a);

/* ------------------------------------------------------- 変化の割合 -- */
console.log("変化の割合");
{
  // 手で解ける例: y = x² の x = 1 から 3 まで → (9−1)/(3−1) = 4 = 1·(1+3)
  near(rateFromDefinition(1, 1, 3), 4, 1e-12, "y=x² の 1→3 の変化の割合");
  near(rateShortcut(1, 1, 3), 4, 1e-12, "a(p+q) も同じ");
  // y = 2x² の −1 から 2 まで → (8−2)/3 = 2 = 2·(−1+2)
  near(rateFromDefinition(2, -1, 2), 2, 1e-12, "y=2x² の −1→2");
  near(rateFromDefinition(-0.5, -2, 4), -1, 1e-12, "y=−0.5x² の −2→4");

  // 定義と近道が常に一致する（これがこのタブの中心的な主張）
  let worst = 0;
  for (const a of A_VALUES) {
    for (let i = 0; i < 400; i++) {
      const p = -6 + (12 * i) / 400;
      const q = p + 0.37 + (i % 7) * 0.21;
      worst = Math.max(worst, Math.abs(rateFromDefinition(a, p, q) - rateShortcut(a, p, q)));
    }
  }
  ok(worst < 1e-12, "定義どおりの差分商と a(p+q) が全域で一致", worst);
  console.log(`     定義 vs a(p+q) の最大差: ${worst.toExponential(2)}`);

  // 一次関数と違い、測る場所で値が変わる（変わらなければこのタブの意味がない）
  ok(rateFromDefinition(1, 0, 1) !== rateFromDefinition(1, 2, 3), "測る区間で値が変わる");

  // 割線は本当に両端を通る
  for (const [a, p, q] of [[1, 1, 3], [-2, -3, 0.5], [0.25, -1.5, 4]]) {
    const s = secant(a, p, q);
    near(s.slope * p + s.intercept, fy(a, p), 1e-12, `割線が (${p}, f(${p})) を通る`);
    near(s.slope * q + s.intercept, fy(a, q), 1e-12, `割線が (${q}, f(${q})) を通る`);
  }

  // q → p で割線は接線に近づく（高校の微分へのつながり）
  for (const [a, p] of [[1, 2], [-1.5, -0.5], [0.75, 3]]) {
    const far = rateFromDefinition(a, p, p + 1);
    const close = rateFromDefinition(a, p, p + 1e-6);
    const t = tangentSlope(a, p);
    ok(Math.abs(close - t) < Math.abs(far - t), `q→p で接線 2a·${p} に近づく (a=${a})`);
    near(close, t, 1e-5, `a=${a}, x=${p} の接線の傾き`);
  }
}

/* ------------------------------------------- 放物線と直線の交点 -- */
console.log("\n放物線と直線の交点");
{
  // 手で解ける定番: y = x² と y = x + 2 → x² − x − 2 = 0 → x = −1, 2
  const pts = intersections(1, 1, 2);
  ok(pts.length === 2, "交点は 2 個", pts.length);
  near(pts[0].x, -1, 1e-12, "左の交点の x");
  near(pts[1].x, 2, 1e-12, "右の交点の x");
  near(pts[0].y, 1, 1e-12, "左の交点の y");
  near(pts[1].y, 4, 1e-12, "右の交点の y");
  near(triangleArea(1, 1, 2), 3, 1e-12, "△OAB の面積");
  // ½|n||xA−xB| とは別経路の靴ひも公式で検算
  near(shoelace([{ x: 0, y: 0 }, pts[0], pts[1]]), 3, 1e-12, "靴ひも公式でも同じ面積");

  // D の符号と交点の個数が食い違わないこと
  // a<0 の例: −x² = x − 2 → x² + x − 2 = 0 → x = −2, 1、D = 1 + 4(−1)(−2) = 9
  const cases = [[1, 2, -1, 0, 1], [1, 1, -1, -3, 0], [1, 1, 2, 9, 2], [-1, 1, -2, 9, 2]];
  for (const [a, m, n, wantD, wantCount] of cases) {
    near(discriminant(a, m, n), wantD, 1e-12, `D(a=${a}, m=${m}, n=${n})`);
    ok(intersections(a, m, n).length === wantCount,
      `a=${a}, m=${m}, n=${n} の交点は ${wantCount} 個`, intersections(a, m, n).length);
  }

  // 交点はどちらの式も満たしていなければならない
  let worst = 0;
  for (const a of A_VALUES) {
    for (let i = 0; i < 60; i++) {
      const m = -4 + i * 0.13;
      const n = -3 + ((i * 7) % 40) * 0.2;
      for (const p of intersections(a, m, n)) {
        worst = Math.max(worst, Math.abs(fy(a, p.x) - p.y), Math.abs(m * p.x + n - p.y));
      }
    }
  }
  ok(worst < 1e-9, "交点は放物線の上にも直線の上にもある", worst);
  console.log(`     両方の式からのずれの最大: ${worst.toExponential(2)}`);

  // 面積の 2 通りの求め方が常に一致する
  let areaGap = 0;
  for (const a of A_VALUES) {
    for (let i = 0; i < 60; i++) {
      const m = -3 + i * 0.11;
      const n = 0.2 + (i % 20) * 0.3;
      const pts2 = intersections(a, m, n);
      if (pts2.length < 2) continue;
      areaGap = Math.max(areaGap,
        Math.abs(triangleArea(a, m, n) - shoelace([{ x: 0, y: 0 }, pts2[0], pts2[1]])));
    }
  }
  ok(areaGap < 1e-9, "½|n||xA−xB| と靴ひも公式が一致", areaGap);
  console.log(`     面積の 2 通りの差の最大: ${areaGap.toExponential(2)}`);

  ok(triangleArea(1, 1, -1) === null, "交点がなければ面積は出さない");
  ok(triangleArea(1, 2, -1) === null, "接するだけなら三角形にならない");
}

/* ------------------------------------------------------------ 設定値 -- */
console.log("\nプリセットと選べる a");
ok(!A_VALUES.includes(0), "a に 0 を含まない（y = 0x² は放物線ではない）");
ok(A_VALUES.every((a, i) => i === 0 || a > A_VALUES[i - 1]), "a の並びが昇順");
ok(A_VALUES.some((a) => a < 0) && A_VALUES.some((a) => a > 0), "上に凸と下に凸の両方が選べる");
for (const p of LINE_PRESETS) {
  ok(A_VALUES.includes(p.a), `プリセット「${p.label}」の a が選択肢にある`, p.a);
  const d = discriminant(p.a, p.m, p.n);
  const count = intersections(p.a, p.m, p.n).length;
  ok(count === (d > 0 ? 2 : d === 0 ? 1 : 0), `「${p.label}」の D と交点数が整合`, `D=${d}, ${count}個`);
  console.log(`     ${p.label.padEnd(20)} D=${d} 交点=${count}個`);
}
ok(new Set(LINE_PRESETS.map((p) => p.key)).size === LINE_PRESETS.length, "プリセットの key が一意");
ok(LINE_PRESETS.some((p) => intersections(p.a, p.m, p.n).length === 2)
  && LINE_PRESETS.some((p) => intersections(p.a, p.m, p.n).length === 1)
  && LINE_PRESETS.some((p) => intersections(p.a, p.m, p.n).length === 0),
  "2個・1個・0個の例がそろっている");

console.log(bad === 0 ? "\nすべて一致しました。" : `\n${bad} 件の不一致`);
process.exit(bad === 0 ? 0 : 1);
