// Solar Planner — Service Worker
// Cache version: bump this string to force a cache refresh after updates
const CACHE = 'solar-planner-v1';

// Everything the app needs to run offline
const PRECACHE = [
  './',
  './alaska_solar_combined.html',
  // Google Fonts — cached on first load, served offline after
  'https://fonts.googleapis.com/css2?family=Orbitron:wght@400;600;700&family=IBM+Plex+Mono:ital,wght@0,300;0,400;0,600;1,400&display=swap',
];

// ── Install: pre-cache the app shell ──
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache =>
      // Use individual adds so one failure (e.g. offline during install) doesn't block the rest
      Promise.allSettled(PRECACHE.map(url => cache.add(url)))
    ).then(() => self.skipWaiting())
  );
});

// ── Activate: clean up old caches ──
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: cache-first for app assets, network-first for external APIs ──
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // External API calls (Nominatim geocoding, TimeAPI timezone lookup) —
  // always try network first; fall back gracefully to cached if offline.
  // The app handles offline API failures with fallback logic already.
  const isExternal = url.hostname !== self.location.hostname
    && url.hostname !== 'fonts.googleapis.com'
    && url.hostname !== 'fonts.gstatic.com';

  if (isExternal) {
    event.respondWith(
      fetch(event.request).catch(() =>
        caches.match(event.request)
      )
    );
    return;
  }

  // App shell + fonts: cache-first, then network
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      return fetch(event.request).then(response => {
        // Only cache valid responses
        if (!response || response.status !== 200 || response.type === 'error') {
          return response;
        }
        const clone = response.clone();
        caches.open(CACHE).then(cache => cache.put(event.request, clone));
        return response;
      }).catch(() => {
        // Offline and not cached — return a minimal offline page for navigation requests
        if (event.request.mode === 'navigate') {
          return caches.match('./alaska_solar_combined.html');
        }
      });
    })
  );
});
