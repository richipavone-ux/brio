// "Talk to Brio": voice (or typed) commands. Every change it makes is shown back to you.
import { S, UI, now, actions, inputs, sheets, render, commit, swapSheet, closeAllSheets, go } from '../ctx.js';
import { t } from '../i18n.js';
import { orb, esc, hm, u, num } from '../ui.js';
import { MIN, plan, roundTo, fix, iobGoneBy } from '../calc.js';
import { parseMeal } from '../foods.js';
import { listen, stop as stopListening, canListen } from '../speech.js';
import { nextAction, meals, iobNow } from '../brain.js';

sheets.talk = (sh) => {
  const listening = sh.state === 'listening';
  const examples = [t('Glucose 120'), t('I took 4 units'), t('It was only half'), t("What's next?")];
  return {
    size: 'mid',
    html: `<div class="shead"><button data-act="talkClose">${esc(t('Close'))}</button><b>${esc(S.settings.name)}</b><span></span></div>
      <div style="display:flex;justify-content:center;padding:14px 0 4px">${orb(96, { mood: listening ? 'listen' : 'calm', eyes: sh.reply && sh.ok ? 'happy' : 'open', attrs: 'data-act="talkListen" role="button"' })}</div>
      <div class="serif say-text" id="talk-text">${esc(sh.text || (listening ? t('Listening…') : canListen() ? t('Tap me and talk.') : t('Type it, I am listening.')))}</div>
      ${sh.reply ? `<div class="brio-line">${orb(28, { eyes: sh.ok ? 'happy' : 'open' })}<div>${esc(sh.reply)}</div></div>` : ''}
      ${sh.followUp ? `<button class="btn dark wide" data-act="${sh.followUp.act}">${esc(sh.followUp.label)}</button>` : ''}
      <div class="chips">${examples.map((x) => `<button class="chip" data-act="talkTry" data-q="${esc(x)}">${esc(x)}</button>`).join('')}</div>
      <form class="talk-form" data-act="talkSend"><input data-k="q" value="" placeholder="${esc(t('Or type here'))}" enterkeyhint="send" autocomplete="off"><button class="btn dark" type="submit">${esc(t('Send'))}</button></form>`,
    mount: () => { if (canListen() && !sh.started) { sh.started = true; actions.talkListen(); } },
  };
};
inputs.talk = (k, v) => { UI.sheet.q = v; };

actions.talkListen = () => {
  const sh = UI.sheet;
  if (!sh || sh.type !== 'talk') return;
  if (sh.state === 'listening') { stopListening(); sh.state = 'idle'; render(); return; }
  if (!canListen()) { document.querySelector('.talk-form input')?.focus(); return; }
  Object.assign(sh, { state: 'listening', text: '', reply: '', followUp: null });
  render();
  listen({
    onPartial: (txt) => { sh.text = txt; const el = document.getElementById('talk-text'); if (el) el.textContent = txt; },
    onFinal: (txt) => { sh.state = 'idle'; handle(txt); },
    onError: () => { sh.state = 'idle'; if (UI.sheet === sh) render(); },
  });
};
actions.talkClose = () => { stopListening(); closeAllSheets(); };
actions.talkTry = (el) => handle(el.dataset.q);
actions.talkSend = () => { const q = (UI.sheet.q || document.querySelector('.talk-form input')?.value || '').trim(); if (q) handle(q); };

function reply(text, ok = true, followUp = null) {
  const sh = UI.sheet;
  if (!sh || sh.type !== 'talk') return;
  Object.assign(sh, { reply: text, ok, followUp });
  render();
}

const lc = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export function handle(raw) {
  const sh = UI.sheet;
  if (sh) { sh.text = raw; sh.q = ''; }
  const q = lc(raw);
  const at = now();
  const n = (re) => { const m = q.match(re); return m ? num(m[1]) : null; };

  // "it was only half" / "era solo mezza"
  if (/\b(only half|half of it|just half|solo mezz[ao]|solo meta|era mezz[ao]|meta)\b/.test(q)) {
    const m = meals().find((x) => at - x.t < 90 * 60 * 1000);
    if (!m) return reply(t("I don't see a meal in the last hour and a half."), false);
    return halfMeal(m);
  }
  // Insulin taken
  const units = n(/(\d+(?:[.,]\d)?)\s*(?:u\b|units?|unita|unità)/) ?? (/(took|taken|fatto|fatte|preso|presi)/.test(q) ? n(/(\d+(?:[.,]\d)?)/) : null);
  if (units != null && /(took|taken|take|fatto|fatte|preso|presi|ho fatto|insulin|insulina|u\b|units?|unita)/.test(q)) {
    const next = nextAction(at);
    if (next && next.kind === 'dose' && Math.abs(next.at - at) < 30 * MIN) {
      next.meal.doses.push({ part: 'later', u: units, t: at });
      commit();
      return reply(t('Logged {u} U for the {meal}.', { u: u(units), meal: next.meal.name }));
    }
    S.logs.push({ id: S.nextId++, kind: 'dose', t: at, u: units, note: '' });
    commit();
    return reply(t('Logged {u} U as a correction.', { u: u(units) }));
  }
  // Glucose
  const bg = n(/(?:glucose|glicemia|sugar|zucchero|sono a|i'?m at|bg|reading)\D{0,6}(\d{2,3})/) ?? (/^\s*\d{2,3}\s*$/.test(q) ? num(q) : null);
  if (bg != null && bg >= 20 && bg <= 600) {
    UI.sheet = { type: 'glucose', draft: { v: bg }, fromTalk: true };
    actions.saveBg();
    return;
  }
  if (/(what('?s| is)? next|what now|cosa (devo|c'?e)|prossim|adesso)/.test(q)) {
    const x = nextAction(at);
    if (!x) return reply(t('Nothing to do right now.'));
    if (x.kind === 'dose') return reply(t('{u} U for the {meal} at {time}.', { u: u(x.u), meal: x.meal.name, time: hm(x.at) }));
    return reply(t('A glucose check at {time}.', { time: hm(x.at) }));
  }
  if (/(on board|iob|working|insulina attiva|in circolo|sta lavorando)/.test(q)) {
    const iob = iobNow(at);
    const gone = iobGoneBy(S, at);
    return reply(iob >= 0.1 ? t('{u} U still working, gone by {time}.', { u: u(iob), time: hm(gone) }) : t('No insulin working right now.'));
  }
  if (/(week|settiman)/.test(q)) { closeAllSheets(); go('week'); return; }
  // Food
  const { items, portion } = parseMeal(S, raw);
  if (items.length) {
    stopListening();
    const name = items.length === 1 ? items[0].name : items.slice(0, 2).map((i) => i.name).join(t(' and '));
    swapSheet('review', { source: 'said', heard: raw, draft: { name, items: items.map((i) => ({ ...i, base: { ...i.base } })), portion, photo: null, q: '' } });
    return;
  }
  reply(t("I didn't get that. Try “glucose 120”, “I took 4 units” or tell me what you're eating."), false);
}

// Brio 3b: "it was only half" – halve the meal, recompute the second dose, show the diff.
function halfMeal(m) {
  const before = { carbs: m.carbs, later: m.plan.later };
  const taken = (m.doses || []).reduce((a, d) => a + d.u, 0);
  m.items = m.items.map((i) => ({ ...i, carbs: fix(i.carbs / 2), fat: fix(i.fat / 2), protein: fix(i.protein / 2) }));
  m.carbs = fix(m.carbs / 2); m.fat = fix(m.fat / 2); m.protein = fix(m.protein / 2);
  const view = { settings: S.settings, logs: S.logs.filter((l) => l !== m && l.t < m.t) };
  const p = plan({ carbs: m.carbs, fat: m.fat, bg: m.bgBefore }, view, m.t);
  const laterTaken = (m.doses || []).some((d) => d.part === 'later');
  let msg = t('OK, half the {meal}: {a} g → {b} g carbs.', { meal: m.name.toLowerCase(), a: Math.round(before.carbs), b: Math.round(m.carbs) });
  if (!laterTaken && before.later > 0) {
    const rest = Math.max(0, fix(roundTo(p.total - taken, S.settings.penStep)));
    m.plan = { ...m.plan, total: p.total, later: rest };
    if (!rest) m.skippedLater = true;
    msg += ' ' + (rest ? t('Second dose: {a} U → {b} U.', { a: u(before.later), b: u(rest) }) : t('No second dose needed any more.'));
  } else if (taken > p.total + S.settings.penStep) {
    msg += ' ' + t('You took {a} U for it, more than the {b} U it needs. Keep an eye out for a low.', { a: u(taken), b: u(p.total) });
  }
  m.plan.total = p.total;
  commit();
  reply(msg);
}
