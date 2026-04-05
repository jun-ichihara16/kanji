import { useState, useEffect, useMemo } from 'react'
import { useEvent } from '../../hooks/useEvent'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

export default function AdminDashboard() {
  const { fetchAllUsers, fetchAllEvents, fetchAllParticipants, fetchAllAdvances } = useEvent()
  const [allUsers, setAllUsers] = useState<any[]>([])
  const [allEvents, setAllEvents] = useState<any[]>([])
  const [allParts, setAllParts] = useState<any[]>([])
  const [allAdvances, setAllAdvances] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([fetchAllUsers(), fetchAllEvents(), fetchAllParticipants(), fetchAllAdvances()]).then(([uRes, eRes, pRes, aRes]) => {
      setAllUsers(uRes.data || [])
      setAllEvents(eRes.data || [])
      setAllParts(pRes.data || [])
      setAllAdvances(aRes.data || [])
      setLoading(false)
    })
  }, [])

  // 日付ヘルパー
  const now = new Date()
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const lastMonth = (() => {
    const d = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })()

  // === KGI指標 ===
  const kgis = useMemo(() => {
    // MAU: 今月イベントを作成/更新した幹事数
    const mauIds = new Set(allEvents.filter((e) => e.created_at?.substring(0, 7) === thisMonth).map((e) => e.host_id).filter(Boolean))
    const lastMauIds = new Set(allEvents.filter((e) => e.created_at?.substring(0, 7) === lastMonth).map((e) => e.host_id).filter(Boolean))

    // GMV: 今月の立替総額
    const thisMonthEventIds = new Set(allEvents.filter((e) => e.created_at?.substring(0, 7) === thisMonth).map((e) => e.id))
    const gmv = allAdvances.filter((a) => thisMonthEventIds.has(a.event_id)).reduce((s, a) => s + a.amount, 0)
    const lastMonthEventIds = new Set(allEvents.filter((e) => e.created_at?.substring(0, 7) === lastMonth).map((e) => e.id))
    const lastGmv = allAdvances.filter((a) => lastMonthEventIds.has(a.event_id)).reduce((s, a) => s + a.amount, 0)

    // 総利用者数: 幹事 + ユニーク参加者名
    const uniqueGuests = new Set(allParts.map((p) => p.name))
    const totalUsers = allUsers.length + uniqueGuests.size

    return {
      mau: mauIds.size,
      lastMau: lastMauIds.size,
      gmv,
      lastGmv,
      totalUsers,
      // K-factor: TODO - 招待トラッキング未実装
      kFactor: null as number | null,
    }
  }, [allUsers, allEvents, allParts, allAdvances, thisMonth, lastMonth])

  // === Activationファネル ===
  const funnel = useMemo(() => {
    const thisMonthUsers = allUsers.filter((u) => u.created_at?.substring(0, 7) === thisMonth)
    const registered = thisMonthUsers.length
    const onboarded = thisMonthUsers.filter((u) => u.onboarding_completed).length
    const createdEvent = thisMonthUsers.filter((u) => allEvents.some((e) => e.host_id === u.id)).length

    return { registered, onboarded, createdEvent }
  }, [allUsers, allEvents, thisMonth])

  // === 運用・品質指標 ===
  const ops = useMemo(() => {
    // 過去30日のイベント
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const recentEvents = allEvents.filter((e) => e.created_at >= thirtyDaysAgo)
    const archivedCount = recentEvents.filter((e) => e.status === 'archived').length
    const settlementRate = recentEvents.length > 0 ? Math.round((archivedCount / recentEvents.length) * 100) : 0

    // PayPay番号収集率
    const paypayCount = allParts.filter((p) => p.payment_method === 'paypay' && p.paypay_phone).length
    const paypayRate = allParts.length > 0 ? Math.round((paypayCount / allParts.length) * 100) : 0

    return { settlementRate, paypayRate, recentEventCount: recentEvents.length }
  }, [allEvents, allParts])

  // === 月次推移 ===
  const chartData = useMemo(() => {
    const months: string[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
    }
    return months.map((m) => ({
      month: m.substring(5),
      users: allUsers.filter((u) => u.created_at?.substring(0, 7) === m).length,
      events: allEvents.filter((e) => e.created_at?.substring(0, 7) === m).length,
    }))
  }, [allUsers, allEvents])

  const getMoM = (current: number, prev: number) => {
    if (prev === 0) return current > 0 ? '+∞' : '—'
    const pct = Math.round(((current - prev) / prev) * 100)
    return pct >= 0 ? `+${pct}%` : `${pct}%`
  }

  if (loading) return <div className="flex items-center justify-center py-12"><div className="w-8 h-8 border-4 border-green/30 border-t-green rounded-full animate-spin" /></div>

  return (
    <div className="p-4 max-w-[800px] mx-auto">
      <h1 className="text-lg font-bold mb-1">事業ダッシュボード</h1>
      <p className="text-xs text-sub mb-4">{thisMonth} のデータ</p>

      {/* === 1. KGI カード === */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-white border border-border rounded-xl p-4">
          <div className="text-xs text-sub mb-1">MAU（月間アクティブ幹事）</div>
          <div className="font-inter text-2xl font-extrabold text-green">{kgis.mau}</div>
          <div className={`text-[10px] font-semibold mt-0.5 ${kgis.mau >= kgis.lastMau ? 'text-green' : 'text-red-500'}`}>
            前月比 {getMoM(kgis.mau, kgis.lastMau)}
          </div>
        </div>
        <div className="bg-white border border-border rounded-xl p-4">
          <div className="text-xs text-sub mb-1">当月GMV（流通総額）</div>
          <div className="font-inter text-2xl font-extrabold">¥{kgis.gmv.toLocaleString()}</div>
          <div className={`text-[10px] font-semibold mt-0.5 ${kgis.gmv >= kgis.lastGmv ? 'text-green' : 'text-red-500'}`}>
            前月比 {getMoM(kgis.gmv, kgis.lastGmv)}
          </div>
        </div>
        <div className="bg-white border border-border rounded-xl p-4">
          <div className="text-xs text-sub mb-1">総利用者数</div>
          <div className="font-inter text-2xl font-extrabold">{kgis.totalUsers}</div>
          <div className="text-[10px] text-sub mt-0.5">幹事 {allUsers.length} + ゲスト {kgis.totalUsers - allUsers.length}</div>
        </div>
        <div className="bg-white border border-border rounded-xl p-4">
          <div className="text-xs text-sub mb-1">バイラル係数（K-factor）</div>
          <div className="font-inter text-2xl font-extrabold text-sub">—</div>
          <div className="text-[10px] text-sub mt-0.5">※招待トラッキング未実装</div>
          {/* TODO: referral_source カラムをusersに追加し、招待元user_idを記録 → K = 招待経由の新規幹事数 / 全幹事数 */}
        </div>
      </div>

      {/* === 2. Activation ファネル === */}
      <div className="bg-white border border-border rounded-xl p-4 mb-6">
        <h2 className="text-sm font-bold mb-3">Activation ファネル（当月）</h2>
        <div className="space-y-3">
          {[
            { label: '新規登録', value: funnel.registered, pct: 100 },
            { label: 'オンボーディング完了', value: funnel.onboarded, pct: funnel.registered > 0 ? Math.round((funnel.onboarded / funnel.registered) * 100) : 0 },
            { label: '初回イベント作成', value: funnel.createdEvent, pct: funnel.registered > 0 ? Math.round((funnel.createdEvent / funnel.registered) * 100) : 0 },
          ].map((step, i) => (
            <div key={step.label}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold">{i + 1}. {step.label}</span>
                <span className="text-xs font-inter">
                  <strong>{step.value}人</strong>
                  <span className="text-sub ml-1">({step.pct}%)</span>
                </span>
              </div>
              <div className="h-2.5 bg-border rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${i === 0 ? 'bg-green' : i === 1 ? 'bg-blue-400' : 'bg-amber-400'}`}
                  style={{ width: `${step.pct}%` }}
                />
              </div>
            </div>
          ))}
        </div>
        {funnel.registered > 0 && funnel.onboarded < funnel.registered && (
          <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-2 text-[10px] text-amber-700">
            ⚠️ オンボーディング完了率が{Math.round((funnel.onboarded / funnel.registered) * 100)}%です。利用規約同意フローの離脱が疑われます。
          </div>
        )}
      </div>

      {/* === 3. 運用・品質指標 === */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-white border border-border rounded-xl p-4">
          <div className="text-xs text-sub mb-1">精算完了率（過去30日）</div>
          <div className="font-inter text-2xl font-extrabold">{ops.settlementRate}%</div>
          <div className="text-[10px] text-sub mt-0.5">{ops.recentEventCount}件中</div>
        </div>
        <div className="bg-white border border-border rounded-xl p-4">
          <div className="text-xs text-sub mb-1">PayPay番号収集率</div>
          <div className="font-inter text-2xl font-extrabold">{ops.paypayRate}%</div>
          <div className="text-[10px] text-sub mt-0.5">{allParts.length}人中</div>
        </div>
      </div>

      {/* === 4. 月次推移グラフ === */}
      <div className="bg-white border border-border rounded-xl p-4 mb-6">
        <h2 className="text-sm font-bold mb-3">月次推移（過去6ヶ月）</h2>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis dataKey="month" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="users" name="新規幹事" fill="#22C55E" radius={[4, 4, 0, 0]} />
            <Bar dataKey="events" name="新規イベント" fill="#3B82F6" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* === 5. 最近のイベント === */}
      <h2 className="text-sm font-bold mb-2">最近のイベント</h2>
      <div className="space-y-2">
        {allEvents.slice(0, 5).map((e: any) => {
          const host = allUsers.find((u: any) => u.id === e.host_id)
          const partCount = allParts.filter((p: any) => p.event_id === e.id).length
          const total = allAdvances.filter((a: any) => a.event_id === e.id).reduce((s: number, a: any) => s + a.amount, 0)
          return (
            <div key={e.id} className="bg-white border border-border rounded-xl p-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate">{e.title}</div>
                <div className="text-xs text-sub">
                  {host?.display_name || '不明'} ・ {partCount}人 ・ ¥{total.toLocaleString()}
                </div>
              </div>
              <div className="text-xs text-sub shrink-0">{e.created_at?.substring(0, 10)}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
