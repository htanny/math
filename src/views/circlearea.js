import { readVars, setupCanvasDPR } from "../chart.js";
import { sectorPlacement, halfAngle, inscribedArea, wobble, rowWidth, convergenceRows } from "../circlearea.js";

const $ = (id) => document.getElementById(id);
const TAU = Math.PI * 2;
const LABEL_FONT = "12px system-ui, -apple-system, 'Segoe UI', sans-serif";

export function initCircleAreaView() {
  const canvas = $("crCanvas");
  const nSlider = $("crN");
  const tSlider = $("crT");
  const nOut = $("crNOut");
  const tOut = $("crTOut");
  const playBtn = $("crPlay");
  const guide = $("crGuide");
  const note = $("crNote");
  const statWidth = $("crWidth");
  const statWobble = $("crWobble");
  const statArea = $("crArea");
  const tableBody = $("crTable").querySelector("tbody");

  let raf = null;

  function drawWedge(ctx, r, alpha, place, fill, stroke, alphaVal) {
    ctx.save();
    ctx.translate(place.x, place.y);
    ctx.rotate(place.angle);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    const steps = Math.max(3, Math.ceil((alpha * 2) / 0.05));
    for (let i = 0; i <= steps; i++) {
      const phi = -alpha + (2 * alpha * i) / steps;
      ctx.lineTo(Math.cos(phi) * r, Math.sin(phi) * r);
    }
    ctx.closePath();
    ctx.globalAlpha = alphaVal;
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }

  function draw() {
    const { ctx, width, height } = setupCanvasDPR(canvas);
    ctx.clearRect(0, 0, width, height);
    const vars = readVars(canvas.parentElement, [
      "--surface-1", "--muted", "--gridline", "--baseline",
      "--text-primary", "--text-secondary", "--series-1", "--series-2", "--series-4",
    ]);

    const n = Number(nSlider.value);
    const t = Number(tSlider.value);

    // the row is πr wide, so that is what has to fit — not the circle
    const r = Math.min((width - 40) / (Math.PI + 0.4), (height - 60) / 2.4);
    if (r <= 4) return;
    const cx = width / 2;
    const cy = height / 2;
    const alpha = halfAngle(n);

    ctx.save();
    ctx.translate(cx, cy);

    if (guide.checked && t > 0.02) {
      const W = rowWidth(r);
      ctx.setLineDash([6, 4]);
      ctx.strokeStyle = vars["--series-4"];
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = Math.min(1, t * 1.6);
      ctx.strokeRect(-W / 2, -r / 2, W, r);
      ctx.globalAlpha = 1;
      ctx.setLineDash([]);
      ctx.fillStyle = vars["--series-4"];
      ctx.font = LABEL_FONT;
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillText("よこ = πr（円周の半分）", 0, -r / 2 - 8);
      ctx.save();
      ctx.translate(-W / 2 - 10, 0);
      ctx.rotate(-Math.PI / 2);
      ctx.textBaseline = "bottom";
      ctx.fillText("たて = r", 0, 0);
      ctx.restore();
    }

    for (let k = 0; k < n; k++) {
      const place = sectorPlacement(n, r, t, k);
      drawWedge(
        ctx,
        r,
        alpha,
        place,
        k % 2 === 0 ? vars["--series-1"] : vars["--series-2"],
        vars["--surface-1"],
        0.5
      );
    }
    ctx.restore();
  }

  function render() {
    const n = Number(nSlider.value);
    const t = Number(tSlider.value);
    nOut.textContent = String(n);
    tOut.textContent = `${Math.round(t * 100)}%`;
    draw();

    const r = 1;
    const area = inscribedArea(n, r);
    const wob = wobble(n, r);
    statWidth.textContent = "πr（いつでも）";
    statWobble.textContent = `${(wob * 100).toFixed(2)}% of r`;
    statArea.textContent = `${area.toFixed(4)} r²`;

    note.textContent =
      `よこは分割数によらず、いつでも円周の半分 πr です — 弧を ${n} 個に分けて上下に振り分けているだけだからです。` +
      `変わるのは形のほうで、ふちのギザギザは r の ${(wob * 100).toFixed(2)}% まで小さくなりました。` +
      `弧をまっすぐな弦に直した図形の面積は ${area.toFixed(4)} r²（πr² = 3.1416 r² より ${((Math.PI - area) / Math.PI * 100).toFixed(2)}% 小さい）。` +
      `n を大きくするほど長方形に近づき、面積は πr² に上がっていきます。`;
  }

  function fillTable() {
    const rows = convergenceRows(1);
    tableBody.innerHTML = rows
      .map(
        (row) =>
          `<tr><td>${row.n}</td><td>${row.area.toFixed(6)}</td><td>${row.error.toFixed(6)}</td>` +
          `<td>${row.errorPct.toFixed(3)}%</td><td>${row.wobble.toFixed(6)}</td></tr>`
      )
      .join("") +
      `<tr class="row-accent"><td>∞</td><td>3.141593 = πr²</td><td>0</td><td>0%</td><td>0</td></tr>`;
  }

  function stopAnim() {
    if (raf) cancelAnimationFrame(raf);
    raf = null;
    playBtn.textContent = "並べかえる";
  }

  playBtn.addEventListener("click", () => {
    if (raf) {
      stopAnim();
      return;
    }
    const from = Number(tSlider.value) >= 0.999 ? 0 : Number(tSlider.value);
    const start = performance.now();
    playBtn.textContent = "止める";
    const step = (now) => {
      const p = Math.min(1, (now - start) / 2200);
      tSlider.value = String(from + (1 - from) * p);
      render();
      if (p < 1) raf = requestAnimationFrame(step);
      else stopAnim();
    };
    raf = requestAnimationFrame(step);
  });

  nSlider.addEventListener("input", () => {
    stopAnim();
    render();
  });
  tSlider.addEventListener("input", () => {
    stopAnim();
    render();
  });
  guide.addEventListener("change", render);

  fillTable();

  return {
    show() {},
    hide() {
      stopAnim();
    },
    redraw() {
      render();
    },
  };
}
