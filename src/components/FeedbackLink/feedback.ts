/**
 * Link for «Сообщить об ошибке»: the address from src/config/site.ts plus
 * what the reader was looking at, so the message says where the mistake is.
 */

/** null — the address is not set yet. */
export function feedbackHref(base: string | null, about: string): string | null {
  if (!base) return null
  const subject = `Weekend Atlas: ошибка — ${about}`
  if (base.startsWith('mailto:')) {
    const sep = base.includes('?') ? '&' : '?'
    return `${base}${sep}subject=${encodeURIComponent(subject)}`
  }
  // A chat or a web form opens exactly as set: Telegram links take no subject.
  try {
    return new URL(base).protocol === 'https:' ? base : null
  } catch {
    return null
  }
}
