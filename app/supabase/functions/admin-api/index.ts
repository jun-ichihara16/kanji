// Supabase Edge Function: Admin API
// service_role keyを使ってRLS制限されたadmin操作を実行する
// デプロイ: supabase functions deploy admin-api

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const { action, userId, ...params } = await req.json()

    // リクエストしたユーザーがadminか検証
    if (!userId) {
      return jsonError('userId is required', 400)
    }
    const { data: caller } = await supabase
      .from('users')
      .select('is_admin')
      .eq('id', userId)
      .single()

    if (!caller?.is_admin) {
      return jsonError('Unauthorized: admin access required', 403)
    }

    // admin操作のルーティング
    switch (action) {
      case 'banUser': {
        const { targetId, banned } = params
        const { error } = await supabase
          .from('users')
          .update({ is_banned: banned })
          .eq('id', targetId)
        if (error) return jsonError(error.message, 500)
        return jsonOk({ ok: true })
      }

      case 'updateUserAdminInfo': {
        const { targetId, tags, memo } = params
        const { error } = await supabase
          .from('users')
          .update({ admin_tags: tags, admin_memo: memo })
          .eq('id', targetId)
        if (error) return jsonError(error.message, 500)
        return jsonOk({ ok: true })
      }

      case 'fetchContacts': {
        const { data, error } = await supabase
          .from('contacts')
          .select('*')
          .order('created_at', { ascending: false })
        if (error) return jsonError(error.message, 500)
        return jsonOk({ data })
      }

      case 'updateContactStatus': {
        const { contactId, status } = params
        const { error } = await supabase
          .from('contacts')
          .update({ status })
          .eq('id', contactId)
        if (error) return jsonError(error.message, 500)
        return jsonOk({ ok: true })
      }

      case 'replyContact': {
        const { contactId, replyText } = params
        const { data, error } = await supabase
          .from('contacts')
          .update({
            admin_reply: replyText,
            replied_at: new Date().toISOString(),
            status: 'done',
          })
          .eq('id', contactId)
          .select()
          .single()
        if (error) return jsonError(error.message, 500)
        return jsonOk({ data })
      }

      case 'forceDeleteEvent': {
        const { eventId } = params
        const { error } = await supabase
          .from('events')
          .delete()
          .eq('id', eventId)
        if (error) return jsonError(error.message, 500)
        return jsonOk({ ok: true })
      }

      default:
        return jsonError(`Unknown action: ${action}`, 400)
    }
  } catch (err) {
    console.error('Admin API error:', err)
    return jsonError(String(err), 500)
  }
})

function jsonOk(data: unknown) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
