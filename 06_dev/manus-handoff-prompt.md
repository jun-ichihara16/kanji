# AI KANJI — Manus共有用 プロジェクト現況まとめ

**作成日：** 2026年4月4日
**目的：** Claude Codeで実装した現在の状態をManusに共有し、機能調整・追加実装を依頼する

---

## 1. プロジェクト概要

**サービス名：** AI KANJI（幹事アプリ）
**コンセプト：** 飲み会・イベントの幹事が抱える「お金の管理」の面倒を解決するWebアプリ。割り勘計算・立替登録・精算計算・PayPay番号収集をLINEログイン+Webアプリ+LINE Botで完結させる。

**公開URL：**
- LP: https://jun-ichihara16.github.io/kanji/
- Reactアプリ: https://jun-ichihara16.github.io/kanji/app/
- GitHubリポジトリ: https://github.com/jun-ichihara16/kanji

---

## 2. 技術スタック

| 領域 | 技術 |
|------|------|
| フロントエンド | React 18 + TypeScript + Vite |
| スタイリング | Tailwind CSS v3 |
| ルーティング | React Router v6 |
| データベース | Supabase (PostgreSQL + RLS) |
| 認証 | LINE Login (直接OAuth → Edge Functionでトークン交換) |
| バックエンド | Supabase Edge Functions (Deno) |
| LINE Bot | Supabase Edge Function (Webhook) |
| デプロイ | GitHub Pages + GitHub Actions |
| 認証方式 | LINE OAuth → Edge Function → localStorageベースのセッション管理（Supabase Authは未使用） |

---

## 3. Supabase情報

- **URL:** https://kdaeebtjwnxerebxmjcs.supabase.co
- **Anon Key:** eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkYWVlYnRqd254ZXJlYnhtamNzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxMzQ1MTEsImV4cCI6MjA5MDcxMDUxMX0.tPeQvMoQ4we1Gj8VxXmnb28FnSoTut33923xCYW0ELw

### LINE Login
- Channel ID: 2009684655
- Channel Secret: b3604bd0d31914453c4c1efa8ebf1a53
- Callback URL: https://jun-ichihara16.github.io/kanji/app/auth/callback

### LINE Bot (Messaging API)
- Channel ID: 2009640755
- Channel Secret: 84d8cf8cdcf318aec9fc22282b9d7486
- Channel Access Token: jVhtlq4H8Zl0EiiCDvHj6LJXmSzIsPsCE9F7EiobF974YN6Zp8gV+bIu76iwEH/Is8UQVwPiDFkDv+/DvVAmi3dYpKYES2EW34i9VKw0ywsnXAnpE2iPk67n+vpWH4BM2PHhoqf1OXLG2f7F1dFquAdB04t89/1O/w1cDnyilFU=
- Webhook URL: https://kdaeebtjwnxerebxmjcs.supabase.co/functions/v1/line-bot

---

## 4. データベーススキーマ

### users テーブル
```sql
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  line_user_id text UNIQUE,
  display_name text,
  avatar_url text,
  onboarding_completed boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
```

### events テーブル
```sql
CREATE TABLE events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  host_id uuid,  -- FK制約は外してある（LINE直接認証のため）
  title text NOT NULL,
  venue_name text,
  venue_address text,
  event_date text,
  fee_per_person integer,
  memo text,
  line_group_id text,  -- LINE Botでグループとイベントを紐付け
  created_at timestamptz DEFAULT now()
);
```

### participants テーブル
```sql
CREATE TABLE participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES events(id) ON DELETE CASCADE,
  name text NOT NULL,
  payment_method text NOT NULL,  -- 'paypay' | 'cash' | 'bank'
  paypay_phone text,
  is_paid boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
```

### advances テーブル（立替記録）
```sql
CREATE TABLE advances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES events(id) ON DELETE CASCADE,
  payer_name text NOT NULL,
  amount integer NOT NULL,
  description text,
  split_target text NOT NULL,  -- 'all' | 'specific'
  target_names text[],          -- split_target='specific'の場合の対象者名リスト
  created_at timestamptz DEFAULT now()
);
```

### contacts テーブル（お問い合わせ）
```sql
CREATE TABLE contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  category text,
  message text NOT NULL,
  created_at timestamptz DEFAULT now()
);
```

### RLSポリシー（全テーブル全開放：開発中）
```sql
CREATE POLICY "xxx_all" ON [テーブル名] FOR ALL USING (true) WITH CHECK (true);
```

---

## 5. ディレクトリ構成

```
/kanji/
├── index.html              # LP（ランディングページ）
├── app.html                # 静的HTMLデモ（旧版、参考用）
├── privacy.html            # プライバシーポリシー
├── terms.html              # 利用規約
├── contact.html            # お問い合わせフォーム
├── 01_business-design/     # 事業設計ドキュメント
├── 02_lp/                  # LP関連プロンプト
├── 03_legal/               # 法務ドキュメント
├── 04_brand/               # ブランドアセット（ロゴ等）
├── 05_img/                 # 画像（kanji_logo.png, paypay.jpg）
├── 06_dev/                 # 開発ドキュメント
├── .github/workflows/
│   └── deploy.yml          # GitHub Actions デプロイ
│
└── app/                    # Reactアプリ本体
    ├── package.json
    ├── vite.config.ts       # base: '/kanji/app/'
    ├── tsconfig.json
    ├── tailwind.config.js
    ├── postcss.config.js
    ├── .env.local           # VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_LINE_CHANNEL_ID
    ├── index.html
    ├── supabase-setup.sql   # DB作成SQL
    ├── public/img/          # kanji_logo.png, paypay.jpg
    │
    ├── supabase/functions/
    │   ├── line-auth/index.ts   # LINE OAuthトークン交換
    │   └── line-bot/index.ts    # LINE Bot Webhook
    │
    └── src/
        ├── main.tsx         # エントリポイント + SPA redirect処理
        ├── App.tsx          # ルーティング定義
        ├── index.css        # Tailwind directives + CSS変数
        ├── vite-env.d.ts
        │
        ├── lib/
        │   ├── supabase.ts  # Supabaseクライアント初期化
        │   ├── auth.ts      # LINE OAuth + localStorageセッション管理
        │   ├── settle.ts    # 最小精算アルゴリズム
        │   └── settle.test.ts # 精算アルゴリズムテスト（5テスト全パス）
        │
        ├── hooks/
        │   ├── useAuth.ts   # 認証状態管理（localStorage）
        │   └── useEvent.ts  # イベント・参加者・立替のCRUD
        │
        ├── components/
        │   ├── Layout.tsx           # ヘッダー + PhoneFrame (390px)
        │   ├── ProtectedRoute.tsx   # 認証ガード
        │   ├── LineLoginButton.tsx  # LINEログインボタン
        │   ├── ParticipantCard.tsx  # 参加者カード
        │   ├── SummaryCard.tsx      # 数値サマリーカード
        │   ├── PayPayList.tsx       # PayPay番号アコーディオン
        │   ├── AdvancePaymentForm.tsx # 立替登録フォーム
        │   └── SettlementList.tsx   # 精算結果リスト
        │
        └── pages/
            ├── Home.tsx         # ランディング（未認証時）
            ├── AuthCallback.tsx # LINE OAuthコールバック
            ├── Onboarding.tsx   # 初回オンボーディング（3ステップ）
            ├── Dashboard.tsx    # イベント一覧
            ├── EventCreate.tsx  # イベント作成（2ステップ）
            ├── EventManage.tsx  # イベント管理（幹事側: 2タブ）
            └── GuestJoin.tsx    # 参加者ページ（公開URL: 3タブ）
```

---

## 6. ルーティング

| パス | コンポーネント | 認証 | 説明 |
|------|-------------|------|------|
| `/` | Home.tsx | 不要 | ランディング。ログイン済みならdashboardにリダイレクト |
| `/auth/callback` | AuthCallback.tsx | 不要 | LINE OAuthコールバック処理 |
| `/onboarding` | Onboarding.tsx | 不要 | 初回ログイン時のオンボーディング |
| `/dashboard` | Dashboard.tsx | **必要** | イベント一覧 |
| `/events/new` | EventCreate.tsx | **必要** | イベント新規作成 |
| `/events/:id` | EventManage.tsx | **必要** | イベント管理（幹事側） |
| `/e/:slug` | GuestJoin.tsx | 不要 | 参加者向け公開ページ |

---

## 7. 認証フロー

```
1. ユーザーが「LINEでログイン」をタップ
2. LINE OAuth認証画面にリダイレクト（access.line.me）
3. ユーザーが許可 → /auth/callback?code=xxx にリダイレクト
4. AuthCallback.tsx が Edge Function (line-auth) を呼び出し
5. Edge Function が:
   a. LINEトークン交換（code → access_token）
   b. LINEプロフィール取得（displayName, userId, pictureUrl）
   c. usersテーブルにupsert
   d. { user: { id, displayName, avatarUrl, onboardingCompleted } } を返す
6. フロントエンドが localStorage に user を保存
7. onboardingCompleted=false → /onboarding
   onboardingCompleted=true → /dashboard
```

**注意:** Supabase Authは使っていない。localStorage + Edge Functionによる独自セッション管理。

---

## 8. 各ページの詳細UI/UX

### Home.tsx（ランディング）
- ロゴ + キャッチコピー
- LINEログインボタン（LINE公式緑）
- 機能カード3つ（割り勘、PayPay集金、リマインド）
- 立替登録・自動精算カード2つ
- ログイン済みなら自動でdashboardにリダイレクト

### Onboarding.tsx（初回オンボーディング）
- STEP 1: ウェルカム画面（AI KANJIへようこそ！）
- STEP 2: 利用規約・プライバシーポリシー同意（両方チェック必須）
- STEP 3: 登録完了 → ダッシュボードへ
- onboarding_completedフラグをDBに保存

### Dashboard.tsx（イベント一覧）
- 「おかえりなさい、{名前}さん」
- イベントカード一覧（タイトル、日時、場所、参加者数、支払い進捗バー）
- 各カードに「このイベントを削除」リンク（確認ダイアログ付き）
- 「新しいイベントを作成」ボタン
- イベントが0件の場合のフォールバック表示

### EventCreate.tsx（イベント作成）
- STEP 1: フォーム入力
  - イベント名（必須）
  - お店の名前
  - 最寄り駅
  - 日時（カレンダーpicker: type="date"）
  - メモ
- STEP 2: URL共有
  - 参加者URL表示 + コピーボタン
  - LINEで送るボタン（line://msg/text/スキーム）
  - 「イベント管理画面へ」ボタン

### EventManage.tsx（幹事側イベント管理）
- ヘッダー: イベント名 + 日時 + 削除ボタン
- サマリーカード3枚（参加者数、支払い済み、未払い）
- **2タブ構成:**

**タブ1: 参加者**
- 参加者追加フォーム（名前 + 支払い方法[PayPay/現金/振込] + PayPay番号）
- 参加者リスト（名前、支払い方法表示、編集・削除ボタン）
- 編集モード: 名前 + 支払い方法 + PayPay番号を変更可能
- 参加者URL共有ボックス
- 精算状況サマリー（プログレスバー + 精算リスト + 完了/済みトグル）

**タブ2: 立替**
- 立替登録フォーム（AdvancePaymentForm）
  - 立替者（参加者からドロップダウン選択）
  - 内容（テキスト）
  - 金額（数値）
  - 対象者（全員チェックボックス or 個別チェックボックス、2列グリッド）
- 登録済み立替一覧（編集・削除ボタン付き）
  - 編集: 内容・金額を変更可能

### GuestJoin.tsx（参加者向け公開ページ `/e/:slug`）
- イベントヘッダー（タイトル、日時、参加者数、合計金額）
- **3タブ構成:**

**タブ1: 情報**
- イベント詳細（場所、メモ）
- 参加者一覧（名前、支払い方法、PayPay番号表示）
- 各参加者に編集・削除ボタン
- 参加登録フォーム（名前 + 支払い方法選択 + PayPay番号）

**タブ2: 立替**
- 立替登録フォーム
  - 支払った人（参加者ドロップダウン）
  - 内容（テキスト）
  - 金額（数値）
  - 対象者（全員 or 個別チェックボックス）
- 立替一覧（編集・削除可能）

**タブ3: 精算**
- 精算結果を自動計算して表示
- 各精算カード:
  - 「A → B ¥3,000」
  - PayPayの人: 番号コピー ▶ PayPayで送金ボタン
  - 現金/振込の人: 支払い方法ラベルのみ（PayPayボタンなし）
  - 「精算完了にする」ボタン（緑背景・白文字）
  - 精算済み: カードグレーアウト + 金額取り消し線 + PayPay UI非表示
- 精算結果コピーボタン

---

## 9. 最小精算アルゴリズム（settle.ts）

```typescript
export interface Advance {
  payerName: string
  amount: number
  splitTarget: 'all' | 'specific'
  targetNames?: string[]
}

export interface Settlement {
  from: string   // 支払う人
  to: string     // 受け取る人
  amount: number // 金額（円）
}

export function calculateSettlements(
  advances: Advance[],
  participantNames: string[]
): Settlement[]
```

**アルゴリズム:**
1. 各人の純収支を計算（立替額 - 負担額）
2. 正（受け取り超過）→ creditors、負（支払い超過）→ debtors に分類
3. 金額が大きい順にソート
4. 貪欲法で最小回数の送金組み合わせを生成

**テストケース（5つ全パス）:**
- 3人でAが全額立替 → B→A, C→A
- 複数立替が混在 → 相殺されて最小精算
- 特定の人のみ対象の立替
- 立替がない場合は空配列
- 全員が均等に立替した場合は精算不要

---

## 10. LINE Botコマンド

| コマンド | 例 | 動作 |
|---------|---|------|
| `@KANJI イベント作成 [タイトル]` | `@KANJI イベント作成 忘年会` | イベント作成 + 参加URL返信 |
| `@KANJI 参加者` | `@KANJI 参加者` | 参加者一覧（PayPay番号付き） |
| `@KANJI 立替 [金額] [内容]` | `@KANJI 立替 3000 居酒屋代` | 送信者名で立替登録（全員割り勘） |
| `@KANJI 精算` | `@KANJI 精算` | 精算結果を計算してグループに投稿 |
| `@KANJI ヘルプ` | `@KANJI ヘルプ` | 使い方ガイド |
| (Botグループ参加時) | - | ウェルカムメッセージ + コマンド一覧 |

**注意:**
- グループ・トークルームでのみ動作（個人チャットは無視）
- `@KANJI` で始まるメッセージのみ反応（大文字小文字不問）
- イベントは `line_group_id` でグループに紐付け
- 立替コマンドは送信者のLINE表示名を自動取得

---

## 11. Edge Functions

### line-auth（LINE OAuthトークン交換）
- **URL:** https://kdaeebtjwnxerebxmjcs.supabase.co/functions/v1/line-auth
- **認証:** --no-verify-jwt（JWTチェックなし）
- **入力:** `{ code, redirectUri }`
- **処理:** code → LINEトークン交換 → プロフィール取得 → usersテーブルupsert
- **出力:** `{ user: { id, displayName, avatarUrl, onboardingCompleted } }`

### line-bot（LINE Bot Webhook）
- **URL:** https://kdaeebtjwnxerebxmjcs.supabase.co/functions/v1/line-bot
- **認証:** --no-verify-jwt + HMAC-SHA256署名検証
- **処理:** Webhookイベント受信 → コマンドパース → DB操作 → リプライ送信

---

## 12. デプロイ構成（GitHub Actions）

- **トリガー:** mainブランチへのpush
- **ビルド:**
  1. `cd app && npm ci && npm run build`
  2. 環境変数: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY(直接記載), VITE_LINE_CHANNEL_ID
- **デプロイ先:** `_site/` ディレクトリ
  - ルート: LP + 静的HTML (index.html, privacy.html, terms.html, contact.html, app.html)
  - `/app/`: Reactビルド出力
  - SPAフォールバック: 404.html + 各ルートディレクトリにindex.htmlをコピー
    - /app/auth/callback/, /app/dashboard/, /app/events/new/, /app/onboarding/, /app/e/

---

## 13. デザイン仕様

### カラー
- グリーン: `#22C55E`（メインアクション）
- ダークグリーン: `#16A34A`（ホバー）
- ライトグリーン: `#F0FDF4`（背景）
- LINE緑: `#06C755`（LINEログインボタン）
- テキスト: `#1A1A1A`
- サブテキスト: `#6B7280`
- ボーダー: `#E5E7EB`
- グレー背景: `#F3F4F6`
- PayPay赤: `#FF0033`

### フォント
- 日本語: Noto Sans JP (400-800)
- 英数字: Inter (400-800)
- Google Fonts CDN読み込み

### レイアウト
- モバイルファースト、max-width: 390px（PhoneFrame）
- 角丸: 10px-16px
- box-shadow: `0 0 40px rgba(0,0,0,0.08)`

---

## 14. 既知の課題・制限事項

1. **認証:** Supabase AuthではなくlocalStorage + Edge Functionの独自認証。セキュリティ面で本番環境には要改善。
2. **host_id FK制約:** 外してあるため、イベントとユーザーの紐付けが緩い。fetchMyEventsのフォールバックで全イベントを表示している。
3. **精算完了状態:** localStorageの `settledMap` で管理しており、DBには保存されていない。ブラウザを変えると精算状態がリセットされる。
4. **RLSポリシー:** 開発中のため全テーブル全開放（`FOR ALL USING (true)`）。本番前にhost_id/event_idベースの制限が必要。
5. **LINE Bot:** イベントはグループの最新1件のみ参照。複数イベントの同時管理は未対応。
6. **SPA フォールバック:** GitHub Pages用に各ルートディレクトリにindex.htmlをコピーする方式。動的パス（`/e/:slug`）は404.html→sessionStorage→redirectで対応。
7. **メール通知:** お問い合わせフォームはDB保存のみ。メール通知は未実装。

---

## 15. 環境変数まとめ

### フロントエンド（.env.local）
```
VITE_SUPABASE_URL=https://kdaeebtjwnxerebxmjcs.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_LINE_CHANNEL_ID=2009684655
```

### Edge Function Secrets（Supabase）
```
LINE_CHANNEL_ID=2009684655
LINE_CHANNEL_SECRET=b3604bd0d31914453c4c1efa8ebf1a53
LINE_BOT_CHANNEL_SECRET=84d8cf8cdcf318aec9fc22282b9d7486
LINE_BOT_ACCESS_TOKEN=jVhtlq4H8Zl0EiiCDvHj6LJXmSzIsPsCE9F7EiobF974YN6Zp8gV+bIu76iwEH/Is8UQVwPiDFkDv+/DvVAmi3dYpKYES2EW34i9VKw0ywsnXAnpE2iPk67n+vpWH4BM2PHhoqf1OXLG2f7F1dFquAdB04t89/1O/w1cDnyilFU=
SUPABASE_URL=（自動設定）
SUPABASE_SERVICE_ROLE_KEY=（自動設定）
```

---

以上がAI KANJIプロジェクトの現在の全容です。
