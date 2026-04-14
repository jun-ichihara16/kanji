import { describe, it, expect } from 'vitest'
import {
  calculateSettlements,
  allocateShares,
  suggestSplitFromTags,
  buildSuggestedProfiles,
  Advance,
  SplitProfile,
} from './settle'

// =========================================
// 既存の均等割テスト（下位互換）
// =========================================
describe('calculateSettlements (均等割 下位互換)', () => {
  it('3人でAが全額立替 → B→A, C→A', () => {
    const advances: Advance[] = [
      { payerName: 'A', amount: 3000, splitTarget: 'all' },
    ]
    const names = ['A', 'B', 'C']
    const result = calculateSettlements(advances, names)

    const totalToA = result
      .filter((s) => s.to === 'A')
      .reduce((sum, s) => sum + s.amount, 0)
    expect(totalToA).toBe(2000)
    expect(result.every((s) => s.to === 'A')).toBe(true)
  })

  it('複数立替が混在 → 相殺されて最小精算', () => {
    const advances: Advance[] = [
      { payerName: 'A', amount: 6000, splitTarget: 'all' },
      { payerName: 'B', amount: 3000, splitTarget: 'all' },
    ]
    const names = ['A', 'B', 'C']
    const result = calculateSettlements(advances, names)

    expect(result.length).toBe(1)
    expect(result[0]).toEqual({ from: 'C', to: 'A', amount: 3000 })
  })

  it('特定の人のみ対象の立替', () => {
    const advances: Advance[] = [
      {
        payerName: 'A',
        amount: 2000,
        splitTarget: 'specific',
        targetNames: ['B', 'C'],
      },
    ]
    const names = ['A', 'B', 'C']
    const result = calculateSettlements(advances, names)

    const totalToA = result
      .filter((s) => s.to === 'A')
      .reduce((sum, s) => sum + s.amount, 0)
    expect(totalToA).toBe(2000)
  })

  it('立替がない場合は空配列', () => {
    const result = calculateSettlements([], ['A', 'B', 'C'])
    expect(result).toEqual([])
  })

  it('全員が均等に立替した場合は精算不要', () => {
    const advances: Advance[] = [
      { payerName: 'A', amount: 3000, splitTarget: 'all' },
      { payerName: 'B', amount: 3000, splitTarget: 'all' },
      { payerName: 'C', amount: 3000, splitTarget: 'all' },
    ]
    const names = ['A', 'B', 'C']
    const result = calculateSettlements(advances, names)
    expect(result).toEqual([])
  })
})

// =========================================
// allocateShares (ウェイト配分の単体テスト)
// =========================================
describe('allocateShares', () => {
  it('全員 weight=1 で均等割（端数は負担大の人に寄せる）', () => {
    const profiles: SplitProfile[] = [
      { name: 'A', weight: 1, fixed_amount: null },
      { name: 'B', weight: 1, fixed_amount: null },
      { name: 'C', weight: 1, fixed_amount: null },
    ]
    const shares = allocateShares(10000, profiles)
    const total = Object.values(shares).reduce((a, b) => a + b, 0)
    expect(total).toBe(10000)
    // 10000 / 3 = 3333.33... → [3334, 3333, 3333]
    expect(shares.A + shares.B + shares.C).toBe(10000)
    expect(Math.max(shares.A, shares.B, shares.C) - Math.min(shares.A, shares.B, shares.C)).toBeLessThanOrEqual(1)
  })

  it('ウェイト傾斜で配分（合計は元の立替額と完全一致）', () => {
    const profiles: SplitProfile[] = [
      { name: 'A', weight: 1.5, fixed_amount: null }, // 上司
      { name: 'B', weight: 1.0, fixed_amount: null },
      { name: 'C', weight: 0.7, fixed_amount: null }, // 女性
      { name: 'D', weight: 0.3, fixed_amount: null }, // 遅刻
    ]
    const shares = allocateShares(10000, profiles)
    const total = Object.values(shares).reduce((a, b) => a + b, 0)
    expect(total).toBe(10000)
    // ウェイト順序: A > B > C > D
    expect(shares.A).toBeGreaterThan(shares.B)
    expect(shares.B).toBeGreaterThan(shares.C)
    expect(shares.C).toBeGreaterThan(shares.D)
  })

  it('fixed_amount 指定者は固定、残りはウェイトで按分', () => {
    const profiles: SplitProfile[] = [
      { name: 'A', weight: 1.0, fixed_amount: 0 },    // 主役 0円固定
      { name: 'B', weight: 1.0, fixed_amount: null },
      { name: 'C', weight: 1.0, fixed_amount: null },
    ]
    const shares = allocateShares(10000, profiles)
    const total = Object.values(shares).reduce((a, b) => a + b, 0)
    expect(total).toBe(10000)
    expect(shares.A).toBe(0)
    expect(shares.B + shares.C).toBe(10000)
    // B, Cは5000/5000の均等割
    expect(Math.abs(shares.B - shares.C)).toBeLessThanOrEqual(1)
  })

  it('端数処理: 合計が立替額と1円も狂わない（100パターン確認）', () => {
    const profiles: SplitProfile[] = [
      { name: 'A', weight: 1.5, fixed_amount: null },
      { name: 'B', weight: 1.0, fixed_amount: null },
      { name: 'C', weight: 0.7, fixed_amount: null },
      { name: 'D', weight: 0.3, fixed_amount: null },
      { name: 'E', weight: 1.2, fixed_amount: null },
    ]
    for (let amt = 1; amt <= 100; amt++) {
      const shares = allocateShares(amt, profiles)
      const total = Object.values(shares).reduce((a, b) => a + b, 0)
      expect(total).toBe(amt)
    }
  })

  it('全員 fixed_amount 指定で残りウェイト対象なし → 余剰は出ず固定金額通り', () => {
    const profiles: SplitProfile[] = [
      { name: 'A', weight: 0, fixed_amount: 3000 },
      { name: 'B', weight: 0, fixed_amount: 2000 },
      { name: 'C', weight: 0, fixed_amount: 5000 },
    ]
    const shares = allocateShares(10000, profiles)
    expect(shares.A).toBe(3000)
    expect(shares.B).toBe(2000)
    expect(shares.C).toBe(5000)
  })

  it('立替額が0のケース', () => {
    const profiles: SplitProfile[] = [
      { name: 'A', weight: 1, fixed_amount: null },
    ]
    const shares = allocateShares(0, profiles)
    expect(shares.A).toBe(0)
  })
})

// =========================================
// calculateSettlements (傾斜対応版)
// =========================================
describe('calculateSettlements (傾斜対応)', () => {
  it('ウェイト傾斜: 上司が多く、女性/若手が少なく負担', () => {
    const advances: Advance[] = [
      { payerName: '幹事', amount: 20000, splitTarget: 'all' },
    ]
    const names = ['幹事', '上司', '女性', '若手']
    const profiles: SplitProfile[] = [
      { name: '幹事', weight: 1.0, fixed_amount: null },
      { name: '上司', weight: 1.5, fixed_amount: null },
      { name: '女性', weight: 0.7, fixed_amount: null },
      { name: '若手', weight: 0.7, fixed_amount: null },
    ]
    const result = calculateSettlements(advances, names, profiles)

    // 幹事へ合計で戻ってくる額は、幹事以外の負担合計と一致
    const totalToKanji = result
      .filter((s) => s.to === '幹事')
      .reduce((sum, s) => sum + s.amount, 0)

    // 合計ウェイト 3.9, 幹事負担 = 20000*1.0/3.9 ≈ 5128
    // 幹事以外の負担 = 20000 - 5128 = 14872 (端数誤差±1)
    expect(totalToKanji).toBeGreaterThan(14000)
    expect(totalToKanji).toBeLessThan(16000)
  })

  it('主役（fixed_amount=0）: 主役以外で負担', () => {
    const advances: Advance[] = [
      { payerName: '幹事', amount: 15000, splitTarget: 'all' },
    ]
    const names = ['幹事', '主役', '参加者1', '参加者2']
    const profiles: SplitProfile[] = [
      { name: '幹事', weight: 1.0, fixed_amount: null },
      { name: '主役', weight: 0, fixed_amount: 0 },
      { name: '参加者1', weight: 1.0, fixed_amount: null },
      { name: '参加者2', weight: 1.0, fixed_amount: null },
    ]
    const result = calculateSettlements(advances, names, profiles)

    // 主役から幹事へ送金はないはず
    const fromShuyaku = result.filter((s) => s.from === '主役')
    expect(fromShuyaku).toEqual([])

    // 幹事以外（主役除く）の2人で 2/3 を負担、幹事が 1/3 負担
    // 15000 * 2/3 = 10000 が幹事へ戻る
    const totalToKanji = result
      .filter((s) => s.to === '幹事')
      .reduce((sum, s) => sum + s.amount, 0)
    expect(totalToKanji).toBe(10000)
  })

  it('全員ウェイトが異なる場合: 合計が立替額と完全一致', () => {
    const advances: Advance[] = [
      { payerName: 'A', amount: 12345, splitTarget: 'all' },
    ]
    const names = ['A', 'B', 'C', 'D', 'E']
    const profiles: SplitProfile[] = [
      { name: 'A', weight: 1.2, fixed_amount: null },
      { name: 'B', weight: 0.8, fixed_amount: null },
      { name: 'C', weight: 0.5, fixed_amount: null },
      { name: 'D', weight: 1.0, fixed_amount: null },
      { name: 'E', weight: 1.5, fixed_amount: null },
    ]
    const result = calculateSettlements(advances, names, profiles)

    // 全員の送金（A宛）の合計 = Aの立替 - A自身の負担 と一致
    const totalIn = result
      .filter((s) => s.to === 'A')
      .reduce((sum, s) => sum + s.amount, 0)
    const totalOut = result
      .filter((s) => s.from === 'A')
      .reduce((sum, s) => sum + s.amount, 0)
    const netToA = totalIn - totalOut

    // Aの負担 = 12345 * 1.2/5.0 = 2962.8, A以外の負担合計 ≈ 9382
    expect(netToA).toBeGreaterThan(9300)
    expect(netToA).toBeLessThan(9500)
  })
})

// =========================================
// suggestSplitFromTags
// =========================================
describe('suggestSplitFromTags', () => {
  it('マイルド: 女性 → 0.8', () => {
    const r = suggestSplitFromTags(['女性'], 'ai_mild')
    expect(r.weight).toBe(0.8)
    expect(r.fixed_amount).toBeNull()
  })

  it('マイルド: 上司/先輩 → 1.2', () => {
    const r = suggestSplitFromTags(['上司/先輩'], 'ai_mild')
    expect(r.weight).toBe(1.2)
  })

  it('マイルド: 遅刻/早退 → 0.5', () => {
    const r = suggestSplitFromTags(['遅刻/早退'], 'ai_mild')
    expect(r.weight).toBe(0.5)
  })

  it('しっかり: 女性 → 0.7', () => {
    const r = suggestSplitFromTags(['女性'], 'ai_strict')
    expect(r.weight).toBe(0.7)
  })

  it('しっかり: 上司/先輩 → 1.5', () => {
    const r = suggestSplitFromTags(['上司/先輩'], 'ai_strict')
    expect(r.weight).toBe(1.5)
  })

  it('しっかり: 遅刻/早退 → 0.3', () => {
    const r = suggestSplitFromTags(['遅刻/早退'], 'ai_strict')
    expect(r.weight).toBe(0.3)
  })

  it('主役は他タグ不問で fixed_amount=0', () => {
    const r = suggestSplitFromTags(['主役', '上司/先輩'], 'ai_strict')
    expect(r.weight).toBe(0)
    expect(r.fixed_amount).toBe(0)
  })

  it('タグなし → 1.0 (null)', () => {
    const r = suggestSplitFromTags([], 'ai_mild')
    expect(r.weight).toBe(1.0)
    expect(r.fixed_amount).toBeNull()
  })

  it('複数タグ: マイルドで女性+遅刻 → 0.8 * 0.5 = 0.4', () => {
    const r = suggestSplitFromTags(['女性', '遅刻/早退'], 'ai_mild')
    expect(r.weight).toBeCloseTo(0.4, 2)
  })
})

// =========================================
// buildSuggestedProfiles
// =========================================
describe('buildSuggestedProfiles', () => {
  it('equal モード: 全員 weight=1.0, fixed=null', () => {
    const profiles = buildSuggestedProfiles(
      [{ name: 'A', tags: ['女性'] }, { name: 'B', tags: ['上司/先輩'] }],
      'equal'
    )
    expect(profiles[0].weight).toBe(1.0)
    expect(profiles[1].weight).toBe(1.0)
  })

  it('ai_mild モード: タグに応じた weight', () => {
    const profiles = buildSuggestedProfiles(
      [
        { name: 'A', tags: ['女性'] },
        { name: 'B', tags: ['上司/先輩'] },
        { name: 'C', tags: [] },
      ],
      'ai_mild'
    )
    expect(profiles[0].weight).toBe(0.8)
    expect(profiles[1].weight).toBe(1.2)
    expect(profiles[2].weight).toBe(1.0)
  })

  it('ai_strict モード: 主役の扱い', () => {
    const profiles = buildSuggestedProfiles(
      [
        { name: 'A', tags: ['主役'] },
        { name: 'B', tags: [] },
      ],
      'ai_strict'
    )
    expect(profiles[0].weight).toBe(0)
    expect(profiles[0].fixed_amount).toBe(0)
    expect(profiles[1].weight).toBe(1.0)
  })
})
