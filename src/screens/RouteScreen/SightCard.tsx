import { useId, useState } from 'react'
import type { RoutePoint, VerificationStatus } from '../../types/content'
import { ExternalLink } from '../../components/ExternalLink/ExternalLink'
import { FavoriteButton } from '../../components/FavoriteButton/FavoriteButton'
import { cardElementId } from '../../lib/focusCard'
import { ImagePlaceholder } from '../../components/ImagePlaceholder/ImagePlaceholder'
import { VerificationBadge } from '../../components/VerificationBadge/VerificationBadge'
import { formatPrice } from '../../utils/format'
import { PointMeta } from './PointMeta'
import { ClosureHints } from './ClosureHints'
import styles from './RouteCards.module.css'

function worstStatus(...statuses: (VerificationStatus | undefined)[]): VerificationStatus {
  return statuses.includes('needs_check') ? 'needs_check' : 'verified'
}

function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

/** Entry line: price for paid entry, «Бесплатно», or «Уточняется». */
function admissionInfo(point: RoutePoint): { text: string; status: VerificationStatus | null } {
  const { admission, price, tickets } = point
  switch (admission.value) {
    case 'paid':
      return { text: formatPrice(price), status: worstStatus(admission.status, price?.status, tickets?.status) }
    case 'free':
      return { text: 'Бесплатно', status: admission.status }
    case 'unknown':
      return { text: 'Уточняется', status: null }
  }
}

export function SightCard({ point, highlighted = false }: { point: RoutePoint; highlighted?: boolean }) {
  const [expanded, setExpanded] = useState(false)
  const moreId = useId()

  const entry = admissionInfo(point)
  const showTickets = point.admission.value === 'paid' && point.tickets !== null
  const hasMore = Boolean(point.details || point.openingHours || point.booking || point.website)
  const photo = point.photo ?? { src: null, alt: point.localName ?? point.title, credit: null }

  return (
    <article id={cardElementId(point.id)} className={highlighted ? `${styles.sight} ${styles.highlighted}` : styles.sight}>
      <ImagePlaceholder photo={photo} ratio="16 / 9" />

      <div className={styles.sightBody}>
        <div className={styles.sightHead}>
          <div className={styles.sightHeadText}>
            <PointMeta point={point} />
            <h3 className={styles.sightTitle}>{point.title}</h3>
          </div>
          <FavoriteButton id={point.id} title={point.title} />
        </div>
        {point.localName && <p className={styles.localName}>{point.localName}</p>}
        <p className={styles.description}>{point.description}</p>

        <dl className={styles.facts}>
          <div className={styles.fact}>
            <dt>Адрес</dt>
            <dd>
              {point.address.value} <VerificationBadge status={point.address.status} />
            </dd>
          </div>
          <div className={styles.fact}>
            <dt>Вход</dt>
            <dd>
              {entry.text} {entry.status && <VerificationBadge status={entry.status} />}
            </dd>
          </div>
        </dl>

        {point.closures && point.closures.length > 0 && <ClosureHints closures={point.closures} />}

        {point.tip && (
          <p className={styles.tip}>
            {point.tip.text}
            {point.tip.link && (
              <>
                {' '}
                <ExternalLink href={point.tip.link.url} className={styles.inlineLink}>
                  {point.tip.link.label}
                </ExternalLink>
              </>
            )}
          </p>
        )}

        {hasMore && expanded && (
          <div id={moreId} className={styles.more}>
            {point.details && <p>{point.details}</p>}
            <dl className={styles.facts}>
              <div className={styles.fact}>
                <dt>Часы работы</dt>
                <dd>
                  {point.openingHours ? (
                    <>
                      {point.openingHours.value} <VerificationBadge status={point.openingHours.status} />
                    </>
                  ) : (
                    'Уточняются'
                  )}
                </dd>
              </div>
              {point.booking && (
                <div className={styles.fact}>
                  <dt>Бронь</dt>
                  <dd>
                    {point.booking.value} <VerificationBadge status={point.booking.status} />
                  </dd>
                </div>
              )}
              {point.website && (
                <div className={styles.fact}>
                  <dt>Сайт</dt>
                  <dd>
                    <ExternalLink href={point.website.value} className={styles.inlineLink}>
                      {hostname(point.website.value)}
                    </ExternalLink>{' '}
                    <VerificationBadge status={point.website.status} />
                  </dd>
                </div>
              )}
            </dl>
          </div>
        )}

        {hasMore && (
          <button
            type="button"
            className={styles.moreToggle}
            aria-expanded={expanded}
            aria-controls={moreId}
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? 'Свернуть' : 'Подробнее'}
          </button>
        )}

        <div className={styles.actions}>
          <ExternalLink href={point.mapUrl} className={styles.buttonSecondary}>
            Открыть на карте
          </ExternalLink>
          {showTickets && point.tickets && (
            <ExternalLink href={point.tickets.value} className={styles.buttonPrimary}>
              Купить билеты
            </ExternalLink>
          )}
        </div>
        {point.admission.value === 'paid' && !point.tickets && point.ticketsNote && (
          <p className={styles.note}>{point.ticketsNote}</p>
        )}
      </div>
    </article>
  )
}
