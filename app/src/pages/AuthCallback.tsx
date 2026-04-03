import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { setLocalUser } from '../lib/auth'

export default function AuthCallback() {
  const navigate = useNavigate()
  const [status, setStatus] = useState('ログイン中...')
  const processed = useRef(false)

  useEffect(() => {
    if (processed.current) return
    processed.current = true

    const handleCallback = async () => {
      const params = new URLSearchParams(window.location.search)
      const code = params.get('code')
      const state = params.get('state')
      const error = params.get('error')
      const savedState = sessionStorage.getItem('line_oauth_state')

      console.log('[AuthCallback] params:', { code: code?.substring(0, 10), state, savedState, error })

      if (error) {
        console.error('[AuthCallback] LINE error:', error)
        setStatus('ログインがキャンセルされました')
        setTimeout(() => { window.location.href = '/kanji/app/' }, 1500)
        return
      }

      if (savedState && state !== savedState) {
        console.error('[AuthCallback] State mismatch')
        setStatus('認証エラー')
        setTimeout(() => { window.location.href = '/kanji/app/' }, 1500)
        return
      }

      sessionStorage.removeItem('line_oauth_state')

      if (!code) {
        setStatus('認証コードが見つかりません')
        setTimeout(() => { window.location.href = '/kanji/app/' }, 1500)
        return
      }

      setStatus('認証中...')

      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
        const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
        const redirectUri = window.location.origin + '/kanji/app/auth/callback'

        console.log('[AuthCallback] Calling Edge Function...')

        const res = await fetch(`${supabaseUrl}/functions/v1/line-auth`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseAnonKey}`,
          },
          body: JSON.stringify({ code, redirectUri }),
        })

        const data = await res.json()
        console.log('[AuthCallback] Edge Function response:', res.status, data)

        if (res.ok && data.user) {
          setLocalUser(data.user)
          setStatus('ログイン成功！')
          console.log('[AuthCallback] User saved, redirecting...')
          // 初回ログイン（onboardingCompleted未設定）→ オンボーディングへ
          if (!data.user.onboardingCompleted) {
            window.location.href = '/kanji/app/onboarding'
          } else {
            window.location.href = '/kanji/app/dashboard'
          }
          return
        }

        // Edge Function failed - show error detail
        console.error('[AuthCallback] Edge Function error:', data)
        setStatus(`エラー: ${data.error || res.status}`)
        setTimeout(() => { window.location.href = '/kanji/app/' }, 3000)
      } catch (e: any) {
        console.error('[AuthCallback] Network error:', e)
        setStatus('通信エラーが発生しました')
        setTimeout(() => { window.location.href = '/kanji/app/' }, 3000)
      }
    }

    handleCallback()
  }, [])

  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-4 border-green/30 border-t-green rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-sub">{status}</p>
      </div>
    </div>
  )
}
