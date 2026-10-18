// Builds docs/data-checklist.md from the city JSON files: every fact and
// price with its status, source, check date and the reason it is unverified.
// Run: npm run checklist [-- <cityId>]   (default: barcelona)

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const cityId = process.argv[2] ?? 'barcelona'
const read = (name) => JSON.parse(readFileSync(join(root, 'src/data', cityId, `${name}.json`), 'utf8'))
const city = read('city')
const route = read('route')
const places = read('places')
const budget = read('budget')

const FIELD_TITLES = {
  address: 'Адрес',
  openingHours: 'Часы работы',
  admission: 'Вход',
  price: 'Цена',
  tickets: 'Покупка билетов',
  booking: 'Бронь',
  website: 'Сайт',
  transferFromPrevious: 'Переход от предыдущей точки',
}
const ADMISSION = { paid: 'платный', free: 'бесплатно', unknown: 'неизвестно' }
const MODES = { walk: 'пешком', metro: 'на метро', bus: 'на автобусе', taxi: 'на такси' }

const money = (n) => String(n).replace('.', ',')
function valueText(field, fact) {
  if ('min' in fact) {
    const range = fact.min === fact.max ? money(fact.min) : `${money(fact.min)}–${money(fact.max)}`
    return `${range} €`
  }
  if (field === 'admission') return ADMISSION[fact.value] ?? fact.value
  if (field === 'transferFromPrevious') return `≈ ${fact.minutes} мин ${MODES[fact.mode]}`
  return String(fact.value)
}

/** Markdown table cell: no line breaks, escaped pipes. */
const cell = (text) => String(text ?? '').replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim()
const link = (source) => (/^https?:\/\//.test(source) ? `<${source}>` : source)

function defaultReason(field, fact) {
  if (field === 'transferFromPrevious') return 'Время в пути — оценка редакции, официального источника нет'
  return fact.checkedAt ? '' : 'Ещё не проверялось'
}

const rows = []
function add(group, object, field, fact) {
  if (!fact) return
  rows.push({
    group,
    object,
    field: FIELD_TITLES[field] ?? field,
    value: valueText(field, fact),
    status: fact.status,
    source: fact.source,
    checkedAt: fact.checkedAt ?? '—',
    reason: fact.status === 'needs_check' ? (fact.note ?? defaultReason(field, fact)) : '',
  })
}

for (const day of route.days) {
  for (const p of day.points) {
    const object = `День ${day.day}. ${p.title}`
    for (const field of Object.keys(FIELD_TITLES)) add('Маршрут', object, field, p[field])
  }
}
for (const p of places.places) {
  for (const field of ['address', 'openingHours', 'price', 'website']) add('Еда и места', p.name, field, p[field])
}
const budgetGroups = [
  ['Бюджет: питание (на человека в день)', budget.food],
  ['Бюджет: транспорт по городу (на человека)', budget.transport],
  ['Бюджет: трансфер из аэропорта', budget.transfer],
]
for (const [group, options] of budgetGroups) {
  for (const o of options.options) {
    const suffix = o.trip ? (o.trip === 'round_trip' ? ', туда и обратно' : ', в одну сторону') : ''
    if (o.price) add(group, `${o.title}${suffix}`, 'price', o.price)
    else rows.push({ group, object: o.title, field: 'Цена', value: 'нет', status: 'needs_check', source: '', checkedAt: '—', reason: 'Цена не указана' })
  }
}

const verified = rows.filter((r) => r.status === 'verified').length
const STATUS = { verified: '✅ verified', needs_check: '⚠️ needs_check' }

let md = `# Чек-лист данных: ${city.name}

Файл собирается автоматически из \`src/data/${cityId}/*.json\` командой \`npm run checklist\`. Не правьте его руками — правьте JSON и пересоберите.

Правило: **verified** — значение прямо найдено на официальной странице, источник — точный адрес этой страницы. Всё остальное — **needs_check** с причиной. Часы работы и цены меняются — перед поездкой их стоит перепроверить.

**Итого:** ${rows.length} значений, проверено ${verified}, требует проверки ${rows.length - verified}.
`
for (const group of [...new Set(rows.map((r) => r.group))]) {
  const list = rows.filter((r) => r.group === group)
  md += `\n## ${group}\n\n| Объект | Поле | Значение | Статус | Источник | Дата | Причина |\n|---|---|---|---|---|---|---|\n`
  for (const r of list) {
    md += `| ${[r.object, r.field, r.value, STATUS[r.status], link(r.source), r.checkedAt, r.reason].map(cell).join(' | ')} |\n`
  }
}

const out = join(root, 'docs/data-checklist.md')
mkdirSync(dirname(out), { recursive: true })
writeFileSync(out, md)
console.log(`docs/data-checklist.md: ${rows.length} values, ${verified} verified`)
