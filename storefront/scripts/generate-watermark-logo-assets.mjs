import fs from 'fs'
import path from 'path'
import sharp from 'sharp'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const svgPath = path.join(__dirname, '../public/neon-hub-watermark.svg')
const pngPath = path.join(__dirname, '../public/neon-hub-watermark.png')
const webpPath = path.join(__dirname, '../public/neon-hub-watermark.webp')

const svgBuffer = fs.readFileSync(svgPath)

await sharp(svgBuffer).png().toFile(pngPath)
await sharp(svgBuffer).webp({ quality: 96 }).toFile(webpPath)

console.log('Generated:')
console.log(`- ${pngPath}`)
console.log(`- ${webpPath}`)
