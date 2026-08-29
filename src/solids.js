/**
 * Nets that fold into solids.
 *
 * A net is a tree of faces: the root lies flat, and every other face hangs
 * off a parent by a hinge — a segment of the flat net that the face swings
 * about. Folding face F means rotating it about its own hinge, then about
 * its parent's hinge, then the grandparent's, and so on outwards. Doing the
 * innermost rotation first is what makes this correct: each outer hinge is
 * still sitting at its flat position at the moment its rotation is applied.
 *
 * The fold direction is not stored per face. A face folds up, away from the
 * table, and which sign of rotation achieves that follows from which side of
 * the hinge the face lies on — so `signedAngle` derives it and the net data
 * only has to say how far to fold.
 */

const SQ3 = Math.sqrt(3);

/* --------------------------------------------------------------- geometry -- */

function sub(p, q) {
  return [p[0] - q[0], p[1] - q[1], p[2] - q[2]];
}
function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
function norm(a) {
  return Math.hypot(a[0], a[1], a[2]);
}

/** Rotate p about the line through `at` with unit direction `u`, by θ. */
function rotateAbout(p, at, u, theta) {
  const v = sub(p, at);
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  const k = cross(u, v);
  const d = dot(u, v) * (1 - c);
  return [
    at[0] + v[0] * c + k[0] * s + u[0] * d,
    at[1] + v[1] * c + k[1] * s + u[1] * d,
    at[2] + v[2] * c + k[2] * s + u[2] * d,
  ];
}

function centroid2(poly) {
  let x = 0;
  let y = 0;
  for (const p of poly) {
    x += p[0];
    y += p[1];
  }
  return [x / poly.length, y / poly.length];
}

/**
 * The rotation that lifts this face off the table rather than pushing it
 * through: positive when the face sits to the left of the hinge direction.
 */
function signedAngle(face) {
  const [h0, h1] = face.hinge;
  const ux = h1[0] - h0[0];
  const uy = h1[1] - h0[1];
  const c = centroid2(face.poly);
  const crossZ = ux * (c[1] - h0[1]) - uy * (c[0] - h0[0]);
  return crossZ >= 0 ? face.fold : -face.fold;
}

/* ------------------------------------------------------------------- nets -- */

/** Square with an outward equilateral / isoceles flap on one edge. */
function flap(p, q, height) {
  const mx = (p[0] + q[0]) / 2;
  const my = (p[1] + q[1]) / 2;
  const dx = q[0] - p[0];
  const dy = q[1] - p[1];
  const len = Math.hypot(dx, dy);
  // outward normal: the net is laid out so "outward" is away from the origin-side
  return [mx, my, dx / len, dy / len, height];
}

function boxNet(w, d, h) {
  return [
    { poly: [[0, 0], [w, 0], [w, d], [0, d]], parent: null, label: "底" },
    { poly: [[0, 0], [w, 0], [w, -h], [0, -h]], parent: 0, hinge: [[0, 0], [w, 0]], fold: Math.PI / 2 },
    { poly: [[w, 0], [w + h, 0], [w + h, d], [w, d]], parent: 0, hinge: [[w, 0], [w, d]], fold: Math.PI / 2 },
    { poly: [[0, d], [w, d], [w, d + h], [0, d + h]], parent: 0, hinge: [[0, d], [w, d]], fold: Math.PI / 2 },
    { poly: [[0, 0], [-h, 0], [-h, d], [0, d]], parent: 0, hinge: [[0, 0], [0, d]], fold: Math.PI / 2 },
    {
      poly: [[0, d + h], [w, d + h], [w, d + h + d], [0, d + h + d]],
      parent: 3,
      hinge: [[0, d + h], [w, d + h]],
      fold: Math.PI / 2,
      label: "ふた",
    },
  ];
}

function prismNet(s, L) {
  const h = (SQ3 / 2) * s;
  return [
    { poly: [[0, 0], [L, 0], [L, s], [0, s]], parent: null, label: "底" },
    { poly: [[0, s], [L, s], [L, 2 * s], [0, 2 * s]], parent: 0, hinge: [[0, s], [L, s]], fold: (2 * Math.PI) / 3 },
    { poly: [[0, 0], [L, 0], [L, -s], [0, -s]], parent: 0, hinge: [[0, 0], [L, 0]], fold: (2 * Math.PI) / 3 },
    { poly: [[0, 0], [0, s], [-h, s / 2]], parent: 0, hinge: [[0, 0], [0, s]], fold: Math.PI / 2 },
    { poly: [[L, 0], [L, s], [L + h, s / 2]], parent: 0, hinge: [[L, 0], [L, s]], fold: Math.PI / 2 },
  ];
}

function tetraNet(s) {
  const A = [0, 0];
  const B = [s, 0];
  const C = [s / 2, (SQ3 / 2) * s];
  const outer = (p, q, r) => [p[0] + q[0] - r[0], p[1] + q[1] - r[1]];
  const fold = Math.acos(-1 / 3);
  return [
    { poly: [A, B, C], parent: null, label: "底" },
    { poly: [A, B, outer(A, B, C)], parent: 0, hinge: [A, B], fold },
    { poly: [B, C, outer(B, C, A)], parent: 0, hinge: [B, C], fold },
    { poly: [C, A, outer(C, A, B)], parent: 0, hinge: [C, A], fold },
  ];
}

function pyramidNet(s) {
  const h = (SQ3 / 2) * s;
  const fold = Math.acos(-1 / SQ3);
  return [
    { poly: [[0, 0], [s, 0], [s, s], [0, s]], parent: null, label: "底" },
    { poly: [[0, 0], [s, 0], [s / 2, -h]], parent: 0, hinge: [[0, 0], [s, 0]], fold },
    { poly: [[s, 0], [s, s], [s + h, s / 2]], parent: 0, hinge: [[s, 0], [s, s]], fold },
    { poly: [[0, s], [s, s], [s / 2, s + h]], parent: 0, hinge: [[0, s], [s, s]], fold },
    { poly: [[0, 0], [0, s], [-h, s / 2]], parent: 0, hinge: [[0, 0], [0, s]], fold },
  ];
}

export const SOLIDS = [
  {
    key: "cube",
    label: "立方体",
    faces: boxNet(1, 1, 1),
    counts: { v: 8, e: 12, f: 6 },
    note: "十字型の展開図。まわりの4面が立ち上がり、いちばん外の面がふたになります。立方体の展開図は全部で11種類あります。",
  },
  {
    key: "box",
    label: "直方体",
    faces: boxNet(1.5, 1, 0.7),
    counts: { v: 8, e: 12, f: 6 },
    note: "同じ十字型でも、たて・よこ・高さが違うと展開図の形も変わります。向かい合う面が同じ形になっていることを確かめてください。",
  },
  {
    key: "prism",
    label: "三角柱",
    faces: prismNet(1, 1.6),
    counts: { v: 6, e: 9, f: 5 },
    note: "3枚の長方形が輪になり、両端に三角形のふたが付きます。長方形の帯の長さは三角形のまわりの長さと同じです。",
  },
  {
    key: "tetra",
    label: "正四面体",
    faces: tetraNet(1.3),
    counts: { v: 4, e: 6, f: 4 },
    note: "大きな正三角形を4つに分けた形。まわりの3枚が起き上がると、3つの頂点が1点で出会います。折り上げる角度は arccos(−1/3) ≒ 109.47°。",
  },
  {
    key: "pyramid",
    label: "四角錐",
    faces: pyramidNet(1.1),
    counts: { v: 5, e: 8, f: 5 },
    note: "正方形の各辺に正三角形。4枚の頂点が1点に集まります（ピラミッド型）。折り上げる角度は arccos(−1/√3) ≒ 125.26°。",
  },
];

export function solidByKey(key) {
  return SOLIDS.find((s) => s.key === key) || SOLIDS[0];
}

/* ------------------------------------------------------------------ folding -- */

/** Chain of ancestor faces, innermost first. */
function hingeChain(faces, index) {
  const chain = [];
  let i = index;
  while (faces[i] && faces[i].parent != null) {
    chain.push(faces[i]);
    i = faces[i].parent;
  }
  return chain;
}

/**
 * The net folded to `t` (0 = flat, 1 = closed), as 3D polygons.
 * Also returns the flat net centre so the caller can keep the drawing put.
 */
export function foldNet(spec, t) {
  const faces = spec.faces;
  return faces.map((face, i) => {
    const chain = hingeChain(faces, i);
    const pts = face.poly.map((p) => {
      let q = [p[0], p[1], 0];
      for (const link of chain) {
        const [h0, h1] = link.hinge;
        const ux = h1[0] - h0[0];
        const uy = h1[1] - h0[1];
        const len = Math.hypot(ux, uy) || 1;
        q = rotateAbout(q, [h0[0], h0[1], 0], [ux / len, uy / len, 0], signedAngle(link) * t);
      }
      return q;
    });
    return { pts, label: face.label, index: i };
  });
}

/** Outward-ish normal, used only for shading. */
export function faceNormal(pts) {
  const n = cross(sub(pts[1], pts[0]), sub(pts[2], pts[0]));
  const l = norm(n) || 1;
  return [n[0] / l, n[1] / l, n[2] / l];
}

/** Bounding box of a folded net, for auto-scaling the drawing. */
export function netBounds(folded) {
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  for (const f of folded) {
    for (const p of f.pts) {
      for (let k = 0; k < 3; k++) {
        if (p[k] < lo[k]) lo[k] = p[k];
        if (p[k] > hi[k]) hi[k] = p[k];
      }
    }
  }
  return { lo, hi };
}

/**
 * Vertices, edges and faces read off the folded solid itself rather than
 * quoted from a table — so the Euler count shown in the app is a measurement.
 */
export function solidCounts(spec) {
  const folded = foldNet(spec, 1);
  const ids = new Map();
  const idOf = (p) => {
    const k = p.map((v) => (Math.abs(v) < 1e-6 ? 0 : v).toFixed(5)).join(",");
    if (!ids.has(k)) ids.set(k, ids.size);
    return ids.get(k);
  };
  const edges = new Set();
  for (const f of folded) {
    const poly = f.pts.map(idOf);
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      edges.add(a < b ? `${a}-${b}` : `${b}-${a}`);
    }
  }
  const v = ids.size;
  const e = edges.size;
  const f = folded.length;
  return { v, e, f, euler: v - e + f };
}
