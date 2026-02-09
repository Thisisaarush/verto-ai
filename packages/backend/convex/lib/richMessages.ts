/**
 * Rich Message Types for Verto AI Widget
 *
 * This module defines structured content types for rich messaging,
 * allowing AI agents and operators to send interactive content beyond plain text.
 *
 * Rich content is embedded in messages using a special format:
 * <!--RICH:{"type":"...", ...}-->
 *
 * This allows compatibility with the @convex-dev/agent message storage
 * while enabling rich rendering in the widget.
 */

import { v } from "convex/values"

// ============================================================================
// RICH CONTENT TYPE DEFINITIONS
// ============================================================================

/**
 * Button action types
 */
export type ButtonAction =
  | { type: "reply"; text: string } // Send this text as a reply
  | { type: "url"; url: string; openInNewTab?: boolean } // Open a URL
  | { type: "callback"; callbackId: string; data?: Record<string, unknown> } // Trigger a callback

/**
 * A single button in quick replies or card actions
 */
export interface RichButton {
  id: string
  label: string
  icon?: string // Lucide icon name
  variant?: "default" | "secondary" | "outline" | "ghost"
  action: ButtonAction
}

/**
 * Quick reply buttons - simple horizontal button row
 */
export interface QuickRepliesContent {
  type: "quick_replies"
  text?: string // Optional text above the buttons
  buttons: RichButton[]
}

/**
 * Rich card with optional image, title, description, and actions
 */
export interface CardContent {
  type: "card"
  title: string
  description?: string
  imageUrl?: string
  imageAlt?: string
  metadata?: Array<{ label: string; value: string; icon?: string }>
  buttons?: RichButton[]
  footer?: string
}

/**
 * Carousel - horizontal scrollable cards
 */
export interface CarouselContent {
  type: "carousel"
  title?: string
  cards: Array<Omit<CardContent, "type">>
}

/**
 * Structured list with items
 */
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

/**
 * Image with optional caption
 */
export interface ImageContent {
  type: "image"
  url: string
  alt?: string
  caption?: string
  width?: number
  height?: number
}

/**
 * Video embed
 */
export interface VideoContent {
  type: "video"
  url: string
  thumbnailUrl?: string
  title?: string
  duration?: number // seconds
  provider?: "youtube" | "vimeo" | "mp4"
}

/**
 * Link preview / unfurl
 */
export interface LinkPreviewContent {
  type: "link_preview"
  url: string
  title?: string
  description?: string
  imageUrl?: string
  siteName?: string
  favicon?: string
}

/**
 * Form input request
 */
export interface FormField {
  id: string
  type: "text" | "email" | "phone" | "number" | "select" | "textarea"
  label: string
  placeholder?: string
  required?: boolean
  options?: Array<{ value: string; label: string }> // For select
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

/**
 * Confirmation dialog trigger
 */
export interface ConfirmationContent {
  type: "confirmation"
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  confirmAction: ButtonAction
  variant?: "default" | "destructive"
}

/**
 * Status indicator / progress
 */
export interface StatusContent {
  type: "status"
  title: string
  status: "pending" | "in_progress" | "completed" | "failed"
  message?: string
  progress?: number // 0-100
  steps?: Array<{
    label: string
    status: "pending" | "current" | "completed" | "failed"
  }>
}

/**
 * File download card
 */
export interface FileContent {
  type: "file"
  filename: string
  url: string
  mimeType: string
  size: number // bytes
  description?: string
}

/**
 * Rating request
 */
export interface RatingContent {
  type: "rating"
  title?: string
  message?: string
  maxRating: number
  callbackId: string
  ratingType?: "stars" | "thumbs" | "emoji"
}

// Union of all rich content types
export type RichContent =
  | QuickRepliesContent
  | CardContent
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

// ============================================================================
// CONVEX VALIDATORS
// ============================================================================

export const buttonActionValidator = v.union(
  v.object({
    type: v.literal("reply"),
    text: v.string(),
  }),
  v.object({
    type: v.literal("url"),
    url: v.string(),
    openInNewTab: v.optional(v.boolean()),
  }),
  v.object({
    type: v.literal("callback"),
    callbackId: v.string(),
    data: v.optional(v.any()),
  }),
)

export const richButtonValidator = v.object({
  id: v.string(),
  label: v.string(),
  icon: v.optional(v.string()),
  variant: v.optional(
    v.union(
      v.literal("default"),
      v.literal("secondary"),
      v.literal("outline"),
      v.literal("ghost"),
    ),
  ),
  action: buttonActionValidator,
})

export const richContentTypeValidator = v.union(
  v.literal("quick_replies"),
  v.literal("card"),
  v.literal("carousel"),
  v.literal("list"),
  v.literal("image"),
  v.literal("video"),
  v.literal("link_preview"),
  v.literal("form"),
  v.literal("confirmation"),
  v.literal("status"),
  v.literal("file"),
  v.literal("rating"),
)

// ============================================================================
// PARSING AND SERIALIZATION
// ============================================================================

const RICH_CONTENT_PREFIX = "<!--RICH:"
const RICH_CONTENT_SUFFIX = "-->"
const RICH_CONTENT_REGEX = /<!--RICH:([\s\S]*?)-->/g

/**
 * Serialize rich content to embeddable format
 */
export function serializeRichContent(content: RichContent): string {
  return `${RICH_CONTENT_PREFIX}${JSON.stringify(content)}${RICH_CONTENT_SUFFIX}`
}

/**
 * Parse rich content from message text
 * Returns array of { isRich: boolean; content: string | RichContent }
 */
export interface MessagePart {
  isRich: boolean
  content: string | RichContent
}

export function parseMessageContent(text: string): MessagePart[] {
  const parts: MessagePart[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  // Reset regex state
  RICH_CONTENT_REGEX.lastIndex = 0

  while ((match = RICH_CONTENT_REGEX.exec(text)) !== null) {
    // Add text before this match
    if (match.index > lastIndex) {
      const textPart = text.slice(lastIndex, match.index).trim()
      if (textPart) {
        parts.push({ isRich: false, content: textPart })
      }
    }

    // Try to parse the rich content
    try {
      const jsonStr = match[1]
      if (jsonStr) {
        const richContent = JSON.parse(jsonStr) as RichContent
        parts.push({ isRich: true, content: richContent })
      }
    } catch {
      // If parsing fails, treat as regular text
      parts.push({ isRich: false, content: match[0] })
    }

    lastIndex = match.index + match[0].length
  }

  // Add remaining text after last match
  if (lastIndex < text.length) {
    const remaining = text.slice(lastIndex).trim()
    if (remaining) {
      parts.push({ isRich: false, content: remaining })
    }
  }

  // If no parts found, return original text
  if (parts.length === 0 && text.trim()) {
    parts.push({ isRich: false, content: text })
  }

  return parts
}

/**
 * Check if a message contains rich content
 */
export function hasRichContent(text: string): boolean {
  return text.includes(RICH_CONTENT_PREFIX)
}

/**
 * Extract only the plain text portions from a message
 */
export function extractPlainText(text: string): string {
  return text.replace(RICH_CONTENT_REGEX, "").trim()
}

// ============================================================================
// HELPER FUNCTIONS TO CREATE RICH MESSAGES
// ============================================================================

/**
 * Create a message with quick reply buttons
 */
export function createQuickReplies(
  buttons: Array<{ label: string; replyText?: string }>,
  text?: string,
): string {
  const content: QuickRepliesContent = {
    type: "quick_replies",
    text,
    buttons: buttons.map((btn, i) => ({
      id: `qr-${i}`,
      label: btn.label,
      action: { type: "reply", text: btn.replyText || btn.label },
    })),
  }
  return text
    ? `${text}\n\n${serializeRichContent(content)}`
    : serializeRichContent(content)
}

/**
 * Create a rich card message
 */
export function createCard(options: {
  title: string
  description?: string
  imageUrl?: string
  buttons?: Array<{ label: string; url?: string; replyText?: string }>
  metadata?: Array<{ label: string; value: string }>
}): string {
  const content: CardContent = {
    type: "card",
    title: options.title,
    description: options.description,
    imageUrl: options.imageUrl,
    metadata: options.metadata,
    buttons: options.buttons?.map((btn, i) => ({
      id: `card-btn-${i}`,
      label: btn.label,
      action: btn.url
        ? { type: "url", url: btn.url, openInNewTab: true }
        : { type: "reply", text: btn.replyText || btn.label },
    })),
  }
  return serializeRichContent(content)
}

/**
 * Create a carousel of cards
 */
export function createCarousel(
  cards: Array<{
    title: string
    description?: string
    imageUrl?: string
    buttons?: Array<{ label: string; url?: string; replyText?: string }>
  }>,
  title?: string,
): string {
  const content: CarouselContent = {
    type: "carousel",
    title,
    cards: cards.map((card, cardIndex) => ({
      title: card.title,
      description: card.description,
      imageUrl: card.imageUrl,
      buttons: card.buttons?.map((btn, btnIndex) => ({
        id: `carousel-${cardIndex}-btn-${btnIndex}`,
        label: btn.label,
        action: btn.url
          ? { type: "url", url: btn.url, openInNewTab: true }
          : { type: "reply", text: btn.replyText || btn.label },
      })),
    })),
  }
  return serializeRichContent(content)
}

/**
 * Create a list message
 */
export function createList(
  items: Array<{
    title: string
    subtitle?: string
    description?: string
    imageUrl?: string
    icon?: string
  }>,
  title?: string,
): string {
  const content: ListContent = {
    type: "list",
    title,
    items: items.map((item, i) => ({
      id: `list-item-${i}`,
      ...item,
    })),
    showDividers: true,
  }
  return serializeRichContent(content)
}

/**
 * Create a status/progress message
 */
export function createStatus(options: {
  title: string
  status: "pending" | "in_progress" | "completed" | "failed"
  message?: string
  progress?: number
  steps?: Array<{ label: string; done: boolean }>
}): string {
  const content: StatusContent = {
    type: "status",
    title: options.title,
    status: options.status,
    message: options.message,
    progress: options.progress,
    steps: options.steps?.map((step) => ({
      label: step.label,
      status: step.done ? "completed" : "pending",
    })),
  }
  return serializeRichContent(content)
}

/**
 * Create a rating request message
 */
export function createRatingRequest(options: {
  title?: string
  message?: string
  maxRating?: number
  callbackId: string
  ratingType?: "stars" | "thumbs" | "emoji"
}): string {
  const content: RatingContent = {
    type: "rating",
    title: options.title,
    message: options.message,
    maxRating: options.maxRating || 5,
    callbackId: options.callbackId,
    ratingType: options.ratingType || "stars",
  }
  return serializeRichContent(content)
}

/**
 * Create a file download card
 */
export function createFileCard(options: {
  filename: string
  url: string
  mimeType: string
  size: number
  description?: string
}): string {
  const content: FileContent = {
    type: "file",
    ...options,
  }
  return serializeRichContent(content)
}

/**
 * Create a link preview
 */
export function createLinkPreview(options: {
  url: string
  title?: string
  description?: string
  imageUrl?: string
  siteName?: string
}): string {
  const content: LinkPreviewContent = {
    type: "link_preview",
    ...options,
  }
  return serializeRichContent(content)
}
