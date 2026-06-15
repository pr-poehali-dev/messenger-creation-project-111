const CACHE = 'pulse-v4';

// Установка — минимальный кэш
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(['/manifest.webmanifest']))
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

  // Только GET запросы к своему домену
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;

  // JS/CSS с хэшем в имени — всегда только сеть (иммутабельны, не кэшируем в SW)
  if (url.pathname.startsWith('/assets/')) return;

  // Шрифты Google — cache first
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

  // Иконки и манифест — cache first
  if (
    url.pathname.startsWith('/pwa-icon') ||
    url.pathname === '/manifest.webmanifest' ||
    url.pathname === '/favicon.svg'
  ) {
    e.respondWith(
      caches.open(CACHE).then(c =>
        c.match(e.request).then(cached =>
          cached || fetch(e.request).then(res => { c.put(e.request, res.clone()); return res; })
        )
      )
    );
    return;
  }

  // HTML (/) — всегда сеть, fallback на кэш только при офлайне
  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone()));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});

// Push-уведомления
self.addEventListener('push', e => {
  let data = { title: 'PULSE', body: 'Новое сообщение', data: {} };
  try { data = e.data.json(); } catch {}

  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/pwa-icon-192.png',
      badge: '/pwa-icon-192.png',
      vibrate: [200, 100, 200],
      tag: 'pulse-message',
      renotify: true,
      data: data.data || {},
    })
  );
});

// Клик по уведомлению — открываем/фокусируем приложение
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if (client.url.includes(self.location.origin)) {
          return client.focus();
        }
      }
      return clients.openWindow('/');
    })
  );
});