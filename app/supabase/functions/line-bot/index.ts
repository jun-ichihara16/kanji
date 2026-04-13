import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { encode as base64Encode } from 'https://deno.land/std@0.177.0/encoding/base64.ts'

import { corsHeaders, handleCors } from '../_shared/cors.ts'

// ===== 署名検証 =====
async function verifySignature(body: string, signature: string, secret: string): Promise<boolean> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(body))
  const expected = base64Encode(new Uint8Array(sig))
  return expected === signature
}

// ===== LINE API ヘルパー =====
async function replyMessage(replyToken: string, messages: { type: string; text: string }[]) {
  const token = Deno.env.get('LINE_BOT_ACCESS_TOKEN')!
  await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ replyToken, messages }),
  })
}

async function getGroupMemberProfile(groupId: string, userId: string): Promise<string> {
  const token = Deno.env.get('LINE_BOT_ACCESS_TOKEN')!
  try {
    const res = await fetch(`https://api.line.me/v2/bot/group/${groupId}/member/${userId}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    })
    if (res.ok) {
      const profile = await res.json()
      return profile.displayName || 'Unknown'
    }
  } catch (e) {
    console.error('Failed to get profile:', e)
  }
  return 'Unknown'
}

// ===== Slug生成 =====
function generateSlug(len = 12): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let slug = ''
  const arr = new Uint8Array(len)
  crypto.getRandomValues(arr)
  for (let i = 0; i < len; i++) slug += chars[arr[i] % chars.length]
  return slug
}

// ===== 精算計算 =====
interface Settlement { from: string; to: string; amount: number }

function calculateSettlements(
  advances: { payer_name: string; amount: number; split_target: string; target_names: string[] | null }[],
  participantNames: string[]
): Settlement[] {
  const balance: Record<string, number> = {}
  participantNames.forEach((n) => { balance[n] = 0 })

  for (const adv of advances) {
    const targets = adv.split_target === 'all' ? participantNames : (adv.target_names ?? [])
    if (targets.length === 0) continue
    const share = Math.round(adv.amount / targets.length)
    balance[adv.payer_name] = (balance[adv.payer_name] ?? 0) + adv.amount
    for (const name of targets) {
      balance[name] = (balance[name] ?? 0) - share
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

  const settlements: Settlement[] = []
  let ci = 0, di = 0
  while (ci < creditors.length && di < debtors.length) {
    const credit = creditors[ci], debt = debtors[di]
    const amount = Math.min(credit.amount, debt.amount)
    if (amount > 0) settlements.push({ from: debt.name, to: credit.name, amount })
    credit.amount -= amount
    debt.amount -= amount
    if (credit.amount === 0) ci++
    if (debt.amount === 0) di++
  }
  return settlements
}

// ===== APP URL =====
const APP_URL = 'https://kanji-relief.com/app'

// ===== メイン =====
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const secret = Deno.env.get('LINE_BOT_CHANNEL_SECRET')!
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  try {
    const body = await req.text()
    const signature = req.headers.get('x-line-signature') || ''

    // 署名検証
    const valid = await verifySignature(body, signature, secret)
    if (!valid) {
      console.error('Signature verification failed')
      return new Response('Unauthorized', { status: 401 })
    }

    const payload = JSON.parse(body)
    const events = payload.events || []

    for (const event of events) {
      const replyToken = event.replyToken
      const sourceType = event.source?.type // 'group' | 'room' | 'user'
      const groupId = event.source?.groupId || event.source?.roomId
      const userId = event.source?.userId
      const webhookEventId = event.webhookEventId

      // === べき等性チェック: 同じwebhookイベントが再送された場合はスキップ ===
      if (webhookEventId) {
        const { data: existing } = await supabase
          .from('webhook_event_log')
          .select('webhook_event_id')
          .eq('webhook_event_id', webhookEventId)
          .maybeSingle()
        if (existing) {
          console.log(`Skipping duplicate webhook event: ${webhookEventId}`)
          continue
        }
      }

      // ===== joinイベント: Botがグループに追加された =====
      if (event.type === 'join') {
        console.log('Bot joined group:', groupId)
        await replyMessage(replyToken, [{
          type: 'text',
          text: `AI KANJIをグループに追加してくれてありがとうございます！🎉\n\n以下のコマンドが使えます：\n\n📅 @KANJI イベント作成 [タイトル]\n👥 @KANJI 参加者\n💰 @KANJI 立替 [金額] [内容]\n🔄 @KANJI 精算\n❓ @KANJI ヘルプ`,
        }])
        continue
      }

      // ===== messageイベント =====
      if (event.type === 'message' && event.message?.type === 'text') {
        const text = (event.message.text || '').trim()

        // @KANJI で始まるメッセージのみ反応
        if (!text.startsWith('@KANJI') && !text.startsWith('@kanji') && !text.startsWith('@Kanji')) {
          continue
        }

        // グループ・トークルーム以外は無視
        if (sourceType !== 'group' && sourceType !== 'room') {
          await replyMessage(replyToken, [{
            type: 'text',
            text: 'AI KANJIはグループチャットで使えます。グループにBotを追加してください。',
          }])
          continue
        }

        // コマンドをパース
        const cmd = text.replace(/^@[Kk][Aa][Nn][Jj][Ii]\s*/i, '').trim()

        // ---------- ヘルプ（デフォルト） ----------
        if (!cmd || cmd === 'ヘルプ' || cmd === 'help') {
          await replyMessage(replyToken, [{
            type: 'text',
            text: `📖 AI KANJI の使い方\n\n📅 @KANJI イベント作成 [タイトル]\n→ イベントを作成して参加URLを発行\n\n👥 @KANJI 参加者\n→ 参加者一覧を表示\n\n💰 @KANJI 立替 [金額] [内容]\n→ あなたの立替を登録（全員割り勘）\n\n🔄 @KANJI 精算\n→ 誰が誰にいくら払うか計算\n\n❓ @KANJI ヘルプ\n→ この画面を表示`,
          }])
          continue
        }

        // ---------- イベント作成 ----------
        if (cmd.startsWith('イベント作成')) {
          const title = cmd.replace('イベント作成', '').trim() || '新しいイベント'
          const slug = generateSlug()

          const { data, error } = await supabase
            .from('events')
            .insert({
              slug,
              title,
              line_group_id: groupId,
            })
            .select()
            .single()

          if (error) {
            console.error('Event creation error:', error)
            await replyMessage(replyToken, [{ type: 'text', text: `❌ イベント作成に失敗しました: ${error.message}` }])
          } else {
            await replyMessage(replyToken, [{
              type: 'text',
              text: `✅ イベント「${title}」を作成しました！\n\n🔗 参加URL:\n${APP_URL}/e/${slug}\n\nこのURLをタップして参加登録してください。`,
            }])
          }
          continue
        }

        // ---------- 参加者一覧 ----------
        if (cmd === '参加者' || cmd === '参加者一覧') {
          // グループに紐づくイベントを検索
          const { data: ev } = await supabase
            .from('events')
            .select('id, title')
            .eq('line_group_id', groupId)
            .order('created_at', { ascending: false })
            .limit(1)
            .single()

          if (!ev) {
            await replyMessage(replyToken, [{
              type: 'text',
              text: 'まだイベントが作成されていません。\n@KANJI イベント作成 [タイトル] で作成してください。',
            }])
            continue
          }

          const { data: participants } = await supabase
            .from('participants')
            .select('name, paypay_phone')
            .eq('event_id', ev.id)
            .order('created_at', { ascending: true })

          if (!participants || participants.length === 0) {
            await replyMessage(replyToken, [{
              type: 'text',
              text: `📋「${ev.title}」の参加者\n\nまだ参加者がいません。\n${APP_URL}/e/${ev.id} から登録してください。`,
            }])
          } else {
            const list = participants.map((p: any, i: number) => {
              const pp = p.paypay_phone ? ` (PayPay: ${p.paypay_phone})` : ''
              return `${i + 1}. ${p.name}${pp}`
            }).join('\n')
            await replyMessage(replyToken, [{
              type: 'text',
              text: `👥「${ev.title}」の参加者（${participants.length}名）\n\n${list}`,
            }])
          }
          continue
        }

        // ---------- 立替登録 ----------
        if (cmd.startsWith('立替')) {
          const parts = cmd.replace('立替', '').trim().split(/\s+/)
          const amountStr = parts[0]
          const description = parts.slice(1).join(' ') || '立替'

          if (!amountStr || isNaN(Number(amountStr))) {
            await replyMessage(replyToken, [{
              type: 'text',
              text: '⚠️ 使い方: @KANJI 立替 [金額] [内容]\n例: @KANJI 立替 3000 居酒屋代',
            }])
            continue
          }

          // グループに紐づくイベントを検索
          const { data: ev } = await supabase
            .from('events')
            .select('id, title')
            .eq('line_group_id', groupId)
            .order('created_at', { ascending: false })
            .limit(1)
            .single()

          if (!ev) {
            await replyMessage(replyToken, [{
              type: 'text',
              text: 'まだイベントが作成されていません。\n@KANJI イベント作成 [タイトル] で作成してください。',
            }])
            continue
          }

          // 送信者の表示名を取得
          const displayName = userId ? await getGroupMemberProfile(groupId, userId) : 'Unknown'

          const amount = parseInt(amountStr)
          if (isNaN(amount) || amount <= 0 || amount > 10_000_000) {
            await replyMessage(replyToken, [{ type: 'text', text: '❌ 金額は1〜10,000,000円の範囲で入力してください' }])
            continue
          }
          const { error } = await supabase
            .from('advances')
            .insert({
              event_id: ev.id,
              payer_name: displayName,
              amount,
              description,
              split_target: 'all',
              target_names: null,
            })

          if (error) {
            console.error('Advance insert error:', error)
            await replyMessage(replyToken, [{ type: 'text', text: `❌ 登録失敗: ${error.message}` }])
          } else {
            await replyMessage(replyToken, [{
              type: 'text',
              text: `✅ ${displayName}さんの立替を登録しました\n\n💰 金額: ${amount.toLocaleString()}円\n📝 内容: ${description}`,
            }])
          }
          continue
        }

        // ---------- 精算 ----------
        if (cmd === '精算' || cmd === '精算結果') {
          const { data: ev } = await supabase
            .from('events')
            .select('id, title')
            .eq('line_group_id', groupId)
            .order('created_at', { ascending: false })
            .limit(1)
            .single()

          if (!ev) {
            await replyMessage(replyToken, [{
              type: 'text',
              text: 'まだイベントが作成されていません。\n@KANJI イベント作成 [タイトル] で作成してください。',
            }])
            continue
          }

          const { data: advances } = await supabase
            .from('advances')
            .select('payer_name, amount, split_target, target_names')
            .eq('event_id', ev.id)

          if (!advances || advances.length === 0) {
            await replyMessage(replyToken, [{
              type: 'text',
              text: 'まだ立替データがありません。\n@KANJI 立替 [金額] [内容] で登録してください。',
            }])
            continue
          }

          const { data: participants } = await supabase
            .from('participants')
            .select('name, paypay_phone')
            .eq('event_id', ev.id)

          const names = (participants || []).map((p: any) => p.name)

          // 参加者がいない場合は立替者の名前も含める
          const allNames = new Set([...names, ...advances.map((a: any) => a.payer_name)])
          const settlements = calculateSettlements(advances, [...allNames])

          if (settlements.length === 0) {
            await replyMessage(replyToken, [{
              type: 'text',
              text: `💰「${ev.title}」の精算結果\n\n✅ 精算は不要です（均等に立替済み）`,
            }])
          } else {
            const total = advances.reduce((s: number, a: any) => s + a.amount, 0)
            const lines = settlements.map((s) => {
              const payee = (participants || []).find((p: any) => p.name === s.to && p.paypay_phone)
              const pp = payee ? `\n   PayPay: ${payee.paypay_phone}` : ''
              return `${s.from} → ${s.to}: ¥${s.amount.toLocaleString()}${pp}`
            }).join('\n')
            await replyMessage(replyToken, [{
              type: 'text',
              text: `💰「${ev.title}」の精算結果\n\n合計: ¥${total.toLocaleString()} / ${allNames.size}人\n\n${lines}`,
            }])
          }
          continue
        }

        // ---------- 不明なコマンド ----------
        await replyMessage(replyToken, [{
          type: 'text',
          text: `⚠️ 不明なコマンドです。\n@KANJI ヘルプ で使い方を確認してください。`,
        }])
      }

      // === べき等性: 処理完了をログに記録 ===
      if (webhookEventId) {
        await supabase
          .from('webhook_event_log')
          .insert({ webhook_event_id: webhookEventId, event_type: event.type || 'unknown' })
          .then(() => {})
          .catch((e: unknown) => console.warn('webhook_event_log insert failed:', e))
      }
    }

    return new Response('OK', { status: 200, headers: corsHeaders })
  } catch (err) {
    console.error('Webhook error:', err)
    return new Response('Internal Server Error', { status: 500, headers: corsHeaders })
  }
})
