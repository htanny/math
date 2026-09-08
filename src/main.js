import "./style.css";
/**
 * Each view is fetched the first time it is opened.
 *
 * Loading all 27 up front cost about 144ms of initialisation on a mid-range
 * phone before anything was drawn — and 26 of those views were for tabs the
 * reader had not asked for. `import()` also lets the bundler split them out,
 * so the first paint no longer waits on code for the other 26 either.
 */
const registry = {
  fraction: () => import("./views/fraction.js").then((m) => m.initFractionView),
  rate: () => import("./views/rate.js").then((m) => m.initRateView),
  circlearea: () => import("./views/circlearea.js").then((m) => m.initCircleAreaView),
  net: () => import("./views/net.js").then((m) => m.initNetView),
  section: () => import("./views/section.js").then((m) => m.initSectionView),
  motion: () => import("./views/motion.js").then((m) => m.initMotionView),
  linear: () => import("./views/linear.js").then((m) => m.initLinearView),
  quadratic: () => import("./views/quadratic.js").then((m) => m.initQuadraticView),
  similar: () => import("./views/similar.js").then((m) => m.initSimilarView),
  roots: () => import("./views/roots.js").then((m) => m.initRootsView),
  expand: () => import("./views/expand.js").then((m) => m.initExpandView),
  probability: () => import("./views/probability.js").then((m) => m.initProbabilityView),
  inscribed: () => import("./views/inscribed.js").then((m) => m.initInscribedView),
  pythagoras: () => import("./views/pythagoras.js").then((m) => m.initPythagorasView),
  unitcircle: () => import("./views/unitcircle.js").then((m) => m.initUnitCircleView),
  calculus: () => import("./views/calculus.js").then((m) => m.initCalculusView),
  calculusDeep: () => import("./views/calculusDeep.js").then((m) => m.initCalculusDeepView),
  calculusAdv: () => import("./views/calculusAdv.js").then((m) => m.initCalculusAdvView),
  conic: () => import("./views/conic.js").then((m) => m.initConicView),
  complex: () => import("./views/complex.js").then((m) => m.initComplexView),
  clt: () => import("./views/clt.js").then((m) => m.initCltView),
  collatz: () => import("./views/collatz.js").then((m) => m.initCollatzView),
  aliquot: () => import("./views/aliquot.js").then((m) => m.initAliquotView),
  logistic: () => import("./views/logistic.js").then((m) => m.initLogisticView),
  modmul: () => import("./views/modmul.js").then((m) => m.initModmulView),
  langton: () => import("./views/langton.js").then((m) => m.initLangtonView),
  goldbach: () => import("./views/goldbach.js").then((m) => m.initGoldbachView),
  continued: () => import("./views/continued.js").then((m) => m.initContinuedView),
  zeta: () => import("./views/zeta.js").then((m) => m.initZetaView),
};

/** Views already fetched and initialised, by name. */
const live = new Map();

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
  "roots",
  "expand",
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

/** Fetch and initialise a view, or hand back the one already running. */
async function load(name) {
  if (live.has(name)) return live.get(name);
  const init = await registry[name]();
  // Two clicks in a row can both get here for the same view; keep the first.
  if (!live.has(name)) live.set(name, init());
  return live.get(name);
}

async function showView(name) {
  if (!VIEWS.includes(name)) name = DEFAULT_VIEW;
  if (name === active) return;

  const leaving = live.get(active);
  if (leaving && leaving.hide) leaving.hide();

  for (const view of VIEWS) {
    sections.get(view).hidden = view !== name;
    tabs.get(view).classList.toggle("active", view === name);
    tabs.get(view).setAttribute("aria-current", view === name ? "page" : "false");
  }

  active = name;
  navCurrent.textContent = tabs.get(name).textContent.trim();

  const view = await load(name);
  // The reader may have moved on while this was being fetched; if so the newer
  // showView owns the screen and this one must not draw over it.
  if (active !== name) return;
  // The section is visible now, so canvases finally have a measurable size.
  if (view.show) view.show();
  view.redraw();
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
  const view = live.get(active);
  if (view) view.redraw();
});

/* --------------------------------------------------------------- resize -- */

let resizeTimer = null;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    const view = live.get(active);
    if (view) view.redraw();
  }, 120);
});

/* ----------------------------------------------------------------- boot -- */

applyThemeIcon();
applyFilter();
setNavOpen(false);
showView(location.hash.replace(/^#/, "") || DEFAULT_VIEW);
