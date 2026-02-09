"use client"

import { memo, useState, useCallback } from "react"
import { cn } from "@workspace/ui/lib/utils"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent as UICardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Badge } from "@workspace/ui/components/badge"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Textarea } from "@workspace/ui/components/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Progress } from "@workspace/ui/components/progress"
import { ScrollArea, ScrollBar } from "@workspace/ui/components/scroll-area"
import {
  Dialog,
  DialogContent as UIDialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import {
  ExternalLinkIcon,
  CheckIcon,
  CheckCircle2Icon,
  XCircleIcon,
  ClockIcon,
  LoaderIcon,
  FileIcon,
  DownloadIcon,
  StarIcon,
  ThumbsUpIcon,
  ThumbsDownIcon,
  SmileIcon,
  MehIcon,
  FrownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  LinkIcon,
  ImageIcon,
  PlayCircleIcon,
} from "lucide-react"

// ============================================================================
// TYPES
// ============================================================================

export type ButtonAction =
  | { type: "reply"; text: string }
  | { type: "url"; url: string; openInNewTab?: boolean }
  | { type: "callback"; callbackId: string; data?: Record<string, unknown> }

export interface RichButton {
  id: string
  label: string
  icon?: string
  variant?: "default" | "secondary" | "outline" | "ghost"
  action: ButtonAction
}

export interface QuickRepliesContent {
  type: "quick_replies"
  text?: string
  buttons: RichButton[]
}

export interface RichCardContent {
  type: "card"
  title: string
  description?: string
  imageUrl?: string
  imageAlt?: string
  metadata?: Array<{ label: string; value: string; icon?: string }>
  buttons?: RichButton[]
  footer?: string
}

export interface CarouselContent {
  type: "carousel"
  title?: string
  cards: Array<Omit<RichCardContent, "type">>
}

export interface ListItem {
  id: string
  title: string
  subtitle?: string
  description?: string
  imageUrl?: string
  icon?: string
  badge?: { text: string; variant?: "default" | "secondary" | "destructive" }
  action?: ButtonAction
}

export interface ListContent {
  type: "list"
  title?: string
  items: ListItem[]
  showDividers?: boolean
}

export interface ImageContent {
  type: "image"
  url: string
  alt?: string
  caption?: string
  width?: number
  height?: number
}

export interface VideoContent {
  type: "video"
  url: string
  thumbnailUrl?: string
  title?: string
  duration?: number
  provider?: "youtube" | "vimeo" | "mp4"
}

export interface LinkPreviewContent {
  type: "link_preview"
  url: string
  title?: string
  description?: string
  imageUrl?: string
  siteName?: string
  favicon?: string
}

export interface FormField {
  id: string
  type: "text" | "email" | "phone" | "number" | "select" | "textarea"
  label: string
  placeholder?: string
  required?: boolean
  options?: Array<{ value: string; label: string }>
  validation?: {
    minLength?: number
    maxLength?: number
    pattern?: string
    message?: string
  }
}

export interface FormContent {
  type: "form"
  title?: string
  description?: string
  fields: FormField[]
  submitLabel?: string
  callbackId: string
}

export interface ConfirmationContent {
  type: "confirmation"
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  confirmAction: ButtonAction
  variant?: "default" | "destructive"
}

export interface StatusContent {
  type: "status"
  title: string
  status: "pending" | "in_progress" | "completed" | "failed"
  message?: string
  progress?: number
  steps?: Array<{
    label: string
    status: "pending" | "current" | "completed" | "failed"
  }>
}

export interface FileContent {
  type: "file"
  filename: string
  url: string
  mimeType: string
  size: number
  description?: string
}

export interface RatingContent {
  type: "rating"
  title?: string
  message?: string
  maxRating: number
  callbackId: string
  ratingType?: "stars" | "thumbs" | "emoji"
}

export type RichContent =
  | QuickRepliesContent
  | RichCardContent
  | CarouselContent
  | ListContent
  | ImageContent
  | VideoContent
  | LinkPreviewContent
  | FormContent
  | ConfirmationContent
  | StatusContent
  | FileContent
  | RatingContent

export interface RichContentCallbacks {
  onButtonClick?: (action: ButtonAction) => void
  onFormSubmit?: (callbackId: string, data: Record<string, string>) => void
  onRatingSubmit?: (callbackId: string, rating: number) => void
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export interface AIRichContentProps {
  data: RichContent
  callbacks?: RichContentCallbacks
  className?: string
}

export const AIRichContent = memo(
  ({ data, callbacks, className }: AIRichContentProps) => {
    switch (data.type) {
      case "quick_replies":
        return (
          <QuickReplies
            data={data}
            callbacks={callbacks}
            className={className}
          />
        )
      case "card":
        return (
          <RichCard data={data} callbacks={callbacks} className={className} />
        )
      case "carousel":
        return (
          <Carousel data={data} callbacks={callbacks} className={className} />
        )
      case "list":
        return <List data={data} callbacks={callbacks} className={className} />
      case "image":
        return <RichImage data={data} className={className} />
      case "video":
        return <RichVideo data={data} className={className} />
      case "link_preview":
        return (
          <LinkPreview
            data={data}
            callbacks={callbacks}
            className={className}
          />
        )
      case "form":
        return (
          <RichForm data={data} callbacks={callbacks} className={className} />
        )
      case "confirmation":
        return (
          <Confirmation
            data={data}
            callbacks={callbacks}
            className={className}
          />
        )
      case "status":
        return <Status data={data} className={className} />
      case "file":
        return <FileCard data={data} className={className} />
      case "rating":
        return (
          <Rating data={data} callbacks={callbacks} className={className} />
        )
      default:
        return null
    }
  },
)
AIRichContent.displayName = "AIRichContent"

// ============================================================================
// QUICK REPLIES
// ============================================================================

interface QuickRepliesProps {
  data: QuickRepliesContent
  callbacks?: RichContentCallbacks
  className?: string
}

const QuickReplies = memo(
  ({ data, callbacks, className }: QuickRepliesProps) => {
    const handleClick = useCallback(
      (action: ButtonAction) => {
        callbacks?.onButtonClick?.(action)
      },
      [callbacks],
    )

    return (
      <div className={cn("flex flex-wrap gap-2", className)}>
        {data.buttons.map((button) => (
          <Button
            key={button.id}
            variant={button.variant || "outline"}
            size="sm"
            onClick={() => handleClick(button.action)}
            className="h-auto py-2 px-3 text-sm"
          >
            {button.label}
          </Button>
        ))}
      </div>
    )
  },
)
QuickReplies.displayName = "QuickReplies"

// ============================================================================
// RICH CARD
// ============================================================================

interface RichCardProps {
  data: RichCardContent
  callbacks?: RichContentCallbacks
  className?: string
}

const RichCard = memo(({ data, callbacks, className }: RichCardProps) => {
  const handleClick = useCallback(
    (action: ButtonAction) => {
      callbacks?.onButtonClick?.(action)
    },
    [callbacks],
  )

  return (
    <Card className={cn("w-full max-w-sm overflow-hidden", className)}>
      {data.imageUrl && (
        <div className="relative aspect-video overflow-hidden">
          <img
            src={data.imageUrl}
            alt={data.imageAlt || data.title}
            className="size-full object-cover"
          />
        </div>
      )}
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{data.title}</CardTitle>
        {data.description && (
          <CardDescription>{data.description}</CardDescription>
        )}
      </CardHeader>
      {data.metadata && data.metadata.length > 0 && (
        <UICardContent className="pb-2">
          <div className="space-y-1 text-sm">
            {data.metadata.map((item, i) => (
              <div key={i} className="flex justify-between">
                <span className="text-muted-foreground">{item.label}</span>
                <span className="font-medium">{item.value}</span>
              </div>
            ))}
          </div>
        </UICardContent>
      )}
      {data.buttons && data.buttons.length > 0 && (
        <CardFooter className="flex flex-wrap gap-2 pt-2">
          {data.buttons.map((button) => (
            <Button
              key={button.id}
              variant={button.variant || "default"}
              size="sm"
              onClick={() => handleClick(button.action)}
              className="flex-1 min-w-[80px]"
            >
              {button.action.type === "url" && (
                <ExternalLinkIcon className="mr-1 size-3" />
              )}
              {button.label}
            </Button>
          ))}
        </CardFooter>
      )}
      {data.footer && (
        <div className="border-t px-4 py-2 text-xs text-muted-foreground">
          {data.footer}
        </div>
      )}
    </Card>
  )
})
RichCard.displayName = "RichCard"

// ============================================================================
// CAROUSEL
// ============================================================================

interface CarouselProps {
  data: CarouselContent
  callbacks?: RichContentCallbacks
  className?: string
}

const Carousel = memo(({ data, callbacks, className }: CarouselProps) => {
  const [currentIndex, setCurrentIndex] = useState(0)
  const canScrollLeft = currentIndex > 0
  const canScrollRight = currentIndex < data.cards.length - 1

  return (
    <div className={cn("w-full", className)}>
      {data.title && <h4 className="mb-2 text-sm font-medium">{data.title}</h4>}
      <div className="relative">
        <ScrollArea className="w-full">
          <div className="flex gap-3 pb-4">
            {data.cards.map((card, index) => (
              <RichCard
                key={index}
                data={{ ...card, type: "card" }}
                callbacks={callbacks}
                className="w-[280px] flex-shrink-0"
              />
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>

        {data.cards.length > 1 && (
          <div className="hidden sm:flex absolute -left-3 -right-3 top-1/2 -translate-y-1/2 justify-between pointer-events-none">
            <Button
              variant="secondary"
              size="icon"
              className={cn(
                "size-8 rounded-full shadow-md pointer-events-auto",
                !canScrollLeft && "opacity-0",
              )}
              onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
              disabled={!canScrollLeft}
            >
              <ChevronLeftIcon className="size-4" />
            </Button>
            <Button
              variant="secondary"
              size="icon"
              className={cn(
                "size-8 rounded-full shadow-md pointer-events-auto",
                !canScrollRight && "opacity-0",
              )}
              onClick={() =>
                setCurrentIndex(
                  Math.min(data.cards.length - 1, currentIndex + 1),
                )
              }
              disabled={!canScrollRight}
            >
              <ChevronRightIcon className="size-4" />
            </Button>
          </div>
        )}
      </div>

      {data.cards.length > 1 && (
        <div className="flex justify-center gap-1 mt-2">
          {data.cards.map((_, index) => (
            <button
              key={index}
              className={cn(
                "size-2 rounded-full transition-colors",
                index === currentIndex
                  ? "bg-primary"
                  : "bg-muted-foreground/30",
              )}
              onClick={() => setCurrentIndex(index)}
            />
          ))}
        </div>
      )}
    </div>
  )
})
Carousel.displayName = "Carousel"

// ============================================================================
// LIST
// ============================================================================

interface ListProps {
  data: ListContent
  callbacks?: RichContentCallbacks
  className?: string
}

const List = memo(({ data, callbacks, className }: ListProps) => {
  const handleClick = useCallback(
    (action?: ButtonAction) => {
      if (action) {
        callbacks?.onButtonClick?.(action)
      }
    },
    [callbacks],
  )

  return (
    <div className={cn("w-full", className)}>
      {data.title && <h4 className="mb-2 text-sm font-medium">{data.title}</h4>}
      <div className={cn("space-y-0", data.showDividers && "divide-y")}>
        {data.items.map((item) => (
          <button
            key={item.id}
            className={cn(
              "flex w-full items-start gap-3 py-3 px-1 text-left transition-colors",
              item.action && "hover:bg-muted/50 cursor-pointer",
            )}
            onClick={() => handleClick(item.action)}
            disabled={!item.action}
          >
            {item.imageUrl && (
              <img
                src={item.imageUrl}
                alt={item.title}
                className="size-12 rounded-lg object-cover flex-shrink-0"
              />
            )}
            {item.icon && !item.imageUrl && (
              <div className="flex size-12 items-center justify-center rounded-lg bg-muted flex-shrink-0">
                <span className="text-lg">{item.icon}</span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium truncate">{item.title}</span>
                {item.badge && (
                  <Badge
                    variant={item.badge.variant || "default"}
                    className="text-xs"
                  >
                    {item.badge.text}
                  </Badge>
                )}
              </div>
              {item.subtitle && (
                <p className="text-sm text-muted-foreground truncate">
                  {item.subtitle}
                </p>
              )}
              {item.description && (
                <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">
                  {item.description}
                </p>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
})
List.displayName = "List"

// ============================================================================
// IMAGE
// ============================================================================

interface RichImageProps {
  data: ImageContent
  className?: string
}

const RichImage = memo(({ data, className }: RichImageProps) => {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <div className={cn("w-full max-w-md", className)}>
        <button
          className="block w-full overflow-hidden rounded-lg border bg-muted hover:bg-muted/80 transition-colors"
          onClick={() => setIsOpen(true)}
        >
          <img
            src={data.url}
            alt={data.alt || "Image"}
            className="w-full object-contain max-h-64"
          />
        </button>
        {data.caption && (
          <p className="mt-1 text-xs text-muted-foreground">{data.caption}</p>
        )}
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <UIDialogContent className="max-w-3xl">
          <img
            src={data.url}
            alt={data.alt || "Image"}
            className="w-full object-contain max-h-[80vh]"
          />
          {data.caption && (
            <p className="text-sm text-muted-foreground text-center">
              {data.caption}
            </p>
          )}
        </UIDialogContent>
      </Dialog>
    </>
  )
})
RichImage.displayName = "RichImage"

// ============================================================================
// VIDEO
// ============================================================================

interface RichVideoProps {
  data: VideoContent
  className?: string
}

const RichVideo = memo(({ data, className }: RichVideoProps) => {
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const getEmbedUrl = () => {
    if (data.provider === "youtube") {
      const videoId = data.url.match(
        /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/,
      )?.[1]
      return videoId ? `https://www.youtube.com/embed/${videoId}` : data.url
    }
    if (data.provider === "vimeo") {
      const videoId = data.url.match(/vimeo\.com\/(\d+)/)?.[1]
      return videoId ? `https://player.vimeo.com/video/${videoId}` : data.url
    }
    return data.url
  }

  if (data.provider === "mp4") {
    return (
      <div className={cn("w-full max-w-md", className)}>
        <video
          src={data.url}
          controls
          className="w-full rounded-lg"
          poster={data.thumbnailUrl}
        />
        {data.title && <p className="mt-1 text-sm font-medium">{data.title}</p>}
      </div>
    )
  }

  return (
    <div className={cn("w-full max-w-md", className)}>
      {data.thumbnailUrl ? (
        <a
          href={data.url}
          target="_blank"
          rel="noopener noreferrer"
          className="relative block overflow-hidden rounded-lg border bg-muted hover:bg-muted/80 transition-colors"
        >
          <img
            src={data.thumbnailUrl}
            alt={data.title || "Video thumbnail"}
            className="w-full aspect-video object-cover"
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex size-16 items-center justify-center rounded-full bg-black/60">
              <PlayCircleIcon className="size-8 text-white" />
            </div>
          </div>
          {data.duration && (
            <span className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-xs text-white">
              {formatDuration(data.duration)}
            </span>
          )}
        </a>
      ) : (
        <div className="aspect-video w-full overflow-hidden rounded-lg">
          <iframe
            src={getEmbedUrl()}
            className="size-full"
            allowFullScreen
            title={data.title || "Video"}
          />
        </div>
      )}
      {data.title && <p className="mt-1 text-sm font-medium">{data.title}</p>}
    </div>
  )
})
RichVideo.displayName = "RichVideo"

// ============================================================================
// LINK PREVIEW
// ============================================================================

interface LinkPreviewProps {
  data: LinkPreviewContent
  callbacks?: RichContentCallbacks
  className?: string
}

const LinkPreview = memo(({ data, callbacks, className }: LinkPreviewProps) => {
  const handleClick = useCallback(() => {
    callbacks?.onButtonClick?.({
      type: "url",
      url: data.url,
      openInNewTab: true,
    })
  }, [callbacks, data.url])

  return (
    <button
      className={cn(
        "flex w-full max-w-md items-start gap-3 overflow-hidden rounded-lg border bg-card p-3 text-left hover:bg-muted/50 transition-colors",
        className,
      )}
      onClick={handleClick}
    >
      {data.imageUrl ? (
        <img
          src={data.imageUrl}
          alt={data.title || data.url}
          className="size-16 rounded-md object-cover flex-shrink-0"
        />
      ) : (
        <div className="flex size-16 items-center justify-center rounded-md bg-muted flex-shrink-0">
          <LinkIcon className="size-6 text-muted-foreground" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        {data.siteName && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground mb-0.5">
            {data.favicon && (
              <img src={data.favicon} alt="" className="size-3" />
            )}
            <span>{data.siteName}</span>
          </div>
        )}
        <p className="font-medium text-sm line-clamp-1">
          {data.title || data.url}
        </p>
        {data.description && (
          <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
            {data.description}
          </p>
        )}
        <p className="text-xs text-muted-foreground/70 truncate mt-1">
          {new URL(data.url).hostname}
        </p>
      </div>
    </button>
  )
})
LinkPreview.displayName = "LinkPreview"

// ============================================================================
// FORM
// ============================================================================

interface RichFormProps {
  data: FormContent
  callbacks?: RichContentCallbacks
  className?: string
}

const RichForm = memo(({ data, callbacks, className }: RichFormProps) => {
  const [values, setValues] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      setIsSubmitting(true)
      callbacks?.onFormSubmit?.(data.callbackId, values)
      setTimeout(() => setIsSubmitting(false), 1000)
    },
    [callbacks, data.callbackId, values],
  )

  const handleChange = useCallback((fieldId: string, value: string) => {
    setValues((prev) => ({ ...prev, [fieldId]: value }))
  }, [])

  return (
    <form
      className={cn(
        "w-full max-w-sm space-y-4 rounded-lg border bg-card p-4",
        className,
      )}
      onSubmit={handleSubmit}
    >
      {data.title && (
        <div>
          <h4 className="font-medium">{data.title}</h4>
          {data.description && (
            <p className="text-sm text-muted-foreground">{data.description}</p>
          )}
        </div>
      )}

      <div className="space-y-3">
        {data.fields.map((field) => (
          <div key={field.id} className="space-y-1.5">
            <Label htmlFor={field.id}>
              {field.label}
              {field.required && (
                <span className="text-destructive ml-0.5">*</span>
              )}
            </Label>
            {field.type === "textarea" ? (
              <Textarea
                id={field.id}
                placeholder={field.placeholder}
                required={field.required}
                value={values[field.id] || ""}
                onChange={(e) => handleChange(field.id, e.target.value)}
                className="min-h-[80px]"
              />
            ) : field.type === "select" ? (
              <Select
                value={values[field.id] || ""}
                onValueChange={(value) => handleChange(field.id, value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={field.placeholder || "Select..."} />
                </SelectTrigger>
                <SelectContent>
                  {field.options?.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                id={field.id}
                type={field.type}
                placeholder={field.placeholder}
                required={field.required}
                value={values[field.id] || ""}
                onChange={(e) => handleChange(field.id, e.target.value)}
              />
            )}
          </div>
        ))}
      </div>

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting && <LoaderIcon className="size-4 animate-spin mr-2" />}
        {data.submitLabel || "Submit"}
      </Button>
    </form>
  )
})
RichForm.displayName = "RichForm"

// ============================================================================
// CONFIRMATION
// ============================================================================

interface ConfirmationProps {
  data: ConfirmationContent
  callbacks?: RichContentCallbacks
  className?: string
}

const Confirmation = memo(
  ({ data, callbacks, className }: ConfirmationProps) => {
    const [isOpen, setIsOpen] = useState(true)

    const handleConfirm = useCallback(() => {
      callbacks?.onButtonClick?.(data.confirmAction)
      setIsOpen(false)
    }, [callbacks, data.confirmAction])

    return (
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <UIDialogContent className={cn("sm:max-w-md", className)}>
          <DialogHeader>
            <DialogTitle>{data.title}</DialogTitle>
            <DialogDescription>{data.message}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-end gap-2">
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              {data.cancelLabel || "Cancel"}
            </Button>
            <Button
              variant={
                data.variant === "destructive" ? "destructive" : "default"
              }
              onClick={handleConfirm}
            >
              {data.confirmLabel || "Confirm"}
            </Button>
          </DialogFooter>
        </UIDialogContent>
      </Dialog>
    )
  },
)
Confirmation.displayName = "Confirmation"

// ============================================================================
// STATUS
// ============================================================================

interface StatusProps {
  data: StatusContent
  className?: string
}

const Status = memo(({ data, className }: StatusProps) => {
  const statusIcons = {
    pending: <ClockIcon className="size-5 text-muted-foreground" />,
    in_progress: <LoaderIcon className="size-5 text-blue-500 animate-spin" />,
    completed: <CheckCircle2Icon className="size-5 text-green-500" />,
    failed: <XCircleIcon className="size-5 text-destructive" />,
  }

  const stepIcons = {
    pending: (
      <div className="size-3 rounded-full border-2 border-muted-foreground/30" />
    ),
    current: <LoaderIcon className="size-3 text-primary animate-spin" />,
    completed: <CheckIcon className="size-3 text-green-500" />,
    failed: <XCircleIcon className="size-3 text-destructive" />,
  }

  return (
    <div
      className={cn("w-full max-w-sm rounded-lg border bg-card p-4", className)}
    >
      <div className="flex items-start gap-3">
        {statusIcons[data.status]}
        <div className="flex-1">
          <h4 className="font-medium">{data.title}</h4>
          {data.message && (
            <p className="text-sm text-muted-foreground mt-0.5">
              {data.message}
            </p>
          )}
        </div>
      </div>

      {data.progress !== undefined && (
        <div className="mt-3">
          <Progress value={data.progress} className="h-2" />
          <p className="text-xs text-muted-foreground mt-1 text-right">
            {data.progress}%
          </p>
        </div>
      )}

      {data.steps && data.steps.length > 0 && (
        <div className="mt-3 space-y-2">
          {data.steps.map((step, index) => (
            <div key={index} className="flex items-center gap-2">
              {stepIcons[step.status]}
              <span
                className={cn(
                  "text-sm",
                  step.status === "completed" &&
                    "text-muted-foreground line-through",
                  step.status === "failed" && "text-destructive",
                )}
              >
                {step.label}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
})
Status.displayName = "Status"

// ============================================================================
// FILE CARD
// ============================================================================

interface FileCardProps {
  data: FileContent
  className?: string
}

const FileCard = memo(({ data, className }: FileCardProps) => {
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const getFileIcon = () => {
    if (data.mimeType.startsWith("image/")) {
      return <ImageIcon className="size-8 text-muted-foreground" />
    }
    return <FileIcon className="size-8 text-muted-foreground" />
  }

  return (
    <a
      href={data.url}
      download={data.filename}
      className={cn(
        "flex w-full max-w-sm items-center gap-3 rounded-lg border bg-card p-3 hover:bg-muted/50 transition-colors",
        className,
      )}
    >
      <div className="flex size-12 items-center justify-center rounded-lg bg-muted flex-shrink-0">
        {getFileIcon()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{data.filename}</p>
        <p className="text-xs text-muted-foreground">{formatSize(data.size)}</p>
        {data.description && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
            {data.description}
          </p>
        )}
      </div>
      <DownloadIcon className="size-5 text-muted-foreground flex-shrink-0" />
    </a>
  )
})
FileCard.displayName = "FileCard"

// ============================================================================
// RATING
// ============================================================================

interface RatingProps {
  data: RatingContent
  callbacks?: RichContentCallbacks
  className?: string
}

const Rating = memo(({ data, callbacks, className }: RatingProps) => {
  const [selectedRating, setSelectedRating] = useState<number | null>(null)
  const [hoveredRating, setHoveredRating] = useState<number | null>(null)
  const [isSubmitted, setIsSubmitted] = useState(false)

  const handleSelect = useCallback(
    (rating: number) => {
      setSelectedRating(rating)
      setIsSubmitted(true)
      callbacks?.onRatingSubmit?.(data.callbackId, rating)
    },
    [callbacks, data.callbackId],
  )

  if (data.ratingType === "thumbs") {
    return (
      <div
        className={cn(
          "w-full max-w-sm rounded-lg border bg-card p-4",
          className,
        )}
      >
        {data.title && <h4 className="font-medium mb-1">{data.title}</h4>}
        {data.message && (
          <p className="text-sm text-muted-foreground mb-3">{data.message}</p>
        )}
        <div className="flex gap-2">
          <Button
            variant={selectedRating === 1 ? "default" : "outline"}
            size="lg"
            onClick={() => handleSelect(1)}
            disabled={isSubmitted}
            className="flex-1"
          >
            <ThumbsUpIcon
              className={cn("size-5", selectedRating === 1 && "text-green-500")}
            />
          </Button>
          <Button
            variant={selectedRating === 0 ? "default" : "outline"}
            size="lg"
            onClick={() => handleSelect(0)}
            disabled={isSubmitted}
            className="flex-1"
          >
            <ThumbsDownIcon
              className={cn("size-5", selectedRating === 0 && "text-red-500")}
            />
          </Button>
        </div>
        {isSubmitted && (
          <p className="text-sm text-muted-foreground mt-2 text-center">
            Thanks for your feedback!
          </p>
        )}
      </div>
    )
  }

  if (data.ratingType === "emoji") {
    const emojis = [
      { icon: FrownIcon, label: "Bad", color: "text-red-500" },
      { icon: MehIcon, label: "Okay", color: "text-yellow-500" },
      { icon: SmileIcon, label: "Good", color: "text-green-500" },
    ]
    return (
      <div
        className={cn(
          "w-full max-w-sm rounded-lg border bg-card p-4",
          className,
        )}
      >
        {data.title && <h4 className="font-medium mb-1">{data.title}</h4>}
        {data.message && (
          <p className="text-sm text-muted-foreground mb-3">{data.message}</p>
        )}
        <div className="flex justify-center gap-4">
          {emojis.map((emoji, index) => {
            const Icon = emoji.icon
            return (
              <button
                key={index}
                onClick={() => handleSelect(index + 1)}
                disabled={isSubmitted}
                className={cn(
                  "flex flex-col items-center gap-1 p-2 rounded-lg transition-colors",
                  selectedRating === index + 1
                    ? "bg-muted"
                    : "hover:bg-muted/50",
                  isSubmitted && selectedRating !== index + 1 && "opacity-40",
                )}
              >
                <Icon
                  className={cn(
                    "size-8",
                    selectedRating === index + 1 && emoji.color,
                  )}
                />
                <span className="text-xs text-muted-foreground">
                  {emoji.label}
                </span>
              </button>
            )
          })}
        </div>
        {isSubmitted && (
          <p className="text-sm text-muted-foreground mt-2 text-center">
            Thanks for your feedback!
          </p>
        )}
      </div>
    )
  }

  // Default: stars
  return (
    <div
      className={cn("w-full max-w-sm rounded-lg border bg-card p-4", className)}
    >
      {data.title && <h4 className="font-medium mb-1">{data.title}</h4>}
      {data.message && (
        <p className="text-sm text-muted-foreground mb-3">{data.message}</p>
      )}
      <div className="flex justify-center gap-1">
        {Array.from({ length: data.maxRating }).map((_, index) => {
          const rating = index + 1
          const isFilled = rating <= (hoveredRating ?? selectedRating ?? 0)
          return (
            <button
              key={index}
              onClick={() => handleSelect(rating)}
              onMouseEnter={() => !isSubmitted && setHoveredRating(rating)}
              onMouseLeave={() => setHoveredRating(null)}
              disabled={isSubmitted}
              className="p-1 transition-transform hover:scale-110"
            >
              <StarIcon
                className={cn(
                  "size-8 transition-colors",
                  isFilled
                    ? "fill-yellow-400 text-yellow-400"
                    : "text-muted-foreground",
                )}
              />
            </button>
          )
        })}
      </div>
      {isSubmitted && (
        <p className="text-sm text-muted-foreground mt-2 text-center">
          Thanks for your feedback!
        </p>
      )}
    </div>
  )
})
Rating.displayName = "Rating"

// ============================================================================
// EXPORTS
// ============================================================================

export {
  QuickReplies,
  RichCard,
  Carousel,
  List,
  RichImage,
  RichVideo,
  LinkPreview,
  RichForm,
  Confirmation,
  Status,
  FileCard,
  Rating,
}
