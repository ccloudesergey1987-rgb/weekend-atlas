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

// Minimal typing of the parts of Telegram.WebApp we use.
interface TelegramBackButton {
  show(): void
  hide(): void
  onClick(cb: () => void): void
  offClick(cb: () => void): void
}

interface TelegramWebApp {
  platform: string
  colorScheme: 'light' | 'dark'
  ready(): void
  expand(): void
  openLink(url: string): void
  isVersionAtLeast(version: string): boolean
  setHeaderColor(color: string): void
  setBackgroundColor(color: string): void
  onEvent(event: 'themeChanged', cb: () => void): void
  BackButton: TelegramBackButton
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp }
  }
}

let webApp: TelegramWebApp | null = null
let backHandler: (() => void) | null = null

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

  const script = document.createElement('script')
  script.src = SCRIPT_URL
  script.async = true
  script.onload = onScriptLoaded
  // On error (e.g. telegram.org unreachable) we simply stay in browser mode.
  document.head.appendChild(script)
}

/** True once the app is confirmed to be running inside Telegram. */
export function isInTelegram(): boolean {
  return webApp !== null
}

/**
 * Open an external URL: via Telegram's in-app browser inside Telegram,
 * in a new tab otherwise.
 */
export function openExternalLink(url: string): void {
  if (webApp) {
    webApp.openLink(url)
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
