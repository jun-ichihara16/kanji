import { useState, useEffect } from 'react'
import { useEvent } from '../../hooks/useEvent'

const PLANS = ['成果報酬', '掲載のみ', '無料']
const STATUSES = [
  { value: 'active', label: '契約中', color: 'bg-green-light text-green-dark' },
  { value: 'pending', label: '審査中', color: 'bg-amber-50 text-amber-700' },
  { value: 'inactive', label: '停止', color: 'bg-gray-bg text-sub' },
]

const emptyForm = { name: '', area: '', plan: '成果報酬', status: 'pending', contact_name: '', contact_email: '', memo: '' }

export default function AdminVenues() {
  const { fetchAllVenues, createVenue, updateVenue, deleteVenue } = useEvent()
  const [venues, setVenues] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchAllVenues().then(({ data }) => {
      setVenues(data || [])
      setLoading(false)
    })
  }, [])

  const openCreate = () => {
    setEditId(null)
    setForm(emptyForm)
    setShowModal(true)
  }

  const openEdit = (v: any) => {
    setEditId(v.id)
    setForm({
      name: v.name || '',
      area: v.area || '',
      plan: v.plan || '成果報酬',
      status: v.status || 'pending',
      contact_name: v.contact_name || '',
      contact_email: v.contact_email || '',
      memo: v.memo || '',
    })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.name.trim() || !form.area.trim()) return
    setSaving(true)
    if (editId) {
      const { data } = await updateVenue(editId, form)
      if (data) setVenues((prev) => prev.map((v) => v.id === editId ? data : v))
    } else {
      const { data } = await createVenue(form)
      if (data) setVenues((prev) => [data, ...prev])
    }
    setSaving(false)
    setShowModal(false)
  }

  const handleDelete = async () => {
    if (!editId || !confirm('この店舗を削除しますか？')) return
    await deleteVenue(editId)
    setVenues((prev) => prev.filter((v) => v.id !== editId))
    setShowModal(false)
  }

  const getStatusStyle = (status: string) => STATUSES.find((s) => s.value === status) || STATUSES[2]

  if (loading) return <div className="flex items-center justify-center py-12"><div className="w-8 h-8 border-4 border-green/30 border-t-green rounded-full animate-spin" /></div>

  return (
    <div className="p-4 max-w-[800px] mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-bold">提携店舗管理（{venues.length}件）</h1>
        <button onClick={openCreate} className="text-xs bg-green text-white font-bold px-3 py-1.5 rounded-lg hover:bg-green-dark transition">
          + 店舗を追加
        </button>
      </div>

      {venues.length === 0 ? (
        <div className="text-center py-12 text-sub text-sm">まだ店舗が登録されていません</div>
      ) : (
        <div className="space-y-2">
          {venues.map((v) => {
            const st = getStatusStyle(v.status)
            return (
              <div key={v.id} className="bg-white border border-border rounded-xl p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="text-sm font-semibold">{v.name}</div>
                    <div className="flex gap-1.5 mt-1 flex-wrap">
                      <span className="text-[10px] bg-green-light text-green-dark px-2 py-0.5 rounded-full">{v.area}</span>
                      <span className="text-[10px] bg-gray-bg text-sub px-2 py-0.5 rounded-full">{v.plan}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${st.color}`}>{st.label}</span>
                    </div>
                  </div>
                  <button onClick={() => openEdit(v)} className="text-xs text-sub hover:text-green shrink-0">編集</button>
                </div>
                <div className="flex gap-4 text-xs text-sub">
                  <span>送客イベント: <strong className="text-[#1A1A1A]">0件</strong></span>
                  <span>送客人数: <strong className="text-[#1A1A1A]">0人</strong></span>
                </div>
                {v.contact_name && <div className="text-xs text-sub mt-1">担当: {v.contact_name}</div>}
              </div>
            )
          })}
        </div>
      )}

      {/* モーダル */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl p-5 max-w-[380px] w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-bold mb-4">{editId ? '店舗を編集' : '店舗を追加'}</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-sub mb-1 block">店舗名 *</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full p-2.5 border border-border rounded-xl text-sm bg-gray-bg focus:outline-none focus:border-green" />
              </div>
              <div>
                <label className="text-xs font-semibold text-sub mb-1 block">エリア *</label>
                <input value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })}
                  placeholder="例: 渋谷" className="w-full p-2.5 border border-border rounded-xl text-sm bg-gray-bg focus:outline-none focus:border-green" />
              </div>
              <div>
                <label className="text-xs font-semibold text-sub mb-1 block">契約プラン</label>
                <select value={form.plan} onChange={(e) => setForm({ ...form, plan: e.target.value })}
                  className="w-full p-2.5 border border-border rounded-xl text-sm bg-gray-bg focus:outline-none focus:border-green">
                  {PLANS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-sub mb-1 block">ステータス</label>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className="w-full p-2.5 border border-border rounded-xl text-sm bg-gray-bg focus:outline-none focus:border-green">
                  {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-sub mb-1 block">担当者名</label>
                <input value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
                  className="w-full p-2.5 border border-border rounded-xl text-sm bg-gray-bg focus:outline-none focus:border-green" />
              </div>
              <div>
                <label className="text-xs font-semibold text-sub mb-1 block">担当者メール</label>
                <input type="email" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
                  className="w-full p-2.5 border border-border rounded-xl text-sm bg-gray-bg focus:outline-none focus:border-green" />
              </div>
              <div>
                <label className="text-xs font-semibold text-sub mb-1 block">運営用メモ</label>
                <textarea value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })} rows={3}
                  className="w-full p-2.5 border border-border rounded-xl text-sm bg-gray-bg focus:outline-none focus:border-green resize-none" />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowModal(false)} className="flex-1 py-3 bg-gray-bg text-sub rounded-xl text-sm font-semibold">取消</button>
              <button onClick={handleSave} disabled={!form.name.trim() || !form.area.trim() || saving}
                className="flex-1 py-3 bg-green text-white rounded-xl text-sm font-bold disabled:opacity-40 hover:bg-green-dark transition">
                {saving ? '保存中...' : '保存'}
              </button>
            </div>
            {editId && (
              <button onClick={handleDelete} className="w-full mt-3 text-center text-xs text-red-400 hover:text-red-600 transition">
                この店舗を削除する
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
