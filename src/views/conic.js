import { readVars, setupCanvasDPR } from "../chart.js";
import {
  coneK, planeM, classify, criticalTilt, conicParams, sectionCurve3D,
  sectionCurvePlane, focalMeasure, KIND_LABEL, CONIC_PRESETS,
} from "../conic.js";

const $ = (id) => document.getElementById(id);
const TAU = Math.PI * 2;
const SMALL_FONT = "11px system-ui, -apple-system, 'Segoe UI', sans-serif";
const LABEL_FONT = "13px system-ui, -apple-system, 'Segoe UI', sans-serif";
const Z_LIMIT = 1.9;

function makeCamera(az, el) {
  const ce = Math.cos(el);
  const se = Math.sin(el);
  return (p) => {
    const c = Math.cos(az);
    const s = Math.sin(az);
    const x = p[0] * c - p[1] * s;
    const y = p[0] * s + p[1] * c;
    return { x, y: -(y * se + p[2] * ce), depth: -y * ce + p[2] * se };
  };
}

function fitter(points, project, width, height, pad) {
  let lo = [Infinity, Infinity];
  let hi = [-Infinity, -Infinity];
  for (const p of points) {
    const q = project(p);
    lo[0] = Math.min(lo[0], q.x);
    hi[0] = Math.max(hi[0], q.x);
    lo[1] = Math.min(lo[1], q.y);
    hi[1] = Math.max(hi[1], q.y);
  }
  const w = hi[0] - lo[0] || 1;
  const h = hi[1] - lo[1] || 1;
  const scale = Math.min((width - pad * 2) / w, (height - pad * 2) / h);
  const ox = width / 2 - ((lo[0] + hi[0]) / 2) * scale;
  const oy = height / 2 - ((lo[1] + hi[1]) / 2) * scale;
  return (p) => {
    const q = project(p);
    return [ox + q.x * scale, oy + q.y * scale];
  };
}

export function initConicView() {
  /* ------------------------------------------------------ panel 1: the cone -- */
  const canvas = $("cnCone");
  const presetHost = $("cnPresets");
  const psi = $("cnPsi");
  const alpha = $("cnAlpha");
  const heightS = $("cnHeight");
  const spin = $("cnSpin");
  const psiOut = $("cnPsiOut");
  const alphaOut = $("cnAlphaOut");
  const heightOut = $("cnHeightOut");
  const spinOut = $("cnSpinOut");
  const sweepBtn = $("cnSweep");
  const showPlane = $("cnShowPlane");
  const showGen = $("cnShowGen");
  const note = $("cnNote");
  const ruleNote = $("cnRule");
  const statKind = $("cnKind");
  const statCrit = $("cnCrit");
  const statEcc = $("cnEcc");

  let elevation = (22 * Math.PI) / 180;
  let dragging = null;
  let raf = null;
  let presetNote = CONIC_PRESETS[1].note;

  const state = () => {
    const a = Number(alpha.value);
    const p = Number(psi.value);
    return { alphaDeg: a, psiDeg: p, k: coneK(a), m: planeM(p), c: Number(heightS.value) };
  };

  function drawCone() {
    const { ctx, width, height } = setupCanvasDPR(canvas);
    ctx.clearRect(0, 0, width, height);
    const vars = readVars(canvas.parentElement, [
      "--surface-1", "--muted", "--gridline", "--baseline",
      "--text-primary", "--text-secondary", "--series-1", "--series-2", "--series-3", "--series-4",
    ]);
    const { k, m, c } = state();
    const project = makeCamera((Number(spin.value) * Math.PI) / 180, elevation);

    const rim = (z) => {
      const r = k * Math.abs(z);
      return Array.from({ length: 65 }, (_, i) => {
        const t = (TAU * i) / 64;
        return [r * Math.cos(t), r * Math.sin(t), z];
      });
    };
    const gather = [...rim(Z_LIMIT), ...rim(-Z_LIMIT), [0, 0, 0]];
    const map = fitter(gather, project, width, height, 30);

    const stroke = (pts, color, wdt, dash) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = wdt;
      ctx.setLineDash(dash || []);
      ctx.beginPath();
      pts.forEach((p, i) => {
        const q = map(p);
        if (i === 0) ctx.moveTo(q[0], q[1]);
        else ctx.lineTo(q[0], q[1]);
      });
      ctx.stroke();
      ctx.setLineDash([]);
    };

    for (const z of [Z_LIMIT, -Z_LIMIT, Z_LIMIT / 2, -Z_LIMIT / 2]) {
      stroke(rim(z), vars["--gridline"], Math.abs(z) === Z_LIMIT ? 1.8 : 1);
    }
    if (showGen.checked) {
      for (let i = 0; i < 24; i++) {
        const t = (TAU * i) / 24;
        const r = k * Z_LIMIT;
        stroke(
          [[-r * Math.cos(t), -r * Math.sin(t), -Z_LIMIT], [0, 0, 0], [r * Math.cos(t), r * Math.sin(t), Z_LIMIT]],
          vars["--gridline"],
          1
        );
      }
    }
    // the axis, and one generator picked out so "parallel to the side" is visible
    stroke([[0, 0, -Z_LIMIT], [0, 0, Z_LIMIT]], vars["--baseline"], 1.5, [5, 4]);
    stroke([[0, 0, 0], [k * Z_LIMIT, 0, Z_LIMIT]], vars["--series-4"], 2.5);

    if (showPlane.checked) {
      // keep the sheet inside the drawn part of the cone: an unclipped plane
      // at a steep tilt is metres tall and swamps the picture
      const R = k * Z_LIMIT * 1.35;
      const xr = Math.abs(m) < 1e-9
        ? [-R, R]
        : [(-Z_LIMIT - c) / m, (Z_LIMIT - c) / m].sort((p, q) => p - q).map((x) => Math.max(-R, Math.min(R, x)));
      const quad = [[xr[0], -R], [xr[1], -R], [xr[1], R], [xr[0], R]].map(([x, y]) => [x, y, m * x + c]);
      ctx.beginPath();
      quad.forEach((p, i) => {
        const q = map(p);
        if (i === 0) ctx.moveTo(q[0], q[1]);
        else ctx.lineTo(q[0], q[1]);
      });
      ctx.closePath();
      ctx.fillStyle = vars["--series-2"];
      ctx.globalAlpha = 0.16;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = vars["--series-2"];
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    for (const branch of sectionCurve3D(k, m, c, Z_LIMIT, 420)) {
      stroke(branch, vars["--series-1"], 3.5);
    }

    ctx.fillStyle = vars["--muted"];
    ctx.font = SMALL_FONT;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("橙の太線が円錐の側面（母線）", 6, 6);
  }

  function renderCone() {
    const { alphaDeg, psiDeg, k, m, c } = state();
    psiOut.textContent = `${psiDeg}°`;
    alphaOut.textContent = `${alphaDeg}°`;
    heightOut.textContent = Number(heightS.value).toFixed(2);
    spinOut.textContent = `${spin.value}°`;
    drawCone();

    const kind = classify(alphaDeg, psiDeg);
    const crit = criticalTilt(alphaDeg);
    const params = conicParams(k, m, c);
    statKind.textContent = KIND_LABEL[kind];
    statCrit.textContent = `${crit}°`;
    statEcc.textContent = params.eccentricity.toFixed(4);

    const rel =
      Math.abs(psiDeg - crit) < 0.5
        ? "ちょうど同じ"
        : psiDeg < crit
        ? `${(crit - psiDeg).toFixed(0)}° ゆるい`
        : `${(psiDeg - crit).toFixed(0)}° 急`;
    note.innerHTML = presetNote;
    ruleNote.textContent =
      `いま円錐の側面は水平から ${crit}° 傾いていて、切る平面は ${psiDeg}° —— 側面より ${rel}。だから${KIND_LABEL[kind]}です。` +
      `離心率は ${params.eccentricity.toFixed(4)}（楕円なら 1 未満、放物線はちょうど 1、双曲線は 1 より大きい）。` +
      `これは sin ψ ÷ cos α に等しく、円錐の形と切る角度だけで決まります —— 切る高さを変えても大きさが変わるだけで、種類は変わりません。`;
  }

  function stopSweep() {
    if (raf) cancelAnimationFrame(raf);
    raf = null;
    sweepBtn.textContent = "傾きを 0° から上げる";
  }

  sweepBtn.addEventListener("click", () => {
    if (raf) {
      stopSweep();
      return;
    }
    const start = performance.now();
    const to = 82;
    sweepBtn.textContent = "止める";
    presetNote = "傾きを上げていくと、円 → 楕円 → 放物線 → 双曲線 と切り口が移り変わります。";
    const step = (now) => {
      const t = Math.min(1, (now - start) / 7000);
      psi.value = String(Math.round(to * t));
      renderCone();
      renderFace();
      if (t < 1) raf = requestAnimationFrame(step);
      else stopSweep();
    };
    raf = requestAnimationFrame(step);
  });

  for (const el of [psi, alpha, heightS]) {
    el.addEventListener("input", () => {
      stopSweep();
      renderCone();
      renderFace();
    });
  }
  spin.addEventListener("input", renderCone);
  showPlane.addEventListener("change", renderCone);
  showGen.addEventListener("change", renderCone);

  canvas.addEventListener("pointerdown", (evt) => {
    dragging = { x: evt.clientX, y: evt.clientY, az: Number(spin.value), el: elevation };
    canvas.setPointerCapture(evt.pointerId);
    evt.preventDefault();
  });
  canvas.addEventListener("pointermove", (evt) => {
    if (!dragging) return;
    spin.value = String((((dragging.az - (evt.clientX - dragging.x) * 0.4) % 360) + 360) % 360);
    elevation = Math.max(-0.5, Math.min(1.35, dragging.el + (evt.clientY - dragging.y) * 0.006));
    renderCone();
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

  presetHost.innerHTML = CONIC_PRESETS.map(
    (p) => `<button type="button" class="chip" data-key="${p.key}">${p.label}</button>`
  ).join("");
  presetHost.addEventListener("click", (evt) => {
    const btn = evt.target.closest("button[data-key]");
    if (!btn) return;
    const p = CONIC_PRESETS.find((q) => q.key === btn.dataset.key);
    alpha.value = String(p.alpha);
    psi.value = String(p.psi);
    heightS.value = "1";
    presetNote = p.note;
    for (const b of presetHost.querySelectorAll("button")) b.classList.toggle("chip-accent", b === btn);
    stopSweep();
    renderCone();
    renderFace();
  });
  presetHost.querySelectorAll("button")[1].classList.add("chip-accent");

  /* --------------------------------------------- panel 2: the true shape -- */
  const faceCanvas = $("cnFace");
  const pSlider = $("cnP");
  const pOut = $("cnPOut");
  const pPlay = $("cnPPlay");
  const faceNote = $("cnFaceNote");
  const measureLabel = $("cnMeasureLabel");
  const statMeasure = $("cnMeasure");
  const statConst = $("cnConst");
  const statGap = $("cnGap");
  let raf2 = null;

  /** All sampled points of the section, flattened so one slider walks them. */
  function facePoints() {
    const { k, m, c } = state();
    const branches = sectionCurvePlane(k, m, c, Z_LIMIT, 360);
    return { branches, flat: branches.flat() };
  }

  function drawFace(params, branches, P) {
    const { ctx, width, height } = setupCanvasDPR(faceCanvas);
    ctx.clearRect(0, 0, width, height);
    const vars = readVars(faceCanvas.parentElement, [
      "--surface-1", "--muted", "--gridline", "--baseline",
      "--text-primary", "--text-secondary", "--series-1", "--series-2", "--series-3", "--series-4",
    ]);

    const pts = branches.flat();
    if (!pts.length) return;
    const marks = params.kind === "parabola" ? [params.focus] : params.foci;
    const all = [...pts, ...marks];
    let lo = [Infinity, Infinity];
    let hi = [-Infinity, -Infinity];
    for (const p of all) {
      lo[0] = Math.min(lo[0], p[0]);
      hi[0] = Math.max(hi[0], p[0]);
      lo[1] = Math.min(lo[1], p[1]);
      hi[1] = Math.max(hi[1], p[1]);
    }
    const pad = 34;
    const scale = Math.min((width - pad * 2) / (hi[0] - lo[0] || 1), (height - pad * 2) / (hi[1] - lo[1] || 1));
    const ox = width / 2 - ((lo[0] + hi[0]) / 2) * scale;
    const oy = height / 2 + ((lo[1] + hi[1]) / 2) * scale;
    const map = ([u, v]) => [ox + u * scale, oy - v * scale];

    ctx.strokeStyle = vars["--gridline"];
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, oy);
    ctx.lineTo(width, oy);
    ctx.stroke();

    if (params.kind === "parabola") {
      const x = map([params.directrixU, 0])[0];
      ctx.strokeStyle = vars["--series-4"];
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = vars["--series-4"];
      ctx.font = SMALL_FONT;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText("準線", x + 5, 6);
    }

    for (const br of branches) {
      ctx.strokeStyle = vars["--series-1"];
      ctx.lineWidth = 3;
      ctx.lineJoin = "round";
      ctx.beginPath();
      br.forEach((p, i) => {
        const q = map(p);
        if (i === 0) ctx.moveTo(q[0], q[1]);
        else ctx.lineTo(q[0], q[1]);
      });
      ctx.stroke();
    }

    if (P) {
      for (const f of marks) {
        const a = map(P);
        const b = map(f);
        ctx.strokeStyle = vars["--series-3"];
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(a[0], a[1]);
        ctx.lineTo(b[0], b[1]);
        ctx.stroke();
      }
      if (params.kind === "parabola") {
        const a = map(P);
        const b = map([params.directrixU, P[1]]);
        ctx.strokeStyle = vars["--series-4"];
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(a[0], a[1]);
        ctx.lineTo(b[0], b[1]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    ctx.font = LABEL_FONT;
    for (const f of marks) {
      const q = map(f);
      ctx.fillStyle = vars["--surface-1"];
      ctx.beginPath();
      ctx.arc(q[0], q[1], 8, 0, TAU);
      ctx.fill();
      ctx.fillStyle = vars["--series-2"];
      ctx.beginPath();
      ctx.arc(q[0], q[1], 5, 0, TAU);
      ctx.fill();
    }
    if (marks.length) {
      const q = map(marks[0]);
      ctx.fillStyle = vars["--series-2"];
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillText("焦点", q[0], q[1] - 10);
    }
    if (P) {
      const q = map(P);
      ctx.fillStyle = vars["--surface-1"];
      ctx.beginPath();
      ctx.arc(q[0], q[1], 9, 0, TAU);
      ctx.fill();
      ctx.fillStyle = vars["--series-3"];
      ctx.beginPath();
      ctx.arc(q[0], q[1], 5.5, 0, TAU);
      ctx.fill();
      ctx.textAlign = "left";
      ctx.textBaseline = "bottom";
      ctx.fillText("P", q[0] + 10, q[1] - 7);
    }
  }

  function renderFace() {
    const { k, m, c, alphaDeg, psiDeg } = state();
    const params = conicParams(k, m, c);
    const { branches, flat } = facePoints();
    const frac = Number(pSlider.value);
    pOut.textContent = `${Math.round(frac * 100)}%`;
    const P = flat.length ? flat[Math.min(flat.length - 1, Math.round(frac * (flat.length - 1)))] : null;
    drawFace(params, branches, P);

    if (!P) {
      statMeasure.textContent = "—";
      statConst.textContent = "—";
      statGap.textContent = "—";
      faceNote.textContent = "この切り方では、表示している範囲に切り口が出てきません。切る高さや傾きを変えてください。";
      return;
    }

    const fm = focalMeasure(params, P);
    measureLabel.textContent = params.kind === "parabola" ? "焦点までの距離" : fm.label;
    statMeasure.textContent = fm.value.toFixed(6);
    statConst.textContent = params.kind === "parabola" ? `準線まで ${fm.other.toFixed(6)}` : fm.other.toFixed(6);
    statGap.textContent = Math.abs(fm.value - fm.other).toExponential(2);

    const kindName = KIND_LABEL[params.kind];
    faceNote.textContent =
      params.kind === "parabola"
        ? `放物線は「焦点までの距離」と「準線までの距離」が等しい点の集まり。P をどこへ動かしても、` +
          `${fm.value.toFixed(6)} と ${fm.other.toFixed(6)} が一致したままです（差 ${Math.abs(fm.value - fm.other).toExponential(2)}）。` +
          `これは焦点の定義から作った曲線ではなく、円錐を切って出てきた点の座標から測った値です。`
        : params.kind === "hyperbola"
        ? `双曲線は「2つの焦点までの距離の差」が一定の点の集まり。いま差は ${fm.value.toFixed(6)}、` +
          `理論値は 2a = ${fm.other.toFixed(6)}（ずれ ${Math.abs(fm.value - fm.other).toExponential(2)}）。` +
          `P を反対側の枝に移しても同じ値になります。`
        : `${kindName}は「2つの焦点までの距離の和」が一定の点の集まり。いま和は ${fm.value.toFixed(6)}、` +
          `長軸の 2 倍 2a = ${fm.other.toFixed(6)} と一致しています（ずれ ${Math.abs(fm.value - fm.other).toExponential(2)}）。` +
          (params.kind === "circle"
            ? " 円では2つの焦点が中心の1点に重なるので、これは「中心からの距離が一定」そのものです。"
            : " 円錐を切っただけなのに焦点の性質が出てくる —— この2つが同じものだという証拠です。");
  }

  function stopP() {
    if (raf2) cancelAnimationFrame(raf2);
    raf2 = null;
    pPlay.textContent = "P を動かす";
  }

  pPlay.addEventListener("click", () => {
    if (raf2) {
      stopP();
      return;
    }
    const from = Number(pSlider.value) >= 0.999 ? 0 : Number(pSlider.value);
    const start = performance.now();
    pPlay.textContent = "止める";
    const step = (now) => {
      const t = Math.min(1, (now - start) / 5200);
      pSlider.value = String(from + (1 - from) * t);
      renderFace();
      if (t < 1) raf2 = requestAnimationFrame(step);
      else stopP();
    };
    raf2 = requestAnimationFrame(step);
  });

  pSlider.addEventListener("input", () => {
    stopP();
    renderFace();
  });

  return {
    show() {},
    hide() {
      stopSweep();
      stopP();
    },
    redraw() {
      renderCone();
      renderFace();
    },
  };
}
