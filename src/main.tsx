import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/index.css'
import { initTelegram } from './telegram/telegram'
import { App } from './app/App'

// Must run before the router reads the URL hash; never blocks rendering.
initTelegram()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
