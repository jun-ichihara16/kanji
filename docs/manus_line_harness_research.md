# KANJI × LINE Harness 統合設計・戦略・実装手順のリサーチ依頼

## プロダクト概要：KANJI

KANJIは、LINEグループで完結する幹事向け割り勘・立替精算ツール。

### 技術スタック
- フロントエンド: React (Vite) + TypeScript → GitHub Pages
- バックエンド: Supabase (PostgreSQL + Edge Functions + Realtime)
- 認証: LINE Login (OAuth 2.0)
- LINE Bot: Supabase Edge Function で Messaging API 処理
- ドメイン: kanji-relief.com

### 現在のLINE活用状況
- LINE Login: 幹事のログインに使用（OAuth フロー）
- LINE Bot: グループ内コマンド対応（参加者一覧、精算結果表示等）
- LINE共有: イベントURLをLINEで送信（line.me/R/msg/text/）
- LIFF: 未使用（SDKは導入済み、LIFF IDは未発行）
- Rich Menu / Push通知 / 友だち追加: 未使用

### ユーザーフロー（現状）
1. 幹事: Webブラウザ → LINEログイン → イベント作成 → URL発行 → LINEグループに共有
2. 参加者: LINEグループでURL受信 → 外部ブラウザで開く → 名前・PayPay情報入力 → 参加
3. 精算: 立替登録 → 自動計算 → PayPay送金 → 精算完了マーク

### 事業フェーズ
- Phase 1（現在・4〜6月）: 割り勘MVPの体験磨き込み。月30イベント目標
- Phase 2（7〜9月）: 連絡ツール拡張（招待一斉送信、リマインド自動化）
- Phase 3（10〜12月）: 収益化（提携店舗からの成果報酬15%、LINEリストPR配信 1人250円）

### 成長ループの課題（UX分析で特定済み）
- 崖①: 初回イベント作成で離脱
- 崖②: LINEグループにURL共有する心理的障壁
- 崖③: 精算の最後の1-2人が未払いのまま放置
- 崖④: 参加者が幹事の便利さを認知せず、次回幹事化しない

---

## LINE Harness OSS について

- GitHub: https://github.com/Shudesu/line-harness-oss
- Cloudflare Workers + D1 SQLite で動作する OSS の LINE CRM
- Lステップ（月2万円）の無料代替。5,000友だちまで0円
- 主要機能: ステップ配信、リッチメニュー切替、LIFF フォーム、スコアリング、IF-THEN自動化、Tracked Links
- MCP Server 対応（Claude Codeから自然言語操作可能）

### 現在の状態
- Cloudflare アカウント作成済み
- LINE Developers コンソールにアクセス可能（Messaging APIチャネルあり）
- npx create-line-harness はまだ実行していない

---

## 調査・設計してほしいこと

### 1. LINE Harness 最新動向リサーチ（2026年4月以降）
- LINE Harness OSS の最新バージョン・機能追加・Breaking Changes
- LIFF と LINE ミニアプリのブランド統合の進捗（2025年に予告済み）→ 新規は LIFF か ミニアプリか
- LINE Messaging API の料金体系の最新（2023年に大幅改定あり）
- Cloudflare Workers / D1 の無料枠の最新状況
- LINE Harness の本番運用での known issues / gotchas

### 2. アーキテクチャ設計
KANJI（Supabase）× LINE Harness（Cloudflare）の連携設計：
- データの持ち方: ユーザー情報は Supabase と D1 のどちらが master か
- 認証フロー: LIFF 内の認証と既存 LINE OAuth の共存
- Webhook 連携: 双方向の設計
- 友だち管理: LINE Harness の友だちDBと Supabase users テーブルの同期
- メッセージ通数の最適化（フリープラン200通/月で始める設計）
- セキュリティ: Webhook 認証、API キー管理

### 3. シナリオ設計（IF-THEN自動化）

#### シナリオA: 幹事オンボーディング
友だち追加 → ウェルカム → 24h後に未作成ならリマインド → 作成で停止。タグ: new_user → host

#### シナリオB: 参加者の自動参加
LIFF フォーム送信 → 参加完了メッセージ → 友だち追加促進（任意）。タグ: participant, event_{id}

#### シナリオC: 精算リマインド
KANJI から Webhook → 未精算者に個別 Push → 24h後に再通知（1回のみ） → 完了で停止。Flex Message デザイン案も

#### シナリオD: 参加者→幹事転換
全精算完了 Webhook → 参加者に「次はあなたも」メッセージ。スコア3以上は特別メッセージ。押しつけがましくないトーン

### 4. リッチメニュー設計
3〜4パターン（新規・幹事・参加者・精算完了後）のボタン配置・アクション・タグベース切替ルール

### 5. LIFF 統合設計
- LIFF アプリ登録手順
- 既存 React SPA の LIFF 化（liff.init() / liff.getProfile() と既存 OAuth の共存）
- Share Target Picker 実装
- LIFF URL の動的対応（イベントごと）

### 6. メッセージ通数の最適化戦略
- Push vs Webhook リプライの使い分け
- 月30→100イベントへの通数シミュレーション
- フリー→ライトプランの切替判断基準

### 7. 成長ループへの統合戦略
- 各ステップでの LINE Harness 介入ポイント
- K-factor を上げる施策（Tracked Links 計測含む）
- 参加者→幹事の転換率を最大化するメッセージ戦略
- ブロック率を最小化する配信頻度設計
- Phase 1→2→3 での LINE Harness 活用段階設計

### 8. セットアップ手順書
npx create-line-harness から本番運用開始までの完全手順：
1. 事前準備（LINE Developers 設定、Cloudflare 確認）
2. npx create-line-harness 実行と各入力値
3. Webhook URL 設定
4. 初期シナリオ作成（A〜D）
5. リッチメニュー作成
6. LIFF アプリ登録
7. テスト手順
8. 本番切替チェックリスト
※ 各ステップにコマンド・入力値の具体例・ハマりポイントを含める

---

## 制約条件
- 個人開発（1人）。月額コスト最大5,000円/月
- 既存 Supabase + React は変更しない。LINE Harness を追加する形
- 参加者は LINE 登録なしでも従来通り使える設計（LIFF/友だち追加は任意）
- 現在のユーザー数: 5〜10人（友人テスト段階）
- 2026年5月中に Step 1（セットアップ + 基本シナリオ）を完了したい

---

## 出力フォーマット

Part 1: リサーチ結果（最新動向 → KANJI への影響）
Part 2: アーキテクチャ設計（構成図・データフロー・認証フロー・Webhook設計）
Part 3: シナリオ設計（A〜D の詳細フロー + Flex Message JSON テンプレート）
Part 4: リッチメニュー設計（パターン・ボタン・切替ルール）
Part 5: LIFF 統合設計（手順・コード・注意点）
Part 6: メッセージ最適化戦略（通数シミュレーション・配信ルール）
Part 7: 成長ループ戦略（KPI・計測・Phase別ロードマップ）
Part 8: セットアップ手順書（コマンドレベルの完全手順）
Part 9: リスクと注意点（プラットフォーム・コスト・UX）
Part 10: ❓要確認事項

## 出力ルール
- 結論先出し
- 2026年4月以降の最新情報を優先。古い情報は注記
- 実装コスト（時間）を各施策に付記
- 「まずこれだけやれば動く」ミニマムセットを明示
- 落とし穴は ⚠️、要確認は ❓ で明示
- Flex Message JSON はコピペで使えるレベルで
