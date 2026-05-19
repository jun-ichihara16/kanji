// 計測イベントの軽量ユーティリティ。
// 現状は console.log + localStorage のリングバッファに記録するだけ。
// 後で PostHog / GA4 等に差し替える場合はここを実装すれば全箇所が連動する。
//
// 使い方:
//   track('template_selected', { event_template: 'nomikai', step_name: 'step1' })

export type AnalyticsEvent =
  | 'template_selected'
  | 'basic_info_completed'
  | 'settlement_type_selected'
  | 'settlement_detail_completed'
  | 'event_created'
  | 'request_sent'
  | 'payment_completed'
  | 'settlement_completed'
  | 'event_first_completion'
  | 'template_changed'
  | 'settlement_type_changed'
  | 'draft_saved'
  | 'draft_restored'

export interface AnalyticsProps {
  event_template?: string
  settlement_type?: string
  participant_count?: number
  has_expense_items?: boolean
  total_amount?: number
  draft_saved?: boolean
  step_name?: string
  // 自由拡張用
  [key: string]: unknown
}

const STORAGE_KEY = 'kanji_analytics_log'
const MAX_EVENTS = 200

interface StoredEvent {
  ts: number
  event: AnalyticsEvent
  props: AnalyticsProps
}

function readLog(): StoredEvent[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as StoredEvent[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeLog(events: StoredEvent[]) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(events))
  } catch {
    // localStorage が満杯等 → 黙殺
  }
}

export function track(event: AnalyticsEvent, props: AnalyticsProps = {}): void {
  const entry: StoredEvent = { ts: Date.now(), event, props }
  if (typeof window !== 'undefined' && import.meta.env.DEV) {
    // 開発時はログを目視できるように
    console.log('[analytics]', event, props)
  }
  const log = readLog()
  log.push(entry)
  if (log.length > MAX_EVENTS) {
    log.splice(0, log.length - MAX_EVENTS)
  }
  writeLog(log)
}

// デバッグ用にログを取得（admin等で利用）
export function getAnalyticsLog(): StoredEvent[] {
  return readLog()
}

export function clearAnalyticsLog(): void {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(STORAGE_KEY)
}
