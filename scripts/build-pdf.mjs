/**
 * Builds the PDF version of the guide from the already built site (dist/).
 *
 *   npm run build && npm run pdf
 *
 * Serves dist/ locally, opens print.html in headless Chromium and prints it
 * to dist/guides/<file>.pdf. The data comes from the same JSON as the app,
 * so the PDF is always as fresh as the site.
 *
 * Chromium is installed once with: npx playwright-core install chromium
 */

import { mkdir, stat } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { preview } from 'vite'
import { chromium } from 'playwright-core'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
/** Must match PDF_GUIDE_PATH in src/config/site.ts. */
const OUT = resolve(root, 'dist/guides/weekend-atlas-barcelona-72.pdf')

const server = await preview({ root, preview: { port: 4321, strictPort: false }, logLevel: 'warn' })
const url = server.resolvedUrls?.local?.[0] ?? 'http://localhost:4321/'

const browser = await chromium.launch()
try {
  const page = await browser.newPage({ viewport: { width: 560, height: 800 } })
  await page.goto(new URL('print.html', url).href, { waitUntil: 'networkidle' })
  await page.evaluate(async () => {
    await document.fonts.ready
    await Promise.all(
      [...document.images].map((img) =>
        img.complete ? null : new Promise((ok) => img.addEventListener('load', ok, { once: true })),
      ),
    )
  })
  const broken = await page.evaluate(() => [...document.images].filter((i) => !i.naturalWidth).map((i) => i.src))
  if (broken.length) throw new Error(`Images not loaded: ${broken.join(', ')}`)

  // Chromium keeps JPEG data as is but stores WebP uncompressed, which makes
  // the PDF several times heavier. Re-encode every photo to JPEG first.
  await page.evaluate(async () => {
    await Promise.all(
      [...document.images].map(async (img) => {
        const canvas = document.createElement('canvas')
        canvas.width = img.naturalWidth
        canvas.height = img.naturalHeight
        canvas.getContext('2d').drawImage(img, 0, 0)
        img.src = canvas.toDataURL('image/jpeg', 0.82)
        await img.decode()
      }),
    )
  })

  await mkdir(dirname(OUT), { recursive: true })
  await page.pdf({
    path: OUT,
    preferCSSPageSize: true,
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: '<span></span>',
    footerTemplate:
      '<div style="width:100%;font-size:7px;font-family:Arial,sans-serif;color:#6e665b;padding:0 13mm;display:flex;justify-content:space-between">' +
      '<span>Weekend Atlas · weekend-atlas.ru</span><span class="pageNumber"></span></div>',
  })
  const { size } = await stat(OUT)
  console.log(`PDF: ${OUT} (${(size / 1024 / 1024).toFixed(1)} MB)`)
} finally {
  await browser.close()
  await new Promise((done) => server.httpServer.close(done))
}
