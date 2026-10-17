import type { Photo } from '../../types/content'
import styles from './ImagePlaceholder.module.css'

interface Props {
  photo: Photo
  /** CSS aspect-ratio, e.g. "4 / 5". Defaults to 4 / 3 via CSS. */
  ratio?: string
  className?: string
}

/** Shows the photo if it exists, otherwise a quiet placeholder with the alt text. */
export function ImagePlaceholder({ photo, ratio, className }: Props) {
  const classes = [styles.frame, className].filter(Boolean).join(' ')

  if (photo.src) {
    return (
      <figure className={classes} style={ratio ? { aspectRatio: ratio } : undefined}>
        <img className={styles.image} src={photo.src} alt={photo.alt} />
        {photo.credit && <figcaption className={styles.credit}>{photo.credit}</figcaption>}
      </figure>
    )
  }

  return (
    <div className={`${classes} ${styles.placeholder}`} style={ratio ? { aspectRatio: ratio } : undefined} role="img" aria-label={photo.alt}>
      <span className={styles.label}>{photo.alt}</span>
    </div>
  )
}
