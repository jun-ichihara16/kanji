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
          お金のやり取りを、<br />
          <span className="text-green">もっと手軽に、気持ちよく。</span>
        </h1>
        <p className="text-sm text-sub leading-relaxed mb-7">
          割り勘計算からPayPay集金、未払い者への<br />
          リマインドまで。AIがすべて自動で行います。
        </p>
        <LineLoginButton />
        <div className="flex justify-center gap-3 mt-4">
          <div className="flex items-center gap-1 text-xs text-sub">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
            完全無料
          </div>
          <div className="flex items-center gap-1 text-xs text-sub">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
            10秒で登録
          </div>
          <div className="flex items-center gap-1 text-xs text-sub">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
            アプリ不要
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="grid grid-cols-3 gap-2 px-4 pb-6">
        {[
          { icon: '/app/img/icons/icon_warikan.png', label: '割り勘' },
          { icon: '/app/img/icons/icon_paypay.png', label: 'PayPay集金' },
          { icon: '/app/img/icons/icon_reminder.png', label: 'リマインド' },
        ].map((f) => (
          <div key={f.label} className="text-center py-4 px-2 bg-gray-bg rounded-xl">
            <img src={f.icon} alt={f.label} className="w-12 h-12 mx-auto mb-2" />
            <span className="text-xs font-semibold">{f.label}</span>
          </div>
        ))}
      </div>

      {/* 立替・精算・AI傾斜 */}
      <div className="grid grid-cols-3 gap-2 px-4 pb-6">
        <div className="text-center py-4 px-2 bg-green-light rounded-xl border border-green/20">
          <img src="/app/img/icons/icon_tatekae.png" alt="立替登録" className="w-12 h-12 mx-auto mb-2" />
          <span className="text-xs font-semibold text-green-dark">立替登録</span>
        </div>
        <div className="text-center py-4 px-2 bg-green-light rounded-xl border border-green/20">
          <img src="/app/img/icons/icon_seisan.png" alt="自動精算" className="w-12 h-12 mx-auto mb-2" />
          <span className="text-xs font-semibold text-green-dark">自動精算</span>
        </div>
        <div className="text-center py-4 px-2 bg-green-light rounded-xl border border-green/20">
          <img src="/app/img/icons/icon_keisha.svg" alt="AI傾斜設定" className="w-12 h-12 mx-auto mb-2" />
          <span className="text-xs font-semibold text-green-dark">AI傾斜設定</span>
        </div>
      </div>

      {/* How it works */}
      <div className="px-4 py-8 bg-white mt-4">
        <h2 className="text-lg font-bold text-center mb-6">AI KANJIで、幹事の仕事はこう変わります</h2>
        <div className="space-y-4">
          <div className="flex gap-4 items-start bg-gray-bg p-4 rounded-xl">
            <div className="flex-shrink-0 w-8 h-8 bg-green text-white rounded-full flex items-center justify-center font-bold">1</div>
            <div>
              <h3 className="font-bold text-sm mb-1">イベントを作ってLINEでシェア</h3>
              <p className="text-xs text-sub leading-relaxed">幹事の作業はこれだけ。参加者はLINEのリンクからワンタップで参加できます。</p>
            </div>
          </div>
          <div className="flex gap-4 items-start bg-gray-bg p-4 rounded-xl">
            <div className="flex-shrink-0 w-8 h-8 bg-green text-white rounded-full flex items-center justify-center font-bold">2</div>
            <div>
              <h3 className="font-bold text-sm mb-1">参加者が各自で立替を入力</h3>
              <p className="text-xs text-sub leading-relaxed">レシートを撮影するか、金額を入力するだけ。誰がいくら立て替えたか記録されます。</p>
            </div>
          </div>
          <div className="flex gap-4 items-start bg-gray-bg p-4 rounded-xl">
            <div className="flex-shrink-0 w-8 h-8 bg-green text-white rounded-full flex items-center justify-center font-bold">3</div>
            <div>
              <h3 className="font-bold text-sm mb-1">AIが自動計算＆PayPayで集金</h3>
              <p className="text-xs text-sub leading-relaxed">イベント終了後、誰が誰にいくら払うかをAIが最適化。ワンタップでPayPay送金が完了します。</p>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom CTA */}
      <div className="px-5 py-10 bg-gradient-to-t from-green-light to-white mt-auto text-center border-t border-green/10">
        <h2 className="text-lg font-bold mb-5">幹事のストレスから、<br />今すぐ解放されましょう。</h2>
        <LineLoginButton />
        <p className="text-xs text-sub mt-3 mb-8 font-medium">
          完全無料 / LINEで10秒登録
        </p>

        {/* Footer Links */}
        <div className="flex justify-center flex-wrap gap-x-4 gap-y-1 text-xs text-sub/70">
          <a href="/" className="hover:underline">サービスについて</a>
          <span>|</span>
          <a href="/terms.html" className="hover:underline">利用規約</a>
          <span>|</span>
          <a href="/privacy.html" className="hover:underline">プライバシーポリシー</a>
          <span>|</span>
          <a href="/contact.html" className="hover:underline">お問い合わせ</a>
        </div>
        <div className="mt-4 text-[10px] text-sub/50">
          &copy; 2026 AI KANJI All rights reserved.
        </div>
      </div>
    </div>
  )
}
