const CACHE = 'polarops-react-shell-v1'
const SHELL = ['/', '/index.html']

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(
    keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))
  )))
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  if (event.request.method !== 'GET' || url.pathname.startsWith('/api/') || url.pathname.startsWith('/ws/')) return
  if (url.origin !== self.location.origin) return

  event.respondWith((async () => {
    const cached = await caches.match(event.request, { ignoreVary: true })
    if (cached) return cached
    try {
      const response = await fetch(event.request)
      if (response.ok) {
        const cache = await caches.open(CACHE)
        cache.put(event.request, response.clone())
      }
      return response
    } catch (error) {
      if (event.request.mode === 'navigate') {
        const shell = await caches.match('/index.html')
        if (shell) return shell
      }
      throw error
    }
  })())
})
