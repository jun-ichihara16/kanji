-- 005: イベント分類タグ
-- events.category カラム追加（飲み会/ランチ/旅行/合宿/歓送迎会/誕生日/その他）

BEGIN;

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS category text DEFAULT NULL;

-- CHECK制約: 許容値のみ（将来カテゴリ追加時はここを更新）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'events_category_check'
  ) THEN
    ALTER TABLE events
      ADD CONSTRAINT events_category_check
      CHECK (category IS NULL OR category IN (
        '飲み会',
        'ランチ',
        '旅行',
        '合宿',
        '歓送迎会',
        '誕生日',
        'その他'
      ));
  END IF;
END $$;

COMMIT;

-- ========================================
-- 適用後の確認
-- ========================================
-- SELECT column_name, data_type, column_default FROM information_schema.columns
--   WHERE table_name = 'events' AND column_name = 'category';
