/**
 * Small plotting primitives shared by the calculus views: a "region" is a
 * rectangle on the canvas with its own scales, so several graphs can be
 * stacked with their x-axes aligned.
 */

const TAU = Math.PI * 2;
export const TICK_FONT = "11px system-ui, -apple-system, 'Segoe UI', sans-serif";

export const PLOT_CHROME = [
  "--surface-1",
  "--muted",
  "--gridline",
  "--baseline",
  "--text-primary",
  "--text-secondary",
  "--series-1",
  "--series-2",
  "--series-3",
  "--series-4",
  "--good",
  "--warning",
];

export function makeRegion(ctx, box, xRange, yRange, vars) {
  const [x0, x1] = xRange;
  const [y0, y1] = yRange;
  const sx = (x) => box.x + ((x - x0) / (x1 - x0 || 1)) * box.w;
  const sy = (y) => box.y + box.h - ((y - y0) / (y1 - y0 || 1)) * box.h;

  ctx.strokeStyle = vars["--gridline"];
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.rect(box.x + 0.5, box.y + 0.5, box.w - 1, box.h - 1);
  ctx.stroke();

  ctx.strokeStyle = vars["--baseline"];
  if (y0 < 0 && y1 > 0) {
    const y = Math.round(sy(0)) + 0.5;
    ctx.beginPath();
    ctx.moveTo(box.x, y);
    ctx.lineTo(box.x + box.w, y);
    ctx.stroke();
  }
  if (x0 < 0 && x1 > 0) {
    const x = Math.round(sx(0)) + 0.5;
    ctx.beginPath();
    ctx.moveTo(x, box.y);
    ctx.lineTo(x, box.y + box.h);
    ctx.stroke();
  }
  return { sx, sy, box, xRange, yRange };
}

export function plotCurve(ctx, reg, fn, color, width = 2) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineJoin = "round";
  ctx.beginPath();
  const [x0, x1] = reg.xRange;
  const [y0, y1] = reg.yRange;
  const span = y1 - y0;
  const steps = Math.max(200, Math.round(reg.box.w * 2));
  let started = false;
  for (let i = 0; i <= steps; i++) {
    const x = x0 + ((x1 - x0) * i) / steps;
    const y = fn(x);
    // Lift the pen outside the window instead of drawing a spike back in.
    if (!Number.isFinite(y) || y < y0 - span || y > y1 + span) {
      started = false;
      continue;
    }
    const px = reg.sx(x);
    const py = reg.sy(Math.max(y0 - span * 0.02, Math.min(y1 + span * 0.02, y)));
    if (!started) {
      ctx.moveTo(px, py);
      started = true;
    } else ctx.lineTo(px, py);
  }
  ctx.stroke();
}

export function labelRegion(ctx, reg, vars, title, yTicks) {
  ctx.fillStyle = vars["--muted"];
  ctx.font = TICK_FONT;
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  for (const t of yTicks || []) {
    if (t < reg.yRange[0] || t > reg.yRange[1]) continue;
    ctx.fillText(String(t), reg.box.x - 6, reg.sy(t));
  }
  if (title) {
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillStyle = vars["--text-secondary"];
    ctx.fillText(title, reg.box.x + 8, reg.box.y + 6);
  }
}

export function xTickLabels(ctx, reg, vars, count = 4, digits = 1) {
  ctx.fillStyle = vars["--muted"];
  ctx.font = TICK_FONT;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  const [x0, x1] = reg.xRange;
  for (let i = 0; i <= count; i++) {
    const x = x0 + ((x1 - x0) * i) / count;
    ctx.fillText(x.toFixed(digits), reg.sx(x), reg.box.y + reg.box.h + 6);
  }
}

/** Padded y-range covering fn over the interval, ignoring non-finite values. */
export function niceRange(fn, x0, x1, samples = 400, padFrac = 0.15) {
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i <= samples; i++) {
    const v = fn(x0 + ((x1 - x0) * i) / samples);
    if (!Number.isFinite(v)) continue;
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return [-1, 1];
  const padding = (hi - lo) * padFrac || 1;
  return [lo - padding, hi + padding];
}

/** A dot with a surface-coloured ring, so it stays legible over a curve. */
export function markPoint(ctx, reg, x, y, color, vars, r = 4.5) {
  ctx.fillStyle = vars["--surface-1"];
  ctx.beginPath();
  ctx.arc(reg.sx(x), reg.sy(y), r + 2.5, 0, TAU);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(reg.sx(x), reg.sy(y), r, 0, TAU);
  ctx.fill();
}

export function vLine(ctx, reg, x, color, dash = [4, 3]) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.setLineDash(dash);
  ctx.beginPath();
  ctx.moveTo(reg.sx(x), reg.box.y);
  ctx.lineTo(reg.sx(x), reg.box.y + reg.box.h);
  ctx.stroke();
  ctx.setLineDash([]);
}

/** Straight line through (x0, y0) with the given slope, clipped to the region. */
export function slopeLine(ctx, reg, x0, y0, slope, color, width = 2, dash = []) {
  const [xa, xb] = reg.xRange;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.setLineDash(dash);
  ctx.beginPath();
  ctx.moveTo(reg.sx(xa), reg.sy(y0 + slope * (xa - x0)));
  ctx.lineTo(reg.sx(xb), reg.sy(y0 + slope * (xb - x0)));
  ctx.stroke();
  ctx.setLineDash([]);
}

export function legendHTML(items) {
  return items
    .filter(Boolean)
    .map(
      ([label, color]) =>
        `<span class="legend-item"><span class="legend-dot" style="background:${color}"></span>${label}</span>`
    )
    .join("");
}
