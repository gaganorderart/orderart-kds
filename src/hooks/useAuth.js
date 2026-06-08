import { useState } from 'react'

const AUTH_API  = import.meta.env.VITE_AUTH_API ?? '/yii2-api/auth/login'
export const TOKEN_KEY = 'kds_token'
export const RID_KEY   = 'kds_rid'
export const USER_KEY  = 'kds_user'

export function getStoredAuth() {
  try {
    return {
      token: localStorage.getItem(TOKEN_KEY),
      rid:   localStorage.getItem(RID_KEY),
      user:  JSON.parse(localStorage.getItem(USER_KEY) || 'null'),
    }
  } catch {
    return { token: null, rid: null, user: null }
  }
}

export function useAuth() {
  const [auth, setAuth]       = useState(getStoredAuth)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)

  async function login(username, password) {
    setLoading(true)
    setError(null)
    try {
      const res  = await fetch(AUTH_API, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ username, password }),
      })
      const data = await res.json()
      if (data.status === 200 && data.token) {
        const { token, user } = data
        localStorage.setItem(TOKEN_KEY, token)
        localStorage.setItem(RID_KEY,   String(user.rid))
        localStorage.setItem(USER_KEY,  JSON.stringify(user))
        setAuth({ token, rid: String(user.rid), user })
      } else {
        setError(data.message || 'Invalid credentials')
      }
    } catch {
      setError('Cannot reach server — check your connection.')
    } finally {
      setLoading(false)
    }
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(RID_KEY)
    localStorage.removeItem(USER_KEY)
    setAuth({ token: null, rid: null, user: null })
  }

  return {
    isAuthenticated: !!auth.token,
    token:  auth.token,
    rid:    auth.rid,
    user:   auth.user,
    login,
    logout,
    loading,
    error,
  }
}
