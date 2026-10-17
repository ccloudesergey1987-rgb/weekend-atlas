/**
 * Favorites: IDs of saved route points and places («barcelona/sagrada-familia»).
 *
 * Where they live:
 *  - always in localStorage — the local copy, read at startup, so hearts show at once;
 *  - inside Telegram (6.9+) also in CloudStorage, so they follow the user across devices.
 *
 * At startup the cloud is read once. It wins over the local copy, except for
 * what the user changed while it was loading: those changes are applied on top.
 * If the cloud is empty, the local copy is uploaded.
 *
 * Storage errors never reach the interface: a failed write leaves the list
 * working in memory for this visit.
 */

import { readJson, writeJson } from './storage'

/** localStorage key and CloudStorage key (CloudStorage allows only A–Z, a–z, 0–9, _ and -). */
export const LOCAL_KEY = 'weekend-atlas:favorites'
export const CLOUD_KEY = 'favorites'

/** CloudStorage value limit; above it the list is kept only locally. */
const CLOUD_VALUE_LIMIT = 4096

/** The part of Telegram CloudStorage we need; replaced by a stub in tests. */
export interface CloudStore {
  getItem(key: string): Promise<string | null>
  setItem(key: string, value: string): Promise<void>
}

export interface FavoritesStore {
  /** Same array until the list changes (required by useSyncExternalStore). */
  getSnapshot(): readonly string[]
  subscribe(listener: () => void): () => void
  has(id: string): boolean
  add(id: string): void
  remove(id: string): void
  toggle(id: string): void
  /** Reads the cloud and starts writing to it. `null` — no cloud, local copy only. */
  sync(cloud: CloudStore | null): Promise<void>
}

/** A list of unique strings, or null if `value` is not a list at all. */
function parseIds(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null
  return [...new Set(value.filter((v): v is string => typeof v === 'string' && v !== ''))]
}

function parseCloud(text: string | null): string[] | null {
  if (text === null) return null
  try {
    return parseIds(JSON.parse(text))
  } catch {
    return null
  }
}

export function createFavoritesStore(): FavoritesStore {
  let ids: readonly string[] = parseIds(readJson(LOCAL_KEY)) ?? []
  let cloud: CloudStore | null = null
  /** Changes made before the cloud answered: id → whether it is now saved. */
  const pending = new Map<string, boolean>()
  const listeners = new Set<() => void>()

  function pushToCloud(): void {
    const value = JSON.stringify(ids)
    if (!cloud || value.length > CLOUD_VALUE_LIMIT) return
    cloud.setItem(CLOUD_KEY, value).catch(() => {
      // Offline or Telegram error: the local copy still has it.
    })
  }

  function commit(next: readonly string[]): void {
    ids = next
    writeJson(LOCAL_KEY, ids)
    listeners.forEach((listener) => listener())
  }

  function set(id: string, saved: boolean): void {
    if (ids.includes(id) === saved) return
    commit(saved ? [...ids, id] : ids.filter((v) => v !== id))
    if (cloud) pushToCloud()
    else pending.set(id, saved)
  }

  return {
    getSnapshot: () => ids,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    has: (id) => ids.includes(id),
    add: (id) => set(id, true),
    remove: (id) => set(id, false),
    toggle: (id) => set(id, !ids.includes(id)),

    async sync(store) {
      if (!store || cloud) return
      let remote: string[] | null
      try {
        remote = parseCloud(await store.getItem(CLOUD_KEY))
      } catch {
        return // cloud unavailable: keep working with the local copy
      }
      cloud = store

      if (remote === null) {
        pending.clear()
        pushToCloud()
        return
      }
      let merged = remote
      for (const [id, saved] of pending) {
        merged = saved ? (merged.includes(id) ? merged : [...merged, id]) : merged.filter((v) => v !== id)
      }
      const hadPending = pending.size > 0
      pending.clear()
      if (merged.join('\n') !== ids.join('\n')) commit(merged)
      if (hadPending) pushToCloud()
    },
  }
}
