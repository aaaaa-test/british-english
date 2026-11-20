/* Keeps KJV Words and Bible working without internet.
   Pages come from the internet when it answers quickly, so updates show up at once; otherwise the saved copy is used.
   The Bible data (kjv/*.json, about 9 MB) is kept the first time it is loaded. */
const CACHE = 'kjv-site-1';
const FILES = ['./', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'icon-maskable.png', 'kjv/bible.json', 'kjv/words.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(FILES.map(f => c.add(new Request(f, {cache: 'reload'})).catch(() => null)))));   // fresh copies, not the browser's
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('kjv-site-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith((async () => {
    // ask the server every time (no-cache), so a new version shows up at once instead of after the browser's 10-minute copy expires
    const net = fetch(req, {cache: 'no-cache'}).catch(() => fetch(req)).then(res => {
      if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    });
    const saved = await caches.match(req, {ignoreSearch: true});
    if (!saved) return net;
    const slow = new Promise(r => setTimeout(() => r(saved), 3000));
    return Promise.race([net.catch(() => saved), slow]);
  })());
});
