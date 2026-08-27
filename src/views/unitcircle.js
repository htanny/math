import { readVars, setupCanvasDPR } from "../chart.js";

const $ = (id) => document.getElementById(id);
const TAU = Math.PI * 2;
const TICK_FONT = "11px system-ui, -apple-system, 'Segoe UI', sans-serif";

/** Exact-looking labels for the angles school work actually asks about. */
const SPECIAL = [
  { deg: 0, sin: "0", cos: "1", tan: "0" },
  { deg: 30, sin: "1/2", cos: "√3/2", tan: "1/√3" },
  { deg: 45, sin: "√2/2", cos: "√2/2", tan: "1" },
  { deg: 60, sin: "√3/2", cos: "1/2", tan: "√3" },
  { deg: 90, sin: "1", cos: "0", tan: "定義されない" },
  { deg: 120, sin: "√3/2", cos: "−1/2", tan: "−√3" },
  { deg: 135, sin: "√2/2", cos: "−√2/2", tan: "−1" },
  { deg: 150, sin: "1/2", cos: "−√3/2", tan: "−1/√3" },
  { deg: 180, sin: "0", cos: "−1", tan: "0" },
  { deg: 270, sin: "−1", cos: "0", tan: "定義されない" },
];

export function initUnitCircleView() {
  const slider = $("ucAngle");
  const angleOut = $("ucAngleOut");
  const radOut = $("ucRadOut");
  const playBtn = $("ucPlay");
  const presetRow = $("ucPresets");
  const showSin = $("ucShowSin");
  const showCos = $("ucShowCos");
  const showTan = $("ucShowTan");
  const canvas = $("ucCanvas");
  const legend = $("ucLegend");
  const statSin = $("ucStatSin");
  const statCos = $("ucStatCos");
  const statTan = $("ucStatTan");
  const exactOut = $("ucExact");

  // second panel: y = A sin(B(x - C)) + D
  const aS = $("ucA");
  const bS = $("ucB");
  const cS = $("ucC");
  const dS = $("ucD");
  const aOut = $("ucAOut");
  const bOut = $("ucBOut");
  const cOut = $("ucCOut");
  const dOut = $("ucDOut");
  const waveCanvas = $("ucWave");
  const waveInfo = $("ucWaveInfo");
  const waveReset = $("ucWaveReset");

  let deg = Number(slider.value);
  let playing = false;
  let animHandle = null;
  let visible = false;
  let last = 0;

  /* ------------------------------------------------- circle + graph pair -- */

  function draw() {
    const { ctx, width, height } = setupCanvasDPR(canvas);
    ctx.clearRect(0, 0, width, height);
    const vars = readVars(canvas.parentElement, [
      "--surface-1",
      "--muted",
      "--gridline",
      "--baseline",
      "--text-primary",
      "--series-1",
      "--series-2",
      "--series-3",
    ]);

    const pad = { top: 16, bottom: 30, left: 12, right: 14 };
    const h = height - pad.top - pad.bottom;
    if (h <= 0 || width <= 0) return;

    // The circle and the graph share one vertical scale, so the horizontal
    // tie-line from the moving point to the curve lands exactly on it. That
    // alignment is the whole point of the picture.
    const r = Math.min(h / 2 - 6, (width - pad.left - pad.right) * 0.22);
    const cx = pad.left + r + 26;
    const cy = pad.top + h / 2;
    const gx0 = cx + r + 34;
    const gw = width - pad.right - gx0;
    if (gw <= 20 || r <= 10) return;

    const t = (deg * Math.PI) / 180;
    const px = cx + Math.cos(t) * r;
    const py = cy - Math.sin(t) * r;

    // axes of the circle
    ctx.strokeStyle = vars["--gridline"];
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - r - 8, cy);
    ctx.lineTo(cx + r + 8, cy);
    ctx.moveTo(cx, cy - r - 8);
    ctx.lineTo(cx, cy + r + 8);
    ctx.stroke();

    ctx.strokeStyle = vars["--baseline"];
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, TAU);
    ctx.stroke();

    // radius to the point
    ctx.strokeStyle = vars["--muted"];
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(px, py);
    ctx.stroke();

    // cos leg (horizontal) and sin leg (vertical)
    if (showCos.checked) {
      ctx.strokeStyle = vars["--series-2"];
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(px, cy);
      ctx.stroke();
    }
    if (showSin.checked) {
      ctx.strokeStyle = vars["--series-1"];
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(px, cy);
      ctx.lineTo(px, py);
      ctx.stroke();
    }

    // tan as the segment on the tangent line x = 1
    if (showTan.checked && Math.abs(Math.cos(t)) > 1e-3) {
      const ty = cy - Math.tan(t) * r;
      const clamped = Math.max(pad.top - 40, Math.min(pad.top + h + 40, ty));
      ctx.strokeStyle = vars["--series-3"];
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(cx + r, cy - r - 10);
      ctx.lineTo(cx + r, cy + r + 10);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(cx + r, cy);
      ctx.lineTo(cx + r, clamped);
      ctx.stroke();
    }

    // the moving point
    ctx.fillStyle = vars["--surface-1"];
    ctx.beginPath();
    ctx.arc(px, py, 8, 0, TAU);
    ctx.fill();
    ctx.fillStyle = vars["--text-primary"];
    ctx.beginPath();
    ctx.arc(px, py, 5, 0, TAU);
    ctx.fill();

    /* ---- graph panel, x from 0 to 360 degrees ---- */

    const sx = (d) => gx0 + (d / 360) * gw;
    const sy = (v) => cy - v * r;

    ctx.strokeStyle = vars["--gridline"];
    ctx.lineWidth = 1;
    for (const v of [-1, -0.5, 0, 0.5, 1]) {
      const y = Math.round(sy(v)) + 0.5;
      ctx.beginPath();
      ctx.moveTo(gx0, y);
      ctx.lineTo(gx0 + gw, y);
      ctx.stroke();
    }
    ctx.fillStyle = vars["--muted"];
    ctx.font = TICK_FONT;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    for (const d of [0, 90, 180, 270, 360]) {
      const x = Math.round(sx(d)) + 0.5;
      ctx.strokeStyle = vars["--gridline"];
      ctx.beginPath();
      ctx.moveTo(x, sy(1));
      ctx.lineTo(x, sy(-1));
      ctx.stroke();
      ctx.fillText(`${d}°`, sx(d), sy(-1) + 7);
    }

    const curve = (fn, color) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.lineJoin = "round";
      ctx.beginPath();
      let started = false;
      for (let d = 0; d <= deg + 0.001; d += 1) {
        const v = fn((d * Math.PI) / 180);
        if (!Number.isFinite(v) || Math.abs(v) > 1.6) {
          started = false; // tan blows up; lift the pen rather than draw a spike
          continue;
        }
        const x = sx(d);
        const y = sy(v);
        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else ctx.lineTo(x, y);
      }
      ctx.stroke();
    };

    if (showCos.checked) curve(Math.cos, vars["--series-2"]);
    if (showTan.checked) curve(Math.tan, vars["--series-3"]);
    if (showSin.checked) curve(Math.sin, vars["--series-1"]);

    // the tie-line: the circle's height carried across to the curve
    if (showSin.checked) {
      const gyx = sx(deg);
      const gyy = sy(Math.sin(t));
      ctx.strokeStyle = vars["--series-1"];
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(gyx, gyy);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = vars["--surface-1"];
      ctx.beginPath();
      ctx.arc(gyx, gyy, 7, 0, TAU);
      ctx.fill();
      ctx.fillStyle = vars["--series-1"];
      ctx.beginPath();
      ctx.arc(gyx, gyy, 4, 0, TAU);
      ctx.fill();
    }

    legend.innerHTML = [
      showSin.checked ? ["sin θ", vars["--series-1"]] : null,
      showCos.checked ? ["cos θ", vars["--series-2"]] : null,
      showTan.checked ? ["tan θ", vars["--series-3"]] : null,
    ]
      .filter(Boolean)
      .map(
        ([label, color]) =>
          `<span class="legend-item"><span class="legend-dot" style="background:${color}"></span>${label}</span>`
      )
      .join("");
  }

  function updateStats() {
    const t = (deg * Math.PI) / 180;
    statSin.textContent = Math.sin(t).toFixed(4);
    statCos.textContent = Math.cos(t).toFixed(4);
    const c = Math.cos(t);
    statTan.textContent = Math.abs(c) < 1e-12 ? "定義されない" : Math.tan(t).toFixed(4);

    const norm = ((Math.round(deg) % 360) + 360) % 360;
    const hit = SPECIAL.find((s) => s.deg === norm);
    exactOut.textContent = hit
      ? `θ = ${hit.deg}° は暗記すべき角。sin = ${hit.sin} / cos = ${hit.cos} / tan = ${hit.tan}`
      : "スライダーを 30°・45°・60° などに合わせると、暗記すべき厳密値が出ます。";
  }

  function refresh() {
    angleOut.textContent = `${deg.toFixed(0)}°`;
    radOut.textContent = `${(deg / 180).toFixed(3)}π`;
    updateStats();
    draw();
  }

  /* --------------------------------------------------------- animation -- */

  function stopAnim() {
    if (animHandle) cancelAnimationFrame(animHandle);
    animHandle = null;
  }

  function tick(now) {
    if (!playing || !visible) {
      animHandle = null;
      return;
    }
    if (now - last >= 16) {
      last = now;
      deg += 1;
      if (deg > 360) deg = 0;
      slider.value = String(deg);
      refresh();
    }
    animHandle = requestAnimationFrame(tick);
  }

  function setPlaying(next) {
    playing = next;
    playBtn.textContent = playing ? "停止" : "1周まわす";
    playBtn.classList.toggle("btn-primary", !playing);
    stopAnim();
    if (playing && visible) {
      last = 0;
      animHandle = requestAnimationFrame(tick);
    }
  }

  slider.addEventListener("input", () => {
    deg = Number(slider.value);
    setPlaying(false);
    refresh();
  });
  playBtn.addEventListener("click", () => setPlaying(!playing));
  [showSin, showCos, showTan].forEach((el) => el.addEventListener("change", draw));

  [0, 30, 45, 60, 90, 120, 135, 150, 180, 270].forEach((d) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "chip";
    btn.textContent = `${d}°`;
    btn.addEventListener("click", () => {
      deg = d;
      slider.value = String(d);
      setPlaying(false);
      refresh();
    });
    presetRow.appendChild(btn);
  });

  /* ------------------------------------------- y = A sin(B(x - C)) + D -- */

  function drawWave() {
    const { ctx, width, height } = setupCanvasDPR(waveCanvas);
    ctx.clearRect(0, 0, width, height);
    const vars = readVars(waveCanvas.parentElement, [
      "--muted",
      "--gridline",
      "--baseline",
      "--series-1",
      "--series-2",
    ]);

    const pad = { top: 12, right: 14, bottom: 26, left: 34 };
    const w = width - pad.left - pad.right;
    const h = height - pad.top - pad.bottom;
    if (w <= 0 || h <= 0) return;

    const A = Number(aS.value);
    const B = Number(bS.value);
    const C = Number(cS.value);
    const D = Number(dS.value);

    const yMax = 4;
    const sx = (d) => pad.left + (d / 720) * w;
    const sy = (v) => pad.top + h / 2 - (v / yMax) * (h / 2);

    ctx.strokeStyle = vars["--gridline"];
    ctx.lineWidth = 1;
    for (let v = -4; v <= 4; v++) {
      const y = Math.round(sy(v)) + 0.5;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(pad.left + w, y);
      ctx.stroke();
    }
    ctx.fillStyle = vars["--muted"];
    ctx.font = TICK_FONT;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (const v of [-4, -2, 0, 2, 4]) ctx.fillText(String(v), pad.left - 6, sy(v));
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    for (const d of [0, 180, 360, 540, 720]) {
      const x = Math.round(sx(d)) + 0.5;
      ctx.strokeStyle = vars["--gridline"];
      ctx.beginPath();
      ctx.moveTo(x, pad.top);
      ctx.lineTo(x, pad.top + h);
      ctx.stroke();
      ctx.fillStyle = vars["--muted"];
      ctx.fillText(`${d}°`, sx(d), pad.top + h + 6);
    }

    // reference y = sin x, so the transformation is visible as a change
    ctx.strokeStyle = vars["--baseline"];
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let d = 0; d <= 720; d += 2) {
      const y = sy(Math.sin((d * Math.PI) / 180));
      if (d === 0) ctx.moveTo(sx(d), y);
      else ctx.lineTo(sx(d), y);
    }
    ctx.stroke();

    ctx.strokeStyle = vars["--series-1"];
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    ctx.beginPath();
    for (let d = 0; d <= 720; d += 2) {
      const v = A * Math.sin((B * (d - C) * Math.PI) / 180) + D;
      const y = sy(v);
      if (d === 0) ctx.moveTo(sx(d), y);
      else ctx.lineTo(sx(d), y);
    }
    ctx.stroke();

    aOut.textContent = A.toFixed(1);
    bOut.textContent = B.toFixed(1);
    cOut.textContent = `${C.toFixed(0)}°`;
    dOut.textContent = D.toFixed(1);
    waveInfo.innerHTML =
      `振幅 <strong>${Math.abs(A).toFixed(1)}</strong> ／ 周期 <strong>${B === 0 ? "—" : (360 / Math.abs(B)).toFixed(0) + "°"}</strong>` +
      ` ／ 横に <strong>${C.toFixed(0)}°</strong> 平行移動 ／ 縦に <strong>${D.toFixed(1)}</strong> 平行移動` +
      `（細い線は基準の y = sin x）`;
  }

  [aS, bS, cS, dS].forEach((el) => el.addEventListener("input", drawWave));
  waveReset.addEventListener("click", () => {
    aS.value = "1";
    bS.value = "1";
    cS.value = "0";
    dS.value = "0";
    drawWave();
  });

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
      drawWave();
    },
  };
}
