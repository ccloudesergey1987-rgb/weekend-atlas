import type { VerificationStatus } from '../../types/content'
import styles from './VerificationBadge.module.css'

interface Props {
  status: VerificationStatus
}

/** Small «Требует проверки» label. Renders nothing for verified data. */
export function VerificationBadge({ status }: Props) {
  if (status !== 'needs_check') return null
  return (
    <span className={styles.badge} title="Данные ещё не сверены с официальным источником">
      Требует проверки
    </span>
  )
}
