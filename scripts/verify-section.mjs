/**
 * The section view makes three kinds of claim — the shape of the cut, its
 * area, and the ratio the solid is split into. All three are checked here
 * against values worked out by hand, plus the invariant that the two pieces
 * have to add back up to the whole.
 */
import {
  makeCube, makePrism, planeThrough, crossSection, splitVolume, polygonArea3,
  shapeName, volumeOf, extensionPoints, constructionSteps, len, sub,
} from "../src/section.js";

let bad = 0;
const check = (name, got, want, tol = 1e-9) => {
  const ok = typeof want === "string" ? got === want : Math.abs(got - want) <= tol;
  if (!ok) bad++;
  console.log(`${ok ? "ok  " : "FAIL"} ${name}: ${typeof got === "number" ? got.toFixed(10) : got}` +
    (ok ? "" : `  (期待 ${typeof want === "number" ? want.toFixed(10) : want})`));
};

const cube = makeCube(1, 1, 1);
const V = (name) => cube.verts[cube.names.indexOf(name)];
const mid = (a, b) => [(V(a)[0] + V(b)[0]) / 2, (V(a)[1] + V(b)[1]) / 2, (V(a)[2] + V(b)[2]) / 2];

console.log("--- 立方体そのもの ---");
check("体積", volumeOf(cube), 1);
check("辺の数", cube.faces.reduce((n, f) => n + f.length, 0) / 2, 12);

console.log("\n--- 6辺の中点を通る切断（正六角形） ---");
{
  const pts = [mid("A", "B"), mid("A", "D"), mid("B", "F")];
  const plane = planeThrough(...pts);
  const poly = crossSection(cube, plane);
  const v = splitVolume(cube, plane);
  check("頂点の数", poly.length, 6);
  check("形の名前", shapeName(poly), "正六角形");
  check("面積 = 3√3/4", polygonArea3(poly), (3 * Math.sqrt(3)) / 4, 1e-9);
  check("1辺 = √2/2", len(sub(poly[1], poly[0])), Math.SQRT2 / 2, 1e-9);
  check("下側の体積", v.below, 0.5, 1e-9);
  check("上側の体積", v.above, 0.5, 1e-9);
  check("2つの和 = もとの体積", v.closes, 0, 1e-9);
}

console.log("\n--- 頂点を1つ切り落とす（B・D・E を通る） ---");
{
  const pts = [V("B"), V("D"), V("E")];
  const plane = planeThrough(...pts);
  const poly = crossSection(cube, plane);
  const v = splitVolume(cube, plane);
  check("形の名前", shapeName(poly), "正三角形");
  check("1辺 = √2", len(sub(poly[1], poly[0])), Math.SQRT2, 1e-9);
  check("面積 = √3/2", polygonArea3(poly), Math.sqrt(3) / 2, 1e-9);
  check("小さいほうの体積 = 1/6", Math.min(v.below, v.above), 1 / 6, 1e-9);
  check("体積比 = 1 : 5", Math.max(v.below, v.above) / Math.min(v.below, v.above), 5, 1e-9);
  check("2つの和", v.closes, 0, 1e-9);
}

console.log("\n--- 対角線を含む切断（A・C・G を通る） ---");
{
  const plane = planeThrough(V("A"), V("C"), V("G"));
  const poly = crossSection(cube, plane);
  const v = splitVolume(cube, plane);
  check("形の名前", shapeName(poly), "長方形");
  check("面積 = √2", polygonArea3(poly), Math.SQRT2, 1e-9);
  check("体積比 = 1 : 1", v.below / v.above, 1, 1e-9);
}

console.log("\n--- 上面と下面を平行に切る（原則2が効く） ---");
{
  const p = [0.5, 0, 1];
  const q = [0.5, 1, 1];
  const r = [0.5, 0, 0];
  const plane = planeThrough(p, q, r);
  const poly = crossSection(cube, plane);
  check("形の名前", shapeName(poly), "正方形");
  check("面積 = 1", polygonArea3(poly), 1, 1e-9);
  check("体積比 = 1 : 1", splitVolume(cube, plane).below, 0.5, 1e-9);
}

console.log("\n--- 五角形になる例 ---");
{
  const pts = [mid("A", "B"), mid("A", "D"), [1, 1, 0.25]];
  const plane = planeThrough(...pts);
  const poly = crossSection(cube, plane);
  const v = splitVolume(cube, plane);
  check("頂点の数", poly.length, 5);
  check("形の名前", shapeName(poly), "五角形");
  check("2つの和", v.closes, 0, 1e-9);
  console.log(`     体積比 ${v.below.toFixed(6)} : ${v.above.toFixed(6)}`);
}

console.log("\n--- でたらめな平面 200 個で「2つの和 = もと」 ---");
{
  let worst = 0;
  let shapes = {};
  for (let i = 0; i < 200; i++) {
    const rnd = () => [Math.random(), Math.random(), Math.random()];
    const plane = planeThrough(rnd(), rnd(), rnd());
    if (!plane) continue;
    const v = splitVolume(cube, plane);
    worst = Math.max(worst, v.closes);
    const poly = crossSection(cube, plane);
    if (poly.length) shapes[poly.length] = (shapes[poly.length] || 0) + 1;
  }
  check("いちばん大きなずれ", worst, 0, 1e-9);
  console.log("     出てきた切り口:", Object.entries(shapes).map(([k, n]) => `${k}角形 ${n}`).join(" / "));
}

console.log("\n--- 角柱の斜め切り: 体積 = 底面積 × 側面の辺の平均 ---");
for (const [label, base, hs] of [
  ["四角柱", [[0, 0], [1, 0], [1, 1], [0, 1]], [1.2, 0.6, 1.0, 1.6]],
  ["四角柱2", [[0, 0], [2, 0], [2, 1], [0, 1]], [0.4, 1.4, 1.9, 0.9]],
  ["三角柱", [[0, 0], [1, 0], [0.5, 0.9]], [0.5, 1.3, 1.8]],
]) {
  const H = 3;
  const prism = makePrism(base, H);
  const top = base.map(([x, y], i) => [x, y, hs[i]]);
  const plane = planeThrough(top[0], top[1], top[2]);
  // every listed height must actually lie on the plane, or the shape is not a plane cut
  const off = Math.max(...top.map((p) => Math.abs(plane.n[0] * p[0] + plane.n[1] * p[1] + plane.n[2] * p[2] - plane.d)));
  const area = Math.abs(base.reduce((s, [x, y], i) => {
    const [x2, y2] = base[(i + 1) % base.length];
    return s + (x * y2 - x2 * y);
  }, 0)) / 2;
  const mean = hs.reduce((a, b) => a + b, 0) / hs.length;
  const v = splitVolume(prism, plane);
  console.log(`  ${label}: 底面積 ${area} × 平均 ${mean.toFixed(4)} = ${(area * mean).toFixed(6)}`);
  check(`  ${label} 4点が同一平面`, off, 0, 1e-9);
  check(`  ${label} 実際の体積`, v.below, area * mean, 1e-9);
}

console.log("\n--- 作図の手順（延長法が要る例） ---");
{
  const given = [mid("A", "B"), mid("A", "D"), [1, 1, 0.25]];
  const plane = planeThrough(...given);
  const poly = crossSection(cube, plane);
  const steps = constructionSteps(cube, plane, poly, given, (i) => `P${i}`);
  check("手順の数 = 辺の数", steps.length, poly.length);
  console.log("     " + steps.map((s) => `原則${s.rule}(${s.faceLabel})`).join(" → "));
  const ext = extensionPoints(cube, plane);
  console.log(`     立方体の外にできる交点: ${ext.length} 個`);
  check("延長でしか引けない線がある", steps.some((s) => s.rule === 3) ? 1 : 0, 1);
}

console.log(bad === 0 ? "\nすべて一致。" : `\n${bad} 件の不一致`);
process.exit(bad === 0 ? 0 : 1);
