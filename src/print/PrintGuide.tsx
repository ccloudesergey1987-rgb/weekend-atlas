import type { ReactNode } from 'react'
import { getCityContent } from '../data'
import {
  GOOGLE_CARD_SOURCE,
  type Fact,
  type Photo,
  type Place,
  type RoutePoint,
  type VerificationStatus,
} from '../types/content'
import { DATA_CHECKED_LABEL, TELEGRAM_CHANNEL_URL } from '../config/site'
import { calculateBudget, defaultSelection, formatRange, formatUnitPrice, paidSights } from '../lib/budget'
import { cityPhotos, photoCreditText, photoUrl } from '../lib/photos'
import { formatDuration, formatTransfer, pluralize } from '../utils/format'
import { priceLevel, priceLevelSymbol } from '../utils/priceLevel'
import { placeTypeLabel } from '../screens/PlacesScreen/placeFilters'
import styles from './PrintGuide.module.css'

const SITE_URL = 'https://weekend-atlas.ru'

/**
 * The smallest file of a photo (800 px). Chromium stores images in the PDF
 * without recompressing, so bigger files make the PDF too heavy to send.
 */
function smallest(photo: Photo): string | null {
  return photo.src ? photoUrl(photo.src) : null
}

function Badge({ status }: { status: VerificationStatus | undefined }) {
  if (status !== 'needs_check') return null
  return <span className={styles.badge}>Требует проверки</span>
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.row}>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}

function FactRow({ label, fact }: { label: string; fact: Fact<string> | null | undefined }) {
  if (!fact) return null
  return (
    <Row label={label}>
      {fact.value} <Badge status={fact.status} />
    </Row>
  )
}

function entryText(point: RoutePoint): ReactNode {
  if (point.admission.value === 'free') return 'Бесплатно'
  if (!point.price) return 'Цена уточняется'
  return (
    <>
      {formatUnitPrice(point.price)} <Badge status={point.price.status} />
    </>
  )
}

function Point({ point, nearby }: { point: RoutePoint; nearby: Place[] }) {
  const photo = point.kind === 'sight' && point.photo ? smallest(point.photo) : null
  return (
    <article className={styles.point}>
      {point.transferFromPrevious && (
        <p className={styles.transfer}>{formatTransfer(point.transferFromPrevious)}</p>
      )}
      <div className={styles.pointTop}>
        <div className={styles.pointHead}>
          {point.time && <span className={styles.time}>{point.time}</span>}
          <div>
            <h3 className={styles.pointTitle}>{point.title}</h3>
            {point.localName && <p className={styles.localName}>{point.localName}</p>}
          </div>
        </div>
        {photo && <img className={styles.pointPhoto} src={photo} alt={point.photo?.alt ?? ''} />}
        <p className={styles.text}>{point.description}</p>
      </div>
      <dl className={styles.facts}>
        {point.address.status !== 'not_applicable' && <FactRow label="Адрес" fact={point.address} />}
        <FactRow label="Часы" fact={point.openingHours} />
        {point.kind === 'sight' && <Row label="Вход">{entryText(point)}</Row>}
        <FactRow label="Бронь" fact={point.booking} />
        {point.durationMin && <Row label="Время">≈ {formatDuration(point.durationMin)}</Row>}
      </dl>
      {point.closures?.map((c) => (
        <p key={c.text} className={styles.warning}>
          <strong>{c.text}.</strong> {c.advice}
          {c.alternative && ` Рядом: ${c.alternative.title} — ${c.alternative.openingHours.value}`}
        </p>
      ))}
      {point.tip && <p className={styles.tip}>{point.tip.text}</p>}
      {nearby.length > 0 && (
        <p className={styles.tip}>
          <strong>Где поесть рядом:</strong> {nearby.map((p) => p.name).join(', ')} — подробнее в разделе «Где поесть».
        </p>
      )}
      <p className={styles.links}>
        <a href={point.mapUrl}>Открыть на карте</a>
        {point.tickets && (
          <>
            {' · '}
            <a href={point.tickets.value}>{point.ticketsLabel ?? 'Билеты'}</a>
          </>
        )}
      </p>
    </article>
  )
}

function PlaceEntry({ place }: { place: Place }) {
  const level = priceLevel(place.price)
  const fromGoogle = [place.address, place.openingHours].some((f) => f?.source === GOOGLE_CARD_SOURCE)
  const price =
    place.type === 'market'
      ? 'Цена зависит от выбора'
      : place.price
        ? `${formatUnitPrice(place.price)} на человека${level ? ` · ${priceLevelSymbol(level)}` : ''}`
        : 'Цена уточняется'
  return (
    <article className={styles.place}>
      <p className={styles.placeType}>
        {placeTypeLabel(place.type)} · {price}
        {place.reservation?.value === 'recommended' && ' · лучше забронировать'}
      </p>
      <h3 className={styles.placeName}>{place.name}</h3>
      <p className={styles.placeText}>{place.description}</p>
      <dl className={styles.facts}>
        <FactRow label="Адрес" fact={place.address} />
        <FactRow label="Часы" fact={place.openingHours} />
      </dl>
      <p className={styles.links}>
        <a href={place.mapUrl}>Карта</a>
        {place.website && (
          <>
            {' · '}
            <a href={place.website.value}>Сайт</a>
          </>
        )}
        {' · Рекомендуют: '}
        {place.recommendedBy.map((r) => r.name).join(', ')}
        {fromGoogle && ' · адрес и часы по данным Google'}
      </p>
    </article>
  )
}

export function PrintGuide() {
  const content = getCityContent()
  const { city, route, places, budget } = content
  const cover = smallest(city.cover)
  const days = route.days.length
  const sights = paidSights(route)

  const areaOrder = route.days.flatMap((d) => d.areas)
  const placesByArea = areaOrder
    .map((area) => ({ area, list: places.places.filter((p) => p.area === area) }))
    .filter((g) => g.list.length > 0)

  const example = (foodId: string) =>
    calculateBudget({
      settings: budget,
      days: city.durationDays,
      sights,
      selection: { ...defaultSelection(budget), travelers: 1, foodId },
    })

  return (
    <div className={styles.doc}>
      {/* Cover */}
      <section className={`${styles.page} ${styles.cover}`}>
        {cover && <img className={styles.coverPhoto} src={cover} alt={city.cover.alt} />}
        <div className={styles.coverText}>
          <p className={styles.brand}>Weekend Atlas</p>
          <h1 className={styles.coverTitle}>{city.title}</h1>
          <p className={styles.coverLead}>{city.description}</p>
          <p className={styles.coverMeta}>
            {days} {pluralize(days, ['день', 'дня', 'дней'])} · маршрут · еда · бюджет · данные проверены: {DATA_CHECKED_LABEL}
          </p>
        </div>
      </section>

      {/* How to use */}
      <section className={styles.page}>
        <p className={styles.eyebrow}>Перед поездкой</p>
        <h2 className={styles.h2}>Как пользоваться</h2>
        <p className={styles.text}>
          Это офлайн-версия путеводителя: сохрани файл в телефон, и он откроется без интернета. Ссылки «Открыть на карте»
          и «Билеты» работают, когда интернет есть.
        </p>
        <ol className={styles.toc}>
          {route.days.map((d) => (
            <li key={d.day}>
              <strong>День {d.day}.</strong> {d.title} — {d.areas.join(', ')}
            </li>
          ))}
          <li>
            <strong>Где поесть</strong> — {places.places.length} проверенных мест по районам
          </li>
          <li>
            <strong>Сколько стоит</strong> — бюджет на одного без перелёта и жилья
          </li>
        </ol>
        <div className={styles.legend}>
          <p>
            <strong>≈</strong> — оценка редакции: время в пути и средний чек, у которых не бывает официального источника.
          </p>
          <p>
            <span className={styles.badge}>Требует проверки</span> — данные ещё не сверены с официальным сайтом.
          </p>
          <p>Цены и часы работы меняются. Перед визитом сверяйся с официальными сайтами — ссылки в карточках.</p>
        </div>
        {route.days.some((d) => d.notice) && (
          <>
            <h3 className={styles.h3}>Важно про дни недели</h3>
            {route.days
              .filter((d) => d.notice)
              .map((d) => (
                <p key={d.day} className={styles.warning}>
                  <strong>День {d.day}.</strong> {d.notice}
                </p>
              ))}
          </>
        )}
      </section>

      {/* Route */}
      {route.days.map((d) => (
        <section key={d.day} className={styles.page}>
          <p className={styles.eyebrow}>
            День {d.day} · {d.areas.join(' · ')}
          </p>
          <h2 className={styles.h2}>{d.title}</h2>
          <p className={styles.lead}>{d.summary}</p>
          {d.notice && <p className={styles.warning}>{d.notice}</p>}
          {d.points.map((p) => (
            <Point
              key={p.id}
              point={p}
              nearby={p.kind === 'meal' && p.area ? places.places.filter((pl) => pl.area === p.area) : []}
            />
          ))}
        </section>
      ))}

      {/* Places */}
      <section className={styles.page}>
        <p className={styles.eyebrow}>Еда и места</p>
        <h2 className={styles.h2}>Где поесть</h2>
        <p className={styles.lead}>
          Каждое место рекомендуют минимум два независимых гида или издания. Средний чек — на человека, обычно с напитками.
        </p>
        {placesByArea.map((g) => (
          <div key={g.area} className={styles.area}>
            <h3 className={styles.areaTitle}>{g.area}</h3>
            {g.list.map((p) => (
              <PlaceEntry key={p.id} place={p} />
            ))}
          </div>
        ))}
      </section>

      {/* Budget */}
      <section className={styles.page}>
        <p className={styles.eyebrow}>Бюджет</p>
        <h2 className={styles.h2}>Сколько стоит</h2>
        <p className={styles.lead}>
          На одного человека за {city.durationDays} {pluralize(city.durationDays, ['день', 'дня', 'дней'])}, без
          перелёта и жилья: все билеты по маршруту, городской транспорт и дорога из аэропорта.
        </p>
        <div className={styles.totals}>
          {budget.food.options.map((o) => {
            const r = example(o.id)
            return (
              <div key={o.id} className={styles.total}>
                <p className={styles.totalLabel}>{o.title}</p>
                <p className={styles.totalValue}>≈ {formatRange(r.perPersonEuros, budget.currency)}</p>
                <p className={styles.small}>{o.description}</p>
              </div>
            )
          })}
        </div>
        <h3 className={styles.h3}>Билеты по маршруту</h3>
        <dl className={styles.facts}>
          {sights.map((s) => (
            <Row key={s.id} label={`День ${s.day}`}>
              {s.title} — {s.price ? formatUnitPrice(s.price) : 'цена уточняется'}
            </Row>
          ))}
        </dl>
        <h3 className={styles.h3}>Транспорт</h3>
        <dl className={styles.facts}>
          {budget.transport.options.map((o) => (
            <Row key={o.id} label={formatUnitPrice(o.price)}>
              <strong>{o.title}.</strong> {o.description}
            </Row>
          ))}
        </dl>
        <h3 className={styles.h3}>Из аэропорта</h3>
        <dl className={styles.facts}>
          {budget.transfer.options
            .filter((o) => o.price && o.price.max > 0)
            .map((o) => (
              <Row key={o.id} label={formatUnitPrice(o.price)}>
                <strong>{o.title}.</strong> {o.description}
              </Row>
            ))}
        </dl>
        <p className={styles.small}>
          Пример посчитан с проездным «{budget.transport.options.find((o) => o.id === budget.transport.defaultId)?.title}» и
          трансфером «{budget.transfer.options.find((o) => o.id === budget.transfer.defaultId)?.title}». Свой вариант —
          в калькуляторе на {SITE_URL.replace('https://', '')}.
        </p>
      </section>

      {/* Back page */}
      <section className={`${styles.page} ${styles.back}`}>
        <p className={styles.brand}>Weekend Atlas</p>
        <h2 className={styles.h2}>Хорошей поездки!</h2>
        <p className={styles.text}>
          Интерактивная версия с избранным и калькулятором бюджета — <a href={SITE_URL}>{SITE_URL.replace('https://', '')}</a>
        </p>
        <p className={styles.text}>
          Новые города и лайфхаки — в Telegram: <a href={TELEGRAM_CHANNEL_URL}>{TELEGRAM_CHANNEL_URL.replace('https://', '')}</a>
        </p>
        <p className={styles.small}>
          Данные проверены: {DATA_CHECKED_LABEL}. Цены, часы работы и правила входа меняются — перед визитом сверяйся с
          официальными сайтами.
        </p>
        <h3 className={styles.h3}>Авторы фотографий</h3>
        <ul className={styles.credits}>
          {cityPhotos(content).map((u) => (
            <li key={u.photo.src}>
              {u.title}: {u.photo.credit && photoCreditText(u.photo.credit).replace('Фото: ', '')}
              {u.photo.credit && (
                <>
                  {' '}
                  — <a href={u.photo.credit.sourceUrl}>источник</a>
                </>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
