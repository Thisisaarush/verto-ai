import { action, mutation, query, QueryCtx } from "../_generated/server"
import { ConvexError, v } from "convex/values"
import {
  contentHashFromArrayBuffer,
  Entry,
  EntryId,
  guessMimeTypeFromContents,
  guessMimeTypeFromExtension,
  vEntryId,
} from "@convex-dev/rag"
import { extractTextContent } from "../lib/extractTextContent"
import rag from "../system/ai/rag"
import { Id } from "../_generated/dataModel"
import { paginationOptsValidator } from "convex/server"
import { internal } from "../_generated/api"

const WEBSITE_CRAWL_LIMITS = {
  maxPages: 25,
  maxDepth: 2,
  maxPageChars: 50_000,
  requestTimeoutMs: 10_000,
} as const

const guessMimeType = (filename: string, bytes: ArrayBuffer): string => {
  return (
    guessMimeTypeFromExtension(filename) ||
    guessMimeTypeFromContents(bytes) ||
    "application/octet-stream"
  )
}

export const addFile = action({
  args: {
    filename: v.string(),
    mimeType: v.string(),
    bytes: v.bytes(),
    category: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (identity === null) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "User not authenticated",
      })
    }

    const orgId = identity.orgId as string
    if (!orgId) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "User not authorized",
      })
    }

    const subscriptions = await ctx.runQuery(
      internal.system.subscriptions.getByOrganizationId,
      {
        organizationId: orgId,
      }
    )

    if (subscriptions?.status !== "active") {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Organization does not have an active subscription",
      })
    }

    const { bytes, filename, category } = args
    const mimeType = args.mimeType || guessMimeType(filename, bytes)
    const blob = new Blob([bytes], { type: mimeType })

    const storageId = await ctx.storage.store(blob)

    const text = await extractTextContent(ctx, {
      storageId,
      filename,
      bytes,
      mimeType,
    })

    const { entryId, created } = await rag.add(ctx, {
      namespace: orgId,
      text,
      key: filename,
      metadata: {
        storageId,
        uploadedBy: orgId,
        filename,
        category: category ?? null,
      } as EntryMetadata,
      contentHash: await contentHashFromArrayBuffer(bytes),
    })

    if (!created) {
      console.debug("Entry already exists, skipping upload metadata")
      await ctx.storage.delete(storageId)
    }

    return {
      url: await ctx.storage.getUrl(storageId),
      entryId,
    }
  },
})

export const addWebsite = action({
  args: {
    url: v.string(),
    category: v.optional(v.string()),
    maxPages: v.optional(v.number()),
    maxDepth: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (identity === null) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "User not authenticated",
      })
    }

    const orgId = identity.orgId as string
    if (!orgId) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "User not authorized",
      })
    }

    const subscriptions = await ctx.runQuery(
      internal.system.subscriptions.getByOrganizationId,
      {
        organizationId: orgId,
      }
    )

    if (subscriptions?.status !== "active") {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Organization does not have an active subscription",
      })
    }

    let seedUrl: URL
    try {
      seedUrl = new URL(args.url)
    } catch {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Invalid URL",
      })
    }

    if (!["http:", "https:"].includes(seedUrl.protocol)) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Only http/https URLs are supported",
      })
    }

    const maxPages = Math.min(
      Math.max(args.maxPages ?? 10, 1),
      WEBSITE_CRAWL_LIMITS.maxPages
    )
    const maxDepth = Math.min(
      Math.max(args.maxDepth ?? 1, 0),
      WEBSITE_CRAWL_LIMITS.maxDepth
    )

    let { pages, lastError } = await crawlWebsite(seedUrl, maxPages, maxDepth)
    if (pages.length === 0) {
      const fallbackUrl = getWwwFallbackUrl(seedUrl)
      if (fallbackUrl) {
        const fallbackResult = await crawlWebsite(fallbackUrl, maxPages, maxDepth)
        pages = fallbackResult.pages
        lastError = fallbackResult.lastError ?? lastError
      }
    }
    if (pages.length === 0) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: lastError
          ? `No crawlable pages found at the provided URL. Last error: ${lastError}`
          : "No crawlable pages found at the provided URL",
      })
    }

    let ingestedCount = 0
    for (const page of pages) {
      const text = formatPageContent(page)
      const key = page.title
        ? `${page.title} (${page.url})`
        : page.url

      const { created } = await rag.add(ctx, {
        namespace: orgId,
        text,
        key,
        metadata: {
          uploadedBy: orgId,
          category: args.category ?? null,
          sourceType: "url",
          url: page.url,
          title: page.title || null,
        } as UrlEntryMetadata,
        contentHash: await contentHashFromArrayBuffer(
          new TextEncoder().encode(text).buffer
        ),
      })

      if (created) {
        ingestedCount += 1
      }
    }

    return {
      crawledCount: pages.length,
      ingestedCount,
      skippedCount: pages.length - ingestedCount,
      pages: pages.map((page) => ({
        url: page.url,
        title: page.title,
      })),
    }
  },
})

export const getWebsitePreview = action({
  args: {
    url: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (identity === null) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "User not authenticated",
      })
    }

    const orgId = identity.orgId as string
    if (!orgId) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "User not authorized",
      })
    }

    const result = await fetchViaReaderProxy(args.url)
    if (!result.page) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: result.error || "Unable to load website preview",
      })
    }

    return {
      title: result.page.title,
      text: result.page.text.slice(0, WEBSITE_CRAWL_LIMITS.maxPageChars),
      url: args.url,
    }
  },
})

export const deleteFile = mutation({
  args: {
    entryId: vEntryId,
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (identity === null) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "User not authenticated",
      })
    }

    const orgId = identity.orgId as string
    if (!orgId) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "User not authorized",
      })
    }

    const namespace = await rag.getNamespace(ctx, {
      namespace: orgId,
    })

    if (!namespace) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "Namespace not found",
      })
    }

    const entry = await rag.getEntry(ctx, {
      entryId: args.entryId,
    })

    if (!entry) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Entry not found",
      })
    }

    if (entry.metadata?.uploadedBy !== orgId) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "User not authorized to delete this entry",
      })
    }

    if (entry.metadata?.storageId) {
      await ctx.storage.delete(entry.metadata.storageId as Id<"_storage">)
    }

    await rag.deleteAsync(ctx, {
      entryId: args.entryId,
    })
  },
})

export const list = query({
  args: {
    category: v.optional(v.string()),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (identity === null) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "User not authenticated",
      })
    }

    const orgId = identity.orgId as string
    if (!orgId) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "User not authorized",
      })
    }

    const namespace = await rag.getNamespace(ctx, {
      namespace: orgId,
    })

    if (!namespace) {
      return { page: [], isDone: true, continueCursor: "" }
    }

    const results = await rag.list(ctx, {
      namespaceId: namespace.namespaceId,
      paginationOpts: args.paginationOpts,
    })

    const files = await Promise.all(
      results.page.map((entry) => convertEntryToPublicFile(ctx, entry))
    )

    const filteredFiles = args.category
      ? files.filter((file) => file.category === args.category)
      : files

    return {
      page: filteredFiles,
      isDone: results.isDone,
      continueCursor: results.continueCursor,
    }
  },
})

export type PublicFile = {
  id: EntryId
  name: string
  type: string
  size: string
  status: "ready" | "processing" | "error"
  url: string
  category: string | null
  sourceType: "document" | "url"
  sourceUrl: string | null
}

type EntryMetadata = {
  storageId?: Id<"_storage">
  uploadedBy: string
  filename?: string
  category: string | null
  sourceType?: "document" | "url"
  url?: string
  title?: string | null
}

const convertEntryToPublicFile = async (
  ctx: QueryCtx,
  entry: Entry
): Promise<PublicFile> => {
  const metadata = entry.metadata as EntryMetadata | undefined
  const storageId = metadata?.storageId

  let fileSize = "unknown"

  if (storageId) {
    try {
      const storageMetadata = await ctx.db.system.get(storageId)
      if (storageMetadata) {
        fileSize = formatFileSize(storageMetadata.size)
      }
    } catch (error) {
      console.error("Error fetching storage metadata:", error)
    }
  }

  const filename = entry.key || "unknown"
  const extension =
    metadata?.sourceType === "url"
      ? "url"
      : filename.split(".").pop()?.toLowerCase() || "txt"

  let status: "ready" | "processing" | "error" = "error"
  if (entry.status === "ready") {
    status = "ready"
  } else if (entry.status === "pending") {
    status = "processing"
  }

  const url = storageId ? await ctx.storage.getUrl(storageId) : null

  return {
    id: entry.entryId,
    name: filename,
    type: extension,
    size: fileSize,
    status,
    url: url || "",
    category: metadata?.category || null,
    sourceType: metadata?.sourceType || "document",
    sourceUrl: metadata?.url || null,
  }
}

type UrlEntryMetadata = {
  uploadedBy: string
  category: string | null
  sourceType: "url"
  url: string
  title: string | null
}

type CrawledPage = {
  url: string
  title: string | null
  text: string
  links: string[]
}

async function crawlWebsite(
  seedUrl: URL,
  maxPages: number,
  maxDepth: number
): Promise<{ pages: CrawledPage[]; lastError: string | null }> {
  const normalizedSeed = normalizeUrl(seedUrl.toString())
  if (!normalizedSeed) return { pages: [], lastError: "Invalid seed URL" }

  const queue: Array<{ url: string; depth: number }> = [
    { url: normalizedSeed, depth: 0 },
  ]
  const visited = new Set<string>()
  const results: CrawledPage[] = []
  let lastError: string | null = null

  while (queue.length > 0 && results.length < maxPages) {
    const current = queue.shift()
    if (!current) break
    if (visited.has(current.url)) continue
    visited.add(current.url)

    const pageResult = await fetchAndExtractPage(current.url, seedUrl.hostname)
    if (pageResult.error) {
      lastError = pageResult.error
    }
    const page = pageResult.page
    if (!page) continue

    results.push(page)
    if (current.depth >= maxDepth) continue

    for (const link of page.links) {
      if (!visited.has(link) && queue.length + results.length < maxPages * 3) {
        queue.push({ url: link, depth: current.depth + 1 })
      }
    }
  }

  return { pages: results, lastError }
}

async function fetchAndExtractPage(
  url: string,
  allowedHost: string
): Promise<{ page: CrawledPage | null; error: string | null }> {
  const controller = new AbortController()
  const timeout = setTimeout(
    () => controller.abort(),
    WEBSITE_CRAWL_LIMITS.requestTimeoutMs
  )

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
    })
    if (!response.ok) {
      if (response.status === 403 || response.status === 401) {
        const proxyResult = await fetchViaReaderProxy(url)
        if (proxyResult.page) {
          return {
            page: {
              url,
              title: proxyResult.page.title,
              text: proxyResult.page.text.slice(
                0,
                WEBSITE_CRAWL_LIMITS.maxPageChars
              ),
              links: [],
            },
            error: null,
          }
        }
        return {
          page: null,
          error: `HTTP ${response.status} for ${url} (proxy fallback failed: ${proxyResult.error ?? "unknown"})`,
        }
      }
      return { page: null, error: `HTTP ${response.status} for ${url}` }
    }

    const contentType = response.headers.get("content-type")?.toLowerCase()
    if (!contentType?.includes("text/html")) {
      return {
        page: null,
        error: `Non-HTML content at ${url} (${contentType ?? "unknown"})`,
      }
    }

    const html = await response.text()
    const { title, text } = extractHtmlContent(html)
    if (!text && !title) {
      return { page: null, error: `No text content extracted from ${url}` }
    }

    const finalUrl = normalizeUrl(response.url) || url
    const links = extractInternalLinks(finalUrl, html, allowedHost)

    return {
      page: {
        url: finalUrl,
        title,
        text: text.slice(0, WEBSITE_CRAWL_LIMITS.maxPageChars),
        links,
      },
      error: null,
    }
  } catch {
    return { page: null, error: `Request failed for ${url}` }
  } finally {
    clearTimeout(timeout)
  }
}

async function fetchViaReaderProxy(
  url: string
): Promise<{
  page: { title: string | null; text: string } | null
  error: string | null
}> {
  const controller = new AbortController()
  const timeout = setTimeout(
    () => controller.abort(),
    WEBSITE_CRAWL_LIMITS.requestTimeoutMs
  )

  try {
    const parsed = new URL(url)
    const withoutProtocol = `${parsed.host}${parsed.pathname}${parsed.search}`
    const proxyCandidates = [
      `https://r.jina.ai/${url}`,
      `https://r.jina.ai/https://${withoutProtocol}`,
      `https://r.jina.ai/http://${withoutProtocol}`,
    ]

    let lastError: string | null = null
    for (const proxyUrl of proxyCandidates) {
      try {
        const response = await fetch(proxyUrl, {
          signal: controller.signal,
          headers: {
            Accept: "text/plain,text/markdown;q=0.9,*/*;q=0.8",
            "User-Agent":
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          },
        })

        if (!response.ok) {
          lastError = `proxy HTTP ${response.status}`
          continue
        }

        const text = (await response.text()).trim()
        if (!text) {
          lastError = "proxy returned empty response"
          continue
        }

        const firstLine = text
          .split("\n")
          .find((line) => line.trim().length > 0)
        const title = firstLine ? firstLine.replace(/^#\s*/, "").trim() : null

        return { page: { title: title || null, text }, error: null }
      } catch {
        lastError = "proxy request failed"
      }
    }

    return { page: null, error: lastError ?? "proxy unavailable" }
  } catch {
    return { page: null, error: "invalid URL for proxy fallback" }
  } finally {
    clearTimeout(timeout)
  }
}

function extractHtmlContent(html: string): { title: string | null; text: string } {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  const title = titleMatch?.[1] ? decodeHtml(titleMatch[1]).trim() : null
  const metaDescriptionMatch = html.match(
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i
  )
  const metaDescription = metaDescriptionMatch?.[1]
    ? decodeHtml(metaDescriptionMatch[1]).trim()
    : ""

  const noScript = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
  const noTags = noScript.replace(/<[^>]+>/g, " ")
  let text = decodeHtml(noTags).replace(/\s+/g, " ").trim()

  if (text.length < 120 && metaDescription) {
    text = `${text}\n\n${metaDescription}`.trim()
  }

  return { title, text }
}

function extractInternalLinks(
  baseUrl: string,
  html: string,
  host: string
): string[] {
  const links: string[] = []
  const hrefRegex = /\bhref\s*=\s*["']([^"'#]+)["']/gi
  let match: RegExpExecArray | null
  while ((match = hrefRegex.exec(html)) !== null) {
    const href = match[1]
    if (!href) continue

    try {
      const absolute = new URL(href, baseUrl)
      if (!["http:", "https:"].includes(absolute.protocol)) continue
      if (!isSameSiteHost(absolute.hostname, host)) continue
      const normalized = normalizeUrl(absolute.toString())
      if (normalized) links.push(normalized)
    } catch {
      continue
    }
  }

  return [...new Set(links)]
}

function isSameSiteHost(candidateHost: string, seedHost: string): boolean {
  const normalizeHost = (host: string) =>
    host.toLowerCase().replace(/^www\./, "")

  return normalizeHost(candidateHost) === normalizeHost(seedHost)
}

function normalizeUrl(url: string): string | null {
  try {
    const normalized = new URL(url)
    normalized.hash = ""
    if (normalized.pathname.endsWith("/")) {
      normalized.pathname = normalized.pathname.slice(0, -1) || "/"
    }
    return normalized.toString()
  } catch {
    return null
  }
}

function getWwwFallbackUrl(url: URL): URL | null {
  const hostname = url.hostname.toLowerCase()
  if (hostname.startsWith("www.")) {
    const withoutWww = hostname.replace(/^www\./, "")
    if (!withoutWww) return null
    const next = new URL(url.toString())
    next.hostname = withoutWww
    return next
  }

  const next = new URL(url.toString())
  next.hostname = `www.${hostname}`
  return next
}

function decodeHtml(input: string): string {
  return input
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

function formatPageContent(page: CrawledPage): string {
  const heading = page.title ? `# ${page.title}\n\n` : ""
  return `${heading}Source: ${page.url}\n\n${page.text}`
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
}
