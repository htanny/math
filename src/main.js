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
import { initFractionView } from "./views/fraction.js";
import { initRateView } from "./views/rate.js";
import { initCircleAreaView } from "./views/circlearea.js";
import { initNetView } from "./views/net.js";
import { initSectionView } from "./views/section.js";
import { initMotionView } from "./views/motion.js";
import { initLinearView } from "./views/linear.js";
import { initQuadraticView } from "./views/quadratic.js";
import { initSimilarView } from "./views/similar.js";
import { initProbabilityView } from "./views/probability.js";
import { initPythagorasView } from "./views/pythagoras.js";
import { initConicView } from "./views/conic.js";
import { initComplexView } from "./views/complex.js";
import { initCltView } from "./views/clt.js";

const VIEWS = [
  "fraction",
  "rate",
  "circlearea",
  "net",
  "section",
  "motion",
  "linear",
  "quadratic",
  "similar",
  "probability",
  "inscribed",
  "pythagoras",
  "unitcircle",
  "calculus",
  "calculusDeep",
  "calculusAdv",
  "conic",
  "complex",
  "clt",
  "collatz",
  "aliquot",
  "logistic",
  "modmul",
  "langton",
  "goldbach",
  "continued",
  "zeta",
];
const DEFAULT_VIEW = "fraction";

const registry = {
  fraction: initFractionView(),
  rate: initRateView(),
  circlearea: initCircleAreaView(),
  net: initNetView(),
  section: initSectionView(),
  motion: initMotionView(),
  linear: initLinearView(),
  quadratic: initQuadraticView(),
  similar: initSimilarView(),
  probability: initProbabilityView(),
  inscribed: initInscribedView(),
  pythagoras: initPythagorasView(),
  conic: initConicView(),
  complex: initComplexView(),
  clt: initCltView(),
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

/* ------------------------------------------------------------------- nav -- */

const nav = document.getElementById("tabNav");
const navToggle = document.getElementById("navToggle");
const navCurrent = document.getElementById("navCurrent");
const tabSearch = document.getElementById("tabSearch");
const tabSearchEmpty = document.getElementById("tabSearchEmpty");

/** Is the tab list currently collapsed behind the button? (phone widths only) */
const isSheet = () => window.matchMedia("(max-width: 640px)").matches;

function setNavOpen(open) {
  nav.hidden = isSheet() ? !open : false;
  navToggle.setAttribute("aria-expanded", String(open && isSheet()));
}

function applyFilter() {
  const q = tabSearch.value.trim().toLowerCase();
  let shown = 0;
  for (const group of nav.querySelectorAll(".tab-group")) {
    let hits = 0;
    for (const tab of group.querySelectorAll(".tab")) {
      const hit = !q || tab.textContent.toLowerCase().includes(q);
      tab.hidden = !hit;
      if (hit) hits++;
    }
    group.hidden = hits === 0;
    shown += hits;
  }
  tabSearchEmpty.hidden = shown > 0;
}

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
  navCurrent.textContent = tabs.get(name).textContent.trim();
  // The section is visible now, so canvases finally have a measurable size.
  if (registry[name].show) registry[name].show();
  registry[name].redraw();
}

for (const [name, tab] of tabs) {
  tab.addEventListener("click", () => {
    showView(name);
    if (history.replaceState) history.replaceState(null, "", `#${name}`);
    else location.hash = name;
    if (isSheet()) setNavOpen(false);
  });
}

navToggle.addEventListener("click", () => {
  const open = navToggle.getAttribute("aria-expanded") !== "true";
  setNavOpen(open);
  if (open) tabSearch.focus();
});

tabSearch.addEventListener("input", applyFilter);
tabSearch.addEventListener("keydown", (evt) => {
  if (evt.key !== "Enter") return;
  // Enter on a filtered list picks the only remaining theme — the fast path
  const left = [...nav.querySelectorAll(".tab")].filter((t) => !t.hidden);
  if (left.length === 1) left[0].click();
});

document.addEventListener("keydown", (evt) => {
  if (evt.key !== "Escape" || !isSheet()) return;
  if (navToggle.getAttribute("aria-expanded") !== "true") return;
  setNavOpen(false);
  navToggle.focus();
});

document.addEventListener("pointerdown", (evt) => {
  if (!isSheet() || navToggle.getAttribute("aria-expanded") !== "true") return;
  if (nav.contains(evt.target) || navToggle.contains(evt.target)) return;
  setNavOpen(false);
});

// crossing the breakpoint must not leave the list hidden on a wide screen
window.matchMedia("(max-width: 640px)").addEventListener("change", () => {
  setNavOpen(false);
});

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
applyFilter();
setNavOpen(false);
showView(location.hash.replace(/^#/, "") || DEFAULT_VIEW);
