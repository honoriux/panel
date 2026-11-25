// Service worker: permite usar la app sin conexión.
// Sirve desde caché y actualiza en segundo plano. Cuando cambia CACHE, este service worker nuevo descarga todos los
// ficheros saltándose la caché HTTP (GitHub Pages la pone de 10 minutos), toma el control y la app se recarga sola (app.js).
// CACHE tiene que coincidir con APP_VERSION de app.js ('panel-AAAA-MM-DD.N': fecha de publicación y nº de ese día).
const CACHE = 'panel-2026-11-25.5';
const FILES = ['./', 'index.html', 'styles.css', 'savey.js', 'app.js', 'manifest.webmanifest', 'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  if (url.searchParams.has('fresh')) return; // la app pregunta por la última versión publicada: siempre a la red
  e.respondWith(caches.open(CACHE).then(async cache => {
    const cached = await cache.match(e.request, { ignoreSearch: true });
    const network = fetch(e.request).then(res => { if (res.ok) cache.put(e.request, res.clone()); return res; }).catch(() => cached);
    return cached || network;
  }));
});
