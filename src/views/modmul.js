import { readVars, setupCanvasDPR } from "../chart.js";

const $ = (id) => document.getElementById(id);
const TAU = Math.PI * 2;

function hexToRgb(hex) {
  const h = hex.trim().replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const v = parseInt(full, 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

function lerpRgb(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

export function initModmulView() {
  const nSlider = $("mmN");
  const nOut = $("mmNOut");
  const mSlider = $("mmM");
  const mOut = $("mmMOut");
  const playBtn = $("mmPlay");
  const speedSelect = $("mmSpeed");
  const dotsToggle = $("mmDots");
  const canvas = $("mmChart");
  const cuspsOut = $("mmCusps");
  const linesOut = $("mmLines");

  let n = Number(nSlider.value);
  let m = Number(mSlider.value);
  let playing = false;
  let animHandle = null;
  let visible = false;

  function draw() {
    const { ctx, width, height } = setupCanvasDPR(canvas);
    ctx.clearRect(0, 0, width, height);
    const vars = readVars(canvas.parentElement, [
      "--ramp-a",
      "--ramp-b",
      "--gridline",
      "--muted",
    ]);

    const cx = width / 2;
    const cy = height / 2;
    const radius = Math.min(width, height) / 2 - 12;
    if (radius <= 0) return;

    // Start at the top and go clockwise so m=2's cusp points the familiar way.
    const pos = (t) => {
      const a = -Math.PI / 2 + (t / n) * TAU;
      return [cx + Math.cos(a) * radius, cy + Math.sin(a) * radius];
    };

    ctx.strokeStyle = vars["--gridline"];
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, TAU);
    ctx.stroke();

    const rampA = hexToRgb(vars["--ramp-a"] || "#9ec5f4");
    const rampB = hexToRgb(vars["--ramp-b"] || "#104281");
    const alpha = n > 400 ? 0.35 : n > 200 ? 0.45 : 0.6;

    ctx.lineWidth = 1;
    for (let k = 0; k < n; k++) {
      const [x1, y1] = pos(k);
      const [x2, y2] = pos((k * m) % n);
      const [r, g, b] = lerpRgb(rampA, rampB, k / n);
      ctx.strokeStyle = `rgba(${r},${g},${b},${alpha})`;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    if (dotsToggle.checked) {
      ctx.fillStyle = vars["--muted"];
      const dotR = n > 300 ? 1 : 1.8;
      for (let k = 0; k < n; k++) {
        const [x, y] = pos(k);
        ctx.beginPath();
        ctx.arc(x, y, dotR, 0, TAU);
        ctx.fill();
      }
    }

    const isInteger = Math.abs(m - Math.round(m)) < 1e-9;
    cuspsOut.textContent = isInteger && Math.round(m) >= 2 ? String(Math.round(m) - 1) : "—";
    linesOut.textContent = n.toLocaleString("en-US");
  }

  function stopAnim() {
    if (animHandle) cancelAnimationFrame(animHandle);
    animHandle = null;
  }

  function tick() {
    if (!playing || !visible) {
      animHandle = null;
      return;
    }
    m += Number(speedSelect.value);
    if (m > Number(mSlider.max)) m = Number(mSlider.min);
    mSlider.value = String(m);
    mOut.textContent = m.toFixed(2);
    draw();
    animHandle = requestAnimationFrame(tick);
  }

  function setPlaying(next) {
    playing = next;
    playBtn.textContent = playing ? "停止" : "アニメーション開始";
    playBtn.classList.toggle("btn-primary", !playing);
    stopAnim();
    if (playing && visible) animHandle = requestAnimationFrame(tick);
  }

  nSlider.addEventListener("input", () => {
    n = Number(nSlider.value);
    nOut.textContent = String(n);
    draw();
  });

  mSlider.addEventListener("input", () => {
    m = Number(mSlider.value);
    mOut.textContent = m.toFixed(2);
    setPlaying(false);
    draw();
  });

  dotsToggle.addEventListener("change", draw);

  playBtn.addEventListener("click", () => setPlaying(!playing));

  document.querySelectorAll(".chip[data-m]").forEach((btn) => {
    btn.addEventListener("click", () => {
      m = Number(btn.dataset.m);
      mSlider.value = String(m);
      mOut.textContent = m.toFixed(2);
      setPlaying(false);
      draw();
    });
  });

  nOut.textContent = String(n);
  mOut.textContent = m.toFixed(2);

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
      draw();
    },
  };
}
