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
  // A web form or chat: pass the subject along; pages that do not need it ignore it.
  try {
    const url = new URL(base)
    url.searchParams.set('subject', subject)
    return url.href
  } catch {
    return null
  }
}
