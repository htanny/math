/**
 * Cutting a convex solid with a plane — the 立体切断 of Japanese entrance exams.
 *
 * Everything here works on a convex polyhedron given as vertices plus faces.
 * Convexity is what makes it easy: the cross-section is a convex polygon, so
 * its vertices can simply be sorted by angle instead of chained edge by edge,
 * and each piece is again convex, so its volume follows from the divergence
 * theorem over its faces.
 */

const EPS = 1e-9;

export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const scale = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export const len = (a) => Math.hypot(a[0], a[1], a[2]);
export const lerp3 = (a, b, t) => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

/* --------------------------------------------------------------- the solid -- */

/** Vertex letters as a Japanese textbook labels 立方体 ABCD-EFGH. */
export const CUBE_NAMES = ["A", "B", "C", "D", "E", "F", "G", "H"];

/** Every edge of the cube, by the pair of letters students would name it. */
export const CUBE_EDGES = [
  ["A", "B"], ["B", "C"], ["C", "D"], ["D", "A"],
  ["E", "F"], ["F", "G"], ["G", "H"], ["H", "E"],
  ["A", "E"], ["B", "F"], ["C", "G"], ["D", "H"],
];

/**
 * Winding is not written out by hand — each face is flipped if needed so its
 * normal points away from the centre. Getting six windings right by eye is
 * exactly the kind of thing that silently produces a negative volume.
 */
export function orientFaces(solid) {
  const c = centroid(solid.verts);
  const faces = solid.faces.map((f) => {
    const n = faceNormal(f.map((i) => solid.verts[i]));
    const fc = centroid(f.map((i) => solid.verts[i]));
    return dot(n, sub(fc, c)) >= 0 ? f : [...f].reverse();
  });
  return { ...solid, faces };
}

export function centroid(pts) {
  const s = pts.reduce((acc, p) => add(acc, p), [0, 0, 0]);
  return scale(s, 1 / (pts.length || 1));
}

export function faceNormal(poly) {
  // Newell's method: robust for polygons that are not exactly planar
  let n = [0, 0, 0];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    n = add(n, [
      (a[1] - b[1]) * (a[2] + b[2]),
      (a[2] - b[2]) * (a[0] + b[0]),
      (a[0] - b[0]) * (a[1] + b[1]),
    ]);
  }
  const l = len(n) || 1;
  return scale(n, 1 / l);
}

export function makeCube(w = 1, d = 1, h = 1) {
  const verts = [
    [0, 0, h], [w, 0, h], [w, d, h], [0, d, h], // A B C D  上の面
    [0, 0, 0], [w, 0, 0], [w, d, 0], [0, d, 0], // E F G H  下の面
  ];
  const faces = [
    [0, 1, 2, 3], // ABCD
    [4, 5, 6, 7], // EFGH
    [0, 1, 5, 4], // ABFE
    [3, 2, 6, 7], // DCGH
    [0, 3, 7, 4], // ADHE
    [1, 2, 6, 5], // BCGF
  ];
  const faceLabels = ["ABCD（上）", "EFGH（下）", "ABFE（前）", "DCGH（後）", "ADHE（左）", "BCGF（右）"];
  return orientFaces({ verts, faces, faceLabels, names: CUBE_NAMES, edgeNames: CUBE_EDGES, size: [w, d, h] });
}

/** A prism over the given base polygon (given in the z = 0 plane), height h. */
export function makePrism(base, h) {
  const n = base.length;
  const verts = [
    ...base.map(([x, y]) => [x, y, 0]),
    ...base.map(([x, y]) => [x, y, h]),
  ];
  const faces = [
    base.map((_, i) => i),
    base.map((_, i) => n + i),
    ...base.map((_, i) => [i, (i + 1) % n, n + ((i + 1) % n), n + i]),
  ];
  return orientFaces({ verts, faces, base, height: h });
}

/** Unique edges as index pairs, read off the faces. */
export function solidEdges(solid) {
  const seen = new Map();
  for (const f of solid.faces) {
    for (let i = 0; i < f.length; i++) {
      const a = f[i];
      const b = f[(i + 1) % f.length];
      const k = a < b ? `${a},${b}` : `${b},${a}`;
      if (!seen.has(k)) seen.set(k, a < b ? [a, b] : [b, a]);
    }
  }
  return [...seen.values()];
}

export function volumeOf(solid) {
  return volumeOfFaces(solid.faces.map((f) => f.map((i) => solid.verts[i])));
}

/** Divergence theorem over outward-oriented faces, fan-triangulated. */
export function volumeOfFaces(polys) {
  let v = 0;
  for (const poly of polys) {
    for (let i = 1; i + 1 < poly.length; i++) {
      v += dot(poly[0], cross(poly[i], poly[i + 1]));
    }
  }
  return Math.abs(v) / 6;
}

/* ---------------------------------------------------------------- the plane -- */

export function planeThrough(p, q, r) {
  const n = cross(sub(q, p), sub(r, p));
  const l = len(n);
  if (l < 1e-10) return null; // the three points are in a line
  const u = scale(n, 1 / l);
  return { n: u, d: dot(u, p) };
}

export const signedDist = (plane, p) => dot(plane.n, p) - plane.d;

/**
 * The cut face itself. Points are collected off every edge the plane crosses,
 * then sorted by angle about their centre — valid because a convex solid has
 * a convex cross-section.
 */
export function crossSection(solid, plane) {
  const pts = [];
  const push = (p) => {
    if (!pts.some((q) => len(sub(q, p)) < 1e-7)) pts.push(p);
  };
  for (const [i, j] of solidEdges(solid)) {
    const a = solid.verts[i];
    const b = solid.verts[j];
    const sa = signedDist(plane, a);
    const sb = signedDist(plane, b);
    if (Math.abs(sa) < EPS) push(a);
    if (Math.abs(sb) < EPS) push(b);
    if (sa * sb < -EPS * EPS) push(lerp3(a, b, sa / (sa - sb)));
  }
  if (pts.length < 3) return [];

  const c = centroid(pts);
  const [u, v] = planeBasis(plane.n);
  return pts
    .map((p) => ({ p, ang: Math.atan2(dot(sub(p, c), v), dot(sub(p, c), u)) }))
    .sort((a, b) => a.ang - b.ang)
    .map((e) => e.p);
}

/** Two unit vectors spanning the plane, for laying the section out flat. */
export function planeBasis(n) {
  const seed = Math.abs(n[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
  const u = cross(n, seed);
  const uu = scale(u, 1 / (len(u) || 1));
  const v = cross(n, uu);
  return [uu, scale(v, 1 / (len(v) || 1))];
}

export function polygonArea3(poly) {
  if (poly.length < 3) return 0;
  let s = [0, 0, 0];
  for (let i = 1; i + 1 < poly.length; i++) {
    s = add(s, cross(sub(poly[i], poly[0]), sub(poly[i + 1], poly[0])));
  }
  return len(s) / 2;
}

/* --------------------------------------------------------------- the pieces -- */

/** Sutherland–Hodgman, in 3D against a plane. Keeps the side where s <= 0. */
function clipPolygon(poly, plane, below) {
  const sign = below ? 1 : -1;
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const sa = sign * signedDist(plane, a);
    const sb = sign * signedDist(plane, b);
    if (sa <= EPS) out.push(a);
    if ((sa < -EPS && sb > EPS) || (sa > EPS && sb < -EPS)) {
      out.push(lerp3(a, b, sa / (sa - sb)));
    }
  }
  return dedupeLoop(out);
}

function dedupeLoop(poly) {
  const out = [];
  for (const p of poly) {
    if (!out.length || len(sub(out[out.length - 1], p)) > 1e-9) out.push(p);
  }
  while (out.length > 1 && len(sub(out[0], out[out.length - 1])) < 1e-9) out.pop();
  return out;
}

/**
 * One of the two pieces, as a closed set of outward-oriented faces: the
 * original faces clipped back, plus the cut face capping it off.
 */
export function piece(solid, plane, below) {
  const faces = [];
  for (const f of solid.faces) {
    const clipped = clipPolygon(f.map((i) => solid.verts[i]), plane, below);
    if (clipped.length >= 3) faces.push(clipped);
  }
  const cap = crossSection(solid, plane);
  if (cap.length >= 3) {
    // the cap's outward normal is +n for the piece below the plane, -n above
    const want = below ? plane.n : scale(plane.n, -1);
    faces.push(dot(faceNormal(cap), want) >= 0 ? cap : [...cap].reverse());
  }
  return faces;
}

export function splitVolume(solid, plane) {
  const total = volumeOf(solid);
  const below = volumeOfFaces(piece(solid, plane, true));
  const above = volumeOfFaces(piece(solid, plane, false));
  return { below, above, total, closes: Math.abs(below + above - total) };
}

/* ----------------------------------------------------- the drawing method -- */

/**
 * Where the plane meets the *lines* of the solid's edges outside the solid
 * itself. These are the auxiliary points 延長法 constructs — the step that a
 * still picture cannot show, because the point being used is off the solid.
 */
export function extensionPoints(solid, plane, reach = 1.3) {
  const out = [];
  const edges = solidEdges(solid);
  for (let k = 0; k < edges.length; k++) {
    const [i, j] = edges[k];
    const a = solid.verts[i];
    const b = solid.verts[j];
    const sa = signedDist(plane, a);
    const sb = signedDist(plane, b);
    if (Math.abs(sa - sb) < EPS) continue; // edge parallel to the plane
    const t = sa / (sa - sb);
    if (t >= -EPS && t <= 1 + EPS) continue; // inside: an ordinary cut point
    if (t < -reach || t > 1 + reach) continue; // too far away to draw usefully
    out.push({ edge: k, from: t < 0 ? a : b, point: lerp3(a, b, t), t });
  }
  return out;
}

/** Which face of the solid a cut segment lies on. */
function faceOfSegment(solid, a, b) {
  for (let i = 0; i < solid.faces.length; i++) {
    const poly = solid.faces[i].map((k) => solid.verts[k]);
    const n = faceNormal(poly);
    const d = dot(n, poly[0]);
    if (Math.abs(dot(n, a) - d) < 1e-7 && Math.abs(dot(n, b) - d) < 1e-7) return i;
  }
  return -1;
}

export function sectionSegments(solid, poly) {
  return poly.map((a, i) => {
    const b = poly[(i + 1) % poly.length];
    return { a, b, face: faceOfSegment(solid, a, b) };
  });
}

/**
 * One valid order in which a student could draw the section, and which of the
 * three rules each line comes from:
 *
 *   1. two points on the same face are joined
 *   2. a face parallel to one that already has a cut line gets a parallel one
 *   3. neither applies, so the faces are extended to find a point outside
 *
 * Rule 3 is the one worth animating: the point it uses is not on the solid.
 */
export function constructionSteps(solid, plane, poly, givenPoints, nameOf) {
  const segs = sectionSegments(solid, poly);
  const normals = solid.faces.map((f) => faceNormal(f.map((i) => solid.verts[i])));
  const parallel = (i, j) => i >= 0 && j >= 0 && Math.abs(Math.abs(dot(normals[i], normals[j])) - 1) < 1e-7;

  const known = poly.map((p) => givenPoints.some((g) => len(sub(g, p)) < 1e-7));
  const done = segs.map(() => false);
  const drawnFaces = [];
  const steps = [];

  const endpoints = (k) => [k, (k + 1) % poly.length];

  for (let guard = 0; guard < segs.length + 4 && steps.length < segs.length; guard++) {
    let pick = -1;
    let rule = 0;

    for (let k = 0; k < segs.length && pick < 0; k++) {
      if (done[k]) continue;
      const [p, q] = endpoints(k);
      if (known[p] && known[q]) {
        pick = k;
        rule = 1;
      }
    }
    for (let k = 0; k < segs.length && pick < 0; k++) {
      if (done[k]) continue;
      const [p, q] = endpoints(k);
      if ((known[p] || known[q]) && drawnFaces.some((f) => parallel(f, segs[k].face))) {
        pick = k;
        rule = 2;
      }
    }
    for (let k = 0; k < segs.length && pick < 0; k++) {
      if (done[k]) continue;
      const [p, q] = endpoints(k);
      if (known[p] || known[q]) {
        pick = k;
        rule = 3;
      }
    }
    if (pick < 0) {
      pick = done.findIndex((v) => !v);
      rule = 3;
    }
    if (pick < 0) break;

    const [p, q] = endpoints(pick);
    known[p] = true;
    known[q] = true;
    done[pick] = true;
    drawnFaces.push(segs[pick].face);
    steps.push({
      index: pick,
      rule,
      face: segs[pick].face,
      faceLabel: solid.faceLabels ? solid.faceLabels[segs[pick].face] : "",
      from: nameOf(p),
      to: nameOf(q),
    });
  }
  return steps;
}

/**
 * The two volumes as the small whole-number ratio an exam answer is written
 * in — 7 : 17 rather than 1 : 2.4286. The pieces of a cube cut by a plane
 * through rational points are rational, so a denominator search finds it.
 */
export function ratioText(a, b, maxDen = 400) {
  if (a < 1e-12 || b < 1e-12) return "—";
  const [lo, hi] = a <= b ? [a, b] : [b, a];
  const r = hi / lo;
  for (let q = 1; q <= maxDen; q++) {
    const n = Math.round(r * q);
    if (n >= 1 && Math.abs(r - n / q) < 1e-9) {
      const g = smallGcd(q, n);
      return `${q / g} : ${n / g}`;
    }
  }
  return `1 : ${r.toFixed(4)}`;
}

function smallGcd(a, b) {
  while (b) {
    const t = a % b;
    a = b;
    b = t;
  }
  return a || 1;
}

/* ----------------------------------------------------------- what shape is it -- */

const near = (a, b, tol = 1e-6) => Math.abs(a - b) < tol;

/** The answer to "切り口はどんな形か" — the question exams actually ask. */
export function shapeName(poly) {
  const n = poly.length;
  if (n < 3) return "—";
  const sides = poly.map((p, i) => len(sub(poly[(i + 1) % n], p)));
  const angles = poly.map((p, i) => {
    const a = sub(poly[(i - 1 + n) % n], p);
    const b = sub(poly[(i + 1) % n], p);
    return Math.acos(Math.max(-1, Math.min(1, dot(a, b) / (len(a) * len(b)))));
  });
  const tol = Math.max(...sides) * 1e-5;
  const equalSides = sides.every((s) => near(s, sides[0], tol));
  const equalAngles = angles.every((a) => near(a, angles[0], 1e-5));
  const right = angles.every((a) => near(a, Math.PI / 2, 1e-5));

  if (n === 3) {
    if (equalSides) return "正三角形";
    if (near(sides[0], sides[1], tol) || near(sides[1], sides[2], tol) || near(sides[0], sides[2], tol)) {
      return "二等辺三角形";
    }
    return "三角形";
  }
  if (n === 4) {
    if (equalSides && right) return "正方形";
    if (right) return "長方形";
    if (equalSides) return "ひし形";
    const par = (i, j) => {
      const u = sub(poly[(i + 1) % n], poly[i]);
      const v = sub(poly[(j + 1) % n], poly[j]);
      return len(cross(u, v)) < len(u) * len(v) * 1e-6;
    };
    const p02 = par(0, 2);
    const p13 = par(1, 3);
    if (p02 && p13) return "平行四辺形";
    if (p02 || p13) {
      const legs = p02 ? [sides[1], sides[3]] : [sides[0], sides[2]];
      return near(legs[0], legs[1], tol) ? "等脚台形" : "台形";
    }
    return "四角形";
  }
  if (n === 5) return "五角形";
  if (n === 6) return equalSides && equalAngles ? "正六角形" : "六角形";
  return `${n}角形`;
}
