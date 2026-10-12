import { S, UI, now, views, actions, inputs, sheets, render, commit, back, openSheet, closeAllSheets, meal as findMeal, toast } from '../ctx.js';
import { t, tn } from '../i18n.js';
import { orb, esc, hm, u, num, dur, scale, path } from '../ui.js';
import { MIN, mealStatus, forecastCurve, readings, fix } from '../calc.js';
import { meals } from '../brain.js';

function memoryLine(m) {
  const at = now();
  const same = meals().filter((x) => x.id !== m.id && x.name.toLowerCase() === m.name.toLowerCase() && x.t < m.t && m.t - x.t < 30 * 24 * 60 * MIN);
  if (!same.length) return t("First time I see this meal. I'll remember how it goes.");
  const closed = same.map((x) => ({ x, st: mealStatus(x, S, at) })).filter((o) => o.st.closed && o.st.peak);
  let line = tn(same.length, 'You had this once before in the last 30 days.', 'You had this {n} times in the last 30 days.');
  if (closed.length) {
    const avg = Math.round(closed.reduce((a, o) => a + o.st.peak.v, 0) / closed.length / 5) * 5;
    const avgH = closed.reduce((a, o) => a + (o.st.peak.t - o.x.t), 0) / closed.length / MIN;
    const ok = closed.filter((o) => o.st.inRange === 100).length;
    line += ' ' + t('It usually peaks around {v} at {d} and {a} of {b} stayed in range.', { v: avg, d: dur(Math.round(avgH / 10) * 10), a: ok, b: closed.length });
  }
  return line;
}

function chart(m, st, live) {
  const s = S.settings;
  const at = now();
  const from = m.t - 10 * MIN;
  const to = Math.min(Math.max(st.end + 30 * MIN, from + 3 * 60 * MIN), m.t + 6 * 60 * MIN);
  const W = 338, H = live ? 130 : 104;
  const win = readings(S).filter((r) => r.t >= from - 20 * MIN && r.t <= to).map((r) => ({ t: Math.max(r.t, from), v: r.v }));
  const all = win.map((p) => p.v);
  const fc = m.bgBefore ? forecastCurve(m, S, m.t, to) : [];
  const vmax = Math.max(240, ...all, ...fc.map((p) => p.v)) + 10;
  const vmin = Math.min(60, ...all) - 5;
  const sc = scale(from, to, vmin, vmax, W, H);
  const band = `<rect x="0" y="${sc.y(s.rangeHigh).toFixed(1)}" width="${W}" height="${(sc.y(s.rangeLow) - sc.y(s.rangeHigh)).toFixed(1)}" fill="#e9f6ef" rx="6"/>`;
  const fpath = fc.length ? `<path d="${path(fc, sc)}" fill="none" stroke="#a99bf5" stroke-width="2" stroke-dasharray="5 5"/>` : '';
  const ypath = win.length > 1 ? `<path d="${path(win, sc)}" fill="none" stroke="#10151f" stroke-width="2.6" stroke-linejoin="round"/>` : '';
  const last = win[win.length - 1];
  const dot = last ? `<circle cx="${sc.x(last.t).toFixed(1)}" cy="${sc.y(last.v).toFixed(1)}" r="${live ? 5 : 4.5}" fill="#10151f" stroke="#fff" stroke-width="2"/>` : '';
  const nowLine = live && at < to ? `<line x1="${sc.x(at).toFixed(1)}" x2="${sc.x(at).toFixed(1)}" y1="0" y2="${H}" stroke="#dc2626" stroke-width="1" opacity=".4"/>` : '';
  let chips = '';
  if (live) {
    chips = st.steps.map((x) => {
      const cx = Math.max(17, Math.min(W - 17, sc.x(x.at)));
      if (x.kind === 'dose') {
        const fill = x.done ? '#0f9d6c' : '#fff', fg = x.done ? '#fff' : '#5b3fd6', stroke = x.done ? '#0f9d6c' : '#5b3fd6';
        return `<g transform="translate(${cx.toFixed(1)},${H + 4})"><rect x="-19" y="0" width="38" height="20" rx="10" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/><text x="0" y="14" text-anchor="middle" font-size="11" font-weight="700" fill="${fg}">${esc(u(x.u))}${x.done ? ' U' : ''}</text></g>`;
      }
      return `<circle cx="${cx.toFixed(1)}" cy="${H + 14}" r="5" fill="${x.done ? '#0f9d6c' : '#fff'}" stroke="${x.done ? '#0f9d6c' : '#98a2b3'}" stroke-width="1.5"/>`;
    }).join('');
  }
  return `<svg viewBox="0 0 ${W} ${H + (live ? 26 : 0)}" width="100%" style="display:block;overflow:visible">${band}${fpath}${ypath}${dot}${nowLine}${chips}</svg>`;
}

views.meal = (id) => {
  const m = findMeal(id);
  if (!m) return views.memory();
  const at = now();
  const st = mealStatus(m, S, at);
  const live = !st.closed;
  const totalU = (m.doses || []).reduce((a, d) => a + d.u, 0);
  const s = S.settings;
  const subtitle = [hm(m.t), t('{c} g carbs', { c: Math.round(m.carbs) }),
    m.plan.split ? t('fatty, split dose') : null,
    !live ? t('{u} U in {n} doses', { u: u(totalU), n: (m.doses || []).length }) : null].filter(Boolean).join(' · ');

  let statusLabel, statusColor = 'var(--ink)';
  if (live) {
    const late = st.steps.some((x) => !x.done && !x.skipped && x.at < at - 15 * MIN);
    statusLabel = late ? t('Waiting for you') : t('On track');
  } else if (st.inRange === 100) { statusLabel = t('Done · stayed in range'); statusColor = 'var(--green)'; }
  else if (st.peak && st.peak.v > s.rangeHigh) { statusLabel = t('Done · peaked {v}', { v: st.peak.v }); statusColor = 'var(--amber)'; }
  else if (st.missing) { statusLabel = t('Done · {n} check missing', { n: st.missing }); statusColor = 'var(--muted)'; }
  else { statusLabel = t('Done'); }

  const legend = live ? `<div class="legend"><span><i class="lg-you"></i>${esc(t('You'))}</span>${m.bgBefore ? `<span><i class="lg-fc"></i>${esc(t("Brio's forecast"))}</span>` : ''}<span><i class="lg-ck"></i>${esc(t('Checks'))}</span></div>` : '';
  const stats = !live ? `<div class="stats3"><div><b>${st.peak ? st.peak.v : '—'}</b>${esc(st.peak ? t('peak at {d}', { d: dur((st.peak.t - m.t) / MIN) }) : t('no readings'))}</div><div><b>${st.inRange != null ? st.inRange + '%' : '—'}</b>${esc(t('in range'))}</div><div><b>${st.vsForecast != null ? (st.vsForecast > 0 ? '+' : st.vsForecast < 0 ? '−' : '') + Math.abs(st.vsForecast) : '—'}</b>${esc(t('vs forecast'))}</div></div>` : '';

  let brio = memoryLine(m);
  if (!live && st.vsForecast != null) {
    brio = st.vsForecast <= 0 && st.inRange === 100 ? t("Better than I expected. Next time I'll suggest the same split.")
      : st.vsForecast > 25 ? t('Higher than I expected. If it happens again, talk to your care team about this meal.')
        : t('About as I expected. Noted for next time.');
    if (!m.plan.split) brio = brio.replace(t(" Next time I'll suggest the same split."), '');
  }

  const p = m.plan;
  const why = [[t('{c} g ÷ carb ratio {r}', { c: Math.round(m.carbs), r: u(s.icr) }), `${u(p.cu)} U`],
    m.bgBefore ? [t('Correction {a} → {b}', { a: m.bgBefore, b: s.target }), `${p.co >= 0 ? '+' : '−'}${u(Math.abs(Math.round(p.co * 10) / 10))} U`] : null,
    p.iob >= 0.05 ? [t('Insulin still on board'), `−${u(Math.round(p.iob * 10) / 10)} U`] : null,
    [t('Suggested'), `${u(p.total)} U`],
    ...(m.doses || []).map((d) => [t('Taken at {time}', { time: hm(d.t) }), `${u(d.u)} U`])].filter(Boolean);
  const nearby = S.logs.filter((l) => (l.kind === 'bg' || l.kind === 'dose') && l.t >= m.t - 30 * MIN && l.t <= st.end + 60 * MIN);
  const logsList = [...nearby.map((l) => ({ t: l.t, label: l.kind === 'bg' ? t('Glucose {v}', { v: l.v }) : t('{u} U correction', { u: u(l.u) }) })),
    ...(m.doses || []).map((d) => ({ t: d.t, label: t('{u} U insulin', { u: u(d.u) }) }))].sort((a, b) => a.t - b.t);
  const nBg = nearby.filter((l) => l.kind === 'bg').length;
  const nIns = (m.doses || []).length + nearby.filter((l) => l.kind === 'dose').length;
  const ex = UI.expand;
  const fold = (key, label, right, body) => `<button class="row" data-act="fold" data-key="${key}" aria-expanded="${!!ex[key]}"><div class="row-l">${esc(label)}</div><div class="row-r">${esc(right)}<span class="chev${ex[key] ? ' open' : ''}">›</span></div></button>${ex[key] ? `<div class="fold-body">${body}</div>` : ''}`;

  return `<div class="screen plain-bg">
    <div class="navbar"><button data-act="back">‹ ${esc(UI.stack.length && UI.stack[UI.stack.length - 1].view === 'memory' ? t('Memory') : t('Today'))}</button><button data-act="editMeal" data-id="${m.id}">${esc(t('Edit'))}</button></div>
    <div class="scroll page">
      <div class="meal-head">${m.photo ? `<img class="thumb lg" src="${m.photo}" alt="">` : '<div class="thumb lg ph"></div>'}<div style="flex:1;min-width:0"><div class="h-24">${esc(m.name)}</div><div class="muted-13">${esc(subtitle)}</div></div></div>
      <div class="card">
        <div class="card-head"><b style="color:${statusColor}">${esc(statusLabel)}</b><span>${esc(t('{a} of {b} done', { a: st.done, b: st.total }))}</span></div>
        ${chart(m, st, live)}
        ${legend}${stats}
      </div>
      <div class="brio-line">${orb(34, { eyes: !live && st.inRange === 100 ? 'happy' : 'open' })}<div>${esc(brio)}</div></div>
      <div class="group">
        ${fold('why', t('Why this dose'), `${u(p.total)} U`, `<div class="calc flat">${why.map(([a, b]) => `<div><span>${esc(a)}</span><b>${esc(b)}</b></div>`).join('')}</div>`)}
        ${fold('plate', t('On the plate'), tn(m.items.length, '1 item', '{n} items'), `<div class="calc flat">${m.items.map((i) => `<div><span>${esc(i.name)}${i.portion ? ` · ${esc(i.portion)}` : ''}</span><b>${fix(i.carbs)} g</b></div>`).join('')}<div><span>${esc(t('Fat · protein'))}</span><b>${Math.round(m.fat)} g · ${Math.round(m.protein)} g</b></div></div>`)}
        ${fold('logs', t('All logs'), t('{a} glucose · {b} insulin', { a: nBg, b: nIns }), `<div class="calc flat">${logsList.map((l) => `<div><span>${hm(l.t)}</span><b>${esc(l.label)}</b></div>`).join('') || esc(t('Nothing yet.'))}</div>`)}
      </div>
      ${m.note ? `<div class="note-card">${esc(m.note)}</div>` : ''}
      <div class="btn-row">
        <button class="btn" data-act="favMeal" data-id="${m.id}">${m.favorite ? '★' : '☆'} ${esc(t('Favorite'))}</button>
        <button class="btn" data-act="noteMeal" data-id="${m.id}">${esc(m.note ? t('Edit note') : t('Add a note'))}</button>
      </div>
      <button class="btn wide" data-act="repeatFrom" data-id="${m.id}">${esc(t('Eat this again'))}</button>
    </div></div>`;
};

actions.back = () => back();
actions.fold = (el) => { const k = el.dataset.key; UI.expand[k] = !UI.expand[k]; render(); };
actions.favMeal = (el) => { const m = findMeal(+el.dataset.id); m.favorite = !m.favorite; commit(); };
actions.noteMeal = (el) => openSheet('note', { id: +el.dataset.id, draft: { note: findMeal(+el.dataset.id).note || '' } });
actions.repeatFrom = (el) => {
  const m = findMeal(+el.dataset.id);
  openSheet('dose', { source: 'repeat', from: m.id, draft: { name: m.name, items: m.items.map((i) => ({ ...i, base: { ...(i.base || i) } })), portion: 1, photo: m.photo || null, q: '' } });
};

sheets.note = (sh) => ({
  size: 'mid',
  html: `<div class="shead"><button data-act="close">${esc(t('Cancel'))}</button><b>${esc(t('Note'))}</b><button class="strong" data-act="saveNote">${esc(t('Save'))}</button></div>
    <textarea class="note-input" data-k="note" rows="5" placeholder="${esc(t('Anything worth remembering? A walk after, a stressful day…'))}">${esc(sh.draft.note)}</textarea>`,
  mount: () => document.querySelector('.note-input')?.focus(),
});
inputs.note = (k, v) => { UI.sheet.draft[k] = v; };
actions.saveNote = () => { findMeal(UI.sheet.id).note = UI.sheet.draft.note.trim(); closeAllSheets(); commit(); };

// ---- Edit a logged meal ----------------------------------------------------------
sheets.editMeal = (sh) => {
  const m = findMeal(sh.id);
  const d = sh.draft;
  if (d.name == null) {
    Object.assign(d, { name: m.name, time: hm(m.t), carbs: m.carbs, fat: m.fat, bg: m.bgBefore ?? '' });
    (m.doses || []).forEach((x, i) => { d['dose' + i] = x.u; });
  }
  return {
    size: 'tall',
    html: `<div class="shead"><button data-act="close">${esc(t('Cancel'))}</button><b>${esc(t('Edit meal'))}</b><button class="strong" data-act="saveMeal">${esc(t('Save'))}</button></div>
      <div class="sheet-scroll">
      <input class="meal-name" data-k="name" value="${esc(d.name)}">
      <div class="form">
        <label><span>${esc(t('Time'))}</span><input type="time" data-k="time" value="${esc(d.time)}"></label>
        <label><span>${esc(t('Carbs (g)'))}</span><input inputmode="decimal" data-k="carbs" value="${esc(d.carbs)}"></label>
        <label><span>${esc(t('Fat (g)'))}</span><input inputmode="decimal" data-k="fat" value="${esc(d.fat)}"></label>
        <label><span>${esc(t('Glucose before'))}</span><input inputmode="numeric" data-k="bg" value="${esc(d.bg)}"></label>
        ${(m.doses || []).map((x, i) => `<label><span>${esc(t('Insulin at {time} (U)', { time: hm(x.t) }))}</span><input inputmode="decimal" data-k="dose${i}" value="${esc(d['dose' + i])}"></label>`).join('')}
      </div>
      <div class="fine left">${esc(t('Changing carbs here updates the log, not the doses you already took.'))}</div>
      <button class="link danger" data-act="deleteMeal">${esc(t('Delete meal'))}</button>
      </div>`,
  };
};
inputs.editMeal = (k, v) => { UI.sheet.draft[k] = v; };
actions.editMeal = (el) => openSheet('editMeal', { id: +el.dataset.id });
actions.saveMeal = () => {
  const m = findMeal(UI.sheet.id);
  const d = UI.sheet.draft;
  const [h, mm] = String(d.time).split(':').map(Number);
  const nt = new Date(m.t); nt.setHours(h, mm || 0, 0, 0);
  const shift = nt.getTime() - m.t;
  const oldCarbs = m.carbs || 1;
  m.name = d.name.trim() || m.name;
  m.carbs = num(d.carbs); m.fat = num(d.fat);
  if (m.items.length === 1) { m.items[0].carbs = m.carbs; m.items[0].fat = m.fat; }
  else if (m.carbs !== oldCarbs) m.items.forEach((i) => { i.carbs = fix(i.carbs * m.carbs / oldCarbs); });
  m.bgBefore = num(d.bg) || null;
  (m.doses || []).forEach((x, i) => { x.u = num(d['dose' + i]); x.t += shift; });
  m.doses = (m.doses || []).filter((x) => x.u > 0);
  if (shift) { m.t += shift; if (m.laterAt) m.laterAt += shift; if (m.plan.laterAt) m.plan.laterAt += shift; m.checks = m.checks.map((c) => c + shift); }
  closeAllSheets(); commit(); toast(t('Saved.'));
};
actions.deleteMeal = () => {
  if (!confirm(t('Delete this meal and its doses?'))) return;
  S.logs = S.logs.filter((l) => l.id !== UI.sheet.id);
  closeAllSheets();
  back();
  commit();
};
