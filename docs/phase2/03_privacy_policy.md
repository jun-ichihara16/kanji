# KANJI Phase 2 プライバシー基盤

- **バージョン**: v1.1
- **作成日**: 2026-04-28
- **ステータス**: Week 0 タスク基準ドキュメント・Phase 2 実装着手前の必須整備項目
- **関連文書**:
  - `01_strategy.md`(戦略本体・Phase 2 全体計画)
  - `02_implementation_plan.md`(スキーマ・実装詳細)
  - `04_decision_log.md`(論点1〜6 の意思決定経緯)

⚠️ **重要な免責**: 本ドキュメントは PM・プロダクト設計観点での整理である。最終的な法的判断は弁護士または個人情報保護委員会のガイドラインを参照すること。商用展開時は専門家レビューが必須。

---

## 1. 基本方針

### 1.1 4つの原則

KANJI のプライバシー設計は以下4つの原則に基づく:

1. **個人情報保護法・LINE 規約の遵守** — 個人開発でも対象事業者となる
2. **データ最小化** — 「今すぐ使うものだけ取得する。将来使うかも、では取らない」
3. **透明性** — 取得目的・保管期間をユーザーに明示する
4. **削除権の保証** — ユーザーの削除依頼に対応できる仕組みを用意する

### 1.2 Phase 2 のプライバシー対応スコープ

Week 0(実装着手前)に完了させるべき項目:

- プライバシーポリシー本文の作成と公開
- 利用規約本文の作成と公開
- オンボーディング同意 UI の実装
- 解析 ID(`analytics_id_hash`)生成ロジックの実装と検証
- ユーザー削除依頼の受付窓口設置
- 90日ログ集約 cron の実装計画確定
- `growth_events` の payload 設計ガイドライン文書化

これらが揃うまで Phase 2 の実装(計測基盤・施策実装)に着手しない。

---

## 2. 法令・規約上の制約整理

### 2.1 個人情報保護法(日本)上の分類

KANJI が扱う情報の法令上の分類:

| データ | 分類 | 取り扱い注意度 |
|---|---|---|
| LINE display_name | 個人情報(特定の個人を識別可能) | 中 |
| LINE picture_url | 個人情報 | 中 |
| LINE user_id | 個人識別符号に該当する可能性 | 高 |
| 参加者の手入力名 | 個人情報 | 中 |
| **PayPay 番号** | 個人情報(金融関連の連絡先として扱う) | **高** |
| イベント・立替・精算データ | 個人に紐付くため個人情報 | 中 |
| 行動ログ(クリック等) | 単体では非該当だが user_id 紐付きで個人情報 | 中 |
| referrer / UserAgent | 単体では非個人情報 | 低 |

### 2.2 法的義務

KANJI が個人開発でも遵守すべき主要義務:

1. **利用目的の特定・通知**(法第17条・第21条)
   - 何のために収集するかを明示する
2. **第三者提供の制限**(法第27条)
   - 同意なしに外部に渡さない
3. **安全管理措置**(法第23条)
   - 個人情報の漏洩防止
4. **本人からの開示・訂正・削除請求への対応**(法第33-35条)
   - 「データを削除して」と言われたら対応する仕組み

### 2.3 LINE プラットフォーム規約上の制約

| 規約事項 | KANJI への影響 |
|---|---|
| LINE ユーザー情報の保管制限 | display_name, picture_url の長期保管は OK だが利用目的を明示 |
| プラットフォーム外でのユーザー特定の禁止 | LINE user_id を他サービスとの突き合わせに使ってはいけない |
| LINE Messaging API の通知頻度 | 過剰なメッセージ送信は規約違反リスク |
| プロフィール情報の用途 | 表示・本人識別目的のみ。第三者提供は要同意 |

特に重要: **LINE user_id を生のまま外部の解析ツール・広告プラットフォームに渡すことは規約違反リスクがある**。必ず匿名化する。

### 2.4 GDPR・他国法令の扱い

Phase 2 では対象外と判断:

- KANJI のサービス提供地域は日本(LINE ログイン主体、日本語 UI)
- EU/英国ユーザーの利用想定が低い
- 将来的にグローバル展開する場合は GDPR / CCPA 等の対応が必要

→ Phase 2 では日本の個人情報保護法のみを対応軸とする。

---

## 3. 収集してよいデータ

### 3.1 サービス機能のために必須なデータ

| データ | 用途 | 同意の取り方 |
|---|---|---|
| LINE user_id | ログイン・本人識別 | 利用規約への明示 |
| LINE display_name | 画面表示・参加者識別 | 利用規約への明示 |
| LINE picture_url | UI 表示 | 利用規約への明示 |
| 参加者の手入力名 | イベント運営 | 入力時の文脈で自明 |
| PayPay 番号 | 精算機能 | 入力時に「精算用です」と明示 |
| イベント・立替・精算データ | サービス本体 | 利用時に自明 |

→ ✅ **すべて収集 OK**。ただし利用目的を明示する必要あり。

### 3.2 解析・グロース目的のデータ

| データ | 用途 | 判定 |
|---|---|---|
| `events.completed_at` | MSH 計測 | ✅ OK |
| `invitations.token` | 招待トラッキング | ✅ OK |
| `events.originated_from_event_id` | 参加者→幹事化追跡 | ✅ OK |
| `events.host_was_participant` | 同上 | ✅ OK |
| `growth_events`(13種ログ) | ファネル分析 | ✅ OK(payload 設計に注意) |
| ログイン時刻・最終アクセス時刻 | アクティブユーザー判定 | ✅ OK |
| 主要ボタン押下ログ | 施策効果測定 | ✅ OK |

→ ✅ **すべて収集 OK**。ただし以下の条件付き:

1. **payload に個人特定情報を含めない**(Section 5 のルール参照)
2. **利用目的をプライバシーポリシーに明記**
3. **第三者提供しない**

### 3.3 補助データ

| データ | 用途 | 判定 |
|---|---|---|
| referrer(HTTP ヘッダ) | 流入元分析 | ✅ OK(個人特定性なし) |
| UserAgent | デバイス・ブラウザ分析 | ✅ OK(個人特定性なし) |
| 画面解像度 | UI 改善 | ✅ OK |

---

## 4. 避けるべきデータ

### 4.1 NG(収集しない)

| データ | 理由 |
|---|---|
| 詳細な位置情報(GPS 座標) | 利用目的不明、過剰収集 |
| デバイス指紋(Canvas/Audio Fingerprint) | プライバシー侵害的、機能に不要 |
| 連絡先帳(電話番号・メールアドレス一覧) | アクセス権限要求が過剰 |
| LINE 友達リスト | 利用目的不明、LINE 規約上もグレー |
| 他サービスのアカウント情報 | 同意取得困難、漏洩リスク |
| クレジットカード情報 | KANJI は決済サービスではない |
| 生年月日・性別 | Phase 2 では使う場面がない |

判断軸: **「今すぐ使わないが、将来使うかも」で取るのは NG**。利用目的が現時点で明確なものだけ。

### 4.2 グレーゾーン(慎重に判断)

| データ | グレーな理由 | Phase 2 の判断 |
|---|---|---|
| IP アドレス | 個人特定可能性あり、ただしセキュリティ上必要 | アクセスログとして30日保管 OK、解析 payload には含めない |
| Cookie ID(独自) | クロスデバイス追跡につながる | Phase 2 では実装しない |
| LINE user_id を解析ツールに送信 | 個人識別符号の第三者提供にあたる可能性 | ❌ 送るならハッシュ化必須 |
| ローカルストレージの長期保持 | ユーザーが意識しないまま追跡 | ✅ OK だが「直近の招待トークン」程度に制限 |

### 4.3 Phase 2 で取らない(明示)

KANJI の規模・フェーズに対して過剰なもの:

- ❌ ヒートマップ(Hotjar / Microsoft Clarity 等)
- ❌ セッションリプレイ
- ❌ A/B テスト基盤の Cookie
- ❌ 広告 ID(IDFA / AAID)
- ❌ 詳細ファネル分析ツール(Mixpanel / Amplitude の高機能プラン)

これらは Phase 3 以降、規模が出てから検討する。

---

## 5. 匿名化方針

### 5.1 user_id の取り扱い

LINE user_id は個人識別符号に該当する可能性があるため、**内部 DB では原則そのまま保管 OK だが、解析用途では必ず匿名化**する。

- **内部 DB(機能上必要)**: `users.line_user_id` にそのまま保存
- **解析ツール送信時**: `users.analytics_id_hash` を使用(SHA256 + SECRET_SALT の先頭16文字)
- **growth_events への記録**: `host_user_id_hash` カラムにのみ書き込む(生 user_id は絶対書かない)

### 5.2 analytics_id_hash の生成ロジック

`02_implementation_plan.md` Section 4.3 と同じ実装。再掲:

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

### 5.3 SECRET_SALT の管理ルール

- Supabase Vault または環境変数で管理する
- **絶対に Git リポジトリにコミットしない**
- ローテーションしない(SALT が変わると過去のハッシュとの突合が壊れる)
- 漏洩時の対応: 新規 SALT で再ハッシュ → 旧ハッシュとの対応表を作成 → 段階的に置換(Phase 2 では発生想定なし)
- 開発・ステージング・本番でそれぞれ別の SALT を使う(環境間データ混在を防ぐ)

### 5.4 growth_events の payload 設計ルール

#### 5.4.1 含めて良い情報

| 項目 | 例 | 備考 |
|---|---|---|
| event_type | `"settlement_completed"` | 列挙値で管理 |
| host_user_id_hash | `"a3f9b2c1..."` | analytics_id_hash と一致 |
| event_id | UUID | KANJI イベント ID |
| timestamp | ISO 8601 | サーバー側で `NOW()` |
| 数値メタ | `participants_count: 4` | 集計に使う値 |
| カテゴリ識別子 | `category: "drinking"` | 既定値リスト内 |

#### 5.4.2 含めてはいけない情報

| 項目 | 理由 |
|---|---|
| 氏名(`name`, `display_name`) | 個人特定情報 |
| LINE userId 生値 | プラットフォーム規約上 NG |
| PayPay ID | 金融関連の連絡先 |
| 金額(`amount`, `total`) | 個別金額は不要 |
| メッセージ本文 | 私信の領域 |
| メールアドレス | 個人特定情報 |
| IP アドレス | アクセスログ側で別管理 |

#### 5.4.3 NG 例と OK 例

```json
// ❌ NG: 個人特定情報が混入
{
  "event_type": "participant_added",
  "payload": {
    "participant_name": "田中太郎",
    "paypay_number": "090-1234-5678",
    "line_display_name": "たろちゃん",
    "amount": 5000
  }
}

// ✅ OK: ID 参照と数値メタのみ
{
  "event_type": "participant_added",
  "host_user_id_hash": "a3f9b2c1...",
  "event_id": "uuid",
  "payload": {
    "participants_count_after": 4
  }
}
```

→ payload を見ても「誰が何をしたか」までは分かるが、「具体的に誰なのか」は別テーブル(participants)参照経由でなければ特定できない構造にする。

### 5.5 PayPay 番号の特別扱い

PayPay 番号は **金融関連の連絡先** として、他の個人情報より厳格に扱う:

- Supabase の Row Level Security で **本人と該当イベントの幹事のみ** 参照可能
- 解析ログには **絶対に含めない**(payload で明示禁止)
- 不要になったら削除する(精算完了から1年経過したら自動削除する cron を Phase 2 後半で実装検討)
- Supabase の `pgcrypto` 拡張を使った暗号化保管も検討するが、Phase 2 では RLS と適切な payload 設計で対応(暗号化は Phase 3 以降)

---

## 6. データ保管期間

### 6.1 保管期間一覧

| データ種別 | 保管期間 | 処理 |
|---|---|---|
| サービス機能データ(events, participants 等) | ユーザー削除依頼まで | - |
| growth_events 個別レコード | 90日 | 月次集約後に削除 |
| growth_events_monthly_summary | 2年 | 長期トレンド分析用 |
| アクセスログ(IP・UA) | 30日 | 自動削除 |
| 退会ユーザーのデータ | 退会後30日で匿名化 | 名前を「退会ユーザー」に |
| invitations(消費済) | 1年 | 1年経過後は redeemed_user_id を NULL 化 |
| invitations(未消費) | 90日 | 90日経過後は削除 |

### 6.2 90日ログ集約 cron(再掲)

詳細は `02_implementation_plan.md` Section 4.6 参照。`pg_cron` で毎月1日 03:00 JST に実行:

- 90日経過した `growth_events` を月次サマリーに集約
- 元レコードを削除
- ジョブ失敗時は Supabase Dashboard の `cron.job_run_details` で週次確認

### 6.3 退会ユーザーのデータ匿名化(自動)

Phase 2 では手動運用とし、Phase 3 以降で自動化を検討する。手動運用の手順は Section 8 を参照。

---

## 7. 同意取得の設計

### 7.1 基本方針

> **オンボーディング時に1回、利用規約 + プライバシーポリシー同意を取得。それ以降は基本的に都度同意不要。**

理由:

- 都度同意(行動ごとに「これを記録していいですか?」)は UX 破壊的
- 個人情報保護法上も「利用目的を通知・公表」していれば同意不要なケースが多い
- ただし **利用目的を後から大幅に変更する場合は再同意が必要**

### 7.2 オンボーディング同意 UI のコピー案

LINE ログイン直後の初回画面で表示するモーダル例:

---

**KANJI のご利用にあたって**

KANJI は以下の情報を取得・利用します:

✓ **LINE アカウント情報**(名前・アイコン)
　→ 画面表示と本人識別のため

✓ **ご利用状況**(ボタン操作・遷移)
　→ サービス改善のための分析(個人を特定できない形に変換します)

✓ **招待元イベント情報**
　→ 招待機能の動作と効果測定

詳細な利用目的・保管期間は [プライバシーポリシー] をご確認ください。

[ ] 利用規約 と プライバシーポリシー に同意します

[ 同意して始める ](活性化条件: 上記チェック)

---

### 7.3 同意取得の実装

`users.privacy_consented_at` カラムへの記録ロジック:

```typescript
// supabase/functions/record-consent/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const { user_id, policy_version } = await req.json();

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { error } = await supabase
    .from("users")
    .update({
      privacy_consented_at: new Date().toISOString(),
      privacy_policy_version: policy_version,
    })
    .eq("id", user_id);

  if (error) {
    return new Response(JSON.stringify({ error }), { status: 500 });
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
```

### 7.4 同意のないユーザーへの対応

- LINE ログイン未完了のユーザー: 機能制限(イベント作成・参加不可)
- プライバシーポリシー未同意: 同上(オンボーディング画面で停止)
- 同意撤回(削除依頼): 機能利用不可、データ匿名化処理(Section 8)

### 7.5 招待トラッキングと参加者同意

**論点**: 参加者本人の同意なしに招待元を追跡してよいか?

**判断**: ✅ OK(条件付き)

理由:

- 「招待元イベント ID」はサービス機能の動作上必要な情報であり、純粋なマーケティング追跡ではない
- 参加者がアプリを使う時点で、同等の同意取得フロー(オンボーディング)を経ている
- プライバシーポリシーで「招待機能の改善のために招待元を記録」と明示すれば足りる

ただし守るべきライン:

- 招待元の追跡を **広告配信・第三者提供に使わない**
- ユーザーが要望すれば追跡データを削除する仕組みを提供

### 7.6 ポリシー大幅改訂時の再同意フロー

`users.privacy_policy_version` を比較し、現行バージョンと一致しない場合は再同意モーダルを表示する。Phase 3 でポイント制度を導入する際は、新たな同意フローを必ず通す。

---

## 8. ユーザー削除依頼への対応

### 8.1 受付窓口

プライバシーポリシーに以下を明記する:

- 連絡先メールアドレス(例: `kanji-privacy@example.com`)
- 削除依頼への対応期限(法定では「遅滞なく」、KANJI 個人開発では **30日以内** を目安)
- 削除依頼に必要な情報: LINE 表示名 + 登録メールアドレス(任意)+ 依頼内容

### 8.2 完全削除ではなく匿名化を採用する理由

完全削除すると、他参加者のイベントデータが壊れる:

- 過去のイベントから幹事の名前が消えると、参加者が「誰のイベントだったか」分からなくなる
- settlement の参照整合性が壊れる(誰から誰への送金だったか追えない)
- growth_events の集計値が遡及的に変動する

→ **匿名化方式を採用**: 個人特定情報のみ削除し、ID 参照は残す。

### 8.3 削除依頼処理スクリプト

```sql
-- supabase/migrations/utils/anonymize_user.sql
-- 使用例: SELECT anonymize_user_data('<line_user_id>');

CREATE OR REPLACE FUNCTION anonymize_user_data(p_line_user_id TEXT)
RETURNS VOID
LANGUAGE plpgsql AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- LINE user_id から内部 UUID を取得
  SELECT id INTO v_user_id FROM users WHERE line_user_id = p_line_user_id;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not found for line_user_id: %', p_line_user_id;
  END IF;

  -- 1. events: 幹事の表示名・ID を匿名化
  UPDATE events
  SET host_display_name = '退会ユーザー'
  WHERE host_user_id = v_user_id;

  -- 2. participants: 名前と PayPay 番号を削除
  UPDATE participants
  SET
    name = '退会ユーザー',
    paypay_number = NULL
  WHERE user_id = v_user_id;

  -- 3. invitations: redeemed_user_id を NULL 化
  UPDATE invitations
  SET redeemed_user_id = NULL
  WHERE redeemed_user_id = v_user_id;

  -- 4. growth_events の host_user_id_hash は既に匿名化されているので変更不要
  -- ただし、再特定リスクを下げるためにランダムなハッシュに置換することも可能
  UPDATE growth_events
  SET host_user_id_hash = MD5(RANDOM()::TEXT)
  WHERE host_user_id_hash = (SELECT analytics_id_hash FROM users WHERE id = v_user_id);

  -- 5. users: 個人情報を削除、削除フラグ立てる
  UPDATE users
  SET
    line_user_id = NULL,
    line_display_name = '退会ユーザー',
    line_picture_url = NULL,
    analytics_id_hash = NULL,
    deleted_at = NOW()
  WHERE id = v_user_id;
END;
$$;
```

### 8.4 削除依頼受付フロー(運用)

1. ユーザーから受付窓口メールに削除依頼が届く
2. 開発者が本人確認(LINE 表示名と登録情報の照合)
3. `anonymize_user_data('<line_user_id>')` を Supabase SQL エディタで実行
4. 完了したことをメールで返信(処理日時を記録)
5. 30日後、`deleted_at` から30日経過したユーザーのレコードを完全削除する月次 cron(Phase 2 後半で検討)

### 8.5 削除依頼ログの保管

監査目的で削除依頼の事実を記録(個人情報は含めない):

```sql
CREATE TABLE IF NOT EXISTS deletion_requests_log (
  id BIGSERIAL PRIMARY KEY,
  request_received_at TIMESTAMPTZ NOT NULL,
  processed_at TIMESTAMPTZ,
  user_id_hash TEXT,  -- 削除前の analytics_id_hash
  notes TEXT
);
```

---

## 9. プライバシーポリシー必須記載項目

### 9.1 プライバシーポリシー本文構成

実際のポリシー本文は別途ドラフト化するが、以下の項目を必ず含める:

| セクション | 記載内容 |
|---|---|
| 1. 事業者情報 | 開発者氏名・連絡先メール |
| 2. 取得する情報の種類 | LINE 情報、利用状況、招待元、入力データ |
| 3. 利用目的 | 各情報の用途を具体的に列挙 |
| 4. 第三者提供の有無 | 「原則として第三者に提供しません」 |
| 5. 保管期間 | データ種別ごとに明示(Section 6 参照) |
| 6. 安全管理措置 | 適切なセキュリティ対策の概要 |
| 7. 開示・訂正・削除請求の窓口 | 連絡先メール |
| 8. Cookie / localStorage の利用 | 招待トラッキングで使う旨 |
| 9. 改訂時の通知方法 | アプリ内通知 |
| 10. 準拠法・管轄裁判所 | 日本法、東京地裁等 |

### 9.2 KANJI 特有で追記すべき項目

#### 招待トラッキングについて

```
KANJI は招待機能の改善および効果測定のため、参加者がどの招待リンクから流入したかを記録します。
この情報はサービス改善のみに利用し、広告配信や第三者提供には使用しません。
記録されるのは「招待元イベントの ID」のみで、参加者個人を特定できる情報は含まれません。
```

#### ご利用状況の記録について

```
イベント作成・精算完了等の主要操作のタイミングを記録し、
匿名化(SHA256 ハッシュ化)した上でサービス改善のための分析に利用します。
個人を特定可能な形での外部提供は行いません。
記録されたデータは90日経過後、月次の集約値に変換して個別記録は削除します。
```

#### LINE アカウント情報について

```
LINE プラットフォームから取得したユーザー情報(表示名・アイコン・ユーザー ID)は、
KANJI の機能提供および本人識別目的のみに利用し、
他のサービスとの紐付けには使用しません。
LINE プラットフォームの利用規約に従って取り扱います。
```

#### PayPay 番号について

```
精算機能を実現するために、参加者の PayPay 番号を記録します。
この情報は精算操作の表示のみに使用し、決済処理は KANJI 内では行いません。
PayPay 番号は当該イベントの幹事と本人のみが参照可能で、
解析・分析の目的には一切使用しません。
```

---

## 10. 利用規約必須記載項目

| セクション | 記載内容 |
|---|---|
| サービスの内容 | KANJI が提供する機能の範囲 |
| 利用者の責任 | 入力情報の正確性、適法な利用 |
| 禁止事項 | 不正利用、なりすまし、虚偽の精算情報入力 |
| サービスの変更・中止権 | 個人開発のため運営継続を保証しない旨 |
| 免責事項 | 精算金額の正確性は利用者責任、KANJI は決済を保証しない |
| 知的財産権 | KANJI のロゴ・コードの権利帰属 |
| 規約改定 | 改定時の通知方法と効力発生時期 |
| 準拠法・管轄 | 日本法、東京地裁等 |

特に重要: **「金銭が絡むサービス」として最低限の免責は明記する**。個人開発でも、紛争時のリスクを負わないために必須。

---

## 11. Week 0 タスクチェックリスト

Phase 2 実装着手前に完了させるべき項目:

### 11.1 ドキュメント作成

- [ ] プライバシーポリシー本文のドラフト作成
- [ ] 利用規約本文のドラフト作成
- [ ] 両方を KANJI のサイト上に公開(URL を確定)
- [ ] オンボーディング同意 UI のコピー確定

### 11.2 実装

- [ ] `users.privacy_consented_at` / `privacy_policy_version` / `analytics_id_hash` / `is_test_account` カラム追加(`02_implementation_plan.md` のマイグレーションに含む)
- [ ] `generateAnalyticsIdHash()` 関数の実装
- [ ] `ANALYTICS_ID_SALT` 環境変数の設定(本番・ステージング・開発で別値)
- [ ] `record-consent` Edge Function の実装
- [ ] オンボーディング画面でプライバシーポリシー同意 UI を実装
- [ ] 同意していないユーザーが機能を使えないようにする ガード実装

### 11.3 運用準備

- [ ] 削除依頼受付メールアドレスの確保と公開
- [ ] `anonymize_user_data()` 関数の本番デプロイ
- [ ] `deletion_requests_log` テーブル作成
- [ ] 90日ログ集約 cron の本番設定
- [ ] テストアカウント(`is_test_account = true`)の登録(開発者本人と既知の知人)

### 11.4 検証

- [ ] 単体テスト: `generateAnalyticsIdHash()` が同じ入力で同じハッシュを返すこと
- [ ] 単体テスト: 異なる SECRET_SALT で異なるハッシュが生成されること
- [ ] 結合テスト: オンボーディング → 同意 → 機能利用までの一連フロー
- [ ] 結合テスト: 同意していないユーザーは機能アクセスできないこと
- [ ] 結合テスト: `anonymize_user_data()` 実行後、個人情報が消えていることを SQL で確認

---

## 12. リスク・落とし穴

### 12.1 個人開発で見落としがちな点

| 落とし穴 | 対策 |
|---|---|
| 「個人開発だから免責される」誤認 | 個人情報保護法は事業規模で適用除外にならない |
| LINE user_id の生 GA 送信 | 必ず analytics_id_hash 経由で送信 |
| プライバシーポリシーと実装の乖離 | 実装変更時にポリシーも改訂 |
| 削除依頼への対応漏れ | 受付窓口・処理スクリプトを Week 0 で整備 |
| 利用目的の事後拡大 | 大幅変更時は再同意フロー発火 |
| SECRET_SALT の Git コミット | `.gitignore` 徹底、Vault 使用 |
| テストアカウントの本番混入 | `is_test_account` フラグでの除外を集計クエリ全てに適用 |

### 12.2 ポリシー本文作成時の注意点

- **テンプレのコピペは危険**: 実装と乖離して逆にリスクを生む。KANJI で実際に取っているデータと記載内容を一致させる
- **専門家レビューを受ける**: Phase 2 着手前、可能なら法務に詳しい知人または有償の弁護士レビューを受ける
- **改訂履歴を残す**: ポリシー本文に「改訂履歴」セクションを設け、いつ何を変えたか記録する

### 12.3 海外ユーザーへの想定不足

- 「日本人しか使わない」と思っていても、海外在住の日本人ユーザーが利用するケースは想定すべき
- GDPR 完全対応は不要だが、**EU IP からのアクセスを検出してプライバシーポリシーで明示する** 程度の配慮は推奨(Phase 3 以降検討)

### 12.4 子ども(18歳未満)の利用への対応

飲み会ツールだが、参加者に未成年が含まれる可能性がある。Phase 2 では明示的な対応はしないが、将来的には:

- 利用規約に「18歳未満は保護者の同意の上で利用する」と明記
- 必要に応じて年齢確認 UI を追加(Phase 3 以降)

### 12.5 越境データ移転(Supabase の海外リージョン)

Supabase が AWS の海外リージョンに保存している場合、第三国へのデータ移転に該当する可能性がある。

- Phase 2 では Supabase の Tokyo リージョン(ap-northeast-1)を使用していることを確認する
- プライバシーポリシーに「データは日本国内のクラウドサーバーに保管」と記載できる状態にする
- 海外リージョンを使う場合は、その旨をポリシーに明記する必要あり

### 12.6 同意は1回で永久有効ではない

- 利用目的を大幅に変更したり、新たなデータ収集を追加する場合は **再同意取得が必要**
- Phase 3 でポイント制度を導入する際は、新たな同意フローを必ず通す
- ポリシー改訂時は `users.privacy_policy_version` の比較で自動的に再同意モーダルが出る仕組みを Week 0 で実装

---

## 13. 同様サービスのプライバシー実装事例

### 13.1 Splitwise

- プライバシーポリシーが詳細・明示的
- データの第三者提供を明確に否定
- ユーザー削除リクエストの窓口を設置
- **学び**: 「金銭関連 = 透明性の高さがブランド価値」になる

### 13.2 PayPay

- 入力情報の用途明示が徹底されている
- **学び**: PayPay 番号入力時に「精算用に使われる」と明示する UI

### 13.3 LINE Pay 割り勘機能

- LINE プラットフォーム内なので同意取得が簡素化されている
- **学び**: KANJI も「LINE ログイン経由で同意取得済み」を活用してオンボーディングを軽くできる

---

## 14. 専門家レビューが必要な領域

Week 0 完了前に、可能であれば以下を専門家(弁護士または個人情報保護に詳しい知人)にレビューしてもらう:

- プライバシーポリシー本文
- 利用規約本文
- 同意 UI のコピー
- 削除依頼処理スクリプトの法的妥当性
- LINE プラットフォーム規約との整合性

商用展開時は法務専門家レビューが必須。

---

## 改訂履歴

| 日付 | バージョン | 内容 |
|---|---|---|
| 2026-04-28 | v1.0 | 初稿(論点6 検討段階) |
| 2026-04-28 | v1.1 | 論点1〜6 統合反映、Week 0 タスクチェックリスト確定版 |
