# KANJI Phase 2 実装計画

- **バージョン**: v1.1
- **作成日**: 2026-04-28
- **ステータス**: Phase 2 実装の技術仕様基準ドキュメント
- **関連文書**:
  - `01_strategy.md`(戦略本体・KPI 定義・Gate 構造)
  - `03_privacy_policy.md`(Week 0 プライバシー基盤・同意 UI・削除運用)
  - `04_decision_log.md`(論点1〜6 の意思決定経緯)

---

## 1. 統合スキーマ変更(DDL すべて)

### 1.1 マイグレーション全体構成

Phase 2 のスキーマ変更は1本のマイグレーションファイルにまとめる。Supabase の migration 機構を使い、`supabase/migrations/20260428_phase2_kpi_foundation.sql` として配置する。

実行順序:

1. `users` テーブル拡張(プライバシー・解析ID用カラム追加)
2. `events` テーブル拡張(`completed_at` / `re_completed_at` / `host_was_participant`)
3. `invitations` テーブル新設(招待トラッキング第2層)
4. `growth_events` テーブル新設(イベントログ)
5. `growth_events_monthly_summary` テーブル新設(90日後の集約)
6. インデックス追加
7. RLS ポリシー追加・更新
8. 既存データへのバックフィル(`completed_at`)

### 1.2 DDL 全文

```sql
-- ============================================================
-- KANJI Phase 2: 計測基盤 + プライバシー対応
-- Migration: 20260428_phase2_kpi_foundation.sql
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. users テーブル拡張(プライバシー・解析ID)
-- ------------------------------------------------------------
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS privacy_consented_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS privacy_policy_version TEXT,
  ADD COLUMN IF NOT EXISTS analytics_id_hash TEXT,
  ADD COLUMN IF NOT EXISTS is_test_account BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN users.privacy_consented_at IS 'プライバシーポリシー同意日時';
COMMENT ON COLUMN users.privacy_policy_version IS '同意したポリシーのバージョン';
COMMENT ON COLUMN users.analytics_id_hash IS 'SHA256(line_user_id + SECRET_SALT) の先頭16文字。解析ツール送信用';
COMMENT ON COLUMN users.is_test_account IS '開発者本人・テスト用アカウント。集計から除外';

-- ------------------------------------------------------------
-- 2. events テーブル拡張(精算完了・幹事化追跡)
-- ------------------------------------------------------------
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS re_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS host_was_participant BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS originated_from_event_id UUID REFERENCES events(id) ON DELETE SET NULL;

COMMENT ON COLUMN events.completed_at IS '初めて全件精算完了した瞬間。一度記録されたら不変';
COMMENT ON COLUMN events.re_completed_at IS '再完了時の最新時刻(participants/advances 後追加で再構成された場合)';
COMMENT ON COLUMN events.host_was_participant IS '幹事が過去にKANJIで参加経験ありの場合 true';
COMMENT ON COLUMN events.originated_from_event_id IS '幹事化のきっかけとなった過去参加イベント';

-- ------------------------------------------------------------
-- 3. invitations テーブル新設(招待トラッキング第2層)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT UNIQUE NOT NULL,
  source_event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  source_host_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- 招待が消費された時の記録
  redeemed_event_id UUID REFERENCES events(id) ON DELETE SET NULL,
  redeemed_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  redeemed_at TIMESTAMPTZ,
  -- どの層で捕捉されたか
  redemption_layer TEXT CHECK (redemption_layer IN ('url_param', 'liff_state', 'local_storage', 'db_lookup'))
);

COMMENT ON TABLE invitations IS '招待トラッキング第2層。token は URL に埋め込む短縮ハッシュ';
COMMENT ON COLUMN invitations.token IS 'URL パラメータ ?inv=<token> として配布する短縮ID(8〜12文字推奨)';
COMMENT ON COLUMN invitations.redemption_layer IS 'どの捕捉経路で消費されたか。デバッグ・健全性チェック用';

-- ------------------------------------------------------------
-- 4. growth_events テーブル新設(イベントログ)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS growth_events (
  id BIGSERIAL PRIMARY KEY,
  event_type TEXT NOT NULL,
  host_user_id_hash TEXT,           -- analytics_id_hash 互換。生 user_id は入れない
  event_id UUID,                    -- KANJI イベント ID(該当する場合のみ)
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE growth_events IS 'Phase 2 のグロース計測ログ。生の個人情報は含めない';
COMMENT ON COLUMN growth_events.host_user_id_hash IS 'users.analytics_id_hash と一致するハッシュ値';
COMMENT ON COLUMN growth_events.payload IS 'JSONB。氏名・PayPay番号・金額・LINE userId 生値は禁止';

-- ------------------------------------------------------------
-- 5. growth_events_monthly_summary 新設(90日後の集約)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS growth_events_monthly_summary (
  month DATE NOT NULL,                -- 月初(JST 基準で DATE_TRUNC('month'))
  event_type TEXT NOT NULL,
  count BIGINT NOT NULL,
  unique_users INTEGER NOT NULL,
  PRIMARY KEY (month, event_type)
);

COMMENT ON TABLE growth_events_monthly_summary IS 'growth_events の90日経過分を月次に集約。元レコード削除後もトレンド分析可能';

-- ------------------------------------------------------------
-- 6. インデックス
-- ------------------------------------------------------------
-- MSH 集計用: completed_at が NULL でない行のみ
CREATE INDEX IF NOT EXISTS idx_events_completed_at_jst
  ON events ((completed_at AT TIME ZONE 'Asia/Tokyo'))
  WHERE completed_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_events_host_completed
  ON events (host_user_id, completed_at)
  WHERE completed_at IS NOT NULL;

-- 招待トラッキング検索用
CREATE INDEX IF NOT EXISTS idx_invitations_token ON invitations (token);
CREATE INDEX IF NOT EXISTS idx_invitations_source_event ON invitations (source_event_id);
CREATE INDEX IF NOT EXISTS idx_invitations_redeemed_user ON invitations (redeemed_user_id) WHERE redeemed_user_id IS NOT NULL;

-- 幹事化追跡用
CREATE INDEX IF NOT EXISTS idx_events_originated_from ON events (originated_from_event_id) WHERE originated_from_event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_events_host_was_participant ON events (host_was_participant) WHERE host_was_participant = true;

-- growth_events 集計用
CREATE INDEX IF NOT EXISTS idx_growth_events_type_time ON growth_events (event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_growth_events_user_hash ON growth_events (host_user_id_hash) WHERE host_user_id_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_growth_events_event_id ON growth_events (event_id) WHERE event_id IS NOT NULL;

-- 月次集約検索
CREATE INDEX IF NOT EXISTS idx_growth_summary_month ON growth_events_monthly_summary (month DESC);

-- ------------------------------------------------------------
-- 7. RLS ポリシー
-- ------------------------------------------------------------
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE growth_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE growth_events_monthly_summary ENABLE ROW LEVEL SECURITY;

-- invitations: 自分が発行したもの・自分が消費したものは読める。書き込みは Service Role 経由のみ
CREATE POLICY invitations_select_self
  ON invitations FOR SELECT
  USING (
    auth.uid() = source_host_user_id
    OR auth.uid() = redeemed_user_id
  );

CREATE POLICY invitations_insert_service
  ON invitations FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY invitations_update_service
  ON invitations FOR UPDATE
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- growth_events: クライアントから直接書き込み禁止。Service Role(Edge Function)のみ
CREATE POLICY growth_events_insert_service
  ON growth_events FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY growth_events_select_service
  ON growth_events FOR SELECT
  USING (auth.role() = 'service_role');

-- monthly_summary: 集計クエリ用に Service Role のみ
CREATE POLICY growth_summary_all_service
  ON growth_events_monthly_summary FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ------------------------------------------------------------
-- 8. 既存データへの completed_at バックフィル
-- ------------------------------------------------------------
-- archived 状態のイベントについて、updated_at を completed_at に転記して概算再構成
UPDATE events
SET completed_at = updated_at
WHERE status = 'archived'
  AND completed_at IS NULL
  AND EXISTS (
    SELECT 1 FROM participants p WHERE p.event_id = events.id
    GROUP BY p.event_id HAVING COUNT(*) >= 2
  )
  AND EXISTS (
    SELECT 1 FROM advances a WHERE a.event_id = events.id
  )
  AND EXISTS (
    SELECT 1 FROM settlements s WHERE s.event_id = events.id
  );

-- バックフィルしたレコードに注釈を残す(運用で識別できるよう metadata 列があれば付与、無ければスキップ)
-- 注: 過去データは「概算」として扱う。Gate 0 の合格判定には含めない

COMMIT;
```

### 1.3 ロールバック手順

問題が発生した場合の復旧 SQL を別ファイル `20260428_phase2_kpi_foundation_rollback.sql` に保管:

```sql
BEGIN;

DROP TABLE IF EXISTS growth_events_monthly_summary;
DROP TABLE IF EXISTS growth_events;
DROP TABLE IF EXISTS invitations;

ALTER TABLE events
  DROP COLUMN IF EXISTS originated_from_event_id,
  DROP COLUMN IF EXISTS host_was_participant,
  DROP COLUMN IF EXISTS re_completed_at,
  DROP COLUMN IF EXISTS completed_at;

ALTER TABLE users
  DROP COLUMN IF EXISTS is_test_account,
  DROP COLUMN IF EXISTS analytics_id_hash,
  DROP COLUMN IF EXISTS privacy_policy_version,
  DROP COLUMN IF EXISTS privacy_consented_at;

COMMIT;
```

⚠️ ロールバックすると `growth_events` のログが完全に失われる。**本番環境では rollback 前に `pg_dump` でテーブルダンプを取る**こと。

### 1.4 マイグレーション実行手順

ローカル検証 → ステージング → 本番の順:

1. **ローカル**: `supabase db reset` で空 DB に対して migration 適用、エラーないことを確認
2. **ステージング**: 本番のスナップショットを restore した上で `supabase db push`、バックフィル件数を SELECT で確認
3. **本番**:
   - `pg_dump` で全テーブルのバックアップ取得
   - メンテナンスモードに移行(イベント作成・精算操作を一時停止)
   - `supabase db push`
   - バックフィル件数確認: `SELECT COUNT(*) FROM events WHERE completed_at IS NOT NULL`
   - メンテナンスモード解除

---

## 2. 招待トラッキング3層構造の実装詳細

### 2.1 各層の役割

| 層 | 仕組み | 役割 | 信頼度 |
|---|---|---|---|
| 第1層 | URL パラメータ `?inv=<token>` | 即時性。LIFF が起動した瞬間に取得 | 高(改ざん検知あり) |
| 第2層 | `invitations` テーブル | 永続化。token と source の対応を保持 | 最高 |
| 第3層 | LIFF state / localStorage | フォールバック。第1・2層が欠けた場合の救済 | 中(消失リスクあり) |

### 2.2 フォールバック決定ロジック

参加者が招待リンク経由でイベントに参加した瞬間、以下の順序で招待元を決定する:

1. URL に `?inv=<token>` がある → `invitations` テーブルで検証 → `source_event_id` 取得
2. URL になければ LIFF の `state` パラメータを確認 → 同様に検証
3. どちらもなければ `localStorage.getItem('kanji_inv_token')` を確認 → 検証
4. すべて欠けていれば `redemption_layer = NULL`、ダイレクト流入として扱う

### 2.3 招待トークン発行フロー(幹事側)

幹事がイベント詳細画面で「LINE で共有」ボタンを押した瞬間、Edge Function が token を発行:

```typescript
// supabase/functions/create-invitation/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const { event_id, host_user_id } = await req.json();

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // token 生成: 12文字の英数字
  const token = crypto.randomUUID().replace(/-/g, "").slice(0, 12);

  const { data, error } = await supabase
    .from("invitations")
    .insert({
      token,
      source_event_id: event_id,
      source_host_user_id: host_user_id,
    })
    .select()
    .single();

  if (error) return new Response(JSON.stringify({ error }), { status: 500 });

  // growth_event 発火
  await supabase.from("growth_events").insert({
    event_type: "invitation_created",
    event_id,
    payload: { token_length: token.length },
  });

  return new Response(
    JSON.stringify({
      token,
      share_url: `https://kanji.app/e/${event_id}?inv=${token}`,
    }),
    { headers: { "Content-Type": "application/json" } },
  );
});
```

### 2.4 招待消費フロー(参加者側)

LIFF 起動時、3層を順に確認して招待元を解決し、`invitations.redeemed_*` カラムを更新する:

```typescript
// app/src/lib/invitation-resolver.ts
import liff from "@line/liff";
import { supabase } from "./supabase-client";

export type ResolvedInvitation = {
  token: string;
  source_event_id: string;
  layer: "url_param" | "liff_state" | "local_storage";
} | null;

export async function resolveInvitation(): Promise<ResolvedInvitation> {
  // 第1層: URL パラメータ
  const urlParams = new URLSearchParams(window.location.search);
  let token = urlParams.get("inv");
  let layer: ResolvedInvitation["layer"] = "url_param";

  // 第2層: LIFF state(LINE 経由起動時にプラットフォームが付与する場合あり)
  if (!token) {
    const liffState = liff.isLoggedIn() ? new URLSearchParams(liff.getContext()?.liffId || "") : null;
    token = liffState?.get("inv") ?? null;
    if (token) layer = "liff_state";
  }

  // 第3層: localStorage(過去訪問時に保存されたもの)
  if (!token) {
    token = localStorage.getItem("kanji_inv_token");
    if (token) layer = "local_storage";
  }

  if (!token) return null;

  // DB で検証
  const { data, error } = await supabase
    .from("invitations")
    .select("source_event_id, redeemed_at")
    .eq("token", token)
    .single();

  if (error || !data) return null;
  if (data.redeemed_at) {
    // 既に消費済み: 別ユーザーが先に使ったケース or 自分の再訪
    // 当人の再訪なら問題なし、別人なら無視
  }

  // 次回訪問のために localStorage に残す
  localStorage.setItem("kanji_inv_token", token);

  return { token, source_event_id: data.source_event_id, layer };
}

export async function redeemInvitation(
  token: string,
  redeemed_user_id: string,
  redeemed_event_id: string | null,
  layer: ResolvedInvitation["layer"],
) {
  await supabase
    .from("invitations")
    .update({
      redeemed_user_id,
      redeemed_event_id,
      redeemed_at: new Date().toISOString(),
      redemption_layer: layer,
    })
    .eq("token", token)
    .is("redeemed_at", null); // 二重消費防止
}
```

### 2.5 「参加者→幹事化」の捕捉ロジック

参加者が後日、自分でイベントを作成する瞬間に `host_was_participant` を判定する。

判定ルール:

- 新規イベント作成時、その作成ユーザーが過去に他のイベントの `participants` に登録されていれば `host_was_participant = true`
- さらに、過去参加イベントのうち最も新しいものを `originated_from_event_id` として記録

```sql
-- イベント作成時に呼ぶトリガーまたは Edge Function 内ロジック
WITH last_participation AS (
  SELECT p.event_id, p.created_at
  FROM participants p
  WHERE p.user_id = $new_host_user_id
    AND p.event_id != $new_event_id  -- 作成中イベント自身は除外
  ORDER BY p.created_at DESC
  LIMIT 1
)
UPDATE events
SET
  host_was_participant = (SELECT COUNT(*) FROM last_participation) > 0,
  originated_from_event_id = (SELECT event_id FROM last_participation)
WHERE id = $new_event_id;
```

招待 token 経由で参加した場合は、`invitations.redeemed_event_id` も `originated_from_event_id` の候補となる。優先順位:

1. `invitations.source_event_id`(招待 token 経由で来ていた場合)
2. 直近の `participants` レコードから判定

---

## 3. 集計クエリ集

すべて Supabase(PostgreSQL 14+)前提。Asia/Tokyo タイムゾーン変換、テストアカウント除外を組み込む。

### 3.1 MSH 月次

```sql
-- 月間 精算完了幹事数(MSH)
WITH eligible_events AS (
  SELECT
    e.id AS event_id,
    e.host_user_id,
    DATE_TRUNC('month', e.completed_at AT TIME ZONE 'Asia/Tokyo')::DATE AS month_jst
  FROM events e
  WHERE e.completed_at IS NOT NULL
    -- 対象イベント条件: 参加者2人以上
    AND (SELECT COUNT(*) FROM participants p WHERE p.event_id = e.id) >= 2
    -- 立替1件以上
    AND EXISTS (SELECT 1 FROM advances a WHERE a.event_id = e.id)
    -- settlement 1件以上、かつすべて精算済み
    AND EXISTS (SELECT 1 FROM settlements s WHERE s.event_id = e.id)
    AND NOT EXISTS (SELECT 1 FROM settlements s WHERE s.event_id = e.id AND s.is_settled = false)
    -- テストアカウント除外
    AND e.host_user_id NOT IN (SELECT id FROM users WHERE is_test_account = true)
)
SELECT
  month_jst,
  COUNT(DISTINCT host_user_id) AS msh
FROM eligible_events
GROUP BY month_jst
ORDER BY month_jst DESC;
```

### 3.2 週次4週移動 MSH

```sql
WITH eligible_events AS (
  SELECT
    e.host_user_id,
    DATE_TRUNC('week', e.completed_at AT TIME ZONE 'Asia/Tokyo')::DATE AS week_jst
  FROM events e
  WHERE e.completed_at IS NOT NULL
    AND (SELECT COUNT(*) FROM participants p WHERE p.event_id = e.id) >= 2
    AND EXISTS (SELECT 1 FROM advances a WHERE a.event_id = e.id)
    AND EXISTS (SELECT 1 FROM settlements s WHERE s.event_id = e.id)
    AND NOT EXISTS (SELECT 1 FROM settlements s WHERE s.event_id = e.id AND s.is_settled = false)
    AND e.host_user_id NOT IN (SELECT id FROM users WHERE is_test_account = true)
),
weekly AS (
  SELECT week_jst, COUNT(DISTINCT host_user_id) AS msh_week
  FROM eligible_events
  GROUP BY week_jst
)
SELECT
  week_jst,
  msh_week,
  SUM(msh_week) OVER (ORDER BY week_jst ROWS BETWEEN 3 PRECEDING AND CURRENT ROW) AS msh_4w_rolling
FROM weekly
ORDER BY week_jst DESC;
```

### 3.3 再利用幹事率(30日 / 60日)

```sql
-- 30日窓: 直近30日の MSH のうち、その前30日にも MSH に入っていた幹事の割合
WITH eligible_completions AS (
  SELECT
    e.host_user_id,
    e.completed_at AT TIME ZONE 'Asia/Tokyo' AS completed_jst
  FROM events e
  WHERE e.completed_at IS NOT NULL
    AND (SELECT COUNT(*) FROM participants p WHERE p.event_id = e.id) >= 2
    AND EXISTS (SELECT 1 FROM advances a WHERE a.event_id = e.id)
    AND EXISTS (SELECT 1 FROM settlements s WHERE s.event_id = e.id)
    AND NOT EXISTS (SELECT 1 FROM settlements s WHERE s.event_id = e.id AND s.is_settled = false)
    AND e.host_user_id NOT IN (SELECT id FROM users WHERE is_test_account = true)
),
recent_hosts AS (
  SELECT DISTINCT host_user_id
  FROM eligible_completions
  WHERE completed_jst >= NOW() - INTERVAL '30 days'
),
prior_hosts AS (
  SELECT DISTINCT host_user_id
  FROM eligible_completions
  WHERE completed_jst >= NOW() - INTERVAL '60 days'
    AND completed_jst < NOW() - INTERVAL '30 days'
)
SELECT
  '30日' AS window_label,
  (SELECT COUNT(*) FROM recent_hosts) AS recent_count,
  (SELECT COUNT(*) FROM prior_hosts) AS prior_count,
  (SELECT COUNT(*) FROM recent_hosts r WHERE EXISTS (SELECT 1 FROM prior_hosts p WHERE p.host_user_id = r.host_user_id))::NUMERIC
    / NULLIF((SELECT COUNT(*) FROM prior_hosts), 0) AS retention_rate;
```

60日窓は同じ構造で `INTERVAL '60 days'` / `INTERVAL '120 days'` に置換。

### 3.4 K-factor(月次)

```sql
-- 1幹事が当月生んだ新規幹事の数
WITH source_events AS (
  -- 当月精算完了したイベント
  SELECT id, host_user_id, DATE_TRUNC('month', completed_at AT TIME ZONE 'Asia/Tokyo')::DATE AS month_jst
  FROM events
  WHERE completed_at IS NOT NULL
    AND host_user_id NOT IN (SELECT id FROM users WHERE is_test_account = true)
),
spawned_hosts AS (
  -- そのイベントを起点として作られた新規幹事のイベント
  SELECT
    s.month_jst AS source_month,
    s.host_user_id AS source_host,
    e.host_user_id AS spawned_host
  FROM source_events s
  INNER JOIN events e ON e.originated_from_event_id = s.id
  WHERE e.host_user_id NOT IN (SELECT id FROM users WHERE is_test_account = true)
    AND e.host_user_id != s.host_user_id  -- 自分自身は除外
)
SELECT
  source_month,
  COUNT(DISTINCT source_host) AS active_hosts,
  COUNT(DISTINCT spawned_host) AS new_hosts_spawned,
  COUNT(DISTINCT spawned_host)::NUMERIC / NULLIF(COUNT(DISTINCT source_host), 0) AS k_factor
FROM spawned_hosts
GROUP BY source_month
ORDER BY source_month DESC;
```

### 3.5 初回精算完了率

```sql
-- イベントを作成した「初めての幹事」のうち、そのイベントを精算完了まで持っていけた割合
WITH first_events AS (
  SELECT DISTINCT ON (host_user_id)
    id AS event_id,
    host_user_id,
    created_at,
    completed_at
  FROM events
  WHERE host_user_id NOT IN (SELECT id FROM users WHERE is_test_account = true)
  ORDER BY host_user_id, created_at ASC
)
SELECT
  DATE_TRUNC('month', created_at AT TIME ZONE 'Asia/Tokyo')::DATE AS cohort_month,
  COUNT(*) AS first_time_hosts,
  COUNT(*) FILTER (WHERE completed_at IS NOT NULL) AS completed,
  COUNT(*) FILTER (WHERE completed_at IS NOT NULL)::NUMERIC / NULLIF(COUNT(*), 0) AS completion_rate
FROM first_events
GROUP BY cohort_month
ORDER BY cohort_month DESC;
```

### 3.6 新規幹事の参加経験率

```sql
-- 当月に初めて幹事になった人のうち、過去に参加経験がある(host_was_participant=true)割合
WITH first_events AS (
  SELECT DISTINCT ON (host_user_id)
    host_user_id,
    DATE_TRUNC('month', created_at AT TIME ZONE 'Asia/Tokyo')::DATE AS month_jst,
    host_was_participant
  FROM events
  WHERE host_user_id NOT IN (SELECT id FROM users WHERE is_test_account = true)
  ORDER BY host_user_id, created_at ASC
)
SELECT
  month_jst,
  COUNT(*) AS new_hosts,
  COUNT(*) FILTER (WHERE host_was_participant) AS from_participation,
  COUNT(*) FILTER (WHERE host_was_participant)::NUMERIC / NULLIF(COUNT(*), 0) AS participation_to_host_rate
FROM first_events
GROUP BY month_jst
ORDER BY month_jst DESC;
```

### 3.7 オーガニック流入比率

```sql
-- 新規幹事のうち、開発者本人(is_test_account=true)の知り合いではない経路から来た割合
-- 「知り合い経由」の定義: originated_from_event_id をたどって辿り着く源流幹事が is_test_account
WITH new_hosts AS (
  SELECT DISTINCT ON (host_user_id)
    host_user_id,
    originated_from_event_id,
    DATE_TRUNC('month', created_at AT TIME ZONE 'Asia/Tokyo')::DATE AS month_jst
  FROM events
  WHERE host_user_id NOT IN (SELECT id FROM users WHERE is_test_account = true)
  ORDER BY host_user_id, created_at ASC
),
traced AS (
  SELECT
    nh.month_jst,
    nh.host_user_id,
    -- originated 元の幹事が test_account なら知り合い経由
    EXISTS (
      SELECT 1 FROM events src
      JOIN users u ON u.id = src.host_user_id
      WHERE src.id = nh.originated_from_event_id
        AND u.is_test_account = true
    ) AS via_developer
  FROM new_hosts nh
)
SELECT
  month_jst,
  COUNT(*) AS new_hosts,
  COUNT(*) FILTER (WHERE NOT via_developer) AS organic,
  COUNT(*) FILTER (WHERE NOT via_developer)::NUMERIC / NULLIF(COUNT(*), 0) AS organic_rate
FROM traced
GROUP BY month_jst
ORDER BY month_jst DESC;
```

---

## 4. growth_events ログの payload 設計ルール

### 4.1 含めて良い情報

| 項目 | 例 | 備考 |
|---|---|---|
| event_type | `"settlement_completed"` | 列挙値で管理 |
| host_user_id_hash | `"a3f9b2c1..."` | SHA256(line_user_id + SECRET_SALT) の先頭16文字 |
| event_id | UUID | KANJI イベント ID |
| timestamp | ISO 8601 | サーバー側で `NOW()` を採用 |
| 数値メタ | `participants_count: 4`, `advances_count: 3` | 集計に使う値 |
| カテゴリ識別子 | `category: "drinking"` | 既定値リスト内の文字列 |
| layer 情報 | `redemption_layer: "url_param"` | デバッグ用 |

### 4.2 含めてはいけない情報

| 項目 | 理由 |
|---|---|
| 氏名(`name`, `display_name`) | 個人特定情報 |
| LINE userId 生値 | プラットフォーム規約上、外部送信 NG |
| PayPay ID | 金融関連の連絡先 |
| 金額(`amount`, `total`) | 集計値以外で個別金額は不要 |
| メッセージ本文 | 私信の領域 |
| メールアドレス | 個人特定情報 |
| IP アドレス | アクセスログ側で別管理 |

### 4.3 analytics_id_hash の生成ロジック

`users.analytics_id_hash` は登録時に計算してテーブルに保存する。再計算しない(SALT が変わると突合できなくなるため)。

```typescript
// supabase/functions/_shared/analytics-id.ts
import { encode as encodeHex } from "https://deno.land/std@0.224.0/encoding/hex.ts";

export async function generateAnalyticsIdHash(
  lineUserId: string,
): Promise<string> {
  const salt = Deno.env.get("ANALYTICS_ID_SALT");
  if (!salt) throw new Error("ANALYTICS_ID_SALT not configured");

  const data = new TextEncoder().encode(lineUserId + salt);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashHex = new TextDecoder().decode(encodeHex(new Uint8Array(hashBuffer)));
  return hashHex.slice(0, 16);
}
```

`ANALYTICS_ID_SALT` は Supabase Vault または環境変数で管理し、ローテーションしない。漏洩時は新規 SALT で再ハッシュ → 旧ハッシュとの対応表を作成 → 段階的に置換、という運用になる(Phase 2 では発生想定なし)。

### 4.4 主要 event_type 一覧

| event_type | 発火タイミング | 主な payload |
|---|---|---|
| `event_created` | events INSERT 時 | `{ category, host_was_participant, originated_from_event_id }` |
| `participant_added` | participants INSERT 時 | `{ participants_count_after }` |
| `advance_registered` | advances INSERT 時 | `{ advances_count_after }` |
| `settlement_completed` | events.completed_at 記録時 | `{ participants_count, advances_count, settlements_count }` |
| `settlement_re_completed` | re_completed_at 更新時 | `{ delta_seconds_since_first }` |
| `invitation_created` | invitations INSERT 時 | `{ token_length }` |
| `invitation_clicked` | LIFF 起動時に invitation 解決成功 | `{ redemption_layer }` |
| `invitation_redeemed` | invitations.redeemed_at 更新時 | `{ redemption_layer }` |
| `bulk_settle_clicked` | 一括精算ボタン押下 | `{ pending_count }` |
| `reminder_sent_no_advance` | 24h リマインダー送信 | `{ hours_since_creation }` |
| `reminder_sent_no_settlement` | 48h リマインダー送信 | `{ hours_since_creation }` |
| `share_template_used` | LINE 共有テンプレ生成 | `{ template_version }` |
| `deep_link_advance_opened` | 立替入力 deep link 経由起動 | `{}` |

### 4.5 payload JSON スキーマ定義例

```json
{
  "settlement_completed": {
    "type": "object",
    "required": ["participants_count", "advances_count"],
    "properties": {
      "participants_count": { "type": "integer", "minimum": 2 },
      "advances_count": { "type": "integer", "minimum": 1 },
      "settlements_count": { "type": "integer", "minimum": 1 }
    },
    "additionalProperties": false
  },
  "invitation_redeemed": {
    "type": "object",
    "required": ["redemption_layer"],
    "properties": {
      "redemption_layer": {
        "type": "string",
        "enum": ["url_param", "liff_state", "local_storage", "db_lookup"]
      }
    },
    "additionalProperties": false
  }
}
```

スキーマ検証は Edge Function 側でランタイムチェックを推奨(Zod 等)。

### 4.6 90日後の月次集約 cron 仕様

Supabase Scheduled Functions(`pg_cron` 拡張)で毎月1日 03:00 JST に実行:

```sql
-- pg_cron で毎月1日 18:00 UTC (= 翌日 03:00 JST) に実行
SELECT cron.schedule(
  'aggregate_growth_events_monthly',
  '0 18 1 * *',
  $$
  -- 90日経過分を月次サマリーへ集約
  INSERT INTO growth_events_monthly_summary (month, event_type, count, unique_users)
  SELECT
    DATE_TRUNC('month', created_at AT TIME ZONE 'Asia/Tokyo')::DATE,
    event_type,
    COUNT(*),
    COUNT(DISTINCT host_user_id_hash)
  FROM growth_events
  WHERE created_at < NOW() - INTERVAL '90 days'
  GROUP BY 1, 2
  ON CONFLICT (month, event_type) DO UPDATE
    SET count = EXCLUDED.count, unique_users = EXCLUDED.unique_users;

  -- 集約済みの raw レコードを削除
  DELETE FROM growth_events
  WHERE created_at < NOW() - INTERVAL '90 days';
  $$
);
```

ジョブ失敗時の検知: Supabase Dashboard の Logs で `cron.job_run_details` を週次で確認。失敗が連続したら Slack 通知などを後追いで設定(Phase 2 では手動確認で十分)。

---

## 5. 優先施策 Top 5 の最小実装

### 5.1 Top 1: 一括精算完了ボタン

**ファイル配置**:
- UI: `app/src/features/settlement/components/BulkSettleButton.tsx`
- API: `supabase/functions/bulk-settle/index.ts`

**関数シグネチャ**:

```typescript
// UI 側
type BulkSettleButtonProps = {
  eventId: string;
  pendingCount: number;
  onCompleted: () => void;
};

// Edge Function
type BulkSettleRequest = { event_id: string };
type BulkSettleResponse = { settled_count: number; event_completed: boolean };
```

**最小実装(UI)**:

```typescript
// app/src/features/settlement/components/BulkSettleButton.tsx
import { useState } from "react";
import { supabase } from "@/lib/supabase-client";

export function BulkSettleButton({ eventId, pendingCount, onCompleted }: BulkSettleButtonProps) {
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);

  if (pendingCount === 0) return null;

  const handleConfirm = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("bulk-settle", {
        body: { event_id: eventId },
      });
      if (error) throw error;
      onCompleted();
    } finally {
      setLoading(false);
      setConfirming(false);
    }
  };

  if (confirming) {
    return (
      <div className="bulk-settle-confirm">
        <p>残り {pendingCount} 件を一括で精算完了にします。よろしいですか?</p>
        <button onClick={handleConfirm} disabled={loading}>はい、まとめて完了</button>
        <button onClick={() => setConfirming(false)} disabled={loading}>キャンセル</button>
      </div>
    );
  }

  return (
    <button onClick={() => setConfirming(true)} className="bulk-settle-btn">
      残り {pendingCount} 件をまとめて精算完了
    </button>
  );
}
```

**最小実装(Edge Function)**:

```typescript
// supabase/functions/bulk-settle/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const { event_id } = await req.json();
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // 1. 全 settlement を is_settled=true に
  const { data: pending } = await supabase
    .from("settlements")
    .select("id")
    .eq("event_id", event_id)
    .eq("is_settled", false);

  if (!pending || pending.length === 0) {
    return new Response(JSON.stringify({ settled_count: 0, event_completed: false }));
  }

  await supabase.from("settlements")
    .update({ is_settled: true })
    .eq("event_id", event_id)
    .eq("is_settled", false);

  // 2. completed_at を記録(IS NULL ガード必須)
  await supabase.rpc("mark_event_completed_if_eligible", { p_event_id: event_id });

  // 3. growth_event 発火
  await supabase.from("growth_events").insert({
    event_type: "bulk_settle_clicked",
    event_id,
    payload: { pending_count: pending.length },
  });

  return new Response(JSON.stringify({
    settled_count: pending.length,
    event_completed: true,
  }));
});
```

`mark_event_completed_if_eligible` は Section 1 の対象イベント条件をチェックする RPC 関数として別途定義。

### 5.2 Top 2: 立替未登録の自動リマインダー

**ファイル配置**:
- Edge Function: `supabase/functions/reminder-cron/index.ts`
- LINE クライアント: `supabase/functions/_shared/line-messaging.ts`

**実装(リマインダー cron 本体)**:

```typescript
// supabase/functions/reminder-cron/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendLineMessage } from "../_shared/line-messaging.ts";

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // 24h 後リマインダー対象: 作成から 24-26h、立替0件、completed_at 未記録、まだリマインド送ってない
  const { data: targets24h } = await supabase
    .from("events")
    .select("id, host_user_id, title, users!inner(line_user_id, reminder_opt_out)")
    .gte("created_at", new Date(Date.now() - 26 * 3600 * 1000).toISOString())
    .lte("created_at", new Date(Date.now() - 24 * 3600 * 1000).toISOString())
    .is("completed_at", null)
    .not("id", "in", `(${
      (await supabase.from("growth_events")
        .select("event_id")
        .eq("event_type", "reminder_sent_no_advance")).data?.map(r => r.event_id).join(",") ?? "''"
    })`);

  for (const event of targets24h ?? []) {
    if (event.users.reminder_opt_out) continue;

    // 立替が0件かチェック
    const { count } = await supabase
      .from("advances")
      .select("*", { count: "exact", head: true })
      .eq("event_id", event.id);

    if (count !== 0) continue;

    await sendLineMessage(event.users.line_user_id, {
      type: "text",
      text: `「${event.title}」の立替がまだ登録されていません。\nLINE グループで参加者に登録を呼びかけませんか?\n\nhttps://kanji.app/e/${event.id}`,
    });

    await supabase.from("growth_events").insert({
      event_type: "reminder_sent_no_advance",
      event_id: event.id,
      payload: { hours_since_creation: 24 },
    });
  }

  // 48h 後リマインダー(精算未完了向け)も同様のロジックで実装

  return new Response(JSON.stringify({ processed: targets24h?.length ?? 0 }));
});
```

**LINE Messaging API ラッパー**:

```typescript
// supabase/functions/_shared/line-messaging.ts
const LINE_API = "https://api.line.me/v2/bot/message/push";
const RATE_LIMIT_PER_MONTH = 1000; // フリー枠

export async function sendLineMessage(
  lineUserId: string,
  message: { type: "text"; text: string },
) {
  const token = Deno.env.get("LINE_CHANNEL_ACCESS_TOKEN");
  if (!token) throw new Error("LINE_CHANNEL_ACCESS_TOKEN not set");

  const res = await fetch(LINE_API, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ to: lineUserId, messages: [message] }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`LINE API error ${res.status}: ${body}`);
  }
}
```

**OFF 設定**: `users.reminder_opt_out BOOLEAN DEFAULT FALSE` カラムを `users` テーブルに別途追加(Phase 2 のスキーマ変更には未含。リマインダー実装時に追加)。設定画面でユーザーがトグル可能にする。

**cron 実行**: Supabase Scheduled Functions で毎時 0分に `reminder-cron` を呼び出す。

### 5.3 Top 3: 参加者ごとの立替ステータス可視化

**ファイル配置**: `app/src/features/event/components/ParticipantStatusList.tsx`

```typescript
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase-client";

type ParticipantStatus = {
  participant_id: string;
  name: string;
  has_advance: boolean;
  advance_count: number;
};

export function ParticipantStatusList({ eventId }: { eventId: string }) {
  const [statuses, setStatuses] = useState<ParticipantStatus[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.rpc("get_participant_advance_status", {
        p_event_id: eventId,
      });
      setStatuses(data ?? []);
    })();
  }, [eventId]);

  return (
    <ul className="participant-status-list">
      {statuses.map((s) => (
        <li key={s.participant_id} className={s.has_advance ? "registered" : "unregistered"}>
          <span>{s.name}</span>
          <span>{s.has_advance ? `立替 ${s.advance_count}件` : "立替未登録"}</span>
        </li>
      ))}
    </ul>
  );
}
```

対応 RPC:

```sql
CREATE OR REPLACE FUNCTION get_participant_advance_status(p_event_id UUID)
RETURNS TABLE (participant_id UUID, name TEXT, has_advance BOOLEAN, advance_count BIGINT)
LANGUAGE SQL STABLE AS $$
  SELECT
    p.id,
    p.name,
    EXISTS (SELECT 1 FROM advances a WHERE a.payer_participant_id = p.id) AS has_advance,
    (SELECT COUNT(*) FROM advances a WHERE a.payer_participant_id = p.id) AS advance_count
  FROM participants p
  WHERE p.event_id = p_event_id
  ORDER BY p.created_at;
$$;
```

### 5.4 Top 4: LINE 共有メッセージのテンプレ自動生成

**ファイル配置**: `app/src/features/event/utils/share-template.ts`

```typescript
export function generateShareMessage(event: {
  title: string;
  date: string;
  share_url: string;
}): string {
  return [
    `【${event.title}】の精算ページです`,
    `日付: ${event.date}`,
    ``,
    `立替がある人は登録してください:`,
    event.share_url,
  ].join("\n");
}

// 使用例
export async function shareToLine(eventId: string) {
  const event = await fetchEvent(eventId);
  const message = generateShareMessage(event);

  await liff.shareTargetPicker([{ type: "text", text: message }]);

  await supabase.from("growth_events").insert({
    event_type: "share_template_used",
    event_id: eventId,
    payload: { template_version: "v1" },
  });
}
```

### 5.5 Top 5: 立替入力 UI の deep link 化

招待リンクに `&action=add_advance` を付与し、LIFF 起動時にクエリを見て立替入力モーダルを自動オープン:

```typescript
// app/src/pages/event/[id].tsx の useEffect 内
useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  if (params.get("action") === "add_advance") {
    setAdvanceModalOpen(true);
    supabase.from("growth_events").insert({
      event_type: "deep_link_advance_opened",
      event_id: eventId,
      payload: {},
    });
  }
}, [eventId]);
```

---

## 6. Week 0 〜 Month 6 マスタープラン

### 6.1 Week 0: プライバシー基盤(実装着手前)

詳細は `03_privacy_policy.md` 参照。実装計画側では関数シグネチャレベルで言及:

- `generateAnalyticsIdHash(lineUserId: string): Promise<string>` — Section 4.3 参照
- `recordPrivacyConsent(userId: string, version: string): Promise<void>` — `users.privacy_consented_at` 更新
- `anonymizeUserData(userId: string): Promise<void>` — 削除依頼処理(本文は `03_privacy_policy.md`)

**Week 0 完了チェックリスト**:

- [ ] プライバシーポリシー本文公開
- [ ] 利用規約公開
- [ ] オンボーディング同意 UI 実装
- [ ] `users.privacy_consented_at` / `analytics_id_hash` カラム追加(本マイグレーションに含む)
- [ ] `generateAnalyticsIdHash` 関数の実装と単体テスト
- [ ] 削除依頼受付メールアドレス公開

### 6.2 Week 1-2: スキーマ変更 + completed_at 記録ロジック + 集計クエリ整備

**Week 1**:

- [ ] マイグレーション `20260428_phase2_kpi_foundation.sql` をローカルで適用、検証
- [ ] ステージング環境へ適用
- [ ] `mark_event_completed_if_eligible` RPC 実装(対象イベント条件チェック含む)
- [ ] settlement 更新トリガーまたは Edge Function 内で RPC を呼び出すロジック実装
- [ ] バックフィル SQL を本番で実行

**Week 2**:

- [ ] Section 3 の集計クエリを Supabase の SQL ビューとして登録
- [ ] ベースライン MSH のスナップショット取得(過去3ヶ月分の概算値)
- [ ] テストアカウント設定(`is_test_account = true` を開発者本人と知人アカウントに付与)
- [ ] 集計クエリの結果妥当性チェック(2件くらいテストイベントを作って手動確認)

### 6.3 Week 3-4: 招待トラッキング3層 + ベースライン MSH 取得 → Gate 0

**Week 3**:

- [ ] `create-invitation` Edge Function 実装
- [ ] `invitation-resolver.ts` クライアント実装
- [ ] `redeemInvitation` ロジック実装
- [ ] 招待 token 経由の参加フロー E2E テスト

**Week 4**:

- [ ] `host_was_participant` 判定ロジックを events INSERT 時に組み込み
- [ ] `originated_from_event_id` 自動設定ロジック実装
- [ ] growth_events ログのスキーマ検証(Zod 等で payload validate)
- [ ] **Gate 0 通過判定**: チェックリスト全項目 ✅

### 6.4 Month 2: 優先施策 Top 1 + Top 4 + 計測ログ整備

- **Week 5**: Top 1(一括精算完了ボタン)、Top 4(共有テンプレ)
- **Week 6**: 計測ログの追加(`bulk_settle_clicked`、`share_template_used`)、効果測定の準備
- **Week 7**: Top 2 着手(LINE Messaging API 連携、cron 設定)
- **Week 8**: Top 2 完成、24h/48h リマインダーが本番稼働

### 6.5 Month 3: 優先施策 Top 3 + Top 5 + Gate 1 判定

- **Week 9**: Top 3(参加者ごとの立替ステータス可視化)
- **Week 10**: Top 5(deep link 化)、必要に応じて
- **Week 11**: 効果測定、月次振り返り
- **Week 12**: **Gate 1 通過判定**: 定性サイン3つの観測状況確認

### 6.6 Month 4-6: 検証期 → Gate 2 判定

- **Month 4**:
  - 数値の3ヶ月移動平均トラッキング開始
  - 早期前倒し条項(MSH 50/月、再利用率40%、K-factor 0.3)を満たすか確認
  - 必要に応じて施策の追加実装
- **Month 5**:
  - 月次振り返り
  - Gate 2 達成状況の中間レビュー
- **Month 6**:
  - **Gate 2 通過判定**: 数値2つ AND 定性3つ
  - Phase 3 移行 / 延長 / ピボット / 撤退 の意思決定

### 6.7 各週末のチェックリスト共通項目

毎週金曜日に確認:

- [ ] 当週リリースした機能が本番で正常動作しているか
- [ ] growth_events ログが想定通り記録されているか(Supabase ダッシュボードで件数確認)
- [ ] エラーログに新規ログが出ていないか
- [ ] LINE Messaging API の月次送信数が枠内か
- [ ] 来週の優先タスクを月次プランから抜き出し

---

## 7. 実装リスク・落とし穴

### 7.1 マイグレーション失敗時の rollback 手順

1. **本番環境**: 適用前に必ず `pg_dump -h <host> -U postgres -F c -f backup_$(date +%Y%m%d).dump` でフルバックアップ
2. 失敗を検知したら、まず Supabase Dashboard で「Restore from backup」を最初に検討
3. 部分的に適用された場合は `20260428_phase2_kpi_foundation_rollback.sql` を実行
4. ロールバック後の状態確認:
   - `\d events` で新規カラムが消えていることを確認
   - `\dt` で `growth_events` `invitations` テーブルが消えていることを確認

### 7.2 LINE Messaging API レート制限対策

LINE Messaging API のフリー枠は月1,000通。リマインダー設計で以下を厳守:

- 1イベントあたり最大2回(24h + 48h)
- 月内の累計送信数を `growth_events` で集計可能にする
- 950通到達でアラート(将来的な実装)、1,000通到達で送信停止
- ユーザーが `reminder_opt_out = true` を設定した場合は送信スキップ

```sql
-- 月次送信数モニタリング
SELECT COUNT(*) AS monthly_reminders
FROM growth_events
WHERE event_type IN ('reminder_sent_no_advance', 'reminder_sent_no_settlement')
  AND created_at >= DATE_TRUNC('month', NOW());
```

### 7.3 RLS ポリシー漏れの検出方法

新規テーブル作成後、必ず以下のテストクエリで権限を確認:

```sql
-- 匿名ロールで growth_events に書き込めないことを確認
SET ROLE anon;
INSERT INTO growth_events (event_type, payload) VALUES ('test', '{}');
-- → ERROR: new row violates row-level security policy
RESET ROLE;

-- 認証済みロールでも自分以外の invitation を取得できないことを確認
SET ROLE authenticated;
SET request.jwt.claim.sub = '<other_user_uuid>';
SELECT * FROM invitations WHERE source_host_user_id = '<my_uuid>';
-- → 0 行
RESET ROLE;
```

CI で実行する単体テストとして組み込むのが理想。Phase 2 では手動検証で十分。

### 7.4 completed_at 上書きバグを防ぐ実装パターン

`mark_event_completed_if_eligible` RPC の実装で必ず以下のパターンを使う:

```sql
CREATE OR REPLACE FUNCTION mark_event_completed_if_eligible(p_event_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql AS $$
DECLARE
  v_eligible BOOLEAN;
  v_already_completed TIMESTAMPTZ;
BEGIN
  -- 既に completed_at が記録されているか確認
  SELECT completed_at INTO v_already_completed
  FROM events WHERE id = p_event_id;

  -- 対象イベント条件チェック
  SELECT
    (SELECT COUNT(*) FROM participants p WHERE p.event_id = p_event_id) >= 2
    AND EXISTS (SELECT 1 FROM advances a WHERE a.event_id = p_event_id)
    AND EXISTS (SELECT 1 FROM settlements s WHERE s.event_id = p_event_id)
    AND NOT EXISTS (SELECT 1 FROM settlements s WHERE s.event_id = p_event_id AND s.is_settled = false)
  INTO v_eligible;

  IF NOT v_eligible THEN
    RETURN FALSE;
  END IF;

  IF v_already_completed IS NULL THEN
    -- 初回完了
    UPDATE events
    SET completed_at = NOW()
    WHERE id = p_event_id AND completed_at IS NULL;  -- ガード必須
    RETURN TRUE;
  ELSE
    -- 再完了
    UPDATE events
    SET re_completed_at = NOW()
    WHERE id = p_event_id;
    RETURN FALSE;
  END IF;
END;
$$;
```

ポイント:

- `WHERE ... AND completed_at IS NULL` で並行更新時の上書きを防止
- 再完了は `re_completed_at` に書く(`completed_at` には触れない)
- 戻り値で初回完了かどうかを呼び出し側に伝える(growth_events の event_type 切り替え用)

### 7.5 タイムゾーンバグの検出方法

JST と UTC の境界月でテストケースを作る:

```sql
-- 6月30日 23:30 JST(= 6月30日 14:30 UTC)に完了したイベント → 6月の MSH に入るべき
INSERT INTO events (host_user_id, title, completed_at)
VALUES ('<test_uuid>', 'TZ test JST end', '2026-06-30 14:30:00+00');

-- 7月1日 00:30 JST(= 6月30日 15:30 UTC)に完了したイベント → 7月の MSH に入るべき
INSERT INTO events (host_user_id, title, completed_at)
VALUES ('<test_uuid>', 'TZ test JST start', '2026-06-30 15:30:00+00');

-- MSH クエリを実行して、それぞれが正しい月にカウントされることを確認
```

集計クエリで `DATE_TRUNC('month', completed_at AT TIME ZONE 'Asia/Tokyo')` を必ず使うこと。`AT TIME ZONE` を忘れると UTC 基準で月境界が判定されてバグる。

### 7.6 リマインダー疲れ防止

ユーザーがブロックしないよう以下を厳守:

- 1イベントあたり最大2通(24h + 48h)
- `users.reminder_opt_out = true` でグローバル OFF 可能
- リマインダー本文に「通知を停止する: <設定URL>」を必ず含める
- LINE 公式アカウントでブロックされた場合は `growth_events` に記録し、以後その user_id への送信を停止する仕組みを Phase 2 後半で検討

---

## 改訂履歴

| 日付 | バージョン | 内容 |
|---|---|---|
| 2026-04-28 | v1.0 | 初稿(`01_strategy.md` v1.0 と並行作成された案) |
| 2026-04-28 | v1.1 | 論点1〜6 統合反映、DDL・実装コード・cron 仕様確定版 |
