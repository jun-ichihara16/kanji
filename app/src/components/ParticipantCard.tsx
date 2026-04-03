const AVATAR_COLORS = [
  '#22C55E', '#3B82F6', '#F97316', '#EF4444',
  '#8B5CF6', '#EC4899', '#14B8A6', '#F59E0B',
]

function getColor(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

export default function ParticipantCard({
  name,
  paymentMethod,
  isPaid,
  paypayPhone,
  onTogglePaid,
  onRemind,
}: {
  name: string
  paymentMethod: string
  isPaid: boolean
  paypayPhone?: string | null
  onTogglePaid?: () => void
  onRemind?: () => void
}) {
  const methodLabel = paymentMethod === 'paypay' ? 'PayPay' : paymentMethod === 'bank' ? '銀行振込' : '現金'

  return (
    <div className="flex items-center gap-3 p-3 bg-white border border-border rounded-xl">
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
        style={{ background: getColor(name) }}
      >
        {name.charAt(0)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold truncate">{name}</div>
        <div className="text-[11px] text-sub">
          {methodLabel}
          {paypayPhone && ` (${paypayPhone})`}
        </div>
      </div>
      <span
        className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full cursor-pointer select-none ${
          isPaid
            ? 'bg-green-light text-green-dark'
            : 'bg-amber-50 text-amber-700'
        }`}
        onClick={onTogglePaid}
      >
        {isPaid ? '支払い済み' : '未払い'}
      </span>
      {!isPaid && onRemind && (
        <button
          onClick={onRemind}
          className="shrink-0 text-[11px] px-2.5 py-1.5 bg-green-light text-green-dark rounded-lg font-semibold hover:bg-green/10 transition"
        >
          リマインド
        </button>
      )}
    </div>
  )
}
