import { readVars, setupCanvasDPR } from "../chart.js";
import {
  normalPdf, binomialPmf, ballPath, SOURCES, sourceByKey,
  sampleMeans, histogram, meanSd,
} from "../clt.js";

const $ = (id) => document.getElementById(id);
const TAU = Math.PI * 2;
const SMALL_FONT = "11px system-ui, -apple-system, 'Segoe UI', sans-serif";
const LABEL_FONT = "12px system-ui, -apple-system, 'Segoe UI', sans-serif";

export function initCltView() {
  /* ------------------------------------------------- panel 1: Galton board -- */
  const board = $("clBoard");
  const rowsSlider = $("clRows");
  const rowsOut = $("clRowsOut");
  const dropBtn = $("clDrop");
  const drop1000 = $("clDrop1000");
  const resetBtn = $("clReset");
  const curveToggle = $("clCurve");
  const note = $("clNote");
  const stats = { count: $("clCount"), mean: $("clMean"), sd: $("clSd") };

  let rows = Number(rowsSlider.value);
  let bins = new Array(rows + 1).fill(0);
  let total = 0;
  let flying = null;
  let raf = null;

  function resetBoard() {
    rows = Number(rowsSlider.value);
    bins = new Array(rows + 1).fill(0);
    total = 0;
    flying = null;
  }

  function boardStats() {
    if (!total) return { mean: 0, sd: 0 };
    let s = 0;
    for (let k = 0; k <= rows; k++) s += k * bins[k];
    const mean = s / total;
    let q = 0;
    for (let k = 0; k <= rows; k++) q += bins[k] * (k - mean) ** 2;
    return { mean, sd: Math.sqrt(q / total) };
  }

  function drawBoard() {
    const { ctx, width, height } = setupCanvasDPR(board);
    ctx.clearRect(0, 0, width, height);
    const vars = readVars(board.parentElement, [
      "--surface-1", "--muted", "--gridline", "--baseline",
      "--text-primary", "--text-secondary", "--series-1", "--series-2", "--series-3",
    ]);

    const pad = { l: 18, r: 18, t: 14, b: 26 };
    const w = width - pad.l - pad.r;
    const pegH = (height - pad.t - pad.b) * 0.46;
    const histTop = pad.t + pegH + 12;
    const histH = height - pad.b - histTop;
    if (w <= 20 || histH <= 20) return;

    const slot = w / (rows + 1);
    // row r holds r pegs, sitting exactly where a ball can be after r-1
    // bounces — so the ball's path visibly runs from peg to peg
    const pegX = (r, s) => pad.l + w / 2 + (s - (r - 1) / 2) * slot;
    const pegY = (r) => pad.t + ((r - 1) / Math.max(1, rows - 1)) * pegH;

    ctx.fillStyle = vars["--muted"];
    for (let r = 1; r <= rows; r++) {
      for (let s = 0; s < r; s++) {
        ctx.beginPath();
        ctx.arc(pegX(r, s), pegY(r), Math.min(3.2, slot / 6), 0, TAU);
        ctx.fill();
      }
    }

    const maxCount = Math.max(1, ...bins);
    const barW = slot * 0.82;
    for (let k = 0; k <= rows; k++) {
      const h = (bins[k] / maxCount) * histH;
      const cx = pad.l + slot * (k + 0.5);
      ctx.fillStyle = vars["--series-1"];
      ctx.globalAlpha = 0.75;
      ctx.fillRect(cx - barW / 2, histTop + histH - h, barW, h);
      ctx.globalAlpha = 1;
    }

    if (curveToggle.checked && total > 0) {
      const mu = rows / 2;
      const sigma = Math.sqrt(rows) / 2;
      // scale so the curve's peak matches the tallest expected bar
      const peak = binomialPmf(rows, Math.round(mu)) * total;
      const scale = (peak / maxCount) * histH / normalPdf(mu, mu, sigma);
      ctx.strokeStyle = vars["--series-2"];
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (let i = 0; i <= 200; i++) {
        const k = (rows * i) / 200;
        const x = pad.l + slot * (k + 0.5);
        const y = histTop + histH - normalPdf(k, mu, sigma) * scale;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    ctx.strokeStyle = vars["--baseline"];
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(pad.l, Math.round(histTop + histH) + 0.5);
    ctx.lineTo(pad.l + w, Math.round(histTop + histH) + 0.5);
    ctx.stroke();

    ctx.fillStyle = vars["--muted"];
    ctx.font = SMALL_FONT;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    const labelEvery = rows > 12 ? 2 : 1;
    for (let k = 0; k <= rows; k += labelEvery) {
      ctx.fillText(String(k), pad.l + slot * (k + 0.5), histTop + histH + 5);
    }

    if (flying) {
      const [r, s] = flying.at;
      const x = pad.l + w / 2 + (s - r / 2) * slot;
      const y = pad.t + (r / Math.max(1, rows)) * pegH;
      ctx.fillStyle = vars["--series-3"];
      ctx.beginPath();
      ctx.arc(x, y, Math.min(6, slot / 3), 0, TAU);
      ctx.fill();
    }
  }

  function renderBoard() {
    rowsOut.textContent = rowsSlider.value;
    drawBoard();
    const { mean, sd } = boardStats();
    stats.count.textContent = total.toLocaleString("ja-JP");
    stats.mean.textContent = total ? `${mean.toFixed(3)}（理論 ${(rows / 2).toFixed(1)}）` : "—";
    stats.sd.textContent = total ? `${sd.toFixed(3)}（${(Math.sqrt(rows) / 2).toFixed(3)}）` : "—";

    note.textContent = total
      ? `${total.toLocaleString("ja-JP")} 個のボールが ${rows} 段の釘を通りました。` +
        `落ちた場所は「右に何回はねたか」なので、山の高さは二項分布そのもの — ` +
        `理論の平均は ${rows}/2 = ${(rows / 2).toFixed(1)}、標準偏差は √${rows}/2 = ${(Math.sqrt(rows) / 2).toFixed(3)} です。` +
        `1個1個は左右どちらに行くか分からないのに、たくさん集まると形が決まってしまうのが不思議なところです。`
      : `${rows} 段の釘。各段で左右に 1/2 ずつ分かれます。ボタンを押してボールを落としてください。`;
  }

  function stopFly() {
    if (raf) cancelAnimationFrame(raf);
    raf = null;
  }

  dropBtn.addEventListener("click", () => {
    if (raf) return;
    const path = ballPath(rows);
    let i = 0;
    let last = performance.now();
    flying = { at: path[0] };
    const step = (now) => {
      if (now - last > 70) {
        i++;
        last = now;
        if (i >= path.length) {
          bins[path[path.length - 1][1]]++;
          total++;
          flying = null;
          raf = null;
          renderBoard();
          return;
        }
        flying = { at: path[i] };
      }
      renderBoard();
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  });

  drop1000.addEventListener("click", () => {
    for (let i = 0; i < 1000; i++) {
      const path = ballPath(rows);
      bins[path[path.length - 1][1]]++;
      total++;
    }
    renderBoard();
  });

  resetBtn.addEventListener("click", () => {
    stopFly();
    resetBoard();
    renderBoard();
  });

  rowsSlider.addEventListener("input", () => {
    stopFly();
    resetBoard();
    renderBoard();
  });
  curveToggle.addEventListener("change", renderBoard);

  /* ------------------------------------------------- panel 2: sample means -- */
  const meansCanvas = $("clMeans");
  const nSlider = $("clN");
  const nOut = $("clNOut");
  const resample = $("clResample");
  const sourceHost = $("clSources");
  const meanNote = $("clMeanNote");
  const mStats = { mean: $("clMm"), sd: $("clMsd"), theory: $("clTheory") };

  let source = SOURCES[0];
  const TRIALS = 6000;
  let raw = null;
  let means = null;

  function resampleAll() {
    const n = Number(nSlider.value);
    raw = sampleMeans(source, 1, TRIALS);
    means = sampleMeans(source, n, TRIALS);
  }

  function drawHist(ctx, vars, box, values, lo, hi, color, overlay) {
    const bins = 48;
    const h = histogram(values, lo, hi, bins);
    const maxC = Math.max(1, ...h.counts);
    const bw = box.w / bins;
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.7;
    for (let i = 0; i < bins; i++) {
      const barH = (h.counts[i] / maxC) * box.h;
      ctx.fillRect(box.x + i * bw, box.y + box.h - barH, Math.max(1, bw - 1), barH);
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = vars["--baseline"];
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(box.x, Math.round(box.y + box.h) + 0.5);
    ctx.lineTo(box.x + box.w, Math.round(box.y + box.h) + 0.5);
    ctx.stroke();

    if (overlay) {
      const { mu, sigma } = overlay;
      // match the curve's peak to the tallest bar so the shapes are comparable
      const scale = box.h / normalPdf(mu, mu, sigma);
      ctx.strokeStyle = vars["--series-2"];
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      let started = false;
      for (let i = 0; i <= 240; i++) {
        const x = lo + ((hi - lo) * i) / 240;
        const peakCount = normalPdf(mu, mu, sigma) * values.length * h.w;
        const y =
          box.y + box.h - (normalPdf(x, mu, sigma) * scale * Math.min(1, peakCount / maxC));
        const px = box.x + ((x - lo) / (hi - lo)) * box.w;
        if (!started) {
          ctx.moveTo(px, y);
          started = true;
        } else ctx.lineTo(px, y);
      }
      ctx.stroke();
    }
    return h;
  }

  function drawMeans() {
    const { ctx, width, height } = setupCanvasDPR(meansCanvas);
    ctx.clearRect(0, 0, width, height);
    const vars = readVars(meansCanvas.parentElement, [
      "--surface-1", "--muted", "--gridline", "--baseline",
      "--text-primary", "--text-secondary", "--series-1", "--series-2", "--series-3",
    ]);
    if (!raw) resampleAll();

    const pad = { l: 16, r: 16, t: 24, b: 30 };
    const w = width - pad.l - pad.r;
    const gap = 44;
    const h = (height - pad.t - pad.b - gap) / 2;
    if (w <= 20 || h <= 20) return;

    const [lo, hi] = source.range;
    const n = Number(nSlider.value);

    ctx.fillStyle = vars["--text-secondary"];
    ctx.font = LABEL_FONT;
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    ctx.fillText("元の分布（1個ずつ）", pad.l, pad.t - 6);
    drawHist(ctx, vars, { x: pad.l, y: pad.t, w, h }, raw, lo, hi, vars["--series-3"], null);

    const y2 = pad.t + h + gap;
    ctx.fillStyle = vars["--text-secondary"];
    ctx.textBaseline = "bottom";
    ctx.fillText(`${n} 個の平均をとった分布`, pad.l, y2 - 6);
    drawHist(ctx, vars, { x: pad.l, y: y2, w, h }, means, lo, hi, vars["--series-1"], {
      mu: source.mean,
      sigma: source.sd / Math.sqrt(n),
    });

    ctx.fillStyle = vars["--muted"];
    ctx.font = SMALL_FONT;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    for (let k = 0; k <= 4; k++) {
      const v = lo + ((hi - lo) * k) / 4;
      ctx.fillText(v.toFixed(1), pad.l + (w * k) / 4, y2 + h + 6);
    }
  }

  function renderMeans() {
    const n = Number(nSlider.value);
    nOut.textContent = String(n);
    drawMeans();
    const m = meanSd(means);
    mStats.mean.textContent = m.mean.toFixed(4);
    mStats.sd.textContent = m.sd.toFixed(4);
    mStats.theory.textContent = (source.sd / Math.sqrt(n)).toFixed(4);

    meanNote.textContent =
      `${source.note} いま n = ${n}。標本平均の標準偏差は ${m.sd.toFixed(4)}、` +
      `理論値 σ/√n = ${source.sd.toFixed(4)}/√${n} = ${(source.sd / Math.sqrt(n)).toFixed(4)} とよく合っています。` +
      `2つのグラフは同じ横軸なので、n を増やすと下の山が同じ位置のまま細くなっていくのが見えます。` +
      (n === 1
        ? " n = 1 では「平均」は元の分布そのものなので、上下は同じ形です。ここから n を上げてください。"
        : " 上の分布がどんな形でも、下は釣鐘に近づきます — これが中心極限定理です。");
  }

  nSlider.addEventListener("input", () => {
    resampleAll();
    renderMeans();
  });
  resample.addEventListener("click", () => {
    resampleAll();
    renderMeans();
  });

  sourceHost.innerHTML = SOURCES.map(
    (s) => `<button type="button" class="chip" data-key="${s.key}">${s.label}</button>`
  ).join("");
  sourceHost.addEventListener("click", (evt) => {
    const btn = evt.target.closest("button[data-key]");
    if (!btn) return;
    source = sourceByKey(btn.dataset.key);
    for (const b of sourceHost.querySelectorAll("button")) {
      b.classList.toggle("chip-accent", b.dataset.key === source.key);
    }
    resampleAll();
    renderMeans();
  });
  sourceHost.querySelector("button").classList.add("chip-accent");

  return {
    show() {},
    hide() {
      stopFly();
    },
    redraw() {
      renderBoard();
      renderMeans();
    },
  };
}
