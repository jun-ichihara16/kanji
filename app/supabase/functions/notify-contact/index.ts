import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { escapeHtml, isValidEmail, isWithinLength } from '../_shared/validation.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { name, email, category, message } = await req.json()

    // サーバー側バリデーション
    if (!name || !email || !message) {
      return new Response(JSON.stringify({ error: 'name, email, message are required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    if (!isValidEmail(email)) {
      return new Response(JSON.stringify({ error: 'Invalid email format' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    if (!isWithinLength(name, 200) || !isWithinLength(message, 5000)) {
      return new Response(JSON.stringify({ error: 'Input too long' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!

    const categoryLabel: Record<string, string> = {
      question: 'ご質問',
      request: 'ご要望・機能リクエスト',
      bug: '不具合の報告',
      other: 'その他',
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'AI KANJI <onboarding@resend.dev>',
        to: ['jun-ichihara@cuen0924.com'],
        subject: `[AI KANJI] お問い合わせ: ${categoryLabel[category] || category}`,
        html: `
          <h2>AI KANJI お問い合わせ</h2>
          <table style="border-collapse:collapse;width:100%;max-width:500px">
            <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold">お名前</td><td style="padding:8px;border:1px solid #ddd">${escapeHtml(name)}</td></tr>
            <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold">メール</td><td style="padding:8px;border:1px solid #ddd">${escapeHtml(email)}</td></tr>
            <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold">カテゴリ</td><td style="padding:8px;border:1px solid #ddd">${escapeHtml(categoryLabel[category] || category)}</td></tr>
            <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold">内容</td><td style="padding:8px;border:1px solid #ddd;white-space:pre-wrap">${escapeHtml(message)}</td></tr>
          </table>
          <p style="color:#999;font-size:12px;margin-top:16px">このメールはAI KANJIのお問い合わせフォームから自動送信されました。</p>
        `,
      }),
    })

    const result = await res.json()
    console.log('Resend result:', res.status, result)

    if (!res.ok) {
      return new Response(JSON.stringify({ error: 'Email send failed', detail: result }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (err) {
    console.error('Error:', err)
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
