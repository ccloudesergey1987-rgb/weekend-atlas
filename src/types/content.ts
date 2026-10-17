/**
 * Content model for a Weekend Atlas city guide.
 *
 * Every fact or price carries its verification state. Unverified data is
 * shown in the UI with a «Требует проверки» label. Never put invented
 * values here: use `null` when something is unknown.
 */

export type VerificationStatus = 'verified' | 'needs_check'

/** Where a fact came from and when it was last checked. */
export interface Provenance {
  status: VerificationStatus
  /** URL or short description of the source; empty string if none yet. */
  source: string
  /** ISO date (YYYY-MM-DD) of the last check, or null if never checked. */
  checkedAt: string | null
}

/** A single fact such as an address, opening hours or an official URL. */
export interface Fact<T> extends Provenance {
  value: T
}

export type Currency = 'EUR' | 'RUB' | 'USD'

/** Price range. `min === max` means a fixed price. */
export interface Price extends Provenance {
  min: number
  max: number
  currency: Currency
}

/** A licensed or own photo. `src: null` renders a placeholder. */
export interface Photo {
  src: string | null
  alt: string
  /** Author and license, e.g. «Фото: Имя Фамилия, CC BY-SA 4.0, Wikimedia Commons». */
  credit: string | null
}

/** Links shared by route points and places. */
export interface Links {
  /** Plain Google Maps link, no API key. */
  mapUrl: string | null
  /** Official website or ticket page. */
  website: Fact<string> | null
  /** Reserved for future affiliate links; not shown in the MVP. */
  partnerUrl?: string | null
}

// ---------------------------------------------------------------------------
// city.json

export interface City {
  id: string
  name: string
  /** Name in the local language, e.g. «Barcelona». */
  localName: string
  /** Guide title, e.g. «Барселона за 72 часа». */
  title: string
  description: string
  durationDays: number
  cover: Photo
}

// ---------------------------------------------------------------------------
// route.json

/** `sight` — attraction, `meal` — food break, `free` — free time / walk. */
export type RoutePointKind = 'sight' | 'meal' | 'free'

/** `unknown` — not yet known whether entry is paid. */
export type Admission = 'paid' | 'free' | 'unknown'

export type TransferMode = 'walk' | 'metro' | 'bus' | 'taxi'

/** How to get to a point from the previous one. Time is an estimate. */
export interface Transfer extends Provenance {
  mode: TransferMode
  minutes: number
}

export interface RoutePoint extends Links {
  /**
   * Permanent ID «<cityId>/<name>», e.g. «barcelona/sagrada-familia». Favorites
   * store it, so never change it and never put the day number in it.
   */
  id: string
  kind: RoutePointKind
  title: string
  /** Name in the local language, if different. */
  localName?: string
  description: string
  /** Longer text shown under «Подробнее». */
  details?: string
  /** Suggested time of day, e.g. «10:00». Not a fact, a planning hint. */
  time?: string
  /** Suggested duration in minutes. */
  durationMin?: number
  /**
   * Neighbourhood from `RouteDay.areas`. Required for meals: «Где поесть рядом»
   * opens the places screen filtered by it, so it must match `Place.area`.
   */
  area?: string
  /** For meals and free time — the area or square, not a specific venue. */
  address: Fact<string>
  /** Every route point must open on the map. */
  mapUrl: string
  openingHours: Fact<string> | null
  admission: Fact<Admission>
  /** Entry price per adult; null — «Цена уточняется». */
  price: Price | null
  /** Official ticket page. Required for paid entry unless `ticketsNote` explains why not. */
  tickets: Fact<string> | null
  /** Why there is no ticket link, e.g. «Билеты продаются на входе». */
  ticketsNote?: string
  /** Absent for the first point of the day. */
  transferFromPrevious?: Transfer
  photo?: Photo
}

export interface RouteDay {
  day: number
  title: string
  /** Neighbourhoods covered this day. */
  areas: string[]
  summary: string
  points: RoutePoint[]
}

export interface Route {
  cityId: string
  days: RouteDay[]
}

// ---------------------------------------------------------------------------
// places.json

export type PlaceType = 'tapas' | 'restaurant' | 'cafe' | 'market' | 'bar' | 'bakery'

/**
 * 1 — недорого (€), 2 — средне (€€), 3 — дорого (€€€).
 * Never stored in JSON: computed from `Place.price` in src/utils/priceLevel.ts.
 */
export type PriceLevel = 1 | 2 | 3

export interface Place extends Links {
  /** Permanent ID «<cityId>/<name>», like `RoutePoint.id`. */
  id: string
  type: PlaceType
  name: string
  /** True for illustrative entries that are not real venues. */
  isExample: boolean
  description: string
  /** Must match a name from `RouteDay.areas` exactly, e.g. «Борн». */
  area: string
  /** Approximate average bill per person; null — «Цена уточняется». */
  price: Price | null
  address: Fact<string> | null
  /** Every place must open on the map. */
  mapUrl: string
  openingHours: Fact<string> | null
  photo?: Photo
}

export interface Places {
  cityId: string
  places: Place[]
}

// ---------------------------------------------------------------------------
// budget.json
//
// Entry tickets are NOT stored here: the calculator takes them from
// route.json, so each price lives in exactly one place. Trip length comes
// from `City.durationDays`.

/** A selectable option. `price: null` — «Цена уточняется», never counted as 0. */
export interface BudgetOption {
  id: string
  title: string
  description: string
  price: Price | null
}

/** Food level. Price is per person per day. */
export type FoodLevel = BudgetOption

/** City transport for the whole trip. Price is per person. */
export type TransportOption = BudgetOption

/** `per_person` — public transport ticket; `per_vehicle` — taxi, shared by the group. */
export type TransferPricing = 'per_person' | 'per_vehicle'

/** Airport transfer. Price is ONE WAY; the calculator doubles it for the way back. */
export interface TransferOption extends BudgetOption {
  pricing: TransferPricing
  /** Passengers per vehicle, required for `per_vehicle` (4 for a regular taxi). */
  vehicleCapacity?: number
}

export interface OptionGroup<T extends BudgetOption> {
  defaultId: string
  options: T[]
}

export interface BudgetSettings {
  cityId: string
  currency: Currency
  defaultTravelers: number
  food: OptionGroup<FoodLevel>
  transport: OptionGroup<TransportOption>
  transfer: OptionGroup<TransferOption>
}
