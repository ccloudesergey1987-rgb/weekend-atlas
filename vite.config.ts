import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [react()],
  // GitHub Pages serves the site from https://<login>.github.io/weekend-atlas/
  base: command === 'build' ? '/weekend-atlas/' : '/',
}))
