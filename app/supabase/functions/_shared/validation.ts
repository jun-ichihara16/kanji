// Edge Function共通バリデーション・サニタイズ関数

/** HTMLエスケープ（メール本文のXSS防止） */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** UUID v4 形式チェック */
export function isValidUUID(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str)
}

/** PayPay番号（数字のみ or ハイフン区切り、9〜13桁） */
export function isValidPhone(str: string): boolean {
  return /^[\d-]{9,15}$/.test(str)
}

/** メールアドレス簡易チェック */
export function isValidEmail(str: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str) && str.length <= 254
}

/** 文字列長チェック */
export function isWithinLength(str: string | null | undefined, max: number): boolean {
  if (!str) return true
  return str.length <= max
}

/** 金額バリデーション（正の整数、上限1000万円） */
export function isValidAmount(amount: number): boolean {
  return Number.isInteger(amount) && amount > 0 && amount <= 10_000_000
}
