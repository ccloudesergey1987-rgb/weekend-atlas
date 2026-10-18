/**
 * Budget calculator: pure functions, no React, no storage.
 *
 * All money is handled in integer cents, so 0.1 + 0.2 never becomes
 * 0.30000000000000004. Euros appear only at the very end, for display,
 * rounded to the nearest whole euro (half up).
 *
 * A missing price is never treated as 0: the item is left out of the total
 * and reported separately, so the UI can say what was not counted.
 */

import type {
  BudgetOption,
  BudgetSettings,
  Currency,
  OptionGroup,
  Price,
  Route,
  TransferOption,
} from '../types/content'
import { currencySymbol } from '../utils/format'

export const MIN_TRAVELERS = 1
export const MAX_TRAVELERS = 6
/** Upper limit for a manually entered amount: 1 000 000 in cents. */
export const MAX_MANUAL_CENTS = 100_000_000
/** Longest manual input we keep; anything longer is junk. */
const MAX_INPUT_LENGTH = 20

/** Amount range in integer cents (or whole euros, where stated). */
export interface Range {
  min: number
  max: number
}

// ---------------------------------------------------------------------------
// Integer arithmetic

/** Price from JSON (e.g. 7.45) → integer cents (745). */
export function toCents(amount: number): number {
  if (!Number.isFinite(amount) || amount < 0) throw new Error(`Invalid price: ${amount}`)
  // 7.45 * 100 = 744.9999999999999 in floating point, so round to the nearest cent.
  return Math.round(amount * 100)
}

/** a / b rounded to the nearest integer, halves up. Both are non-negative integers, b > 0. */
export function divideRounded(a: number, b: number): number {
  return Math.floor((2 * a + b) / (2 * b))
}

/** Cents → whole euros, halves up: 1249 → 12, 1250 → 13. */
export function centsToEuros(cents: number): number {
  return divideRounded(cents, 100)
}

function priceToCents(price: Price): Range {
  return { min: toCents(price.min), max: toCents(price.max) }
}

function scale(range: Range, factor: number): Range {
  return { min: range.min * factor, max: range.max * factor }
}

function add(a: Range, b: Range): Range {
  return { min: a.min + b.min, max: a.max + b.max }
}

const ZERO: Range = { min: 0, max: 0 }

// ---------------------------------------------------------------------------
// Manual amounts (typed by the user)

export type AmountError = 'not_a_number' | 'negative' | 'too_large'

export type ParsedAmount =
  | { kind: 'empty' }
  | { kind: 'invalid'; error: AmountError }
  | { kind: 'ok'; cents: number }

/**
 * Parses what the user typed: «120», «120,5», «1 200.50». Up to two decimals,
 * comma or dot. Negative, non-numeric and absurdly large values are rejected
 * and NOT counted.
 */
export function parseAmount(raw: string): ParsedAmount {
  const text = raw.replace(/[\s  ]/g, '')
  if (text === '') return { kind: 'empty' }
  if (/^-/.test(text)) return { kind: 'invalid', error: 'negative' }

  // «12,» is accepted while the user is still typing the cents.
  const match = /^(\d+)(?:[.,](\d{0,2}))?$/.exec(text)
  if (!match) return { kind: 'invalid', error: 'not_a_number' }

  const whole = match[1].replace(/^0+(?=\d)/, '')
  if (whole.length > 7) return { kind: 'invalid', error: 'too_large' }
  const cents = Number(whole) * 100 + Number((match[2] ?? '').padEnd(2, '0'))
  if (cents > MAX_MANUAL_CENTS) return { kind: 'invalid', error: 'too_large' }
  return { kind: 'ok', cents }
}

function manualCents(raw: string): number | null {
  const parsed = parseAmount(raw)
  return parsed.kind === 'ok' ? parsed.cents : null
}

// ---------------------------------------------------------------------------
// Sights from route.json

export interface SightItem {
  id: string
  title: string
  day: number
  /** Entry price per adult; null — not known yet. */
  price: Price | null
}

/** Paid points of the route, in route order. Prices come from route.json only. */
export function paidSights(route: Route): SightItem[] {
  return route.days.flatMap((day) =>
    day.points
      .filter((p) => p.admission.value === 'paid' || p.price !== null)
      .map((p) => ({ id: p.id, title: p.title, day: day.day, price: p.price })),
  )
}

// ---------------------------------------------------------------------------
// Airport transfer

/** How many vehicles a group needs: 5 people in 4-seat taxis → 2 cars. */
export function vehiclesNeeded(travelers: number, capacity: number | undefined): number {
  if (!capacity || capacity < 1) return 1
  return Math.ceil(travelers / capacity)
}

/** How many units of the price the group pays: people or vehicles. */
export function transferUnits(option: TransferOption, travelers: number): number {
  return option.pricing === 'per_vehicle' ? vehiclesNeeded(travelers, option.vehicleCapacity) : travelers
}

/** How many times one unit pays the price for there and back: 2 one-way tickets or 1 return ticket. */
export function transferTrips(option: TransferOption): number {
  return option.trip === 'round_trip' ? 1 : 2
}

/** The chosen city transport already includes this transfer, e.g. a pass with airport metro rides. */
export function transferIncluded(option: TransferOption, transportId: string): boolean {
  return option.includedInTransport?.includes(transportId) ?? false
}

// ---------------------------------------------------------------------------
// User selection

export interface BudgetSelection {
  travelers: number
  foodId: string
  transportId: string
  transferId: string
  /** Sights switched OFF. Stored this way so newly added sights start switched on. */
  excludedSightIds: string[]
  /** Raw text of the manual fields, exactly as typed. */
  extra: string
  /** Per person, there and back. */
  flights: string
  /** For the whole group and the whole stay. */
  lodging: string
}

export function clampTravelers(value: unknown): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? Math.trunc(value) : MIN_TRAVELERS
  return Math.min(MAX_TRAVELERS, Math.max(MIN_TRAVELERS, n))
}

function validId<T extends BudgetOption>(group: OptionGroup<T>, id: unknown): string {
  return typeof id === 'string' && group.options.some((o) => o.id === id) ? id : group.defaultId
}

function validText(value: unknown): string {
  return typeof value === 'string' && value.length <= MAX_INPUT_LENGTH ? value : ''
}

export function defaultSelection(settings: BudgetSettings): BudgetSelection {
  return {
    travelers: clampTravelers(settings.defaultTravelers),
    foodId: settings.food.defaultId,
    transportId: settings.transport.defaultId,
    transferId: settings.transfer.defaultId,
    excludedSightIds: [],
    extra: '',
    flights: '',
    lodging: '',
  }
}

/**
 * Turns anything (e.g. JSON from localStorage written by an older version,
 * or edited by hand) into a valid selection. Unknown or broken fields fall
 * back to defaults one by one, so one bad field does not reset the rest.
 */
export function sanitizeSelection(raw: unknown, settings: BudgetSettings, sights: SightItem[]): BudgetSelection {
  const defaults = defaultSelection(settings)
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return defaults
  const r = raw as Record<string, unknown>
  const sightIds = new Set(sights.map((s) => s.id))
  return {
    travelers:
      typeof r.travelers === 'number' && Number.isFinite(r.travelers) ? clampTravelers(r.travelers) : defaults.travelers,
    foodId: validId(settings.food, r.foodId),
    transportId: validId(settings.transport, r.transportId),
    transferId: validId(settings.transfer, r.transferId),
    excludedSightIds: Array.isArray(r.excludedSightIds)
      ? [...new Set(r.excludedSightIds.filter((id): id is string => typeof id === 'string' && sightIds.has(id)))]
      : [],
    extra: validText(r.extra),
    flights: validText(r.flights),
    lodging: validText(r.lodging),
  }
}

// ---------------------------------------------------------------------------
// Calculation

export type BudgetLineId = 'food' | 'sights' | 'transport' | 'transfer' | 'extra' | 'flights' | 'lodging'

export interface BudgetLine {
  id: BudgetLineId
  /** For the whole group, in cents. null — not counted (no price or nothing entered). */
  cents: Range | null
  /**
   * Whole euros for display. Rounded together with the other lines, so the
   * shown lines always add up to the shown total. null when `cents` is null.
   */
  euros: Range | null
  /** Uses at least one price marked «needs_check». */
  needsCheck: boolean
}

export interface BudgetResult {
  travelers: number
  days: number
  lines: BudgetLine[]
  /** For the whole group, in cents. */
  total: Range
  /** Whole euros, rounded for display. */
  totalEuros: Range
  perPersonEuros: Range
  /** Switched-on sights whose price is unknown, left out of the total. */
  unpricedSights: number
  /** Taxis needed for the transfer, if a per-vehicle option is chosen. */
  vehicles: number | null
  /** The chosen transfer is already part of the chosen city transport and costs nothing extra. */
  transferIncluded: boolean
  /** At least one counted amount is unverified — the total is approximate. */
  needsCheck: boolean
  missingFlights: boolean
  missingLodging: boolean
}

export interface BudgetInput {
  settings: BudgetSettings
  days: number
  sights: SightItem[]
  selection: BudgetSelection
}

function findOption<T extends BudgetOption>(group: OptionGroup<T>, id: string): T {
  const option = group.options.find((o) => o.id === id) ?? group.options.find((o) => o.id === group.defaultId)
  if (!option) throw new Error(`No option «${id}» and no default «${group.defaultId}»`)
  return option
}

type RawLine = Omit<BudgetLine, 'euros'>

function optionLine(id: BudgetLineId, price: Price | null, factor: number): RawLine {
  if (!price) return { id, cents: null, needsCheck: false }
  return { id, cents: scale(priceToCents(price), factor), needsCheck: price.status === 'needs_check' }
}

function manualLine(id: BudgetLineId, raw: string, factor: number): RawLine {
  const cents = manualCents(raw)
  return { id, cents: cents === null ? null : { min: cents * factor, max: cents * factor }, needsCheck: false }
}

/**
 * Splits a rounded total between parts (largest remainder method): every
 * part gets its whole euros rounded down, then the euros still missing to
 * reach the rounded total go one by one to the parts with the largest
 * leftover cents (earlier part wins a tie). The result always sums to
 * `centsToEuros(sum of parts)` and each part differs from its exact value
 * by less than 1 €.
 */
export function allocateEuros(parts: number[]): number[] {
  const total = centsToEuros(parts.reduce((sum, c) => sum + c, 0))
  const euros = parts.map((c) => Math.floor(c / 100))
  let missing = total - euros.reduce((sum, e) => sum + e, 0)
  const order = parts.map((_, i) => i).sort((a, b) => (parts[b] % 100) - (parts[a] % 100) || a - b)
  for (const i of order) {
    if (missing <= 0) break
    if (parts[i] % 100 === 0) continue
    euros[i] += 1
    missing -= 1
  }
  return euros
}

/** Adds display euros to the counted lines, separately for min and max. */
function withEuros(lines: RawLine[]): BudgetLine[] {
  const counted = lines.filter((l) => l.cents !== null)
  const mins = allocateEuros(counted.map((l) => l.cents!.min))
  const maxes = allocateEuros(counted.map((l) => l.cents!.max))
  return lines.map((line) => {
    const i = counted.indexOf(line)
    return { ...line, euros: i === -1 ? null : { min: mins[i], max: maxes[i] } }
  })
}

export function calculateBudget({ settings, days, sights, selection }: BudgetInput): BudgetResult {
  const travelers = clampTravelers(selection.travelers)
  const tripDays = Math.max(1, Math.trunc(days))

  const food = findOption(settings.food, selection.foodId)
  const transport = findOption(settings.transport, selection.transportId)
  const transfer = findOption(settings.transfer, selection.transferId)

  const excluded = new Set(selection.excludedSightIds)
  const chosenSights = sights.filter((s) => !excluded.has(s.id))
  const pricedSights = chosenSights.filter((s) => s.price !== null)
  const sightsLine: RawLine = {
    id: 'sights',
    cents:
      pricedSights.length === 0
        ? null
        : scale(
            pricedSights.reduce((sum, s) => add(sum, priceToCents(s.price as Price)), ZERO),
            travelers,
          ),
    needsCheck: pricedSights.some((s) => s.price?.status === 'needs_check'),
  }

  const units = transferUnits(transfer, travelers)
  const included = transferIncluded(transfer, transport.id)
  const transferLine: RawLine = included
    ? // Already paid for in the transport line: counted, but adds nothing.
      { id: 'transfer', cents: { ...ZERO }, needsCheck: false }
    : // There and back: 2 one-way tickets or 1 return ticket per unit.
      optionLine('transfer', transfer.price, transferTrips(transfer) * units)
  const lines = withEuros([
    optionLine('food', food.price, tripDays * travelers),
    sightsLine,
    optionLine('transport', transport.price, travelers),
    transferLine,
    manualLine('extra', selection.extra, 1),
    manualLine('flights', selection.flights, travelers),
    manualLine('lodging', selection.lodging, 1),
  ])

  const total = lines.reduce((sum, line) => (line.cents ? add(sum, line.cents) : sum), ZERO)
  const flightsLine = lines.find((l) => l.id === 'flights')
  const lodgingLine = lines.find((l) => l.id === 'lodging')

  return {
    travelers,
    days: tripDays,
    lines,
    total,
    totalEuros: { min: centsToEuros(total.min), max: centsToEuros(total.max) },
    perPersonEuros: {
      min: divideRounded(total.min, 100 * travelers),
      max: divideRounded(total.max, 100 * travelers),
    },
    unpricedSights: chosenSights.length - pricedSights.length,
    vehicles: transfer.pricing === 'per_vehicle' && !included ? units : null,
    transferIncluded: included,
    needsCheck: lines.some((l) => l.cents !== null && l.needsCheck),
    missingFlights: flightsLine?.cents == null,
    missingLodging: lodgingLine?.cents == null,
  }
}

// ---------------------------------------------------------------------------
// Display

/** 12345 → «12 345» with a non-breaking space, so «12» and «345 €» never split. */
export function formatNumber(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}

/** Whole-euro range: «650–1 100 €»; a single number when min = max. */
export function formatRange(euros: Range, currency: Currency): string {
  const symbol = currencySymbol(currency)
  if (euros.min === euros.max) return `${formatNumber(euros.min)} ${symbol}`
  return `${formatNumber(euros.min)}–${formatNumber(euros.max)} ${symbol}`
}

/** Unit price of an option, kept exact: «7,25–7,45 €», «13 €», «Цена уточняется». */
export function formatUnitPrice(price: Price | null): string {
  if (!price) return 'Цена уточняется'
  const money = (amount: number) => {
    const cents = toCents(amount)
    const whole = formatNumber(Math.floor(cents / 100))
    const rest = cents % 100
    return rest === 0 ? whole : `${whole},${String(rest).padStart(2, '0')}`
  }
  const symbol = currencySymbol(price.currency)
  if (price.min === price.max) return `${money(price.min)} ${symbol}`
  return `${money(price.min)}–${money(price.max)} ${symbol}`
}
