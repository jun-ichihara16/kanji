/**
 * 参加者リスト上部に出すサマリー＋認証状態フィルタ。
 *
 * 例:「👥 8人中 5人がLINEログイン済み（62%）」
 *  + [すべて] [LINEログイン済み] [ゲストのみ] フィルタタブ
 *
 * 参加者が0人なら何も描画しない。
 */

export type AuthFilter = 'all' | 'line' | 'guest'

interface Props {
  total: number
  lineCount: number
  filter: AuthFilter
  onFilterChange: (next: AuthFilter) => void
  /** 参加者がいない時に既定値を出すかどうか（基本は非表示） */
  showWhenEmpty?: boolean
}

const TABS: { value: AuthFilter; label: string }[] = [
  { value: 'all', label: 'すべて' },
  { value: 'line', label: 'LINEログイン済み' },
  { value: 'guest', label: 'ゲストのみ' },
]

export default function ParticipantAuthSummary({
  total,
  lineCount,
  filter,
  onFilterChange,
  showWhenEmpty = false,
}: Props) {
  if (total === 0 && !showWhenEmpty) return null

  const percentage = total > 0 ? Math.round((lineCount / total) * 100) : 0

  return (
    <div className="bg-white border border-border rounded-xl p-3 mb-3">
      <div className="flex items-center gap-1.5 text-xs text-sub mb-2">
        <span aria-hidden="true">👥</span>
        <span>
          {total}人中 <span className="font-inter font-bold text-[#1A1A1A]">{lineCount}人</span> がLINEログイン済み
          <span className="font-inter ml-1">（{percentage}%）</span>
        </span>
      </div>
      <div className="flex gap-1">
        {TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => onFilterChange(t.value)}
            className={`text-[11px] px-2.5 py-1 rounded-full border font-semibold transition ${
              filter === t.value
                ? 'bg-green-light border-green text-green-dark'
                : 'bg-white border-border text-sub hover:border-green/50'
            }`}
            aria-pressed={filter === t.value}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  )
}
