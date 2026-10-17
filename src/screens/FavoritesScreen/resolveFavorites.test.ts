import { describe, expect, it } from 'vitest'
import { getCityContent } from '../../data'
import { resolveFavorites } from './resolveFavorites'

const { route, places } = getCityContent('barcelona')
const day3 = route.days.find((d) => d.day === 3)!.points.find((p) => p.kind === 'sight')!
const day1 = route.days.find((d) => d.day === 1)!.points.find((p) => p.kind === 'sight')!
const [firstPlace, secondPlace] = places.places

describe('избранное → точки маршрута и заведения', () => {
  it('раскладывает по группам с номером дня, в порядке путеводителя', () => {
    const result = resolveFavorites([secondPlace.id, day3.id, firstPlace.id, day1.id], route, places)
    expect(result.route.map((r) => [r.day, r.point.id])).toEqual([
      [1, day1.id],
      [3, day3.id],
    ])
    expect(result.places.map((p) => p.id)).toEqual([firstPlace.id, secondPlace.id])
  })

  it('молча пропускает ID, которых больше нет в данных', () => {
    const result = resolveFavorites(['barcelona/removed-point', 'lisbon/belem-tower', day1.id, ''], route, places)
    expect(result.route.map((r) => r.point.id)).toEqual([day1.id])
    expect(result.places).toEqual([])
  })

  it('пустое избранное — пустые группы', () => {
    expect(resolveFavorites([], route, places)).toEqual({ route: [], places: [] })
  })
})
