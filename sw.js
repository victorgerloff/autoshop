// Planet Automotive Service Worker
// Provides offline support and background notifications

const CACHE_NAME = 'planet-auto-v1';
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

// Fetch: serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (event.request.url.includes('firebaseio.com')) return; // Don't cache Firebase API calls
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request).catch(() => caches.match('./index.html'));
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
