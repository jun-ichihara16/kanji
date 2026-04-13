// Web Share API ヘルパ
// 非対応環境ではクリップボードコピーにフォールバック

export type ShareResult = 'shared' | 'copied' | 'cancelled' | 'error'

export async function shareOrCopy(payload: {
  title?: string
  text: string
  url?: string
}): Promise<ShareResult> {
  // 共有テキスト（フォールバック用に text + url を結合）
  const fallbackText = payload.url ? `${payload.text}\n${payload.url}` : payload.text

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({
        title: payload.title,
        text: payload.text,
        url: payload.url,
      })
      return 'shared'
    } catch (e: any) {
      // ユーザーがキャンセルした場合
      if (e?.name === 'AbortError') return 'cancelled'
      // それ以外のエラーはクリップボードへフォールバック
    }
  }

  try {
    await navigator.clipboard.writeText(fallbackText)
    return 'copied'
  } catch {
    return 'error'
  }
}

// 精算1件分の共有メッセージを生成
export function buildSettlementShareText(args: {
  toName: string
  amount: number
}): string {
  return `▼${args.toName}へ ¥${args.amount.toLocaleString()}`
}

// PayPay受取リンクのURL形式を検証
// pay.paypay.ne.jp / qr.paypay.ne.jp 配下のhttps URLのみ許可
const PAYPAY_LINK_RE = /^https:\/\/(pay|qr)\.paypay\.ne\.jp\//
export function isValidPaypayLink(url: string): boolean {
  return PAYPAY_LINK_RE.test(url.trim())
}

// PayPay情報未登録者への登録依頼メッセージを生成
export function buildPaypayRequestText(args: {
  toName: string
}): string {
  return `${args.toName}さんへKANJI経由でPayPay送金したいので、PayPay番号または受取リンクの登録をお願いします`
}

// イベントの公開URLを組み立て
export function buildEventPublicUrl(slug: string): string {
  if (typeof window === 'undefined') return ''
  return `${window.location.origin}/app/e/${slug}`
}

export function buildEventJoinUrl(slug: string): string {
  if (typeof window === 'undefined') return ''
  return `${window.location.origin}/app/e/${slug}`
}
