import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import api from '../utils/services/api'
import { useAuth } from './AuthContext'

const ExpeditionContext = createContext(null)
const KEY = 'polarops-selected-expedition'

export function ExpeditionProvider({ children }) {
  const { user } = useAuth()
  const [expeditions, setExpeditions] = useState([])
  const [selectedId, setSelectedId] = useState(() => Number(localStorage.getItem(KEY) || 0))

  const refresh = useCallback(async () => {
    if (!user) return
    const items = await api.get('/api/expeditions')
    setExpeditions(items)
    const next = items.some((item) => Number(item.id) === selectedId) ? selectedId : Number(items[0]?.id || 0)
    setSelectedId(next)
    if (next) localStorage.setItem(KEY, String(next))
  }, [user, selectedId])

  useEffect(() => { refresh() }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  const selectExpedition = useCallback((id) => {
    const value = Number(id)
    setSelectedId(value)
    localStorage.setItem(KEY, String(value))
  }, [])

  const selectedExpedition = expeditions.find((item) => Number(item.id) === selectedId) || null
  const value = useMemo(() => ({
    expeditions, selectedId, selectedExpedition, selectExpedition, refresh,
  }), [expeditions, selectedId, selectedExpedition, selectExpedition, refresh])

  return <ExpeditionContext.Provider value={value}>{children}</ExpeditionContext.Provider>
}

export const useExpedition = () => useContext(ExpeditionContext)
