import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { getCityContent } from '../../data'
import { HeartIcon } from '../../components/FavoriteButton/HeartIcon'
import { favorites, useFavorites } from '../../lib/useFavorites'
import { placePath, routePointPath } from '../../lib/focusCard'
import { pluralize } from '../../utils/format'
import { placeTypeLabel } from '../PlacesScreen/placeFilters'
import { resolveFavorites } from './resolveFavorites'
import styles from './FavoritesScreen.module.css'

/** How long «Вернуть» stays after removing an item. */
const UNDO_MS = 6000

interface Removed {
  id: string
  title: string
}

function Item({ to, meta, title, onRemove }: { to: string; meta: string; title: string; onRemove: () => void }) {
  return (
    <li className={styles.item}>
      <Link to={to} className={styles.itemLink}>
        <span className={styles.itemMeta}>{meta}</span>
        <span className={styles.itemTitle}>{title}</span>
      </Link>
      <button
        type="button"
        className={styles.remove}
        aria-label={`Убрать «${title}» из избранного`}
        title="Убрать из избранного"
        onClick={onRemove}
      >
        <HeartIcon filled />
      </button>
    </li>
  )
}

export function FavoritesScreen() {
  const { route, places } = getCityContent()
  const saved = resolveFavorites(useFavorites(), route, places)
  const total = saved.route.length + saved.places.length
  const [removed, setRemoved] = useState<Removed | null>(null)

  useEffect(() => {
    if (!removed) return
    const timer = setTimeout(() => setRemoved(null), UNDO_MS)
    return () => clearTimeout(timer)
  }, [removed])

  function remove(id: string, title: string) {
    favorites.remove(id)
    setRemoved({ id, title })
  }

  function undo() {
    if (removed) favorites.add(removed.id)
    setRemoved(null)
  }

  const undoBar = (
    <div className={styles.undoSlot} aria-live="polite">
      {removed && (
        <p className={styles.undo}>
          <span className={styles.undoText}>«{removed.title}» убрано из избранного</span>
          <button type="button" className={styles.undoButton} onClick={undo}>
            Вернуть
          </button>
        </p>
      )}
    </div>
  )

  if (total === 0) {
    return (
      <section className={styles.screen}>
        <h1 className={styles.title}>Избранное</h1>
        {undoBar}
        <div className={styles.empty}>
          <span className={styles.emptyIcon}>
            <HeartIcon size={28} />
          </span>
          <h2 className={styles.emptyTitle}>Здесь пока пусто</h2>
          <p className={styles.emptyText}>
            Нажмите на сердечко на карточке достопримечательности в маршруте или заведения в разделе «Еда и места» —
            оно появится здесь.
          </p>
          <Link to="/route" className={styles.emptyButton}>
            Перейти к маршруту
          </Link>
        </div>
      </section>
    )
  }

  return (
    <section className={styles.screen}>
      <h1 className={styles.title}>Избранное</h1>
      <p className={styles.lead}>
        {total} {pluralize(total, ['сохранённое место', 'сохранённых места', 'сохранённых мест'])}
      </p>
      {undoBar}

      {saved.route.length > 0 && (
        <section className={styles.group} aria-labelledby="favorites-route">
          <h2 id="favorites-route" className={styles.groupTitle}>
            Маршрут
          </h2>
          <ul className={styles.list}>
            {saved.route.map(({ day, point }) => (
              <Item
                key={point.id}
                to={routePointPath(day, point.id)}
                meta={point.time ? `День ${day} · ${point.time}` : `День ${day}`}
                title={point.title}
                onRemove={() => remove(point.id, point.title)}
              />
            ))}
          </ul>
        </section>
      )}

      {saved.places.length > 0 && (
        <section className={styles.group} aria-labelledby="favorites-places">
          <h2 id="favorites-places" className={styles.groupTitle}>
            Еда и места
          </h2>
          <ul className={styles.list}>
            {saved.places.map((place) => (
              <Item
                key={place.id}
                to={placePath(place.id)}
                meta={`${placeTypeLabel(place.type)} · ${place.area}`}
                title={place.name}
                onRemove={() => remove(place.id, place.name)}
              />
            ))}
          </ul>
        </section>
      )}
    </section>
  )
}
