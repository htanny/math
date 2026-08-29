import {
  ROUGH_FUNCTIONS,
  roughByKey,
  oneSidedSlope,
  slopeLadder,
  DEFINITION_CASES,
  definitionByKey,
  PRODUCT_PAIRS,
  productByKey,
  productPieces,
  CHAIN_CASES,
  chainByKey,
  chainStep,
} from "../calculusDeep.js";
import { readVars, setupCanvasDPR } from "../chart.js";
import {
  PLOT_CHROME,
  makeRegion,
  plotCurve,
  labelRegion,
  xTickLabels,
  niceRange,
  markPoint,
  slopeLine,
  legendHTML,
  TICK_FONT,
} from "../plot.js";

const $ = (id) => document.getElementById(id);
const fmt = (v, d = 4) => (Number.isFinite(v) ? v.toFixed(d) : "—");

function fillSelect(el, items) {
  items.forEach((it) => {
    const opt = document.createElement("option");
    opt.value = it.key;
    opt.textContent = it.label;
    el.appendChild(opt);
  });
}

export function initCalculusDeepView() {
  /* ------------------------------------------- where differentiation fails */
  const roughSelect = $("cdRough");
  const roughH = $("cdRoughH");
  const roughHOut = $("cdRoughHOut");
  const roughCanvas = $("cdRoughCanvas");
  const roughLegend = $("cdRoughLegend");
  const roughLeft = $("cdRoughLeft");
  const roughRight = $("cdRoughRight");
  const roughVerdict = $("cdRoughVerdict");
  const roughNote = $("cdRoughNote");
  const roughTableBody = document.querySelector("#cdRoughTable tbody");

  /* ------------------------------------------------ the limit definition */
  const defSelect = $("cdDef");
  const defX = $("cdDefX");
  const defXOut = $("cdDefXOut");
  const defH = $("cdDefH");
  const defHOut = $("cdDefHOut");
  const defSteps = $("cdDefSteps");
  const defNumeric = $("cdDefNumeric");

  /* --------------------------------------------------------- product rule */
  const prodSelect = $("cdProd");
  const prodX = $("cdProdX");
  const prodXOut = $("cdProdXOut");
  const prodDx = $("cdProdDx");
  const prodDxOut = $("cdProdDxOut");
  const prodCanvas = $("cdProdCanvas");
  const prodLegend = $("cdProdLegend");
  const prodFdg = $("cdProdFdg");
  const prodGdf = $("cdProdGdf");
  const prodCorner = $("cdProdCorner");
  const prodNote = $("cdProdNote");

  /* ----------------------------------------------------------- chain rule */
  const chainSelect = $("cdChain");
  const chainX = $("cdChainX");
  const chainXOut = $("cdChainXOut");
  const chainDx = $("cdChainDx");
  const chainDxOut = $("cdChainDxOut");
  const chainCanvas = $("cdChainCanvas");
  const chainInner = $("cdChainInner");
  const chainOuter = $("cdChainOuter");
  const chainProduct = $("cdChainProduct");
  const chainNote = $("cdChainNote");

  /* ===================================================== rough functions == */

  function drawRough() {
    const { ctx, width, height } = setupCanvasDPR(roughCanvas);
    ctx.clearRect(0, 0, width, height);
    const vars = readVars(roughCanvas.parentElement, PLOT_CHROME);

    const spec = roughByKey(roughSelect.value);
    const [xLo, xHi] = spec.domain;
    const h = Number(roughH.value);

    const pad = { top: 10, right: 14, bottom: 26, left: 42 };
    const w = width - pad.left - pad.right;
    const hh = height - pad.top - pad.bottom;
    if (w <= 0 || hh <= 0) return;

    const reg = makeRegion(
      ctx,
      { x: pad.left, y: pad.top, w, h: hh },
      [xLo, xHi],
      niceRange(spec.f, xLo, xHi, 1200),
      vars
    );

    plotCurve(ctx, reg, spec.f, vars["--series-1"]);

    const a = spec.at;
    const ya = spec.f(a);
    const left = oneSidedSlope(spec.f, a, -h);
    const right = oneSidedSlope(spec.f, a, h);

    if (Number.isFinite(left)) slopeLine(ctx, reg, a, ya, left, vars["--series-2"], 2);
    if (Number.isFinite(right)) slopeLine(ctx, reg, a, ya, right, vars["--series-3"], 2);

    markPoint(ctx, reg, a - h, spec.f(a - h), vars["--series-2"], vars);
    markPoint(ctx, reg, a + h, spec.f(a + h), vars["--series-3"], vars);
    markPoint(ctx, reg, a, ya, vars["--text-primary"], vars, 5);

    labelRegion(ctx, reg, vars, `y = ${spec.label}`, [-1, -0.5, 0, 0.5, 1]);
    xTickLabels(ctx, reg, vars, 4, 2);

    roughLegend.innerHTML = legendHTML([
      ["左からの割線", vars["--series-2"]],
      ["右からの割線", vars["--series-3"]],
    ]);

    roughLeft.textContent = fmt(left, 4);
    roughRight.textContent = fmt(right, 4);
    const ok = spec.verdict === "differentiable";
    roughVerdict.textContent = ok ? "微分できる" : "微分できない";
    roughVerdict.style.color = ok ? vars["--good"] : vars["--series-2"];
    roughNote.textContent = spec.note;

    roughTableBody.innerHTML = slopeLadder(spec.f, a, 0.5, 8)
      .map(
        (r) => `<tr>
          <td class="mono">${r.h.toExponential(1)}</td>
          <td class="mono">${fmt(r.left, 4)}</td>
          <td class="mono">${fmt(r.right, 4)}</td>
        </tr>`
      )
      .join("");
  }

  /* ================================================= the limit definition == */

  function renderDefinition() {
    const spec = definitionByKey(defSelect.value);
    const x = Number(defX.value);
    const h = Number(defH.value);

    defSteps.innerHTML = spec.steps
      .map(
        (s, i) => `<li class="${i === 3 ? "step-key" : ""}">
          <code>${s.expr}</code><span class="step-note">${s.note}</span>
        </li>`
      )
      .join("");

    const approx = spec.approx(x, h);
    const exact = spec.df(x);
    const quotient = (spec.f(x + h) - spec.f(x)) / h;
    defNumeric.innerHTML =
      `x = <strong>${x.toFixed(2)}</strong>、h = <strong>${h.toFixed(4)}</strong> のとき` +
      `<br />差分商をそのまま計算: <code>${fmt(quotient, 6)}</code>` +
      `<br />約分した式 <code>${spec.approxLabel}</code> の値: <code>${fmt(approx, 6)}</code>` +
      `<br />h → 0 の答え <code>${spec.result}</code> の値: <code>${fmt(exact, 6)}</code>` +
      `<br /><span class="note">約分した式と差分商が同じ値になることに注目してください。` +
      `<strong>h ≠ 0 のあいだは同じ式</strong>なので約分してよく、そのあとで h → 0 とできる —— これが極限の計算の中身です。</span>`;
  }

  /* ======================================================== product rule == */

  function drawProduct() {
    const { ctx, width, height } = setupCanvasDPR(prodCanvas);
    ctx.clearRect(0, 0, width, height);
    const vars = readVars(prodCanvas.parentElement, PLOT_CHROME);

    const pair = productByKey(prodSelect.value);
    const x = Number(prodX.value);
    const dx = Number(prodDx.value);
    const p = productPieces(pair, x, dx);

    const pad = { top: 26, right: 16, bottom: 30, left: 46 };
    const w = width - pad.left - pad.right;
    const hh = height - pad.top - pad.bottom;
    if (w <= 0 || hh <= 0) return;

    // Scale so the grown rectangle always fits with room for labels.
    const maxF = Math.max(p.f0, p.f1) * 1.25;
    const maxG = Math.max(p.g0, p.g1) * 1.25;
    const sx = (v) => pad.left + (v / maxF) * w;
    const sy = (v) => pad.top + hh - (v / maxG) * hh;

    const x0 = sx(0);
    const y0 = sy(0);
    const xf0 = sx(p.f0);
    const xf1 = sx(p.f1);
    const yg0 = sy(p.g0);
    const yg1 = sy(p.g1);

    const box = (xa, ya, xb, yb, color, alpha) => {
      ctx.fillStyle = color;
      ctx.globalAlpha = alpha;
      ctx.fillRect(Math.min(xa, xb), Math.min(ya, yb), Math.abs(xb - xa), Math.abs(yb - ya));
      ctx.globalAlpha = 1;
    };

    // fg (the original), f·dg (on top), g·df (to the right), df·dg (the corner)
    box(x0, y0, xf0, yg0, vars["--muted"], 0.22);
    box(x0, yg0, xf0, yg1, vars["--series-1"], 0.42);
    box(xf0, y0, xf1, yg0, vars["--series-3"], 0.42);
    box(xf0, yg0, xf1, yg1, vars["--series-2"], 0.65);

    ctx.strokeStyle = vars["--baseline"];
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x0, Math.min(y0, yg1), xf1 - x0, Math.abs(yg1 - y0));

    ctx.fillStyle = vars["--text-secondary"];
    ctx.font = TICK_FONT;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    if (Math.abs(xf0 - x0) > 40 && Math.abs(yg0 - y0) > 24) {
      ctx.fillText("f · g", (x0 + xf0) / 2, (y0 + yg0) / 2);
    }
    if (Math.abs(xf0 - x0) > 40 && Math.abs(yg1 - yg0) > 14) {
      ctx.fillText("f · dg", (x0 + xf0) / 2, (yg0 + yg1) / 2);
    }
    if (Math.abs(xf1 - xf0) > 34 && Math.abs(yg0 - y0) > 24) {
      ctx.fillText("g · df", (xf0 + xf1) / 2, (y0 + yg0) / 2);
    }

    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    ctx.fillStyle = vars["--muted"];
    ctx.fillText(`f = ${pair.fLabel}  →`, pad.left, pad.top - 8);
    ctx.save();
    ctx.translate(pad.left - 30, pad.top + hh);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(`g = ${pair.gLabel}  →`, 0, 0);
    ctx.restore();

    prodLegend.innerHTML = legendHTML([
      ["もとの面積 f·g", vars["--muted"]],
      ["f · dg（上に伸びた分）", vars["--series-1"]],
      ["g · df（右に伸びた分）", vars["--series-3"]],
      ["df · dg（角の小さな長方形）", vars["--series-2"]],
    ]);

    prodFdg.textContent = fmt(p.fdg, 5);
    prodGdf.textContent = fmt(p.gdf, 5);
    prodCorner.textContent = fmt(p.corner, 6);

    const share = Math.abs(p.total) > 1e-12 ? (Math.abs(p.corner) / Math.abs(p.total)) * 100 : 0;
    prodNote.innerHTML =
      `増えた面積の内訳は <code>f·dg + g·df + df·dg</code>。角の <strong>df·dg は全体の ${share.toFixed(2)}%</strong> しかありません。` +
      `dx を小さくしていくとこの割合はどんどん 0 に近づきます —— <strong>2次の微小量だから無視できる</strong>、というのがここで起きていることです。` +
      `<br />公式の値 <code>f′g + fg′ = ${fmt(p.ruleSlope, 5)}</code> ／ 実際の差分商 <code>${fmt(p.actualSlope, 5)}</code>。dx → 0 で一致します。`;
  }

  /* ========================================================== chain rule == */

  function drawChain() {
    const { ctx, width, height } = setupCanvasDPR(chainCanvas);
    ctx.clearRect(0, 0, width, height);
    const vars = readVars(chainCanvas.parentElement, PLOT_CHROME);

    const c = chainByKey(chainSelect.value);
    const x = Number(chainX.value);
    const dx = Number(chainDx.value);
    const s = chainStep(c, x, dx);

    const pad = { top: 30, right: 30, bottom: 26, left: 30 };
    const w = width - pad.left - pad.right;
    const hh = height - pad.top - pad.bottom;
    if (w <= 0 || hh <= 0) return;

    // three horizontal number lines: x, then u, then y
    const uRange = niceRange(c.inner, c.domain[0], c.domain[1], 400, 0.1);
    const yRange = niceRange((t) => c.outer(c.inner(t)), c.domain[0], c.domain[1], 400, 0.1);
    const lines = [
      { label: `x（もとの変数）`, range: c.domain, at: x, delta: dx, color: vars["--series-1"] },
      { label: `${c.innerLabel}`, range: uRange, at: s.u, delta: s.du, color: vars["--series-3"] },
      { label: `${c.outerLabel}`, range: yRange, at: s.y, delta: s.dy, color: vars["--series-2"] },
    ];

    const rowH = hh / 3;
    ctx.font = TICK_FONT;
    lines.forEach((ln, i) => {
      const y = pad.top + rowH * i + rowH * 0.55;
      const [lo, hi] = ln.range;
      const sx = (v) => pad.left + ((v - lo) / (hi - lo || 1)) * w;

      ctx.strokeStyle = vars["--baseline"];
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(pad.left + w, y);
      ctx.stroke();

      ctx.fillStyle = vars["--text-secondary"];
      ctx.textAlign = "left";
      ctx.textBaseline = "bottom";
      ctx.fillText(ln.label, pad.left, y - 14);

      ctx.fillStyle = vars["--muted"];
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(lo.toFixed(2), pad.left, y + 6);
      ctx.fillText(hi.toFixed(2), pad.left + w, y + 6);

      // the increment, drawn as a bar from the current value
      const xa = sx(ln.at);
      const xb = sx(ln.at + ln.delta);
      ctx.strokeStyle = ln.color;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(xa, y);
      ctx.lineTo(xb, y);
      ctx.stroke();

      ctx.fillStyle = vars["--surface-1"];
      ctx.beginPath();
      ctx.arc(xa, y, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = ln.color;
      ctx.beginPath();
      ctx.arc(xa, y, 4.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = vars["--text-primary"];
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      const mid = (xa + xb) / 2;
      const tag = i === 0 ? "Δx" : i === 1 ? "Δu" : "Δy";
      ctx.fillText(`${tag} = ${ln.delta.toFixed(4)}`, mid, y - 12);

      // arrow down to the next line
      if (i < 2) {
        ctx.strokeStyle = vars["--muted"];
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(xa, y + 10);
        ctx.lineTo(sx === null ? xa : xa, y + rowH - 20);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    });

    chainInner.textContent = fmt(s.dInner, 5);
    chainOuter.textContent = fmt(s.dOuter, 5);
    chainProduct.textContent = fmt(s.product, 5);

    chainNote.innerHTML =
      `x が <code>Δx = ${dx.toFixed(4)}</code> 動くと、u はその <strong>${fmt(s.dInner, 4)} 倍</strong>だけ動き` +
      `（<code>Δu ≈ ${fmt(s.dInner * dx, 5)}</code>、実際 <code>${fmt(s.du, 5)}</code>）、` +
      `y はさらにその <strong>${fmt(s.dOuter, 4)} 倍</strong>動きます。` +
      `<br />だから x から y への変化率は <strong>2つの倍率の掛け算</strong>: ` +
      `<code>dy/du × du/dx = ${fmt(s.dOuter, 4)} × ${fmt(s.dInner, 4)} = ${fmt(s.product, 5)}</code>。` +
      `実際の差分商は <code>${fmt(s.actual, 5)}</code> で、Δx を小さくすると一致していきます。これが連鎖律です。`;
  }

  /* ============================================================= wiring == */

  function syncOutputs() {
    roughHOut.textContent = Number(roughH.value).toFixed(4);
    defXOut.textContent = Number(defX.value).toFixed(2);
    defHOut.textContent = Number(defH.value).toFixed(4);
    prodXOut.textContent = Number(prodX.value).toFixed(2);
    prodDxOut.textContent = Number(prodDx.value).toFixed(3);
    chainXOut.textContent = Number(chainX.value).toFixed(2);
    chainDxOut.textContent = Number(chainDx.value).toFixed(3);
  }

  function refresh() {
    syncOutputs();
    drawRough();
    renderDefinition();
    drawProduct();
    drawChain();
  }

  fillSelect(roughSelect, ROUGH_FUNCTIONS);
  fillSelect(defSelect, DEFINITION_CASES);
  fillSelect(prodSelect, PRODUCT_PAIRS);
  fillSelect(chainSelect, CHAIN_CASES);

  function clampProduct() {
    const pair = productByKey(prodSelect.value);
    prodX.min = String(pair.domain[0]);
    prodX.max = String(pair.domain[1] - 0.3);
    prodX.value = String(
      Math.min(Number(prodX.max), Math.max(Number(prodX.min), Number(prodX.value)))
    );
  }

  function clampChain() {
    const c = chainByKey(chainSelect.value);
    chainX.min = String(c.domain[0]);
    chainX.max = String(c.domain[1]);
    chainX.value = String(
      Math.min(Number(chainX.max), Math.max(Number(chainX.min), Number(chainX.value)))
    );
  }

  function clampDef() {
    const spec = definitionByKey(defSelect.value);
    // 1/x and sqrt(x) need x away from 0
    const needsPositive = spec.key === "recip" || spec.key === "sqrt";
    defX.min = needsPositive ? "0.4" : "-2";
    defX.max = "2.5";
    defX.value = String(Math.min(2.5, Math.max(Number(defX.min), Number(defX.value))));
  }

  roughSelect.addEventListener("change", refresh);
  defSelect.addEventListener("change", () => {
    clampDef();
    refresh();
  });
  prodSelect.addEventListener("change", () => {
    clampProduct();
    refresh();
  });
  chainSelect.addEventListener("change", () => {
    clampChain();
    refresh();
  });
  [roughH, defX, defH, prodX, prodDx, chainX, chainDx].forEach((el) =>
    el.addEventListener("input", refresh)
  );

  clampDef();
  clampProduct();
  clampChain();

  return {
    show() {},
    redraw() {
      refresh();
    },
  };
}
