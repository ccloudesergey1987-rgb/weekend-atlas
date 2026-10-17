import { useEffect } from 'react'
import { Navigate, NavLink, useParams } from 'react-router'
import { getCityContent } from '../../data'
import type { RouteDay } from '../../types/content'
import { VerificationBadge } from '../../components/VerificationBadge/VerificationBadge'
import { formatTransfer, pluralize } from '../../utils/format'
import { SightCard } from './SightCard'
import { BreakCard } from './BreakCard'
import styles from './RouteScreen.module.css'

const LAST_DAY_KEY = 'weekend-atlas:last-route-day'

function rememberDay(day: number): void {
  try {
    sessionStorage.setItem(LAST_DAY_KEY, String(day))
  } catch {
    // storage unavailable — not critical
  }
}

function lastDay(): number {
  try {
    return Number(sessionStorage.getItem(LAST_DAY_KEY)) || 1
  } catch {
    return 1
  }
}

/** /route → the last opened day (or day 1). */
export function RouteIndexRedirect() {
  const { route } = getCityContent()
  const day = route.days.some((d) => d.day === lastDay()) ? lastDay() : route.days[0].day
  return <Navigate to={`/route/${day}`} replace />
}

function DaySummary({ day }: { day: RouteDay }) {
  const points = day.points.length
  const paid = day.points.filter((p) => p.admission.value === 'paid').length
  const unknown = day.points.filter((p) => p.admission.value === 'unknown').length

  const stats = [
    `${points} ${pluralize(points, ['точка', 'точки', 'точек'])}`,
    paid > 0
      ? `${paid} ${pluralize(paid, ['платный вход', 'платных входа', 'платных входов'])}`
      : 'без платных входов',
  ]
  if (unknown > 0) stats.push(`${unknown} — вход уточняется`)

  return (
    <header className={styles.summary}>
      <h2 className={styles.dayTitle}>{day.title}</h2>
      <p className={styles.areas}>{day.areas.join(' · ')}</p>
      <p className={styles.stats}>{stats.join(' · ')}</p>
      <p className={styles.dayText}>{day.summary}</p>
    </header>
  )
}

export function RouteScreen() {
  const { route } = getCityContent()
  const params = useParams()
  const dayNumber = Number(params.day)
  const day = route.days.find((d) => d.day === dayNumber)

  useEffect(() => {
    if (day) rememberDay(day.day)
  }, [day])

  if (!day) return <Navigate to={`/route/${route.days[0].day}`} replace />

  return (
    <section className={styles.screen}>
      <h1 className={styles.title}>Маршрут</h1>

      <nav className={styles.tabs} aria-label="Дни маршрута">
        {route.days.map((d) => (
          <NavLink
            key={d.day}
            to={`/route/${d.day}`}
            replace
            className={({ isActive }) => (isActive ? `${styles.tab} ${styles.tabActive}` : styles.tab)}
          >
            День {d.day}
          </NavLink>
        ))}
      </nav>

      <DaySummary day={day} />

      <ol className={styles.timeline}>
        {day.points.map((point) => (
          <li key={point.id} className={styles.step}>
            {point.transferFromPrevious && (
              <p className={styles.transfer}>
                <span>{formatTransfer(point.transferFromPrevious)}</span>{' '}
                <VerificationBadge status={point.transferFromPrevious.status} />
              </p>
            )}
            <div className={styles.stop}>
              <span
                className={point.kind === 'sight' ? styles.marker : `${styles.marker} ${styles.markerLight}`}
                aria-hidden="true"
              />
              {point.kind === 'sight' ? <SightCard point={point} /> : <BreakCard point={point} />}
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}
