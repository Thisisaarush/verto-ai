import { mutation, query } from "../_generated/server"
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
