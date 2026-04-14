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

// 傾斜機能用: 参加者の負担プロファイル
export interface SplitProfile {
  name: string
  weight: number              // 1.0 = 均等割相当
  fixed_amount: number | null // 非NULLで指定時は固定
}

export type SplitMode = 'equal' | 'ai_mild' | 'ai_strict' | 'manual'

// =======================================================
// ヘルパー: ウェイト+固定金額ベースの負担額配分（厳密端数処理）
// =======================================================
/**
 * 立替額 `totalAmount` を、対象者の weight / fixed_amount に従って
 * 1円単位で配分する。合計が元の立替額と 1 円も狂わないように
 * 端数を最大負担者に寄せる。
 *
 * @returns Record<name, share> 各人の負担額
 */
export function allocateShares(
  totalAmount: number,
  profiles: SplitProfile[]
): Record<string, number> {
  const shares: Record<string, number> = {}
  if (profiles.length === 0 || totalAmount <= 0) {
    for (const p of profiles) shares[p.name] = 0
    return shares
  }

  // 1. fixed_amount を先に確保
  let fixedTotal = 0
  const flexible: SplitProfile[] = []
  for (const p of profiles) {
    if (p.fixed_amount != null) {
      shares[p.name] = Math.max(0, Math.floor(p.fixed_amount))
      fixedTotal += shares[p.name]
    } else {
      flexible.push(p)
    }
  }

  // 2. 残額をウェイトで按分
  const remaining = totalAmount - fixedTotal
  if (remaining <= 0) {
    // fixed で既に totalAmount を超過/一致してる場合
    for (const p of flexible) shares[p.name] = 0
    return shares
  }

  const weightSum = flexible.reduce((acc, p) => acc + (p.weight || 0), 0)
  if (weightSum <= 0) {
    // 全員 weight=0 の場合は fixed 組のみ。余剰が出るが按分不可。
    for (const p of flexible) shares[p.name] = 0
    return shares
  }

  // 3. floor で按分
  for (const p of flexible) {
    shares[p.name] = Math.floor((remaining * p.weight) / weightSum)
  }

  // 4. 端数調整: 合計を正確に totalAmount に合わせる
  const currentTotal = Object.values(shares).reduce((a, b) => a + b, 0)
  let diff = totalAmount - currentTotal

  if (diff > 0) {
    // 負担が大きい人から順に1円ずつ追加
    // flexible の中で負担額降順 → weight降順 の順に加算
    const sorted = [...flexible].sort((a, b) => {
      const sa = shares[a.name] ?? 0
      const sb = shares[b.name] ?? 0
      if (sb !== sa) return sb - sa
      return (b.weight || 0) - (a.weight || 0)
    })
    let i = 0
    while (diff > 0 && sorted.length > 0) {
      shares[sorted[i % sorted.length].name] += 1
      diff -= 1
      i += 1
    }
  } else if (diff < 0) {
    // 逆のケース（floor しか使っていないので原則起きないが保険）
    const sorted = [...flexible].sort((a, b) => {
      const sa = shares[a.name] ?? 0
      const sb = shares[b.name] ?? 0
      return sb - sa
    })
    let i = 0
    while (diff < 0 && sorted.length > 0) {
      const n = sorted[i % sorted.length].name
      if (shares[n] > 0) {
        shares[n] -= 1
        diff += 1
      }
      i += 1
      if (i > sorted.length * 10000) break // 異常系回避
    }
  }

  return shares
}

/**
 * 最小精算アルゴリズム（ウェイト/固定金額対応版）
 *
 * @param advances 立替金リスト
 * @param participantNames 参加者名リスト
 * @param profiles ウェイトと固定金額（省略時は全員 weight=1, fixed=null）
 */
export function calculateSettlements(
  advances: Advance[],
  participantNames: string[],
  profiles?: SplitProfile[]
): Settlement[] {
  if (advances.length === 0 || participantNames.length === 0) return []

  // profiles 未指定時は均等割（全員 weight=1.0, fixed=null）
  const profileMap: Record<string, SplitProfile> = {}
  for (const name of participantNames) {
    profileMap[name] = { name, weight: 1.0, fixed_amount: null }
  }
  if (profiles) {
    for (const p of profiles) {
      if (profileMap[p.name]) {
        profileMap[p.name] = {
          name: p.name,
          weight: p.weight,
          fixed_amount: p.fixed_amount,
        }
      }
    }
  }

  // 1. 各人の純収支を計算
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

    // 立替者は全額受け取り
    balance[adv.payerName] = (balance[adv.payerName] ?? 0) + adv.amount

    // 対象者のプロファイルで配分
    const targetProfiles = targets.map((n) => profileMap[n] ?? {
      name: n, weight: 1.0, fixed_amount: null,
    })
    const shares = allocateShares(adv.amount, targetProfiles)

    for (const name of targets) {
      balance[name] = (balance[name] ?? 0) - (shares[name] ?? 0)
    }
  }

  // 2. 最小精算（greedy法）
  const creditors: { name: string; amount: number }[] = []
  const debtors: { name: string; amount: number }[] = []

  for (const [name, bal] of Object.entries(balance)) {
    if (bal > 0) creditors.push({ name, amount: bal })
    else if (bal < 0) debtors.push({ name, amount: -bal })
  }

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

// =======================================================
// AI提案ロジック（タグ → weight/fixed_amount のヒューリスティック）
// =======================================================

/**
 * タグ配列を受け取り、指定モードでの推奨 weight / fixed_amount を返す。
 * 複数タグが付いた場合は「最も強い補正」を優先して適用する
 * （主役＞遅刻早退＞女性/若手＞上司 の順でpriorityを決める）。
 */
export function suggestSplitFromTags(
  tags: string[],
  mode: 'ai_mild' | 'ai_strict'
): { weight: number; fixed_amount: number | null } {
  // 主役は必ず 0円固定
  if (tags.includes('主役')) {
    return { weight: 0, fixed_amount: 0 }
  }

  const preset = mode === 'ai_strict'
    ? {
        '遅刻/早退': 0.3,
        '女性':       0.7,
        '若手/後輩':  0.7,
        '上司/先輩':  1.5,
      }
    : {
        '遅刻/早退': 0.5,
        '女性':       0.8,
        '若手/後輩':  0.8,
        '上司/先輩':  1.2,
      }

  // 補正係数の掛け合わせ
  let weight = 1.0
  let applied = false
  for (const tag of tags) {
    const factor = (preset as Record<string, number>)[tag]
    if (factor != null) {
      weight *= factor
      applied = true
    }
  }

  if (!applied) return { weight: 1.0, fixed_amount: null }
  return { weight, fixed_amount: null }
}

/**
 * モード別に全参加者の推奨プロファイルを返す
 */
export function buildSuggestedProfiles(
  participants: { name: string; tags: string[] }[],
  mode: SplitMode
): SplitProfile[] {
  if (mode === 'equal' || mode === 'manual') {
    return participants.map((p) => ({
      name: p.name,
      weight: 1.0,
      fixed_amount: null,
    }))
  }
  return participants.map((p) => {
    const s = suggestSplitFromTags(p.tags, mode)
    return { name: p.name, weight: s.weight, fixed_amount: s.fixed_amount }
  })
}
