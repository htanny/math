import {
  FUNCTIONS,
  functionByKey,
  secantSlope,
  riemann,
  exactArea,
  areaFunction,
  areaAt,
  shapeOf,
  monotonicityTable,
  meanValuePoints,
  SHAPE_LABEL,
  RULES,
} from "../calculus.js";
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
} from "../plot.js";

const $ = (id) => document.getElementById(id);
const fmt = (v, d = 3) => (Number.isFinite(v) ? v.toFixed(d) : "—");

/** Stack of plot regions sharing one x-axis. */
function stack(ctx, pad, width, height, xRange, specs, vars) {
  const gap = 13;
  const w = width - pad.left - pad.right;
  const total = height - pad.top - pad.bottom - gap * (specs.length - 1);
  if (w <= 0 || total <= 0) return null;
  const regions = [];
  let y = pad.top;
  for (const spec of specs) {
    const h = total * spec.frac;
    regions.push(makeRegion(ctx, { x: pad.left, y, w, h }, xRange, spec.yRange, vars));
    y += h + gap;
  }
  return regions;
}

export function initCalculusView() {
  const funcSelect = $("caFunc");

  // panel 1: secant -> tangent
  const x0Slider = $("caX0");
  const x0Out = $("caX0Out");
  const hSlider = $("caH");
  const hOut = $("caHOut");
  const shrinkBtn = $("caShrink");
  const diffCanvas = $("caDiffCanvas");
  const diffLegend = $("caDiffLegend");
  const statSecant = $("caSecant");
  const statTangent = $("caTangent");
  const statGap = $("caGap");

  // panel 2: shape of the graph
  const shapeCanvas = $("caShapeCanvas");
  const shapeLegend = $("caShapeLegend");
  const shapeTableBody = document.querySelector("#caShapeTable tbody");
  const shapeSummary = $("caShapeSummary");

  // panel 3: mean value theorem
  const mvtA = $("caMvtA");
  const mvtAOut = $("caMvtAOut");
  const mvtB = $("caMvtB");
  const mvtBOut = $("caMvtBOut");
  const mvtCanvas = $("caMvtCanvas");
  const mvtLegend = $("caMvtLegend");
  const mvtSlope = $("caMvtSlope");
  const mvtC = $("caMvtC");
  const mvtNote = $("caMvtNote");

  // panel 4: integral
  const aSlider = $("caA");
  const aOut = $("caAOut");
  const bSlider = $("caB");
  const bOut = $("caBOut");
  const nSlider = $("caN");
  const nOut = $("caNOut");
  const ruleSelect = $("caRule");
  const intCanvas = $("caIntCanvas");
  const intLegend = $("caIntLegend");
  const statSum = $("caSum");
  const statExact = $("caExact");
  const statErr = $("caErr");
  const statSigned = $("caSigned");
  const riemannFormula = $("caRiemann");
  const ftcNote = $("caFtcNote");

  let fn = functionByKey("sq");
  let shrinking = false;
  let animHandle = null;
  let visible = false;

  function clampToDomain() {
    const [lo, hi] = fn.domain;
    for (const el of [x0Slider, aSlider, bSlider, mvtA, mvtB]) {
      el.min = String(lo);
      el.max = String(hi);
      el.step = "0.01";
      el.value = String(Math.min(hi, Math.max(lo, Number(el.value))));
    }
    // keep the two intervals sensible for the new domain
    if (Number(bSlider.value) <= Number(aSlider.value)) {
      aSlider.value = String(lo + (hi - lo) * 0.25);
      bSlider.value = String(lo + (hi - lo) * 0.75);
    }
    if (Number(mvtB.value) <= Number(mvtA.value)) {
      mvtA.value = String(lo + (hi - lo) * 0.15);
      mvtB.value = String(lo + (hi - lo) * 0.85);
    }
  }

  /* ------------------------------------------ panel 1: secant -> tangent -- */

  function drawDerivative() {
    const { ctx, width, height } = setupCanvasDPR(diffCanvas);
    ctx.clearRect(0, 0, width, height);
    const vars = readVars(diffCanvas.parentElement, PLOT_CHROME);
    const [xLo, xHi] = fn.domain;

    const regs = stack(
      ctx,
      { top: 10, right: 14, bottom: 26, left: 42 },
      width,
      height,
      [xLo, xHi],
      [
        { frac: 0.58, yRange: niceRange(fn.f, xLo, xHi) },
        { frac: 0.42, yRange: niceRange(fn.df, xLo, xHi) },
      ],
      vars
    );
    if (!regs) return;
    const [top, bot] = regs;

    plotCurve(ctx, top, fn.f, vars["--series-1"]);
    plotCurve(ctx, bot, fn.df, vars["--series-3"]);

    const x0 = Number(x0Slider.value);
    const h = Number(hSlider.value);
    const y0 = fn.f(x0);
    const exact = fn.df(x0);
    const x1 = Math.min(xHi, Math.max(xLo, x0 + h));
    const y1 = fn.f(x1);
    const sec = secantSlope(fn.f, x0, x1 - x0);

    slopeLine(ctx, top, x0, y0, exact, vars["--series-4"], 2, [5, 4]);
    if (Number.isFinite(sec)) {
      slopeLine(ctx, top, x0, y0, sec, vars["--series-2"], 2);
      ctx.strokeStyle = vars["--muted"];
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(top.sx(x0), top.sy(y0));
      ctx.lineTo(top.sx(x1), top.sy(y0));
      ctx.lineTo(top.sx(x1), top.sy(y1));
      ctx.stroke();
      ctx.setLineDash([]);
    }

    markPoint(ctx, top, x0, y0, vars["--series-1"], vars);
    if (Number.isFinite(y1)) markPoint(ctx, top, x1, y1, vars["--series-2"], vars);
    markPoint(ctx, bot, x0, exact, vars["--series-3"], vars);

    labelRegion(ctx, top, vars, `y = ${fn.label}`, [-8, -4, -2, 0, 2, 4, 8]);
    labelRegion(ctx, bot, vars, `y′ = ${fn.dfLabel}`, [-9, -6, -3, 0, 3, 6, 9]);
    xTickLabels(ctx, bot, vars);

    diffLegend.innerHTML = legendHTML([
      ["割線（2点を結ぶ直線）", vars["--series-2"]],
      ["接線（h → 0 の極限）", vars["--series-4"]],
      ["導関数 y′", vars["--series-3"]],
    ]);

    statSecant.textContent = fmt(sec, 5);
    statTangent.textContent = fmt(exact, 5);
    statGap.textContent = Number.isFinite(sec) ? fmt(Math.abs(sec - exact), 5) : "—";
  }

  /* --------------------------------------- panel 2: shape and the table -- */

  function drawShape() {
    const { ctx, width, height } = setupCanvasDPR(shapeCanvas);
    ctx.clearRect(0, 0, width, height);
    const vars = readVars(shapeCanvas.parentElement, PLOT_CHROME);
    const [xLo, xHi] = fn.domain;

    const regs = stack(
      ctx,
      { top: 10, right: 14, bottom: 26, left: 42 },
      width,
      height,
      [xLo, xHi],
      [
        { frac: 0.44, yRange: niceRange(fn.f, xLo, xHi) },
        { frac: 0.28, yRange: niceRange(fn.df, xLo, xHi) },
        { frac: 0.28, yRange: niceRange(fn.d2f, xLo, xHi) },
      ],
      vars
    );
    if (!regs) return;
    const [rf, rd1, rd2] = regs;

    const { stationary, inflections } = shapeOf(fn);

    // guide lines tying the three graphs together at the interesting x values
    for (const p of stationary) {
      for (const r of regs) vLine(ctx, r, p.x, vars["--series-2"], [3, 4]);
    }
    for (const p of inflections) {
      for (const r of regs) vLine(ctx, r, p.x, vars["--series-4"], [2, 5]);
    }

    plotCurve(ctx, rf, fn.f, vars["--series-1"]);
    plotCurve(ctx, rd1, fn.df, vars["--series-3"]);
    plotCurve(ctx, rd2, fn.d2f, vars["--series-4"]);

    for (const p of stationary) {
      markPoint(ctx, rf, p.x, p.y, vars["--series-2"], vars);
      markPoint(ctx, rd1, p.x, 0, vars["--series-2"], vars, 3.5);
    }
    for (const p of inflections) {
      markPoint(ctx, rf, p.x, p.y, vars["--series-4"], vars, 3.5);
      markPoint(ctx, rd2, p.x, 0, vars["--series-4"], vars, 3.5);
    }

    labelRegion(ctx, rf, vars, `y = ${fn.label}`, [-8, -4, 0, 4, 8]);
    labelRegion(ctx, rd1, vars, `y′ = ${fn.dfLabel}`, [-6, 0, 6]);
    labelRegion(ctx, rd2, vars, `y″ = ${fn.d2fLabel}`, [-6, 0, 6]);
    xTickLabels(ctx, rd2, vars);

    shapeLegend.innerHTML = legendHTML([
      ["極値（y′ = 0 で符号が変わる）", vars["--series-2"]],
      ["変曲点（y″ = 0 で符号が変わる）", vars["--series-4"]],
    ]);

    renderShapeTable();
  }

  function renderShapeTable() {
    const { rows, stationary, inflections } = monotonicityTable(fn);
    const cuts = [];
    for (const p of stationary) cuts.push({ x: p.x, kind: SHAPE_LABEL[p.kind] });
    for (const p of inflections) cuts.push({ x: p.x, kind: "変曲点" });
    cuts.sort((a, b) => a.x - b.x);

    const cells = [];
    rows.forEach((r, i) => {
      cells.push(`<tr>
        <td class="mono">${r.lo.toFixed(3)} 〜 ${r.hi.toFixed(3)}</td>
        <td class="mono">${r.dfSign > 0 ? "＋" : r.dfSign < 0 ? "−" : "0"}</td>
        <td class="mono">${r.d2fSign > 0 ? "＋" : r.d2fSign < 0 ? "−" : "0"}</td>
        <td>${r.dfSign > 0 ? "増加" : r.dfSign < 0 ? "減少" : "一定"}・${r.d2fSign > 0 ? "下に凸" : r.d2fSign < 0 ? "上に凸" : "—"}</td>
      </tr>`);
      const cut = cuts[i];
      if (cut) {
        cells.push(`<tr class="row-accent">
          <td class="mono">x = ${cut.x.toFixed(4)}</td><td colspan="3">${cut.kind}</td>
        </tr>`);
      }
    });
    shapeTableBody.innerHTML = cells.join("");

    const st = stationary
      .map((p) => `x = ${p.x.toFixed(4)}（${SHAPE_LABEL[p.kind]}）`)
      .join("、");
    const inf = inflections.map((p) => `x = ${p.x.toFixed(4)}`).join("、");
    shapeSummary.innerHTML =
      `<strong>極値</strong>: ${st || "この範囲にはありません"}　／　` +
      `<strong>変曲点</strong>: ${inf || "この範囲にはありません"}。` +
      `y′ の符号が変わるところが極値、y″ の符号が変わるところが変曲点です。3つのグラフの縦線が同じ x で揃っているのを確かめてください。`;
  }

  /* ------------------------------------------ panel 3: mean value theorem -- */

  function drawMvt() {
    const { ctx, width, height } = setupCanvasDPR(mvtCanvas);
    ctx.clearRect(0, 0, width, height);
    const vars = readVars(mvtCanvas.parentElement, PLOT_CHROME);
    const [xLo, xHi] = fn.domain;

    let a = Number(mvtA.value);
    let b = Number(mvtB.value);
    if (b < a) [a, b] = [b, a];

    const regs = stack(
      ctx,
      { top: 10, right: 14, bottom: 26, left: 42 },
      width,
      height,
      [xLo, xHi],
      [{ frac: 1, yRange: niceRange(fn.f, xLo, xHi) }],
      vars
    );
    if (!regs) return;
    const [reg] = regs;

    plotCurve(ctx, reg, fn.f, vars["--series-1"]);

    const { slope, points } = meanValuePoints(fn, a, b);

    vLine(ctx, reg, a, vars["--muted"]);
    vLine(ctx, reg, b, vars["--muted"]);

    // the chord
    if (Number.isFinite(slope)) {
      ctx.strokeStyle = vars["--series-2"];
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(reg.sx(a), reg.sy(fn.f(a)));
      ctx.lineTo(reg.sx(b), reg.sy(fn.f(b)));
      ctx.stroke();
      markPoint(ctx, reg, a, fn.f(a), vars["--series-2"], vars);
      markPoint(ctx, reg, b, fn.f(b), vars["--series-2"], vars);
    }

    // every tangent parallel to it
    for (const p of points) {
      slopeLine(ctx, reg, p.x, p.y, slope, vars["--series-4"], 2, [6, 4]);
      markPoint(ctx, reg, p.x, p.y, vars["--series-4"], vars);
    }

    labelRegion(ctx, reg, vars, `y = ${fn.label}`, [-8, -4, 0, 4, 8]);
    xTickLabels(ctx, reg, vars);

    mvtLegend.innerHTML = legendHTML([
      ["割線（a と b を結ぶ）", vars["--series-2"]],
      ["割線と平行な接線", vars["--series-4"]],
    ]);

    mvtSlope.textContent = fmt(slope, 5);
    mvtC.textContent = points.length ? points.map((p) => p.x.toFixed(4)).join("、") : "—";
    mvtNote.innerHTML = points.length
      ? `区間 [${a.toFixed(2)}, ${b.toFixed(2)}] のどこかに、<strong>接線の傾きが割線とちょうど同じ</strong>になる点 c があります` +
        `（ここでは ${points.length} 個）。a・b をどう動かしても必ず見つかる — これが平均値の定理です。` +
        `f(a) = f(b) の場合が特にロルの定理で、そのとき傾きは 0、つまり水平な接線になります。`
      : "区間の幅を広げてください（a < b が必要です）。";
  }

  /* ------------------------------------------------ panel 4: the integral -- */

  function drawIntegral() {
    const { ctx, width, height } = setupCanvasDPR(intCanvas);
    ctx.clearRect(0, 0, width, height);
    const vars = readVars(intCanvas.parentElement, PLOT_CHROME);
    const [xLo, xHi] = fn.domain;

    let a = Number(aSlider.value);
    let b = Number(bSlider.value);
    if (b < a) [a, b] = [b, a];
    const n = Number(nSlider.value);
    const rule = ruleSelect.value;

    const area = areaFunction(fn.f, xLo, xHi, 900);
    const offset = areaAt(area, a);
    let aLo = Infinity;
    let aHi = -Infinity;
    for (let i = 0; i < area.xs.length; i += 4) {
      const v = area.ys[i] - offset;
      if (v < aLo) aLo = v;
      if (v > aHi) aHi = v;
    }
    const aPad = (aHi - aLo) * 0.12 || 1;

    const regs = stack(
      ctx,
      { top: 10, right: 14, bottom: 26, left: 42 },
      width,
      height,
      [xLo, xHi],
      [
        { frac: 0.56, yRange: niceRange(fn.f, xLo, xHi) },
        { frac: 0.44, yRange: [aLo - aPad, aHi + aPad] },
      ],
      vars
    );
    if (!regs) return;
    const [top, bot] = regs;

    let positive = 0;
    let negative = 0;
    if (b > a) {
      const { rects } = riemann(fn.f, a, b, n, rule);
      const baseY = top.sy(0);
      const thin = rects.length > 120;
      for (const r of rects) {
        // Signed area: strips below the axis subtract, and are coloured to say so.
        const up = r.height >= 0;
        if (up) positive += r.height * r.w;
        else negative += r.height * r.w;
        ctx.fillStyle = up ? vars["--series-1"] : vars["--series-2"];
        ctx.globalAlpha = 0.3;
        const px = top.sx(r.left);
        const pw = top.sx(r.left + r.w) - px;
        const py = top.sy(r.height);
        ctx.fillRect(px, Math.min(py, baseY), Math.max(pw - (thin ? 0 : 1), 0.5), Math.abs(baseY - py));
        ctx.globalAlpha = 1;
      }
    }

    plotCurve(ctx, top, fn.f, vars["--series-3"]);
    plotCurve(ctx, bot, (x) => areaAt(area, x) - offset, vars["--series-3"]);

    const heightAtB = fn.f(b);
    const sB = areaAt(area, b) - offset;
    const span = (xHi - xLo) * 0.16;
    ctx.strokeStyle = vars["--series-4"];
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(bot.sx(b - span), bot.sy(sB - heightAtB * span));
    ctx.lineTo(bot.sx(b + span), bot.sy(sB + heightAtB * span));
    ctx.stroke();

    vLine(ctx, top, a, vars["--muted"]);
    vLine(ctx, top, b, vars["--series-4"]);
    vLine(ctx, bot, b, vars["--series-4"]);
    markPoint(ctx, top, b, heightAtB, vars["--series-3"], vars);
    markPoint(ctx, bot, b, sB, vars["--series-3"], vars);

    labelRegion(ctx, top, vars, `y = ${fn.label}`, [-8, -4, 0, 4, 8]);
    labelRegion(ctx, bot, vars, "S(x) = a から x までの符号付き面積", [-9, -6, -3, 0, 3, 6, 9, 12]);
    xTickLabels(ctx, bot, vars);

    intLegend.innerHTML = legendHTML([
      ["x軸より上の短冊（正）", vars["--series-1"]],
      ["x軸より下の短冊（負）", vars["--series-2"]],
      [`y = ${fn.label} と面積関数 S(x)`, vars["--series-3"]],
      ["S(x) の x = b での接線", vars["--series-4"]],
    ]);

    const sum = b > a ? riemann(fn.f, a, b, n, rule).total : 0;
    const truth = b > a ? exactArea(fn.f, a, b) : 0;
    statSum.textContent = fmt(sum, 5);
    statExact.textContent = fmt(truth, 5);
    statErr.textContent = fmt(Math.abs(sum - truth), 5);
    statSigned.textContent = `＋${fmt(positive, 3)} / −${fmt(Math.abs(negative), 3)}`;

    const w = b > a ? (b - a) / n : 0;
    riemannFormula.innerHTML =
      `<code>Σ<sub>k=1..n</sub> f(x<sub>k</sub>)·Δx</code> ＝ 短冊の合計。ここでは ` +
      `<code>Δx = (b − a)/n = ${fmt(w, 4)}</code>、<code>n = ${n}</code>。` +
      `n → ∞ でこれが <code>∫<sub>a</sub><sup>b</sup> f(x)dx</code> になります。` +
      `特に区間が [0, 1] のときは <code>lim (1/n)·Σ f(k/n) = ∫₀¹ f(x)dx</code> — ` +
      `<strong>数列の和の極限が定積分になる</strong>という、入試で頻出の形です。`;

    ftcNote.innerHTML =
      `x = b での <strong>S(x) の接線の傾き = ${fmt(heightAtB, 4)}</strong> は、` +
      `上のグラフの <strong>f(b) の高さ = ${fmt(heightAtB, 4)}</strong> とぴったり同じ値です。` +
      `これが微積分学の基本定理 <strong>S′(x) = f(x)</strong> ——「面積を微分すると元の関数に戻る」の意味です。`;
  }

  /* ------------------------------------------------------------- wiring -- */

  function refresh() {
    x0Out.textContent = Number(x0Slider.value).toFixed(2);
    hOut.textContent = Number(hSlider.value).toFixed(3);
    aOut.textContent = Number(aSlider.value).toFixed(2);
    bOut.textContent = Number(bSlider.value).toFixed(2);
    nOut.textContent = nSlider.value;
    mvtAOut.textContent = Number(mvtA.value).toFixed(2);
    mvtBOut.textContent = Number(mvtB.value).toFixed(2);
    drawDerivative();
    drawShape();
    drawMvt();
    drawIntegral();
  }

  function stopAnim() {
    if (animHandle) cancelAnimationFrame(animHandle);
    animHandle = null;
  }

  function endShrink() {
    shrinking = false;
    shrinkBtn.textContent = "h → 0 にする";
    shrinkBtn.classList.add("btn-primary");
    stopAnim();
  }

  function shrinkTick() {
    if (!shrinking || !visible) {
      animHandle = null;
      return;
    }
    const h = Number(hSlider.value) * 0.93;
    const min = Number(hSlider.min);
    if (h <= min) {
      hSlider.value = String(min);
      endShrink();
      refresh();
      return;
    }
    hSlider.value = String(h);
    refresh();
    animHandle = requestAnimationFrame(shrinkTick);
  }

  shrinkBtn.addEventListener("click", () => {
    if (shrinking) {
      endShrink();
      return;
    }
    hSlider.value = hSlider.max;
    shrinking = true;
    shrinkBtn.textContent = "停止";
    shrinkBtn.classList.remove("btn-primary");
    stopAnim();
    animHandle = requestAnimationFrame(shrinkTick);
  });

  funcSelect.addEventListener("change", () => {
    fn = functionByKey(funcSelect.value);
    clampToDomain();
    refresh();
  });

  hSlider.addEventListener("input", () => {
    if (shrinking) endShrink();
    refresh();
  });
  [x0Slider, aSlider, bSlider, nSlider, mvtA, mvtB].forEach((el) =>
    el.addEventListener("input", refresh)
  );
  ruleSelect.addEventListener("change", refresh);

  FUNCTIONS.forEach((f) => {
    const opt = document.createElement("option");
    opt.value = f.key;
    opt.textContent = f.label;
    funcSelect.appendChild(opt);
  });
  funcSelect.value = "cubic";
  fn = functionByKey("cubic");
  clampToDomain();

  return {
    show() {
      visible = true;
    },
    hide() {
      visible = false;
      stopAnim();
    },
    redraw() {
      refresh();
    },
  };
}
