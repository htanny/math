import {
  continuedFraction,
  convergents,
  seedPositions,
  minSpacing,
  ALPHA_PRESETS,
} from "../continued.js";
import { readVars, setupCanvasDPR } from "../chart.js";

const $ = (id) => document.getElementById(id);
const TAU = Math.PI * 2;

function hexToRgb(hex) {
  const h = hex.trim().replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const v = parseInt(full, 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

export function initContinuedView() {
  const alphaSlider = $("cfAlpha");
  const alphaOut = $("cfAlphaOut");
  const angleOut = $("cfAngleOut");
  const seedsSlider = $("cfSeeds");
  const seedsOut = $("cfSeedsOut");
  const presetRow = $("cfPresets");
  const canvas = $("cfCanvas");
  const cfOut = $("cfExpansion");
  const spacingOut = $("cfSpacing");
  const bestOut = $("cfBest");
  const noteOut = $("cfNote");
  const tableBody = document.querySelector("#cfTable tbody");

  let alpha = Number(alphaSlider.value);
  let seeds = Number(seedsSlider.value);

  function draw() {
    const { ctx, width, height } = setupCanvasDPR(canvas);
    ctx.clearRect(0, 0, width, height);
    const vars = readVars(canvas.parentElement, ["--ramp-a", "--ramp-b", "--gridline"]);

    const cx = width / 2;
    const cy = height / 2;
    const radius = Math.min(width, height) / 2 - 10;
    if (radius <= 0) return;

    ctx.strokeStyle = vars["--gridline"];
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, TAU);
    ctx.stroke();

    const pts = seedPositions(alpha, seeds);
    const a = hexToRgb(vars["--ramp-a"] || "#9ec5f4");
    const b = hexToRgb(vars["--ramp-b"] || "#104281");
    const dot = seeds > 900 ? 2.1 : seeds > 500 ? 2.6 : 3.4;

    for (let k = 0; k < seeds; k++) {
      const t = k / seeds;
      const r = Math.round(a[0] + (b[0] - a[0]) * t);
      const g = Math.round(a[1] + (b[1] - a[1]) * t);
      const bl = Math.round(a[2] + (b[2] - a[2]) * t);
      ctx.fillStyle = `rgb(${r},${g},${bl})`;
      ctx.beginPath();
      ctx.arc(cx + pts[k * 2] * radius, cy + pts[k * 2 + 1] * radius, dot, 0, TAU);
      ctx.fill();
    }
  }

  function updateReadouts() {
    const terms = continuedFraction(alpha, 12);
    const cv = convergents(terms, alpha);

    const head = terms[0];
    const tail = terms.slice(1);
    cfOut.textContent = tail.length ? `[${head}; ${tail.join(", ")}${tail.length >= 11 ? ", …" : ""}]` : `[${head}]`;

    const pts = seedPositions(alpha, seeds);
    spacingOut.textContent = minSpacing(pts, seeds).toFixed(4);

    const best = cv[cv.length - 1];
    bestOut.textContent = best ? `${best.p} / ${best.q}` : "—";

    tableBody.innerHTML = cv
      .slice(0, 10)
      .map(
        (c) => `<tr>
          <td class="mono">${c.term}</td>
          <td class="mono">${c.p} / ${c.q}</td>
          <td class="mono">${c.value.toFixed(9)}</td>
          <td class="mono">${c.error === 0 ? "0" : c.error.toExponential(2)}</td>
        </tr>`
      )
      .join("");

    // A large partial quotient means a nearby good rational, which is exactly
    // what pulls the seeds into visible spokes.
    const biggest = Math.max(...tail, 0);
    if (terms.length <= 3 && tail.length && alpha * tail[0] % 1 === 0) {
      noteOut.textContent = "有理数なので、種は有限本の直線に並んでしまいます。";
    } else if (biggest >= 8) {
      noteOut.textContent = `連分数に大きな項（${biggest}）があります。近くに精度の高い有理数近似があるということで、その分だけ種が筋状に並び、隙間ができます。`;
    } else if (biggest <= 1) {
      noteOut.textContent = "連分数の項がすべて1 — 有理数で近似するのが最も難しい数です。だから種が最も均等に詰まります。";
    } else {
      noteOut.textContent = "項が小さいほど有理数近似が効きにくく、種は均等に散らばります。";
    }
  }

  function refresh() {
    alphaOut.textContent = alpha.toFixed(6);
    angleOut.textContent = `${(alpha * 360).toFixed(2)}°`;
    seedsOut.textContent = String(seeds);
    updateReadouts();
    draw();
  }

  alphaSlider.addEventListener("input", () => {
    alpha = Number(alphaSlider.value);
    refresh();
  });

  seedsSlider.addEventListener("input", () => {
    seeds = Number(seedsSlider.value);
    refresh();
  });

  ALPHA_PRESETS.forEach((p) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "chip";
    btn.textContent = p.label;
    btn.title = p.note;
    btn.addEventListener("click", () => {
      alpha = p.value;
      alphaSlider.value = String(alpha);
      refresh();
    });
    presetRow.appendChild(btn);
  });

  return {
    show() {},
    redraw() {
      refresh();
    },
  };
}
