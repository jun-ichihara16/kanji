-- 004: 傾斜機能（AI提案＋手動調整）用のカラム追加
-- 対象: participants (tags/weight/fixed_amount), events (split_mode)

BEGIN;

-- ========================================
-- participants テーブル拡張
-- ========================================

-- タグ配列（女性/若手/後輩/上司/先輩/遅刻/早退/主役 等）
ALTER TABLE participants
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';

-- ウェイト（均等割を1.0とした負担割合）
ALTER TABLE participants
  ADD COLUMN IF NOT EXISTS weight numeric NOT NULL DEFAULT 1.0;

-- 固定金額（手動調整で金額が確定した場合に使用。NULL=ウェイト按分）
ALTER TABLE participants
  ADD COLUMN IF NOT EXISTS fixed_amount integer DEFAULT NULL;

-- ========================================
-- events テーブル拡張
-- ========================================

-- 分割モード
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS split_mode text NOT NULL DEFAULT 'equal';

-- CHECK制約: 許容値のみ
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'events_split_mode_check'
  ) THEN
    ALTER TABLE events
      ADD CONSTRAINT events_split_mode_check
      CHECK (split_mode IN ('equal', 'ai_mild', 'ai_strict', 'manual'));
  END IF;
END $$;

-- weight の妥当性（負にはならない）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'participants_weight_check'
  ) THEN
    ALTER TABLE participants
      ADD CONSTRAINT participants_weight_check
      CHECK (weight >= 0);
  END IF;
END $$;

-- fixed_amount の妥当性（非負）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'participants_fixed_amount_check'
  ) THEN
    ALTER TABLE participants
      ADD CONSTRAINT participants_fixed_amount_check
      CHECK (fixed_amount IS NULL OR fixed_amount >= 0);
  END IF;
END $$;

COMMIT;

-- ========================================
-- 適用後の確認クエリ
-- ========================================
-- SELECT column_name, data_type, column_default FROM information_schema.columns
--   WHERE table_name IN ('participants', 'events')
--     AND column_name IN ('tags', 'weight', 'fixed_amount', 'split_mode');
