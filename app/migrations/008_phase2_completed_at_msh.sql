-- =============================================
-- 008: Phase 2 計測基盤の最小サブセット
--   * events.completed_at      : 初回精算完了日時(不変)
--   * events.re_completed_at   : 再完了の最新日時
--   * users.is_test_account    : 集計から除外するテストアカウント
--   * idx_events_completed_at_jst / idx_events_host_completed
--   * RLS: events.UPDATE は host_id = auth.uid() のときのみ
--   * 既存 archived イベントへの completed_at バックフィル
--
-- 参照: docs/phase2/02_implementation_plan.md § 1, docs/phase2/06_phase2_revised_implementation_notes.md § 2-3
-- Supabase Dashboard > SQL Editor で実行
-- =============================================

BEGIN;

-- ===========================================
-- 1. events: completed_at / re_completed_at
-- ===========================================
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS re_completed_at TIMESTAMPTZ;

COMMENT ON COLUMN events.completed_at IS 'Phase 2: 初めて全件精算完了した瞬間。一度記録されたら不変。MSH 集計の真実の源泉。';
COMMENT ON COLUMN events.re_completed_at IS 'Phase 2: 再完了時の最新時刻。completed_at には触れない。';

-- ===========================================
-- 2. users: is_test_account
-- ===========================================
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_test_account BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN users.is_test_account IS 'Phase 2: 開発者本人・テスト用アカウント。MSH 等の集計から除外。';

-- ===========================================
-- 3. インデックス
-- ===========================================
-- MSH 月次集計用(JST 月境界)
CREATE INDEX IF NOT EXISTS idx_events_completed_at_jst
  ON events ((completed_at AT TIME ZONE 'Asia/Tokyo'))
  WHERE completed_at IS NOT NULL;

-- 再利用幹事率の窓判定用
CREATE INDEX IF NOT EXISTS idx_events_host_completed
  ON events (host_id, completed_at)
  WHERE completed_at IS NOT NULL;

-- ===========================================
-- 4. RLS: events UPDATE
--   既存ポリシーが Supabase ダッシュボード上で作成済みのことが多いため、
--   IF NOT EXISTS / DO ブロックで冪等性を担保する
-- ===========================================
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- 既存の SELECT/UPDATE ポリシーは温存し、ホスト本人のUPDATEのみ追加する。
-- 同名ポリシーがあればスキップ。
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'events'
      AND policyname = 'events_update_by_host_phase2'
  ) THEN
    CREATE POLICY events_update_by_host_phase2
      ON events
      FOR UPDATE
      USING (auth.uid() = host_id)
      WITH CHECK (auth.uid() = host_id);
  END IF;
END $$;

-- ===========================================
-- 5. 既存 archived イベントへの completed_at バックフィル
--   archived_at がある行は archived_at、なければ created_at を採用(events に updated_at は無いため)。
--   対象イベント条件(参加者2人以上 + 立替1件以上 + settlements 1件以上)を満たすもののみ。
--   既に completed_at が入っている行は触らない(IS NULL ガード)。
-- ===========================================
UPDATE events e
SET completed_at = COALESCE(e.archived_at, e.created_at, NOW())
WHERE e.status = 'archived'
  AND e.completed_at IS NULL
  AND (SELECT COUNT(*) FROM participants p WHERE p.event_id = e.id) >= 2
  AND EXISTS (SELECT 1 FROM advances a WHERE a.event_id = e.id)
  AND EXISTS (SELECT 1 FROM settlements s WHERE s.event_id = e.id);

-- ===========================================
-- 6. MSH 月次集計ビュー(Admin が直接 SELECT できる軽量ビュー)
-- ===========================================
DROP VIEW IF EXISTS phase2_msh_monthly;
CREATE VIEW phase2_msh_monthly AS
WITH eligible AS (
  SELECT
    e.id AS event_id,
    e.host_id,
    DATE_TRUNC('month', e.completed_at AT TIME ZONE 'Asia/Tokyo')::DATE AS month_jst
  FROM events e
  WHERE e.completed_at IS NOT NULL
    AND (SELECT COUNT(*) FROM participants p WHERE p.event_id = e.id) >= 2
    AND EXISTS (SELECT 1 FROM advances a WHERE a.event_id = e.id)
    AND EXISTS (SELECT 1 FROM settlements s WHERE s.event_id = e.id)
    AND NOT EXISTS (SELECT 1 FROM settlements s WHERE s.event_id = e.id AND s.is_settled = false)
    AND e.host_id NOT IN (SELECT id FROM users WHERE is_test_account = true)
)
SELECT
  month_jst,
  COUNT(DISTINCT host_id) AS msh,
  COUNT(*) AS completed_events
FROM eligible
GROUP BY month_jst
ORDER BY month_jst DESC;

COMMENT ON VIEW phase2_msh_monthly IS 'Phase 2: 月次 MSH と完了イベント数。テストアカウント除外済み。';

COMMIT;

-- ===========================================
-- 適用後の確認
-- ===========================================
-- SELECT column_name, data_type
-- FROM information_schema.columns
-- WHERE table_name = 'events'
--   AND column_name IN ('completed_at', 're_completed_at');
--
-- SELECT * FROM phase2_msh_monthly LIMIT 12;
--
-- SELECT COUNT(*) AS backfilled FROM events WHERE completed_at IS NOT NULL;
