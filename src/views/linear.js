import { readVars, setupCanvasDPR } from "../chart.js";
import { frac, fStr, fVal } from "../fractions.js";

const $ = (id) => document.getElementById(id);
const SMALL_FONT = "11px system-ui, -apple-system, 'Segoe UI', sans-serif";
const LABEL_FONT = "13px system-ui, -apple-system, 'Segoe UI', sans-serif";

const PRESETS = [
  { label: "交点がある", v: [1, 1, -0.5, 4] },
  { label: "平行（解なし）", v: [1, 1, 1, -3] },
  { label: "重なる（解が無数）", v: [1, 1, 1, 1] },
  { label: "直角に交わる", v: [2, -1, -0.5, 3] },
];

export function initLinearView() {
  /* -------------------------------------------------------- panel 1: graph -- */
  const canvas = $("lnCanvas");
  const a1 = $("lnA1");
  const b1 = $("lnB1");
  const a2 = $("lnA2");
  const b2 = $("lnB2");
  const outs = { a1: $("lnA1Out"), b1: $("lnB1Out"), a2: $("lnA2Out"), b2: $("lnB2Out") };
  const note = $("lnNote");
  const statKind = $("lnKind");
  const statX = $("lnX");
  const statY = $("lnY");

  const RANGE = 8;

  function draw() {
    const { ctx, width, height } = setupCanvasDPR(canvas);
    ctx.clearRect(0, 0, width, height);
    const vars = readVars(canvas.parentElement, [
      "--surface-1", "--muted", "--gridline", "--baseline",
      "--text-primary", "--text-secondary", "--series-1", "--series-2", "--series-3",
    ]);

    const pad = 24;
    const size = Math.min(width, height) - pad * 2;
    const ox = (width - size) / 2;
    const oy = (height - size) / 2;
    const sx = (x) => ox + ((x + RANGE) / (2 * RANGE)) * size;
    const sy = (y) => oy + size - ((y + RANGE) / (2 * RANGE)) * size;

    ctx.strokeStyle = vars["--gridline"];
    ctx.lineWidth = 1;
    ctx.fillStyle = vars["--muted"];
    ctx.font = SMALL_FONT;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    for (let k = -RANGE; k <= RANGE; k += 2) {
      const x = Math.round(sx(k)) + 0.5;
      const y = Math.round(sy(k)) + 0.5;
      ctx.beginPath();
      ctx.moveTo(x, oy);
      ctx.lineTo(x, oy + size);
      ctx.moveTo(ox, y);
      ctx.lineTo(ox + size, y);
      ctx.stroke();
      if (k !== 0) {
        ctx.fillText(String(k), sx(k), sy(0) + 4);
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        ctx.fillText(String(k), sx(0) - 5, sy(k));
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
      }
    }
    ctx.strokeStyle = vars["--baseline"];
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(ox, Math.round(sy(0)) + 0.5);
    ctx.lineTo(ox + size, Math.round(sy(0)) + 0.5);
    ctx.moveTo(Math.round(sx(0)) + 0.5, oy);
    ctx.lineTo(Math.round(sx(0)) + 0.5, oy + size);
    ctx.stroke();

    // a steep line runs off the top of the box, so clip to the axes
    const line = (a, b, color) => {
      ctx.save();
      ctx.beginPath();
      ctx.rect(ox, oy, size, size);
      ctx.clip();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(sx(-RANGE), sy(a * -RANGE + b));
      ctx.lineTo(sx(RANGE), sy(a * RANGE + b));
      ctx.stroke();
      ctx.restore();
    };

    const A1 = Number(a1.value);
    const B1 = Number(b1.value);
    const A2 = Number(a2.value);
    const B2 = Number(b2.value);
    line(A1, B1, vars["--series-1"]);
    line(A2, B2, vars["--series-2"]);

    if (Math.abs(A1 - A2) > 1e-9) {
      const x = (B2 - B1) / (A1 - A2);
      const y = A1 * x + B1;
      if (Math.abs(x) <= RANGE && Math.abs(y) <= RANGE) {
        ctx.fillStyle = vars["--surface-1"];
        ctx.beginPath();
        ctx.arc(sx(x), sy(y), 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = vars["--series-3"];
        ctx.beginPath();
        ctx.arc(sx(x), sy(y), 5.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = LABEL_FONT;
        ctx.textAlign = "left";
        ctx.textBaseline = "bottom";
        ctx.fillText(`(${round2(x)}, ${round2(y)})`, sx(x) + 10, sy(y) - 8);
      }
    }
  }

  function round2(v) {
    return Math.round(v * 100) / 100;
  }

  function renderGraph() {
    const A1 = Number(a1.value);
    const B1 = Number(b1.value);
    const A2 = Number(a2.value);
    const B2 = Number(b2.value);
    outs.a1.textContent = A1.toFixed(2);
    outs.b1.textContent = B1.toFixed(1);
    outs.a2.textContent = A2.toFixed(2);
    outs.b2.textContent = B2.toFixed(1);
    draw();

    if (Math.abs(A1 - A2) > 1e-9) {
      const x = (B2 - B1) / (A1 - A2);
      const y = A1 * x + B1;
      statKind.textContent = "交わる（解は1つ）";
      statX.textContent = String(round2(x));
      statY.textContent = String(round2(y));
      note.textContent =
        `傾きがちがう（${A1} と ${A2}）ので、2本の直線は必ず1点で交わります。` +
        `その点 (${round2(x)}, ${round2(y)}) が連立方程式のただ1つの解です。` +
        (Math.abs(A1 * A2 + 1) < 1e-9 ? " いまは傾きの積が −1 なので直角に交わっています。" : "");
    } else if (Math.abs(B1 - B2) > 1e-9) {
      statKind.textContent = "平行（解なし）";
      statX.textContent = "—";
      statY.textContent = "—";
      note.textContent =
        `傾きが同じ（どちらも ${A1}）で切片がちがうので、2本は平行のまま決して交わりません。` +
        `これが「解なし」です。式で解こうとすると ${round2(B1)} = ${round2(B2)} という成り立たない等式が出ます。`;
    } else {
      statKind.textContent = "重なる（解は無数）";
      statX.textContent = "無数";
      statY.textContent = "無数";
      note.textContent =
        `2本の式が同じ直線を表しています。直線上のどの点も両方の式を満たすので、解は無数にあります。` +
        `式で解こうとすると 0 = 0 になり、x が決まりません。`;
    }
  }

  for (const el of [a1, b1, a2, b2]) el.addEventListener("input", renderGraph);

  const presetHost = $("lnPresets");
  presetHost.innerHTML = PRESETS.map(
    (p, i) => `<button type="button" class="chip" data-i="${i}">${p.label}</button>`
  ).join("");
  presetHost.addEventListener("click", (evt) => {
    const btn = evt.target.closest("button[data-i]");
    if (!btn) return;
    const [p, q, r, s] = PRESETS[Number(btn.dataset.i)].v;
    a1.value = String(p);
    b1.value = String(q);
    a2.value = String(r);
    b2.value = String(s);
    renderGraph();
  });

  /* --------------------------------------------------- panel 2: elimination -- */
  const eIn = {
    a1: $("lnEa1"), b1: $("lnEb1"), c1: $("lnEc1"),
    a2: $("lnEa2"), b2: $("lnEb2"), c2: $("lnEc2"),
  };
  const stepList = $("lnElimSteps");
  const elimNote = $("lnElimNote");

  const term = (coef, sym) => {
    if (coef === 0) return "";
    const c = coef === 1 ? "" : coef === -1 ? "−" : String(Math.abs(coef));
    return `${coef < 0 && coef !== -1 ? "−" : ""}${c}${sym}`;
  };

  function eqString(a, b, c) {
    const parts = [];
    if (a !== 0) parts.push(term(a, "x"));
    if (b !== 0) parts.push((b > 0 && parts.length ? "+ " : "") + term(b, "y"));
    if (!parts.length) parts.push("0");
    return `${parts.join(" ")} = ${c}`;
  }

  function renderElim() {
    const v = {};
    for (const k of Object.keys(eIn)) {
      const n = Math.round(Number(eIn[k].value));
      v[k] = Number.isFinite(n) ? n : 0;
    }
    const D = v.a1 * v.b2 - v.a2 * v.b1;
    const Dx = v.c1 * v.b2 - v.c2 * v.b1;
    const Dy = v.a1 * v.c2 - v.a2 * v.c1;

    const li = (code, noteText, key) =>
      `<li${key ? ' class="step-key"' : ""}><code>${code}</code>` +
      (noteText ? `<span class="step-note">${noteText}</span>` : "") +
      `</li>`;

    if ((v.a1 === 0 && v.b1 === 0) || (v.a2 === 0 && v.b2 === 0)) {
      stepList.innerHTML = li("x と y の係数が両方 0 の式があります", "これは方程式になっていません");
      elimNote.textContent = "係数を入れ直してください。";
      return;
    }

    if (D === 0) {
      if (Dx === 0 && Dy === 0) {
        stepList.innerHTML =
          li(`① ${eqString(v.a1, v.b1, v.c1)}`) +
          li(`② ${eqString(v.a2, v.b2, v.c2)}`) +
          li("②は①の定数倍", "同じ直線を2回書いているだけです") +
          li("0 = 0", "x が消えてしまい、値が決まりません", true);
        elimNote.textContent =
          "2つの式が同じ直線を表しています。解は無数にあります（①を満たす (x, y) がすべて解）。";
      } else {
        stepList.innerHTML =
          li(`① ${eqString(v.a1, v.b1, v.c1)}`) +
          li(`② ${eqString(v.a2, v.b2, v.c2)}`) +
          li("左辺の比は同じなのに右辺の比がちがう", "傾きが同じで切片がちがう＝平行") +
          li("0 = （0でない数）", "成り立たない等式になります", true);
        elimNote.textContent = "2本は平行なので交点がありません。解なしです。";
      }
      return;
    }

    const x = frac(Dx, D);
    const y = frac(Dy, D);

    // when one equation has no y (or no x) at all there is nothing to
    // eliminate — multiplying through by a zero coefficient would be nonsense
    if (v.b1 === 0 || v.b2 === 0) {
      const solo = v.b1 === 0 ? 1 : 2;
      const sa = solo === 1 ? v.a1 : v.a2;
      const sc = solo === 1 ? v.c1 : v.c2;
      const other = solo === 1 ? 2 : 1;
      stepList.innerHTML =
        li(`① ${eqString(v.a1, v.b1, v.c1)}`) +
        li(`② ${eqString(v.a2, v.b2, v.c2)}`) +
        li(`${solo === 1 ? "①" : "②"}には y がない`, "そろえる手間はいりません — そのまま x が出ます", true) +
        li(`x = ${fStr(frac(sc, sa))}`, `${sc} ÷ ${sa}`) +
        li(`${other === 1 ? "①" : "②"}に代入して y = ${fStr(y)}`, "残った式に入れるだけ", true);
      elimNote.textContent =
        `片方の式に y が入っていないので、加減法を使うまでもなく x が決まります。` +
        `解は x = ${fStr(x)}、y = ${fStr(y)}。グラフでは、縦の直線ともう1本の交点にあたります。`;
      return;
    }

    const m1 = v.b2;
    const m2 = v.b1;

    stepList.innerHTML =
      li(`① ${eqString(v.a1, v.b1, v.c1)}`) +
      li(`② ${eqString(v.a2, v.b2, v.c2)}`) +
      li(
        `①×${m1}: ${eqString(v.a1 * m1, v.b1 * m1, v.c1 * m1)}`,
        `y の係数を ${v.b1 * m1} にそろえます`
      ) +
      li(
        `②×${m2}: ${eqString(v.a2 * m2, v.b2 * m2, v.c2 * m2)}`,
        `こちらも ${v.b2 * m2} — 同じ数になりました`
      ) +
      li(
        `辺々ひく: ${eqString(D, 0, Dx)}`,
        "y が消えました。これが加減法です",
        true
      ) +
      li(`x = ${fStr(x)}`, `${Dx} ÷ ${D}`) +
      li(`①に代入して y = ${fStr(y)}`, "分数のままが正確な答えです", true);

    elimNote.textContent =
      `解は x = ${fStr(x)}、y = ${fStr(y)}` +
      (x.d === 1 && y.d === 1 ? "（どちらも整数）" : `（小数では x ≈ ${fVal(x).toFixed(4)}、y ≈ ${fVal(y).toFixed(4)}）`) +
      `。上のグラフでいえば、2直線の交点の座標です。` +
      `y の係数どうしを掛け合わせてそろえるのが機械的なやり方ですが、` +
      `最小公倍数を使えば数はもっと小さくできます。`;
  }

  for (const el of Object.values(eIn)) {
    el.addEventListener("input", renderElim);
    el.addEventListener("change", renderElim);
  }

  return {
    show() {},
    redraw() {
      renderGraph();
      renderElim();
    },
  };
}
