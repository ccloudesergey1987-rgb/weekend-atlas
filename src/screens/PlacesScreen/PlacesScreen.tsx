import { useSearchParams } from 'react-router'
import { getCityContent } from '../../data'
import { FOCUS_PARAM, useScrollToCard } from '../../lib/focusCard'
import type { PlaceFilters } from './placeFilters'
import {
  NO_FILTERS,
  PLACE_TYPES,
  filterPlaces,
  filtersToParams,
  hasActiveFilters,
  parseFilters,
  toggle,
} from './placeFilters'
import { PRICE_LEVELS, priceLevelName, priceLevelSymbol } from '../../utils/priceLevel'
import { pluralize } from '../../utils/format'
import { PlaceCard } from './PlaceCard'
import styles from './PlacesScreen.module.css'

function Chip({ active, onClick, label, children }: { active: boolean; onClick: () => void; label?: string; children: string }) {
  return (
    <button
      type="button"
      className={active ? `${styles.chip} ${styles.chipActive}` : styles.chip}
      aria-pressed={active}
      aria-label={label}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

export function PlacesScreen() {
  const { route, places } = getCityContent()
  const [searchParams, setSearchParams] = useSearchParams()

  const knownAreas = route.days.flatMap((d) => d.areas)
  const filters = parseFilters(searchParams, knownAreas)
  const results = filterPlaces(places.places, filters)
  // Opened from favorites: no filters in the address, so the place is in the list.
  const focusId = searchParams.get(FOCUS_PARAM)
  useScrollToCard(focusId)
  // Only types that this city actually has, so there is never a chip leading nowhere.
  const types = PLACE_TYPES.filter((t) => places.places.some((p) => p.type === t.id))
  const onlyExamples = places.places.length > 0 && places.places.every((p) => p.isExample)

  // `replace`: chips change the current address instead of adding history steps,
  // so «Назад» returns to where the user came from (e.g. the route), not chip by chip.
  function update(next: PlaceFilters) {
    setSearchParams(filtersToParams(next), { replace: true })
  }

  return (
    <section className={styles.screen}>
      <h1 className={styles.title}>Еда и места</h1>
      <p className={styles.lead}>Где пообедать, выпить кофе или вермут рядом с маршрутом.</p>
      {onlyExamples && (
        <p className={styles.notice}>
          Пока здесь только примеры, чтобы показать, как работает раздел. Настоящие заведения появятся после проверки.
        </p>
      )}

      <div className={styles.filters}>
        {filters.area && (
          <div className={styles.areaFilter}>
            <span>
              Район: <strong>{filters.area}</strong>
            </span>
            <button
              type="button"
              className={styles.areaRemove}
              aria-label={`Убрать фильтр по району ${filters.area}`}
              onClick={() => update({ ...filters, area: null })}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        )}

        <div className={styles.chipGroup} role="group" aria-label="Тип заведения">
          {types.map((t) => (
            <Chip
              key={t.id}
              active={filters.types.includes(t.id)}
              onClick={() => update({ ...filters, types: toggle(filters.types, t.id) })}
            >
              {t.chip}
            </Chip>
          ))}
        </div>

        <div className={styles.chipGroup} role="group" aria-label="Уровень цены">
          {PRICE_LEVELS.map((level) => (
            <Chip
              key={level}
              active={filters.levels.includes(level)}
              label={`${priceLevelSymbol(level)} — ${priceLevelName(level)}`}
              onClick={() => update({ ...filters, levels: toggle(filters.levels, level) })}
            >
              {priceLevelSymbol(level)}
            </Chip>
          ))}
        </div>
      </div>

      <div className={styles.resultsBar}>
        <p className={styles.count} aria-live="polite">
          {results.length > 0
            ? `${results.length} ${pluralize(results.length, ['место', 'места', 'мест'])}`
            : 'Ничего не найдено'}
        </p>
        {hasActiveFilters(filters) && results.length > 0 && (
          <button type="button" className={styles.resetLink} onClick={() => update(NO_FILTERS)}>
            Сбросить фильтры
          </button>
        )}
      </div>

      {results.length > 0 ? (
        <ul className={styles.list}>
          {results.map((place) => (
            <li key={place.id}>
              <PlaceCard place={place} highlighted={place.id === focusId} />
            </li>
          ))}
        </ul>
      ) : (
        <div className={styles.empty}>
          <h2 className={styles.emptyTitle}>Под эти фильтры ничего не подходит</h2>
          <p className={styles.emptyText}>
            {filters.area
              ? `В районе «${filters.area}» нет мест с такими условиями. Уберите часть фильтров или посмотрите все районы.`
              : 'Уберите часть фильтров — например, выберите другой уровень цены или тип заведения.'}
          </p>
          <button type="button" className={styles.resetButton} onClick={() => update(NO_FILTERS)}>
            Сбросить фильтры
          </button>
        </div>
      )}
    </section>
  )
}
