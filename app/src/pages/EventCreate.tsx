import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import {
  useEvent,
  EventTemplate,
  SettlementType,
  RoundingRule,
  FinalAdjustmentMode,
  EVENT_TEMPLATES,
  SETTLEMENT_TYPES,
} from '../hooks/useEvent'
import {
  TEMPLATE_LABELS,
  TEMPLATE_HINTS,
  TEMPLATE_DEFAULT_SETTLEMENT,
  SETTLEMENT_TITLE,
  SETTLEMENT_DESCRIPTION,
  WEIGHT_PRESET_LABEL,
  WEIGHT_PRESET_VALUE,
  WeightPreset,
  ROUNDING_LABEL,
  FINAL_ADJUSTMENT_LABEL,
} from '../lib/eventFlow'
import {
  EventDraft,
  emptyDraft,
  loadDraft,
  saveDraft,
  clearDraft,
  DraftExpense,
} from '../lib/eventDraft'
import {
  applyRounding,
  calcEqualSplit,
  calcWeightedSplit,
  calcReimbursementSplit,
  RoundingRule as SettleRoundingRule,
} from '../lib/settle'
import { track } from '../lib/analytics'

const STEP_NAMES = [
  'template',
  'basic_info',
  'settlement_type',
  'settlement_detail',
  'confirm',
] as const

type StepName = typeof STEP_NAMES[number]

export default function EventCreate() {
  const { user } = useAuth()
  const { createEvent, addParticipant } = useEvent()
  const navigate = useNavigate()

  // ===== state =====
  const [draft, setDraft] = useState<EventDraft>(() => emptyDraft())
  const [step, setStep] = useState<number>(1) // 1..5
  const [hasRestored, setHasRestored] = useState(false)
  const [restorePromptDismissed, setRestorePromptDismissed] = useState(false)
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // ===== 初回ロード: 下書き復元プロンプト =====
  useEffect(() => {
    if (!user) return
    const saved = loadDraft(user.id)
    if (saved && !hasRestored) {
      // 「復元するか？」プロンプトを表示するために、空の状態で開始する
      // （ユーザーが復元を選ぶと saved を当てる）
      // 自動復元はしない
    }
  }, [user, hasRestored])

  // ===== オートセーブ =====
  useEffect(() => {
    if (!user) return
    if (step === 1 && draft.event_template == null && draft.title === '') return
    saveDraft(user.id, { ...draft, step })
  }, [draft, step, user])

  // ===== 派生値 =====
  const memberNames = useMemo(() => draft.members.map((m) => m.name), [draft.members])

  // 対象メンバー（exclude_organizer / 任意の対象指定を反映）
  const includedNames = useMemo(() => {
    if (draft.included_member_names.length > 0) {
      return draft.included_member_names
    }
    // デフォルト: 全員（exclude_organizer のときは幹事を除く想定だが、
    // EventCreate 段階では幹事=作成者は participants にまだ入ってないので、
    // ここでは全員を返す。除外ロジックは preview 段階で適用）
    return memberNames
  }, [draft.included_member_names, memberNames])

  const equalPreview = useMemo(() => {
    if (draft.settlement_type !== 'equal_split') return null
    if (!draft.total_amount || draft.total_amount <= 0) return null
    if (includedNames.length === 0) return null
    return calcEqualSplit({
      totalAmount: draft.total_amount,
      memberNames: includedNames,
      rounding: draft.rounding_rule as SettleRoundingRule,
    })
  }, [draft.settlement_type, draft.total_amount, draft.rounding_rule, includedNames])

  const weightedPreview = useMemo(() => {
    if (draft.settlement_type !== 'weighted_split') return null
    if (!draft.total_amount || draft.total_amount <= 0) return null
    const targets = draft.weighted_member_names.length > 0
      ? draft.weighted_member_names
      : memberNames
    if (targets.length === 0) return null
    return calcWeightedSplit({
      totalAmount: draft.total_amount,
      members: targets.map((n) => ({
        name: n,
        weight: draft.member_weights[n] ?? 1.0,
        fixed_amount: draft.manual_amounts[n] ?? null,
      })),
      rounding: draft.rounding_rule as SettleRoundingRule,
    })
  }, [draft.settlement_type, draft.total_amount, draft.rounding_rule, draft.weighted_member_names, draft.member_weights, draft.manual_amounts, memberNames])

  const reimbursementPreview = useMemo(() => {
    if (draft.settlement_type !== 'reimbursement_split') return null
    if (memberNames.length === 0) return null
    if (draft.expense_items.length === 0) return null
    return calcReimbursementSplit({
      advances: draft.expense_items.map((e) => ({
        payerName: e.payer_name,
        amount: e.amount,
        splitTarget: e.split_target,
        targetNames: e.split_target === 'specific' ? e.target_names : undefined,
      })),
      participantNames: memberNames,
    })
  }, [draft.settlement_type, draft.expense_items, memberNames])

  // ===== draft 更新ヘルパ =====
  function patch(p: Partial<EventDraft>) {
    setDraft((prev) => ({ ...prev, ...p }))
  }

  function selectTemplate(tpl: EventTemplate) {
    const wasSelected = draft.event_template
    patch({
      event_template: tpl,
      // テンプレ変更で会計方式の初期値を更新（既存値は保持）
      settlement_type: draft.settlement_type ?? TEMPLATE_DEFAULT_SETTLEMENT[tpl],
    })
    if (wasSelected && wasSelected !== tpl) {
      track('template_changed', { event_template: tpl, step_name: 'step1' })
    } else {
      track('template_selected', { event_template: tpl, step_name: 'step1' })
    }
  }

  function selectSettlementType(t: SettlementType) {
    const was = draft.settlement_type
    patch({
      settlement_type: t,
      // フォーム破綻防止: equal/weighted の対象や金額は維持しつつ、明らかに不要な値だけリセットしない
      included_member_names: t === 'equal_split' ? draft.included_member_names : draft.included_member_names,
      weighted_member_names: t === 'weighted_split' ? draft.weighted_member_names : draft.weighted_member_names,
    })
    if (was && was !== t) {
      track('settlement_type_changed', {
        settlement_type: t,
        event_template: draft.event_template ?? undefined,
      })
    } else {
      track('settlement_type_selected', {
        settlement_type: t,
        event_template: draft.event_template ?? undefined,
        step_name: 'step3',
      })
    }
  }

  function toggleIncluded(name: string) {
    const set = new Set(draft.included_member_names.length > 0 ? draft.included_member_names : memberNames)
    if (set.has(name)) set.delete(name)
    else set.add(name)
    patch({ included_member_names: Array.from(set) })
  }

  function toggleWeightedTarget(name: string) {
    const set = new Set(draft.weighted_member_names.length > 0 ? draft.weighted_member_names : memberNames)
    if (set.has(name)) set.delete(name)
    else set.add(name)
    patch({ weighted_member_names: Array.from(set) })
  }

  function setMemberPreset(name: string, preset: WeightPreset) {
    patch({
      member_weights: { ...draft.member_weights, [name]: WEIGHT_PRESET_VALUE[preset] },
      manual_amounts: { ...draft.manual_amounts, [name]: null },
    })
  }

  function setManualAmount(name: string, value: number | null) {
    patch({
      manual_amounts: { ...draft.manual_amounts, [name]: value },
    })
  }

  function addExpense(e: DraftExpense) {
    patch({ expense_items: [...draft.expense_items, e] })
  }

  function removeExpense(index: number) {
    patch({ expense_items: draft.expense_items.filter((_, i) => i !== index) })
  }

  // ===== ステップ進行 =====
  function goNext() {
    setErrorMessage(null)
    if (step === 1) {
      if (!draft.event_template) {
        setErrorMessage('テンプレートを選んでください')
        return
      }
      setStep(2)
    } else if (step === 2) {
      if (!draft.title.trim()) {
        setErrorMessage('会の名前は必須です')
        return
      }
      track('basic_info_completed', {
        event_template: draft.event_template ?? undefined,
        participant_count: draft.members.length,
        step_name: 'step2',
      })
      setStep(3)
    } else if (step === 3) {
      if (!draft.settlement_type) {
        setErrorMessage('会計方式を選んでください')
        return
      }
      setStep(4)
    } else if (step === 4) {
      const err = validateSettlementDetail()
      if (err) {
        setErrorMessage(err)
        return
      }
      track('settlement_detail_completed', {
        event_template: draft.event_template ?? undefined,
        settlement_type: draft.settlement_type ?? undefined,
        total_amount: draft.total_amount ?? undefined,
        has_expense_items: draft.expense_items.length > 0,
        step_name: 'step4',
      })
      setStep(5)
    }
  }

  function goPrev() {
    setErrorMessage(null)
    setStep((s) => Math.max(1, s - 1))
  }

  function validateSettlementDetail(): string | null {
    // メンバーは EventCreate 段階では追加しない設計（URLシェア後の自己登録に委ねる）。
    // 各方式とも合計金額のみ最低限のバリデーションとし、
    // メンバー前提の詳細設定はメンバー集合後に EventManage で行う。
    if (draft.settlement_type === 'equal_split') {
      if (!draft.total_amount || draft.total_amount <= 0) return '合計金額を入力してください'
      return null
    }
    if (draft.settlement_type === 'weighted_split') {
      if (!draft.total_amount || draft.total_amount <= 0) return '合計金額を入力してください'
      if (weightedPreview?.mismatch) {
        return `合計が一致していません（差分: ¥${(weightedPreview.expectedTotal - weightedPreview.actualTotal).toLocaleString()}）`
      }
      return null
    }
    if (draft.settlement_type === 'reimbursement_split') {
      // メンバー登録前は立替の登録ができないため、空でも進める
      return null
    }
    return null
  }

  function validateBeforeRequest(): string | null {
    if (!draft.title.trim()) return '会の名前は必須です'
    return validateSettlementDetail()
  }

  // ===== 下書き保存（明示） =====
  function handleSaveDraft() {
    if (!user) return
    saveDraft(user.id, { ...draft, step })
    track('draft_saved', {
      event_template: draft.event_template ?? undefined,
      settlement_type: draft.settlement_type ?? undefined,
      step_name: STEP_NAMES[step - 1],
      draft_saved: true,
    })
    setErrorMessage('下書きを保存しました')
    setTimeout(() => setErrorMessage(null), 1500)
  }

  function handleRestore() {
    if (!user) return
    const saved = loadDraft(user.id)
    if (!saved) return
    setDraft(saved)
    setStep(saved.step || 1)
    setHasRestored(true)
    track('draft_restored', {
      event_template: saved.event_template ?? undefined,
      settlement_type: saved.settlement_type ?? undefined,
      step_name: STEP_NAMES[(saved.step || 1) - 1],
    })
  }

  function handleDiscardDraft() {
    if (!user) return
    clearDraft(user.id)
    setRestorePromptDismissed(true)
  }

  // ===== 作成 =====
  async function handleCreate() {
    if (!user) return
    const err = validateBeforeRequest()
    if (err) {
      setErrorMessage(err)
      return
    }
    if (!draft.event_template || !draft.settlement_type) return

    setSaving(true)
    setErrorMessage(null)
    try {
      // 1. event 作成
      const { data: ev, error } = await createEvent(user.id, {
        title: draft.title,
        venue_name: draft.venue_name || undefined,
        venue_address: draft.venue_address || undefined,
        event_date: draft.event_date || undefined,
        memo: draft.memo || undefined,
        event_template: draft.event_template,
        settlement_type: draft.settlement_type,
        total_amount: draft.total_amount,
        rounding_rule: draft.rounding_rule,
        exclude_organizer: draft.exclude_organizer,
        final_adjustment_mode: draft.final_adjustment_mode,
        is_draft: false,
      })
      if (error || !ev) {
        setErrorMessage('イベント作成に失敗しました: ' + (error?.message || 'unknown'))
        return
      }

      // 2. 幹事自身のみ参加者に追加（その他メンバーはURLシェアからの自己登録に委ねる）
      await addParticipant(ev.id, {
        name: user.displayName,
        payment_method: 'paypay',
        user_id: user.id,
      })

      // 3. event_created 発火
      track('event_created', {
        event_template: draft.event_template,
        settlement_type: draft.settlement_type,
        participant_count: 1, // 作成時点では幹事のみ
        total_amount: draft.total_amount ?? undefined,
        has_expense_items: draft.expense_items.length > 0,
      })

      // 6. 下書き破棄
      clearDraft(user.id)

      // 7. 管理画面へ
      navigate(`/events/${ev.id}`)
    } finally {
      setSaving(false)
    }
  }

  // ===== 下書き復元プロンプト =====
  const savedDraft = user ? loadDraft(user.id) : null
  const showRestorePrompt =
    !!savedDraft &&
    !hasRestored &&
    !restorePromptDismissed &&
    step === 1 &&
    draft.event_template == null

  if (showRestorePrompt) {
    return (
      <div className="flex-1 flex items-center justify-center px-5">
        <div className="bg-white border border-border rounded-2xl p-5 max-w-sm w-full">
          <h2 className="font-bold text-base mb-2">作成中の下書きがあります</h2>
          <p className="text-xs text-sub mb-4">
            続きから作成しますか？ 破棄すると最初からになります。
          </p>
          <button
            onClick={handleRestore}
            className="w-full py-3 bg-green text-white font-bold rounded-xl mb-2 hover:bg-green-dark transition"
          >
            続きから作成
          </button>
          <button
            onClick={handleDiscardDraft}
            className="w-full py-3 border border-border text-sub font-semibold rounded-xl hover:bg-gray-bg transition"
          >
            破棄して新規作成
          </button>
        </div>
      </div>
    )
  }

  // =========================================================
  // レンダリング
  // =========================================================
  return (
    <div className="flex-1 flex flex-col">
      {/* Step indicator */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex gap-1.5">
          {[1, 2, 3, 4, 5].map((s) => (
            <div
              key={s}
              className={`h-2 rounded-full transition-all ${
                s === step ? 'w-6 bg-green' : 'w-2 bg-border'
              }`}
            />
          ))}
        </div>
        <span className="text-xs text-sub">STEP {step}/5</span>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-8">
        {step === 1 && (
          <Step1Template draft={draft} onSelect={selectTemplate} />
        )}
        {step === 2 && (
          <Step2BasicInfo draft={draft} patch={patch} />
        )}
        {step === 3 && (
          <Step3SettlementType draft={draft} onSelect={selectSettlementType} />
        )}
        {step === 4 && (
          <Step4SettlementDetail
            draft={draft}
            patch={patch}
            memberNames={memberNames}
            includedNames={includedNames}
            toggleIncluded={toggleIncluded}
            toggleWeightedTarget={toggleWeightedTarget}
            setMemberPreset={setMemberPreset}
            setManualAmount={setManualAmount}
            addExpense={addExpense}
            removeExpense={removeExpense}
            equalPreview={equalPreview}
            weightedPreview={weightedPreview}
            reimbursementPreview={reimbursementPreview}
          />
        )}
        {step === 5 && (
          <Step5Confirm
            draft={draft}
            equalPreview={equalPreview}
            weightedPreview={weightedPreview}
            reimbursementPreview={reimbursementPreview}
          />
        )}

        {errorMessage && (
          <p className="mt-4 text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl p-3">
            {errorMessage}
          </p>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-border bg-white px-4 py-3 flex items-center gap-2">
        {step > 1 && (
          <button
            onClick={goPrev}
            className="px-4 py-3 text-sub font-semibold rounded-xl hover:bg-gray-bg transition"
          >
            戻る
          </button>
        )}
        <button
          onClick={handleSaveDraft}
          className="px-3 py-3 text-xs text-sub font-semibold rounded-xl hover:bg-gray-bg transition"
        >
          下書き保存
        </button>
        <div className="flex-1" />
        {step < 5 ? (
          <button
            onClick={goNext}
            className="px-5 py-3 bg-green text-white font-bold rounded-xl hover:bg-green-dark transition"
          >
            次へ →
          </button>
        ) : (
          <button
            onClick={handleCreate}
            disabled={saving}
            className="px-5 py-3 bg-green text-white font-bold rounded-xl disabled:opacity-40 hover:bg-green-dark transition"
          >
            {saving ? '作成中...' : 'イベントを作成する'}
          </button>
        )}
      </div>
    </div>
  )
}

// =========================================================
// Step 1: テンプレート選択
// =========================================================
function Step1Template({
  draft,
  onSelect,
}: {
  draft: EventDraft
  onSelect: (tpl: EventTemplate) => void
}) {
  return (
    <>
      <h2 className="text-lg font-bold text-center mb-1">どんなイベント？</h2>
      <p className="text-xs text-sub text-center mb-5">あとから変更できます</p>

      <div className="space-y-2">
        {EVENT_TEMPLATES.map((tpl) => {
          const selected = draft.event_template === tpl
          return (
            <button
              key={tpl}
              type="button"
              onClick={() => onSelect(tpl)}
              className={`w-full text-left p-4 rounded-2xl border-2 transition ${
                selected
                  ? 'border-green bg-green-light'
                  : 'border-border bg-white hover:border-green/50'
              }`}
            >
              <div className={`font-bold text-sm mb-0.5 ${selected ? 'text-green-dark' : 'text-text'}`}>
                {TEMPLATE_LABELS[tpl]}
              </div>
              <div className="text-[11px] text-sub leading-relaxed">{TEMPLATE_HINTS[tpl]}</div>
            </button>
          )
        })}
      </div>
    </>
  )
}

// =========================================================
// Step 2: 基本情報
// =========================================================
function Step2BasicInfo({
  draft,
  patch,
}: {
  draft: EventDraft
  patch: (p: Partial<EventDraft>) => void
}) {
  return (
    <>
      <h2 className="text-lg font-bold text-center mb-5">基本情報</h2>

      <div className="space-y-4">
        <div>
          <label className="text-xs font-semibold text-sub mb-1 block">会の名前 *</label>
          <input
            value={draft.title}
            onChange={(e) => patch({ title: e.target.value })}
            placeholder="例：新年会、歓迎会、〇〇さん送別会"
            className="w-full p-3 border border-border rounded-xl text-sm bg-gray-bg focus:outline-none focus:border-green"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs font-semibold text-sub mb-1 block">開催日</label>
            <input
              type="date"
              value={draft.event_date}
              onChange={(e) => patch({ event_date: e.target.value })}
              className="w-full p-3 border border-border rounded-xl text-sm bg-gray-bg focus:outline-none focus:border-green"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-sub mb-1 block">開始時間</label>
            <input
              type="time"
              value={draft.event_time}
              onChange={(e) => patch({ event_time: e.target.value })}
              className="w-full p-3 border border-border rounded-xl text-sm bg-gray-bg focus:outline-none focus:border-green"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-sub mb-1 block">場所 / お店</label>
          <input
            value={draft.venue_name}
            onChange={(e) => patch({ venue_name: e.target.value })}
            placeholder="例：居酒屋○○ 渋谷店"
            className="w-full p-3 border border-border rounded-xl text-sm bg-gray-bg focus:outline-none focus:border-green"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-sub mb-1 block">メモ（任意）</label>
          <input
            value={draft.memo}
            onChange={(e) => patch({ memo: e.target.value })}
            placeholder="例：二次会あり、ドレスコードなし"
            className="w-full p-3 border border-border rounded-xl text-sm bg-gray-bg focus:outline-none focus:border-green"
          />
        </div>
      </div>
    </>
  )
}

// =========================================================
// Step 3: 会計方式選択
// =========================================================
function Step3SettlementType({
  draft,
  onSelect,
}: {
  draft: EventDraft
  onSelect: (t: SettlementType) => void
}) {
  return (
    <>
      <h2 className="text-lg font-bold text-center mb-1">会計方式を選ぶ</h2>
      <p className="text-xs text-sub text-center mb-5">あとから変更できます</p>

      <div className="space-y-2">
        {SETTLEMENT_TYPES.map((t) => {
          const selected = draft.settlement_type === t
          return (
            <button
              key={t}
              type="button"
              onClick={() => onSelect(t)}
              className={`w-full text-left p-4 rounded-2xl border-2 transition ${
                selected
                  ? 'border-green bg-green-light'
                  : 'border-border bg-white hover:border-green/50'
              }`}
            >
              <div className={`font-bold text-sm mb-1 ${selected ? 'text-green-dark' : 'text-text'}`}>
                {SETTLEMENT_TITLE[t]}
              </div>
              <div className="text-xs text-sub leading-relaxed">
                {SETTLEMENT_DESCRIPTION[t]}
              </div>
            </button>
          )
        })}
      </div>
    </>
  )
}

// =========================================================
// Step 4: 会計詳細
// =========================================================
function Step4SettlementDetail(props: {
  draft: EventDraft
  patch: (p: Partial<EventDraft>) => void
  memberNames: string[]
  includedNames: string[]
  toggleIncluded: (name: string) => void
  toggleWeightedTarget: (name: string) => void
  setMemberPreset: (name: string, preset: WeightPreset) => void
  setManualAmount: (name: string, value: number | null) => void
  addExpense: (e: DraftExpense) => void
  removeExpense: (i: number) => void
  equalPreview: ReturnType<typeof calcEqualSplit> | null
  weightedPreview: ReturnType<typeof calcWeightedSplit> | null
  reimbursementPreview: ReturnType<typeof calcReimbursementSplit> | null
}) {
  const { draft } = props

  return (
    <>
      <h2 className="text-lg font-bold text-center mb-5">
        {draft.settlement_type ? SETTLEMENT_TITLE[draft.settlement_type] : '詳細'}の設定
      </h2>

      {draft.settlement_type === 'equal_split' && <EqualForm {...props} />}
      {draft.settlement_type === 'weighted_split' && <WeightedForm {...props} />}
      {draft.settlement_type === 'reimbursement_split' && <ReimbursementForm {...props} />}
    </>
  )
}

function EqualForm({
  draft,
  patch,
  memberNames,
  includedNames,
  toggleIncluded,
  equalPreview,
}: {
  draft: EventDraft
  patch: (p: Partial<EventDraft>) => void
  memberNames: string[]
  includedNames: string[]
  toggleIncluded: (name: string) => void
  equalPreview: ReturnType<typeof calcEqualSplit> | null
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs font-semibold text-sub mb-1 block">合計金額 *</label>
        <input
          type="number"
          inputMode="numeric"
          value={draft.total_amount ?? ''}
          onChange={(e) => patch({ total_amount: e.target.value === '' ? null : parseInt(e.target.value, 10) })}
          placeholder="例：12000"
          className="w-full p-3 border border-border rounded-xl text-sm bg-gray-bg focus:outline-none focus:border-green font-inter font-bold"
        />
      </div>

      <div>
        <label className="text-xs font-semibold text-sub mb-1 block">誰で割るか</label>
        {memberNames.length === 0 ? (
          <p className="text-xs text-sub bg-gray-bg p-3 rounded-xl">
            招待URLから他メンバーに自己登録してもらいます。詳細は揃ってからイベント管理画面で設定できます。
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {memberNames.map((n) => {
              const isIncluded = (
                draft.included_member_names.length === 0
                  ? true
                  : draft.included_member_names.includes(n)
              )
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => toggleIncluded(n)}
                  className={`text-xs px-3 py-1.5 rounded-full border-2 font-semibold transition ${
                    isIncluded
                      ? 'border-green bg-green-light text-green-dark'
                      : 'border-border bg-white text-sub'
                  }`}
                >
                  {n}
                </button>
              )
            })}
          </div>
        )}
        <label className="flex items-center gap-2 mt-2 text-xs text-sub">
          <input
            type="checkbox"
            checked={draft.exclude_organizer}
            onChange={(e) => patch({ exclude_organizer: e.target.checked })}
            className="accent-green"
          />
          幹事を対象から外す（任意）
        </label>
      </div>

      <div>
        <label className="text-xs font-semibold text-sub mb-1 block">端数処理</label>
        <div className="grid grid-cols-3 gap-1.5">
          {(['floor', 'round', 'ceil'] as RoundingRule[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => patch({ rounding_rule: r })}
              className={`text-xs py-2 px-2 rounded-xl border-2 font-semibold transition ${
                draft.rounding_rule === r
                  ? 'border-green bg-green-light text-green-dark'
                  : 'border-border bg-white text-sub'
              }`}
            >
              {ROUNDING_LABEL[r]}
            </button>
          ))}
        </div>
      </div>

      {/* プレビュー */}
      <div className="bg-gray-bg rounded-2xl p-4">
        <div className="text-xs text-sub mb-1">1人あたり</div>
        <div className="font-inter text-2xl font-extrabold text-green">
          ¥{(equalPreview?.perPerson ?? 0).toLocaleString()}
        </div>
        <div className="text-[11px] text-sub mt-1">
          対象 {includedNames.length}人 / 合計 ¥{(draft.total_amount ?? 0).toLocaleString()}
        </div>
      </div>
    </div>
  )
}

function WeightedForm({
  draft,
  patch,
  memberNames,
  toggleWeightedTarget,
  setMemberPreset,
  setManualAmount,
  weightedPreview,
}: {
  draft: EventDraft
  patch: (p: Partial<EventDraft>) => void
  memberNames: string[]
  toggleWeightedTarget: (name: string) => void
  setMemberPreset: (name: string, preset: WeightPreset) => void
  setManualAmount: (name: string, value: number | null) => void
  weightedPreview: ReturnType<typeof calcWeightedSplit> | null
}) {
  const targets = draft.weighted_member_names.length > 0
    ? draft.weighted_member_names
    : memberNames

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs font-semibold text-sub mb-1 block">合計金額 *</label>
        <input
          type="number"
          inputMode="numeric"
          value={draft.total_amount ?? ''}
          onChange={(e) => patch({ total_amount: e.target.value === '' ? null : parseInt(e.target.value, 10) })}
          placeholder="例：30000"
          className="w-full p-3 border border-border rounded-xl text-sm bg-gray-bg focus:outline-none focus:border-green font-inter font-bold"
        />
      </div>

      <div>
        <label className="text-xs font-semibold text-sub mb-1 block">対象メンバー</label>
        {memberNames.length === 0 ? (
          <p className="text-xs text-sub bg-gray-bg p-3 rounded-xl">
            招待URLから他メンバーに自己登録してもらいます。詳細は揃ってからイベント管理画面で設定できます。
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {memberNames.map((n) => {
              const isTarget = targets.includes(n)
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => toggleWeightedTarget(n)}
                  className={`text-xs px-3 py-1.5 rounded-full border-2 font-semibold transition ${
                    isTarget
                      ? 'border-green bg-green-light text-green-dark'
                      : 'border-border bg-white text-sub'
                  }`}
                >
                  {n}
                </button>
              )
            })}
          </div>
        )}
      </div>

      <div>
        <label className="text-xs font-semibold text-sub mb-1 block">差のつけ方（メンバーごと）</label>
        <div className="space-y-2">
          {targets.map((n) => {
            const w = draft.member_weights[n] ?? 1.0
            const manual = draft.manual_amounts[n]
            const previewAmt = weightedPreview?.shares[n] ?? 0
            const currentPreset: WeightPreset =
              w >= 1.2 ? 'more' : w <= 0.8 ? 'less' : 'normal'
            return (
              <div key={n} className="bg-white border border-border rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-semibold">{n}</div>
                  <div className="font-inter text-sm font-bold text-green">
                    ¥{previewAmt.toLocaleString()}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-1.5 mb-2">
                  {(['more', 'normal', 'less'] as WeightPreset[]).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setMemberPreset(n, p)}
                      className={`text-[11px] py-1.5 rounded-lg border-2 font-semibold transition ${
                        currentPreset === p && manual == null
                          ? 'border-green bg-green-light text-green-dark'
                          : 'border-border bg-white text-sub'
                      }`}
                    >
                      {WEIGHT_PRESET_LABEL[p]}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-sub">直接入力:</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={manual ?? ''}
                    onChange={(e) =>
                      setManualAmount(n, e.target.value === '' ? null : parseInt(e.target.value, 10))
                    }
                    placeholder="未指定"
                    className="flex-1 p-1.5 border border-border rounded-lg text-xs font-inter font-bold text-right focus:outline-none focus:border-green"
                  />
                  <span className="text-[11px] text-sub">円</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* 整合チェック */}
      {weightedPreview && (
        <div
          className={`rounded-xl p-3 text-xs font-semibold ${
            weightedPreview.mismatch
              ? 'bg-red-50 border border-red-200 text-red-700'
              : 'bg-green-light border border-green/30 text-green-dark'
          }`}
        >
          合計 ¥{weightedPreview.actualTotal.toLocaleString()} / ¥{weightedPreview.expectedTotal.toLocaleString()}
          {weightedPreview.mismatch && (
            <span className="block mt-0.5">
              ⚠ 差分: ¥{(weightedPreview.expectedTotal - weightedPreview.actualTotal).toLocaleString()}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

function ReimbursementForm({
  draft,
  patch,
  memberNames,
  addExpense,
  removeExpense,
  reimbursementPreview,
}: {
  draft: EventDraft
  patch: (p: Partial<EventDraft>) => void
  memberNames: string[]
  addExpense: (e: DraftExpense) => void
  removeExpense: (i: number) => void
  reimbursementPreview: ReturnType<typeof calcReimbursementSplit> | null
}) {
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [payerName, setPayerName] = useState('')
  const [splitTarget, setSplitTarget] = useState<'all' | 'specific'>('all')
  const [targetNames, setTargetNames] = useState<string[]>([])
  const [note, setNote] = useState('')

  function toggleTarget(n: string) {
    setTargetNames((prev) =>
      prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n]
    )
  }

  function handleAdd() {
    if (!name.trim() || !amount || !payerName) return
    addExpense({
      name: name.trim(),
      amount: parseInt(amount, 10),
      payer_name: payerName,
      split_target: splitTarget,
      target_names: splitTarget === 'all' ? memberNames : targetNames,
      note: note.trim() || undefined,
    })
    setName('')
    setAmount('')
    setPayerName('')
    setSplitTarget('all')
    setTargetNames([])
    setNote('')
  }

  if (memberNames.length === 0) {
    return (
      <div className="space-y-4">
        <p className="text-xs text-sub bg-gray-bg p-3 rounded-xl leading-relaxed">
          招待URLから他メンバーに自己登録してもらいます。<br />
          立替の登録はメンバーが揃ってから、イベント管理画面で行えます。
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* 立替項目一覧 */}
      <div>
        <h3 className="text-xs font-semibold text-sub mb-2">立替項目</h3>
        {draft.expense_items.length === 0 ? (
          <p className="text-xs text-sub bg-gray-bg p-3 rounded-xl">
            まだ登録されていません。下のフォームから追加してください。
          </p>
        ) : (
          <div className="space-y-2">
            {draft.expense_items.map((e, i) => (
              <div key={i} className="bg-white border border-border rounded-xl p-3 flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">{e.name}</div>
                  <div className="text-[11px] text-sub">
                    {e.payer_name} 立替 / {e.split_target === 'all' ? '全員' : `${e.target_names.length}人`}で割る
                  </div>
                </div>
                <div className="font-inter text-sm font-bold">¥{e.amount.toLocaleString()}</div>
                <button
                  onClick={() => removeExpense(i)}
                  className="text-sub hover:text-red-500 text-xs px-1"
                  aria-label="削除"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 立替追加フォーム */}
      <div className="bg-gray-bg rounded-2xl p-3 space-y-2">
        <div className="text-xs font-semibold text-sub">立替を追加</div>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="費目（例: 食材、宿代）"
          className="w-full p-2.5 border border-border rounded-xl text-xs bg-white focus:outline-none focus:border-green"
        />
        <div className="grid grid-cols-2 gap-2">
          <input
            type="number"
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="金額"
            className="p-2.5 border border-border rounded-xl text-xs bg-white focus:outline-none focus:border-green font-inter font-bold"
          />
          <select
            value={payerName}
            onChange={(e) => setPayerName(e.target.value)}
            className="p-2.5 border border-border rounded-xl text-xs bg-white focus:outline-none focus:border-green"
          >
            <option value="">立替者を選ぶ</option>
            {memberNames.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
        <div>
          <div className="grid grid-cols-2 gap-1.5 mb-1.5">
            <button
              type="button"
              onClick={() => setSplitTarget('all')}
              className={`text-xs py-2 rounded-lg border-2 font-semibold transition ${
                splitTarget === 'all'
                  ? 'border-green bg-green-light text-green-dark'
                  : 'border-border bg-white text-sub'
              }`}
            >
              全員で割る
            </button>
            <button
              type="button"
              onClick={() => setSplitTarget('specific')}
              className={`text-xs py-2 rounded-lg border-2 font-semibold transition ${
                splitTarget === 'specific'
                  ? 'border-green bg-green-light text-green-dark'
                  : 'border-border bg-white text-sub'
              }`}
            >
              一部の人で割る
            </button>
          </div>
          {splitTarget === 'specific' && (
            <div className="flex flex-wrap gap-1">
              {memberNames.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => toggleTarget(n)}
                  className={`text-[11px] px-2 py-1 rounded-full border-2 font-semibold transition ${
                    targetNames.includes(n)
                      ? 'border-green bg-green-light text-green-dark'
                      : 'border-border bg-white text-sub'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          )}
        </div>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="メモ（任意）"
          className="w-full p-2.5 border border-border rounded-xl text-xs bg-white focus:outline-none focus:border-green"
        />
        <button
          onClick={handleAdd}
          disabled={!name.trim() || !amount || !payerName}
          className="w-full py-2.5 bg-green text-white text-xs font-bold rounded-xl disabled:opacity-40 hover:bg-green-dark transition"
        >
          この立替を追加
        </button>
      </div>

      {/* 最終調整方式 */}
      <div>
        <label className="text-xs font-semibold text-sub mb-1 block">最終差額の調整</label>
        <div className="grid grid-cols-2 gap-1.5">
          {(['minimum', 'even'] as FinalAdjustmentMode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => patch({ final_adjustment_mode: m })}
              className={`text-xs py-2 px-2 rounded-xl border-2 font-semibold transition ${
                draft.final_adjustment_mode === m
                  ? 'border-green bg-green-light text-green-dark'
                  : 'border-border bg-white text-sub'
              }`}
            >
              {FINAL_ADJUSTMENT_LABEL[m]}
            </button>
          ))}
        </div>
      </div>

      {/* プレビュー */}
      {reimbursementPreview && reimbursementPreview.settlements.length > 0 && (
        <div className="bg-gray-bg rounded-2xl p-3">
          <div className="text-xs font-semibold text-sub mb-2">最終差額プレビュー</div>
          <div className="space-y-1">
            {reimbursementPreview.settlements.map((s, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span>
                  <span className="font-semibold">{s.from}</span>
                  <span className="text-sub mx-1">→</span>
                  <span className="font-semibold">{s.to}</span>
                </span>
                <span className="font-inter font-bold">¥{s.amount.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// =========================================================
// Step 5: 確認
// =========================================================
function Step5Confirm({
  draft,
  equalPreview,
  weightedPreview,
  reimbursementPreview,
}: {
  draft: EventDraft
  equalPreview: ReturnType<typeof calcEqualSplit> | null
  weightedPreview: ReturnType<typeof calcWeightedSplit> | null
  reimbursementPreview: ReturnType<typeof calcReimbursementSplit> | null
}) {
  return (
    <>
      <h2 className="text-lg font-bold text-center mb-5">内容を確認</h2>

      <div className="space-y-3">
        <SummaryRow label="テンプレート">
          {draft.event_template ? TEMPLATE_LABELS[draft.event_template] : '—'}
        </SummaryRow>
        <SummaryRow label="会の名前">{draft.title || '—'}</SummaryRow>
        <SummaryRow label="開催日時">
          {draft.event_date || '未指定'}
          {draft.event_time && ` ${draft.event_time}`}
        </SummaryRow>
        <SummaryRow label="場所">{draft.venue_name || '未指定'}</SummaryRow>
        <SummaryRow label="参加メンバー">幹事1名 + 招待URLから自己登録</SummaryRow>
        <SummaryRow label="会計方式">
          {draft.settlement_type ? SETTLEMENT_TITLE[draft.settlement_type] : '—'}
        </SummaryRow>

        {draft.settlement_type === 'equal_split' && (
          <>
            <SummaryRow label="合計金額">
              ¥{(draft.total_amount ?? 0).toLocaleString()}
            </SummaryRow>
            <SummaryRow label="1人あたり">
              <span className="font-inter font-extrabold text-green">
                ¥{(equalPreview?.perPerson ?? 0).toLocaleString()}
              </span>
            </SummaryRow>
            <SummaryRow label="端数処理">{ROUNDING_LABEL[draft.rounding_rule]}</SummaryRow>
          </>
        )}

        {draft.settlement_type === 'weighted_split' && weightedPreview && (
          <>
            <SummaryRow label="合計金額">
              ¥{(draft.total_amount ?? 0).toLocaleString()}
            </SummaryRow>
            <div className="bg-white border border-border rounded-xl p-3">
              <div className="text-xs font-semibold text-sub mb-2">メンバー別請求額</div>
              <div className="space-y-1">
                {Object.entries(weightedPreview.shares).map(([n, amt]) => (
                  <div key={n} className="flex items-center justify-between text-xs">
                    <span>{n}</span>
                    <span className="font-inter font-bold">¥{amt.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {draft.settlement_type === 'reimbursement_split' && (
          <>
            <SummaryRow label="立替項目数">{draft.expense_items.length}件</SummaryRow>
            {reimbursementPreview && reimbursementPreview.settlements.length > 0 && (
              <div className="bg-white border border-border rounded-xl p-3">
                <div className="text-xs font-semibold text-sub mb-2">精算プレビュー</div>
                <div className="space-y-1">
                  {reimbursementPreview.settlements.map((s, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <span>
                        <span className="font-semibold">{s.from}</span>
                        <span className="text-sub mx-1">→</span>
                        <span className="font-semibold">{s.to}</span>
                      </span>
                      <span className="font-inter font-bold">¥{s.amount.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <p className="text-[11px] text-sub mt-4">
        「イベントを作成する」を押すと管理画面に移動します。招待URLをLINEで共有してメンバーを集め、揃ったら請求を開始してください。
      </p>
    </>
  )
}

function SummaryRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-border rounded-xl px-3 py-2.5 flex items-center justify-between gap-2">
      <span className="text-[11px] text-sub shrink-0">{label}</span>
      <span className="text-xs text-text text-right font-semibold truncate">{children}</span>
    </div>
  )
}

// applyRounding を Step4 で型互換のため再宣言する必要なし（unused削除）
void applyRounding
