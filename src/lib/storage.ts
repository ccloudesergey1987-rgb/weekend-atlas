/**
 * Safe wrapper around localStorage. Storage may be missing or throw
 * (private mode, blocked cookies, quota exceeded, some in-app browsers):
 * then reads return null and writes are silently skipped — the app keeps
 * working, it just does not remember the choice.
 */

function storage(): Storage | null {
  try {
    return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null
  } catch {
    return null
  }
}

/** Parsed JSON stored under `key`, or null if absent, broken or unavailable. */
export function readJson(key: string): unknown {
  try {
    const text = storage()?.getItem(key)
    return text == null ? null : (JSON.parse(text) as unknown)
  } catch {
    return null
  }
}

/** Returns false if the value could not be saved. */
export function writeJson(key: string, value: unknown): boolean {
  try {
    const s = storage()
    if (!s) return false
    s.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

export function removeKey(key: string): void {
  try {
    storage()?.removeItem(key)
  } catch {
    // Nothing to do: storage is unavailable.
  }
}
