import { describe, expect, it } from 'vitest'
import type { Price } from '../types/content'
import { PRICE_LEVEL_THRESHOLDS, priceLevel, priceLevelName, priceLevelSymbol } from './priceLevel'

const eur = (min: number, max: number): Price => ({
  min,
  max,
  currency: 'EUR',
  status: 'needs_check',
  source: '',
  checkedAt: null,
})

describe('priceLevel', () => {
  it('нет цены → уровень неизвестен, а не «€»', () => {
    expect(priceLevel(null)).toBeNull()
  })

  it('цена не в евро → уровень неизвестен', () => {
    expect(priceLevel({ ...eur(500, 900), currency: 'RUB' })).toBeNull()
  })

  it.each([
    [5, 10, 1],
    [20, 30, 2],
    [40, 60, 3],
  ])('%i–%i € → уровень %i', (min, max, level) => {
    expect(priceLevel(eur(min, max))).toBe(level)
  })

  it('считает по середине диапазона, а не по краям', () => {
    // 10–30 €: дешёвый край «€», дорогой «€€», середина 20 € → «€€»
    expect(priceLevel(eur(10, 30))).toBe(2)
    // 30–44 €: дешёвый край «€€», середина 37 € → «€€€»
    expect(priceLevel(eur(30, 44))).toBe(3)
  })

  it('границы порогов включаются в нижний уровень', () => {
    const { budgetMax, midMax } = PRICE_LEVEL_THRESHOLDS
    expect(priceLevel(eur(budgetMax, budgetMax))).toBe(1)
    expect(priceLevel(eur(budgetMax + 1, budgetMax + 1))).toBe(2)
    expect(priceLevel(eur(midMax, midMax))).toBe(2)
    expect(priceLevel(eur(midMax + 1, midMax + 1))).toBe(3)
  })

  it('фиксированная цена', () => {
    expect(priceLevel(eur(12, 12))).toBe(1)
  })
})

describe('priceLevelSymbol и priceLevelName', () => {
  it.each([
    [1, '€', 'недорого'],
    [2, '€€', 'средне'],
    [3, '€€€', 'дорого'],
  ] as const)('%i → %s, %s', (level, symbol, name) => {
    expect(priceLevelSymbol(level)).toBe(symbol)
    expect(priceLevelName(level)).toBe(name)
  })
})
