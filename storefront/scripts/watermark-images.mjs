import path from 'path'
import { fileURLToPath } from 'url'
import { syncProductWatermarks } from './product-watermarks.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const imagesDir = path.join(__dirname, '../public/images/products')

console.log('Generating watermarked product images...')
const result = await syncProductWatermarks({ imagesDir, concurrency: 6 })
console.log(`  ${result.done} new, ${result.skipped} cached, ${result.failed} failed, ${result.removed} removed / ${result.total} total`)
