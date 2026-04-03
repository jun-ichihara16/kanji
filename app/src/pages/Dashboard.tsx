import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useEvent, Event, Participant } from '../hooks/useEvent'

export default function Dashboard() {
  const { user, displayName } = useAuth()
  const { fetchMyEvents, fetchParticipants } = useEvent()
  const [events, setEvents] = useState<Event[]>([])
  const [stats, setStats] = useState<Record<string, { total: number; paid: number }>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user?.id) return
    fetchMyEvents(user.id).then(async ({ data }) => {
      if (data) {
        setEvents(data)
        const s: Record<string, { total: number; paid: number }> = {}
        for (const ev of data) {
          const { data: parts } = await fetchParticipants(ev.id)
          s[ev.id] = {
            total: parts?.length ?? 0,
            paid: parts?.filter((p: Participant) => p.is_paid).length ?? 0,
          }
        }
        setStats(s)
      }
      setLoading(false)
    })
  }, [user])

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-green/30 border-t-green rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex-1 p-4">
      <div className="text-lg font-bold mb-1">おかえりなさい、{displayName}さん</div>
      <div className="text-sm text-sub mb-5">あなたのイベント</div>

      {events.length === 0 ? (
        <div className="text-center py-12 text-sub text-sm">
          まだイベントがありません
        </div>
      ) : (
        <div className="space-y-3 mb-5">
          {events.map((ev) => {
            const s = stats[ev.id] || { total: 0, paid: 0 }
            const pct = s.total > 0 ? Math.round((s.paid / s.total) * 100) : 0
            return (
              <Link
                key={ev.id}
                to={`/events/${ev.id}`}
                className="block bg-white border border-border rounded-2xl p-4 hover:border-green hover:shadow-sm transition"
              >
                <div className="font-bold mb-2">{ev.title}</div>
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
                  <span>支払い済み <strong className="text-green">{s.paid}/{s.total}</strong></span>
                </div>
                <div className="h-1 bg-border rounded-full mt-2 overflow-hidden">
                  <div className="h-full bg-green rounded-full transition-all" style={{ width: `${pct}%` }} />
                </div>
              </Link>
            )
          })}
        </div>
      )}

      <Link
        to="/events/new"
        className="flex items-center justify-center gap-1.5 w-full py-4 bg-green text-white font-bold rounded-xl hover:bg-green-dark transition"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        新しいイベントを作成
      </Link>
    </div>
  )
}
