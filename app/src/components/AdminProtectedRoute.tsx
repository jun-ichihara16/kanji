import { useState, useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'

export default function AdminProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth()
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)

  useEffect(() => {
    if (!user?.id) return
    supabase.from('users').select('is_admin').eq('id', user.id).single()
      .then(({ data }) => setIsAdmin(data?.is_admin === true))
  }, [user])

  if (authLoading || isAdmin === null) {
    return <div className="flex-1 flex items-center justify-center"><div className="w-8 h-8 border-4 border-green/30 border-t-green rounded-full animate-spin" /></div>
  }
  if (!user || !isAdmin) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}
