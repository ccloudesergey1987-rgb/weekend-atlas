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
      ...content.budget.categories.map((c) => c.price),
    ].filter((p) => p !== null)
    for (const price of prices) {
      expect(price.min).toBeGreaterThanOrEqual(0)
      expect(price.min).toBeLessThanOrEqual(price.max)
    }
  })

  it('примеры заведений явно помечены в названии', () => {
    for (const place of content.places.places.filter((p) => p.isExample)) {
      expect(place.name, place.id).toMatch(/^Пример:/)
    }
  })
})
