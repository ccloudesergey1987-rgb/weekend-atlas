import { describe, expect, it } from 'vitest'
import type { BudgetSettings, Price, VerificationStatus } from '../types/content'
import { getCityContent } from '../data'
import type { BudgetSelection, SightItem } from './budget'
import {
  MAX_TRAVELERS,
  allocateEuros,
  calculateBudget,
  centsToEuros,
  clampTravelers,
  defaultSelection,
  divideRounded,
  formatRange,
  formatUnitPrice,
  paidSights,
  parseAmount,
  sanitizeSelection,
  toCents,
  vehiclesNeeded,
} from './budget'

const eur = (min: number, max: number, status: VerificationStatus = 'needs_check'): Price => ({
  min,
  max,
  currency: 'EUR',
  status,
  source: status === 'verified' ? 'тест' : '',
  checkedAt: status === 'verified' ? '2026-10-18' : null,
})

// Условные цены только для тестов — не данные Барселоны.
const settings: BudgetSettings = {
  cityId: 'test',
  currency: 'EUR',
  defaultTravelers: 2,
  food: {
    defaultId: 'medium',
    options: [
      { id: 'zero', title: 'Ноль', description: '', price: eur(0, 0, 'verified') },
      { id: 'economy', title: 'Экономно', description: '', price: eur(30, 45) },
      { id: 'medium', title: 'Средне', description: '', price: eur(45, 80) },
      { id: 'fixed', title: 'Фикс', description: '', price: eur(50, 50, 'verified') },
      { id: 'unknown', title: 'Без цены', description: '', price: null },
    ],
  },
  transport: {
    defaultId: 'casual',
    options: [
      { id: 'casual', title: 'Разовые', description: '', price: eur(13, 13) },
      { id: 'pass', title: 'Проездной', description: '', price: null },
      { id: 'pass-airport', title: 'Проездной с метро в аэропорт', description: '', price: eur(25, 27.5, 'verified') },
      { id: 'walk', title: 'Пешком', description: '', price: eur(0, 0, 'verified') },
    ],
  },
  transfer: {
    defaultId: 'bus',
    options: [
      { id: 'bus', title: 'Автобус', description: '', pricing: 'per_person', trip: 'one_way', price: eur(7.25, 7.45) },
      { id: 'bus-return', title: 'Автобус туда-обратно', description: '', pricing: 'per_person', trip: 'round_trip', price: eur(13.3, 13.3, 'verified') },
      { id: 'metro', title: 'Метро', description: '', pricing: 'per_person', trip: 'one_way', includedInTransport: ['pass-airport'], price: eur(5.9, 5.9, 'verified') },
      { id: 'taxi', title: 'Такси', description: '', pricing: 'per_vehicle', trip: 'one_way', vehicleCapacity: 4, price: eur(30, 45) },
      { id: 'none', title: 'Не нужен', description: '', pricing: 'per_person', trip: 'round_trip', price: eur(0, 0, 'verified') },
    ],
  },
}

const sights: SightItem[] = [
  { id: 'a', title: 'A', day: 1, price: eur(12, 12, 'verified') },
  { id: 'b', title: 'B', day: 2, price: eur(25.5, 30) },
  { id: 'c', title: 'C', day: 3, price: null },
]
const ALL_SIGHTS = sights.map((s) => s.id)

/** Everything costs 0, so each test switches on only the category it checks. */
const empty: BudgetSelection = {
  travelers: 1,
  foodId: 'zero',
  transportId: 'walk',
  transferId: 'none',
  excludedSightIds: ALL_SIGHTS,
  extra: '',
  flights: '',
  lodging: '',
}

function calc(selection: Partial<BudgetSelection>, days = 3) {
  return calculateBudget({ settings, days, sights, selection: { ...empty, ...selection } })
}

function line(selection: Partial<BudgetSelection>, id: string, days = 3) {
  return calc(selection, days).lines.find((l) => l.id === id)!
}

describe('целые центы и округление', () => {
  it('переводит цены в центы без ошибок плавающей точки', () => {
    expect(toCents(7.45)).toBe(745)
    expect(toCents(0.1) + toCents(0.2)).toBe(30)
    expect(toCents(19.99)).toBe(1999)
    expect(toCents(0)).toBe(0)
  })

  it('не принимает отрицательные и нечисловые цены', () => {
    expect(() => toCents(-1)).toThrow()
    expect(() => toCents(Number.NaN)).toThrow()
    expect(() => toCents(Number.POSITIVE_INFINITY)).toThrow()
  })

  it('округляет до целых евро по правилу «половина — вверх»', () => {
    expect(centsToEuros(0)).toBe(0)
    expect(centsToEuros(1249)).toBe(12)
    expect(centsToEuros(1250)).toBe(13)
    expect(centsToEuros(1299)).toBe(13)
    expect(divideRounded(10, 3)).toBe(3)
    expect(divideRounded(5, 2)).toBe(3)
  })

  it('суммирует в центах и округляет только итог', () => {
    // 0,10 € + 0,20 € = 0,30 €, ×5 человек = 1,50 € → 2 €
    const cheap: SightItem[] = [
      { id: 'x', title: 'X', day: 1, price: eur(0.1, 0.1) },
      { id: 'y', title: 'Y', day: 1, price: eur(0.2, 0.2) },
    ]
    const r = calculateBudget({ settings, days: 3, sights: cheap, selection: { ...empty, excludedSightIds: [], travelers: 5 } })
    expect(r.total).toEqual({ min: 150, max: 150 })
    expect(r.totalEuros).toEqual({ min: 2, max: 2 })
  })
})

describe('питание', () => {
  it('цена × дни × путешественники', () => {
    expect(line({ foodId: 'medium', travelers: 2 }, 'food').cents).toEqual({ min: 45 * 3 * 2 * 100, max: 80 * 3 * 2 * 100 })
    expect(line({ foodId: 'economy', travelers: 1 }, 'food', 4).cents).toEqual({ min: 30 * 4 * 100, max: 45 * 4 * 100 })
  })

  it('уровень без цены не считается нулём', () => {
    const r = calc({ foodId: 'unknown' })
    expect(r.lines.find((l) => l.id === 'food')!.cents).toBeNull()
  })
})

describe('достопримечательности', () => {
  it('сумма включённых точек × путешественники', () => {
    const r = calc({ excludedSightIds: [], travelers: 2 })
    expect(r.lines.find((l) => l.id === 'sights')!.cents).toEqual({ min: (12 + 25.5) * 2 * 100, max: (12 + 30) * 2 * 100 })
  })

  it('выключенная точка не считается', () => {
    expect(line({ excludedSightIds: ['b'], travelers: 1 }, 'sights').cents).toEqual({ min: 1200, max: 1200 })
  })

  it('точки без цены не считаются нулём, а подсчитываются отдельно', () => {
    expect(calc({ excludedSightIds: [] }).unpricedSights).toBe(1)
    expect(calc({ excludedSightIds: ['c'] }).unpricedSights).toBe(0)
  })

  it('если включены только точки без цены — категория не учтена, а не 0', () => {
    const r = calc({ excludedSightIds: ['a', 'b'] })
    expect(r.lines.find((l) => l.id === 'sights')!.cents).toBeNull()
    expect(r.unpricedSights).toBe(1)
  })

  it('из маршрута берутся только платные точки и точки с ценой', () => {
    const { route } = getCityContent()
    const list = paidSights(route)
    const points = route.days.flatMap((d) => d.points)
    expect(list.length).toBe(points.filter((p) => p.admission.value === 'paid' || p.price !== null).length)
    expect(list.every((s) => points.find((p) => p.id === s.id)!.price === s.price)).toBe(true)
  })
})

describe('городской транспорт', () => {
  it('цена × путешественники', () => {
    expect(line({ transportId: 'casual', travelers: 3 }, 'transport').cents).toEqual({ min: 3900, max: 3900 })
  })

  it('вариант без цены не учитывается', () => {
    expect(line({ transportId: 'pass' }, 'transport').cents).toBeNull()
  })
})

describe('трансфер из аэропорта', () => {
  it('общественный транспорт — на человека, туда и обратно', () => {
    // 7,25–7,45 € × 2 поездки × 2 человека
    expect(line({ transferId: 'bus', travelers: 2 }, 'transfer').cents).toEqual({ min: 2900, max: 2980 })
  })

  it('такси на 1 человека: машина целиком на одного', () => {
    const r = calc({ transferId: 'taxi', travelers: 1 })
    expect(r.lines.find((l) => l.id === 'transfer')!.cents).toEqual({ min: 6000, max: 9000 })
    expect(r.perPersonEuros).toEqual({ min: 60, max: 90 })
    expect(r.vehicles).toBe(1)
  })

  it('такси на 4 человек: одна машина делится на всех', () => {
    const r = calc({ transferId: 'taxi', travelers: 4 })
    expect(r.lines.find((l) => l.id === 'transfer')!.cents).toEqual({ min: 6000, max: 9000 })
    expect(r.vehicles).toBe(1)
    // 60 € / 4 = 15 €, 90 € / 4 = 22,50 € → 23 €
    expect(r.perPersonEuros).toEqual({ min: 15, max: 23 })
  })

  it('такси на 5 человек: нужны две машины', () => {
    const r = calc({ transferId: 'taxi', travelers: 5 })
    expect(r.vehicles).toBe(2)
    expect(r.lines.find((l) => l.id === 'transfer')!.cents).toEqual({ min: 12000, max: 18000 })
  })

  it('число машин', () => {
    expect(vehiclesNeeded(1, 4)).toBe(1)
    expect(vehiclesNeeded(4, 4)).toBe(1)
    expect(vehiclesNeeded(5, 4)).toBe(2)
    expect(vehiclesNeeded(6, 4)).toBe(2)
    expect(vehiclesNeeded(3, undefined)).toBe(1)
  })

  it('для общественного транспорта машины не показываются', () => {
    expect(calc({ transferId: 'bus' }).vehicles).toBeNull()
  })

  it('билет туда-обратно считается один раз на человека', () => {
    // 13,30 € × 1 билет × 3 человека
    expect(line({ transferId: 'bus-return', travelers: 3 }, 'transfer').cents).toEqual({ min: 3990, max: 3990 })
    // Для сравнения: два билета в одну сторону на 3 человек — 7,25–7,45 € × 2 × 3
    expect(line({ transferId: 'bus', travelers: 3 }, 'transfer').cents).toEqual({ min: 4350, max: 4470 })
  })

  it('«не нужен» туда-обратно остаётся нулём', () => {
    expect(line({ transferId: 'none', travelers: 4 }, 'transfer').cents).toEqual({ min: 0, max: 0 })
  })

  it('трансфер, который уже входит в выбранный проездной, ничего не добавляет', () => {
    const r = calc({ transferId: 'metro', transportId: 'pass-airport', travelers: 2 })
    expect(r.lines.find((l) => l.id === 'transfer')!.cents).toEqual({ min: 0, max: 0 })
    expect(r.transferIncluded).toBe(true)
    // Проездной считается как обычно: 25–27,50 € × 2
    expect(r.total).toEqual({ min: 5000, max: 5500 })
  })

  it('без такого проездного метро в аэропорт оплачивается: туда и обратно', () => {
    const r = calc({ transferId: 'metro', transportId: 'casual', travelers: 2 })
    expect(r.lines.find((l) => l.id === 'transfer')!.cents).toEqual({ min: 2360, max: 2360 })
    expect(r.transferIncluded).toBe(false)
  })
})

describe('ручные суммы', () => {
  it('разбирает суммы с запятой, точкой и пробелами', () => {
    expect(parseAmount('120')).toEqual({ kind: 'ok', cents: 12000 })
    expect(parseAmount('12,5')).toEqual({ kind: 'ok', cents: 1250 })
    expect(parseAmount('12.05')).toEqual({ kind: 'ok', cents: 1205 })
    expect(parseAmount(' 1 200 ')).toEqual({ kind: 'ok', cents: 120000 })
    expect(parseAmount('12,')).toEqual({ kind: 'ok', cents: 1200 })
    expect(parseAmount('007')).toEqual({ kind: 'ok', cents: 700 })
    expect(parseAmount('0')).toEqual({ kind: 'ok', cents: 0 })
  })

  it('пустое поле — это «не указано», а не ошибка', () => {
    expect(parseAmount('')).toEqual({ kind: 'empty' })
    expect(parseAmount('   ')).toEqual({ kind: 'empty' })
  })

  it('отклоняет отрицательные, нечисловые и слишком большие значения', () => {
    expect(parseAmount('-5')).toEqual({ kind: 'invalid', error: 'negative' })
    expect(parseAmount('- 5')).toEqual({ kind: 'invalid', error: 'negative' })
    for (const bad of ['abc', '12a', '+5', '1e3', '12.345', '1,2,3', 'NaN', 'Infinity', '.5', '€5']) {
      expect(parseAmount(bad), bad).toEqual({ kind: 'invalid', error: 'not_a_number' })
    }
    expect(parseAmount('10000000')).toEqual({ kind: 'invalid', error: 'too_large' })
    expect(parseAmount('1000000,01')).toEqual({ kind: 'invalid', error: 'too_large' })
    expect(parseAmount('1000000')).toEqual({ kind: 'ok', cents: 100_000_000 })
  })

  it('прочие расходы и проживание — на всех, авиабилеты — на человека', () => {
    const r = calc({ travelers: 2, extra: '100', lodging: '450,50', flights: '250' })
    expect(r.lines.find((l) => l.id === 'extra')!.cents).toEqual({ min: 10000, max: 10000 })
    expect(r.lines.find((l) => l.id === 'lodging')!.cents).toEqual({ min: 45050, max: 45050 })
    expect(r.lines.find((l) => l.id === 'flights')!.cents).toEqual({ min: 50000, max: 50000 })
    expect(r.total).toEqual({ min: 105050, max: 105050 })
  })

  it('пустые и некорректные суммы не попадают в итог', () => {
    const r = calc({ extra: '-50', flights: 'abc', lodging: '' })
    expect(r.lines.filter((l) => ['extra', 'flights', 'lodging'].includes(l.id)).every((l) => l.cents === null)).toBe(true)
    expect(r.total).toEqual({ min: 0, max: 0 })
  })

  it('пометка «без авиабилетов и проживания» снимается, только когда они добавлены', () => {
    expect(calc({})).toMatchObject({ missingFlights: true, missingLodging: true })
    expect(calc({ flights: '200' })).toMatchObject({ missingFlights: false, missingLodging: true })
    expect(calc({ flights: '200', lodging: '300' })).toMatchObject({ missingFlights: false, missingLodging: false })
    expect(calc({ flights: 'abc' })).toMatchObject({ missingFlights: true })
  })
})

describe('округление строк и итога', () => {
  it('распределяет евро так, что сумма частей равна округлённому итогу', () => {
    // 3 × 0,50 € = 1,50 € → 2 €; по отдельности каждая строка округлилась бы до 1 €, и сумма была бы 3 €
    expect(allocateEuros([50, 50, 50])).toEqual([1, 1, 0])
    // 10,40 + 10,40 + 10,40 = 31,20 → 31; по отдельности 10 + 10 + 10 = 30
    expect(allocateEuros([1040, 1040, 1040])).toEqual([11, 10, 10])
    expect(allocateEuros([1060, 1060])).toEqual([11, 10])
    expect(allocateEuros([1200, 3000])).toEqual([12, 30])
    expect(allocateEuros([])).toEqual([])
    expect(allocateEuros([0, 49])).toEqual([0, 0])
  })

  it('каждая часть отличается от точного значения меньше чем на 1 €', () => {
    const parts = [1999, 1, 2550, 49, 51, 12345]
    allocateEuros(parts).forEach((e, i) => expect(Math.abs(e * 100 - parts[i]), String(i)).toBeLessThan(100))
  })

  it('строки расчёта всегда складываются в показанный итог', () => {
    const foods = ['zero', 'economy', 'medium', 'fixed', 'unknown']
    const transports = ['casual', 'pass', 'pass-airport', 'walk']
    const transfers = ['bus', 'bus-return', 'metro', 'taxi', 'none']
    const extras = ['', '0,50', '10,49', '33,33']
    let checked = 0
    for (const foodId of foods)
      for (const transportId of transports)
        for (const transferId of transfers)
          for (const extra of extras)
            for (const travelers of [1, 3, 5]) {
              const r = calc({ foodId, transportId, transferId, extra, travelers, excludedSightIds: ['c'], lodging: '100,50' })
              const shown = r.lines.filter((l) => l.euros !== null)
              const sum = shown.reduce((s, l) => ({ min: s.min + l.euros!.min, max: s.max + l.euros!.max }), { min: 0, max: 0 })
              expect(sum, JSON.stringify({ foodId, transportId, transferId, extra, travelers })).toEqual(r.totalEuros)
              checked += 1
            }
    expect(checked).toBe(5 * 4 * 5 * 4 * 3)
  })

  it('строка без цены не получает евро', () => {
    const r = calc({ foodId: 'unknown' })
    expect(r.lines.find((l) => l.id === 'food')!.euros).toBeNull()
  })
})

describe('итог', () => {
  it('складывает все категории и делит на человека', () => {
    const r = calc({
      travelers: 2,
      foodId: 'medium', // 270–480
      excludedSightIds: [], // 75–84
      transportId: 'casual', // 26
      transferId: 'taxi', // 60–90 на машину
      extra: '40',
    })
    expect(r.totalEuros).toEqual({ min: 270 + 75 + 26 + 60 + 40, max: 480 + 84 + 26 + 90 + 40 })
    expect(r.perPersonEuros).toEqual({ min: 236, max: 360 })
  })

  it('мин = макс показывается одним числом', () => {
    const r = calc({ foodId: 'fixed', travelers: 1 }, 1)
    expect(r.totalEuros).toEqual({ min: 50, max: 50 })
    expect(formatRange(r.totalEuros, 'EUR')).toBe('50 €')
    expect(formatRange({ min: 650, max: 1100 }, 'EUR')).toBe('650–1 100 €')
    expect(formatRange({ min: 0, max: 0 }, 'EUR')).toBe('0 €')
  })

  it('цена варианта показывается точно, с запятой', () => {
    expect(formatUnitPrice(eur(7.25, 7.45))).toBe('7,25–7,45 €')
    expect(formatUnitPrice(eur(13, 13))).toBe('13 €')
    expect(formatUnitPrice(eur(7.5, 1200))).toBe('7,50–1 200 €')
    expect(formatUnitPrice(null)).toBe('Цена уточняется')
  })

  it('пометка «ориентировочно», только если в итог вошли непроверенные цены', () => {
    expect(calc({}).needsCheck).toBe(false)
    expect(calc({ foodId: 'fixed' }).needsCheck).toBe(false)
    expect(calc({ transportId: 'casual' }).needsCheck).toBe(true)
    expect(calc({ excludedSightIds: ['a', 'c'] }).needsCheck).toBe(true)
    // Непроверенная, но выключенная точка не влияет.
    expect(calc({ excludedSightIds: ['b', 'c'] }).needsCheck).toBe(false)
  })

  it('количество путешественников ограничено 1–6', () => {
    expect(clampTravelers(0)).toBe(1)
    expect(clampTravelers(-3)).toBe(1)
    expect(clampTravelers(99)).toBe(MAX_TRAVELERS)
    expect(clampTravelers(2.7)).toBe(2)
    expect(clampTravelers(Number.NaN)).toBe(1)
    expect(calc({ travelers: 10, transportId: 'casual' }).lines.find((l) => l.id === 'transport')!.cents).toEqual({
      min: 13 * 6 * 100,
      max: 13 * 6 * 100,
    })
  })
})

describe('сохранённый выбор и сброс', () => {
  it('сброс возвращает значения по умолчанию из budget.json', () => {
    expect(defaultSelection(settings)).toEqual({
      travelers: 2,
      foodId: 'medium',
      transportId: 'casual',
      transferId: 'bus',
      excludedSightIds: [],
      extra: '',
      flights: '',
      lodging: '',
    })
  })

  it('корректный сохранённый выбор восстанавливается без изменений', () => {
    const saved: BudgetSelection = { ...empty, travelers: 4, foodId: 'economy', excludedSightIds: ['a'], extra: '12,5' }
    expect(sanitizeSelection(JSON.parse(JSON.stringify(saved)), settings, sights)).toEqual(saved)
  })

  it('пустое или испорченное сохранение даёт значения по умолчанию', () => {
    for (const raw of [null, undefined, 42, 'text', [], { foo: 1 }]) {
      expect(sanitizeSelection(raw, settings, sights)).toEqual(defaultSelection(settings))
    }
  })

  it('испорченные поля заменяются по одному, остальные сохраняются', () => {
    const r = sanitizeSelection(
      {
        travelers: '3',
        foodId: 'economy',
        transportId: 'deleted-option',
        transferId: 'taxi',
        excludedSightIds: ['a', 'a', 'gone', 5],
        extra: 123,
        flights: 'x'.repeat(100),
        lodging: '300',
      },
      settings,
      sights,
    )
    expect(r).toEqual({
      travelers: 2,
      foodId: 'economy',
      transportId: 'casual',
      transferId: 'taxi',
      excludedSightIds: ['a'],
      extra: '',
      flights: '',
      lodging: '300',
    })
    expect(sanitizeSelection({ travelers: 42 }, settings, sights).travelers).toBe(MAX_TRAVELERS)
  })
})

describe('данные Барселоны', () => {
  const content = getCityContent()

  it('калькулятор считает настройки по умолчанию без ошибок', () => {
    const list = paidSights(content.route)
    const r = calculateBudget({
      settings: content.budget,
      days: content.city.durationDays,
      sights: list,
      selection: defaultSelection(content.budget),
    })
    expect(r.days).toBe(content.city.durationDays)
    expect(r.totalEuros.min).toBeLessThanOrEqual(r.totalEuros.max)
    expect(r.unpricedSights).toBe(list.filter((s) => s.price === null).length)
  })
})
