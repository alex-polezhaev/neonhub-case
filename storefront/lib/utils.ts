import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

interface ColorConfig {
  hex: string
  textClass: string
  cardGlowClass: string
  borderRgba: string
  shadowRgba: string
  glowShadow: string
}

function makeGlow(r: number, g: number, b: number): string {
  const c = `${r},${g},${b}`
  return `0 0 5px rgba(${c},1), 0 0 15px rgba(${c},0.8), 0 0 30px rgba(${c},0.6), 0 0 60px rgba(${c},0.4)`
}

const COLOR_MAP: Record<string, ColorConfig> = {
  pink:    { hex: '#ff2d95', textClass: 'neon-text-pink',    cardGlowClass: 'card-glow-pink',    borderRgba: 'rgba(255,45,149,0.35)',  shadowRgba: 'rgba(255,45,149,0.18)',  glowShadow: makeGlow(255,45,149) },
  cyan:    { hex: '#00f0ff', textClass: 'neon-text-cyan',    cardGlowClass: 'card-glow-cyan',    borderRgba: 'rgba(0,240,255,0.35)',   shadowRgba: 'rgba(0,240,255,0.18)',   glowShadow: makeGlow(0,240,255) },
  white:   { hex: '#ffffff', textClass: 'neon-text-white',   cardGlowClass: 'card-glow-white',   borderRgba: 'rgba(255,255,255,0.35)', shadowRgba: 'rgba(255,255,255,0.18)', glowShadow: makeGlow(255,255,255) },
  neutral: { hex: '#ffd580', textClass: 'neon-text-neutral', cardGlowClass: 'card-glow-neutral', borderRgba: 'rgba(255,213,128,0.35)', shadowRgba: 'rgba(255,213,128,0.18)', glowShadow: makeGlow(255,213,128) },
  red:     { hex: '#ff2020', textClass: 'neon-text-red',     cardGlowClass: 'card-glow-red',     borderRgba: 'rgba(255,32,32,0.35)',   shadowRgba: 'rgba(255,32,32,0.18)',   glowShadow: makeGlow(255,32,32) },
  green:   { hex: '#00ff66', textClass: 'neon-text-green',   cardGlowClass: 'card-glow-green',   borderRgba: 'rgba(0,255,102,0.35)',   shadowRgba: 'rgba(0,255,102,0.18)',   glowShadow: makeGlow(0,255,102) },
  blue:    { hex: '#4466ff', textClass: 'neon-text-blue',    cardGlowClass: 'card-glow-blue',    borderRgba: 'rgba(68,102,255,0.35)',  shadowRgba: 'rgba(68,102,255,0.18)',  glowShadow: makeGlow(68,102,255) },
  yellow:  { hex: '#ffe600', textClass: 'neon-text-yellow',  cardGlowClass: 'card-glow-yellow',  borderRgba: 'rgba(255,230,0,0.35)',   shadowRgba: 'rgba(255,230,0,0.18)',   glowShadow: makeGlow(255,230,0) },
  purple:  { hex: '#bf00ff', textClass: 'neon-text-purple',  cardGlowClass: 'card-glow-purple',  borderRgba: 'rgba(191,0,255,0.35)',   shadowRgba: 'rgba(191,0,255,0.18)',   glowShadow: makeGlow(191,0,255) },
  orange:  { hex: '#ff6600', textClass: 'neon-text-orange',  cardGlowClass: 'card-glow-orange',  borderRgba: 'rgba(255,102,0,0.35)',   shadowRgba: 'rgba(255,102,0,0.18)',   glowShadow: makeGlow(255,102,0) },
}

export const ALL_COLORS = Object.keys(COLOR_MAP)

export function colorLabel(color: string, _locale: string = 'en'): string {
  return color.charAt(0).toUpperCase() + color.slice(1)
}

export function getColorConfig(color: string): ColorConfig {
  return COLOR_MAP[color] ?? COLOR_MAP.cyan
}

export function getCardColorStyles(colors: string[]): {
  className: string
  style: Record<string, string>
  boxShadow: string
} {
  if (colors.length <= 1) {
    const cc = getColorConfig(colors[0] ?? 'cyan')
    return {
      className: cc.cardGlowClass,
      style: { borderColor: cc.borderRgba },
      boxShadow: `0 0 18px ${cc.shadowRgba}, inset 0 0 18px ${cc.shadowRgba}`,
    }
  }
  const configs = colors.map(c => getColorConfig(c))
  const varStyle: Record<string, string> = {}
  configs.forEach((c, i) => { varStyle[`--bc${i}`] = c.borderRgba })
  const shadows = configs
    .map(c => `0 0 18px ${c.shadowRgba}`)
    .concat(configs.map(c => `inset 0 0 18px ${c.shadowRgba}`))
    .join(', ')
  return {
    className: `border-spin-${Math.min(colors.length, 4)}`,
    style: varStyle,
    boxShadow: shadows,
  }
}

export function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

export function directusImage(url: string, quality = 82, size?: number): string {
  if (!url) return url
  // Local images — return pre-generated variant
  if (url.startsWith('/images/products/')) {
    if (size) {
      return url.replace(/\.webp$/, '-thumb-wm.webp')
    }
    return url.replace(/\.webp$/, '-wm.webp')
  }
  // External Directus URL — transform via query params
  const baseUrl = url.split('?')[0]
  const params: Record<string, string> = { fit: 'cover', quality: String(quality), format: 'webp' }
  if (size) { params.width = String(size); params.height = String(size) }
  return `${baseUrl}?${new URLSearchParams(params)}`
}
