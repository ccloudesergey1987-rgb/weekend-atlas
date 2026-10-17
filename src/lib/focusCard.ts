import { useEffect } from 'react'

/**
 * Opening a screen at a specific card, e.g. from favorites:
 *
 *   #/route/2?focus=barcelona/sagrada-familia
 *   #/places?focus=barcelona/example-cafe-gracia
 *
 * The screen scrolls to the card and briefly highlights it.
 */

export const FOCUS_PARAM = 'focus'

/** DOM id of a card. */
export function cardElementId(id: string): string {
  return `card-${id}`
}

export function routePointPath(day: number, id: string): string {
  return `/route/${day}?${new URLSearchParams({ [FOCUS_PARAM]: id })}`
}

export function placePath(id: string): string {
  return `/places?${new URLSearchParams({ [FOCUS_PARAM]: id })}`
}

/** Scrolls the card with this id into view once it is on the screen. */
export function useScrollToCard(id: string | null): void {
  useEffect(() => {
    if (!id) return
    // Next frame: after the screen has rendered and after «scroll to top» on navigation.
    const frame = requestAnimationFrame(() => {
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      document.getElementById(cardElementId(id))?.scrollIntoView({
        // Cards are often taller than the screen: show them from the top (photo, title).
        block: 'start',
        behavior: reduceMotion ? 'auto' : 'smooth',
      })
    })
    return () => cancelAnimationFrame(frame)
  }, [id])
}
