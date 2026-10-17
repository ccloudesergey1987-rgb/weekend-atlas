import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CLOUD_KEY, LOCAL_KEY, createFavoritesStore, type CloudStore } from './favorites'
import { cloudStorageOf } from '../telegram/telegram'

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

/** CloudStorage stub. `answer` lets a test hold the first read until it wants. */
function fakeCloud(initial: string | null = null) {
  let value = initial
  let release: () => void = () => {}
  const gate = new Promise<void>((r) => (release = r))
  let held = false
  const cloud: CloudStore & { value: () => string | null; hold: () => void; answer: () => void } = {
    getItem: vi.fn(async (key: string) => {
      expect(key).toBe(CLOUD_KEY)
      if (held) await gate
      return value
    }),
    setItem: vi.fn(async (key: string, v: string) => {
      expect(key).toBe(CLOUD_KEY)
      value = v
    }),
    value: () => value,
    hold: () => void (held = true),
    answer: () => release(),
  }
  return cloud
}

const throwing = (): never => {
  throw new Error('SecurityError')
}

const A = 'barcelona/sagrada-familia'
const B = 'barcelona/park-guell'
const C = 'barcelona/example-cafe-gracia'

let local: Storage

beforeEach(() => {
  local = fakeStorage()
  vi.stubGlobal('window', { localStorage: local })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('избранное без Telegram (только localStorage)', () => {
  it('добавляет и сохраняет локально', () => {
    const store = createFavoritesStore()
    store.add(A)
    expect(store.has(A)).toBe(true)
    expect(JSON.parse(local.getItem(LOCAL_KEY)!)).toEqual([A])
    // after a reload
    expect(createFavoritesStore().getSnapshot()).toEqual([A])
  })

  it('удаляет', () => {
    const store = createFavoritesStore()
    store.add(A)
    store.add(B)
    store.remove(A)
    expect(store.getSnapshot()).toEqual([B])
    expect(createFavoritesStore().getSnapshot()).toEqual([B])
  })

  it('повторное добавление не создаёт дубль и не меняет список', () => {
    const store = createFavoritesStore()
    store.add(A)
    const before = store.getSnapshot()
    const listener = vi.fn()
    store.subscribe(listener)
    store.add(A)
    expect(store.getSnapshot()).toBe(before)
    expect(listener).not.toHaveBeenCalled()
  })

  it('удаление того, чего нет, ничего не ломает', () => {
    const store = createFavoritesStore()
    expect(() => store.remove(A)).not.toThrow()
    expect(store.getSnapshot()).toEqual([])
  })

  it('toggle добавляет и убирает, подписчики узнают об изменении', () => {
    const store = createFavoritesStore()
    const listener = vi.fn()
    store.subscribe(listener)
    store.toggle(A)
    expect(store.has(A)).toBe(true)
    store.toggle(A)
    expect(store.has(A)).toBe(false)
    expect(listener).toHaveBeenCalledTimes(2)
  })

  it('sync без облака оставляет локальную копию', async () => {
    local.setItem(LOCAL_KEY, JSON.stringify([A]))
    const store = createFavoritesStore()
    await store.sync(null)
    expect(store.getSnapshot()).toEqual([A])
  })

  it('испорченные данные в localStorage читаются как пустой список, мусор отбрасывается', () => {
    local.setItem(LOCAL_KEY, '{not json')
    expect(createFavoritesStore().getSnapshot()).toEqual([])
    local.setItem(LOCAL_KEY, JSON.stringify([A, 42, null, '', A, B]))
    expect(createFavoritesStore().getSnapshot()).toEqual([A, B])
    local.setItem(LOCAL_KEY, JSON.stringify({ ids: [A] }))
    expect(createFavoritesStore().getSnapshot()).toEqual([])
  })
})

describe('недоступное хранилище', () => {
  it('localStorage бросает ошибки — избранное работает в памяти', () => {
    vi.stubGlobal('window', { localStorage: { getItem: throwing, setItem: throwing, removeItem: throwing } })
    const store = createFavoritesStore()
    expect(() => store.add(A)).not.toThrow()
    expect(store.has(A)).toBe(true)
    store.remove(A)
    expect(store.has(A)).toBe(false)
  })

  it('доступ к localStorage запрещён', () => {
    vi.stubGlobal('window', {
      get localStorage() {
        return throwing()
      },
    })
    const store = createFavoritesStore()
    store.add(A)
    expect(store.getSnapshot()).toEqual([A])
  })

  it('облако не отвечает при чтении — остаётся локальная копия, запись в облако не идёт', async () => {
    local.setItem(LOCAL_KEY, JSON.stringify([A]))
    const cloud: CloudStore = { getItem: vi.fn().mockRejectedValue(new Error('timeout')), setItem: vi.fn() }
    const store = createFavoritesStore()
    await expect(store.sync(cloud)).resolves.toBeUndefined()
    store.add(B)
    expect(store.getSnapshot()).toEqual([A, B])
    expect(cloud.setItem).not.toHaveBeenCalled()
  })

  it('ошибка записи в облако не ломает интерфейс', async () => {
    const cloud: CloudStore = {
      getItem: vi.fn().mockResolvedValue(null),
      setItem: vi.fn().mockRejectedValue(new Error('offline')),
    }
    const store = createFavoritesStore()
    await store.sync(cloud)
    expect(() => store.add(A)).not.toThrow()
    await Promise.resolve()
    expect(store.getSnapshot()).toEqual([A])
    expect(JSON.parse(local.getItem(LOCAL_KEY)!)).toEqual([A])
  })
})

describe('синхронизация с CloudStorage (заглушка)', () => {
  it('облако главнее локальной копии и обновляет её', async () => {
    local.setItem(LOCAL_KEY, JSON.stringify([A]))
    const store = createFavoritesStore()
    expect(store.getSnapshot()).toEqual([A]) // shown at once, before the cloud answers
    await store.sync(fakeCloud(JSON.stringify([B, C])))
    expect(store.getSnapshot()).toEqual([B, C])
    expect(JSON.parse(local.getItem(LOCAL_KEY)!)).toEqual([B, C])
  })

  it('пустое облако получает локальную копию', async () => {
    local.setItem(LOCAL_KEY, JSON.stringify([A]))
    const cloud = fakeCloud(null)
    const store = createFavoritesStore()
    await store.sync(cloud)
    expect(store.getSnapshot()).toEqual([A])
    expect(cloud.value()).toBe(JSON.stringify([A]))
  })

  it('пустой список в облаке — это тоже ответ: удаление на другом устройстве доходит', async () => {
    local.setItem(LOCAL_KEY, JSON.stringify([A]))
    const store = createFavoritesStore()
    await store.sync(fakeCloud('[]'))
    expect(store.getSnapshot()).toEqual([])
  })

  it('испорченное значение в облаке перезаписывается локальной копией', async () => {
    local.setItem(LOCAL_KEY, JSON.stringify([A]))
    const cloud = fakeCloud('{oops')
    const store = createFavoritesStore()
    await store.sync(cloud)
    expect(store.getSnapshot()).toEqual([A])
    expect(cloud.value()).toBe(JSON.stringify([A]))
  })

  it('после синхронизации изменения сразу уходят в облако', async () => {
    const cloud = fakeCloud(null)
    const store = createFavoritesStore()
    await store.sync(cloud)
    store.add(A)
    store.add(B)
    store.remove(A)
    expect(cloud.value()).toBe(JSON.stringify([B]))
  })

  it('изменения, сделанные пока облако отвечало, не теряются', async () => {
    local.setItem(LOCAL_KEY, JSON.stringify([A]))
    const cloud = fakeCloud(JSON.stringify([A, B]))
    cloud.hold()
    const store = createFavoritesStore()
    const syncing = store.sync(cloud)
    store.add(C) // user taps hearts while the cloud is still loading
    store.remove(A)
    expect(cloud.setItem).not.toHaveBeenCalled()
    cloud.answer()
    await syncing
    expect(store.getSnapshot()).toEqual([B, C])
    expect(cloud.value()).toBe(JSON.stringify([B, C]))
  })

  it('без изменений облако не перезаписывается при запуске', async () => {
    const cloud = fakeCloud(JSON.stringify([A]))
    await createFavoritesStore().sync(cloud)
    expect(cloud.setItem).not.toHaveBeenCalled()
  })

  it('отсутствующие в данных ID из облака сохраняются как есть (их пропускает экран)', async () => {
    const store = createFavoritesStore()
    await store.sync(fakeCloud(JSON.stringify(['barcelona/removed-point', A])))
    expect(store.getSnapshot()).toEqual(['barcelona/removed-point', A])
  })
})

describe('CloudStorage в Telegram', () => {
  type Callback = (error: string | null, result?: unknown) => void
  function webApp(version: number, api?: Record<string, (...args: never[]) => void>) {
    return {
      isVersionAtLeast: (v: string) => version >= Number(v),
      CloudStorage: api as never,
    }
  }
  const working = () => {
    const data = new Map<string, string>()
    return {
      getItem: (key: string, cb: Callback) => cb(null, data.get(key) ?? ''),
      setItem: (key: string, value: string, cb: Callback) => {
        data.set(key, value)
        cb(null, true)
      },
    }
  }

  it('в версиях Telegram до 6.9 не используется', () => {
    expect(cloudStorageOf(webApp(6.1, working()))).toBeNull()
    expect(cloudStorageOf(webApp(6.0, working()))).toBeNull()
  })

  it('без объекта CloudStorage не используется', () => {
    expect(cloudStorageOf(webApp(7.0))).toBeNull()
  })

  it('с 6.9 читает и пишет; пустая строка Telegram — это «нет значения»', async () => {
    const cloud = cloudStorageOf(webApp(6.9, working()))!
    expect(await cloud.getItem(CLOUD_KEY)).toBeNull()
    await cloud.setItem(CLOUD_KEY, '["x"]')
    expect(await cloud.getItem(CLOUD_KEY)).toBe('["x"]')
  })

  it('ошибка Telegram превращается в отказ, который хранилище избранного переживает', async () => {
    const cloud = cloudStorageOf(
      webApp(7.0, {
        getItem: (_k: never, cb: Callback) => cb('STORAGE_KEY_CLOUD_ERROR'),
        setItem: () => throwing(),
      }),
    )!
    await expect(cloud.getItem(CLOUD_KEY)).rejects.toThrow('STORAGE_KEY_CLOUD_ERROR')
    await expect(cloud.setItem(CLOUD_KEY, '[]')).rejects.toThrow()

    local.setItem(LOCAL_KEY, JSON.stringify([A]))
    const store = createFavoritesStore()
    await store.sync(cloud)
    expect(store.getSnapshot()).toEqual([A])
  })

  it('зависший вызов прерывается по таймауту', async () => {
    vi.useFakeTimers()
    try {
      const cloud = cloudStorageOf(webApp(7.0, { getItem: () => {}, setItem: () => {} }))!
      const result = cloud.getItem(CLOUD_KEY)
      vi.advanceTimersByTime(6_000)
      await expect(result).rejects.toThrow('timeout')
    } finally {
      vi.useRealTimers()
    }
  })
})
