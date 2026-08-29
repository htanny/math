import { readVars, setupCanvasDPR } from "../chart.js";
import { legendHTML } from "../plot.js";
import { solveProportion, buai, TRAVEL_PRESETS, positionAt, crossings } from "../rate.js";

const $ = (id) => document.getElementById(id);
const LABEL_FONT = "12px system-ui, -apple-system, 'Segoe UI', sans-serif";
const SMALL_FONT = "11px system-ui, -apple-system, 'Segoe UI', sans-serif";

export function initRateView() {
  /* ------------------------------------------------- panel 1: number line -- */
  const unknownSel = $("rtUnknown");
  const unitSel = $("rtUnit");
  const sliders = { base: $("rtBase"), ratio: $("rtRatio"), compare: $("rtCompare") };
  const outs = { base: $("rtBaseOut"), ratio: $("rtRatioOut"), compare: $("rtCompareOut") };
  const canvas = $("rtCanvas");
  const note = $("rtNote");
  const statFormula = $("rtFormula");
  const statAnswer = $("rtAnswer");
  const statBuai = $("rtBuai");

  function currentTriple() {
    const unknown = unknownSel.value;
    const base = Number(sliders.base.value);
    const ratio = Number(sliders.ratio.value);
    const compare = Number(sliders.compare.value);
    return solveProportion(base, ratio, compare, unknown);
  }

  function drawLines() {
    const { ctx, width, height } = setupCanvasDPR(canvas);
    ctx.clearRect(0, 0, width, height);
    const vars = readVars(canvas.parentElement, [
      "--surface-1", "--muted", "--gridline", "--baseline",
      "--text-primary", "--text-secondary", "--series-1", "--series-2", "--series-4",
    ]);

    const t = currentTriple();
    const unit = unitSel.value;
    const unknown = unknownSel.value;

    // both lines are drawn to the same scale, so "1" and "もとにする量" line up
    const ratioMax = Math.max(1.2, t.ratio * 1.15 || 1.2);
    const x0 = 20;
    const x1 = width - 20;
    const px = (r) => x0 + (r / ratioMax) * (x1 - x0);

    const yTop = 46;
    const yBot = height - 46;

    const axis = (y, label) => {
      ctx.strokeStyle = vars["--baseline"];
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x0, y);
      ctx.lineTo(x1, y);
      ctx.stroke();
      ctx.fillStyle = vars["--muted"];
      ctx.font = SMALL_FONT;
      ctx.textAlign = "left";
      ctx.textBaseline = "bottom";
      ctx.fillText(label, x0, y - 20);
    };
    axis(yTop, `量（${unit}）`);
    axis(yBot, "割合");

    const tick = (r, y, up, color, main, sub) => {
      const x = px(r);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, y - 7);
      ctx.lineTo(x, y + 7);
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.font = LABEL_FONT;
      ctx.textAlign = "center";
      ctx.textBaseline = up ? "bottom" : "top";
      ctx.fillText(main, x, up ? y - 11 : y + 11);
      if (sub) {
        ctx.fillStyle = vars["--muted"];
        ctx.font = SMALL_FONT;
        ctx.fillText(sub, x, up ? y - 26 : y + 26);
      }
    };

    // vertical ties: the whole point of the double number line
    const tie = (r, color, dash) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.setLineDash(dash || []);
      ctx.beginPath();
      ctx.moveTo(px(r), yTop);
      ctx.lineTo(px(r), yBot);
      ctx.stroke();
      ctx.setLineDash([]);
    };

    tie(1, vars["--series-4"]);
    tie(t.ratio, vars["--series-2"], [5, 4]);

    ctx.fillStyle = vars["--muted"];
    ctx.font = SMALL_FONT;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText("0", x0, yBot + 11);
    ctx.textBaseline = "bottom";
    ctx.fillText("0", x0, yTop - 11);

    const fmt = (v) => (Number.isFinite(v) ? Math.round(v * 100) / 100 : "?");
    tick(1, yTop, true, vars["--series-4"], `${fmt(t.base)} ${unit}`, unknown === "base" ? "← 求めるもの" : "もとにする量");
    tick(1, yBot, false, vars["--series-4"], "1", null);
    tick(t.ratio, yTop, true, vars["--series-2"], `${fmt(t.compare)} ${unit}`, unknown === "compare" ? "← 求めるもの" : "くらべる量");
    tick(t.ratio, yBot, false, vars["--series-2"], fmt(t.ratio), unknown === "ratio" ? "← 求めるもの" : null);
  }

  function renderProportion() {
    const t = currentTriple();
    const unknown = unknownSel.value;
    const unit = unitSel.value;
    for (const k of ["base", "ratio", "compare"]) {
      sliders[k].disabled = k === unknown;
      const v = t[k];
      outs[k].textContent = k === "ratio" ? (Number.isFinite(v) ? v.toFixed(2) : "—") : Math.round(v || 0);
      if (k === unknown && Number.isFinite(v)) sliders[k].value = String(v);
    }
    drawLines();

    const fmt = (v) => (Number.isFinite(v) ? String(Math.round(v * 100) / 100) : "—");
    if (unknown === "compare") {
      statFormula.textContent = "もと × 割合";
      statAnswer.textContent = `${fmt(t.compare)} ${unit}`;
      note.textContent =
        `割合 1 の真上にあるのが「もとにする量」${fmt(t.base)} ${unit}。求めるのは割合 ${fmt(t.ratio)} の真上なので、` +
        `${fmt(t.base)} × ${fmt(t.ratio)} = ${fmt(t.compare)} ${unit}。数直線が ${fmt(t.ratio)} 倍にのびた、と読めます。`;
    } else if (unknown === "ratio") {
      statFormula.textContent = "くらべる量 ÷ もと";
      statAnswer.textContent = fmt(t.ratio);
      note.textContent =
        `${fmt(t.compare)} ${unit} が、もとにする量 ${fmt(t.base)} ${unit} の何倍にあたるかを聞かれています。` +
        `${fmt(t.compare)} ÷ ${fmt(t.base)} = ${fmt(t.ratio)}。上の数直線の比が、そのまま下の目盛りです。`;
    } else {
      statFormula.textContent = "くらべる量 ÷ 割合";
      statAnswer.textContent = `${fmt(t.base)} ${unit}`;
      note.textContent =
        `${fmt(t.compare)} ${unit} が割合 ${fmt(t.ratio)} にあたる、と言われています。求めるのは割合 1 の真上。` +
        `${fmt(t.compare)} ÷ ${fmt(t.ratio)} = ${fmt(t.base)} ${unit}。「もとにする量」は、いつでも 1 の真上です。`;
    }
    statBuai.textContent = buai(t.ratio);
  }

  unknownSel.addEventListener("change", renderProportion);
  unitSel.addEventListener("change", renderProportion);
  for (const el of Object.values(sliders)) el.addEventListener("input", renderProportion);

  /* --------------------------------------------------- panel 2: diagram -- */
  const diaCanvas = $("rtDia");
  const diaLegend = $("rtDiaLegend");
  const diaNote = $("rtDiaNote");
  const question = $("rtQuestion");
  const hint = $("rtHint");
  const speedA = $("rtSpeedA");
  const speedB = $("rtSpeedB");
  const speedAOut = $("rtSpeedAOut");
  const speedBOut = $("rtSpeedBOut");
  const nameA = $("rtNameA");
  const nameB = $("rtNameB");

  let presetIdx = 0;

  function travellers() {
    const p = TRAVEL_PRESETS[presetIdx];
    const sa = Number(speedA.value);
    const sb = Number(speedB.value);
    return [
      { ...p.a, speed: Math.sign(p.a.speed) * sa },
      { ...p.b, speed: Math.sign(p.b.speed) * sb },
    ];
  }

  function drawDiagram() {
    const { ctx, width, height } = setupCanvasDPR(diaCanvas);
    ctx.clearRect(0, 0, width, height);
    const vars = readVars(diaCanvas.parentElement, [
      "--surface-1", "--muted", "--gridline", "--baseline",
      "--text-primary", "--text-secondary", "--series-1", "--series-2", "--series-3",
    ]);

    const p = TRAVEL_PRESETS[presetIdx];
    const [A, B] = travellers();
    const pad = { l: 52, r: 16, t: 14, b: 34 };
    const w = width - pad.l - pad.r;
    const h = height - pad.t - pad.b;
    if (w <= 10 || h <= 10) return;

    const sx = (t) => pad.l + (t / p.tMax) * w;
    const sy = (x) => pad.t + h - (x / p.xMax) * h;

    // grid
    ctx.font = SMALL_FONT;
    ctx.strokeStyle = vars["--gridline"];
    ctx.lineWidth = 1;
    ctx.fillStyle = vars["--muted"];
    const tStep = p.tMax > 30 ? 10 : 5;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    for (let t = 0; t <= p.tMax + 1e-9; t += tStep) {
      const x = Math.round(sx(t)) + 0.5;
      ctx.beginPath();
      ctx.moveTo(x, pad.t);
      ctx.lineTo(x, pad.t + h);
      ctx.stroke();
      ctx.fillText(`${t}分`, x, pad.t + h + 6);
    }
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    const xStep = p.xMax / 4;
    for (let d = 0; d <= p.xMax + 1e-9; d += xStep) {
      const y = Math.round(sy(d)) + 0.5;
      ctx.beginPath();
      ctx.moveTo(pad.l, y);
      ctx.lineTo(pad.l + w, y);
      ctx.stroke();
      ctx.fillText(`${Math.round(d)}m`, pad.l - 6, y);
    }

    const line = (tr, color) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.lineJoin = "round";
      ctx.beginPath();
      const steps = 600;
      let started = false;
      for (let i = 0; i <= steps; i++) {
        const t = (p.tMax * i) / steps;
        if (t < (tr.delay || 0)) continue;
        const x = positionAt(tr, t, p.xMax);
        if (!started) {
          ctx.moveTo(sx(t), sy(x));
          started = true;
        } else ctx.lineTo(sx(t), sy(x));
      }
      ctx.stroke();
    };
    line(A, vars["--series-1"]);
    line(B, vars["--series-2"]);

    const cross = crossings(A, B, p.tMax, p.xMax);
    for (const t of cross) {
      const x = positionAt(A, t, p.xMax);
      ctx.strokeStyle = vars["--series-3"];
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(sx(t), sy(x));
      ctx.lineTo(sx(t), pad.t + h);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = vars["--surface-1"];
      ctx.beginPath();
      ctx.arc(sx(t), sy(x), 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = vars["--series-3"];
      ctx.beginPath();
      ctx.arc(sx(t), sy(x), 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = LABEL_FONT;
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillText(`${round2(t)}分`, sx(t), sy(x) - 10);
    }

    diaLegend.innerHTML = legendHTML([
      [`${p.a.name}`, vars["--series-1"]],
      [`${p.b.name}`, vars["--series-2"]],
      ["出会う点", vars["--series-3"]],
    ]);

    const list = cross.map((t) => `${round2(t)} 分`).join("、");
    diaNote.textContent = cross.length
      ? `2本の線が交わるのは ${list}。そのときの道のりは ${Math.round(positionAt(A, cross[0], p.xMax))} m 地点です。` +
        `線の傾きが速さ、交点が「同じ時刻に同じ場所」を表しています。`
      : "この速さでは、グラフの範囲内で2本の線は交わりません。速さを変えてみてください。";
  }

  function round2(v) {
    return Math.round(v * 100) / 100;
  }

  function renderDiagram() {
    const p = TRAVEL_PRESETS[presetIdx];
    nameA.textContent = p.a.name;
    nameB.textContent = p.b.name;
    speedAOut.textContent = speedA.value;
    speedBOut.textContent = speedB.value;
    question.textContent = p.question;
    hint.textContent = `考え方: ${p.hint}`;
    drawDiagram();
  }

  function loadPreset(i) {
    presetIdx = i;
    const p = TRAVEL_PRESETS[i];
    speedA.value = String(Math.abs(p.a.speed));
    speedB.value = String(Math.abs(p.b.speed));
    for (const btn of presetHost.querySelectorAll("button")) {
      btn.classList.toggle("chip-accent", Number(btn.dataset.i) === i);
    }
    renderDiagram();
  }

  const presetHost = $("rtPresets");
  presetHost.innerHTML = TRAVEL_PRESETS.map(
    (p, i) => `<button type="button" class="chip" data-i="${i}">${p.label}</button>`
  ).join("");
  presetHost.addEventListener("click", (evt) => {
    const btn = evt.target.closest("button[data-i]");
    if (btn) loadPreset(Number(btn.dataset.i));
  });
  speedA.addEventListener("input", renderDiagram);
  speedB.addEventListener("input", renderDiagram);

  loadPreset(0);

  return {
    show() {},
    redraw() {
      renderProportion();
      renderDiagram();
    },
  };
}
