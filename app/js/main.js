import { S, UI, now, actions, inputs, views, sheets, setRender, render, commit, persist, go, openSheet, closeAllSheets, closeSheet, toast } from './ctx.js';
import { t, setLang } from './i18n.js';
import { esc, u } from './ui.js';
import { lowRisk, agenda } from './brain.js';
import { lastReading } from './calc.js';
import { notify, unlockAudio, chime } from './notify.js';
import { stop as stopListening } from './speech.js';
import './views/home.js';
import { hypoActive, startHypo, tickHypo } from './views/hypo.js';
import { repeatLast, stopCamera, onPhotoFile } from './views/mealflow.js';
import './views/glucose.js';
import './views/meal.js';
import './views/memory.js';
import './views/settings.js';
import './views/talk.js';
import { needsOnboarding } from './views/onboarding.js';

setLang(S.settings.lang);
const root = document.getElementById('app');

// ---- Rendering ----------------------------------------------------------------
let lastKey = '';
const stripVolatile = (h) => h.replace(/animation-delay:-\d+ms/g, '');

function draw({ force = false } = {}) {
  setLang(S.settings.lang);
  const onboarding = needsOnboarding();
  if (onboarding && UI.view !== 'onboarding') { UI.view = 'onboarding'; UI.arg = UI.arg || 0; }
  const view = (views[UI.view] || views.home)(UI.arg);
  let sheetHtml = '';
  let mount = null;
  if (UI.sheet && sheets[UI.sheet.type]) {
    const sh = sheets[UI.sheet.type](UI.sheet);
    mount = sh.mount;
    const full = sh.size === 'full';
    sheetHtml = `<div class="sheet-wrap ${sh.size}">${full ? '' : '<div class="backdrop" data-act="backdrop"></div>'}<div class="sheet ${sh.size}" role="dialog" aria-modal="true">${full ? '' : '<div class="grab"></div>'}${sh.html}</div></div>`;
  }
  const toastHtml = UI.toast ? `<div class="toast" role="status">${esc(UI.toast)}</div>` : '';
  const html = view + sheetHtml + toastHtml;
  const key = stripVolatile(html);
  if (!force && key === lastKey) return;
  lastKey = key;

  // Keep scroll positions and the focused field across re-renders.
  const scrolls = [...root.querySelectorAll('.scroll, .sheet-scroll')].map((el) => el.scrollTop);
  const active = document.activeElement;
  const focusKey = active?.dataset?.k;
  const sel = focusKey && 'selectionStart' in active ? [active.selectionStart, active.selectionEnd] : null;

  root.innerHTML = html;

  root.querySelectorAll('.scroll, .sheet-scroll').forEach((el, i) => { if (scrolls[i]) el.scrollTop = scrolls[i]; });
  if (focusKey) {
    const el = root.querySelector(`[data-k="${CSS.escape(focusKey)}"]`);
    if (el) { el.focus({ preventScroll: true }); if (sel) { try { el.setSelectionRange(...sel); } catch { /* not a text field */ } } }
  }
  document.body.classList.toggle('dark-chrome', /urgent-bg|camera/.test(html.slice(0, 400)) || UI.sheet?.type === 'camera');
  mount?.();
}
setRender(() => draw());

// ---- Clicks, inputs, forms ----------------------------------------------------------
// After a hold or a swipe the screen changes under the finger: swallow the click that follows.
let suppress = null;
const suppressOn = (el, ms) => { suppress = el ? { el, until: Date.now() + ms } : null; };

root.addEventListener('click', (e) => {
  unlockAudio();
  if (suppress && Date.now() < suppress.until && suppress.el.contains(e.target)) { e.preventDefault(); e.stopPropagation(); suppress = null; return; }
  const el = e.target.closest('[data-act]');
  if (!el || el.tagName === 'FORM') return;
  if (el.disabled) return;
  const act = el.dataset.act;
  if (el.tagName !== 'A') e.preventDefault();
  if (act === 'step') return step(el);
  actions[act]?.(el, e);
});

root.addEventListener('keydown', (e) => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[role="button"][data-act]')) { e.preventDefault(); e.target.click(); }
  if (e.key === 'Enter' && e.target.matches('input[data-k="q"]') && UI.sheet?.type === 'review') {
    e.preventDefault(); document.querySelector('.results .res')?.click();
  }
  if (e.key === 'Enter' && e.target.matches('input[data-k="text"]') && UI.sheet?.type === 'say') { e.preventDefault(); actions.sayDone(); }
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && UI.sheet) actions.backdrop(); });

function onInput(e) {
  const el = e.target;
  if (el.dataset.file) { if (el.files?.[0]) onPhotoFile(el.files[0]); return; }
  const k = el.dataset.k;
  if (!k) return;
  const v = el.type === 'checkbox' ? el.checked : el.value;
  if (UI.sheet) inputs[UI.sheet.type]?.(k, v, el);
  else inputs['view_' + k]?.(v, el);
}
root.addEventListener('input', (e) => { if (e.target.tagName !== 'SELECT' && e.target.type !== 'checkbox' && e.target.type !== 'file') onInput(e); });
root.addEventListener('change', (e) => { if (e.target.tagName === 'SELECT' || e.target.type === 'checkbox' || e.target.type === 'file') onInput(e); });
root.addEventListener('submit', (e) => {
  e.preventDefault();
  const act = e.target.dataset.act;
  actions[act]?.(e.target, e);
});

function step(btn) {
  const box = btn.closest('.stepper');
  const input = box.querySelector('input');
  const stepV = +box.dataset.step, min = +box.dataset.min, max = +box.dataset.max;
  const cur = parseFloat(String(input.value).replace(',', '.')) || 0;
  let v = Math.round((cur + stepV * +btn.dataset.dir) / stepV) * stepV;
  v = Math.max(min, Math.min(max, Math.round(v * 100) / 100));
  input.value = S.settings.lang === 'it' ? String(v).replace('.', ',') : String(v);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

actions.backdrop = () => { stopCamera(); stopListening(); closeAllSheets(); };
actions.close = () => { stopListening(); closeSheet(); };
actions.closeAll = () => { stopCamera(); stopListening(); closeAllSheets(); };
actions.newMeal = () => { UI.card = false; closeAllSheets(); openSheet('newMeal'); };
actions.gesture = (el) => gesture(el.dataset.g);

// ---- Orb gestures -------------------------------------------------------------------
const HOLD_MS = 650, DOUBLE_MS = 300;
let press = null, tapTimer = null, lastTapAt = 0;

function gesture(g) {
  const s = S.settings;
  if (g === 'tap' && UI.card) { UI.card = false; render(); return; }
  const act = s.gestures[g];
  if (!act || act === 'none') return;
  if ((s.uses[g] || 0) < 3) { s.uses[g] = (s.uses[g] || 0) + 1; persist(); }
  runAction(act);
}

export function runAction(act) {
  if (act === 'now') { UI.card = !UI.card; render(); }
  else if (act === 'meal') actions.newMeal();
  else if (act === 'glucose') actions.glucose();
  else if (act === 'talk') { UI.card = false; openSheet('talk', { state: 'idle' }); }
  else if (act === 'week') go('week');
  else if (act === 'repeat') repeatLast();
  else if (act === 'memory') go('memory');
}

function setRing(frac) {
  const c = root.querySelector('.hold-prog');
  if (!c) return;
  const len = 2 * Math.PI * +c.getAttribute('r');
  c.setAttribute('stroke-dasharray', `${(len * frac).toFixed(1)} ${len.toFixed(1)}`);
  c.closest('.orb-hit')?.classList.toggle('holding', frac > 0);
}

root.addEventListener('pointerdown', (e) => {
  unlockAudio();
  const orbEl = e.target.closest('[data-orb]');
  const holdEl = !orbEl && e.target.closest('[data-hold]');
  const swipeEl = e.target.closest('[data-swipe]');
  press = { x: e.clientX, y: e.clientY, t: performance.now(), orb: !!orbEl, holdEl, swipe: !!swipeEl, fired: false, raf: 0, timer: 0 };
  if (orbEl && S.settings.gestures.hold !== 'none') {
    const p = press;
    const tick = () => {
      if (press !== p) return;
      const frac = (performance.now() - p.t - 120) / (HOLD_MS - 120);
      if (frac > 0) setRing(Math.min(1, frac));
      if (frac >= 1) { p.fired = true; setRing(0); clearTimeout(tapTimer); lastTapAt = 0; suppressOn(root, 700); gesture('hold'); return; }
      p.raf = requestAnimationFrame(tick);
    };
    p.raf = requestAnimationFrame(tick);
  }
  if (holdEl) {
    const p = press;
    p.timer = setTimeout(() => { if (press === p) { p.fired = true; suppressOn(root, 700); actions[holdEl.dataset.hold]?.(holdEl); } }, 550);
  }
});

root.addEventListener('pointermove', (e) => {
  if (!press || press.fired) return;
  const dx = e.clientX - press.x, dy = e.clientY - press.y;
  if (Math.hypot(dx, dy) > 12) {
    cancelAnimationFrame(press.raf); clearTimeout(press.timer); setRing(0);
    press.moved = true;
  }
});

function endPress(e, cancelled) {
  const p = press;
  press = null;
  if (!p) return;
  cancelAnimationFrame(p.raf); clearTimeout(p.timer);
  if (p.fired) return;
  setRing(0);
  if (cancelled) return;
  const dx = e.clientX - p.x, dy = e.clientY - p.y;
  // Swipe up anywhere on the home (when it isn't scrolling) or from the grabber.
  if (p.swipe && dy < -60 && Math.abs(dx) < 80) {
    const sc = root.querySelector('.home-scroll');
    const scrollable = sc && sc.scrollHeight > sc.clientHeight + 4;
    if (!scrollable || e.target.closest?.('.grabber') || p.y > window.innerHeight - 140) { suppressOn(root, 400); gesture('swipe'); return; }
  }
  if (!p.orb || p.moved) return;
  const at = performance.now();
  if (at - lastTapAt < DOUBLE_MS) {
    clearTimeout(tapTimer); lastTapAt = 0;
    gesture('double');
  } else {
    lastTapAt = at;
    // With no double-tap action, a tap fires at once.
    if (S.settings.gestures.double === 'none') { lastTapAt = 0; gesture('tap'); return; }
    tapTimer = setTimeout(() => { lastTapAt = 0; gesture('tap'); }, DOUBLE_MS);
  }
}
root.addEventListener('pointerup', (e) => endPress(e, false));
root.addEventListener('pointercancel', (e) => endPress(e, true));
root.addEventListener('contextmenu', (e) => { if (e.target.closest('[data-orb],[data-hold]')) e.preventDefault(); });

// Keyboard access to the orb: Enter = tap, Shift+Enter = double tap, Alt+Enter = hold.
root.addEventListener('keydown', (e) => {
  if (!e.target.matches('[data-orb]') || e.key !== 'Enter') return;
  e.preventDefault();
  gesture(e.altKey ? 'hold' : e.shiftKey ? 'double' : 'tap');
});

// ---- Background loop: lows, reminders, notifications ------------------------------------
let n = 0;
function loop() {
  n++;
  if (tickHypo()) return;
  const at = now();
  if (n % 5 === 0) checkLows(at);
  if (n % 5 === 0) checkReminders(at);
  const h = S.hypo;
  if (h && h.phase === 'alert' && h.level === 'urgent' && !h.answered && S.settings.critical && n % 4 === 0 && document.visibilityState === 'visible') chime();
  if (n % 20 === 0 && !(UI.sheet && document.activeElement?.dataset?.k)) render();
}

function checkLows(at) {
  const risk = lowRisk(at);
  const r = lastReading(S, at);
  if (!risk || !r) return;
  if (hypoActive()) {
    if (risk.level === 'urgent' && S.hypo.level !== 'urgent' && S.hypo.phase === 'alert') { S.hypo.level = 'urgent'; commit(); }
    return;
  }
  if (S.hypo && S.hypo.readingId === r.id) return;  // already handled this reading
  startHypo(risk.level, r);
  UI.sheet = null; UI.sheetStack = []; UI.card = false;
  if (UI.view !== 'home') { UI.stack = []; UI.view = 'home'; }
  commit();
  chime();
  const title = risk.level === 'urgent' ? t('Urgent low: {v} mg/dL', { v: r.v }) : risk.level === 'low' ? t("You're low: {v} mg/dL", { v: r.v }) : t("You're heading low");
  if (document.visibilityState !== 'visible') notify(title, t('Eat 15 g of fast sugar now.'), 'hypo');
}

function checkReminders(at) {
  const pref = S.settings.notify;
  let changed = false;
  for (const x of agenda(at)) {
    if (x.at > at || S.notified[x.key]) continue;
    S.notified[x.key] = at;
    changed = true;
    const wants = pref === 'all' || (pref === 'doses' && x.kind === 'dose');
    if (!wants) continue;
    if (document.visibilityState === 'visible') { toast(x.kind === 'dose' ? t('Time for {u} U.', { u: u(x.u) }) : t('Time to check your glucose.')); continue; }
    if (x.kind === 'dose') notify(t('{u} U for the {meal}', { u: u(x.u), meal: x.meal.name }), t('Second part of the dose. Tap to confirm in Brio.'), x.key);
    else notify(t('How is it going?'), x.meal ? t('{meal}: time to check your glucose.', { meal: x.meal.name }) : t('Time to check your glucose.'), x.key);
  }
  if (changed) persist();
}

document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { checkLows(now()); render(); } });
window.addEventListener('pageshow', () => render());

// ---- Start ---------------------------------------------------------------------------
draw({ force: true });
setInterval(loop, 1000);
checkLows(now());

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => { /* offline support is optional */ });
}

// Handy for testing in the browser console.
window.brio = { S, UI, now, render, runAction };
