import { useState, useEffect, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { useEvent, Event, Participant, AdvanceRecord } from '../hooks/useEvent'
import { calculateSettlements, Advance } from '../lib/settle'

export default function GuestJoin() {
  const { slug } = useParams<{ slug: string }>()
  const { fetchEventBySlug, fetchParticipants, fetchAdvances, addAdvance } = useEvent()

  const [event, setEvent] = useState<Event | null>(null)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [advances, setAdvances] = useState<AdvanceRecord[]>([])
  const [loading, setLoading] = useState(true)

  // 立替フォーム
  const [payerName, setPayerName] = useState('')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [splitAll, setSplitAll] = useState(true)
  const [targetNames, setTargetNames] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const participantNames = useMemo(() => participants.map((p) => p.name), [participants])

  // 精算計算
  const settlements = useMemo(() => {
    if (advances.length === 0 || participantNames.length === 0) return []
    const advs: Advance[] = advances.map((a) => ({
      payerName: a.payer_name,
      amount: a.amount,
      splitTarget: a.split_target as 'all' | 'specific',
      targetNames: a.target_names ?? undefined,
    }))
    return calculateSettlements(advs, participantNames)
  }, [advances, participantNames])

  useEffect(() => {
    if (!slug) return
    fetchEventBySlug(slug).then(async ({ data: ev }) => {
      if (!ev) { setLoading(false); return }
      setEvent(ev)
      const [partRes, advRes] = await Promise.all([
        fetchParticipants(ev.id),
        fetchAdvances(ev.id),
      ])
      if (partRes.data) setParticipants(partRes.data)
      if (advRes.data) setAdvances(advRes.data)
      setLoading(false)
    })
  }, [slug])

  const toggleTarget = (name: string) => {
    setTargetNames((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    )
  }

  const selectAllTargets = () => {
    setTargetNames([...participantNames])
  }

  const handleSubmitAdvance = async () => {
    if (!event || !payerName || !amount) return
    setSubmitting(true)
    const { data: newAdv } = await addAdvance(event.id, {
      payer_name: payerName,
      amount: parseInt(amount),
      description: description || undefined,
      split_target: splitAll ? 'all' : 'specific',
      target_names: splitAll ? undefined : targetNames,
    })
    if (newAdv) {
      setAdvances((prev) => [...prev, newAdv])
      setPayerName('')
      setAmount('')
      setDescription('')
      setSplitAll(true)
      setTargetNames([])
      setSubmitted(true)
      setTimeout(() => setSubmitted(false), 2000)
    }
    setSubmitting(false)
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-green/30 border-t-green rounded-full animate-spin" />
      </div>
    )
  }

  if (!event) {
    return (
      <div className="flex-1 flex items-center justify-center text-sub text-sm">
        イベントが見つかりません
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {/* イベント情報 */}
      <div className="bg-green-light p-5 mx-4 mt-4 rounded-2xl">
        <div className="text-lg font-bold mb-3">{event.title}</div>
        {event.event_date && (
          <div className="flex items-center gap-2 text-sm text-sub mb-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            {event.event_date}
          </div>
        )}
        {event.venue_name && (
          <div className="flex items-center gap-2 text-sm text-sub mb-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
            {event.venue_name}{event.venue_address && `（${event.venue_address}）`}
          </div>
        )}
        {event.fee_per_person && (
          <div className="flex items-center gap-2 text-sm text-sub mb-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
            参加費：<strong className="font-inter text-[#1A1A1A]">¥{event.fee_per_person.toLocaleString()}</strong>
          </div>
        )}
        {event.memo && (
          <div className="flex items-center gap-2 text-sm text-sub">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            {event.memo}
          </div>
        )}
        <div className="text-xs text-sub mt-3 pt-3 border-t border-black/5">
          参加者：{participantNames.join('、') || 'なし'}
        </div>
      </div>

      {/* 立替え登録フォーム */}
      <div className="px-4 mt-6">
        <h2 className="text-base font-bold mb-3 flex items-center gap-2">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/></svg>
          立替えを登録する
        </h2>

        <div className="bg-white border border-border rounded-2xl p-4 space-y-3">
          {/* 支払った人 */}
          <div>
            <label className="text-xs font-semibold text-sub mb-1 block">支払った人</label>
            <input
              list="participant-names"
              value={payerName}
              onChange={(e) => setPayerName(e.target.value)}
              placeholder="名前を入力"
              className="w-full p-3 border border-border rounded-xl text-sm bg-gray-bg focus:outline-none focus:border-green"
            />
            <datalist id="participant-names">
              {participantNames.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          </div>

          {/* 金額 */}
          <div>
            <label className="text-xs font-semibold text-sub mb-1 block">金額（円）</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="3000"
              className="w-full p-3 border border-border rounded-xl text-sm bg-gray-bg focus:outline-none focus:border-green font-inter"
            />
          </div>

          {/* 内容 */}
          <div>
            <label className="text-xs font-semibold text-sub mb-1 block">内容</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="例: 二次会代、タクシー代"
              className="w-full p-3 border border-border rounded-xl text-sm bg-gray-bg focus:outline-none focus:border-green"
            />
          </div>

          {/* 割り勘対象 */}
          <div>
            <label className="text-xs font-semibold text-sub mb-1 block">割り勘対象</label>
            <div className="flex gap-2 mb-2">
              <button
                onClick={() => setSplitAll(true)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border-2 transition ${
                  splitAll ? 'border-green bg-green-light text-green-dark' : 'border-border text-sub'
                }`}
              >
                全員
              </button>
              <button
                onClick={() => { setSplitAll(false); selectAllTargets() }}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border-2 transition ${
                  !splitAll ? 'border-green bg-green-light text-green-dark' : 'border-border text-sub'
                }`}
              >
                選択する
              </button>
            </div>
            {!splitAll && (
              <div className="space-y-1">
                <button
                  onClick={selectAllTargets}
                  className="text-xs text-green-dark font-semibold mb-1 hover:underline"
                >
                  全員を選択
                </button>
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
              </div>
            )}
          </div>

          {/* 送信 */}
          <button
            onClick={handleSubmitAdvance}
            disabled={!payerName || !amount || submitting}
            className="w-full py-3.5 bg-green text-white font-bold rounded-xl disabled:opacity-40 disabled:cursor-not-allowed hover:bg-green-dark transition"
          >
            {submitting ? '登録中...' : submitted ? '登録しました！' : '立替えを登録する'}
          </button>
        </div>
      </div>

      {/* 立替え一覧 */}
      {advances.length > 0 && (
        <div className="px-4 mt-6">
          <h2 className="text-base font-bold mb-3 flex items-center gap-2">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
            立替え一覧（{advances.length}件）
          </h2>
          <div className="space-y-2">
            {advances.map((a) => (
              <div key={a.id} className="flex items-center gap-3 p-3 bg-white border border-border rounded-xl">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold">{a.payer_name}</div>
                  <div className="text-xs text-sub">
                    {a.description || '立替'} ・ {a.split_target === 'all' ? '全員で割り勘' : a.target_names?.join('、')}
                  </div>
                </div>
                <div className="font-inter text-sm font-bold text-green shrink-0">
                  ¥{a.amount.toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 精算結果 */}
      {advances.length > 0 && (
        <div className="px-4 mt-6 mb-8">
          <h2 className="text-base font-bold mb-3 flex items-center gap-2">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
            精算方法
          </h2>
          {settlements.length === 0 ? (
            <div className="text-center py-6 text-sub text-sm bg-gray-bg rounded-xl">
              精算は不要です（均等に立替済み）
            </div>
          ) : (
            <div className="space-y-2.5">
              {settlements.map((s, i) => {
                const payee = participants.find((p) => p.name === s.to && p.payment_method === 'paypay')
                return (
                  <div key={i} className="bg-white border border-border rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-1 text-sm">
                      <span className="font-semibold">{s.from}</span>
                      <span className="text-sub">→</span>
                      <span className="font-semibold">{s.to}</span>
                    </div>
                    <div className="font-inter text-xl font-extrabold text-green">
                      ¥{s.amount.toLocaleString()}
                    </div>
                    {payee?.paypay_phone && (
                      <div className="mt-1.5 text-xs text-sub flex items-center gap-1">
                        <img src="/kanji/app/img/paypay.jpg" alt="" width={16} height={16} className="rounded" />
                        PayPay: {payee.paypay_phone}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
