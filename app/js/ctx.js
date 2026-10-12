// Shared app context: state, navigation and the action registry.
import { load, save } from './store.js';

export const S = load();

// UI state that is not persisted.
export const UI = {
  view: 'home', arg: null, stack: [],
  sheet: null,         // { type, ...data }
  sheetStack: [],
  card: false,         // "what matters now" open on home
  toast: '',
  memTab: 'meals',
  expand: {},          // expanded rows on the meal detail
  clock: null,         // set in demo/tests to freeze time
};

// `?at=13:42` starts the clock at that time today (demos, screenshots, tests); time then runs normally.
const OFFSET = (() => {
  const m = /[?&]at=(\d{1,2}):(\d{2})/.exec(location.search);
  if (!m) return 0;
  const d = new Date(); d.setHours(+m[1], +m[2], 0, 0);
  return d.getTime() - Date.now();
})();
export const now = () => UI.clock ?? Date.now() + OFFSET;

export const actions = {};
export const inputs = {};   // live handlers for sheets: inputs[sheetType](key, value, el)
export const views = {};    // views[name](arg) -> html
export const sheets = {};   // sheets[type](sheet) -> { html, size }

let renderFn = () => {};
export const setRender = (fn) => { renderFn = fn; };
export const render = () => renderFn();

export function commit() { save(S); render(); }
export const persist = () => save(S);

export function go(view, arg = null) {
  UI.stack.push({ view: UI.view, arg: UI.arg });
  UI.view = view; UI.arg = arg; UI.sheet = null; UI.sheetStack = []; UI.card = false; UI.expand = {};
  render();
  document.querySelector('.scroll')?.scrollTo(0, 0);
}

export function back() {
  const prev = UI.stack.pop() || { view: 'home', arg: null };
  UI.view = prev.view; UI.arg = prev.arg; UI.expand = {};
  render();
}

export function home() {
  UI.stack = []; UI.view = 'home'; UI.arg = null; UI.sheet = null; UI.sheetStack = [];
  render();
}

export function openSheet(type, data = {}) {
  if (UI.sheet) UI.sheetStack.push(UI.sheet);
  UI.sheet = { type, draft: {}, ...data };
  render();
}

// Replace the current sheet (a step forward in the same flow).
export function swapSheet(type, data = {}) {
  UI.sheet = { type, draft: {}, ...data };
  render();
}

export function closeSheet() {
  UI.sheet = UI.sheetStack.pop() || null;
  render();
}

export function closeAllSheets() {
  UI.sheet = null; UI.sheetStack = [];
  render();
}

let toastTimer;
export function toast(msg) {
  UI.toast = msg;
  render();
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { UI.toast = ''; render(); }, 2400);
}

export const meal = (id) => S.logs.find((l) => l.id === id && l.kind === 'meal');
export const log = (id) => S.logs.find((l) => l.id === id);
