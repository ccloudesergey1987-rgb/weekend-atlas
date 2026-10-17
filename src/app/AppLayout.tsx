import { useEffect } from 'react'
import { Link, Outlet, useNavigate } from 'react-router'
import { BottomNav } from '../components/BottomNav/BottomNav'
import { setTelegramBackButton } from '../telegram/telegram'
import styles from './AppLayout.module.css'

/** Frame for inner screens: brand header, content, bottom navigation. */
export function AppLayout() {
  const navigate = useNavigate()

  // Inner screens show Telegram's native «Назад» button leading to the home screen.
  useEffect(() => {
    setTelegramBackButton(() => navigate('/'))
    return () => setTelegramBackButton(null)
  }, [navigate])

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
