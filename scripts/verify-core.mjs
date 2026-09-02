/**
 * The five modules behind the primary- and middle-school views that had no
 * checker of their own: exact fractions, the circle-area dissection, rate and
 * travel problems, the dice tally, and the central limit theorem.
 *
 * Every claim here is one the views make on screen, checked against a value
 * worked out by hand or against an exact identity — not against whatever the
 * code happens to return today.
 */
import { divisionTiling, fAdd, fDiv, fMixed, fMul, fStr, fSub, fVal, frac, gcd } from "../src/fractions.js";
import { convergenceRows, inscribedArea, rowWidth, sectorPlacement, wobble } from "../src/circlearea.js";
import { TRAVEL_PRESETS, buai, crossings, positionAt, solveProportion } from "../src/rate.js";
import { EXPERIMENTS, Tally } from "../src/probability.js";
import { SOURCES, binomialPmf, histogram, meanSd, normalPdf, sampleMeans } from "../src/clt.js";

let bad = 0;
const ok = (cond, what, got) => {
  if (cond) return;
  console.log(`  FAIL ${what}${got === undefined ? "" : ` — 実際: ${got}`}`);
  bad++;
};
const near = (a, b, tol, what) => ok(Math.abs(a - b) <= tol, `${what} ≈ ${b}`, a);

/** Deterministic stand-in for Math.random, so the sampling checks repeat. */
function seedRandom(seed) {
  let s = seed >>> 0;
  const real = Math.random;
  Math.random = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
  return () => {
    Math.random = real;
  };
}

/* ------------------------------------------------------------- fractions -- */
console.log("分数（exact rationals）");
ok(gcd(84, 36) === 12, "gcd(84,36) = 12", gcd(84, 36));
ok(gcd(0, 7) === 7, "gcd(0,7) = 7", gcd(0, 7));
ok(fStr(frac(4, -6)) === "-2/3", "frac(4,-6) は符号を分子へ", fStr(frac(4, -6)));
ok(fStr(fAdd(frac(1, 6), frac(1, 3))) === "1/2", "1/6 + 1/3 = 1/2", fStr(fAdd(frac(1, 6), frac(1, 3))));
ok(fStr(fSub(frac(3, 4), frac(2, 5))) === "7/20", "3/4 − 2/5 = 7/20", fStr(fSub(frac(3, 4), frac(2, 5))));
ok(fStr(fMul(frac(2, 3), frac(3, 8))) === "1/4", "2/3 × 3/8 = 1/4", fStr(fMul(frac(2, 3), frac(3, 8))));
ok(fStr(fDiv(frac(2, 3), frac(1, 4))) === "8/3", "2/3 ÷ 1/4 = 8/3", fStr(fDiv(frac(2, 3), frac(1, 4))));
ok(fMixed(frac(8, 3)) === "2 と 2/3", "8/3 は帯分数で 2 と 2/3", fMixed(frac(8, 3)));
ok(fMixed(frac(-8, 3)) === "−2 と 2/3", "−8/3 の符号", fMixed(frac(-8, 3)));

// the tiling the view draws: whole tiles + leftover must rebuild the answer,
// and the leftover is measured in tiles, not in b-ths
for (const [a, b, c, d, want, whole] of [
  [2, 3, 1, 4, "8/3", 2],
  [3, 4, 2, 5, "15/8", 1],
  [1, 1, 1, 3, "3", 3],
  [5, 6, 3, 4, "10/9", 1],
  [1, 2, 2, 1, "1/4", 0],
  [3, 5, 3, 5, "1", 1],
]) {
  const t = divisionTiling(a, b, c, d);
  ok(fStr(t.quotient) === want, `${a}/${b} ÷ ${c}/${d} = ${want}`, fStr(t.quotient));
  ok(t.whole === whole, `${a}/${b} ÷ ${c}/${d} のタイル数 = ${whole}`, t.whole);
  near(t.whole + fVal(t.restFrac), fVal(t.quotient), 1e-12, `${a}/${b} ÷ ${c}/${d} の整数部+端数`);
  near(fVal(t.perUnit) * fVal(t.divisor), 1, 1e-12, `1 に入る ${c}/${d} の個数 × ${c}/${d}`);
  // the picture is only honest if the tiles really cover the dividend
  near(fVal(t.quotient) * fVal(t.divisor), fVal(t.dividend), 1e-12, "タイル数 × わる数 = わられる数");
}

/* ------------------------------------------------------------ 円の面積 -- */
console.log("\n円の面積（分割して長方形にする）");
const R = 5;
near(inscribedArea(4, R), 2 * R * R, 1e-12, "内接正方形の面積 = 2r²");
near(inscribedArea(6, R), (3 * Math.sqrt(3) * R * R) / 2, 1e-12, "内接正六角形の面積 = 3√3r²/2");
near(rowWidth(R), Math.PI * R, 1e-12, "並べた長方形の横 = πr（半周ぶん）");
near(wobble(3, R), R * 0.5, 1e-12, "n=3 のでこぼこ = r(1−cos60°)");
const rows = convergenceRows(R);
ok(rows.length === 7, "収束表は 7 行", rows.length);
for (let i = 1; i < rows.length; i++) {
  ok(rows[i].area > rows[i - 1].area, `n=${rows[i].n} で面積が増える`);
  ok(rows[i].error < rows[i - 1].error, `n=${rows[i].n} で誤差が減る`);
  ok(rows[i].error > 0, `n=${rows[i].n} で内接多角形は円より小さい`);
}
// (1 − sinθ/θ) with θ = 2π/256 ≈ 0.0100%
near(rows[rows.length - 1].errorPct, 0.01004, 1e-4, "n=256 の誤差率 ≈ 0.0100%");
// the dissection has to end with every sector placed, and start with none
for (const n of [8, 16, 32]) {
  ok(sectorPlacement(n, R, 0, 0).placed === false, `t=0 では未配置 (n=${n})`);
  for (let k = 0; k < n; k++) ok(sectorPlacement(n, R, 1, k).placed, `t=1 で全て配置 (n=${n}, k=${k})`);
  near(sectorPlacement(n, R, 0, 0).x, 0, 1e-12, `t=0 は円の位置のまま (n=${n})`);
  // apexes are evenly spaced across the row, alternating up and down
  const xs = [];
  for (let k = 0; k < n; k++) xs.push(sectorPlacement(n, R, 1, k).x);
  for (let k = 1; k < n; k++) near(xs[k] - xs[k - 1], rowWidth(R) / n, 1e-9, `扇の間隔 (n=${n}, k=${k})`);
}

/* --------------------------------------------------------- 割合・速さ -- */
console.log("\n割合と速さ");
near(solveProportion(2400, 0.35, null, "compare").compare, 840, 1e-9, "2400 の 35% = 840");
near(solveProportion(2400, null, 840, "ratio").ratio, 0.35, 1e-12, "840 は 2400 の 0.35");
near(solveProportion(null, 0.35, 840, "base").base, 2400, 1e-9, "0.35 が 840 なら もと = 2400");
ok(buai(0.35) === "3割5分", "0.35 = 3割5分", buai(0.35));
ok(buai(0.207) === "2割7厘", "0.207 = 2割7厘", buai(0.207));
ok(buai(0) === "0割", "0 = 0割", buai(0));
ok(buai(1) === "10割", "1 = 10割", buai(1));

const preset = (k) => TRAVEL_PRESETS.find((p) => p.key === k);
{
  const p = preset("meet"); // 1800m / 分速120m → 15分後、家から 70×15 = 1050m
  const t = crossings(p.a, p.b, p.tMax, p.xMax);
  ok(t.length === 1, "出会い算の交点は 1 回", t.length);
  near(t[0], 15, 1e-6, "出会いは 15 分後");
  near(positionAt(p.a, 15, p.xMax), 1050, 1e-6, "出会う地点は 1050 m");
}
{
  const p = preset("chase"); // 兄は 8 分後に出て 12 分で追いつく → 出発から 20 分後
  const t = crossings(p.a, p.b, p.tMax, p.xMax);
  near(t[t.length - 1], 20, 1e-6, "追いつくのは出発から 20 分後");
  near(positionAt(p.a, 20, p.xMax), 1200, 1e-6, "追いつく地点は 1200 m");
  ok(positionAt(p.b, 5, p.xMax) === 0, "出発前の兄は家にいる", positionAt(p.b, 5, p.xMax));
}
{
  const p = preset("round"); // 10分ごと…ではなく 10, 30, 50 分（往復ぶん 20 分おき）
  const t = crossings(p.a, p.b, p.tMax, p.xMax);
  near(t[0], 10, 1e-6, "往復問題の 1 回目は 10 分後");
  near(t[1], 30, 1e-6, "2 回目は 30 分後");
  // A は 1200m を 15 分で往復の折り返し、30 分で出発点へ戻る
  near(positionAt(p.a, 15, p.xMax), 1200, 1e-6, "A は 15 分で反対のはし");
  near(positionAt(p.a, 30, p.xMax), 0, 1e-6, "A は 30 分で出発点へ戻る");
  for (const tt of [0, 3.7, 11, 19.5, 28, 40]) {
    const x = positionAt(p.a, tt, p.xMax);
    ok(x >= -1e-9 && x <= p.xMax + 1e-9, `折り返しが道の外へ出ない (t=${tt})`, x);
  }
}

/* ----------------------------------------------------- 確率・大数の法則 -- */
console.log("\n確率と大数の法則");
for (const spec of EXPERIMENTS) {
  const sum = spec.theory.reduce((a, b) => a + b, 0);
  near(sum, 1, 1e-12, `${spec.label} の理論確率の合計`);
  ok(spec.outcomes.length === spec.theory.length, `${spec.label} の出目と確率の本数が一致`);
  ok(spec.outcomes.includes(spec.watch), `${spec.label} の注目する出目が一覧にある`);
}
{
  const restore = seedRandom(20260902);
  const spec = EXPERIMENTS[0];
  const tally = new Tally(spec);
  tally.add(200);
  const relSmall = tally.maxRelGap();
  const countSmall = tally.maxCountGap();
  tally.add(60000 - 200);
  ok(tally.n === 60000, "60000 回まわした", tally.n);
  ok(tally.counts.reduce((a, b) => a + b, 0) === tally.n, "度数の合計が回数と一致");
  // the point of the view: the relative gap shrinks while the count gap does not
  ok(tally.maxRelGap() < relSmall, "相対度数のずれは縮む", `${relSmall} -> ${tally.maxRelGap()}`);
  ok(tally.maxCountGap() > countSmall, "度数そのもののずれは縮まない", `${countSmall} -> ${tally.maxCountGap()}`);
  ok(tally.maxRelGap() < 0.01, "60000 回で相対度数のずれは 1% 未満", tally.maxRelGap());
  ok(tally.history.length > 40 && tally.history.length < 600, "履歴が対数間隔で保たれる", tally.history.length);
  tally.reset();
  ok(tally.n === 0 && tally.history.length === 0, "reset で空になる");
  restore();
}

/* ------------------------------------------------------- 中心極限定理 -- */
console.log("\n中心極限定理");
{
  let s = 0;
  for (let k = 0; k <= 12; k++) s += binomialPmf(12, k);
  near(s, 1, 1e-12, "二項分布 (n=12) の合計");
  near(binomialPmf(12, 6), 924 / 4096, 1e-12, "C(12,6)/2^12 = 924/4096");
  near(binomialPmf(12, 0), 1 / 4096, 1e-15, "両はしは 1/4096");
  for (let k = 0; k <= 6; k++) near(binomialPmf(12, k), binomialPmf(12, 12 - k), 1e-15, `左右対称 (k=${k})`);
}
near(normalPdf(0, 0, 1), 1 / Math.sqrt(2 * Math.PI), 1e-15, "標準正規の頂点");
{
  // ∫ pdf ≈ 1, by strips — the curve the histogram is compared against
  let area = 0;
  for (let x = -8; x < 8; x += 0.001) area += normalPdf(x, 0, 1) * 0.001;
  near(area, 1, 1e-6, "正規分布の面積");
}
for (const src of SOURCES) {
  const restore = seedRandom(4242);
  const draws = sampleMeans(src, 1, 40000);
  const st = meanSd(draws);
  near(st.mean, src.mean, 0.03 * (src.sd || 1) + 0.02, `${src.label} の母平均`);
  near(st.sd, src.sd, 0.05 * src.sd + 0.02, `${src.label} の母標準偏差`);
  // the theorem itself: the spread of the mean of n falls like 1/√n
  const m9 = meanSd(sampleMeans(src, 9, 20000));
  near(m9.sd, src.sd / 3, 0.08 * src.sd, `${src.label}: n=9 の標本平均の散らばりは 1/3`);
  near(m9.mean, src.mean, 0.05 * src.sd + 0.02, `${src.label}: n=9 でも中心は動かない`);
  restore();
}
{
  const h = histogram([0, 0.24, 0.25, 0.99, 1, -3, 7], 0, 1, 4);
  ok(h.counts.reduce((a, b) => a + b, 0) === 7, "範囲外もどこかの階級に入る", h.counts.join(","));
  ok(h.counts[0] === 3, "はみ出した下端は最初の階級へ", h.counts[0]);
  ok(h.counts[3] === 3, "はみ出した上端は最後の階級へ", h.counts[3]);
  near(h.w, 0.25, 1e-15, "階級の幅");
}

console.log(bad === 0 ? "\nすべて一致しました。" : `\n${bad} 件の不一致`);
process.exit(bad === 0 ? 0 : 1);
