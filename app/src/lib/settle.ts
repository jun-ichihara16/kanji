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

  // 0. weight/fixed_amount を number に正規化（Supabase numeric が文字列で返るケースの保険）
  const safe: SplitProfile[] = profiles.map((p) => {
    const w = typeof p.weight === 'number' ? p.weight : Number(p.weight)
    const fa = p.fixed_amount
    return {
      name: p.name,
      weight: Number.isFinite(w) ? w : 0,
      fixed_amount: fa == null ? null : (typeof fa === 'number' ? fa : Number(fa)),
    }
  })

  // 1. fixed_amount を先に確保
  let fixedTotal = 0
  const flexible: SplitProfile[] = []
  for (const p of safe) {
    if (p.fixed_amount != null && Number.isFinite(p.fixed_amount)) {
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
 * 主役は最優先で fixed_amount=0。それ以外のタグは weight 係数を掛け合わせる。
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
        '女性':       0.7,
        '若手/後輩':  0.7,
        '上司/先輩':  1.5,
      }
    : {
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

// =======================================================
// イベント作成フロー改修（007）用ヘルパー
// =======================================================

export type RoundingRule = 'floor' | 'round' | 'ceil'
export type SettlementType =
  | 'equal_split'
  | 'weighted_split'
  | 'reimbursement_split'

/**
 * 端数処理を1円単位で適用する。
 * round は半数切り上げ（Math.round）。
 */
export function applyRounding(value: number, rule: RoundingRule): number {
  if (!Number.isFinite(value)) return 0
  switch (rule) {
    case 'floor':
      return Math.floor(value)
    case 'ceil':
      return Math.ceil(value)
    case 'round':
    default:
      return Math.round(value)
  }
}

export interface EqualSplitInput {
  totalAmount: number
  memberNames: string[] // 対象メンバー（除外済み）
  rounding: RoundingRule
}

export interface EqualSplitResult {
  perPerson: number // 端数処理後の1人あたり金額
  shares: Record<string, number> // 端数調整後の各人金額（合計 = totalAmount）
  remainder: number // 端数として吸収された差分（1人あたり計算後 → 合計調整前）
}

/**
 * equal_split: 全員ほぼ同じ金額で精算
 * - 1人あたり金額に rounding を適用
 * - 合計が totalAmount に一致するよう、最後に端数を1円単位で調整
 */
export function calcEqualSplit(input: EqualSplitInput): EqualSplitResult {
  const { totalAmount, memberNames, rounding } = input
  const shares: Record<string, number> = {}
  if (memberNames.length === 0 || totalAmount <= 0) {
    for (const n of memberNames) shares[n] = 0
    return { perPerson: 0, shares, remainder: 0 }
  }

  const perPersonRaw = totalAmount / memberNames.length
  const perPerson = applyRounding(perPersonRaw, rounding)

  for (const n of memberNames) shares[n] = perPerson

  // 合計を totalAmount に一致させるため端数を再分配
  const currentTotal = perPerson * memberNames.length
  let diff = totalAmount - currentTotal
  let i = 0
  while (diff > 0 && memberNames.length > 0) {
    shares[memberNames[i % memberNames.length]] += 1
    diff -= 1
    i += 1
  }
  while (diff < 0 && memberNames.length > 0) {
    const name = memberNames[i % memberNames.length]
    if (shares[name] > 0) {
      shares[name] -= 1
      diff += 1
    }
    i += 1
    if (i > memberNames.length * 10000) break
  }

  return { perPerson, shares, remainder: totalAmount - perPerson * memberNames.length }
}

export interface WeightedMember {
  name: string
  weight: number
  fixed_amount: number | null
}

export interface WeightedSplitInput {
  totalAmount: number
  members: WeightedMember[] // 対象メンバー
  rounding: RoundingRule
}

export interface WeightedSplitResult {
  shares: Record<string, number>
  expectedTotal: number // = totalAmount
  actualTotal: number // 実際の合計
  mismatch: boolean // 整合してない場合 true
}

/**
 * weighted_split: 重み付きで金額に差をつける
 * 既存 allocateShares() を流用しつつ、整合チェックを返す。
 * rounding は最終調整に直接は使わない（allocateShares が常に1円単位で完全一致させる）。
 * ただし将来の拡張のために I/F は受け取る。
 */
export function calcWeightedSplit(input: WeightedSplitInput): WeightedSplitResult {
  const { totalAmount, members } = input
  const profiles: SplitProfile[] = members.map((m) => ({
    name: m.name,
    weight: m.weight,
    fixed_amount: m.fixed_amount,
  }))
  const shares = allocateShares(totalAmount, profiles)
  const actualTotal = Object.values(shares).reduce((a, b) => a + b, 0)
  return {
    shares,
    expectedTotal: totalAmount,
    actualTotal,
    mismatch: totalAmount > 0 && actualTotal !== totalAmount,
  }
}

export interface ReimbursementSplitInput {
  advances: Advance[]
  participantNames: string[]
  // weighted profiles を併用したい場合に渡す
  profiles?: SplitProfile[]
}

export interface ReimbursementSplitResult {
  settlements: Settlement[] // 誰が誰にいくら払うか（最小精算）
  balances: Record<string, number> // 各人の純収支
}

/**
 * reimbursement_split: 立替分を最後にまとめて精算
 * 既存 calculateSettlements を流用しつつ、各人の純収支も返す。
 */
export function calcReimbursementSplit(input: ReimbursementSplitInput): ReimbursementSplitResult {
  const { advances, participantNames, profiles } = input
  const settlements = calculateSettlements(advances, participantNames, profiles)

  // 純収支（プレビュー用）
  const balance: Record<string, number> = {}
  for (const n of participantNames) balance[n] = 0
  for (const adv of advances) {
    const targets =
      adv.splitTarget === 'all'
        ? participantNames
        : (adv.targetNames ?? [])
    if (targets.length === 0) continue
    balance[adv.payerName] = (balance[adv.payerName] ?? 0) + adv.amount
    const targetProfiles: SplitProfile[] = targets.map((n) => {
      const found = profiles?.find((p) => p.name === n)
      return found ?? { name: n, weight: 1.0, fixed_amount: null }
    })
    const shares = allocateShares(adv.amount, targetProfiles)
    for (const n of targets) {
      balance[n] = (balance[n] ?? 0) - (shares[n] ?? 0)
    }
  }
  return { settlements, balances: balance }
}
