import { Link } from 'react-router'
import type { RoutePoint } from '../../types/content'
import { ExternalLink } from '../../components/ExternalLink/ExternalLink'
import { VerificationBadge } from '../../components/VerificationBadge/VerificationBadge'
import { placesNearPath } from '../PlacesScreen/placeFilters'
import { PointMeta } from './PointMeta'
import styles from './RouteCards.module.css'

const kindLabel = {
  meal: 'Еда',
  free: 'Свободное время',
} as const

/** Lighter card for meals and free time. */
export function BreakCard({ point }: { point: RoutePoint }) {
  const label = point.kind === 'meal' ? kindLabel.meal : kindLabel.free

  return (
    <article className={styles.break}>
      <PointMeta point={point} label={<span className={styles.breakKind}>{label}</span>} />
      <h3 className={styles.breakTitle}>{point.title}</h3>
      <p className={styles.description}>{point.description}</p>
      <p className={styles.breakFooter}>
        <ExternalLink href={point.mapUrl} className={styles.inlineLink}>
          {point.address.value}
        </ExternalLink>{' '}
        <VerificationBadge status={point.address.status} />
      </p>
      {point.kind === 'meal' && point.area && (
        <Link to={placesNearPath(point.area)} className={styles.nearbyButton}>
          Где поесть рядом
        </Link>
      )}
    </article>
  )
}
