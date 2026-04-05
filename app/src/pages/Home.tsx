import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import LineLoginButton from '../components/LineLoginButton'

export default function Home() {
  const { isLoggedIn, loading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!loading && isLoggedIn) {
      navigate('/dashboard', { replace: true })
    }
  }, [loading, isLoggedIn, navigate])

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-green/30 border-t-green rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* Hero */}
      <div className="px-5 pt-10 pb-8 text-center bg-gradient-to-b from-green-light to-white">
        <div className="flex items-center justify-center gap-2 text-2xl font-extrabold text-green mb-5">
          <img src="/app/img/kanji_logo.png" alt="" width={40} height={40} />
          AI KANJI
        </div>
        <h1 className="text-2xl font-extrabold leading-snug mb-3">
          幹事を、もっと<br />
          <span className="text-green">ラクに。得に。</span>
        </h1>
        <p className="text-sm text-sub leading-relaxed mb-7">
          割り勘計算・PayPay番号収集・<br />
          支払いリマインドが全自動。
        </p>
        <LineLoginButton />
      </div>

      {/* Features */}
      <div className="grid grid-cols-3 gap-2 px-4 pb-6">
        {[
          { icon: '💰', label: '割り勘' },
          { icon: '📱', label: 'PayPay集金' },
          { icon: '🔔', label: 'リマインド' },
        ].map((f) => (
          <div key={f.label} className="text-center py-4 px-2 bg-gray-bg rounded-xl">
            <div className="text-2xl mb-1">{f.icon}</div>
            <span className="text-xs font-semibold">{f.label}</span>
          </div>
        ))}
      </div>

      {/* 立替・精算 */}
      <div className="grid grid-cols-2 gap-2 px-4 pb-6">
        <div className="text-center py-4 px-2 bg-green-light rounded-xl border border-green/20">
          <div className="text-2xl mb-1">🧾</div>
          <span className="text-xs font-semibold text-green-dark">立替登録</span>
        </div>
        <div className="text-center py-4 px-2 bg-green-light rounded-xl border border-green/20">
          <div className="text-2xl mb-1">🔄</div>
          <span className="text-xs font-semibold text-green-dark">自動精算</span>
        </div>
      </div>

      <div className="px-4 pb-8 mt-auto">
        <p className="text-center text-xs text-sub mb-3">
          LINEアカウントで無料で始められます
        </p>
      </div>
    </div>
  )
}
