import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../styles/fonts.css'
import '../styles/tokens.css'
import { PrintGuide } from './PrintGuide'

// The PDF version of the guide. scripts/build-pdf.mjs opens this page in a
// headless browser and prints it; the app itself never links here.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PrintGuide />
  </StrictMode>,
)
