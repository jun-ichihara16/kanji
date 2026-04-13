# Supabase セキュリティ推奨設定ガイド

## 1. Dashboard 2FA（二要素認証）
- Supabase Dashboard > Account > Multi-factor authentication
- TOTPアプリ（Google Authenticator等）で設定
- **最優先で実施**

## 2. データベース直接接続の制限
- Dashboard > Settings > Database > Connection Info
- `Connection Pooler` を使用し、直接接続は開発者IPのみに制限
- 本番環境ではPostgREST（REST API）経由のみ推奨

## 3. API Rate Limiting
- Supabase Free planではデフォルトで制限あり
- Dashboard > Settings > API > Rate Limiting で確認
- 異常なリクエストパターン（連続slug推測等）をLogsで監視

## 4. Service Role Key の管理
- Service Role KeyはEdge Functionの環境変数としてのみ保持
- **フロントエンドコードに含めない**（anon keyのみ使用）
- 定期ローテーション手順:
  1. Dashboard > Settings > API > Service Role Key > Regenerate
  2. `supabase secrets set SUPABASE_SERVICE_ROLE_KEY=新しいキー`
  3. 全Edge Functionを再デプロイ

## 5. Edge Function Secrets
- `supabase secrets list` で設定済みシークレットを確認
- 必要なシークレット:
  - `LINE_CHANNEL_ID`
  - `LINE_CHANNEL_SECRET`
  - `LINE_BOT_ACCESS_TOKEN`
  - `RESEND_API_KEY`
- **GitリポジトリやDockerfileに含めないこと**

## 6. PITR（Point-in-Time Recovery）
- Pro plan以上で利用可能
- Dashboard > Settings > Database > Backups > PITR
- 有効化することでDB全体の任意時点への復元が可能

## 7. ログ監視
- Dashboard > Logs で以下を定期チェック:
  - Edge Function の実行エラー
  - REST API の異常なアクセスパターン
  - 認証失敗の頻発
- Slack連携等のアラート設定を推奨

## 8. Anon Key について
- Anon keyはフロントエンド公開前提の設計（Supabaseの仕様）
- **セキュリティはRLSポリシーで担保する**
- Anon keyの漏洩自体は問題ではなく、RLSが正しく設定されていることが重要
