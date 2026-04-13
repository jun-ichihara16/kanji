# KANJI PayPay 送金UX設計

**更新日：** 2026年4月13日
**ステータス：** Phase 1a 実装待ち / Phase 1b 設計中

---

## 背景と課題

### 現在の送金フロー（改善前）

1. 送金者が KANJI の精算画面を開く
2. 「番号をコピー」タップ → PayPay番号だけクリップボードへ
3. 「PayPayで送金」タップ → `paypay://` でアプリ起動
4. PayPay内で相手検索（番号ペースト）
5. **金額を手入力** ← 入力ミス・面倒の温床
6. 確認 → 送金

### 技術制約

- PayPayの **個人間送金ディープリンクに金額パラメータを渡すAPIは存在しない**
- `paypay://` はアプリ起動のみ、`paypay.ne.jp` 配下のURLも個人向けは公式APIなし
- PayPay for Business API は法人加盟店限定

### 改善の方針

- 情報は **KANJI に集約**（番号・金額・送金状態）
- 共有メッセージは **最小限**（金額＋KANJIリンクのみ）
- PayPayアプリ側で手入力が必要になる箇所は **金額を明示して記憶負荷を減らす**
- 金額指定リンクを使う場合は **期限切れを自動リマインドでカバー**

---

## Phase 1a｜PayPay送金UX強化（Phase 1 内で実装）

### 対応するPayPay情報の種類

| 種類 | 期限 | 金額入力 | リマインド |
|------|------|----------|-----------|
| PayPay番号 | ∞ | 送金者が手入力 | 不要 |
| 受取リンク（金額指定なし・マイコード型） | ∞ | 送金者が手入力 | 不要 |

Phase 1a では上記2種類のみをサポート。金額指定ありリンクは Phase 1b で追加。

### UI/UX 改善

#### 1. 共有メッセージ（Web Share API）

精算行ごとに「共有」ボタンを追加。`navigator.share()` でOS標準のシェアシートを起動し、LINE等に即送信可能にする。

**送信メッセージ形式：**

```
▼Aさんへ ¥3,200
https://kanji-relief.com/e/xxx
```

- `paypay://` はLINEでタップ不可のため **含めない**
- PayPay番号・受取リンクも **含めない**（KANJIページに集約）
- Web Share API 非対応環境ではクリップボードコピーにフォールバック

#### 2. PayPay情報 未登録者への依頼導線

送金先の参加者がPayPay情報を登録していない場合、精算カードに注意書きと依頼ボタンを表示：

```
⚠ PayPay情報が未登録です
ご本人に以下のいずれかを依頼してください：
・PayPay番号の共有
・PayPay受取リンクの発行・共有

[◯◯さんに依頼する] ← Web Share API で送信
```

**依頼メッセージ形式：**

```
◯◯さんへKANJI経由でPayPay送金したいので、
PayPay番号または受取リンクの登録をお願いします
https://kanji-relief.com/e/xxx/join
```

#### 3. 参加者登録フォーム

PayPayを選択した場合、**電話番号 または 受取リンク のどちらかを登録可**とする。

**実装方針：2フィールド方式**

- `paypay_phone` （従来）
- `paypay_link_url` （新規）
- どちらか一方の登録でOK。両方登録も可。
- UI上はラベルで「PayPay番号」「PayPay受取リンク（任意）」と明示

#### 4. 精算時の表示分岐

| 登録内容 | 表示するボタン |
|---------|--------------|
| 番号のみ | 「番号をコピー」＋「PayPayで送金」 |
| リンクのみ | 「リンクで送金」（タップでリンク起動） |
| 両方 | どちらかを選択可（リンク優先） |
| 未登録 | 依頼ボタンのみ |

### DBマイグレーション（Phase 1a）

```sql
ALTER TABLE participants
  ADD COLUMN paypay_link_url TEXT,
  ADD COLUMN paypay_link_type TEXT CHECK (paypay_link_type IN ('amount_free'));
```

※`paypay_link_type` は Phase 1b で `amount_fixed` を追加予定のため、CHECK制約で拡張可能にしておく。

---

## Phase 1b｜金額指定リンク + 自動リマインド（Phase 2 と同時期）

### 対応するPayPay情報の種類（Phase 1b 追加分）

| 種類 | 期限 | 金額入力 | リマインド |
|------|------|----------|-----------|
| 受取リンク（金額指定あり） | **24時間** | 自動入力済み | **必要** |

### データモデル

金額指定リンクは **settlementごとに異なる金額・URL** が必要になるため、`participants` ではなく **`settlement_paypay_links`** 新規テーブルで管理する。

```sql
CREATE TABLE settlement_paypay_links (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_id   UUID NOT NULL REFERENCES settlements(id) ON DELETE CASCADE,
  url             TEXT NOT NULL,
  amount          INTEGER NOT NULL,
  issued_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at      TIMESTAMPTZ NOT NULL,  -- issued_at + 24h
  reminded_12h    BOOLEAN NOT NULL DEFAULT FALSE,
  reminded_4h     BOOLEAN NOT NULL DEFAULT FALSE,
  expired_notified BOOLEAN NOT NULL DEFAULT FALSE,
  used_at         TIMESTAMPTZ,  -- 送金者が送金完了を報告した時刻
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_paypay_links_expires ON settlement_paypay_links(expires_at)
  WHERE used_at IS NULL;
```

### リマインドフロー

```
T0      受取人がリンク発行・KANJIに登録
         ↓
T0+12h  送金者へLINE①「¥3,200のPayPayリンク、残り12時間です」
         ↓
T0+20h  送金者へLINE②「残り4時間です（最終通知）」
         ↓
T0+24h  期限切れ
         ├─ 受取人へLINE「リンクが期限切れ。再発行をお願いします」← 自動（方針a）
         └─ 送金者へLINE「受取人がリンク再発行中です」
```

### 期限切れ時の挙動：**方針a（自動）**

- 期限切れを検知した scheduled function が **受取人に自動でLINE再発行依頼を送る**
- 送金者アクションを必要としないため、送金者の心理的負担ゼロ
- 受取人が再発行後、KANJIで新URLを登録 → 送金者へ「新しいリンクが発行されました」通知

### 実装コンポーネント

| # | コンポーネント | 内容 |
|---|---|---|
| 1 | DBマイグレーション | `settlement_paypay_links` テーブル新規作成 |
| 2 | リンク登録UI | 受取人が settlement 行ごとに「リンクを発行して登録」 |
| 3 | 金額自動抽出（任意） | URLパラメータから金額を自動抽出して検証 |
| 4 | Supabase Scheduled Function | 1時間ごとに期限チェック → LINE通知 |
| 5 | LINE Bot 通知テンプレート | 12h前 / 4h前 / 期限切れ（受取人宛）/ 再発行完了（送金者宛）の4種 |
| 6 | KANJI UI バッジ | 各精算行に「リンク有効・残り◯時間」「期限切れ・再発行待ち」などを可視化 |

### Phase 2 インフラとの統合

- LINE Messaging API の自動配信基盤は **Phase 2 の「招待メッセージ一斉送信」「イベントリマインド自動化」** で構築
- Phase 1b のリマインドも同じインフラ（LINE Bot + Supabase Scheduled Function）を活用
- 結果的に **Phase 1b の追加実装コストは小さい**

---

## 成功指標

### Phase 1a（送金UX改善）

| 指標 | 目標値 |
|------|--------|
| PayPay送金時の「共有」ボタン利用率 | 40%以上（精算行ベース） |
| PayPay情報未登録者への「依頼」ボタン経由で登録完了する率 | 50%以上 |
| 参加者の「PayPay金額入力ミス」に関するCS問い合わせ | 月1件未満 |

### Phase 1b（金額指定リンク）

| 指標 | 目標値 |
|------|--------|
| 金額指定リンク発行件数 | 月30件以上 |
| リマインド経由での送金完了率 | 70%以上 |
| 期限切れ→再発行→送金完了までの平均リードタイム | 6時間以内 |

---

## 関連ドキュメント

- [ロードマップ](./kanji-roadmap.md) — Phase 1 / Phase 2 の全体像
- [LINE自動化設計](./kanji-line-automation-design.md) — LINE Messaging API の活用方針
- [収益プラン](./kanji-revenue-plan.md) — 成果報酬プランとの関係
