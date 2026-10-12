// What Brio thinks right now: the agenda, the next action and the sentence on the home.
import { S, now } from './ctx.js';
import { t } from './i18n.js';
import { MIN, mealStatus, iobAt, lastReading, forecastNow, lowThreshold } from './calc.js';
import { hm, u } from './ui.js';

export function meals() {
  return S.logs.filter((l) => l.kind === 'meal').sort((a, b) => b.t - a.t);
}

export function liveMeals(at = now()) {
  return meals().filter((m) => at - m.t < 12 * 60 * MIN && !mealStatus(m, S, at).closed);
}

// Everything Brio is waiting for, oldest first. Overdue items stay until done or 90 min late.
export function agenda(at = now()) {
  const items = [];
  for (const m of liveMeals(at)) {
    for (const st of mealStatus(m, S, at).steps) {
      if (st.done || st.skipped) continue;
      if (st.kind === 'dose' && st.part === 'now') continue;
      if (at - st.at > 90 * MIN) continue;
      items.push({ ...st, meal: m, key: `${m.id}:${st.kind}:${st.part || st.at}` });
    }
  }
  for (const r of S.reminders) {
    if (r.done || at - r.at > 90 * MIN) continue;
    items.push({ kind: 'recheck', at: r.at, key: 'r:' + r.id, rem: r });
  }
  return items.sort((a, b) => a.at - b.at);
}

export const nextAction = (at = now()) => agenda(at)[0] || null;

export function glucoseNow(at = now()) {
  const r = lastReading(S, at);
  if (!r) return null;
  const age = (at - r.t) / MIN;
  const prev = S.logs.filter((l) => l.kind === 'bg' && l.t < r.t).sort((a, b) => b.t - a.t)[0];
  let arrow = '';
  if (prev && (r.t - prev.t) / MIN <= 60) {
    const rate = (r.v - prev.v) / ((r.t - prev.t) / MIN);
    arrow = rate > 2 ? '↑' : rate > 0.7 ? '↗' : rate < -2 ? '↓' : rate < -0.7 ? '↘' : '→';
  }
  const s = S.settings;
  const color = r.v < s.low ? 'var(--red)' : r.v > s.rangeHigh ? 'var(--amber)' : 'var(--ink)';
  const arrowColor = r.v < s.low || arrow === '↓' || arrow === '↘' && r.v < 100 ? 'var(--red)' : arrow === '↗' || arrow === '↑' ? 'var(--amber)' : 'var(--muted)';
  return { v: r.v, t: r.t, age, arrow: age < 60 ? arrow : '', color, arrowColor, stale: age > 60 };
}

export const iobNow = (at = now()) => Math.round(iobAt(S, at) * 10) / 10;

export function lowRisk(at = now()) {
  const s = S.settings;
  const r = lastReading(S, at);
  if (!r || (at - r.t) / MIN > 20) return null;
  const thr = lowThreshold(s, at);
  if (r.v < s.urgentLow) return { level: 'urgent', v: r.v };
  if (r.v < thr) return { level: 'low', v: r.v, f20: forecastNow(S, at, 20) };
  if (!s.headingLow) return null;
  const f = forecastNow(S, at, 20);
  if (f != null && f < thr) return { level: 'heading', v: r.v, f20: f };
  return null;
}

// The single sentence under the orb.
export function sentence(at = now()) {
  const chatty = S.settings.talk === 'chatty';
  const recent = meals().find((m) => at - m.t < 15 * MIN);
  const next = nextAction(at);
  const g = glucoseNow(at);
  const s = S.settings;
  if (recent) {
    const later = mealStatus(recent, S, at).steps.find((x) => x.kind === 'dose' && x.part === 'later' && !x.done);
    return {
      main: t('Enjoy the {meal}.', { meal: shortName(recent.name) }),
      sub: later ? t("I'll remind you of the {u} U at {time}.", { u: u(later.u), time: hm(later.at) })
        : t("I'll ask for your glucose at {time}.", { time: hm(recent.checks[0]) }),
    };
  }
  if (next && next.at <= at + 5 * MIN) {
    if (next.kind === 'dose') return { main: t('Time for {u} U.', { u: u(next.u) }), sub: t('{meal}, second part', { meal: next.meal.name }) };
    return { main: t('Time to check your glucose.'), sub: next.meal ? t('{meal} · {time}', { meal: next.meal.name, time: hm(next.at) }) : t('As promised.') };
  }
  if (g && !g.stale && g.v > s.rangeHigh) {
    return { main: t("You're a bit high."), sub: iobNow(at) > 0.1 ? t('{u} U still working. Tap me before correcting.', { u: u(iobNow(at)) }) : t('Tap me if you want to correct.') };
  }
  if (next) {
    const main = next.kind === 'dose' ? t('All good. Next dose at {time}.', { time: hm(next.at) }) : t('All good. Next check at {time}.', { time: hm(next.at) });
    return { main, sub: chatty ? t("I'm keeping an eye on it.") : '' };
  }
  const today = S.logs.some((l) => new Date(l.t).toDateString() === new Date(at).toDateString());
  const hour = new Date(at).getHours();
  if (!today) {
    const main = hour < 12 ? t('Good morning.') : hour < 18 ? t('Good afternoon.') : t('Good evening.');
    return { main, sub: t('Double tap me when you eat.') };
  }
  return { main: t('All good.'), sub: chatty ? t('Nothing to do right now. Enjoy your day.') : t('Nothing to do right now.') };
}

export function shortName(name) {
  const n = String(name || '').trim();
  const first = n.split(/\s+/)[0] || n;
  return (S.settings.lang === 'it' ? n : first).toLowerCase();
}

export function todaysLogs(at = now()) {
  const d = new Date(at).toDateString();
  return S.logs.filter((l) => new Date(l.t).toDateString() === d && l.kind !== 'reminder').sort((a, b) => b.t - a.t);
}
