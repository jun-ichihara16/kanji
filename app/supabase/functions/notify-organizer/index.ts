import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const APP_URL = 'https://kanji-relief.com/app'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const ACCESS_TOKEN = Deno.env.get('LINE_BOT_ACCESS_TOKEN')!
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // 現在時刻（JST）
    const now = new Date()
    const jstHour = (now.getUTCHours() + 9) % 24
    const jstMinute = now.getUTCMinutes()
    const currentTime = `${String(jstHour).padStart(2, '0')}:${String(jstMinute).padStart(2, '0')}`
    // 分単位の一致は厳しすぎるので、時間単位で比較
    const currentHour = `${String(jstHour).padStart(2, '0')}:00`

    console.log(`[notify-organizer] Current JST: ${currentTime}, checking hour: ${currentHour}`)

    // リマインド有効 & 該当時間のイベントを取得
    const { data: events, error: evErr } = await supabase
      .from('events')
      .select('id, title, host_id, reminder_time')
      .eq('reminder_enabled', true)

    if (evErr || !events || events.length === 0) {
      return new Response(JSON.stringify({ ok: true, message: 'No events to notify', count: 0 }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // 時間が一致するイベントをフィルタ
    const matchingEvents = events.filter((ev: any) => {
      const reminderHour = (ev.reminder_time || '20:00').substring(0, 2) + ':00'
      return reminderHour === currentHour
    })

    console.log(`[notify-organizer] Matching events: ${matchingEvents.length}`)

    let notifiedCount = 0

    for (const ev of matchingEvents) {
      // 幹事のLINE user IDを取得
      if (!ev.host_id) continue
      const { data: user } = await supabase
        .from('users')
        .select('line_user_id')
        .eq('id', ev.host_id)
        .single()

      if (!user?.line_user_id) continue

      // 未精算データを確認
      const [advRes, settRes] = await Promise.all([
        supabase.from('advances').select('payer_name, amount, split_target, target_names').eq('event_id', ev.id),
        supabase.from('settlements').select('from_name, to_name, is_settled').eq('event_id', ev.id),
      ])

      const advances = advRes.data || []
      if (advances.length === 0) continue

      const settledMap: Record<string, boolean> = {}
      ;(settRes.data || []).forEach((s: any) => { settledMap[`${s.from_name}-${s.to_name}`] = s.is_settled })

      // 精算計算して未精算件数を確認
      const { data: parts } = await supabase.from('participants').select('name').eq('event_id', ev.id)
      const names = (parts || []).map((p: any) => p.name)
      const allNames = new Set([...names, ...advances.map((a: any) => a.payer_name)])

      // 簡易カウント
      const balance: Record<string, number> = {}
      ;[...allNames].forEach((n) => { balance[n] = 0 })
      for (const adv of advances) {
        const targets = adv.split_target === 'all' ? [...allNames] : (adv.target_names ?? [])
        if (targets.length === 0) continue
        balance[adv.payer_name] = (balance[adv.payer_name] ?? 0) + adv.amount
        const share = Math.floor(adv.amount / targets.length)
        for (const t of targets) { balance[t] = (balance[t] ?? 0) - share }
      }

      const unsettledCount = Object.entries(balance).filter(([_, bal]) => bal < 0).length -
        Object.values(settledMap).filter(Boolean).length

      if (unsettledCount <= 0) continue

      // 幹事に個人メッセージ送信
      const pushRes = await fetch('https://api.line.me/v2/bot/message/push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${ACCESS_TOKEN}`,
        },
        body: JSON.stringify({
          to: user.line_user_id,
          messages: [{
            type: 'text',
            text: `📊 AI KANJI リマインド\n\n「${ev.title}」に未精算が残っています。\n\n管理画面で確認して、グループにリマインドを送りましょう。\n\n${APP_URL}/events/${ev.id}`,
          }],
        }),
      })

      if (pushRes.ok) {
        notifiedCount++
        console.log(`[notify-organizer] Notified host for event: ${ev.title}`)
      } else {
        const err = await pushRes.text()
        console.error(`[notify-organizer] Push failed for ${ev.id}:`, err)
      }
    }

    return new Response(
      JSON.stringify({ ok: true, notified: notifiedCount }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('[notify-organizer] Error:', err)
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
