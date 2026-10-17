import type { ReactNode } from 'react'
import type { RoutePoint } from '../../types/content'
import { formatDuration } from '../../utils/format'
import styles from './RouteCards.module.css'

/** «Еда · 13:00 · 1 ч 30 мин». Each part wraps as a whole, never in the middle. */
export function PointMeta({ point, label }: { point: RoutePoint; label?: ReactNode }) {
  const parts: ReactNode[] = []
  if (label) parts.push(label)
  if (point.time) parts.push(point.time)
  if (point.durationMin) parts.push(formatDuration(point.durationMin))
  if (parts.length === 0) return null

  return (
    <p className={styles.meta}>
      {parts.map((part, i) => (
        <span key={i} className={styles.metaPart}>
          {i > 0 && ' · '}
          {part}
        </span>
      ))}
    </p>
  )
}
