// Lets ApexDrive open with no signal (in a dealership's back office, say).
// The page itself is fetched fresh when there is signal; the last copy is used
// when there isn't. Everything you log is already kept on the phone and
// syncs when you're back online.

const CACHE = 'apexdrive-shell-v1';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon.svg'];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).catch(() => undefined));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const putInCache = (request, response) => {
  if (response && (response.ok || response.type === 'opaque')) {
    const copy = response.clone();
    caches.open(CACHE).then(c => c.put(request, copy)).catch(() => undefined);
  }
  return response;
};

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // The page: fresh when online, last copy when not.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(r => putInCache('./index.html', r))
        .catch(() => caches.match('./index.html').then(r => r || caches.match('./')))
    );
    return;
  }

  // App files (their names change with every release): cache first.
  if (url.origin === self.location.origin) {
    event.respondWith(caches.match(request).then(hit => hit || fetch(request).then(r => putInCache(request, r))));
    return;
  }

  // Map styles and fonts from other sites: use the copy, refresh in the background.
  if (/unpkg\.com|fonts\.(googleapis|gstatic)\.com/.test(url.hostname)) {
    event.respondWith(
      caches.match(request).then(hit => {
        const fresh = fetch(request)
          .then(r => putInCache(request, r))
          .catch(() => hit);
        return hit || fresh;
      })
    );
  }
});
