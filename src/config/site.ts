/**
 * Site settings that the owner changes by hand. One place for all of them.
 */

/**
 * Where «Сообщить об ошибке» leads: an e-mail («mailto:…») or a page
 * («https://…», e.g. a form or a Telegram chat). `null` — not set yet: the
 * button then explains that the address will appear soon.
 */
export const FEEDBACK_URL: string | null = 'https://t.me/weekendatlas_help_bot'

/** Shown at the bottom of the home screen. Update after each full data check. */
export const DATA_CHECKED_LABEL = 'октябрь 2026'

/** Weekend Atlas Telegram channel. */
export const TELEGRAM_CHANNEL_URL = 'https://t.me/WeekendAtlastravel'

/**
 * Free short guides to other cities (Telegraph articles), shown on the home
 * screen under «Другие города». Add a new city here — nothing else to change.
 */
export const OTHER_CITY_GUIDES: { city: string; note: string; url: string }[] = [
  {
    city: 'Рим',
    note: 'Колизей, Ватикан, Трастевере и еда до €15',
    url: 'https://telegra.ph/Rim-za-3-dnya--besplatnyj-gid-Weekend-Atlas-10-28',
  },
  {
    city: 'Париж',
    note: 'Эйфелева башня, Лувр, Монмартр и бульоны',
    url: 'https://telegra.ph/Parizh-za-3-dnya--besplatnyj-gid-Weekend-Atlas-10-28',
  },
  {
    city: 'Лиссабон',
    note: 'Алфама, Белен, Синтра и лучшие смотровые',
    url: 'https://telegra.ph/Lissabon-za-3-dnya--besplatnyj-gid-Weekend-Atlas-10-28',
  },
]
