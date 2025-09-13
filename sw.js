// sw.js
const CACHE_NAME = 'finnote-cache-v1';
const RUNTIME_CACHE = 'finnote-runtime';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.webmanifest'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => (k !== CACHE_NAME && k !== RUNTIME_CACHE) ? caches.delete(k) : null))
    )
  );
  self.clients.claim();
});

// Strategi:
// - Navigasi (HTML): cache-first (fallback ke cache saat offline)
// - Same-origin assets (css/js): cache-first
// - CDN (fontawesome/fonts): network-first lalu cache (biar bisa offline setelah sekali buka)
self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);

  // Hanya GET yang di-handle
  if (req.method !== 'GET') return;

  // 1) Navigasi dokumen (SPA fallback)
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(RUNTIME_CACHE).then(c => c.put('./', copy));
        return res;
      }).catch(() => caches.match('./index.html'))
    );
    return;
  }

  // 2) Same-origin: cache-first
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.match(req).then(cached => {
        return cached || fetch(req).then(res => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(req, copy));
          return res;
        });
      })
    );
    return;
  }

  // 3) Cross-origin (CDN: font, fa, dll) → network-first lalu cache
  e.respondWith(
    fetch(req).then(res => {
      const copy = res.clone();
      caches.open(RUNTIME_CACHE).then(c => c.put(req, copy));
      return res;
    }).catch(() => caches.match(req))
  );
});
