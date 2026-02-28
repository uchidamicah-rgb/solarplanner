// Solar Planner — Service Worker
// Build: 2026-02-28 18:38 UTC
// CACHE version is set by a build timestamp injected at deploy time (see README).
// If deploying manually, increment the number below each time you push a new version.
const CACHE = 'solar-planner-20260228_183855';

// Assets to pre-cache on install
const PRECACHE = [
  './alaska_solar_combined.html',
  'https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap',
];

// ── Install: pre-cache assets ──
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => Promise.allSettled(PRECACHE.map(url => cache.add(url))))
      .then(() => self.skipWaiting())  // activate immediately, don't wait for old SW to die
  );
});

// ── Activate: delete all old-versioned caches ──
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ── Fetch strategy ──
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  const isNavigate = event.request.mode === 'navigate';

  // ── External APIs (geocoding, timezone) — don't intercept ──
  const isExternalAPI = url.hostname !== self.location.hostname
    && url.hostname !== 'fonts.googleapis.com'
    && url.hostname !== 'fonts.gstatic.com';

  if (isExternalAPI) {
    return; // let browser handle normally
  }

  // ── HTML navigation requests — network-first ──
  // Always try to fetch the latest HTML from the network.
  // Only fall back to cache if genuinely offline.
  if (isNavigate) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match('./alaska_solar_combined.html'))
    );
    return;
  }

  // ── Everything else (fonts, icons) — cache-first ──
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (!response || response.status !== 200) return response;
        const clone = response.clone();
        caches.open(CACHE).then(cache => cache.put(event.request, clone));
        return response;
      });
    })
  );
});
