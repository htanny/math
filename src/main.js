import "./style.css";
import { initCollatzView } from "./views/collatz.js";
import { initAliquotView } from "./views/aliquot.js";
import { initLogisticView } from "./views/logistic.js";
import { initModmulView } from "./views/modmul.js";
import { initLangtonView } from "./views/langton.js";
import { initGoldbachView } from "./views/goldbach.js";
import { initContinuedView } from "./views/continued.js";
import { initZetaView } from "./views/zeta.js";
import { initInscribedView } from "./views/inscribed.js";
import { initUnitCircleView } from "./views/unitcircle.js";
import { initCalculusView } from "./views/calculus.js";
import { initCalculusDeepView } from "./views/calculusDeep.js";
import { initCalculusAdvView } from "./views/calculusAdv.js";

const VIEWS = [
  "inscribed",
  "unitcircle",
  "calculus",
  "calculusDeep",
  "calculusAdv",
  "collatz",
  "aliquot",
  "logistic",
  "modmul",
  "langton",
  "goldbach",
  "continued",
  "zeta",
];
const DEFAULT_VIEW = "inscribed";

const registry = {
  inscribed: initInscribedView(),
  unitcircle: initUnitCircleView(),
  calculus: initCalculusView(),
  calculusDeep: initCalculusDeepView(),
  calculusAdv: initCalculusAdvView(),
  collatz: initCollatzView(),
  aliquot: initAliquotView(),
  logistic: initLogisticView(),
  modmul: initModmulView(),
  langton: initLangtonView(),
  goldbach: initGoldbachView(),
  continued: initContinuedView(),
  zeta: initZetaView(),
};

const sections = new Map();
const tabs = new Map();
for (const name of VIEWS) {
  sections.set(name, document.querySelector(`section.view[data-view="${name}"]`));
  tabs.set(name, document.querySelector(`button.tab[data-view="${name}"]`));
}

let active = null;

function showView(name) {
  if (!VIEWS.includes(name)) name = DEFAULT_VIEW;
  if (name === active) return;

  if (active && registry[active].hide) registry[active].hide();

  for (const view of VIEWS) {
    sections.get(view).hidden = view !== name;
    tabs.get(view).classList.toggle("active", view === name);
    tabs.get(view).setAttribute("aria-current", view === name ? "page" : "false");
  }

  active = name;
  // The section is visible now, so canvases finally have a measurable size.
  if (registry[name].show) registry[name].show();
  registry[name].redraw();
}

for (const [name, tab] of tabs) {
  tab.addEventListener("click", () => {
    showView(name);
    if (history.replaceState) history.replaceState(null, "", `#${name}`);
    else location.hash = name;
  });
}

window.addEventListener("hashchange", () => {
  showView(location.hash.replace(/^#/, ""));
});

/* ---------------------------------------------------------------- theme -- */

const themeToggle = document.getElementById("themeToggle");
const themeIcon = document.getElementById("themeIcon");

function prefersDark() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function applyThemeIcon() {
  const explicit = document.documentElement.dataset.theme;
  const isDark = explicit ? explicit === "dark" : prefersDark();
  themeIcon.textContent = isDark ? "☀️" : "🌙";
}

themeToggle.addEventListener("click", () => {
  const themeNow = document.documentElement.dataset.theme || (prefersDark() ? "dark" : "light");
  document.documentElement.dataset.theme = themeNow === "dark" ? "light" : "dark";
  applyThemeIcon();
  if (active) registry[active].redraw();
});

/* --------------------------------------------------------------- resize -- */

let resizeTimer = null;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (active) registry[active].redraw();
  }, 120);
});

/* ----------------------------------------------------------------- boot -- */

applyThemeIcon();
showView(location.hash.replace(/^#/, "") || DEFAULT_VIEW);
