import { describe, it, expect } from 'vitest'
import { appendInvToken } from './invitation-url'

describe('appendInvToken', () => {
  it('クエリパラメータが無い URL に ?inv= を付与する', () => {
    expect(appendInvToken('https://kanji-relief.com/app/e/abc123', 'xyz789')).toBe(
      'https://kanji-relief.com/app/e/abc123?inv=xyz789',
    )
  })

  it('既にクエリパラメータがある URL には &inv= を付与する', () => {
    expect(appendInvToken('https://kanji-relief.com/app/e/abc?preview=1', 'xyz')).toBe(
      'https://kanji-relief.com/app/e/abc?preview=1&inv=xyz',
    )
  })

  it('token に特殊文字が含まれていても URL エンコードされる', () => {
    const url = appendInvToken('https://example.com/', 'a b/c')
    expect(url).toBe('https://example.com/?inv=a%20b%2Fc')
  })
})
