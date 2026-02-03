import { mutation, query } from "../_generated/server"
import { ConvexError, v } from "convex/values"
import { supportAgent } from "../system/ai/agents/supportAgent"
import { MessageDoc, saveMessage } from "@convex-dev/agent"
import { components, internal } from "../_generated/api"
import { paginationOptsValidator } from "convex/server"
import { logger, createLogContext } from "../lib/logger"
import { enforceRateLimit, getIdentifier, RATE_LIMITS } from "../lib/rateLimit"

export const getMany = query({
  args: {
    contactSessionId: v.id("contactSessions"),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const contactSession = await ctx.db.get(args.contactSessionId)
    if (!contactSession) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Contact session not found",
      })
    }

    const conversations = await ctx.db
      .query("conversations")
      .withIndex("by_contact_session_id", (q) =>
        q.eq("contactSessionId", args.contactSessionId),
      )
      .order("desc")
      .paginate(args.paginationOpts)

    // OPTIMIZATION: Batch fetch last messages for all conversations
    // Instead of N+1 queries, we fetch all thread IDs and query messages in parallel
    const threadIds = conversations.page.map((c) => c.threadId)

    // Parallel fetch of last messages for all threads
    const lastMessagesMap = new Map<string, MessageDoc | null>()

    await Promise.all(
      threadIds.map(async (threadId) => {
        try {
          const messages = await supportAgent.listMessages(ctx, {
            threadId,
            paginationOpts: { numItems: 1, cursor: null },
          })
          lastMessagesMap.set(threadId, messages.page[0] ?? null)
        } catch (error) {
          logger.warn("Failed to fetch last message", {
            conversationId: threadId,
          })
          lastMessagesMap.set(threadId, null)
        }
      }),
    )

    const conversationWithLastMessage = conversations.page.map(
      (conversation) => ({
        _id: conversation._id,
        _creationTime: conversation._creationTime,
        status: conversation.status,
        organizationId: conversation.organizationId,
        threadId: conversation.threadId,
        tags: conversation.tags,
        priority: conversation.priority,
        lastMessage: lastMessagesMap.get(conversation.threadId) ?? null,
      }),
    )

    return {
      ...conversations,
      page: conversationWithLastMessage,
    }
  },
})

export const getOne = query({
  args: {
    conversationId: v.id("conversations"),
    contactSessionId: v.id("contactSessions"),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.contactSessionId)
    if (!session) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Session not found",
      })
    }
    const conversation = await ctx.db.get(args.conversationId)
    if (!conversation) return null

    if (conversation.contactSessionId !== session._id) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "You do not have access to this conversation",
      })
    }

    return {
      _id: conversation._id,
      status: conversation.status,
      threadId: conversation.threadId,
    }
  },
})

export const create = mutation({
  args: {
    organizationId: v.string(),
    contactSessionId: v.id("contactSessions"),
  },
  handler: async (ctx, args) => {
    // Rate limiting
    enforceRateLimit(
      getIdentifier("conversationCreate", args.contactSessionId),
      RATE_LIMITS.conversationCreate,
    )

    const session = await ctx.db.get(args.contactSessionId)

    if (!session || (session.expiresAt && session.expiresAt < Date.now())) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "Invalid or expired session",
      })
    }

    const { threadId } = await supportAgent.createThread(ctx, {
      userId: args.organizationId,
    })

    // Refresh the contact session to extend its validity when they are in threshold
    await ctx.runMutation(internal.system.contactSessions.refresh, {
      contactSessionId: args.contactSessionId,
    })

    const widgetSettings = await ctx.db
      .query("widgetSettings")
      .withIndex("by_organization_id", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .unique()

    await saveMessage(ctx, components.agent, {
      threadId,
      message: {
        content:
          (widgetSettings && widgetSettings?.greetMessage) ||
          "Hello, how can I help you?",
        role: "assistant",
      },
    })

    const conversationId = await ctx.db.insert("conversations", {
      organizationId: args.organizationId,
      contactSessionId: session._id,
      status: "unresolved",
      threadId,
    })
    return conversationId
  },
})
