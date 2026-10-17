import type { BudgetSettings, City, Places, Route } from '../types/content'

import barcelonaCity from './barcelona/city.json'
import barcelonaRoute from './barcelona/route.json'
import barcelonaPlaces from './barcelona/places.json'
import barcelonaBudget from './barcelona/budget.json'

export interface CityContent {
  city: City
  route: Route
  places: Places
  budget: BudgetSettings
}

// JSON literals widen to `string`, so the files are cast to the content types.
// Adding a city = adding a folder in src/data/ and one entry here.
const cities: Record<string, CityContent> = {
  barcelona: {
    city: barcelonaCity as City,
    route: barcelonaRoute as Route,
    places: barcelonaPlaces as Places,
    budget: barcelonaBudget as BudgetSettings,
  },
}

/** The MVP has a single city; city selection is out of scope. */
export const DEFAULT_CITY_ID = 'barcelona'

export function getCityContent(cityId: string = DEFAULT_CITY_ID): CityContent {
  const content = cities[cityId]
  if (!content) throw new Error(`Unknown city: ${cityId}`)
  return content
}
