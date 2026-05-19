// 催促レス施策(Phase 2 v1.2 C-6): 未払い者宛ての催促文面テンプレ
//
// 設計方針:
//  - 幹事が「コピー」ボタンを押すだけで LINE に貼り付けられる文面を返す
//  - 個別宛て(1人ずつ)を基本とする。グループ宛てではない
//  - 金額は1の位まで明示。曖昧表現は避ける
//  - 「お忙しいところすみません」など気まずさ軽減の枕詞を入れる
//
// 参照: docs/phase2/01_strategy.md § 6 / docs/KANJI_インタビュー整理レポート.md
//   インタビューで強度 1 位だった「催促気まずさ・自腹許容」を、
//   幹事が"システムが作った文面を貼るだけ"の演出で和らげる。

export type UnpaidSettlement = {
  /** 支払う人(参加者) */
  from: string
  /** 受け取る人(通常は幹事) */
  to: string
  /** 支払い金額(円) */
  amount: number
}

export type ReminderTemplateInput = {
  eventTitle: string
  /** 未払い1件分。複数人を1メッセージにまとめたい場合は別関数で組み立てる */
  settlement: UnpaidSettlement
  /** イベント詳細 URL(参加者が支払い状況を見るためのページ) */
  eventUrl: string
  /** 受け取り手段の補足(例: 「PayPay: 080-XXXX-XXXX」)。任意 */
  paymentHint?: string
}

/**
 * 個別宛て催促文面を組み立てる。LINE にそのまま貼り付けて使う想定。
 * 文面は意図的に控えめ・幹事が「自分から催促した」感を薄める設計。
 */
export function buildIndividualReminderText(input: ReminderTemplateInput): string {
  const { eventTitle, settlement, eventUrl, paymentHint } = input
  const lines: string[] = [
    `${settlement.from}さん、お忙しいところすみません。`,
    ``,
    `「${eventTitle}」の精算がまだ残っているようなので、念のため共有します。`,
    `${settlement.to}さんへ ¥${settlement.amount.toLocaleString()}`,
  ]
  if (paymentHint && paymentHint.trim() !== '') {
    lines.push(``, paymentHint.trim())
  }
  lines.push(``, `詳細はこちらから確認できます:`, eventUrl)
  return lines.join('\n')
}

/**
 * 同じ受取人に対する複数件の未払いをまとめたサマリー文面。
 * 例: 受取人が複数の参加者から受け取る予定がある場合に、内訳一覧として使う。
 * 個別宛ての buildIndividualReminderText とは別物。
 */
export function buildPayeeSummaryText(input: {
  eventTitle: string
  payeeName: string
  unpaidList: UnpaidSettlement[]
  eventUrl: string
}): string {
  const { eventTitle, payeeName, unpaidList, eventUrl } = input
  if (unpaidList.length === 0) return ''
  const total = unpaidList.reduce((sum, s) => sum + s.amount, 0)
  const lines: string[] = [
    `【${eventTitle}】${payeeName}さんへの未払い一覧`,
    ``,
    ...unpaidList.map((s) => `・${s.from}さん: ¥${s.amount.toLocaleString()}`),
    ``,
    `合計: ¥${total.toLocaleString()}`,
    ``,
    `詳細: ${eventUrl}`,
  ]
  return lines.join('\n')
}
