import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/index.css'
import { initTelegram } from './telegram/telegram'
import { startFavoritesSync } from './lib/useFavorites'
import { App } from './app/App'
import { ErrorBoundary } from './components/ErrorBoundary/ErrorBoundary'

// Must run before the router reads the URL hash; never blocks rendering.
initTelegram()
// Waits for Telegram in the background; outside it does nothing.
startFavoritesSync()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
