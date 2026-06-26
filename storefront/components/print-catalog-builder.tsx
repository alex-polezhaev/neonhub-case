"use client"

import { useDeferredValue, useEffect, useMemo, useState } from "react"
import { flushSync } from "react-dom"
import { toPng } from "html-to-image"
import QRCode from "qrcode"
import {
  ArrowDown,
  ArrowUp,
  GripVertical,
  LoaderCircle,
  Printer,
  RotateCcw,
  Save,
  Search,
  Trash2,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { translateCategory } from "@/lib/categories"
import {
  PRINT_CATALOG_ABSOLUTE_MAX_PRODUCTS,
  PRINT_CATALOG_BLEED_MM,
  PRINT_CATALOG_DEFAULT_GRID_SIZE,
  PRINT_CATALOG_GRID_SIZES,
  PRINT_CATALOG_PAGE_COUNT,
  type PrintCatalogGridSize,
  getPrintCatalogMaxProducts,
  type PrintCatalogContactLink,
  type PrintCatalogProduct,
  type PrintCatalogRecord,
  type PrintCatalogSummary,
} from "@/lib/print-catalog-shared"
import { cn, getColorConfig } from "@/lib/utils"

const PAGE_WIDTH_MM = 210 + PRINT_CATALOG_BLEED_MM * 2
const PAGE_HEIGHT_MM = 148 + PRINT_CATALOG_BLEED_MM * 2
const DEFAULT_TITLE = "NEON HUB Catalog"
const STORAGE_KEY = "neonhub-print-catalogs"
const EXPORT_PIXEL_RATIO = 300 / 96

type SaveStatus = {
  tone: "neutral" | "success" | "error"
  text: string
}

type PageDefinition =
  | {
      type: "cover"
      number: number
      title: string
      heroProduct: PrintCatalogProduct | null
    }
  | {
      type: "products"
      number: number
      productsPerPage: PrintCatalogGridSize
      items: Array<PrintCatalogProduct | null>
    }
  | {
      type: "contacts"
      number: number
      title: string
      selectedCount: number
    }

function chunkProducts(
  products: PrintCatalogProduct[],
  productsPerPage: PrintCatalogGridSize,
) {
  const pages: Array<Array<PrintCatalogProduct | null>> = []

  for (let index = 0; index < PRINT_CATALOG_PAGE_COUNT - 2; index += 1) {
    const slice: Array<PrintCatalogProduct | null> = products.slice(
      index * productsPerPage,
      (index + 1) * productsPerPage,
    )

    while (slice.length < productsPerPage) {
      slice.push(null)
    }

    pages.push(slice)
  }

  return pages
}

function formatDimensions(product: PrintCatalogProduct) {
  if (!product.widthCm || !product.heightCm) {
    return "Size TBD"
  }

  return `${Math.round(product.widthCm)} x ${Math.round(product.heightCm)} cm`
}

function getCatalogImage(
  url: string,
  variant: "picker" | "page" | "cover" = "page",
) {
  if (!url) {
    return url
  }

  if (url.startsWith("/images/products/")) {
    if (url.includes("-thumb.webp")) {
      return url.replace(/-thumb-wm\.webp$/, "-thumb.webp")
    }

    return url.replace(/\.webp$/, "-thumb.webp")
  }

  const baseUrl = url.split("?")[0]
  const width = variant === "cover" ? 900 : variant === "picker" ? 320 : 640
  const quality = variant === "cover" ? 68 : 64

  return `${baseUrl}?${new URLSearchParams({
    fit: "cover",
    format: "webp",
    quality: String(quality),
    width: String(width),
  })}`
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
}

function getSwatchBackground(hexes: string[]): string {
  if (hexes.length <= 1) {
    return hexes[0] ?? "#00f0ff"
  }

  const segment = 100 / hexes.length
  const stops = hexes
    .map((hex, index) => {
      const start = (segment * index).toFixed(2)
      const end = (segment * (index + 1)).toFixed(2)
      return `${hex} ${start}% ${end}%`
    })
    .join(", ")

  return `linear-gradient(135deg, ${stops})`
}

function moveItem<T>(items: T[], fromIndex: number, toIndex: number) {
  const next = [...items]
  const [item] = next.splice(fromIndex, 1)
  next.splice(toIndex, 0, item)
  return next
}

function readStoredCatalogs(): PrintCatalogRecord[] {
  if (typeof window === "undefined") {
    return []
  }

  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) {
    return []
  }

  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed
      .filter((item): item is PrintCatalogRecord => {
        return (
          !!item &&
          typeof item === "object" &&
          typeof item.id === "string" &&
          typeof item.title === "string" &&
          Array.isArray(item.productGroupIds) &&
          (item.productsPerPage === undefined ||
            item.productsPerPage === 4 ||
            item.productsPerPage === 6 ||
            item.productsPerPage === 8) &&
          typeof item.createdAt === "string" &&
          typeof item.updatedAt === "string"
        )
      })
      .map((item) => ({
        ...item,
        productsPerPage: normalizeGridSize(item.productsPerPage),
        pageCount: item.pageCount ?? PRINT_CATALOG_PAGE_COUNT,
        bleedMm: item.bleedMm ?? PRINT_CATALOG_BLEED_MM,
      }))
  } catch {
    return []
  }
}

function writeStoredCatalogs(records: PrintCatalogRecord[]) {
  if (typeof window === "undefined") {
    return
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records))
}

function toSummary(record: PrintCatalogRecord): PrintCatalogSummary {
  return {
    id: record.id,
    title: record.title,
    productCount: record.productGroupIds.length,
    updatedAt: record.updatedAt,
  }
}

function normalizeGridSize(value: unknown): PrintCatalogGridSize {
  return value === 6 || value === 8 ? value : PRINT_CATALOG_DEFAULT_GRID_SIZE
}

function ProductTile({
  product,
  qrCode,
  productsPerPage,
}: {
  product: PrintCatalogProduct | null
  qrCode?: string
  productsPerPage: PrintCatalogGridSize
}) {
  const isCompact = productsPerPage >= 6
  const isDense = productsPerPage === 8
  const qrReserve = isDense ? 52 : isCompact ? 68 : 92
  const colors = product?.colors?.length ? product.colors : ["cyan"]
  const resolvedConfigs = colors.map((color) => getColorConfig(color))
  const borderAccent =
    colors.length > 1
      ? {
          background: getSwatchBackground(
            resolvedConfigs.map((config) => config.borderRgba),
          ),
          boxShadow: resolvedConfigs
            .map((config) => `0 0 14px ${config.shadowRgba}`)
            .join(", "),
        }
      : {
          borderColor: resolvedConfigs[0]?.borderRgba ?? "rgba(0,240,255,0.35)",
          boxShadow: `0 0 14px ${resolvedConfigs[0]?.shadowRgba ?? "rgba(0,240,255,0.18)"}`,
        }

  if (!product) {
    return (
      <div
        className={cn(
          "flex h-full items-center justify-center rounded-[18px] border border-dashed border-[#2f2f3b] bg-[#08080c]/70 text-center uppercase tracking-[0.28em] text-[#6f6f7f]",
          isDense ? "min-h-[84px] text-[9px]" : isCompact ? "min-h-[112px] text-[10px]" : "min-h-[170px] text-xs",
        )}
      >
        Add a product
      </div>
    )
  }

  return (
    <div
      className={cn(
        "rounded-[18px]",
        colors.length > 1 ? "p-[1.5px]" : "border-[1.5px]",
        isDense ? "min-h-[84px]" : isCompact ? "min-h-[112px]" : "min-h-[170px]",
      )}
      style={borderAccent}
    >
      <article
        className={cn(
          "relative h-full overflow-hidden rounded-[16px] bg-[radial-gradient(circle_at_top_left,_rgba(255,144,0,0.18),_transparent_55%),linear-gradient(135deg,_#040404,_#12131a)]",
          isDense ? "min-h-[84px]" : isCompact ? "min-h-[112px]" : "min-h-[170px]",
        )}
      >
        <img
          src={getCatalogImage(product.image, "page")}
          alt={product.name}
          loading="eager"
          className="absolute inset-0 h-full w-full object-cover opacity-92"
        />
        <div
          className={cn(
            "absolute z-10 bg-white/98",
            isDense
              ? "bottom-2 right-2 h-10 w-10 p-0.5"
              : isCompact
                ? "bottom-3 right-3 h-12 w-12 p-1"
                : "bottom-4 right-4 h-16 w-16 p-1",
          )}
        >
          {qrCode ? (
            <img
              src={qrCode}
              alt={`QR ${product.name}`}
              className="h-full w-full"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-white">
              <LoaderCircle className="h-5 w-5 animate-spin text-[#050505]" />
            </div>
          )}
        </div>
        <div
          className={cn(
            "absolute inset-x-0 bottom-0 bg-black/60",
            isDense ? "p-2.5" : isCompact ? "p-3" : "p-4",
          )}
        >
          <h3
            className={cn(
              "font-black uppercase tracking-[0.08em] text-[#f4f4f7]",
              isDense ? "text-[10px] leading-3.5" : isCompact ? "text-xs leading-4" : "text-sm leading-5",
            )}
            style={{ maxWidth: `calc(100% - ${qrReserve}px)` }}
          >
            {product.name}
          </h3>
        </div>
      </article>
    </div>
  )
}

function CoverPage({
  title,
  heroProduct,
  contactLinks,
  qrCodes,
}: {
  title: string
  heroProduct: PrintCatalogProduct | null
  contactLinks: PrintCatalogContactLink[]
  qrCodes: Record<string, string>
}) {
  return (
    <div className="relative h-full overflow-hidden border border-[#1a1a2e] bg-[radial-gradient(circle_at_top_left,_rgba(255,144,0,0.22),_transparent_38%),radial-gradient(circle_at_bottom_right,_rgba(255,255,255,0.10),_transparent_34%),linear-gradient(135deg,_#050505,_#0e1018_58%,_#050505)] p-7">
      <div className="absolute inset-0 bg-[linear-gradient(transparent_0,_transparent_97%,_rgba(255,255,255,0.05)_100%)] opacity-60" />
      {heroProduct ? (
        <img
          src={getCatalogImage(heroProduct.image, "cover")}
          alt={heroProduct.name}
          loading="eager"
          className="absolute -right-8 bottom-0 h-[82%] w-[48%] object-cover opacity-30 saturate-125"
        />
      ) : null}
      <div className="absolute inset-0 bg-[linear-gradient(90deg,_rgba(5,5,5,0.92)_0%,_rgba(5,5,5,0.65)_52%,_rgba(5,5,5,0.85)_100%)]" />

      <div className="relative flex h-full flex-col justify-between">
        <div>
          <div className="flex items-center gap-0">
            <span className="font-sans text-4xl font-black uppercase tracking-wider text-white">
              NEON
            </span>
            <span
              className="ml-2 rounded-[8px] px-3 py-1 font-sans text-4xl font-black uppercase tracking-wider text-[#050505]"
              style={{
                backgroundColor: "#FF9000",
                boxShadow:
                  "0 0 12px #FF9000, 0 0 24px rgba(255,144,0,0.6)",
              }}
            >
              HUB
            </span>
          </div>
          <p className="mt-6 text-xs font-bold uppercase tracking-[0.36em] text-[#FF9000]">
            Print catalog • A5 horizontal
          </p>
          <h1 className="mt-5 max-w-[58%] font-tektur text-4xl font-black uppercase leading-[1.05] tracking-[0.08em] text-[#f6f6f8]">
            {title}
          </h1>
          <p className="mt-5 max-w-[48%] text-sm leading-6 text-[#b0b1c0]">
            A selection of neon signs for quick offline browsing. The catalog
            pages have no prices or color options, only visuals and QR codes
            linking to the product cards.
          </p>
        </div>

        <div>
          <div className="grid grid-cols-4 gap-3">
            {contactLinks.slice(0, 4).map((contact) => (
              <div
                key={contact.id}
                className="rounded-[18px] border border-[#1a1a2e] bg-[#090a10]/85 p-3"
              >
                <div className="flex justify-center rounded-[14px] bg-white p-2">
                  {qrCodes[contact.url] ? (
                    <img
                      src={qrCodes[contact.url]}
                      alt={`QR ${contact.label}`}
                      className="aspect-square w-full"
                    />
                  ) : (
                    <div className="flex aspect-square w-full items-center justify-center rounded-[10px] bg-white">
                      <LoaderCircle className="h-5 w-5 animate-spin text-[#050505]" />
                    </div>
                  )}
                </div>
                <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.28em] text-[#FF9000]">
                  {contact.label}
                </p>
                <p className="mt-1 text-[11px] leading-4 text-[#dcdee7]">
                  {contact.value}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function ContactsPage({
  title,
  selectedCount,
  contactLinks,
  qrCodes,
}: {
  title: string
  selectedCount: number
  contactLinks: PrintCatalogContactLink[]
  qrCodes: Record<string, string>
}) {
  return (
    <div className="relative h-full overflow-hidden border border-[#1a1a2e] bg-[radial-gradient(circle_at_top_right,_rgba(255,144,0,0.2),_transparent_40%),linear-gradient(135deg,_#050505,_#0b0c12_55%,_#050505)] p-7">
      <div className="absolute inset-x-0 top-20 h-px bg-[linear-gradient(90deg,_transparent,_rgba(255,144,0,0.45),_transparent)]" />
      <div className="relative flex h-full flex-col">
        <div className="flex items-start justify-between gap-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.34em] text-[#FF9000]">
              Contacts
            </p>
            <h2 className="mt-3 font-tektur text-3xl font-black uppercase tracking-[0.08em] text-[#f2f2f5]">
              {title}
            </h2>
            <p className="mt-4 max-w-xl text-sm leading-6 text-[#acadc0]">
              Use the QR codes to quickly open the website, jump into a
              messenger, or send a request. The catalog is designed for offline
              presentation and fast follow-up after viewing.
            </p>
          </div>
          <div className="min-w-[180px] rounded-[18px] border border-[#1a1a2e] bg-[#0a0a10]/85 p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.26em] text-[#FF9000]">
              In catalog
            </p>
            <p className="mt-3 text-4xl font-black text-white">
              {selectedCount}
            </p>
            <p className="mt-2 text-xs uppercase tracking-[0.18em] text-[#8d8ea0]">
              products selected
            </p>
          </div>
        </div>

        <div className="mt-8 grid flex-1 grid-cols-4 gap-4">
          {contactLinks.slice(0, 4).map((contact) => (
            <div
              key={contact.id}
              className="flex flex-col rounded-[20px] border border-[#1a1a2e] bg-[#090a10]/88 p-4"
            >
              <div className="flex justify-center rounded-[16px] bg-white p-2">
                {qrCodes[contact.url] ? (
                  <img
                    src={qrCodes[contact.url]}
                    alt={`QR ${contact.label}`}
                    className="aspect-square w-full"
                  />
                ) : (
                  <div className="flex aspect-square w-full items-center justify-center rounded-[12px] bg-white">
                    <LoaderCircle className="h-5 w-5 animate-spin text-[#050505]" />
                  </div>
                )}
              </div>
              <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.26em] text-[#FF9000]">
                {contact.label}
              </p>
              <p className="mt-2 text-sm leading-5 text-[#f0f0f4]">
                {contact.value}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function PageCanvas({
  page,
  contactLinks,
  qrCodes,
}: {
  page: PageDefinition
  contactLinks: PrintCatalogContactLink[]
  qrCodes: Record<string, string>
}) {
  return (
    <div className="relative h-full w-full overflow-hidden border border-[#242432] bg-[#040406] shadow-[0_0_0_1px_rgba(255,255,255,0.02),0_20px_80px_rgba(0,0,0,0.45)]">

      {page.type === "cover" ? (
        <CoverPage
          title={page.title}
          heroProduct={page.heroProduct}
          contactLinks={contactLinks}
          qrCodes={qrCodes}
        />
      ) : null}

      {page.type === "products" ? (
        <div className="relative h-full overflow-hidden border border-[#1a1a2e] bg-[radial-gradient(circle_at_top_left,_rgba(255,144,0,0.16),_transparent_30%),linear-gradient(135deg,_#050505,_#0b0d13_58%,_#050505)] p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-[#FF9000]">
                Catalog
              </p>
              <p className="mt-1 text-xs uppercase tracking-[0.2em] text-[#8e8fa2]">
                A selection of products for print
              </p>
            </div>
            <div className="rounded-full border border-[#FF9000]/20 bg-[#FF9000]/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.24em] text-[#ffd8a1]">
              Page {page.number}
            </div>
          </div>
          <div
            className={cn(
              "grid h-[calc(100%-3.75rem)]",
              page.productsPerPage === 4 && "grid-cols-2 gap-4",
              page.productsPerPage === 6 && "grid-cols-3 gap-3",
              page.productsPerPage === 8 && "grid-cols-4 gap-3",
            )}
          >
            {page.items.map((product, index) => (
              <ProductTile
                key={product?.groupId ?? `empty-${index}`}
                product={product}
                qrCode={product ? qrCodes[product.productUrl] : undefined}
                productsPerPage={page.productsPerPage}
              />
            ))}
          </div>
        </div>
      ) : null}

      {page.type === "contacts" ? (
        <ContactsPage
          title={page.title}
          selectedCount={page.selectedCount}
          contactLinks={contactLinks}
          qrCodes={qrCodes}
        />
      ) : null}
    </div>
  )
}

export function PrintCatalogBuilder({
  initialProducts,
  contactLinks,
}: {
  initialProducts: PrintCatalogProduct[]
  contactLinks: PrintCatalogContactLink[]
}) {
  const [title, setTitle] = useState(DEFAULT_TITLE)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [savedCatalogs, setSavedCatalogs] = useState<PrintCatalogSummary[]>([])
  const [currentCatalogId, setCurrentCatalogId] = useState<string | null>(null)
  const [productsPerPage, setProductsPerPage] = useState<PrintCatalogGridSize>(
    PRINT_CATALOG_DEFAULT_GRID_SIZE,
  )
  const [category, setCategory] = useState("all")
  const [query, setQuery] = useState("")
  const [selectedPage, setSelectedPage] = useState(0)
  const [isBusy, setIsBusy] = useState(false)
  const [isPreparingPdf, setIsPreparingPdf] = useState(false)
  const [status, setStatus] = useState<SaveStatus>({
    tone: "neutral",
    text: "Select products, arrange the sequence, and save the catalog locally in your browser.",
  })
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [qrCodes, setQrCodes] = useState<Record<string, string>>({})
  const [printRasterPages, setPrintRasterPages] = useState<string[] | null>(null)

  const deferredQuery = useDeferredValue(query)
  const maxProducts = getPrintCatalogMaxProducts(productsPerPage)

  const productMap = useMemo(
    () => new Map(initialProducts.map((product) => [product.groupId, product])),
    [initialProducts],
  )

  const categories = useMemo(() => {
    const map = new Map<string, string>()
    for (const product of initialProducts) {
      for (const categoryId of product.categories) {
        map.set(categoryId, translateCategory(categoryId, "en"))
      }
    }

    return [
      { id: "all", label: "All categories" },
      ...[...map.entries()].map(([id, label]) => ({ id, label })),
    ]
  }, [initialProducts])

  const filteredProducts = useMemo(() => {
    const normalizedQuery = deferredQuery.trim().toLowerCase()

    return initialProducts.filter((product) => {
      const matchesCategory =
        category === "all" || product.categories.includes(category)
      const matchesQuery =
        normalizedQuery.length === 0 ||
        product.name.toLowerCase().includes(normalizedQuery) ||
        product.categoryLabels.some((label) =>
          label.toLowerCase().includes(normalizedQuery),
        )

      return matchesCategory && matchesQuery
    })
  }, [category, deferredQuery, initialProducts])

  const selectedProducts = useMemo(
    () =>
      selectedIds
        .map((id) => productMap.get(id) ?? null)
        .filter((product): product is PrintCatalogProduct => product !== null),
    [productMap, selectedIds],
  )

  const pages = useMemo(() => {
    const productPages = chunkProducts(
      selectedProducts.slice(0, maxProducts),
      productsPerPage,
    )

    return [
      {
        type: "cover" as const,
        number: 1,
        title: title.trim() || DEFAULT_TITLE,
        heroProduct: selectedProducts[0] ?? null,
      },
      ...productPages.map(
        (items, index) =>
          ({
            type: "products" as const,
            number: index + 2,
            productsPerPage,
            items,
          }) satisfies PageDefinition,
      ),
      {
        type: "contacts" as const,
        number: PRINT_CATALOG_PAGE_COUNT,
        title: title.trim() || DEFAULT_TITLE,
        selectedCount: selectedProducts.length,
      },
    ]
  }, [maxProducts, productsPerPage, selectedProducts, title])

  const qrTargets = useMemo(
    () => [
      ...contactLinks.map((contact) => contact.url),
      ...selectedProducts
        .slice(0, maxProducts)
        .map((product) => product.productUrl),
    ],
    [contactLinks, maxProducts, selectedProducts],
  )

  useEffect(() => {
    const catalogs = readStoredCatalogs()
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map(toSummary)
    setSavedCatalogs(catalogs)
  }, [])

  useEffect(() => {
    let cancelled = false

    async function buildQrCodes() {
      const entries = await Promise.all(
        qrTargets.map(async (target) => [
          target,
          await QRCode.toDataURL(target, {
            margin: 1,
            width: 256,
            color: {
              dark: "#050505",
              light: "#FFFFFFFF",
            },
          }),
        ]),
      )

      if (!cancelled) {
        setQrCodes((current) => ({
          ...current,
          ...Object.fromEntries(entries),
        }))
      }
    }

    if (qrTargets.length > 0) {
      void buildQrCodes()
    }

    return () => {
      cancelled = true
    }
  }, [qrTargets])

  useEffect(() => {
    function handleAfterPrint() {
      setPrintRasterPages(null)
      setIsPreparingPdf(false)
    }

    window.addEventListener("afterprint", handleAfterPrint)
    return () => {
      window.removeEventListener("afterprint", handleAfterPrint)
    }
  }, [])

  function refreshCatalogs() {
    const catalogs = readStoredCatalogs()
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map(toSummary)
    setSavedCatalogs(catalogs)
  }

  async function loadCatalog(id: string) {
    if (!id) {
      return
    }

    setIsBusy(true)
    try {
      const record = readStoredCatalogs().find((catalog) => catalog.id === id)
      if (!record) {
        throw new Error("Catalog not found in local storage.")
      }
      setCurrentCatalogId(record.id)
      setTitle(record.title)
      setSelectedIds(record.productGroupIds)
      setProductsPerPage(normalizeGridSize(record.productsPerPage))
      setSelectedPage(0)
      setStatus({
        tone: "success",
        text: `Loaded catalog "${record.title}".`,
      })
    } catch (error) {
      setStatus({
        tone: "error",
        text:
          error instanceof Error
            ? error.message
            : "Failed to load the catalog.",
      })
    } finally {
      setIsBusy(false)
    }
  }

  function toggleProduct(productId: string, checked: boolean | "indeterminate") {
    if (checked === "indeterminate") {
      return
    }

    if (checked) {
      setSelectedIds((current) => {
        if (current.includes(productId)) {
          return current
        }
        return [...current, productId].slice(0, PRINT_CATALOG_ABSOLUTE_MAX_PRODUCTS)
      })
      return
    }

    setSelectedIds((current) => current.filter((id) => id !== productId))
  }

  function moveSelected(fromIndex: number, toIndex: number) {
    if (
      fromIndex < 0 ||
      toIndex < 0 ||
      fromIndex >= selectedIds.length ||
      toIndex >= selectedIds.length
    ) {
      return
    }

    setSelectedIds((current) => moveItem(current, fromIndex, toIndex))
  }

  function resetBuilder() {
    setCurrentCatalogId(null)
    setTitle(DEFAULT_TITLE)
    setSelectedIds([])
    setProductsPerPage(PRINT_CATALOG_DEFAULT_GRID_SIZE)
    setSelectedPage(0)
    setStatus({
      tone: "neutral",
      text: "Created a new catalog draft.",
    })
  }

  async function saveCatalog() {
    setIsBusy(true)
    try {
      const stored = readStoredCatalogs()
      const existing = currentCatalogId
        ? stored.find((record) => record.id === currentCatalogId) ?? null
        : null
      const record: PrintCatalogRecord = {
        id: currentCatalogId ?? `catalog-${Date.now()}`,
        title: title.trim() || DEFAULT_TITLE,
        productGroupIds: selectedIds.slice(0, PRINT_CATALOG_ABSOLUTE_MAX_PRODUCTS),
        productsPerPage,
        pageCount: PRINT_CATALOG_PAGE_COUNT,
        bleedMm: PRINT_CATALOG_BLEED_MM,
        createdAt: existing?.createdAt ?? new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      writeStoredCatalogs([
        record,
        ...stored.filter((item) => item.id !== record.id),
      ])
      setCurrentCatalogId(record.id)
      refreshCatalogs()
      setStatus({
        tone: "success",
        text: `Catalog saved locally: ${record.title}.`,
      })
    } catch (error) {
      setStatus({
        tone: "error",
        text:
          error instanceof Error
            ? error.message
            : "Failed to save the catalog.",
      })
    } finally {
      setIsBusy(false)
    }
  }

  async function removeCatalog() {
    if (!currentCatalogId) {
      return
    }

    setIsBusy(true)
    try {
      writeStoredCatalogs(
        readStoredCatalogs().filter((item) => item.id !== currentCatalogId),
      )
      refreshCatalogs()
      resetBuilder()
      setStatus({
        tone: "success",
        text: "Catalog removed from local storage.",
      })
    } catch (error) {
      setStatus({
        tone: "error",
        text:
          error instanceof Error
            ? error.message
            : "Failed to delete the catalog.",
      })
    } finally {
      setIsBusy(false)
    }
  }

  async function exportPdf() {
    setIsPreparingPdf(true)
    try {
      if (typeof document !== "undefined" && "fonts" in document) {
        await document.fonts.ready
      }

      const nodes = Array.from(
        document.querySelectorAll<HTMLElement>(".print-catalog-page"),
      )

      if (nodes.length === 0) {
        throw new Error("Catalog pages not found for export.")
      }

      const rasterPages = await Promise.all(
        nodes.map((node) =>
          toPng(node, {
            pixelRatio: EXPORT_PIXEL_RATIO,
            cacheBust: false,
            backgroundColor: "#050505",
            skipFonts: false,
          }),
        ),
      )

      flushSync(() => {
        setPrintRasterPages(rasterPages)
      })

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          window.print()
        })
      })
    } catch (error) {
      setIsPreparingPdf(false)
      setStatus({
        tone: "error",
        text:
          error instanceof Error
            ? error.message
            : "Failed to prepare the lightweight PDF.",
      })
    }
  }

  const overflowCount = Math.max(0, selectedProducts.length - maxProducts)
  const activePage = pages[selectedPage] ?? pages[0]

  return (
    <>
      <div className="print-catalog-screen relative z-10 mx-auto flex w-full max-w-[1820px] flex-col gap-6 px-4 pb-8 pt-8 md:px-6">
        <section className="rounded-[28px] border border-[#1a1a2e] bg-[#0a0a0f]/90 p-5 backdrop-blur-md md:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-[0.32em] text-[#FF9000]">
              DEV ONLY
            </p>
            <h1 className="mt-3 font-tektur text-3xl font-black uppercase tracking-[0.08em] text-[#f3f3f6] md:text-5xl">
              Print Catalog Builder
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-[#9d9eb0] md:text-base">
              A hidden page for assembling an A5 horizontal catalog with a
              preview of every side. {PRINT_CATALOG_PAGE_COUNT} sides total:
              cover, product pages, and a final contact page.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-[minmax(280px,360px)_auto_auto_auto_auto]">
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Catalog title"
              className="h-11 border-[#1f2130] bg-[#0f1018] text-[#f2f3f6] placeholder:text-[#6e7187] focus-visible:border-[#FF9000]"
            />
            <Button
              onClick={saveCatalog}
              disabled={isBusy}
              className="h-11 rounded-none border-2 border-[#FF9000] bg-[#FF9000] px-5 font-bold uppercase tracking-[0.18em] text-black hover:bg-transparent hover:text-[#FF9000]"
            >
              {isBusy ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save
            </Button>
            <Button
              onClick={exportPdf}
              variant="outline"
              disabled={isPreparingPdf}
              className="h-11 rounded-none border-[#1f3d4d] bg-transparent px-5 font-bold uppercase tracking-[0.18em] text-[#b8edf7] hover:bg-[#0f2028]"
            >
              {isPreparingPdf ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Printer className="h-4 w-4" />
              )}
              {isPreparingPdf ? "Preparing PDF" : "PDF"}
            </Button>
            <Button
              onClick={resetBuilder}
              variant="outline"
              className="h-11 rounded-none border-[#2a2d3b] bg-transparent px-5 font-bold uppercase tracking-[0.18em] text-[#e6e6ea] hover:bg-[#171923]"
            >
              <RotateCcw className="h-4 w-4" />
              New
            </Button>
            <Button
              onClick={removeCatalog}
              disabled={!currentCatalogId || isBusy}
              variant="outline"
              className="h-11 rounded-none border-[#3a2329] bg-transparent px-5 font-bold uppercase tracking-[0.18em] text-[#ff9aa7] hover:bg-[#261419]"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          </div>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div
            className={cn(
              "rounded-[20px] border px-4 py-3 text-sm",
              status.tone === "success" &&
                "border-[#1e3d2d] bg-[#0e1713] text-[#b9f1cf]",
              status.tone === "error" &&
                "border-[#472129] bg-[#170c10] text-[#ffbcc8]",
              status.tone === "neutral" &&
                "border-[#1a1a2e] bg-[#0d0e14] text-[#a8a9bb]",
            )}
          >
            {status.text}
          </div>
          <div className="grid gap-2">
            <label className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#7f8193]">
              Products per page
            </label>
            <div className="flex gap-2">
              {PRINT_CATALOG_GRID_SIZES.map((size) => (
                <Button
                  key={size}
                  onClick={() => setProductsPerPage(size)}
                  variant="outline"
                  className={cn(
                    "h-11 min-w-14 rounded-none px-4 font-bold uppercase tracking-[0.18em]",
                    productsPerPage === size
                      ? "border-[#FF9000] bg-[#FF9000] text-black hover:bg-[#FF9000]"
                      : "border-[#2a2d3b] bg-transparent text-[#e6e6ea] hover:bg-[#171923]",
                  )}
                >
                  {size}
                </Button>
              ))}
            </div>
            <label className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#7f8193]">
              Saved catalogs
            </label>
            <select
              className="h-11 rounded-none border border-[#1f2130] bg-[#0f1018] px-3 text-sm text-[#f1f2f6] outline-none"
              value={currentCatalogId ?? ""}
              onChange={(event) => {
                const nextId = event.target.value
                if (nextId) {
                  void loadCatalog(nextId)
                }
              }}
            >
              <option value="">Select a catalog</option>
              {savedCatalogs.map((catalog) => (
                <option key={catalog.id} value={catalog.id}>
                  {catalog.title} • {catalog.productCount} •{" "}
                  {formatDate(catalog.updatedAt)}
                </option>
              ))}
            </select>
          </div>
        </div>
        </section>

        <div className="grid gap-6 2xl:grid-cols-[360px_360px_minmax(0,1fr)]">
          <section className="rounded-[28px] border border-[#1a1a2e] bg-[#0a0a0f]/88 p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-tektur text-xl font-bold uppercase tracking-[0.08em] text-[#f2f2f5]">
                Product search
              </h2>
              <p className="mt-1 text-sm text-[#8f90a3]">
                Check items to add them to the catalog.
              </p>
            </div>
            <Badge className="border-[#FF9000]/20 bg-[#FF9000]/10 text-[#ffd8a1]">
              {filteredProducts.length}
            </Badge>
          </div>

          <div className="mt-4 grid gap-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#717486]" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by name or category"
                className="h-11 border-[#1f2130] bg-[#0f1018] pl-10 text-[#f2f3f6] placeholder:text-[#6e7187] focus-visible:border-[#FF9000]"
              />
            </div>

            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="h-11 rounded-none border border-[#1f2130] bg-[#0f1018] px-3 text-sm text-[#f1f2f6] outline-none"
            >
              {categories.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-4 max-h-[740px] space-y-3 overflow-y-auto pr-1">
            {filteredProducts.map((product) => {
              const checked = selectedIds.includes(product.groupId)
              return (
                <label
                  key={product.groupId}
                  className={cn(
                    "flex cursor-pointer gap-3 rounded-[20px] border p-3 transition-colors",
                    checked
                      ? "border-[#FF9000]/30 bg-[#18120b]"
                      : "border-[#1a1a2e] bg-[#0d0e14]",
                  )}
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(value) =>
                      toggleProduct(product.groupId, value)
                    }
                    className="mt-1 border-[#34384a] data-[state=checked]:border-[#FF9000] data-[state=checked]:bg-[#FF9000]"
                  />
                  <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-[14px] border border-[#1a1a2e] bg-[#090a10]">
                    <img
                      src={getCatalogImage(product.image, "picker")}
                      alt={product.name}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold uppercase tracking-[0.08em] text-[#f2f3f6]">
                      {product.name}
                    </p>
                    <p className="mt-2 text-xs uppercase tracking-[0.16em] text-[#8d8fa4]">
                      {formatDimensions(product)}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {product.categoryLabels.slice(0, 3).map((label) => (
                        <span
                          key={label}
                          className="rounded-full border border-[#24283a] px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-[#aeb1c5]"
                        >
                          {label}
                        </span>
                      ))}
                    </div>
                  </div>
                </label>
              )
            })}
          </div>
          </section>

          <section className="rounded-[28px] border border-[#1a1a2e] bg-[#0a0a0f]/88 p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-tektur text-xl font-bold uppercase tracking-[0.08em] text-[#f2f2f5]">
                Catalog contents
              </h2>
              <p className="mt-1 text-sm text-[#8f90a3]">
                Drag or reorder with the buttons.
              </p>
            </div>
            <Badge className="border-[#FF9000]/20 bg-[#FF9000]/10 text-[#ffd8a1]">
              {selectedProducts.length}/{maxProducts}
            </Badge>
          </div>

          <div className="mt-4 rounded-[20px] border border-[#1a1a2e] bg-[#0d0e14] p-4 text-xs uppercase tracking-[0.2em] text-[#8b8ca0]">
            Page size: {PAGE_WIDTH_MM} x {PAGE_HEIGHT_MM} mm.
          </div>

          {overflowCount > 0 ? (
            <div className="mt-3 rounded-[20px] border border-[#563219] bg-[#1f140b] px-4 py-3 text-sm text-[#ffd8a1]">
              {overflowCount} products in the selected set don't fit in the
              catalog. The preview will include the first {maxProducts}.
            </div>
          ) : null}

          <div className="mt-4 max-h-[740px] space-y-3 overflow-y-auto pr-1">
            {selectedProducts.length === 0 ? (
              <div className="rounded-[20px] border border-dashed border-[#2a2b36] bg-[#0c0d12] p-8 text-center text-sm text-[#7e8092]">
                Empty for now. Check products on the left.
              </div>
            ) : null}

            {selectedProducts.map((product, index) => (
              <div
                key={product.groupId}
                draggable
                onDragStart={() => setDraggedId(product.groupId)}
                onDragEnd={() => setDraggedId(null)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => {
                  if (!draggedId || draggedId === product.groupId) {
                    return
                  }
                  const fromIndex = selectedIds.indexOf(draggedId)
                  const toIndex = selectedIds.indexOf(product.groupId)
                  moveSelected(fromIndex, toIndex)
                  setDraggedId(null)
                }}
                className={cn(
                  "flex items-start gap-3 rounded-[20px] border p-3 transition-colors",
                  draggedId === product.groupId
                    ? "border-[#FF9000]/30 bg-[#19130d]"
                    : "border-[#1a1a2e] bg-[#0d0e14]",
                )}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#2a2d3a] text-[#7b7f92]">
                  <GripVertical className="h-4 w-4" />
                </div>
                <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-[14px] border border-[#1a1a2e] bg-[#090a10]">
                  <img
                    src={getCatalogImage(product.image, "picker")}
                    alt={product.name}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#FF9000]">
                        #{index + 1}
                      </p>
                      <p className="mt-1 text-sm font-bold uppercase tracking-[0.08em] text-[#f2f3f6]">
                        {product.name}
                      </p>
                      <p className="mt-2 text-xs uppercase tracking-[0.16em] text-[#8d8fa4]">
                        {formatDimensions(product)}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        onClick={() => moveSelected(index, index - 1)}
                        variant="ghost"
                        size="icon-sm"
                        disabled={index === 0}
                        className="text-[#b3b6ca]"
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button
                        onClick={() => moveSelected(index, index + 1)}
                        variant="ghost"
                        size="icon-sm"
                        disabled={index === selectedProducts.length - 1}
                        className="text-[#b3b6ca]"
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                      <Button
                        onClick={() =>
                          setSelectedIds((current) =>
                            current.filter((id) => id !== product.groupId),
                          )
                        }
                        variant="ghost"
                        size="icon-sm"
                        className="text-[#ff9aa7]"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          </section>

          <section className="rounded-[28px] border border-[#1a1a2e] bg-[#0a0a0f]/88 p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <h2 className="font-tektur text-xl font-bold uppercase tracking-[0.08em] text-[#f2f2f5]">
                Page preview
              </h2>
              <p className="mt-1 text-sm text-[#8f90a3]">
                View each side separately. The cover is always first.
              </p>
            </div>
            <div className="rounded-[16px] border border-[#1a1a2e] bg-[#0d0e14] px-4 py-3 text-xs uppercase tracking-[0.22em] text-[#8b8ca0]">
              Side {activePage.number} of {PRINT_CATALOG_PAGE_COUNT}
            </div>
          </div>

          <div className="mt-5 rounded-[32px] border border-[#15161f] bg-[#06070b] p-4">
            <div
              className="mx-auto w-full max-w-[1080px]"
              style={{ aspectRatio: `${PAGE_WIDTH_MM} / ${PAGE_HEIGHT_MM}` }}
            >
              <PageCanvas
                page={activePage}
                contactLinks={contactLinks}
                qrCodes={qrCodes}
              />
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
            {pages.map((page, index) => (
              <button
                key={`${page.type}-${page.number}`}
                onClick={() => setSelectedPage(index)}
                className={cn(
                  "rounded-[20px] border p-2 text-left transition-colors",
                  index === selectedPage
                    ? "border-[#FF9000]/40 bg-[#18120c]"
                    : "border-[#1a1a2e] bg-[#0d0e14]",
                )}
              >
                <div
                  className="overflow-hidden rounded-[14px]"
                  style={{ aspectRatio: `${PAGE_WIDTH_MM} / ${PAGE_HEIGHT_MM}` }}
                >
                  <PageCanvas
                    page={page}
                    contactLinks={contactLinks}
                    qrCodes={qrCodes}
                  />
                </div>
                <div className="mt-2 flex items-center justify-between gap-2 px-1">
                  <span className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#FF9000]">
                    {page.type === "cover"
                      ? "Cover"
                      : page.type === "contacts"
                        ? "Contacts"
                        : "Products"}
                  </span>
                  <span className="text-[10px] uppercase tracking-[0.18em] text-[#8c8ea1]">
                    {page.number}
                  </span>
                </div>
              </button>
            ))}
          </div>
          </section>
        </div>
      </div>
      <div className="print-catalog-pages" aria-hidden="true">
        {(printRasterPages ?? pages).map((page, index) => (
          <div
            key={
              typeof page === "string"
                ? `print-raster-${index + 1}`
                : `print-${page.type}-${page.number}`
            }
            className="print-catalog-page"
            style={{
              width: `${PAGE_WIDTH_MM}mm`,
              height: `${PAGE_HEIGHT_MM}mm`,
            }}
          >
            {typeof page === "string" ? (
              <img
                src={page}
                alt={`Catalog page ${index + 1}`}
                className="h-full w-full object-cover"
              />
            ) : (
              <PageCanvas
                page={page}
                contactLinks={contactLinks}
                qrCodes={qrCodes}
              />
            )}
          </div>
        ))}
      </div>
    </>
  )
}
