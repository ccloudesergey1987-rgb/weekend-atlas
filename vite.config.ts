import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // GitHub Pages serves the site from the root of https://weekend-atlas.ru/ (see public/CNAME)
  base: '/',
})
