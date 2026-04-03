import { describe, it, expect } from 'vitest'
import { calculateSettlements, Advance } from './settle'

describe('calculateSettlements', () => {
  it('3人でAが全額立替 → B→A, C→A', () => {
    const advances: Advance[] = [
      { payerName: 'A', amount: 3000, splitTarget: 'all' },
    ]
    const names = ['A', 'B', 'C']
    const result = calculateSettlements(advances, names)

    const totalToA = result
      .filter((s) => s.to === 'A')
      .reduce((sum, s) => sum + s.amount, 0)
    expect(totalToA).toBe(2000) // B: 1000 + C: 1000
    expect(result.every((s) => s.to === 'A')).toBe(true)
  })

  it('複数立替が混在 → 相殺されて最小精算', () => {
    const advances: Advance[] = [
      { payerName: 'A', amount: 6000, splitTarget: 'all' },
      { payerName: 'B', amount: 3000, splitTarget: 'all' },
    ]
    const names = ['A', 'B', 'C']
    const result = calculateSettlements(advances, names)

    // A paid 6000, owes 3000 → net +3000
    // B paid 3000, owes 3000 → net 0
    // C paid 0, owes 3000 → net -3000
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

    // A paid 2000 for B and C (1000 each)
    // A: +2000, B: -1000, C: -1000
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
