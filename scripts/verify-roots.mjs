/**
 * 平方根タブが図と表で主張することを確かめる。
 *
 * 渦巻きについては「k 番目の点までの距離が √k」が主張のすべてなので、
 * 実際に距離を測って √k と比べる。三角形の直角も内積で確認する。
 * 挟み撃ちは、区間が本当に √n を挟んでいることと、幅がちょうど 1/10 ずつ
 * 縮むことを見る（Math.sqrt は答え合わせにだけ使い、生成には使わない）。
 */
import {
  SURD_PRESETS, digitSqueeze, perfectSquareRoot, simplifySurd, spiral, spiralTriangles,
} from "../src/roots.js";

let bad = 0;
const ok = (cond, what, got) => {
  if (cond) return;
  console.log(`  FAIL ${what}${got === undefined ? "" : ` — 実際: ${got}`}`);
  bad++;
};
const near = (a, b, tol, what) => ok(Math.abs(a - b) <= tol, `${what} ≈ ${b}`, a);

/* ------------------------------------------------------ テオドロスの渦巻き -- */
console.log("テオドロスの渦巻き: k 番目の点までの距離が √k か");
{
  const N = 40;
  const pts = spiral(N);
  ok(pts.length === N, `点は ${N} 個`, pts.length);

  let worst = 0;
  for (let k = 0; k < pts.length; k++) {
    const r = Math.hypot(...pts[k]);
    worst = Math.max(worst, Math.abs(r - Math.sqrt(k + 1)));
  }
  ok(worst < 1e-12, "どの点も原点からの距離が √k", worst);
  console.log(`     √1〜√${N} までの距離のずれの最大: ${worst.toExponential(2)}`);

  // 手で追える最初の数個
  near(Math.hypot(...pts[0]), 1, 1e-15, "1 番目は √1 = 1");
  near(Math.hypot(...pts[1]), Math.SQRT2, 1e-15, "2 番目は √2");
  near(Math.hypot(...pts[3]), 2, 1e-14, "4 番目は √4 = 2（ぴったり整数）");
  near(Math.hypot(...pts[8]), 3, 1e-13, "9 番目は √9 = 3");

  // 各三角形は、直角をはさむ辺が √k と 1 の直角三角形
  const tris = spiralTriangles(N);
  ok(tris.length === N - 1, `三角形は ${N - 1} 個`, tris.length);
  let rightAngle = 0;
  let unitLeg = 0;
  let legLen = 0;
  for (const t of tris) {
    // 直角は Pk のところ: ベクトル Pk→O と Pk→P(k+1) が直交する
    const u = [t.o[0] - t.a[0], t.o[1] - t.a[1]];
    const v = [t.b[0] - t.a[0], t.b[1] - t.a[1]];
    rightAngle = Math.max(rightAngle, Math.abs(u[0] * v[0] + u[1] * v[1]));
    unitLeg = Math.max(unitLeg, Math.abs(Math.hypot(...v) - 1));
    legLen = Math.max(legLen, Math.abs(Math.hypot(...t.a) - Math.sqrt(t.leg)));
  }
  ok(rightAngle < 1e-12, "どの三角形も Pk のところが直角", rightAngle);
  ok(unitLeg < 1e-12, "外側の辺の長さはつねに 1", unitLeg);
  ok(legLen < 1e-12, "内側の辺は √k", legLen);
  console.log(`     直角のずれ ${rightAngle.toExponential(1)} / 辺 1 のずれ ${unitLeg.toExponential(1)}`);

  // 三平方の定理: √k と 1 の直角三角形の斜辺は √(k+1)
  let pyth = 0;
  for (const t of tris) {
    pyth = Math.max(pyth, Math.abs(Math.hypot(...t.b) ** 2 - (t.leg + 1)));
  }
  ok(pyth < 1e-12, "斜辺の 2 乗が k+1（＝渦巻きが成り立つ理由）", pyth);
}

/* ---------------------------------------------------------- 挟み撃ち -- */
console.log("\n一桁ずつの挟み撃ち");
{
  for (const n of [2, 3, 5, 7, 10, 17, 40, 99]) {
    const rows = digitSqueeze(n, 6);
    const r = Math.sqrt(n);
    ok(rows.length === 7, `n=${n}: 段階は 7 行`, rows.length);
    for (const row of rows) {
      ok(row.lo <= r && r < row.hi, `n=${n} 段階${row.stage}: ${row.lo} ≤ √${n} < ${row.hi}`);
      ok(row.loSq <= n, `n=${n} 段階${row.stage}: 下の 2 乗が n 以下`, row.loSq);
      ok(row.hiSq > n, `n=${n} 段階${row.stage}: 上の 2 乗が n より大きい`, row.hiSq);
      near(row.hi - row.lo, row.step, 1e-12, `n=${n} 段階${row.stage}: 区間の幅`);
    }
    // 幅がちょうど 1/10 ずつ縮む
    for (let i = 1; i < rows.length; i++) {
      near(rows[i].step * 10, rows[i - 1].step, 1e-15, `n=${n}: 幅が 1/10 になる`);
      ok(rows[i].lo >= rows[i - 1].lo, `n=${n}: 下からの見積もりは下がらない`);
      ok(rows[i].hi <= rows[i - 1].hi, `n=${n}: 上からの見積もりは上がらない`);
    }
  }
  // 教科書に載っている値
  const two = digitSqueeze(2, 5).map((r) => r.lo);
  ok(two.join(",") === "1,1.4,1.41,1.414,1.4142,1.41421",
    "√2 は 1, 1.4, 1.41, 1.414, 1.4142, 1.41421 と決まっていく", two.join(","));
  // 値で比べる。1.7320 は数値としては 1.732 なので、桁を見せるのは表示側の仕事
  const three = digitSqueeze(3, 4);
  const wantThree = [1, 1.7, 1.73, 1.732, 1.732];
  for (let i = 0; i < wantThree.length; i++) {
    near(three[i].lo, wantThree[i], 1e-15, `√3 の段階${i} の下からの見積もり`);
    ok(three[i].lo.toFixed(i) === wantThree[i].toFixed(i),
      `√3 の段階${i} は ${wantThree[i].toFixed(i)} と表示される`, three[i].lo.toFixed(i));
  }
  console.log(`     √2: ${two.join(" → ")}`);
  console.log(`     √3: ${three.map((r) => r.lo.toFixed(r.stage)).join(" → ")}`);

  // 平方数はぴったり止まる
  for (const n of [4, 9, 16, 25]) {
    const rows = digitSqueeze(n, 3);
    near(rows[0].lo, Math.sqrt(n), 1e-15, `n=${n} は最初の段階で整数`);
    for (const row of rows) near(row.lo, Math.sqrt(n), 1e-12, `n=${n} 段階${row.stage} は動かない`);
  }
}

/* ------------------------------------------------------ 有理数かどうか -- */
console.log("\n√n が整数になるのは平方数のときだけ");
{
  const squares = new Set([1, 4, 9, 16, 25, 36, 49, 64, 81, 100]);
  for (let n = 1; n <= 100; n++) {
    const r = perfectSquareRoot(n);
    ok((r !== null) === squares.has(n), `n=${n} の判定`, r);
    if (r !== null) ok(r * r === n, `√${n} = ${r}`);
  }
  console.log("     1〜100 で判定が一致");
}

/* ---------------------------------------------------------- a√b の形 -- */
console.log("\na√b の形に直す");
{
  const cases = [[8, 2, 2], [12, 2, 3], [18, 3, 2], [50, 5, 2], [2, 1, 2],
                 [72, 6, 2], [45, 3, 5], [100, 10, 1], [17, 1, 17]];
  for (const [n, outside, inside] of cases) {
    const s = simplifySurd(n);
    ok(s.outside === outside && s.inside === inside,
      `√${n} = ${outside}√${inside}`, `${s.outside}√${s.inside}`);
    near(s.outside * Math.sqrt(s.inside), Math.sqrt(n), 1e-12, `√${n} の値が変わらない`);
  }
  // 1〜200 すべてで、値が保たれ、中身に平方因数が残っていない
  let worst = 0;
  for (let n = 1; n <= 200; n++) {
    const s = simplifySurd(n);
    worst = Math.max(worst, Math.abs(s.outside * Math.sqrt(s.inside) - Math.sqrt(n)));
    for (let d = 2; d * d <= s.inside; d++) {
      ok(s.inside % (d * d) !== 0, `√${n} の中身に ${d}² が残っている`, s.inside);
    }
  }
  ok(worst < 1e-12, "1〜200 で値が保たれる", worst);
  console.log(`     √8=2√2、√12=2√3、√50=5√2。1〜200 で値のずれ最大 ${worst.toExponential(1)}`);
  for (const n of SURD_PRESETS) ok(n >= 2, `プリセット ${n} は 2 以上`);
}

console.log(bad === 0 ? "\nすべて一致しました。" : `\n${bad} 件の不一致`);
process.exit(bad === 0 ? 0 : 1);
