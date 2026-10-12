// Round 5: the meal log, from the double tap to "I took 4 U".
import { S, UI, now, actions, inputs, sheets, render, commit, openSheet, swapSheet, closeAllSheets, toast } from '../ctx.js';
import { t } from '../i18n.js';
import { orb, esc, hm, u, num, dur } from '../ui.js';
import { MIN, plan, lastReading, mealChecks, isFatty, roundTo, fix, mealStatus } from '../calc.js';
import { search, itemsFromFood, parseMeal, learn } from '../foods.js';
import { listen, stop as stopListening, canListen } from '../speech.js';
import { meals } from '../brain.js';

const PORTIONS = [[0.25, '¼'], [0.5, '½'], [0.75, '¾'], [1, 'All']];
const MULTS = [0.25, 0.5, 0.75, 1, 1.5, 2, 3];
const multLabel = (m) => ({ 0.25: '¼', 0.5: '½', 0.75: '¾', 1: '', 1.5: '1½', 2: '2', 3: '3' }[m] ?? String(m));

// Distinct recent meals for "Again?"
export function usualMeals(limit = 3) {
  const seen = new Set();
  const out = [];
  for (const m of meals()) {
    const k = m.name.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(m);
    if (out.length >= limit) break;
  }
  return out;
}

function mealOutcome(m) {
  const st = mealStatus(m, S, now());
  const total = (m.doses || []).reduce((a, d) => a + d.u, 0);
  const inRange = st.closed && st.inRange === 100;
  return t('{c} g · last time {u} U', { c: Math.round(m.carbs), u: u(total) }) + (inRange ? t(', in range') : '');
}

// ---- 1 · New meal -------------------------------------------------------------
sheets.newMeal = () => {
  const last = S.settings.lastInput;
  const opt = (key, label, sub, icon) => `<button class="opt${last === key ? ' on' : ''}" data-act="mealVia" data-via="${key}"><i class="ic-${icon}"></i><b>${esc(label)}</b><span>${esc(sub)}</span></button>`;
  const usual = usualMeals();
  return {
    size: 'mid',
    html: `<div class="shead"><button data-act="closeAll">${esc(t('Cancel'))}</button><b>${esc(t('New meal'))}</b><span></span></div>
      <div style="display:flex;justify-content:center;padding-top:4px">${orb(64)}</div>
      <div class="serif" style="text-align:center;font-size:24px;letter-spacing:-.4px">${esc(t('What are you eating?'))}</div>
      <div class="opts">${opt('photo', t('Photo'), t('Point at the plate'), 'sq')}${opt('say', t('Say it'), t('"Pizza, the whole thing"'), 'ci')}${opt('type', t('Type it'), t('Name and carbs'), 'ci')}</div>
      ${usual.length ? `<div class="section-label">${esc(t('AGAIN?'))}</div>
      <div class="grey-list">${usual.map((m) => `<div class="gl-row"><div><div class="gl-title">${esc(m.name)}</div><div class="gl-sub">${esc(mealOutcome(m))}</div></div><button class="link-btn" data-act="repeatMeal" data-id="${m.id}">${esc(t('Repeat'))}</button></div>`).join('')}</div>` : ''}`,
  };
};

actions.mealVia = (el) => {
  const via = el.dataset.via;
  S.settings.lastInput = via;
  if (via === 'photo') swapSheet('camera');
  else if (via === 'say') swapSheet('say', { text: '', state: 'idle' });
  else swapSheet('review', { source: 'typed', draft: draftOf({ name: '', items: [] }), focusSearch: true });
};

const draftOf = ({ name, items, portion = 1, photo = null }) => ({ name, items: items.map((i) => ({ ...i, base: { ...i.base } })), portion, photo, q: '' });

actions.repeatMeal = (el) => {
  const m = S.logs.find((l) => l.id === +el.dataset.id);
  if (!m) return;
  const items = m.items.map((i) => ({ ...i, base: { ...(i.base || { carbs: i.carbs, fat: i.fat, protein: i.protein }) } }));
  swapSheet('dose', { source: 'repeat', from: m.id, draft: { ...draftOf({ name: m.name, items, portion: 1 }) } });
};

// "Repeat last meal" as a gesture.
export function repeatLast() {
  const m = meals()[0];
  if (!m) { openSheet('newMeal'); return; }
  openSheet('dose', { source: 'repeat', from: m.id, draft: draftOf({ name: m.name, items: m.items.map((i) => ({ ...i, base: { ...(i.base || i) } })) }) });
}

// ---- 2 · Photo -----------------------------------------------------------------
let stream = null;
sheets.camera = () => ({
  size: 'full',
  html: `<div class="camera">
    <video id="cam" playsinline muted autoplay></video>
    <div class="cam-shade"></div>
    <div class="cam-frame"></div>
    <div class="cam-top"><button data-act="camCancel">${esc(t('Cancel'))}</button><div class="cam-pill">${orb(26, { mood: 'listen' })}<span>${esc(t('Point at the plate'))}</span></div></div>
    <div class="cam-bottom">
      <div class="cam-tip">${esc(t('Fit the whole plate in the frame.'))}</div>
      <div class="cam-controls">
        <label class="cam-side" aria-label="${esc(t('Choose a photo'))}"><input type="file" accept="image/*" data-file="photo" hidden></label>
        <button class="shutter" data-act="camShoot" aria-label="${esc(t('Take photo'))}"><i></i></button>
        <label class="cam-side round" aria-label="${esc(t('Camera'))}"><input type="file" accept="image/*" capture="environment" data-file="photo" hidden><i class="bar"></i></label>
      </div>
    </div></div>`,
  mount: startCamera,
});

async function startCamera() {
  const v = document.getElementById('cam');
  if (!v || !navigator.mediaDevices?.getUserMedia) return;
  if (stream && v.srcObject === stream) return;
  try {
    stream = stream || await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
    v.srcObject = stream;
  } catch {
    stream = null;
    const tip = document.querySelector('.cam-tip');
    if (tip) tip.textContent = t('No camera access. Use the buttons to pick or take a photo.');
  }
}

export function stopCamera() {
  if (stream) { stream.getTracks().forEach((tr) => tr.stop()); stream = null; }
}

function thumbFrom(source, w, h) {
  const size = 240;
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const s = Math.min(w, h);
  c.getContext('2d').drawImage(source, (w - s) / 2, (h - s) / 2, s, s, 0, 0, size, size);
  return c.toDataURL('image/jpeg', 0.72);
}

actions.camCancel = () => { stopCamera(); closeAllSheets(); };
actions.camShoot = () => {
  const v = document.getElementById('cam');
  if (!v || !v.videoWidth) { document.querySelector('[data-file][capture]')?.click(); return; }
  const photo = thumbFrom(v, v.videoWidth, v.videoHeight);
  stopCamera();
  toReviewWithPhoto(photo);
};

export function onPhotoFile(file) {
  const img = new Image();
  const url = URL.createObjectURL(file);
  img.onload = () => { const p = thumbFrom(img, img.naturalWidth, img.naturalHeight); URL.revokeObjectURL(url); stopCamera(); toReviewWithPhoto(p); };
  img.src = url;
}

function toReviewWithPhoto(photo) {
  swapSheet('review', { source: 'photo', draft: draftOf({ name: '', items: [], photo }), focusSearch: true });
}

// ---- Say it ----------------------------------------------------------------------
sheets.say = (sh) => {
  const live = canListen();
  return {
    size: 'mid',
    html: `<div class="shead"><button data-act="sayCancel">${esc(t('Cancel'))}</button><b>${esc(t('New meal'))}</b><span></span></div>
      <div style="display:flex;justify-content:center;padding:18px 0 6px">${orb(96, { mood: sh.state === 'listening' ? 'listen' : 'calm' })}</div>
      <div class="serif say-text" id="say-text">${esc(sh.text || (sh.state === 'listening' ? t('Listening…') : live ? t('Tap the orb and tell me what you are eating.') : t('Tell me what you are eating, the way you would say it.')))}</div>
      ${live ? `<button class="btn ${sh.state === 'listening' ? '' : 'dark'} wide" data-act="sayListen">${esc(sh.state === 'listening' ? t('Stop') : sh.text ? t('Say it again') : t('Start listening'))}</button>` : ''}
      <label class="field"><span>${esc(live ? t('Or type it') : t('What are you eating?'))}</span><input data-k="text" value="${esc(sh.text)}" placeholder="${esc(t('Pizza, the whole thing'))}" enterkeyhint="go"></label>
      <button class="btn dark wide" data-act="sayDone" ${sh.text ? '' : 'disabled'}>${esc(t('Continue'))}</button>`,
    mount: () => { if (live && sh.state === 'idle' && !sh.started) { sh.started = true; actions.sayListen(); } },
  };
};
inputs.say = (k, v) => { UI.sheet.text = v; const b = document.querySelector('[data-act="sayDone"]'); if (b) b.disabled = !v.trim(); };
actions.sayListen = () => {
  const sh = UI.sheet;
  if (sh.state === 'listening') { stopListening(); sh.state = 'idle'; render(); return; }
  sh.state = 'listening'; render();
  listen({
    onPartial: (txt) => { sh.text = txt; const el = document.getElementById('say-text'); if (el) el.textContent = txt; },
    onFinal: (txt) => { sh.text = txt; sh.state = 'idle'; if (UI.sheet === sh) actions.sayDone(); },
    onError: () => { sh.state = 'idle'; if (UI.sheet === sh) render(); },
  });
};
actions.sayCancel = () => { stopListening(); closeAllSheets(); };
actions.sayDone = () => {
  stopListening();
  const text = (UI.sheet.text || '').trim();
  if (!text) return;
  const { items, portion } = parseMeal(S, text);
  const name = items.length === 1 ? items[0].name : capitalize(text.replace(/[,.].*$/, '').slice(0, 40));
  swapSheet('review', { source: 'said', draft: draftOf({ name, items, portion }), focusSearch: !items.length, heard: text });
};
const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// ---- 3 · Is this right? ------------------------------------------------------------
function totals(d) {
  const sum = (k) => d.items.reduce((a, i) => a + (i[k] || 0), 0) * d.portion;
  return { carbs: Math.round(sum('carbs')), fat: Math.round(sum('fat')), protein: Math.round(sum('protein')) };
}

function totalsHtml(d) {
  const x = totals(d);
  const fatty = isFatty(S.settings, x.fat);
  return `<div><div class="tot-l">${esc(t('Carbs'))}</div><div class="tot-v">${x.carbs} g</div></div><div><div class="tot-l">${esc(t('Fat'))}</div><div class="tot-v" style="color:${fatty ? 'var(--amber)' : 'inherit'}">${x.fat} g</div></div><div><div class="tot-l">${esc(t('Protein'))}</div><div class="tot-v">${x.protein} g</div></div>`;
}

function searchHtml(d) {
  const q = d.q || '';
  if (!q.trim()) return '';
  const res = search(S, q, 5);
  return `<div class="results">${res.map((f) => `<button class="res" data-act="addFood" data-key="${esc(f.key)}"><div><b>${esc(f.name)}</b><span>${esc(f.portion)}</span></div><em>${f.carbs} g</em></button>`).join('')}
    <button class="res" data-act="addManual"><div><b>${esc(t('Add “{q}” by hand', { q }))}</b><span>${esc(t('You type the carbs'))}</span></div><em>+</em></button></div>`;
}

sheets.review = (sh) => {
  const d = sh.draft;
  const sub = { photo: t('Your photo · add what is on the plate'), said: t('From what you said'), typed: t('Typed by you'), repeat: t('Like last time') }[sh.source] || '';
  const rows = d.items.map((i, n) => `<div class="item">
      <input class="item-name" data-k="item:${n}:name" value="${esc(i.name)}" aria-label="${esc(t('Name'))}">
      <label class="item-carbs"><input inputmode="decimal" data-k="item:${n}:carbs" value="${fix(i.carbs)}"><span>g</span></label>
      <label class="item-portion">${esc((i.mult !== 1 ? multLabel(i.mult) + ' × ' : '') + (i.portion || t('1 portion')))} ▾<select data-k="item:${n}:mult">${MULTS.map((m) => `<option value="${m}"${m === i.mult ? ' selected' : ''}>${esc((m === 1 ? '1' : multLabel(m)) + ' × ' + (i.portion || t('1 portion')))}</option>`).join('')}</select></label>
      <span class="item-unit">${esc(t('carbs'))}</span>
      <button class="item-x" data-act="removeItem" data-n="${n}" aria-label="${esc(t('Remove'))}">×</button></div>`).join('');
  const ok = d.items.length > 0;
  return {
    size: 'tall',
    html: `<div class="shead"><button data-act="reviewBack">${esc(t('Back'))}</button><b>${esc(t('Is this right?'))}</b><span></span></div>
      <div class="sheet-scroll">
      <div class="meal-head">${d.photo ? `<img class="thumb" src="${d.photo}" alt="">` : '<div class="thumb ph"></div>'}<div style="flex:1;min-width:0"><input class="meal-name" data-k="name" value="${esc(d.name)}" placeholder="${esc(t('Name this meal'))}"><div class="muted-13">${esc(sub)}</div></div></div>
      ${sh.heard ? `<div class="heard">“${esc(sh.heard)}”</div>` : ''}
      ${rows ? `<div class="grey-list items">${rows}</div>` : ''}
      <div class="search"><input data-k="q" value="${esc(d.q)}" placeholder="${esc(d.items.length ? t('Add something else') : t("What's on the plate?"))}" autocomplete="off" enterkeyhint="search"><div id="results">${searchHtml(d)}</div></div>
      ${ok ? `<div class="section-label" style="margin-bottom:-6px">${esc(t('HOW MUCH WILL YOU EAT?'))}</div>
      <div class="seg">${PORTIONS.map(([p, l]) => `<button class="${d.portion === p ? 'on' : ''}" data-act="portion" data-p="${p}">${esc(p === 1 ? t(l) : l)}</button>`).join('')}</div>
      <div class="totals" id="totals">${totalsHtml(d)}</div>
      <div class="brio-tip">${orb(28)}<span>${esc(t('Tap a number to fix it. Every number can be changed by hand.'))}</span></div>` : ''}
      </div>
      <button class="btn dark wide" data-act="reviewOk" ${ok ? '' : 'disabled'}>${esc(t('Looks right'))}</button>`,
    mount: () => { if (sh.focusSearch) { sh.focusSearch = false; document.querySelector('.search input')?.focus(); } },
  };
};

inputs.review = (k, v, el) => {
  const d = UI.sheet.draft;
  if (k === 'name') { d.name = v; return; }
  if (k === 'q') { d.q = v; document.getElementById('results').innerHTML = searchHtml(d); return; }
  const [, n, field] = k.split(':');
  const it = d.items[+n];
  if (!it) return;
  if (field === 'name') { it.name = v; return; }
  if (field === 'carbs') { it.carbs = num(v); it.edited = true; it.base.carbs = it.carbs / it.mult; }
  if (field === 'mult') {
    it.mult = num(v) || 1;
    for (const f of ['carbs', 'fat', 'protein']) it[f] = fix(it.base[f] * it.mult);
    render();
    return;
  }
  document.getElementById('totals').innerHTML = totalsHtml(d);
};

actions.addFood = (el) => {
  const d = UI.sheet.draft;
  const f = search(S, d.q, 8).find((x) => x.key === el.dataset.key);
  if (!f) return;
  d.items.push(...itemsFromFood(f));
  if (!d.name) d.name = f.name;
  d.q = '';
  render();
};
actions.addManual = () => {
  const d = UI.sheet.draft;
  const name = capitalize(d.q.trim());
  d.items.push({ name, carbs: 0, fat: 0, protein: 0, portion: '', base: { carbs: 0, fat: 0, protein: 0 }, mult: 1, edited: true });
  if (!d.name) d.name = name;
  d.q = '';
  render();
  const fields = document.querySelectorAll('.item-carbs input');
  fields[fields.length - 1]?.select();
};
actions.removeItem = (el) => { UI.sheet.draft.items.splice(+el.dataset.n, 1); render(); };
actions.portion = (el) => { UI.sheet.draft.portion = +el.dataset.p; render(); };
actions.reviewBack = () => swapSheet('newMeal');
actions.reviewOk = () => {
  const d = UI.sheet.draft;
  if (!d.name.trim()) d.name = d.items.map((i) => i.name).slice(0, 2).join(t(' and '));
  swapSheet('dose', { source: UI.sheet.source, draft: d });
};

// ---- 4 · Your dose -----------------------------------------------------------------
function glucoseFor(sh) {
  const r = lastReading(S, now());
  const fresh = r && now() - r.t <= 15 * MIN;
  if (sh.draft.bg != null && sh.draft.bg !== '') return { v: num(sh.draft.bg), manual: true };
  return fresh ? { v: r.v, t: r.t } : null;
}

function lastSameMeal(name) {
  return meals().find((m) => m.name.toLowerCase() === name.toLowerCase());
}

sheets.dose = (sh) => {
  const d = sh.draft;
  const x = totals(d);
  const g = glucoseFor(sh);
  const p = plan({ carbs: x.carbs, fat: x.fat, bg: g?.v }, S, now());
  sh.plan = p;
  const s = S.settings;
  const prev = lastSameMeal(d.name);
  let reason = '';
  if (p.split) {
    reason = t('{fat} g of fat slows the rise, so most of it waits {d}.', { fat: x.fat, d: dur(s.splitDelay) });
    if (prev && prev.plan.split) {
      const st = mealStatus(prev, S, now());
      if (st.closed && st.inRange === 100) reason += ' ' + t('Last time this split kept you in range.');
    }
  }
  const gRow = g && !g.manual
    ? `<button class="info-row" data-act="doseBg"><span>${esc(t('Glucose now'))}</span><span><b>${g.v}</b> <em>${esc(t('mg/dL · {d} ago', { d: dur((now() - g.t) / MIN) }))}</em></span></button>`
    : `<label class="info-row"><span>${esc(t('Glucose now'))}</span><span><input inputmode="numeric" data-k="bg" value="${esc(d.bg ?? '')}" placeholder="—" class="inline-num"> <em>mg/dL</em></span></label>`;
  const lines = [
    [t('{c} g ÷ carb ratio {r}', { c: x.carbs, r: u(s.icr) }), `${u(p.cu)} U`],
    g ? [t('Correction {a} → {b}', { a: g.v, b: s.target }), `${p.co >= 0 ? '+' : '−'}${u(Math.abs(roundTo(p.co, 0.1)))} U`] : [t('No glucose, no correction'), '—'],
    p.iob >= 0.05 ? [t('Insulin still on board'), `−${u(roundTo(p.iob, 0.1))} U`] : null,
    [t('Rounded to your pen ({s} U)', { s: s.penStep === 0.5 ? '½' : u(s.penStep) }), `${u(p.total)} U`],
    p.capped ? [t('Capped at your largest dose'), `${u(s.maxDose)} U`] : null,
  ].filter(Boolean);
  const taking = sh.other ? num(d.taken) : p.now;
  return {
    size: 'tall',
    html: `<div class="shead"><button data-act="doseBack">${esc(t('Back'))}</button><b>${esc(t('Your dose'))}</b><span></span></div>
      <div class="sheet-scroll">
      ${gRow}
      ${p.low ? `<div class="warn">${esc(t("You're low. Treat the low first, then dose for the meal when you're back above {v}.", { v: s.low }))}</div>` : ''}
      <div style="text-align:center"><div class="muted-13" style="font-weight:500">${esc(t('Suggested in total'))}</div><div class="big-dose">${u(p.total)}<span> U</span></div></div>
      ${p.split ? `<div class="split"><div class="split-now" style="flex:${Math.max(1, p.now)}"><b>${u(p.now)} U</b><span>${esc(t('now'))}</span></div><div class="split-later" style="flex:${Math.max(1, p.later)}"><b>${u(p.later)} U</b><span>${esc(t('at {time}', { time: hm(p.laterAt) }))}</span></div></div>` : ''}
      ${reason ? `<div class="reason">${esc(reason)}</div>` : ''}
      <div class="calc">${lines.map(([a, b]) => `<div><span>${esc(a)}</span><b>${esc(b)}</b></div>`).join('')}</div>
      ${sh.other ? `<label class="field big"><span>${esc(t('I took'))}</span><input inputmode="decimal" data-k="taken" value="${esc(d.taken ?? p.now)}"><em>U</em></label>` : ''}
      </div>
      <div class="sheet-foot">
        <button class="btn dark wide" data-act="doseTook">${esc(t('I took {u} U', { u: u(taking) }))}</button>
        ${sh.other ? '' : `<button class="link" data-act="doseOther">${esc(t('I took a different amount'))}</button>`}
        <div class="fine">${esc(t('Brio never logs a dose for you. Check every dose with your care plan.'))}</div>
      </div>`,
  };
};

inputs.dose = (k, v) => {
  UI.sheet.draft[k] = v;
  if (k === 'taken') { const b = document.querySelector('[data-act="doseTook"]'); if (b) b.textContent = t('I took {u} U', { u: u(num(v)) }); return; }
  clearTimeout(inputs._doseT);
  inputs._doseT = setTimeout(() => {
    const el = document.activeElement;
    const pos = el?.selectionStart;
    render();
    const again = document.querySelector(`[data-k="${k}"]`);
    if (again) { again.focus(); try { again.setSelectionRange(pos, pos); } catch { /* number inputs */ } }
  }, 450);
};

actions.doseBg = () => { UI.sheet.draft.bg = ''; render(); document.querySelector('[data-k="bg"]')?.focus(); };
actions.doseOther = () => { UI.sheet.other = true; UI.sheet.draft.taken = UI.sheet.plan.now; render(); document.querySelector('[data-k="taken"]')?.select(); };
actions.doseBack = () => {
  const sh = UI.sheet;
  if (sh.source === 'repeat') closeAllSheets();
  else swapSheet('review', { source: sh.source, draft: sh.draft });
};

actions.doseTook = () => {
  const sh = UI.sheet;
  const d = sh.draft;
  const p = sh.plan;
  const at = now();
  const x = totals(d);
  const taken = sh.other ? Math.max(0, num(d.taken)) : p.now;
  const g = glucoseFor(sh);
  if (g?.manual && g.v > 0) S.logs.push({ id: S.nextId++, kind: 'bg', t: at - 1000, v: g.v, note: t('Before {meal}', { meal: d.name }) });
  const planned = { ...p };
  if (sh.other) {
    planned.later = p.split ? Math.max(0, fix(roundTo(p.total - taken, S.settings.penStep))) : 0;
    if (!planned.later) planned.laterAt = null;
  }
  const items = d.items.map((i) => ({ ...i, carbs: fix(i.carbs * d.portion), fat: fix(i.fat * d.portion), protein: fix(i.protein * d.portion) }));
  const m = {
    id: S.nextId++, kind: 'meal', t: at, name: d.name.trim() || t('Meal'), items, portion: d.portion,
    carbs: x.carbs, fat: x.fat, protein: x.protein, bgBefore: g?.v || null, plan: planned,
    laterAt: planned.laterAt, checks: mealChecks(at, planned.laterAt),
    doses: taken > 0 ? [{ part: 'now', u: taken, t: at }] : [], photo: d.photo || null, favorite: false, note: '',
  };
  S.logs.push(m);
  learn(S, { name: m.name, items: d.items });
  closeAllSheets();
  UI.card = false;
  commit();
};

// ---- Second dose: change or skip -----------------------------------------------------
sheets.laterDose = (sh) => {
  const m = S.logs.find((l) => l.id === sh.id);
  if (!m) return { size: 'mid', html: '' };
  if (sh.draft.u == null) sh.draft.u = m.plan.later;
  return {
    size: 'mid',
    html: `<div class="shead"><button data-act="close">${esc(t('Cancel'))}</button><b>${esc(t('Second dose'))}</b><span></span></div>
      <div class="sheet-lead">${esc(t('{meal} · planned {u} U at {time}', { meal: m.name, u: u(m.plan.later), time: hm(m.laterAt) }))}</div>
      <div class="stepper big" data-key="u" data-step="${S.settings.penStep}" data-min="0" data-max="${S.settings.maxDose}">
        <button data-act="step" data-dir="-1">−</button><div class="stepper-v"><input inputmode="decimal" data-k="u" value="${esc(sh.draft.u)}"><span>U</span></div><button data-act="step" data-dir="1">+</button></div>
      <button class="btn dark wide" data-act="laterTook">${esc(t('I took {u} U', { u: u(num(sh.draft.u)) }))}</button>
      <button class="btn wide" data-act="laterMove">${esc(t('Remind me in 15 min'))}</button>
      <button class="link danger" data-act="laterSkip">${esc(t('Skip this dose'))}</button>`,
  };
};
inputs.laterDose = (k, v) => { UI.sheet.draft[k] = v; const b = document.querySelector('[data-act="laterTook"]'); if (b) b.textContent = t('I took {u} U', { u: u(num(v)) }); };
actions.laterTook = () => {
  const m = S.logs.find((l) => l.id === UI.sheet.id);
  const x = num(UI.sheet.draft.u);
  if (x > 0) m.doses.push({ part: 'later', u: x, t: now() });
  else m.skippedLater = true;
  closeAllSheets(); UI.card = false; commit(); toast(x > 0 ? t('Logged {u} U.', { u: u(x) }) : t('Skipped.'));
};
actions.laterMove = () => {
  const m = S.logs.find((l) => l.id === UI.sheet.id);
  m.laterAt = Math.max(now(), m.laterAt) + 15 * MIN;
  delete S.notified[`${m.id}:dose:later`];
  closeAllSheets(); UI.card = false; commit(); toast(t("OK, I'll remind you at {time}.", { time: hm(m.laterAt) }));
};
actions.laterSkip = () => {
  const m = S.logs.find((l) => l.id === UI.sheet.id);
  m.skippedLater = true;
  closeAllSheets(); UI.card = false; commit(); toast(t('Skipped.'));
};
