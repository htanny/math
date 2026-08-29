import { readVars, setupCanvasDPR } from "../chart.js";

const $ = (id) => document.getElementById(id);
const TAU = Math.PI * 2;
const LABEL_FONT = "13px system-ui, -apple-system, 'Segoe UI', sans-serif";
const SMALL_FONT = "11px system-ui, -apple-system, 'Segoe UI', sans-serif";

const mul = (p, q) => ({ re: p.re * q.re - p.im * q.im, im: p.re * q.im + p.im * q.re });
const abs = (p) => Math.hypot(p.re, p.im);
const arg = (p) => Math.atan2(p.im, p.re);
const deg = (r) => ((r * 180) / Math.PI + 360) % 360;

export function initComplexView() {
  /* ---------------------------------------------------- panel 1: z times w -- */
  const canvas = $("cxCanvas");
  const unitW = $("cxUnitW");
  const spinBtn = $("cxSpin");
  const resetBtn = $("cxReset");
  const note = $("cxNote");
  const tableBody = $("cxTable").querySelector("tbody");

  const START = { z: { re: 1.2, im: 0.7 }, w: { re: 0.8, im: 0.9 } };
  let z = { ...START.z };
  let w = { ...START.w };
  let geom = null;
  let dragging = null;
  let raf = null;

  const RANGE = 3;

  function drawPlane(ctx, width, height, vars, range) {
    const pad = 22;
    const size = Math.min(width, height) - pad * 2;
    const ox = (width - size) / 2;
    const oy = (height - size) / 2;
    const sx = (x) => ox + ((x + range) / (2 * range)) * size;
    const sy = (y) => oy + size - ((y + range) / (2 * range)) * size;

    ctx.strokeStyle = vars["--gridline"];
    ctx.lineWidth = 1;
    ctx.fillStyle = vars["--muted"];
    ctx.font = SMALL_FONT;
    for (let k = -Math.floor(range); k <= range; k++) {
      const x = Math.round(sx(k)) + 0.5;
      const y = Math.round(sy(k)) + 0.5;
      ctx.beginPath();
      ctx.moveTo(x, oy);
      ctx.lineTo(x, oy + size);
      ctx.moveTo(ox, y);
      ctx.lineTo(ox + size, y);
      ctx.stroke();
    }
    ctx.strokeStyle = vars["--baseline"];
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(ox, Math.round(sy(0)) + 0.5);
    ctx.lineTo(ox + size, Math.round(sy(0)) + 0.5);
    ctx.moveTo(Math.round(sx(0)) + 0.5, oy);
    ctx.lineTo(Math.round(sx(0)) + 0.5, oy + size);
    ctx.stroke();

    // the unit circle, because everything about rotation happens on it
    ctx.strokeStyle = vars["--muted"];
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(sx(0), sy(0), (size / (2 * range)) * 1, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = vars["--muted"];
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText("実軸", ox + size - 18, sy(0) + 5);
    ctx.save();
    ctx.translate(sx(0) + 5, oy + 14);
    ctx.textAlign = "left";
    ctx.fillText("虚軸", 0, 0);
    ctx.restore();

    return { sx, sy, ox, oy, size, range };
  }

  function arrow(ctx, g, p, color, label, vars) {
    const x = g.sx(p.re);
    const y = g.sy(p.im);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(g.sx(0), g.sy(0));
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.fillStyle = vars["--surface-1"];
    ctx.beginPath();
    ctx.arc(x, y, 9, 0, TAU);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, TAU);
    ctx.fill();
    ctx.font = LABEL_FONT;
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    ctx.fillText(label, x + 11, y - 7);
  }

  function drawProduct() {
    const { ctx, width, height } = setupCanvasDPR(canvas);
    ctx.clearRect(0, 0, width, height);
    const vars = readVars(canvas.parentElement, [
      "--surface-1", "--muted", "--gridline", "--baseline",
      "--text-primary", "--text-secondary", "--series-1", "--series-2", "--series-3",
    ]);
    const g = drawPlane(ctx, width, height, vars, RANGE);
    geom = g;

    const zw = mul(z, w);

    // the arc from z round to zw is the angle that w added
    ctx.strokeStyle = vars["--series-3"];
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 3]);
    const rr = (g.size / (2 * g.range)) * Math.min(abs(z), 2.6);
    ctx.beginPath();
    ctx.arc(g.sx(0), g.sy(0), rr, -arg(z), -arg(zw), arg(w) > 0);
    ctx.stroke();
    ctx.setLineDash([]);

    arrow(ctx, g, z, vars["--series-1"], "z", vars);
    arrow(ctx, g, w, vars["--series-2"], "w", vars);
    arrow(ctx, g, zw, vars["--series-3"], "zw", vars);
  }

  function renderProduct() {
    if (unitW.checked) {
      const a = arg(w);
      w = { re: Math.cos(a), im: Math.sin(a) };
    }
    drawProduct();
    const zw = mul(z, w);
    const row = (name, p, color) =>
      `<tr><td style="color:${color}">${name}</td><td>${p.re.toFixed(3)}</td><td>${p.im.toFixed(3)}</td>` +
      `<td>${abs(p).toFixed(3)}</td><td>${deg(arg(p)).toFixed(1)}°</td></tr>`;
    const vars = readVars(canvas.parentElement, ["--series-1", "--series-2", "--series-3"]);
    tableBody.innerHTML =
      row("z", z, vars["--series-1"]) +
      row("w", w, vars["--series-2"]) +
      row("zw", zw, vars["--series-3"]) +
      `<tr class="row-accent"><td>確かめ</td><td colspan="2">|z||w| = ${(abs(z) * abs(w)).toFixed(3)}</td>` +
      `<td>${abs(zw).toFixed(3)}</td><td>${((deg(arg(z)) + deg(arg(w))) % 360).toFixed(1)}°</td></tr>`;

    note.textContent =
      `|z| = ${abs(z).toFixed(3)} に |w| = ${abs(w).toFixed(3)} を掛けて |zw| = ${abs(zw).toFixed(3)}。` +
      `偏角のほうは ${deg(arg(z)).toFixed(1)}° に ${deg(arg(w)).toFixed(1)}° を足して ${deg(arg(zw)).toFixed(1)}°。` +
      `長さは掛け算、角は足し算 — これが複素数の掛け算の正体です。` +
      (unitW.checked
        ? " いま w は単位円上にあるので、|w| = 1。zw は z を回しただけで、長さは変わりません。"
        : " w を単位円の上に置くと、掛け算が純粋な回転になります。");
  }

  function localPos(evt, el) {
    const rect = el.getBoundingClientRect();
    return { x: evt.clientX - rect.left, y: evt.clientY - rect.top };
  }

  function toComplex(pos, g) {
    const half = g.size / 2;
    return {
      re: ((pos.x - (g.ox + half)) / half) * g.range,
      im: -((pos.y - (g.oy + half)) / half) * g.range,
    };
  }

  canvas.addEventListener("pointerdown", (evt) => {
    if (!geom) return;
    const pos = localPos(evt, canvas);
    const near = (p) => Math.hypot(geom.sx(p.re) - pos.x, geom.sy(p.im) - pos.y);
    const dz = near(z);
    const dw = near(w);
    if (Math.min(dz, dw) > 26) return;
    dragging = dz <= dw ? "z" : "w";
    canvas.setPointerCapture(evt.pointerId);
    evt.preventDefault();
  });

  canvas.addEventListener("pointermove", (evt) => {
    if (!dragging || !geom) return;
    const p = toComplex(localPos(evt, canvas), geom);
    const clamped = {
      re: Math.max(-RANGE, Math.min(RANGE, p.re)),
      im: Math.max(-RANGE, Math.min(RANGE, p.im)),
    };
    if (dragging === "z") z = clamped;
    else w = clamped;
    renderProduct();
  });

  function endDrag(evt) {
    if (!dragging) return;
    if (evt && evt.pointerId != null && canvas.hasPointerCapture(evt.pointerId)) {
      canvas.releasePointerCapture(evt.pointerId);
    }
    dragging = null;
  }
  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);

  unitW.addEventListener("change", renderProduct);
  resetBtn.addEventListener("click", () => {
    z = { ...START.z };
    w = { ...START.w };
    renderProduct();
  });

  function stopSpin() {
    if (raf) cancelAnimationFrame(raf);
    raf = null;
    spinBtn.textContent = "w を1周させる";
  }

  spinBtn.addEventListener("click", () => {
    if (raf) {
      stopSpin();
      return;
    }
    const r = abs(w) || 1;
    const a0 = arg(w);
    const start = performance.now();
    spinBtn.textContent = "止める";
    const step = (now) => {
      const p = Math.min(1, (now - start) / 4200);
      const a = a0 + TAU * p;
      w = { re: Math.cos(a) * r, im: Math.sin(a) * r };
      renderProduct();
      if (p < 1) raf = requestAnimationFrame(step);
      else stopSpin();
    };
    raf = requestAnimationFrame(step);
  });

  /* ------------------------------------------------ panel 2: roots of unity -- */
  const rootsCanvas = $("cxRoots");
  const nSlider = $("cxN");
  const radSlider = $("cxRad");
  const argSlider = $("cxArg");
  const nOut = $("cxNOut");
  const radOut = $("cxRadOut");
  const argOut = $("cxArgOut");
  const rootNote = $("cxRootNote");

  function drawRoots() {
    const { ctx, width, height } = setupCanvasDPR(rootsCanvas);
    ctx.clearRect(0, 0, width, height);
    const vars = readVars(rootsCanvas.parentElement, [
      "--surface-1", "--muted", "--gridline", "--baseline",
      "--text-primary", "--text-secondary", "--series-1", "--series-2", "--series-3", "--series-4",
    ]);
    const g = drawPlane(ctx, width, height, vars, 1.8);

    const n = Number(nSlider.value);

    // the n roots of 1: a regular n-gon, every time
    ctx.strokeStyle = vars["--series-4"];
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let k = 0; k < n; k++) {
      const a = (TAU * k) / n;
      const x = g.sx(Math.cos(a));
      const y = g.sy(Math.sin(a));
      if (k === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = vars["--series-4"];
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.stroke();
    for (let k = 0; k < n; k++) {
      const a = (TAU * k) / n;
      const x = g.sx(Math.cos(a));
      const y = g.sy(Math.sin(a));
      ctx.fillStyle = vars["--series-4"];
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, TAU);
      ctx.fill();
    }

    // powers of a z the reader picks: on the circle, inside it, or outside
    const r = Number(radSlider.value);
    const a0 = (Number(argSlider.value) * Math.PI) / 180;
    let p = { re: 1, im: 0 };
    const step = { re: Math.cos(a0) * r, im: Math.sin(a0) * r };
    ctx.strokeStyle = vars["--series-1"];
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(g.sx(1), g.sy(0));
    for (let k = 1; k <= 14; k++) {
      p = mul(p, step);
      if (Math.hypot(p.re, p.im) > 3) break;
      ctx.lineTo(g.sx(p.re), g.sy(p.im));
    }
    ctx.stroke();

    p = { re: 1, im: 0 };
    for (let k = 1; k <= 14; k++) {
      p = mul(p, step);
      if (Math.hypot(p.re, p.im) > 3) break;
      ctx.fillStyle = vars["--series-1"];
      ctx.beginPath();
      ctx.arc(g.sx(p.re), g.sy(p.im), 3.6, 0, TAU);
      ctx.fill();
      if (k <= 4) {
        ctx.fillStyle = vars["--text-secondary"];
        ctx.font = SMALL_FONT;
        ctx.textAlign = "left";
        ctx.textBaseline = "bottom";
        ctx.fillText(k === 1 ? "z" : `z${["", "", "²", "³", "⁴"][k]}`, g.sx(p.re) + 7, g.sy(p.im) - 5);
      }
    }
  }

  function renderRoots() {
    const n = Number(nSlider.value);
    const r = Number(radSlider.value);
    const a = Number(argSlider.value);
    nOut.textContent = String(n);
    radOut.textContent = r.toFixed(2);
    argOut.textContent = `${a}°`;
    drawRoots();

    const spacing = 360 / n;
    const inside = r < 0.995;
    const outside = r > 1.005;
    rootNote.textContent =
      `zⁿ = 1 の解は ${n} 個。${spacing.toFixed(1)}° おきに単位円をまわり、正 ${n} 角形の頂点になります。` +
      `n 乗して 1 に戻るには、n 回まわしてちょうど 1 周（または何周か）すればよい、というだけのことです。` +
      (inside
        ? ` いま |z| = ${r.toFixed(2)} < 1 なので、累乗するたびに短くなり、原点に向かう内向きのらせんになります。`
        : outside
        ? ` いま |z| = ${r.toFixed(2)} > 1 なので、累乗するたびに長くなり、外へ広がるらせんになります。`
        : ` いま |z| = 1 ちょうどなので、z の累乗は円の上を ${a}° ずつ回りつづけます。` +
          (360 % a === 0 && a !== 0 ? ` ${360 / a} 回で 1 に戻ります。` : " 割り切れない角なので 1 には戻りません。"));
  }

  for (const el of [nSlider, radSlider, argSlider]) el.addEventListener("input", renderRoots);

  return {
    show() {},
    hide() {
      stopSpin();
    },
    redraw() {
      renderProduct();
      renderRoots();
    },
  };
}
