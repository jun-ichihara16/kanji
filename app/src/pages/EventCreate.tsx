import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useEvent, EVENT_CATEGORIES, EventCategory } from '../hooks/useEvent'

const CATEGORY_EMOJI: Record<EventCategory, string> = {
  '飲み会': '🍻',
  'ランチ': '🍽️',
  '旅行': '✈️',
  '合宿': '🏕️',
  '歓送迎会': '🎉',
  '誕生日': '🎂',
  'その他': '✨',
}

export default function EventCreate() {
  const { user } = useAuth()
  const { createEvent, addParticipant } = useEvent()
  const navigate = useNavigate()

  const [step, setStep] = useState(1)
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState<EventCategory | null>(null)
  const [venueName, setVenueName] = useState('')
  const [venueAddress, setVenueAddress] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [memo, setMemo] = useState('')
  const [createdSlug, setCreatedSlug] = useState('')
  const [createdId, setCreatedId] = useState('')
  const [copied, setCopied] = useState(false)
  const [saving, setSaving] = useState(false)

  const shareUrl = `${window.location.origin}/app/e/${createdSlug}`

  const handleCreate = async () => {
    if (!user || !title) return
    setSaving(true)
    const { data, error } = await createEvent(user.id, {
      title,
      venue_name: venueName || undefined,
      venue_address: venueAddress || undefined,
      event_date: eventDate || undefined,
      memo: memo || undefined,
      category: category || undefined,
    })
    setSaving(false)
    console.log('[EventCreate] result:', { data, error })
    if (error) {
      alert('イベント作成エラー: ' + (error.message || JSON.stringify(error)))
      return
    }
    if (data) {
      // 幹事本人を自動で参加者リストに追加（LINE表示名・PayPay選択・情報未登録）
      await addParticipant(data.id, {
        name: user.displayName,
        payment_method: 'paypay',
        user_id: user.id,
      })
      setCreatedSlug(data.slug)
      setCreatedId(data.id)
      setStep(2)
    }
  }

  const copyUrl = () => {
    navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* Step indicator */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex gap-1.5">
          {[1, 2].map((s) => (
            <div
              key={s}
              className={`h-2 rounded-full transition-all ${
                s === step ? 'w-6 bg-green' : 'w-2 bg-border'
              }`}
            />
          ))}
        </div>
        <span className="text-xs text-sub">STEP {step}/2</span>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-8">
        {step === 1 && (
          <>
            <h2 className="text-lg font-bold text-center mb-5">新しいイベントを作成</h2>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-sub mb-1 block">イベント名 *</label>
                <input value={title} onChange={(e) => setTitle(e.target.value)}
                  placeholder="例：新年会、歓迎会、合宿など" className="w-full p-3 border border-border rounded-xl text-sm bg-gray-bg focus:outline-none focus:border-green" />
              </div>
              <div>
                <label className="text-xs font-semibold text-sub mb-1 block">カテゴリ（任意）</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {EVENT_CATEGORIES.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCategory(category === c ? null : c)}
                      className={`py-2 px-1 rounded-xl text-[11px] font-semibold border-2 transition flex flex-col items-center gap-0.5 ${
                        category === c
                          ? 'border-green bg-green-light text-green-dark'
                          : 'border-border bg-white text-sub'
                      }`}
                    >
                      <span className="text-base leading-none">{CATEGORY_EMOJI[c]}</span>
                      <span>{c}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-sub mb-1 block">お店の名前</label>
                <input value={venueName} onChange={(e) => setVenueName(e.target.value)}
                  placeholder="例：居酒屋○○ 渋谷店" className="w-full p-3 border border-border rounded-xl text-sm bg-gray-bg focus:outline-none focus:border-green" />
              </div>
              <div>
                <label className="text-xs font-semibold text-sub mb-1 block">最寄り駅</label>
                <input value={venueAddress} onChange={(e) => setVenueAddress(e.target.value)}
                  placeholder="例：渋谷駅" className="w-full p-3 border border-border rounded-xl text-sm bg-gray-bg focus:outline-none focus:border-green" />
              </div>
              <div>
                <label className="text-xs font-semibold text-sub mb-1 block">日時</label>
                <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)}
                  className="w-full p-3 border border-border rounded-xl text-sm bg-gray-bg focus:outline-none focus:border-green" />
              </div>
              <div>
                <label className="text-xs font-semibold text-sub mb-1 block">メモ（任意）</label>
                <input value={memo} onChange={(e) => setMemo(e.target.value)}
                  placeholder="例：二次会あり、ドレスコードなし" className="w-full p-3 border border-border rounded-xl text-sm bg-gray-bg focus:outline-none focus:border-green" />
              </div>
            </div>

            <button
              onClick={handleCreate}
              disabled={!title || saving}
              className="w-full py-4 bg-green text-white font-bold rounded-xl mt-6 disabled:opacity-40 hover:bg-green-dark transition"
            >
              {saving ? '作成中...' : 'イベントURLを発行する →'}
            </button>
          </>
        )}

        {step === 2 && (
          <>
            <h2 className="text-lg font-bold text-center mb-5">URLを友達に送ろう</h2>

            <div className="flex items-center gap-2 bg-gray-bg border border-border rounded-xl p-3 mb-4">
              <span className="flex-1 font-inter text-xs text-[#1A1A1A] truncate">{shareUrl}</span>
              <button onClick={copyUrl} className="shrink-0 px-3.5 py-1.5 bg-green text-white rounded-lg text-xs font-semibold">
                {copied ? 'コピー済み!' : 'コピー'}
              </button>
            </div>

            <a
              href={`https://line.me/R/msg/text/?${encodeURIComponent(`${title}に参加してください！\n${shareUrl}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 bg-line text-white font-bold py-4 rounded-xl mb-6 hover:brightness-95 transition"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596a.626.626 0 01-.199.031c-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.271.173-.508.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/></svg>
              LINEで送る
            </a>

            <button
              onClick={() => navigate(`/events/${createdId}`)}
              className="w-full py-4 border-2 border-green text-green-dark font-bold rounded-xl hover:bg-green-light transition"
            >
              イベント管理画面へ →
            </button>
          </>
        )}
      </div>
    </div>
  )
}
