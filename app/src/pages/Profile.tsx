import { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useEvent, Event } from '../hooks/useEvent'
import { Link } from 'react-router-dom'
import { signOut } from '../lib/auth'

function getRank(count: number) {
  if (count >= 15) return { name: 'プレミアム幹事', color: 'text-amber-500', bg: 'bg-amber-50', icon: '👑' }
  if (count >= 5) return { name: '認定幹事', color: 'text-green', bg: 'bg-green-light', icon: '🏅' }
  return { name: '一般幹事', color: 'text-sub', bg: 'bg-gray-bg', icon: '🎫' }
}

export default function Profile() {
  const { user, displayName } = useAuth()
  const { fetchMyEvents, fetchParticipants } = useEvent()
  const [events, setEvents] = useState<Event[]>([])
  const [totalParticipants, setTotalParticipants] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user?.id) return
    fetchMyEvents(user.id).then(async ({ data }) => {
      if (data) {
        setEvents(data)
        let total = 0
        for (const ev of data) {
          const { data: parts } = await fetchParticipants(ev.id)
          total += parts?.length ?? 0
        }
        setTotalParticipants(total)
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

  const rank = getRank(events.length)
  const recentEvents = events.slice(0, 3)

  return (
    <div className="flex-1 overflow-y-auto p-4">
      {/* プロフィールカード */}
      <div className="bg-white border border-border rounded-2xl p-5 mb-4 text-center">
        <div className="w-16 h-16 rounded-full bg-green/10 text-green flex items-center justify-center text-2xl font-bold mx-auto mb-3">
          {user?.avatarUrl ? (
            <img src={user.avatarUrl} alt="" className="w-16 h-16 rounded-full object-cover" />
          ) : (
            displayName.charAt(0)
          )}
        </div>
        <h2 className="text-lg font-bold mb-1">{displayName}</h2>
        <div className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${rank.bg} ${rank.color}`}>
          {rank.icon} {rank.name}
        </div>
      </div>

      {/* 実績サマリー */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="bg-white border border-border rounded-xl p-3 text-center">
          <div className="font-inter text-xl font-extrabold text-green">{events.length}</div>
          <div className="text-[10px] text-sub mt-0.5">イベント数</div>
        </div>
        <div className="bg-white border border-border rounded-xl p-3 text-center">
          <div className="font-inter text-xl font-extrabold">{totalParticipants}</div>
          <div className="text-[10px] text-sub mt-0.5">累計参加者</div>
        </div>
        <div className="bg-white border border-border rounded-xl p-3 text-center">
          <div className="text-xl">{rank.icon}</div>
          <div className="text-[10px] text-sub mt-0.5">{rank.name}</div>
        </div>
      </div>

      {/* ランク説明 */}
      <div className="bg-white border border-border rounded-xl p-4 mb-4">
        <h3 className="text-sm font-bold mb-2">幹事ランク</h3>
        <div className="space-y-2">
          {[
            { name: '一般幹事', range: '0〜4回', icon: '🎫', active: events.length < 5 },
            { name: '認定幹事', range: '5〜14回', icon: '🏅', active: events.length >= 5 && events.length < 15 },
            { name: 'プレミアム幹事', range: '15回以上', icon: '👑', active: events.length >= 15 },
          ].map((r) => (
            <div key={r.name} className={`flex items-center gap-2 p-2 rounded-lg ${r.active ? 'bg-green-light' : ''}`}>
              <span>{r.icon}</span>
              <span className={`text-sm flex-1 ${r.active ? 'font-bold' : 'text-sub'}`}>{r.name}</span>
              <span className="text-xs text-sub">{r.range}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 最近のイベント */}
      {recentEvents.length > 0 && (
        <div className="mb-4">
          <h3 className="text-sm font-bold mb-2">最近のイベント</h3>
          <div className="space-y-2">
            {recentEvents.map((ev) => (
              <Link
                key={ev.id}
                to={`/events/${ev.id}`}
                className="block bg-white border border-border rounded-xl p-3 hover:border-green transition"
              >
                <div className="text-sm font-semibold">{ev.title}</div>
                <div className="text-xs text-sub mt-0.5">{ev.event_date || '日程未定'}</div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ログアウト */}
      <button
        onClick={() => signOut()}
        className="w-full py-3 border-2 border-border text-sub font-semibold rounded-xl hover:border-red-300 hover:text-red-500 transition"
      >
        ログアウト
      </button>
    </div>
  )
}
