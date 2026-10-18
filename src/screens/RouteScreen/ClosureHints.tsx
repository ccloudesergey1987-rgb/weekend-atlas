import type { Alternative, Closure } from '../../types/content'
import { ExternalLink } from '../../components/ExternalLink/ExternalLink'
import { VerificationBadge } from '../../components/VerificationBadge/VerificationBadge'
import { ImagePlaceholder } from '../../components/ImagePlaceholder/ImagePlaceholder'
import { formatPrice } from '../../utils/format'
import styles from './RouteCards.module.css'

/** Closures that share an alternative, so the same place is described only once. */
interface Group {
  key: string
  closures: Closure[]
  alternative?: Alternative
}

function groupByAlternative(closures: Closure[]): Group[] {
  const groups: Group[] = []
  for (const c of closures) {
    const same = c.alternative && groups.find((g) => g.alternative?.title === c.alternative!.title)
    if (same) same.closures.push(c)
    else groups.push({ key: c.days.join('-'), closures: [c], alternative: c.alternative })
  }
  return groups
}

function AlternativeInfo({ alternative: a }: { alternative: Alternative }) {
  return (
    <div className={styles.alternative}>
      {a.photo && <ImagePlaceholder photo={a.photo} ratio="16 / 9" className={styles.alternativePhoto} sizes="(min-width: 720px) 560px, 90vw" />}
      <p>{a.description}</p>
      <p>
        {a.address.value} <VerificationBadge status={a.address.status} />
      </p>
      <p>
        {a.openingHours.value} <VerificationBadge status={a.openingHours.status} />
      </p>
      <p>
        Вход: {formatPrice(a.price)} {a.price && <VerificationBadge status={a.price.status} />}
      </p>
      <p className={styles.alternativeLinks}>
        <ExternalLink href={a.mapUrl} className={styles.inlineLink}>
          На карте
        </ExternalLink>
        {a.website && (
          <ExternalLink href={a.website.value} className={styles.inlineLink}>
            Сайт
          </ExternalLink>
        )}
      </p>
    </div>
  )
}

/** «В понедельник закрыто. Вместо этого: …» — a calm block per alternative or per day. */
export function ClosureHints({ closures }: { closures: Closure[] }) {
  return (
    <div className={styles.closures}>
      {groupByAlternative(closures).map((g) => (
        <div key={g.key} className={styles.closure}>
          {g.closures.map((c) => (
            <p key={c.days.join('-')}>
              <strong>{c.text}.</strong> <VerificationBadge status={c.status} />
            </p>
          ))}
          {g.alternative && (
            <>
              <p>Вместо этого: {g.alternative.title}.</p>
              <AlternativeInfo alternative={g.alternative} />
            </>
          )}
          {g.closures.map((c) => c.advice && <p key={`advice-${c.days.join('-')}`}>{c.advice}</p>)}
        </div>
      ))}
    </div>
  )
}
