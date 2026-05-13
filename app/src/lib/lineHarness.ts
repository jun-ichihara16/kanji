// LINE Harness API 連携ヘルパー
// KANJI のイベント（作成・精算完了等）を LINE Harness に通知し、
// タグ付与・メッセージ配信・リッチメニュー切替をトリガーする
//
// LINE Harness API docs: https://github.com/Shudesu/line-harness-oss

const LINE_HARNESS_URL = import.meta.env.VITE_LINE_HARNESS_URL || ''
const LINE_HARNESS_API_KEY = import.meta.env.VITE_LINE_HARNESS_API_KEY || ''

interface HarnessPayload {
  action: string
  line_user_id?: string
  tags?: string[]
  event_id?: string
  metadata?: Record<string, unknown>
}

async function callHarness(payload: HarnessPayload): Promise<boolean> {
  if (!LINE_HARNESS_URL || !LINE_HARNESS_API_KEY) return false

  try {
    const res = await fetch(`${LINE_HARNESS_URL}/api/webhook-in`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LINE_HARNESS_API_KEY}`,
      },
      body: JSON.stringify(payload),
    })
    return res.ok
  } catch {
    return false
  }
}

// 幹事がイベント作成完了 → タグ「host」付与 + リッチメニュー切替
export function notifyEventCreated(lineUserId: string, eventId: string) {
  return callHarness({
    action: 'event_created',
    line_user_id: lineUserId,
    tags: ['host'],
    event_id: eventId,
  })
}

// 参加者がイベント参加 → タグ「participant」付与
export function notifyParticipantJoined(lineUserId: string, eventId: string) {
  return callHarness({
    action: 'participant_joined',
    line_user_id: lineUserId,
    tags: ['participant'],
    event_id: eventId,
  })
}

// 精算完了 → 参加者にメッセージ送信トリガー
export function notifySettlementCompleted(eventId: string, hostName: string) {
  return callHarness({
    action: 'settlement_completed',
    event_id: eventId,
    metadata: { host_name: hostName },
  })
}

// 請求開始 → 未精算者にPush通知トリガー
export function notifyBillingStarted(eventId: string, settlements: Array<{
  fromLineUserId?: string
  fromName: string
  toName: string
  amount: number
}>) {
  return callHarness({
    action: 'billing_started',
    event_id: eventId,
    metadata: { settlements },
  })
}
