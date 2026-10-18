import { describe, expect, it } from 'vitest'
import { FEEDBACK_URL } from '../../config/site'
import { feedbackHref } from './feedback'

describe('ссылка «Сообщить об ошибке»', () => {
  it('без адреса ссылки нет — кнопка объясняет, что адрес скоро появится', () => {
    expect(feedbackHref(null, 'главная')).toBeNull()
    expect(feedbackHref('', 'главная')).toBeNull()
    expect(feedbackHref('не адрес', 'главная')).toBeNull()
  })

  it('письмо: в теме — где ошибка', () => {
    expect(feedbackHref('mailto:hello@example.org', 'Саграда Фамилия')).toBe(
      `mailto:hello@example.org?subject=${encodeURIComponent('Weekend Atlas: ошибка — Саграда Фамилия')}`,
    )
  })

  it('чат или веб-форма открываются ровно по указанному адресу', () => {
    expect(feedbackHref('https://t.me/weekendatlas_help', 'Каса Мила')).toBe('https://t.me/weekendatlas_help')
    expect(feedbackHref('http://example.org', 'Каса Мила')).toBeNull()
  })

  it('в настройках указан чат Telegram, и кнопка ведёт туда', () => {
    expect(FEEDBACK_URL).toBe('https://t.me/weekendatlas_help')
    expect(feedbackHref(FEEDBACK_URL, 'главная страница')).toBe('https://t.me/weekendatlas_help')
  })
})
