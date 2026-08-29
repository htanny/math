import {
  TAYLOR_CASES,
  taylorByKey,
  taylorValue,
  taylorTerms,
  taylorAgreementRadius,
  NEWTON_CASES,
  newtonByKey,
  newtonIterations,
  REVOLUTION_CASES,
  revolutionByKey,
  revolutionDisks,
  baseSlopeAtZero,
  eLimitRow,
} from "../calculusAdv.js";
import { readVars, setupCanvasDPR } from "../chart.js";
import {
  PLOT_CHROME,
  makeRegion,
  plotCurve,
  labelRegion,
  xTickLabels,
  niceRange,
  markPoint,
  vLine,
  slopeLine,
  legendHTML,
  TICK_FONT,
} from "../plot.js";

const $ = (id) => document.getElementById(id);
const TAU = Math.PI * 2;
const fmt = (v, d = 4) => (Number.isFinite(v) ? v.toFixed(d) : "—");

function fillSelect(el, items) {
  items.forEach((it) => {
    const opt = document.createElement("option");
    opt.value = it.key;
    opt.textContent = it.label;
    el.appendChild(opt);
  });
}

export function initCalculusAdvView() {
  /* -------------------------------------------------------------- Taylor */
  const tSelect = $("cvTaylor");
  const tDegree = $("cvDegree");
  const tDegreeOut = $("cvDegreeOut");
  const tPlay = $("cvTaylorPlay");
  const tCanvas = $("cvTaylorCanvas");
  const tLegend = $("cvTaylorLegend");
  const tTerms = $("cvTaylorTerms");
  const tError = $("cvTaylorError");
  const tRadius = $("cvTaylorRadius");
  const tNote = $("cvTaylorNote");

  /* -------------------------------------------------------------- Newton */
  const nSelect = $("cvNewton");
  const nX0 = $("cvNewtonX0");
  const nX0Out = $("cvNewtonX0Out");
  const nSteps = $("cvNewtonSteps");
  const nStepsOut = $("cvNewtonStepsOut");
  const nCanvas = $("cvNewtonCanvas");
  const nLegend = $("cvNewtonLegend");
  const nTableBody = document.querySelector("#cvNewtonTable tbody");
  const nNote = $("cvNewtonNote");

  /* ---------------------------------------------------------- revolution */
  const rSelect = $("cvRev");
  const rN = $("cvRevN");
  const rNOut = $("cvRevNOut");
  const rCanvas = $("cvRevCanvas");
  const rLegend = $("cvRevLegend");
  const rSum = $("cvRevSum");
  const rExact = $("cvRevExact");
  const rErr = $("cvRevErr");
  const rNote = $("cvRevNote");

  /* ------------------------------------------------------------------- e */
  const eBase = $("cvBase");
  const eBaseOut = $("cvBaseOut");
  const eFind = $("cvFindE");
  const eCanvas = $("cvECanvas");
  const eLegend = $("cvELegend");
  const eSlope = $("cvESlope");
  const eLn = $("cvELn");
  const eNote = $("cvENote");
  const eTableBody = document.querySelector("#cvETable tbody");

  let taylorPlaying = false;
  let taylorHandle = null;
  let taylorLast = 0;
  let visible = false;

  /* ==================================================== Taylor polynomials */

  function drawTaylor() {
    const { ctx, width, height } = setupCanvasDPR(tCanvas);
    ctx.clearRect(0, 0, width, height);
    const vars = readVars(tCanvas.parentElement, PLOT_CHROME);

    const spec = taylorByKey(tSelect.value);
    const degree = Number(tDegree.value);
    const [xLo, xHi] = spec.domain;

    const pad = { top: 10, right: 14, bottom: 26, left: 42 };
    const w = width - pad.left - pad.right;
    const h = height - pad.top - pad.bottom;
    if (w <= 0 || h <= 0) return;

    const reg = makeRegion(ctx, { x: pad.left, y: pad.top, w, h }, [xLo, xHi], spec.yRange, vars);

    // the convergence window, when the series has a finite radius
    if (Number.isFinite(spec.radius)) {
      const a = Math.max(xLo, -spec.radius);
      const b = Math.min(xHi, spec.radius);
      ctx.fillStyle = vars["--good"];
      ctx.globalAlpha = 0.07;
      ctx.fillRect(reg.sx(a), reg.box.y, reg.sx(b) - reg.sx(a), reg.box.h);
      ctx.globalAlpha = 1;
      vLine(ctx, reg, -spec.radius, vars["--good"], [3, 4]);
      vLine(ctx, reg, spec.radius, vars["--good"], [3, 4]);
    }

    plotCurve(ctx, reg, spec.f, vars["--series-1"], 2.5);
    plotCurve(ctx, reg, (x) => taylorValue(spec, degree, x), vars["--series-2"], 2);

    markPoint(ctx, reg, 0, spec.f(0), vars["--series-4"], vars, 4);

    labelRegion(ctx, reg, vars, `${spec.label} と ${degree} 次の近似`, [-2, 0, 2, 4, 8, 12]);
    xTickLabels(ctx, reg, vars, 4, 1);

    tLegend.innerHTML = legendHTML([
      [`本物の ${spec.label}`, vars["--series-1"]],
      [`テイラー多項式（${degree} 次）`, vars["--series-2"]],
      Number.isFinite(spec.radius) ? ["収束する範囲", vars["--good"]] : null,
    ]);

    tDegreeOut.textContent = String(degree);
    tTerms.innerHTML = `<code>${taylorTerms(spec, degree)}</code>`;

    const r = taylorAgreementRadius(spec, degree);
    tError.textContent = `|x| < ${r.toFixed(2)}`;
    tRadius.textContent = Number.isFinite(spec.radius) ? String(spec.radius) : "∞";
    tNote.innerHTML =
      `次数を上げるほど、原点のまわりで<strong>一致する範囲が広がっていきます</strong>（いまは |x| &lt; ${r.toFixed(2)} で誤差 0.01 未満）。` +
      `${spec.radiusNote}` +
      (Number.isFinite(spec.radius)
        ? `<br /><strong>ただし次数をいくら上げても、この範囲は収束半径 ${spec.radius} を超えられません。</strong>` +
          `多項式で表せる範囲には限界があるということです。`
        : "") +
      `<br />テイラー多項式は「原点での値・傾き・曲がり方…を順に合わせていく」多項式です。` +
      `n 次の項は f の n 階微分から決まるので、<strong>微分の情報だけで関数全体を復元しようとしている</strong>ことになります。`;
  }

  function stopTaylor() {
    if (taylorHandle) cancelAnimationFrame(taylorHandle);
    taylorHandle = null;
  }

  function taylorTick(now) {
    if (!taylorPlaying || !visible) {
      taylorHandle = null;
      return;
    }
    if (now - taylorLast >= 420) {
      taylorLast = now;
      let d = Number(tDegree.value) + 1;
      if (d > Number(tDegree.max)) d = Number(tDegree.min);
      tDegree.value = String(d);
      drawTaylor();
    }
    taylorHandle = requestAnimationFrame(taylorTick);
  }

  function setTaylorPlaying(next) {
    taylorPlaying = next;
    tPlay.textContent = taylorPlaying ? "停止" : "次数を上げていく";
    tPlay.classList.toggle("btn-primary", !taylorPlaying);
    stopTaylor();
    if (taylorPlaying && visible) {
      taylorLast = 0;
      taylorHandle = requestAnimationFrame(taylorTick);
    }
  }

  /* ======================================================= Newton's method */

  function drawNewton() {
    const { ctx, width, height } = setupCanvasDPR(nCanvas);
    ctx.clearRect(0, 0, width, height);
    const vars = readVars(nCanvas.parentElement, PLOT_CHROME);

    const spec = newtonByKey(nSelect.value);
    const [xLo, xHi] = spec.domain;
    const x0 = Number(nX0.value);
    const steps = Number(nSteps.value);
    const rows = newtonIterations(spec, x0, steps);

    const pad = { top: 10, right: 14, bottom: 26, left: 42 };
    const w = width - pad.left - pad.right;
    const h = height - pad.top - pad.bottom;
    if (w <= 0 || h <= 0) return;

    const reg = makeRegion(
      ctx,
      { x: pad.left, y: pad.top, w, h },
      [xLo, xHi],
      niceRange(spec.f, xLo, xHi),
      vars
    );

    plotCurve(ctx, reg, spec.f, vars["--series-1"], 2.5);

    // the true root, for reference
    vLine(ctx, reg, spec.root, vars["--good"], [3, 4]);

    rows.slice(0, steps).forEach((r, i) => {
      if (!Number.isFinite(r.next)) return;
      const fade = 0.35 + (0.65 * (i + 1)) / steps;
      ctx.globalAlpha = fade;
      slopeLine(ctx, reg, r.x, r.fx, r.dfx, vars["--series-2"], 1.5);
      ctx.globalAlpha = 1;

      // drop from the curve down to the axis at the next iterate
      ctx.strokeStyle = vars["--muted"];
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(reg.sx(r.x), reg.sy(r.fx));
      ctx.lineTo(reg.sx(r.x), reg.sy(0));
      ctx.stroke();
      ctx.setLineDash([]);

      markPoint(ctx, reg, r.x, r.fx, vars["--series-2"], vars, 3.5);
      markPoint(ctx, reg, r.next, 0, vars["--series-4"], vars, 3.5);
    });

    labelRegion(ctx, reg, vars, spec.label, [-8, -4, 0, 4, 8]);
    xTickLabels(ctx, reg, vars, 4, 2);

    nLegend.innerHTML = legendHTML([
      ["y = f(x)", vars["--series-1"]],
      ["各段階の接線", vars["--series-2"]],
      ["接線と x軸の交点（次の値）", vars["--series-4"]],
      ["本当の解", vars["--good"]],
    ]);

    nTableBody.innerHTML = rows
      .map(
        (r) => `<tr>
          <td class="mono">${r.i}</td>
          <td class="mono">${r.x.toFixed(12)}</td>
          <td class="mono">${r.fx.toExponential(2)}</td>
          <td class="mono">${r.error === 0 ? "0" : r.error.toExponential(2)}</td>
        </tr>`
      )
      .join("");

    nNote.innerHTML =
      `いまの点で<strong>接線を引き、その接線が x軸と交わるところを次の点にする</strong>。それだけの手順です。` +
      `<br />誤差の列を見てください。${spec.note} ` +
      `正しい桁数が1回ごとにおよそ<strong>倍</strong>になっています（2次収束）。` +
      `だから3〜4回でほぼ機械の精度に達します。`;
  }

  /* ==================================================== solid of revolution */

  function drawRevolution() {
    const { ctx, width, height } = setupCanvasDPR(rCanvas);
    ctx.clearRect(0, 0, width, height);
    const vars = readVars(rCanvas.parentElement, PLOT_CHROME);

    const spec = revolutionByKey(rSelect.value);
    const [a, b] = spec.defaultRange;
    const n = Number(rN.value);
    const { total, disks } = revolutionDisks(spec, a, b, n);

    const pad = { top: 14, right: 16, bottom: 28, left: 44 };
    const w = width - pad.left - pad.right;
    const h = height - pad.top - pad.bottom;
    if (w <= 0 || h <= 0) return;

    let rMax = 0;
    for (let i = 0; i <= 200; i++) {
      const v = Math.abs(spec.f(a + ((b - a) * i) / 200));
      if (Number.isFinite(v) && v > rMax) rMax = v;
    }
    rMax = rMax || 1;

    const cy = pad.top + h / 2;
    const sx = (x) => pad.left + ((x - a) / (b - a || 1)) * w;
    // Radii are drawn at the same scale vertically, squashed so the solid fits.
    const sr = (r) => (r / rMax) * (h / 2) * 0.92;
    // Horizontal squash for the ellipse that stands in for a circular face.
    const ellipseW = Math.max(3, (w / Math.max(n, 1)) * 0.42);

    ctx.strokeStyle = vars["--baseline"];
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad.left, cy);
    ctx.lineTo(pad.left + w, cy);
    ctx.stroke();

    // the disks, drawn back to front as ellipses
    for (const d of disks) {
      const r = sr(Math.abs(d.r));
      if (r <= 0.2) continue;
      const cx = sx(d.mid);
      ctx.fillStyle = vars["--series-1"];
      ctx.globalAlpha = 0.16;
      ctx.beginPath();
      ctx.ellipse(cx, cy, Math.max(ellipseW, 2), r, 0, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 0.55;
      ctx.strokeStyle = vars["--series-1"];
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(cx, cy, Math.max(ellipseW, 2), r, 0, 0, TAU);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // the generating curve and its mirror image
    for (const sign of [1, -1]) {
      ctx.strokeStyle = vars["--series-2"];
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i <= 300; i++) {
        const x = a + ((b - a) * i) / 300;
        const y = cy - sign * sr(spec.f(x));
        if (i === 0) ctx.moveTo(sx(x), y);
        else ctx.lineTo(sx(x), y);
      }
      ctx.stroke();
    }

    ctx.fillStyle = vars["--muted"];
    ctx.font = TICK_FONT;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    for (let i = 0; i <= 4; i++) {
      const x = a + ((b - a) * i) / 4;
      ctx.fillText(x.toFixed(2), sx(x), pad.top + h + 6);
    }

    rLegend.innerHTML = legendHTML([
      ["積み重ねた円盤", vars["--series-1"]],
      [`回転させる曲線 y = ${spec.label.split("（")[0]}`, vars["--series-2"]],
    ]);

    rNOut.textContent = String(n);
    rSum.textContent = fmt(total, 5);
    rExact.textContent = fmt(spec.exact, 5);
    rErr.textContent = fmt(Math.abs(total - spec.exact), 5);
    rNote.innerHTML =
      `x のところで薄さ Δx の円盤を切ると、その断面は半径 f(x) の円なので体積は <code>π·f(x)²·Δx</code>。` +
      `それを足し合わせたものが <code>V = ∫ π f(x)² dx</code> です。` +
      `<br />いまの円盤の合計 <strong>${fmt(total, 5)}</strong> に対し、厳密な値は <strong>${spec.exactLabel} = ${fmt(spec.exact, 5)}</strong>。` +
      `円盤の数を増やすと一致していきます。<strong>「断面積を積分すると体積」</strong>——これが数学IIIの体積計算の正体です。`;
  }

  /* ================================================================== e == */

  function drawE() {
    const { ctx, width, height } = setupCanvasDPR(eCanvas);
    ctx.clearRect(0, 0, width, height);
    const vars = readVars(eCanvas.parentElement, PLOT_CHROME);

    const a = Number(eBase.value);
    const pad = { top: 10, right: 14, bottom: 26, left: 42 };
    const w = width - pad.left - pad.right;
    const h = height - pad.top - pad.bottom;
    if (w <= 0 || h <= 0) return;

    const reg = makeRegion(ctx, { x: pad.left, y: pad.top, w, h }, [-2, 2], [-0.5, 6], vars);

    // y = x + 1 : the line every candidate is being compared against
    slopeLine(ctx, reg, 0, 1, 1, vars["--good"], 1.5, [5, 4]);

    plotCurve(ctx, reg, (x) => Math.pow(a, x), vars["--series-1"], 2.5);

    const slope = baseSlopeAtZero(a);
    slopeLine(ctx, reg, 0, 1, slope, vars["--series-2"], 2);
    markPoint(ctx, reg, 0, 1, vars["--series-2"], vars);

    labelRegion(ctx, reg, vars, `y = ${a.toFixed(4)}ˣ`, [0, 1, 2, 4, 6]);
    xTickLabels(ctx, reg, vars, 4, 1);

    eLegend.innerHTML = legendHTML([
      [`y = aˣ（a = ${a.toFixed(4)}）`, vars["--series-1"]],
      ["x = 0 での接線", vars["--series-2"]],
      ["傾き 1 の基準線 y = x + 1", vars["--good"]],
    ]);

    eBaseOut.textContent = a.toFixed(4);
    eSlope.textContent = fmt(slope, 6);
    eLn.textContent = fmt(Math.log(a), 6);

    const diff = Math.abs(slope - 1);
    eNote.innerHTML =
      `<code>aˣ</code> の x = 0 での接線の傾きは <strong>${fmt(slope, 6)}</strong>。これはちょうど <code>log a</code>（＝ ${fmt(Math.log(a), 6)}）です。` +
      `<br />a を動かして<strong>この傾きがちょうど 1 になる場所</strong>を探してください。そこが <code>e = 2.718281…</code> です。` +
      (diff < 0.002
        ? `<br /><strong>いまほぼ 1 になっています。</strong>傾きが 1 ということは、そこで <code>(aˣ)′ = aˣ</code> —— ` +
          `つまり <strong>微分しても変わらない関数</strong>。e が特別なのは、天下りに決めた定数だからではなく、この条件で決まる数だからです。`
        : `<br />傾きが 1 になるとき <code>(aˣ)′ = aˣ</code>、つまり<strong>微分しても形が変わらない</strong>関数になります。`);

    eTableBody.innerHTML = [1, 2, 5, 10, 100, 1000, 10000, 1000000]
      .map((n) => {
        const row = eLimitRow(n);
        return `<tr>
          <td class="mono">${n.toLocaleString("en-US")}</td>
          <td class="mono">${row.value.toFixed(9)}</td>
          <td class="mono">${row.gap.toExponential(2)}</td>
        </tr>`;
      })
      .join("");
  }

  /* ============================================================= wiring == */

  function refresh() {
    nX0Out.textContent = Number(nX0.value).toFixed(3);
    nStepsOut.textContent = nSteps.value;
    drawTaylor();
    drawNewton();
    drawRevolution();
    drawE();
  }

  fillSelect(tSelect, TAYLOR_CASES);
  fillSelect(nSelect, NEWTON_CASES);
  fillSelect(rSelect, REVOLUTION_CASES);

  function clampNewton() {
    const spec = newtonByKey(nSelect.value);
    nX0.min = String(spec.domain[0]);
    nX0.max = String(spec.domain[1]);
    nX0.step = "0.01";
    nX0.value = String(Math.min(spec.domain[1], Math.max(spec.domain[0], Number(nX0.value))));
  }

  tSelect.addEventListener("change", () => {
    setTaylorPlaying(false);
    drawTaylor();
  });
  tDegree.addEventListener("input", () => {
    setTaylorPlaying(false);
    drawTaylor();
  });
  tPlay.addEventListener("click", () => setTaylorPlaying(!taylorPlaying));

  nSelect.addEventListener("change", () => {
    clampNewton();
    refresh();
  });
  [nX0, nSteps].forEach((el) => el.addEventListener("input", refresh));

  rSelect.addEventListener("change", refresh);
  rN.addEventListener("input", refresh);

  eBase.addEventListener("input", drawE);
  eFind.addEventListener("click", () => {
    eBase.value = String(Math.E.toFixed(4));
    drawE();
  });

  clampNewton();

  return {
    show() {
      visible = true;
      if (taylorPlaying) setTaylorPlaying(true);
    },
    hide() {
      visible = false;
      stopTaylor();
    },
    redraw() {
      refresh();
    },
  };
}
