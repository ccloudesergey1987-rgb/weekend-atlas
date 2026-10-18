import { describe, expect, it } from 'vitest'
import { getCityContent, listCityIds } from './index'

const STATUSES = ['verified', 'needs_check', 'estimate']
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
/** «barcelona/sagrada-familia»: city prefix, then a name without the day number. */
const STABLE_ID = /^[a-z0-9-]+\/[a-z0-9-]+$/

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

  it('идентификаторы точек и заведений постоянные: «город/имя»', () => {
    const ids = [...points.map((p) => p.id), ...content.places.places.map((p) => p.id)]
    for (const id of ids) {
      expect(id).toMatch(STABLE_ID)
      expect(id.split('/')[0], id).toBe(cityId)
    }
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

  it('проверенный факт маршрута и цена бюджета ссылаются на страницу источника', () => {
    const budgetPrices = [content.budget.food, content.budget.transport, content.budget.transfer].flatMap((g) =>
      g.options.map((o) => ({ path: `budget.${o.id}`, item: o.price as Record<string, unknown> | null })),
    )
    const items = [
      ...findProvenance(content.route, 'route'),
      // «0 €» за «пешком» или «трансфер не нужен» источника не требует.
      ...budgetPrices.filter((p) => p.item !== null && p.item.max !== 0),
    ]
    for (const { path, item } of items) {
      if (item!.status === 'verified') expect(String(item!.source), path).toMatch(/^https:\/\//)
    }
  })

  it('если значение сверяли, но оставили «needs_check», указана причина', () => {
    for (const { path, item } of findProvenance(content)) {
      if (item.status === 'needs_check' && item.checkedAt !== null) {
        expect(String(item.note ?? '').trim(), `${path}: нет причины`).not.toBe('')
      }
    }
  })

  it('«оценка редакции» — только для переходов, такси по тарифу, чека по меню и уровней питания, и с пояснением', () => {
    const allowed = new Set<unknown>([
      ...points.map((p) => p.transferFromPrevious),
      ...content.budget.transfer.options.filter((o) => o.pricing === 'per_vehicle').map((o) => o.price),
      ...content.places.places.map((p) => p.price),
      ...content.budget.food.options.map((o) => o.price),
    ])
    for (const { path, item } of findProvenance(content)) {
      if (item.status !== 'estimate') continue
      expect(allowed.has(item), `${path}: цены, часы и адреса не могут быть оценкой`).toBe(true)
      expect(String(item.note ?? '').trim(), `${path}: нет пояснения к оценке`).not.toBe('')
    }
  })

  describe('дни закрытия', () => {
    const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
    const withClosures = points.filter((p) => p.closures?.length)

    it('у каждой точки с днями закрытия есть альтернатива или подсказка, как перестроить день', () => {
      for (const p of withClosures) {
        for (const c of p.closures!) {
          expect(Boolean(c.alternative) || Boolean(c.advice?.trim()), `${p.id}: ${c.days}`).toBe(true)
        }
      }
    })

    it('дни недели корректны, а закрытие взято из проверенных часов', () => {
      for (const p of withClosures) {
        for (const c of p.closures!) {
          expect(c.days.length, p.id).toBeGreaterThan(0)
          for (const d of c.days) expect(WEEKDAYS, p.id).toContain(d)
          expect(['closed', 'partial'], p.id).toContain(c.kind)
          expect(c.text.trim(), p.id).not.toBe('')
          expect(c.source, p.id).toMatch(/^https:\/\//)
        }
        const days = p.closures!.flatMap((c) => c.days)
        expect(new Set(days).size, `${p.id}: день повторяется`).toBe(days.length)
      }
    })

    it('альтернатива — реальное место с адресом, часами и ссылкой на карту', () => {
      for (const p of withClosures) {
        for (const alt of p.closures!.flatMap((c) => (c.alternative ? [c.alternative] : []))) {
          expect(alt.title.trim(), p.id).not.toBe('')
          expect(alt.address.value.trim(), p.id).not.toBe('')
          expect(alt.openingHours.value.trim(), p.id).not.toBe('')
          expect(alt.mapUrl, p.id).toMatch(/^https:\/\/www\.google\.com\/maps\//)
          if (alt.website) expect(alt.website.value, p.id).toMatch(/^https:\/\//)
        }
      }
    })
  })

  it('ссылка в подсказке на карточке ведёт на https', () => {
    for (const p of points.filter((p) => p.tip?.link)) {
      expect(p.tip!.link!.url, p.id).toMatch(/^https:\/\//)
    }
  })

  it('у трансфера указано «в одну сторону» или «туда-обратно», а проездные в нём существуют', () => {
    const transportIds = content.budget.transport.options.map((o) => o.id)
    for (const option of content.budget.transfer.options) {
      expect(['one_way', 'round_trip'], option.id).toContain(option.trip)
      for (const id of option.includedInTransport ?? []) expect(transportIds, option.id).toContain(id)
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

  describe('заведения', () => {
    const places = content.places.places

    it('в каждом районе обеда и ужина маршрута — минимум 2 заведения («Где поесть рядом»)', () => {
      for (const point of points.filter((p) => p.kind === 'meal')) {
        const near = places.filter((p) => p.area === point.area)
        expect(near.length, `${point.id}: «${point.area}»`).toBeGreaterThanOrEqual(2)
      }
    })

    it('каждое заведение рекомендуют минимум два независимых источника со ссылками', () => {
      for (const place of places) {
        const hosts = place.recommendedBy.map((r) => {
          expect(r.name.trim(), place.id).not.toBe('')
          expect(r.url, place.id).toMatch(/^https:\/\//)
          return new URL(r.url).hostname.replace(/^(www|diumenge)\./, '')
        })
        const names = new Set(place.recommendedBy.map((r) => r.name))
        expect(names.size, `${place.id}: источники должны быть разными`).toBeGreaterThanOrEqual(2)
        expect(new Set(hosts).size, `${place.id}: источники с одного сайта`).toBeGreaterThanOrEqual(2)
      }
    })

    it('средний чек — оценка по официальному меню со ссылкой и расчётом, либо нет цены с причиной', () => {
      for (const place of places) {
        if (place.price) {
          expect(place.price.status, place.id).toBe('estimate')
          expect(place.price.source, place.id).toMatch(/^https:\/\//)
          expect(String(place.price.note ?? ''), place.id).toMatch(/\d/)
        } else {
          expect(place.priceNote?.trim(), `${place.id}: нет причины, почему нет цены`).toBeTruthy()
        }
      }
    })

    it('пометка о брони взята с официального сайта', () => {
      for (const place of places.filter((p) => p.reservation)) {
        expect(['recommended', 'not_accepted'], place.id).toContain(place.reservation!.value)
        expect(place.reservation!.status, place.id).toBe('verified')
      }
    })

    it('есть все типы заведений и уровни цены', () => {
      expect(new Set(places.map((p) => p.type))).toEqual(new Set(['tapas', 'restaurant', 'cafe', 'market', 'bakery']))
      expect(places.length).toBeGreaterThanOrEqual(12)
      expect(places.length).toBeLessThanOrEqual(15)
    })
  })

  it('примеров и заглушек среди заведений нет', () => {
    for (const place of content.places.places) {
      expect(place, place.id).not.toHaveProperty('isExample')
      expect(place.name, place.id).not.toMatch(/пример/i)
      if (place.website) expect(place.website.value, place.id).not.toMatch(/example.com/)
    }
  })
})

// Favorites keep bare IDs of all cities in one list, so an ID must be unique
// across the whole guide, not only within its city.
it('идентификаторы точек и заведений уникальны во всех городах', () => {
  const ids = listCityIds().flatMap((cityId) => {
    const { route, places } = getCityContent(cityId)
    return [...route.days.flatMap((d) => d.points.map((p) => p.id)), ...places.places.map((p) => p.id)]
  })
  const repeated = ids.filter((id, i) => ids.indexOf(id) !== i)
  expect(repeated).toEqual([])
})
