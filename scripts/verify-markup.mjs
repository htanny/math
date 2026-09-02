/**
 * The views wire themselves to the page by id. Nothing in the build checks
 * that those ids exist, so a renamed element fails silently at runtime —
 * getElementById returns null and the whole view stops in its first line.
 *
 * This is the cheap standing version of that check: every id a view asks for
 * must exist exactly once, every aria reference must resolve, and every
 * canvas must carry a name.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");

let bad = 0;
const fail = (msg) => {
  console.log(`  FAIL ${msg}`);
  bad++;
};

/* --------------------------------------------------------- ids in the page -- */
const ids = new Map();
for (const m of html.matchAll(/\sid="([^"]+)"/g)) {
  ids.set(m[1], (ids.get(m[1]) || 0) + 1);
}
for (const [id, n] of ids) if (n > 1) fail(`id="${id}" が ${n} 個あります`);
console.log(`id: ${ids.size} 個（重複なし）`);

/* ------------------------------------------------- ids the views ask for -- */
function jsFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...jsFiles(p));
    else if (name.endsWith(".js")) out.push(p);
  }
  return out;
}

const srcDir = new URL("../src", import.meta.url).pathname;
let asked = 0;
for (const file of jsFiles(srcDir)) {
  const code = readFileSync(file, "utf8");
  const wanted = new Set();
  for (const m of code.matchAll(/\bgetElementById\(\s*"([^"]+)"\s*\)/g)) wanted.add(m[1]);
  for (const m of code.matchAll(/\$\(\s*"([^"]+)"\s*\)/g)) wanted.add(m[1]);
  for (const id of wanted) {
    asked++;
    if (!ids.has(id)) fail(`${file.split("/src/")[1]} が参照する id="${id}" がページにありません`);
  }
}
console.log(`ビューが参照する id: ${asked} 件`);

/* ---------------------------------------------------------- aria の参照先 -- */
let refs = 0;
for (const m of html.matchAll(/aria-(?:labelledby|describedby|controls)="([^"]+)"/g)) {
  for (const target of m[1].trim().split(/\s+/)) {
    refs++;
    if (!ids.has(target)) fail(`aria 参照先の id="${target}" がありません`);
  }
}
console.log(`aria 参照: ${refs} 件`);

/* --------------------------------------------------------- canvas に名前 -- */
let canvases = 0;
for (const m of html.matchAll(/<canvas\b([\s\S]*?)>/g)) {
  canvases++;
  const attrs = m[1];
  const id = (attrs.match(/\sid="([^"]+)"/) || [])[1] || "(id なし)";
  if (!/aria-label="/.test(attrs) && !/aria-labelledby="/.test(attrs)) {
    fail(`canvas id="${id}" に名前 (aria-label) がありません`);
  }
  // a canvas you can move with the keyboard has to be reachable by the keyboard
  if (/tabindex="0"/.test(attrs) && !/role="application"/.test(attrs)) {
    fail(`canvas id="${id}" は tabindex はあるが role="application" がありません`);
  }
}
console.log(`canvas: ${canvases} 個`);

/* ------------------------------------------- タブと <section> の対応関係 -- */
const tabs = [...html.matchAll(/<button[^>]*class="tab"[^>]*data-view="([^"]+)"/g)].map((m) => m[1]);
const views = [...html.matchAll(/<section[^>]*class="view"[^>]*data-view="([^"]+)"/g)].map((m) => m[1]);
const main = readFileSync(new URL("../src/main.js", import.meta.url), "utf8");
const listed = (main.match(/const VIEWS = \[([\s\S]*?)\]/) || [])[1] || "";
const registered = (main.match(/const registry = \{([\s\S]*?)\n\};/) || [])[1] || "";
const declared = [...listed.matchAll(/"([^"]+)"/g)].map((m) => m[1]);

for (const t of tabs) if (!views.includes(t)) fail(`タブ "${t}" に対応する section がありません`);
for (const v of views) if (!tabs.includes(v)) fail(`section "${v}" に対応するタブがありません`);
for (const v of views) if (!declared.includes(v)) fail(`section "${v}" が VIEWS に入っていません`);
for (const v of declared) {
  if (!views.includes(v)) fail(`VIEWS の "${v}" に対応する section がありません`);
  if (!new RegExp(`(^|\\n)\\s*${v}:`).test(registered)) fail(`VIEWS の "${v}" が registry にありません`);
}
console.log(`タブ / ビュー: ${tabs.length} 組`);

console.log(bad === 0 ? "\nマークアップの結線はすべて通っています。" : `\n${bad} 件の不整合`);
process.exit(bad === 0 ? 0 : 1);
