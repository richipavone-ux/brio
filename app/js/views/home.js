import { S, UI, now, views, actions, go, openSheet, commit, meal as findMeal, toast } from '../ctx.js';
import { t, tn } from '../i18n.js';
import { orb, esc, hm, u, dur, ringSvg, scale, path } from '../ui.js';
import { MIN, mealStatus, readings } from '../calc.js';
import { sentence, agenda, glucoseNow, iobNow, liveMeals, todaysLogs } from '../brain.js';
import { hypoView, hypoActive } from './hypo.js';

export const ACTION_LABEL = {
  now: 'What matters now', meal: 'New meal', glucose: 'Log glucose', talk: 'Talk to Brio',
  week: 'Your week', repeat: 'Repeat last meal', memory: 'Memory', none: 'Nothing',
};
const HINT_LABEL = {
  now: 'what now', meal: 'new meal', glucose: 'log glucose', talk: 'talk to me',
  week: 'your week', repeat: 'repeat last meal', memory: 'memory',
};

export function topBar({ dark = false } = {}) {
  const s = S.settings;
  const g = glucoseNow();
  const iob = iobNow();
  const pill = dark ? 'pill-glass dark' : 'pill-glass';
  let left = `<button class="icon-btn" data-act="settings" aria-label="${esc(t('Settings'))}"><i class="i-circle"></i></button>`;
  if (s.show.iob && iob >= 0.1) {
    const frac = Math.min(1, iob / Math.max(1, iobPeak()));
    left += `<button class="${pill} iob-pill" data-act="iob" aria-label="${esc(t('Insulin on board'))}">${ringSvg(16, 2.5, frac, '#7c4dff', '#e6e3fb')}<b>${u(iob)} U</b></button>`;
  }
  let right = '';
  if (s.show.glucose) {
    right = g
      ? `<button class="${pill}" data-act="glucose"><b style="font-size:16px;color:${g.stale ? 'var(--muted)' : g.color}">${g.v}</b><span class="unit">mg/dL</span>${g.arrow ? `<b style="color:${g.arrowColor}">${g.arrow}</b>` : ''}${g.stale ? `<span class="unit">· ${dur(g.age)}</span>` : ''}</button>`
      : `<button class="${pill}" data-act="glucose"><b style="font-size:14px">+ ${esc(t('Glucose'))}</b></button>`;
  }
  return `<div class="topbar"><div class="topbar-l">${left}</div>${right}</div>`;
}

// The IOB ring empties from the largest recent dose down to zero.
function iobPeak() {
  const at = now();
  return S.logs.flatMap((l) => (l.kind === 'meal' ? l.doses || [] : l.kind === 'dose' ? [l] : []))
    .filter((d) => d.t <= at && at - d.t < S.settings.diaMin * MIN)
    .reduce((a, d) => a + d.u, 0) || 1;
}

function hints() {
  const s = S.settings;
  if (!s.hints) return '';
  const chips = ['tap', 'double', 'hold']
    .filter((g) => s.gestures[g] !== 'none' && (s.uses[g] || 0) < 3)
    .map((g) => `<div class="hint"><b>${esc(t(g === 'tap' ? 'Tap' : g === 'double' ? 'Double tap' : 'Hold'))}</b> ${esc(t(HINT_LABEL[s.gestures[g]]))}</div>`);
  return chips.length ? `<div class="hints">${chips.join('')}</div>` : '';
}

export function nowCard() {
  const at = now();
  const list = agenda(at);
  const next = list[0];
  const then = list[1];
  let body;
  const badge = (x) => {
    const m = Math.round((x.at - at) / MIN);
    const label = m > 1 ? t('in {d}', { d: dur(m) }) : m >= -2 ? t('now') : t('{d} late', { d: dur(-m) });
    return `<div class="badge${m < -2 ? ' late' : ''}">${esc(label)}</div>`;
  };
  if (!next) {
    body = `<div class="now-head"><div><div class="now-title">${esc(t('Nothing to do'))}</div><div class="now-sub">${esc(t("I'll tell you when something comes up."))}</div></div></div>
      <div class="btn-row"><button class="btn dark" style="flex:1.3" data-act="newMeal">${esc(t('New meal'))}</button><button class="btn" data-act="glucose">${esc(t('Log glucose'))}</button></div>`;
  } else if (next.kind === 'dose') {
    body = `<div class="now-head"><div><div class="now-title">${esc(t('{u} U at {time}', { u: u(next.u), time: hm(next.at) }))}</div><div class="now-sub">${esc(t('{meal}, second part', { meal: next.meal.name }))}</div></div>${badge(next)}</div>
      <div class="btn-row"><button class="btn dark" style="flex:1.3" data-act="tookLater" data-id="${next.meal.id}">${esc(t('Took it'))}</button><button class="btn" data-act="changeLater" data-id="${next.meal.id}">${esc(t('Change'))}</button></div>`;
  } else {
    const sub = next.kind === 'recheck' ? t('After waiting on a high') : t('{meal} · {h} h check', { meal: next.meal.name, h: Math.round((next.at - next.meal.t) / 60 / MIN) });
    body = `<div class="now-head"><div><div class="now-title">${esc(t('Check glucose'))}</div><div class="now-sub">${esc(sub)}</div></div>${badge(next)}</div>
      <div class="btn-row"><button class="btn dark" style="flex:1.3" data-act="glucose" data-check="${esc(next.key)}">${esc(t('Log it'))}</button><button class="btn" data-act="skipCheck" data-key="${esc(next.key)}">${esc(t('Skip'))}</button></div>`;
  }
  const g = glucoseNow(at);
  const high = g && !g.stale && g.age < 30 && g.v > S.settings.rangeHigh;
  const corr = high ? `<button class="now-then link-row" data-act="correct"><span>${esc(t('Glucose {v}: thinking of correcting?', { v: g.v }))}</span><b>›</b></button>` : '';
  const thenRow = then ? `<div class="now-then"><span>${esc(then.kind === 'dose' ? t('Then: {u} U', { u: u(then.u) }) : t('Then: check glucose'))}</span><b>${hm(then.at)}</b></div>` : '';
  return `<div class="now-card"><div class="eyebrow">${esc(t('WHAT MATTERS NOW'))}</div>${body}${thenRow}${corr}</div>`;
}

function mealTimeline(m) {
  const st = mealStatus(m, S, now());
  const next = st.steps.find((x) => !x.done && !x.skipped);
  const cells = st.steps.map((x) => {
    const color = x.done ? 'var(--green)' : x.skipped ? '#c0c6d0' : x === next ? 'var(--purple)' : '#e4e7ec';
    const label = x.kind === 'dose' ? `${u(x.u)} U` : t('Check');
    return `<div class="tl-cell"><div class="tl-bar" style="background:${color}"></div><span><b>${esc(label)}</b> ${hm(x.at)}</span></div>`;
  }).join('');
  return `<button class="meal-tl" data-act="openMeal" data-id="${m.id}"><div class="meal-tl-head"><b>${esc(m.name)}</b><span>${esc(t('{a} of {b} done', { a: st.done, b: st.total }))}</span></div>
    <div class="tl" style="grid-template-columns:repeat(${st.steps.length},1fr)">${cells}</div></button>`;
}

function chart24() {
  const at = now();
  const from = at - 24 * 60 * MIN;
  const pts = readings(S).filter((r) => r.t >= from).map((r) => ({ t: r.t, v: r.v }));
  const s = S.settings;
  const W = 338, H = 96;
  const sc = scale(from, at, 40, 300, W, H);
  const band = `<rect x="0" y="${sc.y(s.rangeHigh)}" width="${W}" height="${sc.y(s.rangeLow) - sc.y(s.rangeHigh)}" fill="#e9f6ef" rx="6"/>`;
  const line = pts.length > 1 ? `<path d="${path(pts, sc)}" fill="none" stroke="#10151f" stroke-width="2.2" stroke-linejoin="round"/>` : '';
  const dots = pts.map((p) => `<circle cx="${sc.x(p.t).toFixed(1)}" cy="${sc.y(p.v).toFixed(1)}" r="2.6" fill="${p.v < s.low ? '#dc2626' : '#10151f'}"/>`).join('');
  const meals = S.logs.filter((l) => l.kind === 'meal' && l.t >= from).map((l) => `<circle cx="${sc.x(l.t).toFixed(1)}" cy="${H + 8}" r="4" fill="#fff" stroke="#5b3fd6" stroke-width="1.5"/>`).join('');
  const ticks = [-24, -18, -12, -6].map((h) => `<span>${hm(at + h * 60 * MIN)}</span>`).join('') + `<span>${esc(t('Now'))}</span>`;
  return `<div class="glass-card"><div class="card-head"><b>${esc(t('Last 24 h'))}</b><span>${pts.length ? esc(t('{n}% in range', { n: Math.round(100 * pts.filter((p) => p.v >= s.rangeLow && p.v <= s.rangeHigh).length / pts.length) })) : ''}</span></div>
    <svg viewBox="0 0 ${W} ${H + 14}" width="100%" style="display:block;overflow:visible">${band}${line}${dots}${meals}</svg>
    <div class="axis">${ticks}</div></div>`;
}

export function logRow(l) {
  if (l.kind === 'meal') {
    const st = mealStatus(l, S, now());
    const taken = (l.doses || []).reduce((a, d) => a + d.u, 0);
    return `<button class="list-row" data-act="openMeal" data-id="${l.id}"><span class="lr-time">${hm(l.t)}</span><div class="lr-main"><div class="lr-title">${esc(l.name)}</div><div class="lr-sub">${esc(t('{c} g carbs · {u} U', { c: Math.round(l.carbs), u: u(taken) }))}</div></div>${ringSvg(26, 3, st.done / Math.max(1, st.total), st.closed ? 'var(--green)' : 'var(--purple)')}</button>`;
  }
  if (l.kind === 'bg') {
    return `<button class="list-row" data-act="editBg" data-id="${l.id}"><span class="lr-time">${hm(l.t)}</span><div class="lr-main"><div class="lr-title">${esc(t('Glucose {v}', { v: l.v }))}</div><div class="lr-sub">${esc(l.note || t('mg/dL'))}</div></div><span class="chev">›</span></button>`;
  }
  if (l.kind === 'dose') {
    return `<button class="list-row" data-act="editDose" data-id="${l.id}"><span class="lr-time">${hm(l.t)}</span><div class="lr-main"><div class="lr-title">${esc(t('{u} U correction', { u: u(l.u) }))}</div><div class="lr-sub">${esc(t('Rapid insulin'))}</div></div><span class="chev">›</span></button>`;
  }
  if (l.kind === 'sugar') {
    return `<div class="list-row"><span class="lr-time">${hm(l.t)}</span><div class="lr-main"><div class="lr-title">${esc(t('{g} g fast sugar', { g: l.g }))}</div><div class="lr-sub">${esc(t('Low treatment'))}</div></div></div>`;
  }
  return '';
}

views.home = () => {
  if (hypoActive()) return hypoView();
  const s = S.settings;
  const sen = sentence();
  const live = liveMeals();
  const showLogs = s.show.todayLogs;
  const showChart = s.show.chart24;
  const compact = showLogs || showChart;
  const card = UI.card;
  const size = card ? 104 : compact ? 112 : 150;
  const logs = todaysLogs();
  const ringSize = Math.round(size * 1.43);

  const orbBlock = `<div class="orb-zone${card ? ' open' : ''}" style="margin-top:${card ? 'clamp(16px,6vh,56px)' : compact ? 'clamp(16px,4vh,40px)' : 'clamp(40px,13vh,110px)'}">
    <div class="orb-hit" data-orb tabindex="0" role="button" aria-label="${esc(s.name)}" style="width:${ringSize}px;height:${ringSize}px">
      <svg class="hold-ring" width="${ringSize}" height="${ringSize}" aria-hidden="true"><circle cx="${ringSize / 2}" cy="${ringSize / 2}" r="${ringSize / 2 - 3}" fill="none" stroke="rgba(124,77,255,.15)" stroke-width="4"/><circle class="hold-prog" cx="${ringSize / 2}" cy="${ringSize / 2}" r="${ringSize / 2 - 3}" fill="none" stroke="#7c4dff" stroke-width="4" stroke-linecap="round" stroke-dasharray="0 999"/></svg>
      ${orb(size, { eyes: card ? 'happy' : 'open' })}
    </div></div>`;

  let middle;
  if (card) {
    middle = `${nowCard()}<div class="close-hint">${esc(t('Tap the orb again to close'))}</div>`;
  } else {
    middle = `<div class="sentence${compact ? ' small' : ''}">${esc(sen.main)}</div>${sen.sub ? `<div class="sentence-sub">${esc(sen.sub)}</div>` : ''}`;
    if (showChart) middle += `<div style="align-self:stretch;margin-top:18px">${chart24()}</div>`;
    if (showLogs) {
      middle += `<div class="glass-card list" style="align-self:stretch;margin-top:12px"><div class="card-head"><b>${esc(t('Today'))}</b><span>${esc(tn(logs.length, '1 log', '{n} logs'))}</span></div>${logs.length ? logs.map(logRow).join('') : `<div class="empty">${esc(t('Nothing logged yet today.'))}</div>`}</div>`;
    }
  }

  const bottom = !card && live.length ? `<div style="align-self:stretch;margin-top:${compact ? '12px' : 'auto'};display:flex;flex-direction:column;gap:8px">${live.slice(0, 2).map(mealTimeline).join('')}</div>` : '';
  const hint = !card && !live.length ? `<div style="margin-top:${compact ? '16px' : 'auto'}">${hints()}</div>` : '';

  return `<div class="screen home-bg" data-swipe>
    ${topBar()}
    <div class="scroll home-scroll${compact ? '' : ' fill'}">
      <div class="home-col">${orbBlock}${middle}${bottom}${hint}</div>
    </div>
    <button class="grabber" data-act="gesture" data-g="swipe" aria-label="${esc(t(ACTION_LABEL[s.gestures.swipe]))}"><i></i><span>${esc(tn(logs.length, 'Today · 1 log', 'Today · {n} logs'))}</span></button>
  </div>`;
};

// ---- Actions ---------------------------------------------------------------
actions.settings = () => go('settings');
actions.openMeal = (el) => go('meal', +el.dataset.id);

actions.tookLater = (el) => {
  const m = findMeal(+el.dataset.id);
  if (!m) return;
  m.doses.push({ part: 'later', u: m.plan.later, t: now() });
  UI.card = false;
  commit();
  toast(t('Logged {u} U.', { u: u(m.plan.later) }));
};

actions.changeLater = (el) => openSheet('laterDose', { id: +el.dataset.id });

actions.skipCheck = (el) => {
  const key = el.dataset.key;
  if (key.startsWith('r:')) {
    const r = S.reminders.find((x) => 'r:' + x.id === key);
    if (r) r.done = true;
  } else {
    const [id, , at] = key.split(':');
    const m = findMeal(+id);
    if (m) { m.checks = m.checks.filter((c) => String(c) !== at); }
  }
  commit();
};
