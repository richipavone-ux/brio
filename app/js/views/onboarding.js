// First run, as in 1d: one number per screen, then the safety note.
import { S, UI, now, views, actions, inputs, render, commit, home } from '../ctx.js';
import { t, setLang } from '../i18n.js';
import { orb, esc, u, num } from '../ui.js';
import { exampleDay } from '../store.js';

const STEPS = [
  { key: 'icr', q: 'How many grams of carbs does 1 unit cover?', help: 'On your care plan this is called carb ratio or ICR. Every dose Brio suggests starts from it.', unit: 'g per unit', step: 0.5, min: 1, max: 60, example: (v) => t('Example: with {v}, a 60 g pasta lunch needs {u} U before any correction.', { v: u(v), u: u(Math.round((60 / v) * 2) / 2) }) },
  { key: 'isf', q: 'How much does 1 unit bring your glucose down?', help: 'Called sensitivity, correction factor or ISF. Brio uses it to correct highs.', unit: 'mg/dL per unit', step: 1, min: 5, max: 250, example: (v) => t('Example: at 190 with a goal of 110, that is {u} U of correction.', { u: u(Math.round((80 / v) * 2) / 2) }) },
  { key: 'target', q: 'What glucose do you aim for?', help: 'Brio corrects towards this number.', unit: 'mg/dL', step: 5, min: 80, max: 180, example: () => t('Most care plans use something between 100 and 120.') },
  { key: 'diaMin', q: 'How long does your rapid insulin work?', help: 'Used to know how much insulin is still on board, so doses never stack.', unit: 'hours', step: 0.5, min: 2, max: 8, scale: 60, example: () => t('Most rapid insulins: 3 to 5 hours. Ask your care team if unsure.') },
];

views.onboarding = () => {
  const step = UI.arg || 0;
  const s = S.settings;
  if (step === 0) {
    return `<div class="screen home-bg"><div class="scroll page onb">
      <div style="display:flex;justify-content:center;margin-top:clamp(30px,10vh,90px)">${orb(130)}</div>
      <div class="serif" style="font-size:34px;text-align:center;letter-spacing:-.6px;margin-top:30px">${esc(t('Hi, I’m Brio.'))}</div>
      <div class="sentence-sub" style="font-size:16px">${esc(t('I help with meals, doses and lows. You stay in charge: I suggest, you decide.'))}</div>
      <div class="seg" style="margin-top:26px"><button class="${s.lang === 'en' ? 'on' : ''}" data-act="lang" data-l="en">English</button><button class="${s.lang === 'it' ? 'on' : ''}" data-act="lang" data-l="it">Italiano</button></div>
      <div style="margin-top:auto;display:flex;flex-direction:column;gap:8px;padding-bottom:20px">
        <button class="btn dark wide" data-act="onbNext">${esc(t('Set up my plan'))}</button>
        <button class="link" data-act="onbExample">${esc(t('Just look around with an example day'))}</button>
      </div></div></div>`;
  }
  if (step <= STEPS.length) {
    const f = STEPS[step - 1];
    const shown = f.scale ? s[f.key] / f.scale : s[f.key];
    return `<div class="screen settings-bg">
      <div class="navbar"><button data-act="onbBack">‹ ${esc(t('Back'))}</button><span class="muted-14">${esc(t('Your plan · {a} of {b}', { a: step, b: STEPS.length }))}</span></div>
      <div class="scroll page onb">
        <div class="h-28" style="margin-top:20px;text-wrap:balance">${esc(t(f.q))}</div>
        <div class="muted-14" style="line-height:1.45">${esc(t(f.help))}</div>
        <div class="stepper big" style="margin-top:20px" data-key="${f.key}" data-step="${f.step}" data-min="${f.min}" data-max="${f.max}"><button data-act="step" data-dir="-1">−</button><div class="stepper-v"><input inputmode="decimal" data-k="${f.key}" value="${esc(u(shown))}"><span>${esc(t(f.unit))}</span></div><button data-act="step" data-dir="1">+</button></div>
        <div class="reason" id="onb-ex" style="text-align:center">${esc(f.example(shown))}</div>
        <div style="margin-top:auto;padding-bottom:20px"><button class="btn dark wide" data-act="onbNext">${esc(t('Continue'))}</button></div>
      </div></div>`;
  }
  return `<div class="screen home-bg"><div class="scroll page onb">
    <div style="display:flex;justify-content:center;margin-top:clamp(30px,8vh,70px)">${orb(96, { eyes: 'happy' })}</div>
    <div class="h-28" style="text-align:center;margin-top:24px">${esc(t('One last thing'))}</div>
    <div class="white-list" style="margin-top:10px">
      <div class="promise">${esc(t('I never log a dose for you. You confirm what you actually took.'))}</div>
      <div class="promise bt">${esc(t('My suggestions use only the numbers you just set. Check them with your care team.'))}</div>
      <div class="promise bt">${esc(t('I am a support tool, not a medical device. If something feels wrong, trust yourself and your care team.'))}</div>
      <div class="promise bt">${esc(t('Your data stays on this phone. You can export or erase it in settings.'))}</div>
    </div>
    <div style="margin-top:auto;padding:20px 0"><button class="btn dark wide" data-act="onbDone">${esc(t('I understand'))}</button></div>
  </div></div>`;
};

inputs.view_icr = (v) => setVal('icr', v);
inputs.view_isf = (v) => setVal('isf', v);
inputs.view_target = (v) => setVal('target', v);
inputs.view_diaMin = (v) => setVal('diaMin', v);
function setVal(key, v) {
  const f = STEPS.find((x) => x.key === key);
  const n = num(v);
  if (!n) return;
  S.settings[key] = f.scale ? n * f.scale : n;
  const ex = document.getElementById('onb-ex');
  if (ex) ex.textContent = f.example(n);
}

actions.onbNext = () => {
  const step = UI.arg || 0;
  if (step > 0) {
    const f = STEPS[step - 1];
    const v = f.scale ? S.settings[f.key] / f.scale : S.settings[f.key];
    const c = Math.max(f.min, Math.min(f.max, v));
    S.settings[f.key] = f.scale ? c * f.scale : c;
  }
  UI.arg = step + 1;
  commit();
};
actions.onbBack = () => { UI.arg = Math.max(0, (UI.arg || 0) - 1); render(); };
actions.onbDone = () => { S.settings.onboarded = true; S.settings.planCheckedOn = null; commit(); home(); };
actions.onbExample = () => { S.settings.onboarded = true; exampleDay(S, now()); commit(); home(); };
export const needsOnboarding = () => !S.settings.onboarded;
export { setLang };
