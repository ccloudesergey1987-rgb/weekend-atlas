import type { Photo, PhotoFile } from '../../types/content'
import { ExternalLink } from '../ExternalLink/ExternalLink'
import { photoCreditText, photoUrl } from '../../lib/photos'
import styles from './ImagePlaceholder.module.css'

interface Props {
  photo: Photo
  /** CSS aspect-ratio, e.g. "4 / 5". Defaults to 4 / 3 via CSS. */
  ratio?: string
  className?: string
  /** The first big image on the page: load right away, not lazily. */
  priority?: boolean
  /** How wide the image is on screen, for picking a file from srcset. */
  sizes?: string
}

const srcSet = (files: PhotoFile[]) => files.map((f) => `${photoUrl(f.src)} ${f.width}w`).join(', ')

/** The narrow-screen breakpoint, same as in the CSS of the home cover. */
const NARROW = '(max-width: 639px)'

/**
 * Shows the photo if it exists, otherwise a quiet placeholder with the alt text.
 * Width and height are set so the page does not jump while the file loads.
 */
export function ImagePlaceholder({ photo, ratio, className, priority = false, sizes = '(min-width: 720px) 640px, 100vw' }: Props) {
  const classes = [styles.frame, className].filter(Boolean).join(' ')

  if (photo.src) {
    return (
      <figure className={classes} style={ratio ? { aspectRatio: ratio } : undefined}>
        <picture>
          {photo.portrait && <source media={NARROW} srcSet={srcSet(photo.portrait.srcSet)} sizes="100vw" />}
          <img
            className={styles.image}
            src={photoUrl(photo.src)}
            srcSet={photo.srcSet ? srcSet(photo.srcSet) : undefined}
            sizes={photo.srcSet ? sizes : undefined}
            width={photo.width}
            height={photo.height}
            alt={photo.alt}
            loading={priority ? 'eager' : 'lazy'}
            decoding={priority ? 'sync' : 'async'}
            fetchPriority={priority ? 'high' : 'auto'}
          />
        </picture>
        {photo.credit && (
          <figcaption className={styles.credit}>
            <ExternalLink href={photo.credit.sourceUrl} className={styles.creditLink}>
              <span className={styles.creditText}>{photoCreditText(photo.credit)}</span>
            </ExternalLink>
          </figcaption>
        )}
      </figure>
    )
  }

  return (
    <div className={`${classes} ${styles.placeholder}`} style={ratio ? { aspectRatio: ratio } : undefined} role="img" aria-label={photo.alt}>
      <span className={styles.label}>{photo.alt}</span>
    </div>
  )
}
