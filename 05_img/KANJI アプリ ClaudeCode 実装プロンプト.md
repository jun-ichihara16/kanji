# KANJI アプリ ClaudeCode 実装プロンプト

---

## プロンプト本文（ClaudeCodeにそのまま貼り付けてください）

---

```
以下の仕様に従って、KANJIというイベント割り勘・集金管理Webアプリを実装してください。

## アプリ概要

「KANJI」は幹事向けの割り勘・集金管理サービスです。
幹事がイベントを作成してURLを発行し、参加者がそのURLから参加登録・支払い方法の登録を行います。
LINEログインで認証し、GitHub Pages（静的サイト）として公開します。

---

## 技術スタック

- **フロントエンド**: React + TypeScript + Vite
- **スタイリング**: Tailwind CSS v4
- **ルーティング**: React Router v7
- **バックエンド**: Supabase（認証・DB・リアルタイム）
- **認証**: LINE Login OAuth 2.0（Supabase Auth カスタムプロバイダー）
- **デプロイ**: GitHub Pages（Vite の base 設定で対応）

---

## デザイン仕様

### カラーパレット
- プライマリグリーン: `#22C55E`
- ダークグリーン: `#16A34A`
- 背景白: `#FFFFFF`
- テキスト: `#1A1A1A`
- サブテキスト: `#6B7280`
- ライトグリーン背景: `#F0FDF4`
- ボーダー: `#E5E7EB`
- グレー背景: `#F3F4F6`

### フォント
- 日本語: Noto Sans JP（400, 500, 600, 700, 800）
- 英数字: Inter（400, 600, 700, 800）
- Google Fonts CDN で読み込む

### UIスタイル
- スマホファースト（最大幅 390px のフォンフレーム）
- 角丸: 10px〜16px
- シャドウ: `0 0 40px rgba(0,0,0,.08)`
- ボタンホバー: `translateY(-1px)` + 影
- トランジション: `all .2s`

---

## 画面構成

### 1. ランディングページ（`/`）

ヘッダー・ヒーローセクション・機能説明・CTAの構成。
「LINEでログイン」ボタンを目立たせる。
ヘッダーは `position: fixed` でスクロール追従。

### 2. ダッシュボード（`/dashboard`）ログイン必須

LINEログイン後に表示。
- マイイベント一覧（カード形式）
- 「新しいイベントを作成」ボタン
- 各イベントカードに参加者数・支払い状況サマリーを表示

### 3. イベント作成（`/events/new`）ログイン必須

**Step 1: イベント情報入力**
以下のフィールドを持つフォーム:
- イベント名（例: 渋谷で忘年会）
- お店の名前（例: 個室居酒屋 鳥貴族 渋谷店）
- 住所・最寄り駅（例: 渋谷駅 徒歩3分）
- 日時（例: 2025年12月20日（土）19:00〜）
- 参加費・一人あたり（例: ¥4,000）
- 幹事からのメモ（任意）
- 「イベントURLを発行する」ボタン

**Step 2: URL発行・共有**
- 発行されたURL表示（例: `https://kanji.app/e/xK9mP2`）
- コピーボタン（クリックで「コピー済み!」に変わり2秒後に戻る）
- 「LINEで送る」ボタン（`line://msg/text/` スキーム）
- 参加状況リスト（参加者カード: アバター・名前・支払い方法・登録済み/未払いバッジ）

**Step 3: 参加者管理**
- サマリーカード3枚（参加者数・支払い済み・未払い）
- 参加者リスト（各カードにリマインド送信ボタン）
- 「PayPay番号をまとめて見る」アコーディオン（名前と電話番号の一覧）

### 4. 参加者向けページ（`/e/:slug`）ログイン不要

**Step 1: イベント詳細確認**
- イベントカード（タイトル・日時・場所・参加費・幹事メモ・幹事名）
- 「参加する」ボタン

**Step 2: 参加情報入力**
- 名前入力
- 支払い方法選択（PayPay / 銀行振込 / 現金）ラジオ選択UI
- PayPay選択時: 電話番号入力フィールドを表示
- 「登録する」ボタン

**Step 3: 登録完了**
- 完了アイコン（緑の丸にチェックマーク）
- 完了メッセージ・イベント詳細サマリー
- 「LINEで支払いリマインドを受け取る」ボタン
- 「支払いました」ボタン（クリックで支払い済みに更新）

---

## コンポーネント設計

```
src/
  components/
    PhoneFrame.tsx       # スマホフレームラッパー（max-w-390px）
    StepIndicator.tsx    # ドットインジケーター（active時に横長に変化）
    StepNav.tsx          # 戻る/次へナビゲーション
    ParticipantCard.tsx  # 参加者カード（アバター・名前・支払い方法・ステータス）
    EventCard.tsx        # イベント情報カード（ライトグリーン背景）
    PaymentOption.tsx    # 支払い方法選択ラジオUI
    SummaryCard.tsx      # 数値サマリーカード（参加者数など）
    LineLoginButton.tsx  # LINEログインボタン（#06C755）
  pages/
    Home.tsx
    Dashboard.tsx
    EventCreate.tsx
    EventManage.tsx
    EventPublic.tsx      # /e/:slug 参加者向け
  hooks/
    useAuth.ts           # Supabase Auth + LINE Login
    useEvent.ts          # イベントCRUD
  lib/
    supabase.ts          # Supabase クライアント初期化
```

---

## Supabase データベーススキーマ

```sql
-- ユーザーテーブル（Supabase Auth と連携）
create table users (
  id uuid references auth.users primary key,
  line_user_id text unique,
  display_name text,
  avatar_url text,
  created_at timestamptz default now()
);

-- イベントテーブル
create table events (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,         -- URLスラッグ（6文字ランダム）
  host_id uuid references users(id),
  title text not null,
  venue_name text,
  venue_address text,
  event_date text,
  fee_per_person integer,            -- 円
  memo text,
  created_at timestamptz default now()
);

-- 参加者テーブル
create table participants (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references events(id) on delete cascade,
  name text not null,
  payment_method text not null,      -- 'paypay' | 'bank' | 'cash'
  paypay_phone text,
  is_paid boolean default false,
  created_at timestamptz default now()
);
```

---

## LINE Login 実装

Supabase の Custom OAuth Provider として LINE Login を設定します。

```typescript
// lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

export const signInWithLine = () => {
  return supabase.auth.signInWithOAuth({
    provider: 'line' as any,
    options: {
      redirectTo: `${window.location.origin}/dashboard`,
      scopes: 'profile openid'
    }
  })
}
```

LINE Login チャンネル情報:
- Channel ID: `2009640755`
- Callback URL: `{SUPABASE_URL}/auth/v1/callback`

---

## GitHub Pages デプロイ設定

```typescript
// vite.config.ts
export default defineConfig({
  base: '/kanji/',   // リポジトリ名に合わせて変更
  plugins: [react()],
  build: {
    outDir: 'dist'
  }
})
```

```yaml
# .github/workflows/deploy.yml
name: Deploy to GitHub Pages
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run build
        env:
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
      - uses: peaceiris/actions-gh-pages@v4
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
```

---

## 実装の優先順位

1. プロジェクトセットアップ（Vite + React + TypeScript + Tailwind）
2. デザイントークン・グローバルCSS設定
3. PhoneFrame・共通コンポーネント作成
4. ランディングページ（`/`）
5. 参加者向けページ（`/e/:slug`）※ログイン不要なので先に実装
6. Supabase接続・LINEログイン実装
7. ダッシュボード（`/dashboard`）
8. イベント作成ページ（`/events/new`）
9. イベント管理ページ（`/events/:id/manage`）
10. GitHub Actions デプロイ設定

---

## 重要な実装ポイント

- **ステップナビゲーション**: `useState` でステップ管理し、`transform: translateX` でスライドアニメーション
- **アバターカラー**: 8色のカラーパレット（`#22C55E`, `#3B82F6`, `#F97316`, `#EF4444`, `#8B5CF6`, `#EC4899`, `#14B8A6`, `#F59E0B`）を名前のインデックスで割り当て
- **URLスラッグ生成**: `nanoid(6)` で6文字のランダムID
- **PayPayアコーディオン**: `useState` でopen/close管理
- **コピーボタン**: `navigator.clipboard.writeText()` + 2秒後にリセット
- **支払い方法選択**: 選択中のオプションに `border-color: #22C55E` + `background: #F0FDF4`

まず `package.json` の作成から始めて、上記の優先順位に従って実装してください。
```

---

## GitHub Pagesで公開する手順

1. GitHubで新しいリポジトリを作成（例: `kanji`）
2. ClaudeCodeで生成したコードをpush
3. リポジトリの Settings → Pages → Source を「GitHub Actions」に設定
4. Secrets に `VITE_SUPABASE_URL` と `VITE_SUPABASE_ANON_KEY` を追加
5. mainブランチにpushするたびに自動デプロイ

**公開URL**: `https://{GitHubユーザー名}.github.io/kanji/`

---

## 補足: Supabaseの無料枠

| 項目 | 無料枠 |
|------|--------|
| DB容量 | 500MB |
| 月間アクティブユーザー | 50,000 |
| ストレージ | 1GB |
| Edge Functions | 500,000回/月 |

個人利用・小規模サービスであれば**完全無料**で運用できます。
