import { useState, useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'

export default function AdminProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth()
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    if (authLoading) return
    if (!user?.id) {
      setIsAdmin(false)
      setChecked(true)
      return
    }
    // Supabaseから直接is_adminを確認
    supabase.from('users').select('is_admin').eq('id', user.id).single()
      .then(({ data, error }) => {
        console.log('[AdminCheck] user:', user.id, 'is_admin:', data?.is_admin, 'error:', error)
        setIsAdmin(data?.is_admin === true)
        setChecked(true)
      })
  }, [user, authLoading])

  if (!checked) {
    return (
      <div className="flex justify-center min-h-screen bg-gray-bg">
        <div className="w-full max-w-[800px] min-h-screen bg-white flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-green/30 border-t-green rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  if (!isAdmin) {
    console.log('[AdminCheck] Not admin, redirecting to dashboard')
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}
