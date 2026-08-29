import { readVars, setupCanvasDPR } from "../chart.js";
import { gcd } from "../fractions.js";
import {
  makeCube, makePrism, planeThrough, crossSection, splitVolume, polygonArea3,
  shapeName, extensionPoints, constructionSteps, sectionSegments, piece, ratioText,
  solidEdges, faceNormal, centroid, sub, add, scale, len, lerp3,
} from "../section.js";

const $ = (id) => document.getElementById(id);
const TAU = Math.PI * 2;
const LABEL_FONT = "13px system-ui, -apple-system, 'Segoe UI', sans-serif";
const SMALL_FONT = "11px system-ui, -apple-system, 'Segoe UI', sans-serif";

const CUBE = makeCube(1, 1, 1);
const EDGE_INDEX = CUBE.edgeNames.map(([a, b]) => [CUBE.names.indexOf(a), CUBE.names.indexOf(b)]);
const EDGE_LABEL = CUBE.edgeNames.map(([a, b]) => `辺 ${a}${b}`);

/** Slider position 0..12 read the way a problem would state it. */
function ratioLabel(edge, k) {
  const [a, b] = CUBE.edgeNames[edge];
  if (k === 0) return `頂点 ${a}`;
  if (k === 12) return `頂点 ${b}`;
  const g = gcd(k, 12 - k);
  return `${k / g} : ${(12 - k) / g}`;
}

const POINT_KEYS = ["P", "Q", "R"];

/** Where a vertex's letter goes: just outside the corner, clear of the edges. */
const CUBE_MID = centroid(CUBE.verts);
const labelSpot = (v) => add(v, scale(sub(v, CUBE_MID), 0.16));

const PRESETS = [
  { label: "6辺の中点（正六角形）", v: [[0, 6], [3, 6], [9, 6]] },
  { label: "頂点を切り落とす", v: [[0, 12], [3, 0], [8, 12]] },
  { label: "対角線を通る", v: [[0, 0], [1, 12], [10, 12]] },
  { label: "平行な面（原則2）", v: [[0, 6], [2, 6], [4, 6]] },
  { label: "延長法が要る（五角形）", v: [[0, 6], [3, 6], [10, 9]] },
  { label: "等脚台形になる", v: [[0, 6], [1, 6], [8, 12]] },
  { label: "ひし形になる", v: [[0, 6], [1, 12], [8, 12]] },
];

/* ------------------------------------------------------------- projection -- */

function rotZ(p, az) {
  const c = Math.cos(az);
  const s = Math.sin(az);
  return [p[0] * c - p[1] * s, p[0] * s + p[1] * c, p[2]];
}

function makeCamera(az, el) {
  const ce = Math.cos(el);
  const se = Math.sin(el);
  return {
    /** Screen position, plus how near the camera the point is. */
    project(p) {
      const q = rotZ(p, az);
      return { x: q[0], y: -(q[1] * se + q[2] * ce), depth: -q[1] * ce + q[2] * se };
    },
    /** Does this outward normal face the camera? */
    facing(n) {
      const q = rotZ(n, az);
      return -q[1] * ce + q[2] * se > 1e-9;
    },
  };
}

function fitTo(points, cam, width, height, pad) {
  let lo = [Infinity, Infinity];
  let hi = [-Infinity, -Infinity];
  for (const p of points) {
    const q = cam.project(p);
    lo[0] = Math.min(lo[0], q.x);
    hi[0] = Math.max(hi[0], q.x);
    lo[1] = Math.min(lo[1], q.y);
    hi[1] = Math.max(hi[1], q.y);
  }
  const w = hi[0] - lo[0] || 1;
  const h = hi[1] - lo[1] || 1;
  const scl = Math.min((width - pad * 2) / w, (height - pad * 2) / h);
  const ox = width / 2 - ((lo[0] + hi[0]) / 2) * scl;
  const oy = height / 2 - ((lo[1] + hi[1]) / 2) * scl;
  return (p) => {
    const q = cam.project(p);
    return [ox + q.x * scl, oy + q.y * scl, q.depth];
  };
}

/* ------------------------------------------------------------------- view -- */

export function initSectionView() {
  const canvas = $("scCanvas");
  const rowHost = $("scPointRows");
  const presetHost = $("scPresets");
  const stepSlider = $("scStep");
  const stepOut = $("scStepOut");
  const playBtn = $("scPlay");
  const splitSlider = $("scSplit");
  const splitOut = $("scSplitOut");
  const spinSlider = $("scSpin");
  const spinOut = $("scSpinOut");
  const extToggle = $("scExt");
  const hiddenToggle = $("scHidden");
  const note = $("scNote");
  const stepList = $("scSteps");
  const rulesNote = $("scRules");
  const statShape = $("scShape");
  const statArea = $("scArea");
  const statRatio = $("scRatio");

  // each point lives on one edge of the cube, at a position in twelfths
  const pts = [
    { edge: 0, k: 6 },
    { edge: 3, k: 6 },
    { edge: 9, k: 6 },
  ];
  let elevation = (28 * Math.PI) / 180;
  let raf = null;
  let dragging = null;

  rowHost.innerHTML = POINT_KEYS.map(
    (key, i) => `
    <div class="controls-row slider-row">
      <label class="field field-inline">
        <span>点 ${key}</span>
        <select id="scEdge${key}" aria-label="点 ${key} を置く辺">${EDGE_INDEX.map(
      (_, e) => `<option value="${e}"${e === pts[i].edge ? " selected" : ""}>${EDGE_LABEL[e]}</option>`
    ).join("")}</select>
      </label>
      <label class="field field-grow">
        <span>位置 = <output id="scT${key}Out" class="mono">1 : 1</output></span>
        <input id="scT${key}" type="range" min="0" max="12" step="1" value="${pts[i].k}" />
      </label>
    </div>`
  ).join("");

  const edgeSel = POINT_KEYS.map((k) => $(`scEdge${k}`));
  const tSliders = POINT_KEYS.map((k) => $(`scT${k}`));
  const tOuts = POINT_KEYS.map((k) => $(`scT${k}Out`));

  function readPoints() {
    for (let i = 0; i < 3; i++) {
      pts[i].edge = Number(edgeSel[i].value);
      pts[i].k = Number(tSliders[i].value);
    }
    return pts.map((p) => {
      const [i, j] = EDGE_INDEX[p.edge];
      return lerp3(CUBE.verts[i], CUBE.verts[j], p.k / 12);
    });
  }

  /** Labels for the section's corners: the given points, cube vertices, then S, T, U… */
  function makeNamer(poly, given) {
    const extra = ["S", "T", "U", "V", "W"];
    let next = 0;
    const cache = poly.map((p) => {
      for (let i = 0; i < given.length; i++) if (len(sub(given[i], p)) < 1e-7) return POINT_KEYS[i];
      for (let i = 0; i < CUBE.verts.length; i++) if (len(sub(CUBE.verts[i], p)) < 1e-7) return CUBE.names[i];
      return extra[next++] || "•";
    });
    return (i) => cache[i];
  }

  /** A cube section never has more than 6 sides, so 6 always means "finished". */
  function showWholeSection() {
    stepSlider.max = "6";
    stepSlider.value = "6";
  }

  function currentGeometry() {
    const given = readPoints();
    const plane = planeThrough(given[0], given[1], given[2]);
    if (!plane) return { given, plane: null };
    const poly = crossSection(CUBE, plane);
    if (poly.length < 3) return { given, plane, poly: [] };
    const namer = makeNamer(poly, given);
    return {
      given,
      plane,
      poly,
      namer,
      segs: sectionSegments(CUBE, poly),
      steps: constructionSteps(CUBE, plane, poly, given, namer),
      vol: splitVolume(CUBE, plane),
      area: polygonArea3(poly),
      ext: extensionPoints(CUBE, plane),
    };
  }

  /* ------------------------------------------------------------- drawing -- */

  function draw(g) {
    const { ctx, width, height } = setupCanvasDPR(canvas);
    ctx.clearRect(0, 0, width, height);
    const vars = readVars(canvas.parentElement, [
      "--surface-1", "--page", "--muted", "--gridline", "--baseline",
      "--text-primary", "--text-secondary",
      "--series-1", "--series-2", "--series-3", "--series-4",
    ]);

    const az = (Number(spinSlider.value) * Math.PI) / 180;
    const cam = makeCamera(az, elevation);
    const mid = centroid(CUBE.verts);
    const centred = (p) => sub(p, mid);
    const split = Number(splitSlider.value);

    const total = g.poly ? g.poly.length : 0;
    const stepNow = Math.min(Number(stepSlider.value), total);
    const showExt =
      extToggle.checked && g.ext && g.ext.length && split < 0.01 && total > 0 && stepNow < total;

    // the vertex letters sit just outside the corners, so they have to be part
    // of the fit or the ones at the top and bottom get clipped off the canvas
    const gather = CUBE.verts.flatMap((v) => [centred(v), centred(labelSpot(v))]);
    if (showExt) for (const e of g.ext) gather.push(centred(e.point));
    if (split > 0.01 && g.plane) {
      const off = scale(g.plane.n, split * 0.55);
      for (const v of CUBE.verts) {
        gather.push(add(centred(v), off));
        gather.push(sub(centred(v), off));
      }
    }
    const map = fitTo(gather, cam, width, height, 34);
    const P = (p) => map(centred(p));

    if (split > 0.01 && g.plane) {
      drawPieces(ctx, vars, g, P, split);
    } else {
      drawWireframe(ctx, vars, g, P, cam, showExt);
    }
  }

  function drawWireframe(ctx, vars, g, P, cam, showExt) {
    const edges = solidEdges(CUBE);
    const faceOf = new Map();
    CUBE.faces.forEach((f, fi) => {
      for (let i = 0; i < f.length; i++) {
        const a = f[i];
        const b = f[(i + 1) % f.length];
        const k = a < b ? `${a},${b}` : `${b},${a}`;
        if (!faceOf.has(k)) faceOf.set(k, []);
        faceOf.get(k).push(fi);
      }
    });
    const front = CUBE.faces.map((f) => cam.facing(faceNormal(f.map((i) => CUBE.verts[i]))));

    const seg = (a, b, color, wdt, dash) => {
      const p = P(a);
      const q = P(b);
      ctx.strokeStyle = color;
      ctx.lineWidth = wdt;
      ctx.setLineDash(dash || []);
      ctx.beginPath();
      ctx.moveTo(p[0], p[1]);
      ctx.lineTo(q[0], q[1]);
      ctx.stroke();
      ctx.setLineDash([]);
    };

    // hidden edges first, so the visible ones sit on top of them
    for (const [i, j] of edges) {
      const k = i < j ? `${i},${j}` : `${j},${i}`;
      const visible = (faceOf.get(k) || []).some((fi) => front[fi]);
      if (visible) continue;
      if (hiddenToggle.checked) seg(CUBE.verts[i], CUBE.verts[j], vars["--gridline"], 1.4, [5, 4]);
    }

    // the cut, drawn up to the current construction step
    if (g.poly && g.poly.length >= 3) {
      const total = g.poly.length;
      const upto = Math.min(total, Number(stepSlider.value) >= total ? total : Number(stepSlider.value));

      if (showExt) {
        // brighter on the very step that needs them, so it is clear what they are for
        const nowRule = g.steps[upto - 1] ? g.steps[upto - 1].rule : 0;
        ctx.globalAlpha = nowRule === 3 ? 1 : 0.4;
        for (const e of g.ext) {
          seg(e.from, e.point, vars["--series-4"], 1.4, [3, 3]);
          const q = P(e.point);
          ctx.fillStyle = vars["--series-4"];
          ctx.beginPath();
          ctx.arc(q[0], q[1], 3.6, 0, TAU);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }

      if (upto >= total) {
        ctx.beginPath();
        g.poly.forEach((p, i) => {
          const q = P(p);
          if (i === 0) ctx.moveTo(q[0], q[1]);
          else ctx.lineTo(q[0], q[1]);
        });
        ctx.closePath();
        ctx.fillStyle = vars["--series-3"];
        ctx.globalAlpha = 0.34;
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = vars["--series-3"];
        ctx.lineWidth = 2.5;
        ctx.stroke();
      } else {
        for (let s = 0; s < upto; s++) {
          const st = g.steps[s];
          const a = g.poly[st.index];
          const b = g.poly[(st.index + 1) % total];
          const last = s === upto - 1;
          seg(a, b, last ? vars["--series-1"] : vars["--series-3"], last ? 3.5 : 2.5);
        }
      }
    }

    for (const [i, j] of edges) {
      const k = i < j ? `${i},${j}` : `${j},${i}`;
      const visible = (faceOf.get(k) || []).some((fi) => front[fi]);
      if (visible) seg(CUBE.verts[i], CUBE.verts[j], vars["--baseline"], 2);
    }

    ctx.font = SMALL_FONT;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    CUBE.verts.forEach((v, i) => {
      const q = P(labelSpot(v));
      ctx.fillStyle = vars["--muted"];
      ctx.fillText(CUBE.names[i], q[0], q[1]);
    });

    // the three given points last of all
    ctx.font = LABEL_FONT;
    g.given.forEach((p, i) => {
      const q = P(p);
      ctx.fillStyle = vars["--surface-1"];
      ctx.beginPath();
      ctx.arc(q[0], q[1], 8, 0, TAU);
      ctx.fill();
      ctx.fillStyle = vars["--series-2"];
      ctx.beginPath();
      ctx.arc(q[0], q[1], 5, 0, TAU);
      ctx.fill();
      ctx.textAlign = "left";
      ctx.textBaseline = "bottom";
      ctx.fillText(POINT_KEYS[i], q[0] + 9, q[1] - 6);
    });
  }

  function drawPieces(ctx, vars, g, P, split) {
    const off = scale(g.plane.n, split * 0.55);
    const halves = [
      { faces: piece(CUBE, g.plane, true), shift: off, color: vars["--series-1"] },
      { faces: piece(CUBE, g.plane, false), shift: scale(off, -1), color: vars["--series-2"] },
    ];
    const all = [];
    for (const h of halves) {
      for (const poly of h.faces) {
        const moved = poly.map((p) => add(p, h.shift));
        const pr = moved.map(P);
        all.push({ pr, depth: pr.reduce((s, q) => s + q[2], 0) / pr.length, color: h.color });
      }
    }
    all.sort((a, b) => a.depth - b.depth);
    for (const f of all) {
      ctx.beginPath();
      f.pr.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])));
      ctx.closePath();
      ctx.fillStyle = f.color;
      ctx.globalAlpha = 0.4;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = f.color;
      ctx.lineWidth = 1.6;
      ctx.stroke();
    }
  }

  /* -------------------------------------------------------------- render -- */

  function render() {
    const g = currentGeometry();
    for (let i = 0; i < 3; i++) tOuts[i].textContent = ratioLabel(pts[i].edge, pts[i].k);
    spinOut.textContent = `${spinSlider.value}°`;
    splitOut.textContent = `${Math.round(Number(splitSlider.value) * 100)}%`;

    if (!g.plane || !g.poly || g.poly.length < 3) {
      const { ctx, width, height } = setupCanvasDPR(canvas);
      ctx.clearRect(0, 0, width, height);
      draw({ ...g, poly: [] });
      note.textContent = "3点が一直線に並んでいるので、平面が決まりません。どれかの点を動かしてください。";
      stepList.innerHTML = "";
      statShape.textContent = "—";
      statArea.textContent = "—";
      statRatio.textContent = "—";
      return;
    }

    stepSlider.max = String(g.poly.length);
    const stepVal = Math.min(Number(stepSlider.value), g.poly.length);
    stepOut.textContent = stepVal >= g.poly.length ? "完成" : `${stepVal} 本目まで`;

    draw(g);

    const small = Math.min(g.vol.below, g.vol.above);
    const big = Math.max(g.vol.below, g.vol.above);
    statShape.textContent = shapeName(g.poly);
    statArea.textContent = `${g.area.toFixed(4)}（1辺 1 のとき）`;
    statRatio.textContent = ratioText(g.vol.below, g.vol.above);

    stepList.innerHTML = g.steps
      .map((s, i) => {
        const cls = i === stepVal - 1 ? ' class="step-key"' : "";
        const how =
          s.rule === 1
            ? `原則1 — 同じ面の上の2点なので、そのまま結べます`
            : s.rule === 2
            ? `原則2 — 向かい合う面なので、すでに引いた線と平行に引きます`
            : `原則3 — <strong>面を延長して、立方体の外に交点を作ってから</strong>引きます`;
        return `<li${cls}><code>${s.from} — ${s.to}（面 ${s.faceLabel}）</code><span class="step-note">${how}</span></li>`;
      })
      .join("");

    const usedExt = g.steps.filter((s) => s.rule === 3).length;
    rulesNote.textContent = usedExt
      ? `この切り方では ${usedExt} 本が延長法でしか引けません。立方体の外にできる交点は ${g.ext.length} 個で、` +
        `「延長線と交点を出す」にチェックを入れると橙色で表示されます。` +
        `外に出た点から立方体へ線を引き戻すのが延長法の正体です。`
      : `この切り方は原則1と原則2だけで引き切れます。延長法が必要な例を見るには、` +
        `上のプリセット「延長法が要る（五角形）」を選んでみてください。`;

    const shape = shapeName(g.poly);
    note.textContent =
      `切り口は${shape}（${g.poly.length}つの頂点）。立方体の面は6つなので、切り口の辺は最大でも6本 — ` +
      `だから七角形以上にはなりません。面積は 1辺を 1 として ${g.area.toFixed(4)}、` +
      `体積は ${g.vol.below.toFixed(4)} と ${g.vol.above.toFixed(4)} に分かれます` +
      (small > 1e-9 ? `（比は ${ratioText(g.vol.below, g.vol.above)}）` : "") +
      `。この2つを足すと ${(g.vol.below + g.vol.above).toFixed(6)} で、もとの立方体の体積 1 に戻ります。`;
  }

  /* ------------------------------------------------------------ controls -- */

  for (const el of [...edgeSel, ...tSliders]) {
    el.addEventListener("input", () => {
      showWholeSection();
      render();
    });
    el.addEventListener("change", render);
  }
  for (const el of [stepSlider, splitSlider, spinSlider]) el.addEventListener("input", render);
  extToggle.addEventListener("change", render);
  hiddenToggle.addEventListener("change", render);

  $("scTop").addEventListener("click", () => {
    elevation = (88 * Math.PI) / 180;
    spinSlider.value = "0";
    render();
  });
  $("scFront").addEventListener("click", () => {
    elevation = 0;
    spinSlider.value = "0";
    render();
  });
  $("scReset").addEventListener("click", () => {
    elevation = (28 * Math.PI) / 180;
    spinSlider.value = "35";
    render();
  });

  function stopPlay() {
    if (raf) cancelAnimationFrame(raf);
    raf = null;
    playBtn.textContent = "1本ずつ引く";
  }

  playBtn.addEventListener("click", () => {
    if (raf) {
      stopPlay();
      return;
    }
    const total = Number(stepSlider.max);
    let shown = 0;
    let last = performance.now();
    stepSlider.value = "0";
    playBtn.textContent = "止める";
    const tick = (now) => {
      if (now - last > 900) {
        shown++;
        last = now;
        stepSlider.value = String(shown);
        render();
        if (shown >= total) {
          stopPlay();
          return;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    render();
    raf = requestAnimationFrame(tick);
  });

  canvas.addEventListener("pointerdown", (evt) => {
    dragging = { x: evt.clientX, y: evt.clientY, az: Number(spinSlider.value), el: elevation };
    canvas.setPointerCapture(evt.pointerId);
    evt.preventDefault();
  });
  canvas.addEventListener("pointermove", (evt) => {
    if (!dragging) return;
    const dx = evt.clientX - dragging.x;
    const dy = evt.clientY - dragging.y;
    spinSlider.value = String((((dragging.az - dx * 0.4) % 360) + 360) % 360);
    elevation = Math.max(-0.25, Math.min(1.53, dragging.el + dy * 0.006));
    render();
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

  presetHost.innerHTML = PRESETS.map(
    (p, i) => `<button type="button" class="chip" data-i="${i}">${p.label}</button>`
  ).join("");
  presetHost.addEventListener("click", (evt) => {
    const btn = evt.target.closest("button[data-i]");
    if (!btn) return;
    const preset = PRESETS[Number(btn.dataset.i)];
    preset.v.forEach(([e, k], i) => {
      edgeSel[i].value = String(e);
      tSliders[i].value = String(k);
    });
    for (const b of presetHost.querySelectorAll("button")) {
      b.classList.toggle("chip-accent", b === btn);
    }
    stopPlay();
    showWholeSection();
    splitSlider.value = "0";
    render();
  });
  presetHost.querySelector("button").classList.add("chip-accent");

  const prism = initPrismPanel();

  return {
    show() {},
    hide() {
      stopPlay();
    },
    redraw() {
      render();
      prism.redraw();
    },
  };
}

/* ------------------------------------------- panel 3: the average-height rule -- */

const PRISM_KINDS = [
  {
    key: "square",
    label: "四角柱（底面は正方形）",
    base: [[0, 0], [1, 0], [1, 1], [0, 1]],
    corners: ["ア", "イ", "ウ", "エ"],
    free: 3,
    note:
      "四角柱では、4本の辺の長さを勝手には決められません。切り口は平面なので、" +
      "向かい合う2組の和が等しくなる必要があり、エは残りの3つから決まります（エ = ア − イ + ウ）。",
  },
  {
    key: "triangle",
    label: "三角柱",
    base: [[0, 0], [1, 0], [0.5, 0.87]],
    corners: ["ア", "イ", "ウ"],
    free: 3,
    note: "三角柱では3点がいつでも1つの平面を決めるので、3本の長さは自由に決められます。",
  },
];

function initPrismPanel() {
  const canvas = $("scPrism");
  const kindHost = $("scPrismKind");
  const rowHost = $("scPrismRows");
  const spin = $("scPrismSpin");
  const spinOut = $("scPrismSpinOut");
  const note = $("scPrismNote");
  const statMean = $("scPrismMean");
  const statFormula = $("scPrismFormula");
  const statActual = $("scPrismActual");

  let kind = PRISM_KINDS[0];
  let heights = [1.2, 0.6, 1.0];
  const H = 2.2;

  function buildRows() {
    rowHost.innerHTML = kind.corners
      .slice(0, kind.free)
      .map(
        (c, i) => `
      <div class="controls-row slider-row">
        <label class="field field-grow">
          <span>${c} の辺 = <output id="scPh${i}Out" class="mono">1.0</output></span>
          <input id="scPh${i}" type="range" min="0.3" max="1.9" step="0.1" value="${heights[i]}" />
        </label>
      </div>`
      )
      .join("");
    for (let i = 0; i < kind.free; i++) {
      $(`scPh${i}`).addEventListener("input", () => {
        heights[i] = Number($(`scPh${i}`).value);
        render();
      });
    }
  }

  /** All the edge lengths, including the one the plane forces on a quadrilateral. */
  function allHeights() {
    if (kind.key === "square") {
      const [a, b, c] = heights;
      return [a, b, c, a - b + c];
    }
    return heights.slice(0, 3);
  }

  function baseArea() {
    const b = kind.base;
    return Math.abs(
      b.reduce((s, [x, y], i) => {
        const [x2, y2] = b[(i + 1) % b.length];
        return s + (x * y2 - x2 * y);
      }, 0)
    ) / 2;
  }

  function draw(hs, ok) {
    const { ctx, width, height } = setupCanvasDPR(canvas);
    ctx.clearRect(0, 0, width, height);
    const vars = readVars(canvas.parentElement, [
      "--surface-1", "--muted", "--gridline", "--baseline",
      "--text-primary", "--text-secondary", "--series-1", "--series-2", "--series-3",
    ]);

    const solid = makePrism(kind.base, H);
    const az = (Number(spin.value) * Math.PI) / 180;
    const cam = makeCamera(az, (26 * Math.PI) / 180);
    const mid = centroid(solid.verts);
    const map = fitTo(solid.verts.map((p) => sub(p, mid)), cam, width, height, 40);
    const P = (p) => map(sub(p, mid));

    const n = kind.base.length;
    const top = kind.base.map(([x, y], i) => [x, y, hs[i]]);

    for (const [i, j] of solidEdges(solid)) {
      const a = P(solid.verts[i]);
      const b = P(solid.verts[j]);
      ctx.strokeStyle = vars["--gridline"];
      ctx.lineWidth = 1.3;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    if (ok) {
      // the piece that is left after the slanted cut
      for (let i = 0; i < n; i++) {
        const quad = [
          [kind.base[i][0], kind.base[i][1], 0],
          [kind.base[(i + 1) % n][0], kind.base[(i + 1) % n][1], 0],
          top[(i + 1) % n],
          top[i],
        ].map(P);
        ctx.beginPath();
        quad.forEach((q, k) => (k ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])));
        ctx.closePath();
        ctx.fillStyle = vars["--series-1"];
        ctx.globalAlpha = 0.22;
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = vars["--series-1"];
        ctx.lineWidth = 1.8;
        ctx.stroke();
      }
      ctx.beginPath();
      top.map(P).forEach((q, k) => (k ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])));
      ctx.closePath();
      ctx.fillStyle = vars["--series-3"];
      ctx.globalAlpha = 0.4;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = vars["--series-3"];
      ctx.lineWidth = 2.5;
      ctx.stroke();

      ctx.font = SMALL_FONT;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      top.forEach((t, i) => {
        const q = P(t);
        ctx.fillStyle = vars["--surface-1"];
        ctx.beginPath();
        ctx.arc(q[0], q[1], 13, 0, TAU);
        ctx.fill();
        ctx.fillStyle = vars["--text-primary"];
        ctx.fillText(hs[i].toFixed(1), q[0], q[1]);
      });
    }
  }

  function render() {
    spinOut.textContent = `${spin.value}°`;
    for (let i = 0; i < kind.free; i++) {
      const out = $(`scPh${i}Out`);
      if (out) out.textContent = heights[i].toFixed(1);
    }
    const hs = allHeights();
    const ok = hs.every((h) => h > 0.05 && h < H - 0.05);
    draw(hs, ok);

    const area = baseArea();
    const mean = hs.reduce((a, b) => a + b, 0) / hs.length;
    statMean.textContent = ok ? mean.toFixed(4) : "—";
    statFormula.textContent = ok ? (area * mean).toFixed(4) : "—";

    if (!ok) {
      statActual.textContent = "—";
      note.textContent =
        "この組み合わせでは、決まってしまう辺の長さが角柱の外に出てしまいます（0 より短いか、高さを超えています）。" +
        "スライダーを戻してください。";
      return;
    }

    const solid = makePrism(kind.base, H);
    const top = kind.base.map(([x, y], i) => [x, y, hs[i]]);
    const plane = planeThrough(top[0], top[1], top[2]);
    const actual = splitVolume(solid, plane).below;
    statActual.textContent = actual.toFixed(4);

    const label = kind.corners.map((c, i) => `${c} ${hs[i].toFixed(1)}`).join("、");
    note.textContent =
      `${label}。平均は (${hs.map((h) => h.toFixed(1)).join(" + ")}) ÷ ${hs.length} = ${mean.toFixed(4)}。` +
      `底面積 ${area.toFixed(4)} を掛けて ${(area * mean).toFixed(4)} —— ` +
      `実際にこの平面で切って求めた体積は ${actual.toFixed(4)} で、ぴったり同じです。` +
      `${kind.note} 平均が使えるのは、切り口が平面だからです。斜めに切った角柱は、` +
      `同じものをもう1つ逆さにして重ねると「平均の高さの角柱」2つぶんになる、と考えても同じ答えになります。`;
  }

  kindHost.innerHTML = PRISM_KINDS.map(
    (k) => `<button type="button" class="chip" data-key="${k.key}">${k.label}</button>`
  ).join("");
  kindHost.addEventListener("click", (evt) => {
    const btn = evt.target.closest("button[data-key]");
    if (!btn) return;
    kind = PRISM_KINDS.find((k) => k.key === btn.dataset.key) || PRISM_KINDS[0];
    heights = kind.key === "square" ? [1.2, 0.6, 1.0] : [0.6, 1.3, 1.8];
    for (const b of kindHost.querySelectorAll("button")) {
      b.classList.toggle("chip-accent", b === btn);
    }
    buildRows();
    render();
  });
  kindHost.querySelector("button").classList.add("chip-accent");

  spin.addEventListener("input", render);
  buildRows();

  return { redraw: render };
}
