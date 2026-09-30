import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import api, { getAuthToken, setAuthToken } from '../utils/services/api'

const AuthContext = createContext(null)
const USER_KEY = 'polarops.user'

function storedUser() {
  try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null') } catch { return null }
}

function persistUser(user) {
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user))
  else localStorage.removeItem(USER_KEY)
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => getAuthToken() ? storedUser() : null)
  const [loading, setLoading] = useState(Boolean(getAuthToken()) && !user)

  const logout = useCallback(() => {
    setAuthToken('')
    persistUser(null)
    setUser(null)
  }, [])

  const refresh = useCallback(async () => {
    if (!getAuthToken()) {
      setLoading(false)
      return
    }
    try {
      const current = await api.get('/api/me')
      persistUser(current)
      setUser(current)
    } catch (error) {
      const cached = storedUser()
      if (!error.status && !navigator.onLine && cached) setUser(cached)
      else logout()
    } finally {
      setLoading(false)
    }
  }, [logout])

  useEffect(() => {
    refresh()
    window.addEventListener('polarops:unauthorized', logout)
    return () => window.removeEventListener('polarops:unauthorized', logout)
  }, [refresh, logout])

  const login = useCallback(async (email, password) => {
    const data = await api.post('/api/auth/login', { email, password }, { auth: false, queue: false })
    setAuthToken(data.token)
    persistUser(data.user)
    setUser(data.user)
  }, [])

  const value = useMemo(() => ({ user, loading, login, logout, refresh }), [user, loading, login, logout, refresh])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
