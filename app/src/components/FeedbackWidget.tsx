import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

type FeedbackSource = 'footer' | 'event_complete' | 'error_banner' | 'other'
type FeedbackCategory = 'bug' | 'feature_request' | 'ux' | 'praise' | 'other'

interface Props {
  /** 埋め込み位置（ログ用） */
  source?: FeedbackSource
  /** 関連イベント（任意） */
  eventId?: string
  /** 初期表示でモーダルを開く */
  defaultOpen?: boolean
  /** 閉じた時のコールバック */
  onClose?: () => void
  /** ボタンを表示しない（モーダルのみ使う場合） */
  hideButton?: boolean
}

const CATEGORY_OPTIONS: { value: FeedbackCategory; label: string; emoji: string }[] = [
  { value: 'bug', label: '不具合', emoji: '🐛' },
  { value: 'feature_request', label: '機能要望', emoji: '💡' },
  { value: 'ux', label: '使いやすさ', emoji: '🎨' },
  { value: 'praise', label: 'お褒め', emoji: '🎉' },
  { value: 'other', label: 'その他', emoji: '💬' },
]

export default function FeedbackWidget({
  source = 'footer',
  eventId,
  defaultOpen = false,
  onClose,
  hideButton = false,
}: Props) {
  const { user } = useAuth()
  const [open, setOpen] = useState(defaultOpen)
  const [rating, setRating] = useState<number | null>(null)
  const [category, setCategory] = useState<FeedbackCategory | null>(null)
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const handleOpen = () => setOpen(true)
  const handleClose = () => {
    setOpen(false)
    setRating(null)
    setCategory(null)
    setMessage('')
    setSubmitted(false)
    onClose?.()
  }

  const handleSubmit = async () => {
    if (!message.trim()) return
    setSubmitting(true)
    const { error } = await supabase.from('feedback').insert({
      user_id: user?.id ?? null,
      event_id: eventId ?? null,
      source,
      rating,
      category,
      message: message.trim(),
      page_url: window.location.pathname,
      user_agent: navigator.userAgent,
    })
    setSubmitting(false)
    if (error) {
      alert('送信に失敗しました: ' + error.message)
      return
    }
    setSubmitted(true)
    setTimeout(() => handleClose(), 2000)
  }

  return (
    <>
      {/* 常設ボタン（hideButton=false時のみ） */}
      {!hideButton && (
        <button
          onClick={handleOpen}
          className="fixed bottom-20 right-4 z-30 bg-white border-2 border-green text-green-dark rounded-full shadow-lg p-3 hover:bg-green-light transition flex items-center gap-1.5"
          title="フィードバックを送る"
          aria-label="フィードバックを送る"
        >
          <span className="text-lg leading-none">💬</span>
          <span className="text-xs font-bold pr-1">ご意見</span>
        </button>
      )}

      {/* モーダル */}
      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center"
          onClick={handleClose}
        >
          <div
            className="bg-white rounded-t-2xl md:rounded-2xl w-full max-w-[420px] max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {submitted ? (
              <div className="p-8 text-center">
                <div className="text-4xl mb-3">🙏</div>
                <div className="text-base font-bold mb-2">ありがとうございます</div>
                <div className="text-xs text-sub">いただいたご意見は大切に拝見します</div>
              </div>
            ) : (
              <>
                <div className="p-4 border-b border-border flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold">💬 ご意見・ご要望</h3>
                    <p className="text-[11px] text-sub mt-0.5">あなたの声がKANJIを良くします</p>
                  </div>
                  <button onClick={handleClose} className="text-sub text-2xl leading-none px-2">×</button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {/* 5段階評価（任意） */}
                  <section>
                    <label className="text-xs font-semibold text-sub mb-1.5 block">
                      今回の使い心地は？ <span className="text-[10px] font-normal">(任意)</span>
                    </label>
                    <div className="flex justify-between gap-1">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button
                          key={n}
                          onClick={() => setRating(rating === n ? null : n)}
                          className={`flex-1 py-2.5 rounded-xl border-2 text-xl transition ${
                            rating === n
                              ? 'border-green bg-green-light'
                              : 'border-border bg-white hover:border-green/50'
                          }`}
                        >
                          {n === 1 && '😞'}
                          {n === 2 && '🙁'}
                          {n === 3 && '😐'}
                          {n === 4 && '🙂'}
                          {n === 5 && '😄'}
                        </button>
                      ))}
                    </div>
                  </section>

                  {/* カテゴリ（任意） */}
                  <section>
                    <label className="text-xs font-semibold text-sub mb-1.5 block">
                      どんな内容ですか？ <span className="text-[10px] font-normal">(任意)</span>
                    </label>
                    <div className="grid grid-cols-5 gap-1">
                      {CATEGORY_OPTIONS.map((c) => (
                        <button
                          key={c.value}
                          onClick={() => setCategory(category === c.value ? null : c.value)}
                          className={`py-2 px-1 rounded-xl text-[10px] font-semibold border-2 transition flex flex-col items-center gap-0.5 ${
                            category === c.value
                              ? 'border-green bg-green-light text-green-dark'
                              : 'border-border bg-white text-sub'
                          }`}
                        >
                          <span className="text-sm leading-none">{c.emoji}</span>
                          <span>{c.label}</span>
                        </button>
                      ))}
                    </div>
                  </section>

                  {/* 自由記述（必須） */}
                  <section>
                    <label className="text-xs font-semibold text-sub mb-1.5 block">
                      詳細 <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value.slice(0, 2000))}
                      placeholder="例: 精算完了ボタンが見つけにくかった / 旅行の立替記録が助かった / ○○の機能が欲しい"
                      rows={5}
                      className="w-full p-3 border border-border rounded-xl text-sm bg-gray-bg focus:outline-none focus:border-green resize-none"
                    />
                    <div className="text-[10px] text-sub text-right mt-0.5">
                      {message.length} / 2000
                    </div>
                  </section>

                  <div className="text-[10px] text-sub bg-gray-bg rounded-lg p-2">
                    💡 匿名投稿可。個人情報は含めないでください。
                  </div>
                </div>

                <div className="p-4 border-t border-border flex gap-2">
                  <button
                    onClick={handleClose}
                    className="flex-1 py-3 bg-gray-bg text-sub font-semibold rounded-xl"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={submitting || !message.trim()}
                    className="flex-1 py-3 bg-green text-white font-bold rounded-xl disabled:opacity-40 hover:bg-green-dark transition"
                  >
                    {submitting ? '送信中...' : '送信する'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
