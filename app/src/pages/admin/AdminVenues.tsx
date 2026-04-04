import { useState } from 'react'

// モックデータ（将来的にDBから取得）
const MOCK_VENUES = [
  { id: 1, name: '個室居酒屋 灯り', area: '渋谷', plan: 'スタンダード', status: 'active', events: 12, guests: 340 },
  { id: 2, name: '貸切レストラン SALON', area: '新宿', plan: 'プレミアム', status: 'active', events: 8, guests: 520 },
  { id: 3, name: '海鮮居酒屋 磯丸', area: '銀座', plan: 'スタンダード', status: 'pending', events: 0, guests: 0 },
]

export default function AdminVenues() {
  const [venues] = useState(MOCK_VENUES)

  return (
    <div className="p-4 max-w-[800px] mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-bold">提携店舗管理（{venues.length}件）</h1>
        <span className="text-xs bg-amber-50 text-amber-700 px-2 py-1 rounded-full">モックアップ</span>
      </div>
      <div className="space-y-2">
        {venues.map((v) => (
          <div key={v.id} className="bg-white border border-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="text-sm font-semibold">{v.name}</div>
                <div className="flex gap-1.5 mt-1">
                  <span className="text-[10px] bg-green-light text-green-dark px-2 py-0.5 rounded-full">{v.area}</span>
                  <span className="text-[10px] bg-gray-bg text-sub px-2 py-0.5 rounded-full">{v.plan}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${v.status === 'active' ? 'bg-green-light text-green-dark' : 'bg-amber-50 text-amber-700'}`}>
                    {v.status === 'active' ? '契約中' : '審査中'}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex gap-4 text-xs text-sub">
              <span>送客イベント: <strong className="text-[#1A1A1A]">{v.events}件</strong></span>
              <span>送客人数: <strong className="text-[#1A1A1A]">{v.guests}人</strong></span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
