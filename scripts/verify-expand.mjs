/**
 * 展開と因数分解のタブが図と表で主張することを確かめる。
 *
 * かなめは「4 枚のタイルの面積の合計が、長方形全体の面積と等しい」こと。
 * これが成り立てば展開の式はその読み替えにすぎず、因数分解は同じ絵を
 * 逆から見ただけになります。だから式どうしを比べるのではなく、実際に
 * 面積を足して (x+a)(x+b) と突き合わせます。
 */
import {
  FACTOR_PRESETS, PATTERNS, candidateTable, cutAndMove, expandCoefs, factorPairs,
  factorQuadratic, factoredString, quadraticString, tiles,
} from "../src/expand.js";

let bad = 0;
const ok = (cond, what, got) => {
  if (cond) return;
  console.log(`  FAIL ${what}${got === undefined ? "" : ` — 実際: ${got}`}`);
  bad++;
};
const near = (a, b, tol, what) => ok(Math.abs(a - b) <= tol, `${what} ≈ ${b}`, a);

/* --------------------------------------------------------- タイルの面積 -- */
console.log("4 枚のタイルを足すと長方形になるか");
{
  let worst = 0;
  let count = 0;
  for (let a = -5; a <= 5; a++) {
    for (let b = -5; b <= 5; b++) {
      for (const x of [0.5, 1, 2, 3.7, 10]) {
        const sum = tiles(a, b).reduce((s, t) => s + t.wv(x) * t.hv(x), 0);
        worst = Math.max(worst, Math.abs(sum - (x + a) * (x + b)));
        count++;
      }
    }
  }
  ok(worst < 1e-9, "タイルの面積の合計 = (x+a)(x+b)", worst);
  console.log(`     ${count} 通りで確認、ずれの最大 ${worst.toExponential(2)}`);

  // 展開した式とも一致する（x² + px + q の形）
  let poly = 0;
  for (let a = -5; a <= 5; a++) {
    for (let b = -5; b <= 5; b++) {
      const { p, q } = expandCoefs(a, b);
      for (const x of [0.5, 1, 2, 3.7, 10]) {
        poly = Math.max(poly, Math.abs((x + a) * (x + b) - (x * x + p * x + q)));
      }
    }
  }
  ok(poly < 1e-9, "(x+a)(x+b) = x² + (a+b)x + ab", poly);

  // タイルは 4 枚で、辺の意味も合っている
  const t = tiles(2, 3);
  ok(t.length === 4, "タイルは 4 枚", t.length);
  ok(t.map((v) => v.term).join(" + ") === "x² + 3x + 2x + 6",
    "2 と 3 のときの 4 項", t.map((v) => v.term).join(" + "));
  near(t[0].wv(7) * t[0].hv(7), 49, 1e-12, "x=7 での x² タイル");
  near(t[3].wv(7) * t[3].hv(7), 6, 1e-12, "角のタイルは x によらず ab");
}

/* --------------------------------------------------------------- 表示 -- */
console.log("\n式の書き方");
{
  const cases = [
    [5, 6, "x² + 5x + 6"], [-5, 6, "x² − 5x + 6"], [1, -6, "x² + x − 6"],
    [-1, -6, "x² − x − 6"], [0, -9, "x² − 9"], [6, 9, "x² + 6x + 9"],
    [0, 0, "x²"], [2, 0, "x² + 2x"],
  ];
  for (const [p, q, want] of cases) {
    ok(quadraticString(p, q) === want, `p=${p}, q=${q} → ${want}`, quadraticString(p, q));
  }
  const f = [
    [2, 3, "(x + 2)(x + 3)"], [-2, -3, "(x − 2)(x − 3)"],
    [3, -2, "(x + 3)(x − 2)"], [3, 3, "(x + 3)(x + 3)"],
  ];
  for (const [a, b, want] of f) {
    ok(factoredString(a, b) === want, `a=${a}, b=${b} → ${want}`, factoredString(a, b));
  }
}

/* ----------------------------------------------------------- 因数分解 -- */
console.log("\n因数分解: たして p、かけて q");
{
  // 割り切れる組はすべて、展開すると元に戻る
  let checked = 0;
  for (let p = -12; p <= 12; p++) {
    for (let q = -30; q <= 30; q++) {
      const r = factorQuadratic(p, q);
      if (!r) continue;
      ok(r.a + r.b === p, `p=${p}, q=${q}: たして ${p}`, r.a + r.b);
      ok(r.a * r.b === q, `p=${p}, q=${q}: かけて ${q}`, r.a * r.b);
      // 展開して戻ることを、値でも確かめる
      for (const x of [1, 2, 5.5, -3]) {
        near((x + r.a) * (x + r.b), x * x + p * x + q, 1e-9,
          `p=${p}, q=${q} を展開して戻す (x=${x})`);
      }
      checked++;
    }
  }
  console.log(`     整数に分解できた ${checked} 通りすべてが、展開すると元に戻る`);

  // 分解できないものは、本当にできない（総当たりで確認）
  let noneOk = 0;
  for (let p = -12; p <= 12; p++) {
    for (let q = -30; q <= 30; q++) {
      if (factorQuadratic(p, q)) continue;
      let found = null;
      for (let a = -40; a <= 40; a++) {
        for (let b = -40; b <= 40; b++) {
          if (a + b === p && a * b === q) found = [a, b];
        }
      }
      ok(found === null, `p=${p}, q=${q} は分解できないはず`, found && found.join(","));
      noneOk++;
    }
  }
  console.log(`     分解できないと判定した ${noneOk} 通りも、総当たりで組が存在しない`);

  // 手で解ける定番
  const known = [[5, 6, 2, 3], [7, 12, 3, 4], [-5, 6, -3, -2], [1, -6, -2, 3], [6, 9, 3, 3], [0, -9, -3, 3]];
  for (const [p, q, a, b] of known) {
    const r = factorQuadratic(p, q);
    ok(r !== null, `x²+${p}x+${q} は分解できる`);
    ok(new Set([r.a, r.b]).size === new Set([a, b]).size
      && [r.a, r.b].sort((u, v) => u - v).join() === [a, b].sort((u, v) => u - v).join(),
      `x² + ${p}x + ${q} → ${a} と ${b}`, `${r.a} と ${r.b}`);
  }
  ok(factorQuadratic(3, 5) === null, "x² + 3x + 5 は整数では分解できない");
}

/* ------------------------------------------------------------ 候補の表 -- */
console.log("\n候補の表");
{
  const rows = candidateTable(5, 6);
  ok(rows.every((r) => r.a * r.b === 6), "どの行もかけて 6");
  ok(rows.filter((r) => r.hit).length === 1, "当たりはちょうど 1 行",
    rows.filter((r) => r.hit).length);
  const hit = rows.find((r) => r.hit);
  ok(hit.a + hit.b === 5, "当たりの行はたして 5");
  // 同じ組を 2 度出さない
  for (const [p, q] of [[5, 6], [1, -6], [0, -9], [7, 12], [-5, 6]]) {
    const t = candidateTable(p, q);
    const keys = t.map((r) => [r.a, r.b].sort((u, v) => u - v).join(","));
    ok(new Set(keys).size === keys.length, `p=${p}, q=${q}: 重複した組がない`, keys.length);
    ok(t.every((r) => r.a * r.b === q), `p=${p}, q=${q}: どの行もかけて ${q}`);
    ok(t.filter((r) => r.hit).length <= 1, `p=${p}, q=${q}: 当たりは多くても 1 行`);
  }
  ok(candidateTable(3, 5).every((r) => !r.hit), "x²+3x+5 には当たりがない");
  ok(factorPairs(0).length === 0, "factorPairs(0) は空（探す対象ではない）");
  // 定数項がないときは、探索ではなく共通因数でくくる
  for (const p2 of [-7, -1, 0, 1, 5, 12]) {
    const r = factorQuadratic(p2, 0);
    ok(r !== null && r.a === 0 && r.b === p2, `x² + ${p2}x は x(x + ${p2})`, r && `${r.a},${r.b}`);
    const t2 = candidateTable(p2, 0);
    ok(t2.length === 1 && t2[0].hit, `p=${p2}, q=0 の表は 1 行だけ`, t2.length);
  }
  console.log(`     かけて 6 の組: ${rows.map((r) => `(${r.a},${r.b})`).join(" ")}`);
}

/* ------------------------------------------------------- 切って移す図 -- */
console.log("\n和と差の積: 切って移しても面積が変わらないか");
{
  let worstArea = 0;
  let worstPieces = 0;
  let count = 0;
  for (const x of [2, 3, 4.5, 6, 8]) {
    for (let a = 1; a < x; a += 0.5) {
      const cm = cutAndMove(x, a);
      // L 字の面積 = 切った 2 枚の合計
      const pieces = cm.bottom.w * cm.bottom.h + cm.top.w * cm.top.h;
      worstPieces = Math.max(worstPieces, Math.abs(pieces - cm.lShapeArea));
      // L 字の面積 = 組みかえた長方形の面積
      worstArea = Math.max(worstArea,
        Math.abs(cm.rectangle.w * cm.rectangle.h - cm.lShapeArea));
      // 移した先の大きさが、上の部分を 90° 回したものと一致する
      ok(Math.abs(cm.movedTo.w - cm.top.h) < 1e-12 && Math.abs(cm.movedTo.h - cm.top.w) < 1e-12,
        `x=${x}, a=${a}: 回したあとの縦横が入れ替わっている`);
      // 出来上がりは (x+a) × (x−a)
      near(cm.rectangle.w, x + a, 1e-12, `x=${x}, a=${a}: よこ`);
      near(cm.rectangle.h, x - a, 1e-12, `x=${x}, a=${a}: たて`);
      near(cm.lShapeArea, x * x - a * a, 1e-12, `x=${x}, a=${a}: L 字の面積`);
      count++;
    }
  }
  ok(worstPieces < 1e-12, "切った 2 枚の合計 = L 字の面積", worstPieces);
  ok(worstArea < 1e-12, "組みかえた長方形 = L 字の面積（＝ x²−a² = (x+a)(x−a)）", worstArea);
  console.log(`     ${count} 通りで確認、面積のずれの最大 ${worstArea.toExponential(2)}`);
}

/* ----------------------------------------------------- プリセットの整合 -- */
console.log("\nプリセット");
for (const pat of PATTERNS) {
  ok(pat.a >= 0 && pat.b >= 0, `「${pat.label}」の辺は 0 以上（負の長さは描けない）`,
    `${pat.a}, ${pat.b}`);
  ok(pat.mode === "tiles" || pat.mode === "diff", `「${pat.label}」の描き方が決まっている`, pat.mode);
  if (pat.mode !== "tiles") continue;
  const { p, q } = expandCoefs(pat.a, pat.b);
  ok(factorQuadratic(p, q) !== null, `「${pat.label}」は分解して戻せる`);
  console.log(`     ${pat.label.padEnd(24)} ${factoredString(pat.a, pat.b)} = ${quadraticString(p, q)}`);
}
ok(PATTERNS.find((p) => p.key === "square").a === PATTERNS.find((p) => p.key === "square").b,
  "和の平方は a = b");
ok(PATTERNS.find((p) => p.key === "diff").mode === "diff",
  "和と差の積は切って移す図で扱う");
ok(expandCoefs(3, -3).p === 0, "式の上では、和と差の積で真ん中が消える", expandCoefs(3, -3).p);
for (const pre of FACTOR_PRESETS) {
  const r = factorQuadratic(pre.p, pre.q);
  const label = quadraticString(pre.p, pre.q);
  ok(pre.p === 3 && pre.q === 5 ? r === null : r !== null,
    `プリセット ${label} の分解可否`, r && `${r.a},${r.b}`);
  console.log(`     ${label.padEnd(16)} → ${r ? factoredString(r.a, r.b) : "整数では分解できない"}`);
}

console.log(bad === 0 ? "\nすべて一致しました。" : `\n${bad} 件の不一致`);
process.exit(bad === 0 ? 0 : 1);
