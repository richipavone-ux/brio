// Dose maths, insulin on board and glucose forecast.
// Every number here comes from the user's settings; nothing is hardcoded medical advice.

export const MIN = 60 * 1000;

export const roundTo = (x, step) => Math.round(x / step) * step;
export const fix = (x) => Math.round(x * 100) / 100;
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const smooth = (x) => { x = clamp01(x); return x * x * (3 - 2 * x); };

// Exponential insulin action curve (same family used by OpenAPS / Loop).
// Returns the fraction of a dose still active `mins` after it was taken.
export function iobFraction(mins, diaMin) {
  if (mins <= 0) return 1;
  if (mins >= diaMin) return 0;
  const td = diaMin;
  const tp = Math.min(75, td * 0.35);
  const tau = (tp * (1 - tp / td)) / (1 - (2 * tp) / td);
  const a = (2 * tau) / td;
  const S = 1 / (1 - a + (1 + a) * Math.exp(-td / tau));
  const t = mins;
  const f = 1 - S * (1 - a) * ((t * t / (tau * td * (1 - a)) - t / tau - 1) * Math.exp(-t / tau) + 1);
  return clamp01(f);
}

// Every insulin entry the user confirmed, from meals and corrections.
export function allDoses(state) {
  const out = [];
  for (const l of state.logs) {
    if (l.kind === 'meal') for (const d of l.doses || []) out.push({ t: d.t, u: d.u, src: l });
    if (l.kind === 'dose') out.push({ t: l.t, u: l.u, src: l });
  }
  return out;
}

export function iobAt(state, at) {
  const dia = state.settings.diaMin;
  return allDoses(state).reduce((sum, d) => (d.t <= at ? sum + d.u * iobFraction((at - d.t) / MIN, dia) : sum), 0);
}

export function iobBreakdown(state, at) {
  const dia = state.settings.diaMin;
  return allDoses(state)
    .filter((d) => d.t <= at && at - d.t < dia * MIN * 1.5 && (at - d.t) < 24 * 60 * MIN)
    .map((d) => ({ ...d, left: d.u * iobFraction((at - d.t) / MIN, dia) }))
    .sort((a, b) => b.t - a.t);
}

export function iobGoneBy(state, at) {
  const dia = state.settings.diaMin;
  const active = allDoses(state).filter((d) => d.t <= at && at - d.t < dia * MIN);
  if (!active.length) return null;
  return Math.max(...active.map((d) => d.t)) + dia * MIN;
}

// Carb absorption: slower and later when the meal is fatty.
function carbFraction(mins, fatty) {
  const delay = fatty ? 15 : 10;
  const dur = fatty ? 210 : 120;
  return smooth((mins - delay) / dur);
}

export const isFatty = (s, fat) => fat >= s.fatSplit;

export function readings(state) {
  return state.logs.filter((l) => l.kind === 'bg').sort((a, b) => a.t - b.t);
}

export function lastReading(state, before = Infinity) {
  const r = readings(state).filter((l) => l.t <= before);
  return r[r.length - 1] || null;
}

// mg/dL per minute from the last two readings, if they are recent and close together.
export function trend(state, at) {
  const r = readings(state).filter((l) => l.t <= at);
  if (r.length < 2) return 0;
  const b = r[r.length - 1];
  const a = [...r].reverse().find((x) => (b.t - x.t) / MIN >= 5);
  if (!a) return 0;
  const gap = (b.t - a.t) / MIN;
  if (gap > 45 || (at - b.t) / MIN > 30) return 0;
  return (b.v - a.v) / gap;
}

// Forecast glucose at `at`, starting from a reading. Uses insulin action, carbs still
// absorbing and a fading short-term trend.
export function forecastFrom(state, base, at) {
  const s = state.settings;
  const csf = s.isf / s.icr;
  let bg = base.v;
  const t0 = base.t;
  for (const l of state.logs) {
    const carbs = l.kind === 'meal' ? l.carbs : l.kind === 'sugar' ? l.g : 0;
    if (!carbs) continue;
    const fatty = l.kind === 'meal' && isFatty(s, l.fat);
    const fast = l.kind === 'sugar';
    const f = (m) => (fast ? smooth((m - 3) / 25) : carbFraction(m, fatty));
    bg += csf * carbs * (f((at - l.t) / MIN) - f((t0 - l.t) / MIN));
  }
  for (const d of allDoses(state)) {
    const before = 1 - iobFraction((t0 - d.t) / MIN, s.diaMin);
    const after = 1 - iobFraction((at - d.t) / MIN, s.diaMin);
    bg -= s.isf * d.u * (after - before);
  }
  const tr = base.trend || 0;
  const mins = Math.max(0, (at - t0) / MIN);
  // Recent trend carries most of the next 20–25 minutes (it errs towards warning early on lows).
  bg += tr * Math.min(mins, 25) * 0.9;
  return Math.max(30, Math.min(450, bg));
}

export function forecastNow(state, now, ahead) {
  const r = lastReading(state, now);
  if (!r || (now - r.t) / MIN > 20) return null;
  return forecastFrom(state, { v: r.v, t: r.t, trend: trend(state, now) }, now + ahead * MIN);
}

export function isNight(s, now) {
  const d = new Date(now);
  const m = d.getHours() * 60 + d.getMinutes();
  const [sh, sm] = s.nightStart.split(':').map(Number);
  const [eh, em] = s.nightEnd.split(':').map(Number);
  const a = sh * 60 + sm, b = eh * 60 + em;
  return a > b ? m >= a || m < b : m >= a && m < b;
}

export const lowThreshold = (s, now) => (isNight(s, now) ? Math.max(s.low, s.nightThreshold) : s.low);

// Suggested dose for a meal.
export function plan({ carbs, fat, bg }, state, now) {
  const s = state.settings;
  const step = s.penStep;
  const cu = carbs / s.icr;
  const co = bg ? (bg - s.target) / s.isf : 0;
  const iob = iobAt(state, now);
  const raw = Math.max(0, cu + co - iob);
  let total = roundTo(raw, step);
  let capped = false;
  if (total > s.maxDose) { total = s.maxDose; capped = true; }
  const split = isFatty(s, fat) && total >= step * 4;
  const nowU = split ? roundTo(total * s.firstPct, step) : total;
  const later = fix(total - nowU);
  return {
    cu: fix(cu), co: fix(co), iob: fix(iob), raw: fix(raw), total: fix(total), capped,
    split, now: fix(nowU), later, laterAt: split ? now + s.splitDelay * MIN : null,
    low: bg && bg < s.low,
  };
}

export function correction(bg, state, now) {
  const s = state.settings;
  const co = Math.max(0, (bg - s.target) / s.isf);
  const iob = iobAt(state, now);
  const suggested = Math.min(s.maxDose, Math.max(0, roundTo(co - iob, s.penStep)));
  return { co: fix(roundTo(co, 0.1)), iob: fix(roundTo(iob, 0.1)), suggested: fix(suggested), drop: Math.round(iob * s.isf) };
}

// The steps of a meal: planned doses and glucose checks.
export function mealSteps(meal, state) {
  const steps = [];
  const first = (meal.doses || []).find((d) => d.part === 'now') || (meal.doses || [])[0];
  if (meal.plan.now > 0 || first) steps.push({ kind: 'dose', part: 'now', at: meal.t, u: first ? first.u : meal.plan.now, done: !!first });
  if (meal.plan.later > 0) {
    const d = (meal.doses || []).find((x) => x.part === 'later');
    steps.push({ kind: 'dose', part: 'later', at: meal.laterAt || meal.plan.laterAt, u: d ? d.u : meal.plan.later, done: !!d, skipped: !!meal.skippedLater });
  }
  const r = readings(state);
  for (const at of meal.checks || []) {
    const hit = r.find((x) => x.t >= at - 20 * MIN && x.t <= at + 90 * MIN);
    steps.push({ kind: 'check', at, done: !!hit, v: hit ? hit.v : null });
  }
  return steps;
}

export function mealChecks(t, laterAt) {
  return laterAt ? [t + 120 * MIN, laterAt + 120 * MIN] : [t + 120 * MIN, t + 240 * MIN];
}

export function mealStatus(meal, state, now) {
  const s = state.settings;
  const steps = mealSteps(meal, state);
  const done = steps.filter((x) => x.done || x.skipped).length;
  const end = Math.max(...steps.map((x) => x.at), meal.t + 120 * MIN);
  const closed = now > end + 60 * MIN || (done === steps.length && now > end - 10 * MIN);
  const win = readings(state).filter((x) => x.t >= meal.t && x.t <= end + 60 * MIN);
  const peak = win.length ? win.reduce((a, b) => (b.v > a.v ? b : a)) : null;
  const inRange = win.length ? Math.round((100 * win.filter((x) => x.v >= s.rangeLow && x.v <= s.rangeHigh).length) / win.length) : null;
  const missing = steps.filter((x) => x.kind === 'check' && !x.done && x.at < now).length;
  let fPeak = null;
  if (meal.bgBefore) {
    const curve = forecastCurve(meal, state, meal.t, end);
    fPeak = Math.max(...curve.map((p) => p.v));
  }
  return { steps, done, total: steps.length, closed, peak, inRange, missing, end, vsForecast: peak && fPeak ? Math.round(peak.v - fPeak) : null };
}

// Forecast as Brio saw it when the meal was logged (only that meal's carbs and doses).
export function forecastCurve(meal, state, from, to) {
  const s = state.settings;
  const plannedDoses = [{ t: meal.t, u: meal.plan.now }];
  if (meal.plan.later) plannedDoses.push({ t: meal.laterAt || meal.plan.laterAt, u: meal.plan.later });
  const view = {
    settings: s,
    logs: [{ kind: 'meal', t: meal.t, carbs: meal.carbs, fat: meal.fat, doses: plannedDoses }],
  };
  const base = { v: meal.bgBefore, t: meal.t, trend: 0 };
  const pts = [];
  const n = 24;
  for (let i = 0; i <= n; i++) {
    const at = from + ((to - from) * i) / n;
    pts.push({ t: at, v: forecastFrom(view, base, at) });
  }
  return pts;
}

export function timeInRange(list, s) {
  if (!list.length) return null;
  return Math.round((100 * list.filter((x) => x.v >= s.rangeLow && x.v <= s.rangeHigh).length) / list.length);
}
