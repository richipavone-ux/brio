// System notifications. A web app can only show them while it is running (or briefly in the
// background); scheduled delivery with the app closed needs a push server or the native app.
import { t } from './i18n.js';

const standalone = () => window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;
const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent);

export function notifySupport() {
  if (!('Notification' in window)) {
    return isIOS() && !standalone() ? t('Add Brio to your Home Screen to turn these on') : t('Not available in this browser');
  }
  if (Notification.permission === 'denied') return t("Blocked in your phone's settings");
  if (Notification.permission === 'default') return t('Brio will ask for permission');
  return t('Delivered while Brio is open or in the background');
}

export async function requestNotifications() {
  if (!('Notification' in window)) return 'unsupported';
  if (Notification.permission !== 'default') return Notification.permission;
  try { return await Notification.requestPermission(); } catch { return 'denied'; }
}

export async function notify(title, body, tag) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return false;
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) await reg.showNotification(title, { body, tag, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', renotify: true });
    else new Notification(title, { body, tag });
    return true;
  } catch { return false; }
}

// A short repeating chime for urgent lows, using Web Audio (needs one tap first to unlock).
let ctx = null;
export function unlockAudio() {
  if (ctx) return;
  try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { ctx = null; }
}
export function chime() {
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume();
  const t0 = ctx.currentTime;
  [0, 0.22, 0.44].forEach((d, i) => {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = [880, 660, 880][i];
    g.gain.setValueAtTime(0.0001, t0 + d);
    g.gain.exponentialRampToValueAtTime(0.35, t0 + d + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + d + 0.2);
    o.connect(g).connect(ctx.destination);
    o.start(t0 + d); o.stop(t0 + d + 0.22);
  });
  navigator.vibrate?.([300, 120, 300]);
}
