import { readVars, setupCanvasDPR } from "../chart.js";
import {
  SURD_PRESETS, digitSqueeze, perfectSquareRoot, simplifySurd, spiral, spiralTriangles,
} from "../roots.js";

const $ = (id) => document.getElementById(id);
const LABEL_FONT = "13px system-ui, -apple-system, 'Segoe UI', sans-serif";
const SMALL_FONT = "11px system-ui, -apple-system, 'Segoe UI', sans-serif";

export function initRootsView() {
  /* --------------------------------------------------------- 渦巻き -- */
  const nSlider = $("sqN");
  const nOut = $("sqNOut");
  const labelsToggle = $("sqLabels");
  const growBtn = $("sqGrow");
  const spiralCanvas = $("sqSpiralCanvas");
  const spiralNote = $("sqSpiralNote");
  const statOuter = $("sqOuter");
  const statSurd = $("sqSurd");
  const statGap = $("sqGap");

  let raf = null;

  function stopGrow() {
    if (raf) cancelAnimationFrame(raf);
    raf = null;
    growBtn.textContent = "1 つずつ増やす";
  }

  function drawSpiral() {
    const { ctx, width, height } = setupCanvasDPR(spiralCanvas);
    ctx.clearRect(0, 0, width, height);
    const vars = readVars(spiralCanvas.parentElement, [
      "--surface-1", "--muted", "--gridline", "--baseline", "--text-primary",
      "--text-secondary", "--series-1", "--series-2", "--series-3", "--series-4",
    ]);

    const n = Number(nSlider.value);
    const pts = spiral(n);
    const tris = spiralTriangles(n);
    const rMax = Math.sqrt(n);

    // The spiral wraps right round the origin once n passes about 17, so it
    // needs a disc of radius √n all to itself. It gets the upper part of the
    // canvas; the number line sits clear of it underneath, at the same unit,
    // and the outer radius reaches it by being turned onto the horizontal and
    // then dropped straight down.
    const pad = 30;
    const axisY = height - 46;
    const topY = 26;
    const unit = Math.min((axisY - topY - 24) / (2 * rMax), (width - pad * 2) / (2 * rMax));
    const cx = width / 2;
    const cy = topY + rMax * unit;
    const sx = (x) => cx + x * unit;
    const sy = (y) => cy - y * unit;

    // the spiral, darkening towards the outside so the newest triangle reads
    for (let i = 0; i < tris.length; i++) {
      const t = tris[i];
      const last = i === tris.length - 1;
      ctx.beginPath();
      ctx.moveTo(sx(t.o[0]), sy(t.o[1]));
      ctx.lineTo(sx(t.a[0]), sy(t.a[1]));
      ctx.lineTo(sx(t.b[0]), sy(t.b[1]));
      ctx.closePath();
      ctx.fillStyle = vars["--series-1"];
      ctx.globalAlpha = last ? 0.34 : 0.06 + (0.14 * i) / Math.max(1, tris.length - 1);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = last ? vars["--series-1"] : vars["--gridline"];
      ctx.lineWidth = last ? 2.2 : 1;
      ctx.stroke();
    }

    // turn the outer radius down onto the horizontal
    ctx.strokeStyle = vars["--series-3"];
    ctx.setLineDash([4, 3]);
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(sx(0), sy(0), rMax * unit, -Math.atan2(pts[n - 1][1], pts[n - 1][0]), 0, false);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.strokeStyle = vars["--series-3"];
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(sx(0), sy(0));
    ctx.lineTo(sx(rMax), sy(0));
    ctx.stroke();

    // …then straight down onto the number line
    ctx.strokeStyle = vars["--series-3"];
    ctx.setLineDash([3, 3]);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(sx(rMax), sy(0));
    ctx.lineTo(sx(rMax), axisY);
    ctx.stroke();
    ctx.setLineDash([]);

    // the number line, same unit, 0 under the spiral's centre
    ctx.strokeStyle = vars["--baseline"];
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(sx(-0.35), Math.round(axisY) + 0.5);
    ctx.lineTo(Math.min(width - 8, sx(rMax + 0.35)), Math.round(axisY) + 0.5);
    ctx.stroke();

    ctx.font = SMALL_FONT;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    for (let k = 0; k <= Math.ceil(rMax); k++) {
      const x = sx(k);
      if (x > width - 10) break;
      ctx.strokeStyle = vars["--gridline"];
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(Math.round(x) + 0.5, axisY - 5);
      ctx.lineTo(Math.round(x) + 0.5, axisY + 5);
      ctx.stroke();
      ctx.fillStyle = vars["--muted"];
      ctx.fillText(String(k), x, axisY + 7);
    }

    if (labelsToggle.checked) {
      for (let k = 1; k <= n; k++) {
        const x = sx(Math.sqrt(k));
        if (x > width - 10) continue;
        ctx.strokeStyle = vars["--series-4"];
        ctx.lineWidth = k === n ? 2 : 1;
        ctx.beginPath();
        ctx.moveTo(Math.round(x) + 0.5, axisY);
        ctx.lineTo(Math.round(x) + 0.5, axisY - (k === n ? 15 : 10));
        ctx.stroke();
      }
      ctx.fillStyle = vars["--text-secondary"];
      let lastX = -Infinity;
      ctx.textBaseline = "bottom";
      for (let k = 1; k <= n; k++) {
        const x = sx(Math.sqrt(k));
        if (x > width - 10) continue;
        if (k !== n && x - lastX < 24) continue;
        lastX = x;
        ctx.fillText(`√${k}`, x, axisY - (k === n ? 17 : 12));
      }
    }

    ctx.fillStyle = vars["--text-primary"];
    ctx.font = LABEL_FONT;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(`√${n} = ${rMax.toFixed(4)}…`, 10, 8);
  }

  function renderSpiral() {
    const n = Number(nSlider.value);
    nOut.textContent = String(n);
    drawSpiral();

    const r = Math.sqrt(n);
    const s = simplifySurd(n);
    const exact = perfectSquareRoot(n);
    statOuter.textContent = `√${n} = ${r.toFixed(5)}…`;
    statSurd.textContent =
      exact !== null ? `${exact}（ちょうど整数）`
      : s.outside === 1 ? `√${s.inside}（これ以上簡単にならない）`
      : `${s.outside}√${s.inside}`;
    const gap = r - Math.sqrt(n - 1);
    statGap.textContent = `√${n} − √${n - 1} = ${gap.toFixed(4)}`;

    spiralNote.textContent =
      `直角をはさむ辺が √${n - 1} と 1 の直角三角形をつくると、斜辺は三平方の定理で ` +
      `√(${n - 1} + 1) = √${n}。これを巻いていくだけで √1 から √${n} までが順に手に入ります。` +
      (exact !== null
        ? `√${n} は ${exact} ちょうどなので、数直線の目もりの上にぴったり乗ります。`
        : `目もりの間隔は ${gap.toFixed(4)} で、n が大きくなるほど詰まっていきます —— ` +
          `同じ 1 を足しても、大きい数の平方根はあまり増えないためです。`);
  }

  for (const el of [nSlider, labelsToggle]) {
    el.addEventListener("input", () => {
      stopGrow();
      renderSpiral();
    });
  }
  labelsToggle.addEventListener("change", renderSpiral);

  growBtn.addEventListener("click", () => {
    if (raf) {
      stopGrow();
      return;
    }
    nSlider.value = "2";
    growBtn.textContent = "止める";
    let last = performance.now();
    const step = (now) => {
      if (now - last >= 260) {
        last = now;
        const next = Number(nSlider.value) + 1;
        if (next > Number(nSlider.max)) {
          stopGrow();
          return;
        }
        nSlider.value = String(next);
        renderSpiral();
      }
      raf = requestAnimationFrame(step);
    };
    renderSpiral();
    raf = requestAnimationFrame(step);
  });

  /* ------------------------------------------------------- 挟み撃ち -- */
  const presetHost = $("sqPresets");
  const stageSlider = $("sqStage");
  const stageOut = $("sqStageOut");
  const squeezeCanvas = $("sqSqueezeCanvas");
  const squeezeNote = $("sqSqueezeNote");
  const table = $("sqTable").querySelector("tbody");

  let target = 2;

  function drawSqueeze() {
    const { ctx, width, height } = setupCanvasDPR(squeezeCanvas);
    ctx.clearRect(0, 0, width, height);
    const vars = readVars(squeezeCanvas.parentElement, [
      "--surface-1", "--muted", "--gridline", "--baseline", "--text-primary",
      "--text-secondary", "--series-1", "--series-2", "--series-3",
    ]);

    const stage = Number(stageSlider.value);
    const rows = digitSqueeze(target, stage);
    const r = Math.sqrt(target);

    // one strip per digit, each a zoom into the shaded tenth of the one above.
    // Later stages carry longer labels, so the gutter follows the widest one.
    ctx.font = SMALL_FONT;
    const widest = rows.reduce(
      (m, row) => Math.max(m, ctx.measureText(row.lo.toFixed(row.stage)).width,
                              ctx.measureText(row.hi.toFixed(row.stage)).width),
      0
    );
    const gutter = Math.min(width / 4, Math.max(46, widest + 12));
    const top = 14;
    const foot = 22;
    const lane = (height - top - foot) / rows.length;
    const barH = Math.max(9, Math.min(20, lane - 12));

    rows.forEach((row, i) => {
      const y = top + lane * i + (lane - barH) / 2;
      const x0 = gutter;
      const x1 = width - gutter;
      const sx = (v) => x0 + ((v - row.lo) / row.step) * (x1 - x0);

      // the ten slots this digit is choosing between
      ctx.strokeStyle = vars["--gridline"];
      ctx.lineWidth = 1;
      for (let k = 0; k <= 10; k++) {
        const x = Math.round(sx(row.lo + (row.step * k) / 10)) + 0.5;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + barH);
        ctx.stroke();
      }
      ctx.strokeRect(x0 + 0.5, y + 0.5, x1 - x0 - 1, barH - 1);

      // the slot the next digit narrows to
      const next = rows[i + 1];
      if (next) {
        ctx.fillStyle = vars["--series-1"];
        ctx.globalAlpha = 0.22;
        ctx.fillRect(sx(next.lo), y, sx(next.hi) - sx(next.lo), barH);
        ctx.globalAlpha = 1;
      }

      // where √n actually is
      ctx.strokeStyle = vars["--series-3"];
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(sx(r), y - 3);
      ctx.lineTo(sx(r), y + barH + 3);
      ctx.stroke();

      ctx.fillStyle = vars["--text-secondary"];
      ctx.font = SMALL_FONT;
      ctx.textBaseline = "middle";
      ctx.textAlign = "right";
      ctx.fillText(row.lo.toFixed(row.stage), x0 - 6, y + barH / 2);
      ctx.textAlign = "left";
      ctx.fillText(row.hi.toFixed(row.stage), x1 + 6, y + barH / 2);

      if (i === 0) {
        ctx.fillStyle = vars["--series-3"];
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.fillText(`√${target} はここ`, sx(r), y - 4);
      }
    });

    ctx.fillStyle = vars["--muted"];
    ctx.font = SMALL_FONT;
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    ctx.fillText(
      "青いところが、次のけたで選ばれる 1/10 の区間",
      gutter,
      height - 6
    );
  }

  function renderSqueeze() {
    const stage = Number(stageSlider.value);
    stageOut.textContent = String(stage);
    drawSqueeze();

    const rows = digitSqueeze(target, stage);
    const last = rows[rows.length - 1];
    const exact = perfectSquareRoot(target);

    table.innerHTML = rows
      .map(
        (row) =>
          `<tr${row === last ? ' class="row-accent"' : ""}>` +
          `<td>${row.stage}</td><td>${row.lo.toFixed(row.stage)}</td>` +
          `<td>${row.loSq.toFixed(Math.min(6, row.stage * 2))}</td>` +
          `<td>${row.hi.toFixed(row.stage)}</td>` +
          `<td>${row.hiSq.toFixed(Math.min(6, row.stage * 2))}</td>` +
          `<td>${row.step}</td></tr>`
      )
      .join("");

    squeezeNote.textContent =
      exact !== null
        ? `${target} は平方数なので、√${target} = ${exact} でぴったり止まります。` +
          `けたを増やしても下からの見積もりは動きません —— こういう数のときだけ、平方根は整数になります。`
        : `${last.lo.toFixed(last.stage)} ≤ √${target} < ${last.hi.toFixed(last.stage)}。` +
          `${last.lo.toFixed(last.stage)}² = ${last.loSq.toFixed(Math.min(6, last.stage * 2))} は ${target} 以下、` +
          `${last.hi.toFixed(last.stage)}² = ${last.hiSq.toFixed(Math.min(6, last.stage * 2))} は ${target} より大きい。` +
          `けたを 1 つ増やすたびに幅が 1/10 になりますが、けっして 0 にはなりません —— ` +
          `小数が終わらず、しかも循環もしないので、√${target} は分数で表せません（無理数）。`;
  }

  presetHost.innerHTML = SURD_PRESETS.map(
    (n) => `<button type="button" class="chip" data-n="${n}">√${n}</button>`
  ).join("");
  presetHost.addEventListener("click", (evt) => {
    const btn = evt.target.closest("button[data-n]");
    if (!btn) return;
    target = Number(btn.dataset.n);
    renderSqueeze();
  });
  stageSlider.addEventListener("input", renderSqueeze);

  return {
    show() {},
    hide() {
      stopGrow();
    },
    redraw() {
      renderSpiral();
      renderSqueeze();
    },
  };
}
