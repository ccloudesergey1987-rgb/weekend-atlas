import { describe, expect, it, vi } from 'vitest'
import { FEEDBACK_URL } from '../config/site'
import { downloadFileIn, downloadInTelegram, isInTelegram, isTelegramLink, openLinkIn } from './telegram'

function fakeApp() {
  return { openLink: vi.fn(), openTelegramLink: vi.fn() }
}

describe('внешние ссылки внутри Telegram', () => {
  it('ссылка на бота открывает чат в Telegram (openTelegramLink)', () => {
    const app = fakeApp()
    openLinkIn(app, FEEDBACK_URL!)
    expect(app.openTelegramLink).toHaveBeenCalledWith('https://t.me/weekendatlas_help_bot')
    expect(app.openLink).not.toHaveBeenCalled()
  })

  it('остальные ссылки открываются через openLink', () => {
    const app = fakeApp()
    openLinkIn(app, 'https://maps.google.com/?q=Sagrada')
    expect(app.openLink).toHaveBeenCalledWith('https://maps.google.com/?q=Sagrada')
    expect(app.openTelegramLink).not.toHaveBeenCalled()
  })

  it('t.me узнаётся только по адресу сайта, не по тексту в ссылке', () => {
    expect(isTelegramLink('https://telegram.me/weekendatlas_help_bot')).toBe(true)
    expect(isTelegramLink('https://example.org/?to=https://t.me/x')).toBe(false)
    expect(isTelegramLink('https://t.me.example.org/x')).toBe(false)
    expect(isTelegramLink('не адрес')).toBe(false)
  })

  it('в обычном браузере Telegram не используется — работает обычная ссылка в новой вкладке', () => {
    expect(isInTelegram()).toBe(false)
  })
})

describe('скачивание PDF', () => {
  const url = 'https://weekend-atlas.ru/guides/weekend-atlas-barcelona-72.pdf'

  function fakeApp(version: number, withDownload = true) {
    return {
      isVersionAtLeast: (v: string) => version >= Number(v),
      downloadFile: withDownload ? vi.fn() : undefined,
      openLink: vi.fn(),
      openTelegramLink: vi.fn(),
    }
  }

  it('в новом Telegram открывает его окно сохранения файла', () => {
    const app = fakeApp(8.0)
    downloadFileIn(app, url, 'guide.pdf')
    expect(app.downloadFile).toHaveBeenCalledWith({ url, file_name: 'guide.pdf' })
    expect(app.openLink).not.toHaveBeenCalled()
  })

  it('в старом Telegram открывает файл в браузере', () => {
    const app = fakeApp(7.10)
    downloadFileIn(app, url, 'guide.pdf')
    expect(app.downloadFile).not.toHaveBeenCalled()
    expect(app.openLink).toHaveBeenCalledWith(url)
  })

  it('вне Telegram ничего не делает — скачивает сам браузер', () => {
    expect(downloadInTelegram(url, 'guide.pdf')).toBe(false)
  })
})
