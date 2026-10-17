import type { Place, VerificationStatus } from '../../types/content'
import { ExternalLink } from '../../components/ExternalLink/ExternalLink'
import { ImagePlaceholder } from '../../components/ImagePlaceholder/ImagePlaceholder'
import { VerificationBadge } from '../../components/VerificationBadge/VerificationBadge'
import { formatPrice } from '../../utils/format'
import { priceLevel, priceLevelName, priceLevelSymbol } from '../../utils/priceLevel'
import { placeTypeLabel } from './placeFilters'
import styles from './PlaceCard.module.css'

/** A missing address is plainly «Уточняется»; a known one carries its verification badge. */
function addressInfo(place: Place): { text: string; status: VerificationStatus | null } {
  if (!place.address) return { text: 'Уточняется', status: null }
  return { text: place.address.value, status: place.address.status }
}

export function PlaceCard({ place }: { place: Place }) {
  const level = priceLevel(place.price)
  const address = addressInfo(place)

  return (
    <article className={styles.card}>
      {/* Only real photos: a placeholder per card would be noise in a list. */}
      {place.photo?.src && <ImagePlaceholder photo={place.photo} ratio="16 / 9" />}

      <div className={styles.body}>
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
        <p className={styles.description}>{place.description}</p>

        <dl className={styles.facts}>
          <div className={styles.fact}>
            <dt>Адрес</dt>
            <dd>
              {address.text} {address.status && <VerificationBadge status={address.status} />}
            </dd>
          </div>
          <div className={styles.fact}>
            <dt>Средний чек</dt>
            <dd>
              {place.price ? (
                <>
                  ≈ {formatPrice(place.price)} на человека <VerificationBadge status={place.price.status} />
                </>
              ) : (
                'Уточняется'
              )}
            </dd>
          </div>
        </dl>

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
