// Checks every external link in the city data: maps, tickets, sites, photo
// sources and recommendations. Run: npm run check-links [-- <cityId>]
//
// For each link: does it open, and does it end up on the same site (a
// redirect to another domain often means a lost or hijacked domain).
// Some official sites block visitors from our region; those are listed
// separately and are NOT treated as broken.

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const cityId = process.argv[2] ?? 'barcelona'
const data = Object.fromEntries(
  ['city', 'route', 'places', 'budget'].map((n) => [n, JSON.parse(readFileSync(join(root, 'src/data', cityId, `${n}.json`), 'utf8'))]),
)

const TIMEOUT_MS = 20_000
const CONCURRENCY = 6
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36',
  'Accept-Language': 'ru,es;q=0.8,en;q=0.6',
}
/** Answers that mean «blocked for this visitor», not «gone». */
const REGION_BLOCK = /block access from your country|not available in your (country|region)|request could not be satisfied/i
/** Anti-bot pages (Cloudflare, DataDome): a person in a browser gets through. */
const isBotCheck = (res, text) =>
  res.headers.get('cf-mitigated') === 'challenge' || res.headers.has('x-datadome') || /captcha-delivery|challenge-platform|Attention Required! \| Cloudflare/i.test(text)

/** Every http(s) string in the data, with where it was found. */
function collect(value, path, out) {
  if (typeof value === 'string' && /^https?:\/\//.test(value)) {
    const list = out.get(value) ?? []
    list.push(path)
    out.set(value, list)
  } else if (Array.isArray(value)) value.forEach((v, i) => collect(v, `${path}[${i}]`, out))
  else if (value && typeof value === 'object') {
    // `source` of a fact is where we checked it — also worth checking.
    for (const [k, v] of Object.entries(value)) collect(v, path ? `${path}.${k}` : k, out)
  }
  return out
}

const host = (url) => new URL(url).hostname.replace(/^www\./, '')
/** «sub.example.com» and «example.com» count as the same site. */
const sameSite = (a, b) => a === b || a.endsWith(`.${b}`) || b.endsWith(`.${a}`)

async function check(url) {
  let current = url
  for (let hop = 0; hop < 8; hop++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
    let res
    try {
      res = await fetch(current, { redirect: 'manual', headers: HEADERS, signal: controller.signal })
    } catch (error) {
      clearTimeout(timer)
      return { kind: 'network', detail: error.name === 'AbortError' ? 'нет ответа за 20 с' : String(error.cause?.code ?? error.message) }
    } finally {
      clearTimeout(timer)
    }
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      current = new URL(res.headers.get('location'), current).href
      continue
    }
    const text = res.status >= 400 ? await res.text().catch(() => '') : ''
    if (res.status >= 400) {
      if ((res.status === 403 || res.status === 451) && REGION_BLOCK.test(text)) return { kind: 'region', detail: `HTTP ${res.status}`, final: current }
      if (res.status === 403 && isBotCheck(res, text)) return { kind: 'bot', detail: 'защита от роботов — в браузере открывается', final: current }
      return { kind: 'http', detail: `HTTP ${res.status}`, final: current }
    }
    if (!sameSite(host(url), host(current))) return { kind: 'redirect', detail: `ведёт на ${host(current)}`, final: current }
    return { kind: 'ok', final: current }
  }
  return { kind: 'http', detail: 'слишком много переадресаций' }
}

const links = collect(data, '', new Map())
const urls = [...links.keys()]
const results = new Map()
let next = 0
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    while (next < urls.length) {
      const url = urls[next++]
      results.set(url, await check(url))
    }
  }),
)

const groups = { ok: [], redirect: [], http: [], network: [], region: [], bot: [] }
for (const [url, r] of results) groups[r.kind].push({ url, ...r, where: links.get(url) })

const print = (title, list) => {
  if (list.length === 0) return
  console.log(`\n${title} (${list.length}):`)
  for (const r of list) console.log(`  ${r.url}\n    ${r.detail ?? ''}${r.final && r.final !== r.url ? ` → ${r.final}` : ''}\n    в данных: ${r.where.slice(0, 3).join(', ')}${r.where.length > 3 ? '…' : ''}`)
}
console.log(`Проверено ссылок: ${urls.length}. Открываются: ${groups.ok.length}.`)
print('Переадресация на другой сайт — проверить', groups.redirect)
print('Ошибка HTTP — проверить', groups.http)
print('Не открываются (сеть/таймаут) — возможно, блок для нашего региона', groups.network)
print('Заблокированы для нашего региона — не удалять', groups.region)
print('Защита от роботов — программа не проходит, человек в браузере проходит', groups.bot)

const broken = groups.redirect.length + groups.http.length
process.exitCode = broken > 0 ? 1 : 0
