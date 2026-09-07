/**
 * 「長さ k 倍 → 面積 k² 倍 → 体積 k³ 倍」を、規則を使わずに確かめる。
 *
 * ピースの枚数を数えるのではなく、敷き詰めたピースの面積を実際に合計して、
 * 拡大した図形の面積（靴ひも公式で別に求めたもの）と一致するかを見る。
 * ピースが合同であることも、辺の長さの多重集合で確認する。
 */
import {
  BOXES, FIGURES, SOLIDS, boxSurface, boxVolume, polyArea, ratioText, ratios,
  scalePoly, sideLengths, tileBox,
} from "../src/similar.js";

let bad = 0;
const ok = (cond, what, got) => {
  if (cond) return;
  console.log(`  FAIL ${what}${got === undefined ? "" : ` — 実際: ${got}`}`);
  bad++;
};
const near = (a, b, tol, what) => ok(Math.abs(a - b) <= tol, `${what} ≈ ${b}`, a);

/* ------------------------------------------------------------ 平面図形 -- */
console.log("平面: 拡大した図形は、もとの図形 k² 個で敷き詰められるか");
for (const fig of FIGURES) {
  const base = polyArea(fig.poly);
  const baseSides = sideLengths(fig.poly);
  console.log(`\n--- ${fig.label}（もとの面積 ${base.toFixed(4)}）---`);
  for (let k = 1; k <= 6; k++) {
    const big = scalePoly(fig.poly, k);
    const bigArea = polyArea(big); // 靴ひも公式で直接。k² 倍という規則は使わない
    const pieces = fig.tile(big, k);

    ok(pieces.length === k * k, `k=${k}: ピースは k²=${k * k} 個`, pieces.length);

    // ピースの面積の合計が、拡大した図形の面積と一致する（＝隙間も重なりもない）
    const sum = pieces.reduce((s, p) => s + polyArea(p.poly), 0);
    near(sum, bigArea, 1e-9, `k=${k}: ピースの面積の合計`);

    // 面積比が k² であることは、上の 2 つから出る結論
    near(bigArea / base, k * k, 1e-9, `k=${k}: 面積比`);

    // ピースはすべて、もとの図形と合同
    let worst = 0;
    for (const p of pieces) {
      const s = sideLengths(p.poly);
      ok(s.length === baseSides.length, `k=${k}: ピースの辺の数`);
      for (let i = 0; i < s.length; i++) worst = Math.max(worst, Math.abs(s[i] - baseSides[i]));
    }
    ok(worst < 1e-9, `k=${k}: どのピースももとの図形と合同`, worst);
  }
  // 三角形だけは上向きと下向きに分かれる
  if (fig.key === "triangle") {
    for (let k = 1; k <= 6; k++) {
      const pieces = fig.tile(scalePoly(fig.poly, k), k);
      const up = pieces.filter((p) => !p.flipped).length;
      const down = pieces.filter((p) => p.flipped).length;
      ok(up === (k * (k + 1)) / 2, `k=${k}: 上向き k(k+1)/2 個`, up);
      ok(down === (k * (k - 1)) / 2, `k=${k}: 下向き k(k−1)/2 個`, down);
      ok(up + down === k * k, `k=${k}: 合計 k²`);
    }
    console.log("     上向き k(k+1)/2 + 下向き k(k−1)/2 = k² を k=1..6 で確認");
  }
}

/* -------------------------------------------------------------- 立体 -- */
console.log("\n\n立体: 拡大した立体は、もとの立体 k³ 個でできているか");
for (const box of BOXES) {
  const v = boxVolume(box.dims);
  const s = boxSurface(box.dims);
  console.log(`\n--- ${box.label}（体積 ${v.toFixed(4)} / 表面積 ${s.toFixed(4)}）---`);
  for (let k = 1; k <= 5; k++) {
    const cells = tileBox(box.dims, k);
    ok(cells.length === k ** 3, `k=${k}: ピースは k³=${k ** 3} 個`, cells.length);
    near(cells.length * v, boxVolume(box.dims.map((d) => d * k)), 1e-9,
      `k=${k}: ピースの体積の合計`);
    near(boxVolume(box.dims.map((d) => d * k)) / v, k ** 3, 1e-9, `k=${k}: 体積比`);
    near(boxSurface(box.dims.map((d) => d * k)) / s, k * k, 1e-9, `k=${k}: 表面積比`);

    // 隙間なく詰まっているか（重複した位置がないか）
    const seen = new Set(cells.map((c) => c.at.map((x) => x.toFixed(6)).join(",")));
    ok(seen.size === cells.length, `k=${k}: 同じ位置に 2 個置いていない`, seen.size);
  }
}

/* ---------------------------------------- 箱以外でも同じ比になること -- */
console.log("\n\nこの規則は箱に限らない（それぞれの公式から直接）");
for (const solid of SOLIDS) {
  let worstV = 0;
  let worstS = 0;
  for (const k of [1.5, 2, 2.5, 3, 4, 7]) {
    worstV = Math.max(worstV, Math.abs(solid.volume(k) / solid.volume(1) - k ** 3));
    worstS = Math.max(worstS, Math.abs(solid.surface(k) / solid.surface(1) - k * k));
  }
  ok(worstV < 1e-9, `${solid.label}: 体積比が k³`, worstV);
  ok(worstS < 1e-9, `${solid.label}: 表面積比が k²`, worstS);
  console.log(`     ${solid.label.padEnd(22)} 体積比のずれ ${worstV.toExponential(1)} / 表面積比 ${worstS.toExponential(1)}`);
}

/* ------------------------------------------------------------- 比の表記 -- */
console.log("\n入試で書く形");
ok(ratioText(2, 3, 2) === "4 : 9", "相似比 2:3 の面積比は 4 : 9", ratioText(2, 3, 2));
ok(ratioText(2, 3, 3) === "8 : 27", "相似比 2:3 の体積比は 8 : 27", ratioText(2, 3, 3));
ok(ratioText(1, 2, 2) === "1 : 4", "相似比 1:2 の面積比は 1 : 4", ratioText(1, 2, 2));
ok(ratioText(3, 5, 3) === "27 : 125", "相似比 3:5 の体積比は 27 : 125", ratioText(3, 5, 3));
const r = ratios(3);
ok(r.length === 3 && r.area === 9 && r.volume === 27, "k=3 → 3 / 9 / 27",
  `${r.length}/${r.area}/${r.volume}`);
console.log("     2:3 → 面積 4:9、体積 8:27。3:5 → 体積 27:125");

console.log(bad === 0 ? "\nすべて一致しました。" : `\n${bad} 件の不一致`);
process.exit(bad === 0 ? 0 : 1);
