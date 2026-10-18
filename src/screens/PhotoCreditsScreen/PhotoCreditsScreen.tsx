import { getCityContent } from '../../data'
import { ExternalLink } from '../../components/ExternalLink/ExternalLink'
import { cityPhotos } from '../../lib/photos'
import styles from './PhotoCreditsScreen.module.css'

/** All photos of the guide with author, license and a link to the source page. */
export function PhotoCreditsScreen() {
  const photos = cityPhotos(getCityContent())

  return (
    <section className={styles.screen}>
      <h1 className={styles.title}>Авторы фотографий</h1>
      <p className={styles.lead}>
        Все фотографии взяты с Wikimedia Commons под свободными лицензиями. Спасибо авторам!
      </p>
      <ul className={styles.list}>
        {photos.map(({ title, photo }) => {
          const credit = photo.credit!
          return (
            <li key={photo.src} className={styles.item}>
              <p className={styles.what}>{title}</p>
              <p className={styles.who}>
                {credit.author},{' '}
                {credit.licenseUrl ? (
                  <ExternalLink href={credit.licenseUrl} className={styles.link}>
                    {credit.license}
                  </ExternalLink>
                ) : (
                  credit.license
                )}
                {' · '}
                <ExternalLink href={credit.sourceUrl} className={styles.link}>
                  страница файла
                </ExternalLink>
              </p>
              <p className={styles.changes}>Изменения: {credit.changes.charAt(0).toLowerCase() + credit.changes.slice(1)}.</p>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
