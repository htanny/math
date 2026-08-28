import { goldbachCounts, pairsFor, BANDS, MAX_LIMIT } from "../goldbach.js";
import { readVars, setupCanvasDPR, niceTicks } from "../chart.js";

const $ = (id) => document.getElementById(id);
const fmt = (n) => n.toLocaleString("en-US");
const TICK_FONT = "11px system-ui, -apple-system, 'Segoe UI', sans-serif";
// The right margin has to clear half of the last x tick label ("60,000").
const PAD = { top: 14, right: 34, bottom: 30, left: 52 };
const BAND_KEYS = ["div3", "div5", "other"];

export function initGoldbachView() {
  const form = $("gbForm");
  const limitInput = $("gbLimit");
  const canvas = $("gbCanvas");
  const tooltip = $("gbTooltip");
  const legend = $("gbLegend");
  const statMin = $("gbMin");
  const statMax = $("gbMax");
  const statCount = $("gbCount");
  const statViolations = $("gbViolations");

  const lookupForm = $("gbLookupForm");
  const lookupInput = $("gbLookupInput");
  const lookupOut = $("gbLookupOut");

  let data = null;
  let plot = null;

  function render() {
    const { ctx, width, height } = setupCanvasDPR(canvas);
    ctx.clearRect(0, 0, width, height);
    const vars = readVars(canvas.parentElement, [
      "--muted",
      "--gridline",
      "--baseline",
      "--series-1",
      "--series-2",
      "--series-3",
    ]);

    if (!data || !data.points.length) {
      plot = null;
      return;
    }

    const w = width - PAD.left - PAD.right;
    const h = height - PAD.top - PAD.bottom;
    if (w <= 0 || h <= 0) return;

    const nMax = data.limit;
    const gMax = data.max.g;
    const sx = (n) => PAD.left + (n / nMax) * w;
    const sy = (g) => PAD.top + h - (g / (gMax || 1)) * h;

    ctx.strokeStyle = vars["--gridline"];
    ctx.lineWidth = 1;
    ctx.fillStyle = vars["--muted"];
    ctx.font = TICK_FONT;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (const t of niceTicks(0, gMax, 5)) {
      const y = Math.round(sy(t)) + 0.5;
      ctx.beginPath();
      ctx.moveTo(PAD.left, y);
      ctx.lineTo(PAD.left + w, y);
      ctx.stroke();
      ctx.fillText(fmt(Math.round(t)), PAD.left - 7, sy(t));
    }

    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    for (const t of niceTicks(0, nMax, 6)) {
      ctx.fillText(fmt(Math.round(t)), sx(t), PAD.top + h + 7);
    }

    // One fillStyle per band, then every point of that band, so the whole
    // comet costs three style changes instead of thirty thousand.
    const dot = nMax > 20000 ? 1.2 : nMax > 8000 ? 1.6 : 2.2;
    for (const key of BAND_KEYS) {
      ctx.fillStyle = vars[BANDS[key].color];
      for (const p of data.points) {
        if (p.band !== key) continue;
        ctx.fillRect(sx(p.n) - dot / 2, sy(p.g) - dot / 2, dot, dot);
      }
    }

    ctx.strokeStyle = vars["--baseline"];
    ctx.beginPath();
    ctx.moveTo(PAD.left, PAD.top + h + 0.5);
    ctx.lineTo(PAD.left + w, PAD.top + h + 0.5);
    ctx.stroke();

    plot = { width, height, w, h, sx, nMax };

    legend.innerHTML = BAND_KEYS.map(
      (k) =>
        `<span class="legend-item"><span class="legend-dot" style="background:${vars[BANDS[k].color]}"></span>${BANDS[k].label}</span>`
    ).join("");
  }

  function compute(limit) {
    const capped = Math.min(Math.max(Math.trunc(limit) || 0, 100), MAX_LIMIT);
    limitInput.value = String(capped);
    data = goldbachCounts(capped);

    statMin.textContent = `${fmt(data.min.g)}（n = ${fmt(data.min.n)}）`;
    statMax.textContent = `${fmt(data.max.g)}（n = ${fmt(data.max.n)}）`;
    statCount.textContent = fmt(data.points.length);
    statViolations.textContent = data.violations === 0 ? "0 件（成立）" : `${fmt(data.violations)} 件`;
    render();
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    compute(Number(limitInput.value));
  });

  canvas.addEventListener("mousemove", (evt) => {
    if (!plot || !data) return;
    const rect = canvas.getBoundingClientRect();
    const mx = evt.clientX - rect.left;
    if (mx < PAD.left || mx > PAD.left + plot.w) {
      tooltip.style.display = "none";
      return;
    }
    const nRaw = ((mx - PAD.left) / plot.w) * plot.nMax;
    let n = Math.round(nRaw / 2) * 2;
    n = Math.min(Math.max(n, 4), data.limit);
    const point = data.points[(n - 4) / 2];
    if (!point) {
      tooltip.style.display = "none";
      return;
    }
    const pairs = pairsFor(n) || [];
    const shown = pairs.slice(0, 3).map(([p, q]) => `${p} + ${q}`).join("<br/>");
    tooltip.innerHTML =
      `<div class="tt-title">n = ${fmt(n)}（${BANDS[point.band].label}）</div>` +
      `表現数 g(n) = <strong>${fmt(point.g)}</strong>` +
      (shown ? `<br/>${shown}${pairs.length > 3 ? "<br/>…" : ""}` : "");
    tooltip.style.display = "block";
    tooltip.style.left = `${mx + 12}px`;
    tooltip.style.top = `${evt.clientY - rect.top + 12}px`;
  });

  canvas.addEventListener("mouseleave", () => {
    tooltip.style.display = "none";
  });

  lookupForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const n = Math.trunc(Number(lookupInput.value));
    if (!Number.isFinite(n) || n < 4 || n % 2 !== 0) {
      lookupOut.innerHTML = `<span class="note">4以上の偶数を入力してください。</span>`;
      return;
    }
    if (n > MAX_LIMIT) {
      lookupOut.innerHTML = `<span class="note">${fmt(MAX_LIMIT)} 以下の偶数を入力してください。</span>`;
      return;
    }
    const pairs = pairsFor(n);
    if (!pairs.length) {
      lookupOut.innerHTML = `<span class="note"><strong>${fmt(n)}</strong> を2つの素数の和で表す方法は見つかりませんでした。</span>`;
      return;
    }
    const shown = pairs.slice(0, 60);
    lookupOut.innerHTML =
      `<div class="note"><strong>${fmt(n)}</strong> = 2つの素数の和 — <strong>${fmt(pairs.length)}</strong> 通り` +
      (pairs.length > shown.length ? `（先頭 ${shown.length} 件を表示）` : "") +
      `</div><div class="pair-list">` +
      shown.map(([p, q]) => `<span class="pair">${fmt(p)} + ${fmt(q)}</span>`).join("") +
      `</div>`;
  });

  let booted = false;

  return {
    show() {
      if (!booted) {
        booted = true;
        compute(Number(limitInput.value));
        lookupInput.value = "100";
        lookupForm.dispatchEvent(new Event("submit"));
      }
    },
    redraw() {
      render();
    },
  };
}
