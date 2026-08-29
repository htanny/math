/**
 * Cutting a circle into sectors and dealing them out alternately into a row.
 *
 * The row is exactly πr wide and r tall by construction — that part is not
 * an approximation. What converges as n grows is the *shape*: the scalloped
 * top and bottom flatten out, and the straight-sided version of the same
 * arrangement (the inscribed polygon) closes in on πr² from below.
 */

/** Half-angle of one sector. */
export const halfAngle = (n) => Math.PI / n;

/** Area of the inscribed n-gon — what you get if each sector's arc is replaced by its chord. */
export const inscribedArea = (n, r) => (n / 2) * r * r * Math.sin((2 * Math.PI) / n);

/** Height of the scallops left on the edges of the row. */
export const wobble = (n, r) => r * (1 - Math.cos(Math.PI / n));

/** The row is this wide, for every n. */
export const rowWidth = (r) => Math.PI * r;

/**
 * Where sector k sits at morph time t (0 = still in the circle, 1 = in the row).
 * Canvas coordinates: +y points down, and the wedge's own shape points along +x.
 *
 * The sectors are staggered rather than all moving at once. Moving together
 * they sweep through each other and the middle of the animation is an
 * unreadable pile; dealt out one after another, every frame shows a partly
 * cut circle beside a partly built row, which is the idea being explained.
 */
export function sectorPlacement(n, r, t, k, stagger = 0.6) {
  const start = (stagger * k) / Math.max(1, n - 1);
  const span = 1 - stagger;
  const tk = Math.max(0, Math.min(1, (t - start) / span));
  const alpha = halfAngle(n);
  const circleAngle = (k + 0.5) * 2 * alpha - Math.PI / 2;

  const W = rowWidth(r);
  const apexX = -W / 2 + ((k + 0.5) * W) / n;
  const pointsDown = k % 2 === 0;
  const apexY = pointsDown ? -r / 2 : r / 2;
  let rowAngle = pointsDown ? Math.PI / 2 : -Math.PI / 2;

  // unroll by the shortest way round, so the sectors fan out instead of
  // spinning through several turns on their way to the row
  while (rowAngle - circleAngle > Math.PI) rowAngle -= 2 * Math.PI;
  while (circleAngle - rowAngle > Math.PI) rowAngle += 2 * Math.PI;

  return {
    angle: circleAngle + (rowAngle - circleAngle) * tk,
    x: apexX * tk,
    y: apexY * tk,
    alpha,
    placed: tk >= 1,
  };
}

/** Convergence table rows for the given radius. */
export function convergenceRows(r, counts = [4, 8, 16, 32, 64, 128, 256]) {
  const exact = Math.PI * r * r;
  return counts.map((n) => {
    const area = inscribedArea(n, r);
    return {
      n,
      area,
      error: exact - area,
      errorPct: ((exact - area) / exact) * 100,
      wobble: wobble(n, r),
    };
  });
}
