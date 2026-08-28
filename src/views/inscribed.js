import { readVars, setupCanvasDPR } from "../chart.js";

const $ = (id) => document.getElementById(id);
const TAU = Math.PI * 2;
const LABEL_FONT = "13px system-ui, -apple-system, 'Segoe UI', sans-serif";

/** Signed angle at vertex v between rays to a and b, in degrees, 0..180. */
function angleAt(v, a, b) {
  const a1 = Math.atan2(a.y - v.y, a.x - v.x);
  const a2 = Math.atan2(b.y - v.y, b.x - v.x);
  let d = Math.abs(a1 - a2);
  if (d > Math.PI) d = TAU - d;
  return (d * 180) / Math.PI;
}

/** Is p on the arc AB that does NOT contain the reference side? */
function sameSide(a, b, p) {
  // sign of the cross product of AB with AP
  return (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x) > 0;
}

export function initInscribedView() {
  const canvas = $("icCanvas");
  const traceToggle = $("icTrace");
  const quadToggle = $("icQuad");
  const diameterBtn = $("icDiameter");
  const resetBtn = $("icReset");
  const statInscribed = $("icInscribed");
  const statCentral = $("icCentral");
  const statRatio = $("icRatio");
  const statNote = $("icNote");

  // angles in radians around the circle
  const START = { a: Math.PI * 0.82, b: Math.PI * 0.18, p: -Math.PI * 0.5, q: Math.PI * 0.5 };
  let ang = { ...START };
  let dragging = null;
  let geom = null;
  const ghosts = [];

  function pointAt(t) {
    if (!geom) return { x: 0, y: 0 };
    return { x: geom.cx + Math.cos(t) * geom.r, y: geom.cy + Math.sin(t) * geom.r };
  }

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
      "--series-4",
    ]);

    const cx = width / 2;
    const cy = height / 2;
    const r = Math.min(width, height) / 2 - 42;
    if (r <= 0) return;
    geom = { cx, cy, r };

    const A = pointAt(ang.a);
    const B = pointAt(ang.b);
    const P = pointAt(ang.p);
    const Q = pointAt(ang.q);
    const O = { x: cx, y: cy };

    // circle
    ctx.strokeStyle = vars["--gridline"];
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, TAU);
    ctx.stroke();

    // ghost trail of earlier P positions, all subtending the same angle
    if (traceToggle.checked) {
      ctx.lineWidth = 1;
      for (const g of ghosts) {
        const G = pointAt(g);
        ctx.strokeStyle = vars["--series-1"];
        ctx.globalAlpha = 0.22;
        ctx.beginPath();
        ctx.moveTo(A.x, A.y);
        ctx.lineTo(G.x, G.y);
        ctx.lineTo(B.x, B.y);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }

    // chord AB
    ctx.strokeStyle = vars["--baseline"];
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(A.x, A.y);
    ctx.lineTo(B.x, B.y);
    ctx.stroke();

    // central angle AOB
    ctx.strokeStyle = vars["--series-2"];
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(A.x, A.y);
    ctx.lineTo(O.x, O.y);
    ctx.lineTo(B.x, B.y);
    ctx.stroke();

    // inscribed angle APB
    ctx.strokeStyle = vars["--series-1"];
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(A.x, A.y);
    ctx.lineTo(P.x, P.y);
    ctx.lineTo(B.x, B.y);
    ctx.stroke();

    if (quadToggle.checked) {
      ctx.strokeStyle = vars["--series-3"];
      ctx.beginPath();
      ctx.moveTo(A.x, A.y);
      ctx.lineTo(Q.x, Q.y);
      ctx.lineTo(B.x, B.y);
      ctx.stroke();
    }

    const dot = (pt, color, label) => {
      ctx.fillStyle = vars["--surface-1"];
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 8, 0, TAU);
      ctx.fill();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 5.5, 0, TAU);
      ctx.fill();
      if (label) {
        const ox = pt.x - cx;
        const oy = pt.y - cy;
        const n = Math.hypot(ox, oy) || 1;
        ctx.fillStyle = vars["--text-primary"];
        ctx.font = LABEL_FONT;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(label, pt.x + (ox / n) * 20, pt.y + (oy / n) * 20);
      }
    };

    dot(O, vars["--series-2"], "O");
    dot(A, vars["--muted"], "A");
    dot(B, vars["--muted"], "B");
    dot(P, vars["--series-1"], "P");
    if (quadToggle.checked) dot(Q, vars["--series-3"], "Q");

    updateStats(A, B, P, Q, O);
  }

  function updateStats(A, B, P, Q, O) {
    const inscribed = angleAt(P, A, B);
    // The central angle is the reflex-aware one: it is twice the inscribed
    // angle, which can exceed 180 degrees when P sits on the minor arc.
    let central = angleAt(O, A, B);
    if (inscribed > 90.0001) central = 360 - central;

    statInscribed.textContent = `${inscribed.toFixed(2)}°`;
    statCentral.textContent = `${central.toFixed(2)}°`;
    statRatio.textContent = (central / (inscribed || 1)).toFixed(4);

    if (quadToggle.checked) {
      const other = angleAt(Q, A, B);
      const onOppositeArcs = sameSide(A, B, P) !== sameSide(A, B, Q);
      statNote.textContent = onOppositeArcs
        ? `P と Q は AB の反対側の弧にあります。∠APB + ∠AQB = ${(inscribed + other).toFixed(2)}° — 円に内接する四角形の対角の和は 180°。`
        : `P と Q が同じ弧の上にあります。∠APB = ${inscribed.toFixed(2)}°、∠AQB = ${other.toFixed(2)}° — 同じ弧の円周角は等しい。Q を反対側へ動かすと 180° の関係になります。`;
    } else if (Math.abs(inscribed - 90) < 0.5) {
      statNote.textContent = "AB が直径なので円周角は 90°（タレスの定理）。直径を見込む角はつねに直角です。";
    } else {
      statNote.textContent =
        "P を円周上でドラッグしても ∠APB は変わりません。中心角 ∠AOB はつねにその 2 倍です。A・B も動かせます。";
    }
  }

  /* ------------------------------------------------------------ dragging -- */

  function localPos(evt) {
    const rect = canvas.getBoundingClientRect();
    return { x: evt.clientX - rect.left, y: evt.clientY - rect.top };
  }

  function nearestHandle(pos) {
    if (!geom) return null;
    const handles = [["a", ang.a], ["b", ang.b], ["p", ang.p]];
    if (quadToggle.checked) handles.push(["q", ang.q]);
    let best = null;
    let bestD = 24; // generous hit radius, fingers included
    for (const [key, t] of handles) {
      const pt = pointAt(t);
      const d = Math.hypot(pt.x - pos.x, pt.y - pos.y);
      if (d < bestD) {
        bestD = d;
        best = key;
      }
    }
    return best;
  }

  canvas.addEventListener("pointerdown", (evt) => {
    const pos = localPos(evt);
    const handle = nearestHandle(pos);
    if (!handle) return;
    dragging = handle;
    canvas.setPointerCapture(evt.pointerId);
    evt.preventDefault();
  });

  canvas.addEventListener("pointermove", (evt) => {
    if (!dragging || !geom) return;
    const pos = localPos(evt);
    const t = Math.atan2(pos.y - geom.cy, pos.x - geom.cx);
    if (dragging === "p" && traceToggle.checked) {
      ghosts.push(ang.p);
      if (ghosts.length > 14) ghosts.shift();
    }
    ang[dragging] = t;
    draw();
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

  /* ----------------------------------------------------------- controls -- */

  traceToggle.addEventListener("change", () => {
    ghosts.length = 0;
    draw();
  });
  quadToggle.addEventListener("change", draw);

  diameterBtn.addEventListener("click", () => {
    // put B diametrically opposite A, keeping P clear of both
    ang.b = ang.a + Math.PI;
    ang.p = ang.a + Math.PI * 1.5;
    ghosts.length = 0;
    draw();
  });

  resetBtn.addEventListener("click", () => {
    ang = { ...START };
    ghosts.length = 0;
    draw();
  });

  return {
    show() {},
    redraw() {
      draw();
    },
  };
}
