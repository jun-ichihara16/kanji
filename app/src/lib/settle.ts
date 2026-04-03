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
 * 最小精算アルゴリズム
 * 各人の収支（立替分 - 負担分）を計算し、
 * 最小回数の送金で精算できる組み合わせを返す
 */
export function calculateSettlements(
  advances: Advance[],
  participantNames: string[]
): Settlement[] {
  // 1. 各人の純収支（正=受け取り超過、負=支払い超過）を計算
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

    const share = Math.round(adv.amount / targets.length)

    // 立替払いした人は全額受け取り権あり
    balance[adv.payerName] = (balance[adv.payerName] ?? 0) + adv.amount

    // 対象者は均等負担
    for (const name of targets) {
      balance[name] = (balance[name] ?? 0) - share
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
