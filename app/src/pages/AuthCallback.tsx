import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { exchangeLineCode, setLocalUser } from '../lib/auth'

export default function AuthCallback() {
  const navigate = useNavigate()
  const [status, setStatus] = useState('ログイン中...')

  const [processing, setProcessing] = useState(false)

  useEffect(() => {
    // StrictModeの2回レンダリング対策
    if (processing) return
    setProcessing(true)

    const handleCallback = async () => {
      const params = new URLSearchParams(window.location.search)
      const code = params.get('code')
      const state = params.get('state')
      const error = params.get('error')
      const savedState = sessionStorage.getItem('line_oauth_state')

      console.log('Callback params:', { code: !!code, state, savedState, error })

      // エラーチェック
      if (error) {
        console.error('LINE auth error:', error, params.get('error_description'))
        setStatus('ログインがキャンセルされました')
        setTimeout(() => navigate('/', { replace: true }), 1500)
        return
      }

      // state検証（savedStateがnullの場合はスキップ＝2回目のレンダリング）
      if (savedState && state !== savedState) {
        console.error('State mismatch:', { state, savedState })
        setStatus('認証エラー（state不一致）')
        setTimeout(() => navigate('/', { replace: true }), 1500)
        return
      }

      sessionStorage.removeItem('line_oauth_state')

      if (!code) {
        setStatus('認証コードが見つかりません')
        setTimeout(() => navigate('/', { replace: true }), 1500)
        return
      }

      // Edge Functionでトークン交換
      setStatus('認証中...')
      const { user, error: exchangeError } = await exchangeLineCode(code)

      if (user && !exchangeError) {
        setLocalUser(user)
        console.log('Login success:', user)
        navigate('/dashboard', { replace: true })
      } else {
        console.error('Token exchange failed:', exchangeError)
        setStatus('ログインに失敗しました')
        setTimeout(() => navigate('/', { replace: true }), 2000)
      }
    }

    handleCallback()
  }, [navigate])

  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-4 border-green/30 border-t-green rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-sub">{status}</p>
      </div>
    </div>
  )
}
