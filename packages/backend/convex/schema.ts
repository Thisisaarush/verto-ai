import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"

// Input validation constraints
export const INPUT_CONSTRAINTS = {
  MESSAGE_MAX_LENGTH: 4000,
  NAME_MAX_LENGTH: 100,
  EMAIL_MAX_LENGTH: 255,
  PHONE_MAX_LENGTH: 20,
  TAG_NAME_MAX_LENGTH: 50,
  CANNED_RESPONSE_MAX_LENGTH: 2000,
  // Attachment constraints
  ATTACHMENT_MAX_SIZE_BYTES: 10 * 1024 * 1024, // 10MB
  ATTACHMENT_MAX_PER_MESSAGE: 5,
} as const

// Allowed file types for attachments
export const ALLOWED_ATTACHMENT_TYPES = {
  // Images
  "image/jpeg": { ext: [".jpg", ".jpeg"], maxSize: 10 * 1024 * 1024 },
  "image/png": { ext: [".png"], maxSize: 10 * 1024 * 1024 },
  "image/gif": { ext: [".gif"], maxSize: 5 * 1024 * 1024 },
  "image/webp": { ext: [".webp"], maxSize: 10 * 1024 * 1024 },
  // Documents
  "application/pdf": { ext: [".pdf"], maxSize: 10 * 1024 * 1024 },
  "text/plain": { ext: [".txt"], maxSize: 1 * 1024 * 1024 },
  // Spreadsheets
  "text/csv": { ext: [".csv"], maxSize: 5 * 1024 * 1024 },
} as const

export type AllowedMimeType = keyof typeof ALLOWED_ATTACHMENT_TYPES

// Conversation status enum
export const conversationStatusValidator = v.union(
  v.literal("unresolved"),
  v.literal("escalated"),
  v.literal("resolved"),
)

// Message status enum
export const messageStatusValidator = v.union(
  v.literal("sending"),
  v.literal("sent"),
  v.literal("delivered"),
  v.literal("failed"),
)

export default defineSchema({
  subscriptions: defineTable({
    organizationId: v.string(),
    status: v.string(),
  }).index("by_organization_id", ["organizationId"]),

  widgetSettings: defineTable({
    organizationId: v.string(),
    greetMessage: v.string(),
    defaultSuggestions: v.object({
      suggestion1: v.optional(v.string()),
      suggestion2: v.optional(v.string()),
      suggestion3: v.optional(v.string()),
    }),
    // New: widget customization
    primaryColor: v.optional(v.string()),
    position: v.optional(
      v.union(v.literal("bottom-right"), v.literal("bottom-left")),
    ),
    language: v.optional(v.string()),
  }).index("by_organization_id", ["organizationId"]),

  conversations: defineTable({
    threadId: v.string(),
    organizationId: v.string(),
    contactSessionId: v.id("contactSessions"),
    status: conversationStatusValidator,
    // New: conversation enhancements
    tags: v.optional(v.array(v.string())),
    priority: v.optional(
      v.union(v.literal("low"), v.literal("medium"), v.literal("high")),
    ),
    assignedTo: v.optional(v.string()),
    escalatedAt: v.optional(v.number()),
    resolvedAt: v.optional(v.number()),
    sentiment: v.optional(
      v.union(
        v.literal("positive"),
        v.literal("neutral"),
        v.literal("negative"),
      ),
    ),
  })
    .index("by_organization_id", ["organizationId"])
    .index("by_contact_session_id", ["contactSessionId"])
    .index("by_thread_id", ["threadId"])
    .index("by_status_and_organization_id", ["status", "organizationId"])
    .index("by_priority_and_organization_id", ["priority", "organizationId"]),

  contactSessions: defineTable({
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    organizationId: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
    metadata: v.optional(
      v.object({
        userAgent: v.optional(v.string()),
        language: v.optional(v.string()),
        languages: v.optional(v.string()),
        platform: v.optional(v.string()),
        vendor: v.optional(v.string()),
        screenResolution: v.optional(v.string()),
        viewportSize: v.optional(v.string()),
        timezone: v.optional(v.string()),
        timezoneOffset: v.optional(v.number()),
        cookieEnabled: v.optional(v.boolean()),
        referrer: v.optional(v.string()),
        currentUrl: v.optional(v.string()),
      }),
    ),
  })
    .index("by_expires_at", ["expiresAt"])
    .index("by_organization_id", ["organizationId"]),

  users: defineTable({
    name: v.optional(v.string()),
  }),

  // New: Conversation tags/labels
  conversationTags: defineTable({
    organizationId: v.string(),
    name: v.string(),
    color: v.string(),
    description: v.optional(v.string()),
  })
    .index("by_organization_id", ["organizationId"])
    .index("by_name_and_organization_id", ["name", "organizationId"]),

  // New: Canned responses/templates
  cannedResponses: defineTable({
    organizationId: v.string(),
    title: v.string(),
    content: v.string(),
    shortcut: v.optional(v.string()),
    category: v.optional(v.string()),
    usageCount: v.number(),
  })
    .index("by_organization_id", ["organizationId"])
    .index("by_shortcut_and_organization_id", ["shortcut", "organizationId"]),

  // New: Analytics events
  analyticsEvents: defineTable({
    organizationId: v.string(),
    eventType: v.string(),
    eventData: v.any(),
    timestamp: v.number(),
    sessionId: v.optional(v.id("contactSessions")),
    conversationId: v.optional(v.id("conversations")),
  })
    .index("by_organization_id", ["organizationId"])
    .index("by_type_and_organization_id", ["eventType", "organizationId"])
    .index("by_timestamp", ["timestamp"]),

  // New: Email notifications queue
  emailNotifications: defineTable({
    organizationId: v.string(),
    type: v.string(),
    to: v.string(),
    subject: v.string(),
    body: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("sent"),
      v.literal("failed"),
    ),
    conversationId: v.optional(v.id("conversations")),
    sentAt: v.optional(v.number()),
    error: v.optional(v.string()),
  })
    .index("by_status", ["status"])
    .index("by_organization_id", ["organizationId"]),

  // New: Translations for multi-language support
  translations: defineTable({
    organizationId: v.string(),
    locale: v.string(),
    key: v.string(),
    value: v.string(),
  })
    .index("by_organization_and_locale", ["organizationId", "locale"])
    .index("by_key_and_locale", ["key", "locale", "organizationId"]),

  // New: RAG cache for performance
  ragCache: defineTable({
    organizationId: v.string(),
    queryHash: v.string(),
    results: v.any(),
    expiresAt: v.number(),
  })
    .index("by_query_hash", ["queryHash", "organizationId"])
    .index("by_expires_at", ["expiresAt"]),

  // New: Typing indicators for real-time feedback
  typingIndicators: defineTable({
    conversationId: v.id("conversations"),
    participantId: v.string(), // contactSessionId or "ai" or "operator"
    participantType: v.union(
      v.literal("user"),
      v.literal("ai"),
      v.literal("operator"),
    ),
    isTyping: v.boolean(),
    lastUpdated: v.number(),
  })
    .index("by_conversation_id", ["conversationId"])

    .index("by_participant", ["conversationId", "participantId"]),

  // AI Model Settings for organizations
  aiModelSettings: defineTable({
    organizationId: v.string(),
    provider: v.union(
      v.literal("google"),
      v.literal("openai"),
      v.literal("anthropic"),
      v.literal("platform"),
    ),
    model: v.string(),
    apiKey: v.optional(v.string()), // Encrypted API key
    isActive: v.boolean(),
    freeRequestsUsed: v.number(),
    freeRequestsLimit: v.number(),
    lastUsedAt: v.optional(v.number()),
  }).index("by_organization_id", ["organizationId"]),

  // Chat attachments (files attached to messages)
  attachments: defineTable({
    storageId: v.id("_storage"),
    conversationId: v.id("conversations"),
    organizationId: v.string(),
    contactSessionId: v.optional(v.id("contactSessions")), // If uploaded by user
    messageId: v.optional(v.string()), // Links to agent message ID
    uploadedBy: v.union(v.literal("user"), v.literal("operator")),
    filename: v.string(),
    mimeType: v.string(),
    size: v.number(), // bytes
    url: v.optional(v.string()), // Cached URL
    createdAt: v.number(),
    // For abuse prevention
    uploadIp: v.optional(v.string()),
    scanStatus: v.optional(
      v.union(v.literal("pending"), v.literal("clean"), v.literal("flagged")),
    ),
  })
    .index("by_conversation_id", ["conversationId"])
    .index("by_organization_id", ["organizationId"])
    .index("by_storage_id", ["storageId"])
    .index("by_message_id", ["messageId"]),
})
