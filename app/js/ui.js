import { t, lang } from './i18n.js';

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const hm = (ts) => {
  const d = new Date(ts);
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
};

export const num = (v) => {
  const n = parseFloat(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};

// 9.5 -> "9.5", 4 -> "4" (Italian uses a comma)
export const u = (x) => {
  const s = String(Math.round(x * 10) / 10);
  return lang() === 'it' ? s.replace('.', ',') : s;
};

export const dur = (mins) => {
  mins = Math.max(0, Math.round(mins));
  const h = Math.floor(mins / 60), m = mins % 60;
  const s = mins < 60 ? t('{n} min', { n: mins }) : m ? t('{h} h {m}', { h, m: String(m).padStart(2, '0') }) : t('{h} h', { h });
  return s.replace(/ /g, '\u00a0');  // keep "1 h 30" on one line
};

export const dayLabel = (ts, now) => {
  const a = new Date(ts); a.setHours(0, 0, 0, 0);
  const b = new Date(now); b.setHours(0, 0, 0, 0);
  const diff = Math.round((b - a) / 86400000);
  if (diff === 0) return t('Today');
  if (diff === 1) return t('Yesterday');
  return a.toLocaleDateString(lang() === 'it' ? 'it-IT' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
};

export const longDate = (ts) => {
  const s = new Date(ts).toLocaleDateString(lang() === 'it' ? 'it-IT' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  return s.charAt(0).toUpperCase() + s.slice(1);
};

// ---- The orb ----------------------------------------------------------------
// mood: 'calm' | 'listen' | 'alert'; eyes: 'open' | 'happy' | 'wide'
export function orb(size, { mood = 'calm', eyes = 'open', cls = '', attrs = '' } = {}) {
  const alert = mood === 'alert';
  const rings = mood === 'listen' || alert;
  const glow = alert ? 'rgba(239,68,68,.35)' : 'rgba(79,107,255,.38)';
  const shadow = `drop-shadow(0 ${(size * 0.12).toFixed(0)}px ${(size * 0.22).toFixed(0)}px ${glow})`;
  const gap = (size * 0.16).toFixed(1);
  let eye;
  if (eyes === 'happy') {
    const w = (size * 0.17).toFixed(1), h = (size * 0.085).toFixed(1), b = Math.max(2, size * 0.04).toFixed(1);
    eye = `<b class="eye-arc" style="width:${w}px;height:${h}px;border-width:${b}px;border-radius:${size}px ${size}px 0 0"></b>`;
  } else {
    const k = eyes === 'wide' ? 1.15 : 1;
    const w = (size * 0.125 * k).toFixed(1), h = (size * 0.17 * k).toFixed(1), g = Math.max(3, size * 0.09).toFixed(0);
    eye = `<b class="eye${alert || mood === 'listen' ? '' : ' blink'}" style="width:${w}px;height:${h}px;box-shadow:0 0 ${g}px rgba(255,255,255,.9)"></b>`;
  }
  // Negative delays keep the animation phase continuous when the screen re-renders.
  const nowMs = Date.now();
  const spin = mood === 'calm' ? 9000 : 2600, breath = alert ? 2000 : 4500;
  return `<div class="orb ${mood} ${cls}" style="width:${size}px;height:${size}px;filter:${shadow}" ${attrs}>
    ${rings ? '<i class="ring"></i><i class="ring r2"></i><i class="ring r3"></i>' : ''}
    <div class="orb-body" style="animation-delay:-${nowMs % breath}ms"><div class="orb-grad" style="animation-delay:-${nowMs % spin}ms"></div><div class="orb-shine"></div></div>
    <div class="orb-eyes${alert ? ' c' : ''}" style="gap:${gap}px">${eye}${eye}</div>
  </div>`;
}

// ---- Small building blocks -----------------------------------------------------
export const toggle = (on, act, extra = '') =>
  `<button class="toggle${on ? ' on' : ''}" role="switch" aria-checked="${on}" data-act="${act}" ${extra}><i></i></button>`;

export const chev = '<span class="chev">›</span>';

export function row(label, right, { act = '', sub = '', cls = '', attrs = '' } = {}) {
  return `<div class="row ${cls}" ${act ? `data-act="${act}" role="button" tabindex="0"` : ''} ${attrs}>
    <div class="row-l"><div>${label}</div>${sub ? `<div class="row-sub">${sub}</div>` : ''}</div>
    <div class="row-r">${right}</div></div>`;
}

export const ringSvg = (size, stroke, frac, color, track = '#eef0f3') => {
  const r = size / 2 - stroke / 2 - 0.5;
  const c = 2 * Math.PI * r;
  return `<svg width="${size}" height="${size}" class="ring-svg" aria-hidden="true"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${track}" stroke-width="${stroke}"/><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${(c * Math.max(0, Math.min(1, frac))).toFixed(1)} ${c.toFixed(1)}"/></svg>`;
};

export function stepper(key, value, { step = 1, unit = '', min = 0, max = 9999 } = {}) {
  return `<div class="stepper" data-key="${key}" data-step="${step}" data-min="${min}" data-max="${max}">
    <button data-act="step" data-dir="-1" aria-label="−">−</button>
    <div class="stepper-v"><input inputmode="decimal" data-k="${key}" value="${esc(value)}"><span>${esc(unit)}</span></div>
    <button data-act="step" data-dir="1" aria-label="+">+</button></div>`;
}

// Line chart helper: maps time/value to the box.
export function scale(t0, t1, v0, v1, w, h) {
  return {
    x: (ts) => ((ts - t0) / (t1 - t0)) * w,
    y: (v) => h - ((Math.max(v0, Math.min(v1, v)) - v0) / (v1 - v0)) * h,
  };
}

export const path = (pts, sc) => pts.map((p, i) => `${i ? 'L' : 'M'}${sc.x(p.t).toFixed(1)} ${sc.y(p.v).toFixed(1)}`).join(' ');
