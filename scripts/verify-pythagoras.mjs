/**
 * The claim both animations make is that area never changes. Check it at
 * every intermediate frame, not just at the stage boundaries.
 */
import { rearrangement, rearrangementAt, euclidStages, stageAt, polyArea } from "../src/pythagoras.js";

const TOL = 1e-9;
let bad = 0;
const check = (name, got, want, tol = TOL) => {
  const ok = Math.abs(got - want) <= tol;
  if (!ok) bad++;
  console.log(`${ok ? "ok  " : "FAIL"} ${name}: ${got.toFixed(10)} (期待 ${want.toFixed(10)})`);
};

for (const [a, b] of [[3, 4], [1, 1], [5, 2], [1.2, 3.7]]) {
  const c2 = a * a + b * b;
  console.log(`\n--- a=${a}, b=${b}, c=${Math.hypot(a, b).toFixed(6)} ---`);

  const plan = rearrangement(a, b);
  const big = (a + b) ** 2;
  const triArea = (a * b) / 2;

  // uncovered area matches in both arrangements
  check("配置A の余り (a²+b²)", plan.squaresA[0].area + plan.squaresA[1].area, c2);
  check("配置B の余り (c²)", polyArea(plan.squareB.poly), c2);
  check("大きい正方形 = 4三角形 + 余り", 4 * triArea + c2, big);

  // the tilted quadrilateral really is a square
  const q = plan.squareB.poly;
  for (let i = 0; i < 4; i++) {
    const p0 = q[i];
    const p1 = q[(i + 1) % 4];
    check(`  c²の辺${i}`, Math.hypot(p1[0] - p0[0], p1[1] - p0[1]), Math.sqrt(c2));
  }

  // the triangles keep their shape and stay inside the big square all the way
  let worstArea = 0;
  let outside = 0;
  for (let k = 0; k <= 40; k++) {
    const tris = rearrangementAt(plan, k / 40);
    for (const tri of tris) {
      worstArea = Math.max(worstArea, Math.abs(polyArea(tri) - triArea));
      for (const [x, y] of tri) {
        if (x < -TOL || y < -TOL || x > plan.side + TOL || y > plan.side + TOL) outside++;
      }
    }
  }
  check("移動中の三角形の面積のずれ", worstArea, 0);
  check("大きい正方形からはみ出た頂点", outside, 0);

  // Euclid: every frame of every stage keeps its area
  const eu = euclidStages(a, b);
  let worstB = 0;
  let worstA = 0;
  for (let k = 0; k <= 120; k++) {
    const t = (k / 120) * 3;
    worstB = Math.max(worstB, Math.abs(polyArea(stageAt(eu.bStages, t)) - b * b));
    worstA = Math.max(worstA, Math.abs(polyArea(stageAt(eu.aStages, t)) - a * a));
  }
  check("せん断中ずっと面積 = b²", worstB, 0, 1e-9);
  check("せん断中ずっと面積 = a²", worstA, 0, 1e-9);

  // final rectangles tile the c-square exactly
  const rb = eu.bStages[3];
  const ra = eu.aStages[3];
  check("最終の左長方形 = b²", polyArea(rb), b * b);
  check("最終の右長方形 = a²", polyArea(ra), a * a);
  check("2つの長方形 = c²", polyArea(rb) + polyArea(ra), polyArea(eu.cSquare));
  check("長方形の境目 = 垂線の足 H", rb[1][0], eu.H[0]);
  check("右長方形の左端も H", ra[0][0], eu.H[0]);
  // C really is the right-angle vertex
  const ca = Math.hypot(eu.C[0] - eu.A[0], eu.C[1] - eu.A[1]);
  const cb = Math.hypot(eu.C[0] - eu.B[0], eu.C[1] - eu.B[1]);
  check("|CA| = b", ca, b);
  check("|CB| = a", cb, a);
}
console.log(bad === 0 ? "\nすべて一致。" : `\n${bad} 件の不一致`);
process.exit(bad === 0 ? 0 : 1);
