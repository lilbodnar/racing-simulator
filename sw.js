// Service worker: keeps a copy of the game on the phone so it opens offline.
// Network first, so a new version you push shows up as soon as there's a connection;
// the saved copy is only used when the network can't be reached.
const CACHE = 'racing-sim-v1';
const FILES = [
  './', 'index.html', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
  'js/three.min.js', 'js/tracks.js', 'js/car.js', 'js/scenery.js', 'js/ai.js', 'js/music.js',
  'js/wheel.js', 'js/dancer.js', 'js/weather.js', 'js/peerjs.min.js', 'js/net.js', 'js/game.js',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;   // multiplayer etc. go straight out
  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
