import { useState, useEffect } from 'react'
import { useEvent } from '../../hooks/useEvent'

export default function AdminUsers() {
  const { fetchAllUsers, fetchAllEvents, banUser } = useEvent()
  const [users, setUsers] = useState<any[]>([])
  const [events, setEvents] = useState<any[]>([])
  const [sortBy, setSortBy] = useState<'date' | 'events'>('date')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([fetchAllUsers(), fetchAllEvents()]).then(([uRes, eRes]) => {
      setUsers(uRes.data || [])
      setEvents(eRes.data || [])
      setLoading(false)
    })
  }, [])

  const getEventCount = (uid: string) => events.filter((e: any) => e.host_id === uid).length
  const getRank = (count: number) => count >= 15 ? '👑 プレミアム' : count >= 5 ? '🏅 認定' : '🎫 一般'

  const sorted = [...users].sort((a, b) => {
    if (sortBy === 'events') return getEventCount(b.id) - getEventCount(a.id)
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  const handleBan = async (u: any) => {
    const newVal = !u.is_banned
    if (!confirm(`${u.display_name}を${newVal ? '凍結' : '凍結解除'}しますか？`)) return
    await banUser(u.id, newVal)
    setUsers((prev) => prev.map((x) => x.id === u.id ? { ...x, is_banned: newVal } : x))
  }

  if (loading) return <div className="flex items-center justify-center py-12"><div className="w-8 h-8 border-4 border-green/30 border-t-green rounded-full animate-spin" /></div>

  return (
    <div className="p-4 max-w-[800px] mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-bold">ユーザー管理（{users.length}人）</h1>
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)} className="text-xs border border-border rounded-lg px-2 py-1">
          <option value="date">登録日順</option>
          <option value="events">イベント数順</option>
        </select>
      </div>
      <div className="space-y-2">
        {sorted.map((u) => {
          const count = getEventCount(u.id)
          return (
            <div key={u.id} className={`bg-white border rounded-xl p-3 ${u.is_banned ? 'border-red-200 bg-red-50/50' : 'border-border'}`}>
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{u.display_name || '名前なし'}</span>
                    {u.is_banned && <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">凍結</span>}
                    {u.is_admin && <span className="text-[10px] bg-green-light text-green-dark px-1.5 py-0.5 rounded-full">Admin</span>}
                  </div>
                  <div className="text-xs text-sub mt-0.5">
                    {getRank(count)} ・ イベント{count}件 ・ {u.created_at?.substring(0, 10)}
                  </div>
                </div>
                <button
                  onClick={() => handleBan(u)}
                  className={`text-xs px-2.5 py-1 rounded-full font-semibold ${u.is_banned ? 'bg-gray-bg text-sub' : 'bg-red-50 text-red-600'}`}
                >
                  {u.is_banned ? '解除' : '凍結'}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
