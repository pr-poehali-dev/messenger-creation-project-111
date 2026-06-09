const CACHE = 'pulse-v2';
const STATIC = [
  '/',
  '/pwa-icon.svg',
  '/pwa-icon-192.png',
  '/pwa-icon-512.png',
  '/manifest.webmanifest',
];

// Установка — кэшируем статику
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(STATIC))
      .then(() => self.skipWaiting())
  );
});

// Активация — удаляем старые кэши
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // API и сторонние запросы — только сеть
  if (
    e.request.method !== 'GET' ||
    url.hostname.includes('functions.poehali.dev') ||
    url.hostname.includes('mc.yandex.ru') ||
    url.hostname.includes('cdn.poehali.dev')
  ) return;

  // Шрифты Google — cache first (долго живут)
  if (url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com')) {
    e.respondWith(
      caches.open(CACHE).then(c =>
        c.match(e.request).then(cached =>
          cached || fetch(e.request).then(res => { c.put(e.request, res.clone()); return res; })
        )
      )
    );
    return;
  }

  // Всё остальное — network first, fallback cache
  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      })
      .catch(() =>
        caches.match(e.request).then(cached =>
          cached || caches.match('/')
        )
      )
  );
});
