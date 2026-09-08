import { readVars, setupCanvasDPR } from "../chart.js";
import {
  FACTOR_PRESETS, PATTERNS, candidateTable, cutAndMove, expandCoefs, factorQuadratic,
  factoredString, quadraticString, tiles,
} from "../expand.js";

const $ = (id) => document.getElementById(id);
const LABEL_FONT = "13px system-ui, -apple-system, 'Segoe UI', sans-serif";
const SMALL_FONT = "11px system-ui, -apple-system, 'Segoe UI', sans-serif";

const sign = (v) => (v < 0 ? `− ${-v}` : `+ ${v}`);
const num = (v, d = 2) => v.toFixed(d);

/** Draw text with a soft ground behind it so it stays legible over a shape. */
function haloLabel(ctx, vars, text, x, y) {
  ctx.font = SMALL_FONT;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const w = ctx.measureText(text).width + 8;
  ctx.globalAlpha = 0.82;
  ctx.fillStyle = vars["--surface-1"];
  ctx.fillRect(x - w / 2, y - 8, w, 16);
  ctx.globalAlpha = 1;
  ctx.fillStyle = vars["--text-primary"];
  ctx.fillText(text, x, y);
}

export function initExpandView() {
  /* ----------------------------------------------------------- 展開 -- */
  const patternHost = $("exPatterns");
  const aSlider = $("exA");
  const bSlider = $("exB");
  const xSlider = $("exX");
  const aOut = $("exAOut");
  const bOut = $("exBOut");
  const xOut = $("exXOut");
  const canvas = $("exCanvas");
  const note = $("exNote");
  const statPoly = $("exPoly");
  const statArea = $("exArea");
  const statSum = $("exSum");
  const steps = $("exSteps");
  const moveSlider = $("exMove");
  const moveOut = $("exMoveOut");
  const movePlay = $("exMovePlay");

  let patternNote = PATTERNS[0].note;
  let mode = PATTERNS[0].mode;
  let raf = null;

  /**
   * The four tiles at their real sizes.
   *
   * a and b are kept at or above zero here on purpose: a negative length
   * cannot be drawn, and pretending otherwise makes the pieces overlap the
   * square they are supposed to be taken from. The one case where a negative
   * matters — (x + a)(x − a) — gets its own picture below.
   */
  function drawTiles(ctx, width, height, vars, a, b, x) {
    const spanW = x + b;
    const spanH = x + a;
    const pad = 54;
    const unit = Math.min((width - pad * 2) / spanW, (height - pad * 2) / spanH);
    const ox = pad + (width - pad * 2 - spanW * unit) / 2;
    const oy = height - pad - (height - pad * 2 - spanH * unit) / 2;
    const px = (v) => ox + v * unit;
    const py = (v) => oy - v * unit;

    const parts = [
      { x: 0, y: 0, w: x, h: x, colour: vars["--series-1"], label: "x·x" },
      { x, y: 0, w: b, h: x, colour: vars["--series-3"], label: `${b}·x` },
      { x: 0, y: x, w: x, h: a, colour: vars["--series-2"], label: `${a}·x` },
      { x, y: x, w: b, h: a, colour: vars["--series-4"], label: String(a * b) },
    ];
    for (const t of parts) {
      if (t.w <= 0 || t.h <= 0) continue;
      const left = px(t.x);
      const top = py(t.y + t.h);
      const wpx = t.w * unit;
      const hpx = t.h * unit;
      ctx.fillStyle = t.colour;
      ctx.globalAlpha = 0.3;
      ctx.fillRect(left, top, wpx, hpx);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = t.colour;
      ctx.lineWidth = 1.6;
      ctx.strokeRect(left + 0.5, top + 0.5, wpx - 1, hpx - 1);
      if (wpx > 24 && hpx > 16) {
        ctx.fillStyle = vars["--text-primary"];
        ctx.font = SMALL_FONT;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(t.label, left + wpx / 2, top + hpx / 2);
      }
    }

    ctx.strokeStyle = vars["--text-primary"];
    ctx.lineWidth = 2.4;
    ctx.strokeRect(px(0) + 0.5, py(x + a) + 0.5, spanW * unit - 1, spanH * unit - 1);

    ctx.fillStyle = vars["--text-secondary"];
    ctx.font = LABEL_FONT;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(`よこ x + ${b} = ${num(x + b, 1)}`, px(0) + (spanW * unit) / 2, py(0) + 10);
    ctx.save();
    ctx.translate(px(0) - 14, py(x + a) + (spanH * unit) / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textBaseline = "bottom";
    ctx.fillText(`たて x + ${a} = ${num(x + a, 1)}`, 0, 0);
    ctx.restore();
  }

  /**
   * x² − a² = (x + a)(x − a), by cutting and moving.
   *
   * The L left after removing the a × a corner is cut at height x − a. The
   * top piece turns a quarter turn and goes on the right, and what is left is
   * an (x + a) × (x − a) rectangle. Nothing is added or thrown away, so the
   * areas must agree — which is the proof.
   */
  function drawCutAndMove(ctx, width, height, vars, a, x, t) {
    const cm = cutAndMove(x, a);
    const pad = 54;
    const spanW = x + a;
    const unit = Math.min((width - pad * 2) / spanW, (height - pad * 2) / x);
    // the picture is x tall at the start and x - a tall at the end; slide the
    // baseline so it stays centred without ever rescaling mid-move
    const spanH = x - a * t;
    const ox = pad + (width - pad * 2 - spanW * unit) / 2;
    const oy = height - pad - (height - pad * 2 - spanH * unit) / 2;
    const px = (v) => ox + v * unit;
    const py = (v) => oy - v * unit;

    // the a × a corner that was removed, shown as a dashed hole at t = 0
    if (t < 0.5) {
      ctx.globalAlpha = 1 - t * 2;
      ctx.strokeStyle = vars["--muted"];
      ctx.setLineDash([4, 3]);
      ctx.lineWidth = 1.4;
      ctx.strokeRect(px(x - a) + 0.5, py(x) + 0.5, a * unit - 1, a * unit - 1);
      ctx.fillStyle = vars["--muted"];
      ctx.font = SMALL_FONT;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`${num(a, 1)}² を取り除く`, px(x - a) + (a * unit) / 2, py(x) + (a * unit) / 2);
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }

    // the piece that stays put
    ctx.fillStyle = vars["--series-1"];
    ctx.globalAlpha = 0.3;
    ctx.fillRect(px(0), py(cm.bottom.h), cm.bottom.w * unit, cm.bottom.h * unit);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = vars["--series-1"];
    ctx.lineWidth = 1.8;
    ctx.strokeRect(px(0) + 0.5, py(cm.bottom.h) + 0.5, cm.bottom.w * unit - 1, cm.bottom.h * unit - 1);

    // the piece that turns a quarter turn and moves to the right. It is drawn
    // about its own centre, so the centre can travel in a straight line while
    // the piece turns: from the top of the L to the slot at x .. x + a.
    const w = cm.top.w * unit;
    const h = cm.top.h * unit;
    const fromCx = px(0) + w / 2;
    const fromCy = py(x) + h / 2;
    const toCx = px(cm.movedTo.x) + h / 2;
    const toCy = py(cm.movedTo.y + cm.movedTo.h) + w / 2;
    const cx = fromCx + (toCx - fromCx) * t;
    // lift it clear of the piece that stays put on the way across
    const cy = fromCy + (toCy - fromCy) * t - Math.sin(Math.PI * t) * unit * 0.45;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((Math.PI / 2) * t);
    ctx.fillStyle = vars["--series-2"];
    ctx.globalAlpha = 0.34;
    ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = vars["--series-2"];
    ctx.lineWidth = 1.8;
    ctx.strokeRect(-w / 2 + 0.5, -h / 2 + 0.5, w - 1, h - 1);
    ctx.restore();

    // labels stay upright even while the piece turns
    ctx.fillStyle = vars["--text-primary"];
    ctx.font = SMALL_FONT;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    if (cm.bottom.w * unit > 34 && cm.bottom.h * unit > 15) {
      ctx.fillText(
        `${num(cm.bottom.w, 1)} × ${num(cm.bottom.h, 1)}`,
        px(0) + (cm.bottom.w * unit) / 2,
        py(cm.bottom.h / 2)
      );
    }
    if (Math.min(w, h) > 15) {
      haloLabel(ctx, vars, `${num(cm.top.w, 1)} × ${num(cm.top.h, 1)}`, cx, cy);
    }

    // the rectangle it all becomes
    ctx.globalAlpha = t;
    ctx.strokeStyle = vars["--text-primary"];
    ctx.lineWidth = 2.4;
    ctx.strokeRect(
      px(0) + 0.5,
      py(cm.rectangle.h) + 0.5,
      cm.rectangle.w * unit - 1,
      cm.rectangle.h * unit - 1
    );
    ctx.globalAlpha = 1;

    ctx.fillStyle = vars["--text-secondary"];
    ctx.font = LABEL_FONT;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(
      t > 0.5 ? `よこ x + ${num(a, 1)} = ${num(x + a, 1)}` : `よこ x = ${num(x, 1)}`,
      px(0) + ((t > 0.5 ? x + a : x) * unit) / 2,
      py(0) + 10
    );
  }

  function drawExpand() {
    const { ctx, width, height } = setupCanvasDPR(canvas);
    ctx.clearRect(0, 0, width, height);
    const vars = readVars(canvas.parentElement, [
      "--surface-1", "--muted", "--gridline", "--baseline", "--text-primary",
      "--text-secondary", "--series-1", "--series-2", "--series-3", "--series-4",
    ]);
    const a = Number(aSlider.value);
    const b = Number(bSlider.value);
    const x = Number(xSlider.value);
    if (mode === "diff") {
      // the cut needs a genuine corner to remove, and something left over
      drawCutAndMove(ctx, width, height, vars, Math.min(a, x - 0.5), x, Number(moveSlider.value));
    } else {
      drawTiles(ctx, width, height, vars, a, b, x);
    }
  }

  function renderExpand() {
    const a = Number(aSlider.value);
    const b = Number(bSlider.value);
    const x = Number(xSlider.value);
    aOut.textContent = String(a);
    bOut.textContent = String(b);
    xOut.textContent = num(x, 1);
    moveOut.textContent = num(Number(moveSlider.value));

    drawExpand();

    if (mode === "diff") {
      renderDiff(a, x);
      return;
    }

    const { p, q } = expandCoefs(a, b);
    const rect = (x + a) * (x + b);
    const parts = tiles(a, b);
    const sum = parts.reduce((s, t) => s + t.wv(x) * t.hv(x), 0);

    statPoly.textContent = `${factoredString(a, b)} = ${quadraticString(p, q)}`;
    statArea.textContent = num(rect);
    statSum.textContent = num(sum);

    note.textContent =
      `たて ${num(x + a, 1)}、よこ ${num(x + b, 1)} の長方形の面積は ${num(rect)}。` +
      `4 枚のタイルを足しても ${num(sum)} で同じです。x を動かしても一致は崩れません —— ` +
      `だから ${factoredString(a, b)} と ${quadraticString(p, q)} は、同じものの言い換えです。` +
      patternNote;

    steps.innerHTML =
      parts
        .map(
          (t) =>
            `<li><code>${t.w} × ${t.h} = ${t.term}</code>` +
            `<span class="step-note">x = ${num(x, 1)} のとき ${num(t.wv(x) * t.hv(x))}</span></li>`
        )
        .join("") +
      `<li class="step-key"><code>合わせて ${quadraticString(p, q)}</code>` +
      `<span class="step-note">${
        a === -b
          ? `${a}x と ${b}x が打ち消し合うので、真ん中の項が消えます`
          : a === b
          ? `${a}x が 2 枚あるので、真ん中は 2 × ${a} = ${p} 倍の x`
          : `細長い 2 枚はどちらも辺の片方が x。だから合わせて (${a} ${sign(b)}) x = ${p}x`
      }</span></li>`;
  }

  function renderDiff(aRaw, x) {
    const a = Math.min(aRaw, x - 0.5);
    const cm = cutAndMove(x, a);
    statPoly.textContent = `(x + ${a})(x − ${a}) = x² − ${a * a}`;
    statArea.textContent = num(cm.rectangle.w * cm.rectangle.h);
    statSum.textContent = num(cm.lShapeArea);

    note.textContent =
      `x² から ${a}² を取り除くと L 字が残ります（面積 ${num(x * x)} − ${a * a} = ${num(cm.lShapeArea)}）。` +
      `高さ ${num(x - a, 1)} のところで切り、上の ${num(x - a, 1)} × ${a} を 90° 回して右へつけると、` +
      `よこ ${num(x + a, 1)}、たて ${num(x - a, 1)} の長方形になります。面積は ${num(cm.rectangle.w * cm.rectangle.h)} ` +
      `で変わりません —— 動かしただけだからです。` + patternNote;

    steps.innerHTML = [
      `<li><code>x² − ${a}²</code>` +
        `<span class="step-note">正方形から角の正方形を取り除いた L 字。面積 ${num(cm.lShapeArea)}</span></li>`,
      `<li><code>下の部分: x × (x − ${a}) = ${num(cm.bottom.w * cm.bottom.h)}</code>` +
        `<span class="step-note">高さ x − ${a} で切った下側。そのまま動かしません</span></li>`,
      `<li><code>上の部分: (x − ${a}) × ${a} = ${num(cm.top.w * cm.top.h)}</code>` +
        `<span class="step-note">90° 回して右へ。回しても面積は変わりません</span></li>`,
      `<li class="step-key"><code>(x + ${a})(x − ${a}) = ${num(cm.rectangle.w)} × ${num(cm.rectangle.h)} = ${num(cm.rectangle.w * cm.rectangle.h)}</code>` +
        `<span class="step-note">切って移しただけなので、はじめの x² − ${a}² と同じ面積です</span></li>`,
    ].join("");
  }

  function stopMove() {
    if (raf) cancelAnimationFrame(raf);
    raf = null;
    movePlay.textContent = "切って移す";
  }

  movePlay.addEventListener("click", () => {
    if (raf) {
      stopMove();
      return;
    }
    const from = Number(moveSlider.value) >= 1 ? 0 : Number(moveSlider.value);
    const start = performance.now();
    movePlay.textContent = "止める";
    const step = (now) => {
      const t = Math.min(1, from + (now - start) / 1800);
      moveSlider.value = String(t.toFixed(2));
      renderExpand();
      if (t < 1) raf = requestAnimationFrame(step);
      else stopMove();
    };
    raf = requestAnimationFrame(step);
  });

  moveSlider.addEventListener("input", () => {
    stopMove();
    renderExpand();
  });

  patternHost.innerHTML = PATTERNS.map(
    (pat) => `<button type="button" class="chip" data-key="${pat.key}">${pat.label}</button>`
  ).join("");
  patternHost.addEventListener("click", (evt) => {
    const btn = evt.target.closest("button[data-key]");
    if (!btn) return;
    const pat = PATTERNS.find((v) => v.key === btn.dataset.key);
    stopMove();
    mode = pat.mode;
    aSlider.value = String(pat.a);
    bSlider.value = String(pat.b);
    moveSlider.value = "0";
    patternNote = pat.note;
    renderExpand();
  });
  for (const el of [aSlider, bSlider, xSlider]) {
    el.addEventListener("input", () => {
      stopMove();
      patternNote = "";
      renderExpand();
    });
  }

  /* ------------------------------------------------------- 因数分解 -- */
  const factorPresetHost = $("exFactorPresets");
  const pSlider = $("exP");
  const qSlider = $("exQ");
  const pOut = $("exPOut");
  const qOut = $("exQOut");
  const factorCanvas = $("exFactorCanvas");
  const factorNote = $("exFactorNote");
  const statFrom = $("exFactorFrom");
  const statTo = $("exFactorTo");
  const statCount = $("exFactorCount");
  const factorTable = $("exFactorTable").querySelector("tbody");

  let presetNote = FACTOR_PRESETS[0].note;

  function drawFactor() {
    const { ctx, width, height } = setupCanvasDPR(factorCanvas);
    ctx.clearRect(0, 0, width, height);
    const vars = readVars(factorCanvas.parentElement, [
      "--surface-1", "--muted", "--gridline", "--baseline", "--text-primary",
      "--text-secondary", "--series-1", "--series-2", "--series-3", "--series-4",
    ]);

    const p = Number(pSlider.value);
    const q = Number(qSlider.value);
    const found = factorQuadratic(p, q);

    if (!found) {
      ctx.fillStyle = vars["--text-secondary"];
      ctx.font = LABEL_FONT;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(
        `${quadraticString(p, q)} は、整数の 2 数では長方形になりません`,
        width / 2,
        height / 2
      );
      return;
    }

    const { a, b } = found;
    // a representative x, big enough that the strips read as strips
    const x = Math.max(3, Math.abs(a) + 1, Math.abs(b) + 1);
    const spanW = x + Math.abs(b);
    const spanH = x + Math.abs(a);
    const pad = 48;
    const unit = Math.min((width - pad * 2) / spanW, (height - pad * 2) / spanH);
    const ox = pad + (width - pad * 2 - spanW * unit) / 2;
    const oy = height - pad - (height - pad * 2 - spanH * unit) / 2;
    const px = (v) => ox + v * unit;
    const py = (v) => oy - v * unit;

    const box = (x0, y0, w, h, colour, label) => {
      const left = px(Math.min(x0, x0 + w));
      const bottom = py(Math.min(y0, y0 + h));
      const wpx = Math.abs(w) * unit;
      const hpx = Math.abs(h) * unit;
      const topY = bottom - hpx;
      ctx.fillStyle = colour;
      ctx.globalAlpha = w < 0 || h < 0 ? 0.1 : 0.3;
      ctx.fillRect(left, topY, wpx, hpx);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = colour;
      ctx.lineWidth = 1.5;
      if (w < 0 || h < 0) ctx.setLineDash([4, 3]);
      ctx.strokeRect(left + 0.5, topY + 0.5, wpx - 1, hpx - 1);
      ctx.setLineDash([]);
      if (label && wpx > 20 && hpx > 15) {
        ctx.fillStyle = vars["--text-primary"];
        ctx.font = SMALL_FONT;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(label, left + wpx / 2, topY + hpx / 2);
      }
    };

    box(0, 0, x, x, vars["--series-1"], "x²");
    box(x, 0, b, x, vars["--series-3"], `${b}x`);
    box(0, x, x, a, vars["--series-2"], `${a}x`);
    box(x, x, b, a, vars["--series-4"], String(a * b));

    ctx.strokeStyle = vars["--text-primary"];
    ctx.lineWidth = 2.4;
    ctx.strokeRect(px(0) + 0.5, py(x + a) + 0.5, (x + b) * unit - 1, (x + a) * unit - 1);

    ctx.fillStyle = vars["--text-secondary"];
    ctx.font = LABEL_FONT;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(`よこ x ${sign(b)}`, px(0) + ((x + b) * unit) / 2, py(0) + 10);
    ctx.save();
    ctx.translate(px(0) - 12, py(x + a) + ((x + a) * unit) / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textBaseline = "bottom";
    ctx.fillText(`たて x ${sign(a)}`, 0, 0);
    ctx.restore();
  }

  function renderFactor() {
    const p = Number(pSlider.value);
    const q = Number(qSlider.value);
    pOut.textContent = String(p);
    qOut.textContent = String(q);

    drawFactor();

    const found = factorQuadratic(p, q);
    const rows = candidateTable(p, q);
    statFrom.textContent = quadraticString(p, q);
    statTo.textContent = found ? factoredString(found.a, found.b) : "整数では分解できない";
    statCount.textContent = `${rows.length} 通り`;

    factorTable.innerHTML = rows
      .map(
        (row) =>
          `<tr${row.hit ? ' class="row-accent"' : ""}>` +
          `<td>${row.a} と ${row.b}</td><td>${row.a * row.b}</td><td>${row.sum}</td>` +
          `<td>${row.hit ? "◎ これ" : ""}</td></tr>`
      )
      .join("");

    factorNote.textContent = found
      ? q === 0
        ? `定数項がないので、探すまでもなく共通因数の x でくくれます: ${quadraticString(p, q)} = ${factoredString(found.a, found.b)}。`
        : `かけて ${q} になる組は ${rows.length} 通り。そのうち たして ${p} になるのは ` +
          `${found.a} と ${found.b} だけです。これが長方形のたてとよこ: ${quadraticString(p, q)} = ${factoredString(found.a, found.b)}。` +
          presetNote
      : `かけて ${q} になる組は ${rows.length} 通りありますが、たして ${p} になるものがありません。` +
        `だから整数のままでは長方形に組めません（中3の範囲では「分解できない」で終わり、` +
        `高校で解の公式を習うと分解できるようになります）。` + presetNote;
  }

  factorPresetHost.innerHTML = FACTOR_PRESETS.map(
    (pre, i) => `<button type="button" class="chip" data-i="${i}">${quadraticString(pre.p, pre.q)}</button>`
  ).join("");
  factorPresetHost.addEventListener("click", (evt) => {
    const btn = evt.target.closest("button[data-i]");
    if (!btn) return;
    const pre = FACTOR_PRESETS[Number(btn.dataset.i)];
    pSlider.value = String(pre.p);
    qSlider.value = String(pre.q);
    presetNote = pre.note;
    renderFactor();
  });
  for (const el of [pSlider, qSlider]) {
    el.addEventListener("input", () => {
      presetNote = "";
      renderFactor();
    });
  }

  return {
    show() {},
    hide() {
      stopMove();
    },
    redraw() {
      renderExpand();
      renderFactor();
    },
  };
}
