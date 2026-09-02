import { readVars, setupCanvasDPR } from "../chart.js";
import { divisionTiling, fStr, fMixed, fVal, frac } from "../fractions.js";

const $ = (id) => document.getElementById(id);
const LABEL_FONT = "12px system-ui, -apple-system, 'Segoe UI', sans-serif";
const SMALL_FONT = "11px system-ui, -apple-system, 'Segoe UI', sans-serif";

/** [min, max, fallback] for each box, and the label the warning uses. */
const LIMITS = { a: [1, 24, 2], b: [1, 24, 3], c: [1, 24, 1], d: [1, 24, 4] };
const BOX_NAME = {
  a: "わられる数の分子",
  b: "わられる数の分母",
  c: "わる数の分子",
  d: "わる数の分母",
};

const PRESETS = [
  { label: "2/3 ÷ 1/4", v: [2, 3, 1, 4] },
  { label: "3/4 ÷ 2/5", v: [3, 4, 2, 5] },
  { label: "1 ÷ 1/3", v: [1, 1, 1, 3] },
  { label: "5/6 ÷ 3/4", v: [5, 6, 3, 4] },
  { label: "1/2 ÷ 2", v: [1, 2, 2, 1] },
  { label: "3/5 ÷ 3/5", v: [3, 5, 3, 5] },
];

export function initFractionView() {
  const inputs = { a: $("frA"), b: $("frB"), c: $("frC"), d: $("frD") };
  const canvas = $("frCanvas");
  const unitCanvas = $("frUnit");
  const note = $("frNote");
  const steps = $("frSteps");
  const whyNote = $("frWhyNote");
  const warn = $("frWarn");
  const statAnswer = $("frAnswer");
  const statMixed = $("frMixed");
  const statCount = $("frCount");

  // The boxes are not inside a <form>, so min/max block nothing on their own.
  // Anything unusable falls back to a default — and `bad` records that, so the
  // picture is never allowed to disagree with what the boxes show.
  function read() {
    const out = { bad: [] };
    for (const key of ["a", "b", "c", "d"]) {
      const [lo, hi, dflt] = LIMITS[key];
      const raw = inputs[key].value.trim();
      const v = Math.round(Number(raw));
      const ok = raw !== "" && Number.isFinite(v) && v >= lo && v <= hi;
      out[key] = ok ? v : dflt;
      if (!ok) out.bad.push({ key, raw, used: dflt });
    }
    return out;
  }

  function warnText(bad) {
    return bad
      .map(({ key, raw, used }) => {
        const [lo, hi] = LIMITS[key];
        const what = raw === "" ? "空欄です" : `「${raw}」は使えません`;
        return `${BOX_NAME[key]}: ${what}（${lo}〜${hi} の整数）。${used} として描いています。`;
      })
      .join(" ");
  }

  // Fires on blur / Enter, so it does not fight you mid-keystroke.
  function snapInputs() {
    const v = read();
    for (const key of ["a", "b", "c", "d"]) inputs[key].value = String(v[key]);
    render();
  }

  /** One row of the picture: a bar from 0 to `value`, ticked every `step`. */
  function bar(ctx, vars, geom, y, h, value, step, fill, alpha) {
    const { x0, unit } = geom;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = fill;
    ctx.fillRect(x0, y, value * unit, h);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = vars["--gridline"];
    ctx.lineWidth = 1;
    if (step > 0 && value / step <= 60) {
      for (let k = 1; k * step < value - 1e-9; k++) {
        const x = Math.round(x0 + k * step * unit) + 0.5;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + h);
        ctx.stroke();
      }
    }
    ctx.strokeStyle = vars["--baseline"];
    ctx.strokeRect(x0 + 0.5, y + 0.5, value * unit - 1, h - 1);
  }

  function drawMain(t, v) {
    const { ctx, width, height } = setupCanvasDPR(canvas);
    ctx.clearRect(0, 0, width, height);
    const vars = readVars(canvas.parentElement, [
      "--surface-1", "--muted", "--gridline", "--baseline",
      "--text-primary", "--text-secondary", "--series-1", "--series-2", "--series-3",
    ]);

    const dividend = fVal(t.dividend);
    const divisor = fVal(t.divisor);
    const span = Math.max(dividend, divisor, 1) * 1.06;
    const x0 = 34;
    const unit = (width - x0 - 18) / span;
    const geom = { x0, unit };

    // scale: whole numbers along the top
    ctx.font = SMALL_FONT;
    ctx.fillStyle = vars["--muted"];
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    for (let k = 0; k <= Math.floor(span); k++) {
      const x = x0 + k * unit;
      ctx.strokeStyle = vars["--gridline"];
      ctx.beginPath();
      ctx.moveTo(Math.round(x) + 0.5, 16);
      ctx.lineTo(Math.round(x) + 0.5, height - 20);
      ctx.stroke();
      ctx.fillText(String(k), x, 2);
    }

    const barH = 34;
    const yTop = 30;
    const yBot = yTop + barH + 30;

    bar(ctx, vars, geom, yTop, barH, dividend, 1 / v.b, vars["--series-1"], 0.28);
    ctx.fillStyle = vars["--text-primary"];
    ctx.font = LABEL_FONT;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(`わられる数 ${fStr(t.dividend)}`, x0 + 6, yTop + barH / 2);

    // divisor tiles, laid end to end until they run past the dividend
    const tileW = divisor * unit;
    const maxTiles = Math.min(t.whole, 200);
    for (let k = 0; k < maxTiles; k++) {
      ctx.fillStyle = vars["--series-2"];
      ctx.globalAlpha = k % 2 === 0 ? 0.42 : 0.26;
      ctx.fillRect(x0 + k * tileW, yBot, tileW, barH);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = vars["--series-2"];
      ctx.strokeRect(x0 + k * tileW + 0.5, yBot + 0.5, tileW - 1, barH - 1);
      if (tileW > 22) {
        ctx.fillStyle = vars["--text-primary"];
        ctx.font = SMALL_FONT;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(k + 1), x0 + (k + 0.5) * tileW, yBot + barH / 2);
      }
    }

    // the leftover, drawn as the part of one more tile that actually fits
    const restVal = fVal(t.restFrac);
    if (restVal > 1e-9) {
      const rx = x0 + t.whole * tileW;
      const rw = restVal * tileW;
      ctx.fillStyle = vars["--series-3"];
      ctx.globalAlpha = 0.4;
      ctx.fillRect(rx, yBot, rw, barH);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = vars["--series-3"];
      ctx.strokeRect(rx + 0.5, yBot + 0.5, Math.max(1, rw - 1), barH - 1);
      // the rest of that tile, left empty, to show it did not fill
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = vars["--muted"];
      ctx.strokeRect(rx + 0.5, yBot + 0.5, tileW - 1, barH - 1);
      ctx.setLineDash([]);
    }

    ctx.fillStyle = vars["--text-secondary"];
    ctx.font = SMALL_FONT;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(`わる数 ${fStr(t.divisor)} のタイル`, x0 + 2, yBot + barH + 6);
  }

  function drawUnit(t) {
    const { ctx, width, height } = setupCanvasDPR(unitCanvas);
    ctx.clearRect(0, 0, width, height);
    const vars = readVars(unitCanvas.parentElement, [
      "--surface-1", "--muted", "--gridline", "--baseline",
      "--text-primary", "--text-secondary", "--series-2", "--series-4",
    ]);

    const divisor = fVal(t.divisor);
    const perUnit = fVal(t.perUnit);
    const span = Math.max(1, divisor) * 1.06;
    const x0 = 34;
    const unit = (width - x0 - 18) / span;
    const barH = 40;
    const y = Math.round(height / 2 - barH / 2);

    ctx.fillStyle = vars["--series-4"];
    ctx.globalAlpha = 0.16;
    ctx.fillRect(x0, y, unit, barH);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = vars["--series-4"];
    ctx.lineWidth = 2;
    ctx.strokeRect(x0 + 0.5, y + 0.5, unit - 1, barH - 1);

    const tileW = divisor * unit;
    const full = Math.floor(perUnit + 1e-9);
    for (let k = 0; k < Math.min(full, 200); k++) {
      ctx.fillStyle = vars["--series-2"];
      ctx.globalAlpha = k % 2 === 0 ? 0.4 : 0.24;
      ctx.fillRect(x0 + k * tileW, y, tileW, barH);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = vars["--series-2"];
      ctx.lineWidth = 1;
      ctx.strokeRect(x0 + k * tileW + 0.5, y + 0.5, tileW - 1, barH - 1);
    }
    const rest = perUnit - full;
    if (rest > 1e-9) {
      ctx.fillStyle = vars["--series-2"];
      ctx.globalAlpha = 0.4;
      ctx.fillRect(x0 + full * tileW, y, rest * tileW, barH);
      ctx.globalAlpha = 1;
    }

    ctx.fillStyle = vars["--text-primary"];
    ctx.font = LABEL_FONT;
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText("1", x0 + unit / 2, y - 6);
    ctx.textBaseline = "top";
    ctx.fillStyle = vars["--text-secondary"];
    ctx.fillText(`${fStr(t.divisor)} が ${fStr(t.perUnit)} 個`, x0 + unit / 2, y + barH + 6);
  }

  function stepHTML(v, t) {
    const dv = fStr(t.dividend);
    const ds = fStr(t.divisor);
    const inv = fStr(t.perUnit);
    const ans = fStr(t.quotient);
    return [
      `<li class="step-key"><code>1 ÷ ${ds} = ${inv}</code>` +
        `<span class="step-note">${
          v.c === 1
            ? `${ds} を ${v.d} 個あつめると 1 になるから`
            : `${ds} を ${v.d} 個あつめると ${v.c}。1 はその ${v.c} 分の 1 なので、必要なのは ${v.d} ÷ ${v.c} = ${inv} 個`
        }</span></li>`,
      `<li><code>${dv} は 1 の ${dv} 倍</code>` +
        `<span class="step-note">わられる数は、1 をこれだけの割合にしたもの</span></li>`,
      `<li><code>${dv} ÷ ${ds} = ${inv} × ${dv}</code>` +
        `<span class="step-note">入る個数も同じ割合になる — ここが要です</span></li>`,
      `<li class="step-key"><code>= ${v.d}/${v.c} × ${v.a}/${v.b} = ${ans}</code>` +
        `<span class="step-note">これが「ひっくり返して掛ける」の正体</span></li>`,
    ].join("");
  }

  function render() {
    const v = read();
    const t = divisionTiling(v.a, v.b, v.c, v.d);
    drawMain(t, v);
    drawUnit(t);

    statAnswer.textContent = fStr(t.quotient);
    statMixed.textContent = fMixed(t.quotient);
    const restVal = fVal(t.restFrac);
    statCount.textContent =
      restVal > 1e-9 ? `${t.whole} 個と ${fStr(t.restFrac)} 個ぶん` : `ちょうど ${t.whole} 個`;

    const dv = fStr(t.dividend);
    const ds = fStr(t.divisor);
    note.textContent =
      restVal > 1e-9
        ? `${dv} の中に ${ds} は ${t.whole} 個入り、あと ${fStr(t.restFrac)} 個ぶん残ります。` +
          `答えは「入ったタイルの数」なので ${t.whole} + ${fStr(t.restFrac)} = ${fStr(t.quotient)}。` +
          `残りを ${v.b} 分の何個と数えないことに注意してください — 数えているのはタイルです。`
        : `${dv} の中に ${ds} はちょうど ${t.whole} 個入ります。だから ${dv} ÷ ${ds} = ${fStr(t.quotient)}。`;

    warn.hidden = v.bad.length === 0;
    warn.textContent = v.bad.length ? warnText(v.bad) : "";

    steps.innerHTML = stepHTML(v, t);
    whyNote.textContent =
      `${fStr(frac(v.c, v.d))} の逆数は ${fStr(t.perUnit)}。「1 の中にいくつ入るか」がそのまま逆数になっているので、` +
      `わり算が逆数の掛け算に化けます。わる数を 1 より小さくすると答えがもとの数より大きくなるのも、` +
      `小さいタイルほどたくさん入る、というだけのことです。`;
  }

  for (const el of Object.values(inputs)) {
    el.addEventListener("input", render);
    el.addEventListener("change", snapInputs);
  }

  const presetHost = $("frPresets");
  presetHost.innerHTML = PRESETS.map(
    (p, i) => `<button type="button" class="chip" data-i="${i}">${p.label}</button>`
  ).join("");
  presetHost.addEventListener("click", (evt) => {
    const btn = evt.target.closest("button[data-i]");
    if (!btn) return;
    const [a, b, c, d] = PRESETS[Number(btn.dataset.i)].v;
    inputs.a.value = a;
    inputs.b.value = b;
    inputs.c.value = c;
    inputs.d.value = d;
    render();
  });

  return {
    show() {},
    redraw() {
      render();
    },
  };
}
