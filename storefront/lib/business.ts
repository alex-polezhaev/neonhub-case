import { getSiteUrl } from '@/lib/site'

export function getBusinessInfo() {
  const siteUrl = getSiteUrl()

  return {
    siteUrl,
    name: 'NEON HUB',
    legalName: 'NeonHub LLC',
    phone: '+1 (555) 010-0100',
    email: 'hello@neonhub.example',
    faviconUrl: `${siteUrl}/favicon.svg`,
    address: {
      '@type': 'PostalAddress',
      streetAddress: '123 Example Ave',
      addressLocality: 'Brooklyn',
      addressRegion: 'NY',
      postalCode: '11201',
      addressCountry: 'US',
    },
    sameAs: [],
  }
}
