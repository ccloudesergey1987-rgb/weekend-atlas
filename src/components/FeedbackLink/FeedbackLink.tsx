import { useState } from 'react'
import { FEEDBACK_URL } from '../../config/site'
import { ExternalLink } from '../ExternalLink/ExternalLink'
import { feedbackHref } from './feedback'
import styles from './FeedbackLink.module.css'

/** «Сообщить об ошибке». `about` — what the reader was looking at, e.g. the card title. */
export function FeedbackLink({ about, className }: { about: string; className?: string }) {
  const [notSet, setNotSet] = useState(false)
  const href = feedbackHref(FEEDBACK_URL, about)
  const classes = [styles.link, className].filter(Boolean).join(' ')

  if (!href) {
    return (
      <>
        <button type="button" className={classes} onClick={() => setNotSet(true)}>
          Сообщить об ошибке
        </button>
        {notSet && (
          <p className={styles.note} role="status">
            Адрес для сообщений скоро появится. Спасибо, что помогаете сделать гид точнее!
          </p>
        )}
      </>
    )
  }

  // mailto opens the mail app directly; web links go through ExternalLink (Telegram-aware).
  return href.startsWith('mailto:') ? (
    <a href={href} className={classes}>
      Сообщить об ошибке
    </a>
  ) : (
    <ExternalLink href={href} className={classes}>
      Сообщить об ошибке
    </ExternalLink>
  )
}
