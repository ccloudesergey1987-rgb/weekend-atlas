import { useId, type ReactNode } from 'react'
import type { AmountError } from '../../lib/budget'
import { parseAmount } from '../../lib/budget'
import styles from './BudgetScreen.module.css'

export function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  const id = useId()
  return (
    <section className={styles.section} aria-labelledby={id}>
      <h2 id={id} className={styles.sectionTitle}>
        {title}
      </h2>
      {hint && <p className={styles.sectionHint}>{hint}</p>}
      <div className={styles.sectionBody}>{children}</div>
    </section>
  )
}

interface StepperProps {
  label: string
  value: number
  min: number
  max: number
  onChange: (value: number) => void
}

export function Stepper({ label, value, min, max, onChange }: StepperProps) {
  return (
    <div className={styles.stepper} role="group" aria-label={label}>
      <button
        type="button"
        className={styles.stepButton}
        aria-label="Меньше"
        disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
      >
        −
      </button>
      <output className={styles.stepValue} aria-live="polite">
        {value}
      </output>
      <button
        type="button"
        className={styles.stepButton}
        aria-label="Больше"
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
      >
        +
      </button>
    </div>
  )
}

interface ChoiceProps {
  type: 'radio' | 'checkbox'
  name?: string
  checked: boolean
  onChange: () => void
  title: string
  description?: string
  price: string
  /** Shown under the price, e.g. «Требует проверки». */
  priceExtra?: ReactNode
  /** Price is unknown: shown muted. */
  muted?: boolean
}

/** A large tappable card with a native radio/checkbox inside, for keyboard and screen readers. */
export function Choice({ type, name, checked, onChange, title, description, price, priceExtra, muted }: ChoiceProps) {
  return (
    <label className={checked ? `${styles.choice} ${styles.choiceChecked}` : styles.choice}>
      <input className={styles.choiceInput} type={type} name={name} checked={checked} onChange={onChange} />
      <span className={type === 'radio' ? styles.radioMark : styles.checkMark} aria-hidden="true" />
      <span className={styles.choiceMain}>
        <span className={styles.choiceTitle}>{title}</span>
        {description && <span className={styles.choiceDescription}>{description}</span>}
      </span>
      <span className={styles.choicePrice}>
        <span className={muted ? styles.priceMuted : undefined}>{price}</span>
        {priceExtra}
      </span>
    </label>
  )
}

const amountErrors: Record<AmountError, string> = {
  not_a_number: 'Введите сумму цифрами, например 120 или 120,50',
  negative: 'Сумма не может быть отрицательной',
  too_large: 'Слишком большая сумма',
}

interface AmountFieldProps {
  label: string
  hint: string
  /** Currency symbol shown after the number. */
  suffix: string
  value: string
  onChange: (value: string) => void
}

/** Money input: numeric keyboard on phones, invalid values are explained and not counted. */
export function AmountField({ label, hint, suffix, value, onChange }: AmountFieldProps) {
  const id = useId()
  const parsed = parseAmount(value)
  const error = parsed.kind === 'invalid' ? amountErrors[parsed.error] : null
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.fieldLabel}>
        {label}
      </label>
      <p id={`${id}-hint`} className={styles.fieldHint}>
        {hint}
      </p>
      <div className={error ? `${styles.inputWrap} ${styles.inputWrapError}` : styles.inputWrap}>
        <input
          id={id}
          className={styles.input}
          type="text"
          inputMode="decimal"
          enterKeyHint="done"
          autoComplete="off"
          maxLength={20}
          placeholder="0"
          value={value}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-hint ${id}-error` : `${id}-hint`}
          onChange={(e) => onChange(e.target.value)}
        />
        <span className={styles.inputSuffix} aria-hidden="true">
          {suffix}
        </span>
      </div>
      {error && (
        <p id={`${id}-error`} className={styles.fieldError} role="alert">
          {error} — сумма не учтена.
        </p>
      )}
    </div>
  )
}
