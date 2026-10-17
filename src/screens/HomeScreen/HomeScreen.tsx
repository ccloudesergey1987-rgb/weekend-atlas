import { Link } from 'react-router'
import { ImagePlaceholder } from '../../components/ImagePlaceholder/ImagePlaceholder'
import { getCityContent } from '../../data'
import { pluralize } from '../../utils/format'
import styles from './HomeScreen.module.css'

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
      </header>

      <ImagePlaceholder photo={city.cover} className={styles.cover} />

      <section className={styles.intro}>
        <p className={styles.eyebrow}>
          Путеводитель · {city.durationDays} {pluralize(city.durationDays, ['день', 'дня', 'дней'])}
        </p>
        <h1 className={styles.title}>{city.title}</h1>
        <p className={styles.description}>{city.description}</p>
        <Link to="/route" className={styles.cta}>
          Начать путешествие
        </Link>
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
    </div>
  )
}
