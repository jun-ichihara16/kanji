export interface Advance {
  payerName: string
  amount: number
  splitTarget: 'all' | 'specific'
  targetNames?: string[]
}

export interface Settlement {
  from: string
  to: string
  amount: number
}

/**
 * 最小精算アルゴリズム（端数処理改善版）
 * 各人の収支（立替分 - 負担分）を計算し、
 * 最小回数の送金で精算できる組み合わせを返す
 */
export function calculateSettlements(
  advances: Advance[],
  participantNames: string[]
): Settlement[] {
  if (advances.length === 0 || participantNames.length === 0) return []

  // 1. 各人の純収支を計算（正=受け取り超過、負=支払い超過）
  const balance: Record<string, number> = {}
  participantNames.forEach((name) => {
    balance[name] = 0
  })

  for (const adv of advances) {
    const targets =
      adv.splitTarget === 'all'
        ? participantNames
        : (adv.targetNames ?? [])
    if (targets.length === 0) continue

    // 端数処理: floor で均等割りし、余りを最初の対象者に寄せる
    const baseShare = Math.floor(adv.amount / targets.length)
    const remainder = adv.amount - baseShare * targets.length

    // 立替払いした人は全額受け取り権あり
    balance[adv.payerName] = (balance[adv.payerName] ?? 0) + adv.amount

    // 対象者は均等負担（余りは最初の人が負担）
    for (let i = 0; i < targets.length; i++) {
      const share = baseShare + (i < remainder ? 1 : 0)
      balance[targets[i]] = (balance[targets[i]] ?? 0) - share
    }
  }

  // 2. 最小精算（greedy法）
  const creditors: { name: string; amount: number }[] = []
  const debtors: { name: string; amount: number }[] = []

  for (const [name, bal] of Object.entries(balance)) {
    if (bal > 0) creditors.push({ name, amount: bal })
    else if (bal < 0) debtors.push({ name, amount: -bal })
  }

  // 金額が大きい順にソート
  creditors.sort((a, b) => b.amount - a.amount)
  debtors.sort((a, b) => b.amount - a.amount)

  const settlements: Settlement[] = []
  let ci = 0
  let di = 0

  while (ci < creditors.length && di < debtors.length) {
    const credit = creditors[ci]
    const debt = debtors[di]
    const amount = Math.min(credit.amount, debt.amount)

    if (amount > 0) {
      settlements.push({ from: debt.name, to: credit.name, amount })
    }

    credit.amount -= amount
    debt.amount -= amount
    if (credit.amount === 0) ci++
    if (debt.amount === 0) di++
  }

  return settlements
}
