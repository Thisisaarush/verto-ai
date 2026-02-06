import { action, internalQuery, mutation, query } from "../_generated/server"
import { ConvexError, v } from "convex/values"
import { supportAgent } from "../system/ai/agents/supportAgent"
import { MessageDoc } from "@convex-dev/agent"
import { paginationOptsValidator, PaginationResult } from "convex/server"
import { Doc } from "../_generated/dataModel"
import { api, internal } from "../_generated/api"

export const updateStatus = mutation({
  args: {
    conversationId: v.id("conversations"),
    status: v.union(
      v.literal("unresolved"),
      v.literal("escalated"),
      v.literal("resolved"),
    ),
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

    const conversation = await ctx.db.get(args.conversationId)
    if (!conversation) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Conversation not found",
      })
    }

    if (conversation.organizationId !== orgId) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "User not authorized",
      })
    }

    // Track timestamps for escalation/resolution
    const updates: Partial<Doc<"conversations">> = {
      status: args.status,
    }

    if (args.status === "escalated" && !conversation.escalatedAt) {
      updates.escalatedAt = Date.now()
    }
    if (args.status === "resolved" && !conversation.resolvedAt) {
      updates.resolvedAt = Date.now()
      // Delete all attachments for this conversation
      await ctx.scheduler.runAfter(
        0,
        internal.private.attachments.deleteAllForConversation,
        {
          conversationId: args.conversationId,
        },
      )
    }

    await ctx.db.patch(args.conversationId, updates)

    // Generate AI summary when conversation is resolved or escalated
    if (
      (args.status === "resolved" || args.status === "escalated") &&
      !conversation.summary
    ) {
      await ctx.scheduler.runAfter(
        0,
        internal.system.conversations.generateSummary,
        {
          conversationId: args.conversationId,
          threadId: conversation.threadId,
        },
      )
    }
  },
})

export const updatePriority = mutation({
  args: {
    conversationId: v.id("conversations"),
    priority: v.union(v.literal("low"), v.literal("medium"), v.literal("high")),
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

    const conversation = await ctx.db.get(args.conversationId)
    if (!conversation) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Conversation not found",
      })
    }

    if (conversation.organizationId !== orgId) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "User not authorized",
      })
    }

    await ctx.db.patch(args.conversationId, {
      priority: args.priority,
    })
  },
})

// Mark conversation as read by operator
export const markAsRead = mutation({
  args: {
    conversationId: v.id("conversations"),
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

    const conversation = await ctx.db.get(args.conversationId)
    if (!conversation) {
      return // Silently fail for non-existent conversations
    }

    if (conversation.organizationId !== orgId) {
      return // Silently fail for unauthorized
    }

    await ctx.db.patch(args.conversationId, {
      lastReadAt: Date.now(),
    })
  },
})

// Internal query for search - fetches recent conversations for an org
export const getManyInternal = internalQuery({
  args: {
    organizationId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 50
    const conversations = await ctx.db
      .query("conversations")
      .withIndex("by_organization_id", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .order("desc")
      .take(limit)

    return conversations
  },
})

export const getOne = query({
  args: {
    conversationId: v.id("conversations"),
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

    const conversation = await ctx.db.get(args.conversationId)
    if (!conversation) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Conversation not found",
      })
    }

    if (conversation.organizationId !== orgId) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "User not authorized",
      })
    }

    const contactSession = await ctx.db.get(conversation.contactSessionId)
    if (!contactSession) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Contact session not found",
      })
    }

    return {
      ...conversation,
      contactSession,
    }
  },
})

export const getMany = query({
  args: {
    paginationOpts: paginationOptsValidator,
    status: v.optional(
      v.union(
        v.literal("unresolved"),
        v.literal("escalated"),
        v.literal("resolved"),
      ),
    ),
    priority: v.optional(
      v.union(v.literal("low"), v.literal("medium"), v.literal("high")),
    ),
    sentiment: v.optional(
      v.union(
        v.literal("positive"),
        v.literal("neutral"),
        v.literal("negative"),
      ),
    ),
    tag: v.optional(v.string()),
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

    let conversations: PaginationResult<Doc<"conversations">>

    if (args.status) {
      conversations = await ctx.db
        .query("conversations")
        .withIndex("by_status_and_organization_id", (q) =>
          q
            .eq("status", args.status as Doc<"conversations">["status"])
            .eq("organizationId", orgId),
        )
        .order("desc")
        .paginate(args.paginationOpts)
    } else {
      conversations = await ctx.db
        .query("conversations")
        .withIndex("by_organization_id", (q) => q.eq("organizationId", orgId))
        .order("desc")
        .paginate(args.paginationOpts)
    }

    // Apply priority filter in-memory (Convex doesn't support multiple index filters)
    let filteredPage = conversations.page
    if (args.priority) {
      filteredPage = filteredPage.filter(
        (conv) => conv.priority === args.priority,
      )
    }

    // Apply sentiment filter in-memory
    if (args.sentiment) {
      filteredPage = filteredPage.filter(
        (conv) => conv.sentiment === args.sentiment,
      )
    }

    // Apply tag filter in-memory
    if (args.tag) {
      filteredPage = filteredPage.filter((conv) =>
        conv.tags?.includes(args.tag as string),
      )
    }

    // Update conversations object with filtered page
    conversations = {
      ...conversations,
      page: filteredPage,
    }

    const conversationsWithAdditionalData = await Promise.all(
      conversations.page.map(async (conversation) => {
        let lastMessage: MessageDoc | null = null
        const contactSession = await ctx.db.get(conversation.contactSessionId)

        if (!contactSession) return null

        const messages = await supportAgent.listMessages(ctx, {
          threadId: conversation?.threadId,
          paginationOpts: { numItems: 1, cursor: null },
        })

        if (messages.page.length > 0) {
          lastMessage = messages.page[0] ?? null
        }

        return {
          ...conversation,
          lastMessage,
          contactSession,
        }
      }),
    )

    const validConversations = conversationsWithAdditionalData.filter(
      (conv): conv is NonNullable<typeof conv> => conv !== null,
    )

    return {
      ...conversations,
      page: validConversations,
    }
  },
})

// Get AI-suggested replies for a conversation
export const getSuggestedReplies = action({
  args: {
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, args): Promise<string[]> => {
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

    // Get conversation to verify access and get threadId
    const conversation = await ctx.runQuery(api.private.conversations.getOne, {
      conversationId: args.conversationId,
    })

    if (!conversation) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Conversation not found",
      })
    }

    // Skip for resolved conversations
    if (conversation.status === "resolved") {
      return []
    }

    // Generate suggested replies using the internal action
    const suggestions = await ctx.runAction(
      internal.system.conversations.generateSuggestedReplies,
      {
        conversationId: args.conversationId,
        threadId: conversation.threadId,
        organizationId: orgId,
      },
    )

    return suggestions
  },
})

// Search conversations by message content
export const searchConversations = action({
  args: {
    query: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<
    Array<{
      conversation: Doc<"conversations">
      contactSession: Doc<"contactSessions">
      matchingMessages: Array<{
        _id: string
        text: string | null
        role: "user" | "assistant"
        _creationTime: number
      }>
    }>
  > => {
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

    const searchQuery = args.query.trim().toLowerCase()
    if (!searchQuery || searchQuery.length < 3) {
      return []
    }

    // Get recent conversations for this org (limit to 50 for performance)
    const conversations = await ctx.runQuery(
      internal.private.conversations.getManyInternal,
      { organizationId: orgId, limit: 50 },
    )

    if (!conversations || conversations.length === 0) {
      return []
    }

    const results: Array<{
      conversation: Doc<"conversations">
      contactSession: Doc<"contactSessions">
      matchingMessages: Array<{
        _id: string
        text: string | null
        role: "user" | "assistant"
        _creationTime: number
      }>
    }> = []

    const limit = args.limit || 20

    // Search through each conversation's messages
    for (const conv of conversations) {
      if (results.length >= limit) break

      // Get messages for this conversation's thread
      const messages = await ctx.runQuery(
        internal.private.messages.getAllForThread,
        { threadId: conv.threadId },
      )

      if (!messages || messages.length === 0) continue

      // Find matching messages
      const matchingMessages: Array<{
        _id: string
        text: string | null
        role: "user" | "assistant"
        _creationTime: number
      }> = []

      for (const msg of messages) {
        // Extract text content from the message
        let text: string | null = null
        if (typeof msg.message?.content === "string") {
          text = msg.message.content
        } else if (Array.isArray(msg.message?.content)) {
          const textParts = (
            msg.message.content as Array<{ type: string; text?: string }>
          )
            .filter((part) => part.type === "text" && part.text)
            .map((part) => part.text!)
          text = textParts.join(" ")
        }

        // Check if message contains the search query
        if (text && text.toLowerCase().includes(searchQuery)) {
          const role =
            msg.message?.role === "user" ? "user" : ("assistant" as const)
          matchingMessages.push({
            _id: msg._id,
            text,
            role,
            _creationTime: msg._creationTime,
          })
        }

        // Limit to 3 matching messages per conversation
        if (matchingMessages.length >= 3) break
      }

      // Only include conversations with matching messages
      if (matchingMessages.length > 0) {
        // Get contact session
        const contactSession = await ctx.runQuery(
          internal.system.contactSessions.getOne,
          { contactSessionId: conv.contactSessionId },
        )

        if (contactSession) {
          results.push({
            conversation: conv,
            contactSession,
            matchingMessages,
          })
        }
      }
    }

    return results
  },
})
