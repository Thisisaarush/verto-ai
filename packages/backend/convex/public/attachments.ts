import { action, mutation, query, internalMutation } from "../_generated/server"
import { ConvexError, v } from "convex/values"
import { internal } from "../_generated/api"
import {
  ALLOWED_ATTACHMENT_TYPES,
  INPUT_CONSTRAINTS,
  type AllowedMimeType,
} from "../schema"
import { enforceRateLimit, getIdentifier, RATE_LIMITS } from "../lib/rateLimit"

// Internal mutation to link attachments (called from actions)
export const linkToMessageInternal = internalMutation({
  args: {
    attachmentIds: v.array(v.id("attachments")),
    messageId: v.string(),
    contactSessionId: v.id("contactSessions"),
  },
  handler: async (ctx, args) => {
    for (const attachmentId of args.attachmentIds) {
      const attachment = await ctx.db.get(attachmentId)
      if (attachment && attachment.contactSessionId === args.contactSessionId) {
        await ctx.db.patch(attachmentId, { messageId: args.messageId })
      }
    }
    return { success: true }
  },
})

// Validate file type and size
function validateAttachment(
  filename: string,
  mimeType: string,
  size: number,
): { valid: boolean; error?: string } {
  // Check if mime type is allowed
  const allowedType = ALLOWED_ATTACHMENT_TYPES[mimeType as AllowedMimeType]
  if (!allowedType) {
    const allowedTypes = Object.keys(ALLOWED_ATTACHMENT_TYPES)
      .map((t) => t.split("/")[1])
      .join(", ")
    return {
      valid: false,
      error: `File type not allowed. Allowed types: ${allowedTypes}`,
    }
  }

  // Check file extension matches mime type
  const ext = filename.toLowerCase().slice(filename.lastIndexOf("."))
  if (!(allowedType.ext as readonly string[]).includes(ext)) {
    return {
      valid: false,
      error: `File extension does not match type. Expected: ${allowedType.ext.join(" or ")}`,
    }
  }

  // Check size
  if (size > allowedType.maxSize) {
    const maxMB = Math.round(allowedType.maxSize / (1024 * 1024))
    return {
      valid: false,
      error: `File too large. Maximum size for ${mimeType}: ${maxMB}MB`,
    }
  }

  // General size limit
  if (size > INPUT_CONSTRAINTS.ATTACHMENT_MAX_SIZE_BYTES) {
    return {
      valid: false,
      error: `File too large. Maximum size: ${INPUT_CONSTRAINTS.ATTACHMENT_MAX_SIZE_BYTES / (1024 * 1024)}MB`,
    }
  }

  return { valid: true }
}

// Basic content type validation by checking magic bytes
function validateMagicBytes(bytes: ArrayBuffer, mimeType: string): boolean {
  const arr = new Uint8Array(bytes.slice(0, 12))

  // JPEG: FF D8 FF
  if (mimeType === "image/jpeg") {
    return arr[0] === 0xff && arr[1] === 0xd8 && arr[2] === 0xff
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (mimeType === "image/png") {
    return (
      arr[0] === 0x89 && arr[1] === 0x50 && arr[2] === 0x4e && arr[3] === 0x47
    )
  }

  // GIF: 47 49 46 38
  if (mimeType === "image/gif") {
    return (
      arr[0] === 0x47 && arr[1] === 0x49 && arr[2] === 0x46 && arr[3] === 0x38
    )
  }

  // WebP: 52 49 46 46 ... 57 45 42 50
  if (mimeType === "image/webp") {
    return (
      arr[0] === 0x52 &&
      arr[1] === 0x49 &&
      arr[2] === 0x46 &&
      arr[3] === 0x46 &&
      arr[8] === 0x57 &&
      arr[9] === 0x45 &&
      arr[10] === 0x42 &&
      arr[11] === 0x50
    )
  }

  // PDF: 25 50 44 46 (%PDF)
  if (mimeType === "application/pdf") {
    return (
      arr[0] === 0x25 && arr[1] === 0x50 && arr[2] === 0x44 && arr[3] === 0x46
    )
  }

  // Text files - allow any (will be sanitized on display)
  if (mimeType === "text/plain" || mimeType === "text/csv") {
    return true
  }

  return false
}

// Generate upload URL for client-side upload
export const generateUploadUrl = mutation({
  args: {
    contactSessionId: v.id("contactSessions"),
    conversationId: v.id("conversations"),
    filename: v.string(),
    mimeType: v.string(),
    size: v.number(),
  },
  handler: async (ctx, args) => {
    // Rate limit
    enforceRateLimit(
      getIdentifier("attachmentUpload", args.contactSessionId),
      { maxRequests: 10, windowMs: 60 * 1000 }, // 10 uploads per minute
    )

    // Validate contact session
    const contactSession = await ctx.db.get(args.contactSessionId)
    if (
      !contactSession ||
      (contactSession.expiresAt && contactSession.expiresAt < Date.now())
    ) {
      throw new ConvexError({
        code: "INVALID_SESSION",
        message: "Invalid or expired session",
      })
    }

    // Validate conversation belongs to session
    const conversation = await ctx.db.get(args.conversationId)
    if (
      !conversation ||
      conversation.contactSessionId !== args.contactSessionId
    ) {
      throw new ConvexError({
        code: "INVALID_CONVERSATION",
        message: "Invalid conversation",
      })
    }

    // Check conversation is not resolved
    if (conversation.status === "resolved") {
      throw new ConvexError({
        code: "CONVERSATION_CLOSED",
        message: "Cannot upload to a resolved conversation",
      })
    }

    // Validate file
    const validation = validateAttachment(
      args.filename,
      args.mimeType,
      args.size,
    )
    if (!validation.valid) {
      throw new ConvexError({
        code: "INVALID_FILE",
        message: validation.error!,
      })
    }

    // Check attachment count limit
    const existingAttachments = await ctx.db
      .query("attachments")
      .withIndex("by_conversation_id", (q) =>
        q.eq("conversationId", args.conversationId),
      )
      .collect()

    if (existingAttachments.length >= 50) {
      // Max 50 attachments per conversation
      throw new ConvexError({
        code: "LIMIT_EXCEEDED",
        message: "Maximum attachments per conversation reached",
      })
    }

    // Generate upload URL
    return await ctx.storage.generateUploadUrl()
  },
})

// Complete upload after file is uploaded to storage
export const completeUpload = mutation({
  args: {
    storageId: v.id("_storage"),
    contactSessionId: v.id("contactSessions"),
    conversationId: v.id("conversations"),
    filename: v.string(),
    mimeType: v.string(),
    size: v.number(),
  },
  handler: async (ctx, args) => {
    // Validate contact session
    const contactSession = await ctx.db.get(args.contactSessionId)
    if (
      !contactSession ||
      (contactSession.expiresAt && contactSession.expiresAt < Date.now())
    ) {
      // Clean up uploaded file
      await ctx.storage.delete(args.storageId)
      throw new ConvexError({
        code: "INVALID_SESSION",
        message: "Invalid or expired session",
      })
    }

    // Validate conversation
    const conversation = await ctx.db.get(args.conversationId)
    if (
      !conversation ||
      conversation.contactSessionId !== args.contactSessionId
    ) {
      await ctx.storage.delete(args.storageId)
      throw new ConvexError({
        code: "INVALID_CONVERSATION",
        message: "Invalid conversation",
      })
    }

    // Get the URL
    const url = await ctx.storage.getUrl(args.storageId)

    // Create attachment record
    const attachmentId = await ctx.db.insert("attachments", {
      storageId: args.storageId,
      conversationId: args.conversationId,
      organizationId: conversation.organizationId,
      contactSessionId: args.contactSessionId,
      uploadedBy: "user",
      filename: args.filename,
      mimeType: args.mimeType,
      size: args.size,
      url: url ?? undefined,
      createdAt: Date.now(),
      scanStatus: "pending",
    })

    return {
      id: attachmentId,
      url,
      filename: args.filename,
    }
  },
})

// Link attachments to a messageId after message creation
export const linkToMessage = mutation({
  args: {
    attachmentIds: v.array(v.id("attachments")),
    messageId: v.string(),
    contactSessionId: v.id("contactSessions"),
  },
  handler: async (ctx, args) => {
    // Validate contact session
    const contactSession = await ctx.db.get(args.contactSessionId)
    if (
      !contactSession ||
      (contactSession.expiresAt && contactSession.expiresAt < Date.now())
    ) {
      throw new ConvexError({
        code: "INVALID_SESSION",
        message: "Invalid or expired session",
      })
    }

    // Link each attachment
    for (const attachmentId of args.attachmentIds) {
      const attachment = await ctx.db.get(attachmentId)
      if (attachment && attachment.contactSessionId === args.contactSessionId) {
        await ctx.db.patch(attachmentId, { messageId: args.messageId })
      }
    }

    return { success: true }
  },
})

// Get attachments by messageId
export const getByMessageId = query({
  args: {
    messageId: v.string(),
    contactSessionId: v.id("contactSessions"),
  },
  handler: async (ctx, args) => {
    const contactSession = await ctx.db.get(args.contactSessionId)
    if (
      !contactSession ||
      (contactSession.expiresAt && contactSession.expiresAt < Date.now())
    ) {
      return []
    }

    const attachments = await ctx.db
      .query("attachments")
      .withIndex("by_message_id", (q) => q.eq("messageId", args.messageId))
      .collect()

    return attachments
      .filter((a) => a.scanStatus !== "flagged")
      .map((a) => ({
        id: a._id,
        filename: a.filename,
        mimeType: a.mimeType,
        size: a.size,
        url: a.url,
        uploadedBy: a.uploadedBy,
        createdAt: a.createdAt,
      }))
  },
})

// Get attachments for a conversation (user side)
export const getByConversation = query({
  args: {
    conversationId: v.id("conversations"),
    contactSessionId: v.id("contactSessions"),
  },
  handler: async (ctx, args) => {
    // Validate conversation belongs to session
    const conversation = await ctx.db.get(args.conversationId)
    if (
      !conversation ||
      conversation.contactSessionId !== args.contactSessionId
    ) {
      return []
    }

    const attachments = await ctx.db
      .query("attachments")
      .withIndex("by_conversation_id", (q) =>
        q.eq("conversationId", args.conversationId),
      )
      .collect()

    // Filter out flagged attachments
    return attachments
      .filter((a) => a.scanStatus !== "flagged")
      .map((a) => ({
        id: a._id,
        filename: a.filename,
        mimeType: a.mimeType,
        size: a.size,
        url: a.url,
        uploadedBy: a.uploadedBy,
        createdAt: a.createdAt,
      }))
  },
})
