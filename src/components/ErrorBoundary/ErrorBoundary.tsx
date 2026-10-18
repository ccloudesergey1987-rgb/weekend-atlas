import { Component, type ErrorInfo, type ReactNode } from 'react'
import styles from './ErrorBoundary.module.css'

interface Props {
  children: ReactNode
}

interface State {
  failed: boolean
}

/**
 * Catches a crash anywhere in the screens and shows a calm message in
 * Russian instead of a white page. «Обновить» reloads; «На главную» drops
 * the current address in case it is what breaks the screen.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // No analytics in the MVP: the console is enough to debug.
    console.error('Weekend Atlas crashed:', error, info.componentStack)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className={styles.screen} role="alert">
        <p className={styles.brand}>Weekend Atlas</p>
        <h1 className={styles.title}>Что-то пошло не так</h1>
        <p className={styles.text}>
          Экран не смог открыться. Попробуйте обновить страницу — сохранённые места и настройки бюджета не потеряются.
        </p>
        <div className={styles.actions}>
          <button type="button" className={styles.primary} onClick={() => window.location.reload()}>
            Обновить
          </button>
          <button
            type="button"
            className={styles.secondary}
            onClick={() => {
              window.location.hash = '#/'
              window.location.reload()
            }}
          >
            На главную
          </button>
        </div>
      </div>
    )
  }
}
