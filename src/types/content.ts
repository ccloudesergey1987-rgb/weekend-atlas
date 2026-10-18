/**
 * Content model for a Weekend Atlas city guide.
 *
 * Every fact or price carries its verification state. Unverified data is
 * shown in the UI with a «Требует проверки» label. Never put invented
 * values here: use `null` when something is unknown.
 */

/**
 * `verified` — found on an official page; `needs_check` — not confirmed yet;
 * `estimate` — editorial estimate for values that can have no official source
 * (walking time between points, a taxi range computed from the official
 * tariff, an average bill computed from the official menu and the food
 * levels built from those bills). Entry prices, opening hours and
 * addresses are never `estimate`.
 */
export type VerificationStatus = 'verified' | 'needs_check' | 'estimate'

/** Where a fact came from and when it was last checked. */
export interface Provenance {
  status: VerificationStatus
  /** URL or short description of the source; empty string if none yet. */
  source: string
  /** ISO date (YYYY-MM-DD) of the last check, or null if never checked. */
  checkedAt: string | null
  /** Why the value is still «needs_check», or how an «estimate» was made. */
  note?: string
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
  /** Whether tickets must be booked in advance, in plain words. */
  booking?: Fact<string> | null
  /** Days when the point is closed or open only part of the day, from verified hours. */
  closures?: Closure[]
  /** Short practical tip shown on the card, optionally with a link. */
  tip?: Tip
  /** Absent for the first point of the day. */
  transferFromPrevious?: Transfer
  photo?: Photo
}

export type Weekday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'

/** A real place nearby that is open when a route point is not. */
export interface Alternative {
  title: string
  localName?: string
  description: string
  address: Fact<string>
  mapUrl: string
  openingHours: Fact<string>
  /** Entry price per adult; null — «Цена уточняется». */
  price: Price | null
  website: Fact<string> | null
}

/**
 * Closed or partly open days. The provenance points to the verified opening
 * hours it was taken from. Needs an `alternative`, an `advice`, or both.
 */
export interface Closure extends Provenance {
  days: Weekday[]
  /** `closed` — whole day; `partial` — shorter hours. */
  kind: 'closed' | 'partial'
  /** «В понедельник закрыто», «В воскресенье — только 14:00–17:00». */
  text: string
  alternative?: Alternative
  /** How to rebuild the day: without an alternative, or in addition to it. */
  advice?: string
}

export interface Tip {
  text: string
  link?: { url: string; label: string }
}

export interface RouteDay {
  day: number
  title: string
  /** Neighbourhoods covered this day. */
  areas: string[]
  summary: string
  /** Warning about days of the week, e.g. a museum closed on Mondays. */
  notice?: string
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

/** An independent guide or publication that recommends a place. */
export interface Recommendation {
  /** «Guía Michelin», «Time Out Barcelona». */
  name: string
  /** The page about this place (or a list that names it). */
  url: string
}

/** What the official site says about booking a table. */
export type Reservation = 'recommended' | 'not_accepted'

export interface Place extends Links {
  /** Permanent ID «<cityId>/<name>», like `RoutePoint.id`. */
  id: string
  type: PlaceType
  name: string
  description: string
  /** Must match a name from `RouteDay.areas` exactly, e.g. «Борн». */
  area: string
  /** At least two independent sources; the place is not listed without them. */
  recommendedBy: Recommendation[]
  /** From the official site only; absent when the site says nothing. */
  reservation?: Fact<Reservation>
  /**
   * Approximate average bill per person; null — «Цена уточняется».
   * An `estimate` is computed from the official menu, explained in `note`.
   */
  price: Price | null
  /** Why there is no price, e.g. «На официальном сайте нет меню с ценами». */
  priceNote?: string
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

/** `one_way` — the calculator doubles the price for the way back; `round_trip` — the price covers both ways. */
export type TransferTrip = 'one_way' | 'round_trip'

/** Airport transfer, there and back. */
export interface TransferOption extends BudgetOption {
  pricing: TransferPricing
  trip: TransferTrip
  /** Passengers per vehicle, required for `per_vehicle` (4 for a regular taxi). */
  vehicleCapacity?: number
  /** City transport options that already include this transfer, e.g. a pass with airport metro rides. */
  includedInTransport?: string[]
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
