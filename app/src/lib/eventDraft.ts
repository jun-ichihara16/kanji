// イベント作成フローの「下書き保存」用ユーティリティ。
// localStorage にユーザー単位で保存する。
// ※ DB 側にも is_draft カラムはあるが、未作成段階では DB レコード自体が無いため
//   localStorage で受ける。作成後の編集中下書きは DB の is_draft に寄せる想定。

import {
  EventTemplate,
  SettlementType,
  RoundingRule,
} from '../hooks/useEvent'

export interface DraftMember {
  name: string
  payment_method?: string
}

export interface DraftExpense {
  name: string
  amount: number
  payer_name: string // 既存 advances と整合させる
  split_target: 'all' | 'specific'
  target_names: string[]
  note?: string
}

export interface EventDraft {
  // ステップ
  step: number
  // 1. テンプレ
  event_template: EventTemplate | null
  // 2. 基本情報
  title: string
  event_date: string
  event_time: string
  venue_name: string
  venue_address: string
  members: DraftMember[]
  memo: string
  // 3. 会計方式
  settlement_type: SettlementType | null
  // 4. 会計詳細
  total_amount: number | null
  rounding_rule: RoundingRule
  exclude_organizer: boolean
  included_member_names: string[] // equal_split / weighted_split で対象とするメンバー名
  weighted_member_names: string[] // weighted_split で差をつける対象
  member_weights: Record<string, number> // weighted_split: name -> weight
  manual_amounts: Record<string, number | null> // weighted_split: name -> 固定金額
  expense_items: DraftExpense[] // reimbursement_split
  final_adjustment_mode: 'minimum' | 'even'
  // メタ
  saved_at: number
}

const KEY_PREFIX = 'kanji_event_draft_'

function key(userId: string): string {
  return `${KEY_PREFIX}${userId}`
}

export function emptyDraft(): EventDraft {
  return {
    step: 1,
    event_template: null,
    title: '',
    event_date: '',
    event_time: '',
    venue_name: '',
    venue_address: '',
    members: [],
    memo: '',
    settlement_type: null,
    total_amount: null,
    rounding_rule: 'round',
    exclude_organizer: false,
    included_member_names: [],
    weighted_member_names: [],
    member_weights: {},
    manual_amounts: {},
    expense_items: [],
    final_adjustment_mode: 'minimum',
    saved_at: 0,
  }
}

export function loadDraft(userId: string): EventDraft | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(key(userId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<EventDraft>
    // 古い形式に対する保険: 欠けてるフィールドを埋める
    return { ...emptyDraft(), ...parsed } as EventDraft
  } catch {
    return null
  }
}

export function saveDraft(userId: string, draft: EventDraft): void {
  if (typeof window === 'undefined') return
  try {
    const next: EventDraft = { ...draft, saved_at: Date.now() }
    window.localStorage.setItem(key(userId), JSON.stringify(next))
  } catch {
    // 容量超過等 → 黙殺
  }
}

export function clearDraft(userId: string): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(key(userId))
  } catch {
    // 黙殺
  }
}

export function hasDraft(userId: string): boolean {
  return loadDraft(userId) != null
}
