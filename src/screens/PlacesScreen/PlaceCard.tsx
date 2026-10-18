import type { Fact, Place, Reservation, VerificationStatus } from '../../types/content'
import { ExternalLink } from '../../components/ExternalLink/ExternalLink'
import { FavoriteButton } from '../../components/FavoriteButton/FavoriteButton'
import { cardElementId } from '../../lib/focusCard'
import { ImagePlaceholder } from '../../components/ImagePlaceholder/ImagePlaceholder'
import { VerificationBadge } from '../../components/VerificationBadge/VerificationBadge'
import { formatPrice } from '../../utils/format'
import { priceLevel, priceLevelName, priceLevelSymbol } from '../../utils/priceLevel'
import { closedDays, formatDays, unknownDays } from '../../lib/schedule'
import { placeTypeLabel } from './placeFilters'
import styles from './PlaceCard.module.css'

/** A missing fact is plainly «Уточняется»; a known one carries its verification badge. */
function factInfo(fact: Fact<string> | null): { text: string; status: VerificationStatus | null } {
  if (!fact) return { text: 'Уточняется', status: null }
  return { text: fact.value, status: fact.status }
}

/** «пн, вт», «нет — работает каждый день», «вс — на сайте не указано», «Уточняется». */
function closedText(place: Place): string {
  if (!place.schedule) return 'Уточняется'
  const closed = closedDays(place.schedule.value)
  const unknown = unknownDays(place.schedule.value)
  const parts: string[] = []
  if (closed.length > 0) parts.push(formatDays(closed))
  if (unknown.length > 0) parts.push(`${formatDays(unknown)} — на сайте не указано`)
  return parts.length > 0 ? parts.join('; ') : 'нет — работает каждый день'
}

const reservationText: Record<Reservation, string> = {
  recommended: 'Лучше забронировать',
  not_accepted: 'Столики не бронируют — приходите заранее',
}

function FactRow({ label, fact }: { label: string; fact: Fact<string> | null }) {
  const info = factInfo(fact)
  return (
    <div className={styles.fact}>
      <dt>{label}</dt>
      <dd>
        {info.text} {info.status && <VerificationBadge status={info.status} />}
      </dd>
    </div>
  )
}

export function PlaceCard({ place, highlighted = false }: { place: Place; highlighted?: boolean }) {
  const level = priceLevel(place.price)

  return (
    <article id={cardElementId(place.id)} className={highlighted ? `${styles.card} ${styles.highlighted}` : styles.card}>
      {/* Only real photos: a placeholder per card would be noise in a list. */}
      {place.photo?.src && <ImagePlaceholder photo={place.photo} ratio="16 / 9" />}

      <div className={styles.body}>
        <div className={styles.head}>
          <div className={styles.headText}>
            <p className={styles.meta}>
              <span className={styles.metaPart}>{placeTypeLabel(place.type)}</span>
              <span className={styles.metaPart}> · {place.area}</span>
              {level && (
                <span className={styles.metaPart}>
                  {' · '}
                  <span className={styles.level} aria-label={`уровень цены: ${priceLevelName(level)}`}>
                    {priceLevelSymbol(level)}
                  </span>
                </span>
              )}
            </p>
            <h3 className={styles.title}>{place.name}</h3>
          </div>
          <FavoriteButton id={place.id} title={place.name} />
        </div>
        <p className={styles.description}>{place.description}</p>

        {place.reservation && <p className={styles.reservation}>{reservationText[place.reservation.value]}</p>}

        <dl className={styles.facts}>
          <FactRow label="Адрес" fact={place.address} />
          <FactRow label="Часы" fact={place.openingHours} />
          <div className={styles.fact}>
            <dt>Закрыто</dt>
            <dd>
              {closedText(place)}{' '}
              {place.schedule && <VerificationBadge status={place.schedule.status} />}
            </dd>
          </div>
          <div className={styles.fact}>
            <dt>Средний чек</dt>
            <dd>
              {place.price ? (
                <>
                  ≈ {formatPrice(place.price)} на человека <VerificationBadge status={place.price.status} />
                  {place.price.note && (
                    <details className={styles.estimate}>
                      <summary>Оценка редакции — как посчитано</summary>
                      <p>
                        {place.price.note}{' '}
                        {/^https:\/\//.test(place.price.source) && (
                          <ExternalLink href={place.price.source} className={styles.inlineLink}>
                            Меню
                          </ExternalLink>
                        )}
                      </p>
                    </details>
                  )}
                </>
              ) : (
                <>
                  Уточняется
                  {place.priceNote && <span className={styles.muted}> — {place.priceNote}</span>}
                </>
              )}
            </dd>
          </div>
        </dl>

        {place.recommendedBy.length > 0 && (
          <p className={styles.recommended}>
            Рекомендуют:{' '}
            {place.recommendedBy.map((r, i) => (
              <span key={r.url}>
                {i > 0 && ', '}
                <ExternalLink href={r.url} className={styles.inlineLink}>
                  {r.name}
                </ExternalLink>
              </span>
            ))}
          </p>
        )}

        <div className={styles.actions}>
          <ExternalLink href={place.mapUrl} className={styles.button}>
            Открыть на карте
          </ExternalLink>
          {place.website && (
            <ExternalLink href={place.website.value} className={styles.button}>
              Сайт / меню
            </ExternalLink>
          )}
        </div>
      </div>
    </article>
  )
}
