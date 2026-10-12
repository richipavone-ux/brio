import { S, UI, now, actions, commit, openSheet, inputs, sheets, closeAllSheets, render } from '../ctx.js';
import { t } from '../i18n.js';
import { orb, esc, hm, u, ringSvg, scale, path, longDate, num } from '../ui.js';
import { MIN, readings, forecastNow, lowThreshold, forecastFrom, trend, isNight } from '../calc.js';
import { glucoseNow, iobNow } from '../brain.js';
import { topBar } from './home.js';

const TIMER = 15 * MIN;
export const stopAt = () => Math.max(S.settings.low + 10, 80);

export const hypoActive = () => !!S.hypo && S.hypo.phase !== 'closed';

export function startHypo(level, reading) {
  S.hypo = {
    level, phase: 'alert', startedAt: now(), readingId: reading.id, rounds: 0, answered: false,
    events: [{ t: reading.t, kind: 'bg', v: reading.v, level }], timerEnd: null,
  };
}

function eventsList() {
  const h = S.hypo;
  return `<div class="white-list">${h.events.map((e) => {
    const label = e.kind === 'bg' ? `<b style="color:${e.v < S.settings.urgentLow ? 'var(--red)' : e.v < S.settings.low ? 'var(--amber)' : 'var(--ink)'}">${e.v}${e.arrow ? ' ' + e.arrow : ''}</b>` : `<b>${esc(t('{g} g sugar', { g: e.g }))}</b>`;
    const note = e.kind === 'bg' ? (e.level === 'urgent' ? t('Urgent low') : e.level === 'heading' ? t('Heading low') : e.v < S.settings.low ? t('Low') : e.arrow === '↗' ? t('Rising') : '') : t('You');
    return `<div class="ev-row"><span>${hm(e.t)}</span>${label}<span>${esc(note)}</span></div>`;
  }).join('')}</div>`;
}

function lowChart() {
  const at = now();
  const s = S.settings;
  const thr = lowThreshold(s, at);
  const from = at - 60 * MIN, to = at + 25 * MIN;
  const pts = readings(S).filter((r) => r.t >= from && r.t <= at).map((r) => ({ t: r.t, v: r.v }));
  const last = pts[pts.length - 1];
  const W = 338, H = 102;
  const sc = scale(from, to, 40, 180, W, H);
  let fc = '';
  if (last) {
    const base = { v: last.v, t: last.t, trend: trend(S, at) };
    const f = [0, 5, 10, 15, 20].map((m) => ({ t: last.t + m * MIN, v: forecastFrom(S, base, last.t + m * MIN) }));
    fc = `<path d="${path(f, sc)}" fill="none" stroke="#ef4444" stroke-width="2.2" stroke-dasharray="5 5"/>`;
  }
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="display:block">
    <rect x="0" y="${sc.y(thr)}" width="${W}" height="${H - sc.y(thr)}" fill="#fee2e2" rx="4"/>
    <line x1="0" x2="${W}" y1="${sc.y(thr)}" y2="${sc.y(thr)}" stroke="#ef4444" stroke-dasharray="3 4"/>
    ${pts.length > 1 ? `<path d="${path(pts, sc)}" fill="none" stroke="#10151f" stroke-width="2.6"/>` : ''}
    ${fc}
    ${last ? `<circle cx="${sc.x(last.t)}" cy="${sc.y(last.v)}" r="5" fill="#10151f" stroke="#fff" stroke-width="2"/>` : ''}
    <text x="4" y="${sc.y(thr) - 5}" font-size="11" fill="#dc2626" font-weight="600">${thr}</text></svg>`;
}

function alertView() {
  const h = S.hypo;
  const g = glucoseNow();
  const iob = iobNow();
  const f20 = forecastNow(S, now(), 20);
  const heading = h.level === 'heading';
  const title = h.rounds > 0 ? t('Still low. Another 15 g.') : heading ? t("You're heading low.") : t("You're low.");
  const sub = heading && f20 ? t('About {v} in 20 minutes. Better to eat something now.', { v: Math.round(f20 / 5) * 5 })
    : t('{v} mg/dL. Eat something now.', { v: g ? g.v : '' });
  return `<div class="screen hypo-bg">${topBar()}
    <div class="scroll"><div class="home-col">
      <div style="margin-top:clamp(12px,4vh,40px)">${orb(120, { mood: 'alert', eyes: 'wide' })}</div>
      <div class="sentence" style="margin-top:30px">${esc(title)}</div>
      <div class="sentence-sub">${esc(sub)}</div>
      <div class="alert-card">
        ${lowChart()}
        <div style="font-size:14px;color:var(--ink2);line-height:1.4">${t('Take <b>15 g of fast sugar</b>: 3 glucose tablets, or 150 ml of juice.')}${iob >= 0.1 ? ' ' + esc(t('Still {u} U working.', { u: u(iob) })) : ''}</div>
        <div class="btn-row"><button class="btn dark" style="flex:1.3" data-act="ateSugar" data-g="15">${esc(t('I ate 15 g'))}</button><button class="btn" data-act="sugarOther">${esc(t('Something else'))}</button></div>
      </div>
      ${heading && h.rounds === 0 ? `<button class="link" data-act="hypoDismiss">${esc(t("I'm fine, it's not right"))}</button>` : ''}
    </div></div></div>`;
}

function urgentView() {
  const h = S.hypo;
  const g = glucoseNow();
  const s = S.settings;
  const mins = (now() - h.startedAt) / MIN;
  const contact = s.contactName && s.contactPhone;
  let footer = s.critical ? t('Brio keeps ringing while this screen is open.') : '';
  if (contact) footer += ' ' + t("If you don't answer for 10 min, I'll ask you to message {name}.", { name: s.contactName });
  const msg = contact && mins >= 10 ? `<a class="btn light wide" href="${esc(smsLink())}" data-act="smsSent">${esc(t('Message {name}', { name: s.contactName }))}</a>` : '';
  return `<div class="screen urgent-bg">
    <div class="lock-date">${esc(longDate(now()))}</div>
    <div class="lock-time">${hm(now())}</div>
    <div class="urgent-wrap">
      <div class="urgent-card">
        <div class="urgent-head">${orb(30, { mood: 'alert' })}<b>${esc(t('URGENT LOW · {name}', { name: s.name.toUpperCase() }))}</b><span>${esc(t('now'))}</span></div>
        <div class="urgent-v"><span>${g ? g.v : '—'}</span><span>mg/dL ${g?.arrow || '↓'}</span></div>
        <div class="urgent-text">${esc(t("Eat 15 g of sugar now. I'll ring again in 15 minutes if you don't answer."))}</div>
        <div class="btn-row"><button class="btn light" data-act="ateSugar" data-g="15">${esc(t('I ate 15 g'))}</button><button class="btn glass" data-act="hypoOk">${esc(t("I'm OK"))}</button></div>
        ${msg}
      </div>
      <div class="urgent-foot">${esc(footer.trim())}</div>
    </div></div>`;
}

function smsLink() {
  const s = S.settings;
  const g = glucoseNow();
  let body = t("This is {name}, the diabetes app. My glucose is {v} mg/dL and I haven't answered for 10 minutes. Please check on me.", { name: s.name, v: g ? g.v : '?' });
  if (S.hypo?.loc) body += ' ' + t('Location: {url}', { url: S.hypo.loc });
  return `sms:${s.contactPhone.replace(/[^\d+]/g, '')}${/iPhone|iPad/.test(navigator.userAgent) ? '&' : '?'}body=${encodeURIComponent(body)}`;
}

function timerView() {
  const h = S.hypo;
  const left = Math.max(0, h.timerEnd - now());
  const frac = 1 - left / TIMER;
  const night = isNight(S.settings, now());
  return `<div class="screen hypo-bg">
    <div class="scroll"><div class="home-col">
      <div class="timer-ring" style="margin-top:clamp(24px,8vh,70px)">${ringSvg(200, 8, frac, '#f97316', '#fde2d4')}<div class="timer-orb">${orb(120)}</div></div>
      <div class="countdown" id="hypo-countdown">${mmss(left)}</div>
      <div class="sentence" style="font-size:24px;margin-top:6px">${esc(night ? t("Rest. I'll check again at {time}.", { time: hm(h.timerEnd) }) : t("Hang on. I'll check again at {time}.", { time: hm(h.timerEnd) }))}</div>
      <div style="align-self:stretch;margin-top:22px">${eventsList()}</div>
      <div class="foot-note">${esc(t("If it's still under {low} I'll ask for another 15 g. Once you're above {stop} I'll stop.", { low: S.settings.low, stop: stopAt() }))}</div>
      <button class="btn" style="align-self:stretch;margin-top:14px;flex:none" data-act="hypoAsk">${esc(t('Check now'))}</button>
    </div></div></div>`;
}

function doneView() {
  const h = S.hypo;
  const last = [...h.events].reverse().find((e) => e.kind === 'bg');
  return `<div class="screen home-bg">
    <div class="scroll"><div class="home-col">
      <div style="margin-top:clamp(40px,12vh,100px)">${orb(140, { eyes: 'happy' })}</div>
      <div class="sentence" style="margin-top:40px">${esc(t("You're back in range."))}</div>
      <div class="sentence-sub">${esc(t('{v} mg/dL. Nicely done.', { v: last ? last.v : '' }))}</div>
      <div style="align-self:stretch;margin-top:24px">${eventsList()}</div>
      <button class="btn dark" style="align-self:stretch;margin-top:auto;margin-bottom:24px;flex:none" data-act="hypoClose">${esc(t('Close'))}</button>
    </div></div></div>`;
}

export const mmss = (ms) => {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export function hypoView() {
  const h = S.hypo;
  if (h.phase === 'timer') return timerView();
  if (h.phase === 'done') return doneView();
  return h.level === 'urgent' && h.rounds === 0 ? urgentView() : alertView();
}

// Called with every new glucose value while a hypo episode is open.
export function hypoReading(v, reading) {
  const h = S.hypo;
  const prev = [...h.events].reverse().find((e) => e.kind === 'bg');
  h.events.push({ t: reading.t, kind: 'bg', v, arrow: prev ? (v > prev.v ? '↗' : v < prev.v ? '↘' : '') : '' });
  h.answered = true;
  if (v < S.settings.low) { h.phase = 'alert'; h.level = v < S.settings.urgentLow ? 'urgent' : 'low'; h.rounds++; }
  else if (v >= stopAt()) { h.phase = 'done'; }
  else { h.phase = 'timer'; h.timerEnd = now() + TIMER; h.asked = false; }
}

function logSugar(g) {
  const at = now();
  S.logs.push({ id: S.nextId++, kind: 'sugar', t: at, g });
  const h = S.hypo;
  h.events.push({ t: at, kind: 'sugar', g });
  h.answered = true;
  h.phase = 'timer';
  h.timerEnd = at + TIMER;
  h.asked = false;
}

actions.ateSugar = (el) => { logSugar(+el.dataset.g || 15); closeAllSheets(); commit(); };
actions.sugarOther = () => openSheet('sugar', { draft: { g: 15 } });
actions.hypoOk = () => { Object.assign(S.hypo, { answered: true, phase: 'timer', timerEnd: now() + TIMER, asked: false }); commit(); };
actions.hypoAsk = () => openSheet('glucose', { hypo: true });
actions.hypoDismiss = () => { S.hypo.phase = 'closed'; commit(); };
actions.hypoClose = () => { S.hypo.phase = 'closed'; commit(); };
actions.smsSent = () => { S.hypo.answered = true; };

// "Something else": how many grams of fast carbs.
sheets.sugar = (sh) => {
  const g = sh.draft.g;
  return {
    size: 'mid',
    html: `<div class="shead"><button data-act="close">${esc(t('Cancel'))}</button><b>${esc(t('What did you eat?'))}</b><span></span></div>
      <div class="sheet-lead">${esc(t('Fast sugar works best. Tell me the grams of carbs.'))}</div>
      <div class="chips">${[10, 15, 20, 30].map((x) => `<button class="chip${+g === x ? ' on' : ''}" data-act="sugarPick" data-g="${x}">${x} g</button>`).join('')}</div>
      <label class="field big"><span>${esc(t('Carbs'))}</span><input inputmode="decimal" data-k="g" value="${esc(g)}"><em>g</em></label>
      <button class="btn dark wide" data-act="sugarSave">${esc(t('I ate it'))}</button>`,
  };
};
actions.sugarPick = (el) => { UI.sheet.draft.g = +el.dataset.g; render(); };
actions.sugarSave = () => { const g = num(UI.sheet.draft.g); if (g > 0) { logSugar(g); closeAllSheets(); commit(); } };
inputs.sugar = () => {};

// Keep the countdown ticking without re-rendering the whole screen.
export function tickHypo() {
  const h = S.hypo;
  if (!h || h.phase !== 'timer') return false;
  const left = h.timerEnd - now();
  const el = document.getElementById('hypo-countdown');
  if (el) el.textContent = mmss(Math.max(0, left));
  if (left <= 0 && !h.asked && !(UI.sheet && UI.sheet.type === 'glucose')) {
    h.asked = true;
    openSheet('glucose', { hypo: true });
    return true;
  }
  return false;
}
