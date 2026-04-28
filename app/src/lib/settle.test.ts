import { describe, it, expect } from 'vitest'
import {
  calculateSettlements,
  allocateShares,
  suggestSplitFromTags,
  buildSuggestedProfiles,
  applyRounding,
  calcEqualSplit,
  calcWeightedSplit,
  calcReimbursementSplit,
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

  it('回帰: Supabase numeric が文字列で返ってきても weight が効く', () => {
    // PostgREST は numeric を文字列で返すことがあり、string + number 結合で
    // weightSum が壊れる → 全員 NaN になる既存バグの回帰テスト
    const profiles = [
      { name: 'A', weight: '1.5' as unknown as number, fixed_amount: null },
      { name: 'B', weight: '1.0' as unknown as number, fixed_amount: null },
      { name: 'C', weight: '0.5' as unknown as number, fixed_amount: null },
    ]
    const shares = allocateShares(10000, profiles)
    const total = Object.values(shares).reduce((a, b) => a + b, 0)
    expect(total).toBe(10000)
    expect(Number.isFinite(shares.A)).toBe(true)
    expect(shares.A).toBeGreaterThan(shares.B)
    expect(shares.B).toBeGreaterThan(shares.C)
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

  it('しっかり: 女性 → 0.7', () => {
    const r = suggestSplitFromTags(['女性'], 'ai_strict')
    expect(r.weight).toBe(0.7)
  })

  it('しっかり: 上司/先輩 → 1.5', () => {
    const r = suggestSplitFromTags(['上司/先輩'], 'ai_strict')
    expect(r.weight).toBe(1.5)
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

// =========================================
// イベント作成フロー改修（007）
// =========================================

describe('applyRounding', () => {
  it('floor / round / ceil', () => {
    expect(applyRounding(123.4, 'floor')).toBe(123)
    expect(applyRounding(123.5, 'floor')).toBe(123)
    expect(applyRounding(123.4, 'round')).toBe(123)
    expect(applyRounding(123.5, 'round')).toBe(124)
    expect(applyRounding(123.4, 'ceil')).toBe(124)
    expect(applyRounding(123.0, 'ceil')).toBe(123)
  })
  it('NaN/Infinity → 0', () => {
    expect(applyRounding(NaN, 'round')).toBe(0)
    expect(applyRounding(Infinity, 'round')).toBe(0)
  })
})

describe('calcEqualSplit', () => {
  it('4人で12000円の割り勘 → 1人3000円', () => {
    const r = calcEqualSplit({
      totalAmount: 12000,
      memberNames: ['A', 'B', 'C', 'D'],
      rounding: 'round',
    })
    expect(r.perPerson).toBe(3000)
    expect(r.shares).toEqual({ A: 3000, B: 3000, C: 3000, D: 3000 })
    const sum = Object.values(r.shares).reduce((a, b) => a + b, 0)
    expect(sum).toBe(12000)
  })

  it('3人で10000円: 端数1円調整で合計一致', () => {
    const r = calcEqualSplit({
      totalAmount: 10000,
      memberNames: ['A', 'B', 'C'],
      rounding: 'round',
    })
    const sum = Object.values(r.shares).reduce((a, b) => a + b, 0)
    expect(sum).toBe(10000)
  })

  it('floor 指定: 1人あたりは切り捨て、合計は端数で帳尻合わせ', () => {
    const r = calcEqualSplit({
      totalAmount: 10000,
      memberNames: ['A', 'B', 'C'],
      rounding: 'floor',
    })
    expect(r.perPerson).toBe(3333)
    const sum = Object.values(r.shares).reduce((a, b) => a + b, 0)
    expect(sum).toBe(10000)
  })

  it('対象0人 → 全員0', () => {
    const r = calcEqualSplit({
      totalAmount: 5000,
      memberNames: [],
      rounding: 'round',
    })
    expect(r.perPerson).toBe(0)
  })

  it('totalAmount=0 → 全員0', () => {
    const r = calcEqualSplit({
      totalAmount: 0,
      memberNames: ['A', 'B'],
      rounding: 'round',
    })
    expect(r.shares).toEqual({ A: 0, B: 0 })
  })
})

describe('calcWeightedSplit', () => {
  it('多め(1.3) / ふつう(1.0) / 少なめ(0.7) で配分', () => {
    const r = calcWeightedSplit({
      totalAmount: 30000,
      members: [
        { name: '先輩', weight: 1.3, fixed_amount: null },
        { name: 'ふつう', weight: 1.0, fixed_amount: null },
        { name: '学生', weight: 0.7, fixed_amount: null },
      ],
      rounding: 'round',
    })
    expect(r.actualTotal).toBe(30000)
    expect(r.mismatch).toBe(false)
    // 先輩 > ふつう > 学生
    expect(r.shares['先輩']).toBeGreaterThan(r.shares['ふつう'])
    expect(r.shares['ふつう']).toBeGreaterThan(r.shares['学生'])
  })

  it('一部メンバーに固定金額（manual_amounts）', () => {
    const r = calcWeightedSplit({
      totalAmount: 10000,
      members: [
        { name: 'A', weight: 1.0, fixed_amount: 1000 }, // 固定
        { name: 'B', weight: 1.0, fixed_amount: null },
        { name: 'C', weight: 1.0, fixed_amount: null },
      ],
      rounding: 'round',
    })
    expect(r.shares['A']).toBe(1000)
    expect(r.actualTotal).toBe(10000)
    expect(r.mismatch).toBe(false)
  })
})

describe('calcReimbursementSplit', () => {
  it('BBQ想定: 立替2件・立替者2人', () => {
    const r = calcReimbursementSplit({
      advances: [
        { payerName: 'A', amount: 8000, splitTarget: 'all' }, // 食材
        { payerName: 'B', amount: 4000, splitTarget: 'all' }, // 飲み物
      ],
      participantNames: ['A', 'B', 'C', 'D'],
    })
    // 1人あたり = 12000 / 4 = 3000
    // A: +8000 - 3000 = +5000
    // B: +4000 - 3000 = +1000
    // C: -3000
    // D: -3000
    expect(r.balances['A']).toBe(5000)
    expect(r.balances['B']).toBe(1000)
    expect(r.balances['C']).toBe(-3000)
    expect(r.balances['D']).toBe(-3000)
    // 精算: C/Dから A/Bへ流れる
    const sumOut = r.settlements.reduce((s, x) => s + x.amount, 0)
    expect(sumOut).toBe(6000)
  })

  it('対象外メンバーあり（specific）', () => {
    const r = calcReimbursementSplit({
      advances: [
        {
          payerName: 'A',
          amount: 6000,
          splitTarget: 'specific',
          targetNames: ['B', 'C'],
        },
      ],
      participantNames: ['A', 'B', 'C', 'D'],
    })
    // D は対象外なので balance は 0
    expect(r.balances['D']).toBe(0)
    // A は受取6000
    expect(r.balances['A']).toBe(6000)
    expect(r.balances['B']).toBe(-3000)
    expect(r.balances['C']).toBe(-3000)
  })
})
