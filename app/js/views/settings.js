import { S, UI, now, views, actions, inputs, sheets, render, commit, go, openSheet, closeAllSheets, toast } from '../ctx.js';
import { t, setLang } from '../i18n.js';
import { orb, esc, u, num, toggle, row, chev, dur } from '../ui.js';
import { PRESETS, exampleDay, exportJSON, defaultSettings } from '../store.js';
import { ACTION_LABEL } from './home.js';
import { requestNotifications, notifySupport } from '../notify.js';

// Treatment plan and alert numbers. `plan: true` fields ask to confirm twice.
export const PLAN_FIELDS = [
  { key: 'icr', label: 'Carb ratio', unit: 'g / U', step: 0.5, min: 1, max: 60, plan: true, help: 'How many grams of carbs does 1 unit cover? On your care plan this is called carb ratio or ICR.' },
  { key: 'isf', label: 'Sensitivity', unit: 'mg/dL per U', step: 1, min: 5, max: 250, plan: true, help: 'How much does 1 unit bring your glucose down? Also called correction factor or ISF.' },
  { key: 'target', label: 'Goal glucose', unit: 'mg/dL', step: 5, min: 80, max: 180, plan: true, help: 'The value Brio corrects towards.' },
  { key: 'diaMin', label: 'Insulin duration', unit: 'h', step: 0.5, min: 2, max: 8, plan: true, scale: 60, help: 'How long your rapid insulin keeps working. Used for insulin on board.' },
  { key: 'penStep', label: 'Pen steps', unit: 'U', options: [0.1, 0.5, 1], plan: true, help: 'Doses are rounded to what your pen or pump can give.' },
  { key: 'maxDose', label: 'Largest single dose', unit: 'U', step: 1, min: 1, max: 60, plan: true, help: 'Brio never suggests more than this in one go.' },
  { key: 'fatSplit', label: 'Split meals with fat from', unit: 'g', step: 5, min: 5, max: 80, plan: true, help: 'Fatty meals raise glucose later, so Brio splits the dose in two.' },
  { key: 'firstPct', label: 'Split: first part', unit: '%', step: 5, min: 20, max: 80, plan: true, scale: 0.01, help: 'How much of a split dose to take at the start of the meal.' },
  { key: 'splitDelay', label: 'Split: second part after', unit: 'min', step: 15, min: 30, max: 240, plan: true, help: 'When Brio reminds you of the second part.' },
  { key: 'rangeLow', label: 'Range, low end', unit: 'mg/dL', step: 5, min: 60, max: 100, plan: true, help: 'Your target range, for charts and time in range.' },
  { key: 'rangeHigh', label: 'Range, high end', unit: 'mg/dL', step: 5, min: 120, max: 250, plan: true, help: 'Your target range, for charts and time in range.' },
];
export const ALERT_FIELDS = [
  { key: 'low', label: 'Low below', unit: 'mg/dL', step: 5, min: 60, max: 100 },
  { key: 'urgentLow', label: 'Urgent low below', unit: 'mg/dL', step: 1, min: 40, max: 65 },
  { key: 'nightThreshold', label: 'Night threshold', unit: 'mg/dL', step: 5, min: 60, max: 110 },
];
const FIELDS = [...PLAN_FIELDS, ...ALERT_FIELDS];
const fieldOf = (k) => FIELDS.find((f) => f.key === k);

const shown = (f, v) => (f.scale ? Math.round((v / f.scale) * 100) / 100 : v);
export function planValue(f) {
  const v = S.settings[f.key];
  if (f.key === 'diaMin') return dur(v);
  if (f.key === 'penStep') return v === 0.5 ? '½ U' : `${u(v)} U`;
  return `${u(shown(f, v))} ${t(f.unit)}`;
}

function presetCard(key, label, sub, bars) {
  const on = S.settings.preset === key;
  const sz = { simple: 26, balanced: 20, everything: 16 }[key];
  return `<button class="preset${on ? ' on' : ''}" data-act="preset" data-p="${key}" aria-pressed="${on}"><div class="preset-pv">${orb(sz)}${bars.map((h) => `<i style="height:${h}px"></i>`).join('')}</div><div><b>${esc(t(label))}</b><span>${esc(t(sub))}</span></div></button>`;
}

views.settings = () => {
  const s = S.settings;
  const sh = s.show;
  const g = s.gestures;
  const gsum = ['tap', 'double', 'hold'].filter((k) => g[k] !== 'none').map((k) => t(k === 'tap' ? 'Tap' : k === 'double' ? 'Double tap' : 'Hold')).join(' · ') || t('Off');
  const notifyLabel = { doses: t('Doses only'), all: t('Doses and checks'), off: t('Off') }[s.notify];
  const tog = (key, label, i) => row(esc(t(label)), toggle(sh[key], 'show', `data-key="${key}"`), { cls: i ? 'bt' : '' });
  return `<div class="screen settings-bg">
    <div class="navbar"><button data-act="home">‹ ${esc(s.name)}</button><span></span></div>
    <div class="scroll page" style="gap:0">
      <div class="h-34" style="padding:0 4px 4px">${esc(t('Make it yours'))}</div>
      <div class="muted-14" style="padding:0 4px 14px">${esc(t('{name} starts simple. Turn on only what you need.', { name: s.name }))}</div>
      <div class="presets">${presetCard('simple', 'Simple', 'Orb and one line', [])}${presetCard('balanced', 'Balanced', "+ today's logs", [5, 5])}${presetCard('everything', 'Everything', 'Charts, IOB, all', [5, 5, 14])}</div>
      <div class="group-label">${esc(t('ON THE HOME SCREEN'))}</div>
      <div class="white-list">${tog('glucose', 'Glucose', 0)}${tog('iob', 'Insulin on board', 1)}${tog('todayLogs', "Today's logs", 1)}${tog('chart24', '24 h chart', 1)}</div>
      <div class="group-label">${esc(t('THE ORB'))}</div>
      <div class="white-list">
        ${row(esc(t('Gestures')), `${esc(gsum)}${chev}`, { act: 'goGestures' })}
        ${row(esc(t('How {name} talks', { name: s.name })), `${esc(s.talk === 'chatty' ? t('Chatty') : t('Short'))}${chev}`, { act: 'pickTalk', cls: 'bt' })}
        ${row(esc(t('Name')), `${esc(s.name)}${chev}`, { act: 'editName', cls: 'bt' })}
      </div>
      <div class="group-label">${esc(t('OUTSIDE THE APP'))}</div>
      <div class="white-list">${row(esc(t('Notifications')), `${esc(notifyLabel)}${chev}`, { act: 'pickNotify', sub: esc(notifySupport()) })}</div>
      <div class="group-label">${esc(t('SAFETY'))}</div>
      <div class="white-list">${row(esc(t('Low alerts')), `${esc(t('{v} mg/dL', { v: s.low }))}${chev}`, { act: 'goAlerts' })}
        ${row(esc(t('Your treatment plan')), `${esc(t('{r} g/U · {i} mg/dL', { r: u(s.icr), i: s.isf }))}${chev}`, { act: 'goPlan', cls: 'bt' })}</div>
      <div class="group-label">${esc(t('LANGUAGE'))}</div>
      <div class="seg" style="margin:0 2px"><button class="${s.lang === 'en' ? 'on' : ''}" data-act="lang" data-l="en">English</button><button class="${s.lang === 'it' ? 'on' : ''}" data-act="lang" data-l="it">Italiano</button></div>
      <div class="group-label">${esc(t('DATA'))}</div>
      <div class="white-list">
        ${row(esc(t('Export your data')), chev, { act: 'exportData', sub: esc(t('A JSON file with every log')) })}
        ${row(esc(t('Load an example day')), chev, { act: 'loadExample', cls: 'bt', sub: esc(t('Replaces your logs with the pizza day from the designs')) })}
        ${row(`<span style="color:var(--red)">${esc(t('Erase everything'))}</span>`, '', { act: 'eraseAll', cls: 'bt' })}
      </div>
      <div class="foot-note left" style="padding:16px 12px 30px">${esc(t('{name} is a support tool, not a medical device. It never logs a dose for you. Check every dose with your care plan and set every number with your care team. Your data stays on this phone.', { name: s.name }))}</div>
    </div></div>`;
};

actions.preset = (el) => {
  const p = el.dataset.p;
  S.settings.preset = p;
  S.settings.show = { ...PRESETS[p] };
  commit();
};
actions.show = (el) => {
  const s = S.settings;
  s.show[el.dataset.key] = !s.show[el.dataset.key];
  s.preset = Object.keys(PRESETS).find((k) => Object.keys(PRESETS[k]).every((x) => PRESETS[k][x] === s.show[x])) || 'custom';
  commit();
};
actions.goGestures = () => go('gestures');
actions.goAlerts = () => go('alerts');
actions.goPlan = () => { UI.memTab = 'numbers'; go('memory'); };
actions.lang = (el) => { S.settings.lang = el.dataset.l; setLang(el.dataset.l); commit(); };
actions.pickTalk = () => openSheet('pick', { key: 'talk', title: t('How {name} talks', { name: S.settings.name }), options: [['short', t('Short'), t('One sentence, only what matters.')], ['chatty', t('Chatty'), t('A little warmer, a few more words.')]] });
actions.pickNotify = () => openSheet('pick', { key: 'notify', title: t('Notifications'), options: [['doses', t('Doses only'), t('Second doses and urgent lows.')], ['all', t('Doses and checks'), t('Also the glucose checks after meals.')], ['off', t('Off'), t('Urgent lows still show while the app is open.')]] });
actions.editName = () => openSheet('text', { key: 'name', title: t('Name'), draft: { v: S.settings.name } });

actions.exportData = () => {
  const blob = new Blob([exportJSON(S)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `brio-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
};
actions.loadExample = () => {
  if (S.logs.length && !confirm(t('Replace your logs with the example day?'))) return;
  exampleDay(S, now()); commit(); toast(t('Example day loaded.'));
};
actions.eraseAll = () => {
  if (!confirm(t('Erase every log, food and setting on this phone?'))) return;
  const lang = S.settings.lang;
  Object.assign(S, { settings: { ...defaultSettings(), lang }, logs: [], foods: [], hypo: null, reminders: [], notified: {}, nextId: 1 });
  UI.stack = []; UI.view = 'onboarding'; UI.arg = 0;
  commit();
};

// ---- Pick one / text -------------------------------------------------------------
sheets.pick = (sh) => ({
  size: 'auto',
  html: `<div class="shead"><span></span><b>${esc(sh.title)}</b><button data-act="close">${esc(t('Done'))}</button></div>
    <div class="white-list">${sh.options.map(([v, l, sub], i) => `<button class="pick${i ? ' bt' : ''}" data-act="picked" data-v="${esc(v)}"><div><div>${esc(l)}</div>${sub ? `<div class="row-sub">${esc(sub)}</div>` : ''}</div>${S.settings[sh.key] === v ? '<b class="tick">✓</b>' : ''}</button>`).join('')}</div>`,
});
actions.picked = async (el) => {
  const key = UI.sheet.key;
  S.settings[key] = el.dataset.v;
  if (key === 'notify' && el.dataset.v !== 'off') await requestNotifications();
  closeAllSheets(); commit();
};
sheets.text = (sh) => ({
  size: 'auto',
  html: `<div class="shead"><button data-act="close">${esc(t('Cancel'))}</button><b>${esc(sh.title)}</b><button class="strong" data-act="saveText">${esc(t('Save'))}</button></div>
    <input class="meal-name" data-k="v" value="${esc(sh.draft.v)}" maxlength="16">`,
  mount: () => document.querySelector('[data-k="v"]')?.select(),
});
inputs.text = (k, v) => { UI.sheet.draft.v = v; };
actions.saveText = () => { const v = UI.sheet.draft.v.trim(); if (v) S.settings[UI.sheet.key] = v; closeAllSheets(); commit(); };

// ---- Numbers (asks twice for the treatment plan) -----------------------------------------
sheets.editNum = (sh) => {
  const f = fieldOf(sh.key);
  const cur = shown(f, S.settings[f.key]);
  if (sh.draft.v == null) sh.draft.v = cur;
  const next = num(sh.draft.v);
  if (sh.confirm) {
    return {
      size: 'auto',
      html: `<div class="shead"><button data-act="numBack">${esc(t('Back'))}</button><b>${esc(t('Confirm'))}</b><span></span></div>
        <div class="confirm-q">${esc(t('Change {label} from {a} to {b} {unit}?', { label: t(f.label).toLowerCase(), a: u(cur), b: u(next), unit: t(f.unit) }))}</div>
        <div class="sheet-lead">${esc(t('Every dose Brio suggests from now on uses the new number.'))}</div>
        <label class="check"><input type="checkbox" data-k="checked" ${sh.draft.checked ? 'checked' : ''}><span>${esc(t('I checked this with my care team'))}</span></label>
        <button class="btn dark wide" data-act="numConfirm">${esc(t('Yes, change it'))}</button>`,
    };
  }
  const control = f.options
    ? `<div class="seg">${f.options.map((o) => `<button class="${+sh.draft.v === o ? 'on' : ''}" data-act="numOpt" data-v="${o}">${o === 0.5 ? '½' : u(o)} U</button>`).join('')}</div>`
    : `<div class="stepper big" data-key="v" data-step="${f.step}" data-min="${f.min}" data-max="${f.max}"><button data-act="step" data-dir="-1">−</button><div class="stepper-v"><input inputmode="decimal" data-k="v" value="${esc(sh.draft.v)}"><span>${esc(t(f.unit))}</span></div><button data-act="step" data-dir="1">+</button></div>`;
  return {
    size: 'auto',
    html: `<div class="shead"><button data-act="close">${esc(t('Cancel'))}</button><b>${esc(t(f.label))}</b><button class="strong" data-act="numSave">${esc(t('Save'))}</button></div>
      ${f.help ? `<div class="sheet-lead">${esc(t(f.help))}</div>` : ''}
      ${control}
      ${f.key === 'urgentLow' ? `<div class="fine left">${esc(t('Urgent low alerts are always on and cannot be turned off.'))}</div>` : ''}`,
  };
};
inputs.editNum = (k, v) => {
  if (k === 'checked') { UI.sheet.draft.checked = v; return; }
  UI.sheet.draft.v = v;
};
actions.editNum = (el) => openSheet('editNum', { key: el.dataset.key });
actions.numOpt = (el) => { UI.sheet.draft.v = +el.dataset.v; render(); };
actions.numBack = () => { UI.sheet.confirm = false; render(); };
actions.numSave = () => {
  const sh = UI.sheet;
  const f = fieldOf(sh.key);
  let v = num(sh.draft.v);
  if (!f.options) v = Math.max(f.min, Math.min(f.max, v));
  sh.draft.v = v;
  if (v === shown(f, S.settings[f.key])) { closeAllSheets(); return; }
  if (f.plan) { sh.confirm = true; render(); return; }
  S.settings[f.key] = f.scale ? v * f.scale : v;
  closeAllSheets(); commit();
};
actions.numConfirm = () => {
  const sh = UI.sheet;
  const f = fieldOf(sh.key);
  const v = num(sh.draft.v);
  S.settings[f.key] = f.scale ? Math.round(v * f.scale * 100) / 100 : v;
  if (sh.draft.checked) S.settings.planCheckedOn = now();
  closeAllSheets(); commit(); toast(t('Saved.'));
};

// ---- Orb gestures (4d · right) -------------------------------------------------------
const GESTURES = [['tap', 'TAP'], ['double', 'DOUBLE TAP'], ['hold', 'HOLD'], ['swipe', 'SWIPE UP']];
const CAN_DO = { tap: ['now', 'meal', 'glucose', 'talk', 'week', 'none'], double: ['meal', 'glucose', 'talk', 'week', 'repeat', 'none'], hold: ['week', 'talk', 'meal', 'glucose', 'repeat', 'none'], swipe: ['memory', 'week', 'none'] };

views.gestures = () => {
  const s = S.settings;
  const edit = UI.gestureEdit || 'double';
  const rows = GESTURES.map(([k, l], i) => `<div class="g-row${i ? ' bt' : ''}${edit === k ? ' sel' : ''}"><div class="g-ic">${orb(26)}</div><div><div class="g-k">${esc(t(l))}</div><div class="g-v">${esc(t(ACTION_LABEL[s.gestures[k]]))}</div></div><button class="link-btn" data-act="gEdit" data-g="${k}">${esc(t('Change'))}</button></div>`).join('');
  const label = GESTURES.find(([k]) => k === edit)[1];
  return `<div class="screen settings-bg">
    <div class="navbar"><button data-act="back">‹ ${esc(t('Make it yours'))}</button><span></span></div>
    <div class="scroll page">
      <div class="h-28">${esc(t('Orb gestures'))}</div>
      <div class="white-list">${rows}</div>
      <div class="group-label" style="padding:8px 12px 0">${esc(t('{g} CAN ALSO DO', { g: t(label) }))}</div>
      <div class="chips">${CAN_DO[edit].map((a) => `<button class="chip${s.gestures[edit] === a ? ' on' : ''}" data-act="gSet" data-a="${a}">${esc(t(ACTION_LABEL[a]))}</button>`).join('')}</div>
      <div class="white-list" style="margin-top:6px">${row(esc(t('Show gesture hints')), toggle(s.hints, 'hintsToggle'))}</div>
      <div class="foot-note left">${esc(t("Hints hide on their own after you've used each gesture three times."))}</div>
    </div></div>`;
};
actions.gEdit = (el) => { UI.gestureEdit = el.dataset.g; render(); };
actions.gSet = (el) => { S.settings.gestures[UI.gestureEdit || 'double'] = el.dataset.a; commit(); };
actions.hintsToggle = () => { S.settings.hints = !S.settings.hints; if (S.settings.hints) S.settings.uses = { tap: 0, double: 0, hold: 0, swipe: 0 }; commit(); };

// ---- Low alerts (6b · 6) ----------------------------------------------------------------
views.alerts = () => {
  const s = S.settings;
  const val = (k) => `${esc(t('{v} mg/dL', { v: s[k] }))}${chev}`;
  return `<div class="screen settings-bg">
    <div class="navbar"><button data-act="back">‹ ${esc(t('Make it yours'))}</button><span></span></div>
    <div class="scroll page" style="gap:0">
      <div class="h-30" style="padding:0 4px 14px">${esc(t('Low alerts'))}</div>
      <div class="white-list">
        ${row(esc(t('Heading low')), toggle(s.headingLow, 'alertToggle', 'data-key="headingLow"'), { sub: esc(t('Warns 20 min before')) })}
        ${row(esc(t('Low below')), val('low'), { act: 'editNum', attrs: 'data-key="low"', cls: 'bt' })}
        ${row(esc(t('Urgent low below')), val('urgentLow'), { act: 'editNum', attrs: 'data-key="urgentLow"', cls: 'bt', sub: esc(t("Always on, can't be turned off")) })}
      </div>
      <div class="group-label">${esc(t('AT NIGHT'))}</div>
      <div class="white-list">
        ${row(esc(t('Keep ringing')), toggle(s.critical, 'alertToggle', 'data-key="critical"'), { sub: esc(t('Sound on the urgent low screen until you answer')) })}
        ${row(esc(t('Night threshold')), val('nightThreshold'), { act: 'editNum', attrs: 'data-key="nightThreshold"', cls: 'bt', sub: esc(t('{a} – {b}, a little earlier', { a: s.nightStart, b: s.nightEnd })) })}
      </div>
      <div class="group-label">${esc(t("IF YOU DON'T ANSWER"))}</div>
      <div class="white-list">
        ${row(esc(t('Message a contact')), `${esc(s.contactName || t('Add'))}${chev}`, { act: 'editContact', sub: esc(t('After 10 min without a reply')) })}
        ${row(esc(t('Share your location')), toggle(s.shareLocation, 'alertToggle', 'data-key="shareLocation"'), { cls: 'bt' })}
      </div>
      <div class="foot-note left">${esc(t('Set the thresholds with your care team.'))}</div>
      <div class="foot-note left">${esc(t('On iPhone a web app cannot ring through silent mode or send messages by itself. Brio rings while it is open and prepares the message for you to send.'))}</div>
    </div></div>`;
};
actions.alertToggle = (el) => { const k = el.dataset.key; S.settings[k] = !S.settings[k]; commit(); };

sheets.contact = (sh) => ({
  size: 'auto',
  html: `<div class="shead"><button data-act="close">${esc(t('Cancel'))}</button><b>${esc(t('Emergency contact'))}</b><button class="strong" data-act="saveContact">${esc(t('Save'))}</button></div>
    <div class="sheet-lead">${esc(t("If you don't answer an urgent low for 10 minutes, Brio prepares a message to this person with your glucose and location."))}</div>
    <div class="form"><label><span>${esc(t('Name'))}</span><input data-k="name" value="${esc(sh.draft.name)}" autocomplete="off"></label>
    <label><span>${esc(t('Phone'))}</span><input type="tel" data-k="phone" value="${esc(sh.draft.phone)}" autocomplete="off"></label></div>
    ${S.settings.contactName ? `<button class="link danger" data-act="removeContact">${esc(t('Remove contact'))}</button>` : ''}`,
});
inputs.contact = (k, v) => { UI.sheet.draft[k] = v; };
actions.editContact = () => openSheet('contact', { draft: { name: S.settings.contactName, phone: S.settings.contactPhone } });
actions.saveContact = () => { S.settings.contactName = UI.sheet.draft.name.trim(); S.settings.contactPhone = UI.sheet.draft.phone.trim(); closeAllSheets(); commit(); };
actions.removeContact = () => { S.settings.contactName = ''; S.settings.contactPhone = ''; closeAllSheets(); commit(); };
