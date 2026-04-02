# KANJI アプリ 確定仕様書

---

## コンセプト

**LINEグループで完結する幹事向け割り勘・立替精算ツール**

幹事が専用LINEグループを作成し、KANJI Botを追加。参加者を招待すると、立替登録・精算計算・支払いリマインドがすべてLINE上で完結します。

---

## 確定した設計

### 1. 立替登録

**LINEグループのリッチメニューから入力**

- リッチメニューに「立替を登録」ボタン
- クリックするとLIFF（LINE Front-end Framework）でフォームが開く
- 入力項目:
  - 誰が（立替した人）
  - 誰の分を（複数選択可能）
  - 何を（例: 居酒屋代、タクシー代）
  - いくら
- 送信すると自動でDBに保存され、Botがグループに通知

```
KANJI Bot:
💰 立替が登録されました
田中さんが「居酒屋代」を立替
対象: 鈴木さん、佐藤さん、山田さん
金額: ¥12,000
```

---

### 2. 精算計算

**最小精算方式（walica方式）**

全員の立替・支払い状況から「誰が誰にいくら払えば全員ゼロになるか」を最小回数で自動計算します。

例:
```
田中 → 市原: ¥1,500
鈴木 → 市原: ¥2,000
```

幹事がWebダッシュボードまたはLINEで「精算を確認」を押すと表示されます。

---

### 3. 支払い完了管理

**手動で「払いました」ボタン（シンプル方式）**

- 幹事がWebダッシュボードで各精算項目に「済」ボタン
- または参加者がLINEで「払いました」と送ると幹事に通知

---

### 4. グループLINE運用フロー

#### ステップ1: 幹事がLINEグループ作成

幹事が **イベント専用のLINEグループ** を新規作成し、参加者を招待します。

例: 「【KANJI】渋谷で忘年会」

#### ステップ2: KANJI Botを追加

幹事がWebダッシュボードでイベント作成 → Bot追加用のQRコードまたはリンクを取得 → グループに追加

#### ステップ3: Botがメンバーをスキャン

Botがグループメンバーのリストを取得し、Webダッシュボードに表示。
幹事が各メンバーの支払い方法（PayPay / 銀行振込 / 現金）を設定。

#### ステップ4: 立替登録

参加者がリッチメニューから立替を登録。Botがグループに通知。

#### ステップ5: 精算計算

幹事がWebまたはLINEで「精算を確認」→ 誰が誰にいくら払うかが表示される。

#### ステップ6: 支払いリマインド

**幹事がWebで「リマインド送信」ボタンを押す**

```
KANJI Bot:
@鈴木さん
市原さんへの支払いがまだ完了していません。
金額: ¥2,000
PayPay: 090-XXXX-XXXX
```

#### ステップ7: 支払い完了

参加者が支払い後、幹事がWebで「済」にする。または参加者がLINEで「払いました」と送る。

---

## 技術スタック

### フロントエンド（Web）
- React + TypeScript + Vite
- Tailwind CSS v4
- React Router v7

### バックエンド
- Supabase（DB・認証・リアルタイム）
- LINE Messaging API（Bot）
- LIFF（LINE Front-end Framework）（立替登録フォーム）

### 認証
- LINE Login OAuth 2.0

### デプロイ
- フロントエンド: GitHub Pages
- Bot: Supabase Edge Functions

---

## データベーススキーマ

```sql
-- ユーザーテーブル
create table users (
  id uuid primary key,
  line_user_id text unique,
  display_name text,
  avatar_url text,
  created_at timestamptz default now()
);

-- イベントテーブル
create table events (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  host_id uuid references users(id),
  title text not null,
  venue_name text,
  event_date text,
  line_group_id text,              -- LINEグループID
  created_at timestamptz default now()
);

-- 参加者テーブル
create table participants (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references events(id) on delete cascade,
  line_user_id text,               -- LINEユーザーID
  name text not null,
  payment_method text not null,    -- 'paypay' | 'bank' | 'cash'
  paypay_phone text,
  created_at timestamptz default now()
);

-- 立替テーブル
create table expenses (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references events(id) on delete cascade,
  payer_id uuid references participants(id),     -- 立替した人
  description text not null,                     -- 何を（居酒屋代など）
  amount integer not null,                       -- 金額（円）
  created_at timestamptz default now()
);

-- 立替対象者テーブル（多対多）
create table expense_targets (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid references expenses(id) on delete cascade,
  participant_id uuid references participants(id) on delete cascade
);

-- 精算テーブル
create table settlements (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references events(id) on delete cascade,
  from_participant_id uuid references participants(id),
  to_participant_id uuid references participants(id),
  amount integer not null,
  is_paid boolean default false,
  created_at timestamptz default now()
);
```

---

## 画面構成

### Web（幹事用ダッシュボード）

#### 1. ホーム（`/`）
- ランディングページ
- 「LINEでログイン」ボタン

#### 2. ダッシュボード（`/dashboard`）
- マイイベント一覧
- 「新しいイベントを作成」ボタン

#### 3. イベント作成（`/events/new`）
- イベント名・日時・場所入力
- 「イベントを作成してBotを追加」ボタン
- Bot追加用QRコード・リンク表示

#### 4. イベント管理（`/events/:id/manage`）
- 参加者リスト（LINEグループから自動取得）
- 立替一覧
- 精算計算結果
- 「リマインド送信」ボタン
- 各精算に「済」ボタン

### LINE（参加者・幹事共通）

#### リッチメニュー
- 立替を登録
- 精算を確認
- イベント情報

#### LIFF（立替登録フォーム）
- 誰が（自動入力：ログイン中のユーザー）
- 誰の分を（チェックボックス：グループメンバー一覧）
- 何を（テキスト入力）
- いくら（数値入力）
- 送信ボタン

---

## 精算アルゴリズム（最小精算）

```typescript
// 各参加者の収支を計算
const balances = participants.map(p => {
  const paid = expenses.filter(e => e.payer_id === p.id).reduce((sum, e) => sum + e.amount, 0);
  const owed = expenseTargets.filter(et => et.participant_id === p.id).reduce((sum, et) => sum + et.expense.amount / et.expense.targets.length, 0);
  return { id: p.id, name: p.name, balance: paid - owed };
});

// 債権者（プラス）と債務者（マイナス）に分ける
const creditors = balances.filter(b => b.balance > 0).sort((a, b) => b.balance - a.balance);
const debtors = balances.filter(b => b.balance < 0).sort((a, b) => a.balance - b.balance);

// 最小精算を計算
const settlements = [];
let i = 0, j = 0;
while (i < creditors.length && j < debtors.length) {
  const amount = Math.min(creditors[i].balance, -debtors[j].balance);
  settlements.push({
    from: debtors[j].name,
    to: creditors[i].name,
    amount: Math.round(amount)
  });
  creditors[i].balance -= amount;
  debtors[j].balance += amount;
  if (creditors[i].balance === 0) i++;
  if (debtors[j].balance === 0) j++;
}
```

---

## LINE Bot 実装

### Webhook処理（Supabase Edge Functions）

```typescript
// deno deploy function
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const body = await req.json()
  const events = body.events

  for (const event of events) {
    if (event.type === 'message' && event.message.type === 'text') {
      const text = event.message.text
      if (text === '精算を確認') {
        // 精算計算して返信
      } else if (text === '払いました') {
        // 幹事に通知
      }
    } else if (event.type === 'postback') {
      // リッチメニューからのpostback処理
    }
  }

  return new Response('OK', { status: 200 })
})
```

### リッチメニュー設定

```json
{
  "size": { "width": 2500, "height": 1686 },
  "selected": true,
  "name": "KANJI Menu",
  "chatBarText": "メニュー",
  "areas": [
    {
      "bounds": { "x": 0, "y": 0, "width": 1250, "height": 843 },
      "action": { "type": "uri", "uri": "https://liff.line.me/{LIFF_ID}/expense/new" }
    },
    {
      "bounds": { "x": 1250, "y": 0, "width": 1250, "height": 843 },
      "action": { "type": "message", "text": "精算を確認" }
    },
    {
      "bounds": { "x": 0, "y": 843, "width": 2500, "height": 843 },
      "action": { "type": "message", "text": "イベント情報" }
    }
  ]
}
```

---

## 実装優先順位

1. Supabase プロジェクト作成・スキーマ構築
2. LINE Developers チャンネル作成（Messaging API + LINE Login）
3. フロントエンド基盤（React + Tailwind + Router）
4. LINE Login 実装
5. イベント作成・管理画面
6. LINE Bot Webhook（Supabase Edge Functions）
7. LIFF 立替登録フォーム
8. 精算計算ロジック
9. リマインド送信機能
10. GitHub Pages デプロイ設定

---

## 次のステップ

この仕様書をベースに、ClaudeCode用の実装プロンプトを再生成しますか？
それとも、Manusの現在のWebアプリに機能を追加する形で進めますか？
