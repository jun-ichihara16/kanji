-- =============================================
-- 010: growth_events の INSERT RLS を緩和
--
-- 背景:
--   KANJI は LINE OAuth 直接認証(Supabase Auth 不使用)で動作しているため、
--   クライアントから書き込み時に auth.uid() が常に NULL。
--   migration 009 で設定した `auth.uid() = user_id` ポリシーでは
--   永久に INSERT が拒否される。
--
--   KANJI の他テーブル(events, advances, settlements 等)も
--   anonymous で書き込み許可されている設計に合わせ、growth_events も
--   anyone can INSERT に変更する。user_id の整合性はクライアント側で担保。
--
-- 影響:
--   * INSERT は anon ロールでも可能になる
--   * SELECT ポリシー(growth_events_select_self_or_admin)はそのまま維持
--   * UPDATE/DELETE は引き続き禁止(該当ポリシー無し)
--
-- 参照:
--   * docs/phase2/02_implementation_plan.md(本来は service_role 経由が推奨)
--   * app/migrations/009_phase2_growth_events.sql
--
-- Supabase Dashboard > SQL Editor で実行
-- =============================================

BEGIN;

-- 旧 INSERT ポリシーを削除
DROP POLICY IF EXISTS growth_events_insert_self ON growth_events;

-- 新 INSERT ポリシー: anyone allowed
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='growth_events' AND policyname='growth_events_insert_anyone'
  ) THEN
    CREATE POLICY growth_events_insert_anyone
      ON growth_events FOR INSERT
      WITH CHECK (true);
  END IF;
END $$;

COMMENT ON POLICY growth_events_insert_anyone ON growth_events
  IS 'KANJI は Supabase Auth を使わず LINE OAuth 直接認証のため、auth.uid() が常に NULL。他テーブルと同じく anonymous INSERT を許可し、user_id の整合性はクライアントが担保する。';

COMMIT;

-- ===========================================
-- 適用後の確認
-- ===========================================
-- SELECT policyname, cmd, qual, with_check
-- FROM pg_policies
-- WHERE schemaname='public' AND tablename='growth_events'
-- ORDER BY policyname;
