import { useState, useEffect, useMemo } from 'react'
import { Participant, SplitMode } from '../hooks/useEvent'
import {
  allocateShares,
  buildSuggestedProfiles,
  SplitProfile,
} from '../lib/settle'

interface Props {
  open: boolean
  onClose: () => void
  eventId: string
  participants: Participant[]
  totalAdvance: number              // 立替合計（プレビュー用）
  currentMode: SplitMode
  onSave: (
    mode: SplitMode,
    updates: { id: string; tags: string[]; weight: number; fixed_amount: number | null }[]
  ) => Promise<void>
}

const TAGS = ['女性', '若手/後輩', '上司/先輩', '遅刻/早退', '主役'] as const

type ModeTab = 'equal' | 'ai_mild' | 'ai_strict' | 'manual'

const MODE_LABEL: Record<ModeTab, string> = {
  equal: '全員同額',
  ai_mild: 'AI マイルド',
  ai_strict: 'AI しっかり',
  manual: '手動のみ',
}

const MODE_DESC: Record<ModeTab, string> = {
  equal: '全員で均等に割り勘',
  ai_mild: 'タグで控えめ傾斜（女性/若手 -20%, 上司 +20%）',
  ai_strict: 'タグでしっかり傾斜（女性/若手 -30%, 上司 +50%）',
  manual: 'ベース均等、全員を手動で調整',
}

export default function SplitSettingsModal({
  open, onClose, participants, totalAdvance, currentMode, onSave,
}: Props) {
  // 編集中の状態
  const [tab, setTab] = useState<ModeTab>(currentMode as ModeTab)
  const [tagsMap, setTagsMap] = useState<Record<string, string[]>>({})
  // 手動オーバーライド: participant.id → 金額
  const [overrides, setOverrides] = useState<Record<string, number>>({})
  const [saving, setSaving] = useState(false)

  // open時に初期化
  useEffect(() => {
    if (!open) return
    const tm: Record<string, string[]> = {}
    const ov: Record<string, number> = {}
    for (const p of participants) {
      tm[p.id] = p.tags ?? []
      if (p.fixed_amount != null) ov[p.id] = p.fixed_amount
    }
    setTagsMap(tm)
    setTab(currentMode as ModeTab)
    setOverrides(ov)
  }, [open, participants, currentMode])

  // タブ切替時、オーバーライドが「手動のみタブでのもの」か確認するため保持
  // （実装上は単純にすべてのタブで有効にする）

  // ベースプロファイル（オーバーライド前）: 現在のタブで計算される weight
  const baseProfiles: SplitProfile[] = useMemo(() => {
    if (tab === 'manual') {
      return participants.map((p) => ({ name: p.name, weight: 1.0, fixed_amount: null }))
    }
    return buildSuggestedProfiles(
      participants.map((p) => ({ name: p.name, tags: tagsMap[p.id] ?? [] })),
      tab
    )
  }, [tab, participants, tagsMap])

  // 実効プロファイル（オーバーライドを fixed_amount にマージ）
  const effectiveProfiles: SplitProfile[] = useMemo(() => {
    return baseProfiles.map((prof) => {
      const p = participants.find((pp) => pp.name === prof.name)!
      if (overrides[p.id] != null) {
        return { ...prof, fixed_amount: overrides[p.id] }
      }
      return prof
    })
  }, [baseProfiles, overrides, participants])

  // 全員の負担額プレビュー
  const previewShares = useMemo(() => {
    if (totalAdvance <= 0) return {}
    return allocateShares(totalAdvance, effectiveProfiles)
  }, [totalAdvance, effectiveProfiles])

  const previewTotal = Object.values(previewShares).reduce((a, b) => a + b, 0)
  const previewMismatch = previewTotal !== totalAdvance && totalAdvance > 0

  const toggleTag = (pid: string, tag: string) => {
    setTagsMap((prev) => {
      const cur = prev[pid] ?? []
      const next = cur.includes(tag) ? cur.filter((t) => t !== tag) : [...cur, tag]
      return { ...prev, [pid]: next }
    })
  }

  // 金額の手動調整（すべてのタブで有効）
  const handleAdjust = (pid: string, delta: number) => {
    const p = participants.find((pp) => pp.id === pid)!
    const currentValue = overrides[pid] != null
      ? overrides[pid]
      : (previewShares[p.name] ?? 0)
    setOverrides((prev) => ({ ...prev, [pid]: Math.max(0, currentValue + delta) }))
  }

  const handleSet = (pid: string, value: number) => {
    setOverrides((prev) => ({ ...prev, [pid]: Math.max(0, value) }))
  }

  const handleResetOne = (pid: string) => {
    setOverrides((prev) => {
      const next = { ...prev }
      delete next[pid]
      return next
    })
  }

  const handleResetAll = () => setOverrides({})

  const handleSave = async () => {
    setSaving(true)
    try {
      // 最終的な split_mode 決定
      // - 手動オーバーライドが1つでもあれば、視覚的には「手動」相当だが
      //   split_mode はタブの値を採用（ゲスト側バッジで文脈を示すため）
      // - 「手動のみ」タブの場合は manual
      const mode: SplitMode = tab

      const updates = participants.map((p) => {
        const prof = effectiveProfiles.find((pr) => pr.name === p.name)
        const newTags = tagsMap[p.id] ?? []
        return {
          id: p.id,
          tags: newTags,
          weight: prof?.weight ?? 1.0,
          fixed_amount: prof?.fixed_amount ?? null,
        }
      })
      await onSave(mode, updates)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  const overrideCount = Object.keys(overrides).length

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center" onClick={onClose}>
      <div
        className="bg-white rounded-t-2xl md:rounded-2xl w-full max-w-[420px] max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold">精算方法を決める</h3>
            <p className="text-[11px] text-sub mt-0.5">タグ → 傾斜方式 → 調整 の順で決めます</p>
          </div>
          <button onClick={onClose} className="text-sub text-2xl leading-none px-2">×</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {/* ========== 1. タグ付与 ========== */}
          <section>
            <h4 className="text-sm font-bold mb-2">1. タグを付ける <span className="text-[10px] text-sub font-normal">（任意・AI提案の根拠に使います）</span></h4>
            <div className="space-y-2">
              {participants.map((p) => (
                <div key={p.id} className="bg-gray-bg rounded-xl p-3">
                  <div className="text-sm font-semibold mb-1.5">{p.name}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {TAGS.map((t) => {
                      const selected = (tagsMap[p.id] ?? []).includes(t)
                      return (
                        <button
                          key={t}
                          onClick={() => toggleTag(p.id, t)}
                          className={`text-[11px] px-2.5 py-1 rounded-full border-2 font-semibold transition ${
                            selected
                              ? 'bg-green-light border-green text-green-dark'
                              : 'bg-white border-border text-sub'
                          }`}
                        >
                          {t}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ========== 2. 方式選択 ========== */}
          <section>
            <h4 className="text-sm font-bold mb-2">2. 傾斜方式を選ぶ</h4>
            <div className="grid grid-cols-2 gap-1.5">
              {(['equal', 'ai_mild', 'ai_strict', 'manual'] as ModeTab[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setTab(m)}
                  className={`text-xs py-2.5 px-2 rounded-xl border-2 font-bold transition text-left ${
                    tab === m
                      ? 'border-green bg-green-light text-green-dark'
                      : 'border-border bg-white text-sub'
                  }`}
                >
                  <div>{MODE_LABEL[m]}</div>
                  <div className="text-[9px] font-normal mt-0.5 leading-tight">{MODE_DESC[m]}</div>
                </button>
              ))}
            </div>
          </section>

          {/* ========== 3. 金額調整 + プレビュー ========== */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-bold">3. 金額を調整</h4>
              <div className="text-[11px] text-sub">
                立替合計 <span className="font-inter font-bold text-dark">¥{totalAdvance.toLocaleString()}</span>
              </div>
            </div>
            <p className="text-[11px] text-sub mb-2">
              気になる人だけ個別に金額を上書きできます。残りは選んだ傾斜方式で自動按分されます。
            </p>

            {totalAdvance <= 0 ? (
              <p className="text-xs text-sub text-center py-4 bg-gray-bg rounded-xl">
                立替が登録されていません。先に「立替」タブで追加してください。
              </p>
            ) : (
              <div className="space-y-1.5">
                {overrideCount > 0 && (
                  <button
                    onClick={handleResetAll}
                    className="text-[11px] text-sub hover:text-green underline w-full text-right pb-1"
                  >
                    全ての手動調整をリセット（{overrideCount}件）
                  </button>
                )}
                {participants.map((p) => {
                  const amt = previewShares[p.name] ?? 0
                  const isOverridden = overrides[p.id] != null
                  return (
                    <div
                      key={p.id}
                      className={`rounded-xl p-2.5 border-2 ${
                        isOverridden
                          ? 'bg-amber-50 border-amber-300'
                          : 'bg-white border-border'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold truncate flex items-center gap-1.5">
                            {p.name}
                            {isOverridden && (
                              <span className="text-[9px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-bold">
                                ✏️ 手動
                              </span>
                            )}
                          </div>
                          {(tagsMap[p.id] ?? []).length > 0 && (
                            <div className="text-[10px] text-sub truncate">
                              {(tagsMap[p.id] ?? []).join('・')}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleAdjust(p.id, -500)}
                          className="w-8 h-8 rounded-lg bg-gray-bg text-sub text-[10px] font-bold hover:bg-border"
                        >
                          -500
                        </button>
                        <input
                          type="number"
                          value={amt}
                          onChange={(e) => handleSet(p.id, parseInt(e.target.value) || 0)}
                          className={`flex-1 p-1.5 border rounded-lg text-sm font-inter font-bold text-right focus:outline-none focus:border-green ${
                            isOverridden ? 'border-amber-300' : 'border-border'
                          }`}
                        />
                        <button
                          onClick={() => handleAdjust(p.id, 500)}
                          className="w-8 h-8 rounded-lg bg-gray-bg text-sub text-[10px] font-bold hover:bg-border"
                        >
                          +500
                        </button>
                        {isOverridden && (
                          <button
                            onClick={() => handleResetOne(p.id)}
                            title="提案値に戻す"
                            className="w-8 h-8 rounded-lg bg-white border border-border text-sub text-[14px] hover:border-green hover:text-green"
                          >
                            ↶
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}

                {/* 合計チェック */}
                <div className={`flex items-center justify-between text-xs p-2.5 rounded-xl mt-2 ${
                  previewMismatch
                    ? 'bg-red-50 text-red-700 border border-red-200'
                    : 'bg-green-light/50 text-green-dark'
                }`}>
                  <span className="font-semibold">合計</span>
                  <span className="font-inter font-bold">
                    ¥{previewTotal.toLocaleString()} / ¥{totalAdvance.toLocaleString()}
                    {previewMismatch && (
                      <span className="ml-1">⚠ 差額: ¥{(totalAdvance - previewTotal).toLocaleString()}</span>
                    )}
                  </span>
                </div>

                {previewMismatch && (
                  <p className="text-[11px] text-red-700 px-1">
                    手動設定の合計が立替額を超過/不足しています。他の人の値を調整するか、リセットしてください。
                  </p>
                )}
              </div>
            )}
          </section>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border flex gap-2">
          <button onClick={onClose} className="flex-1 py-3 bg-gray-bg text-sub font-semibold rounded-xl">取消</button>
          <button
            onClick={handleSave}
            disabled={saving || (previewMismatch && totalAdvance > 0)}
            className="flex-1 py-3 bg-green text-white font-bold rounded-xl disabled:opacity-40 hover:bg-green-dark transition"
          >
            {saving ? '保存中...' : 'この設定で保存'}
          </button>
        </div>
      </div>
    </div>
  )
}
