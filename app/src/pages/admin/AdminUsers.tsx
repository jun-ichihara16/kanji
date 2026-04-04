import { useState, useEffect } from 'react'
import { useEvent } from '../../hooks/useEvent'

export default function AdminUsers() {
  const { fetchAllUsers, fetchAllEvents, banUser, updateUserAdminInfo } = useEvent()
  const [users, setUsers] = useState<any[]>([])
  const [events, setEvents] = useState<any[]>([])
  const [sortBy, setSortBy] = useState<'date' | 'events'>('date')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [newTag, setNewTag] = useState('')
  const [editMemo, setEditMemo] = useState('')
  const [saving, setSaving] = useState(false)
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

  const handleExpand = (u: any) => {
    if (expandedId === u.id) { setExpandedId(null); return }
    setExpandedId(u.id)
    setEditMemo(u.admin_memo || '')
    setNewTag('')
  }

  const handleAddTag = (u: any) => {
    if (!newTag.trim()) return
    const tags = [...(u.admin_tags || []), newTag.trim()]
    setUsers((prev) => prev.map((x) => x.id === u.id ? { ...x, admin_tags: tags } : x))
    setNewTag('')
    saveTags(u.id, tags, editMemo)
  }

  const handleRemoveTag = (u: any, tag: string) => {
    const tags = (u.admin_tags || []).filter((t: string) => t !== tag)
    setUsers((prev) => prev.map((x) => x.id === u.id ? { ...x, admin_tags: tags } : x))
    saveTags(u.id, tags, editMemo)
  }

  const handleSaveMemo = async (u: any) => {
    setSaving(true)
    await updateUserAdminInfo(u.id, u.admin_tags || [], editMemo)
    setUsers((prev) => prev.map((x) => x.id === u.id ? { ...x, admin_memo: editMemo } : x))
    setSaving(false)
  }

  const saveTags = async (id: string, tags: string[], memo: string) => {
    await updateUserAdminInfo(id, tags, memo)
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
          const isExpanded = expandedId === u.id
          const tags: string[] = u.admin_tags || []
          return (
            <div key={u.id} className={`bg-white border rounded-xl overflow-hidden ${u.is_banned ? 'border-red-200 bg-red-50/50' : 'border-border'}`}>
              {/* ヘッダー行 */}
              <div className="p-3 flex items-center gap-3 cursor-pointer" onClick={() => handleExpand(u)}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold">{u.display_name || '名前なし'}</span>
                    {u.is_banned && <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">凍結</span>}
                    {u.is_admin && <span className="text-[10px] bg-green-light text-green-dark px-1.5 py-0.5 rounded-full">Admin</span>}
                    {tags.map((t) => (
                      <span key={t} className="text-[10px] bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full">{t}</span>
                    ))}
                  </div>
                  <div className="text-xs text-sub mt-0.5">
                    {getRank(count)} ・ イベント{count}件 ・ {u.created_at?.substring(0, 10)}
                  </div>
                </div>
                <span className="text-sub text-xs shrink-0">{isExpanded ? '▲' : '▼'}</span>
              </div>

              {/* 展開詳細 */}
              {isExpanded && (
                <div className="border-t border-border p-3 bg-gray-bg/30 space-y-3">
                  {/* タグ管理 */}
                  <div>
                    <label className="text-xs font-semibold text-sub block mb-1">タグ</label>
                    <div className="flex flex-wrap gap-1 mb-2">
                      {tags.map((t) => (
                        <span key={t} className="inline-flex items-center gap-1 bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full text-xs">
                          {t}
                          <button onClick={() => handleRemoveTag(u, t)} className="text-gray-400 hover:text-red-500">×</button>
                        </span>
                      ))}
                      {tags.length === 0 && <span className="text-xs text-sub">タグなし</span>}
                    </div>
                    <div className="flex gap-1">
                      <input
                        value={newTag}
                        onChange={(e) => setNewTag(e.target.value)}
                        placeholder="新しいタグを入力"
                        className="flex-1 p-2 text-xs border border-border rounded-lg focus:outline-none focus:border-green"
                        onKeyDown={(e) => { if (e.key === 'Enter') handleAddTag(u) }}
                      />
                      <button onClick={() => handleAddTag(u)} className="px-3 py-2 bg-green text-white text-xs font-bold rounded-lg">追加</button>
                    </div>
                  </div>

                  {/* メモ */}
                  <div>
                    <label className="text-xs font-semibold text-sub block mb-1">社内メモ</label>
                    <textarea
                      value={editMemo}
                      onChange={(e) => setEditMemo(e.target.value)}
                      rows={3}
                      className="w-full p-2 text-xs border border-border rounded-lg focus:outline-none focus:border-green resize-none"
                      placeholder="運営用のメモ（ユーザーには表示されません）"
                    />
                    <button
                      onClick={() => handleSaveMemo(u)}
                      disabled={saving}
                      className="mt-1 px-3 py-1.5 bg-green text-white text-xs font-bold rounded-lg disabled:opacity-40"
                    >
                      {saving ? '保存中...' : 'メモを保存'}
                    </button>
                  </div>

                  {/* アクション */}
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => handleBan(u)}
                      className={`text-xs px-3 py-1.5 rounded-lg font-semibold ${u.is_banned ? 'bg-gray-bg text-sub' : 'bg-red-50 text-red-600'}`}
                    >
                      {u.is_banned ? '凍結解除' : 'アカウント凍結'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
