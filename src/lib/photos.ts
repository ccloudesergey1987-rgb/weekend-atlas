/**
 * Photos of a city guide: where their files live and who made them.
 */

import type { CityContent } from '../data'
import type { Photo, PhotoCredit, PhotoFile } from '../types/content'

/** Licenses we accept for photos; the tests check every photo against this list. */
export const ALLOWED_PHOTO_LICENSE = /^(Public domain|CC0|CC BY \d\.\d|CC BY-SA \d\.\d)$/

/** A file path from JSON → URL that respects Vite's base (if the site ever moves into a subfolder). */
export function photoUrl(src: string): string {
  return `${import.meta.env.BASE_URL}${src}`
}

/** «Фото: Bernard Gagnon, CC BY-SA 3.0». */
export function photoCreditText(credit: PhotoCredit): string {
  return `Фото: ${credit.author}, ${credit.license}`
}

/** Every file of a photo: main crop and portrait crop. */
export function photoFiles(photo: Photo): PhotoFile[] {
  return [...(photo.srcSet ?? []), ...(photo.portrait?.srcSet ?? [])]
}

export interface PhotoUse {
  /** What is in the photo, for the credits list: «Обложка», «Саграда Фамилия». */
  title: string
  photo: Photo
}

/**
 * All photos of a city with what they show, without repeats (one alternative
 * can be offered for several days). Placeholders are left out.
 */
export function cityPhotos({ city, route }: Pick<CityContent, 'city' | 'route'>): PhotoUse[] {
  const uses: PhotoUse[] = [{ title: 'Обложка', photo: city.cover }]
  for (const point of route.days.flatMap((d) => d.points)) {
    if (point.photo) uses.push({ title: point.title, photo: point.photo })
    for (const closure of point.closures ?? []) {
      const alt = closure.alternative
      if (alt?.photo) uses.push({ title: alt.title, photo: alt.photo })
    }
  }
  const seen = new Set<string>()
  return uses.filter((u) => {
    if (!u.photo.src || !u.photo.credit || seen.has(u.photo.src)) return false
    seen.add(u.photo.src)
    return true
  })
}
