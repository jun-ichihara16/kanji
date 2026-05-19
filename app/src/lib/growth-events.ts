// Phase 2 v1.2 行動ログ growth_events のクライアント側ヘルパー
//
// 設計方針:
//  - 個人特定情報(氏名・PayPay 番号・LINE userId 生値・金額の生数値)は payload に入れない
//  - 失敗してもアプリ本体の動作を止めない(catch して握りつぶす + console.warn)
//  - RLS により INSERT は auth.uid() === user_id のときのみ通る
//
// 参照: docs/phase2/02_implementation_plan.md § 4, app/migrations/009_phase2_growth_events.sql

import { supabase } from './supabase'

export type GrowthEventType =
  | 'manual_reminder_copied'
  | 'reminder_sent'
  | 'settlement_marked_paid'
  | 'bulk_settle_clicked'
  | 'participant_joined'
  | 'invite_token_redeemed'
  | 'host_first_completion'
  | 'event_completed'

export type GrowthEventPayload = {
  // 数値メタ・カテゴリ識別子のみを許可。
  // 任意キーを許可するが、呼び出し側で「個人特定情報を入れない」責任を負う。
  [key: string]: string | number | boolean | null | undefined
}

export type TrackGrowthEventInput = {
  eventType: GrowthEventType
  userId: string
  eventId?: string | null
  payload?: GrowthEventPayload
}

/**
 * growth_events に1件記録する。失敗しても throw しない。
 * 戻り値: { ok: boolean, error?: unknown }
 */
export async function trackGrowthEvent(
  input: TrackGrowthEventInput,
): Promise<{ ok: boolean; error?: unknown }> {
  try {
    const { error } = await supabase.from('growth_events').insert({
      event_type: input.eventType,
      user_id: input.userId,
      event_id: input.eventId ?? null,
      payload: input.payload ?? {},
    })
    if (error) {
      // eslint-disable-next-line no-console
      console.warn('[growth_events] insert failed:', error.message)
      return { ok: false, error }
    }
    return { ok: true }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[growth_events] insert threw:', e)
    return { ok: false, error: e }
  }
}
