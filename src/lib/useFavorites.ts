import { useSyncExternalStore } from 'react'
import { getTelegramCloudStorage } from '../telegram/telegram'
import { createFavoritesStore } from './favorites'

/** The app's single favorites list. */
export const favorites = createFavoritesStore()

/** Call once at startup. Never blocks: hearts show from the local copy meanwhile. */
export function startFavoritesSync(): void {
  getTelegramCloudStorage()
    .then((cloud) => favorites.sync(cloud))
    .catch(() => {
      // Stay with the local copy.
    })
}

/** Saved IDs; the component re-renders when they change. */
export function useFavorites(): readonly string[] {
  return useSyncExternalStore(favorites.subscribe, favorites.getSnapshot)
}
