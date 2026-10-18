import { useEffect, useRef, useState } from 'react'
import { getCityContent } from '../../data'
import type { BudgetLine, BudgetLineId, BudgetResult, BudgetSelection } from '../../lib/budget'
import {
  MAX_TRAVELERS,
  MIN_TRAVELERS,
  calculateBudget,
  defaultSelection,
  formatRange,
  formatUnitPrice,
  paidSights,
  sanitizeSelection,
} from '../../lib/budget'
import { readJson, writeJson } from '../../lib/storage'
import type { BudgetSettings, TransferOption } from '../../types/content'
import { currencySymbol, pluralize } from '../../utils/format'
import { VerificationBadge } from '../../components/VerificationBadge/VerificationBadge'
import { AmountField, Choice, Section, Stepper } from './BudgetControls'
import styles from './BudgetScreen.module.css'

/** «на 1 человека», «на 2 человека», «на 5 человек». */
const forPeople = (n: number) => `на ${n} ${pluralize(n, ['человека', 'человека', 'человек'])}`

const lineTitles: Record<BudgetLineId, string> = {
  food: 'Питание',
  sights: 'Достопримечательности',
  transport: 'Транспорт по городу',
  transfer: 'Трансфер из аэропорта',
  extra: 'Прочие расходы',
  flights: 'Авиабилеты',
  lodging: 'Проживание',
}

function missingText(result: BudgetResult): string | null {
  if (result.missingFlights && result.missingLodging) return 'Без учёта авиабилетов и проживания'
  if (result.missingFlights) return 'Без учёта авиабилетов'
  if (result.missingLodging) return 'Без учёта проживания'
  return null
}

function unpricedText(n: number): string {
  return `${n} ${pluralize(n, ['место', 'места', 'мест'])} без цены — ${n % 10 === 1 && n % 100 !== 11 ? 'не учтено' : 'не учтены'}`
}

function lineValue(line: BudgetLine, settings: BudgetSettings): string {
  if (line.euros) return formatRange(line.euros, settings.currency)
  if (line.id === 'flights' || line.id === 'lodging') return 'добавьте сами'
  if (line.id === 'extra') return 'не указано'
  return 'не учтено'
}

/** «на человека, туда и обратно», «за машину, в одну сторону». */
function transferUnitText(option: TransferOption): string {
  const who = option.pricing === 'per_vehicle' ? 'за машину' : 'на человека'
  return `${who}, ${option.trip === 'round_trip' ? 'туда и обратно' : 'в одну сторону'}`
}

/** Remembers the user's choice between visits. Storage failures are harmless. */
function useBudgetSelection(key: string, settings: BudgetSettings, sights: ReturnType<typeof paidSights>) {
  const [selection, setSelection] = useState<BudgetSelection>(() => sanitizeSelection(readJson(key), settings, sights))
  useEffect(() => {
    writeJson(key, selection)
  }, [key, selection])
  return [selection, setSelection] as const
}

/** True while the element is on screen; used to hide the sticky total next to the full one. */
function useInView<T extends Element>() {
  const ref = useRef<T>(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return [ref, inView] as const
}

export function BudgetScreen() {
  const { city, route, budget: settings } = getCityContent()
  const sights = paidSights(route)
  const [selection, setSelection] = useBudgetSelection(`weekend-atlas:budget:${city.id}:v1`, settings, sights)
  const [resultRef, resultInView] = useInView<HTMLElement>()

  const result = calculateBudget({ settings, days: city.durationDays, sights, selection })
  const symbol = currencySymbol(settings.currency)
  const update = (patch: Partial<BudgetSelection>) => setSelection((s) => ({ ...s, ...patch }))
  const excluded = new Set(selection.excludedSightIds)
  const isDefault = JSON.stringify(selection) === JSON.stringify(defaultSelection(settings))

  const total = formatRange(result.totalEuros, settings.currency)
  const perPerson = formatRange(result.perPersonEuros, settings.currency)
  const missing = missingText(result)

  function toggleSight(id: string) {
    const next = excluded.has(id) ? selection.excludedSightIds.filter((x) => x !== id) : [...selection.excludedSightIds, id]
    update({ excludedSightIds: next })
  }

  return (
    <div className={styles.screen}>
      <h1 className={styles.title}>Бюджет</h1>
      <p className={styles.lead}>
        {city.name}, {city.durationDays} {pluralize(city.durationDays, ['день', 'дня', 'дней'])}. Расходы от минимума до
        максимума — итог пересчитывается сразу.
      </p>

      <Section title="Путешественники">
        <div className={styles.travelers}>
          <span className={styles.travelersLabel}>Сколько вас едет</span>
          <Stepper
            label="Количество путешественников"
            value={selection.travelers}
            min={MIN_TRAVELERS}
            max={MAX_TRAVELERS}
            onChange={(travelers) => update({ travelers })}
          />
        </div>
      </Section>

      <Section title="Питание" hint="На человека в день.">
        {settings.food.options.map((o) => (
          <Choice
            key={o.id}
            type="radio"
            name="food"
            checked={selection.foodId === o.id}
            onChange={() => update({ foodId: o.id })}
            title={o.title}
            description={o.description}
            price={formatUnitPrice(o.price)}
            muted={!o.price}
            priceExtra={o.price && <VerificationBadge status={o.price.status} />}
          />
        ))}
      </Section>

      <Section title="Достопримечательности" hint="Платные места из маршрута, цена входного билета на взрослого.">
        {sights.map((s) => (
          <Choice
            key={s.id}
            type="checkbox"
            checked={!excluded.has(s.id)}
            onChange={() => toggleSight(s.id)}
            title={s.title}
            description={`День ${s.day}`}
            price={formatUnitPrice(s.price)}
            muted={!s.price}
            priceExtra={s.price && <VerificationBadge status={s.price.status} />}
          />
        ))}
        {result.unpricedSights > 0 && <p className={styles.notice}>{unpricedText(result.unpricedSights)}</p>}
      </Section>

      <Section title="Транспорт по городу" hint="На человека за всю поездку.">
        {settings.transport.options.map((o) => (
          <Choice
            key={o.id}
            type="radio"
            name="transport"
            checked={selection.transportId === o.id}
            onChange={() => update({ transportId: o.id })}
            title={o.title}
            description={o.description}
            price={formatUnitPrice(o.price)}
            muted={!o.price}
            priceExtra={o.price && <VerificationBadge status={o.price.status} />}
          />
        ))}
        {result.lines.find((l) => l.id === 'transport')?.cents === null && (
          <p className={styles.notice}>Цена этого варианта уточняется — в итог он не вошёл.</p>
        )}
      </Section>

      <Section title="Трансфер из аэропорта" hint="В итоге — дорога туда и обратно: билет в одну сторону считается дважды.">
        {settings.transfer.options.map((o) => (
          <Choice
            key={o.id}
            type="radio"
            name="transfer"
            checked={selection.transferId === o.id}
            onChange={() => update({ transferId: o.id })}
            title={o.title}
            description={o.description}
            price={formatUnitPrice(o.price)}
            muted={!o.price}
            priceExtra={
              <>
                {o.price && o.price.max > 0 && (
                  <span className={styles.priceUnit}>{transferUnitText(o)}</span>
                )}
                {o.price && <VerificationBadge status={o.price.status} />}
              </>
            }
          />
        ))}
        {result.transferIncluded && (
          <p className={styles.notice}>Поездки на метро в аэропорт уже входят в выбранный проездной — отдельно не считаются.</p>
        )}
        {result.vehicles !== null && result.vehicles > 1 && (
          <p className={styles.notice}>
            Вас {result.travelers} — понадобится {result.vehicles}{' '}
            {pluralize(result.vehicles, ['машина', 'машины', 'машин'])} в каждую сторону.
          </p>
        )}
      </Section>

      <Section title="Свои расходы" hint="Необязательно. Пустое поле в итог не входит.">
        <AmountField
          label="Прочие расходы"
          hint="Сувениры, покупки, запас — сумма на всех."
          suffix={symbol}
          value={selection.extra}
          onChange={(extra) => update({ extra })}
        />
        <AmountField
          label="Авиабилеты"
          hint="На одного человека, туда и обратно."
          suffix={symbol}
          value={selection.flights}
          onChange={(flights) => update({ flights })}
        />
        <AmountField
          label="Проживание"
          hint="За всё время, на всех."
          suffix={symbol}
          value={selection.lodging}
          onChange={(lodging) => update({ lodging })}
        />
      </Section>

      <section ref={resultRef} className={styles.result} aria-labelledby="budget-total">
        <p className={styles.resultLabel}>Итого {forPeople(result.travelers)}</p>
        <p id="budget-total" className={styles.resultTotal} aria-live="polite">
          {total}
        </p>
        {result.travelers > 1 && <p className={styles.resultPerPerson}>{perPerson} на человека</p>}

        {missing && <p className={styles.resultMissing}>{missing}</p>}

        <dl className={styles.breakdown}>
          {result.lines.map((line) => (
            <div key={line.id} className={styles.breakdownRow}>
              <dt>{lineTitles[line.id]}</dt>
              <dd className={line.cents ? undefined : styles.breakdownEmpty}>{lineValue(line, settings)}</dd>
            </div>
          ))}
        </dl>

        <div className={styles.resultNotes}>
          {result.needsCheck && (
            <p className={styles.notice}>
              Суммы ориентировочные: часть цен ещё не сверена с официальными источниками.
            </p>
          )}
          {result.unpricedSights > 0 && <p className={styles.notice}>{unpricedText(result.unpricedSights)}</p>}
          <p className={styles.tip}>Карты российских банков за границей не работают — заранее продумайте способ оплаты.</p>
        </div>

        <button
          type="button"
          className={styles.resetButton}
          disabled={isDefault}
          onClick={() => setSelection(defaultSelection(settings))}
        >
          Сбросить
        </button>
      </section>

      <div className={resultInView ? `${styles.stickyTotal} ${styles.stickyHidden}` : styles.stickyTotal} aria-hidden="true">
        <div className={styles.stickyInner}>
          <span className={styles.stickyLabel}>
            Итого {forPeople(result.travelers)}
            {missing && <span className={styles.stickyMissing}> · {missing.toLowerCase()}</span>}
          </span>
          <span className={styles.stickyValue}>{total}</span>
        </div>
      </div>
    </div>
  )
}
