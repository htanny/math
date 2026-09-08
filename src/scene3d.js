/**
 * The one camera the 3D views share.
 *
 * All of them want the same thing: spin the scene about the vertical axis,
 * tilt it towards the viewer, drop the depth. Four views had grown four
 * copies of that — section, conic, net and similar — so it lives here now.
 *
 * The projection is a rotation of 3-space followed by reading off two of the
 * three coordinates, which is why `project` hands back `depth` as well: it is
 * the coordinate that was dropped, and it is what the painter's algorithm and
 * back-face culling need.
 */

/** Rotate about the vertical (z) axis. */
export function rotZ(p, az) {
  const c = Math.cos(az);
  const s = Math.sin(az);
  return [p[0] * c - p[1] * s, p[0] * s + p[1] * c, p[2]];
}

export function makeCamera(az, el) {
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

/**
 * A map from scene coordinates to canvas pixels that puts `points` in the
 * middle of the frame at the largest scale that still fits, with `pad` to
 * spare. One scale for both axes, so nothing is squashed.
 */
export function fitTo(points, cam, width, height, pad) {
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
