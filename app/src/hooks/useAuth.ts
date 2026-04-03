import { useState, useEffect } from 'react'
import { getLocalUser, clearLocalUser } from '../lib/auth'

interface KanjiUser {
  id: string
  displayName: string
  avatarUrl?: string
}

export function useAuth() {
  const [user, setUser] = useState<KanjiUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const u = getLocalUser()
    setUser(u)
    setLoading(false)

    // storageイベントで他タブの変更も検知
    const handler = () => {
      setUser(getLocalUser())
    }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [])

  return {
    user,
    loading,
    isLoggedIn: !!user,
    displayName: user?.displayName || 'ユーザー',
    refresh: () => setUser(getLocalUser()),
  }
}
