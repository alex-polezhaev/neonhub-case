const DEFAULT_SITE_URL = 'https://neonhub.example'

export function getSiteUrl(): string {
  const rawSiteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SITE_URL ||
    DEFAULT_SITE_URL

  return rawSiteUrl.replace(/\/+$/, '')
}
