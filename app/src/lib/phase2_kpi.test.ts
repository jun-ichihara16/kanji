import { describe, it, expect } from 'vitest'
import {
  aggregateMshMonthly,
  isEligibleEvent,
  recentMonths,
  toJstMonth,
  type EventInput,
  type ParticipantInput,
  type AdvanceInput,
  type SettlementInput,
  type UserInput,
} from './phase2_kpi'

describe('toJstMonth', () => {
  it('UTC 14:59:59 (= JST 23:59:59 当日) は当日の月になる', () => {
    expect(toJstMonth('2026-06-30T14:59:59.000Z')).toBe('2026-06')
  })

  it('UTC 15:00:00 (= JST 00:00:00 翌日) は翌月になる', () => {
    expect(toJstMonth('2026-06-30T15:00:00.000Z')).toBe('2026-07')
  })

  it('月初 00:00 JST は正しくその月になる', () => {
    expect(toJstMonth('2026-05-31T15:00:00.000Z')).toBe('2026-06')
  })
})

describe('isEligibleEvent', () => {
  const baseEvent: EventInput = {
    id: 'evt1',
    host_id: 'host1',
    completed_at: '2026-05-15T03:00:00.000Z',
  }
  const baseParticipants: ParticipantInput[] = [
    { event_id: 'evt1' },
    { event_id: 'evt1' },
  ]
  const baseAdvances: AdvanceInput[] = [{ event_id: 'evt1' }]
  const baseSettlements: SettlementInput[] = [{ event_id: 'evt1', is_settled: true }]

  it('全条件を満たせば true', () => {
    expect(
      isEligibleEvent(baseEvent, baseParticipants, baseAdvances, baseSettlements, new Set()),
    ).toBe(true)
  })

  it('completed_at が null なら false', () => {
    expect(
      isEligibleEvent(
        { ...baseEvent, completed_at: null },
        baseParticipants,
        baseAdvances,
        baseSettlements,
        new Set(),
      ),
    ).toBe(false)
  })

  it('参加者1人なら false', () => {
    expect(
      isEligibleEvent(
        baseEvent,
        [{ event_id: 'evt1' }],
        baseAdvances,
        baseSettlements,
        new Set(),
      ),
    ).toBe(false)
  })

  it('立替0件なら false', () => {
    expect(
      isEligibleEvent(baseEvent, baseParticipants, [], baseSettlements, new Set()),
    ).toBe(false)
  })

  it('settlements 0件なら false', () => {
    expect(
      isEligibleEvent(baseEvent, baseParticipants, baseAdvances, [], new Set()),
    ).toBe(false)
  })

  it('settlements の一部が未完了なら false', () => {
    expect(
      isEligibleEvent(
        baseEvent,
        baseParticipants,
        baseAdvances,
        [
          { event_id: 'evt1', is_settled: true },
          { event_id: 'evt1', is_settled: false },
        ],
        new Set(),
      ),
    ).toBe(false)
  })

  it('host_id がテストアカウントなら false', () => {
    expect(
      isEligibleEvent(
        baseEvent,
        baseParticipants,
        baseAdvances,
        baseSettlements,
        new Set(['host1']),
      ),
    ).toBe(false)
  })
})

describe('aggregateMshMonthly', () => {
  const users: UserInput[] = [
    { id: 'h1', is_test_account: false },
    { id: 'h2', is_test_account: false },
    { id: 'test', is_test_account: true },
  ]
  const events: EventInput[] = [
    // h1 が 2026-05 に完了 2件 → MSH カウントはユニーク
    { id: 'e1', host_id: 'h1', completed_at: '2026-05-10T03:00:00.000Z' },
    { id: 'e2', host_id: 'h1', completed_at: '2026-05-20T03:00:00.000Z' },
    // h2 が 2026-05 に完了 1件
    { id: 'e3', host_id: 'h2', completed_at: '2026-05-25T03:00:00.000Z' },
    // テストアカウントは除外
    { id: 'e4', host_id: 'test', completed_at: '2026-05-15T03:00:00.000Z' },
    // 別月
    { id: 'e5', host_id: 'h1', completed_at: '2026-04-10T03:00:00.000Z' },
    // completed_at なし
    { id: 'e6', host_id: 'h2', completed_at: null },
  ]
  const participants: ParticipantInput[] = events.flatMap((e) => [
    { event_id: e.id },
    { event_id: e.id },
  ])
  const advances: AdvanceInput[] = events.map((e) => ({ event_id: e.id }))
  const settlements: SettlementInput[] = events.map((e) => ({ event_id: e.id, is_settled: true }))

  it('2026-05 の MSH はユニーク幹事2人、完了イベントは3件(テストアカウント除外)', () => {
    const result = aggregateMshMonthly(events, participants, advances, settlements, users, ['2026-05'])
    expect(result).toEqual([{ month_jst: '2026-05', msh: 2, completed_events: 3 }])
  })

  it('2026-04 の MSH は1人、完了イベント1件', () => {
    const result = aggregateMshMonthly(events, participants, advances, settlements, users, ['2026-04'])
    expect(result).toEqual([{ month_jst: '2026-04', msh: 1, completed_events: 1 }])
  })

  it('入力月リストの順序を維持する', () => {
    const result = aggregateMshMonthly(
      events,
      participants,
      advances,
      settlements,
      users,
      ['2026-05', '2026-04', '2026-03'],
    )
    expect(result.map((r) => r.month_jst)).toEqual(['2026-05', '2026-04', '2026-03'])
  })

  it('対象月にデータがなければ msh=0', () => {
    const result = aggregateMshMonthly(events, participants, advances, settlements, users, ['2026-03'])
    expect(result).toEqual([{ month_jst: '2026-03', msh: 0, completed_events: 0 }])
  })
})

describe('recentMonths', () => {
  it('基準日 2026-05-19 から3ヶ月分を新しい順に返す', () => {
    const base = new Date(2026, 4, 19) // 月は0始まり
    expect(recentMonths(3, base)).toEqual(['2026-05', '2026-04', '2026-03'])
  })

  it('1月を跨いで前年に戻る', () => {
    const base = new Date(2026, 0, 15)
    expect(recentMonths(3, base)).toEqual(['2026-01', '2025-12', '2025-11'])
  })
})
