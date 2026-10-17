import { describe, expect, it } from 'vitest'
import type { Place, PlaceType, Price } from '../../types/content'
import {
  NO_FILTERS,
  filterPlaces,
  filtersToParams,
  hasActiveFilters,
  parseFilters,
  placesNearPath,
  toggle,
} from './placeFilters'

const eur = (min: number, max: number): Price => ({
  min,
  max,
  currency: 'EUR',
  status: 'needs_check',
  source: '',
  checkedAt: null,
})

function place(id: string, type: PlaceType, area: string, price: Price | null): Place {
  return {
    id,
    type,
    name: `Пример: ${id}`,
    isExample: true,
    description: '',
    area,
    price,
    address: null,
    mapUrl: 'https://www.google.com/maps/search/?api=1&query=Barcelona',
    openingHours: null,
    website: null,
  }
}

// Уровни: cafe €, tapas €€, restaurant €€€, bar €€, bakery — цена неизвестна
const places = [
  place('cafe', 'cafe', 'Грасия', eur(5, 10)),
  place('tapas', 'tapas', 'Борн', eur(20, 30)),
  place('restaurant', 'restaurant', 'Борн', eur(40, 60)),
  place('bar', 'bar', 'Грасия', eur(15, 25)),
  place('bakery', 'bakery', 'Борн', null),
]
const ids = (list: Place[]) => list.map((p) => p.id)
const AREAS = ['Борн', 'Грасия']

describe('filterPlaces', () => {
  it('без фильтров показывает всё в исходном порядке', () => {
    expect(ids(filterPlaces(places, NO_FILTERS))).toEqual(['cafe', 'tapas', 'restaurant', 'bar', 'bakery'])
  })

  it('по одному типу', () => {
    expect(ids(filterPlaces(places, { ...NO_FILTERS, types: ['tapas'] }))).toEqual(['tapas'])
  })

  it('несколько типов — «или»', () => {
    expect(ids(filterPlaces(places, { ...NO_FILTERS, types: ['cafe', 'bar'] }))).toEqual(['cafe', 'bar'])
  })

  it('несколько уровней цены — «или»', () => {
    expect(ids(filterPlaces(places, { ...NO_FILTERS, levels: [1, 3] }))).toEqual(['cafe', 'restaurant'])
  })

  it('при фильтре по цене места с неизвестной ценой скрываются', () => {
    const result = ids(filterPlaces(places, { ...NO_FILTERS, levels: [1, 2, 3] }))
    expect(result).not.toContain('bakery')
    expect(result).toHaveLength(4)
  })

  it('тип и цена вместе — «и»', () => {
    expect(ids(filterPlaces(places, { ...NO_FILTERS, types: ['tapas', 'bar', 'restaurant'], levels: [2] }))).toEqual([
      'tapas',
      'bar',
    ])
  })

  it('район вместе с типом и ценой', () => {
    expect(ids(filterPlaces(places, { types: ['tapas', 'bar'], levels: [2], area: 'Грасия' }))).toEqual(['bar'])
  })

  it('по району', () => {
    expect(ids(filterPlaces(places, { ...NO_FILTERS, area: 'Борн' }))).toEqual(['tapas', 'restaurant', 'bakery'])
  })

  it('пустой результат, если ничего не подходит', () => {
    expect(filterPlaces(places, { ...NO_FILTERS, types: ['cafe'], levels: [3] })).toEqual([])
    expect(filterPlaces(places, { ...NO_FILTERS, types: ['market'] })).toEqual([])
  })
})

describe('фильтры в адресе страницы', () => {
  it('туда и обратно без потерь', () => {
    const filters = { types: ['tapas', 'bar'], levels: [1, 2], area: 'Борн' } as const
    const params = filtersToParams({ ...filters, types: [...filters.types], levels: [...filters.levels] })
    expect(parseFilters(params, AREAS)).toEqual(filters)
  })

  it('пустые фильтры → пустой адрес', () => {
    expect(filtersToParams(NO_FILTERS).toString()).toBe('')
  })

  it('читает адрес вида ?type=cafe&price=2&area=…', () => {
    const params = new URLSearchParams('type=cafe&type=bar&price=2&area=%D0%93%D1%80%D0%B0%D1%81%D0%B8%D1%8F')
    expect(parseFilters(params, AREAS)).toEqual({ types: ['cafe', 'bar'], levels: [2], area: 'Грасия' })
  })

  it('неизвестные значения в адресе игнорируются', () => {
    const params = new URLSearchParams('type=pizza&type=cafe&price=7&price=abc&area=Марс')
    expect(parseFilters(params, AREAS)).toEqual({ types: ['cafe'], levels: [], area: null })
  })

  it('порядок в адресе не важен', () => {
    const a = parseFilters(new URLSearchParams('type=bar&type=cafe&price=3&price=1'), AREAS)
    const b = parseFilters(new URLSearchParams('type=cafe&type=bar&price=1&price=3'), AREAS)
    expect(a).toEqual(b)
  })

  it('ссылка «Где поесть рядом» открывает экран с фильтром по району', () => {
    const path = placesNearPath('Побле-сек')
    const [pathname, query] = path.split('?')
    expect(pathname).toBe('/places')
    expect(parseFilters(new URLSearchParams(query), ['Побле-сек'])).toEqual({ ...NO_FILTERS, area: 'Побле-сек' })
  })
})

describe('вспомогательные функции', () => {
  it('toggle добавляет и убирает значение', () => {
    expect(toggle(['a'], 'b')).toEqual(['a', 'b'])
    expect(toggle(['a', 'b'], 'a')).toEqual(['b'])
  })

  it('hasActiveFilters', () => {
    expect(hasActiveFilters(NO_FILTERS)).toBe(false)
    expect(hasActiveFilters({ ...NO_FILTERS, area: 'Борн' })).toBe(true)
    expect(hasActiveFilters({ ...NO_FILTERS, levels: [1] })).toBe(true)
  })
})
