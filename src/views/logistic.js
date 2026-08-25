import {
  map,
  orbit,
  attractor,
  bifurcationDensity,
  feigenbaumRows,
  ACCUMULATION_POINT,
  FEIGENBAUM_DELTA,
} from "../logistic.js";
import { readVars, setupCanvasDPR, niceTicks } from "../chart.js";

const $ = (id) => document.getElementById(id);
const TICK_FONT = "11px system-ui, -apple-system, 'Segoe UI', sans-serif";

const FULL_WINDOW = { rMin: 2.4, rMax: 4, xMin: 0, xMax: 1 };

const CHROME = [
  "--surface-1",
  "--muted",
  "--gridline",
  "--baseline",
  "--series-1",
  "--series-2",
  "--text-secondary",
];

function hexToRgb(hex) {
  const h = hex.trim().replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const v = parseInt(full, 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

function fmtR(v, digits = 3) {
  return v.toFixed(digits);
}

/** Decimals needed so that adjacent ticks in this range read as different. */
function tickDigits(span) {
  if (span >= 1) return 2;
  if (span >= 0.1) return 3;
  if (span >= 0.01) return 4;
  return 5;
}

export function initLogisticView() {
  const rSlider = $("rSlider");
  const rOut = $("rOut");
  const x0Slider = $("x0Slider");
  const x0Out = $("x0Out");
  const replayBtn = $("cobwebReplay");
  const stepsSelect = $("cobwebSteps");
  const statR = $("logStatR");
  const statPeriod = $("logStatPeriod");
  const statAttractor = $("logStatAttractor");

  const cobwebCanvas = $("cobwebChart");
  const timeCanvas = $("timeChart");
  const bifCanvas = $("bifChart");
  const bifResetBtn = $("bifReset");
  const bifRangeNote = $("bifRange");
  const feigBody = document.querySelector("#feigTable tbody");

  let r = Number(rSlider.value);
  let x0 = Number(x0Slider.value);
  let steps = Number(stepsSelect.value);

  let revealed = 0;
  let animHandle = null;
  let visible = false;

  let win = { ...FULL_WINDOW };
  let bifImage = null;
  let bifOrigin = [0, 0];
  let bifGeom = null;
  let drag = null;

  /* ------------------------------------------------------------- cobweb -- */

  function drawCobweb() {
    const { ctx, width, height } = setupCanvasDPR(cobwebCanvas);
    ctx.clearRect(0, 0, width, height);
    const vars = readVars(cobwebCanvas.parentElement, CHROME);

    const pad = { left: 34, right: 12, top: 12, bottom: 26 };
    const w = width - pad.left - pad.right;
    const h = height - pad.top - pad.bottom;
    if (w <= 0 || h <= 0) return;

    const sx = (x) => pad.left + x * w;
    const sy = (y) => pad.top + h - y * h;

    // frame
    ctx.strokeStyle = vars["--gridline"];
    ctx.lineWidth = 1;
    ctx.strokeRect(pad.left + 0.5, pad.top + 0.5, w - 1, h - 1);

    // y = x
    ctx.strokeStyle = vars["--baseline"];
    ctx.beginPath();
    ctx.moveTo(sx(0), sy(0));
    ctx.lineTo(sx(1), sy(1));
    ctx.stroke();

    // y = r x (1 - x)
    ctx.strokeStyle = vars["--series-2"];
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i <= 200; i++) {
      const x = i / 200;
      const y = map(r, x);
      if (i === 0) ctx.moveTo(sx(x), sy(y));
      else ctx.lineTo(sx(x), sy(y));
    }
    ctx.stroke();

    // the staircase itself
    ctx.strokeStyle = vars["--series-1"];
    ctx.lineWidth = 1.5;
    ctx.lineJoin = "round";
    ctx.beginPath();
    let x = x0;
    let y = 0;
    ctx.moveTo(sx(x), sy(y));
    for (let seg = 0; seg < revealed; seg++) {
      if (seg % 2 === 0) {
        y = map(r, x); // vertical: up to the parabola
      } else {
        x = y; // horizontal: across to the diagonal
      }
      ctx.lineTo(sx(x), sy(y));
    }
    ctx.stroke();

    // where it currently sits
    if (revealed > 0) {
      ctx.fillStyle = vars["--surface-1"];
      ctx.beginPath();
      ctx.arc(sx(x), sy(y), 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = vars["--series-1"];
      ctx.beginPath();
      ctx.arc(sx(x), sy(y), 3.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = vars["--muted"];
    ctx.font = TICK_FONT;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText("0", sx(0), pad.top + h + 7);
    ctx.fillText("x", sx(0.5), pad.top + h + 7);
    ctx.fillText("1", sx(1), pad.top + h + 7);
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText("1", pad.left - 6, sy(1));
    ctx.fillText("0", pad.left - 6, sy(0));
  }

  /* -------------------------------------------------------- time series -- */

  function drawTimeSeries() {
    const { ctx, width, height } = setupCanvasDPR(timeCanvas);
    ctx.clearRect(0, 0, width, height);
    const vars = readVars(timeCanvas.parentElement, CHROME);

    const pad = { left: 34, right: 12, top: 12, bottom: 26 };
    const w = width - pad.left - pad.right;
    const h = height - pad.top - pad.bottom;
    if (w <= 0 || h <= 0) return;

    const shown = Math.max(1, Math.ceil(revealed / 2));
    const values = orbit(r, x0, steps);
    const sx = (i) => pad.left + (i / steps) * w;
    const sy = (v) => pad.top + h - v * h;

    ctx.strokeStyle = vars["--gridline"];
    ctx.lineWidth = 1;
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      const y = Math.round(sy(t)) + 0.5;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(pad.left + w, y);
      ctx.stroke();
    }

    ctx.strokeStyle = vars["--series-1"];
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.beginPath();
    for (let i = 0; i <= Math.min(shown, steps); i++) {
      const px = sx(i);
      const py = sy(values[i]);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    ctx.strokeStyle = vars["--baseline"];
    ctx.beginPath();
    ctx.moveTo(pad.left, pad.top + h + 0.5);
    ctx.lineTo(pad.left + w, pad.top + h + 0.5);
    ctx.stroke();

    ctx.fillStyle = vars["--muted"];
    ctx.font = TICK_FONT;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText("1", pad.left - 6, sy(1));
    ctx.fillText("0.5", pad.left - 6, sy(0.5));
    ctx.fillText("0", pad.left - 6, sy(0));
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText("n = 0", sx(0) + 10, pad.top + h + 7);
    ctx.fillText(String(steps), sx(steps), pad.top + h + 7);
  }

  /* -------------------------------------------------------- bifurcation -- */

  function renderBifurcation() {
    const { ctx, width, height } = setupCanvasDPR(bifCanvas);
    ctx.clearRect(0, 0, width, height);
    const vars = readVars(bifCanvas.parentElement, CHROME);

    const dpr = window.devicePixelRatio || 1;
    const pad = { left: 46, right: 12, top: 12, bottom: 28 };
    const w = width - pad.left - pad.right;
    const h = height - pad.top - pad.bottom;
    if (w <= 0 || h <= 0) return;

    const dw = Math.max(1, Math.round(w * dpr));
    const dh = Math.max(1, Math.round(h * dpr));
    const density = bifurcationDensity(win.rMin, win.rMax, win.xMin, win.xMax, dw, dh);

    const [red, green, blue] = hexToRgb(vars["--series-1"] || "#2a78d6");
    const img = ctx.createImageData(dw, dh);
    const data = img.data;
    for (let i = 0; i < density.length; i++) {
      const d = density[i];
      if (d === 0) continue;
      // Saturating response: one hit already reads, a solid branch goes opaque.
      const t = 1 - Math.exp(-d * 0.45);
      const o = i * 4;
      data[o] = red;
      data[o + 1] = green;
      data[o + 2] = blue;
      data[o + 3] = Math.round(t * 255);
    }

    bifImage = img;
    bifOrigin = [Math.round(pad.left * dpr), Math.round(pad.top * dpr)];
    bifGeom = { pad, w, h, width, height, vars };
    paintBifurcation();
  }

  function paintBifurcation() {
    if (!bifGeom || !bifImage) return;
    const { pad, w, h, width, vars } = bifGeom;
    const ctx = bifCanvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, bifGeom.height);
    ctx.putImageData(bifImage, bifOrigin[0], bifOrigin[1]);

    const rToX = (rv) => pad.left + ((rv - win.rMin) / (win.rMax - win.rMin)) * w;
    const xToY = (xv) => pad.top + h - ((xv - win.xMin) / (win.xMax - win.xMin)) * h;

    // current r, tying this panel to the cobweb above
    if (r >= win.rMin && r <= win.rMax) {
      ctx.strokeStyle = vars["--series-2"];
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(rToX(r), pad.top);
      ctx.lineTo(rToX(r), pad.top + h);
      ctx.stroke();
    }

    ctx.strokeStyle = vars["--baseline"];
    ctx.lineWidth = 1;
    ctx.strokeRect(pad.left + 0.5, pad.top + 0.5, w - 1, h - 1);

    ctx.fillStyle = vars["--muted"];
    ctx.font = TICK_FONT;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    const rDigits = tickDigits(win.rMax - win.rMin);
    for (const t of niceTicks(win.rMin, win.rMax, 6)) {
      ctx.fillText(fmtR(t, rDigits), rToX(t), pad.top + h + 7);
    }
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    const xDigits = tickDigits(win.xMax - win.xMin);
    for (const t of niceTicks(win.xMin, win.xMax, 5)) {
      ctx.fillText(fmtR(t, xDigits), pad.left - 6, xToY(t));
    }

    if (drag && drag.active) {
      const x1 = Math.min(drag.x0, drag.x1);
      const x2 = Math.max(drag.x0, drag.x1);
      const y1 = Math.min(drag.y0, drag.y1);
      const y2 = Math.max(drag.y0, drag.y1);
      ctx.fillStyle = "rgba(127,127,127,0.18)";
      ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
      ctx.strokeStyle = vars["--series-2"];
      ctx.lineWidth = 1;
      ctx.strokeRect(x1 + 0.5, y1 + 0.5, x2 - x1, y2 - y1);
    }

    bifRangeNote.textContent = `r: ${fmtR(win.rMin, rDigits)} 〜 ${fmtR(win.rMax, rDigits)} / x: ${fmtR(
      win.xMin,
      xDigits
    )} 〜 ${fmtR(win.xMax, xDigits)}`;
  }

  function pointerPos(evt) {
    const rect = bifCanvas.getBoundingClientRect();
    return { x: evt.clientX - rect.left, y: evt.clientY - rect.top };
  }

  bifCanvas.addEventListener("pointerdown", (evt) => {
    if (!bifGeom) return;
    const { pad, w, h } = bifGeom;
    const p = pointerPos(evt);
    if (p.x < pad.left || p.x > pad.left + w || p.y < pad.top || p.y > pad.top + h) return;
    drag = { active: true, x0: p.x, y0: p.y, x1: p.x, y1: p.y };
    bifCanvas.setPointerCapture(evt.pointerId);
    evt.preventDefault();
  });

  bifCanvas.addEventListener("pointermove", (evt) => {
    if (!drag || !drag.active || !bifGeom) return;
    const { pad, w, h } = bifGeom;
    const p = pointerPos(evt);
    drag.x1 = Math.min(Math.max(p.x, pad.left), pad.left + w);
    drag.y1 = Math.min(Math.max(p.y, pad.top), pad.top + h);
    paintBifurcation();
  });

  function endDrag(evt) {
    if (!drag || !drag.active || !bifGeom) return;
    const { pad, w, h } = bifGeom;
    const dx = Math.abs(drag.x1 - drag.x0);
    const dy = Math.abs(drag.y1 - drag.y0);
    drag.active = false;
    if (evt && evt.pointerId != null && bifCanvas.hasPointerCapture(evt.pointerId)) {
      bifCanvas.releasePointerCapture(evt.pointerId);
    }

    // A stray click should not zoom into a sliver.
    if (dx < 6 || dy < 6) {
      drag = null;
      paintBifurcation();
      return;
    }

    const xToR = (px) => win.rMin + ((px - pad.left) / w) * (win.rMax - win.rMin);
    const yToX = (py) => win.xMin + ((pad.top + h - py) / h) * (win.xMax - win.xMin);

    const rA = xToR(Math.min(drag.x0, drag.x1));
    const rB = xToR(Math.max(drag.x0, drag.x1));
    const xA = yToX(Math.max(drag.y0, drag.y1));
    const xB = yToX(Math.min(drag.y0, drag.y1));
    drag = null;

    win = { rMin: rA, rMax: rB, xMin: xA, xMax: xB };
    renderBifurcation();
  }

  bifCanvas.addEventListener("pointerup", endDrag);
  bifCanvas.addEventListener("pointercancel", endDrag);

  bifResetBtn.addEventListener("click", () => {
    win = { ...FULL_WINDOW };
    renderBifurcation();
  });

  document.querySelectorAll("[data-bifzoom]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const [rMin, rMax, xMin, xMax] = btn.dataset.bifzoom.split(",").map(Number);
      win = { rMin, rMax, xMin, xMax };
      renderBifurcation();
    });
  });

  /* ---------------------------------------------------------------- ui -- */

  function updateStats() {
    statR.textContent = fmtR(r, 4);
    const values = attractor(r);
    if (!values.length) {
      statPeriod.textContent = "カオス（周期なし）";
      statAttractor.textContent = "一定の値に落ち着かない";
    } else {
      statPeriod.textContent = `${values.length} 周期`;
      const shown = values.slice(0, 4).map((v) => v.toFixed(4));
      statAttractor.textContent = shown.join(", ") + (values.length > 4 ? ", …" : "");
    }
  }

  function stopAnim() {
    if (animHandle) cancelAnimationFrame(animHandle);
    animHandle = null;
  }

  function runAnimation() {
    stopAnim();
    revealed = 0;
    const total = steps * 2;
    const tick = () => {
      if (!visible) {
        // Finish instantly rather than animate off-screen.
        revealed = total;
        drawCobweb();
        drawTimeSeries();
        animHandle = null;
        return;
      }
      revealed = Math.min(total, revealed + 2);
      drawCobweb();
      drawTimeSeries();
      if (revealed < total) animHandle = requestAnimationFrame(tick);
      else animHandle = null;
    };
    tick();
  }

  function onParamChange({ animate = true } = {}) {
    updateStats();
    if (animate) runAnimation();
    else {
      drawCobweb();
      drawTimeSeries();
    }
    paintBifurcation();
  }

  rSlider.addEventListener("input", () => {
    r = Number(rSlider.value);
    rOut.textContent = fmtR(r);
    // Redrawing the whole staircase every input event is smoother than
    // restarting the reveal animation on each pixel of slider travel.
    revealed = steps * 2;
    stopAnim();
    onParamChange({ animate: false });
  });

  x0Slider.addEventListener("input", () => {
    x0 = Number(x0Slider.value);
    x0Out.textContent = x0.toFixed(3);
    revealed = steps * 2;
    stopAnim();
    onParamChange({ animate: false });
  });

  stepsSelect.addEventListener("change", () => {
    steps = Number(stepsSelect.value);
    onParamChange();
  });

  replayBtn.addEventListener("click", () => onParamChange());

  document.querySelectorAll(".chip[data-r]").forEach((btn) => {
    btn.addEventListener("click", () => {
      r = Number(btn.dataset.r);
      rSlider.value = String(r);
      rOut.textContent = fmtR(r);
      onParamChange();
    });
  });

  function renderFeigenbaum() {
    const rows = feigenbaumRows();
    feigBody.innerHTML =
      rows
        .map(
          (row) => `<tr>
            <td>${row.period}</td>
            <td class="mono">${row.r.toFixed(9)}</td>
            <td class="mono">${row.gap === null ? "—" : row.gap.toFixed(9)}</td>
            <td class="mono">${row.delta === null ? "—" : row.delta.toFixed(6)}</td>
          </tr>`
        )
        .join("") +
      `<tr class="row-accent">
        <td>∞</td>
        <td class="mono">${ACCUMULATION_POINT.toFixed(9)}</td>
        <td>集積点</td>
        <td class="mono">→ ${FEIGENBAUM_DELTA.toFixed(6)}</td>
      </tr>`;
  }

  rOut.textContent = fmtR(r);
  x0Out.textContent = x0.toFixed(3);
  renderFeigenbaum();

  let booted = false;

  return {
    show() {
      visible = true;
      if (!booted) {
        booted = true;
        runAnimation(); // redraw() runs right after and paints everything else
      }
    },
    hide() {
      visible = false;
      stopAnim();
    },
    redraw() {
      updateStats();
      drawCobweb();
      drawTimeSeries();
      renderBifurcation();
    },
  };
}
