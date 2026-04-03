// Supabase Edge Function: LINE OAuth トークン交換
// デプロイ: supabase functions deploy line-auth
// 環境変数: LINE_CHANNEL_ID, LINE_CHANNEL_SECRET

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { code, redirectUri } = await req.json()

    if (!code || !redirectUri) {
      return new Response(
        JSON.stringify({ error: 'code and redirectUri are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const LINE_CHANNEL_ID = Deno.env.get('LINE_CHANNEL_ID')!
    const LINE_CHANNEL_SECRET = Deno.env.get('LINE_CHANNEL_SECRET')!
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // 1. LINEトークン交換
    const tokenRes = await fetch('https://api.line.me/oauth2/v2.1/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: LINE_CHANNEL_ID,
        client_secret: LINE_CHANNEL_SECRET,
      }),
    })

    const tokenData = await tokenRes.json()
    console.log('LINE token response status:', tokenRes.status)

    if (!tokenRes.ok || !tokenData.access_token) {
      console.error('LINE token error:', tokenData)
      return new Response(
        JSON.stringify({ error: 'LINE token exchange failed', detail: tokenData }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 2. LINEプロフィール取得
    const profileRes = await fetch('https://api.line.me/v2/profile', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    })
    const profile = await profileRes.json()
    console.log('LINE profile:', profile.displayName, profile.userId)

    // 3. Supabaseにユーザーを作成/更新（service_roleキー使用）
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // usersテーブルにupsert
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('line_user_id', profile.userId)
      .single()

    let userId: string

    if (existingUser) {
      userId = existingUser.id
      // 表示名を更新
      await supabaseAdmin
        .from('users')
        .update({ display_name: profile.displayName, avatar_url: profile.pictureUrl })
        .eq('id', userId)
    } else {
      // 新規ユーザー作成
      const { data: newUser, error: createError } = await supabaseAdmin
        .from('users')
        .insert({
          id: crypto.randomUUID(),
          line_user_id: profile.userId,
          display_name: profile.displayName,
          avatar_url: profile.pictureUrl,
        })
        .select('id')
        .single()

      if (createError) {
        console.error('User creation error:', createError)
        return new Response(
          JSON.stringify({ error: 'User creation failed', detail: createError }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      userId = newUser.id
    }

    return new Response(
      JSON.stringify({
        user: {
          id: userId,
          displayName: profile.displayName,
          avatarUrl: profile.pictureUrl,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('Unexpected error:', err)
    return new Response(
      JSON.stringify({ error: 'Internal server error', detail: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
