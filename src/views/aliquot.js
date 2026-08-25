import { aliquotSequence, scanRange, STEP_CAP, VALUE_CAP } from "../aliquot.js";
import { LineChart, BarChart } from "../chart.js";

const $ = (id) => document.getElementById(id);
const fmt = (n) => n.toLocaleString("en-US");

// `noun` names the cycle a sequence ends in. Whether the starting value is
// itself part of that cycle changes the wording — 25 falls into the perfect
// number 6, but 25 is not a perfect number.
const KINDS = {
  terminal: { noun: null, label: "1に到達", short: "1に到達", color: "--good" },
  perfect: { noun: "完全数", short: "完全数へ", color: "--series-1" },
  amicable: { noun: "友愛数", short: "友愛数へ", color: "--series-2" },
  sociable: { noun: "社交数", short: "社交数へ", color: "--series-3" },
  open: { noun: null, label: "未決着（打ち切り）", short: "未決着", color: "--warning" },
};

export function initAliquotView() {
  const form = $("alqForm");
  const input = $("alqInput");
  const randomBtn = $("alqRandomBtn");
  const speedSelect = $("alqSpeed");
  const logToggle = $("alqLogToggle");
  const pauseBtn = $("alqPauseBtn");
  const tickerEl = $("alqTicker");
  const tickerValue = $("alqTickerValue");
  const tickerStep = $("alqTickerStep");
  const cycleBox = $("alqCycle");
  const statSteps = $("alqSteps");
  const statMax = $("alqMax");
  const statMaxStep = $("alqMaxStep");
  const statClass = $("alqClass");

  const scanForm = $("alqScanForm");
  const scanInput = $("alqScanInput");
  const scanNote = $("alqScanNote");

  const chart = new LineChart($("alqChart"), $("alqTooltip"));
  chart.setLogScale(true);

  const scanChart = new BarChart($("alqScanChart"), $("alqScanTooltip"), {
    xLabels: true,
    tooltip: (d) => `<div class="tt-title">${d.label}</div>${fmt(d.value)} 個`,
  });

  let current = null;
  let animIndex = 0;
  let animHandle = null;
  let paused = false;
  let done = false;
  let scanData = [];

  function kindLabel(kind, cycleLength, startInCycle) {
    const k = KINDS[kind];
    if (!k.noun) return k.label;
    const period = `（${cycleLength}周期）`;
    return startInCycle ? `${k.noun}${period}` : `${k.noun}に到達${period}`;
  }

  function kindBadge(kind, cycleLength, startInCycle) {
    const k = KINDS[kind];
    const color = getComputedStyle(document.body).getPropertyValue(k.color).trim();
    const label = kindLabel(kind, cycleLength, startInCycle);
    return `<span class="badge"><span class="badge-dot" style="background:${color}"></span>${label}</span>`;
  }

  // One box, three mutually exclusive outcomes: a cycle to show off, a
  // truncation to be honest about, or nothing.
  function renderOutcomeBox() {
    if (!current) {
      cycleBox.hidden = true;
      return;
    }
    if (current.cycle) {
      const loop = current.cycle.concat(current.cycle[0]);
      cycleBox.hidden = false;
      cycleBox.innerHTML =
        `<span class="cycle-title">循環</span>` +
        `<span class="cycle-body">${loop.map(fmt).join(" → ")}</span>`;
      return;
    }
    if (current.status === "overflow" || current.status === "truncated") {
      const exponent = Math.round(Math.log10(VALUE_CAP));
      const reason =
        current.status === "overflow"
          ? `値が上限 10^${exponent} を超えたため、ここで打ち切りました。実際の数列はこの先も続きます。`
          : `ステップ上限 ${STEP_CAP} に達したため打ち切りました。`;
      cycleBox.hidden = false;
      cycleBox.innerHTML = `<span class="cycle-title">打ち切り</span><span class="cycle-body">${reason}</span>`;
      return;
    }
    cycleBox.hidden = true;
  }

  function renderFrame() {
    if (!current) return;
    chart.setData([
      { label: `開始値 ${fmt(current.start)}`, values: current.sequence.slice(0, animIndex + 1) },
    ]);

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
    if (!done) statClass.textContent = "計算中…";
  }

  function renderFinalState() {
    statSteps.textContent = fmt(current.steps);
    statMax.textContent = fmt(current.maxValue);
    statMaxStep.textContent = fmt(current.maxStep);
    statClass.innerHTML = kindBadge(
      current.classification,
      current.cycle ? current.cycle.length : 0,
      current.startInCycle
    );
    tickerEl.classList.toggle("done", current.classification !== "open");
    renderOutcomeBox();
  }

  function finishAnimation() {
    cancelAnimation();
    done = true;
    animIndex = current.sequence.length - 1;
    renderFrame();
    renderFinalState();
    pauseBtn.disabled = true;
    pauseBtn.textContent = "一時停止";
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
    cycleBox.hidden = true;
    tickerEl.classList.remove("done");
    pauseBtn.disabled = false;
    pauseBtn.textContent = "一時停止";
    statClass.textContent = "計算中…";

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
    const result = aliquotSequence(n);
    if (result) startAnimation(result);
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const n = Math.trunc(Number(input.value));
    if (Number.isFinite(n) && n >= 1) runFor(n);
  });

  randomBtn.addEventListener("click", () => {
    const n = 2 + Math.floor(Math.random() * 99998);
    input.value = String(n);
    runFor(n);
  });

  document.querySelectorAll(".chip[data-alq]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const n = Number(btn.dataset.alq);
      input.value = String(n);
      runFor(n);
    });
  });

  pauseBtn.addEventListener("click", () => {
    paused = !paused;
    pauseBtn.textContent = paused ? "再開" : "一時停止";
  });

  logToggle.addEventListener("change", () => chart.setLogScale(logToggle.checked));

  scanForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const limit = Math.min(Math.max(Math.trunc(Number(scanInput.value)) || 0, 10), 50000);
    scanInput.value = String(limit);

    scanNote.textContent = "集計中…";
    // Yield once so the "集計中…" paint lands before the sieve blocks the thread.
    requestAnimationFrame(() => {
      const { counts, longest } = scanRange(limit);
      scanData = Object.keys(KINDS).map((kind) => ({
        label: KINDS[kind].short,
        value: counts[kind],
        color: KINDS[kind].color,
        kind,
      }));
      scanChart.setData(scanData);
      scanNote.innerHTML =
        `1〜${fmt(limit)} のうち — ` +
        Object.keys(KINDS)
          .map((k) => `${KINDS[k].short} <strong>${fmt(counts[k])}</strong>`)
          .join(" / ") +
        `。最も長く続いて決着したのは <strong>${fmt(longest.start)}</strong>（${fmt(longest.steps)} ステップ）。` +
        `<br />「完全数へ」は<em>その数自身が完全数である</em>という意味ではなく、` +
        `数列の行き着く先が完全数の循環だという意味です（例: 25 → 6 → 6）。` +
        `完全数そのものは 6・28・496・8128・33550336… と極端に少なく、この集計の大半は「落ちた先」の数です。`;
    });
  });

  let booted = false;

  return {
    show() {
      if (!booted) {
        booted = true;
        runFor(220);
      }
    },
    hide() {
      if (animHandle && current) finishAnimation();
    },
    redraw() {
      if (current) {
        renderFrame();
        if (done) renderFinalState();
      }
      scanChart.setData(scanData);
    },
  };
}
