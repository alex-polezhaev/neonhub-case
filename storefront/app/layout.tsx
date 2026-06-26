import type { Metadata } from 'next'
import { Orbitron, Inter, Tektur, Rubik_Glitch } from 'next/font/google'
import Script from 'next/script'
import { Suspense } from 'react'
import { CartProvider } from '@/components/cart-provider'
import { VkPageviewTracker } from '@/components/vk-pageview-tracker'
import { getCommonSeoKeywords } from '@/lib/keywords.server'
import { getSiteUrl } from '@/lib/site'
import { FloatingCartTablet } from '@/components/floating-cart-tablet'
import { VK_PIXEL_ID } from '@/lib/vk-pixel'
import './globals.css'

const orbitron = Orbitron({
  subsets: ["latin"],
  variable: '--font-orbitron',
  weight: ['700', '900'],
  display: 'swap',
});

const inter = Inter({
  subsets: ["latin", "cyrillic"],
  variable: '--font-inter',
  display: 'swap',
  preload: false,
});

const tektur = Tektur({
  subsets: ["latin", "cyrillic"],
  variable: '--font-tektur',
  weight: ['700', '800'],
  display: 'swap',
});

const rubikGlitch = Rubik_Glitch({
  subsets: ["latin", "cyrillic"],
  variable: '--font-rubik-glitch',
  weight: ['400'],
  display: 'swap',
  preload: false,
});

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: 'NeonHub — Neon Signs',
  description: 'Premium neon signs for business and home. Custom-made, fast shipping.',
  keywords: getCommonSeoKeywords(20),
  alternates: {
    canonical: '/',
  },
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: 'NeonHub — Neon Signs',
    description: 'Premium neon signs for business and home. Custom-made, fast shipping.',
    url: '/',
    siteName: 'NEON HUB',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'NeonHub — Neon Signs' }],
    locale: 'en_US',
    type: 'website',
  },
  other: process.env.NEXT_PUBLIC_PINTEREST_VERIFY
    ? { 'p:domain_verify': process.env.NEXT_PUBLIC_PINTEREST_VERIFY }
    : undefined,
  icons: {
    icon: [
      { url: '/favicon-32x32.png', type: 'image/png', sizes: '32x32' },
      { url: '/favicon-48x48.png', type: 'image/png', sizes: '48x48' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
    apple: { url: '/apple-icon.png', sizes: '180x180' },
    other: [{ rel: 'icon', url: '/favicon-32x32.png' }],
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const ymId = process.env.NEXT_PUBLIC_YANDEX_METRIKA_ID
  return (
    <html lang="en">
      <head />
      <body className={`${orbitron.variable} ${inter.variable} ${tektur.variable} ${rubikGlitch.variable} font-sans antialiased`}>
        <CartProvider>
          <div style={{ fontFamily: 'var(--font-tektur), sans-serif' }}>
            <Suspense fallback={null}>
              <VkPageviewTracker />
            </Suspense>
            {children}
            <FloatingCartTablet />
          </div>
        </CartProvider>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Organization",
            name: "NEON HUB",
            url: getSiteUrl(),
            logo: `${getSiteUrl()}/icon-192.png`,
            image: `${getSiteUrl()}/og.png`,
            description: "Neon signs for business and home. Custom-made, fast shipping.",
            telephone: "+1 (555) 010-0100",
            email: "hello@neonhub.example",
            address: {
              "@type": "PostalAddress",
              streetAddress: "123 Example Ave",
              addressLocality: "Brooklyn",
              addressRegion: "NY",
              postalCode: "11201",
              addressCountry: "US",
            },
            sameAs: [],
          }) }}
        />
        {ymId && (
          <Script id="yandex-metrika" strategy="afterInteractive">{`
            (function(m,e,t,r,i,k,a){
              m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
              m[i].l=1*new Date();
              for (var j = 0; j < document.scripts.length; j++) {if (document.scripts[j].src === r) { return; }}
              k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)
            })(window, document,'script','https://mc.yandex.ru/metrika/tag.js?id=${ymId}', 'ym');
            ym(${ymId}, 'init', {ssr:true, webvisor:false, clickmap:true, ecommerce:"dataLayer", referrer: document.referrer, url: location.href, accurateTrackBounce:true, trackLinks:true});
          `}</Script>
        )}
        <Script id="vk-ads-pixel" strategy="afterInteractive">{`
          var _tmr = window._tmr || (window._tmr = []);
          _tmr.push({ id: "${VK_PIXEL_ID}", type: "pageView", start: (new Date()).getTime() });
          (function(d, w, id) {
            if (d.getElementById(id)) return;
            var ts = d.createElement("script");
            ts.type = "text/javascript";
            ts.async = true;
            ts.id = id;
            ts.src = "https://top-fwz1.mail.ru/js/code.js";
            var f = function() {
              var s = d.getElementsByTagName("script")[0];
              s.parentNode.insertBefore(ts, s);
            };
            if (w.opera == "[object Opera]") {
              d.addEventListener("DOMContentLoaded", f, false);
            } else {
              f();
            }
          })(document, window, "tmr-code");
        `}</Script>
        <Script id="low-end-detect" strategy="afterInteractive">{`
          (function() {
            var lowEnd = false;
            if (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2) lowEnd = true;
            if (navigator.deviceMemory && navigator.deviceMemory <= 2) lowEnd = true;
            if (navigator.connection && (navigator.connection.saveData || /slow-2g|2g/.test(navigator.connection.effectiveType))) lowEnd = true;
            if (lowEnd) document.documentElement.classList.add('low-end');
          })();
        `}</Script>
        <Script id="console-easter-egg" strategy="afterInteractive">{`
          console.log('You don\\'t need this, brother.\\nWalk your own path, samurai.');
        `}</Script>
        <noscript>
          {ymId && (
            <div><img src={`https://mc.yandex.ru/watch/${ymId}`} style={{ position:'absolute', left:'-9999px' }} alt="" /></div>
          )}
          <div><img src={`https://top-fwz1.mail.ru/counter?id=${VK_PIXEL_ID};js=na`} style={{ position:'absolute', left:'-9999px' }} alt="" /></div>
        </noscript>
      </body>
    </html>
  )
}
