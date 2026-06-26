import fs from 'fs'
import path from 'path'
import sharp from 'sharp'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const logoPath = path.join(__dirname, '../public/neon-hub-watermark.svg')
const generatorMtimeMs = fs.statSync(fileURLToPath(import.meta.url)).mtimeMs
const logoMtimeMs = fs.statSync(logoPath).mtimeMs

const FULL_QUALITY = 82
const THUMB_QUALITY = 70
const ROTATION_DEG = -32

function isSourceImageFile(fileName) {
  return fileName.endsWith('.webp') && !fileName.endsWith('-wm.webp')
}

export function getWatermarkedFileName(fileName) {
  if (!isSourceImageFile(fileName)) return null
  if (fileName.endsWith('-thumb.webp')) return fileName.replace(/-thumb\.webp$/, '-thumb-wm.webp')
  return fileName.replace(/\.webp$/, '-wm.webp')
}

function getWatermarkQuality(fileName) {
  return fileName.endsWith('-thumb.webp') ? THUMB_QUALITY : FULL_QUALITY
}

async function applyWatermark(sourcePath, outputPath, quality) {
  const sourceStat = fs.statSync(sourcePath)
  const dependencyMtimeMs = Math.max(sourceStat.mtimeMs, generatorMtimeMs, logoMtimeMs)

  if (fs.existsSync(outputPath)) {
    const outputStat = fs.statSync(outputPath)
    if (outputStat.mtimeMs >= dependencyMtimeMs) return 'skipped'
  }

  const source = sharp(sourcePath, { limitInputPixels: false })
  const metadata = await source.metadata()
  const width = metadata.width
  const height = metadata.height

  if (!width || !height) {
    throw new Error(`Unable to read image size for ${sourcePath}`)
  }

  const tileWidth = Math.max(Math.round(width * 0.18), 140)
  const tileHeight = Math.max(Math.round(tileWidth * 0.28), 44)
  const spacingX = Math.round(tileWidth * 0.55)
  const spacingY = Math.round(tileHeight * 1.8)
  const xStart = -Math.round(tileWidth * 0.28)
  const yStart = -Math.round(tileHeight * 0.22)
  const columns = Math.ceil((width - xStart + tileWidth) / (tileWidth + spacingX)) + 1
  const rows = Math.ceil((height - yStart + tileHeight) / (tileHeight + spacingY)) + 1
  const mainBuffer = await sharp(logoPath)
    .resize({ width: tileWidth, withoutEnlargement: true })
    .rotate(ROTATION_DEG, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .modulate({ brightness: 1 })
    .png()
    .toBuffer()
  const composites = []

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < columns; col += 1) {
      const left = xStart + col * (tileWidth + spacingX) + (row % 2 === 0 ? 0 : Math.round(tileWidth * 0.5))
      const top = yStart + row * (tileHeight + spacingY)

      composites.push(
        {
          input: mainBuffer,
          left,
          top,
        },
      )
    }
  }

  await source
    .composite(composites)
    .webp({ quality })
    .toFile(outputPath)

  return 'done'
}

async function runPool(tasks, concurrency) {
  let done = 0
  let skipped = 0
  let failed = 0
  const queue = [...tasks]
  const total = tasks.length

  function reportProgress() {
    process.stdout.write(`\r  ${done} new, ${skipped} cached, ${failed} failed / ${total} total`)
  }

  if (total > 0) reportProgress()

  async function worker() {
    while (queue.length > 0) {
      const task = queue.shift()
      if (!task) continue

      try {
        const result = await task()
        if (result === 'done') done += 1
        else skipped += 1
      } catch {
        failed += 1
      }

      reportProgress()
    }
  }

  await Promise.all(Array.from({ length: Math.max(1, concurrency) }, worker))
  if (total > 0) process.stdout.write('\n')
  return { done, skipped, failed }
}

export async function syncProductWatermarks({ imagesDir, sourceFiles, concurrency = 6 }) {
  const existingFiles = fs.existsSync(imagesDir) ? fs.readdirSync(imagesDir) : []
  const sourceImageFiles = (sourceFiles ?? existingFiles).filter(isSourceImageFile)

  const tasks = sourceImageFiles.map((fileName) => {
    const outputFileName = getWatermarkedFileName(fileName)
    if (!outputFileName) return null

    return () => applyWatermark(
      path.join(imagesDir, fileName),
      path.join(imagesDir, outputFileName),
      getWatermarkQuality(fileName),
    )
  }).filter(Boolean)

  const result = await runPool(tasks, concurrency)
  const activeOutputs = new Set(sourceImageFiles.map((fileName) => getWatermarkedFileName(fileName)).filter(Boolean))

  let removed = 0
  for (const fileName of existingFiles) {
    if (!fileName.endsWith('-wm.webp')) continue
    if (activeOutputs.has(fileName)) continue
    fs.unlinkSync(path.join(imagesDir, fileName))
    removed += 1
  }

  return { ...result, removed, total: tasks.length }
}
