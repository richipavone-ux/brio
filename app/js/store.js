import { MIN, plan, mealChecks } from './calc.js';
import { t } from './i18n.js';

const KEY = 'brio.v3';

export const PRESETS = {
  simple: { glucose: true, iob: true, todayLogs: false, chart24: false },
  balanced: { glucose: true, iob: true, todayLogs: true, chart24: false },
  everything: { glucose: true, iob: true, todayLogs: true, chart24: true },
};

export const GESTURE_ACTIONS = ['now', 'meal', 'glucose', 'talk', 'week', 'repeat', 'memory', 'none'];

export function defaultSettings() {
  return {
    lang: (navigator.language || 'en').toLowerCase().startsWith('it') ? 'it' : 'en',
    onboarded: false,
    preset: 'simple',
    show: { ...PRESETS.simple },
    gestures: { tap: 'now', double: 'meal', hold: 'week', swipe: 'memory' },
    hints: true,
    uses: { tap: 0, double: 0, hold: 0, swipe: 0 },
    talk: 'short',
    name: 'Brio',
    notify: 'doses',
    lastInput: 'photo',
    // Treatment plan: the user sets these with their care team.
    icr: 10, isf: 40, target: 110, diaMin: 240,
    penStep: 0.5, maxDose: 15, fatSplit: 20, firstPct: 0.4, splitDelay: 90,
    rangeLow: 70, rangeHigh: 180,
    planCheckedOn: null,
    // Low alerts
    headingLow: true, low: 70, urgentLow: 55,
    critical: true, nightThreshold: 80, nightStart: '23:00', nightEnd: '07:00',
    contactName: '', contactPhone: '', shareLocation: true,
  };
}

export function load() {
  let raw = null;
  try { raw = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { raw = null; }
  const settings = { ...defaultSettings(), ...(raw?.settings || {}) };
  settings.show = { ...PRESETS.simple, ...(raw?.settings?.show || {}) };
  settings.gestures = { ...defaultSettings().gestures, ...(raw?.settings?.gestures || {}) };
  settings.uses = { ...defaultSettings().uses, ...(raw?.settings?.uses || {}) };
  return {
    settings,
    logs: raw?.logs || [],
    foods: raw?.foods || [],
    hypo: raw?.hypo || null,
    reminders: raw?.reminders || [],
    notified: raw?.notified || {},
    nextId: raw?.nextId || 1,
  };
}

let saveErr = false;
export function save(state) {
  const { settings, logs, foods, hypo, reminders, notified, nextId } = state;
  try {
    localStorage.setItem(KEY, JSON.stringify({ settings, logs, foods, hypo, reminders, notified, nextId }));
    saveErr = false;
  } catch {
    // Storage full: drop meal photos first, they are the heavy part.
    if (!saveErr) {
      saveErr = true;
      for (const l of logs) if (l.photo) delete l.photo;
      save(state);
    }
  }
}

export const newId = (state) => state.nextId++;

export function exportJSON(state) {
  const { settings, logs, foods } = state;
  return JSON.stringify({ app: 'Brio', version: 3, exportedAt: new Date().toISOString(), settings, logs, foods }, null, 2);
}

// An example day, the one used in the designs: pizza at 13:10 with a split dose.
export function exampleDay(state, now = Date.now()) {
  const day = new Date(now); day.setHours(0, 0, 0, 0);
  const T = (h, m, d = 0) => day.getTime() + ((h * 60 + m) - d * 1440) * MIN;
  const logs = [];
  let id = 1;
  const meal = (at, name, items, bg, dosesTaken, opts = {}) => {
    const carbs = items.reduce((a, i) => a + i.carbs, 0);
    const fat = items.reduce((a, i) => a + i.fat, 0);
    const protein = items.reduce((a, i) => a + i.protein, 0);
    const view = { settings: state.settings, logs: logs.filter((l) => l.t < at) };
    const p = plan({ carbs, fat, bg }, view, at);
    const doses = dosesTaken.map(([part, u, when]) => ({ part, u, t: when }));
    const m = {
      id: id++, kind: 'meal', t: at, name: t(name), items, portion: 1, carbs, fat, protein, bgBefore: bg, plan: p,
      laterAt: p.laterAt, checks: mealChecks(at, p.laterAt), doses, favorite: false, note: '', ...opts,
    };
    logs.push(m);
    return m;
  };
  const bg = (at, v, note = '') => logs.push({ id: id++, kind: 'bg', t: at, v, note: note && t(note) });
  const I = (name, carbs, fat, protein, portion) => ({ name: t(name), carbs, fat, protein, portion: t(portion), base: { carbs, fat, protein }, mult: 1 });

  // Yesterday
  bg(T(8, 20, 1), 118);
  meal(T(8, 30, 1), 'Cappuccino and croissant', [I('Cappuccino', 9, 6, 6, '1 cup'), I('Croissant', 36, 12, 5, '1 piece')], 118, [['now', 4.5, T(8, 30, 1)]]);
  bg(T(10, 30, 1), 212); bg(T(12, 30, 1), 142);
  meal(T(16, 0, 1), 'Apple', [I('Apple', 20, 0, 0, '1 medium')], 104, []);
  bg(T(18, 0, 1), 121);
  bg(T(20, 5, 1), 109);
  meal(T(20, 15, 1), 'Pasta al pomodoro', [I('Pasta', 66, 2, 11, '90 g dry'), I('Tomato sauce', 4, 3, 1, '100 g')], 109, [['now', 7, T(20, 15, 1)]]);
  bg(T(22, 15, 1), 151); bg(T(0, 15, 0), 124);

  // Today
  const nowMin = (now - day.getTime()) / MIN;
  const at = (h, m) => (h * 60 + m <= nowMin ? T(h, m) : null);
  if (at(7, 50)) bg(T(7, 50), 112, 'Waking up');
  if (at(8, 5)) meal(T(8, 5), 'Yogurt and granola', [I('Greek yogurt', 6, 5, 15, '170 g'), I('Granola', 32, 6, 4, '45 g')], 112, [['now', 4, T(8, 5)]]);
  if (at(10, 5)) bg(T(10, 5), 138);
  if (at(12, 10)) bg(T(12, 10), 104);
  if (at(13, 5)) bg(T(13, 5), 128, 'Before lunch');
  if (at(13, 10)) {
    meal(T(13, 10), 'Pizza margherita', [I('Pizza base and sauce', 90, 14, 20, 'Whole · ~320 g'), I('Mozzarella', 2, 20, 8, '~110 g'), I('Coca-Cola Zero', 0, 0, 0, '33 cl')], 128, [['now', 4, T(13, 10)]]);
  }
  if (at(13, 40)) bg(T(13, 40), 156);

  state.logs = logs;
  state.nextId = id;
  state.hypo = null;
  state.reminders = [];
  state.notified = {};
}
