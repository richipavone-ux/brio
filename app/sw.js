// Offline app shell. Bump VERSION when files change.
const VERSION = 'brio-v3.0.0';
const SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css',
  'js/main.js', 'js/ctx.js', 'js/store.js', 'js/calc.js', 'js/brain.js', 'js/foods.js', 'js/ui.js',
  'js/i18n.js', 'js/lang-it.js', 'js/notify.js', 'js/speech.js',
  'js/views/home.js', 'js/views/hypo.js', 'js/views/mealflow.js', 'js/views/glucose.js', 'js/views/meal.js',
  'js/views/memory.js', 'js/views/settings.js', 'js/views/talk.js', 'js/views/onboarding.js',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

// Network first, so updates arrive as soon as you're online; the cache keeps Brio working offline.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(e.request, copy)); return res; })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match('index.html'))),
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    const open = list.find((c) => 'focus' in c);
    return open ? open.focus() : self.clients.openWindow('./');
  }));
});
