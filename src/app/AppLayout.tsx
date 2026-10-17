import { useEffect } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router'
import { BottomNav } from '../components/BottomNav/BottomNav'
import { setTelegramBackButton } from '../telegram/telegram'
import styles from './AppLayout.module.css'

/** Frame for inner screens: brand header, content, bottom navigation. */
export function AppLayout() {
  const navigate = useNavigate()
  // 'default' — the app was opened right on this screen, there is nothing to go back to.
  const hasHistory = useLocation().key !== 'default'

  // Inner screens show Telegram's native «Назад» button: one step back
  // (e.g. from «Где поесть рядом» to the route), or home if opened directly.
  useEffect(() => {
    setTelegramBackButton(() => (hasHistory ? navigate(-1) : navigate('/')))
    return () => setTelegramBackButton(null)
  }, [navigate, hasHistory])

  return (
    <div className={styles.layout}>
      <header className={styles.header}>
        <Link to="/" className={styles.brand}>
          Weekend Atlas
        </Link>
      </header>
      <main className={styles.main}>
        <Outlet />
      </main>
      <BottomNav />
    </div>
  )
}
