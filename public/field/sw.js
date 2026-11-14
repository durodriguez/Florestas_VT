// Offline support for the field survey app.
//
// Vite hashes asset filenames at build time, so there is no fixed list to
// pre-cache. Instead this caches whatever the app fetches as it fetches it:
// the first load on campus wifi primes the cache, and everything afterwards
// works with no signal. Map tiles are deliberately excluded — caching a whole
// basemap would fill the device.

const CACHE = 'uvm-field-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', './manifest.webmanifest'])));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      // Only this app's older caches: the positions tool keeps its own on the
      // same site, and deleting every other cache would wipe it.
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('uvm-field-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// The page lists what it loaded before this worker was running (see
// src/offline.ts); keep those too, so the first visit is enough to work offline.
self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || data.type !== 'keep' || !Array.isArray(data.urls)) return;
  event.waitUntil(caches.open(CACHE).then((c) => Promise.all(
    data.urls
      .filter((u) => typeof u === 'string' && new URL(u).origin === self.location.origin)
      .map((u) => c.match(u, { ignoreVary: true }).then((hit) => hit || fetch(u).then((res) => (res.ok ? c.put(u, res) : undefined)).catch(() => undefined))),
  )));
});

// Saved files are matched by address alone. The server's Vary header (Origin
// on some hosts, Accept-Encoding on others) would otherwise make a saved copy
// miss the page's own request for the same file; these files never change
// under one name, so nothing is lost by ignoring it.
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // tiles and other hosts: network only

  // Navigations fall back to the cached shell so a cold offline launch works.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy));
          return res;
        })
        .catch(() => caches.match(request, { ignoreVary: true }).then((hit) => hit || caches.match('./', { ignoreVary: true }))),
    );
    return;
  }

  event.respondWith(
    caches.match(request, { ignoreVary: true }).then((hit) => {
      if (hit) return hit;
      return fetch(request).then((res) => {
        if (res.ok && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy));
        }
        return res;
      });
    }),
  );
});
