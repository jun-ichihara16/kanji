import { useState, useEffect } from 'react'
import { useEvent } from '../../hooks/useEvent'

export default function AdminEvents() {
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
    if (!confirm(`「${e.title}」を強制削除しますか？`)) return
    await forceDeleteEvent(e.id)
    setEvents((prev) => prev.filter((x) => x.id !== e.id))
  }

  if (loading) return <div className="flex items-center justify-center py-12"><div className="w-8 h-8 border-4 border-green/30 border-t-green rounded-full animate-spin" /></div>

  return (
    <div className="p-4 max-w-[800px] mx-auto">
      <h1 className="text-lg font-bold mb-4">イベント監視（{events.length}件）</h1>
      <div className="space-y-2">
        {events.map((e) => (
          <div key={e.id} className="bg-white border border-border rounded-xl p-3">
            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate">{e.title}</div>
                <div className="text-xs text-sub">
                  幹事: {e.hostName} ・ {e.partCount}人 ・ ¥{e.totalAmount.toLocaleString()}
                </div>
                <div className="text-xs text-sub">{e.event_date || '日程未定'} ・ {e.status === 'archived' ? '完了' : '進行中'}</div>
              </div>
              <button onClick={() => handleDelete(e)} className="text-xs text-red-400 hover:text-red-600 shrink-0">削除</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
