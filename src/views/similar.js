import { readVars, setupCanvasDPR } from "../chart.js";
import {
  BOXES, FIGURES, SOLIDS, boxByKey, boxSurface, boxVolume, figureByKey,
  polyArea, ratios, scalePoly, tileBox,
} from "../similar.js";
import { fitTo, makeCamera } from "../scene3d.js";

const $ = (id) => document.getElementById(id);
const LABEL_FONT = "13px system-ui, -apple-system, 'Segoe UI', sans-serif";
const SMALL_FONT = "11px system-ui, -apple-system, 'Segoe UI', sans-serif";

const fmt = (v, d = 2) => v.toFixed(d);

export function initSimilarView() {
  /* ------------------------------------------------------------- 平面 -- */
  const figureHost = $("smFigures");
  const kSlider = $("smK");
  const kOut = $("smKOut");
  const countToggle = $("smCount");
  const planeCanvas = $("smPlaneCanvas");
  const planeNote = $("smPlaneNote");
  const statLen = $("smRatioLen");
  const statArea = $("smRatioArea");
  const statPieces = $("smPieces");
  const planeSteps = $("smPlaneSteps");

  let figure = FIGURES[0];

  function drawPlane() {
    const { ctx, width, height } = setupCanvasDPR(planeCanvas);
    ctx.clearRect(0, 0, width, height);
    const vars = readVars(planeCanvas.parentElement, [
      "--surface-1", "--muted", "--gridline", "--baseline", "--text-primary",
      "--text-secondary", "--series-1", "--series-2", "--series-3", "--series-4",
    ]);

    const k = Number(kSlider.value);
    const big = scalePoly(figure.poly, k);
    const pieces = figure.tile(big, k);

    // The original sits beside the enlargement at the same scale — the point is
    // lost if they are drawn at different zooms.
    const gap = 0.5;
    const wOf = (poly) => Math.max(...poly.map((p) => p[0])) - Math.min(...poly.map((p) => p[0]));
    const hOf = (poly) => Math.max(...poly.map((p) => p[1])) - Math.min(...poly.map((p) => p[1]));
    const totalW = wOf(figure.poly) + gap + wOf(big);
    const totalH = Math.max(hOf(figure.poly), hOf(big));
    const pad = 34;
    const scale = Math.min((width - pad * 2) / totalW, (height - pad * 2 - 18) / totalH);
    const ox = (width - totalW * scale) / 2;
    const oy = height - pad - (height - pad * 2 - 18 - totalH * scale) / 2;
    const at = (dx) => ([x, y]) => [ox + (x + dx) * scale, oy - y * scale];

    const fill = (poly, map, color, alpha) => {
      ctx.fillStyle = color;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      poly.forEach((p, i) => {
        const q = map(p);
        if (i === 0) ctx.moveTo(q[0], q[1]);
        else ctx.lineTo(q[0], q[1]);
      });
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
    };
    const stroke = (poly, map, color, w) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = w;
      ctx.lineJoin = "round";
      ctx.beginPath();
      poly.forEach((p, i) => {
        const q = map(p);
        if (i === 0) ctx.moveTo(q[0], q[1]);
        else ctx.lineTo(q[0], q[1]);
      });
      ctx.closePath();
      ctx.stroke();
    };

    // the original, on the left
    const mapSmall = at(0);
    fill(figure.poly, mapSmall, vars["--series-2"], 0.3);
    stroke(figure.poly, mapSmall, vars["--series-2"], 2);

    // the enlargement, tiled
    const dx = wOf(figure.poly) + gap;
    const mapBig = at(dx);
    pieces.forEach((piece, i) => {
      fill(piece.poly, mapBig, piece.flipped ? vars["--series-4"] : vars["--series-1"], 0.22);
      stroke(piece.poly, mapBig, piece.flipped ? vars["--series-4"] : vars["--series-1"], 1);
      if (countToggle.checked && pieces.length <= 36) {
        const c = piece.poly.reduce((a, p) => [a[0] + p[0], a[1] + p[1]], [0, 0]);
        const q = mapBig([c[0] / piece.poly.length, c[1] / piece.poly.length]);
        ctx.fillStyle = vars["--text-secondary"];
        ctx.font = SMALL_FONT;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(i + 1), q[0], q[1]);
      }
    });
    stroke(big, mapBig, vars["--series-1"], 2.4);

    ctx.fillStyle = vars["--text-secondary"];
    ctx.font = LABEL_FONT;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText("もとの図形", ox + (wOf(figure.poly) / 2) * scale, oy + 8);
    ctx.fillText(`${k} 倍に拡大`, ox + (dx + wOf(big) / 2) * scale, oy + 8);
  }

  function renderPlane() {
    const k = Number(kSlider.value);
    kOut.textContent = String(k);
    drawPlane();

    const r = ratios(k);
    const pieces = figure.tile(scalePoly(figure.poly, k), k);
    statLen.textContent = `1 : ${r.length}`;
    statArea.textContent = `1 : ${r.area}`;
    statPieces.textContent = `${pieces.length} 個`;

    const base = polyArea(figure.poly);
    const big = polyArea(scalePoly(figure.poly, k));
    planeNote.textContent =
      k === 1
        ? "k = 1 では拡大していないので、そのまま 1 個です。スライダーを動かしてください。"
        : `長さは ${k} 倍ですが、面積は ${r.area} 倍です（${fmt(base)} → ${fmt(big)}）。` +
          `もとの図形が ${pieces.length} 個ぶん入っているのが見えるはずです。${figure.note}`;

    planeSteps.innerHTML = [
      `<li><code>長さの比（相似比）= 1 : ${k}</code>` +
        `<span class="step-note">対応する辺どうしの比。これが出発点です</span></li>`,
      `<li class="step-key"><code>面積比 = 1² : ${k}² = 1 : ${r.area}</code>` +
        `<span class="step-note">たてに ${k} 倍、よこにも ${k} 倍だから ${k} × ${k}。` +
        `長さの比を 2 乗する、と覚えるより「何個ぶん入るか」で見たほうが忘れません</span></li>`,
      `<li><code>逆に、面積比が 1 : ${r.area} なら相似比は 1 : ${k}</code>` +
        `<span class="step-note">面積比から相似比を求めるときは √ をとります。入試ではこの向きがよく出ます</span></li>`,
      `<li class="step-key"><code>相似比 2 : 3 → 面積比 4 : 9、体積比 8 : 27</code>` +
        `<span class="step-note">この 3 つ組はそのまま覚えてしまってよい定番です</span></li>`,
    ].join("");
  }

  figureHost.innerHTML = FIGURES.map(
    (f) => `<button type="button" class="chip" data-key="${f.key}">${f.label}</button>`
  ).join("");
  figureHost.addEventListener("click", (evt) => {
    const btn = evt.target.closest("button[data-key]");
    if (!btn) return;
    figure = figureByKey(btn.dataset.key);
    renderPlane();
  });
  kSlider.addEventListener("input", renderPlane);
  countToggle.addEventListener("change", renderPlane);

  /* ------------------------------------------------------------- 立体 -- */
  const boxHost = $("smBoxes");
  const k3Slider = $("smK3");
  const k3Out = $("smK3Out");
  const explodeToggle = $("smExplode");
  const solidCanvas = $("smSolidCanvas");
  const solidNote = $("smSolidNote");
  const statSurf = $("smRatioSurf");
  const statVol = $("smRatioVol");
  const statCubes = $("smCubes");
  const solidTable = $("smSolidTable").querySelector("tbody");

  let box = BOXES[0];
  let az = -0.62;
  let el = 0.5;
  let dragging = null;

  /** The six faces of a box, as outward-wound quads. */
  function boxFaces(at, dims) {
    const [x, y, z] = at;
    const [w, h, d] = dims;
    const v = [
      [x, y, z], [x + w, y, z], [x + w, y + h, z], [x, y + h, z],
      [x, y, z + d], [x + w, y, z + d], [x + w, y + h, z + d], [x, y + h, z + d],
    ];
    return [
      { pts: [v[0], v[1], v[2], v[3]], n: [0, 0, -1] },
      { pts: [v[4], v[7], v[6], v[5]], n: [0, 0, 1] },
      { pts: [v[0], v[4], v[5], v[1]], n: [0, -1, 0] },
      { pts: [v[3], v[2], v[6], v[7]], n: [0, 1, 0] },
      { pts: [v[0], v[3], v[7], v[4]], n: [-1, 0, 0] },
      { pts: [v[1], v[5], v[6], v[2]], n: [1, 0, 0] },
    ];
  }

  function drawSolid() {
    const { ctx, width, height } = setupCanvasDPR(solidCanvas);
    ctx.clearRect(0, 0, width, height);
    const vars = readVars(solidCanvas.parentElement, [
      "--surface-1", "--muted", "--gridline", "--text-primary", "--text-secondary",
      "--series-1", "--series-2", "--series-3", "--series-4",
    ]);

    const k = Number(k3Slider.value);
    const spread = explodeToggle.checked ? 0.35 : 0;
    const cells = tileBox(box.dims, k).map((c) => ({
      ...c,
      at: [
        c.at[0] + (c.at[0] / box.dims[0]) * spread * box.dims[0],
        c.at[1] + (c.at[1] / box.dims[1]) * spread * box.dims[1],
        c.at[2] + (c.at[2] / box.dims[2]) * spread * box.dims[2],
      ],
    }));

    // centre the whole stack on the origin before projecting
    const size = box.dims.map((d) => d * k * (1 + spread));
    const shift = size.map((s) => -s / 2);

    const cam = makeCamera(az, el);
    const gathered = [];
    const faces = [];
    for (const cell of cells) {
      const at = [cell.at[0] + shift[0], cell.at[1] + shift[1], cell.at[2] + shift[2]];
      for (const f of boxFaces(at, cell.dims)) {
        // only faces turned towards the camera; the rest are hidden anyway
        if (!cam.facing(f.n)) continue;
        faces.push(f);
        gathered.push(...f.pts);
      }
    }
    if (!faces.length) return;

    // fit inside the frame less the caption band at the foot
    const map = fitTo(gathered, cam, width, height - 16, 30);
    const drawn = faces
      .map((f) => {
        const q = f.pts.map(map);
        return { q, n: f.n, depth: q.reduce((s, p) => s + p[2], 0) / q.length };
      })
      .sort((a, b) => a.depth - b.depth);

    // One hue, three shades for the three directions a face can point. Each
    // face is laid over an opaque ground first: painted with alpha alone the
    // stack turns into glass and you see the cubes behind, which is the one
    // thing this picture must not look like.
    const shade = (n) => (n[2] !== 0 ? 0.72 : n[1] !== 0 ? 0.5 : 0.3);
    for (const f of drawn) {
      ctx.beginPath();
      f.q.forEach(([x, y], i) => {
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.closePath();
      ctx.globalAlpha = 1;
      ctx.fillStyle = vars["--surface-1"];
      ctx.fill();
      ctx.globalAlpha = shade(f.n);
      ctx.fillStyle = vars["--series-1"];
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = vars["--surface-1"];
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    ctx.fillStyle = vars["--text-secondary"];
    ctx.font = LABEL_FONT;
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText(`${box.label}を ${k} 倍 — もとの立体 ${k ** 3} 個ぶん`, width / 2, height - 6);
  }

  function renderSolid() {
    const k = Number(k3Slider.value);
    k3Out.textContent = String(k);
    drawSolid();

    const r = ratios(k);
    statSurf.textContent = `1 : ${r.area}`;
    statVol.textContent = `1 : ${r.volume}`;
    statCubes.textContent = `${k ** 3} 個`;

    const v = boxVolume(box.dims);
    const s = boxSurface(box.dims);
    const bigDims = box.dims.map((d) => d * k);
    solidNote.textContent =
      k === 1
        ? "k = 1 では拡大していないので 1 個です。スライダーを動かしてください。"
        : `長さは ${k} 倍、表面積は ${r.area} 倍（${fmt(s)} → ${fmt(boxSurface(bigDims))}）、` +
          `体積は ${r.volume} 倍（${fmt(v)} → ${fmt(boxVolume(bigDims))}）。` +
          `「ばらして見る」で、${k ** 3} 個に分かれていることを確かめられます。`;

    solidTable.innerHTML = SOLIDS.map((solid) => {
      const v1 = solid.volume(1);
      const vk = solid.volume(k);
      return `<tr><td>${solid.label}</td><td>${fmt(v1, 3)}</td><td>${fmt(vk, 3)}</td>` +
        `<td>1 : ${fmt(vk / v1, 0)}</td><td>1 : ${fmt(solid.surface(k) / solid.surface(1), 0)}</td></tr>`;
    }).join("") +
      `<tr class="row-accent"><td>どの立体でも</td><td colspan="2">相似比 1 : ${k}</td>` +
      `<td>1 : ${r.volume}</td><td>1 : ${r.area}</td></tr>`;
  }

  boxHost.innerHTML = BOXES.map(
    (b) => `<button type="button" class="chip" data-key="${b.key}">${b.label}</button>`
  ).join("");
  boxHost.addEventListener("click", (evt) => {
    const btn = evt.target.closest("button[data-key]");
    if (!btn) return;
    box = boxByKey(btn.dataset.key);
    renderSolid();
  });
  for (const el2 of [k3Slider, explodeToggle]) el2.addEventListener("input", renderSolid);
  explodeToggle.addEventListener("change", renderSolid);

  solidCanvas.addEventListener("pointerdown", (evt) => {
    dragging = { x: evt.clientX, y: evt.clientY };
    solidCanvas.setPointerCapture(evt.pointerId);
    evt.preventDefault();
  });
  solidCanvas.addEventListener("pointermove", (evt) => {
    if (!dragging) return;
    az += (evt.clientX - dragging.x) * 0.01;
    el = Math.max(-1.4, Math.min(1.4, el + (evt.clientY - dragging.y) * 0.01));
    dragging = { x: evt.clientX, y: evt.clientY };
    drawSolid();
  });
  function endDrag(evt) {
    if (!dragging) return;
    if (evt && evt.pointerId != null && solidCanvas.hasPointerCapture(evt.pointerId)) {
      solidCanvas.releasePointerCapture(evt.pointerId);
    }
    dragging = null;
  }
  solidCanvas.addEventListener("pointerup", endDrag);
  solidCanvas.addEventListener("pointercancel", endDrag);

  solidCanvas.addEventListener("keydown", (evt) => {
    const step = evt.shiftKey ? 0.04 : 0.12;
    if (evt.key === "ArrowLeft") az -= step;
    else if (evt.key === "ArrowRight") az += step;
    else if (evt.key === "ArrowUp") el = Math.min(1.4, el + step);
    else if (evt.key === "ArrowDown") el = Math.max(-1.4, el - step);
    else return;
    evt.preventDefault();
    drawSolid();
  });

  return {
    show() {},
    redraw() {
      renderPlane();
      renderSolid();
    },
  };
}
