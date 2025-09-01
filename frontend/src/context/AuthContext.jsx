import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { apiFetch } from '@/lib/apiClient'
import { MeSchema } from '@/lib/schemas'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const loadMe = useCallback(async () => {
    try {
      setError(null)
      const me = await apiFetch('/me')
      const parsed = MeSchema.safeParse(me)
      if (!parsed.success) throw new Error('Invalid /me response')
      setUser(parsed.data)
    } catch (err) {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadMe() }, [loadMe])

  async function login(email, password) {
    await apiFetch('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) })
    await loadMe()
  }

  async function signup(email, password) {
    await apiFetch('/auth/signup', { method: 'POST', body: JSON.stringify({ email, password }) })
  }

  async function logout() {
    try { await apiFetch('/auth/logout', { method: 'POST' }) } catch {}
    setUser(null)
  }

  const value = { user, loading, error, login, signup, logout, refresh: loadMe, isAuthenticated: !!user }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

