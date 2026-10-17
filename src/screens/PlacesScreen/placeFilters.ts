import type { Place, PlaceType, PriceLevel } from '../../types/content'
import { PRICE_LEVELS, priceLevel } from '../../utils/priceLevel'

/**
 * Filters of the «Еда и места» screen and how they live in the page address.
 *
 *   #/places?type=tapas&type=bar&price=1&price=2&area=Борн
 *
 * Inside one group the options are combined with «или» (tapas OR bar),
 * between groups with «и» (type AND price AND area).
 */
export interface PlaceFilters {
  types: PlaceType[]
  levels: PriceLevel[]
  /** Set by «Где поесть рядом» from the route; one area at a time. */
  area: string | null
}

export const NO_FILTERS: PlaceFilters = { types: [], levels: [], area: null }

/** Chip order and texts. `label` — for the card, `chip` — for the filter. */
export const PLACE_TYPES: readonly { id: PlaceType; label: string; chip: string }[] = [
  { id: 'tapas', label: 'Тапас-бар', chip: 'Тапас' },
  { id: 'restaurant', label: 'Ресторан', chip: 'Рестораны' },
  { id: 'cafe', label: 'Кофейня', chip: 'Кофейни' },
  { id: 'bar', label: 'Бар', chip: 'Бары' },
  { id: 'market', label: 'Рынок', chip: 'Рынки' },
  { id: 'bakery', label: 'Пекарня', chip: 'Пекарни' },
]

export function placeTypeLabel(type: PlaceType): string {
  return PLACE_TYPES.find((t) => t.id === type)?.label ?? type
}

/**
 * Reads filters from the address. Unknown or broken values are dropped,
 * so an old or hand-edited link never breaks the screen.
 */
export function parseFilters(params: URLSearchParams, knownAreas: readonly string[]): PlaceFilters {
  const typeParams = params.getAll('type')
  const priceParams = params.getAll('price')
  const area = params.get('area')
  return {
    types: PLACE_TYPES.map((t) => t.id).filter((id) => typeParams.includes(id)),
    levels: PRICE_LEVELS.filter((level) => priceParams.includes(String(level))),
    area: area !== null && knownAreas.includes(area) ? area : null,
  }
}

/** Filters → address parameters. Empty filters → no parameters. */
export function filtersToParams(filters: PlaceFilters): URLSearchParams {
  const params = new URLSearchParams()
  for (const type of filters.types) params.append('type', type)
  for (const level of filters.levels) params.append('price', String(level))
  if (filters.area) params.set('area', filters.area)
  return params
}

export function hasActiveFilters(filters: PlaceFilters): boolean {
  return filters.types.length > 0 || filters.levels.length > 0 || filters.area !== null
}

/** Adds the value if it is missing, removes it if present. */
export function toggle<T>(list: readonly T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
}

/**
 * Places matching the filters, in the original order.
 * With a price filter on, places with an unknown price are hidden:
 * we cannot honestly say they are «€» or «€€».
 */
export function filterPlaces(places: readonly Place[], filters: PlaceFilters): Place[] {
  return places.filter((place) => {
    if (filters.area !== null && place.area !== filters.area) return false
    if (filters.types.length > 0 && !filters.types.includes(place.type)) return false
    if (filters.levels.length > 0) {
      const level = priceLevel(place.price)
      if (level === null || !filters.levels.includes(level)) return false
    }
    return true
  })
}

/** Link from a route meal to the places screen filtered by its area. */
export function placesNearPath(area: string): string {
  return `/places?${filtersToParams({ ...NO_FILTERS, area })}`
}
