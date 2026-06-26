import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { getWatermarkedFileName, syncProductWatermarks } from './product-watermarks.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dataDir = path.join(__dirname, '../public/data')
const imagesDir = path.join(__dirname, '../public/images/products')
const sizesDir = path.join(__dirname, '../public/images/sizes')

const WEBHOOK_URL = process.env.PRODUCTS_API_URL
const CONCURRENCY = 20

// --- Helpers ---
function extractId(url) {
  const match = url?.match(/assets\/([a-f0-9-]+)/)
  return match ? match[1] : null
}

async function downloadFile(url, destPath, params) {
  if (fs.existsSync(destPath)) return 'skipped'
  const imgRes = await fetch(`${url.split('?')[0]}?${params}`)
  if (!imgRes.ok) throw new Error(`HTTP ${imgRes.status}`)
  fs.writeFileSync(destPath, Buffer.from(await imgRes.arrayBuffer()))
  return 'done'
}

async function runPool(tasks, concurrency) {
  let done = 0, skipped = 0, failed = 0
  const total = tasks.length
  const queue = [...tasks]

  async function worker() {
    while (queue.length > 0) {
      const task = queue.shift()
      try {
        const result = await task()
        result === 'done' ? done++ : skipped++
      } catch (err) {
        failed++
      }
      process.stdout.write(`\r  ${done} new, ${skipped} cached, ${failed} failed / ${total} total`)
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker))
  console.log('')
  return { done, skipped, failed }
}

// --- Fetch products ---
process.stdout.write('Fetching products... ')
const res = await fetch(WEBHOOK_URL)
const text = await res.text()

if (!text?.trim()) {
  console.error(`\nError: empty response (HTTP ${res.status})`)
  process.exit(1)
}

let data
try {
  data = JSON.parse(text)
} catch {
  console.error(`\nError: invalid JSON`)
  process.exit(1)
}

const products = Array.isArray(data) ? data : data.products ?? []
console.log(`done (${products.length} products)`)

fs.mkdirSync(imagesDir, { recursive: true })
fs.mkdirSync(sizesDir, { recursive: true })

// --- Product images ---
const allImageUrls = new Set()
for (const p of products) {
  for (const url of (p.images ?? [])) {
    if (url) allImageUrls.add(url)
  }
}

const PRODUCT_SIZES = [
  { suffix: '',       params: 'format=webp&quality=82&width=1200' },
  { suffix: '-thumb', params: 'format=webp&quality=70&width=800&height=800&fit=cover' },
]

const productTasks = [...allImageUrls].flatMap(url => {
  const id = extractId(url)
  if (!id) return []
  return PRODUCT_SIZES.map(({ suffix, params }) => () =>
    downloadFile(url, path.join(imagesDir, `${id}${suffix}.webp`), params)
  )
})

console.log(`Downloading ${allImageUrls.size} product images (${productTasks.length} files, ${CONCURRENCY} parallel)...`)
await runPool(productTasks, CONCURRENCY)

const watermarkSourceFiles = [...allImageUrls].flatMap((url) => {
  const id = extractId(url)
  return id ? [`${id}.webp`, `${id}-thumb.webp`] : []
})

console.log('Generating watermarked product images...')
const watermarkResult = await syncProductWatermarks({
  imagesDir,
  sourceFiles: watermarkSourceFiles,
  concurrency: 6,
})
console.log(`  ${watermarkResult.done} new, ${watermarkResult.skipped} cached, ${watermarkResult.failed} failed / ${watermarkResult.total} total`)

// --- Size preview images ---
const allSizePreviewUrls = new Set()
for (const p of products) {
  if (p.size_preview) allSizePreviewUrls.add(p.size_preview)
  for (const s of (p.sizes_json ?? [])) {
    if (s.size_preview) allSizePreviewUrls.add(s.size_preview)
  }
}

const sizeTasks = [...allSizePreviewUrls].map(url => {
  const id = extractId(url)
  if (!id) return null
  return () => downloadFile(url, path.join(sizesDir, `${id}.webp`), 'format=webp&quality=75&width=640&height=480&fit=contain')
}).filter(Boolean)

console.log(`Downloading ${allSizePreviewUrls.size} size previews (${CONCURRENCY} parallel)...`)
await runPool(sizeTasks, CONCURRENCY)

// --- Cleanup outdated ---
const activeProductFiles = new Set(
  [...allImageUrls].flatMap(url => {
    const id = extractId(url)
    if (!id) return []
    return [
      `${id}.webp`,
      `${id}-thumb.webp`,
      getWatermarkedFileName(`${id}.webp`),
      getWatermarkedFileName(`${id}-thumb.webp`),
    ].filter(Boolean)
  })
)
const activeSizeFiles = new Set(
  [...allSizePreviewUrls].map(url => {
    const id = extractId(url)
    return id ? `${id}.webp` : null
  }).filter(Boolean)
)

let removed = 0
for (const file of fs.readdirSync(imagesDir)) {
  if (!activeProductFiles.has(file)) { fs.unlinkSync(path.join(imagesDir, file)); removed++ }
}
for (const file of fs.readdirSync(sizesDir)) {
  if (!activeSizeFiles.has(file)) { fs.unlinkSync(path.join(sizesDir, file)); removed++ }
}
if (removed > 0) console.log(`Removed ${removed} outdated images`)

// --- Rewrite URLs to local paths ---
for (const p of products) {
  p.images = (p.images ?? []).map(url => {
    const id = extractId(url)
    return id ? `/images/products/${id}.webp` : url
  })
  if (p.size_preview) {
    const id = extractId(p.size_preview)
    if (id) p.size_preview = `/images/sizes/${id}.webp`
  }
  for (const s of (p.sizes_json ?? [])) {
    if (s.size_preview) {
      const id = extractId(s.size_preview)
      if (id) s.size_preview = `/images/sizes/${id}.webp`
    }
  }
}

fs.writeFileSync(path.join(dataDir, 'products.json'), JSON.stringify(data, null, 2))
console.log('products.json saved with local image paths')
