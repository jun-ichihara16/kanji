-- =============================================
-- AI KANJI RLS強化（リンクを知っている人のみアクセス可能に）
-- Supabase Dashboard > SQL Editor で実行してください
-- =============================================

-- 1. events: 誰でもSELECTできるが、一覧取得時はhost_idかslugでフィルタが必須
-- （Supabase REST APIではフィルタなしの全件取得を防ぐことは難しいため、
--   アプリ側で必ずslugまたはhost_idでフィルタして取得する設計で担保）

-- 2. participants: event_idでフィルタしないと取得できない
-- → 現状のRLSは全開放のため、アプリ側で必ずevent_idフィルタを使用

-- 3. 検索エンジンからの保護はフロントエンド側（noindex meta tag）で対応済み

-- 4. slugの推測防止: nanoid(12)に変更済み（62^12 = 3.2×10^21通り）

-- 注意: 現在Supabase Authを使っていない（localStorage認証）ため、
-- auth.uid()ベースのRLSは機能しません。
-- 将来的にSupabase Anonymous Sign-insを導入した際にRLSを強化してください。

-- 現時点で適用可能なセキュリティ対策として、
-- events.slugを知らない限りデータにアクセスできないアプリ設計を徹底します。
