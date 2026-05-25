const CACHE_NAME = 'meteor-crush-v1';
const PRECACHE_URLS = [
  '/',
  '/game/',
  '/manifest.webmanifest',
  '/icon.svg',
  '/maskable-icon.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)).catch(() => undefined),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys
        .filter((key) => key !== CACHE_NAME)
        .map((key) => caches.delete(key)),
    )),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);

    try {
      const response = await fetch(request);
      if (response.ok && request.destination !== 'video') {
        cache.put(request, response.clone());
      }
      return response;
    } catch {
      if (cached) return cached;

      if (request.mode === 'navigate') {
        const fallback = await cache.match('/game/');
        if (fallback) return fallback;
      }

      throw new Error('Network unavailable');
    }
  })());
});
