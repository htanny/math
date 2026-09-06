/**
 * Both panels claim a shape for their graph. The overlap graph claims it is
 * piecewise quadratic and bends only at the marked points; the tank graph
 * claims it is piecewise linear with slopes set by the base area. Neither is
 * taken on trust here.
 */
import {
  OVERLAP_CASES, areaAt, durationOf, breakpoints, segmentKind, overlapArea, polyArea2,
  TANK_CASES, simulateTank, tankStateAt, tankVolumeAt,
} from "../src/motion.js";

let bad = 0;
const check = (name, got, want, tol = 1e-9) => {
  const ok = typeof want === "string" ? got === want : Math.abs(got - want) <= tol;
  if (!ok) bad++;
  console.log(`${ok ? "ok  " : "FAIL"} ${name}: ${typeof got === "number" ? got.toFixed(8) : got}` +
    (ok ? "" : `  (期待 ${typeof want === "number" ? want.toFixed(8) : want})`));
};

console.log("=== 重なりの面積 ===");
for (const spec of OVERLAP_CASES) {
  console.log(`\n--- ${spec.label} ---`);
  const span = durationOf(spec);
  const bps = breakpoints(spec);
  console.log(`     折れ点: ${bps.map((t) => t.toFixed(4)).join(", ") || "なし"}（全 ${span} 秒）`);

  check("はじめの重なり", areaAt(spec, 0), 0);
  check("おわりの重なり", areaAt(spec, span), 0);

  // both figures must stand on the same ground line: the moving figure only
  // slides sideways, so a difference in height is invisible in the numbers and
  // misleading in the picture
  const bottom = (fig) => Math.min(...fig.outline.map(([, y]) => y));
  check("2つの図形の底辺がそろっている", bottom(spec.moving) - bottom(spec.fixed), 0);
  for (const pieces of [spec.fixed.pieces, spec.moving.pieces]) {
    const low = Math.min(...pieces.flat().map(([, y]) => y));
    check("  分割した凸部分も同じ底辺", low - bottom(spec.fixed), 0);
  }

  const movingArea = spec.moving.pieces.reduce((s, p) => s + polyArea2(p), 0);
  let peak = 0;
  for (let i = 0; i <= 2000; i++) peak = Math.max(peak, areaAt(spec, (span * i) / 2000));
  check("最大の重なり ≤ 動く図形の面積", peak <= movingArea + 1e-9 ? 1 : 0, 1);

  // between two bends the area has to be exactly a quadratic in t
  const edges = [0, ...bps, span];
  let worstFit = 0;
  for (let s = 0; s + 1 < edges.length; s++) {
    const a = edges[s] + (edges[s + 1] - edges[s]) * 0.02;
    const b = edges[s + 1] - (edges[s + 1] - edges[s]) * 0.02;
    const [t0, t1, t2] = [a, (a + b) / 2, b];
    const [y0, y1, y2] = [t0, t1, t2].map((t) => areaAt(spec, t));
    // Lagrange through the three samples
    const q = (t) =>
      (y0 * (t - t1) * (t - t2)) / ((t0 - t1) * (t0 - t2)) +
      (y1 * (t - t0) * (t - t2)) / ((t1 - t0) * (t1 - t2)) +
      (y2 * (t - t0) * (t - t1)) / ((t2 - t0) * (t2 - t1));
    for (let k = 0; k <= 60; k++) {
      const t = a + ((b - a) * k) / 60;
      worstFit = Math.max(worstFit, Math.abs(areaAt(spec, t) - q(t)));
    }
    const kind = segmentKind(spec, a, b);
    console.log(`     区間 ${edges[s].toFixed(3)}〜${edges[s + 1].toFixed(3)} 秒: ${kind.kind}`);
  }
  check("各区間が2次式にぴったり乗る", worstFit, 0, 1e-9);
}

console.log("\n--- 手で解ける例で答え合わせ（正方形6cm × 正方形4cm）---");
{
  const spec = OVERLAP_CASES[0];
  // overlap width = min(6, p+4) - max(0, p), height 4
  let worst = 0;
  for (let i = 0; i <= 400; i++) {
    const t = (durationOf(spec) * i) / 400;
    const p = spec.from + t;
    const w = Math.max(0, Math.min(6, p + 4) - Math.max(0, p));
    worst = Math.max(worst, Math.abs(areaAt(spec, t) - w * 4));
  }
  check("手計算の式との差", worst, 0, 1e-12);
  check("t=4 秒（全部入った瞬間）", areaAt(spec, 4), 16);
  check("t=6 秒（出はじめる瞬間）", areaAt(spec, 6), 16);
  check("折れ点は 2 つ", breakpoints(spec).length, 2);
}

console.log("\n=== 水そう ===");
for (const spec of TANK_CASES) {
  console.log(`\n--- ${spec.label} ---`);
  const sim = simulateTank(spec);
  console.log("     区切り(秒): " + sim.segments.map((s) => s.t1.toFixed(2)).join(", "));
  console.log("     左の水面: " + sim.segments.map((s) => `${s.left0.toFixed(1)}→${s.left1.toFixed(1)}`).join(" / "));

  check("満水までの時間", sim.tFull, sim.totalVolume / spec.rate, 1e-9);

  // the invariant that makes the whole simulation trustworthy
  let worst = 0;
  for (let i = 0; i <= 500; i++) {
    const t = (sim.tFull * i) / 500;
    worst = Math.max(worst, Math.abs(tankVolumeAt(sim, spec, t) - spec.rate * t));
  }
  check("入れた水の量 = たまっている量", worst, 0, 1e-8);

  // no room ever holds more than the tank is tall, or less than nothing
  let outside = 0;
  for (let i = 0; i <= 300; i++) {
    const { levels } = tankStateAt(sim, spec, (sim.tFull * i) / 300);
    for (const l of levels) if (l < -1e-9 || l > spec.height + 1e-9) outside++;
  }
  check("どのへやも 0 〜 高さ の範囲", outside, 0);
}

console.log("\n--- 仕切り1枚を手計算と照合 ---");
{
  const spec = TANK_CASES[0];
  const sim = simulateTank(spec);
  // 左 30×20 = 600cm², 右 20×20 = 400cm², 毎秒 200cm³
  check("左が 10cm になる時刻", sim.segments[0].t1, (600 * 10) / 200);
  check("右も 10cm になる時刻", sim.segments[1].t1, (600 * 10) / 200 + (400 * 10) / 200);
  check("満水", sim.tFull, (600 * 10) / 200 + (400 * 10) / 200 + (1000 * 10) / 200);
  const slope = (s) => (s.left1 - s.left0) / (s.t1 - s.t0);
  check("第1区間の傾き = 200/600", slope(sim.segments[0]), 200 / 600);
  check("第2区間の傾き = 0", slope(sim.segments[1]), 0);
  check("第3区間の傾き = 200/1000", slope(sim.segments[2]), 200 / 1000);
}

console.log(bad === 0 ? "\nすべて一致。" : `\n${bad} 件の不一致`);
process.exit(bad === 0 ? 0 : 1);
