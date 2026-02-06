import { components, internal } from "../_generated/api"
import { action, mutation, query } from "../_generated/server"
import { ConvexError, v } from "convex/values"
import { supportAgent } from "../system/ai/agents/supportAgent"
import { paginationOptsValidator } from "convex/server"
import { saveMessage } from "@convex-dev/agent"
import { generateText } from "ai"
import { google } from "@ai-sdk/google"
import { OPERATOR_MESSAGE_ENHANCEMENT_PROMPT } from "../system/ai/constants"

export const enhanceResponse = action({
  args: {
    prompt: v.string(),
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

    const subscriptions = await ctx.runQuery(
      internal.system.subscriptions.getByOrganizationId,
      {
        organizationId: orgId,
      },
    )

    if (subscriptions?.status !== "active") {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Organization does not have an active subscription",
      })
    }

    const response = await generateText({
      model: google("gemini-2.5-flash"),
      messages: [
        {
          role: "system",
          content: OPERATOR_MESSAGE_ENHANCEMENT_PROMPT,
        },
        {
          role: "user",
          content: args.prompt,
        },
      ],
    })
    return response.text
  },
})

export const create = mutation({
  args: {
    prompt: v.string(),
    conversationId: v.id("conversations"),
    attachmentIds: v.optional(v.array(v.id("attachments"))),
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
        message: "Conversation not found",
        code: "INVALID_CONVERSATION",
      })
    }

    if (conversation.organizationId !== orgId) {
      throw new ConvexError({
        message: "User not authorized to access this conversation",
        code: "UNAUTHORIZED",
      })
    }

    if (conversation.status === "resolved") {
      throw new ConvexError({
        message: "Conversation already resolved",
        code: "CONVERSATION_RESOLVED",
      })
    }

    if (conversation.status === "unresolved") {
      await ctx.db.patch(args.conversationId, { status: "escalated" })
    }

    // Generate a messageId for attachment linking
    const messageId = `operator-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

    // Link attachments to this message if any
    if (args.attachmentIds && args.attachmentIds.length > 0) {
      for (const attachmentId of args.attachmentIds) {
        const attachment = await ctx.db.get(attachmentId)
        if (attachment && attachment.organizationId === orgId) {
          await ctx.db.patch(attachmentId, { messageId })
        }
      }
    }

    await saveMessage(ctx, components.agent, {
      threadId: conversation.threadId,
      agentName: identity.familyName,
      message: {
        role: "assistant",
        content: args.prompt,
      },
    })
  },
})

export const getMany = query({
  args: {
    threadId: v.string(),
    paginationOpts: paginationOptsValidator,
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

    const conversation = await ctx.db
      .query("conversations")
      .withIndex("by_thread_id", (q) => q.eq("threadId", args.threadId))
      .unique()

    if (!conversation) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Conversation not found",
      })
    }

    if (conversation.organizationId !== orgId) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "User not authorized to access this conversation",
      })
    }

    const paginated = await supportAgent.listMessages(ctx, {
      threadId: args.threadId,
      paginationOpts: args.paginationOpts,
    })

    return paginated
  },
})
