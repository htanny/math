import { readVars, setupCanvasDPR } from "../chart.js";
import { SOLIDS, solidByKey, foldNet, faceNormal, solidCounts } from "../solids.js";

const $ = (id) => document.getElementById(id);
const LABEL_FONT = "13px system-ui, -apple-system, 'Segoe UI', sans-serif";
const ELEVATION = (32 * Math.PI) / 180;

export function initNetView() {
  const canvas = $("ntCanvas");
  const foldSlider = $("ntFold");
  const spinSlider = $("ntSpin");
  const foldOut = $("ntFoldOut");
  const spinOut = $("ntSpinOut");
  const playBtn = $("ntPlay");
  const labelsToggle = $("ntLabels");
  const note = $("ntNote");
  const presetHost = $("ntPresets");
  const stats = { v: $("ntV"), e: $("ntE"), f: $("ntF"), euler: $("ntEuler") };

  let key = SOLIDS[0].key;
  let raf = null;

  /** Spin about the vertical axis, then a fixed camera elevation. */
  function project(p, spin) {
    const cs = Math.cos(spin);
    const sn = Math.sin(spin);
    const x = p[0] * cs - p[1] * sn;
    const y = p[0] * sn + p[1] * cs;
    const z = p[2];
    const ce = Math.cos(ELEVATION);
    const se = Math.sin(ELEVATION);
    return {
      x,
      y: -(y * se + z * ce),
      depth: -y * ce + z * se,
    };
  }

  function fitOf(spec, t, spin, width, height) {
    const folded = foldNet(spec, t);
    let lo = [Infinity, Infinity];
    let hi = [-Infinity, -Infinity];
    for (const f of folded) {
      for (const p of f.pts) {
        const q = project(p, spin);
        lo[0] = Math.min(lo[0], q.x);
        hi[0] = Math.max(hi[0], q.x);
        lo[1] = Math.min(lo[1], q.y);
        hi[1] = Math.max(hi[1], q.y);
      }
    }
    const w = hi[0] - lo[0] || 1;
    const h = hi[1] - lo[1] || 1;
    const scale = Math.min((width - 56) / w, (height - 56) / h);
    return { scale, cx: (lo[0] + hi[0]) / 2, cy: (lo[1] + hi[1]) / 2 };
  }

  function draw() {
    const { ctx, width, height } = setupCanvasDPR(canvas);
    ctx.clearRect(0, 0, width, height);
    const vars = readVars(canvas.parentElement, [
      "--surface-1", "--page", "--muted", "--gridline", "--baseline",
      "--text-primary", "--text-secondary",
      "--series-1", "--series-2", "--series-3", "--series-4", "--ramp-a", "--ramp-b",
    ]);
    const palette = [
      vars["--series-1"], vars["--series-2"], vars["--series-3"],
      vars["--series-4"], vars["--ramp-b"], vars["--ramp-a"],
    ];

    const spec = solidByKey(key);
    const t = Number(foldSlider.value);
    const spin = (Number(spinSlider.value) * Math.PI) / 180;

    // fit the flat net and the finished solid, then move between the two:
    // both ends fill the canvas and nothing jumps on the way
    const f0 = fitOf(spec, 0, spin, width, height);
    const f1 = fitOf(spec, 1, spin, width, height);
    const scale = f0.scale + (f1.scale - f0.scale) * t;
    const cx = f0.cx + (f1.cx - f0.cx) * t;
    const cy = f0.cy + (f1.cy - f0.cy) * t;

    const folded = foldNet(spec, t);
    const drawn = folded.map((f) => {
      const pts = f.pts.map((p) => project(p, spin));
      const depth = pts.reduce((s, q) => s + q.depth, 0) / pts.length;
      return { ...f, pts, depth, normal: faceNormal(f.pts) };
    });
    drawn.sort((a, b) => a.depth - b.depth);

    const ox = width / 2 - cx * scale;
    const oy = height / 2 - cy * scale;

    for (const f of drawn) {
      ctx.beginPath();
      f.pts.forEach((q, i) => {
        const x = ox + q.x * scale;
        const y = oy + q.y * scale;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.closePath();

      // a touch of shading so the folded solid reads as a solid
      const lit = 0.55 + 0.45 * Math.abs(f.normal[2]);
      ctx.globalAlpha = 0.34 + 0.3 * lit;
      ctx.fillStyle = palette[f.index % palette.length];
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = palette[f.index % palette.length];
      ctx.lineWidth = 1.6;
      ctx.stroke();

      if (labelsToggle.checked) {
        let mx = 0;
        let my = 0;
        for (const q of f.pts) {
          mx += ox + q.x * scale;
          my += oy + q.y * scale;
        }
        mx /= f.pts.length;
        my /= f.pts.length;
        ctx.fillStyle = vars["--surface-1"];
        ctx.beginPath();
        ctx.arc(mx, my, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = vars["--text-primary"];
        ctx.font = LABEL_FONT;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(f.label || String(f.index + 1), mx, my);
      }
    }
  }

  function render() {
    const spec = solidByKey(key);
    foldOut.textContent = `${Math.round(Number(foldSlider.value) * 100)}%`;
    spinOut.textContent = `${spinSlider.value}°`;
    draw();

    const c = solidCounts(spec);
    stats.v.textContent = String(c.v);
    stats.e.textContent = String(c.e);
    stats.f.textContent = String(c.f);
    stats.euler.textContent = String(c.euler);

    const t = Number(foldSlider.value);
    const stage =
      t < 0.02
        ? "まだ平らな展開図です。"
        : t > 0.98
        ? "折りあがりました。"
        : "折っている途中です。どの辺どうしがくっつくか見てください。";
    note.textContent =
      `${stage}${spec.note} 頂点 ${c.v} − 辺 ${c.e} + 面 ${c.f} = ${c.euler} — ` +
      `へこみのない多面体なら、形によらずいつでも 2 になります（オイラーの多面体定理）。` +
      `この数は折りあがった立体の座標から数えたもので、重なった頂点は 1 つとして数えています。`;
  }

  function stopAnim() {
    if (raf) cancelAnimationFrame(raf);
    raf = null;
    playBtn.textContent = "折る";
  }

  playBtn.addEventListener("click", () => {
    if (raf) {
      stopAnim();
      return;
    }
    const from = Number(foldSlider.value) >= 0.999 ? 0 : Number(foldSlider.value);
    const start = performance.now();
    playBtn.textContent = "止める";
    const step = (now) => {
      const p = Math.min(1, (now - start) / 2600);
      foldSlider.value = String(from + (1 - from) * p);
      render();
      if (p < 1) raf = requestAnimationFrame(step);
      else stopAnim();
    };
    raf = requestAnimationFrame(step);
  });

  foldSlider.addEventListener("input", () => {
    stopAnim();
    render();
  });
  spinSlider.addEventListener("input", render);
  labelsToggle.addEventListener("change", render);

  presetHost.innerHTML = SOLIDS.map(
    (s) => `<button type="button" class="chip" data-key="${s.key}">${s.label}</button>`
  ).join("");
  presetHost.addEventListener("click", (evt) => {
    const btn = evt.target.closest("button[data-key]");
    if (!btn) return;
    key = btn.dataset.key;
    for (const b of presetHost.querySelectorAll("button")) {
      b.classList.toggle("chip-accent", b.dataset.key === key);
    }
    stopAnim();
    foldSlider.value = "0";
    render();
  });
  presetHost.querySelector("button").classList.add("chip-accent");

  return {
    show() {},
    hide() {
      stopAnim();
    },
    redraw() {
      render();
    },
  };
}
