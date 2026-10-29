import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // GitHub Pages serves the site from the root of https://weekend-atlas.ru/ (see public/CNAME)
  base: '/',
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        // Source page of the PDF guide; scripts/build-pdf.mjs prints it after the build.
        print: resolve(import.meta.dirname, 'print.html'),
      },
    },
  },
})
