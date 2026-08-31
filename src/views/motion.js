import { readVars, setupCanvasDPR } from "../chart.js";
import {
  OVERLAP_CASES, overlapCaseByKey, clipConvex, polyArea2, areaAt, positionAt,
  durationOf, breakpoints, segmentKind,
  TANK_CASES, tankCaseByKey, simulateTank, tankStateAt, tankVolumeAt,
} from "../motion.js";

const $ = (id) => document.getElementById(id);
const TAU = Math.PI * 2;
const SMALL_FONT = "11px system-ui, -apple-system, 'Segoe UI', sans-serif";
const LABEL_FONT = "12px system-ui, -apple-system, 'Segoe UI', sans-serif";

/** Round an axis top up to a value whose quarter-marks are readable. */
function niceCeil(v) {
  if (!(v > 0)) return 1;
  const e = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 1.5, 2, 2.5, 3, 4, 5, 7.5]) if (v <= m * e + 1e-12) return m * e;
  return 10 * e;
}

/** A tick step that lands on round numbers, roughly six across the axis. */
function niceStep(span) {
  const want = span / 6;
  for (const c of [0.5, 1, 2, 2.5, 5, 10, 15, 20, 25, 30, 50, 100, 200]) if (c >= want) return c;
  return span;
}

/** Split a canvas into a figure pane on top and a graph pane below. */
function panes(width, height) {
  const gap = 30;
  const h = (height - gap) / 2;
  return { fig: { x: 0, y: 0, w: width, h }, plot: { x: 0, y: h + gap, w: width, h } };
}

function fillPoly(ctx, poly, map, color, alpha) {
  if (poly.length < 3) return;
  ctx.beginPath();
  poly.forEach((p, i) => {
    const q = map(p);
    if (i === 0) ctx.moveTo(q[0], q[1]);
    else ctx.lineTo(q[0], q[1]);
  });
  ctx.closePath();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.fill();
  ctx.globalAlpha = 1;
}

function strokePoly(ctx, poly, map, color, wdt) {
  ctx.beginPath();
  poly.forEach((p, i) => {
    const q = map(p);
    if (i === 0) ctx.moveTo(q[0], q[1]);
    else ctx.lineTo(q[0], q[1]);
  });
  ctx.closePath();
  ctx.strokeStyle = color;
  ctx.lineWidth = wdt;
  ctx.stroke();
}

/** Axes, ticks and the curve so far — shared by both panels. */
function drawGraph(ctx, vars, box, opts) {
  const { xMax, yMax, xLabel, yLabel, sample, upto, marks, cursor } = opts;
  // gridlines at the heights that mean something, when the caller knows them
  const yTicks = opts.yTicks || [0, 1, 2, 3, 4].map((k) => (yMax * k) / 4);
  const pad = { l: 46, r: 14, t: 16, b: 42 };
  const w = box.w - pad.l - pad.r;
  const h = box.h - pad.t - pad.b;
  if (w < 20 || h < 20) return null;
  const sx = (t) => box.x + pad.l + (t / xMax) * w;
  const sy = (v) => box.y + pad.t + h - (v / yMax) * h;

  ctx.strokeStyle = vars["--gridline"];
  ctx.lineWidth = 1;
  ctx.fillStyle = vars["--muted"];
  ctx.font = SMALL_FONT;
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  for (const v of yTicks) {
    const y = Math.round(sy(v)) + 0.5;
    ctx.beginPath();
    ctx.moveTo(box.x + pad.l, y);
    ctx.lineTo(box.x + pad.l + w, y);
    ctx.stroke();
    ctx.fillText(Number.isInteger(v) ? String(v) : v.toFixed(1), box.x + pad.l - 6, y);
  }
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  const xStep = niceStep(xMax);
  for (let t = 0; t <= xMax + 1e-9; t += xStep) {
    const x = Math.round(sx(t)) + 0.5;
    ctx.beginPath();
    ctx.moveTo(x, box.y + pad.t);
    ctx.lineTo(x, box.y + pad.t + h);
    ctx.stroke();
    ctx.fillText(Number.isInteger(t) ? String(t) : t.toFixed(1), x, box.y + pad.t + h + 5);
  }
  ctx.strokeStyle = vars["--baseline"];
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(box.x + pad.l, Math.round(sy(0)) + 0.5);
  ctx.lineTo(box.x + pad.l + w, Math.round(sy(0)) + 0.5);
  ctx.stroke();

  ctx.fillStyle = vars["--text-secondary"];
  ctx.font = LABEL_FONT;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(yLabel, box.x + pad.l + 4, box.y + 1);
  ctx.textAlign = "right";
  ctx.fillText(xLabel, box.x + pad.l + w, box.y + pad.t + h + 21);

  // the curve, only as far as the clock has run
  ctx.strokeStyle = vars["--series-1"];
  ctx.lineWidth = 2.5;
  ctx.lineJoin = "round";
  ctx.beginPath();
  const steps = 320;
  for (let i = 0; i <= steps; i++) {
    const t = (upto * i) / steps;
    const x = sx(t);
    const y = sy(sample(t));
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  for (const t of marks) {
    if (t > upto + 1e-9) continue;
    const v = sample(t);
    ctx.fillStyle = vars["--surface-1"];
    ctx.beginPath();
    ctx.arc(sx(t), sy(v), 6, 0, TAU);
    ctx.fill();
    ctx.fillStyle = vars["--series-2"];
    ctx.beginPath();
    ctx.arc(sx(t), sy(v), 3.6, 0, TAU);
    ctx.fill();
  }

  if (cursor) {
    const v = sample(upto);
    ctx.strokeStyle = vars["--series-3"];
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(sx(upto), sy(v));
    ctx.lineTo(sx(upto), box.y + pad.t + h);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = vars["--series-3"];
    ctx.beginPath();
    ctx.arc(sx(upto), sy(v), 5, 0, TAU);
    ctx.fill();
  }
  return { sx, sy };
}

export function initMotionView() {
  const overlap = initOverlapPanel();
  const tank = initTankPanel();
  return {
    show() {},
    hide() {
      overlap.stop();
      tank.stop();
    },
    redraw() {
      overlap.render();
      tank.render();
    },
  };
}

/* -------------------------------------------------- panel 1: overlap area -- */

function initOverlapPanel() {
  const canvas = $("moOverlap");
  const presetHost = $("moOvPresets");
  const breakHost = $("moBreaks");
  const slider = $("moT");
  const tOut = $("moTOut");
  const playBtn = $("moPlay");
  const note = $("moOvNote");
  const segNote = $("moOvSegs");
  const statArea = $("moArea");
  const statPeak = $("moPeak");
  const statBreaks = $("moBreakCount");

  let spec = OVERLAP_CASES[0];
  let raf = null;

  function figureBounds() {
    const xs = [];
    const ys = [];
    for (const p of spec.fixed.outline) {
      xs.push(p[0]);
      ys.push(p[1]);
    }
    for (const p of spec.moving.outline) {
      xs.push(p[0] + spec.from, p[0] + spec.to);
      ys.push(p[1]);
    }
    return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
  }

  function peakArea() {
    let peak = 0;
    const span = durationOf(spec);
    for (let i = 0; i <= 600; i++) peak = Math.max(peak, areaAt(spec, (span * i) / 600));
    return peak;
  }

  function draw() {
    const { ctx, width, height } = setupCanvasDPR(canvas);
    ctx.clearRect(0, 0, width, height);
    const vars = readVars(canvas.parentElement, [
      "--surface-1", "--muted", "--gridline", "--baseline",
      "--text-primary", "--text-secondary", "--series-1", "--series-2", "--series-3", "--series-4",
    ]);
    const { fig, plot } = panes(width, height);
    const t = Number(slider.value);
    const p = positionAt(spec, t);

    const b = figureBounds();
    const padF = 26;
    const scale = Math.min((fig.w - padF * 2) / (b.x1 - b.x0), (fig.h - padF * 2) / (b.y1 - b.y0));
    const ox = fig.x + (fig.w - (b.x1 - b.x0) * scale) / 2 - b.x0 * scale;
    const oy = fig.y + fig.h - (fig.h - (b.y1 - b.y0) * scale) / 2 - -b.y0 * scale;
    const map = ([x, y]) => [ox + x * scale, oy - y * scale];

    fillPoly(ctx, spec.fixed.outline, map, vars["--series-4"], 0.18);
    strokePoly(ctx, spec.fixed.outline, map, vars["--series-4"], 2);

    const movedOutline = spec.moving.outline.map(([x, y]) => [x + p, y]);
    fillPoly(ctx, movedOutline, map, vars["--series-2"], 0.18);
    strokePoly(ctx, movedOutline, map, vars["--series-2"], 2);

    for (const m of spec.moving.pieces) {
      const moved = m.map(([x, y]) => [x + p, y]);
      for (const f of spec.fixed.pieces) {
        const cut = clipConvex(moved, f);
        if (cut.length >= 3) {
          fillPoly(ctx, cut, map, vars["--series-1"], 0.6);
          strokePoly(ctx, cut, map, vars["--series-1"], 1.5);
        }
      }
    }

    ctx.fillStyle = vars["--muted"];
    ctx.font = SMALL_FONT;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(`止まっている図形: ${spec.fixed.label}`, fig.x + 6, fig.y + 4);
    ctx.fillText(`動く図形: ${spec.moving.label}（毎秒 1cm）`, fig.x + 6, fig.y + 20);

    drawGraph(ctx, vars, plot, {
      xMax: durationOf(spec),
      yMax: niceCeil(peakArea() * 1.05),
      xLabel: "時間（秒）",
      yLabel: "重なりの面積（cm²）",
      sample: (tt) => areaAt(spec, tt),
      upto: t,
      marks: breakpoints(spec),
      cursor: true,
    });
  }

  function describeSegments() {
    const span = durationOf(spec);
    const bps = breakpoints(spec);
    const edges = [0, ...bps, span];
    const parts = [];
    for (let i = 0; i + 1 < edges.length; i++) {
      const a = edges[i];
      const b = edges[i + 1];
      const kind = segmentKind(spec, a, b).kind;
      const d = (areaAt(spec, b) - areaAt(spec, a)) / (b - a);
      const dir = Math.abs(d) < 1e-9 ? "変わらない" : d > 0 ? `増える` : `減る`;
      parts.push(
        `${a.toFixed(a % 1 ? 1 : 0)}〜${b.toFixed(b % 1 ? 1 : 0)}秒: ${kind}で${dir}` +
          (kind === "直線" && Math.abs(d) > 1e-9 ? `（毎秒 ${Math.abs(d).toFixed(2)} cm²）` : "")
      );
    }
    return parts.join(" ／ ");
  }

  function render() {
    const span = durationOf(spec);
    slider.max = String(span);
    const t = Math.min(Number(slider.value), span);
    tOut.textContent = t.toFixed(1);
    draw();

    const bps = breakpoints(spec);
    statArea.textContent = `${areaAt(spec, t).toFixed(2)} cm²`;
    statPeak.textContent = `${peakArea().toFixed(2)} cm²`;
    statBreaks.textContent = `${bps.length} つ`;

    breakHost.innerHTML = bps
      .map((bt) => `<button type="button" class="chip" data-t="${bt}">${bt.toFixed(1)} 秒</button>`)
      .join("") || '<span class="note-inline">なし</span>';

    note.innerHTML = spec.note;
    segNote.textContent = `グラフの読み: ${describeSegments()}。` +
      `直線になるのは「重なりの横はばだけが一定の速さで変わる」とき、` +
      `曲線になるのは「横はばと高さが同時に変わる」ときです。`;
  }

  function stop() {
    if (raf) cancelAnimationFrame(raf);
    raf = null;
    playBtn.textContent = "動かす";
  }

  playBtn.addEventListener("click", () => {
    if (raf) {
      stop();
      return;
    }
    const span = durationOf(spec);
    const from = Number(slider.value) >= span - 1e-9 ? 0 : Number(slider.value);
    const start = performance.now();
    playBtn.textContent = "止める";
    const step = (now) => {
      const done = Math.min(1, (now - start) / (span * 420));
      slider.value = String(from + (span - from) * done);
      render();
      if (done < 1) raf = requestAnimationFrame(step);
      else stop();
    };
    raf = requestAnimationFrame(step);
  });

  slider.addEventListener("input", () => {
    stop();
    render();
  });
  breakHost.addEventListener("click", (evt) => {
    const btn = evt.target.closest("button[data-t]");
    if (!btn) return;
    stop();
    slider.value = btn.dataset.t;
    render();
  });

  presetHost.innerHTML = OVERLAP_CASES.map(
    (c) => `<button type="button" class="chip" data-key="${c.key}">${c.label}</button>`
  ).join("");
  presetHost.addEventListener("click", (evt) => {
    const btn = evt.target.closest("button[data-key]");
    if (!btn) return;
    spec = overlapCaseByKey(btn.dataset.key);
    for (const b of presetHost.querySelectorAll("button")) {
      b.classList.toggle("chip-accent", b === btn);
    }
    stop();
    slider.value = "0";
    render();
  });
  presetHost.querySelector("button").classList.add("chip-accent");

  return { render, stop };
}

/* ------------------------------------------------------- panel 2: the tank -- */

function initTankPanel() {
  const canvas = $("moTank");
  const presetHost = $("moTankPresets");
  const breakHost = $("moTankBreaks");
  const slider = $("moTankT");
  const tOut = $("moTankTOut");
  const playBtn = $("moTankPlay");
  const note = $("moTankNote");
  const statLevel = $("moTankLevel");
  const statVol = $("moTankVol");
  const statFull = $("moTankFull");
  const tableBody = $("moTankTable").querySelector("tbody");

  let spec = TANK_CASES[0];
  let sim = simulateTank(spec);
  let raf = null;

  const totalWidth = () => spec.widths.reduce((a, b) => a + b, 0);

  function levelAt(t) {
    return tankStateAt(sim, spec, Math.min(t, sim.tFull)).left;
  }

  function draw() {
    const { ctx, width, height } = setupCanvasDPR(canvas);
    ctx.clearRect(0, 0, width, height);
    const vars = readVars(canvas.parentElement, [
      "--surface-1", "--muted", "--gridline", "--baseline",
      "--text-primary", "--text-secondary", "--series-1", "--series-2", "--series-3", "--series-4",
    ]);
    const { fig, plot } = panes(width, height);
    const t = Math.min(Number(slider.value), sim.tFull);
    const { levels } = tankStateAt(sim, spec, t);

    const W = totalWidth();
    const padF = 30;
    const scale = Math.min((fig.w - padF * 2) / W, (fig.h - padF * 2) / spec.height);
    const ox = fig.x + (fig.w - W * scale) / 2;
    const oy = fig.y + (fig.h + spec.height * scale) / 2;
    const px = (x) => ox + x * scale;
    const py = (y) => oy - y * scale;

    // water, room by room
    let x = 0;
    spec.widths.forEach((w, i) => {
      const lv = levels[i];
      if (lv > 1e-9) {
        ctx.fillStyle = vars["--series-1"];
        ctx.globalAlpha = 0.45;
        ctx.fillRect(px(x), py(lv), w * scale, lv * scale);
        ctx.globalAlpha = 1;
      }
      ctx.fillStyle = vars["--muted"];
      ctx.font = SMALL_FONT;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(`${w}cm`, px(x + w / 2), py(0) + 6);
      if (lv > 0.4) {
        ctx.fillStyle = vars["--text-secondary"];
        ctx.textBaseline = "bottom";
        ctx.fillText(`${lv.toFixed(1)}cm`, px(x + w / 2), py(lv) - 4);
      }
      x += w;
    });

    ctx.strokeStyle = vars["--baseline"];
    ctx.lineWidth = 2.5;
    ctx.strokeRect(px(0), py(spec.height), W * scale, spec.height * scale);

    x = 0;
    spec.walls.forEach((h, i) => {
      x += spec.widths[i];
      ctx.strokeStyle = vars["--series-4"];
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(px(x), py(0));
      ctx.lineTo(px(x), py(h));
      ctx.stroke();
      ctx.fillStyle = vars["--series-4"];
      ctx.font = SMALL_FONT;
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillText(`${h}cm`, px(x), py(h) - 5);
    });

    ctx.fillStyle = vars["--muted"];
    ctx.font = SMALL_FONT;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(`奥行 ${spec.depth}cm・高さ ${spec.height}cm・毎秒 ${spec.rate}cm³`, fig.x + 6, fig.y + 4);

    // the tap, over the room being poured into
    ctx.strokeStyle = vars["--series-3"];
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(px(spec.widths[0] / 2), py(spec.height) - 16);
    ctx.lineTo(px(spec.widths[0] / 2), py(spec.height) - 2);
    ctx.stroke();

    drawGraph(ctx, vars, plot, {
      xMax: sim.tFull,
      yMax: spec.height,
      // the wall tops are exactly where the graph goes flat, so put the
      // gridlines there rather than at even fractions of the height
      yTicks: [0, ...spec.walls, spec.height],
      xLabel: "時間（秒）",
      yLabel: "左のへやの水面（cm）",
      sample: levelAt,
      upto: t,
      marks: sim.segments.map((s) => s.t1).slice(0, -1),
      cursor: true,
    });
  }

  function segmentRows() {
    return sim.segments
      .map((s) => {
        const slope = (s.left1 - s.left0) / (s.t1 - s.t0);
        const pool = s.pools[s.rising];
        const rooms = pool.hi - pool.lo + 1;
        const what =
          s.rising === 0
            ? `左をふくむ ${rooms} つのへやに水がたまる（底面積 ${sim.baseArea(pool.lo, pool.hi)}cm²）`
            : `${pool.lo + 1} 番目のへやがたまっている。左は仕切りの高さで止まったまま`;
        return `<tr><td>${s.t0.toFixed(0)}〜${s.t1.toFixed(0)}秒</td>` +
          `<td>${s.left0.toFixed(1)} → ${s.left1.toFixed(1)}cm</td>` +
          `<td>${slope < 1e-9 ? "0（平ら）" : slope.toFixed(3) + "cm"}</td>` +
          `<td style="text-align:left">${what}</td></tr>`;
      })
      .join("");
  }

  function render() {
    slider.max = String(sim.tFull);
    const t = Math.min(Number(slider.value), sim.tFull);
    tOut.textContent = t.toFixed(0);
    draw();

    statLevel.textContent = `${levelAt(t).toFixed(2)} cm`;
    statVol.textContent = `${Math.round(tankVolumeAt(sim, spec, t)).toLocaleString("ja-JP")} cm³`;
    statFull.textContent = `${sim.tFull.toFixed(0)} 秒`;

    const marks = sim.segments.map((s) => s.t1).slice(0, -1);
    breakHost.innerHTML = marks
      .map((bt) => `<button type="button" class="chip" data-t="${bt}">${bt.toFixed(0)} 秒</button>`)
      .join("") || '<span class="note-inline">なし</span>';

    tableBody.innerHTML = segmentRows();
    note.textContent =
      `${spec.note} 満水は ${sim.tFull.toFixed(0)} 秒後（水そう全体で ` +
      `${sim.totalVolume.toLocaleString("ja-JP")}cm³ ÷ 毎秒 ${spec.rate}cm³）。` +
      `のぼる区間の傾きは「毎秒の水の量 ÷ そのとき水を受けている底面積」そのものなので、` +
      `底面積が広がるほどグラフはゆるやかになります。`;
  }

  function stop() {
    if (raf) cancelAnimationFrame(raf);
    raf = null;
    playBtn.textContent = "水を入れる";
  }

  playBtn.addEventListener("click", () => {
    if (raf) {
      stop();
      return;
    }
    const from = Number(slider.value) >= sim.tFull - 1e-9 ? 0 : Number(slider.value);
    const start = performance.now();
    playBtn.textContent = "止める";
    const step = (now) => {
      const done = Math.min(1, (now - start) / 6000);
      slider.value = String(from + (sim.tFull - from) * done);
      render();
      if (done < 1) raf = requestAnimationFrame(step);
      else stop();
    };
    raf = requestAnimationFrame(step);
  });

  slider.addEventListener("input", () => {
    stop();
    render();
  });
  breakHost.addEventListener("click", (evt) => {
    const btn = evt.target.closest("button[data-t]");
    if (!btn) return;
    stop();
    slider.value = btn.dataset.t;
    render();
  });

  presetHost.innerHTML = TANK_CASES.map(
    (c) => `<button type="button" class="chip" data-key="${c.key}">${c.label}</button>`
  ).join("");
  presetHost.addEventListener("click", (evt) => {
    const btn = evt.target.closest("button[data-key]");
    if (!btn) return;
    spec = tankCaseByKey(btn.dataset.key);
    sim = simulateTank(spec);
    for (const b of presetHost.querySelectorAll("button")) {
      b.classList.toggle("chip-accent", b === btn);
    }
    stop();
    slider.value = "0";
    render();
  });
  presetHost.querySelector("button").classList.add("chip-accent");

  return { render, stop };
}
