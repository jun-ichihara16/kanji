# Phase 2 v1.2 実行プラン — Manus すり合わせ結果の反映手順

> 作成日: 2026-05-19
> インプット: `docs/kanji_phase2_strategy_sync_execution_20260519.md`（Manus 出力）
> 関連: `docs/phase2/01_strategy.md` / `docs/phase2/04_decision_log.md`

---

## 0. Manus 出力の評価

| 軸 | 評価 |
|----|------|
| **事実精度** | ◎ インタビュー件数を「9件」と訂正、自前で実態を確認 |
| **戦略修正の論理** | ◎ North Star は据え置き + 補助指標で質を測る、の論理が筋通っている |
| **実装計画** | ◯ 10 ステップに分解、ファイルパス・SQL 具体性あり |
| **テキスト差分** | ◎ `01_strategy.md` / `04_decision_log.md` の diff まで用意済み |
| **ベスプラ参照** | ◯ Reforge / CRV / YC を脚注で参照 |

**そのまま実行に移してよいレベル**。ただし以下5点は事前に意思決定が必要。

---

## 1. 事前確認すべき5つの意思決定（Manus の ❓要確認）

| # | 論点 | 推奨 | 理由 |
|---|------|------|------|
| 1 | インタビュー9件で確定？追加3件あるか | **9件で確定**（レポートと整合） | レポート本体も9件明記、整理結果も9人ベース |
| 2 | v1.2 として `01_strategy.md` / `04_decision_log.md` 反映してよいか | **OK で進める** | Manus 出力の品質が高く、現状仮説より精度が上 |
| 3 | 「自腹ゼロ」のUI設計をどうするか | **UI 追加は後段。まず measurement だけ追加** | 幹事に明示入力させると UX 阻害。growth_events に `host_absorb_confirmed` を予約だけしておく |
| 4 | 自動リマインドは参加者インタビュー前に実装しない方針でOK？ | **OK**（手動テンプレのみ）| 参加者視点ゼロのまま自動 Push は危険 |
| 5 | business-pm の Week 4 タスクを「催促レス設計」中心に並び替えてOK？ | **OK** | 新Top 5 に合わせて kt401〜kt406 を更新 |

---

## 2. 実行フェーズ（4フェーズ・約2週間）

### フェーズA: 戦略文書を v1.2 に反映（半日）

| # | タスク | 出力 |
|---|--------|------|
| A-1 | `docs/phase2/01_strategy.md` を v1.2 に更新 | Manus の diff をそのまま適用 |
| A-2 | `docs/phase2/04_decision_log.md` に §9 追記 | Manus の追記案そのまま |
| A-3 | `docs/phase2/README.md` の v 表記更新 | v1.2 リンク |
| **コミット粒度** | `docs: Phase 2戦略をインタビュー結果で v1.2 に更新` | 1コミット |

### フェーズB: business-pm のタスクボード並び替え（1-2h）

旧 Week 4（計測基盤一直線）→ 新 Week 4（催促レス + 計測基盤並走）に組み替え。

| 旧 kt401〜kt406 | 新 kt401〜kt408 |
|------------------|------------------|
| kt401 Migration 008 | kt401 Migration 008（completed_at + growth_events + invitations） |
| kt402 completed_at バックフィル | kt402 mark_event_completed_if_eligible RPC + settlement連携 |
| kt403 招待トラッキング | kt403 催促文面テンプレ + 手動コピーログ ←新規 |
| kt404 Admin MSH 表示 | kt404 未払い者一覧の幹事向け可視化 ←新規 |
| kt405 プライバシー + 同意UI | kt405 Admin に MSH + 補助指標表示 |
| kt406 FBレビュー Week 4 | kt406 招待トラッキング3層最小実装 |
|  | kt407 プライバシー追記 + 同意UI |
|  | kt408 追加3名ヒアリング（参加者のみ）←T-305 拡張 |

> business-pm 側を `npx prisma db seed` で反映する必要あり（別セッション or 手動）。

### フェーズC: 計測基盤 + 催促レス MVP（約1-2週間）

Manus の実装順序をそのまま採用。並列実行可能なものは並走させる。

**直列パス（依存あり）**
```
A-1: 戦略 v1.2 → C-1: Migration 008 設計 → C-2: DDL 適用
                                            ↓
                                            C-3: mark_completed RPC
                                            ↓
                                            C-4: settlement → RPC 呼び出し
                                            ↓
                                            C-5: Admin MSH 表示
```

**並列パス（独立）**
```
C-2 完了後並走:
- C-6: 催促文面テンプレ + manual_reminder_copied ログ（2-4h）
- C-7: 未払い者一覧の幹事向け可視化（2-3h）
- C-8: 招待トラッキング3層実装（1-2日）
```

| # | タスク | 所要 | 依存 | コミット |
|---|--------|------|------|---------|
| C-1 | Migration 008 設計確定 | 2-3h | A-1 | (作業のみ) |
| C-2 | DDL 適用（events.completed_at / re_completed_at / host_was_participant / growth_events / invitations）| 1-2h | C-1 | `feat: Phase 2 計測基盤のDBマイグレーション追加` |
| C-3 | `mark_event_completed_if_eligible` RPC 実装 | 3-5h | C-2 | (C-4 と統合) |
| C-4 | settlement 更新箇所から RPC 呼び出し（EventManage / GuestJoin） | 3-5h | C-3 | `feat: 精算完了時にcompleted_atを記録` |
| C-5 | MSH / 再利用 / 初回完了率 + 補助4指標を Admin に表示 | 4-6h | C-4 | `feat: AdminにMSHと補助指標を表示` |
| C-6 | 催促文面テンプレ + コピーログ | 2-4h | C-2 | `feat: 催促文面テンプレと利用ログを追加` |
| C-7 | 未払い者一覧の幹事向け可視化 | 2-3h | C-2 | `feat: 未払い者一覧を幹事ダッシュボードに表示` |
| C-8 | 招待トラッキング3層の最小実装 | 1-2日 | C-2 | `feat: 招待トラッキングの最小実装` |
| C-9 | 過去データのバックフィル + 「概算」注記 | 2-3h | C-4 | `chore: completed_at のバックフィルと概算注記` |

合計: 約 25-40 時間（個人開発で2週間想定）

### フェーズD: ヒアリング並走（実装と並行）

| # | タスク | 担当 | 期限 |
|---|--------|------|------|
| D-1 | 追加3名（参加者のみ）のリクルート | 市原 | フェーズC 進行中 |
| D-2 | 既存KANJI 実利用者2名へのフォロー | 市原 | フェーズC 完了前 |
| D-3 | warica利用者など離脱者2名（可能なら） | 市原 | フェーズC 完了前 |
| D-4 | 結果整理 → `docs/KANJI_インタビュー整理レポート_v2.md` | 市原 | フェーズC 完了時 |

聞くべき最優先質問（Manus 出力より）:
- リマインド自動受信が助かるか／不快か
- 催促を送らず自腹にした経験は直近1年で何回
- 支払い済み/未払いの可視化への反応
- LINE 公式アカウント登録での離脱可能性
- 自分が幹事をやるなら何が不安か

---

## 3. SQL DDL の確定版（C-2 で適用）

Manus の提案＋既存の `02_implementation_plan.md` と整合させた最終版：

```sql
-- 008_phase2_kpi_foundation.sql

-- events への計測カラム追加
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS re_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS host_was_participant BOOLEAN DEFAULT FALSE;

-- 招待 → 参加リンクの正規データ
CREATE TABLE IF NOT EXISTS invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  invited_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  token TEXT UNIQUE NOT NULL,
  redeemed_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  redeemed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_invitations_source_event_id ON invitations(source_event_id);
CREATE INDEX IF NOT EXISTS idx_invitations_redeemed_by ON invitations(redeemed_by_user_id);

-- 行動ログ（イベント完了・催促・支払い等）
CREATE TABLE IF NOT EXISTS growth_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  event_id UUID REFERENCES events(id) ON DELETE SET NULL,
  payload JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_growth_events_type_created ON growth_events(event_type, created_at);
CREATE INDEX IF NOT EXISTS idx_growth_events_user ON growth_events(user_id);

-- 精算完了 RPC（重複計上回避 + re_completed_at 対応）
CREATE OR REPLACE FUNCTION mark_event_completed_if_eligible(p_event_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  v_total INT;
  v_settled INT;
  v_host UUID;
  v_existing_completed TIMESTAMPTZ;
BEGIN
  SELECT host_id, completed_at INTO v_host, v_existing_completed
    FROM events WHERE id = p_event_id;

  SELECT COUNT(*), COUNT(*) FILTER (WHERE is_settled)
    INTO v_total, v_settled FROM settlements WHERE event_id = p_event_id;

  IF v_total = 0 OR v_settled < v_total THEN
    RETURN FALSE;
  END IF;

  IF v_existing_completed IS NULL THEN
    UPDATE events SET completed_at = NOW() WHERE id = p_event_id;
    INSERT INTO growth_events(event_type, user_id, event_id)
      VALUES ('event_completed', v_host, p_event_id);
    -- 初回完了の判定
    IF NOT EXISTS (
      SELECT 1 FROM events
      WHERE host_id = v_host
        AND completed_at IS NOT NULL
        AND id != p_event_id
    ) THEN
      INSERT INTO growth_events(event_type, user_id, event_id)
        VALUES ('host_first_completion', v_host, p_event_id);
    END IF;
  ELSE
    UPDATE events SET re_completed_at = NOW() WHERE id = p_event_id;
  END IF;
  RETURN TRUE;
END $$;
```

> 既存 migration 番号と衝突しないか要確認（004 / 005 の重複が docs/phase2/01_strategy.md で言及あり）。

---

## 4. 計測する `growth_events.event_type` 一覧（C-2〜C-8 で順次計上）

| event_type | タイミング | 計上箇所 |
|------------|-----------|---------|
| `event_completed` | RPC で completed_at 初回記録時 | C-3 |
| `host_first_completion` | 上記のうち host にとって初の精算完了 | C-3 |
| `manual_reminder_copied` | 催促テンプレ「コピー」ボタン押下 | C-6 |
| `reminder_sent` | LINE 共有等の催促行動（保留：自動化前は手動扱い） | C-6 |
| `settlement_marked_paid` | 個別の「精算完了にする」 | C-4 |
| `bulk_settle_clicked` | 一括精算ボタン押下 | C-6/C-7 |
| `participant_joined` | 参加者追加時 | C-8 |
| `invite_token_redeemed` | 招待リンクからの参加成立 | C-8 |
| `host_absorb_confirmed` ※予約 | 「自腹で完了」UI 実装後 | 未実装 |

---

## 5. 旧 Phase 2 計画との差分まとめ

| 項目 | 旧（v1.1）| 新（v1.2）|
|------|----------|----------|
| North Star | MSH + 再利用幹事率 | **同じ** + 品質補助指標4種 |
| 優先 Top 5 #1 | 立替登録の谷を解消 | **催促レス設計**（新規最重要）|
| 優先 Top 5 #2 | 招待トラッキング | 立替登録の谷解消（2番手）|
| 優先 Top 5 #3 | 初回精算完了率向上 | **支払い状況/未集金ゼロの可視化** |
| 優先 Top 5 #4 | PayPay 磨き込み | 傾斜テンプレ/AI提案の実用化 |
| 優先 Top 5 #5 | 傾斜機能の使用率 | **後出し費用・ドタキャン対応** |
| ターゲット | 「20-30代 幹事」漠然 | **3セグメント明示**（Excel傾斜社会人 / 半プロ / ドライブ系）|
| やらないこと | 未明示 | **明示**（飲食店連携・ポイント・OCR・自動デポジット・自動Push）|

---

## 6. 次の実行ステップ（即着手）

1. ☐ **意思決定確認**（§1 の5論点）→ ユーザー回答待ち
2. ☐ **フェーズA 着手**（戦略文書 v1.2 反映）— 半日
3. ☐ **フェーズB 着手**（business-pm seed.ts 更新）— 1-2h
4. ☐ **フェーズC 着手**（C-1 設計確定から）— 1-2週間
5. ☐ **フェーズD 並行**（追加ヒアリング3名）— 実装と並走

---

## 7. リスクと注意点

- ⚠️ **migration 番号衝突**: 既存 004/005 と重複があると `02_implementation_plan.md` に言及あり。C-1 時に番号を確定する
- ⚠️ **既存 settlement テーブルとの整合**: `mark_event_completed_if_eligible` が既存の自動アーカイブ（status='archived'）ロジックと競合しないか確認
- ⚠️ **growth_events への過剰書き込み**: 短時間に大量に発生すると DB 負荷。インデックスと RLS を最初から考慮
- ⚠️ **プライバシー UI**: 同意 UI 実装（kt407）はインタビュー分析公開前に必須
- ⚠️ **9件 vs 12件の食い違い**: プロンプト時点で「12人」と書いた誤りは Manus 側で訂正済み。次回プロンプト時は「9件」で統一する

---

## 8. ❓最終確認

ユーザーへの確認事項：

1. **§1 の5論点すべて推奨案でOK？** → 全て OK ならフェーズA から即着手
2. フェーズC の **コミット粒度**（6コミット）でOK？
3. **C-1 着手のタイミング**（戦略反映後すぐ着手か、ヒアリング3名後か）
