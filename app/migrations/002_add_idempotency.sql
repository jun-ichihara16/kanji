-- =============================================
-- 002: Webhookべき等性（重複処理防止）
-- Supabase Dashboard > SQL Editor で実行
-- =============================================

-- Webhook イベントログ: LINEからの全webhookイベントを記録し、重複処理を防止
CREATE TABLE IF NOT EXISTS webhook_event_log (
  webhook_event_id text PRIMARY KEY,
  event_type text NOT NULL,
  processed_at timestamptz DEFAULT now()
);

-- advances テーブルに webhook_event_id カラムを追加
ALTER TABLE advances ADD COLUMN IF NOT EXISTS webhook_event_id text;

-- webhook_event_id のユニークインデックス（NULLは除外 = UI経由の登録は影響なし）
CREATE UNIQUE INDEX IF NOT EXISTS advances_webhook_event_id_unique
  ON advances (webhook_event_id) WHERE webhook_event_id IS NOT NULL;

-- 古いログの自動クリーンアップ（30日以上前のログを削除するcronジョブ）
-- pg_cronが有効な場合のみ実行
-- SELECT cron.schedule('cleanup-webhook-log', '0 4 * * 0', $$DELETE FROM webhook_event_log WHERE processed_at < NOW() - INTERVAL '30 days'$$);
