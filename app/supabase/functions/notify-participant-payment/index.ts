// Phase 2 v1.2 C-6 拡張: LINE ログイン済み参加者への個別 push リマインド
//
// 設計:
//   - 入力: { eventId, participantId, hostUserId }
//   - 認可: hostUserId === events.host_id のときのみ送信可
//   - 対象: participants.user_id 経由で users.line_user_id を引いた参加者
//   - 文面: 個別宛て(buildIndividualReminderText と同じ構造を Edge 側で再構築)
//   - 副作用: growth_events に reminder_sent を記録
//
// 失敗ケース:
//   - 参加者が LINE 未連携(participant.user_id IS NULL or users.line_user_id IS NULL)
//     → 400 を返し、クライアント側でフォールバック(催促文コピーボタン)を促す
//   - LINE 公式アカウントを友だち追加していない
//     → LINE API が 400 を返す。Edge 側でそのまま 502 にして返す
//
// 参照: app/supabase/functions/send-group-reminder/index.ts(既存パターン)

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const APP_URL = 'https://kanji-relief.com/app'

type RequestPayload = {
  eventId?: string
  /** 送信対象の participant.id */
  participantId?: string
  /** リクエスト元の幹事 user.id(認可確認用) */
  hostUserId?: string
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { eventId, participantId, hostUserId } = (await req.json()) as RequestPayload
    if (!eventId || !participantId || !hostUserId) {
      return json({ error: 'eventId, participantId, hostUserId are required' }, 400)
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const ACCESS_TOKEN = Deno.env.get('LINE_BOT_ACCESS_TOKEN')
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !ACCESS_TOKEN) {
      return json({ error: 'Server misconfigured' }, 500)
    }
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // 1. イベント取得 + 認可
    const { data: ev } = await supabase
      .from('events')
      .select('id, title, slug, host_id')
      .eq('id', eventId)
      .single()
    if (!ev) return json({ error: 'Event not found' }, 404)
    if (ev.host_id !== hostUserId) {
      return json({ error: 'Forbidden: only the event host can send reminders' }, 403)
    }

    // 2. 対象 participant 取得
    const { data: participant } = await supabase
      .from('participants')
      .select('id, event_id, name, user_id, paypay_phone, paypay_link_url')
      .eq('id', participantId)
      .single()
    if (!participant || participant.event_id !== eventId) {
      return json({ error: 'Participant not found in this event' }, 404)
    }
    if (!participant.user_id) {
      return json({ error: 'Participant is not LINE-linked', reason: 'no_user_id' }, 400)
    }

    // 3. line_user_id を引く
    const { data: targetUser } = await supabase
      .from('users')
      .select('line_user_id, display_name')
      .eq('id', participant.user_id)
      .single()
    if (!targetUser?.line_user_id) {
      return json({ error: 'Target user has no line_user_id', reason: 'no_line_user_id' }, 400)
    }

    // 4. 未精算の settlement(複数受取人合算)を取得
    const { data: settlements } = await supabase
      .from('settlements')
      .select('from_name, to_name, amount, is_settled')
      .eq('event_id', eventId)
      .eq('from_name', participant.name)
      .eq('is_settled', false)

    if (!settlements || settlements.length === 0) {
      return json({ error: 'No unsettled rows for this participant', reason: 'no_unsettled' }, 400)
    }

    const totalAmount = settlements.reduce((sum, s) => sum + (s.amount as number), 0)

    // 5. 文面を組み立て(クライアント側 reminder-template.ts と同じトーン)
    const eventUrl = `${APP_URL}/e/${ev.slug}`
    const lines: string[] = [
      `${participant.name}さん、お忙しいところすみません。`,
      ``,
      `「${ev.title}」の精算がまだ残っているようなので、念のため共有します。`,
    ]
    for (const s of settlements) {
      lines.push(`${s.to_name}さんへ ¥${(s.amount as number).toLocaleString()}`)
    }
    if (settlements.length > 1) {
      lines.push(``, `合計: ¥${totalAmount.toLocaleString()}`)
    }
    lines.push(``, `詳細はこちらから確認できます:`, eventUrl)
    const text = lines.join('\n')

    // 6. LINE Push
    const pushRes = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ACCESS_TOKEN}`,
      },
      body: JSON.stringify({
        to: targetUser.line_user_id,
        messages: [{ type: 'text', text }],
      }),
    })

    if (!pushRes.ok) {
      const detail = await pushRes.text()
      console.error('[notify-participant-payment] LINE push failed:', pushRes.status, detail)
      return json(
        { error: 'LINE push failed', status: pushRes.status, detail, reason: 'line_push_failed' },
        502,
      )
    }

    // 7. growth_events に記録(失敗しても全体は成功扱い)
    try {
      await supabase.from('growth_events').insert({
        event_type: 'reminder_sent',
        user_id: hostUserId,
        event_id: eventId,
        payload: {
          channel: 'line_push',
          settlement_count: settlements.length,
          target_participant_id_present: true,
        },
      })
    } catch (e) {
      console.warn('[notify-participant-payment] growth_events insert failed:', e)
    }

    return json({ ok: true, settlement_count: settlements.length, total: totalAmount }, 200)
  } catch (err) {
    console.error('[notify-participant-payment] Error:', err)
    return json({ error: String(err) }, 500)
  }
})

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
