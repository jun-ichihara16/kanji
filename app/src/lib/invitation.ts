// Phase 2 v1.2 C-8: 招待トラッキングのクライアント側ヘルパー
//
// 3層構造:
//   第1層: URL パラメータ ?inv=<token>(即時性)
//   第2層: invitations テーブル(信頼性)
//   第3層: localStorage(フォールバック)
//
// 設計判断:
//   - LIFF state は KANJI が LIFF を使っていない構成なので第3層は localStorage のみ
//   - LINE OAuth 直接認証で auth.uid() を使えないため、user_id は明示的に渡す
//   - 失敗はすべて握りつぶし、招待トラッキングの不具合がアプリ本体を止めないようにする
//
// 参照: docs/phase2/02_implementation_plan.md § 2, app/migrations/011_phase2_invitations.sql

import { supabase } from './supabase'
import { nanoid } from 'nanoid'

// 純粋ヘルパーは invitation-url.ts に分離(supabase 依存を切り離してテスト可能にするため)
export { appendInvToken } from './invitation-url'

export type RedemptionLayer = 'url_param' | 'liff_state' | 'local_storage' | 'db_lookup'

export type ResolvedInvitation = {
  token: string
  source_event_id: string
  source_host_user_id: string | null
  layer: RedemptionLayer
}

const LOCAL_STORAGE_KEY = 'kanji_inv_token'

/**
 * 招待 token を発行して invitations に記録する。
 * 既に同じ event に対して同じ host が発行済みの token があれば再利用する。
 */
export async function createInvitationToken(
  eventId: string,
  hostUserId: string,
): Promise<{ token: string | null; error?: unknown }> {
  // 既存トークンがあれば再利用(URL の安定性を保つ)
  try {
    const { data: existing } = await supabase
      .from('invitations')
      .select('token')
      .eq('source_event_id', eventId)
      .eq('source_host_user_id', hostUserId)
      .is('redeemed_at', null)
      .limit(1)
      .maybeSingle()

    if (existing?.token) {
      return { token: existing.token }
    }
  } catch {
    // 既存検索が失敗しても新規発行を試みる
  }

  // 新規発行: nanoid(10) で URL safe な短縮 ID
  const token = nanoid(10)
  const { error } = await supabase.from('invitations').insert({
    token,
    source_event_id: eventId,
    source_host_user_id: hostUserId,
  })
  if (error) {
    return { token: null, error }
  }
  return { token }
}

/**
 * URL → localStorage の順に token を解決し、invitations から source を引く。
 * 見つからなければ null。
 */
export async function resolveInvitation(): Promise<ResolvedInvitation | null> {
  // 第1層: URL パラメータ
  const urlParams = new URLSearchParams(window.location.search)
  let token = urlParams.get('inv')
  let layer: RedemptionLayer = 'url_param'

  // 第3層: localStorage(初回 URL 経由訪問時に保存されたものに頼る)
  if (!token) {
    token = localStorage.getItem(LOCAL_STORAGE_KEY)
    if (token) layer = 'local_storage'
  }

  if (!token) return null

  try {
    const { data, error } = await supabase
      .from('invitations')
      .select('token, source_event_id, source_host_user_id, redeemed_at')
      .eq('token', token)
      .maybeSingle()

    if (error || !data) return null

    // URL 経由なら次回訪問のために localStorage に残す
    if (layer === 'url_param') {
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, token)
      } catch {
        // private browsing 等で書き込めない場合はスキップ
      }
    }

    return {
      token: data.token,
      source_event_id: data.source_event_id,
      source_host_user_id: data.source_host_user_id,
      layer,
    }
  } catch {
    return null
  }
}

/**
 * 招待 token を消費したことを記録する。二重消費は防止する。
 *
 * @param token 招待 token
 * @param redeemedUserId 参加者(消費した側)の user_id
 * @param redeemedEventId 参加が成立したイベント ID(通常は source_event_id と同じ)
 * @param layer 捕捉経路
 */
export async function redeemInvitation(input: {
  token: string
  redeemedUserId: string
  redeemedEventId: string
  layer: RedemptionLayer
}): Promise<{ firstRedemption: boolean; error?: unknown }> {
  try {
    const { data, error } = await supabase
      .from('invitations')
      .update({
        redeemed_user_id: input.redeemedUserId,
        redeemed_event_id: input.redeemedEventId,
        redeemed_at: new Date().toISOString(),
        redemption_layer: input.layer,
      })
      .eq('token', input.token)
      .is('redeemed_at', null)
      .select('id')
    const firstRedemption = Array.isArray(data) && data.length > 0
    return { firstRedemption, error }
  } catch (e) {
    return { firstRedemption: false, error: e }
  }
}

/**
 * イベント作成時に「参加者→幹事化」を判定し、events に反映する。
 *
 * 判定ロジック:
 *   1. localStorage に保存された招待 token があれば、その source_event_id を originated_from_event_id とし、host_was_participant=true
 *   2. なければ、user_id が過去に participants に登録されているか調べ、見つかれば最も新しい event_id を採用
 *   3. どちらも無ければ host_was_participant=false のまま
 */
export async function detectHostWasParticipant(input: {
  newEventId: string
  hostUserId: string
}): Promise<{ updated: boolean }> {
  let originatedFrom: string | null = null

  // 1. localStorage の招待 token から推定
  try {
    const storedToken = localStorage.getItem(LOCAL_STORAGE_KEY)
    if (storedToken) {
      const { data } = await supabase
        .from('invitations')
        .select('source_event_id')
        .eq('token', storedToken)
        .maybeSingle()
      if (data?.source_event_id && data.source_event_id !== input.newEventId) {
        originatedFrom = data.source_event_id
      }
    }
  } catch {
    // 続行
  }

  // 2. participants 履歴から推定
  if (!originatedFrom) {
    try {
      const { data } = await supabase
        .from('participants')
        .select('event_id, created_at')
        .eq('user_id', input.hostUserId)
        .neq('event_id', input.newEventId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (data?.event_id) {
        originatedFrom = data.event_id
      }
    } catch {
      // 続行
    }
  }

  if (!originatedFrom) {
    return { updated: false }
  }

  try {
    const { error } = await supabase
      .from('events')
      .update({
        host_was_participant: true,
        originated_from_event_id: originatedFrom,
      })
      .eq('id', input.newEventId)
    return { updated: !error }
  } catch {
    return { updated: false }
  }
}
