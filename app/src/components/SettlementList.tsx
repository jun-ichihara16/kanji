import { Settlement } from '../lib/settle'
import { Participant } from '../hooks/useEvent'

export default function SettlementList({
  settlements,
  participants,
}: {
  settlements: Settlement[]
  participants: Participant[]
}) {
  if (settlements.length === 0) {
    return (
      <div className="text-center py-8 text-sub text-sm">
        精算は不要です（全員均等に立替済み）
      </div>
    )
  }

  const getPayPay = (name: string) => {
    const p = participants.find((pp) => pp.name === name && pp.payment_method === 'paypay')
    return p?.paypay_phone
  }

  const copyAll = () => {
    const text = settlements
      .map(
        (s) =>
          `${s.from}さん → ${s.to}さん: ¥${s.amount.toLocaleString()}`
      )
      .join('\n')
    navigator.clipboard.writeText(text)
  }

  return (
    <div>
      <div className="space-y-2.5 mb-4">
        {settlements.map((s, i) => (
          <div
            key={i}
            className="bg-white border border-border rounded-xl p-4"
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="font-semibold text-sm">{s.from}</span>
              <span className="text-sub text-xs">→</span>
              <span className="font-semibold text-sm">{s.to}</span>
            </div>
            <div className="font-inter text-xl font-extrabold text-green">
              ¥{s.amount.toLocaleString()}
            </div>
            {getPayPay(s.to) && (
              <div className="mt-1.5 text-xs text-sub flex items-center gap-1">
                <img src="/kanji/app/img/paypay.jpg" alt="" width={16} height={16} className="rounded" />
                PayPay: {getPayPay(s.to)}
              </div>
            )}
          </div>
        ))}
      </div>

      <button
        onClick={copyAll}
        className="w-full py-3 border-2 border-green text-green-dark font-bold rounded-xl text-sm hover:bg-green-light transition flex items-center justify-center gap-2"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
        </svg>
        精算結果をコピー
      </button>
    </div>
  )
}
