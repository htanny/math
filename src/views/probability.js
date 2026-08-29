import { readVars, setupCanvasDPR } from "../chart.js";
import { legendHTML } from "../plot.js";
import { EXPERIMENTS, experimentByKey, Tally } from "../probability.js";

const $ = (id) => document.getElementById(id);
const SMALL_FONT = "11px system-ui, -apple-system, 'Segoe UI', sans-serif";
const LABEL_FONT = "12px system-ui, -apple-system, 'Segoe UI', sans-serif";

export function initProbabilityView() {
  const bars = $("pbBars");
  const conv = $("pbConv");
  const legend = $("pbLegend");
  const note = $("pbNote");
  const convNote = $("pbConvNote");
  const watchLabel = $("pbWatchLabel");
  const presetHost = $("pbPresets");
  const stats = { n: $("pbN"), rel: $("pbRelGap"), count: $("pbCountGap") };

  let spec = EXPERIMENTS[0];
  let tally = new Tally(spec);

  function drawBars() {
    const { ctx, width, height } = setupCanvasDPR(bars);
    ctx.clearRect(0, 0, width, height);
    const vars = readVars(bars.parentElement, [
      "--surface-1", "--muted", "--gridline", "--baseline",
      "--text-primary", "--text-secondary", "--series-1", "--series-2",
    ]);

    const pad = { l: 46, r: 14, t: 14, b: 30 };
    const w = width - pad.l - pad.r;
    const h = height - pad.t - pad.b;
    if (w <= 10 || h <= 10) return;

    const rel = tally.rel();
    const yMax = Math.max(...spec.theory, ...rel, 0.05) * 1.2;
    const sy = (v) => pad.t + h - (v / yMax) * h;

    ctx.strokeStyle = vars["--gridline"];
    ctx.fillStyle = vars["--muted"];
    ctx.font = SMALL_FONT;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (let k = 0; k <= 4; k++) {
      const v = (yMax * k) / 4;
      const y = Math.round(sy(v)) + 0.5;
      ctx.beginPath();
      ctx.moveTo(pad.l, y);
      ctx.lineTo(pad.l + w, y);
      ctx.stroke();
      ctx.fillText(v.toFixed(2), pad.l - 6, y);
    }

    const slot = w / spec.outcomes.length;
    const barW = Math.min(slot * 0.6, 54);
    spec.outcomes.forEach((label, i) => {
      const cx = pad.l + slot * (i + 0.5);
      const y = sy(rel[i]);
      ctx.fillStyle = vars["--series-1"];
      ctx.globalAlpha = 0.75;
      ctx.fillRect(cx - barW / 2, y, barW, pad.t + h - y);
      ctx.globalAlpha = 1;

      // the theoretical value as a rule across the bar
      const ty = Math.round(sy(spec.theory[i])) + 0.5;
      ctx.strokeStyle = vars["--series-2"];
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx - barW / 2 - 5, ty);
      ctx.lineTo(cx + barW / 2 + 5, ty);
      ctx.stroke();

      ctx.fillStyle = vars["--text-secondary"];
      ctx.font = LABEL_FONT;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(String(label), cx, pad.t + h + 6);
    });

    ctx.strokeStyle = vars["--baseline"];
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(pad.l, Math.round(pad.t + h) + 0.5);
    ctx.lineTo(pad.l + w, Math.round(pad.t + h) + 0.5);
    ctx.stroke();

    legend.innerHTML = legendHTML([
      ["相対度数（実際に出た割合）", vars["--series-1"]],
      ["理論の確率", vars["--series-2"]],
    ]);
  }

  function drawConvergence() {
    const { ctx, width, height } = setupCanvasDPR(conv);
    ctx.clearRect(0, 0, width, height);
    const vars = readVars(conv.parentElement, [
      "--surface-1", "--muted", "--gridline", "--baseline",
      "--text-primary", "--text-secondary", "--series-1", "--series-2",
    ]);

    const pad = { l: 46, r: 14, t: 14, b: 30 };
    const w = width - pad.l - pad.r;
    const h = height - pad.t - pad.b;
    if (w <= 10 || h <= 10) return;

    const idx = tally.watchIndex();
    const p = spec.theory[idx];
    const yLo = Math.max(0, p - Math.max(0.28, p * 1.1));
    const yHi = p + Math.max(0.28, p * 1.1);
    const nMax = Math.max(10, tally.n);
    const sx = (n) => pad.l + (Math.log10(Math.max(1, n)) / Math.log10(nMax)) * w;
    const sy = (v) => pad.t + h - ((v - yLo) / (yHi - yLo)) * h;

    ctx.strokeStyle = vars["--gridline"];
    ctx.fillStyle = vars["--muted"];
    ctx.font = SMALL_FONT;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (let k = 0; k <= 4; k++) {
      const v = yLo + ((yHi - yLo) * k) / 4;
      const y = Math.round(sy(v)) + 0.5;
      ctx.beginPath();
      ctx.moveTo(pad.l, y);
      ctx.lineTo(pad.l + w, y);
      ctx.stroke();
      ctx.fillText(v.toFixed(2), pad.l - 6, y);
    }
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    for (let e = 0; Math.pow(10, e) <= nMax; e++) {
      const n = Math.pow(10, e);
      const x = Math.round(sx(n)) + 0.5;
      ctx.strokeStyle = vars["--gridline"];
      ctx.beginPath();
      ctx.moveTo(x, pad.t);
      ctx.lineTo(x, pad.t + h);
      ctx.stroke();
      ctx.fillStyle = vars["--muted"];
      ctx.fillText(n >= 10000 ? `${n / 1000}千` : String(n), x, pad.t + h + 6);
    }

    ctx.strokeStyle = vars["--series-2"];
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(pad.l, sy(p));
    ctx.lineTo(pad.l + w, sy(p));
    ctx.stroke();
    ctx.setLineDash([]);

    if (tally.history.length > 1) {
      ctx.strokeStyle = vars["--series-1"];
      ctx.lineWidth = 2;
      ctx.lineJoin = "round";
      ctx.beginPath();
      tally.history.forEach(([n, v], i) => {
        const x = sx(n);
        const y = sy(Math.max(yLo, Math.min(yHi, v)));
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }
  }

  function render() {
    drawBars();
    drawConvergence();
    watchLabel.textContent = spec.watchLabel;
    stats.n.textContent = tally.n.toLocaleString("ja-JP");
    stats.rel.textContent = tally.n ? tally.maxRelGap().toFixed(4) : "—";
    stats.count.textContent = tally.n ? `${Math.round(tally.maxCountGap()).toLocaleString("ja-JP")} 回` : "—";

    if (!tally.n) {
      note.textContent = `${spec.theoryLabel}。まだ 1 回も振っていません。ボタンで回数を増やしてください。`;
      convNote.textContent = "";
      return;
    }
    const rel = tally.maxRelGap();
    const cnt = tally.maxCountGap();
    note.textContent =
      `${tally.n.toLocaleString("ja-JP")} 回で、相対度数の理論値からのずれは最大 ${rel.toFixed(4)}。` +
      `一方で「出た回数そのもの」のずれは ${Math.round(cnt).toLocaleString("ja-JP")} 回あります。` +
      `回数を増やすと前者は 0 に近づきますが、後者はむしろ大きくなっていきます（およそ √回数 に比例）。` +
      `「そろそろ出ていない目が出るはず」が誤りなのはこのためで、` +
      `ならされるのは割合であって、回数の差ではありません。`;
    convNote.textContent =
      `いま ${spec.watchLabel} の相対度数は ${tally.watchedRel().toFixed(4)}（理論値 ${spec.theory[tally.watchIndex()].toFixed(4)}）。` +
      `横軸は対数目盛なので、右へ 1 目盛りで回数が 10 倍です。左端の暴れ方と右端の落ち着き方を見くらべてください。`;
  }

  function add(n) {
    tally.add(n);
    render();
  }

  $("pb1").addEventListener("click", () => add(1));
  $("pb10").addEventListener("click", () => add(10));
  $("pb100").addEventListener("click", () => add(100));
  $("pb1000").addEventListener("click", () => add(1000));
  $("pb100000").addEventListener("click", () => add(100000));
  $("pbReset").addEventListener("click", () => {
    tally.reset();
    render();
  });

  presetHost.innerHTML = EXPERIMENTS.map(
    (e) => `<button type="button" class="chip" data-key="${e.key}">${e.label}</button>`
  ).join("");
  presetHost.addEventListener("click", (evt) => {
    const btn = evt.target.closest("button[data-key]");
    if (!btn) return;
    spec = experimentByKey(btn.dataset.key);
    tally = new Tally(spec);
    for (const b of presetHost.querySelectorAll("button")) {
      b.classList.toggle("chip-accent", b.dataset.key === spec.key);
    }
    render();
  });
  presetHost.querySelector("button").classList.add("chip-accent");

  return {
    show() {},
    redraw() {
      render();
    },
  };
}
