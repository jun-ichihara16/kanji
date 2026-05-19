-- =============================================
-- 009: Phase 2 行動ログ growth_events テーブル
--   催促レス施策(C-6, C-7) と招待トラッキング(C-8) の共通基盤。
--   payload に個人特定情報は入れず、ID 参照と数値メタのみを記録する。
--
-- 参照:
--   * docs/phase2/06_execution_plan_v1.2.md § 3
--   * docs/phase2/02_implementation_plan.md § 4(payload 設計ルール)
--
-- Supabase Dashboard > SQL Editor で実行
-- =============================================

BEGIN;

-- ===========================================
-- 1. growth_events テーブル
-- ===========================================
CREATE TABLE IF NOT EXISTS growth_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  event_id UUID REFERENCES events(id) ON DELETE SET NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE growth_events IS 'Phase 2 v1.2: 催促レス施策・招待トラッキングの行動ログ。個人特定情報は payload に入れない。';
COMMENT ON COLUMN growth_events.event_type IS '列挙: manual_reminder_copied / reminder_sent / settlement_marked_paid / bulk_settle_clicked / participant_joined / invite_token_redeemed / host_first_completion / event_completed';
COMMENT ON COLUMN growth_events.user_id IS 'アクション主体ユーザー(幹事 or 参加者)。匿名化が必要な解析時は別途ハッシュ化を検討';
COMMENT ON COLUMN growth_events.event_id IS 'KANJI イベント ID(該当する場合のみ)';
COMMENT ON COLUMN growth_events.payload IS '数値メタ・カテゴリ識別子のみ。氏名・PayPay 番号・金額生値・LINE userId 生値・メッセージ本文は禁止';

-- ===========================================
-- 2. インデックス
-- ===========================================
CREATE INDEX IF NOT EXISTS idx_growth_events_type_created
  ON growth_events (event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_growth_events_user
  ON growth_events (user_id)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_growth_events_event
  ON growth_events (event_id)
  WHERE event_id IS NOT NULL;

-- ===========================================
-- 3. RLS
--   * INSERT: 認証済みユーザーは自分の user_id でのみ書ける
--   * SELECT: 自分の行は読める + テストアカウント(=管理者)は全件
--   * UPDATE/DELETE: 禁止(ログは追記オンリー)
-- ===========================================
ALTER TABLE growth_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='growth_events' AND policyname='growth_events_insert_self'
  ) THEN
    CREATE POLICY growth_events_insert_self
      ON growth_events FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='growth_events' AND policyname='growth_events_select_self_or_admin'
  ) THEN
    CREATE POLICY growth_events_select_self_or_admin
      ON growth_events FOR SELECT
      USING (
        auth.uid() = user_id
        OR EXISTS (
          SELECT 1 FROM users u
          WHERE u.id = auth.uid() AND u.is_test_account = true
        )
      );
  END IF;
END $$;

COMMIT;

-- ===========================================
-- 適用後の確認
-- ===========================================
-- SELECT column_name, data_type
-- FROM information_schema.columns
-- WHERE table_name='growth_events';
--
-- SELECT policyname, cmd FROM pg_policies
-- WHERE schemaname='public' AND tablename='growth_events';
--
-- -- 動作確認(クライアントから INSERT してみる前提):
-- INSERT INTO growth_events (event_type, user_id, payload)
-- VALUES ('manual_reminder_copied', auth.uid(), '{"test": true}');
-- SELECT * FROM growth_events ORDER BY created_at DESC LIMIT 5;
