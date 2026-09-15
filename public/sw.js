const CACHE = 'hifz-journey-v1'
const BASE = '/quran-memorization/'

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll([BASE, `${BASE}index.html`])))
  self.skipWaiting()
})
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
    if (new URL(event.request.url).origin === self.location.origin) caches.open(CACHE).then((cache) => cache.put(event.request, response.clone()))
    return response
  })))
})
