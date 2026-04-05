import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useEvent, Event, Participant, AdvanceRecord, SettlementRecord } from '../hooks/useEvent'
import { calculateSettlements, Advance } from '../lib/settle'
import { supabase } from '../lib/supabase'

export default function GuestJoin() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { fetchEventBySlug, fetchParticipants, addParticipant, updateParticipantName, deleteParticipant, fetchAdvances, addAdvance, deleteAdvance, fetchSettlements, upsertSettlement } = useEvent()

  const [event, setEvent] = useState<Event | null>(null)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [advances, setAdvances] = useState<AdvanceRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [activeSection, setActiveSection] = useState<'info' | 'expense' | 'settle'>('info')

  // 参加者登録
  const [joinName, setJoinName] = useState('')
  const [joinPaypay, setJoinPaypay] = useState('')
  const [joinPayMethod, setJoinPayMethod] = useState('paypay')
  const [joining, setJoining] = useState(false)
  const [editingPId, setEditingPId] = useState<string | null>(null)
  const [editPName, setEditPName] = useState('')
  const [editPPaypay, setEditPPaypay] = useState('')
  const [editPMethod, setEditPMethod] = useState('cash')

  // 立替フォーム
  const [payerName, setPayerName] = useState('')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [splitAll, setSplitAll] = useState(true)
  const [targetNames, setTargetNames] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [settledMap, setSettledMap] = useState<Record<string, boolean>>({})

  // 簡易認証: 自分が登録した参加者IDリスト
  const [myParticipantIds, setMyParticipantIds] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(`kanji_my_pids_${slug}`) || '[]')
    } catch { return [] }
  })
  const [myName, setMyName] = useState<string>(() => localStorage.getItem(`kanji_my_name_${slug}`) || '')

  const isMyParticipant = (pid: string) => myParticipantIds.includes(pid)
  const isMyAdvance = (payerName: string) => payerName === myName

  // 立替編集
  const [editingAdvId, setEditingAdvId] = useState<string | null>(null)
  const [editAdvAmount, setEditAdvAmount] = useState('')
  const [editAdvDesc, setEditAdvDesc] = useState('')

  const participantNames = useMemo(() => participants.map((p) => p.name), [participants])

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

  const totalAmount = useMemo(() => advances.reduce((sum, a) => sum + a.amount, 0), [advances])

  useEffect(() => {
    if (!slug) return
    fetchEventBySlug(slug).then(async ({ data: ev }) => {
      if (!ev) { setLoading(false); return }
      // 幹事が自分のイベントURLを開いた場合は管理画面へリダイレクト
      if (user?.id && ev.host_id === user.id) {
        navigate(`/events/${ev.id}`, { replace: true })
        return
      }
      setEvent(ev)
      const [partRes, advRes, settRes] = await Promise.all([
        fetchParticipants(ev.id),
        fetchAdvances(ev.id),
        fetchSettlements(ev.id),
      ])
      if (partRes.data) setParticipants(partRes.data)
      if (advRes.data) setAdvances(advRes.data)
      if (settRes.data) {
        const map: Record<string, boolean> = {}
        settRes.data.forEach((s: SettlementRecord) => { map[`${s.from_name}-${s.to_name}`] = s.is_settled })
        setSettledMap(map)
      }
      setLoading(false)
    })
  }, [slug])

  const handleJoin = async () => {
    if (!event || !joinName.trim()) return
    setJoining(true)
    const { data: newP } = await addParticipant(event.id, {
      name: joinName.trim(),
      payment_method: joinPayMethod,
      paypay_phone: joinPayMethod === 'paypay' ? joinPaypay.trim() || undefined : undefined,
    })
    if (newP) {
      setParticipants((prev) => [...prev, newP])
      // 簡易認証: 自分のIDを記録
      const newIds = [...myParticipantIds, newP.id]
      setMyParticipantIds(newIds)
      setMyName(joinName.trim())
      localStorage.setItem(`kanji_my_pids_${slug}`, JSON.stringify(newIds))
      localStorage.setItem(`kanji_my_name_${slug}`, joinName.trim())
      setJoinName('')
      setJoinPaypay('')
      setJoinPayMethod('paypay')
    }
    setJoining(false)
  }

  const handleEditParticipant = async (p: Participant) => {
    if (!editPName.trim()) { setEditingPId(null); return }
    await supabase.from('participants').update({
      name: editPName.trim(),
      payment_method: editPMethod,
      paypay_phone: editPMethod === 'paypay' ? editPPaypay.trim() || null : null,
    }).eq('id', p.id)
    setParticipants((prev) => prev.map((pp) => pp.id === p.id ? {
      ...pp,
      name: editPName.trim(),
      payment_method: editPMethod,
      paypay_phone: editPMethod === 'paypay' ? editPPaypay.trim() || null : null,
    } : pp))
    setEditingPId(null)
  }

  const handleDeleteParticipant = async (p: Participant) => {
    await deleteParticipant(p.id)
    setParticipants((prev) => prev.filter((pp) => pp.id !== p.id))
  }

  const handleSaveAdvance = async (a: AdvanceRecord) => {
    if (!editAdvAmount) { setEditingAdvId(null); return }
    await supabase.from('advances').update({
      amount: parseInt(editAdvAmount),
      description: editAdvDesc || null,
    }).eq('id', a.id)
    setAdvances((prev) => prev.map((ad) => ad.id === a.id ? {
      ...ad,
      amount: parseInt(editAdvAmount),
      description: editAdvDesc || null,
    } : ad))
    setEditingAdvId(null)
  }

  const handleDeleteAdvance = async (advId: string) => {
    await deleteAdvance(advId)
    setAdvances((prev) => prev.filter((a) => a.id !== advId))
  }

  const toggleTarget = (name: string) => {
    setTargetNames((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    )
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
    return <div className="flex-1 flex items-center justify-center text-sub text-sm">イベントが見つかりません</div>
  }

  const SECTIONS = [
    { key: 'info' as const, label: '情報' },
    { key: 'expense' as const, label: '立替' },
    { key: 'settle' as const, label: '精算' },
  ]

  return (
    <div className="flex-1 flex flex-col">
      {/* イベントヘッダー */}
      <div className="bg-green-light px-4 pt-4 pb-3">
        <h1 className="text-lg font-bold">{event.title}</h1>
        <div className="flex items-center gap-4 mt-1 text-xs text-sub">
          {event.event_date && (
            <span className="flex items-center gap-1">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              {event.event_date}
            </span>
          )}
          <span>{participants.length}人参加</span>
          {totalAmount > 0 && <span className="font-inter">合計 ¥{totalAmount.toLocaleString()}</span>}
        </div>
      </div>

      {/* タブ */}
      <div className="flex border-b border-border bg-white sticky top-[53px] z-40">
        {SECTIONS.map((s) => (
          <button
            key={s.key}
            onClick={() => setActiveSection(s.key)}
            className={`flex-1 py-3 text-sm font-semibold border-b-[3px] transition ${
              activeSection === s.key ? 'text-green border-green' : 'text-sub border-transparent'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* コンテンツ */}
      <div className="flex-1 overflow-y-auto p-4">

        {/* 情報タブ */}
        {activeSection === 'info' && (
          <>
            {/* イベント詳細 */}
            <div className="bg-white border border-border rounded-2xl p-4 mb-4">
              {event.venue_name && (
                <div className="flex items-center gap-2 text-sm text-sub mb-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
                  {event.venue_name}{event.venue_address && `（${event.venue_address}）`}
                </div>
              )}
              {event.memo && (
                <div className="flex items-center gap-2 text-sm text-sub">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  {event.memo}
                </div>
              )}
            </div>

            {/* 参加者一覧 */}
            <h3 className="text-sm font-bold mb-2">参加者（{participants.length}人）</h3>
            {participants.length > 0 ? (
              <div className="space-y-1.5 mb-4">
                {participants.map((p) => (
                  <div key={p.id} className="flex items-center gap-2 p-2.5 bg-white border border-border rounded-xl text-sm">
                    {editingPId === p.id ? (
                      <div className="flex-1 space-y-2">
                        <input
                          value={editPName}
                          onChange={(e) => setEditPName(e.target.value)}
                          placeholder="名前"
                          className="w-full p-2 border border-green rounded-lg text-sm focus:outline-none"
                          autoFocus
                          onKeyDown={(e) => { if (e.key === 'Escape') setEditingPId(null) }}
                        />
                        <div className="grid grid-cols-3 gap-1">
                          {[
                            { value: 'paypay', label: 'PayPay' },
                            { value: 'cash', label: '現金' },
                            { value: 'bank', label: '振込' },
                          ].map((m) => (
                            <button
                              key={m.value}
                              type="button"
                              onClick={() => setEditPMethod(m.value)}
                              className={`py-1.5 rounded-lg text-xs font-semibold border transition ${
                                editPMethod === m.value ? 'border-green bg-green-light text-green-dark' : 'border-border text-sub'
                              }`}
                            >
                              {m.label}
                            </button>
                          ))}
                        </div>
                        {editPMethod === 'paypay' && (
                          <input
                            value={editPPaypay}
                            onChange={(e) => setEditPPaypay(e.target.value)}
                            placeholder="PayPay番号"
                            type="tel"
                            className="w-full p-2 border border-border rounded-lg text-sm focus:outline-none focus:border-green font-inter"
                          />
                        )}
                        <div className="flex gap-2">
                          <button onClick={() => handleEditParticipant(p)} className="text-xs bg-green text-white font-bold px-3 py-1.5 rounded-lg">保存</button>
                          <button onClick={() => setEditingPId(null)} className="text-xs text-sub px-3 py-1.5">取消</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="w-7 h-7 rounded-full bg-green/10 text-green flex items-center justify-center text-xs font-bold shrink-0">
                          {p.name.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm">{p.name}</div>
                          <div className="text-xs text-sub flex items-center gap-1">
                            {p.payment_method === 'paypay' && <><img src="/app/img/paypay.jpg" alt="" width={12} height={12} className="rounded" /> {p.paypay_phone || 'PayPay'}</>}
                            {p.payment_method === 'cash' && '💴 現金'}
                            {p.payment_method === 'bank' && '🏦 振込'}
                          </div>
                        </div>
                        <button
                          onClick={() => { setEditingPId(p.id); setEditPName(p.name); setEditPPaypay(p.paypay_phone || ''); setEditPMethod(p.payment_method) }}
                          className="text-xs text-sub hover:text-green"
                        >
                          編集
                        </button>
                        <button
                          onClick={() => handleDeleteParticipant(p)}
                          className="text-xs text-sub hover:text-red-500"
                        >
                          削除
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-sub mb-4">まだ参加者がいません</p>
            )}

            {/* 参加登録 */}
            <h3 className="text-sm font-bold mb-2">参加する</h3>
            <div className="bg-white border border-border rounded-2xl p-4">
              <div className="space-y-2 mb-3">
                <input
                  value={joinName}
                  onChange={(e) => setJoinName(e.target.value)}
                  placeholder="名前"
                  className="w-full p-3 border border-border rounded-xl text-sm bg-gray-bg focus:outline-none focus:border-green"
                />
                <div>
                  <label className="text-xs font-semibold text-sub mb-1 block">支払い方法</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { value: 'paypay', label: 'PayPay' },
                      { value: 'cash', label: '現金' },
                      { value: 'bank', label: '振込' },
                    ].map((m) => (
                      <button
                        key={m.value}
                        type="button"
                        onClick={() => setJoinPayMethod(m.value)}
                        className={`py-2.5 rounded-xl text-xs font-semibold border-2 transition ${
                          joinPayMethod === m.value ? 'border-green bg-green-light text-green-dark' : 'border-border text-sub'
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>
                {joinPayMethod === 'paypay' && (
                  <input
                    value={joinPaypay}
                    onChange={(e) => setJoinPaypay(e.target.value)}
                    placeholder="PayPay番号 / 電話番号"
                    type="tel"
                    className="w-full p-3 border border-border rounded-xl text-sm bg-gray-bg focus:outline-none focus:border-green font-inter"
                  />
                )}
              </div>
              <button
                onClick={handleJoin}
                disabled={!joinName.trim() || joining}
                className="w-full py-3 bg-green text-white text-sm font-bold rounded-xl disabled:opacity-40 hover:bg-green-dark transition"
              >
                {joining ? '登録中...' : '参加する'}
              </button>
            </div>
          </>
        )}

        {/* 立替タブ */}
        {activeSection === 'expense' && (
          <>
            {/* 立替登録フォーム */}
            <div className="bg-white border border-border rounded-2xl p-4 mb-4">
              <h3 className="text-sm font-bold mb-3">立替えを登録する</h3>

              <div className="mb-3">
                <label className="text-xs font-semibold text-sub mb-1 block">支払った人</label>
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
                {participantNames.length === 0 && (
                  <p className="text-xs text-red-400 mt-1">先に「情報」タブで参加者を登録してください</p>
                )}
              </div>

              <div className="mb-3">
                <label className="text-xs font-semibold text-sub mb-1 block">内容</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="例: 居酒屋代、タクシー代"
                  className="w-full p-3 border border-border rounded-xl text-sm bg-gray-bg focus:outline-none focus:border-green"
                />
              </div>

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

              <div className="mb-3">
                <label className="text-xs font-semibold text-sub mb-1 block">割り勘対象</label>
                <label className="flex items-center gap-2 p-3 bg-white border border-border rounded-xl mb-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={splitAll}
                    onChange={() => { setSplitAll(true); setTargetNames([]) }}
                    className="w-4 h-4 accent-green"
                  />
                  <span className="text-sm font-semibold">全員で割り勘</span>
                </label>
                {!splitAll && participantNames.length === 0 && (
                  <p className="text-xs text-red-400">先に「情報」タブで参加者を登録してください</p>
                )}
                <div className="grid grid-cols-2 gap-1.5">
                  {participantNames.map((n) => (
                    <label key={n} className="flex items-center gap-2 p-2.5 bg-white border border-border rounded-xl cursor-pointer hover:border-green/50 transition">
                      <input
                        type="checkbox"
                        checked={splitAll || targetNames.includes(n)}
                        onChange={() => {
                          if (splitAll) {
                            // 全員モードから個別モードへ：クリックした人以外を全選択
                            const others = participantNames.filter((x) => x !== n)
                            setSplitAll(false)
                            setTargetNames(others)
                          } else {
                            toggleTarget(n)
                          }
                        }}
                        className="w-4 h-4 accent-green shrink-0"
                      />
                      <span className={`text-sm truncate ${splitAll ? 'text-sub' : 'font-medium'}`}>{n}</span>
                    </label>
                  ))}
                </div>
                {!splitAll && targetNames.length > 0 && (
                  <p className="text-xs text-sub mt-1.5">{targetNames.length}人選択中</p>
                )}
              </div>

              <button
                onClick={handleSubmitAdvance}
                disabled={!payerName || !amount || submitting}
                className="w-full py-3.5 bg-green text-white font-bold rounded-xl disabled:opacity-40 hover:bg-green-dark transition"
              >
                {submitting ? '登録中...' : submitted ? '登録しました！' : '立替えを登録する'}
              </button>
            </div>

            {/* 立替一覧 */}
            {advances.length > 0 && (
              <>
                <h3 className="text-sm font-bold mb-2">立替え一覧（{advances.length}件）</h3>
                <div className="space-y-2">
                  {advances.map((a) => (
                    <div key={a.id} className="bg-white border border-border rounded-xl p-3">
                      {editingAdvId === a.id ? (
                        <div className="space-y-2">
                          <div className="text-sm font-semibold">{a.payer_name}</div>
                          <input
                            value={editAdvDesc}
                            onChange={(e) => setEditAdvDesc(e.target.value)}
                            placeholder="内容"
                            className="w-full p-2 border border-border rounded-lg text-sm focus:outline-none focus:border-green"
                          />
                          <input
                            type="number"
                            value={editAdvAmount}
                            onChange={(e) => setEditAdvAmount(e.target.value)}
                            placeholder="金額"
                            className="w-full p-2 border border-border rounded-lg text-sm focus:outline-none focus:border-green font-inter"
                          />
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
                              {a.description || '立替'} ・ {a.split_target === 'all' ? '全員で割り勘' : a.target_names?.join('、')}
                            </div>
                          </div>
                          <div className="font-inter text-sm font-bold text-green shrink-0">
                            ¥{a.amount.toLocaleString()}
                          </div>
                          <button
                            onClick={() => { setEditingAdvId(a.id); setEditAdvAmount(String(a.amount)); setEditAdvDesc(a.description || '') }}
                            className="shrink-0 text-xs text-sub hover:text-green"
                          >
                            編集
                          </button>
                          <button
                            onClick={() => handleDeleteAdvance(a.id)}
                            className="shrink-0 text-xs text-sub hover:text-red-500"
                          >
                            削除
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {/* 精算タブ */}
        {activeSection === 'settle' && (
          <>
            {advances.length === 0 ? (
              <div className="text-center py-12 text-sub text-sm">
                立替データがありません。<br />「立替」タブで費用を登録してください。
              </div>
            ) : settlements.length === 0 ? (
              <div className="text-center py-12 text-sub text-sm">
                精算は不要です（均等に立替済み）
              </div>
            ) : (
              <>
                <h3 className="text-sm font-bold mb-3">精算方法</h3>
                <div className="space-y-2.5 mb-4">
                  {settlements.map((s, i) => {
                    const key = `${s.from}-${s.to}`
                    const isSettled = !!settledMap[key]
                    const payee = participants.find((p) => p.name === s.to)
                    const isPayPay = payee?.payment_method === 'paypay' && payee?.paypay_phone
                    return (
                      <div key={i} className={`border rounded-xl overflow-hidden transition ${isSettled ? 'bg-gray-bg/50 border-border opacity-60' : 'bg-white border-border'}`}>
                        <div className="p-4">
                          <div className="flex items-center gap-2 mb-1 text-sm">
                            <span className={`font-semibold ${isSettled ? 'text-sub' : ''}`}>{s.from}</span>
                            <span className="text-sub">→</span>
                            <span className={`font-semibold ${isSettled ? 'text-sub' : ''}`}>{s.to}</span>
                            {payee && (
                              <span className="text-xs text-sub ml-auto">
                                {payee.payment_method === 'paypay' && 'PayPay'}
                                {payee.payment_method === 'cash' && '現金'}
                                {payee.payment_method === 'bank' && '振込'}
                              </span>
                            )}
                          </div>
                          <div className={`font-inter text-xl font-extrabold ${isSettled ? 'text-sub line-through' : 'text-green'}`}>
                            ¥{s.amount.toLocaleString()}
                          </div>

                          {/* PayPay送金UI（PayPayの人のみ・未精算時のみ） */}
                          {isPayPay && !isSettled && (
                            <div className="mt-3 bg-gray-bg rounded-xl p-3">
                              <div className="flex items-center gap-1.5 text-xs text-sub mb-2">
                                <img src="/app/img/paypay.jpg" alt="" width={14} height={14} className="rounded" />
                                PayPay番号: <span className="font-inter font-semibold text-[#1A1A1A]">{payee.paypay_phone}</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(payee.paypay_phone!)
                                    const el = document.getElementById(`copy-text-${i}`)
                                    if (el) { el.textContent = 'コピー済み ✓'; setTimeout(() => { el.textContent = '番号をコピー' }, 2000) }
                                  }}
                                  className="flex-1 py-2.5 bg-green text-white text-xs font-bold rounded-lg hover:bg-green-dark transition text-center"
                                >
                                  <span id={`copy-text-${i}`}>番号をコピー</span>
                                </button>
                                <span className="text-sub text-xs">▶</span>
                                <a
                                  href="paypay://"
                                  onClick={() => { navigator.clipboard.writeText(payee.paypay_phone!) }}
                                  className="flex-1 py-2.5 bg-[#FF0033] text-white text-xs font-bold rounded-lg hover:brightness-90 transition text-center no-underline"
                                >
                                  PayPayで送金
                                </a>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* 精算完了ボタン */}
                        <button
                          onClick={async () => {
                            if (!event) return
                            const newVal = !settledMap[key]
                            setSettledMap((prev) => ({ ...prev, [key]: newVal }))
                            await upsertSettlement(event.id, s.from, s.to, s.amount, newVal)
                          }}
                          className={`w-full py-4 text-sm font-bold border-t transition ${
                            isSettled
                              ? 'bg-gray-bg text-sub border-border'
                              : 'bg-green text-white border-green hover:bg-green-dark'
                          }`}
                        >
                          {isSettled ? '✓ 精算済み（タップで取り消し）' : '✅ 精算完了にする'}
                        </button>
                      </div>
                    )
                  })}
                </div>
                <button
                  onClick={() => {
                    const text = settlements
                      .map((s) => `${s.from} → ${s.to}: ¥${s.amount.toLocaleString()}`)
                      .join('\n')
                    navigator.clipboard.writeText(text)
                  }}
                  className="w-full py-3 border-2 border-green text-green-dark font-bold rounded-xl text-sm hover:bg-green-light transition"
                >
                  精算結果をコピー
                </button>
              </>
            )}
          </>
        )}

      </div>
    </div>
  )
}
