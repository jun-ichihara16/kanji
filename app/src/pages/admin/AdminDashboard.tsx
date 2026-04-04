import { useState, useEffect } from 'react'
import { useEvent } from '../../hooks/useEvent'

export default function AdminDashboard() {
  const { fetchAllUsers, fetchAllEvents, fetchAllParticipants, fetchAllAdvances } = useEvent()
  const [stats, setStats] = useState({ users: 0, events: 0, participants: 0, monthEvents: 0, totalAmount: 0 })
  const [recentEvents, setRecentEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([fetchAllUsers(), fetchAllEvents(), fetchAllParticipants(), fetchAllAdvances()]).then(([uRes, eRes, pRes, aRes]) => {
      const users = uRes.data || []
      const events = eRes.data || []
      const parts = pRes.data || []
      const advances = aRes.data || []
      const now = new Date()
      const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
      const monthEvents = events.filter((e: any) => e.created_at >= monthStart).length
      const totalAmount = advances.reduce((s: number, a: any) => s + a.amount, 0)
      setStats({ users: users.length, events: events.length, participants: parts.length, monthEvents, totalAmount })
      setRecentEvents(events.slice(0, 5).map((e: any) => ({
        ...e,
        hostName: users.find((u: any) => u.id === e.host_id)?.display_name || '不明',
        partCount: parts.filter((p: any) => p.event_id === e.id).length,
      })))
      setLoading(false)
    })
  }, [])

  if (loading) return <div className="flex items-center justify-center py-12"><div className="w-8 h-8 border-4 border-green/30 border-t-green rounded-full animate-spin" /></div>

  return (
    <div className="p-4 max-w-[800px] mx-auto">
      <h1 className="text-lg font-bold mb-4">管理ダッシュボード</h1>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: '総幹事数', value: stats.users, color: '' },
          { label: '総イベント数', value: stats.events, color: '' },
          { label: '累計参加者', value: stats.participants, color: '' },
          { label: '今月のイベント', value: stats.monthEvents, color: 'text-green' },
        ].map((s) => (
          <div key={s.label} className="bg-white border border-border rounded-xl p-4 text-center">
            <div className={`font-inter text-2xl font-extrabold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-sub mt-1">{s.label}</div>
          </div>
        ))}
      </div>
      <div className="bg-white border border-border rounded-xl p-4 mb-4">
        <div className="font-inter text-lg font-bold text-green mb-1">¥{stats.totalAmount.toLocaleString()}</div>
        <div className="text-xs text-sub">累計立替総額</div>
      </div>
      <h2 className="text-sm font-bold mb-2">最近のイベント</h2>
      <div className="space-y-2">
        {recentEvents.map((e: any) => (
          <div key={e.id} className="bg-white border border-border rounded-xl p-3 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate">{e.title}</div>
              <div className="text-xs text-sub">幹事: {e.hostName} ・ {e.partCount}人</div>
            </div>
            <div className="text-xs text-sub shrink-0">{e.created_at?.substring(0, 10)}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
