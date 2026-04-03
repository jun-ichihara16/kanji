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

      {/* Split target */}
      <div className="mb-3">
        <label className="text-xs font-semibold text-sub mb-1 block">対象者</label>
        <div className="flex gap-2 mb-2">
          <button
            onClick={() => setSplitTarget('all')}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border-2 transition ${
              splitTarget === 'all'
                ? 'border-green bg-green-light text-green-dark'
                : 'border-border text-sub'
            }`}
          >
            全員
          </button>
          <button
            onClick={() => setSplitTarget('specific')}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border-2 transition ${
              splitTarget === 'specific'
                ? 'border-green bg-green-light text-green-dark'
                : 'border-border text-sub'
            }`}
          >
            特定の人
          </button>
        </div>
        {splitTarget === 'specific' && (
          <div className="flex flex-wrap gap-1.5">
            {participantNames.map((n) => (
              <button
                key={n}
                onClick={() => toggleTarget(n)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
                  targetNames.includes(n)
                    ? 'bg-green text-white border-green'
                    : 'bg-gray-bg text-sub border-border'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
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
