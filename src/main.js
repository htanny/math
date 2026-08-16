import "./style.css";
import { computeSequence, findRecordHolders } from "./collatz.js";
import { LineChart, BarChart } from "./chart.js";

const $ = (id) => document.getElementById(id);

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

const themeToggle = $("themeToggle");
const themeIcon = $("themeIcon");

const lineChart = new LineChart($("lineChart"), $("lineTooltip"));
const barChart = new BarChart($("barChart"), $("barTooltip"));

const MAX_PINNED = 2;
const SERIES_COLORS_VAR = ["--series-1", "--series-2", "--series-3"];

let current = null;
let animIndex = 0;
let animHandle = null;
let paused = false;
let pinned = [];

function fmt(n) {
  return n.toLocaleString("en-US");
}

function seriesColor(i) {
  return getComputedStyle(document.body).getPropertyValue(SERIES_COLORS_VAR[i]).trim();
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
  const items = [];
  pinned.forEach((p, i) => {
    items.push({ label: `開始値 ${fmt(p.start)}`, color: seriesColor(i) });
  });
  if (current) {
    items.push({
      label: `開始値 ${fmt(current.start)}（現在）`,
      color: seriesColor(Math.min(pinned.length, SERIES_COLORS_VAR.length - 1)),
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
  const revealCount = animIndex + 1;
  lineChart.setData(buildSeries(revealCount));
  renderLegend();

  const value = current.sequence[animIndex];
  tickerValue.textContent = fmt(value);
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
  statStatus.textContent = "計算中…";
}

function finishAnimation() {
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
  if (!result) return;
  startAnimation(result);
}

startForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const n = Math.trunc(Number(startInput.value));
  if (!Number.isFinite(n) || n < 1) return;
  runFor(n);
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

  const records = findRecordHolders(limit);
  barChart.setData(records);
  if (records.length) {
    const best = records[records.length - 1];
    rangeBestSteps.textContent = fmt(best.steps);
    rangeBestStart.textContent = fmt(best.start);
  }
});

function applyThemeIcon() {
  const explicit = document.documentElement.dataset.theme;
  const isDark = explicit ? explicit === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
  themeIcon.textContent = isDark ? "☀️" : "🌙";
}

themeToggle.addEventListener("click", () => {
  const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const themeNow = document.documentElement.dataset.theme || (isDark ? "dark" : "light");
  document.documentElement.dataset.theme = themeNow === "dark" ? "light" : "dark";
  applyThemeIcon();
  lineChart.render();
  barChart.render();
});

let resizeTimer = null;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    lineChart.render();
    barChart.render();
  }, 100);
});

applyThemeIcon();
runFor(27);
