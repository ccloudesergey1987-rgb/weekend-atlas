import { describe, expect, it } from 'vitest'
import { formatDuration, formatPrice, formatTransfer, pluralize } from './format'

describe('pluralize', () => {
  const forms: [string, string, string] = ['точка', 'точки', 'точек']
  it.each([
    [1, 'точка'],
    [2, 'точки'],
    [5, 'точек'],
    [11, 'точек'],
    [12, 'точек'],
    [21, 'точка'],
    [22, 'точки'],
    [111, 'точек'],
  ])('%i → %s', (n, expected) => {
    expect(pluralize(n, forms)).toBe(expected)
  })
})

describe('formatDuration', () => {
  it.each([
    [45, '45 мин'],
    [60, '1 ч'],
    [90, '1 ч 30 мин'],
    [120, '2 ч'],
  ])('%i → %s', (minutes, expected) => {
    expect(formatDuration(minutes)).toBe(expected)
  })
})

describe('formatPrice', () => {
  const base = { currency: 'EUR' as const, status: 'needs_check' as const, source: '', checkedAt: null }

  it('нет цены → «Цена уточняется», а не 0', () => {
    expect(formatPrice(null)).toBe('Цена уточняется')
  })

  it('фиксированная цена', () => {
    expect(formatPrice({ ...base, min: 25, max: 25 })).toBe('25 €')
  })

  it('диапазон', () => {
    expect(formatPrice({ ...base, min: 20, max: 35 })).toBe('20–35 €')
  })
})

describe('formatTransfer', () => {
  it('пешком', () => {
    expect(formatTransfer({ mode: 'walk', minutes: 15, status: 'needs_check', source: '', checkedAt: null })).toBe(
      '≈ 15 мин пешком',
    )
  })

  it('на метро', () => {
    expect(formatTransfer({ mode: 'metro', minutes: 35, status: 'needs_check', source: '', checkedAt: null })).toBe(
      '≈ 35 мин на метро',
    )
  })
})
