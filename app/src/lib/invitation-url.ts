// 招待 URL の純粋ヘルパー(Supabase クライアントに依存しない関数のみ)
// invitation.ts と分離している理由: 単体テストで supabase の環境変数なしに動かすため。

/**
 * 共有URL に ?inv=<token> を付与する。
 * 既存クエリパラメータがある場合は & で連結する。
 */
export function appendInvToken(baseUrl: string, token: string): string {
  const sep = baseUrl.includes('?') ? '&' : '?'
  return `${baseUrl}${sep}inv=${encodeURIComponent(token)}`
}
