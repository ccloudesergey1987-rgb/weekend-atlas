import type { AnchorHTMLAttributes, MouseEvent } from 'react'
import { isInTelegram, openExternalLink } from '../../telegram/telegram'

type Props = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'target' | 'rel'> & {
  href: string
}

/**
 * Link to an external site. A normal <a target="_blank"> in the browser;
 * inside Telegram it opens through Telegram.WebApp.openLink.
 */
export function ExternalLink({ href, onClick, children, ...rest }: Props) {
  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event)
    if (event.defaultPrevented || !isInTelegram()) return
    event.preventDefault()
    openExternalLink(href)
  }

  return (
    <a href={href} target="_blank" rel="noopener noreferrer" onClick={handleClick} {...rest}>
      {children}
    </a>
  )
}
