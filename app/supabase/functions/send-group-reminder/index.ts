import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// 精算計算（settle.tsと同じロジック）
function calculateSettlements(
  advances: { payer_name: string; amount: number; split_target: string; target_names: string[] | null }[],
  names: string[]
) {
  const balance: Record<string, number> = {}
  names.forEach((n) => { balance[n] = 0 })

  for (const adv of advances) {
    const targets = adv.split_target === 'all' ? names : (adv.target_names ?? [])
    if (targets.length === 0) continue
    const baseShare = Math.floor(adv.amount / targets.length)
    const remainder = adv.amount - baseShare * targets.length
    balance[adv.payer_name] = (balance[adv.payer_name] ?? 0) + adv.amount
    for (let i = 0; i < targets.length; i++) {
      balance[targets[i]] = (balance[targets[i]] ?? 0) - (baseShare + (i < remainder ? 1 : 0))
    }
  }

  const creditors: { name: string; amount: number }[] = []
  const debtors: { name: string; amount: number }[] = []
  for (const [name, bal] of Object.entries(balance)) {
    if (bal > 0) creditors.push({ name, amount: bal })
    else if (bal < 0) debtors.push({ name, amount: -bal })
  }
  creditors.sort((a, b) => b.amount - a.amount)
  debtors.sort((a, b) => b.amount - a.amount)

  const settlements: { from: string; to: string; amount: number }[] = []
  let ci = 0, di = 0
  while (ci < creditors.length && di < debtors.length) {
    const amount = Math.min(creditors[ci].amount, debtors[di].amount)
    if (amount > 0) settlements.push({ from: debtors[di].name, to: creditors[ci].name, amount })
    creditors[ci].amount -= amount
    debtors[di].amount -= amount
    if (creditors[ci].amount === 0) ci++
    if (debtors[di].amount === 0) di++
  }
  return settlements
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { eventId } = await req.json()
    if (!eventId) {
      return new Response(JSON.stringify({ error: 'eventId required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const ACCESS_TOKEN = Deno.env.get('LINE_BOT_ACCESS_TOKEN')!
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // イベント取得
    const { data: ev, error: evErr } = await supabase.from('events').select('*').eq('id', eventId).single()
    if (evErr || !ev) {
      return new Response(JSON.stringify({ error: 'Event not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    if (!ev.line_group_id) {
      return new Response(JSON.stringify({ error: 'No LINE group linked' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // 参加者・立替・精算状態取得
    const [partRes, advRes, settRes] = await Promise.all([
      supabase.from('participants').select('*').eq('event_id', eventId),
      supabase.from('advances').select('*').eq('event_id', eventId),
      supabase.from('settlements').select('*').eq('event_id', eventId),
    ])

    const participants = partRes.data || []
    const advances = advRes.data || []
    const settledRecords = settRes.data || []

    if (advances.length === 0) {
      return new Response(JSON.stringify({ error: 'No advances to remind' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // 精算計算
    const allNames = new Set([...participants.map((p: any) => p.name), ...advances.map((a: any) => a.payer_name)])
    const settlements = calculateSettlements(advances, [...allNames])

    // 精算済みフィルタ
    const settledMap: Record<string, boolean> = {}
    settledRecords.forEach((s: any) => { settledMap[`${s.from_name}-${s.to_name}`] = s.is_settled })

    const unsettled = settlements.filter((s) => !settledMap[`${s.from}-${s.to}`])

    if (unsettled.length === 0) {
      return new Response(JSON.stringify({ ok: true, message: 'All settled' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Flex Message（レシート風）
    const total = advances.reduce((sum: number, a: any) => sum + a.amount, 0)

    const settlementRows = unsettled.map((s) => {
      const payee = participants.find((p: any) => p.name === s.to && p.payment_method === 'paypay')
      const payInfo = payee?.paypay_phone ? `(PayPay: ${payee.paypay_phone})` : ''
      return {
        type: 'box',
        layout: 'horizontal',
        contents: [
          { type: 'text', text: `${s.from} → ${s.to}`, size: 'sm', flex: 3, wrap: true },
          { type: 'text', text: `¥${s.amount.toLocaleString()}`, size: 'sm', align: 'end', weight: 'bold', flex: 2 },
        ],
        margin: 'md',
      }
    })

    const flexMessage = {
      type: 'flex',
      altText: `【${ev.title}】精算リマインド（未精算 ${unsettled.length}件）`,
      contents: {
        type: 'bubble',
        header: {
          type: 'box',
          layout: 'vertical',
          contents: [
            { type: 'text', text: '💰 精算リマインド', weight: 'bold', size: 'lg', color: '#22C55E' },
            { type: 'text', text: ev.title, weight: 'bold', size: 'md', margin: 'sm' },
          ],
          backgroundColor: '#F0FDF4',
          paddingAll: '20px',
        },
        body: {
          type: 'box',
          layout: 'vertical',
          contents: [
            { type: 'text', text: `合計: ¥${total.toLocaleString()} / ${allNames.size}人`, size: 'sm', color: '#6B7280' },
            { type: 'separator', margin: 'lg' },
            { type: 'text', text: `未精算（${unsettled.length}件）`, weight: 'bold', size: 'sm', margin: 'lg' },
            ...settlementRows,
            { type: 'separator', margin: 'lg' },
            { type: 'text', text: 'お早めに精算をお願いします🙏', size: 'xs', color: '#6B7280', margin: 'lg', wrap: true },
          ],
          paddingAll: '20px',
        },
      },
    }

    // Push Message（グループ宛）
    const pushRes = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
      },
      body: JSON.stringify({
        to: ev.line_group_id,
        messages: [flexMessage],
      }),
    })

    const pushResult = await pushRes.text()
    console.log('Push result:', pushRes.status, pushResult)

    if (!pushRes.ok) {
      return new Response(JSON.stringify({ error: 'LINE push failed', detail: pushResult }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({ ok: true, unsettled: unsettled.length }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (err) {
    console.error('Error:', err)
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
