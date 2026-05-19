# Genspark プロンプト: 02_implementation_plan.md 生成依頼

> このファイルは Genspark に貼り付けて `02_implementation_plan.md` v1.1 を生成させるためのプロンプト。
> 前段の論点1〜6 議論コンテキストを保持した Genspark スレッドで使う想定。

---

## プロンプト本文（ここから下をコピー）

KANJI Phase 2 の **実装計画ドキュメント (`02_implementation_plan.md`, v1.1)** を作成してください。

戦略本体（`01_strategy.md` v1.1）は既に確定済みです。これと整合する形で「実装に踏み込めるレベル」の詳細を書いてください。コード・DDL・SQL は実際にコピペで動く具体性を求めます。

### 必須セクション

#### 1. 統合スキーマ変更（DDL すべて）

- `events` テーブル: `completed_at TIMESTAMPTZ`, `re_completed_at TIMESTAMPTZ`, `host_was_participant BOOLEAN` カラム追加
- `users` テーブル: `privacy_consented_at TIMESTAMPTZ`, `analytics_id_hash TEXT` カラム追加
- `invitations` テーブル新設（招待トラッキング第2層用）
- `growth_events` テーブル新設（イベントログ用、JSONB payload）
- インデックス（特に MSH 集計用の `completed_at` 部分インデックス、`growth_events.created_at` 等）
- RLS ポリシー更新（必要なもの全部）
- マイグレーション実行順序とロールバック手順
- 既存 archived イベントへの `completed_at` バックフィル SQL（`updated_at` 転記方式）

#### 2. 招待トラッキング3層構造の実装詳細

- 第1層: URL パラメータ（`?inv=<token>`）— 即時性
- 第2層: DB 永続化（`invitations` テーブル）— 信頼性
- 第3層: クライアント補助（LIFF state / localStorage）— フォールバック
- 各層の役割、フォールバック順序の決定ロジック
- イベント参加 → 後日自分でイベント作成 のフローをどう「参加者→幹事化」として捕捉するか
- 実装コード例（TypeScript: フロント側、SQL: 永続化側）

#### 3. 集計クエリ集（コピペで動く SQL）

すべて Supabase（PostgreSQL 14+）前提、`Asia/Tokyo` タイムゾーン変換明示、テストアカウント `user_id` ブラックリスト除外を組み込む。

- MSH 月次（対象イベント前置フィルタ込み: 参加者2人以上 / 立替1件以上 / settlement 1件以上 / 全 `is_settled`）
- 週次4週移動 MSH
- 再利用幹事率 30日 / 60日
- K-factor（月次: 1幹事が生む新規幹事数）
- 初回精算完了率
- 新規幹事の参加経験率（`host_was_participant=true` 比率）
- オーガニック流入比率（開発者の知り合い以外）

#### 4. growth_events ログの payload 設計ルール

- **含めて良い情報**: `event_type`, `host_user_id_hash`(SHA256+SECRET_SALT), `event_id`, `timestamp`, 数値メタ（参加人数、立替件数）
- **含めてはいけない情報**: 氏名、LINE userId 生値、PayPay ID、金額、メッセージ本文、メールアドレス、表示名
- payload JSON スキーマ定義（イベント種別ごとに）
- 主要 event_type 一覧（`event_created`, `participant_added`, `advance_registered`, `settlement_completed`, `invitation_clicked` 等）
- 90日後の月次集約 cron 仕様（pg_cron or Supabase Scheduled Functions）と集約後 raw データ削除手順

#### 5. 優先施策 Top 5 の最小実装

`01_strategy.md` Section 6.2 の Top 5 について、それぞれ:

- ファイル配置（`app/src/...` のどこに置くか）
- 関数シグネチャ
- 最小実装コード（過剰実装しない）
- 計測フック（どの growth_event を発火させるか）

対象:
1. 一括精算完了ボタン（UI + API）
2. 立替未登録の自動リマインダー（Edge Function + LINE Messaging API、24h/48h、OFF 設定）
3. 参加者ごとの立替ステータス可視化
4. LINE 共有メッセージのテンプレ自動生成
5. 立替入力 UI の deep link 化

#### 6. Week 0 〜 Month 6 マスタープラン

- Week 0: プライバシー基盤（詳細は `03_privacy_policy.md` 参照、ここでは関数シグネチャレベルで言及）
- Week 1-2: スキーマ変更 + `completed_at` 記録ロジック + 集計クエリ整備
- Week 3-4: 招待トラッキング3層 + ベースライン MSH 取得 → Gate 0
- Month 2-3: 優先施策 Top 5 実装（Week 単位の割り付け）→ Gate 1
- Month 4-6: 効果測定 + 追加施策 → Gate 2
- 各週末のチェックリスト

#### 7. 実装リスク・落とし穴

- マイグレーション失敗時の rollback 手順
- LINE Messaging API レート制限対策（月1,000通フリー枠を超えない設計）
- RLS ポリシー漏れの検出方法（テストクエリ）
- `completed_at` の上書きバグを防ぐ実装パターン（`AND completed_at IS NULL` の徹底）
- タイムゾーンバグの検出方法（境界月のテストケース）
- リマインダー疲れ防止（1イベント最大2回、通知 OFF 設定）

### 出力形式

- Markdown（見出し階層、テーブル、コードブロック使用）
- 冒頭にバージョン（v1.1）、作成日（2026-04-28）、関連文書参照
- 末尾に改訂履歴
- 文体: 「だ・である」調 or 「です・ます」調どちらでも、戦略本体と統一
- DDL・SQL は PostgreSQL 14+ 互換、コードブロックに ```sql を付ける
- Edge Function コード例は Deno（Supabase）前提、```typescript
- 関連文書参照は素のファイル名（例: `01_strategy.md`、`03_privacy_policy.md`）。URL 化しない

### 整合性チェック

`01_strategy.md` v1.1 の以下と必ず一致:

- Section 4「精算完了」定義（`completed_at` 不変ルール、対象イベント条件）
- Section 3 の North Star Pair および補助指標4種
- Section 5 の Gate 0/1/2 判定タイミング
- Section 6.2 優先施策 Top 5 の順序とコスト感
- Section 8.1 計測関連リスクの対策

`03_privacy_policy.md`（後続作成）と重複させない:

- プライバシーポリシー本文・利用規約本文 → そちらに任せる
- 同意 UI コピー案 → そちらに任せる
- ユーザー削除依頼処理スクリプト本文 → そちらに任せる
- ただし「`analytics_id_hash` の生成ロジック」「`growth_events` の payload ルール」は実装計画側で扱う

### 分量目安

- 12,000〜18,000字
- セクション7つ + 改訂履歴
- コードブロック・テーブル多めで OK

完成版を1メッセージで出力してください。
