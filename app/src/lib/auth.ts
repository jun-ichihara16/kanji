import { supabase } from './supabase'

const LINE_CHANNEL_ID = import.meta.env.VITE_LINE_CHANNEL_ID

/**
 * 暗号学的に安全なランダムトークンを生成（CSRF対策用）
 * Math.random() は予測可能なため使用しない
 */
function generateSecureToken(bytes = 32): string {
  const array = new Uint8Array(bytes)
  crypto.getRandomValues(array)
  return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * LINE OAuth 直接認証
 */
export function loginWithLINE() {
  const redirectUri = encodeURIComponent(
    window.location.origin + '/app/auth/callback'
  )
  const state = generateSecureToken()
  const nonce = generateSecureToken()

  sessionStorage.setItem('line_oauth_state', state)

  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)

  const params = [
    `response_type=code`,
    `client_id=${LINE_CHANNEL_ID}`,
    `redirect_uri=${redirectUri}`,
    `state=${state}`,
    `scope=profile%20openid`,
    `nonce=${nonce}`,
  ]

  if (isMobile) {
    params.push('disable_auto_login=false')
    params.push('bot_prompt=aggressive')
  }

  const authUrl = `https://access.line.me/oauth2/v2.1/authorize?${params.join('&')}`

  // スマホでもPCでも同じURLだが、LINEアプリがインストールされていれば
  // LINE側が自動的にアプリ内認証にリダイレクトする
  window.location.href = authUrl
}

/**
 * LINEのcodeをEdge Functionに送ってユーザー情報取得
 */
export async function exchangeLineCode(code: string): Promise<{
  user: { id: string; displayName: string; avatarUrl?: string } | null
  error: string | null
}> {
  const redirectUri = window.location.origin + '/app/auth/callback'
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

  try {
    // supabase.functions.invokeの代わりに直接fetchで呼ぶ（エラーハンドリング改善）
    const res = await fetch(`${supabaseUrl}/functions/v1/line-auth`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify({ code, redirectUri }),
    })

    const data = await res.json()
    console.log('Edge Function response:', res.status, data)

    if (!res.ok || data.error) {
      return { user: null, error: data.error || `HTTP ${res.status}` }
    }

    return { user: data.user, error: null }
  } catch (e: any) {
    console.error('Exchange error:', e)
    return { user: null, error: e.message }
  }
}

/**
 * ローカルセッション管理
 */
export function getLocalUser() {
  const raw = localStorage.getItem('kanji_user')
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function setLocalUser(user: {
  id: string
  displayName: string
  avatarUrl?: string
}) {
  localStorage.setItem('kanji_user', JSON.stringify(user))
}

export function clearLocalUser() {
  localStorage.removeItem('kanji_user')
}

export function signOut() {
  clearLocalUser()
  window.location.href = '/app/'
}
