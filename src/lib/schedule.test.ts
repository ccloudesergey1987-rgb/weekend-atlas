import { describe, expect, it } from 'vitest'
import type { WeekSchedule } from '../types/content'
import { closedDays, formatDays, servesDuring, toMinutes, unknownDays } from './schedule'

const lunchAndDinner: WeekSchedule = {
  mon: [],
  tue: [],
  wed: [['13:00', '15:15'], ['20:00', '22:30']],
  thu: [['13:00', '15:15'], ['20:00', '22:30']],
  fri: [['20:00', '24:00']],
  sat: [['13:00', '15:15'], ['20:00', '25:30']],
  sun: null,
}

describe('расписание по дням недели', () => {
  it('переводит время в минуты, включая время после полуночи', () => {
    expect(toMinutes('00:00')).toBe(0)
    expect(toMinutes('13:15')).toBe(795)
    expect(toMinutes('24:30')).toBe(1470)
    expect(() => toMinutes('13.15')).toThrow()
    expect(() => toMinutes('12:75')).toThrow()
  })

  it('закрытые дни — пустой список, а «не указано» закрытым не считается', () => {
    expect(closedDays(lunchAndDinner)).toEqual(['mon', 'tue'])
    expect(unknownDays(lunchAndDinner)).toEqual(['sun'])
  })

  it('дни подряд пишутся через тире', () => {
    expect(formatDays(['mon', 'tue'])).toBe('пн, вт')
    expect(formatDays(['sun', 'mon', 'tue', 'wed'])).toBe('пн–ср, вс')
    expect(formatDays(['mon', 'tue', 'wed', 'fri'])).toBe('пн–ср, пт')
    expect(formatDays([])).toBe('')
  })

  it('можно поесть, если окно работы пересекается с первым часом приёма пищи', () => {
    // обед в 12:45: кухня открывается в 13:00 — успеваем
    expect(servesDuring(lunchAndDinner, 'wed', '12:45', 60)).toBe(true)
    // обед в 15:30: кухня закрылась в 15:15
    expect(servesDuring(lunchAndDinner, 'wed', '15:30', 60)).toBe(false)
    // в пятницу только ужин
    expect(servesDuring(lunchAndDinner, 'fri', '13:00', 60)).toBe(false)
    expect(servesDuring(lunchAndDinner, 'fri', '20:00', 60)).toBe(true)
    // после полуночи
    expect(servesDuring(lunchAndDinner, 'sat', '24:45', 30)).toBe(true)
  })

  it('закрытый и неизвестный день — нельзя', () => {
    expect(servesDuring(lunchAndDinner, 'mon', '13:00', 60)).toBe(false)
    expect(servesDuring(lunchAndDinner, 'sun', '13:00', 60)).toBe(false)
  })
})
