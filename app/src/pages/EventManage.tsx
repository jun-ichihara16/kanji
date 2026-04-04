import { useState, useEffect, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { useEvent, Event, Participant, AdvanceRecord, SettlementRecord } from '../hooks/useEvent'
import { calculateSettlements, Settlement, Advance } from '../lib/settle'
import { supabase } from '../lib/supabase'
import ParticipantCard from '../components/ParticipantCard'
import SummaryCard from '../components/SummaryCard'
import PayPayList from '../components/PayPayList'
import AdvancePaymentForm from '../components/AdvancePaymentForm'
import SettlementList from '../components/SettlementList'

const TABS = ['参加者', '立替'] as const

export default function EventManage() {
  const { id } = useParams<{ id: string }>()
  const {
    fetchEventById, fetchParticipants, addParticipant, updateParticipantName, deleteParticipant, togglePaid,
    fetchAdvances, addAdvance, deleteAdvance, deleteEvent,
    fetchSettlements, upsertSettlement,
  } = useEvent()

  const [event, setEvent] = useState<Event | null>(null)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [advances, setAdvances] = useState<AdvanceRecord[]>([])
  const [settlements, setSettlements] = useState<Settlement[]>([])
  const [activeTab, setActiveTab] = useState<typeof TABS[number]>('参加者')
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [newPaypay, setNewPaypay] = useState('')
  const [addingParticipant, setAddingParticipant] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editPaypay, setEditPaypay] = useState('')
  const [editMethod, setEditMethod] = useState('cash')
  const [newPayMethod, setNewPayMethod] = useState('paypay')
  const [settledMap, setSettledMap] = useState<Record<string, boolean>>({})
  const [settlementRecords, setSettlementRecords] = useState<SettlementRecord[]>([])
  const [editingAdvId, setEditingAdvId] = useState<string | null>(null)
  const [editAdvAmount, setEditAdvAmount] = useState('')
  const [editAdvDesc, setEditAdvDesc] = useState('')

  const load = async () => {
    if (!id) return
    const [evRes, partRes, advRes, settRes] = await Promise.all([
      fetchEventById(id),
      fetchParticipants(id),
      fetchAdvances(id),
      fetchSettlements(id),
    ])
    if (evRes.data) setEvent(evRes.data)
    if (partRes.data) setParticipants(partRes.data)
    if (advRes.data) setAdvances(advRes.data)
    if (settRes.data) {
      setSettlementRecords(settRes.data)
      const map: Record<string, boolean> = {}
      settRes.data.forEach((s: SettlementRecord) => { map[`${s.from_name}-${s.to_name}`] = s.is_settled })
      setSettledMap(map)
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [id])

  // 自動精算計算
  const computedSettlements = useMemo(() => {
    if (advances.length === 0 || participants.length === 0) return []
    const advs: Advance[] = advances.map((a) => ({
      payerName: a.payer_name, amount: a.amount,
      splitTarget: a.split_target as 'all' | 'specific',
      targetNames: a.target_names ?? undefined,
    }))
    return calculateSettlements(advs, participants.map((p) => p.name))
  }, [advances, participants])

  const handleAddOne = async () => {
    if (!id || !newName.trim()) return
    setAddingParticipant(true)
    const { data: newP } = await addParticipant(id, {
      name: newName.trim(),
      payment_method: newPayMethod,
      paypay_phone: newPayMethod === 'paypay' ? newPaypay.trim() || undefined : undefined,
    })
    if (newP) {
      setParticipants((prev) => [...prev, newP])
      setNewName('')
      setNewPaypay('')
      setNewPayMethod('paypay')
    }
    setAddingParticipant(false)
  }

  const handleSaveEdit = async (p: Participant) => {
    if (!editName.trim()) { setEditingId(null); return }
    // 名前・PayPay・支払い方法を1回のUPDATEで保存
    const { error } = await supabase.from('participants').update({
      name: editName.trim(),
      payment_method: editMethod,
      paypay_phone: editMethod === 'paypay' ? editPaypay.trim() || null : null,
    }).eq('id', p.id)
    if (error) { console.error('Update error:', error); alert('更新エラー: ' + error.message); return }
    setParticipants((prev) =>
      prev.map((pp) => (pp.id === p.id ? {
        ...pp,
        name: editName.trim(),
        payment_method: editMethod,
        paypay_phone: editMethod === 'paypay' ? editPaypay.trim() || null : null,
      } : pp))
    )
    setEditingId(null)
  }

  const handleDelete = async (p: Participant) => {
    await deleteParticipant(p.id)
    setParticipants((prev) => prev.filter((pp) => pp.id !== p.id))
  }

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

  const handleSaveAdvance = async (a: AdvanceRecord) => {
    if (!editAdvAmount) { setEditingAdvId(null); return }
    await supabase.from('advances').update({
      amount: parseInt(editAdvAmount),
      description: editAdvDesc || null,
    }).eq('id', a.id)
    setAdvances((prev) => prev.map((ad) => ad.id === a.id ? {
      ...ad, amount: parseInt(editAdvAmount), description: editAdvDesc || null,
    } : ad))
    setEditingAdvId(null)
  }

  const handleDeleteAdvance = async (advId: string) => {
    await deleteAdvance(advId)
    setAdvances((prev) => prev.filter((a) => a.id !== advId))
  }

  const handleToggleSettled = async (fromName: string, toName: string, amount: number) => {
    if (!id) return
    const key = `${fromName}-${toName}`
    const newVal = !settledMap[key]
    setSettledMap((prev) => ({ ...prev, [key]: newVal }))
    await upsertSettlement(id, fromName, toName, amount, newVal)
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
      <div className="px-4 pt-4 pb-2 flex items-start justify-between">
        <div>
          <h2 className="text-lg font-bold">{event.title}</h2>
          {event.event_date && <p className="text-xs text-sub mt-0.5">{event.event_date}</p>}
        </div>
        <button
          onClick={async () => {
            if (!confirm(`「${event.title}」を削除しますか？`)) return
            await deleteEvent(event.id)
            window.location.href = '/kanji/app/dashboard'
          }}
          className="text-xs text-sub hover:text-red-500 transition mt-1"
        >
          削除
        </button>
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
            {/* 一名ずつ追加フォーム */}
            <div className="bg-white border border-border rounded-2xl p-4 mb-4">
              <h3 className="text-sm font-bold mb-3">参加者を追加</h3>
              <div className="space-y-2">
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="名前"
                  className="w-full p-3 border border-border rounded-xl text-sm bg-gray-bg focus:outline-none focus:border-green"
                  onKeyDown={(e) => { if (e.key === 'Enter' && newName.trim()) handleAddOne() }}
                />
                <div>
                  <label className="text-xs font-semibold text-sub mb-1 block">支払い方法</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[{ value: 'paypay', label: 'PayPay' }, { value: 'cash', label: '現金' }, { value: 'bank', label: '振込' }].map((m) => (
                      <button key={m.value} type="button" onClick={() => setNewPayMethod(m.value)}
                        className={`py-2 rounded-xl text-xs font-semibold border-2 transition ${newPayMethod === m.value ? 'border-green bg-green-light text-green-dark' : 'border-border text-sub'}`}>
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>
                {newPayMethod === 'paypay' && (
                  <input
                    value={newPaypay}
                    onChange={(e) => setNewPaypay(e.target.value)}
                    placeholder="PayPay番号 例: 09012345678"
                    className="w-full p-3 border border-border rounded-xl text-sm bg-gray-bg focus:outline-none focus:border-green font-inter"
                  />
                )}
              </div>
              <button
                onClick={handleAddOne}
                disabled={!newName.trim() || addingParticipant}
                className="w-full mt-3 py-3 bg-green text-white text-sm font-bold rounded-xl disabled:opacity-40 hover:bg-green-dark transition"
              >
                {addingParticipant ? '追加中...' : '追加する'}
              </button>
            </div>

            {/* 参加者リスト（編集・削除） */}
            <div className="space-y-2 mb-4">
              {participants.map((p) => (
                <div key={p.id} className="flex items-center gap-2 p-3 bg-white border border-border rounded-xl">
                  {editingId === p.id ? (
                    <div className="flex-1 space-y-2">
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder="名前"
                        className="w-full p-2 border border-green rounded-lg text-sm focus:outline-none"
                        autoFocus
                        onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEdit(p); if (e.key === 'Escape') setEditingId(null) }}
                      />
                      <div className="grid grid-cols-3 gap-1">
                        {[{ value: 'paypay', label: 'PayPay' }, { value: 'cash', label: '現金' }, { value: 'bank', label: '振込' }].map((m) => (
                          <button key={m.value} type="button" onClick={() => setEditMethod(m.value)}
                            className={`py-1.5 rounded-lg text-xs font-semibold border transition ${editMethod === m.value ? 'border-green bg-green-light text-green-dark' : 'border-border text-sub'}`}>
                            {m.label}
                          </button>
                        ))}
                      </div>
                      {editMethod === 'paypay' && (
                        <input
                          value={editPaypay}
                          onChange={(e) => setEditPaypay(e.target.value)}
                          placeholder="PayPay番号"
                          className="w-full p-2 border border-border rounded-lg text-sm focus:outline-none focus:border-green font-inter"
                        />
                      )}
                      <div className="flex gap-2">
                        <button onClick={() => handleSaveEdit(p)} className="text-xs bg-green text-white font-bold px-3 py-1.5 rounded-lg">保存</button>
                        <button onClick={() => setEditingId(null)} className="text-xs text-sub px-3 py-1.5">取消</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold">{p.name}</div>
                        <div className="text-xs text-sub flex items-center gap-1 mt-0.5">
                          {p.payment_method === 'paypay' && <><img src="/kanji/app/img/paypay.jpg" alt="" width={12} height={12} className="rounded" /> <span className="font-inter">{p.paypay_phone || 'PayPay'}</span></>}
                          {p.payment_method === 'cash' && '💴 現金'}
                          {p.payment_method === 'bank' && '🏦 振込'}
                        </div>
                      </div>
                      <button
                        onClick={() => { setEditingId(p.id); setEditName(p.name); setEditPaypay(p.paypay_phone || ''); setEditMethod(p.payment_method) }}
                        className="shrink-0 text-xs text-sub hover:text-green transition px-1.5 py-1"
                      >
                        編集
                      </button>
                      <button
                        onClick={() => handleDelete(p)}
                        className="shrink-0 text-xs text-sub hover:text-red-500 transition px-1.5 py-1"
                      >
                        削除
                      </button>
                    </>
                  )}
                </div>
              ))}
              {participants.length === 0 && (
                <p className="text-center py-8 text-sub text-sm">まだ参加者がいません</p>
              )}
            </div>
            <div className="text-xs text-sub text-center mb-4">{participants.length}人 登録済み</div>

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

            {/* 精算状況サマリー（自動計算） */}
            {computedSettlements.length > 0 && (
              <div className="mt-4">
                <h3 className="text-sm font-bold mb-2">精算状況</h3>
                {(() => {
                  const settledCount = computedSettlements.filter((s) => settledMap[`${s.from}-${s.to}`]).length
                  return (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs text-sub mb-1">
                        <span>進捗</span>
                        <span><span className="text-green font-bold">{settledCount}</span> / {computedSettlements.length} 件完了</span>
                      </div>
                      <div className="h-1.5 bg-border rounded-full overflow-hidden mb-2">
                        <div className="h-full bg-green rounded-full transition-all" style={{ width: `${(settledCount / computedSettlements.length) * 100}%` }} />
                      </div>
                      {computedSettlements.map((s, i) => {
                        const key = `${s.from}-${s.to}`
                        const isSettled = !!settledMap[key]
                        const p = participants.find((pp) => pp.name === s.to)
                        return (
                          <div key={i} className={`flex items-center gap-2 p-3 rounded-xl border transition ${isSettled ? 'bg-gray-bg/50 border-border opacity-60' : 'bg-white border-border'}`}>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm"><span className="font-semibold">{s.from}</span> <span className="text-sub">→</span> <span className="font-semibold">{s.to}</span></div>
                              <div className="text-xs text-sub">
                                {p?.payment_method === 'paypay' && p.paypay_phone ? `PayPay: ${p.paypay_phone}` : p?.payment_method === 'bank' ? '振込' : '現金'}
                              </div>
                            </div>
                            <div className={`font-inter text-sm font-bold shrink-0 ${isSettled ? 'text-sub line-through' : 'text-green'}`}>
                              ¥{s.amount.toLocaleString()}
                            </div>
                            <button
                              onClick={() => handleToggleSettled(s.from, s.to, s.amount)}
                              className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full transition ${isSettled ? 'bg-gray-bg text-sub' : 'bg-green text-white'}`}
                            >
                              {isSettled ? '済み' : '完了'}
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )
                })()}
              </div>
            )}
          </>
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
                    <div key={a.id} className="bg-white border border-border rounded-xl p-3">
                      {editingAdvId === a.id ? (
                        <div className="space-y-2">
                          <div className="text-sm font-semibold">{a.payer_name}</div>
                          <input value={editAdvDesc} onChange={(e) => setEditAdvDesc(e.target.value)} placeholder="内容"
                            className="w-full p-2 border border-border rounded-lg text-sm focus:outline-none focus:border-green" />
                          <input type="number" value={editAdvAmount} onChange={(e) => setEditAdvAmount(e.target.value)} placeholder="金額"
                            className="w-full p-2 border border-border rounded-lg text-sm focus:outline-none focus:border-green font-inter" />
                          <div className="flex gap-2">
                            <button onClick={() => handleSaveAdvance(a)} className="text-xs bg-green text-white font-bold px-3 py-1.5 rounded-lg">保存</button>
                            <button onClick={() => setEditingAdvId(null)} className="text-xs text-sub px-3 py-1.5">取消</button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold">{a.payer_name}</div>
                            <div className="text-xs text-sub">
                              {a.description || '立替'} ・ {a.split_target === 'all' ? '全員' : a.target_names?.join(', ')}
                            </div>
                          </div>
                          <div className="font-inter text-sm font-bold text-green shrink-0">
                            ¥{a.amount.toLocaleString()}
                          </div>
                          <button onClick={() => { setEditingAdvId(a.id); setEditAdvAmount(String(a.amount)); setEditAdvDesc(a.description || '') }}
                            className="shrink-0 text-xs text-sub hover:text-green">編集</button>
                          <button onClick={() => handleDeleteAdvance(a.id)}
                            className="shrink-0 text-xs text-sub hover:text-red-500">削除</button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

      </div>
    </div>
  )
}
