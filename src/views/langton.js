import { createWorld, step, detectPattern, parseRule, RULE_PRESETS } from "../langton.js";
import { readVars, setupCanvasDPR } from "../chart.js";

const $ = (id) => document.getElementById(id);
const fmt = (n) => n.toLocaleString("en-US");

function hexToRgb(hex) {
  const h = hex.trim().replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const v = parseInt(full, 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

export function initLangtonView() {
  const ruleInput = $("ltRule");
  const presetRow = $("ltPresets");
  const sizeSelect = $("ltSize");
  const speedSelect = $("ltSpeed");
  const playBtn = $("ltPlay");
  const resetBtn = $("ltReset");
  const canvas = $("ltCanvas");
  const statSteps = $("ltSteps");
  const statPainted = $("ltPainted");
  const statState = $("ltState");
  const noteEl = $("ltNote");

  let world = null;
  let playing = false;
  let animHandle = null;
  let visible = false;
  let pattern = null;
  let palette = [];

  // Offscreen grid at one pixel per cell, blown up on draw.
  const off = document.createElement("canvas");
  const offCtx = off.getContext("2d", { willReadFrequently: true });
  let img = null;

  function buildPalette(colours) {
    const vars = readVars(canvas.parentElement, ["--ramp-a", "--ramp-b", "--surface-1"]);
    const a = hexToRgb(vars["--ramp-a"] || "#9ec5f4");
    const b = hexToRgb(vars["--ramp-b"] || "#104281");
    palette = [];
    for (let c = 0; c < colours; c++) {
      if (c === 0) {
        palette.push([0, 0, 0, 0]); // unvisited: let the panel surface show
        continue;
      }
      const t = colours <= 2 ? 1 : (c - 1) / (colours - 2);
      palette.push([
        Math.round(a[0] + (b[0] - a[0]) * t),
        Math.round(a[1] + (b[1] - a[1]) * t),
        Math.round(a[2] + (b[2] - a[2]) * t),
        255,
      ]);
    }
  }

  function paintCell(idx, colour) {
    const [r, g, b, al] = palette[colour] || palette[0];
    const o = idx * 4;
    img.data[o] = r;
    img.data[o + 1] = g;
    img.data[o + 2] = b;
    img.data[o + 3] = al;
  }

  function rebuildImage() {
    const size = world.size;
    off.width = size;
    off.height = size;
    img = offCtx.createImageData(size, size);
    buildPalette(world.rule.length);
    for (let i = 0; i < world.cells.length; i++) paintCell(i, world.cells[i]);
  }

  function draw() {
    if (!world || !img) return;
    const { ctx, width, height } = setupCanvasDPR(canvas);
    ctx.clearRect(0, 0, width, height);
    const vars = readVars(canvas.parentElement, ["--series-2", "--gridline"]);

    offCtx.putImageData(img, 0, 0);

    const side = Math.min(width, height);
    const x0 = (width - side) / 2;
    const y0 = (height - side) / 2;

    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(off, x0, y0, side, side);

    ctx.strokeStyle = vars["--gridline"];
    ctx.lineWidth = 1;
    ctx.strokeRect(x0 + 0.5, y0 + 0.5, side - 1, side - 1);

    // the ant
    const cell = side / world.size;
    const ax = x0 + (world.x + 0.5) * cell;
    const ay = y0 + (world.y + 0.5) * cell;
    ctx.fillStyle = vars["--series-2"];
    ctx.beginPath();
    ctx.arc(ax, ay, Math.max(2.5, cell * 0.9), 0, Math.PI * 2);
    ctx.fill();
  }

  function updateStats() {
    if (!world) return;
    statSteps.textContent = fmt(world.steps);
    statPainted.textContent = fmt(world.painted);
    // Reaching the edge must not erase the more interesting fact that a
    // periodic track was found on the way there.
    if (pattern && world.escaped) {
      statState.textContent = `周期 ${pattern.period} の高速道路 → 盤面外へ`;
    } else if (pattern) {
      statState.textContent = `周期 ${pattern.period} の高速道路を検出`;
    } else if (world.escaped) {
      statState.textContent = "盤面の端に到達";
    } else {
      statState.textContent = "探索中…";
    }
  }

  function reset() {
    stopAnim();
    playing = false;
    playBtn.textContent = "再生";
    playBtn.classList.add("btn-primary");
    pattern = null;
    const rule = parseRule(ruleInput.value);
    ruleInput.value = rule;
    world = createWorld(Number(sizeSelect.value), rule);
    rebuildImage();
    updateStats();
    noteEl.textContent =
      rule === "RL"
        ? "ラングトンの原型。約1万歩は無秩序に見える動きが続き、そこから突然「高速道路」を作り始めます。"
        : `${rule.length} 色のチューリング的な蟻。ルールを変えると振る舞いが大きく変わります。`;
    draw();
  }

  function runFrame() {
    const perFrame = Number(speedSelect.value);
    let moved = false;
    for (let i = 0; i < perFrame; i++) {
      if (!step(world)) break;
      paintCell(world.lastIdx, world.lastColour);
      moved = true;
      if (!pattern && world.steps % 50 === 0) {
        const p = detectPattern(world);
        if (p) pattern = p;
      }
    }
    draw();
    updateStats();
    if (!moved || world.escaped) {
      playing = false;
      playBtn.textContent = "再生";
      playBtn.classList.add("btn-primary");
      stopAnim();
      return false;
    }
    return true;
  }

  function stopAnim() {
    if (animHandle) cancelAnimationFrame(animHandle);
    animHandle = null;
  }

  function tick() {
    if (!playing || !visible) {
      animHandle = null;
      return;
    }
    if (runFrame()) animHandle = requestAnimationFrame(tick);
  }

  function setPlaying(next) {
    playing = next && !world.escaped;
    playBtn.textContent = playing ? "一時停止" : "再生";
    playBtn.classList.toggle("btn-primary", !playing);
    stopAnim();
    if (playing && visible) animHandle = requestAnimationFrame(tick);
  }

  playBtn.addEventListener("click", () => setPlaying(!playing));
  resetBtn.addEventListener("click", reset);
  sizeSelect.addEventListener("change", reset);
  ruleInput.addEventListener("change", reset);

  RULE_PRESETS.forEach((p) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "chip";
    btn.textContent = p.label;
    btn.title = p.note;
    btn.addEventListener("click", () => {
      ruleInput.value = p.rule;
      reset();
      setPlaying(true);
    });
    presetRow.appendChild(btn);
  });

  let booted = false;

  return {
    show() {
      visible = true;
      if (!booted) {
        booted = true;
        reset();
      }
      if (playing) setPlaying(true);
    },
    hide() {
      visible = false;
      stopAnim();
    },
    redraw() {
      if (!world) return;
      // Theme may have flipped; the palette is baked into the pixel buffer.
      rebuildImage();
      draw();
      updateStats();
    },
  };
}
