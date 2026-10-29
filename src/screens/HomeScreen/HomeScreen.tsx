import { Link } from 'react-router'
import { ImagePlaceholder } from '../../components/ImagePlaceholder/ImagePlaceholder'
import { getCityContent } from '../../data'
import { pluralize } from '../../utils/format'
import { DATA_CHECKED_LABEL, OTHER_CITY_GUIDES, PDF_GUIDE_PATH, TELEGRAM_CHANNEL_URL } from '../../config/site'
import { downloadInTelegram } from '../../telegram/telegram'
import { ExternalLink } from '../../components/ExternalLink/ExternalLink'
import { FeedbackLink } from '../../components/FeedbackLink/FeedbackLink'
import styles from './HomeScreen.module.css'

const pdfUrl = `${import.meta.env.BASE_URL}${PDF_GUIDE_PATH}`
const pdfName = PDF_GUIDE_PATH.split('/').pop() ?? 'weekend-atlas.pdf'

export function HomeScreen() {
  const { city, route } = getCityContent()

  const days = route.days.length
  const sights = route.days.flatMap((d) => d.points).filter((p) => p.kind === 'sight').length

  const sections = [
    {
      to: '/route',
      title: 'Маршрут',
      text: `${days} ${pluralize(days, ['день', 'дня', 'дней'])} по районам, ${sights} ${pluralize(sights, ['место', 'места', 'мест'])} по порядку — с перерывами на еду и отдых.`,
    },
    {
      to: '/places',
      title: 'Еда и места',
      text: 'Где поесть и выпить кофе: фильтры по типу заведения и цене.',
    },
    {
      to: '/budget',
      title: 'Бюджет',
      text: 'Сколько стоит поездка — от минимума до максимума, без авиабилетов и жилья.',
    },
  ]

  return (
    <div className={styles.home}>
      <header className={styles.top}>
        <span className={styles.brand}>Weekend Atlas</span>
        <button
          type="button"
          className={styles.jump}
          onClick={() => document.getElementById('other-cities')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
        >
          Другие города ↓
        </button>
      </header>

      <ImagePlaceholder photo={city.cover} className={styles.cover} priority sizes="(min-width: 720px) 640px, 100vw" />

      <section className={styles.intro}>
        <p className={styles.eyebrow}>
          Путеводитель · {city.durationDays} {pluralize(city.durationDays, ['день', 'дня', 'дней'])}
        </p>
        <h1 className={styles.title}>{city.title}</h1>
        <p className={styles.description}>{city.description}</p>
        <Link to="/route" className={styles.cta}>
          Начать путешествие
        </Link>
        <a
          href={pdfUrl}
          download={pdfName}
          className={styles.pdf}
          onClick={(event) => {
            if (downloadInTelegram(new URL(pdfUrl, window.location.href).href, pdfName)) event.preventDefault()
          }}
        >
          Скачать PDF — работает без интернета
        </a>
      </section>

      <nav className={styles.sections} aria-label="Разделы путеводителя">
        <ol className={styles.sectionList}>
          {sections.map((s, i) => (
            <li key={s.to}>
              <Link to={s.to} className={styles.section}>
                <span className={styles.sectionNumber}>{String(i + 1).padStart(2, '0')}</span>
                <span className={styles.sectionBody}>
                  <span className={styles.sectionTitle}>{s.title}</span>
                  <span className={styles.sectionText}>{s.text}</span>
                </span>
                <span className={styles.sectionArrow} aria-hidden="true">
                  →
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </nav>

      <section className={styles.others} aria-labelledby="other-cities">
        <h2 id="other-cities" className={styles.othersTitle}>
          Другие города
        </h2>
        <p className={styles.othersLead}>Бесплатные гиды на 3 дня: маршрут, цены и где поесть.</p>
        <ul className={styles.sectionList}>
          {OTHER_CITY_GUIDES.map((g) => (
            <li key={g.url}>
              <ExternalLink href={g.url} className={styles.section}>
                <span className={styles.sectionNumber} aria-hidden="true">
                  ↗
                </span>
                <span className={styles.sectionBody}>
                  <span className={styles.sectionTitle}>{g.city}</span>
                  <span className={styles.sectionText}>{g.note}</span>
                </span>
                <span className={styles.sectionArrow} aria-hidden="true">
                  →
                </span>
              </ExternalLink>
            </li>
          ))}
        </ul>
        <ExternalLink href={TELEGRAM_CHANNEL_URL} className={styles.channel}>
          Новые города — в нашем Telegram
        </ExternalLink>
      </section>

      <footer className={styles.footer}>
        <p className={styles.footerNote}>Данные проверены: {DATA_CHECKED_LABEL}</p>
        <div className={styles.footerLinks}>
          <FeedbackLink about="главная страница" />
          <Link to="/photos" className={styles.footerLink}>
            Авторы фотографий
          </Link>
        </div>
      </footer>
    </div>
  )
}
