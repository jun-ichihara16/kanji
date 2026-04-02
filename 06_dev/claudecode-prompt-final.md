# KANJI アプリ ClaudeCode 実装プロンプト【最終版】

---

## ▼ このファイルの使い方

1. 下の「プロンプト本文」の ``` で囲まれた部分を**全文コピー**
2. ClaudeCodeに貼り付けて実行
3. 実装が完了したら「事前準備チェックリスト」に従って各サービスを設定

---

## プロンプト本文

---

```
以下の仕様に従って、「KANJI」というLINEグループ連携型の幹事向け割り勘・立替精算Webアプリを実装してください。

==========================================================
## 1. アプリ概要・コンセプト
==========================================================

アプリ名: KANJI（幹事）
コンセプト: 「幹事の立替精算を、LINEで全部解決」

【ユーザーフロー】
1. 幹事がWebアプリにLINEログイン
2. イベントを作成（イベント名・日時・場所）
3. KANJI BotをグループLINEに追加
4. Webアプリで「このグループと紐付ける」ボタンを押してイベントとグループを連携
5. 幹事がWebで参加者名を手入力で登録（友達追加不要・シンプル方式）
6. 参加者がLINEリッチメニューの「立替を登録」からLIFFフォームを開いて立替を入力
7. Webアプリで精算計算（最小精算方式）→ 誰が誰にいくら払うか表示
8. 幹事がWebで「リマインド送信」ボタンを押すと、Botが未払い者にメンション
9. 幹事がWebで各精算に「済」ボタンを押して完了管理

==========================================================
## 2. 技術スタック
==========================================================

- フロントエンド: React 18 + TypeScript + Vite
- スタイリング: Tailwind CSS v3（npm install、CDN不可）
- ルーティング: React Router v6
- バックエンド: Supabase（PostgreSQL + Auth + Edge Functions）
- 認証: LINE Login OAuth 2.0（Supabase Auth カスタムプロバイダー）
- LINE連携: LINE Messaging API（Bot） + LIFF（立替登録フォーム）
- デプロイ: GitHub Pages（Vite の base 設定で対応）

==========================================================
## 3. デザイン仕様
==========================================================

### カラーパレット（CSS変数として定義）
```css
:root {
  --green: #22C55E;
  --green-dark: #16A34A;
  --green-light: #F0FDF4;
  --text: #1A1A1A;
  --sub: #6B7280;
  --border: #E5E7EB;
  --gray-bg: #F3F4F6;
  --white: #FFFFFF;
}
```

### フォント（index.htmlのheadに追加）
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&family=Noto+Sans+JP:wght@400;500;600;700;800&display=swap" rel="stylesheet">
```

CSS:
```css
body {
  font-family: 'Noto Sans JP', sans-serif;
}
.inter {
  font-family: 'Inter', sans-serif;
}
```

### UIスタイル
- スマホファースト（コンテンツ最大幅: 480px、中央寄せ）
- 角丸: 12px〜16px
- カードシャドウ: 0 2px 12px rgba(0,0,0,0.08)
- ボタンホバー: translateY(-1px) + shadow強化
- トランジション: all 0.2s ease
- プライマリボタン: bg #22C55E, text white, hover #16A34A
- LINEボタン: bg #06C755, text white

==========================================================
## 4. ファイル構成
==========================================================

```
kanji/
├── index.html
├── vite.config.ts
├── tailwind.config.js
├── postcss.config.js
├── tsconfig.json
├── package.json
├── .env.local              ← gitignore対象
├── .gitignore
├── .github/
│   └── workflows/
│       └── deploy.yml
└── src/
    ├── main.tsx
    ├── App.tsx
    ├── index.css
    ├── lib/
    │   ├── supabase.ts         # Supabaseクライアント初期化
    │   ├── lineAuth.ts         # LINEログイン・ログアウト
    │   ├── lineApi.ts          # LINE Messaging API呼び出し
    │   └── settlement.ts       # 精算計算ロジック（最小精算方式）
    ├── hooks/
    │   ├── useAuth.ts          # 認証状態管理（Supabase Auth）
    │   └── useEvent.ts         # イベントCRUD hooks
    ├── components/
    │   ├── Layout.tsx          # 共通レイアウト（ヘッダー付き）
    │   ├── LineLoginButton.tsx # LINEログインボタン
    │   ├── ParticipantCard.tsx # 参加者カード
    │   ├── ExpenseCard.tsx     # 立替カード
    │   └── SettlementCard.tsx  # 精算カード
    └── pages/
        ├── Home.tsx            # ランディングページ
        ├── Dashboard.tsx       # ダッシュボード（幹事用）
        ├── EventCreate.tsx     # イベント作成
        ├── EventManage.tsx     # イベント管理（幹事用）
        └── ExpenseForm.tsx     # 立替登録フォーム（LIFF用）
```

==========================================================
## 5. データベーススキーマ（Supabase）
==========================================================

以下のSQLをSupabase SQL Editorで実行してください。

```sql
-- ユーザーテーブル（Supabase Authと連携）
create table public.users (
  id uuid references auth.users primary key,
  line_user_id text unique,
  display_name text not null,
  avatar_url text,
  created_at timestamptz default now()
);
alter table public.users enable row level security;
create policy "users_select_own" on public.users for select using (auth.uid() = id);
create policy "users_update_own" on public.users for update using (auth.uid() = id);
create policy "users_insert_own" on public.users for insert with check (auth.uid() = id);

-- イベントテーブル
create table public.events (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null default substr(md5(random()::text), 1, 8),
  host_id uuid references public.users(id) on delete cascade not null,
  title text not null,
  venue_name text,
  venue_address text,
  event_date text,
  memo text,
  line_group_id text,           -- LINEグループID（Bot追加後に紐付け）
  created_at timestamptz default now()
);
alter table public.events enable row level security;
create policy "events_host_all" on public.events for all using (auth.uid() = host_id);
create policy "events_public_read" on public.events for select using (true);

-- 参加者テーブル（幹事がWebで手入力）
create table public.participants (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events(id) on delete cascade not null,
  display_name text not null,   -- 幹事が入力した名前
  line_user_id text,            -- LINEユーザーID（任意・後から紐付け可）
  avatar_color text default '#22C55E',  -- アバターの背景色
  created_at timestamptz default now()
);
alter table public.participants enable row level security;
create policy "participants_public_read" on public.participants for select using (true);
create policy "participants_host_all" on public.participants for all using (
  exists (select 1 from public.events where id = event_id and host_id = auth.uid())
);
create policy "participants_insert_liff" on public.participants for insert with check (true);

-- 立替テーブル
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events(id) on delete cascade not null,
  payer_name text not null,           -- 立替した人の名前
  payer_line_user_id text,            -- 立替した人のLINE ID（LIFF経由の場合）
  description text not null,          -- 何を立替したか（例: 居酒屋代）
  total_amount integer not null,      -- 合計金額（円）
  created_at timestamptz default now()
);
alter table public.expenses enable row level security;
create policy "expenses_public_read" on public.expenses for select using (true);
create policy "expenses_public_insert" on public.expenses for insert with check (true);
create policy "expenses_host_delete" on public.expenses for delete using (
  exists (select 1 from public.events where id = event_id and host_id = auth.uid())
);

-- 立替対象者テーブル（誰の分を立替したか・金額按分）
create table public.expense_targets (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid references public.expenses(id) on delete cascade not null,
  participant_id uuid references public.participants(id) on delete cascade not null,
  participant_name text not null,
  amount integer not null             -- この人の負担額（円）
);
alter table public.expense_targets enable row level security;
create policy "expense_targets_public_read" on public.expense_targets for select using (true);
create policy "expense_targets_public_insert" on public.expense_targets for insert with check (true);

-- 精算テーブル
create table public.settlements (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events(id) on delete cascade not null,
  from_participant_id uuid references public.participants(id) not null,
  from_name text not null,
  to_participant_id uuid references public.participants(id) not null,
  to_name text not null,
  amount integer not null,
  is_paid boolean default false,
  created_at timestamptz default now()
);
alter table public.settlements enable row level security;
create policy "settlements_public_read" on public.settlements for select using (true);
create policy "settlements_host_all" on public.settlements for all using (
  exists (select 1 from public.events where id = event_id and host_id = auth.uid())
);
```

==========================================================
## 6. 精算計算ロジック（src/lib/settlement.ts）
==========================================================

```typescript
export interface ParticipantBalance {
  participantId: string;
  name: string;
  balance: number; // プラス=受け取るべき金額、マイナス=支払うべき金額
}

export interface SettlementResult {
  fromId: string;
  fromName: string;
  toId: string;
  toName: string;
  amount: number;
}

/**
 * 最小精算方式
 * 各参加者の収支（立替した金額 - 立替してもらった金額）を計算し、
 * 最小回数の送金で全員の収支をゼロにする精算リストを返す
 */
export function calculateSettlements(
  participants: Array<{ id: string; display_name: string }>,
  expenses: Array<{
    payer_name: string;
    total_amount: number;
    targets: Array<{ participant_id: string; participant_name: string; amount: number }>;
  }>
): SettlementResult[] {
  // 参加者ごとの収支マップを初期化
  const balanceMap = new Map<string, ParticipantBalance>();
  for (const p of participants) {
    balanceMap.set(p.id, { participantId: p.id, name: p.display_name, balance: 0 });
  }

  // 立替データから収支を計算
  for (const expense of expenses) {
    for (const target of expense.targets) {
      const b = balanceMap.get(target.participant_id);
      if (b) {
        b.balance -= target.amount; // 立替してもらった分はマイナス
        balanceMap.set(target.participant_id, b);
      }
    }
    // 立替した人を名前で検索してプラスに
    for (const [id, b] of balanceMap.entries()) {
      if (b.name === expense.payer_name) {
        b.balance += expense.total_amount;
        balanceMap.set(id, b);
      }
    }
  }

  // 債権者（プラス）と債務者（マイナス）に分けてソート
  const creditors = Array.from(balanceMap.values())
    .filter(b => b.balance > 0.5)
    .sort((a, b) => b.balance - a.balance);
  const debtors = Array.from(balanceMap.values())
    .filter(b => b.balance < -0.5)
    .sort((a, b) => a.balance - b.balance);

  const results: SettlementResult[] = [];
  let i = 0, j = 0;

  while (i < creditors.length && j < debtors.length) {
    const amount = Math.min(creditors[i].balance, -debtors[j].balance);
    if (amount >= 1) {
      results.push({
        fromId: debtors[j].participantId,
        fromName: debtors[j].name,
        toId: creditors[i].participantId,
        toName: creditors[i].name,
        amount: Math.round(amount),
      });
    }
    creditors[i].balance -= amount;
    debtors[j].balance += amount;
    if (creditors[i].balance < 0.5) i++;
    if (debtors[j].balance > -0.5) j++;
  }

  return results;
}
```

==========================================================
## 7. 認証実装（src/lib/lineAuth.ts）
==========================================================

```typescript
import { supabase } from './supabase'

/** LINEログインを開始する */
export const signInWithLine = async () => {
  return supabase.auth.signInWithOAuth({
    provider: 'line' as any,
    options: {
      redirectTo: `${window.location.origin}/dashboard`,
      scopes: 'profile openid',
    },
  })
}

/** ログアウト */
export const signOut = async () => {
  await supabase.auth.signOut()
  window.location.href = '/'
}
```

```typescript
// src/hooks/useAuth.ts
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { User } from '@supabase/supabase-js'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  return { user, loading, isLoggedIn: !!user }
}
```

==========================================================
## 8. 画面仕様
==========================================================

### 8-1. ランディングページ（`/`）

ヘッダー（sticky）:
- 左: KANJIロゴ（緑テキスト、太字）
- 右: 「LINEでログイン」ボタン（#06C755）

ヒーローセクション:
- キャッチコピー（大見出し）: 「幹事の立替精算を、LINEで全部解決」
- サブコピー: 「グループLINEにBotを追加するだけ。立替登録から精算計算まで自動化。」
- CTA: 「LINEで無料で始める →」ボタン（緑、大）

機能紹介（3カラム、アイコン付き）:
- 📱 LINEで立替登録: リッチメニューからワンタップでフォームが開く
- 🧮 自動精算計算: 最小回数で「誰が誰にいくら払うか」を計算
- 🔔 リマインド送信: ボタン1つで未払い者にBotがメンション

フッター:
- © 2025 KANJI
- プライバシーポリシー / 利用規約（リンク、後で追加）

---

### 8-2. ダッシュボード（`/dashboard`）ログイン必須

ヘッダー:
- 左: KANJIロゴ
- 右: LINEアバター + 名前 + ログアウトボタン

コンテンツ:
- 「マイイベント」見出し
- 「+ 新しいイベントを作成」ボタン（緑、上部）
- イベントカード一覧（新しい順）:
  - イベント名（太字）
  - 日時・場所（サブテキスト）
  - 参加者数 / 立替件数 / 未精算合計額（バッジ形式）
  - 「管理する →」ボタン
- イベントが0件の場合: 空状態UI（「まずはイベントを作成しましょう」）

---

### 8-3. イベント作成（`/events/new`）ログイン必須

Step 1: イベント情報入力
フォームフィールド:
- イベント名（必須）: placeholder「例: 渋谷で忘年会」
- お店・場所の名前: placeholder「例: 個室居酒屋 鳥貴族 渋谷店」
- 住所・最寄り駅: placeholder「例: 渋谷駅 徒歩3分」
- 日時: placeholder「例: 2025年12月20日（土）19:00〜」
- 幹事からのメモ（任意）: placeholder「例: 2次会も考えてます！」
- 「イベントを作成する →」ボタン（緑）

Step 2: Bot追加・グループ連携
作成完了後に表示:
- 「イベントを作成しました！」完了メッセージ
- 手順説明カード:
  1. イベント専用のLINEグループを作成して参加者を招待
  2. 「KANJI Bot」をグループに追加（友達追加ボタン）
  3. Botを追加したら下のボタンを押してグループと連携
- 「このグループと紐付ける」ボタン（押すとWebhookでグループIDを取得・保存）
- 「後で設定する」リンク（スキップしてダッシュボードへ）

---

### 8-4. イベント管理（`/events/:id/manage`）ログイン必須

ページヘッダー:
- 「← ダッシュボードに戻る」リンク
- イベント名（大見出し）
- 日時・場所（サブテキスト）
- グループ連携状態バッジ（連携済み / 未連携）

タブ（3つ）: 「参加者」「立替一覧」「精算」

**タブ1: 参加者**

- 参加者カード一覧:
  - アバター（名前の頭文字 + 背景色）
  - 名前
  - 登録日時
- 「+ 参加者を追加」ボタン → インラインフォーム（名前入力 + 追加ボタン）
- 参加者カードに「削除」ボタン（確認ダイアログあり）

**タブ2: 立替一覧**

- 立替カード一覧（新しい順）:
  - 立替した人の名前（アバター付き）
  - 説明（例: 居酒屋代）
  - 金額（Inter フォント、緑色）
  - 対象者（例: 全員 / 田中・鈴木・佐藤）
  - 登録日時
  - 「削除」ボタン
- 「+ 立替を手動追加」ボタン → モーダルフォーム:
  - 立替した人（参加者リストからセレクト）
  - 何を（テキスト入力）
  - いくら（数値入力）
  - 誰の分を（参加者チェックボックス + 「全員」ボタン）
  - 按分方法: 均等割り（金額は自動計算）
  - 「登録する」ボタン
- 立替が0件の場合: 「まだ立替がありません。LINEのリッチメニューまたは上のボタンから追加できます。」

**タブ3: 精算**

- 「精算を計算する」ボタン（緑）
- 計算後、精算リスト表示:
  - 各精算カード: 「田中さん → 市原さん: ¥2,500」
  - 支払い済みバッジ / 未払いバッジ
  - 「済にする」ボタン（未払いのみ表示）
- 未払い精算がある場合: 「リマインドを送信」ボタン（LINE Messaging APIで未払い者にメンション）
- 全員精算済みの場合: 「🎉 全員の精算が完了しました！」

---

### 8-5. 立替登録フォーム（`/expense/new`）LIFF用

LIFFで開くスマホ最適化フォーム（ログイン不要、URLパラメータでevent_idを受け取る）:

```
/expense/new?event_id=xxxx
```

フォーム:
- 「立替を登録」見出し
- 立替した人の名前（テキスト入力）: placeholder「あなたの名前」
- 何を立替しましたか（テキスト入力）: placeholder「例: 居酒屋代、タクシー代」
- 金額（数値入力）: placeholder「0」、円表示
- 誰の分を立替しましたか（チェックボックス一覧）:
  - 「全員」ボタン（全選択/全解除トグル）
  - 各参加者のチェックボックス
- 按分金額プレビュー: 「選択中 3人 → 1人あたり ¥1,333」
- 「登録する」ボタン（緑）

登録完了画面:
- ✅ 完了アイコン（緑の丸にチェック）
- 「立替を登録しました！」
- 登録内容サマリー（誰が・何を・いくら・誰の分）
- 「もう一件登録する」ボタン
- 「閉じる」ボタン

==========================================================
## 9. LINE Bot Webhook（Supabase Edge Function）
==========================================================

`supabase/functions/line-webhook/index.ts` として作成:

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const LINE_CHANNEL_ACCESS_TOKEN = Deno.env.get('LINE_CHANNEL_ACCESS_TOKEN')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })

  const body = await req.json()

  for (const event of body.events ?? []) {
    const groupId = event.source?.groupId

    // Botがグループに追加されたとき
    if (event.type === 'join' && groupId) {
      // 最新の未連携イベントを取得してグループIDを保存
      // （幹事がWebで「このグループと紐付ける」ボタンを押すまで pending 状態）
      await replyMessage(event.replyToken, [{
        type: 'text',
        text: '👋 KANJIです！\nWebアプリで「このグループと紐付ける」ボタンを押してイベントと連携してください。\n\nhttps://[YOUR_GITHUB_PAGES_URL]/dashboard'
      }])
    }

    // 「精算を確認」メッセージ受信
    if (event.type === 'message' && event.message?.type === 'text') {
      const text = event.message.text.trim()

      if (text === '精算を確認' && groupId) {
        const { data: eventData } = await supabase
          .from('events')
          .select('id, title')
          .eq('line_group_id', groupId)
          .single()

        if (!eventData) {
          await replyMessage(event.replyToken, [{ type: 'text', text: 'イベントが見つかりません。Webアプリで連携を確認してください。' }])
          continue
        }

        // 精算結果をテキストで返信
        const settlementText = await getSettlementText(eventData.id, eventData.title)
        await replyMessage(event.replyToken, [{ type: 'text', text: settlementText }])
      }
    }
  }

  return new Response('OK', { status: 200 })
})

async function replyMessage(replyToken: string, messages: object[]) {
  await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({ replyToken, messages }),
  })
}

export async function pushMessage(to: string, messages: object[]) {
  await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({ to, messages }),
  })
}

async function getSettlementText(eventId: string, eventTitle: string): Promise<string> {
  const { data: settlements } = await supabase
    .from('settlements')
    .select('*')
    .eq('event_id', eventId)
    .eq('is_paid', false)

  if (!settlements || settlements.length === 0) {
    return `【${eventTitle}の精算】\n🎉 全員の精算が完了しています！`
  }

  const lines = settlements.map(s =>
    `${s.from_name} → ${s.to_name}: ¥${s.amount.toLocaleString()}`
  )
  return `【${eventTitle}の精算】\n${lines.join('\n')}\n\n詳細はWebアプリで確認できます。`
}
```

==========================================================
## 10. リマインド送信機能
==========================================================

幹事がWebで「リマインドを送信」ボタンを押したとき、以下のAPIを呼び出す:

```typescript
// src/lib/lineApi.ts
export async function sendReminder(
  groupId: string,
  unpaidSettlements: Array<{ fromName: string; toName: string; amount: number }>
) {
  // Supabase Edge Function経由でLINE Push Messageを送信
  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-reminder`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ groupId, unpaidSettlements }),
  })
  return response.ok
}
```

`supabase/functions/send-reminder/index.ts`:

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { pushMessage } from '../line-webhook/index.ts'

serve(async (req) => {
  const { groupId, unpaidSettlements } = await req.json()

  const lines = unpaidSettlements.map((s: any) =>
    `@${s.fromName} → ${s.toName}さんへ ¥${s.amount.toLocaleString()} をお支払いください`
  )

  const text = `💰 支払いリマインド\n\n${lines.join('\n')}\n\n支払い完了後は幹事に連絡してください。`

  await pushMessage(groupId, [{ type: 'text', text }])

  return new Response('OK', { status: 200 })
})
```

==========================================================
## 11. 環境変数
==========================================================

`.env.local`（gitignoreに追加すること）:
```
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_LIFF_ID=xxxxxxxxxx-xxxxxxxx
```

GitHub Secrets（CI/CDで使用）:
- VITE_SUPABASE_URL
- VITE_SUPABASE_ANON_KEY
- VITE_LIFF_ID

==========================================================
## 12. GitHub Pages デプロイ設定
==========================================================

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/kanji/',  // GitHubリポジトリ名に合わせて変更
  plugins: [react()],
  build: { outDir: 'dist' },
})
```

```yaml
# .github/workflows/deploy.yml
name: Deploy to GitHub Pages
on:
  push:
    branches: [main]
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: pages
  cancel-in-progress: false
jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run build
        env:
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
          VITE_LIFF_ID: ${{ secrets.VITE_LIFF_ID }}
      - uses: actions/configure-pages@v4
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist
      - id: deployment
        uses: actions/deploy-pages@v4
```

==========================================================
## 13. 実装の優先順位
==========================================================

以下の順番で実装してください。各ステップが動作することを確認してから次に進むこと。

**Phase 1: 基盤構築**
1. `npm create vite@latest kanji -- --template react-ts` でプロジェクト作成
2. Tailwind CSS v3、React Router v6、Supabase クライアントをインストール
3. `src/index.css` にCSS変数・グローバルスタイルを設定
4. `index.html` にGoogle Fontsを追加
5. `src/lib/supabase.ts` を作成（環境変数から初期化）

**Phase 2: 認証**
6. `src/lib/lineAuth.ts` と `src/hooks/useAuth.ts` を作成
7. `src/App.tsx` でルーティング設定（ログイン必須ルートの保護）
8. ランディングページ（`/`）を作成してLINEログインボタンを実装

**Phase 3: コア機能**
9. ダッシュボード（`/dashboard`）を作成
10. イベント作成ページ（`/events/new`）を作成
11. イベント管理ページ（`/events/:id/manage`）を作成（タブ3つ）
12. `src/lib/settlement.ts` の精算計算ロジックを実装

**Phase 4: LIFF・Bot**
13. 立替登録フォーム（`/expense/new`）をLIFF対応で作成
14. Supabase Edge Function（line-webhook）を作成・デプロイ
15. Supabase Edge Function（send-reminder）を作成・デプロイ

**Phase 5: デプロイ**
16. GitHub Actions の deploy.yml を作成
17. GitHub Pages の設定・動作確認

==========================================================
## 14. 重要な実装ポイント
==========================================================

- **React Router v6 の SPA対応**: GitHub Pages では 404.html に index.html をコピーして対応
- **アバターカラー**: 8色パレット `['#22C55E','#3B82F6','#F97316','#EF4444','#8B5CF6','#EC4899','#14B8A6','#F59E0B']` を名前の文字コードの合計 % 8 で決定
- **均等按分の端数処理**: 合計金額 ÷ 人数の余りは最初の参加者に加算
- **LIFF環境判定**: `liff.isInClient()` でLIFF内かどうかを判定
- **Supabase Auth コールバック**: `/auth/callback` ルートを追加してセッションを処理
- **グループ紐付けフロー**: Botがグループに参加したとき、直近の未連携イベント（host_idが現在のユーザー）のline_group_idを更新する。Webの「紐付けボタン」はこの処理をトリガーするAPIを呼ぶ
- **精算の再計算**: 立替が追加・削除されるたびにsettlementsテーブルを再生成する

まず Phase 1 から始めてください。
```

==========================================================
## 事前準備チェックリスト
==========================================================

ClaudeCodeで実装を始める前に以下を準備してください。

### Supabase（無料）
- [ ] [supabase.com](https://supabase.com) でアカウント作成・新規プロジェクト作成
- [ ] Project URL と anon key を取得（Settings > API）
- [ ] Authentication > Providers > LINE を有効化
  - Channel ID: `2009640755`
  - Channel Secret: Supabase Dashboardで入力
  - Callback URL: `{SUPABASE_URL}/auth/v1/callback`
- [ ] SQL Editorで上記スキーマSQLを実行

### LINE Developers（無料）
- [ ] LINEログインチャンネルのコールバックURLに `{SUPABASE_URL}/auth/v1/callback` を追加
- [ ] LIFFアプリを作成（LINEログインチャンネル > LIFF タブ）
  - エンドポイントURL: `https://{GitHubユーザー名}.github.io/kanji/expense/new`
  - サイズ: Full
  - Scope: profile, openid
- [ ] LIFF IDを取得（`xxxxxxxxxx-xxxxxxxx` 形式）
- [ ] LINE Official Account Manager でリッチメニューを設定
  - 左: 「立替を登録」→ LIFFのURL
  - 右: 「精算を確認」→ テキスト送信「精算を確認」
- [ ] LINE Messaging APIのWebhook URLを設定
  - URL: `{SUPABASE_URL}/functions/v1/line-webhook`

### GitHub（無料）
- [ ] 新規リポジトリ作成（名前: `kanji`）
- [ ] Settings > Pages > Source: GitHub Actions に設定
- [ ] Settings > Secrets and variables > Actions に以下を追加:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
  - `VITE_LIFF_ID`

==========================================================
## 完成後の公開URL
==========================================================

| 用途 | URL |
|------|-----|
| Webアプリ | `https://{GitHubユーザー名}.github.io/kanji/` |
| 立替フォーム（LIFF） | `https://liff.line.me/{LIFF_ID}` |
| Bot Webhook | `{SUPABASE_URL}/functions/v1/line-webhook` |
| リマインド送信 | `{SUPABASE_URL}/functions/v1/send-reminder` |
