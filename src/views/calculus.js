import {
  FUNCTIONS,
  functionByKey,
  secantSlope,
  riemann,
  exactArea,
  areaFunction,
  areaAt,
  RULES,
} from "../calculus.js";
import { readVars, setupCanvasDPR } from "../chart.js";

const $ = (id) => document.getElementById(id);
const TAU = Math.PI * 2;
const TICK_FONT = "11px system-ui, -apple-system, 'Segoe UI', sans-serif";

/** A plot region with its own scales; x is shared between stacked regions. */
function makeRegion(ctx, box, xRange, yRange, vars) {
  const [x0, x1] = xRange;
  const [y0, y1] = yRange;
  const sx = (x) => box.x + ((x - x0) / (x1 - x0)) * box.w;
  const sy = (y) => box.y + box.h - ((y - y0) / (y1 - y0 || 1)) * box.h;

  ctx.strokeStyle = vars["--gridline"];
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.rect(box.x + 0.5, box.y + 0.5, box.w - 1, box.h - 1);
  ctx.stroke();

  // axes only where zero is actually inside the window
  ctx.strokeStyle = vars["--baseline"];
  if (y0 < 0 && y1 > 0) {
    const y = Math.round(sy(0)) + 0.5;
    ctx.beginPath();
    ctx.moveTo(box.x, y);
    ctx.lineTo(box.x + box.w, y);
    ctx.stroke();
  }
  if (x0 < 0 && x1 > 0) {
    const x = Math.round(sx(0)) + 0.5;
    ctx.beginPath();
    ctx.moveTo(x, box.y);
    ctx.lineTo(x, box.y + box.h);
    ctx.stroke();
  }
  return { sx, sy, box, xRange, yRange };
}

function plotCurve(ctx, reg, fn, color, width = 2) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineJoin = "round";
  ctx.beginPath();
  const [x0, x1] = reg.xRange;
  const [y0, y1] = reg.yRange;
  const steps = Math.max(200, Math.round(reg.box.w * 2));
  let started = false;
  for (let i = 0; i <= steps; i++) {
    const x = x0 + ((x1 - x0) * i) / steps;
    const y = fn(x);
    if (!Number.isFinite(y) || y < y0 - (y1 - y0) || y > y1 + (y1 - y0)) {
      started = false;
      continue;
    }
    const px = reg.sx(x);
    const py = reg.sy(Math.max(y0 - 1, Math.min(y1 + 1, y)));
    if (!started) {
      ctx.moveTo(px, py);
      started = true;
    } else ctx.lineTo(px, py);
  }
  ctx.stroke();
}

function labelRegion(ctx, reg, vars, title, yTicks) {
  ctx.fillStyle = vars["--muted"];
  ctx.font = TICK_FONT;
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  for (const t of yTicks) {
    if (t < reg.yRange[0] || t > reg.yRange[1]) continue;
    ctx.fillText(String(t), reg.box.x - 6, reg.sy(t));
  }
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillStyle = vars["--text-secondary"];
  ctx.fillText(title, reg.box.x + 8, reg.box.y + 6);
}

function niceRange(f, x0, x1) {
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i <= 400; i++) {
    const v = f(x0 + ((x1 - x0) * i) / 400);
    if (!Number.isFinite(v)) continue;
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return [-1, 1];
  const padding = (hi - lo) * 0.15 || 1;
  return [lo - padding, hi + padding];
}

const CHROME = [
  "--surface-1",
  "--muted",
  "--gridline",
  "--baseline",
  "--text-primary",
  "--text-secondary",
  "--series-1",
  "--series-2",
  "--series-3",
  "--series-4",
];

export function initCalculusView() {
  const funcSelect = $("caFunc");

  // derivative panel
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

  // integral panel
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
  const ftcNote = $("caFtcNote");

  let fn = functionByKey(funcSelect.value);
  let shrinking = false;
  let animHandle = null;
  let visible = false;

  function clampToDomain() {
    const [lo, hi] = fn.domain;
    x0Slider.min = String(lo);
    x0Slider.max = String(hi);
    aSlider.min = String(lo);
    aSlider.max = String(hi);
    bSlider.min = String(lo);
    bSlider.max = String(hi);
    // A round step, not one derived from the domain: 0.0260 would stop the
    // sliders ever landing exactly on 1.5.
    const step = "0.01";
    x0Slider.step = step;
    aSlider.step = step;
    bSlider.step = step;
    x0Slider.value = String(Math.min(hi, Math.max(lo, Number(x0Slider.value))));
    aSlider.value = String(Math.min(hi, Math.max(lo, Number(aSlider.value))));
    bSlider.value = String(Math.min(hi, Math.max(lo, Number(bSlider.value))));
  }

  /* ------------------------------------------------------- derivative -- */

  function drawDerivative() {
    const { ctx, width, height } = setupCanvasDPR(diffCanvas);
    ctx.clearRect(0, 0, width, height);
    const vars = readVars(diffCanvas.parentElement, CHROME);

    const pad = { top: 10, right: 14, bottom: 26, left: 40 };
    const gap = 14;
    const w = width - pad.left - pad.right;
    const totalH = height - pad.top - pad.bottom - gap;
    if (w <= 0 || totalH <= 0) return;
    const hTop = totalH * 0.58;
    const hBot = totalH - hTop;

    const [xLo, xHi] = fn.domain;
    const x0 = Number(x0Slider.value);
    const h = Number(hSlider.value);

    const topReg = makeRegion(
      ctx,
      { x: pad.left, y: pad.top, w, h: hTop },
      [xLo, xHi],
      niceRange(fn.f, xLo, xHi),
      vars
    );
    const botReg = makeRegion(
      ctx,
      { x: pad.left, y: pad.top + hTop + gap, w, h: hBot },
      [xLo, xHi],
      niceRange(fn.df, xLo, xHi),
      vars
    );

    plotCurve(ctx, topReg, fn.f, vars["--series-1"]);
    plotCurve(ctx, botReg, fn.df, vars["--series-3"]);

    const y0 = fn.f(x0);
    const slopeExact = fn.df(x0);
    const x1 = Math.min(xHi, Math.max(xLo, x0 + h));
    const y1 = fn.f(x1);
    const slopeSecant = secantSlope(fn.f, x0, x1 - x0);

    // tangent (the limit) drawn first, so the secant reads on top of it
    ctx.strokeStyle = vars["--series-4"];
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(topReg.sx(xLo), topReg.sy(y0 + slopeExact * (xLo - x0)));
    ctx.lineTo(topReg.sx(xHi), topReg.sy(y0 + slopeExact * (xHi - x0)));
    ctx.stroke();
    ctx.setLineDash([]);

    if (Number.isFinite(slopeSecant)) {
      ctx.strokeStyle = vars["--series-2"];
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(topReg.sx(xLo), topReg.sy(y0 + slopeSecant * (xLo - x0)));
      ctx.lineTo(topReg.sx(xHi), topReg.sy(y0 + slopeSecant * (xHi - x0)));
      ctx.stroke();

      // the rise-over-run triangle that defines the slope
      ctx.strokeStyle = vars["--muted"];
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(topReg.sx(x0), topReg.sy(y0));
      ctx.lineTo(topReg.sx(x1), topReg.sy(y0));
      ctx.lineTo(topReg.sx(x1), topReg.sy(y1));
      ctx.stroke();
      ctx.setLineDash([]);
    }

    const mark = (reg, x, y, color) => {
      ctx.fillStyle = vars["--surface-1"];
      ctx.beginPath();
      ctx.arc(reg.sx(x), reg.sy(y), 7, 0, TAU);
      ctx.fill();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(reg.sx(x), reg.sy(y), 4.5, 0, TAU);
      ctx.fill();
    };
    mark(topReg, x0, y0, vars["--series-1"]);
    if (Number.isFinite(y1)) mark(topReg, x1, y1, vars["--series-2"]);
    mark(botReg, x0, slopeExact, vars["--series-3"]);

    labelRegion(ctx, topReg, vars, `y = ${fn.label}`, [-4, -2, 0, 2, 4, 6, 8]);
    labelRegion(ctx, botReg, vars, `y′ = ${fn.dfLabel}`, [-6, -3, 0, 3, 6, 9]);

    ctx.fillStyle = vars["--muted"];
    ctx.font = TICK_FONT;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    for (let i = 0; i <= 4; i++) {
      const x = xLo + ((xHi - xLo) * i) / 4;
      ctx.fillText(x.toFixed(1), botReg.sx(x), botReg.box.y + botReg.box.h + 6);
    }

    diffLegend.innerHTML =
      `<span class="legend-item"><span class="legend-dot" style="background:${vars["--series-2"]}"></span>割線（2点を結ぶ直線）</span>` +
      `<span class="legend-item"><span class="legend-dot" style="background:${vars["--series-4"]}"></span>接線（h → 0 の極限）</span>` +
      `<span class="legend-item"><span class="legend-dot" style="background:${vars["--series-3"]}"></span>導関数 y′</span>`;

    statSecant.textContent = Number.isFinite(slopeSecant) ? slopeSecant.toFixed(5) : "—";
    statTangent.textContent = slopeExact.toFixed(5);
    statGap.textContent = Number.isFinite(slopeSecant)
      ? Math.abs(slopeSecant - slopeExact).toFixed(5)
      : "—";
  }

  /* --------------------------------------------------------- integral -- */

  function drawIntegral() {
    const { ctx, width, height } = setupCanvasDPR(intCanvas);
    ctx.clearRect(0, 0, width, height);
    const vars = readVars(intCanvas.parentElement, CHROME);

    const pad = { top: 10, right: 14, bottom: 26, left: 40 };
    const gap = 14;
    const w = width - pad.left - pad.right;
    const totalH = height - pad.top - pad.bottom - gap;
    if (w <= 0 || totalH <= 0) return;
    const hTop = totalH * 0.56;
    const hBot = totalH - hTop;

    const [xLo, xHi] = fn.domain;
    let a = Number(aSlider.value);
    let b = Number(bSlider.value);
    if (b < a) [a, b] = [b, a];
    const n = Number(nSlider.value);
    const rule = ruleSelect.value;

    const area = areaFunction(fn.f, xLo, xHi, 900);
    // S(x) is measured from a, so the vertical range has to come from the
    // shifted values — otherwise the part below the axis (x < a, where the
    // signed area is negative) gets clipped away.
    const offset = areaAt(area, a);
    let aLo = Infinity;
    let aHi = -Infinity;
    for (let i = 0; i < area.xs.length; i += 4) {
      const v = area.ys[i] - offset;
      if (v < aLo) aLo = v;
      if (v > aHi) aHi = v;
    }
    const aPad = (aHi - aLo) * 0.12 || 1;

    const topReg = makeRegion(
      ctx,
      { x: pad.left, y: pad.top, w, h: hTop },
      [xLo, xHi],
      niceRange(fn.f, xLo, xHi),
      vars
    );
    const botReg = makeRegion(
      ctx,
      { x: pad.left, y: pad.top + hTop + gap, w, h: hBot },
      [xLo, xHi],
      [aLo - aPad, aHi + aPad],
      vars
    );

    // rectangles first, so the curve reads on top of them
    if (b > a) {
      const { rects } = riemann(fn.f, a, b, n, rule);
      const baseY = topReg.sy(0);
      ctx.fillStyle = vars["--series-1"];
      ctx.globalAlpha = 0.28;
      ctx.strokeStyle = vars["--series-1"];
      ctx.lineWidth = 1;
      const thin = rects.length > 120;
      for (const r of rects) {
        const px = topReg.sx(r.left);
        const pw = topReg.sx(r.left + r.w) - px;
        const py = topReg.sy(r.height);
        ctx.fillRect(px, Math.min(py, baseY), Math.max(pw - (thin ? 0 : 1), 0.5), Math.abs(baseY - py));
      }
      ctx.globalAlpha = 1;
    }

    plotCurve(ctx, topReg, fn.f, vars["--series-2"]);
    plotCurve(ctx, botReg, (x) => areaAt(area, x) - offset, vars["--series-3"]);

    // The fundamental theorem, drawn: the slope of the area curve at b is the
    // height of f at b. Same number, two different pictures.
    const heightAtB = fn.f(b);
    const sB = areaAt(area, b) - offset;
    const span = (xHi - xLo) * 0.16;
    ctx.strokeStyle = vars["--series-4"];
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(botReg.sx(b - span), botReg.sy(sB - heightAtB * span));
    ctx.lineTo(botReg.sx(b + span), botReg.sy(sB + heightAtB * span));
    ctx.stroke();

    const vline = (reg, x, color) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(reg.sx(x), reg.box.y);
      ctx.lineTo(reg.sx(x), reg.box.y + reg.box.h);
      ctx.stroke();
      ctx.setLineDash([]);
    };
    vline(topReg, a, vars["--muted"]);
    vline(topReg, b, vars["--series-4"]);
    vline(botReg, b, vars["--series-4"]);

    const mark = (reg, x, y, color) => {
      ctx.fillStyle = vars["--surface-1"];
      ctx.beginPath();
      ctx.arc(reg.sx(x), reg.sy(y), 7, 0, TAU);
      ctx.fill();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(reg.sx(x), reg.sy(y), 4.5, 0, TAU);
      ctx.fill();
    };
    mark(topReg, b, heightAtB, vars["--series-2"]);
    mark(botReg, b, sB, vars["--series-3"]);

    labelRegion(ctx, topReg, vars, `y = ${fn.label}`, [-4, -2, 0, 2, 4, 6, 8]);
    labelRegion(ctx, botReg, vars, "S(x) = a から x までの面積", [-6, -3, 0, 3, 6, 9, 12]);

    ctx.fillStyle = vars["--muted"];
    ctx.font = TICK_FONT;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    for (let i = 0; i <= 4; i++) {
      const x = xLo + ((xHi - xLo) * i) / 4;
      ctx.fillText(x.toFixed(1), botReg.sx(x), botReg.box.y + botReg.box.h + 6);
    }

    intLegend.innerHTML =
      `<span class="legend-item"><span class="legend-dot" style="background:${vars["--series-1"]}"></span>短冊（${RULES[rule].label}で高さを取る）</span>` +
      `<span class="legend-item"><span class="legend-dot" style="background:${vars["--series-2"]}"></span>y = ${fn.label}</span>` +
      `<span class="legend-item"><span class="legend-dot" style="background:${vars["--series-3"]}"></span>面積関数 S(x)</span>` +
      `<span class="legend-item"><span class="legend-dot" style="background:${vars["--series-4"]}"></span>S(x) の x = b での接線</span>`;

    const sum = b > a ? riemann(fn.f, a, b, n, rule).total : 0;
    const truth = b > a ? exactArea(fn.f, a, b) : 0;
    statSum.textContent = sum.toFixed(5);
    statExact.textContent = truth.toFixed(5);
    statErr.textContent = Math.abs(sum - truth).toFixed(5);

    ftcNote.innerHTML =
      `x = b での <strong>S(x) の接線の傾き = ${heightAtB.toFixed(4)}</strong> は、` +
      `上のグラフの <strong>f(b) の高さ = ${heightAtB.toFixed(4)}</strong> とぴったり同じ値です。` +
      `これが微積分学の基本定理 <strong>S′(x) = f(x)</strong> ——「面積を微分すると元の関数に戻る」の意味です。`;
  }

  function refresh() {
    x0Out.textContent = Number(x0Slider.value).toFixed(2);
    hOut.textContent = Number(hSlider.value).toFixed(3);
    aOut.textContent = Number(aSlider.value).toFixed(2);
    bOut.textContent = Number(bSlider.value).toFixed(2);
    nOut.textContent = nSlider.value;
    drawDerivative();
    drawIntegral();
  }

  /* ------------------------------------------------------------ h → 0 -- */

  function stopAnim() {
    if (animHandle) cancelAnimationFrame(animHandle);
    animHandle = null;
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
      shrinking = false;
      shrinkBtn.textContent = "h → 0 にする";
      shrinkBtn.classList.add("btn-primary");
      refresh();
      animHandle = null;
      return;
    }
    hSlider.value = String(h);
    refresh();
    animHandle = requestAnimationFrame(shrinkTick);
  }

  shrinkBtn.addEventListener("click", () => {
    if (shrinking) {
      shrinking = false;
      shrinkBtn.textContent = "h → 0 にする";
      shrinkBtn.classList.add("btn-primary");
      stopAnim();
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

  [x0Slider, hSlider].forEach((el) =>
    el.addEventListener("input", () => {
      if (el === hSlider && shrinking) {
        shrinking = false;
        shrinkBtn.textContent = "h → 0 にする";
        shrinkBtn.classList.add("btn-primary");
        stopAnim();
      }
      refresh();
    })
  );
  [aSlider, bSlider, nSlider].forEach((el) => el.addEventListener("input", refresh));
  ruleSelect.addEventListener("change", refresh);

  FUNCTIONS.forEach((f) => {
    const opt = document.createElement("option");
    opt.value = f.key;
    opt.textContent = f.label;
    funcSelect.appendChild(opt);
  });
  funcSelect.value = "sq";
  fn = functionByKey("sq");
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
