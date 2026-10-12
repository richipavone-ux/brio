import { S, UI, now, actions, inputs, sheets, render, commit, swapSheet, closeAllSheets, toast, log } from '../ctx.js';
import { t } from '../i18n.js';
import { orb, esc, hm, u, num, dur, scale } from '../ui.js';
import { MIN, correction, iobAt, iobBreakdown, iobGoneBy, iobFraction } from '../calc.js';
import { agenda } from '../brain.js';
import { hypoActive, hypoReading, startHypo } from './hypo.js';

function comment(v) {
  const s = S.settings;
  if (!v) return '';
  if (v < s.urgentLow) return t('Urgent low. Eat 15 g of fast sugar right now.');
  if (v < s.low) return t("That's low. Take 15 g of fast sugar and check again in 15 minutes.");
  if (v > s.rangeHigh) {
    const iob = iobAt(S, now());
    return iob >= 0.1 ? t("Above range. You still have {u} U working, I'll show you before you correct.", { u: u(iob) }) : t('Above range. I can suggest a correction.');
  }
  return t('In range. Nice.');
}

const timeValue = (ts) => hm(ts);
function parseTime(str, ref) {
  const [h, m] = String(str || '').split(':').map(Number);
  if (!Number.isFinite(h)) return ref;
  const d = new Date(ref); d.setHours(h, m || 0, 0, 0);
  if (d.getTime() > now() + MIN) d.setDate(d.getDate() - 1);
  return d.getTime();
}

// ---- Log / edit glucose -------------------------------------------------------
sheets.glucose = (sh) => {
  const d = sh.draft;
  const editing = sh.id != null;
  if (editing && d.v == null) { const l = log(sh.id); d.v = l.v; d.time = timeValue(l.t); d.note = l.note || ''; }
  if (d.time == null) d.time = timeValue(now());
  let title = t('Glucose');
  let lead = '';
  if (sh.hypo) { title = t('Time to check'); lead = t('What does your meter say now?'); }
  else if (sh.check) {
    const item = agenda().find((x) => x.key === sh.check);
    if (item?.meal) { title = t('How is it going?'); lead = t("{meal}: {h} h check.", { meal: item.meal.name, h: Math.round((item.at - item.meal.t) / 60 / MIN) }); }
  }
  return {
    size: 'mid',
    html: `<div class="shead"><button data-act="closeAll">${esc(t('Cancel'))}</button><b>${esc(title)}</b><button class="strong" data-act="saveBg">${esc(t('Save'))}</button></div>
      ${lead ? `<div class="sheet-lead">${esc(lead)}</div>` : ''}
      <label class="bg-input"><input inputmode="numeric" pattern="[0-9]*" data-k="v" value="${esc(d.v ?? '')}" placeholder="—" autofocus><span>mg/dL</span></label>
      <div class="bg-comment" id="bg-comment">${esc(comment(num(d.v)))}</div>
      <div class="form">
        <label><span>${esc(t('Time'))}</span><input type="time" data-k="time" value="${esc(d.time)}"></label>
        <label><span>${esc(t('Note'))}</span><input data-k="note" value="${esc(d.note ?? '')}" placeholder="${esc(t('Optional'))}"></label>
      </div>
      ${editing ? `<button class="link danger" data-act="deleteBg">${esc(t('Delete reading'))}</button>` : ''}`,
    mount: () => { const i = document.querySelector('[data-k="v"]'); if (i && !d.v) i.focus(); },
  };
};
inputs.glucose = (k, v) => {
  UI.sheet.draft[k] = v;
  if (k === 'v') document.getElementById('bg-comment').textContent = comment(num(v));
};

actions.glucose = (el) => {
  const check = el?.dataset?.check;
  closeAllSheets();
  UI.sheet = { type: 'glucose', draft: {}, check };
  render();
};
actions.editBg = (el) => { UI.sheet = { type: 'glucose', draft: {}, id: +el.dataset.id }; render(); };
actions.deleteBg = () => { S.logs = S.logs.filter((l) => l.id !== UI.sheet.id); closeAllSheets(); commit(); };

actions.saveBg = () => {
  const sh = UI.sheet;
  const v = Math.round(num(sh.draft.v));
  if (!(v >= 20 && v <= 600)) { document.querySelector('[data-k="v"]')?.focus(); toast(t('Enter a value between 20 and 600.')); return; }
  const at = parseTime(sh.draft.time, now());
  if (sh.id != null) {
    const l = log(sh.id);
    Object.assign(l, { v, t: at, note: sh.draft.note || '' });
    closeAllSheets(); commit(); return;
  }
  const reading = { id: S.nextId++, kind: 'bg', t: at, v, note: sh.draft.note || '' };
  S.logs.push(reading);
  if (sh.check?.startsWith('r:')) { const r = S.reminders.find((x) => 'r:' + x.id === sh.check); if (r) r.done = true; }
  const s = S.settings;
  UI.card = false;
  if (hypoActive()) { hypoReading(v, reading); closeAllSheets(); commit(); return; }
  if (now() - at < 20 * MIN && v < s.low) { startHypo(v < s.urgentLow ? 'urgent' : 'low', reading); closeAllSheets(); commit(); return; }
  if (v > s.rangeHigh && !sh.check && now() - at < 20 * MIN) {
    swapSheet('correction', { bg: v });
    commit();
    return;
  }
  closeAllSheets();
  commit();
  toast(t('Saved.'));
};

// ---- Correction, with insulin on board subtracted (6a · 2) --------------------------
sheets.correction = (sh) => {
  const s = S.settings;
  const c = correction(sh.bg, S, now());
  const waitUntil = now() + 45 * MIN;
  const covered = c.suggested === 0 && c.iob >= 0.1;
  const head = `<div class="shead"><button data-act="closeAll">${esc(t('Cancel'))}</button><b>${esc(t('Correction'))}</b><span></span></div>
    <div class="info-row"><span>${esc(t('Glucose now'))}</span><span><b>${sh.bg}</b> <em>mg/dL</em></span></div>`;
  const recent = S.logs.filter((l) => l.kind === 'meal' && now() - l.t < 2 * 60 * MIN && l.t <= now()).sort((a, b) => b.t - a.t)[0];
  const mealNote = recent ? `<div class="reason">${esc(t('You ate {meal} {d} ago: part of this high is the meal, and its insulin is still working.', { meal: recent.name.toLowerCase(), d: dur((now() - recent.t) / MIN) }))}</div>` : '';
  const table = `<div class="calc-table"><span>${esc(t('Correction {a} → {b}', { a: sh.bg, b: s.target }))}</span><b>${u(c.co)} U</b><span>${esc(t('Minus insulin on board'))}</span><b>−${u(c.iob)} U</b><span class="strong">${esc(t('Suggested now'))}</span><b class="strong">${u(c.suggested)} U</b></div>`;
  if (sh.anyway) {
    if (sh.draft.u == null) sh.draft.u = c.suggested || s.penStep;
    return {
      size: 'mid',
      html: `${head}<div class="sheet-lead">${esc(t('How much did you take?'))}</div>
        <div class="stepper big" data-key="u" data-step="${s.penStep}" data-min="0" data-max="${s.maxDose}"><button data-act="step" data-dir="-1">−</button><div class="stepper-v"><input inputmode="decimal" data-k="u" value="${esc(sh.draft.u)}"><span>U</span></div><button data-act="step" data-dir="1">+</button></div>
        <div class="sheet-foot"><button class="btn dark wide" data-act="corrTook">${esc(t('Log {u} U', { u: u(num(sh.draft.u)) }))}</button>
        <div class="fine">${esc(t('Brio never logs a dose for you. Check every dose with your care plan.'))}</div></div>`,
    };
  }
  if (covered) {
    return {
      size: 'mid',
      html: `${head}
        <div class="iob-warn">
          <div style="display:flex;gap:12px;align-items:center">${orb(40, { mood: 'alert' })}<b style="font-size:17px;line-height:1.3">${esc(t('You still have {u} U working', { u: u(c.iob) }))}</b></div>
          <div class="iob-warn-text">${esc(t('That insulin will bring you down by about {d} mg/dL by {time}. Correcting now stacks on top and could take you low.', { d: c.drop, time: hm(iobGoneBy(S, now()) || now()) }))}</div>
          ${table}
        </div>
        ${mealNote}<div class="reason">${esc(t("I'll check again at {time}. If you're still above {v} then, I'll suggest a correction.", { time: hm(waitUntil), v: s.rangeHigh }))}</div>
        <div class="sheet-foot"><button class="btn dark wide" data-act="corrWait">${esc(t('OK, wait'))}</button><button class="link" data-act="corrAnyway">${esc(t('Log a correction anyway'))}</button></div>`,
    };
  }
  return {
    size: 'mid',
    html: `${head}
      ${mealNote}<div style="text-align:center"><div class="muted-13" style="font-weight:500">${esc(t('Suggested correction'))}</div><div class="big-dose">${u(c.suggested)}<span> U</span></div></div>
      ${table}
      <div class="sheet-foot"><button class="btn dark wide" data-act="corrTookSuggested" ${c.suggested > 0 ? '' : 'disabled'}>${esc(t('I took {u} U', { u: u(c.suggested) }))}</button>
      <button class="link" data-act="corrAnyway">${esc(t('I took a different amount'))}</button>
      <button class="link" data-act="closeAll">${esc(t('Not now'))}</button>
      <div class="fine">${esc(t('Brio never logs a dose for you. Check every dose with your care plan.'))}</div></div>`,
  };
};
inputs.correction = (k, v) => { UI.sheet.draft[k] = v; const b = document.querySelector('[data-act="corrTook"]'); if (b) b.textContent = t('Log {u} U', { u: u(num(v)) }); };

actions.corrWait = () => {
  S.reminders.push({ id: S.nextId++, at: now() + 45 * MIN, what: 'recheck', done: false });
  closeAllSheets(); commit(); toast(t("OK. I'll ask you at {time}.", { time: hm(now() + 45 * MIN) }));
};
actions.corrAnyway = () => { UI.sheet.anyway = true; render(); };
const logDose = (x) => {
  if (x > 0) S.logs.push({ id: S.nextId++, kind: 'dose', t: now(), u: x, note: '' });
  closeAllSheets(); commit(); toast(t('Logged {u} U.', { u: u(x) }));
};
actions.corrTook = () => logDose(num(UI.sheet.draft.u));
actions.corrTookSuggested = () => logDose(correction(UI.sheet.bg, S, now()).suggested);

// Edit a logged correction.
sheets.editDose = (sh) => {
  const l = log(sh.id);
  if (sh.draft.u == null) { sh.draft.u = l.u; sh.draft.time = hm(l.t); }
  return {
    size: 'mid',
    html: `<div class="shead"><button data-act="closeAll">${esc(t('Cancel'))}</button><b>${esc(t('Correction'))}</b><button class="strong" data-act="saveDose">${esc(t('Save'))}</button></div>
      <div class="stepper big" data-key="u" data-step="${S.settings.penStep}" data-min="0" data-max="${S.settings.maxDose}"><button data-act="step" data-dir="-1">−</button><div class="stepper-v"><input inputmode="decimal" data-k="u" value="${esc(sh.draft.u)}"><span>U</span></div><button data-act="step" data-dir="1">+</button></div>
      <div class="form"><label><span>${esc(t('Time'))}</span><input type="time" data-k="time" value="${esc(sh.draft.time)}"></label></div>
      <button class="link danger" data-act="deleteDose">${esc(t('Delete'))}</button>`,
  };
};
inputs.editDose = (k, v) => { UI.sheet.draft[k] = v; };
actions.editDose = (el) => { UI.sheet = { type: 'editDose', id: +el.dataset.id, draft: {} }; render(); };
actions.saveDose = () => { const l = log(UI.sheet.id); l.u = num(UI.sheet.draft.u); l.t = parseTime(UI.sheet.draft.time, l.t); closeAllSheets(); commit(); };
actions.deleteDose = () => { S.logs = S.logs.filter((l) => l.id !== UI.sheet.id); closeAllSheets(); commit(); };

// ---- Insulin on board (6a · 1) --------------------------------------------------------
sheets.iob = () => {
  const s = S.settings;
  const at = now();
  const iob = iobAt(S, at);
  const gone = iobGoneBy(S, at);
  const planned = agenda(at).filter((x) => x.kind === 'dose');
  const end = Math.max(gone || at + 60 * MIN, ...planned.map((p) => p.at + s.diaMin * MIN * 0.5));
  const W = 338, H = 112;
  const pts = [];
  const N = 48;
  let maxV = 0.5;
  for (let i = 0; i <= N; i++) {
    const tt = at + ((end - at) * i) / N;
    let v = iobAt(S, tt);
    for (const p of planned) if (tt >= p.at) v += p.u * iobFraction((tt - p.at) / MIN, s.diaMin);
    pts.push({ t: tt, v });
    maxV = Math.max(maxV, v);
  }
  const sc = scale(at, end, 0, maxV * 1.15, W, H);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${sc.x(p.t).toFixed(1)} ${sc.y(p.v).toFixed(1)}`).join(' ');
  const marks = planned.map((p) => `<line x1="${sc.x(p.at)}" x2="${sc.x(p.at)}" y1="8" y2="${H}" stroke="#7c4dff" stroke-dasharray="3 4" opacity=".6"/><text x="${Math.min(sc.x(p.at) + 5, W - 96)}" y="18" font-size="11" fill="#5b3fd6" font-weight="600">${esc(t('+{u} U at {time}', { u: u(p.u), time: hm(p.at) }))}</text>`).join('');
  const ticks = [];
  const firstHour = new Date(at); firstHour.setMinutes(0, 0, 0);
  for (let h = firstHour.getTime() + 60 * MIN; h < end && ticks.length < 4; h += 60 * MIN) ticks.push(h);
  const list = iobBreakdown(S, at).slice(0, 4);
  return {
    size: 'short',
    html: `<div class="iob-head"><div><div class="section-label" style="padding:0">${esc(t('INSULIN STILL WORKING'))}</div><div class="iob-big">${u(Math.round(iob * 10) / 10)}<span> U</span></div></div>
        <div style="text-align:right;font-size:13px;color:var(--muted)">${gone ? `${esc(t('Gone by'))}<br><b style="color:var(--ink);font-size:16px">${hm(gone)}</b>` : ''}</div></div>
      <svg viewBox="0 0 ${W} ${H}" width="100%" style="display:block;overflow:visible"><path d="${line} L${W} ${H} L0 ${H} Z" fill="#f2f0ff"/><path d="${line}" fill="none" stroke="#7c4dff" stroke-width="2.4"/><circle cx="0" cy="${sc.y(pts[0].v)}" r="4.5" fill="#7c4dff" stroke="#fff" stroke-width="2"/>${marks}</svg>
      <div class="axis abs"><span style="left:0">${esc(t('Now'))}</span>${ticks.filter((h) => sc.x(h) > 40 && sc.x(h) < W - 18).map((h) => `<span style="left:${(100 * sc.x(h) / W).toFixed(1)}%">${hm(h)}</span>`).join('')}</div>
      ${list.length ? `<div class="grey-list">${list.map((d) => `<div class="gl-row"><div><div class="gl-title">${esc(d.src.kind === 'meal' ? `${d.src.name} · ${hm(d.t)}` : t('Correction · {time}', { time: hm(d.t) }))}</div><div class="gl-sub">${esc(t('{u} U taken', { u: u(d.u) }))}</div></div><b style="color:var(--purple)">${esc(t('{u} U left', { u: u(Math.round(d.left * 10) / 10) }))}</b></div>`).join('')}</div>` : `<div class="empty">${esc(t('No insulin working right now.'))}</div>`}
      <div class="fine left">${esc(t('Rapid insulin, {d} action, as in your settings. Brio subtracts it from every new dose.', { d: dur(s.diaMin) }))}</div>`,
  };
};
actions.correct = () => { const g = S.logs.filter((l) => l.kind === 'bg').sort((a, b) => b.t - a.t)[0]; if (!g) return; UI.card = false; closeAllSheets(); UI.sheet = { type: 'correction', bg: g.v, draft: {} }; render(); };
actions.iob = () => { closeAllSheets(); UI.sheet = { type: 'iob', draft: {} }; render(); };
