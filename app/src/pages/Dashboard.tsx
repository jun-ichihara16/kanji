import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useEvent, Event, Participant, AdvanceRecord } from '../hooks/useEvent'
import Venues from './Venues'
import Profile from './Profile'

type Tab = 'events' | 'venues' | 'profile'
type EventFilter = 'active' | 'archived'

export default function Dashboard() {
  const { user, displayName } = useAuth()
  const { fetchMyEvents, fetchParticipants, deleteEvent, fetchAdvancesByEventIds } = useEvent()
  const [events, setEvents] = useState<Event[]>([])
  const [stats, setStats] = useState<Record<string, { total: number; paid: number }>>({})
  const [advanceTotals, setAdvanceTotals] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('events')
  const [eventFilter, setEventFilter] = useState<EventFilter>('active')

  useEffect(() => {
    if (!user?.id) return
    fetchMyEvents(user.id).then(async ({ data }) => {
      if (data) {
        setEvents(data)
        // 参加者stats
        const s: Record<string, { total: number; paid: number }> = {}
        for (const ev of data) {
          const { data: parts } = await fetchParticipants(ev.id)
          s[ev.id] = {
            total: parts?.length ?? 0,
            paid: parts?.filter((p: Participant) => p.is_paid).length ?? 0,
          }
        }
        setStats(s)
        // 立替合計（一括取得）
        const ids = data.map((e) => e.id)
        const { data: allAdvances } = await fetchAdvancesByEventIds(ids)
        if (allAdvances) {
          const totals: Record<string, number> = {}
          allAdvances.forEach((a: AdvanceRecord) => {
            totals[a.event_id] = (totals[a.event_id] || 0) + a.amount
          })
          setAdvanceTotals(totals)
        }
      }
      setLoading(false)
    })
  }, [user])

  const activeEvents = events.filter((e) => (e as any).status !== 'archived')
  const archivedEvents = events.filter((e) => (e as any).status === 'archived')
  const filteredEvents = eventFilter === 'active' ? activeEvents : archivedEvents

  return (
    <div className="flex-1 flex flex-col">
      <div className="flex-1 overflow-hidden flex flex-col">
        {activeTab === 'events' && (
          <div className="flex-1 overflow-y-auto p-4">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-4 border-green/30 border-t-green rounded-full animate-spin" />
              </div>
            ) : (
              <>
                <div className="text-lg font-bold mb-1">おかえりなさい、{displayName}さん</div>

                {/* お知らせエリア */}
                <div className="mb-4 bg-blue-50 border border-blue-100 rounded-xl p-3 flex items-start gap-3">
                  <div className="mt-0.5 text-blue-500">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  </div>
                  <div className="flex-1">
                    <div className="text-xs font-bold text-blue-900 mb-1">【新機能】過去の参加者を簡単に追加できるようになりました</div>
                    <div className="text-[10px] text-blue-800 leading-relaxed">イベント管理画面の「参加者を追加」から、過去のイベントに参加したメンバーをワンタップで呼び出せます。</div>
                  </div>
                </div>

                <div className="text-sm text-sub mb-4">あなたのイベント</div>

                {/* Active/Archived タブ */}
                <div className="flex gap-1 mb-4 bg-gray-bg rounded-xl p-1">
                  <button
                    onClick={() => setEventFilter('active')}
                    className={`flex-1 py-2 text-xs font-semibold rounded-lg transition ${eventFilter === 'active' ? 'bg-white text-[#1A1A1A] shadow-sm' : 'text-sub'}`}
                  >
                    進行中（{activeEvents.length}）
                  </button>
                  <button
                    onClick={() => setEventFilter('archived')}
                    className={`flex-1 py-2 text-xs font-semibold rounded-lg transition ${eventFilter === 'archived' ? 'bg-white text-[#1A1A1A] shadow-sm' : 'text-sub'}`}
                  >
                    完了済み（{archivedEvents.length}）
                  </button>
                </div>

                {filteredEvents.length === 0 ? (
                  eventFilter === 'archived' ? (
                    <div className="text-center py-12 text-sub text-sm">完了済みのイベントはありません</div>
                  ) : (
                    <div className="text-center py-10 px-4 bg-white border border-border rounded-2xl">
                      <div className="w-16 h-16 bg-green-light rounded-full flex items-center justify-center mx-auto mb-4">
                        <img src="/app/img/icons/icon_warikan.png" alt="" className="w-8 h-8 opacity-80" />
                      </div>
                      <h3 className="font-bold text-lg mb-2">最初のイベントを作りましょう</h3>
                      <p className="text-xs text-sub leading-relaxed mb-6">
                        飲み会、旅行、ゴルフコンペなど。<br />
                        イベントを作ってLINEでシェアするだけで、<br />
                        面倒なお金の計算・集金をAIが自動化します。
                      </p>
                      <Link
                        to="/events/new"
                        className="inline-flex items-center justify-center gap-1.5 px-8 py-3.5 bg-green text-white font-bold rounded-xl hover:bg-green-dark transition shadow-sm"
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        新しいイベントを作成
                      </Link>
                    </div>
                  )
                ) : (
                  <div className="space-y-3 mb-5">
                    {filteredEvents.map((ev) => {
                      const s = stats[ev.id] || { total: 0, paid: 0 }
                      const pct = s.total > 0 ? Math.round((s.paid / s.total) * 100) : 0
                      const total = advanceTotals[ev.id] || 0
                      const isArchived = (ev as any).status === 'archived'
                      return (
                        <div key={ev.id} className={`bg-white border rounded-2xl p-4 transition ${isArchived ? 'border-border opacity-60' : 'border-border hover:border-green hover:shadow-sm'}`}>
                          <Link to={`/events/${ev.id}`} className="block">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="font-bold flex-1 truncate">{ev.title}</span>
                              {isArchived ? (
                                <span className="shrink-0 text-[10px] bg-gray-bg text-sub px-2 py-0.5 rounded-full">完了</span>
                              ) : s.total > 0 && s.paid < s.total ? (
                                <span className="shrink-0 text-[10px] bg-amber-50 text-amber-600 border border-amber-200 px-2 py-0.5 rounded-full font-bold">未収金あり</span>
                              ) : s.total > 0 ? (
                                <span className="shrink-0 text-[10px] bg-green-light text-green-dark border border-green/20 px-2 py-0.5 rounded-full font-bold">集金完了</span>
                              ) : null}
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-sub mb-1">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                              {ev.event_date || '日程未定'}
                            </div>
                            {ev.venue_name && (
                              <div className="flex items-center gap-1.5 text-xs text-sub mb-1">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
                                {ev.venue_name}
                              </div>
                            )}
                            <div className="flex gap-3 mt-2.5 text-xs text-sub">
                              <span>参加者 <strong className="text-[#1A1A1A]">{s.total}人</strong></span>
                              {total > 0 && <span>総額 <strong className="text-green font-inter">¥{total.toLocaleString()}</strong></span>}
                            </div>
                            <div className="h-1 bg-border rounded-full mt-2 overflow-hidden">
                              <div className="h-full bg-green rounded-full transition-all" style={{ width: `${pct}%` }} />
                            </div>
                          </Link>
                          {!isArchived && (
                            <button
                              onClick={async (e) => {
                                e.preventDefault()
                                if (!confirm(`「${ev.title}」を削除しますか？`)) return
                                await deleteEvent(ev.id)
                                setEvents((prev) => prev.filter((e) => e.id !== ev.id))
                              }}
                              className="mt-3 text-xs text-sub hover:text-red-500 transition"
                            >
                              このイベントを削除
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}

                {eventFilter === 'active' && (
                  <Link
                    to="/events/new"
                    className="flex items-center justify-center gap-1.5 w-full py-4 bg-green text-white font-bold rounded-xl hover:bg-green-dark transition"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    新しいイベントを作成
                  </Link>
                )}
              </>
            )}
          </div>
        )}

        {activeTab === 'venues' && <Venues />}
        {activeTab === 'profile' && <Profile />}
      </div>

      {/* ボトムナビ */}
      <nav className="sticky bottom-0 bg-white border-t border-border flex z-50">
        <button onClick={() => setActiveTab('events')} className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium transition ${activeTab === 'events' ? 'text-green' : 'text-sub'}`}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          イベント
        </button>
        <button onClick={() => setActiveTab('venues')} className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium transition ${activeTab === 'venues' ? 'text-green' : 'text-sub'}`}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
          加盟店を探す
        </button>
        <button onClick={() => setActiveTab('profile')} className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium transition ${activeTab === 'profile' ? 'text-green' : 'text-sub'}`}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          マイページ
        </button>
      </nav>
    </div>
  )
}
