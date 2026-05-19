import { describe, it, expect } from 'vitest'
import { buildIndividualReminderText, buildPayeeSummaryText } from './reminder-template'

describe('buildIndividualReminderText', () => {
  const base = {
    eventTitle: '飲み会',
    settlement: { from: '田中', to: '市原', amount: 3500 },
    eventUrl: 'https://kanji-relief.com/app/e/abc123',
  }

  it('支払う人と受け取る人と金額が必ず含まれる', () => {
    const text = buildIndividualReminderText(base)
    expect(text).toContain('田中さん')
    expect(text).toContain('市原さん')
    expect(text).toContain('¥3,500')
  })

  it('イベント名と URL が含まれる', () => {
    const text = buildIndividualReminderText(base)
    expect(text).toContain('飲み会')
    expect(text).toContain('https://kanji-relief.com/app/e/abc123')
  })

  it('paymentHint があれば含まれる', () => {
    const text = buildIndividualReminderText({ ...base, paymentHint: 'PayPay: 080-1234-5678' })
    expect(text).toContain('PayPay: 080-1234-5678')
  })

  it('paymentHint が空文字なら含まれない', () => {
    const text = buildIndividualReminderText({ ...base, paymentHint: '   ' })
    expect(text).not.toMatch(/PayPay|paypay/)
  })

  it('金額は3桁区切りで表示される', () => {
    const text = buildIndividualReminderText({
      ...base,
      settlement: { from: 'A', to: 'B', amount: 12345 },
    })
    expect(text).toContain('¥12,345')
  })
})

describe('buildPayeeSummaryText', () => {
  it('未払いリストが空なら空文字を返す', () => {
    const text = buildPayeeSummaryText({
      eventTitle: '飲み会',
      payeeName: '市原',
      unpaidList: [],
      eventUrl: 'https://example.com',
    })
    expect(text).toBe('')
  })

  it('合計金額がリスト合計と一致する', () => {
    const text = buildPayeeSummaryText({
      eventTitle: '飲み会',
      payeeName: '市原',
      unpaidList: [
        { from: 'A', to: '市原', amount: 1000 },
        { from: 'B', to: '市原', amount: 2500 },
        { from: 'C', to: '市原', amount: 500 },
      ],
      eventUrl: 'https://example.com',
    })
    expect(text).toContain('合計: ¥4,000')
    expect(text).toContain('・Aさん: ¥1,000')
    expect(text).toContain('・Bさん: ¥2,500')
    expect(text).toContain('・Cさん: ¥500')
  })

  it('イベント名と受取人名と URL が含まれる', () => {
    const text = buildPayeeSummaryText({
      eventTitle: 'BBQ',
      payeeName: '市原',
      unpaidList: [{ from: 'A', to: '市原', amount: 1000 }],
      eventUrl: 'https://kanji.example/x',
    })
    expect(text).toContain('BBQ')
    expect(text).toContain('市原さん')
    expect(text).toContain('https://kanji.example/x')
  })
})
