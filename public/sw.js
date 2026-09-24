const CACHE = 'hifz-journey-shell-v3'
const BASE = new URL('./', self.location.href)
const INDEX = new URL('index.html', BASE)

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const response = await fetch(INDEX)
    if (!response.ok) throw new Error('Unable to cache app shell')
    const html = await response.clone().text()
    const assets = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
      .map(match => new URL(match[1], BASE))
      .filter(url => url.origin === self.location.origin)
    const cache = await caches.open(CACHE)
    await cache.put(INDEX, response)
    await cache.addAll([...new Set([BASE.href, ...assets.map(url => url.href)])])
    await self.skipWaiting()
  })())
})

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    await Promise.all((await caches.keys()).filter(key => key.startsWith('hifz-journey-shell-') && key !== CACHE).map(key => caches.delete(key)))
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).then(async response => { if (response.ok) (await caches.open(CACHE)).put(INDEX, response.clone()); return response }).catch(() => caches.match(INDEX)))
    return
  }
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(async response => { if (response.ok) (await caches.open(CACHE)).put(event.request, response.clone()); return response })))
})
