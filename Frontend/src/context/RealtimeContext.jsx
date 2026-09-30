import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import api, { getAuthToken } from '../utils/services/api'
import { useExpedition } from './ExpeditionContext'

const RealtimeContext = createContext({
  revision: 0,
  connected: false,
  emergency: null,
  showEmergency: () => {},
  dismissEmergency: () => {},
})

const DEFAULT_REALTIME_BASE = import.meta.env.PROD
  ? 'https://polarops-api.pexxoraa.workers.dev'
  : ''
const REALTIME_BASE = (
  import.meta.env.VITE_REALTIME_BASE || DEFAULT_REALTIME_BASE
).replace(/\/$/, '')

function realtimeBase() {
  if (REALTIME_BASE) {
    return REALTIME_BASE
      .replace(/^https:/i, 'wss:')
      .replace(/^http:/i, 'ws:')
  }

  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return proto + '//' + window.location.host
}

export function RealtimeProvider({ children }) {
  const { selectedId } = useExpedition()
  const [revision, setRevision] = useState(0)
  const [connected, setConnected] = useState(false)
  const [emergency, setEmergency] = useState(null)
  const showEmergency = useCallback((event) => setEmergency(event), [])
  const dismissEmergency = useCallback(() => setEmergency(null), [])

  useEffect(() => {
    if (!selectedId || !getAuthToken()) return undefined
    let socket
    let stopped = false
    let timer
    const connect = async () => {
      try {
        const { ticket } = await api.get('/api/realtime/ticket?expedition_id=' + selectedId)
        if (stopped) return
        socket = new WebSocket(
          realtimeBase() +
            '/ws/expeditions/' +
            selectedId +
            '?ticket=' +
            encodeURIComponent(ticket),
        )
        socket.onopen = () => socket.send(JSON.stringify({ type: 'auth', token: getAuthToken() }))
        socket.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data)
            if (message.type === 'auth.ok') setConnected(true)
            else if (message.type === 'emergency.sos') {
              showEmergency({
                ...message.data,
                event_id: message.event_id,
                expedition_id: message.expedition_id,
                occurred_at: message.occurred_at,
              })
              setRevision((value) => value + 1)
            } else if (message.type !== 'pong') setRevision((value) => value + 1)
          } catch { /* ignore malformed payload */ }
        }
        socket.onclose = () => {
          setConnected(false)
          if (!stopped) timer = window.setTimeout(connect, 3000)
        }
      } catch {
        if (!stopped) timer = window.setTimeout(connect, 5000)
      }
    }
    connect()
    return () => {
      stopped = true
      window.clearTimeout(timer)
      socket?.close()
      setConnected(false)
    }
  }, [selectedId, showEmergency])

  const value = useMemo(
    () => ({ revision, connected, emergency, showEmergency, dismissEmergency }),
    [revision, connected, emergency, showEmergency, dismissEmergency],
  )
  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>
}

export const useRealtime = () => useContext(RealtimeContext)
