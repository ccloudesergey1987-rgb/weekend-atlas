import { afterEach, describe, expect, it, vi } from 'vitest'
import { readJson, removeKey, writeJson } from './storage'

function fakeStorage(): Storage {
  const data = new Map<string, string>()
  return {
    get length() {
      return data.size
    },
    clear: () => data.clear(),
    getItem: (k) => data.get(k) ?? null,
    key: (i) => [...data.keys()][i] ?? null,
    removeItem: (k) => void data.delete(k),
    setItem: (k, v) => void data.set(k, String(v)),
  }
}

const throwing = (): never => {
  throw new Error('SecurityError')
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('обёртка над localStorage', () => {
  it('сохраняет, читает и удаляет значение (сброс)', () => {
    vi.stubGlobal('window', { localStorage: fakeStorage() })
    expect(writeJson('k', { travelers: 3 })).toBe(true)
    expect(readJson('k')).toEqual({ travelers: 3 })
    removeKey('k')
    expect(readJson('k')).toBeNull()
  })

  it('испорченный JSON читается как отсутствие значения', () => {
    const storage = fakeStorage()
    storage.setItem('k', '{not json')
    vi.stubGlobal('window', { localStorage: storage })
    expect(readJson('k')).toBeNull()
  })

  it('не падает, если хранилище бросает ошибки', () => {
    vi.stubGlobal('window', {
      localStorage: { getItem: throwing, setItem: throwing, removeItem: throwing },
    })
    expect(readJson('k')).toBeNull()
    expect(writeJson('k', 1)).toBe(false)
    expect(() => removeKey('k')).not.toThrow()
  })

  it('не падает, если доступ к хранилищу запрещён', () => {
    vi.stubGlobal('window', {
      get localStorage() {
        return throwing()
      },
    })
    expect(readJson('k')).toBeNull()
    expect(writeJson('k', 1)).toBe(false)
  })

  it('работает без window (например, при сборке)', () => {
    vi.stubGlobal('window', undefined)
    expect(readJson('k')).toBeNull()
    expect(writeJson('k', 1)).toBe(false)
  })
})
