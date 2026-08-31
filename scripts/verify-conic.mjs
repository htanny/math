/**
 * The claim the view makes is not just "this looks like an ellipse" but that
 * the curve cut out of the cone satisfies the focal definition students are
 * taught separately. That is what is checked here: the section is on the cone
 * and on the plane, and the sum (or difference) of its focal radii is constant.
 */
import {
  coneK, planeM, classify, criticalTilt, conicParams, sectionCurve3D,
  sectionCurvePlane, toPlane, residual, focalMeasure, KIND_LABEL, CONIC_PRESETS,
} from "../src/conic.js";

let bad = 0;
const check = (name, got, want, tol = 1e-9) => {
  const ok = typeof want === "string" ? got === want : Math.abs(got - want) <= tol;
  if (!ok) bad++;
  console.log(`${ok ? "ok  " : "FAIL"} ${name}: ${typeof got === "number" ? got.toExponential(3) : got}` +
    (ok ? "" : `  (期待 ${typeof want === "number" ? want : want})`));
};

console.log("=== 切り口の分類 ===");
for (const alpha of [18, 30, 45]) {
  const crit = criticalTilt(alpha);
  console.log(`  半頂角 ${alpha}° → 側面の傾きは ${crit}°`);
  check(`  ${alpha}°: 0° は円`, classify(alpha, 0), "circle");
  check(`  ${alpha}°: ${crit - 20}° は楕円`, classify(alpha, crit - 20), "ellipse");
  check(`  ${alpha}°: ${crit}° は放物線`, classify(alpha, crit), "parabola");
  check(`  ${alpha}°: ${crit + 10}° は双曲線`, classify(alpha, crit + 10), "hyperbola");
}

console.log("\n=== 曲線の点が本当に円錐と平面の両方に乗っているか ===");
for (const [alpha, psi] of [[30, 0], [30, 35], [30, 60], [30, 72], [18, 60], [45, 20]]) {
  const k = coneK(alpha);
  const m = planeM(psi);
  const branches = sectionCurve3D(k, m, 1, 2.5, 300);
  let worst = 0;
  let n = 0;
  for (const br of branches) for (const p of br) { worst = Math.max(worst, residual(k, m, 1, p)); n++; }
  check(`  α=${alpha}° ψ=${psi}° (${n} 点)`, worst, 0, 1e-9);
}

console.log("\n=== 焦点の性質 ===");
for (const [alpha, psi, label] of [
  [30, 0, "円"], [30, 20, "楕円(ゆるい)"], [30, 35, "楕円"], [30, 55, "楕円(細長い)"],
  [30, 60, "放物線"], [30, 70, "双曲線"], [30, 78, "双曲線(急)"], [18, 60, "細い円錐の楕円"],
]) {
  const k = coneK(alpha);
  const m = planeM(psi);
  const c = 1;
  const params = conicParams(k, m, c);
  const branches = sectionCurvePlane(k, m, c, 2.5, 400);
  let worst = 0;
  let count = 0;
  for (const br of branches) {
    for (const uv of br) {
      const fm = focalMeasure(params, uv);
      worst = Math.max(worst, Math.abs(fm.value - fm.other));
      count++;
    }
  }
  const extra = params.kind === "parabola"
    ? `p=${params.p.toFixed(4)}`
    : `a=${params.a.toFixed(4)} b=${params.b.toFixed(4)} e=${params.eccentricity.toFixed(4)}`;
  console.log(`  ${label.padEnd(14)} ${KIND_LABEL[params.kind].padEnd(4)} ${extra}`);
  check(`    定義どおりか（${count} 点）`, worst, 0, 1e-8);
}

console.log("\n--- 手で確かめられる値 ---");
{
  // ψ = 0: the section is a circle of radius k·c centred on the axis
  const k = coneK(30);
  const params = conicParams(k, 0, 1);
  check("円の半径 = k·c = tan30°", params.a, k, 1e-12);
  check("円の離心率 = 0", params.eccentricity, 0, 1e-12);
  check("円は 2 つの焦点が一致", params.focal, 0, 1e-12);
}
{
  // an ellipse's eccentricity is sin(ψ) / cos(α) — the classic relation
  for (const [alpha, psi] of [[30, 20], [30, 35], [30, 55], [18, 40], [45, 30]]) {
    const p = conicParams(coneK(alpha), planeM(psi), 1);
    const want = Math.sin((psi * Math.PI) / 180) / Math.cos((alpha * Math.PI) / 180);
    check(`離心率 e = sinψ/cosα (α=${alpha}, ψ=${psi})`, p.eccentricity, want, 1e-9);
  }
  // and for a hyperbola the same relation, now greater than 1
  for (const [alpha, psi] of [[30, 70], [30, 78], [45, 60]]) {
    const p = conicParams(coneK(alpha), planeM(psi), 1);
    const want = Math.sin((psi * Math.PI) / 180) / Math.cos((alpha * Math.PI) / 180);
    check(`離心率 e = sinψ/cosα (α=${alpha}, ψ=${psi}, 双曲線)`, p.eccentricity, want, 1e-9);
    check(`  e > 1`, p.eccentricity > 1 ? 1 : 0, 1);
  }
}
{
  // at the critical tilt the relation gives exactly 1, the parabola
  for (const alpha of [18, 30, 45]) {
    const psi = criticalTilt(alpha);
    const e = Math.sin((psi * Math.PI) / 180) / Math.cos((alpha * Math.PI) / 180);
    check(`放物線の離心率 = 1 (α=${alpha}°)`, e, 1, 1e-12);
  }
}

console.log("\n--- プリセットの分類 ---");
for (const p of CONIC_PRESETS) {
  const got = classify(p.alpha, p.psi);
  console.log(`  ${p.label.padEnd(12)} α=${p.alpha}° ψ=${p.psi}° → ${KIND_LABEL[got]}`);
}
check("「細い円錐で楕円」が本当に楕円", classify(18, 60), "ellipse");
check("同じ 60° でも α=30° なら放物線", classify(30, 60), "parabola");

console.log(bad === 0 ? "\nすべて一致。" : `\n${bad} 件の不一致`);
process.exit(bad === 0 ? 0 : 1);
