import { describe, expect, it } from 'vitest'
import { getCityContent, listCityIds } from './index'

const STATUSES = ['verified', 'needs_check']
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/** Every object with a `status` field anywhere inside `value`, with its path. */
function findProvenance(value: unknown, path = ''): { path: string; item: Record<string, unknown> }[] {
  if (Array.isArray(value)) return value.flatMap((v, i) => findProvenance(v, `${path}[${i}]`))
  if (value === null || typeof value !== 'object') return []
  const obj = value as Record<string, unknown>
  const own = 'status' in obj ? [{ path, item: obj }] : []
  return [...own, ...Object.entries(obj).flatMap(([k, v]) => findProvenance(v, path ? `${path}.${k}` : k))]
}

describe.each(listCityIds())('данные города %s', (cityId) => {
  const content = getCityContent(cityId)
  const points = content.route.days.flatMap((d) => d.points)

  it('у каждой точки маршрута есть адрес', () => {
    for (const p of points) {
      expect(p.address?.value?.trim(), p.id).toBeTruthy()
    }
  })

  it('у каждой точки маршрута есть ссылка на Google Maps без API-ключа', () => {
    for (const p of points) {
      expect(p.mapUrl, p.id).toMatch(/^https:\/\/www\.google\.com\/maps\//)
      expect(p.mapUrl, p.id).not.toMatch(/[?&]key=/)
    }
  })

  it('у каждой платной точки есть ссылка на билеты или пометка, что её нет', () => {
    for (const p of points.filter((p) => p.admission.value === 'paid')) {
      const hasLink = Boolean(p.tickets?.value)
      const hasNote = Boolean(p.ticketsNote?.trim())
      expect(hasLink || hasNote, p.id).toBe(true)
    }
  })

  it('ссылки на билеты и сайты ведут на https', () => {
    for (const p of points) {
      if (p.tickets) expect(p.tickets.value, p.id).toMatch(/^https:\/\//)
      if (p.website) expect(p.website.value, p.id).toMatch(/^https:\/\//)
    }
  })

  it('у каждой точки, кроме первой в дне, указан переход от предыдущей', () => {
    for (const day of content.route.days) {
      day.points.forEach((p, i) => {
        if (i === 0) expect(p.transferFromPrevious, p.id).toBeUndefined()
        else expect(p.transferFromPrevious?.minutes, p.id).toBeGreaterThan(0)
      })
    }
  })

  it('идентификаторы точек и заведений не повторяются', () => {
    const ids = [...points.map((p) => p.id), ...content.places.places.map((p) => p.id)]
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('у каждого факта и цены корректный статус; проверенное — с источником и датой', () => {
    for (const { path, item } of findProvenance(content)) {
      expect(STATUSES, path).toContain(item.status)
      expect(item, path).toHaveProperty('source')
      expect(item, path).toHaveProperty('checkedAt')
      if (item.status === 'verified') {
        expect(String(item.source).trim(), `${path}: нет источника`).not.toBe('')
        expect(String(item.checkedAt), `${path}: нет даты проверки`).toMatch(ISO_DATE)
      }
    }
  })

  it('у цен минимум не больше максимума', () => {
    const prices = [
      ...points.map((p) => p.price),
      ...content.places.places.map((p) => p.price),
      ...[content.budget.food, content.budget.transport, content.budget.transfer].flatMap((g) =>
        g.options.map((o) => o.price),
      ),
    ].filter((p) => p !== null)
    for (const price of prices) {
      expect(price.min).toBeGreaterThanOrEqual(0)
      expect(price.min).toBeLessThanOrEqual(price.max)
    }
  })

  it('у каждого заведения есть ссылка на Google Maps без API-ключа', () => {
    for (const place of content.places.places) {
      expect(place.mapUrl, place.id).toMatch(/^https:\/\/www\.google\.com\/maps\//)
      expect(place.mapUrl, place.id).not.toMatch(/[?&]key=/)
      if (place.website) expect(place.website.value, place.id).toMatch(/^https:\/\//)
    }
  })

  it('уровень цены не хранится в данных — он вычисляется из среднего чека', () => {
    for (const place of content.places.places) {
      expect(place, place.id).not.toHaveProperty('priceLevel')
    }
  })

  describe('районы маршрута и заведений называются одинаково', () => {
    const routeAreas = new Set(content.route.days.flatMap((d) => d.areas))
    const placeAreas = new Set(content.places.places.map((p) => p.area))

    it('район каждого заведения есть среди районов маршрута', () => {
      for (const place of content.places.places) {
        expect(routeAreas, `${place.id}: «${place.area}»`).toContain(place.area)
      }
    })

    it('у каждого обеда в маршруте указан район из списка районов его дня', () => {
      for (const day of content.route.days) {
        for (const point of day.points.filter((p) => p.kind === 'meal')) {
          expect(point.area, point.id).toBeTruthy()
          expect(day.areas, `${point.id}: «${point.area}»`).toContain(point.area)
        }
      }
    })

    it('у точки маршрута с районом он есть в списке районов её дня', () => {
      for (const day of content.route.days) {
        for (const point of day.points.filter((p) => p.area !== undefined)) {
          expect(day.areas, `${point.id}: «${point.area}»`).toContain(point.area)
        }
      }
    })

    it('для каждого обеда в маршруте есть хотя бы одно заведение в том же районе', () => {
      for (const point of points.filter((p) => p.kind === 'meal')) {
        expect(placeAreas, `${point.id}: «${point.area}»`).toContain(point.area)
      }
    })
  })

  it('в бюджете вариант по умолчанию существует, а id не повторяются', () => {
    for (const group of [content.budget.food, content.budget.transport, content.budget.transfer]) {
      const ids = group.options.map((o) => o.id)
      expect(ids).toContain(group.defaultId)
      expect(new Set(ids).size).toBe(ids.length)
    }
  })

  it('у трансфера «на машину» указана вместимость', () => {
    for (const option of content.budget.transfer.options) {
      expect(['per_person', 'per_vehicle'], option.id).toContain(option.pricing)
      if (option.pricing === 'per_vehicle') expect(option.vehicleCapacity, option.id).toBeGreaterThanOrEqual(1)
    }
  })

  it('цены бюджета в валюте города', () => {
    for (const group of [content.budget.food, content.budget.transport, content.budget.transfer]) {
      for (const option of group.options) {
        if (option.price) expect(option.price.currency, option.id).toBe(content.budget.currency)
      }
    }
  })

  it('примеры заведений явно помечены в названии', () => {
    for (const place of content.places.places.filter((p) => p.isExample)) {
      expect(place.name, place.id).toMatch(/^Пример:/)
    }
  })
})
