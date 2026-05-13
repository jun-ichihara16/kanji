// LIFF SDK ラッパー
// LINE内で開いた場合は liff.getProfile() で自動認証
// 外部ブラウザの場合は従来の LINE OAuth にフォールバック
//
// セットアップ:
//   1. npm install @line/liff
//   2. .env に VITE_LIFF_ID=xxxx を追加
//   3. main.tsx で initLiff() を呼ぶ

import type liff from '@line/liff'

type Liff = typeof liff

let liffInstance: Liff | null = null
let liffReady = false
let liffError: string | null = null

const LIFF_ID = import.meta.env.VITE_LIFF_ID || ''

export async function initLiff(): Promise<boolean> {
  if (!LIFF_ID) {
    liffError = 'VITE_LIFF_ID is not set'
    return false
  }

  try {
    const liffModule = await import('@line/liff')
    liffInstance = liffModule.default
    await liffInstance.init({ liffId: LIFF_ID })
    liffReady = true
    return true
  } catch (e: any) {
    liffError = e?.message || 'LIFF init failed'
    console.warn('[LIFF] init failed:', liffError)
    return false
  }
}

export function isLiffReady(): boolean {
  return liffReady && liffInstance !== null
}

export function isInLiff(): boolean {
  if (!liffInstance) return false
  try {
    return liffInstance.isInClient()
  } catch {
    return false
  }
}

export function isLiffLoggedIn(): boolean {
  if (!liffInstance) return false
  try {
    return liffInstance.isLoggedIn()
  } catch {
    return false
  }
}

export interface LiffProfile {
  userId: string
  displayName: string
  pictureUrl?: string
}

export async function getLiffProfile(): Promise<LiffProfile | null> {
  if (!liffInstance || !liffReady) return null
  try {
    const profile = await liffInstance.getProfile()
    return {
      userId: profile.userId,
      displayName: profile.displayName,
      pictureUrl: profile.pictureUrl,
    }
  } catch {
    return null
  }
}

export function liffLogin(): void {
  if (!liffInstance) return
  liffInstance.login()
}

export function liffLogout(): void {
  if (!liffInstance) return
  liffInstance.logout()
}

// LINE Share Target Picker（LINE内でのみ動作）
// イベントURLをLINEの友達/グループに直接共有
export async function liffShareTargetPicker(messages: Array<{
  type: 'text'
  text: string
}>): Promise<boolean> {
  if (!liffInstance || !isInLiff()) return false
  try {
    const result = await liffInstance.shareTargetPicker(messages as any)
    return !!result
  } catch {
    return false
  }
}

export function getLiffError(): string | null {
  return liffError
}
