export function readVars(el, names) {
  const style = getComputedStyle(el);
  const out = {};
  for (const name of names) out[name] = style.getPropertyValue(name).trim();
  return out;
}

export function setupCanvasDPR(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width));
  const height = Math.max(1, Math.round(rect.height));
  if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
    canvas.width = width * dpr;
    canvas.height = height * dpr;
  }
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, width, height };
}

export function niceTicks(min, max, count) {
  if (min === max) return [min];
  const range = max - min;
  const rawStep = range / count;
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const norm = rawStep / mag;
  let step;
  if (norm < 1.5) step = 1 * mag;
  else if (norm < 3) step = 2 * mag;
  else if (norm < 7) step = 5 * mag;
  else step = 10 * mag;

  const ticks = [];
  const start = Math.ceil(min / step) * step;
  for (let v = start; v <= max + step * 1e-9; v += step) ticks.push(Math.round(v * 1e9) / 1e9);
  return ticks;
}

function formatNum(v) {
  if (Math.abs(v) >= 1000) return v.toLocaleString("en-US");
  return String(v);
}

const BASE_PAD = { top: 16, right: 16, bottom: 32, left: 56 };
const TICK_FONT = "11px system-ui, -apple-system, 'Segoe UI', sans-serif";

function measureLeftPad(ctx, tickValues) {
  ctx.font = TICK_FONT;
  let maxW = 0;
  for (const t of tickValues) {
    const w = ctx.measureText(formatNum(Math.round(t))).width;
    if (w > maxW) maxW = w;
  }
  return Math.max(BASE_PAD.left, Math.ceil(maxW) + 16);
}

export class LineChart {
  constructor(canvas, tooltipEl) {
    this.canvas = canvas;
    this.tooltipEl = tooltipEl;
    this.series = [];
    this.logScale = false;
    this._onMove = this._onMove.bind(this);
    this._onLeave = this._onLeave.bind(this);
    canvas.addEventListener("mousemove", this._onMove);
    canvas.addEventListener("mouseleave", this._onLeave);
    this._plot = null;
  }

  setData(series) {
    this.series = series;
    this.render();
  }

  setLogScale(v) {
    this.logScale = v;
    this.render();
  }

  render() {
    const { canvas } = this;
    const { ctx, width, height } = setupCanvasDPR(canvas);
    ctx.clearRect(0, 0, width, height);

    const vars = readVars(canvas.parentElement, [
      "--surface-1",
      "--text-secondary",
      "--muted",
      "--gridline",
      "--baseline",
      "--series-1",
      "--series-2",
      "--series-3",
    ]);
    const seriesColors = [vars["--series-1"], vars["--series-2"], vars["--series-3"]];

    if (!this.series.length || this.series.every((s) => s.values.length === 0)) {
      this._plot = null;
      return;
    }

    let maxLen = 0;
    let maxVal = -Infinity;
    let minVal = Infinity;
    for (const s of this.series) {
      maxLen = Math.max(maxLen, s.values.length);
      for (const v of s.values) {
        if (v > maxVal) maxVal = v;
        if (v < minVal) minVal = v;
      }
    }
    if (this.logScale) minVal = Math.max(1, minVal);
    else minVal = Math.min(minVal, 1);

    const toLogY = (v) => Math.log10(Math.max(1, v));
    const yMin = this.logScale ? toLogY(minVal) : minVal;
    const yMax = this.logScale ? toLogY(maxVal) : maxVal;
    const yRange = yMax - yMin || 1;

    const yTicks = this.logScale
      ? Array.from({ length: Math.ceil(yMax) - Math.floor(yMin) + 1 }, (_, i) => Math.floor(yMin) + i).map(
          (e) => Math.pow(10, e)
        )
      : niceTicks(yMin, yMax, 5);

    const pad = { ...BASE_PAD, left: measureLeftPad(ctx, yTicks) };
    const plotW = width - pad.left - pad.right;
    const plotH = height - pad.top - pad.bottom;

    const xScale = (i) => pad.left + (maxLen <= 1 ? 0 : (i / (maxLen - 1)) * plotW);
    const yScale = (v) => {
      const yv = this.logScale ? toLogY(v) : v;
      return pad.top + plotH - ((yv - yMin) / yRange) * plotH;
    };

    // gridlines + y ticks
    ctx.strokeStyle = vars["--gridline"];
    ctx.lineWidth = 1;
    ctx.fillStyle = vars["--muted"];
    ctx.font = TICK_FONT;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";

    for (const t of yTicks) {
      const y = yScale(t);
      ctx.beginPath();
      ctx.moveTo(pad.left, Math.round(y) + 0.5);
      ctx.lineTo(width - pad.right, Math.round(y) + 0.5);
      ctx.stroke();
      ctx.fillText(formatNum(Math.round(t)), pad.left - 8, y);
    }

    // x ticks
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    const xTickCount = Math.min(6, maxLen);
    for (let i = 0; i < xTickCount; i++) {
      const idx = Math.round((i / Math.max(1, xTickCount - 1)) * (maxLen - 1));
      const x = xScale(idx);
      ctx.fillText(String(idx), x, height - pad.bottom + 8);
    }

    // baseline
    ctx.strokeStyle = vars["--baseline"];
    ctx.beginPath();
    ctx.moveTo(pad.left, pad.top + plotH + 0.5);
    ctx.lineTo(width - pad.right, pad.top + plotH + 0.5);
    ctx.stroke();

    // lines
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    this.series.forEach((s, si) => {
      const color = seriesColors[si % seriesColors.length];
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      s.values.forEach((v, i) => {
        const x = xScale(i);
        const y = yScale(v);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      // end marker with surface ring
      const lastI = s.values.length - 1;
      const ex = xScale(lastI);
      const ey = yScale(s.values[lastI]);
      ctx.fillStyle = vars["--surface-1"];
      ctx.beginPath();
      ctx.arc(ex, ey, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(ex, ey, 4, 0, Math.PI * 2);
      ctx.fill();
    });

    this._plot = { width, height, plotW, plotH, xScale, yScale, maxLen, seriesColors, vars, pad };
  }

  _onMove(evt) {
    if (!this._plot || !this.tooltipEl) return;
    const rect = this.canvas.getBoundingClientRect();
    const mx = evt.clientX - rect.left;
    const { xScale, maxLen, pad } = this._plot;

    if (mx < pad.left || mx > this._plot.width - pad.right) {
      this.tooltipEl.style.display = "none";
      return;
    }

    const plotW = this._plot.plotW;
    const relX = (mx - pad.left) / (plotW || 1);
    const idx = Math.max(0, Math.min(maxLen - 1, Math.round(relX * (maxLen - 1))));

    const rows = this.series
      .filter((s) => idx < s.values.length)
      .map((s, i) => `<span style="color:${this._plot.seriesColors[i % 3]}">●</span> ${s.label}: ${s.values[idx].toLocaleString("en-US")}`);

    if (!rows.length) {
      this.tooltipEl.style.display = "none";
      return;
    }

    this.tooltipEl.innerHTML = `<div class="tt-title">step ${idx}</div>${rows.join("<br/>")}`;
    this.tooltipEl.style.display = "block";
    this.tooltipEl.style.left = `${evt.clientX - rect.left + 12}px`;
    this.tooltipEl.style.top = `${evt.clientY - rect.top + 12}px`;
  }

  _onLeave() {
    if (this.tooltipEl) this.tooltipEl.style.display = "none";
  }
}

export class BarChart {
  /**
   * data items: { label: string, value: number, color?: cssVarName, tip?: string }
   */
  constructor(canvas, tooltipEl, options = {}) {
    this.canvas = canvas;
    this.tooltipEl = tooltipEl;
    this.options = options;
    this.data = [];
    this._onMove = this._onMove.bind(this);
    this._onLeave = this._onLeave.bind(this);
    canvas.addEventListener("mousemove", this._onMove);
    canvas.addEventListener("mouseleave", this._onLeave);
    this._plot = null;
  }

  setData(data) {
    this.data = data;
    this.render();
  }

  render() {
    const { canvas } = this;
    const { ctx, width, height } = setupCanvasDPR(canvas);
    ctx.clearRect(0, 0, width, height);

    const vars = readVars(canvas.parentElement, [
      "--surface-1",
      "--text-secondary",
      "--muted",
      "--gridline",
      "--baseline",
      "--series-1",
      "--series-2",
      "--series-3",
      "--series-4",
      "--good",
    ]);

    if (!this.data.length) {
      this._plot = null;
      return;
    }

    const maxVal = Math.max(...this.data.map((d) => d.value));
    const yTicks = niceTicks(0, maxVal, 5);
    const pad = { ...BASE_PAD, left: measureLeftPad(ctx, yTicks) };
    const plotW = width - pad.left - pad.right;
    const plotH = height - pad.top - pad.bottom;

    ctx.strokeStyle = vars["--gridline"];
    ctx.fillStyle = vars["--muted"];
    ctx.font = TICK_FONT;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    const yScale = (v) => pad.top + plotH - (v / (maxVal || 1)) * plotH;
    for (const t of yTicks) {
      const y = yScale(t);
      ctx.beginPath();
      ctx.moveTo(pad.left, Math.round(y) + 0.5);
      ctx.lineTo(width - pad.right, Math.round(y) + 0.5);
      ctx.stroke();
      ctx.fillText(formatNum(Math.round(t)), pad.left - 8, y);
    }

    const n = this.data.length;
    const slot = plotW / n;
    const barW = Math.min(24, slot * 0.7);
    const gap = 2;

    const bars = [];
    this.data.forEach((d, i) => {
      const cx = pad.left + slot * (i + 0.5);
      const barH = (d.value / (maxVal || 1)) * plotH;
      const x = cx - barW / 2 + gap / 2;
      const w = barW - gap;
      const yTop = pad.top + plotH - barH;
      const r = Math.min(4, w / 2);

      ctx.fillStyle = vars[d.color || "--series-1"] || vars["--series-1"];
      ctx.beginPath();
      ctx.moveTo(x, yTop + r);
      ctx.arcTo(x, yTop, x + r, yTop, r);
      ctx.lineTo(x + w - r, yTop);
      ctx.arcTo(x + w, yTop, x + w, yTop + r, r);
      ctx.lineTo(x + w, pad.top + plotH);
      ctx.lineTo(x, pad.top + plotH);
      ctx.closePath();
      ctx.fill();

      bars.push({ x: cx - slot / 2, w: slot, cx, datum: d });
    });

    // category labels under each bar, only when they comfortably fit
    if (this.options.xLabels) {
      ctx.fillStyle = vars["--muted"];
      ctx.font = TICK_FONT;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      const fits = bars.every((b) => ctx.measureText(b.datum.label).width < slot - 6);
      if (fits) {
        for (const b of bars) ctx.fillText(b.datum.label, b.cx, pad.top + plotH + 8);
      }
    }

    // baseline
    ctx.strokeStyle = vars["--baseline"];
    ctx.beginPath();
    ctx.moveTo(pad.left, pad.top + plotH + 0.5);
    ctx.lineTo(width - pad.right, pad.top + plotH + 0.5);
    ctx.stroke();

    this._plot = { width, height, bars };
  }

  _onMove(evt) {
    if (!this._plot || !this.tooltipEl) return;
    const rect = this.canvas.getBoundingClientRect();
    const mx = evt.clientX - rect.left;
    const bar = this._plot.bars.find((b) => mx >= b.x && mx < b.x + b.w);
    if (!bar) {
      this.tooltipEl.style.display = "none";
      return;
    }
    const d = bar.datum;
    const body = this.options.tooltip
      ? this.options.tooltip(d)
      : `<div class="tt-title">${d.label}</div>${d.value.toLocaleString("en-US")}`;
    this.tooltipEl.innerHTML = body;
    this.tooltipEl.style.display = "block";
    this.tooltipEl.style.left = `${evt.clientX - rect.left + 12}px`;
    this.tooltipEl.style.top = `${evt.clientY - rect.top + 12}px`;
  }

  _onLeave() {
    if (this.tooltipEl) this.tooltipEl.style.display = "none";
  }
}
