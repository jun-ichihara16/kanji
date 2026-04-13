-- =============================================
-- 003: PII自動クリーンアップ
-- Supabase Dashboard > SQL Editor で実行
--
-- 前提: pg_cron拡張が有効であること
-- Dashboard > Database > Extensions > pg_cron を有効化してから実行
-- =============================================

-- events テーブルに archived_at カラムを追加
ALTER TABLE events ADD COLUMN IF NOT EXISTS archived_at timestamptz;

-- アーカイブ時にタイムスタンプを記録するため、
-- フロントエンドの updateEvent で status='archived' にする際に
-- archived_at = NOW() も設定するように修正が必要（別途コード修正）

-- PII クリーンアップ関数
CREATE OR REPLACE FUNCTION cleanup_old_pii()
RETURNS void AS $$
DECLARE
  masked_phones integer;
  masked_contacts integer;
BEGIN
  -- アーカイブから1年経過したイベントの参加者のPayPay番号をマスク
  UPDATE participants
  SET paypay_phone = '***-****-****'
  WHERE paypay_phone IS NOT NULL
    AND paypay_phone != '***-****-****'
    AND event_id IN (
      SELECT id FROM events
      WHERE archived_at IS NOT NULL
        AND archived_at < NOW() - INTERVAL '1 year'
    );
  GET DIAGNOSTICS masked_phones = ROW_COUNT;

  -- 1年以上前の問い合わせの個人情報を匿名化
  UPDATE contacts
  SET email = 'deleted@privacy.invalid',
      name = '***'
  WHERE email != 'deleted@privacy.invalid'
    AND created_at < NOW() - INTERVAL '1 year';
  GET DIAGNOSTICS masked_contacts = ROW_COUNT;

  RAISE NOTICE 'PII cleanup completed: % phones masked, % contacts anonymized', masked_phones, masked_contacts;
END;
$$ LANGUAGE plpgsql;

-- 毎週日曜 3:00 JST (土曜 18:00 UTC) に実行
-- pg_cron が有効な場合のみ以下を実行:
SELECT cron.schedule(
  'pii-weekly-cleanup',
  '0 18 * * 6',
  $$SELECT cleanup_old_pii()$$
);

-- === 確認 ===
-- SELECT * FROM cron.job WHERE jobname = 'pii-weekly-cleanup';
-- 手動テスト: SELECT cleanup_old_pii();
