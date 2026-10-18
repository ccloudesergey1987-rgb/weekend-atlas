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
  closure: 'Закрытие',
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
    reason: fact.status === 'verified' ? '' : (fact.note ?? defaultReason(field, fact)),
  })
}

const DAYS = { mon: 'пн', tue: 'вт', wed: 'ср', thu: 'чт', fri: 'пт', sat: 'сб', sun: 'вс' }
for (const day of route.days) {
  for (const p of day.points) {
    const object = `День ${day.day}. ${p.title}`
    for (const field of Object.keys(FIELD_TITLES)) add('Маршрут', object, field, p[field])
  }
}
for (const day of route.days) {
  for (const p of day.points) {
    for (const c of p.closures ?? []) {
      const when = c.days.map((d) => DAYS[d]).join(', ')
      const object = `${p.title} (${when})`
      add('Дни закрытия и альтернативы', object, 'closure', { ...c, value: c.text })
      const alt = c.alternative
      if (alt) {
        const name = `${object} → ${alt.title}`
        for (const field of ['address', 'openingHours', 'price', 'website']) add('Дни закрытия и альтернативы', name, field, alt[field])
      }
      if (c.advice) rows.push({ group: 'Дни закрытия и альтернативы', object, field: 'Как перестроить день', value: c.advice, status: 'advice', source: '', checkedAt: '—', reason: '' })
    }
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
const STATUS = { verified: '✅ verified', needs_check: '⚠️ needs_check', estimate: '≈ estimate', advice: '— совет редакции' }
const estimates = rows.filter((r) => r.status === 'estimate').length
const facts = rows.filter((r) => r.status !== 'advice')

let md = `# Чек-лист данных: ${city.name}

Файл собирается автоматически из \`src/data/${cityId}/*.json\` командой \`npm run checklist\`. Не правьте его руками — правьте JSON и пересоберите.

Правило: **verified** — значение прямо найдено на официальной странице, источник — точный адрес этой страницы. **estimate** — оценка редакции там, где официального источника быть не может (время переходов, такси по официальному тарифу); цены, часы и адреса так не помечаются. Всё остальное — **needs_check** с причиной. Часы работы и цены меняются — перед поездкой их стоит перепроверить.

**Итого:** ${facts.length} значений: проверено ${verified}, оценка редакции ${estimates}, требует проверки ${facts.length - verified - estimates}.
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
console.log(`docs/data-checklist.md: ${facts.length} values, ${verified} verified, ${estimates} estimate`)
