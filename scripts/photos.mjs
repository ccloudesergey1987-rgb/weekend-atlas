// Downloads photos listed in scripts/photo-sources.json from Wikimedia Commons,
// crops and compresses them to WebP and writes author, license and source
// into the city JSON. Run: npm run photos
//
// Downloads are cached in .cache/photos/ (not committed). Every output file
// is kept at or under MAX_BYTES by lowering the WebP quality step by step.

import { mkdirSync, readFileSync, writeFileSync, existsSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const config = JSON.parse(readFileSync(join(root, 'scripts/photo-sources.json'), 'utf8'))
const city = config.cityId
const dataDir = join(root, 'src/data', city)
const outDir = join(root, 'public/images', city)
const cacheDir = join(root, '.cache/photos')
mkdirSync(outDir, { recursive: true })
mkdirSync(cacheDir, { recursive: true })

const MAX_BYTES = 200 * 1024
const DEFAULT_CROPS = [{ name: '', ratio: [16, 9], widths: [800, 1600] }]
const ALLOWED = /^(Public domain|CC0|CC BY \d\.\d|CC BY-SA \d\.\d)$/
const UA = { 'User-Agent': 'WeekendAtlas/1.0 (photo credits; https://github.com/ccloudesergey1987-rgb/weekend-atlas)' }
const stripHtml = (html) =>
  String(html ?? '')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()

async function commonsInfo(title) {
  const url = new URL('https://commons.wikimedia.org/w/api.php')
  Object.entries({
    action: 'query', format: 'json', titles: title, prop: 'imageinfo',
    iiprop: 'url|size|extmetadata', iiurlwidth: '2400',
    iiextmetadatafilter: 'Artist|LicenseShortName|LicenseUrl',
  }).forEach(([k, v]) => url.searchParams.set(k, v))
  const json = await (await fetch(url, { headers: UA })).json()
  const page = Object.values(json.query.pages)[0]
  const info = page.imageinfo?.[0]
  if (!info) throw new Error(`Not found on Commons: ${title}`)
  const license = stripHtml(info.extmetadata.LicenseShortName?.value)
    .replace(/^Public domain$/i, 'Public domain')
  if (!ALLOWED.test(license)) throw new Error(`${title}: license «${license}» is not allowed`)
  return {
    // «:Puigalder», «User:Name» → «Puigalder», «Name»
    author: stripHtml(info.extmetadata.Artist?.value).replace(/^(User:|:)/i, ''),
    license,
    licenseUrl: info.extmetadata.LicenseUrl?.value ?? null,
    sourceUrl: info.descriptionurl,
    // A Commons-made thumbnail up to 2400 px is plenty for 1600 px output.
    download: info.thumburl ?? info.url,
  }
}

async function download(url, file) {
  if (existsSync(file)) return
  const res = await fetch(url, { headers: UA })
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`)
  writeFileSync(file, Buffer.from(await res.arrayBuffer()))
}

/** Crops to the ratio (centre) and resizes; lowers quality until the file fits. */
async function encode(input, ratio, width, file) {
  const meta = await sharp(input).metadata()
  const [rw, rh] = ratio
  const cropW = Math.min(meta.width, Math.floor((meta.height * rw) / rh))
  const cropH = Math.floor((cropW * rh) / rw)
  const outW = Math.min(width, cropW)
  const outH = Math.round((outW * rh) / rw)
  for (let quality = 78; quality >= 30; quality -= 4) {
    const buf = await sharp(input)
      .rotate()
      .extract({ left: Math.floor((meta.width - cropW) / 2), top: Math.floor((meta.height - cropH) / 2), width: cropW, height: cropH })
      .resize(outW, outH)
      .webp({ quality, effort: 6 })
      .toBuffer()
    if (buf.length <= MAX_BYTES) {
      writeFileSync(file, buf)
      return { width: outW, height: outH, bytes: buf.length, quality }
    }
  }
  throw new Error(`${file}: cannot fit into ${MAX_BYTES} bytes`)
}

const results = {}
for (const p of config.photos) {
  const info = await commonsInfo(p.commons)
  const cached = join(cacheDir, `${p.id}.jpg`)
  await download(info.download, cached)
  const variants = {}
  for (const crop of p.crops ?? DEFAULT_CROPS) {
    const srcSet = []
    for (const w of crop.widths) {
      const name = `${p.id}${crop.name ? `-${crop.name}` : ''}-${w}.webp`
      const r = await encode(cached, crop.ratio, w, join(outDir, name))
      srcSet.push({ src: `images/${city}/${name}`, width: r.width })
      console.log(`${name}: ${r.width}×${r.height}, ${Math.round(r.bytes / 1024)} KB, q${r.quality}`)
      variants[crop.name || 'main'] = { srcSet, width: r.width, height: r.height }
    }
  }
  const main = variants.main
  results[p.id] = {
    src: main.srcSet[0].src,
    srcSet: main.srcSet,
    width: main.width,
    height: main.height,
    ...(variants.portrait ? { portrait: variants.portrait } : {}),
    alt: p.alt,
    credit: {
      author: info.author,
      license: info.license,
      licenseUrl: info.licenseUrl,
      sourceUrl: info.sourceUrl,
      changes: `Кадрировано до ${(p.crops ?? DEFAULT_CROPS).map((c) => c.ratio.join(':')).join(' и ')}, уменьшено и сжато в WebP`,
    },
  }
}

// Write the photos into the city JSON, next to the things they show.
const cityFile = join(dataDir, 'city.json')
const routeFile = join(dataDir, 'route.json')
const cityJson = JSON.parse(readFileSync(cityFile, 'utf8'))
const routeJson = JSON.parse(readFileSync(routeFile, 'utf8'))
for (const p of config.photos) {
  const photo = results[p.id]
  const [kind, key] = p.target.split(/:(.*)/s)
  if (p.target === 'city.cover') cityJson.cover = photo
  else if (kind === 'route') {
    const point = routeJson.days.flatMap((d) => d.points).find((x) => x.id === key)
    if (!point) throw new Error(`No route point ${key}`)
    point.photo = photo
  } else if (kind === 'alternative') {
    const alts = routeJson.days.flatMap((d) => d.points).flatMap((x) => x.closures ?? []).map((c) => c.alternative).filter((a) => a?.title === key)
    if (alts.length === 0) throw new Error(`No alternative ${key}`)
    for (const a of alts) a.photo = photo
  } else throw new Error(`Unknown target ${p.target}`)
}
writeFileSync(cityFile, JSON.stringify(cityJson, null, 2) + '\n')
writeFileSync(routeFile, JSON.stringify(routeJson, null, 2) + '\n')

const files = Object.values(results).flatMap((r) => [...r.srcSet, ...(r.portrait?.srcSet ?? [])])
const bytes = files.reduce((s, f) => s + statSync(join(root, 'public', f.src)).size, 0)
console.log(`${files.length} files, ${Math.round(bytes / 1024)} KB in total`)
