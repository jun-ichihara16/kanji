import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getLocalUser, setLocalUser } from '../lib/auth'
import { supabase } from '../lib/supabase'

type Step = 'welcome' | 'terms' | 'complete'

const TOTAL_STEPS = 3

const stepIndex: Record<Step, number> = {
  welcome: 1,
  terms: 2,
  complete: 3,
}

export default function Onboarding() {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('welcome')
  const [termsAgreed, setTermsAgreed] = useState(false)
  const [privacyAgreed, setPrivacyAgreed] = useState(false)

  const user = getLocalUser()

  // Already completed onboarding → redirect
  useEffect(() => {
    if (!user) {
      navigate('/', { replace: true })
      return
    }
    if (user.onboardingCompleted) {
      navigate('/dashboard', { replace: true })
    }
  }, [])

  const completeOnboarding = async () => {
    if (!user) return
    // Update local storage
    const updated = { ...user, onboardingCompleted: true }
    setLocalUser(updated)

    // Update database
    try {
      await supabase
        .from('users')
        .update({ onboarding_completed: true })
        .eq('id', user.id)
    } catch (e) {
      console.error('Failed to update onboarding status:', e)
    }

    setStep('complete')
  }

  const currentStep = stepIndex[step]
  const progress = (currentStep / TOTAL_STEPS) * 100

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center gap-1.5 text-lg font-extrabold text-green mb-3">
          <img src="/kanji/app/img/kanji_logo.png" alt="" width={24} height={24} />
          AI KANJI
        </div>
        {/* Progress bar */}
        <div className="h-1.5 bg-border rounded-full overflow-hidden">
          <div
            className="h-full bg-green rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="text-right text-xs text-sub mt-1">
          STEP {currentStep}/{TOTAL_STEPS}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-8">
        {/* STEP 1: Welcome */}
        {step === 'welcome' && (
          <div className="pt-8">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-green-light rounded-2xl flex items-center justify-center mx-auto mb-4">
                <img src="/kanji/app/img/kanji_logo.png" alt="" width={40} height={40} />
              </div>
              <h1 className="text-2xl font-extrabold mb-3">AI KANJIへようこそ！</h1>
              <p className="text-sm text-sub leading-relaxed">
                幹事のお金まわりを、LINEだけで解決。<br />
                割り勘・PayPay精算がひとつで完結します。
              </p>
            </div>

            <div className="bg-gray-bg rounded-2xl p-5 mb-8">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-light rounded-xl flex items-center justify-center shrink-0">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                  </svg>
                </div>
                <span className="text-sm font-semibold">LINEで割り勘・精算が完結</span>
              </div>
            </div>

            <button
              onClick={() => setStep('terms')}
              className="w-full py-4 bg-green text-white font-bold rounded-xl hover:bg-green-dark transition"
            >
              はじめる
            </button>
          </div>
        )}

        {/* STEP 2: Terms & Privacy */}
        {step === 'terms' && (
          <div className="pt-8">
            <h1 className="text-xl font-extrabold mb-2 text-center">ご利用にあたって</h1>
            <p className="text-sm text-sub text-center mb-8">
              サービスのご利用には以下への同意が必要です。
            </p>

            <div className="space-y-3 mb-6">
              {/* Terms checkbox */}
              <label className="flex items-start gap-3 p-4 bg-white border border-border rounded-xl cursor-pointer hover:border-green/50 transition">
                <input
                  type="checkbox"
                  checked={termsAgreed}
                  onChange={(e) => setTermsAgreed(e.target.checked)}
                  className="mt-0.5 w-5 h-5 accent-green shrink-0"
                />
                <div>
                  <span className="text-sm font-semibold">利用規約に同意する</span>
                  <a
                    href="https://jun-ichihara16.github.io/kanji/terms.html"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-xs text-green mt-1 hover:underline"
                  >
                    利用規約を読む →
                  </a>
                </div>
              </label>

              {/* Privacy checkbox */}
              <label className="flex items-start gap-3 p-4 bg-white border border-border rounded-xl cursor-pointer hover:border-green/50 transition">
                <input
                  type="checkbox"
                  checked={privacyAgreed}
                  onChange={(e) => setPrivacyAgreed(e.target.checked)}
                  className="mt-0.5 w-5 h-5 accent-green shrink-0"
                />
                <div>
                  <span className="text-sm font-semibold">プライバシーポリシーに同意する</span>
                  <a
                    href="https://jun-ichihara16.github.io/kanji/privacy.html"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-xs text-green mt-1 hover:underline"
                  >
                    プライバシーポリシーを読む →
                  </a>
                </div>
              </label>
            </div>

            <p className="text-xs text-sub text-center mb-6">
              同意いただけない場合、本サービスをご利用いただけません。
            </p>

            <div className="flex gap-2">
              <button
                onClick={() => setStep('welcome')}
                className="px-5 py-4 bg-gray-bg text-sub rounded-xl text-sm font-semibold"
              >
                ← 戻る
              </button>
              <button
                onClick={completeOnboarding}
                disabled={!termsAgreed || !privacyAgreed}
                className="flex-1 py-4 bg-green text-white font-bold rounded-xl disabled:opacity-40 disabled:cursor-not-allowed hover:bg-green-dark transition"
              >
                同意して次へ
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Complete */}
        {step === 'complete' && (
          <div className="pt-12 text-center">
            <div className="w-16 h-16 rounded-full bg-green flex items-center justify-center mx-auto mb-5">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h1 className="text-2xl font-extrabold mb-3">登録完了！</h1>
            <p className="text-sm text-sub leading-relaxed mb-8">
              AI KANJIの準備ができました。<br />
              さっそくイベントを作成しましょう！
            </p>
            <button
              onClick={() => {
                window.location.href = '/kanji/app/dashboard'
              }}
              className="w-full py-4 bg-green text-white font-bold rounded-xl hover:bg-green-dark transition"
            >
              ダッシュボードへ
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
