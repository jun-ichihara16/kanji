# KANJI グロース設計 × データベース設計
## 幹事リスト構築 → 口コミ収集 → 有料ユーザー認定 → 先行招待

---

## 1. 全体の設計思想

### フェーズ設計

```
フェーズ1：幹事リスト構築（今）
  └ 公式LINE登録を促す仕組みを作る
  └ 口コミ・写真・レシートを投稿してもらう
  └ 投稿量で「有料ユーザー」認定

フェーズ2：店舗データベース構築（3〜6ヶ月）
  └ 幹事の口コミが蓄積されたら店舗ページが充実
  └ 飲食店への営業材料になる（「こんなデータがあります」）

フェーズ3：店舗提携開始（6ヶ月〜）
  └ 有料ユーザー（実績ある幹事）に先行案件を送る
  └ 成果報酬プランの本格稼働
```

---

## 2. 幹事の「有料ユーザー認定」設計

### 認定の条件（ポイント制）

幹事が以下のアクションを行うと**ポイント**が貯まり、一定ポイントで「認定幹事」になる。

| アクション | ポイント | 備考 |
|---|---|---|
| 公式LINE登録 | 10pt | 必須 |
| イベント作成（1件） | 5pt | |
| 参加者3人以上のイベント完了 | 10pt | 実績として有効 |
| 店舗の写真を投稿（1枚） | 5pt | 最大3枚/店舗 |
| 口コミ投稿（50文字以上） | 10pt | |
| レシート画像を投稿 | 15pt | 最も価値が高い |
| 人数・予算・エリアを記録 | 5pt | |

### 認定ランク

| ランク | 必要ポイント | 特典 |
|---|---|---|
| **一般幹事** | 0〜49pt | 基本機能のみ |
| **認定幹事** | 50〜149pt | 成果報酬案件の先行招待 |
| **プレミアム幹事** | 150pt〜 | 案件の優先割り当て・特別キャッシュバック率 |

### 認定幹事の特典（先行招待の仕組み）

```
店舗提携が始まったとき：

① KANJIが加盟店から案件を受付
   「渋谷で10名以上の飲み会幹事を5名募集」

② 認定幹事（渋谷エリア・10名以上実績あり）に
   LINEで先行通知

③ 一般幹事より先に案件を受け取れる
   → 認定幹事になるインセンティブが生まれる
```

---

## 3. 口コミ・店舗データの収集設計

### 収集するデータ

| データ種別 | 収集方法 | 用途 |
|---|---|---|
| **店舗名・エリア** | 幹事が入力 or レシートから自動抽出 | 店舗DBの基本情報 |
| **実際の人数** | イベントの参加者数から自動取得 | 「何名で利用可能か」の実績データ |
| **実際の飲食代** | レシート画像から抽出 | 「実際の予算感」として表示 |
| **店舗写真** | 幹事がLINEで投稿 | おすすめ店舗ページの掲載写真 |
| **口コミテキスト** | 幹事が投稿（50文字以上でポイント付与） | 幹事目線のリアルな評価 |
| **総合評価（星） ** | 5段階評価 | 店舗ランキングに使用 |
| **タグ** | 幹事が選択 | 「貸し切りOK」「個室あり」「駅近」など |

### 口コミの質を担保する仕組み

- **レシート投稿が必須**：口コミは「実際に行った証拠（レシート）」がある場合のみ高ポイント
- **写真付き口コミ**は通常の2倍ポイント
- 同一店舗への口コミは月1回まで（水増し防止）

---

## 4. データベース設計

### テーブル一覧

```
users（幹事ユーザー）
events（イベント）
participants（参加者）
expenses（立替え）
venues（店舗）
venue_reviews（店舗口コミ）
venue_photos（店舗写真）
user_points（ポイント履歴）
cashback_cases（キャッシュバック案件）
cashback_applications（案件申請）
```

---

### テーブル詳細設計

#### users（幹事ユーザー）

```sql
CREATE TABLE users (
  id              VARCHAR(36) PRIMARY KEY,  -- UUID
  line_user_id    VARCHAR(100) UNIQUE,       -- LINE UserID
  display_name    VARCHAR(100),              -- LINE表示名
  profile_image   TEXT,                      -- LINEプロフィール画像URL
  paypay_number   VARCHAR(20),               -- PayPay電話番号
  total_points    INT DEFAULT 0,             -- 累計ポイント
  rank            ENUM('general','certified','premium') DEFAULT 'general',
  area            VARCHAR(50),               -- 主な活動エリア（渋谷・新宿など）
  event_count     INT DEFAULT 0,             -- 完了イベント数
  created_at      BIGINT,                    -- UTC timestamp
  updated_at      BIGINT
);
```

#### venues（店舗）

```sql
CREATE TABLE venues (
  id              VARCHAR(36) PRIMARY KEY,
  name            VARCHAR(200) NOT NULL,     -- 店舗名
  area            VARCHAR(50),               -- エリア（渋谷・新宿など）
  address         TEXT,                      -- 住所
  category        VARCHAR(50),               -- 居酒屋・焼肉・個室など
  min_capacity    INT,                        -- 最小収容人数（口コミから集計）
  max_capacity    INT,                        -- 最大収容人数（口コミから集計）
  avg_budget      INT,                        -- 平均予算/人（レシートから集計）
  avg_rating      DECIMAL(2,1),              -- 平均評価（1.0〜5.0）
  review_count    INT DEFAULT 0,             -- 口コミ件数
  tags            JSON,                      -- ["貸し切りOK","個室あり","駅近"]
  is_partner      BOOLEAN DEFAULT FALSE,     -- 加盟店フラグ
  partner_plan    ENUM('none','listing','performance'), -- 契約プラン
  created_at      BIGINT,
  updated_at      BIGINT
);
```

#### venue_reviews（店舗口コミ）

```sql
CREATE TABLE venue_reviews (
  id              VARCHAR(36) PRIMARY KEY,
  venue_id        VARCHAR(36) REFERENCES venues(id),
  user_id         VARCHAR(36) REFERENCES users(id),
  event_id        VARCHAR(36) REFERENCES events(id),  -- 紐づくイベント
  rating          TINYINT,                            -- 1〜5
  comment         TEXT,                               -- 口コミ本文（50文字以上）
  actual_headcount INT,                               -- 実際の人数
  actual_budget   INT,                                -- 実際の一人当たり費用
  receipt_image   TEXT,                               -- レシート画像URL（S3）
  has_receipt     BOOLEAN DEFAULT FALSE,              -- レシート添付フラグ
  tags            JSON,                               -- 選択タグ
  points_awarded  INT DEFAULT 0,                      -- 付与ポイント
  created_at      BIGINT
);
```

#### venue_photos（店舗写真）

```sql
CREATE TABLE venue_photos (
  id              VARCHAR(36) PRIMARY KEY,
  venue_id        VARCHAR(36) REFERENCES venues(id),
  user_id         VARCHAR(36) REFERENCES users(id),
  image_url       TEXT NOT NULL,                      -- S3 URL
  caption         VARCHAR(200),
  points_awarded  INT DEFAULT 0,
  created_at      BIGINT
);
```

#### user_points（ポイント履歴）

```sql
CREATE TABLE user_points (
  id              VARCHAR(36) PRIMARY KEY,
  user_id         VARCHAR(36) REFERENCES users(id),
  action_type     ENUM(
    'line_register',      -- LINE登録
    'event_complete',     -- イベント完了
    'review_post',        -- 口コミ投稿
    'photo_post',         -- 写真投稿
    'receipt_post',       -- レシート投稿
    'headcount_record',   -- 人数記録
    'rank_up'             -- ランクアップボーナス
  ),
  points          INT,                                -- 付与ポイント
  reference_id    VARCHAR(36),                        -- 関連するID（review_id等）
  note            TEXT,
  created_at      BIGINT
);
```

#### cashback_cases（キャッシュバック案件）

```sql
CREATE TABLE cashback_cases (
  id              VARCHAR(36) PRIMARY KEY,
  venue_id        VARCHAR(36) REFERENCES venues(id),
  title           VARCHAR(200),                       -- 案件タイトル
  description     TEXT,                               -- 案件詳細
  target_area     VARCHAR(50),                        -- 対象エリア
  min_headcount   INT,                                -- 最小人数
  max_headcount   INT,                                -- 最大人数
  budget_min      INT,                                -- 予算下限（/人）
  budget_max      INT,                                -- 予算上限（/人）
  cashback_rate   DECIMAL(4,2) DEFAULT 10.00,        -- キャッシュバック率（%）
  slots           INT,                                -- 募集枠数
  filled_slots    INT DEFAULT 0,                      -- 埋まった枠数
  priority_rank   ENUM('premium','certified','all'),  -- 先行招待対象ランク
  status          ENUM('draft','active','closed'),
  valid_from      BIGINT,
  valid_until     BIGINT,
  created_at      BIGINT
);
```

#### cashback_applications（案件申請）

```sql
CREATE TABLE cashback_applications (
  id              VARCHAR(36) PRIMARY KEY,
  case_id         VARCHAR(36) REFERENCES cashback_cases(id),
  user_id         VARCHAR(36) REFERENCES users(id),
  event_id        VARCHAR(36) REFERENCES events(id),
  status          ENUM('applied','receipt_submitted','approved','paid','rejected'),
  receipt_image   TEXT,                               -- レシート画像URL
  actual_amount   INT,                                -- 実際の飲食代合計
  cashback_amount INT,                                -- キャッシュバック金額
  paypay_number   VARCHAR(20),                        -- 送金先PayPay番号
  paid_at         BIGINT,                             -- 送金完了日時
  note            TEXT,
  created_at      BIGINT,
  updated_at      BIGINT
);
```

---

## 5. ユーザー体験フロー（幹事視点）

### 初回登録〜認定幹事まで

```
① 公式LINEを友だち追加（+10pt）
   ↓
② KANJIアプリでイベント作成
   ↓
③ 飲み会実施
   ↓
④ 飲み会後にLINEで以下を送付：
   - レシート写真（+15pt）
   - 店舗の写真1〜3枚（+5pt × 枚数）
   - 口コミ（50文字以上）（+10pt）
   - 人数・予算を記録（+5pt）
   ↓
⑤ 1回の飲み会で最大50pt獲得
   ↓
⑥ 2回の飲み会で認定幹事（50pt）に到達
   ↓
⑦ 成果報酬案件の先行招待を受け取れるようになる
```

### 認定後の体験

```
KANJIからLINEで通知：
「【先行案件】渋谷の○○居酒屋から幹事募集！
  10名以上の飲み会で飲食代の10%をキャッシュバック。
  今月5名限定。先着順で受付中。
  → 申し込む」
```

---

## 6. 店舗データの活用イメージ

### おすすめ店舗ページ（アプリ内）

```
【おすすめ店舗】渋谷エリア

┌────────────────────────────────┐
│ ★4.3  ○○居酒屋 渋谷店           │
│ 実績：幹事15人が利用              │
│ 実際の人数：8〜25名               │
│ 実際の予算：3,500〜5,000円/人     │
│ タグ：[貸し切りOK][個室あり][駅近] │
│ 写真：[○][○][○]                 │
│ 口コミ：「幹事に優しい！事前に...」 │
│                    [予約する →]  │
└────────────────────────────────┘
```

### 飲食店への営業材料として

「KANJIには渋谷エリアで飲み会を開催した幹事○○人のデータがあります。
実際の人数・予算・口コミが蓄積されており、御社の集客に活用できます。」

→ 店舗提携の営業時に、データの存在が強力な説得材料になる。

---

## 7. 次のアクション（優先順）

| 優先度 | タスク | 内容 |
|---|---|---|
| ★★★ | DBスキーマ実装 | 上記テーブルをdrizzle/schema.tsに追加 |
| ★★★ | 公式LINE登録フロー | 登録でポイント付与・ランク管理 |
| ★★★ | 口コミ・写真・レシート投稿UI | イベント完了後に表示 |
| ★★★ | ポイント・ランク表示 | ダッシュボードに追加 |
| ★★☆ | おすすめ店舗ページ | 口コミが蓄積されたら公開 |
| ★★☆ | 案件管理・先行招待 | 店舗提携開始後に実装 |

---

*設計確定：2026年3月 / 合同会社CUEN*
