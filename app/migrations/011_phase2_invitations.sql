-- =============================================
-- 011: Phase 2 招待トラッキング3層 + 参加者→幹事化追跡
--
--   * invitations テーブル新設(招待 token と消費の記録)
--   * events.host_was_participant: 作成者が過去に参加経験があるか
--   * events.originated_from_event_id: 幹事化のきっかけとなった過去参加イベント
--
-- 参照:
--   * docs/phase2/02_implementation_plan.md § 2
--   * docs/phase2/06_execution_plan_v1.2.md § 3
--
-- KANJI は LINE OAuth 直接認証で auth.uid() を使わないため、
-- RLS は他テーブル(events_all 等)と同じく anonymous 許可で運用する。
-- user_id の整合性はクライアント側で担保する。
--
-- Supabase Dashboard > SQL Editor で実行
-- =============================================

BEGIN;

-- ===========================================
-- 1. events への追加カラム
-- ===========================================
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS host_was_participant BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS originated_from_event_id UUID REFERENCES events(id) ON DELETE SET NULL;

COMMENT ON COLUMN events.host_was_participant IS 'Phase 2: 作成者(host)が過去に他のイベントの participants に登録されていた場合 true。「参加者→幹事化」ファネルを測るための指標。';
COMMENT ON COLUMN events.originated_from_event_id IS 'Phase 2: 幹事化のきっかけとなった過去参加イベントの ID。初めての招待 token 経由か、直近の参加履歴から推定する。';

-- 集計用インデックス(true の行のみ)
CREATE INDEX IF NOT EXISTS idx_events_host_was_participant
  ON events (host_was_participant)
  WHERE host_was_participant = true;

CREATE INDEX IF NOT EXISTS idx_events_originated_from
  ON events (originated_from_event_id)
  WHERE originated_from_event_id IS NOT NULL;

-- ===========================================
-- 2. invitations テーブル
-- ===========================================
CREATE TABLE IF NOT EXISTS invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT UNIQUE NOT NULL,
  source_event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  source_host_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- 消費(参加成立)時に書き込む
  redeemed_event_id UUID REFERENCES events(id) ON DELETE SET NULL,
  redeemed_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  redeemed_at TIMESTAMPTZ,
  redemption_layer TEXT CHECK (redemption_layer IN ('url_param', 'liff_state', 'local_storage', 'db_lookup'))
);

COMMENT ON TABLE invitations IS 'Phase 2: 招待トラッキング第2層。?inv=<token> として配布される短縮 ID と消費の対応を保持する。';
COMMENT ON COLUMN invitations.token IS 'URL パラメータ ?inv=<token> として配布する短縮 ID(8〜12 文字推奨)';
COMMENT ON COLUMN invitations.redemption_layer IS 'どの捕捉経路で消費されたか(url_param/liff_state/local_storage/db_lookup)。デバッグと健全性チェック用。';

CREATE INDEX IF NOT EXISTS idx_invitations_token ON invitations (token);
CREATE INDEX IF NOT EXISTS idx_invitations_source_event ON invitations (source_event_id);
CREATE INDEX IF NOT EXISTS idx_invitations_redeemed_user
  ON invitations (redeemed_user_id)
  WHERE redeemed_user_id IS NOT NULL;

-- ===========================================
-- 3. RLS
--   KANJI は anonymous 認証で動いているため、他テーブルと同じく
--   anyone allowed とする。SELECT は将来絞る可能性ありだが、
--   Phase 2 期間中は読み取りも anyone 許可で運用する。
-- ===========================================
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='invitations' AND policyname='invitations_all_anyone'
  ) THEN
    CREATE POLICY invitations_all_anyone
      ON invitations FOR ALL
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

COMMENT ON POLICY invitations_all_anyone ON invitations
  IS 'KANJI 既存設計に合わせて anonymous 許可。token は推測困難なランダム文字列で保護される前提。';

COMMIT;

-- ===========================================
-- 適用後の確認
-- ===========================================
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name='invitations' ORDER BY ordinal_position;
--
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name='events' AND column_name IN ('host_was_participant','originated_from_event_id');
--
-- SELECT policyname, cmd FROM pg_policies
-- WHERE schemaname='public' AND tablename='invitations';
