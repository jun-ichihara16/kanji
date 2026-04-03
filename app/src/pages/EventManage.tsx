import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useEvent, Event, Participant, AdvanceRecord } from '../hooks/useEvent'
import { calculateSettlements, Settlement, Advance } from '../lib/settle'
import ParticipantCard from '../components/ParticipantCard'
import SummaryCard from '../components/SummaryCard'
import PayPayList from '../components/PayPayList'
import AdvancePaymentForm from '../components/AdvancePaymentForm'
import SettlementList from '../components/SettlementList'

const TABS = ['参加者', 'PayPay', '立替', '精算'] as const

export default function EventManage() {
  const { id } = useParams<{ id: string }>()
  const {
    fetchEventById, fetchParticipants, togglePaid,
    fetchAdvances, addAdvance, deleteAdvance,
  } = useEvent()

  const [event, setEvent] = useState<Event | null>(null)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [advances, setAdvances] = useState<AdvanceRecord[]>([])
  const [settlements, setSettlements] = useState<Settlement[]>([])
  const [activeTab, setActiveTab] = useState<typeof TABS[number]>('参加者')
  const [loading, setLoading] = useState(true)

  const load = async () => {
    if (!id) return
    const [evRes, partRes, advRes] = await Promise.all([
      fetchEventById(id),
      fetchParticipants(id),
      fetchAdvances(id),
    ])
    if (evRes.data) setEvent(evRes.data)
    if (partRes.data) setParticipants(partRes.data)
    if (advRes.data) setAdvances(advRes.data)
    setLoading(false)
  }

  useEffect(() => { load() }, [id])

  const handleTogglePaid = async (p: Participant) => {
    await togglePaid(p.id, !p.is_paid)
    setParticipants((prev) =>
      prev.map((pp) => (pp.id === p.id ? { ...pp, is_paid: !pp.is_paid } : pp))
    )
  }

  const handleAddAdvance = async (data: {
    payer_name: string; amount: number; description: string;
    split_target: string; target_names: string[]
  }) => {
    if (!id) return
    const { data: newAdv } = await addAdvance(id, data)
    if (newAdv) setAdvances((prev) => [...prev, newAdv])
  }

  const handleDeleteAdvance = async (advId: string) => {
    await deleteAdvance(advId)
    setAdvances((prev) => prev.filter((a) => a.id !== advId))
  }

  const handleCalculate = () => {
    const advs: Advance[] = advances.map((a) => ({
      payerName: a.payer_name,
      amount: a.amount,
      splitTarget: a.split_target as 'all' | 'specific',
      targetNames: a.target_names ?? undefined,
    }))
    const names = participants.map((p) => p.name)
    setSettlements(calculateSettlements(advs, names))
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-green/30 border-t-green rounded-full animate-spin" />
      </div>
    )
  }

  if (!event) {
    return <div className="flex-1 flex items-center justify-center text-sub text-sm">イベントが見つかりません</div>
  }

  const paidCount = participants.filter((p) => p.is_paid).length
  const shareUrl = `${window.location.origin}/kanji/app/e/${event.slug}`

  return (
    <div className="flex-1 flex flex-col">
      {/* Event title */}
      <div className="px-4 pt-4 pb-2">
        <h2 className="text-lg font-bold">{event.title}</h2>
        {event.event_date && <p className="text-xs text-sub mt-0.5">{event.event_date}</p>}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-2 px-4 mb-3">
        <SummaryCard value={participants.length} label="参加者" />
        <SummaryCard value={paidCount} label="支払い済み" color="#22C55E" />
        <SummaryCard value={participants.length - paidCount} label="未払い" color="#F97316" />
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border px-2 sticky top-[53px] bg-white z-40">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-3 text-sm font-semibold border-b-[3px] transition ${
              activeTab === tab
                ? 'text-green border-green'
                : 'text-sub border-transparent'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* TAB: 参加者 */}
        {activeTab === '参加者' && (
          <>
            <div className="space-y-2 mb-4">
              {participants.map((p) => (
                <ParticipantCard
                  key={p.id}
                  name={p.name}
                  paymentMethod={p.payment_method}
                  isPaid={p.is_paid}
                  paypayPhone={p.paypay_phone}
                  onTogglePaid={() => handleTogglePaid(p)}
                />
              ))}
              {participants.length === 0 && (
                <p className="text-center py-8 text-sub text-sm">まだ参加者がいません</p>
              )}
            </div>
            <div className="bg-gray-bg rounded-xl p-3 mb-3">
              <p className="text-xs text-sub mb-2">参加者URL（LINEで共有）</p>
              <div className="flex gap-2">
                <span className="flex-1 font-inter text-[11px] text-[#1A1A1A] truncate bg-white border border-border rounded-lg px-2.5 py-2">
                  {shareUrl}
                </span>
                <button
                  onClick={() => navigator.clipboard.writeText(shareUrl)}
                  className="shrink-0 px-3 py-2 bg-green text-white text-xs font-semibold rounded-lg"
                >
                  コピー
                </button>
              </div>
            </div>
          </>
        )}

        {/* TAB: PayPay */}
        {activeTab === 'PayPay' && (
          <PayPayList participants={participants} />
        )}

        {/* TAB: 立替 */}
        {activeTab === '立替' && (
          <>
            <AdvancePaymentForm
              participantNames={participants.map((p) => p.name)}
              onSubmit={handleAddAdvance}
            />
            {advances.length > 0 && (
              <div>
                <h3 className="text-sm font-bold mb-2">登録済みの立替</h3>
                <div className="space-y-2">
                  {advances.map((a) => (
                    <div key={a.id} className="flex items-center gap-3 p-3 bg-white border border-border rounded-xl">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold">{a.payer_name}</div>
                        <div className="text-xs text-sub">
                          {a.description || '立替'} ・ {a.split_target === 'all' ? '全員' : a.target_names?.join(', ')}
                        </div>
                      </div>
                      <div className="font-inter text-sm font-bold text-green shrink-0">
                        ¥{a.amount.toLocaleString()}
                      </div>
                      <button
                        onClick={() => handleDeleteAdvance(a.id)}
                        className="shrink-0 text-xs text-red-400 hover:text-red-600"
                      >
                        削除
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* TAB: 精算 */}
        {activeTab === '精算' && (
          <>
            <button
              onClick={handleCalculate}
              className="w-full py-3.5 bg-green text-white font-bold rounded-xl mb-4 hover:bg-green-dark transition"
            >
              精算を計算する
            </button>
            {settlements.length > 0 || advances.length === 0 ? (
              <SettlementList settlements={settlements} participants={participants} />
            ) : (
              <p className="text-center text-sm text-sub py-8">
                「精算を計算する」をタップしてください
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
