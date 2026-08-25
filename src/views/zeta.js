import { ZEROS, psiJumps, psiExact, psiApprox, rmsError, maxError } from "../zeta.js";
import { readVars, setupCanvasDPR, niceTicks } from "../chart.js";

const $ = (id) => document.getElementById(id);
const TICK_FONT = "11px system-ui, -apple-system, 'Segoe UI', sans-serif";
const PAD = { top: 14, right: 16, bottom: 30, left: 50 };
const X_MIN = 2;

export function initZetaView() {
  const xSlider = $("ztRange");
  const xOut = $("ztRangeOut");
  const kSlider = $("ztZeros");
  const kOut = $("ztZerosOut");
  const playBtn = $("ztPlay");
  const canvas = $("ztCanvas");
  const legend = $("ztLegend");
  const statZeros = $("ztStatZeros");
  const statRms = $("ztStatRms");
  const statMax = $("ztStatMax");
  const zeroList = $("ztZeroList");

  let xMax = Number(xSlider.value);
  let k = Number(kSlider.value);
  let jumps = psiJumps(xMax);
  let playing = false;
  let animHandle = null;
  let visible = false;
  let lastFrame = 0;

  function draw() {
    const { ctx, width, height } = setupCanvasDPR(canvas);
    ctx.clearRect(0, 0, width, height);
    const vars = readVars(canvas.parentElement, [
      "--muted",
      "--gridline",
      "--baseline",
      "--series-1",
      "--series-2",
      "--surface-1",
    ]);

    const w = width - PAD.left - PAD.right;
    const h = height - PAD.top - PAD.bottom;
    if (w <= 0 || h <= 0) return;

    // Both curves share one scale; psi(x) ~ x sets the ceiling.
    const yMax = xMax * 1.12;
    const sx = (x) => PAD.left + ((x - X_MIN) / (xMax - X_MIN)) * w;
    const sy = (y) => PAD.top + h - (Math.max(0, y) / yMax) * h;

    ctx.strokeStyle = vars["--gridline"];
    ctx.lineWidth = 1;
    ctx.fillStyle = vars["--muted"];
    ctx.font = TICK_FONT;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (const t of niceTicks(0, yMax, 5)) {
      const y = Math.round(sy(t)) + 0.5;
      ctx.beginPath();
      ctx.moveTo(PAD.left, y);
      ctx.lineTo(PAD.left + w, y);
      ctx.stroke();
      ctx.fillText(String(Math.round(t)), PAD.left - 7, sy(t));
    }
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    for (const t of niceTicks(X_MIN, xMax, 6)) {
      ctx.fillText(String(Math.round(t)), sx(t), PAD.top + h + 7);
    }

    // exact psi: a staircase jumping at every prime power
    ctx.strokeStyle = vars["--series-1"];
    ctx.lineWidth = 2;
    ctx.lineJoin = "miter";
    ctx.beginPath();
    let running = 0;
    let prevX = X_MIN;
    for (const j of jumps) {
      if (j.at < X_MIN) {
        running += j.weight;
        continue;
      }
      if (j.at > xMax) break;
      ctx.lineTo(sx(prevX), sy(running));
      ctx.lineTo(sx(j.at), sy(running));
      running += j.weight;
      ctx.lineTo(sx(j.at), sy(running));
      prevX = j.at;
    }
    ctx.lineTo(sx(xMax), sy(running));
    ctx.stroke();

    // the explicit formula, truncated to k zero pairs
    ctx.strokeStyle = vars["--series-2"];
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    ctx.beginPath();
    const samples = Math.max(600, Math.round(w * 2));
    for (let i = 0; i <= samples; i++) {
      const x = X_MIN + ((xMax - X_MIN) * i) / samples;
      const y = psiApprox(x, k);
      if (i === 0) ctx.moveTo(sx(x), sy(y));
      else ctx.lineTo(sx(x), sy(y));
    }
    ctx.stroke();

    ctx.strokeStyle = vars["--baseline"];
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(PAD.left, PAD.top + h + 0.5);
    ctx.lineTo(PAD.left + w, PAD.top + h + 0.5);
    ctx.stroke();

    legend.innerHTML =
      `<span class="legend-item"><span class="legend-dot" style="background:${vars["--series-1"]}"></span>ψ(x) 実際の階段（素数べきで跳ぶ）</span>` +
      `<span class="legend-item"><span class="legend-dot" style="background:${vars["--series-2"]}"></span>明示公式（零点 ${k} 個）</span>`;
  }

  function updateStats() {
    statZeros.textContent = `${k} / ${ZEROS.length}`;
    statRms.textContent = rmsError(X_MIN, xMax, k, jumps).toFixed(3);
    statMax.textContent = maxError(X_MIN, xMax, k, jumps).toFixed(3);
  }

  function refresh() {
    xOut.textContent = String(xMax);
    kOut.textContent = String(k);
    updateStats();
    draw();
  }

  function stopAnim() {
    if (animHandle) cancelAnimationFrame(animHandle);
    animHandle = null;
  }

  function tick(now) {
    if (!playing || !visible) {
      animHandle = null;
      return;
    }
    if (now - lastFrame >= 160) {
      lastFrame = now;
      k = k >= ZEROS.length ? 0 : k + 1;
      kSlider.value = String(k);
      refresh();
    }
    animHandle = requestAnimationFrame(tick);
  }

  function setPlaying(next) {
    playing = next;
    playBtn.textContent = playing ? "停止" : "零点を1つずつ足す";
    playBtn.classList.toggle("btn-primary", !playing);
    stopAnim();
    if (playing && visible) {
      lastFrame = 0;
      animHandle = requestAnimationFrame(tick);
    }
  }

  xSlider.addEventListener("input", () => {
    xMax = Number(xSlider.value);
    jumps = psiJumps(xMax);
    refresh();
  });

  kSlider.addEventListener("input", () => {
    k = Number(kSlider.value);
    setPlaying(false);
    refresh();
  });

  playBtn.addEventListener("click", () => setPlaying(!playing));

  zeroList.textContent = ZEROS.slice(0, 12)
    .map((z) => z.toFixed(6))
    .join(", ") + ", …";

  return {
    show() {
      visible = true;
      if (playing) setPlaying(true);
    },
    hide() {
      visible = false;
      stopAnim();
    },
    redraw() {
      refresh();
    },
  };
}
