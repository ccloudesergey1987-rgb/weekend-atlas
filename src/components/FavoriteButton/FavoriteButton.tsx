import { favorites, useFavorites } from '../../lib/useFavorites'
import { HeartIcon } from './HeartIcon'
import styles from './FavoriteButton.module.css'

interface Props {
  id: string
  /** Name of the point or place, for screen readers: «Добавить „Саграда Фамилия“ в избранное». */
  title: string
}

export function FavoriteButton({ id, title }: Props) {
  const saved = useFavorites().includes(id)
  const label = saved ? `Убрать «${title}» из избранного` : `Добавить «${title}» в избранное`

  return (
    <button
      type="button"
      className={saved ? `${styles.button} ${styles.saved}` : styles.button}
      aria-pressed={saved}
      aria-label={label}
      title={saved ? 'Убрать из избранного' : 'В избранное'}
      onClick={() => favorites.toggle(id)}
    >
      <HeartIcon filled={saved} />
    </button>
  )
}
