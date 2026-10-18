/// <reference types="node" />
import { existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { getCityContent, listCityIds } from '../data'
import { ALLOWED_PHOTO_LICENSE, cityPhotos, photoCreditText, photoFiles } from './photos'

const PUBLIC = join(process.cwd(), 'public')
const MAX_BYTES = 200 * 1024

describe('проверка лицензий фото', () => {
  it('пропускает только свободные лицензии', () => {
    for (const ok of ['Public domain', 'CC0', 'CC BY 2.0', 'CC BY 4.0', 'CC BY-SA 3.0', 'CC BY-SA 4.0']) {
      expect(ALLOWED_PHOTO_LICENSE.test(ok), ok).toBe(true)
    }
    for (const bad of ['CC BY-NC 4.0', 'CC BY-ND 4.0', 'CC BY-NC-SA 2.0', 'All rights reserved', 'GFDL', '']) {
      expect(ALLOWED_PHOTO_LICENSE.test(bad), bad).toBe(false)
    }
  })

  it('подпись к фото — «Фото: Автор, лицензия»', () => {
    expect(
      photoCreditText({ author: 'Bernard Gagnon', license: 'CC BY-SA 3.0', licenseUrl: null, sourceUrl: '', changes: '' }),
    ).toBe('Фото: Bernard Gagnon, CC BY-SA 3.0')
  })
})

describe.each(listCityIds())('фото города %s', (cityId) => {
  const content = getCityContent(cityId)
  const photos = cityPhotos(content)
  const points = content.route.days.flatMap((d) => d.points)

  it('есть обложка и фото у каждой достопримечательности и альтернативы', () => {
    expect(content.city.cover.src, 'обложка').toBeTruthy()
    for (const p of points.filter((p) => p.kind === 'sight')) expect(p.photo?.src, p.id).toBeTruthy()
    for (const c of points.flatMap((p) => p.closures ?? [])) {
      if (c.alternative) expect(c.alternative.photo?.src, c.alternative.title).toBeTruthy()
    }
  })

  for (const { title, photo } of photos) {
    describe(title, () => {
      it('автор, разрешённая лицензия, ссылка на страницу файла и что изменено', () => {
        const credit = photo.credit!
        expect(credit.author.trim()).not.toBe('')
        expect(credit.license).toMatch(ALLOWED_PHOTO_LICENSE)
        expect(credit.sourceUrl).toMatch(/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/)
        if (credit.license !== 'Public domain' && credit.license !== 'CC0') {
          expect(credit.licenseUrl).toMatch(/^https:\/\/creativecommons\.org\//)
        }
        expect(credit.changes.trim()).not.toBe('')
        expect(photo.alt.trim()).not.toBe('')
      })

      it('две ширины, размеры для разметки, файлы есть и весят не больше 200 КБ', () => {
        expect(photo.srcSet!.length).toBeGreaterThanOrEqual(2)
        expect(photo.width).toBeGreaterThan(0)
        expect(photo.height).toBeGreaterThan(0)
        expect(photo.width! / photo.height!, 'горизонтальное').toBeGreaterThan(1)
        expect(photo.src).toBe(photo.srcSet![0].src)
        for (const file of photoFiles(photo)) {
          const path = join(PUBLIC, file.src)
          expect(file.src, 'путь без ведущего слеша').not.toMatch(/^\//)
          expect(file.src).toMatch(/\.webp$/)
          expect(existsSync(path), file.src).toBe(true)
          expect(statSync(path).size, file.src).toBeLessThanOrEqual(MAX_BYTES)
        }
      })
    })
  }
})
