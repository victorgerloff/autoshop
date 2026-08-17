// Planet Automotive Service Worker
// Provides offline support and background notifications

const CACHE_NAME = 'planet-auto-v3';
const URLS_TO_CACHE = [
  './',
  './index.html'
];

// Install: cache main files
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(URLS_TO_CACHE).catch(() => {});
    })
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch: the app shell (index.html) is network-first so a new deploy shows up
// immediately when online; the cached copy is only used offline. Everything
// else (icons, manifest, textures) is cache-first for speed, refreshed in
// the background whenever it's fetched.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (event.request.url.includes('firebaseio.com')) return; // Don't cache Firebase API calls

  const isAppShell = event.request.mode === 'navigate' || event.request.url.endsWith('/index.html');

  if (isAppShell) {
    event.respondWith(
      fetch(event.request).then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      }).catch(() => caches.match(event.request).then((r) => r || caches.match('./index.html')))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetchPromise = fetch(event.request).then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      }).catch(() => cached);
      return cached || fetchPromise;
    })
  );
});

// Listen for messages from the main page to show notifications
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'NOTIFY') {
    const { title, body, tag } = event.data;
    self.registration.showNotification(`🔧 Planet Auto — ${title}`, {
      body: body,
      tag: tag || 'planet-auto',
      requireInteraction: false,
      vibrate: [200, 100, 200],
      badge: './favicon.ico',
      icon: './favicon.ico',
      data: { url: self.registration.scope }
    });
  }
});

// Click on notification: focus or open the app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(event.notification.data.url || './');
    })
  );
});

// Push event (for when push server is set up in the future)
self.addEventListener('push', (event) => {
  if (!event.data) return;
  try {
    const data = event.data.json();
    event.waitUntil(
      self.registration.showNotification(`🔧 Planet Auto — ${data.title}`, {
        body: data.body || '',
        tag: data.tag || 'planet-auto',
        requireInteraction: false,
        vibrate: [200, 100, 200],
        icon: './favicon.ico'
      })
    );
  } catch(e) {}
});
