/**
 * 共有カメラ（src/scene3d.js）の性質を確かめる。
 *
 * この投影は「3次元の回転をしてから 1 つの座標を落とす」もの。だから
 * (x, y, depth) の長さはもとの点の長さとぴったり同じになるはずで、これが
 * 成り立っていれば図形がゆがんでいないことの保証になる。4 つのビューが
 * 同じカメラを使うようになったので、ここが崩れると 4 つとも崩れる。
 */
import { fitTo, makeCamera, rotZ } from "../src/scene3d.js";

let bad = 0;
const ok = (cond, what, got) => {
  if (cond) return;
  console.log(`  FAIL ${what}${got === undefined ? "" : ` — 実際: ${got}`}`);
  bad++;
};
const near = (a, b, tol, what) => ok(Math.abs(a - b) <= tol, `${what} ≈ ${b}`, a);

const ANGLES = [0, 0.3, -0.62, 1.1, Math.PI / 2, Math.PI, -2.4];
const PTS = [
  [1, 0, 0], [0, 1, 0], [0, 0, 1], [1, 1, 1], [-2, 0.5, 3],
  [0.3, -1.7, 0.2], [4, -4, 4], [0, 0, 0],
];

/* --------------------------------------------------------- 回転そのもの -- */
console.log("z 軸まわりの回転");
{
  let worst = 0;
  for (const az of ANGLES) {
    for (const p of PTS) {
      const q = rotZ(p, az);
      worst = Math.max(worst, Math.abs(Math.hypot(...q) - Math.hypot(...p)));
      near(q[2], p[2], 1e-15, `z は変わらない (az=${az.toFixed(2)})`);
    }
  }
  ok(worst < 1e-12, "長さが変わらない", worst);
  console.log(`     長さのずれの最大: ${worst.toExponential(2)}`);
  // 2 回まわすのと、まとめて 1 回まわすのは同じ
  let comp = 0;
  for (const p of PTS) {
    const a = rotZ(rotZ(p, 0.4), 0.9);
    const b = rotZ(p, 1.3);
    comp = Math.max(comp, Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]));
  }
  ok(comp < 1e-12, "回転が合成できる（0.4 → 0.9 と 1.3 が同じ）", comp);
}

/* ------------------------------------------------------------- 投影 -- */
console.log("\n投影（回転して 1 座標を落とす）");
{
  // (x, y, depth) の長さは、もとの点の長さと等しい
  let worst = 0;
  for (const az of ANGLES) {
    for (const el of ANGLES) {
      const cam = makeCamera(az, el);
      for (const p of PTS) {
        const q = cam.project(p);
        worst = Math.max(worst, Math.abs(Math.hypot(q.x, q.y, q.depth) - Math.hypot(...p)));
      }
    }
  }
  ok(worst < 1e-12, "(x, y, depth) の長さがもとの点と一致（＝ゆがみがない）", worst);
  console.log(`     長さのずれの最大: ${worst.toExponential(2)}`);

  // 手で追える向き: az=0, el=0 は真横から見た状態
  const flat = makeCamera(0, 0);
  const ex = flat.project([1, 0, 0]);
  near(ex.x, 1, 1e-15, "az=0,el=0: x 軸は画面の右へ");
  near(ex.y, 0, 1e-15, "  その画面 y");
  near(ex.depth, 0, 1e-15, "  その奥行き");
  const ez = flat.project([0, 0, 1]);
  near(ez.y, -1, 1e-15, "az=0,el=0: z 軸は画面の上へ（y は下向きが正）");
  const ey = flat.project([0, 1, 0]);
  near(ey.depth, -1, 1e-15, "az=0,el=0: y 軸は奥へ");

  // 真上から見下ろすと、奥行きが z そのものになる
  const top = makeCamera(0, Math.PI / 2);
  for (const p of PTS) {
    const q = top.project(p);
    near(q.x, p[0], 1e-15, "真上から: 画面 x = x");
    near(q.y, -p[1], 1e-15, "真上から: 画面 y = −y");
    near(q.depth, p[2], 1e-15, "真上から: 奥行き = z");
  }

  // 原点はどう回しても原点
  for (const az of ANGLES) {
    const q = makeCamera(az, 0.4).project([0, 0, 0]);
    near(Math.hypot(q.x, q.y, q.depth), 0, 1e-15, "原点は動かない");
  }
}

/* --------------------------------------------------- 表を向いているか -- */
console.log("\n面が手前を向いているかの判定");
{
  let mismatch = 0;
  for (const az of ANGLES) {
    for (const el of ANGLES) {
      const cam = makeCamera(az, el);
      for (const n of PTS.slice(0, 7)) {
        const byDepth = cam.project(n).depth > 1e-9;
        if (cam.facing(n) !== byDepth) mismatch++;
      }
    }
  }
  ok(mismatch === 0, "facing() は project().depth の符号と一致する", mismatch);

  // 反対向きの法線が同時に手前を向くことはない
  let both = 0;
  for (const az of ANGLES) {
    const cam = makeCamera(az, 0.5);
    for (const n of [[1, 0, 0], [0, 1, 0], [0, 0, 1]]) {
      const back = n.map((v) => -v);
      if (cam.facing(n) && cam.facing(back)) both++;
    }
  }
  ok(both === 0, "表と裏が同時に手前を向くことはない", both);
}

/* ------------------------------------------------------- 画面への収まり -- */
console.log("\n画面への収まり");
{
  const W = 640;
  const H = 480;
  const PAD = 30;
  for (const az of ANGLES) {
    const cam = makeCamera(az, 0.5);
    const map = fitTo(PTS, cam, W, H, PAD);
    let outside = 0;
    for (const p of PTS) {
      const [x, y] = map(p);
      if (x < PAD - 1e-6 || x > W - PAD + 1e-6 || y < PAD - 1e-6 || y > H - PAD + 1e-6) outside++;
    }
    ok(outside === 0, `az=${az.toFixed(2)}: すべての点が余白の内側`, outside);

    // 画面 x と画面 y で同じ倍率（＝つぶれない）。
    // 単位ベクトルの画面上の長さは向きで変わるが（正射影なので奥を向くぶん
    // 短くなる）、それは短縮であってつぶれではない。見るべきは、投影後の
    // 座標からピクセルへの倍率が両軸で同じかどうか。
    const scaleAlong = (axis) => {
      const p0 = PTS[0];
      const p1 = PTS[4];
      const d = map(p1)[axis] - map(p0)[axis];
      const q = axis === 0
        ? cam.project(p1).x - cam.project(p0).x
        : cam.project(p1).y - cam.project(p0).y;
      return d / q;
    };
    near(scaleAlong(0), scaleAlong(1), 1e-9,
      `az=${az.toFixed(2)}: 画面 x と y の倍率が同じ`);

    // 少なくとも片方の向きは余白いっぱいまで使っている
    const xs = PTS.map((p) => map(p)[0]);
    const ys = PTS.map((p) => map(p)[1]);
    const usedW = Math.max(...xs) - Math.min(...xs);
    const usedH = Math.max(...ys) - Math.min(...ys);
    ok(usedW > W - PAD * 2 - 1e-6 || usedH > H - PAD * 2 - 1e-6,
      `az=${az.toFixed(2)}: どちらかの向きで枠いっぱいに使っている`,
      `${usedW.toFixed(1)} × ${usedH.toFixed(1)}`);
  }
  // map は project の奥行きもそのまま返す
  const cam = makeCamera(0.7, 0.4);
  const map = fitTo(PTS, cam, W, H, PAD);
  for (const p of PTS) near(map(p)[2], cam.project(p).depth, 1e-15, "map は奥行きも返す");
  console.log(`     ${ANGLES.length} 通りの向きで、はみ出しなし・つぶれなし`);
}

console.log(bad === 0 ? "\nすべて一致しました。" : `\n${bad} 件の不一致`);
process.exit(bad === 0 ? 0 : 1);
