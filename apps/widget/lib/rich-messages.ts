/**
 * Rich Message Parser - Client-side utility
 *
 * Parses messages for embedded rich content and provides
 * helper functions for handling rich message interactions.
 */

import type { RichContent } from "@workspace/ui/components/ai/rich-content"

// ============================================================================
// CONSTANTS
// ============================================================================

const RICH_CONTENT_PREFIX = "<!--RICH:"
const RICH_CONTENT_SUFFIX = "-->"
const RICH_CONTENT_REGEX = /<!--RICH:([\s\S]*?)-->/g

// ============================================================================
// TYPES
// ============================================================================

export interface MessagePart {
  isRich: boolean
  content: string | RichContent
}

// ============================================================================
// PARSING FUNCTIONS
// ============================================================================

/**
 * Check if a message contains rich content
 */
export function hasRichContent(text: string): boolean {
  return text.includes(RICH_CONTENT_PREFIX)
}

/**
 * Parse rich content from message text
 * Returns array of { isRich: boolean; content: string | RichContent }
 */
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
 * Extract only the plain text portions from a message
 */
export function extractPlainText(text: string): string {
  return text.replace(RICH_CONTENT_REGEX, "").trim()
}

/**
 * Get a preview of the message (plain text only, truncated)
 */
export function getMessagePreview(
  text: string,
  maxLength: number = 100,
): string {
  const plainText = extractPlainText(text)
  if (plainText.length <= maxLength) return plainText
  return plainText.slice(0, maxLength - 3) + "..."
}
