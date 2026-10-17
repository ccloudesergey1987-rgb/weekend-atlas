import type { Place, Places, Route, RoutePoint } from '../../types/content'

export interface FavoritePoint {
  day: number
  point: RoutePoint
}

export interface ResolvedFavorites {
  route: FavoritePoint[]
  places: Place[]
}

/**
 * Saved IDs → route points and places, in guide order (day by day, then as
 * in the catalog), not in the order they were saved.
 *
 * IDs that are no longer in the data (a point was removed, or belongs to
 * another city) are silently skipped. They stay in storage, so they come back
 * if the point returns.
 */
export function resolveFavorites(ids: readonly string[], route: Route, places: Places): ResolvedFavorites {
  const saved = new Set(ids)
  return {
    route: route.days.flatMap((d) => d.points.filter((p) => saved.has(p.id)).map((point) => ({ day: d.day, point }))),
    places: places.places.filter((p) => saved.has(p.id)),
  }
}
