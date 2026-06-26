# Hero B: A fully SEO-optimized, very fast static storefront

The `storefront/` is NeonHub's customer-facing site (live as neonhub.ru). It's a **Next.js static export**. Every page is pre-rendered to static HTML at build time, so there's no server in the request path. On top of that base it layers a thorough, deliberate SEO and performance stack. Unlike Hero A, **all of this is in-repo and citable.**

## Static-first

- **`output: 'export'`** (`next.config.mjs`): the whole site builds to static HTML/CSS/JS in `out/`. Fastest possible TTFB, trivially CDN-cacheable, no runtime backend.
- The catalog is pulled **once at build time** (an n8n webhook → a baked `products.json` snapshot), never fetched at runtime.
- Cache-busting via `NEXT_PUBLIC_PRODUCTS_VERSION` derived from the catalog's modification time, so clients pick up catalog changes immediately after a deploy.

## SEO layer

| Concern | Implementation |
|---|---|
| **Metadata / Open Graph** | Full `Metadata` in `app/layout.tsx` (`metadataBase`, dynamic keywords, canonical, robots index/follow, OG 1200×630, favicon/apple-icon set). Per-product `generateMetadata` emits unique title / description / keywords / canonical / OG, with a `noindex` fallback for missing products. |
| **Structured data (JSON-LD)** | `Organization` (site-wide), per-product `Product` schema with `Offer` / price / availability, and `BreadcrumbList`. |
| **Sitemaps** | `app/sitemap.ts` (home + static pages + every category + every product), plus a dedicated Google **image sitemap** (`image-sitemap.xml`) listing each product's images with captions. `lastModified` derived from the catalog mtime. |
| **robots** | `app/robots.ts` with sane allow/deny + sitemap reference. |
| **IndexNow** | `scripts/indexnow.mjs` pings the full URL list to IndexNow on every deploy; the key is served as a public `.txt`. |
| **Marketing feeds** | Generated product feeds (VK, Yandex Business/Market, Pinterest) as force-static routes: the catalog syndicates itself. |

## Performance

- **WebP image pipeline** (`scripts/fetch-products.mjs` + `watermark-images.mjs`, run as prebuild): downloads source images and pre-generates **WebP** variants (main `1200 q82`, thumb `800×800 q70`, size previews `640×480 q75`) plus watermarked copies, then rewrites remote URLs to local `/images/products/<id>.webp`. The browser only ever fetches right-sized, modern-format images.
- **Fonts** via `next/font` with `display: 'swap'`, selective `preload: false`, and subset control: no layout shift, no blocking font fetch.
- **Low-end-device detector**: inspects `hardwareConcurrency` / `deviceMemory` / `saveData` and adds a `.low-end` class that downgrades visual effects, so weak devices still render fast.
- **Analytics** loaded `afterInteractive`, never blocking first paint.

## Why this matters

A neon-sign catalog is a **content/SEO play**: the win condition is ranking for thousands of long-tail product and category queries and loading instantly on mobile. The architecture is matched to that exactly: **static export** for speed and cacheability, **per-product structured data + image sitemaps** for rich, indexable results, **IndexNow + feeds** for fast discovery, and a **WebP/device-aware** front end for Core Web Vitals. It's not SEO bolted on; it's SEO as the architecture.

> The catalog shipped in this showcase is a **trimmed English demo** (generic neon-sign products); the real site runs the same pipeline over the full production catalog.
