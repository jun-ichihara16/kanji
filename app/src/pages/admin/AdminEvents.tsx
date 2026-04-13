import { useState, useEffect } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useEvent } from '../../hooks/useEvent'

function getSizeBadge(partCount: number, totalAmount: number) {
  if (partCount >= 20 || totalAmount >= 100000) return { label: 'S', color: 'bg-red-100 text-red-700' }
  if (partCount >= 10 || totalAmount >= 50000) return { label: 'A', color: 'bg-orange-100 text-orange-700' }
  if (partCount >= 5 || totalAmount >= 20000) return { label: 'B', color: 'bg-blue-100 text-blue-700' }
  return { label: 'C', color: 'bg-gray-100 text-gray-700' }
}

export default function AdminEvents() {
  const { user } = useAuth()
  const { fetchAllEvents, fetchAllUsers, fetchAllParticipants, fetchAllAdvances, forceDeleteEvent } = useEvent()
  const [events, setEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([fetchAllEvents(), fetchAllUsers(), fetchAllParticipants(), fetchAllAdvances()]).then(([eRes, uRes, pRes, aRes]) => {
      const users = uRes.data || []
      const parts = pRes.data || []
      const advances = aRes.data || []
      setEvents((eRes.data || []).map((e: any) => ({
        ...e,
        hostName: users.find((u: any) => u.id === e.host_id)?.display_name || '不明',
        partCount: parts.filter((p: any) => p.event_id === e.id).length,
        totalAmount: advances.filter((a: any) => a.event_id === e.id).reduce((s: number, a: any) => s + a.amount, 0),
      })))
      setLoading(false)
    })
  }, [])

  const handleDelete = async (e: any) => {
    if (!confirm(`「${e.title}」を強制削除しますか？\n関連する参加者・立替データもすべて削除されます。`)) return
    await forceDeleteEvent(user!.id, e.id)
    setEvents((prev) => prev.filter((x) => x.id !== e.id))
  }

  if (loading) return <div className="flex items-center justify-center py-12"><div className="w-8 h-8 border-4 border-green/30 border-t-green rounded-full animate-spin" /></div>

  return (
    <div className="p-4 max-w-[800px] mx-auto">
      <h1 className="text-lg font-bold mb-4">イベント監視（{events.length}件）</h1>
      <div className="space-y-2">
        {events.map((e) => {
          const size = getSizeBadge(e.partCount, e.totalAmount)
          const isArchived = e.status === 'archived'
          return (
            <div key={e.id} className={`bg-white border rounded-xl p-3 ${isArchived ? 'border-border opacity-70' : 'border-border'}`}>
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap mb-1">
                    <span className="text-sm font-semibold truncate">{e.title}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${size.color}`}>{size.label}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                      isArchived ? 'bg-green-light text-green-dark' : 'bg-blue-50 text-blue-700'
                    }`}>
                      {isArchived ? '完了' : '進行中'}
                    </span>
                  </div>
                  <div className="text-xs text-sub">
                    幹事: {e.hostName} ・ {e.event_date || '日程未定'}
                  </div>
                  <div className="flex gap-3 mt-1 text-xs text-sub">
                    <span>👥 {e.partCount}人</span>
                    <span className="font-inter">💰 ¥{e.totalAmount.toLocaleString()}</span>
                  </div>
                </div>
                <button onClick={() => handleDelete(e)} className="text-xs text-red-400 hover:text-red-600 shrink-0 mt-1">削除</button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
