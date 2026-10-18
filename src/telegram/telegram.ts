/**
 * Telegram Mini App integration. The ONLY place that talks to Telegram.
 *
 * The app must work fully without Telegram (main audience is in Russia,
 * where telegram.org may be slow or blocked). So:
 *  - the official script is injected only when the page was launched from
 *    Telegram, and asynchronously — rendering never waits for it;
 *  - every function here is a safe no-op outside Telegram.
 */

const SCRIPT_URL = 'https://telegram.org/js/telegram-web-app.js'

/** Key the official script uses to keep launch params across reloads. */
const SCRIPT_PARAMS_KEY = '__telegram__initParams'

/** If telegram.org does not answer in time, we stop waiting and work as a website. */
const SCRIPT_TIMEOUT_MS = 10_000

/** A CloudStorage call that hangs (bad connection) is given up after this. */
const CLOUD_TIMEOUT_MS = 5_000

// Minimal typing of the parts of Telegram.WebApp we use.
interface TelegramBackButton {
  show(): void
  hide(): void
  onClick(cb: () => void): void
  offClick(cb: () => void): void
}

type CloudCallback<T> = (error: string | null, result?: T) => void

interface TelegramCloudStorageApi {
  getItem(key: string, cb: CloudCallback<string>): void
  setItem(key: string, value: string, cb: CloudCallback<boolean>): void
}

interface TelegramWebApp {
  platform: string
  colorScheme: 'light' | 'dark'
  ready(): void
  expand(): void
  openLink(url: string): void
  openTelegramLink(url: string): void
  isVersionAtLeast(version: string): boolean
  setHeaderColor(color: string): void
  setBackgroundColor(color: string): void
  onEvent(event: 'themeChanged', cb: () => void): void
  BackButton: TelegramBackButton
  /** Since Bot API 6.9. Older apps have the object, but its calls only log errors. */
  CloudStorage?: TelegramCloudStorageApi
}

/** Promise-based Telegram CloudStorage: the user's data, synced across their devices. */
export interface TelegramCloudStorage {
  /** Stored value, or null if the key was never set. */
  getItem(key: string): Promise<string | null>
  setItem(key: string, value: string): Promise<void>
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp }
  }
}

let webApp: TelegramWebApp | null = null
let backHandler: (() => void) | null = null
/** Resolves once we know whether we are inside Telegram; outside it — at once. */
let ready: Promise<boolean> = Promise.resolve(false)

function readHashParams(): URLSearchParams | null {
  const hash = window.location.hash.replace(/^#/, '')
  if (!hash.includes('tgWebApp')) return null
  return new URLSearchParams(hash)
}

function hasStoredLaunchParams(): boolean {
  try {
    return window.sessionStorage.getItem(SCRIPT_PARAMS_KEY) !== null
  } catch {
    return false
  }
}

/**
 * Telegram passes launch data in the URL hash (#tgWebAppData=...), which
 * clashes with HashRouter. We hand the params to the official script via
 * sessionStorage (the same place it keeps them itself) and reset the hash
 * to the home route before the router starts.
 */
function moveLaunchParamsOutOfHash(params: URLSearchParams): void {
  try {
    const stored = JSON.parse(window.sessionStorage.getItem(SCRIPT_PARAMS_KEY) ?? '{}') as Record<string, string>
    params.forEach((value, key) => {
      stored[key] = value
    })
    window.sessionStorage.setItem(SCRIPT_PARAMS_KEY, JSON.stringify(stored))
  } catch {
    // sessionStorage unavailable: the script will still find nothing in the hash,
    // the app keeps working as a regular website.
  }
  const { pathname, search } = window.location
  window.history.replaceState(null, '', `${pathname}${search}#/`)
}

function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

function applyTheme(): void {
  if (!webApp) return
  document.documentElement.dataset.theme = webApp.colorScheme
  if (webApp.isVersionAtLeast('6.1')) {
    const bg = cssVar('--color-bg')
    webApp.setHeaderColor(bg)
    webApp.setBackgroundColor(bg)
  }
}

function applyBackButton(): void {
  if (!webApp || !webApp.isVersionAtLeast('6.1')) return
  const button = webApp.BackButton
  if (backHandler) {
    button.show()
  } else {
    button.hide()
  }
}

function onBackClick(): void {
  backHandler?.()
}

function onScriptLoaded(): void {
  const candidate = window.Telegram?.WebApp
  // The script also defines WebApp in a regular browser; platform tells them apart.
  if (!candidate || candidate.platform === 'unknown') return

  webApp = candidate
  webApp.ready()
  webApp.expand()
  applyTheme()
  webApp.onEvent('themeChanged', applyTheme)
  if (webApp.isVersionAtLeast('6.1')) webApp.BackButton.onClick(onBackClick)
  applyBackButton()
}

/**
 * Call once at startup, before rendering. Never blocks: returns immediately.
 */
export function initTelegram(): void {
  const hashParams = readHashParams()
  if (!hashParams && !hasStoredLaunchParams()) return // regular browser

  if (hashParams) moveLaunchParamsOutOfHash(hashParams)

  ready = new Promise<boolean>((resolve) => {
    const timer = window.setTimeout(() => resolve(false), SCRIPT_TIMEOUT_MS)
    const script = document.createElement('script')
    script.src = SCRIPT_URL
    script.async = true
    script.onload = () => {
      onScriptLoaded()
      window.clearTimeout(timer)
      resolve(webApp !== null)
    }
    // On error (e.g. telegram.org unreachable) we simply stay in browser mode.
    script.onerror = () => {
      window.clearTimeout(timer)
      resolve(false)
    }
    document.head.appendChild(script)
  })
}

/** True once the app is confirmed to be running inside Telegram. */
export function isInTelegram(): boolean {
  return webApp !== null
}

/** A link to a Telegram chat, bot or channel (t.me / telegram.me). */
export function isTelegramLink(url: string): boolean {
  try {
    const { protocol, hostname } = new URL(url)
    return protocol === 'https:' && (hostname === 't.me' || hostname === 'telegram.me')
  } catch {
    return false
  }
}

/**
 * Inside Telegram: t.me links open the chat in Telegram itself (openLink
 * would send them to a browser), other links — in Telegram's browser.
 * Exported for tests.
 */
export function openLinkIn(app: Pick<TelegramWebApp, 'openLink' | 'openTelegramLink'>, url: string): void {
  if (isTelegramLink(url)) {
    app.openTelegramLink(url)
  } else {
    app.openLink(url)
  }
}

/**
 * Open an external URL: via Telegram inside Telegram, in a new tab otherwise.
 */
export function openExternalLink(url: string): void {
  if (webApp) {
    openLinkIn(webApp, url)
    return
  }
  window.open(url, '_blank', 'noopener,noreferrer')
}

/**
 * Show Telegram's native «Назад» button with the given handler,
 * or hide it with `null`. Safe to call before the script has loaded.
 */
export function setTelegramBackButton(handler: (() => void) | null): void {
  backHandler = handler
  applyBackButton()
}

/** Rejects if the call takes longer than CLOUD_TIMEOUT_MS. */
function withTimeout<T>(promise: Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('CloudStorage timeout')), CLOUD_TIMEOUT_MS)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error: unknown) => {
        clearTimeout(timer)
        reject(error instanceof Error ? error : new Error(String(error)))
      },
    )
  })
}

/** Turns a callback-style CloudStorage call into a promise; also catches synchronous throws. */
function call<T>(run: (cb: CloudCallback<T>) => void): Promise<T | undefined> {
  return withTimeout(
    new Promise<T | undefined>((resolve, reject) => {
      run((error, result) => (error ? reject(new Error(error)) : resolve(result)))
    }),
  )
}

/**
 * CloudStorage of the given WebApp, or null if this Telegram version does not
 * support it. Exported for tests.
 */
export function cloudStorageOf(app: Pick<TelegramWebApp, 'isVersionAtLeast' | 'CloudStorage'>): TelegramCloudStorage | null {
  const api = app.CloudStorage
  if (!api || !app.isVersionAtLeast('6.9')) return null
  return {
    // Telegram returns '' for a key that was never set.
    getItem: async (key) => (await call<string>((cb) => api.getItem(key, cb))) || null,
    setItem: async (key, value) => {
      await call<boolean>((cb) => api.setItem(key, value, cb))
    },
  }
}

/**
 * Telegram CloudStorage, or null: in a regular browser, if the script did not
 * load, or in a Telegram version without it. Waits for the script; never throws.
 */
export async function getTelegramCloudStorage(): Promise<TelegramCloudStorage | null> {
  const inTelegram = await ready
  return inTelegram && webApp ? cloudStorageOf(webApp) : null
}
