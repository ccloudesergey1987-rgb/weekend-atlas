import { describe, expect, it } from 'vitest'
import { GOOGLE_CARD_SOURCE, type Weekday } from '../types/content'
import { WEEKDAYS, WEEKDAY_SHORT, servesDuring, toMinutes } from '../lib/schedule'
import { getCityContent, listCityIds } from './index'

const STATUSES = ['verified', 'needs_check', 'estimate', 'not_applicable']
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

  it('«не применимо» — только для «адреса»-района и свободного входа у обедов и прогулок', () => {
    for (const p of points) {
      for (const [field, fact] of Object.entries(p) as [string, unknown][]) {
        const item = fact as { status?: string } | null
        if (item?.status !== 'not_applicable') continue
        expect(p.kind, `${p.id}.${field}`).not.toBe('sight')
        expect(['address', 'admission'], `${p.id}.${field}`).toContain(field)
      }
    }
    for (const { path, item } of findProvenance({ places: content.places, budget: content.budget })) {
      expect(item.status, path).not.toBe('not_applicable')
    }
  })

  it('«Карточка Google» — только у заведений без надёжного официального сайта', () => {
    for (const place of content.places.places) {
      const fromGoogle = findProvenance(place).filter(({ item }) => item.source === GOOGLE_CARD_SOURCE)
      if (fromGoogle.length === 0) continue
      expect(place.website, `${place.id}: есть официальный сайт — карточка Google не нужна`).toBeNull()
      for (const { item } of fromGoogle) expect(String(item.checkedAt), place.id).toMatch(ISO_DATE)
    }
    for (const { path, item } of findProvenance(content.route)) {
      expect(item.source, path).not.toBe(GOOGLE_CARD_SOURCE)
    }
  })

  it('в трансфере нет поезда R2 Nord — только Аэробус, метро, такси и «не нужен»', () => {
    expect(content.budget.transfer.options.map((o) => o.id).sort()).toEqual(['aerobus', 'aerobus-return', 'metro-l9', 'none', 'taxi'])
  })

  it('«оценка редакции» — только для переходов, такси по тарифу, чека по меню и уровней питания, и с пояснением', () => {
    const allowed = new Set<unknown>([
      ...points.map((p) => p.transferFromPrevious),
      ...content.budget.transfer.options.filter((o) => o.pricing === 'per_vehicle').map((o) => o.price),
      ...content.places.places.map((p) => p.price),
      ...content.budget.food.options.map((o) => o.price),
      // Вход в общественный парк или на площадь — не билет, его можно оценить.
      ...points.filter((p) => p.kind === 'free').map((p) => p.admission),
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
          expect(place.price.source, place.id).toMatch(/^(https:\/\/|Google Maps, данные посетителей$)/)
          expect(String(place.price.note ?? ''), place.id).toMatch(/\d/)
          if (place.price.from) expect(place.price.max, place.id).toBe(place.price.min)
        } else if (place.type === 'market') {
          // У рынка чек зависит от покупок — на карточке «Цена зависит от выбора».
          expect(place.priceNote, place.id).toBeUndefined()
        } else {
          expect(place.priceNote?.trim(), `${place.id}: нет причины, почему нет цены`).toBeTruthy()
        }
      }
    })

    it('пометка о брони — с официального сайта или из карточки Google Maps', () => {
      for (const place of places.filter((p) => p.reservation)) {
        expect(['recommended', 'not_accepted'], place.id).toContain(place.reservation!.value)
        expect(place.reservation!.status, place.id).toBe('verified')
        expect(place.reservation!.source, place.id).toMatch(/^(https:\/\/|Google Maps)/)
      }
    })

    it('есть разные типы заведений', () => {
      const types = new Set(places.map((p) => p.type))
      for (const t of ['tapas', 'restaurant', 'cafe', 'market', 'bakery']) expect(types, t).toContain(t)
      expect(places.length).toBeGreaterThanOrEqual(12)
    })

    it('расписание по дням недели: все 7 дней, время корректно, проверенное — с официальной страницы', () => {
      for (const place of places.filter((p) => p.schedule)) {
        const schedule = place.schedule!
        expect(Object.keys(schedule.value).sort(), place.id).toEqual([...WEEKDAYS].sort())
        for (const day of WEEKDAYS) {
          for (const [from, to] of schedule.value[day] ?? []) {
            expect(toMinutes(from), `${place.id} ${day}`).toBeLessThanOrEqual(toMinutes(to))
          }
        }
        if (schedule.status === 'verified') expect(schedule.source, place.id).toMatch(/^(https:\/\/|Карточка Google$)/)
        expect(schedule.status, place.id).not.toBe('estimate')
      }
    })

    // Аудитория ездит пт–вс или сб–пн: на каждый обед и ужин маршрута в его
    // районе должно быть открыто хотя бы одно место, где можно поесть, —
    // по проверенным часам, а не по догадке.
    const WEEKEND: Weekday[] = ['fri', 'sat', 'sun', 'mon']
    const MEAL_TYPES = new Set(['tapas', 'restaurant', 'bar'])
    for (const meal of points.filter((p) => p.kind === 'meal')) {
      for (const day of WEEKEND) {
        it(`${meal.title} (${meal.time}) — в ${WEEKDAY_SHORT[day]} есть где поесть в районе «${meal.area}»`, () => {
          const open = places.filter(
            (p) =>
              p.area === meal.area &&
              MEAL_TYPES.has(p.type) &&
              p.schedule?.status === 'verified' &&
              servesDuring(p.schedule.value, day, meal.time!, 60),
          )
          expect(open.map((p) => p.name), `${meal.id}, ${day}`).not.toEqual([])
        })
      }
    }

    it('на сайты с рекламой ставок, спамом или переадресацией ссылок нет', () => {
      for (const id of ['el-xampanyet', 'quimet-quimet', 'la-pubilla', 'escriba-gran-via']) {
        const place = places.find((p) => p.id === `${cityId}/${id}`)!
        expect(place, id).toBeTruthy()
        expect(place.website, id).toBeNull()
        expect(place.websiteWarning?.trim(), id).toBeTruthy()
      }
      for (const place of places.filter((p) => p.websiteWarning)) {
        expect(place.website, place.id).toBeNull()
        // Пометку о брони с такого сайта не берём — только из Google Maps.
        if (place.reservation) expect(place.reservation.source, place.id).toMatch(/^Google Maps/)
      }
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
