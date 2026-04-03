import { useState } from 'react'
import { Participant } from '../hooks/useEvent'

export default function PayPayList({ participants }: { participants: Participant[] }) {
  const [open, setOpen] = useState(false)
  const paypayUsers = participants.filter((p) => p.payment_method === 'paypay' && p.paypay_phone)

  if (paypayUsers.length === 0) return null

  const copyAll = () => {
    const text = paypayUsers.map((p) => `${p.name}: ${p.paypay_phone}`).join('\n')
    navigator.clipboard.writeText(text)
  }

  return (
    <div className="mb-4">
      <button
        onClick={() => setOpen(!open)}
        className="w-full py-3.5 border-2 border-green rounded-xl bg-green-light text-green-dark text-sm font-bold flex items-center justify-center gap-2"
      >
        <img src="/kanji/app/img/paypay.jpg" alt="PayPay" width={24} height={24} className="rounded" />
        PayPay番号をまとめて見る
        <span className="text-xs">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="mt-2 bg-gray-bg rounded-xl overflow-hidden">
          {paypayUsers.map((p) => (
            <div
              key={p.id}
              className="flex justify-between items-center px-4 py-3 border-b border-border last:border-none"
            >
              <span className="text-sm font-semibold">{p.name}</span>
              <span className="font-inter text-sm text-sub">{p.paypay_phone}</span>
            </div>
          ))}
          <button
            onClick={copyAll}
            className="w-full py-2.5 text-xs font-semibold text-green-dark hover:bg-green/5 transition"
          >
            すべてコピー
          </button>
        </div>
      )}
    </div>
  )
}
