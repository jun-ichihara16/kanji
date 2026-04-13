// 全Edge Functionで共有するCORS設定
// '*' ではなく自社ドメインのみ許可

export const ALLOWED_ORIGIN = 'https://kanji-relief.com'

export const corsHeaders = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-line-signature',
}

export function handleCors(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  return null
}
