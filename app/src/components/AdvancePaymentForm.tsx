import { useState } from 'react'

export default function AdvancePaymentForm({
  participantNames,
  onSubmit,
}: {
  participantNames: string[]
  onSubmit: (data: {
    payer_name: string
    amount: number
    description: string
    split_target: string
    target_names: string[]
  }) => void
}) {
  const [payerName, setPayerName] = useState('')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [splitTarget, setSplitTarget] = useState<'all' | 'specific'>('all')
  const [targetNames, setTargetNames] = useState<string[]>([])

  const toggleTarget = (name: string) => {
    setTargetNames((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    )
  }

  const handleSubmit = () => {
    if (!payerName || !amount) return
    onSubmit({
      payer_name: payerName,
      amount: parseInt(amount),
      description,
      split_target: splitTarget,
      target_names: splitTarget === 'all' ? [] : targetNames,
    })
    setPayerName('')
    setAmount('')
    setDescription('')
    setSplitTarget('all')
    setTargetNames([])
  }

  return (
    <div className="bg-white border border-border rounded-2xl p-4 mb-4">
      <h3 className="text-sm font-bold mb-3">立替を登録</h3>

      {/* Payer */}
      <div className="mb-3">
        <label className="text-xs font-semibold text-sub mb-1 block">立替者</label>
        <select
          value={payerName}
          onChange={(e) => setPayerName(e.target.value)}
          className="w-full p-3 border border-border rounded-xl text-sm bg-gray-bg focus:outline-none focus:border-green"
        >
          <option value="">選択してください</option>
          {participantNames.map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      </div>

      {/* Description */}
      <div className="mb-3">
        <label className="text-xs font-semibold text-sub mb-1 block">何の支払い？</label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="例: 二次会代、タクシー代"
          className="w-full p-3 border border-border rounded-xl text-sm bg-gray-bg focus:outline-none focus:border-green"
        />
      </div>

      {/* Amount */}
      <div className="mb-3">
        <label className="text-xs font-semibold text-sub mb-1 block">金額（円）</label>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="3000"
          className="w-full p-3 border border-border rounded-xl text-sm bg-gray-bg focus:outline-none focus:border-green font-inter"
        />
      </div>

      {/* Split target */}
      <div className="mb-3">
        <label className="text-xs font-semibold text-sub mb-1 block">対象者</label>
        <label className="flex items-center gap-2 p-3 bg-white border border-border rounded-xl mb-2 cursor-pointer">
          <input
            type="checkbox"
            checked={splitTarget === 'all'}
            onChange={() => { setSplitTarget('all'); setTargetNames([]) }}
            className="w-4 h-4 accent-green"
          />
          <span className="text-sm font-semibold">全員で割り勘</span>
        </label>
        <div className="grid grid-cols-2 gap-1.5">
          {participantNames.map((n) => (
            <label key={n} className="flex items-center gap-2 p-2.5 bg-white border border-border rounded-xl cursor-pointer hover:border-green/50 transition">
              <input
                type="checkbox"
                checked={splitTarget === 'all' || targetNames.includes(n)}
                onChange={() => {
                  if (splitTarget === 'all') {
                    const others = participantNames.filter((x) => x !== n)
                    setSplitTarget('specific')
                    setTargetNames(others)
                  } else {
                    toggleTarget(n)
                  }
                }}
                className="w-4 h-4 accent-green shrink-0"
              />
              <span className={`text-sm truncate ${splitTarget === 'all' ? 'text-sub' : 'font-medium'}`}>{n}</span>
            </label>
          ))}
        </div>
        {splitTarget === 'specific' && targetNames.length > 0 && (
          <p className="text-xs text-sub mt-1.5">{targetNames.length}人選択中</p>
        )}
      </div>

      <button
        onClick={handleSubmit}
        disabled={!payerName || !amount}
        className="w-full py-3.5 bg-green text-white font-bold rounded-xl mt-2 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-green-dark transition"
      >
        立替を登録する
      </button>
    </div>
  )
}
