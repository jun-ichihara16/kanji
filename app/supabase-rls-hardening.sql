-- =============================================
-- AI KANJI RLS強化
-- Supabase Dashboard > SQL Editor で実行してください
--
-- 変更内容:
--   contacts: INSERTのみ許可（SELECTは管理者がservice key経由で行う）
--   users: DELETEを禁止、is_admin/is_bannedのanon key経由での変更を禁止
-- =============================================

-- === contacts テーブル ===
-- 現状: 全操作可能（contacts_insert + contacts_select）
-- 変更: INSERTのみ。SELECT/UPDATE/DELETEはanon keyでは不可。
--       管理者はEdge Function（service key）経由でアクセスする。

DROP POLICY IF EXISTS "contacts_insert" ON contacts;
DROP POLICY IF EXISTS "contacts_select" ON contacts;
DROP POLICY IF EXISTS "contacts_all" ON contacts;

CREATE POLICY "contacts_insert_only" ON contacts
  FOR INSERT WITH CHECK (true);

-- SELECT/UPDATE/DELETEポリシーなし = anon keyでは読み取り・更新・削除不可
-- service_role keyを使うEdge Functionからは全操作可能（RLSをバイパス）


-- === users テーブル ===
-- 現状: 全操作可能（users_all）
-- 変更: SELECT/INSERTは許可。UPDATEはis_admin, is_bannedの変更を禁止。DELETEは禁止。

DROP POLICY IF EXISTS "users_all" ON users;

-- SELECT: 全ユーザー情報の閲覧を許可（アバター表示等に必要）
CREATE POLICY "users_select" ON users
  FOR SELECT USING (true);

-- INSERT: LINE OAuth後のユーザー作成を許可
CREATE POLICY "users_insert" ON users
  FOR INSERT WITH CHECK (true);

-- UPDATE: display_name, avatar_url等の一般フィールドのみ変更可能
-- is_admin, is_bannedはanon keyでは変更不可（service key経由のみ）
-- ※ PostgreSQLのRLSではカラム単位の制御ができないため、
--    トリガー関数で制御する
CREATE POLICY "users_update" ON users
  FOR UPDATE USING (true) WITH CHECK (true);

-- DELETE: 禁止（ユーザー削除はservice key経由のみ）
-- DELETEポリシーなし = anon keyでは削除不可


-- === is_admin/is_banned保護トリガー ===
-- anon keyからのUPDATEでis_admin/is_bannedの変更を検知して拒否する

CREATE OR REPLACE FUNCTION protect_admin_fields()
RETURNS TRIGGER AS $$
BEGIN
  -- current_settingでroleを取得。anon roleの場合のみ制限
  -- service_role keyを使うEdge Functionではこのチェックをスキップ
  IF current_setting('request.jwt.claim.role', true) = 'anon' THEN
    -- is_adminの変更を禁止
    IF NEW.is_admin IS DISTINCT FROM OLD.is_admin THEN
      RAISE EXCEPTION 'is_admin cannot be modified via anon key';
    END IF;
    -- is_bannedの変更を禁止
    IF NEW.is_banned IS DISTINCT FROM OLD.is_banned THEN
      RAISE EXCEPTION 'is_banned cannot be modified via anon key';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS protect_admin_fields_trigger ON users;
CREATE TRIGGER protect_admin_fields_trigger
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION protect_admin_fields();


-- === 確認用クエリ（実行後に動作確認） ===
-- 以下をSQL Editorで実行して、ポリシーが正しく適用されたか確認:
--
-- SELECT tablename, policyname, cmd, qual, with_check
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- ORDER BY tablename;
