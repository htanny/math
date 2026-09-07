import { readVars, setupCanvasDPR } from "../chart.js";
import { labelRegion, makeRegion, markPoint, plotCurve, xTickLabels } from "../plot.js";
import {
  A_VALUES, LINE_PRESETS, discriminant, fy, intersections, rateFromDefinition,
  rateShortcut, secant, tangentSlope, triangleArea,
} from "../quadratic.js";

const $ = (id) => document.getElementById(id);
const LABEL_FONT = "13px system-ui, -apple-system, 'Segoe UI', sans-serif";
const SMALL_FONT = "11px system-ui, -apple-system, 'Segoe UI', sans-serif";

const num = (v, d = 2) => (Object.is(v, -0) ? 0 : v).toFixed(d).replace(/^-/, "−");
/** Coefficient of x², as a textbook writes it: 1 and −1 lose the digit. */
const aStr = (a) => (a === 1 ? "" : a === -1 ? "−" : String(a).replace("-", "−"));
/** a standing alone as a number, where "1" must not vanish. */
const aNum = (a) => String(a).replace("-", "−");
/** "+ 2.0x" / "− 2.0x", so a negative coefficient never prints as "− −2.0x". */
const term = (v, suffix = "", d = 1) =>
  `${v < 0 ? "−" : "+"} ${Math.abs(v).toFixed(d)}${suffix}`;
/** Wrap a negative in brackets when it sits inside a product. */
const factor = (v, d = 2) => (v < 0 ? `(${num(v, d)})` : num(v, d));

/** Text with a halo, so it survives being drawn on top of a curve. */
function haloText(ctx, vars, text, x, y) {
  const fill = ctx.fillStyle;
  ctx.strokeStyle = vars["--surface-1"];
  ctx.lineWidth = 3.5;
  ctx.lineJoin = "round";
  ctx.strokeText(text, x, y);
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
}

/**
 * Label a point above it, or below when that would fall outside the frame.
 * Haloed in the surface colour: the labels land exactly where the curve and
 * the line meet, which is the least legible spot on the picture.
 */
function pointLabel(ctx, box, x, y, text, vars) {
  const above = y - 9 > box.y + 12;
  const cx = Math.min(Math.max(x, box.x + 12), box.x + box.w - 12);
  const cy = y + (above ? -9 : 9);
  ctx.textAlign = "center";
  ctx.textBaseline = above ? "bottom" : "top";
  haloText(ctx, vars, text, cx, cy);
}

/** Draw inside the plot frame only — steep lines otherwise run over the labels. */
function withClip(ctx, box, fn) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(box.x, box.y, box.w, box.h);
  ctx.clip();
  fn();
  ctx.restore();
}

export function initQuadraticView() {
  /* ------------------------------------------------ panel 1: rate of change -- */
  const aSlider = $("qdA");
  const pSlider = $("qdP");
  const qSlider = $("qdQ");
  const aOut = $("qdAOut");
  const pOut = $("qdPOut");
  const qOut = $("qdQOut");
  const rateCanvas = $("qdRateCanvas");
  const rateNote = $("qdRateNote");
  const statDef = $("qdRateDef");
  const statShort = $("qdRateShort");
  const statPoints = $("qdPoints");
  const rateSteps = $("qdRateSteps");
  const slideBtn = $("qdSlide");
  const shrinkBtn = $("qdShrink");
  const trailToggle = $("qdTrail");

  /** Slopes measured earlier, so "it changes with where you measure" persists. */
  const trail = [];
  let raf = null;

  const aOf = (slider) => A_VALUES[Number(slider.value)];

  function stopAnim() {
    if (raf) cancelAnimationFrame(raf);
    raf = null;
    slideBtn.textContent = "同じ幅のまま右へ動かす";
    shrinkBtn.textContent = "Q を P に近づける";
  }

  function drawRate() {
    const { ctx, width, height } = setupCanvasDPR(rateCanvas);
    ctx.clearRect(0, 0, width, height);
    const vars = readVars(rateCanvas.parentElement, [
      "--surface-1", "--muted", "--gridline", "--baseline", "--text-primary",
      "--text-secondary", "--series-1", "--series-2", "--series-3", "--series-4",
    ]);

    const a = aOf(aSlider);
    const p = Number(pSlider.value);
    const q = Number(qSlider.value);

    const box = { x: 46, y: 14, w: width - 60, h: height - 46 };
    // a fixed window keeps the parabola from rescaling as the points move,
    // which is what makes the change in steepness visible at all
    const span = 4.4;
    const yLo = a > 0 ? -0.12 * a * span * span : -1.05 * a * span * span;
    const yHi = a > 0 ? 1.05 * a * span * span : 0.12 * -a * span * span;
    const reg = makeRegion(ctx, box, [-span, span], [yLo, yHi], vars);

    withClip(ctx, box, () => plotCurve(ctx, reg, (x) => fy(a, x), vars["--series-1"], 2.2));

    if (trailToggle.checked) {
      ctx.lineWidth = 1;
      for (const t of trail) {
        ctx.strokeStyle = vars["--series-4"];
        ctx.globalAlpha = 0.3;
        ctx.beginPath();
        ctx.moveTo(reg.sx(t.p), reg.sy(fy(t.a, t.p)));
        ctx.lineTo(reg.sx(t.q), reg.sy(fy(t.a, t.q)));
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }

    // the step triangle: across (q − p), up (f(q) − f(p)) — the slope, drawn
    const yp = fy(a, p);
    const yq = fy(a, q);
    if (p !== q) {
      ctx.strokeStyle = vars["--series-3"];
      ctx.setLineDash([4, 3]);
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(reg.sx(p), reg.sy(yp));
      ctx.lineTo(reg.sx(q), reg.sy(yp));
      ctx.lineTo(reg.sx(q), reg.sy(yq));
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = vars["--text-secondary"];
      ctx.font = SMALL_FONT;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      haloText(ctx, vars, `よこ ${num(q - p, 1)}`, reg.sx((p + q) / 2), reg.sy(yp) + 4);
      // Normally the height label sits to the right of the vertical leg. Near
      // the frame edge there is no room, so it moves inside — and then down
      // towards P, because at the leg's midpoint the secant runs straight
      // through it.
      const nearRight = reg.sx(q) > box.x + box.w - 70;
      const at = nearRight ? 0.18 : 0.5;
      ctx.textAlign = nearRight ? "right" : "left";
      ctx.textBaseline = "middle";
      haloText(
        ctx,
        vars,
        `たて ${num(yq - yp, 1)}`,
        reg.sx(q) + (nearRight ? -6 : 6),
        reg.sy(yp + (yq - yp) * at)
      );

      const s = secant(a, p, q);
      withClip(ctx, box, () => {
        ctx.strokeStyle = vars["--series-2"];
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(reg.sx(-span), reg.sy(s.slope * -span + s.intercept));
        ctx.lineTo(reg.sx(span), reg.sy(s.slope * span + s.intercept));
        ctx.stroke();
      });
    }

    markPoint(ctx, reg, p, yp, vars["--series-2"], vars, 5.5);
    markPoint(ctx, reg, q, yq, vars["--series-3"], vars, 5.5);
    ctx.fillStyle = vars["--text-primary"];
    ctx.font = LABEL_FONT;
    pointLabel(ctx, box, reg.sx(p), reg.sy(yp), "P", vars);
    pointLabel(ctx, box, reg.sx(q), reg.sy(yq), "Q", vars);

    labelRegion(ctx, reg, vars, `y = ${aStr(a)}x²`, []);
    xTickLabels(ctx, reg, vars, 4, 0);
  }

  function renderRate() {
    const a = aOf(aSlider);
    const p = Number(pSlider.value);
    const q = Number(qSlider.value);
    aOut.textContent = String(a).replace("-", "−");
    pOut.textContent = num(p, 1);
    qOut.textContent = num(q, 1);

    drawRate();

    const same = Math.abs(q - p) < 1e-9;
    const def = rateFromDefinition(a, p, q);
    const short = rateShortcut(a, p, q);
    statDef.textContent = same ? "—" : num(def);
    statShort.textContent = num(short);
    statPoints.textContent = `(${num(p, 1)}, ${num(fy(a, p))}) と (${num(q, 1)}, ${num(fy(a, q))})`;

    const here = rateShortcut(a, p, q);
    const shifted = rateShortcut(a, p + 2, q + 2);
    rateNote.textContent = same
      ? "P と Q が重なっています。q を動かすと変化の割合が出ます。"
      : `いまの区間の変化の割合は ${num(here)}。同じ幅のまま 2 だけ右へずらすと ${num(shifted)} になります。` +
        `一次関数なら動かしても変わりませんが、放物線では傾きぐあいそのものが場所で違うので変わります。` +
        (trail.length > 1 ? `（残した線の傾きを見くらべてください。）` : "");

    rateSteps.innerHTML = [
      `<li><code>(f(q) − f(p)) ÷ (q − p)</code>` +
        `<span class="step-note">= (${num(fy(a, q))} − ${num(fy(a, p))}) ÷ ${num(q - p, 1)}${
          same ? "" : ` = ${num(def)}`
        }</span></li>`,
      `<li><code>a q² − a p² = a(q + p)(q − p)</code>` +
        `<span class="step-note">分子が因数分解できるのがポイント。ここで (q − p) が約分されます</span></li>`,
      `<li class="step-key"><code>変化の割合 = a(p + q) = ${aNum(a)} × (${num(p, 1)} + ${num(q, 1)}) = ${num(short)}</code>` +
        `<span class="step-note">2 点の x 座標を足して a を掛けるだけ。y 座標を求める必要はありません</span></li>`,
      `<li><code>q → p のとき a(p + q) → 2ap = ${num(tangentSlope(a, p))}</code>` +
        `<span class="step-note">Q を P に近づけたときの行き先が、高校でいう接線の傾きです</span></li>`,
    ].join("");
  }

  function pushTrail() {
    trail.push({ a: aOf(aSlider), p: Number(pSlider.value), q: Number(qSlider.value) });
    if (trail.length > 10) trail.shift();
  }

  for (const el of [aSlider, pSlider, qSlider]) {
    el.addEventListener("input", () => {
      stopAnim();
      renderRate();
    });
  }
  trailToggle.addEventListener("change", () => {
    if (!trailToggle.checked) trail.length = 0;
    renderRate();
  });

  slideBtn.addEventListener("click", () => {
    if (raf) return stopAnim(), renderRate();
    const p0 = Number(pSlider.value);
    const w = Number(qSlider.value) - p0;
    const from = -3.6;
    const to = 3.6 - Math.abs(w);
    trail.length = 0;
    const start = performance.now();
    slideBtn.textContent = "止める";
    const step = (now) => {
      const t = Math.min(1, (now - start) / 4200);
      const p = from + (to - from) * t;
      pSlider.value = String(p.toFixed(1));
      qSlider.value = String((p + Math.abs(w)).toFixed(1));
      if (trailToggle.checked && trail.length < 10 && Math.floor(t * 10) > trail.length - 1) pushTrail();
      renderRateKeepingAnim();
      if (t < 1) raf = requestAnimationFrame(step);
      else stopAnim();
    };
    raf = requestAnimationFrame(step);
  });

  shrinkBtn.addEventListener("click", () => {
    if (raf) return stopAnim(), renderRate();
    const p = Number(pSlider.value);
    const q0 = Number(qSlider.value);
    const start = performance.now();
    shrinkBtn.textContent = "止める";
    const step = (now) => {
      const t = Math.min(1, (now - start) / 3000);
      // ease towards p without ever reaching it, so the slope stays defined
      const q = p + (q0 - p) * Math.pow(1 - t, 3) * 0.999 + Math.sign(q0 - p) * 0.05;
      qSlider.value = String(q.toFixed(1));
      renderRateKeepingAnim();
      if (t < 1) raf = requestAnimationFrame(step);
      else stopAnim();
    };
    raf = requestAnimationFrame(step);
  });

  // the animations drive the sliders, so they need render without the stop
  function renderRateKeepingAnim() {
    renderRate();
  }

  /* --------------------------------------- panel 2: parabola meets a line -- */
  const a2Slider = $("qdA2");
  const mSlider = $("qdM");
  const nSlider = $("qdN");
  const a2Out = $("qdA2Out");
  const mOut = $("qdMOut");
  const nOut = $("qdNOut");
  const lineCanvas = $("qdLineCanvas");
  const lineNote = $("qdLineNote");
  const statCount = $("qdCount");
  const statRoots = $("qdRoots");
  const statArea = $("qdArea");
  const solveSteps = $("qdSolveSteps");
  const presetHost = $("qdPresets");

  function drawLine() {
    const { ctx, width, height } = setupCanvasDPR(lineCanvas);
    ctx.clearRect(0, 0, width, height);
    const vars = readVars(lineCanvas.parentElement, [
      "--surface-1", "--muted", "--gridline", "--baseline", "--text-primary",
      "--text-secondary", "--series-1", "--series-2", "--series-3", "--good",
    ]);

    const a = aOf(a2Slider);
    const m = Number(mSlider.value);
    const n = Number(nSlider.value);
    const pts = intersections(a, m, n);

    const box = { x: 46, y: 14, w: width - 60, h: height - 46 };
    const span = 4.4;
    // The window is set by what the picture is about — the two intersections,
    // the y-intercept and the origin (the triangle's third corner) — not by how
    // far the parabola climbs at the edge of the x-window. Fitting the whole
    // parabola squashes the answer into a sliver; the arms may leave the frame.
    const marks = [0, n, m * 2 + n, -m * 2 + n, fy(a, 2), ...pts.map((pt) => pt.y)];
    let lo = Math.min(...marks);
    let hi = Math.max(...marks);
    const pad = (hi - lo) * 0.16 || 1;
    const reg = makeRegion(ctx, box, [-span, span], [lo - pad, hi + pad], vars);

    if (pts.length === 2) {
      ctx.fillStyle = vars["--good"];
      ctx.globalAlpha = 0.18;
      ctx.beginPath();
      ctx.moveTo(reg.sx(0), reg.sy(0));
      ctx.lineTo(reg.sx(pts[0].x), reg.sy(pts[0].y));
      ctx.lineTo(reg.sx(pts[1].x), reg.sy(pts[1].y));
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    withClip(ctx, box, () => {
      plotCurve(ctx, reg, (x) => fy(a, x), vars["--series-1"], 2.2);
      ctx.strokeStyle = vars["--series-2"];
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(reg.sx(-span), reg.sy(m * -span + n));
      ctx.lineTo(reg.sx(span), reg.sy(m * span + n));
      ctx.stroke();
    });

    ctx.font = LABEL_FONT;
    const names = ["A", "B"];
    pts.forEach((pt, i) => {
      markPoint(ctx, reg, pt.x, pt.y, vars["--series-3"], vars, 5.5);
      ctx.fillStyle = vars["--text-primary"];
      pointLabel(ctx, box, reg.sx(pt.x), reg.sy(pt.y), pts.length === 1 ? "接点" : names[i], vars);
      // drop a line to the axis: the x-coordinate is the answer
      ctx.strokeStyle = vars["--series-3"];
      ctx.setLineDash([3, 3]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(reg.sx(pt.x), reg.sy(pt.y));
      ctx.lineTo(reg.sx(pt.x), reg.sy(0));
      ctx.stroke();
      ctx.setLineDash([]);
    });
    if (pts.length === 2) markPoint(ctx, reg, 0, 0, vars["--muted"], vars, 4);

    labelRegion(ctx, reg, vars, `y = ${aStr(a)}x²  と  y = ${num(m, 1)}x ${n < 0 ? "−" : "+"} ${num(Math.abs(n), 1)}`, []);
    xTickLabels(ctx, reg, vars, 4, 0);
  }

  function renderLine() {
    const a = aOf(a2Slider);
    const m = Number(mSlider.value);
    const n = Number(nSlider.value);
    a2Out.textContent = String(a).replace("-", "−");
    mOut.textContent = num(m, 1);
    nOut.textContent = num(n, 1);

    drawLine();

    const d = discriminant(a, m, n);
    const pts = intersections(a, m, n);
    const area = triangleArea(a, m, n);

    statCount.textContent =
      pts.length === 2 ? `2 個（D = ${num(d)} > 0）`
      : pts.length === 1 ? `1 個・接する（D = 0）`
      : `0 個（D = ${num(d)} < 0）`;
    statRoots.textContent = pts.length ? pts.map((p) => num(p.x)).join(" と ") : "実数解なし";
    statArea.textContent = area === null ? "—" : num(area);

    lineNote.textContent =
      pts.length === 2
        ? `交点の x 座標 ${pts.map((p) => num(p.x)).join(" と ")} は、${aStr(a)}x² = ${num(m, 1)}x ${term(
            n,
          )} を解いた答えそのものです。` +
          `緑の三角形 △OAB の面積は ${num(area)} ——「½ × |切片| × 交点の x の差」で出せます。`
        : pts.length === 1
        ? `D = 0 なので重解。放物線と直線が「接する」とは、二次方程式の解が 1 つに重なることです。`
        : `D = ${num(d)} < 0 なので実数解なし。図の上では、直線が放物線に届いていません。`;

    solveSteps.innerHTML = [
      `<li><code>${aStr(a)}x² = ${num(m, 1)}x ${term(n)}</code>` +
        `<span class="step-note">交点は「両方の式を満たす点」なので、y を消して x だけの式にします</span></li>`,
      `<li><code>${aStr(a)}x² ${term(-m, "x")} ${term(-n)} = 0</code>` +
        `<span class="step-note">= 0 の形に移項する</span></li>`,
      `<li class="step-key"><code>D = m² + 4an = ${factor(m)}² + 4 × ${factor(a)} × ${factor(n)} = ${num(d)}</code>` +
        `<span class="step-note">${
          d > 0 ? "正なので解は 2 つ、つまり交点も 2 つ" : d === 0 ? "0 なので重解、つまり接する" : "負なので実数解なし、つまり交わらない"
        }</span></li>`,
      pts.length
        ? `<li class="step-key"><code>x = ${pts.map((p) => num(p.x)).join(", ")}</code>` +
          `<span class="step-note">この x を y = ${aStr(a)}x² に戻すと交点の y 座標 ${pts
            .map((p) => num(p.y))
            .join(", ")} が出ます</span></li>`
        : `<li><code>実数解なし</code><span class="step-note">解がないことと交点がないことは同じ事実です</span></li>`,
    ].join("");
  }

  for (const el of [a2Slider, mSlider, nSlider]) el.addEventListener("input", renderLine);

  presetHost.innerHTML = LINE_PRESETS.map(
    (p, i) => `<button type="button" class="chip" data-i="${i}">${p.label}</button>`
  ).join("");
  presetHost.addEventListener("click", (evt) => {
    const btn = evt.target.closest("button[data-i]");
    if (!btn) return;
    const p = LINE_PRESETS[Number(btn.dataset.i)];
    a2Slider.value = String(A_VALUES.indexOf(p.a));
    mSlider.value = String(p.m);
    nSlider.value = String(p.n);
    renderLine();
    lineNote.textContent = p.note;
  });

  return {
    show() {},
    hide() {
      stopAnim();
    },
    redraw() {
      renderRate();
      renderLine();
    },
  };
}
