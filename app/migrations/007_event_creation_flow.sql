-- 007: イベント作成フロー改修（テンプレ + 会計方式 + 請求開始）
-- 対象: events
--   * event_template       : テンプレ識別子
--   * settlement_type      : 会計方式
--   * total_amount         : 合計金額（equal_split / weighted_split で使用）
--   * rounding_rule        : 端数処理ルール
--   * exclude_organizer    : 幹事を対象外にするか（任意・equal_split / weighted_split）
--   * final_adjustment_mode: 最終差額調整方式（reimbursement_split で使用）
--   * is_draft             : 下書きフラグ（イベント作成後にDB側でも下書き状態を保持できるように）
--   * request_started_at   : 請求開始日時（請求開始されたかの判定に使用）
--
-- 既存の participants.weight / participants.fixed_amount / participants.tags は流用するため変更しない。
-- 既存の split_mode（AI傾斜系）は後方互換のため温存（settlement_type と直交概念として扱う）。

BEGIN;

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS event_template text NOT NULL DEFAULT 'nomikai';

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS settlement_type text NOT NULL DEFAULT 'equal_split';

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS total_amount integer DEFAULT NULL;

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS rounding_rule text NOT NULL DEFAULT 'round';

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS exclude_organizer boolean NOT NULL DEFAULT FALSE;

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS final_adjustment_mode text NOT NULL DEFAULT 'minimum';

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS is_draft boolean NOT NULL DEFAULT FALSE;

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS request_started_at timestamptz DEFAULT NULL;

-- ========================================
-- CHECK 制約
-- ========================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'events_event_template_check'
  ) THEN
    ALTER TABLE events
      ADD CONSTRAINT events_event_template_check
      CHECK (event_template IN ('nomikai', 'prepaid', 'bbq', 'futsal', 'travel', 'other'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'events_settlement_type_check'
  ) THEN
    ALTER TABLE events
      ADD CONSTRAINT events_settlement_type_check
      CHECK (settlement_type IN ('equal_split', 'weighted_split', 'reimbursement_split'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'events_rounding_rule_check'
  ) THEN
    ALTER TABLE events
      ADD CONSTRAINT events_rounding_rule_check
      CHECK (rounding_rule IN ('floor', 'round', 'ceil'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'events_final_adjustment_mode_check'
  ) THEN
    ALTER TABLE events
      ADD CONSTRAINT events_final_adjustment_mode_check
      CHECK (final_adjustment_mode IN ('minimum', 'even'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'events_total_amount_check'
  ) THEN
    ALTER TABLE events
      ADD CONSTRAINT events_total_amount_check
      CHECK (total_amount IS NULL OR total_amount >= 0);
  END IF;
END $$;

COMMIT;

-- ========================================
-- 適用後の確認
-- ========================================
-- SELECT column_name, data_type, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'events'
--   AND column_name IN (
--     'event_template', 'settlement_type', 'total_amount',
--     'rounding_rule', 'exclude_organizer', 'final_adjustment_mode',
--     'is_draft', 'request_started_at'
--   );
