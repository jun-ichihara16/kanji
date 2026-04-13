import { useState, useEffect } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useEvent } from '../../hooks/useEvent'

const STATUS_OPTIONS = [
  { value: 'pending', label: '未対応', color: 'bg-amber-50 text-amber-700' },
  { value: 'in_progress', label: '対応中', color: 'bg-blue-50 text-blue-700' },
  { value: 'done', label: '完了', color: 'bg-green-light text-green-dark' },
]

export default function AdminInquiries() {
  const { user } = useAuth()
  const { fetchAllContacts, updateContactStatus, replyContact } = useEvent()
  const [contacts, setContacts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [replyingId, setReplyingId] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!user?.id) return
    fetchAllContacts(user.id).then(({ data }) => {
      setContacts(data || [])
      setLoading(false)
    })
  }, [user])

  const handleStatus = async (id: string, status: string) => {
    await updateContactStatus(user!.id, id, status)
    setContacts((prev) => prev.map((c) => c.id === id ? { ...c, status } : c))
  }

  const handleReply = async (id: string) => {
    if (!replyText.trim()) return
    setSaving(true)
    const { data } = await replyContact(user!.id, id, replyText.trim())
    if (data) {
      setContacts((prev) => prev.map((c) => c.id === id ? data : c))
    }
    setSaving(false)
    setReplyingId(null)
    setReplyText('')
  }

  const categoryLabel: Record<string, string> = {
    question: 'ご質問', request: 'ご要望', bug: '不具合', other: 'その他',
  }

  if (loading) return <div className="flex items-center justify-center py-12"><div className="w-8 h-8 border-4 border-green/30 border-t-green rounded-full animate-spin" /></div>

  return (
    <div className="p-4 max-w-[800px] mx-auto">
      <h1 className="text-lg font-bold mb-4">お問い合わせ管理（{contacts.length}件）</h1>
      <div className="space-y-3">
        {contacts.map((c) => {
          const st = STATUS_OPTIONS.find((s) => s.value === (c.status || 'pending')) || STATUS_OPTIONS[0]
          return (
            <div key={c.id} className="bg-white border border-border rounded-xl overflow-hidden">
              <div className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="text-sm font-semibold">{c.name}</div>
                    <div className="text-xs text-sub">{c.email} ・ {categoryLabel[c.category] || c.category}</div>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0 ${st.color}`}>{st.label}</span>
                </div>

                {/* 問い合わせ内容 */}
                <div className="bg-gray-bg rounded-lg p-3 mb-3">
                  <p className="text-sm text-sub whitespace-pre-wrap">{c.message}</p>
                </div>

                {/* 運営返信 */}
                {c.admin_reply ? (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-semibold">運営返信済み</span>
                      {c.replied_at && <span className="text-[10px] text-sub">{c.replied_at.substring(0, 10)}</span>}
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{c.admin_reply}</p>
                  </div>
                ) : replyingId === c.id ? (
                  <div className="mb-3">
                    <textarea
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      rows={3}
                      placeholder="返信内容を入力..."
                      className="w-full p-3 border border-border rounded-lg text-sm focus:outline-none focus:border-green resize-none mb-2"
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleReply(c.id)}
                        disabled={!replyText.trim() || saving}
                        className="px-4 py-2 bg-green text-white text-xs font-bold rounded-lg disabled:opacity-40 hover:bg-green-dark transition"
                      >
                        {saving ? '保存中...' : '返信を保存'}
                      </button>
                      <button onClick={() => { setReplyingId(null); setReplyText('') }} className="px-4 py-2 bg-gray-bg text-sub text-xs rounded-lg">取消</button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => { setReplyingId(c.id); setReplyText('') }}
                    className="text-xs text-green font-semibold hover:underline mb-3 block"
                  >
                    返信を入力 →
                  </button>
                )}

                {/* ステータス + 日付 */}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-sub">{c.created_at?.substring(0, 10)}</span>
                  <div className="flex gap-1">
                    {STATUS_OPTIONS.map((s) => (
                      <button
                        key={s.value}
                        onClick={() => handleStatus(c.id, s.value)}
                        className={`text-[10px] px-2 py-1 rounded-full font-semibold transition ${
                          (c.status || 'pending') === s.value ? s.color : 'bg-gray-bg text-sub hover:bg-border'
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
        {contacts.length === 0 && <p className="text-center text-sub text-sm py-8">お問い合わせはまだありません</p>}
      </div>
    </div>
  )
}
