import { createRoot } from 'react-dom/client'
import './index.css'
import './assets/styles/typography.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(<App />)

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', async () => {
    try {
      await navigator.serviceWorker.register('/service-worker.js')
      await navigator.serviceWorker.ready
      const cache = await caches.open('polarops-react-shell-v1')
      const urls = new Set(['/', '/index.html'])
      for (const item of performance.getEntriesByType('resource')) {
        const url = new URL(item.name)
        if (url.origin === location.origin && !url.pathname.startsWith('/api/') && !url.pathname.startsWith('/ws/')) urls.add(url.pathname + url.search)
      }
      await cache.addAll([...urls])
    } catch {
      // The online app must remain usable if PWA setup fails.
    }
  })
}
