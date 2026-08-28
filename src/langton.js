/**
 * Langton's ant and its multi-colour generalisation (turmites).
 *
 * A rule string like "RL" assigns a turn to each cell colour: standing on a
 * colour-i cell the ant turns rule[i], repaints the cell colour (i+1) mod n,
 * and steps forward. "RL" is Langton's original ant, which wanders for about
 * 10,000 steps of apparent chaos before abruptly building a periodic
 * "highway" — behaviour nobody has explained for the general case.
 */

// up, right, down, left
const DX = [0, 1, 0, -1];
const DY = [-1, 0, 1, 0];

// The highway detector needs room for the longest period it looks for, repeated
// enough times to cover MIN_SPAN steps. Three repeats of a short period is far
// too weak a signal — the chaotic phase throws up brief straight runs constantly
// — so a candidate must hold across at least MIN_SPAN steps of travel.
const MAX_PERIOD = 300;
const MIN_SPAN = 400;
const HISTORY = MAX_PERIOD * 3 + MIN_SPAN + 8;

export function parseRule(text) {
  const cleaned = String(text || "")
    .toUpperCase()
    .replace(/[^LR]/g, "");
  return cleaned.length >= 2 ? cleaned : "RL";
}

export function createWorld(size, rule) {
  const n = size | 0;
  return {
    size: n,
    rule: parseRule(rule),
    cells: new Uint8Array(n * n),
    x: n >> 1,
    y: n >> 1,
    dir: 0,
    steps: 0,
    painted: 0, // cells not currently colour 0
    escaped: false,
    lastIdx: -1,
    lastColour: 0,
    // ring buffer of (x, y, dir, painted) per step, for highway detection
    hist: new Int32Array(HISTORY * 4),
    histLen: 0,
    pattern: null,
  };
}

/** One ant step. Returns false once the ant walks off the grid. */
export function step(world) {
  if (world.escaped) return false;

  const { size, rule, cells } = world;
  const colours = rule.length;
  const idx = world.y * size + world.x;
  const colour = cells[idx];

  world.dir = (world.dir + (rule[colour % colours] === "R" ? 1 : 3)) % 4;
  const next = (colour + 1) % colours;
  cells[idx] = next;
  if (colour === 0 && next !== 0) world.painted++;
  else if (colour !== 0 && next === 0) world.painted--;

  // Renderers repaint only the cell that changed rather than the whole grid.
  world.lastIdx = idx;
  world.lastColour = next;

  const nx = world.x + DX[world.dir];
  const ny = world.y + DY[world.dir];
  if (nx < 0 || ny < 0 || nx >= size || ny >= size) {
    world.escaped = true;
    return false;
  }
  world.x = nx;
  world.y = ny;
  world.steps++;

  const slot = (world.histLen % HISTORY) * 4;
  world.hist[slot] = nx;
  world.hist[slot + 1] = ny;
  world.hist[slot + 2] = world.dir;
  world.hist[slot + 3] = world.painted;
  world.histLen++;
  return true;
}

function histAt(world, back) {
  // `back` counts backwards from the most recent entry (0 = latest)
  const i = world.histLen - 1 - back;
  if (i < 0 || world.histLen - i > HISTORY) return null;
  const slot = (i % HISTORY) * 4;
  return {
    x: world.hist[slot],
    y: world.hist[slot + 1],
    dir: world.hist[slot + 2],
    painted: world.hist[slot + 3],
  };
}

/**
 * Look for a translating periodic track: the ant repeating the same net
 * displacement over three consecutive blocks of `period` steps. Returns
 * { period, dx, dy } or null. This catches Langton's 104-step highway and the
 * analogous tracks other rules build, without hard-coding either.
 */
export function detectPattern(world) {
  const available = Math.min(world.histLen, HISTORY);
  if (available < MIN_SPAN) return null;

  for (let p = 2; p <= MAX_PERIOD; p++) {
    // Enough repeats to span MIN_SPAN steps, and never fewer than three.
    const blocks = Math.max(3, Math.ceil(MIN_SPAN / p));
    if ((blocks + 1) * p > available) break;

    const a = histAt(world, 0);
    const b = histAt(world, p);
    if (!a || !b) break;
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    if (dx === 0 && dy === 0) continue; // stationary, not a highway
    if (a.dir !== b.dir) continue;
    const dPainted = a.painted - b.painted;

    // Position alone is too weak — a chaotic ant drifts in a straight-ish line
    // often enough. A genuine track also returns to the same heading and lays
    // down the same number of cells every period.
    let ok = true;
    for (let k = 2; k <= blocks; k++) {
      const prev = histAt(world, (k - 1) * p);
      const cur = histAt(world, k * p);
      if (
        !cur ||
        !prev ||
        prev.x - cur.x !== dx ||
        prev.y - cur.y !== dy ||
        cur.dir !== a.dir ||
        prev.painted - cur.painted !== dPainted
      ) {
        ok = false;
        break;
      }
    }
    if (ok) return { period: p, dx, dy, span: blocks * p };
  }
  return null;
}

/** Count of cells in each colour. */
export function colourCounts(world) {
  const counts = new Array(world.rule.length).fill(0);
  const { cells } = world;
  for (let i = 0; i < cells.length; i++) counts[cells[i]]++;
  return counts;
}

export const RULE_PRESETS = [
  { rule: "RL", label: "RL", note: "ラングトンの原型。約1万歩の混沌のあと高速道路が出現" },
  { rule: "RLR", label: "RLR", note: "秩序が現れず成長し続ける" },
  { rule: "LLRR", label: "LLRR", note: "対称な模様が育つ" },
  { rule: "LRRRRRLLR", label: "LRRRRRLLR", note: "塗り潰された領域を作る" },
  { rule: "LLRRRLRLRLLR", label: "LLRRRLRLRLLR", note: "曲線を描きながら進む" },
  { rule: "RRLLLRLLLRRR", label: "RRLLLRLLLRRR", note: "角ばった領域が広がる" },
];
