import { statSync } from 'fs'
import { join } from 'path'

try {
  const mtime = statSync(join(process.cwd(), 'public/data/products.json')).mtime.getTime()
  process.env.NEXT_PUBLIC_PRODUCTS_VERSION = mtime.toString(36)
} catch {
  process.env.NEXT_PUBLIC_PRODUCTS_VERSION = 'dev'
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
