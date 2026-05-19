// Phase 2 KPI 集計ユーティリティ
// 参照: docs/phase2/01_strategy.md § 3-4, docs/phase2/06_phase2_revised_implementation_notes.md § 4
//
// クライアント側で AdminDashboard に表示する用の最低限の集計のみを置く。
// 厳密な定義は phase2_msh_monthly ビュー(migrations/008)を真実の源泉とし、
// ここは入力が同じであればビューと同じ結果を返すことを単体テストで保証する。

export type EventInput = {
  id: string
  host_id: string | null
  completed_at: string | null
}

export type ParticipantInput = {
  event_id: string
}

export type AdvanceInput = {
  event_id: string
}

export type SettlementInput = {
  event_id: string
  is_settled: boolean
}

export type UserInput = {
  id: string
  is_test_account?: boolean | null
}

export type MonthlyMshRow = {
  month_jst: string // 'YYYY-MM'
  msh: number
  completed_events: number
}

/**
 * イベントが MSH 対象になる条件:
 *   - completed_at が記録されている
 *   - 参加者2人以上
 *   - 立替1件以上
 *   - settlements 1件以上、かつ全件 is_settled=true
 *   - host_id がテストアカウント以外
 */
export function isEligibleEvent(
  event: EventInput,
  participants: ParticipantInput[],
  advances: AdvanceInput[],
  settlements: SettlementInput[],
  testAccountIds: Set<string>,
): boolean {
  if (event.completed_at == null) return false
  if (event.host_id == null) return false
  if (testAccountIds.has(event.host_id)) return false

  const partCount = participants.filter((p) => p.event_id === event.id).length
  if (partCount < 2) return false

  const hasAdvance = advances.some((a) => a.event_id === event.id)
  if (!hasAdvance) return false

  const eventSettlements = settlements.filter((s) => s.event_id === event.id)
  if (eventSettlements.length === 0) return false
  const allSettled = eventSettlements.every((s) => s.is_settled === true)
  if (!allSettled) return false

  return true
}

/**
 * JST で月の文字列 ('YYYY-MM') を返す。
 * 入力 ISO 文字列は UTC として解釈されるため、JST に変換してから月を取る。
 */
export function toJstMonth(isoString: string): string {
  const date = new Date(isoString)
  // UTC を JST (+09:00) にずらしてから YYYY-MM を取り出す
  const jstMs = date.getTime() + 9 * 60 * 60 * 1000
  const jst = new Date(jstMs)
  const y = jst.getUTCFullYear()
  const m = String(jst.getUTCMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

/**
 * MSH 月次集計(直近 N ヶ月)
 *
 * @param months 集計対象の月文字列リスト ('YYYY-MM' 形式)。古い順でも新しい順でも OK
 * @returns 月ごとの { msh, completed_events }。入力月リストの順序を維持
 */
export function aggregateMshMonthly(
  events: EventInput[],
  participants: ParticipantInput[],
  advances: AdvanceInput[],
  settlements: SettlementInput[],
  users: UserInput[],
  months: string[],
): MonthlyMshRow[] {
  const testAccountIds = new Set(users.filter((u) => u.is_test_account === true).map((u) => u.id))

  const eligibleEvents = events.filter((e) =>
    isEligibleEvent(e, participants, advances, settlements, testAccountIds),
  )

  return months.map((month) => {
    const eventsInMonth = eligibleEvents.filter(
      (e) => e.completed_at != null && toJstMonth(e.completed_at) === month,
    )
    const hosts = new Set(eventsInMonth.map((e) => e.host_id).filter((id): id is string => id != null))
    return {
      month_jst: month,
      msh: hosts.size,
      completed_events: eventsInMonth.length,
    }
  })
}

/**
 * 直近 N ヶ月の 'YYYY-MM' リストを生成。新しい順。
 */
export function recentMonths(n: number, baseDate: Date = new Date()): string[] {
  const result: string[] = []
  for (let i = 0; i < n; i++) {
    const d = new Date(baseDate.getFullYear(), baseDate.getMonth() - i, 1)
    result.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return result
}
