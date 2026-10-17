import type { Price, PriceLevel } from '../types/content'

/**
 * Price level thresholds — the only place where €, €€ and €€€ are defined.
 *
 * The level is never typed in by hand: it is computed from the average bill
 * per person (in euros). For a range like «20–30 €» the middle (25 €) is used,
 * so a wide range is not judged by its cheapest or most expensive end.
 *
 *   middle ≤ 15 €        → €    (кофе, выпечка, перекус на рынке)
 *   15 € < middle ≤ 35 € → €€   (тапас, обед в обычном ресторане)
 *   middle > 35 €        → €€€  (ужин в хорошем ресторане)
 *
 * To change the levels for all places at once, edit these two numbers.
 */
export const PRICE_LEVEL_THRESHOLDS = {
  /** Upper bound (inclusive) of «€», in euros per person. */
  budgetMax: 15,
  /** Upper bound (inclusive) of «€€»; anything above is «€€€». */
  midMax: 35,
} as const

export const PRICE_LEVELS: readonly PriceLevel[] = [1, 2, 3]

/** Level from the average bill. Unknown price (or not in euros) → null, never a guess. */
export function priceLevel(price: Price | null): PriceLevel | null {
  if (!price || price.currency !== 'EUR') return null
  const middle = (price.min + price.max) / 2
  if (middle <= PRICE_LEVEL_THRESHOLDS.budgetMax) return 1
  if (middle <= PRICE_LEVEL_THRESHOLDS.midMax) return 2
  return 3
}

/** 1 → «€», 2 → «€€», 3 → «€€€». */
export function priceLevelSymbol(level: PriceLevel): string {
  return '€'.repeat(level)
}

const levelNames: Record<PriceLevel, string> = {
  1: 'недорого',
  2: 'средне',
  3: 'дорого',
}

/** For screen readers and hints: «€€ — средне». */
export function priceLevelName(level: PriceLevel): string {
  return levelNames[level]
}
