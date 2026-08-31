/**
 * Slicing a double cone.
 *
 * Ellipse, parabola and hyperbola are taught as three separate curves with
 * three separate equations. They are one surface cut at three angles, and the
 * only thing that decides which you get is whether the cutting plane is less
 * steep than the cone's own side, exactly as steep, or steeper.
 *
 * Cone: x² + y² = k²z², with k = tan α and α the half-angle at the apex, so a
 * generator leans α from the axis and 90° − α from the horizontal.
 * Plane: z = m·x + c, tilted ψ from the horizontal with m = tan ψ.
 */

export const EPS = 1e-9;

export const coneK = (alphaDeg) => Math.tan((alphaDeg * Math.PI) / 180);
export const planeM = (psiDeg) => Math.tan((psiDeg * Math.PI) / 180);

/** The tilt at which the plane is parallel to a generator — the parabola. */
export const criticalTilt = (alphaDeg) => 90 - alphaDeg;

export function classify(alphaDeg, psiDeg, tol = 0.35) {
  const crit = criticalTilt(alphaDeg);
  if (Math.abs(psiDeg) < tol) return "circle";
  if (Math.abs(psiDeg - crit) < tol) return "parabola";
  return psiDeg < crit ? "ellipse" : "hyperbola";
}

export const KIND_LABEL = {
  circle: "円",
  ellipse: "楕円",
  parabola: "放物線",
  hyperbola: "双曲線",
};

/**
 * The section, in coordinates laid out *in the cutting plane* — which is
 * where it is a genuine conic. u runs along the plane's steepest direction,
 * v across it. The point (x, y, mx+c) maps to u = x√(1+m²), v = y.
 */
export function conicParams(k, m, c) {
  const A = 1 - k * k * m * m;
  const s = Math.sqrt(1 + m * m);
  const kind = Math.abs(A) < 1e-7 ? "parabola" : A > 0 ? (Math.abs(m) < 1e-9 ? "circle" : "ellipse") : "hyperbola";

  if (kind === "parabola") {
    // v² = (2k²mc/s)(u − uv), opening along +u when mc > 0
    const four_p = (2 * k * k * m * c) / s;
    const uv = (-c * s) / (2 * m);
    const p = four_p / 4;
    return {
      kind, A, s, p, vertexU: uv,
      focus: [uv + p, 0],
      directrixU: uv - p,
      eccentricity: 1,
    };
  }

  const absA = Math.abs(A);
  const u0 = (k * k * m * c * s) / A;
  const a = (k * c * s) / absA;
  const b = (k * c) / Math.sqrt(absA);
  const focal = ((k * c) / absA) * Math.abs(m) * Math.sqrt(1 + k * k);
  return {
    kind, A, s, a, b, u0, focal,
    center: [u0, 0],
    foci: [[u0 - focal, 0], [u0 + focal, 0]],
    eccentricity: a > 0 ? focal / a : 0,
    // the constant the two focal radii add up to (ellipse) or differ by (hyperbola)
    focalConstant: 2 * a,
  };
}

/** Where the curve meets the plane's steepest line — the ends of the section. */
export function xRoots(k, m, c) {
  const A = 1 - k * k * m * m;
  if (Math.abs(A) < 1e-12) return null; // parabola: only one end
  return [(-k * c) / (1 + k * m), (k * c) / (1 - k * m)].sort((p, q) => p - q);
}

/**
 * The section as 3D points on the cone. For a hyperbola this is two branches,
 * one on each nappe — which is the point: a steep enough plane reaches both.
 */
export function sectionCurve3D(k, m, c, zLimit, steps = 400) {
  const f = (x) => k * k * (m * x + c) * (m * x + c) - x * x;
  const pt = (x, sign) => {
    const y2 = Math.max(0, f(x));
    return [x, sign * Math.sqrt(y2), m * x + c];
  };

  const A = 1 - k * k * m * m;
  const roots = xRoots(k, m, c);
  const spans = [];
  const BIG = 400;

  if (Math.abs(A) < 1e-7) {
    // parabola: f is linear, non-negative from one end onwards
    const x0 = (-c) / (2 * m);
    spans.push(m > 0 ? [x0, x0 + BIG] : [x0 - BIG, x0]);
  } else if (A > 0) {
    spans.push(roots);
  } else {
    spans.push([roots[0] - BIG, roots[0]]);
    spans.push([roots[1], roots[1] + BIG]);
  }

  // Clip each span to where the cone is actually drawn *before* sampling.
  // Sampling the unbounded span first and then dropping what falls outside
  // leaves only a handful of points on the visible part, and the curve comes
  // out as a few straight segments.
  const zSpan = Math.abs(m) < 1e-9
    ? [-Infinity, Infinity]
    : [(-zLimit - c) / m, (zLimit - c) / m].sort((p, q) => p - q);

  const out = [];
  for (const [lo0, hi0] of spans) {
    const lo = Math.max(lo0, zSpan[0]);
    const hi = Math.min(hi0, zSpan[1]);
    if (!(hi > lo)) continue;

    const upper = [];
    const lower = [];
    for (let i = 0; i <= steps; i++) {
      const x = lo + ((hi - lo) * i) / steps;
      upper.push(pt(x, 1));
      lower.push(pt(x, -1));
    }
    // the two halves meet wherever y reaches 0, and only there
    const flat = (p) => Math.abs(p[1]) < 1e-7;
    const joinLo = flat(upper[0]);
    const joinHi = flat(upper[upper.length - 1]);
    if (joinLo && joinHi) out.push([...upper, ...lower.reverse()]);
    else if (joinLo) out.push([...lower.reverse(), ...upper]);
    else if (joinHi) out.push([...upper, ...lower.reverse()]);
    else {
      out.push(upper);
      out.push(lower);
    }
  }
  return out.filter((branch) => branch.length > 1);
}

/** The same section, as (u, v) in the cutting plane — its true shape. */
export function toPlane(p, m) {
  const s = Math.sqrt(1 + m * m);
  return [p[0] * s, p[1]];
}

export function sectionCurvePlane(k, m, c, zLimit, steps = 400) {
  return sectionCurve3D(k, m, c, zLimit, steps).map((branch) => branch.map((p) => toPlane(p, m)));
}

/** How far a point strays from the cone and from the plane — both must be 0. */
export function residual(k, m, c, p) {
  const onCone = p[0] * p[0] + p[1] * p[1] - k * k * p[2] * p[2];
  const onPlane = p[2] - (m * p[0] + c);
  return Math.max(Math.abs(onCone), Math.abs(onPlane));
}

/**
 * The defining property, measured: the sum (ellipse) or difference
 * (hyperbola) of the distances to the two foci, or for a parabola the gap
 * between the distance to the focus and the distance to the directrix.
 */
export function focalMeasure(params, uv) {
  const d = (f) => Math.hypot(uv[0] - f[0], uv[1] - f[1]);
  if (params.kind === "parabola") {
    return { value: d(params.focus), other: Math.abs(uv[0] - params.directrixU), label: "焦点までの距離 と 準線までの距離" };
  }
  const [f1, f2] = params.foci;
  if (params.kind === "hyperbola") {
    return { value: Math.abs(d(f1) - d(f2)), other: params.focalConstant, label: "2つの焦点までの距離の差" };
  }
  return { value: d(f1) + d(f2), other: params.focalConstant, label: "2つの焦点までの距離の和" };
}

export const CONIC_PRESETS = [
  { key: "circle", label: "円", alpha: 30, psi: 0, note: "軸に垂直に切ると円。切る高さを変えても、いつでも円のままです。" },
  { key: "ellipse", label: "楕円", alpha: 30, psi: 35, note: "円錐の側面より<strong>ゆるい角度</strong>で切ると楕円。傾けるほど細長くなります。" },
  { key: "parabola", label: "放物線", alpha: 30, psi: 60, note: "側面と<strong>ちょうど平行</strong>に切ったときだけ放物線。楕円と双曲線のさかいめの、たった1つの角度です。" },
  { key: "hyperbola", label: "双曲線", alpha: 30, psi: 72, note: "側面より<strong>急な角度</strong>で切ると、上下2つの円錐の両方を切るので、曲線も2本になります。" },
  { key: "narrow", label: "細い円錐で楕円", alpha: 18, psi: 60, note: "円錐が細いと、さきほど放物線だった 60° がまだ楕円のまま。決めているのは傾きそのものではなく、<strong>円錐の側面と比べてどうか</strong>です。" },
];
