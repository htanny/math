import { computeSequence, findRecordHolders } from "../collatz.js";
import { LineChart, BarChart } from "../chart.js";

const $ = (id) => document.getElementById(id);
const fmt = (n) => n.toLocaleString("en-US");

const MAX_PINNED = 2;
const SERIES_VARS = ["--series-1", "--series-2", "--series-3"];

export function initCollatzView() {
  const startForm = $("startForm");
  const startInput = $("startInput");
  const randomBtn = $("randomBtn");
  const speedSelect = $("speedSelect");
  const logScaleToggle = $("logScaleToggle");
  const pauseBtn = $("pauseBtn");
  const compareBtn = $("compareBtn");
  const clearCompareBtn = $("clearCompareBtn");
  const tickerEl = $("ticker");
  const tickerValue = $("tickerValue");
  const tickerStep = $("tickerStep");
  const compareLegend = $("compareLegend");
  const statSteps = $("statSteps");
  const statMax = $("statMax");
  const statMaxStep = $("statMaxStep");
  const statStatus = $("statStatus");

  const rangeForm = $("rangeForm");
  const rangeInput = $("rangeInput");
  const rangeBestSteps = $("rangeBestSteps");
  const rangeBestStart = $("rangeBestStart");

  const lineChart = new LineChart($("lineChart"), $("lineTooltip"));
  const barChart = new BarChart($("barChart"), $("barTooltip"), {
    tooltip: (d) =>
      `<div class="tt-title">開始値 ${d.label}</div>ステップ数: ${fmt(d.value)}`,
  });

  let current = null;
  let animIndex = 0;
  let animHandle = null;
  let paused = false;
  let done = false;
  let pinned = [];
  let records = [];

  function seriesColor(i) {
    return getComputedStyle(document.body).getPropertyValue(SERIES_VARS[i]).trim();
  }

  function buildSeries(revealCount) {
    const series = pinned.map((p) => ({ label: `開始値 ${fmt(p.start)}`, values: p.sequence }));
    if (current) {
      series.push({
        label: `開始値 ${fmt(current.start)}（現在）`,
        values: current.sequence.slice(0, revealCount),
      });
    }
    return series;
  }

  function renderLegend() {
    const items = pinned.map((p, i) => ({ label: `開始値 ${fmt(p.start)}`, color: seriesColor(i) }));
    if (current) {
      items.push({
        label: `開始値 ${fmt(current.start)}（現在）`,
        color: seriesColor(Math.min(pinned.length, SERIES_VARS.length - 1)),
      });
    }
    if (items.length < 2) {
      compareLegend.innerHTML = "";
      return;
    }
    compareLegend.innerHTML = items
      .map(
        (it) =>
          `<span class="legend-item"><span class="legend-dot" style="background:${it.color}"></span>${it.label}</span>`
      )
      .join("");
  }

  function renderFrame() {
    if (!current) return;
    lineChart.setData(buildSeries(animIndex + 1));
    renderLegend();

    tickerValue.textContent = fmt(current.sequence[animIndex]);
    tickerStep.textContent = String(animIndex);

    let runningMax = current.start;
    let runningMaxStep = 0;
    for (let i = 1; i <= animIndex; i++) {
      if (current.sequence[i] > runningMax) {
        runningMax = current.sequence[i];
        runningMaxStep = i;
      }
    }
    statSteps.textContent = fmt(animIndex);
    statMax.textContent = fmt(runningMax);
    statMaxStep.textContent = fmt(runningMaxStep);
    if (!done) statStatus.textContent = "計算中…";
  }

  function finishAnimation() {
    cancelAnimation();
    done = true;
    animIndex = current.sequence.length - 1;
    renderFrame();
    statSteps.textContent = fmt(current.steps);
    statMax.textContent = fmt(current.maxValue);
    statMaxStep.textContent = fmt(current.maxStep);
    statStatus.textContent = current.converged ? "1 に到達 ✓" : "上限到達（未収束）";
    tickerEl.classList.toggle("done", current.converged);
    pauseBtn.disabled = true;
    pauseBtn.textContent = "一時停止";
    compareBtn.disabled = false;
  }

  function cancelAnimation() {
    if (animHandle) cancelAnimationFrame(animHandle);
    animHandle = null;
  }

  function startAnimation(result) {
    cancelAnimation();
    current = result;
    animIndex = 0;
    paused = false;
    done = false;
    tickerEl.classList.remove("done");
    pauseBtn.disabled = false;
    pauseBtn.textContent = "一時停止";
    compareBtn.disabled = true;
    statStatus.textContent = "計算中…";

    const speed = Number(speedSelect.value);
    if (speed === 0 || current.sequence.length <= 1) {
      finishAnimation();
      return;
    }

    let lastTime = performance.now();
    const step = (now) => {
      if (paused) {
        animHandle = requestAnimationFrame(step);
        return;
      }
      if (now - lastTime >= speed) {
        lastTime = now;
        animIndex++;
        if (animIndex >= current.sequence.length - 1) {
          finishAnimation();
          return;
        }
        renderFrame();
      }
      animHandle = requestAnimationFrame(step);
    };
    renderFrame();
    animHandle = requestAnimationFrame(step);
  }

  function runFor(n) {
    const result = computeSequence(n);
    if (result) startAnimation(result);
  }

  startForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const n = Math.trunc(Number(startInput.value));
    if (Number.isFinite(n) && n >= 1) runFor(n);
  });

  randomBtn.addEventListener("click", () => {
    const n = 2 + Math.floor(Math.random() * 999998);
    startInput.value = String(n);
    runFor(n);
  });

  document.querySelectorAll(".chip[data-preset]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const n = Number(btn.dataset.preset);
      startInput.value = String(n);
      runFor(n);
    });
  });

  pauseBtn.addEventListener("click", () => {
    paused = !paused;
    pauseBtn.textContent = paused ? "再開" : "一時停止";
  });

  compareBtn.addEventListener("click", () => {
    if (!current) return;
    if (!pinned.some((p) => p.start === current.start)) {
      pinned.push(current);
      if (pinned.length > MAX_PINNED) pinned.shift();
    }
    clearCompareBtn.disabled = false;
    renderFrame();
  });

  clearCompareBtn.addEventListener("click", () => {
    pinned = [];
    clearCompareBtn.disabled = true;
    if (current) renderFrame();
  });

  logScaleToggle.addEventListener("change", () => {
    lineChart.setLogScale(logScaleToggle.checked);
  });

  rangeForm.addEventListener("submit", (e) => {
    e.preventDefault();
    let limit = Math.trunc(Number(rangeInput.value));
    if (!Number.isFinite(limit) || limit < 1) return;
    limit = Math.min(limit, 200000);
    rangeInput.value = String(limit);

    records = findRecordHolders(limit).map((r) => ({ label: fmt(r.start), value: r.steps }));
    barChart.setData(records);
    if (records.length) {
      const best = records[records.length - 1];
      rangeBestSteps.textContent = fmt(best.value);
      rangeBestStart.textContent = best.label;
    }
  });

  let booted = false;

  return {
    show() {
      if (!booted) {
        booted = true;
        runFor(27);
      }
    },
    hide() {
      // Finish rather than freeze: coming back to a half-drawn run reads as a bug.
      if (animHandle && current) finishAnimation();
    },
    redraw() {
      if (current) renderFrame();
      barChart.setData(records);
    },
  };
}
