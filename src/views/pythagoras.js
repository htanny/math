import { readVars, setupCanvasDPR } from "../chart.js";
import { rearrangement, rearrangementAt, euclidStages, stageAt, polyArea } from "../pythagoras.js";
import { gcd } from "../fractions.js";

const $ = (id) => document.getElementById(id);
const LABEL_FONT = "13px system-ui, -apple-system, 'Segoe UI', sans-serif";
const SMALL_FONT = "11px system-ui, -apple-system, 'Segoe UI', sans-serif";

/** The slider moves in 0.05 steps, so a:b is always a ratio of whole numbers. */
function ratioParts(value) {
  const k = Math.round(value * 20);
  const g = gcd(k, 20);
  return { na: k / g, nb: 20 / g };
}

export function initPythagorasView() {
  /* ------------------------------------------------ panel 1: four triangles -- */
  const canvas = $("pyCanvas");
  const tSlider = $("pyT");
  const shapeSlider = $("pyShape");
  const tOut = $("pyTOut");
  const shapeOut = $("pyShapeOut");
  const playBtn = $("pyPlay");
  const note = $("pyNote");
  const statSum = $("pySum");
  const statC2 = $("pyC2");
  const statDiff = $("pyDiff");

  let raf = null;

  function drawPoly(ctx, poly, map, fill, stroke, alpha, lw) {
    ctx.beginPath();
    poly.forEach((p, i) => {
      const q = map(p);
      if (i === 0) ctx.moveTo(q[0], q[1]);
      else ctx.lineTo(q[0], q[1]);
    });
    ctx.closePath();
    if (fill) {
      ctx.globalAlpha = alpha;
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lw || 1.5;
      ctx.stroke();
    }
  }

  function centre(poly, map) {
    let x = 0;
    let y = 0;
    for (const p of poly) {
      const q = map(p);
      x += q[0];
      y += q[1];
    }
    return [x / poly.length, y / poly.length];
  }

  function drawRearrange() {
    const { ctx, width, height } = setupCanvasDPR(canvas);
    ctx.clearRect(0, 0, width, height);
    const vars = readVars(canvas.parentElement, [
      "--surface-1", "--muted", "--gridline", "--baseline",
      "--text-primary", "--text-secondary", "--series-1", "--series-2", "--series-3", "--series-4",
    ]);

    const { na, nb } = ratioParts(Number(shapeSlider.value));
    const a = na;
    const b = nb;
    const plan = rearrangement(a, b);
    const t = Number(tSlider.value);

    const pad = 30;
    const scale = Math.min(width - pad * 2, height - pad * 2) / plan.side;
    const ox = (width - plan.side * scale) / 2;
    const oy = (height - plan.side * scale) / 2;
    const map = (p) => [ox + p[0] * scale, oy + (plan.side - p[1]) * scale];

    // the big square never changes — that is the fixed frame of the argument
    drawPoly(
      ctx,
      [[0, 0], [plan.side, 0], [plan.side, plan.side], [0, plan.side]],
      map,
      vars["--surface-1"],
      vars["--baseline"],
      1,
      2
    );

    const fadeA = Math.max(0, 1 - t * 1.7);
    const fadeB = Math.max(0, (t - 0.42) / 0.58);

    for (const sq of plan.squaresA) {
      if (fadeA <= 0.01) break;
      drawPoly(ctx, sq.poly, map, vars["--series-4"], vars["--series-4"], 0.3 * fadeA, 1.5);
      const c = centre(sq.poly, map);
      ctx.globalAlpha = fadeA;
      ctx.fillStyle = vars["--text-primary"];
      ctx.font = LABEL_FONT;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(sq.label, c[0], c[1]);
      ctx.globalAlpha = 1;
    }

    if (fadeB > 0.01) {
      drawPoly(ctx, plan.squareB.poly, map, vars["--series-3"], vars["--series-3"], 0.3 * fadeB, 1.5);
      const c = centre(plan.squareB.poly, map);
      ctx.globalAlpha = fadeB;
      ctx.fillStyle = vars["--text-primary"];
      ctx.font = LABEL_FONT;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("c²", c[0], c[1]);
      ctx.globalAlpha = 1;
    }

    for (const tri of rearrangementAt(plan, t)) {
      drawPoly(ctx, tri, map, vars["--series-1"], vars["--series-1"], 0.42, 1.5);
    }

    ctx.fillStyle = vars["--muted"];
    ctx.font = SMALL_FONT;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(`一辺 a + b = ${a} + ${b} = ${plan.side}`, width / 2, oy + plan.side * scale + 8);
  }

  function renderRearrange() {
    const { na, nb } = ratioParts(Number(shapeSlider.value));
    const t = Number(tSlider.value);
    tOut.textContent = `${Math.round(t * 100)}%`;
    shapeOut.textContent = `${na} : ${nb}`;
    drawRearrange();

    const plan = rearrangement(na, nb);
    const sumA = plan.squaresA.reduce((s, q) => s + polyArea(q.poly), 0);
    const areaB = polyArea(plan.squareB.poly);
    statSum.textContent = `${na}² + ${nb}² = ${sumA.toFixed(0)}`;
    statC2.textContent = areaB.toFixed(0);
    statDiff.textContent = (sumA - areaB).toFixed(6);

    note.textContent =
      `どちらの置き方でも、使っている三角形は同じ4枚。だから残った白い部分の面積も同じはずです。` +
      `左の置き方では ${na}² + ${nb}² = ${sumA.toFixed(0)}、右の置き方では c² = ${areaB.toFixed(0)}。` +
      `この2つが等しいことが a² + b² = c² です。三角形は回転も裏返しもしていません（1枚はその場から動きません）。` +
      `面積が隠れる余地がないことが、この見せ方の強みです。`;
  }

  function stopAnim1() {
    if (raf) cancelAnimationFrame(raf);
    raf = null;
    playBtn.textContent = "動かす";
  }

  playBtn.addEventListener("click", () => {
    if (raf) {
      stopAnim1();
      return;
    }
    const from = Number(tSlider.value) >= 0.999 ? 0 : Number(tSlider.value);
    const start = performance.now();
    playBtn.textContent = "止める";
    const step = (now) => {
      const p = Math.min(1, (now - start) / 2400);
      tSlider.value = String(from + (1 - from) * p);
      renderRearrange();
      if (p < 1) raf = requestAnimationFrame(step);
      else stopAnim1();
    };
    raf = requestAnimationFrame(step);
  });

  tSlider.addEventListener("input", () => {
    stopAnim1();
    renderRearrange();
  });
  shapeSlider.addEventListener("input", () => {
    stopAnim1();
    renderRearrange();
  });

  /* ---------------------------------------------------- panel 2: Euclid -- */
  const eCanvas = $("pyEuclid");
  const etSlider = $("pyEt");
  const eShape = $("pyEShape");
  const eStageOut = $("pyEStageOut");
  const eShapeOut = $("pyEShapeOut");
  const ePlay = $("pyEPlay");
  const eCaption = $("pyECaption");
  const eNote = $("pyENote");

  let raf2 = null;
  const STAGE_NAMES = ["はじめ", "① せん断", "② 真下へ", "③ 縦にせん断"];

  function drawEuclid() {
    const { ctx, width, height } = setupCanvasDPR(eCanvas);
    ctx.clearRect(0, 0, width, height);
    const vars = readVars(eCanvas.parentElement, [
      "--surface-1", "--muted", "--gridline", "--baseline",
      "--text-primary", "--text-secondary", "--series-1", "--series-2", "--series-3", "--series-4",
    ]);

    const { na, nb } = ratioParts(Number(eShape.value));
    const eu = euclidStages(na, nb);
    const t = Number(etSlider.value);

    // bounds over everything that will ever be drawn, so nothing shifts
    const all = [eu.triangle, eu.cSquare, ...eu.bStages, ...eu.aStages].flat();
    let lo = [Infinity, Infinity];
    let hi = [-Infinity, -Infinity];
    for (const p of all) {
      lo[0] = Math.min(lo[0], p[0]);
      hi[0] = Math.max(hi[0], p[0]);
      lo[1] = Math.min(lo[1], p[1]);
      hi[1] = Math.max(hi[1], p[1]);
    }
    const pad = 26;
    const scale = Math.min((width - pad * 2) / (hi[0] - lo[0]), (height - pad * 2) / (hi[1] - lo[1]));
    const ox = width / 2 - ((lo[0] + hi[0]) / 2) * scale;
    const oy = height / 2 + ((lo[1] + hi[1]) / 2) * scale;
    const map = (p) => [ox + p[0] * scale, oy - p[1] * scale];

    // the hypotenuse square, split by the foot of the altitude. Its outline
    // is dashed and drawn on top of everything else at the end, because the
    // shapes flowing into it would otherwise hide the target.
    drawPoly(ctx, eu.cSquare, map, vars["--surface-1"], null, 1, 0);
    ctx.strokeStyle = vars["--gridline"];
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    const h0 = map([eu.H[0], 0]);
    const h1 = map([eu.H[0], -eu.c]);
    ctx.moveTo(h0[0], h0[1]);
    ctx.lineTo(h1[0], h1[1]);
    const c0 = map(eu.C);
    ctx.moveTo(c0[0], c0[1]);
    ctx.lineTo(h0[0], h0[1]);
    ctx.stroke();
    ctx.setLineDash([]);

    drawPoly(ctx, stageAt(eu.bStages, t), map, vars["--series-1"], vars["--series-1"], 0.42, 2);
    drawPoly(ctx, stageAt(eu.aStages, t), map, vars["--series-2"], vars["--series-2"], 0.42, 2);
    drawPoly(ctx, eu.triangle, map, vars["--series-4"], vars["--series-4"], 0.5, 2);

    ctx.font = LABEL_FONT;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const tag = (poly, text, color) => {
      const c = centre(poly, map);
      ctx.fillStyle = color;
      ctx.fillText(text, c[0], c[1]);
    };
    tag(stageAt(eu.bStages, t), "b²", vars["--text-primary"]);
    tag(stageAt(eu.aStages, t), "a²", vars["--text-primary"]);

    ctx.setLineDash([6, 4]);
    drawPoly(ctx, eu.cSquare, map, null, vars["--baseline"], 1, 2);
    ctx.setLineDash([]);

    ctx.font = SMALL_FONT;
    ctx.fillStyle = vars["--muted"];
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    const cs = map([eu.c / 2, -eu.c]);
    ctx.fillText("斜辺の上の正方形 c²", cs[0], cs[1] + 6);

    ctx.fillStyle = vars["--text-secondary"];
    const pa = map(eu.A);
    const pb = map(eu.B);
    const pc = map(eu.C);
    const ph = map(eu.H);
    ctx.fillText("A", pa[0] - 12, pa[1] - 10);
    ctx.fillText("B", pb[0] + 12, pb[1] - 10);
    ctx.fillText("C", pc[0], pc[1] - 14);
    ctx.fillText("H", ph[0], ph[1] + 14);
  }

  function renderEuclid() {
    const { na, nb } = ratioParts(Number(eShape.value));
    const t = Number(etSlider.value);
    const stage = t === 0 ? 0 : Math.min(3, Math.ceil(t));
    eStageOut.textContent = STAGE_NAMES[stage];
    eShapeOut.textContent = `${na} : ${nb}`;
    drawEuclid();

    const eu = euclidStages(na, nb);
    eCaption.textContent = eu.captions[stage];
    const areaB = polyArea(stageAt(eu.bStages, t));
    const areaA = polyArea(stageAt(eu.aStages, t));
    eNote.textContent =
      `いま青い図形の面積は ${areaB.toFixed(6)}（= b² = ${nb * nb}）、橙は ${areaA.toFixed(6)}（= a² = ${na * na}）。` +
      `スライダーをどこで止めても、この2つは動きません。せん断も平行移動も面積を変えないからです。` +
      `最後に2つを足すと ${(areaA + areaB).toFixed(0)} = c²。C から斜辺におろした垂線の足 H が、` +
      `c² を b² のぶんと a² のぶんに分けている境目です。`;
  }

  function stopAnim2() {
    if (raf2) cancelAnimationFrame(raf2);
    raf2 = null;
    ePlay.textContent = "流し込む";
  }

  ePlay.addEventListener("click", () => {
    if (raf2) {
      stopAnim2();
      return;
    }
    const from = Number(etSlider.value) >= 2.995 ? 0 : Number(etSlider.value);
    const start = performance.now();
    ePlay.textContent = "止める";
    const step = (now) => {
      const p = Math.min(1, (now - start) / 5200);
      etSlider.value = String(from + (3 - from) * p);
      renderEuclid();
      if (p < 1) raf2 = requestAnimationFrame(step);
      else stopAnim2();
    };
    raf2 = requestAnimationFrame(step);
  });

  etSlider.addEventListener("input", () => {
    stopAnim2();
    renderEuclid();
  });
  eShape.addEventListener("input", () => {
    stopAnim2();
    renderEuclid();
  });

  return {
    show() {},
    hide() {
      stopAnim1();
      stopAnim2();
    },
    redraw() {
      renderRearrange();
      renderEuclid();
    },
  };
}
