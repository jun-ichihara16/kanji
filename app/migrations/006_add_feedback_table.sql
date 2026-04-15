-- 006: アプリ内フィードバックテーブル
-- 目的: ユーザーからの声を1箇所に集約、週次レビューで確認

BEGIN;

CREATE TABLE IF NOT EXISTS feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  event_id uuid REFERENCES events(id) ON DELETE SET NULL,

  -- どこから送信されたか
  source text NOT NULL CHECK (source IN (
    'footer',           -- 常設フッターボタン
    'event_complete',   -- イベント精算完了時
    'error_banner',     -- エラー時
    'other'
  )),

  -- 評価（5段階、任意）
  rating int CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5)),

  -- カテゴリ（任意）
  category text CHECK (category IS NULL OR category IN (
    'bug', 'feature_request', 'ux', 'praise', 'other'
  )),

  -- 自由記述（必須）
  message text NOT NULL CHECK (length(message) >= 1 AND length(message) <= 2000),

  -- 文脈メタデータ（どのページから送ったか等）
  page_url text,
  user_agent text,

  -- ステータス（運営側の処理状態）
  status text NOT NULL DEFAULT 'new' CHECK (status IN (
    'new', 'reviewed', 'actioned', 'dismissed'
  )),

  admin_memo text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_feedback_created ON feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback(status) WHERE status = 'new';
CREATE INDEX IF NOT EXISTS idx_feedback_user ON feedback(user_id);

-- RLS（Row Level Security）
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- 誰でもINSERTできる（匿名投稿可）
CREATE POLICY "anyone_can_insert_feedback"
  ON feedback FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- 自分の投稿は見られる
CREATE POLICY "users_can_read_own_feedback"
  ON feedback FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- 管理側からの読み取りは service_role のみ（Edge Function経由で参照）
-- （他は全て拒否）

COMMIT;

-- ========================================
-- 適用後の確認
-- ========================================
-- SELECT COUNT(*) FROM feedback;
-- SELECT * FROM pg_policies WHERE tablename = 'feedback';
