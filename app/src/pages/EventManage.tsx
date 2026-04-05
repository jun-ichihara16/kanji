import { useState, useEffect, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { useEvent, Event, Participant, AdvanceRecord, SettlementRecord } from '../hooks/useEvent'
import { calculateSettlements, Settlement, Advance } from '../lib/settle'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import SummaryCard from '../components/SummaryCard'
import AdvancePaymentForm from '../components/AdvancePaymentForm'
import { QRCodeCanvas } from 'qrcode.react'

const TABS = ['参加者', '立替'] as const

export default function EventManage() {
  const { id } = useParams<{ id: string }>()
  const {
    fetchEventById, fetchParticipants, addParticipant, updateParticipantName, deleteParticipant, togglePaid,
    fetchAdvances, addAdvance, deleteAdvance, deleteEvent, updateEvent,
    fetchSettlements, upsertSettlement, updateReminderSettings, sendGroupReminder,
    fetchMyEvents,
  } = useEvent()
  const { user } = useAuth()

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
  const [showQR, setShowQR] = useState(false)
  const [urlCopied, setUrlCopied] = useState(false)
  const [sendingReminder, setSendingReminder] = useState(false)
  const [reminderSent, setReminderSent] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showEditEvent, setShowEditEvent] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editDate, setEditDate] = useState('')
  const [editVenue, setEditVenue] = useState('')
  const [editingAdvId, setEditingAdvId] = useState<string | null>(null)
  const [editAdvAmount, setEditAdvAmount] = useState('')
  const [editAdvDesc, setEditAdvDesc] = useState('')
  const [pastParticipants, setPastParticipants] = useState<{ name: string; payment_method: string; paypay_phone: string | null }[]>([])
  const [showPastList, setShowPastList] = useState(false)

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

  // 過去の参加者リスト取得
  useEffect(() => {
    if (!user?.id) return
    fetchMyEvents(user.id).then(async ({ data: evts }) => {
      if (!evts) return
      const otherEventIds = evts.filter((e) => e.id !== id).map((e) => e.id)
      if (otherEventIds.length === 0) return
      const { data: allParts } = await supabase
        .from('participants')
        .select('name, payment_method, paypay_phone')
        .in('event_id', otherEventIds)
      if (!allParts) return
      // 重複排除（名前ベース）
      const seen = new Set<string>()
      const unique = allParts.filter((p: any) => {
        if (seen.has(p.name)) return false
        seen.add(p.name)
        return true
      })
      setPastParticipants(unique)
    })
  }, [user, id])

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

  const handleSaveEvent = async () => {
    if (!id || !editTitle.trim()) return
    await updateEvent(id, {
      title: editTitle.trim(),
      event_date: editDate || undefined,
      venue_name: editVenue.trim() || undefined,
    })
    setEvent((prev) => prev ? { ...prev, title: editTitle.trim(), event_date: editDate || prev.event_date, venue_name: editVenue.trim() || prev.venue_name } : prev)
    setShowEditEvent(false)
  }

  const handleArchive = async () => {
    if (!id || !confirm('このイベントをアーカイブ（完了）にしますか？')) return
    await updateEvent(id, { status: 'archived' })
    window.location.href = '/app/dashboard'
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
  const shareUrl = `${window.location.origin}/app/e/${event.slug}`

  return (
    <div className="flex-1 flex flex-col">
      {/* Event title */}
      <div className="px-4 pt-4 pb-2 flex items-start justify-between">
        <div className="flex-1">
          <h2 className="text-lg font-bold">{event.title}</h2>
          <div className="flex items-center gap-2 mt-0.5">
            {event.event_date && <span className="text-xs text-sub">{event.event_date}</span>}
            {event.venue_name && <span className="text-xs text-sub">📍 {event.venue_name}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => { setEditTitle(event.title); setEditDate(event.event_date || ''); setEditVenue(event.venue_name || ''); setShowEditEvent(true) }}
            className="text-xs text-sub hover:text-green transition"
          >
            編集
          </button>
          <button
            onClick={handleArchive}
            className="text-xs text-sub hover:text-amber-500 transition"
          >
            完了
          </button>
          <button
            onClick={async () => {
              if (!confirm(`「${event.title}」を削除しますか？`)) return
              await deleteEvent(event.id)
              window.location.href = '/app/dashboard'
            }}
            className="text-xs text-sub hover:text-red-500 transition"
          >
            削除
          </button>
        </div>
      </div>

      {/* 編集モーダル */}
      {showEditEvent && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowEditEvent(false)}>
          <div className="bg-white rounded-2xl p-5 max-w-[340px] w-full" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-bold mb-4">イベント情報を編集</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-sub mb-1 block">イベント名 *</label>
                <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full p-3 border border-border rounded-xl text-sm bg-gray-bg focus:outline-none focus:border-green" />
              </div>
              <div>
                <label className="text-xs font-semibold text-sub mb-1 block">日時</label>
                <input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)}
                  className="w-full p-3 border border-border rounded-xl text-sm bg-gray-bg focus:outline-none focus:border-green" />
              </div>
              <div>
                <label className="text-xs font-semibold text-sub mb-1 block">会場</label>
                <input value={editVenue} onChange={(e) => setEditVenue(e.target.value)}
                  placeholder="例: 居酒屋○○"
                  className="w-full p-3 border border-border rounded-xl text-sm bg-gray-bg focus:outline-none focus:border-green" />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowEditEvent(false)} className="flex-1 py-3 bg-gray-bg text-sub rounded-xl text-sm font-semibold">取消</button>
              <button onClick={handleSaveEvent} disabled={!editTitle.trim()} className="flex-1 py-3 bg-green text-white rounded-xl text-sm font-bold disabled:opacity-40 hover:bg-green-dark transition">保存</button>
            </div>
          </div>
        </div>
      )}

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

            {/* 過去の参加者から追加 */}
            {pastParticipants.length > 0 && (
              <div className="mb-4">
                <button
                  onClick={() => setShowPastList(!showPastList)}
                  className="w-full py-2.5 border border-border rounded-xl text-xs font-semibold text-sub hover:border-green hover:text-green transition flex items-center justify-center gap-1"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
                  過去の参加者から追加（{pastParticipants.length}人）
                  <span className="text-[10px]">{showPastList ? '▲' : '▼'}</span>
                </button>
                {showPastList && (
                  <div className="mt-2 bg-white border border-border rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                    {pastParticipants
                      .filter((pp) => !participants.some((p) => p.name === pp.name))
                      .map((pp) => (
                        <button
                          key={pp.name}
                          onClick={async () => {
                            if (!id) return
                            const { data: newP } = await addParticipant(id, {
                              name: pp.name,
                              payment_method: pp.payment_method,
                              paypay_phone: pp.paypay_phone || undefined,
                            })
                            if (newP) setParticipants((prev) => [...prev, newP])
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2.5 text-left border-b border-border last:border-none hover:bg-green-light/50 transition"
                        >
                          <div className="w-7 h-7 rounded-full bg-green/10 text-green flex items-center justify-center text-xs font-bold shrink-0">
                            {pp.name.charAt(0)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{pp.name}</div>
                            <div className="text-[10px] text-sub">
                              {pp.payment_method === 'paypay' && pp.paypay_phone ? `PayPay: ${pp.paypay_phone}` : pp.payment_method === 'bank' ? '振込' : '現金'}
                            </div>
                          </div>
                          <span className="text-xs text-green font-semibold shrink-0">+ 追加</span>
                        </button>
                      ))}
                    {pastParticipants.filter((pp) => !participants.some((p) => p.name === pp.name)).length === 0 && (
                      <p className="text-center text-xs text-sub py-3">全員追加済みです</p>
                    )}
                  </div>
                )}
              </div>
            )}

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
                          {p.payment_method === 'paypay' && <><img src="/app/img/paypay.jpg" alt="" width={12} height={12} className="rounded" /> <span className="font-inter">{p.paypay_phone || 'PayPay'}</span></>}
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
                          <div key={i} className={`rounded-xl border overflow-hidden transition ${isSettled ? 'bg-gray-bg/50 border-border opacity-60' : 'bg-white border-border'}`}>
                            <div className="p-3">
                              {/* From → To 左右配置 */}
                              <div className="flex items-center justify-between mb-2">
                                <div className="text-center flex-1">
                                  <div className="text-xs text-sub">支払う人</div>
                                  <div className="text-sm font-bold">{s.from}</div>
                                </div>
                                <div className="text-sub text-lg px-2">➔</div>
                                <div className="text-center flex-1">
                                  <div className="text-xs text-sub">受け取る人</div>
                                  <div className="text-sm font-bold">{s.to}</div>
                                </div>
                              </div>
                              {/* 金額 */}
                              <div className={`font-inter text-center text-xl font-extrabold mb-1 ${isSettled ? 'text-sub line-through' : 'text-green'}`}>
                                ¥{s.amount.toLocaleString()}
                              </div>
                              {/* 支払い方法 */}
                              <div className="text-center text-xs text-sub">
                                {p?.payment_method === 'paypay' && p.paypay_phone ? `PayPay: ${p.paypay_phone}` : p?.payment_method === 'bank' ? '🏦 振込' : '💴 現金'}
                              </div>
                            </div>
                            {/* 完了トグル */}
                            <button
                              onClick={() => handleToggleSettled(s.from, s.to, s.amount)}
                              className={`w-full min-w-[60px] py-2.5 text-sm font-bold border-t transition ${isSettled ? 'bg-gray-bg text-sub border-border' : 'bg-green text-white border-green hover:bg-green-dark'}`}
                            >
                              {isSettled ? '✓ 精算済み' : '精算完了にする'}
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

      {/* 固定アクションバー */}
      <div className="sticky bottom-0 bg-white border-t border-border shadow-[0_-4px_20px_rgba(0,0,0,0.05)] p-3 space-y-2 z-40">
        {/* リマインド行 */}
        {event.line_group_id && computedSettlements.some((s) => !settledMap[`${s.from}-${s.to}`]) && (
          <button
            onClick={async () => {
              setSendingReminder(true)
              const { ok, data } = await sendGroupReminder(event.id)
              setSendingReminder(false)
              if (ok) { setReminderSent(true); setTimeout(() => setReminderSent(false), 3000) }
              else { alert('送信失敗: ' + (data?.error || 'エラー')) }
            }}
            disabled={sendingReminder || reminderSent}
            className={`w-full py-3 rounded-xl text-sm font-bold transition flex items-center justify-center gap-2 ${
              reminderSent ? 'bg-gray-bg text-sub' : 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100'
            }`}
          >
            {sendingReminder ? '送信中...' : reminderSent ? '✓ リマインド送信済み' : '⚡ LINEグループにリマインドを送る'}
          </button>
        )}
        {/* 共有行 */}
        <div className="flex gap-2">
        <a
          href={`https://line.me/R/msg/text/?${encodeURIComponent(`${event.title}に参加してください！\n${shareUrl}`)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 flex items-center justify-center gap-1.5 py-3 bg-line text-white text-sm font-bold rounded-xl no-underline hover:brightness-95 transition"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596a.626.626 0 01-.199.031c-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.271.173-.508.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/></svg>
          LINEで共有
        </a>
        <button
          onClick={() => {
            navigator.clipboard.writeText(shareUrl)
            setUrlCopied(true)
            setTimeout(() => setUrlCopied(false), 2000)
          }}
          className="flex-1 flex items-center justify-center gap-1.5 py-3 bg-white border-2 border-green text-green-dark text-sm font-bold rounded-xl hover:bg-green-light transition"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
          {urlCopied ? 'コピー済み ✓' : 'URLコピー'}
        </button>
        <button
          onClick={() => setShowQR(true)}
          className="flex items-center justify-center w-12 py-3 bg-white border-2 border-border text-sub rounded-xl hover:border-green hover:text-green transition"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="3" height="3"/><line x1="21" y1="14" x2="21" y2="14.01"/><line x1="21" y1="21" x2="21" y2="21.01"/><line x1="14" y1="21" x2="14" y2="21.01"/></svg>
        </button>
        </div>
      </div>

      {/* QRモーダル */}
      {showQR && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setShowQR(false)}
        >
          <div
            className="bg-white rounded-2xl p-6 max-w-[320px] w-full text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold mb-1">{event.title}</h3>
            <p className="text-xs text-sub mb-4">QRコードをスキャンして参加</p>
            <div className="flex justify-center mb-3" id="qr-container">
              <QRCodeCanvas value={shareUrl} size={200} level="M" includeMargin={true} />
            </div>
            <p className="text-[10px] text-sub break-all mb-4">{shareUrl}</p>
            <div className="space-y-2">
              <button
                onClick={() => {
                  const canvas = document.querySelector('#qr-container canvas') as HTMLCanvasElement
                  if (!canvas) return
                  const url = canvas.toDataURL('image/png')
                  const a = document.createElement('a')
                  a.href = url
                  a.download = `kanji_qr_${event.title}.png`
                  a.click()
                }}
                className="w-full py-3 bg-green text-white font-bold rounded-xl hover:bg-green-dark transition flex items-center justify-center gap-2"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                画像を保存
              </button>
              <button
                onClick={() => setShowQR(false)}
                className="w-full py-3 bg-gray-bg text-sub font-semibold rounded-xl hover:bg-border transition"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
