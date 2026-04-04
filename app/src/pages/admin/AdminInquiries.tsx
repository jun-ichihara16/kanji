import { useState, useEffect } from 'react'
import { useEvent } from '../../hooks/useEvent'

const STATUS_OPTIONS = [
  { value: 'pending', label: '未対応', color: 'bg-amber-50 text-amber-700' },
  { value: 'in_progress', label: '対応中', color: 'bg-blue-50 text-blue-700' },
  { value: 'done', label: '完了', color: 'bg-green-light text-green-dark' },
]

export default function AdminInquiries() {
  const { fetchAllContacts, updateContactStatus } = useEvent()
  const [contacts, setContacts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAllContacts().then(({ data }) => {
      setContacts(data || [])
      setLoading(false)
    })
  }, [])

  const handleStatus = async (id: string, status: string) => {
    await updateContactStatus(id, status)
    setContacts((prev) => prev.map((c) => c.id === id ? { ...c, status } : c))
  }

  const categoryLabel: Record<string, string> = {
    question: 'ご質問', request: 'ご要望', bug: '不具合', other: 'その他',
  }

  if (loading) return <div className="flex items-center justify-center py-12"><div className="w-8 h-8 border-4 border-green/30 border-t-green rounded-full animate-spin" /></div>

  return (
    <div className="p-4 max-w-[800px] mx-auto">
      <h1 className="text-lg font-bold mb-4">お問い合わせ管理（{contacts.length}件）</h1>
      <div className="space-y-2">
        {contacts.map((c) => {
          const st = STATUS_OPTIONS.find((s) => s.value === (c.status || 'pending')) || STATUS_OPTIONS[0]
          return (
            <div key={c.id} className="bg-white border border-border rounded-xl p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="text-sm font-semibold">{c.name}</div>
                  <div className="text-xs text-sub">{c.email} ・ {categoryLabel[c.category] || c.category}</div>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${st.color}`}>{st.label}</span>
              </div>
              <p className="text-sm text-sub bg-gray-bg rounded-lg p-3 mb-3 whitespace-pre-wrap">{c.message}</p>
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
          )
        })}
        {contacts.length === 0 && <p className="text-center text-sub text-sm py-8">お問い合わせはまだありません</p>}
      </div>
    </div>
  )
}
