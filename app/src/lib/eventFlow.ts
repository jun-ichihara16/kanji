// イベント作成フローの「内部値 ↔ 表示文言」マッピング。
// UI側で内部値（nomikai / equal_split など）を直接表示しないために、
// すべてここを経由する。文言は仕様で固定されているので変更しないこと。

import {
  EventTemplate,
  SettlementType,
  RoundingRule,
  FinalAdjustmentMode,
} from '../hooks/useEvent'

// =========================================================
// テンプレート
// =========================================================

export const TEMPLATE_LABELS: Record<EventTemplate, string> = {
  nomikai: '飲み会',
  prepaid: '事前集金イベント',
  bbq: 'BBQ / 屋外イベント',
  futsal: 'フットサル / スポーツ',
  travel: '旅行 / おでかけ',
  other: 'その他',
}

// テンプレ別の初期会計方式（仕様で固定）
export const TEMPLATE_DEFAULT_SETTLEMENT: Record<EventTemplate, SettlementType> = {
  nomikai: 'equal_split',
  prepaid: 'equal_split',
  bbq: 'reimbursement_split',
  futsal: 'equal_split',
  travel: 'reimbursement_split',
  other: 'equal_split',
}

// テンプレ別の補足コピー（軽い説明だけ。仕様文言の上書きはしない）
export const TEMPLATE_HINTS: Record<EventTemplate, string> = {
  nomikai: '居酒屋・お店での会計をシンプルに割り勘',
  prepaid: '事前にまとめて集金（参加費など）',
  bbq: '買い出しなど立替が多い屋外イベント向け',
  futsal: 'コート代などをみんなで割り勘',
  travel: '宿・交通費など複数の立替を最後にまとめて精算',
  other: '上記に当てはまらない場合',
}

// =========================================================
// 会計方式
// =========================================================

export const SETTLEMENT_TITLE: Record<SettlementType, string> = {
  equal_split: '割り勘',
  weighted_split: '金額に差をつける',
  reimbursement_split: '立替分はあとで精算する',
}

export const SETTLEMENT_DESCRIPTION: Record<SettlementType, string> = {
  equal_split: '全員ほぼ同じ金額で精算します',
  weighted_split: '先輩多め・学生少なめなどを設定できます',
  reimbursement_split: '買い出し代などを最後にまとめて調整します',
}

// =========================================================
// 重み（weighted_split 用の簡易プリセット）
// =========================================================

export type WeightPreset = 'more' | 'normal' | 'less'

export const WEIGHT_PRESET_LABEL: Record<WeightPreset, string> = {
  more: '多め',
  normal: 'ふつう',
  less: '少なめ',
}

// 内部の数値（既存 participants.weight に保存）
export const WEIGHT_PRESET_VALUE: Record<WeightPreset, number> = {
  more: 1.3,
  normal: 1.0,
  less: 0.7,
}

export function presetFromWeight(weight: number): WeightPreset {
  if (weight >= 1.2) return 'more'
  if (weight <= 0.8) return 'less'
  return 'normal'
}

// =========================================================
// 端数処理 / 最終調整
// =========================================================

export const ROUNDING_LABEL: Record<RoundingRule, string> = {
  floor: '切り捨て',
  round: '四捨五入',
  ceil: '切り上げ',
}

export const FINAL_ADJUSTMENT_LABEL: Record<FinalAdjustmentMode, string> = {
  minimum: '最小回数で精算',
  even: '全員均等に再分配',
}

// =========================================================
// 請求文面の組み立て（settlement_type ごとに差し替え）
// =========================================================

export function buildRequestMessage(args: {
  eventTitle: string
  shareUrl: string
  settlementType: SettlementType
}): string {
  const { eventTitle, shareUrl, settlementType } = args
  switch (settlementType) {
    case 'equal_split':
      return `${eventTitle} の会計です。下記のURLから1人あたりの金額を確認してください。\n${shareUrl}`
    case 'weighted_split':
      return `${eventTitle} の会計です。一人ひとりの金額を設定しています。下記のURLから確認してください。\n${shareUrl}`
    case 'reimbursement_split':
      return `${eventTitle} の精算です。立替分を集計しました。下記のURLから自分の支払額を確認してください。\n${shareUrl}`
  }
}
