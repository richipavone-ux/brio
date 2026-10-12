import { S, UI, now, views, actions, inputs, sheets, render, commit, openSheet, closeAllSheets, home, toast } from '../ctx.js';
import { t, tn } from '../i18n.js';
import { orb, esc, hm, u, num, dayLabel, ringSvg, row, chev } from '../ui.js';
import { MIN, mealStatus, readings, timeInRange } from '../calc.js';
import { meals } from '../brain.js';
import { library, search } from '../foods.js';
import { PLAN_FIELDS, planValue } from './settings.js';

function mealRow(m, first) {
  const st = mealStatus(m, S, now());
  const totalU = (m.doses || []).reduce((a, d) => a + d.u, 0);
  let label, color;
  if (!st.closed) { label = t('Live'); color = 'var(--purple)'; }
  else if (st.missing) { label = tn(st.missing, '1 check missing', '{n} checks missing'); color = 'var(--faint)'; }
  else if (st.peak && st.peak.v > S.settings.rangeHigh) { label = t('Peaked {v}', { v: st.peak.v }); color = 'var(--amber)'; }
  else if (st.peak && st.peak.v < S.settings.low) { label = t('Went low'); color = 'var(--red)'; }
  else { label = t('In range'); color = 'var(--green)'; }
  const frac = st.total ? st.done / st.total : 1;
  return `<button class="mem-row${first ? '' : ' bt'}" data-act="openMeal" data-id="${m.id}" data-hold="mealMenu">${ringSvg(32, 3.5, frac, color)}<div class="mem-main"><div class="mem-title">${m.favorite ? '★ ' : ''}${esc(m.name)}</div><div class="mem-sub">${esc(`${hm(m.t)} · ${Math.round(m.carbs)} g · ${u(totalU)} U`)}</div></div><span class="mem-status" style="color:${color}">${esc(label)}</span></button>`;
}

function mealsTab() {
  const list = meals();
  if (!list.length) return `<div class="empty big">${orb(48)}<div>${esc(t('No meals yet. Double tap the orb when you eat and I will start remembering.'))}</div></div>`;
  const groups = [];
  for (const m of list.slice(0, 120)) {
    const label = dayLabel(m.t, now());
    if (!groups.length || groups[groups.length - 1].label !== label) groups.push({ label, items: [] });
    groups[groups.length - 1].items.push(m);
  }
  return groups.map((g) => `<div class="day-label">${esc(g.label)}</div><div class="white-list">${g.items.map((m, i) => mealRow(m, i === 0)).join('')}</div>`).join('')
    + `<div class="foot-note">${esc(t('The ring fills as you log the checks. Hold a meal to repeat it or mark it as a favorite.'))}</div>`;
}

function foodsTab() {
  const q = UI.foodQ || '';
  const list = q ? search(S, q, 30) : library(S);
  const mine = list.filter((f) => !f.builtin), base = list.filter((f) => f.builtin);
  const frow = (f, i) => `<button class="mem-row${i ? ' bt' : ''}" data-act="editFood" data-key="${esc(f.key)}"><div class="mem-main"><div class="mem-title">${esc(f.name)}</div><div class="mem-sub">${esc(f.portion || tn(f.parts?.length || 1, '1 item', '{n} items'))}</div></div><span class="mem-status">${Math.round(f.carbs)} g</span>${chev}</button>`;
  return `<div class="search solo"><input data-k="foodQ" value="${esc(q)}" placeholder="${esc(t('Search foods'))}" autocomplete="off"></div>
    ${mine.length ? `<div class="day-label">${esc(t('Yours'))}</div><div class="white-list">${mine.map(frow).join('')}</div>` : ''}
    <div class="day-label">${esc(t('Brio knows'))}</div><div class="white-list">${base.slice(0, q ? 30 : 60).map(frow).join('')}</div>
    <button class="btn wide" data-act="newFood" style="margin-top:4px">${esc(t('+ Add a food'))}</button>
    <div class="foot-note">${esc(t('Carbs are for the portion shown. Change any of them to match what you eat.'))}</div>`;
}

function numbersTab() {
  const s = S.settings;
  const r = readings(S).filter((x) => now() - x.t < 14 * 24 * 60 * MIN);
  const avg = r.length ? Math.round(r.reduce((a, x) => a + x.v, 0) / r.length) : null;
  const tir = timeInRange(r, s);
  return `<div class="stats3 card"><div><b>${tir ?? '—'}${tir != null ? '%' : ''}</b>${esc(t('in range, 14 days'))}</div><div><b>${avg ?? '—'}</b>${esc(t('average'))}</div><div><b>${r.length}</b>${esc(t('readings'))}</div></div>
    <div class="day-label">${esc(t('YOUR TREATMENT PLAN'))}</div>
    <div class="white-list">${PLAN_FIELDS.map((f, i) => row(esc(t(f.label)), `${esc(planValue(f))}${chev}`, { act: 'editNum', attrs: `data-key="${f.key}"`, cls: i ? 'bt' : '' })).join('')}</div>
    <div class="foot-note">${esc(s.planCheckedOn ? t('Checked with your care team on {d}. Changes ask you to confirm twice.', { d: new Date(s.planCheckedOn).toLocaleDateString(s.lang === 'it' ? 'it-IT' : 'en-GB', { day: 'numeric', month: 'long' }) }) : t('Set these with your care team. Changes ask you to confirm twice.'))}</div>`;
}

views.memory = () => {
  const tab = UI.memTab;
  const tabs = [['meals', 'Meals'], ['foods', 'Foods'], ['numbers', 'Numbers']];
  const body = tab === 'foods' ? foodsTab() : tab === 'numbers' ? numbersTab() : mealsTab();
  return `<div class="screen plain-bg">
    <button class="pull" data-act="home" aria-label="${esc(t('Close'))}"><i></i></button>
    <div class="mem-top"><div class="h-34">${esc(t('Memory'))}</div><div class="tabs">${tabs.map(([k, l]) => `<button class="${tab === k ? 'on' : ''}" data-act="memTab" data-tab="${k}">${esc(t(l))}</button>`).join('')}</div></div>
    <div class="scroll page" style="gap:10px">${body}</div></div>`;
};

actions.home = () => home();
actions.memTab = (el) => { UI.memTab = el.dataset.tab; render(); document.querySelector('.scroll')?.scrollTo(0, 0); };
inputs.view_foodQ = (v) => {
  UI.foodQ = v;
  const pos = document.activeElement?.selectionStart;
  render();
  const i = document.querySelector('[data-k="foodQ"]');
  if (i) { i.focus(); try { i.setSelectionRange(pos, pos); } catch { /* ignore */ } }
};

// Hold a meal in Memory
sheets.mealMenu = (sh) => {
  const m = S.logs.find((l) => l.id === sh.id);
  return {
    size: 'auto',
    html: `<div class="shead"><span></span><b>${esc(m.name)}</b><button data-act="close">${esc(t('Done'))}</button></div>
      <button class="btn dark wide" data-act="repeatFrom" data-id="${m.id}">${esc(t('Eat this again'))}</button>
      <button class="btn wide" data-act="favMeal" data-id="${m.id}">${m.favorite ? '★ ' + esc(t('Remove from favorites')) : '☆ ' + esc(t('Mark as favorite'))}</button>`,
  };
};
actions.mealMenu = (el) => openSheet('mealMenu', { id: +el.dataset.id });

// ---- Foods ----------------------------------------------------------------------
sheets.food = (sh) => {
  const d = sh.draft;
  return {
    size: 'mid',
    html: `<div class="shead"><button data-act="close">${esc(t('Cancel'))}</button><b>${esc(sh.id ? t('Edit food') : t('New food'))}</b><button class="strong" data-act="saveFood">${esc(t('Save'))}</button></div>
      ${sh.copyOf ? `<div class="sheet-lead">${esc(t('This is a copy of a food Brio knows. Your numbers win from now on.'))}</div>` : ''}
      <input class="meal-name" data-k="name" value="${esc(d.name)}" placeholder="${esc(t('Name'))}">
      <div class="form">
        <label><span>${esc(t('Portion'))}</span><input data-k="portion" value="${esc(d.portion)}" placeholder="${esc(t('e.g. 1 slice'))}"></label>
        <label><span>${esc(t('Carbs (g)'))}</span><input inputmode="decimal" data-k="carbs" value="${esc(d.carbs)}"></label>
        <label><span>${esc(t('Fat (g)'))}</span><input inputmode="decimal" data-k="fat" value="${esc(d.fat)}"></label>
        <label><span>${esc(t('Protein (g)'))}</span><input inputmode="decimal" data-k="protein" value="${esc(d.protein)}"></label>
      </div>
      ${sh.id ? `<button class="link danger" data-act="deleteFood">${esc(t('Delete'))}</button>` : ''}`,
  };
};
inputs.food = (k, v) => { UI.sheet.draft[k] = v; };
actions.newFood = () => openSheet('food', { draft: { name: UI.foodQ || '', portion: '', carbs: '', fat: '', protein: '' } });
actions.editFood = (el) => {
  const f = library(S).find((x) => x.key === el.dataset.key);
  if (!f) return;
  openSheet('food', { id: f.builtin ? null : f.id, copyOf: f.builtin, draft: { name: f.name, portion: f.portion, carbs: f.carbs, fat: f.fat, protein: f.protein } });
};
actions.saveFood = () => {
  const d = UI.sheet.draft;
  if (!d.name.trim()) return;
  const rec = { name: d.name.trim(), portion: d.portion, carbs: num(d.carbs), fat: num(d.fat), protein: num(d.protein), parts: null };
  if (UI.sheet.id) Object.assign(S.foods.find((f) => f.id === UI.sheet.id), rec);
  else S.foods.push({ id: S.nextId++, ...rec });
  closeAllSheets(); commit(); toast(t('Saved.'));
};
actions.deleteFood = () => { S.foods = S.foods.filter((f) => f.id !== UI.sheet.id); closeAllSheets(); commit(); };

// ---- Your week (hold the orb) ----------------------------------------------------
views.week = () => {
  const s = S.settings;
  const at = now();
  const day0 = new Date(at); day0.setHours(0, 0, 0, 0);
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const start = day0.getTime() - i * 86400000;
    const end = start + 86400000;
    const r = readings(S).filter((x) => x.t >= start && x.t < end);
    days.push({ start, r, tir: timeInRange(r, s), lows: r.filter((x) => x.v < s.low).length, meals: S.logs.filter((l) => l.kind === 'meal' && l.t >= start && l.t < end).length });
  }
  const all = days.flatMap((d) => d.r);
  const tir = timeInRange(all, s);
  const avg = all.length ? Math.round(all.reduce((a, x) => a + x.v, 0) / all.length) : null;
  const lows = days.reduce((a, d) => a + d.lows, 0);
  const nMeals = days.reduce((a, d) => a + d.meals, 0);
  const weekMeals = meals().filter((m) => at - m.t < 7 * 86400000).map((m) => ({ m, st: mealStatus(m, S, at) })).filter((o) => o.st.closed && o.st.peak);
  const best = [...weekMeals].sort((a, b) => a.st.peak.v - b.st.peak.v)[0];
  const worst = [...weekMeals].sort((a, b) => b.st.peak.v - a.st.peak.v)[0];
  let line;
  if (!all.length) line = t('Not enough readings this week yet. Log a few and I will tell you how it went.');
  else if (tir >= 70) line = t('A good week: {n}% of your readings were in range.', { n: tir });
  else line = t('{n}% in range this week. Look at the meals that peaked: that is where the easy wins are.', { n: tir });
  const wd = (ts) => new Date(ts).toLocaleDateString(s.lang === 'it' ? 'it-IT' : 'en-GB', { weekday: 'narrow' });
  const bars = days.map((d) => `<div class="wk-day"><div class="wk-bar"><i style="height:${d.tir ?? 0}%;background:${d.tir == null ? 'transparent' : d.tir >= 70 ? 'var(--green)' : d.tir >= 50 ? 'var(--amber)' : 'var(--red)'}"></i></div><span>${esc(wd(d.start))}</span>${d.lows ? '<em></em>' : ''}</div>`).join('');
  return `<div class="screen home-bg">
    <div class="navbar"><button data-act="home">‹ ${esc(s.name)}</button><span></span></div>
    <div class="scroll page">
      <div class="h-34">${esc(t('Your week'))}</div>
      <div class="brio-line">${orb(34, { eyes: tir >= 70 ? 'happy' : 'open' })}<div>${esc(line)}</div></div>
      <div class="card">
        <div class="card-head"><b>${esc(t('Time in range'))}</b><span>${esc(t('{a}–{b} mg/dL', { a: s.rangeLow, b: s.rangeHigh }))}</span></div>
        <div class="wk-bars">${bars}</div>
        <div class="foot-note left">${esc(t('A red dot means at least one low that day.'))}</div>
      </div>
      <div class="stats4"><div><b>${tir ?? '—'}${tir != null ? '%' : ''}</b>${esc(t('in range'))}</div><div><b>${avg ?? '—'}</b>${esc(t('average'))}</div><div><b>${lows}</b>${esc(t('lows'))}</div><div><b>${nMeals}</b>${esc(t('meals'))}</div></div>
      ${best ? `<div class="white-list">${row(esc(t('Smoothest meal')), `${esc(best.m.name)} · ${best.st.peak.v}${chev}`, { act: 'openMeal', attrs: `data-id="${best.m.id}"` })}${worst && worst !== best ? row(esc(t('Highest peak')), `${esc(worst.m.name)} · ${worst.st.peak.v}${chev}`, { act: 'openMeal', attrs: `data-id="${worst.m.id}"`, cls: 'bt' }) : ''}</div>` : ''}
    </div></div>`;
};
