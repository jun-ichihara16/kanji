-- =============================================
-- 005: 参加者リスト自動蓄積 (Phase 1)
-- Supabase Dashboard > SQL Editor で実行
--
-- 目的: LINEログインしたユーザーが participants に自動追加されるようにする
--       同じユーザーが同じイベントに重複追加されないよう UNIQUE 制約を追加
-- =============================================

ALTER TABLE participants
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- 同一ユーザーが同じイベントに二重追加されないよう部分UNIQUE制約
-- (user_id が NULL の行は従来通り名前テキストで追加されたレコード)
CREATE UNIQUE INDEX IF NOT EXISTS idx_participants_user_event
  ON participants(event_id, user_id)
  WHERE user_id IS NOT NULL;

-- user_id で検索する既存クエリ用のインデックス
CREATE INDEX IF NOT EXISTS idx_participants_user_id
  ON participants(user_id)
  WHERE user_id IS NOT NULL;
