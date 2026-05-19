# KANJI Phase 2 戦略ドキュメント

- **バージョン**: v1.2
- **作成日**: 2026-04-28(v1.2 更新: 2026-05-19)
- **ステータス**: 確定版・Phase 2 実装の意思決定基準

---

## 概要

KANJI Phase 2 は **「PMF が成立しているかを、再現性のある計測で検証する」** フェーズ。
North Star Pair(MSH + 再利用幹事率)を中心に、6ヶ月の2段階Gate構造で Phase 3(ポイント制度)への移行可否を判定する。

---

## ファイル構成

| # | ファイル | 内容 | 主な読者 |
|---|---|---|---|
| 1 | [`01_strategy.md`](01_strategy.md) | 戦略本体・KPI定義・Gate構造・優先施策Top5(v1.2 で催促レス設計中心へ更新) | 全員(意思決定基準) |
| 2 | [`02_implementation_plan.md`](02_implementation_plan.md) | DDL・集計クエリ・実装コード・Week別マスタープラン | 実装担当 |
| 3 | [`03_privacy_policy.md`](03_privacy_policy.md) | Week 0 必須タスク・同意UI・削除運用・法令整理 | Week 0 着手時 |
| 4 | [`04_decision_log.md`](04_decision_log.md) | 論点1〜6 + §10 v1.2 再検討の意思決定経緯 | 戦略見直し時 |
| 5 | [`05_next_action_claudecode_prompt_20260519.md`](05_next_action_claudecode_prompt_20260519.md) | Manus 出力の Claude Code 向けプロンプト | Claude Code 連携時 |
| 6 | [`06_execution_plan_v1.2.md`](06_execution_plan_v1.2.md) | Manus 出力反映後の実行手順(直近2週間) | 実装着手時(v1.2) |

---

## 推奨読書順

### はじめて読む場合

1. **`01_strategy.md`** をまず通読(全体像・KPI・Gate)
2. **`03_privacy_policy.md` Section 11** のチェックリスト確認(Week 0 着手前タスク)
3. **`02_implementation_plan.md` Section 6** のマスタープランで時系列を把握
4. 必要に応じて **`04_decision_log.md`** で「なぜそう決めたか」を確認

### Week 0 着手時

→ **`03_privacy_policy.md`** が起点。Section 11 のチェックリストを上から消化。

### Month 1 計測基盤実装時

→ **`02_implementation_plan.md`** Section 1〜4(DDL・招待トラッキング・集計クエリ・payload設計)。

### Gate 判定時(Month 1 / 3 / 4 / 6)

→ **`01_strategy.md`** Section 5(合格ライン・移行条件)と Section 7.3(振り返りテンプレ)。

### 戦略見直し・Phase 3 移行検討時

→ **`04_decision_log.md`** Section 8(保留論点)で「Phase 3 移行時に再評価する論点」を確認。

---

## 改訂ルール

- **戦略本体(`01`)を改訂する場合**: `04_decision_log.md` Section 7 形式で v1.x → v1.(x+1) の差分を記録する
- **実装計画(`02`)を改訂する場合**: スキーマ変更ならマイグレーションを追加(既存マイグレーションは編集しない)
- **プライバシー(`03`)を改訂する場合**: `users.privacy_policy_version` を更新し、再同意フローが発火することを確認
- **意思決定ログ(`04`)**: 追記のみ。過去の判断は削除せず、新しい判断で上書きする際は「v1.x で再検討」と明示

---

## 関連リソース

- 戦略議論の経緯: Genspark スレッド(論点1〜6 の議論)
- Phase 1 仕様書: `../06_dev/kanji-spec-final.md`(別途参照)
- デザイン規約: `../../.claude/rules/design.md`

---

## 旧ファイル

- `docs/kanji_phase2_kpi_strategy.md`(v1.0 仮置き案)は v1.1 確定に伴い削除済み。差分は `04_decision_log.md` Section 7 を参照。
