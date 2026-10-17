import styles from './ScreenStub.module.css'

interface Props {
  title: string
  description: string
}

/** Temporary content for screens that are not built yet. */
export function ScreenStub({ title, description }: Props) {
  return (
    <section className={styles.stub}>
      <h1 className={styles.title}>{title}</h1>
      <p className={styles.description}>{description}</p>
      <p className={styles.note}>Раздел в разработке</p>
    </section>
  )
}
