/**
 * 参加者の認証状態を表示する小さなバッジ群。
 *
 * - 幹事: 緑塗り「幹事」
 * - LINEログイン済み: 淡緑＋濃緑「✓ LINE」
 * - ゲスト登録: 淡グレー＋濃グレー「ゲスト」
 *
 * 表示優先度は左から：幹事 → LINE/ゲスト の順。
 * ホバー時にツールチップで補足説明、aria-label で同等情報をスクリーンリーダーに提供。
 */

interface Props {
  /** 'line' = LINEログイン済み, 'guest' = ゲスト登録（user_id なし） */
  status: 'line' | 'guest'
  /** 幹事フラグ。true なら左に「幹事」バッジを並べる */
  isOrganizer?: boolean
  /** 余白調整用に外部から付与したいクラス */
  className?: string
}

export default function ParticipantAuthBadge({
  status,
  isOrganizer = false,
  className = '',
}: Props) {
  return (
    <span className={`inline-flex items-center gap-1 align-middle ${className}`}>
      {isOrganizer && (
        <span
          aria-label="幹事"
          title="このイベントの幹事です"
          className="inline-flex items-center text-[10px] font-bold leading-none px-1.5 py-0.5 rounded bg-[#06C755] text-white"
        >
          幹事
        </span>
      )}
      {status === 'line' ? (
        <span
          aria-label="LINEログインで認証済み"
          title="LINEログインで認証済み（リマインド通知の対象になります）"
          className="inline-flex items-center gap-0.5 text-[10px] font-semibold leading-none px-1.5 py-0.5 rounded bg-[#E8F8EE] text-[#04A047]"
        >
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          LINE
        </span>
      ) : (
        <span
          aria-label="ゲスト登録（LINE認証なし）"
          title="ゲスト登録（LINEログインなし）。通知は手動で送る必要があります"
          className="inline-flex items-center text-[10px] font-medium leading-none px-1.5 py-0.5 rounded bg-[#F3F4F6] text-[#6B7280]"
        >
          ゲスト
        </span>
      )}
    </span>
  )
}
