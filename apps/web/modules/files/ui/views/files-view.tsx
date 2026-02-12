"use client"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { useInfiniteScroll } from "@workspace/ui/hooks/use-infinite-scroll"
import { InfiniteScrollTrigger } from "@workspace/ui/components/infinite-scroll-trigger"
import { api } from "@workspace/backend/convex/_generated/api"
import type { PublicFile } from "@workspace/backend/convex/private/files"
import { useAction, usePaginatedQuery } from "convex/react"
import { Button } from "@workspace/ui/components/button"
import {
  DownloadIcon,
  FileIcon,
  LinkIcon,
  MoreHorizontalIcon,
  ScanEyeIcon,
  PlusIcon,
  TrashIcon,
} from "lucide-react"
import { Badge } from "@workspace/ui/components/badge"
import { UploadDialog } from "../components/upload-dialog"
import { useEffect, useState } from "react"
import { DeleteFileDialog } from "../components/delete-file-dialog"
import { MobileHeader } from "@/modules/dashboard/ui/components/mobile-header"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"

export const FilesView = () => {
  const addWebsite = useAction(api.private.files.addWebsite)
  const files = usePaginatedQuery(
    api.private.files.list,
    {},
    { initialNumItems: 10 },
  )

  const {
    topElementRef,
    handleLoadMore,
    canLoadMore,
    isLoadingFirstPage,
    isLoadingMore,
  } = useInfiniteScroll({
    status: files.status,
    loadMore: files.loadMore,
    loadSize: 10,
  })

  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedFile, setSelectedFile] = useState<PublicFile | null>(null)
  const [previewFile, setPreviewFile] = useState<PublicFile | null>(null)
  const [websiteUrl, setWebsiteUrl] = useState("")
  const [websiteCategory, setWebsiteCategory] = useState("")
  const [isCrawlingWebsite, setIsCrawlingWebsite] = useState(false)
  const [crawlMessage, setCrawlMessage] = useState<string | null>(null)
  const [crawlMessageDetail, setCrawlMessageDetail] = useState<string | null>(
    null,
  )

  const handleDeleteClick = (file: PublicFile) => {
    setSelectedFile(file)
    setDeleteDialogOpen(true)
  }

  const handleFileDeleted = () => {
    setSelectedFile(null)
  }

  const handleCrawlWebsite = async () => {
    if (!websiteUrl.trim() || !websiteCategory.trim()) return

    setIsCrawlingWebsite(true)
    setCrawlMessage(null)
    setCrawlMessageDetail(null)
    try {
      const result = await addWebsite({
        url: websiteUrl.trim(),
        category: websiteCategory.trim(),
      })

      setCrawlMessage(
        `Crawled ${result.crawledCount} page(s), ingested ${result.ingestedCount}, skipped ${result.skippedCount}.`,
      )
      setWebsiteUrl("")
    } catch (error) {
      const rawMessage =
        error instanceof Error ? error.message : "Failed to crawl website."
      setCrawlMessageDetail(rawMessage)
      setCrawlMessage(getUserFriendlyCrawlError(rawMessage))
    } finally {
      setIsCrawlingWebsite(false)
    }
  }

  return (
    <>
      <DeleteFileDialog
        file={selectedFile}
        onDeleted={handleFileDeleted}
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
      />
      <UploadDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        onFileUploaded={() => {}}
      />
      <FilePreviewDialog
        file={previewFile}
        open={!!previewFile}
        onOpenChange={(open) => {
          if (!open) setPreviewFile(null)
        }}
      />

      <div className="h-full flex flex-col bg-muted overflow-auto">
        <MobileHeader title="Knowledge Base" />
        <div className="mx-auto w-full max-w-3xl p-8">
          <div className="space-y-2">
            <h1 className="text-2xl md:text-4xl">Knowledge Base</h1>
            <p className="text-muted-foreground">
              Upload and manage documents for your AI assistant.
            </p>
          </div>

          <div className="mt-8 rounded-lg border bg-background p-6">
            <div className="space-y-2">
              <h2 className="text-lg font-medium">Website Crawler</h2>
              <p className="text-sm text-muted-foreground">
                Enter a docs/help center URL to crawl and ingest content into
                your knowledge base.
              </p>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="crawler-url">Website URL</Label>
                <Input
                  id="crawler-url"
                  type="url"
                  placeholder="https://docs.example.com"
                  value={websiteUrl}
                  onChange={(event) => setWebsiteUrl(event.target.value)}
                  disabled={isCrawlingWebsite}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="crawler-category">Category</Label>
                <Input
                  id="crawler-category"
                  placeholder="e.g., Product Docs"
                  value={websiteCategory}
                  onChange={(event) => setWebsiteCategory(event.target.value)}
                  disabled={isCrawlingWebsite}
                />
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p
                className="text-sm text-muted-foreground min-w-0 truncate"
                title={crawlMessageDetail ?? crawlMessage ?? ""}
              >
                {crawlMessage}
              </p>
              <Button
                onClick={handleCrawlWebsite}
                disabled={
                  isCrawlingWebsite ||
                  !websiteUrl.trim() ||
                  !websiteCategory.trim()
                }
              >
                {isCrawlingWebsite ? "Crawling..." : "Crawl Website"}
              </Button>
            </div>
          </div>

          <div className="mt-8 rounded-lg border bg-background">
            <div className="flex items-center justify-end border-b px-6 py-4">
              <Button onClick={() => setUploadDialogOpen(true)}>
                <PlusIcon />
                Add New
              </Button>
            </div>

            <Table className="table-fixed min-w-[720px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="px-6 py-4 font-medium w-[50%]">
                    Name
                  </TableHead>
                  <TableHead className="px-6 py-4 font-medium w-[15%] whitespace-nowrap">
                    Type
                  </TableHead>
                  <TableHead className="px-6 py-4 font-medium w-[15%] whitespace-nowrap">
                    Size
                  </TableHead>
                  <TableHead className="px-6 py-4 font-medium w-[20%] whitespace-nowrap">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(() => {
                  if (isLoadingFirstPage) {
                    return (
                      <TableRow>
                        <TableCell colSpan={4} className="h-24 text-center">
                          Loading files...
                        </TableCell>
                      </TableRow>
                    )
                  }

                  if (files.results.length === 0) {
                    return (
                      <TableRow>
                        <TableCell colSpan={4} className="h-24 text-center">
                          No files found. Click "Add New" to upload files.
                        </TableCell>
                      </TableRow>
                    )
                  }

                  return files.results.map((file: PublicFile) => (
                    <TableRow key={file.id}>
                      <TableCell className="px-6 py-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <FileIcon className="size-4 shrink-0" />
                          <span className="truncate" title={file.name}>
                            {file.name}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="px-6 py-4 whitespace-nowrap">
                        <Badge className="uppercase" variant="outline">
                          {file.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-6 py-4 text-muted-foreground whitespace-nowrap">
                        {file.size}
                      </TableCell>
                      <TableCell className="px-6 py-4 whitespace-nowrap">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              className="size-8 p-0"
                              variant="ghost"
                              size="sm"
                            >
                              <MoreHorizontalIcon />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => setPreviewFile(file)}
                            >
                              <ScanEyeIcon className="size-4 mr-2" />
                              View
                            </DropdownMenuItem>
                            {file.sourceType === "document" && file.url ? (
                              <DropdownMenuItem asChild>
                                <a href={file.url} download={file.name}>
                                  <DownloadIcon className="size-4 mr-2" />
                                  Download
                                </a>
                              </DropdownMenuItem>
                            ) : null}
                            {file.sourceType === "url" && file.sourceUrl ? (
                              <DropdownMenuItem asChild>
                                <a
                                  href={file.sourceUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  <LinkIcon className="size-4 mr-2" />
                                  Open Source
                                </a>
                              </DropdownMenuItem>
                            ) : null}
                            <DropdownMenuItem
                              onClick={() => handleDeleteClick(file)}
                              className="text-destructive"
                            >
                              <TrashIcon className="size-4 mr-2" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                })()}
              </TableBody>
            </Table>

            {!isLoadingFirstPage && files.results.length > 0 && (
              <div className="border-t">
                <InfiniteScrollTrigger
                  ref={topElementRef}
                  canLoadMore={canLoadMore}
                  isLoadingMore={isLoadingMore}
                  isLoadingFirstPage={isLoadingFirstPage}
                  onLoadMore={handleLoadMore}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

export default FilesView

function getUserFriendlyCrawlError(rawMessage: string): string {
  const lower = rawMessage.toLowerCase()

  if (lower.includes("http 403") || lower.includes("http 401")) {
    return "This website blocked crawling access. Try another docs URL."
  }

  if (lower.includes("no crawlable pages found")) {
    return "No crawlable pages were found at that URL."
  }

  if (lower.includes("invalid url")) {
    return "Please enter a valid URL."
  }

  if (lower.includes("non-html content")) {
    return "That URL does not point to an HTML page."
  }

  return "Crawling failed. Please try again."
}

type FilePreviewDialogProps = {
  file: PublicFile | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

const TEXT_PREVIEW_TYPES = new Set(["txt", "csv", "json", "md", "xml", "html"])
const IFRAME_PREVIEW_TYPES = new Set([
  "pdf",
  "jpg",
  "jpeg",
  "png",
  "gif",
  "webp",
])

function FilePreviewDialog({
  file,
  open,
  onOpenChange,
}: FilePreviewDialogProps) {
  const getWebsitePreview = useAction(api.private.files.getWebsitePreview)
  const [content, setContent] = useState<string>("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !file) return

    let cancelled = false
    const loadPreview = async () => {
      setIsLoading(true)
      setError(null)
      setContent("")
      try {
        if (file.sourceType === "url") {
          if (!file.sourceUrl) {
            setError("No source URL available for this entry.")
            return
          }
          const preview = await getWebsitePreview({ url: file.sourceUrl })
          if (!cancelled) {
            setContent(preview.text)
          }
          return
        }

        if (TEXT_PREVIEW_TYPES.has(file.type) && file.url) {
          const response = await fetch(file.url)
          if (!response.ok) {
            throw new Error(`Preview failed with status ${response.status}`)
          }
          const text = await response.text()
          if (!cancelled) {
            setContent(text)
          }
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Failed to load file preview.",
          )
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    loadPreview()
    return () => {
      cancelled = true
    }
  }, [file, open, getWebsitePreview])

  const showIframe =
    !!file &&
    file.sourceType === "document" &&
    !!file.url &&
    IFRAME_PREVIEW_TYPES.has(file.type)

  const showText =
    !!file &&
    ((file.sourceType === "url" && !!content) ||
      (file.sourceType === "document" &&
        TEXT_PREVIEW_TYPES.has(file.type) &&
        !!content))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="min-w-[80vw] max-h-[92vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="truncate" title={file?.name || ""}>
            {file?.name || "File Preview"}
          </DialogTitle>
          <DialogDescription>
            {file?.sourceType === "url"
              ? "Website content preview"
              : "File content preview"}
          </DialogDescription>
        </DialogHeader>

        <div className="h-[72vh] max-h-[72vh] overflow-auto rounded-md border bg-muted/20 p-4">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading preview...</p>
          ) : null}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          {!isLoading && !error && showIframe && file?.url ? (
            <iframe
              src={file.url}
              className="w-full h-full rounded-md border bg-background"
              title={file.name}
            />
          ) : null}
          {!isLoading && !error && showText ? (
            <pre className="max-w-full overflow-x-auto whitespace-pre-wrap wrap-break-word text-sm font-mono">
              {content}
            </pre>
          ) : null}
          {!isLoading && !error && !showIframe && !showText ? (
            <p className="text-sm text-muted-foreground">
              Preview is not available for this file type. Use download or open
              source.
            </p>
          ) : null}
        </div>

        <DialogFooter>
          {file?.sourceType === "document" && file.url ? (
            <Button asChild variant="outline">
              <a href={file.url} download={file.name}>
                <DownloadIcon className="size-4 mr-2" />
                Download
              </a>
            </Button>
          ) : null}
          {file?.sourceType === "url" && file.sourceUrl ? (
            <Button asChild variant="outline">
              <a href={file.sourceUrl} target="_blank" rel="noreferrer">
                <LinkIcon className="size-4 mr-2" />
                Open Source
              </a>
            </Button>
          ) : null}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
