import { useState } from 'react'
import { Settlement } from '../lib/settle'
import { Participant } from '../hooks/useEvent'

export default function SettlementList({
  settlements,
  participants,
}: {
  settlements: Settlement[]
  participants: Participant[]
}) {
  const [settledMap, setSettledMap] = useState<Record<string, boolean>>({})

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

  const getMethod = (name: string) => {
    const p = participants.find((pp) => pp.name === name)
    return p?.payment_method || 'cash'
  }

  const toggleSettled = (key: string) => {
    setSettledMap((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const settledCount = Object.values(settledMap).filter(Boolean).length

  const copyAll = () => {
    const text = settlements
      .map((s) => `${s.from} → ${s.to}: ¥${s.amount.toLocaleString()}${settledMap[`${s.from}-${s.to}`] ? ' ✅' : ''}`)
      .join('\n')
    navigator.clipboard.writeText(text)
  }

  return (
    <div>
      {/* 精算進捗 */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-sub">精算進捗</span>
        <span className="text-xs font-semibold">
          <span className="text-green">{settledCount}</span> / {settlements.length} 件完了
        </span>
      </div>
      <div className="h-1.5 bg-border rounded-full mb-4 overflow-hidden">
        <div className="h-full bg-green rounded-full transition-all" style={{ width: `${settlements.length > 0 ? (settledCount / settlements.length) * 100 : 0}%` }} />
      </div>

      <div className="space-y-2.5 mb-4">
        {settlements.map((s, i) => {
          const key = `${s.from}-${s.to}`
          const isSettled = !!settledMap[key]
          const method = getMethod(s.to)
          return (
            <div
              key={i}
              className={`bg-white border rounded-xl p-4 transition ${isSettled ? 'border-green/30 bg-green-light/30' : 'border-border'}`}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-semibold">{s.from}</span>
                  <span className="text-sub">→</span>
                  <span className="font-semibold">{s.to}</span>
                </div>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isSettled}
                    onChange={() => toggleSettled(key)}
                    className="w-4 h-4 accent-green"
                  />
                  <span className={`text-xs font-semibold ${isSettled ? 'text-green' : 'text-sub'}`}>
                    {isSettled ? '精算済み' : '未精算'}
                  </span>
                </label>
              </div>
              <div className={`font-inter text-xl font-extrabold ${isSettled ? 'text-sub line-through' : 'text-green'}`}>
                ¥{s.amount.toLocaleString()}
              </div>
              <div className="mt-1 text-xs text-sub">
                {method === 'paypay' && getPayPay(s.to) && (
                  <span className="flex items-center gap-1">
                    <img src="/kanji/app/img/paypay.jpg" alt="" width={12} height={12} className="rounded" />
                    PayPay: {getPayPay(s.to)}
                  </span>
                )}
                {method === 'cash' && '💴 現金で支払い'}
                {method === 'bank' && '🏦 銀行振込'}
              </div>
            </div>
          )
        })}
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
