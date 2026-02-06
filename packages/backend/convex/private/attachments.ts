import { action, mutation, query, internalMutation } from "../_generated/server"
import { ConvexError, v } from "convex/values"
import { internal } from "../_generated/api"
import {
  ALLOWED_ATTACHMENT_TYPES,
  INPUT_CONSTRAINTS,
  type AllowedMimeType,
} from "../schema"

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
      error: `File extension does not match type`,
    }
  }

  // Check size
  if (size > allowedType.maxSize) {
    const maxMB = Math.round(allowedType.maxSize / (1024 * 1024))
    return {
      valid: false,
      error: `File too large. Maximum: ${maxMB}MB`,
    }
  }

  return { valid: true }
}

// Generate upload URL for operator upload
export const generateUploadUrl = mutation({
  args: {
    conversationId: v.id("conversations"),
    filename: v.string(),
    mimeType: v.string(),
    size: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "Not authenticated",
      })
    }

    const orgId = identity.orgId as string
    if (!orgId) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "No organization",
      })
    }

    // Validate conversation belongs to org
    const conversation = await ctx.db.get(args.conversationId)
    if (!conversation || conversation.organizationId !== orgId) {
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

    return await ctx.storage.generateUploadUrl()
  },
})

// Complete upload after file is uploaded
export const completeUpload = mutation({
  args: {
    storageId: v.id("_storage"),
    conversationId: v.id("conversations"),
    filename: v.string(),
    mimeType: v.string(),
    size: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      await ctx.storage.delete(args.storageId)
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "Not authenticated",
      })
    }

    const orgId = identity.orgId as string
    if (!orgId) {
      await ctx.storage.delete(args.storageId)
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "No organization",
      })
    }

    // Validate conversation
    const conversation = await ctx.db.get(args.conversationId)
    if (!conversation || conversation.organizationId !== orgId) {
      await ctx.storage.delete(args.storageId)
      throw new ConvexError({
        code: "INVALID_CONVERSATION",
        message: "Invalid conversation",
      })
    }

    const url = await ctx.storage.getUrl(args.storageId)

    const attachmentId = await ctx.db.insert("attachments", {
      storageId: args.storageId,
      conversationId: args.conversationId,
      organizationId: orgId,
      uploadedBy: "operator",
      filename: args.filename,
      mimeType: args.mimeType,
      size: args.size,
      url: url ?? undefined,
      createdAt: Date.now(),
      scanStatus: "clean", // Operators are trusted
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
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "Not authenticated",
      })
    }

    const orgId = identity.orgId as string
    if (!orgId) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "No organization",
      })
    }

    // Link each attachment
    for (const attachmentId of args.attachmentIds) {
      const attachment = await ctx.db.get(attachmentId)
      if (attachment && attachment.organizationId === orgId) {
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
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      return []
    }

    const orgId = identity.orgId as string
    if (!orgId) {
      return []
    }

    const attachments = await ctx.db
      .query("attachments")
      .withIndex("by_message_id", (q) => q.eq("messageId", args.messageId))
      .collect()

    return attachments
      .filter((a) => a.organizationId === orgId)
      .map((a) => ({
        id: a._id,
        filename: a.filename,
        mimeType: a.mimeType,
        size: a.size,
        url: a.url,
        uploadedBy: a.uploadedBy,
        createdAt: a.createdAt,
        scanStatus: a.scanStatus,
      }))
  },
})

// Get attachments for a conversation (operator side)
export const getByConversation = query({
  args: {
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      return []
    }

    const orgId = identity.orgId as string
    if (!orgId) {
      return []
    }

    const conversation = await ctx.db.get(args.conversationId)
    if (!conversation || conversation.organizationId !== orgId) {
      return []
    }

    const attachments = await ctx.db
      .query("attachments")
      .withIndex("by_conversation_id", (q) =>
        q.eq("conversationId", args.conversationId),
      )
      .collect()

    return attachments.map((a) => ({
      id: a._id,
      filename: a.filename,
      mimeType: a.mimeType,
      size: a.size,
      url: a.url,
      uploadedBy: a.uploadedBy,
      createdAt: a.createdAt,
      scanStatus: a.scanStatus,
    }))
  },
})

// Delete an attachment (operator only)
export const deleteAttachment = mutation({
  args: {
    attachmentId: v.id("attachments"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "Not authenticated",
      })
    }

    const orgId = identity.orgId as string
    if (!orgId) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "No organization",
      })
    }

    const attachment = await ctx.db.get(args.attachmentId)
    if (!attachment || attachment.organizationId !== orgId) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Attachment not found",
      })
    }

    // Delete from storage and database
    await ctx.storage.delete(attachment.storageId)
    await ctx.db.delete(args.attachmentId)

    return { success: true }
  },
})

// Internal: Delete all attachments for a conversation (called when conversation is resolved)
export const deleteAllForConversation = internalMutation({
  args: {
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, args) => {
    const attachments = await ctx.db
      .query("attachments")
      .withIndex("by_conversation_id", (q) =>
        q.eq("conversationId", args.conversationId),
      )
      .collect()

    for (const attachment of attachments) {
      try {
        await ctx.storage.delete(attachment.storageId)
      } catch (e) {
        console.error(
          `Failed to delete storage for attachment ${attachment._id}:`,
          e,
        )
      }
      await ctx.db.delete(attachment._id)
    }

    return { deleted: attachments.length }
  },
})
