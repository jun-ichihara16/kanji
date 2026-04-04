import { useState } from 'react'

const VENUES = [
  {
    id: 1,
    name: '個室居酒屋 灯り（あかり）',
    area: '渋谷',
    genre: ['居酒屋', '個室'],
    capacity: '20〜60名',
    price: '3,500円〜',
    tags: ['個室あり', '飲み放題', '幹事特典あり'],
    image: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=400&h=250&fit=crop',
  },
  {
    id: 2,
    name: '貸切レストラン SALON',
    area: '新宿',
    genre: ['レストラン', '貸切'],
    capacity: '30〜100名',
    price: '5,000円〜',
    tags: ['貸切可', 'プロジェクターあり', '幹事特典あり'],
    image: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400&h=250&fit=crop',
  },
  {
    id: 3,
    name: '海鮮居酒屋 磯丸',
    area: '銀座',
    genre: ['居酒屋'],
    capacity: '20〜40名',
    price: '4,000円〜',
    tags: ['飲み放題', '個室あり'],
    image: 'https://images.unsplash.com/photo-1579027989536-b7b1f875659b?w=400&h=250&fit=crop',
  },
]

const AREAS = ['全て', '渋谷', '新宿', '銀座']
const GENRES = ['全て', '居酒屋', 'レストラン', '個室', '貸切']

export default function Venues() {
  const [area, setArea] = useState('全て')
  const [genre, setGenre] = useState('全て')
  const [toast, setToast] = useState(false)

  const filtered = VENUES.filter((v) => {
    if (area !== '全て' && v.area !== area) return false
    if (genre !== '全て' && !v.genre.includes(genre)) return false
    return true
  })

  const handleReserve = () => {
    setToast(true)
    setTimeout(() => {
      setToast(false)
      window.open('https://line.me/R/ti/p/@kanji_relief', '_blank')
    }, 1500)
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-4">
        <h2 className="text-lg font-bold mb-1">加盟店を探す</h2>
        <p className="text-xs text-sub mb-4">AI KANJI提携の幹事特典付き店舗</p>

        {/* エリア */}
        <div className="mb-3">
          <p className="text-xs font-semibold text-sub mb-1.5">エリア</p>
          <div className="flex gap-1.5 flex-wrap">
            {AREAS.map((a) => (
              <button
                key={a}
                onClick={() => setArea(a)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
                  area === a ? 'bg-green text-white border-green' : 'bg-white text-sub border-border'
                }`}
              >
                {a}
              </button>
            ))}
          </div>
        </div>

        {/* ジャンル */}
        <div className="mb-4">
          <p className="text-xs font-semibold text-sub mb-1.5">ジャンル</p>
          <div className="flex gap-1.5 flex-wrap">
            {GENRES.map((g) => (
              <button
                key={g}
                onClick={() => setGenre(g)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
                  genre === g ? 'bg-green text-white border-green' : 'bg-white text-sub border-border'
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        {/* 店舗一覧 */}
        <div className="space-y-3">
          {filtered.map((v) => (
            <div key={v.id} className="bg-white border border-border rounded-2xl overflow-hidden">
              <img src={v.image} alt={v.name} className="w-full h-36 object-cover" />
              <div className="p-4">
                <h3 className="font-bold text-base mb-1">{v.name}</h3>
                <div className="flex gap-1.5 mb-2">
                  <span className="text-xs bg-green-light text-green-dark px-2 py-0.5 rounded-full font-semibold">{v.area}</span>
                  {v.genre.map((g) => (
                    <span key={g} className="text-xs bg-gray-bg text-sub px-2 py-0.5 rounded-full">{g}</span>
                  ))}
                </div>
                <div className="flex items-center gap-4 text-xs text-sub mb-2">
                  <span>👥 {v.capacity}</span>
                  <span className="font-inter font-semibold text-[#1A1A1A]">💰 {v.price}</span>
                </div>
                <div className="flex gap-1 flex-wrap mb-3">
                  {v.tags.map((t) => (
                    <span key={t} className="text-[10px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">{t}</span>
                  ))}
                </div>
                <button
                  onClick={handleReserve}
                  className="w-full py-3 bg-green text-white text-sm font-bold rounded-xl hover:bg-green-dark transition"
                >
                  予約相談する
                </button>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="text-center text-sub text-sm py-8">条件に合う店舗がありません</p>
          )}
        </div>
      </div>

      {/* トースト */}
      {toast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-[#1A1A1A] text-white text-xs font-semibold px-4 py-3 rounded-xl shadow-lg z-50 whitespace-nowrap">
          AI KANJI公式LINEに遷移します。担当者が対応いたします。
        </div>
      )}
    </div>
  )
}
