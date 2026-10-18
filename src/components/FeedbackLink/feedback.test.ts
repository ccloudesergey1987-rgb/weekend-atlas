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

  it('веб-форма или чат: тема передаётся параметром', () => {
    const href = feedbackHref('https://t.me/weekendatlas_bot', 'Каса Мила')!
    expect(new URL(href).searchParams.get('subject')).toBe('Weekend Atlas: ошибка — Каса Мила')
  })

  it('адрес в настройках — письмо или https', () => {
    if (FEEDBACK_URL !== null) expect(FEEDBACK_URL).toMatch(/^(mailto:|https:\/\/)/)
  })
})
