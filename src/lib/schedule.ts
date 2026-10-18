/**
 * Weekly schedules of places: which days they are closed and whether you can
 * sit down to eat at a given time. Pure functions, no React.
 */

import type { WeekSchedule, Weekday } from '../types/content'

export const WEEKDAYS: readonly Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

/** «пн», «вт»… for compact lists. */
export const WEEKDAY_SHORT: Record<Weekday, string> = {
  mon: 'пн',
  tue: 'вт',
  wed: 'ср',
  thu: 'чт',
  fri: 'пт',
  sat: 'сб',
  sun: 'вс',
}

/** «13:00» → 780, «24:30» → 1470. Throws on anything else, so broken data fails the tests. */
export function toMinutes(time: string): number {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time)
  if (!match || Number(match[2]) > 59) throw new Error(`Invalid time: ${time}`)
  return Number(match[1]) * 60 + Number(match[2])
}

/** Days with no hours at all. Days the source does not mention are not «closed». */
export function closedDays(schedule: WeekSchedule): Weekday[] {
  return WEEKDAYS.filter((d) => schedule[d]?.length === 0)
}

/** Days the official source does not mention. */
export function unknownDays(schedule: WeekSchedule): Weekday[] {
  return WEEKDAYS.filter((d) => schedule[d] === null)
}

/** «пн, вт» — or «пн–ср» for three and more days in a row. */
export function formatDays(days: readonly Weekday[]): string {
  const idx = days.map((d) => WEEKDAYS.indexOf(d)).sort((a, b) => a - b)
  const parts: string[] = []
  for (let i = 0; i < idx.length; ) {
    let j = i
    while (j + 1 < idx.length && idx[j + 1] === idx[j] + 1) j++
    const run = idx.slice(i, j + 1).map((k) => WEEKDAY_SHORT[WEEKDAYS[k]])
    parts.push(run.length >= 3 ? `${run[0]}–${run[run.length - 1]}` : run.join(', '))
    i = j + 1
  }
  return parts.join(', ')
}

/**
 * Can you start eating there within the meal slot on that day? True when one
 * of the day's ranges overlaps [start, start + window). Unknown days are false:
 * we never promise what the source does not say.
 */
export function servesDuring(schedule: WeekSchedule, day: Weekday, start: string, windowMin: number): boolean {
  const ranges = schedule[day]
  if (!ranges) return false
  const from = toMinutes(start)
  const to = from + windowMin
  return ranges.some(([a, b]) => toMinutes(a) < to && toMinutes(b) > from)
}
