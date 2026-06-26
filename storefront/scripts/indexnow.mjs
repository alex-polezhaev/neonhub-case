import { readFileSync } from 'fs'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)

const KEY = process.env.INDEXNOW_KEY
const HOST = process.env.INDEXNOW_HOST || 'neonhub.example'
const BASE = `https://${HOST}`

const { products } = JSON.parse(readFileSync('public/data/products.json', 'utf-8'))
const seen = new Set()
const groups = products.filter(p => {
  if (seen.has(p.group_id)) return false
  seen.add(p.group_id)
  return true
})

const categories = [
  'coffee', 'cafe', 'bakery', 'restaurant', 'beauty', 'flowers',
  'balloons', 'grocery', 'gym', 'navigation', 'other', 'game', 'funny',
  'logo', 'animals', 'phrases', 'asia', 'music', 'car', 'food', 'space',
  'movies', 'wedding', 'birthday',
]

const urls = [
  `${BASE}/`,
  `${BASE}/catalog/`,
  `${BASE}/contacts/`,
  `${BASE}/delivery-payment/`,
  ...categories.map(c => `${BASE}/catalog/${c}/`),
  ...groups.map(p => `${BASE}/product/${p.group_id}/`),
]

const body = {
  host: HOST,
  key: KEY,
  keyLocation: `${BASE}/${KEY}.txt`,
  urlList: urls,
}

console.log(`Pinging IndexNow: ${urls.length} URLs...`)

const res = await fetch('https://yandex.com/indexnow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify(body),
})

console.log(`Status: ${res.status} ${res.statusText}`)
if (res.status === 200) {
  console.log('Done — the search engine queued the URLs for crawling.')
} else {
  const text = await res.text()
  console.error('Error:', text)
}
