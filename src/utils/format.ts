import type { Currency, Price, Transfer, TransferMode } from '../types/content'

/** Russian plural form: pluralize(3, ['день', 'дня', 'дней']) → 'дня'. */
export function pluralize(n: number, forms: [string, string, string]): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return forms[0]
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1]
  return forms[2]
}

/** 45 → «45 мин», 60 → «1 ч», 90 → «1 ч 30 мин». */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m} мин`
  if (m === 0) return `${h} ч`
  return `${h} ч ${m} мин`
}

const currencySymbols: Record<Currency, string> = {
  EUR: '€',
  RUB: '₽',
  USD: '$',
}

/** Price range as text. Missing price is never shown as 0. */
export function formatPrice(price: Price | null): string {
  if (!price) return 'Цена уточняется'
  const symbol = currencySymbols[price.currency]
  if (price.min === price.max) return `${price.min} ${symbol}`
  return `${price.min}–${price.max} ${symbol}`
}

const transferModeText: Record<TransferMode, string> = {
  walk: 'пешком',
  metro: 'на метро',
  bus: 'на автобусе',
  taxi: 'на такси',
}

/** «≈ 15 мин пешком». */
export function formatTransfer(transfer: Transfer): string {
  return `≈ ${formatDuration(transfer.minutes)} ${transferModeText[transfer.mode]}`
}
