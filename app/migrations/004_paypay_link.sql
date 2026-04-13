-- =============================================
-- 004: PayPay受取リンク対応 (Phase 1a)
-- Supabase Dashboard > SQL Editor で実行
--
-- Phase 1a: 金額指定なしリンク (amount_free) のみサポート
-- Phase 1b: amount_fixed を CHECK 制約に追加予定
-- =============================================

ALTER TABLE participants
  ADD COLUMN IF NOT EXISTS paypay_link_url TEXT,
  ADD COLUMN IF NOT EXISTS paypay_link_type TEXT;

-- type は将来 'amount_fixed' を追加するため CHECK で拡張可能に
ALTER TABLE participants
  DROP CONSTRAINT IF EXISTS participants_paypay_link_type_check;

ALTER TABLE participants
  ADD CONSTRAINT participants_paypay_link_type_check
  CHECK (paypay_link_type IS NULL OR paypay_link_type IN ('amount_free'));

-- URL は PayPay 公式ドメインのみ許可
ALTER TABLE participants
  DROP CONSTRAINT IF EXISTS participants_paypay_link_url_check;

ALTER TABLE participants
  ADD CONSTRAINT participants_paypay_link_url_check
  CHECK (
    paypay_link_url IS NULL
    OR paypay_link_url ~ '^https://(pay|qr)\.paypay\.ne\.jp/'
  );

-- PII クリーンアップ関数を更新（PayPayリンクも1年経過でマスク）
CREATE OR REPLACE FUNCTION cleanup_old_pii()
RETURNS void AS $$
DECLARE
  masked_phones integer;
  masked_links integer;
  masked_contacts integer;
BEGIN
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

  UPDATE participants
  SET paypay_link_url = NULL,
      paypay_link_type = NULL
  WHERE paypay_link_url IS NOT NULL
    AND event_id IN (
      SELECT id FROM events
      WHERE archived_at IS NOT NULL
        AND archived_at < NOW() - INTERVAL '1 year'
    );
  GET DIAGNOSTICS masked_links = ROW_COUNT;

  UPDATE contacts
  SET email = 'deleted@privacy.invalid',
      name = '***'
  WHERE email != 'deleted@privacy.invalid'
    AND created_at < NOW() - INTERVAL '1 year';
  GET DIAGNOSTICS masked_contacts = ROW_COUNT;

  RAISE NOTICE 'PII cleanup completed: % phones masked, % links cleared, % contacts anonymized', masked_phones, masked_links, masked_contacts;
END;
$$ LANGUAGE plpgsql;
