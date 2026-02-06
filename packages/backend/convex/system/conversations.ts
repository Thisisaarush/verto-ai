import { internalAction, internalMutation, internalQuery } from "../_generated/server"
import { ConvexError, v } from "convex/values"
import { supportAgent } from "./ai/agents/supportAgent"
import { CONVERSATION_SUMMARY_PROMPT } from "./ai/constants"
import { google } from "@ai-sdk/google"
import { generateText } from "ai"
import { internal } from "../_generated/api"

export const escalate = internalMutation({
  args: {
    threadId: v.string(),
  },
  handler: async (ctx, args) => {
    const conversation = await ctx.db
      .query("conversations")
      .withIndex("by_thread_id", (q) => q.eq("threadId", args.threadId))
      .unique()

    if (!conversation) {
      throw new ConvexError({
        message: "Conversation not found",
        code: "NOT_FOUND",
      })
    }

    await ctx.db.patch(conversation._id, {
      status: "escalated",
    })

    // Generate AI summary on escalation
    if (!conversation.summary) {
      await ctx.scheduler.runAfter(
        0,
        internal.system.conversations.generateSummary,
        {
          conversationId: conversation._id,
          threadId: args.threadId,
        },
      )
    }
  },
})

export const resolve = internalMutation({
  args: {
    threadId: v.string(),
  },
  handler: async (ctx, args) => {
    const conversation = await ctx.db
      .query("conversations")
      .withIndex("by_thread_id", (q) => q.eq("threadId", args.threadId))
      .unique()

    if (!conversation) {
      throw new ConvexError({
        message: "Conversation not found",
        code: "NOT_FOUND",
      })
    }

    await ctx.db.patch(conversation._id, {
      status: "resolved",
    })

    // Generate AI summary on resolution
    if (!conversation.summary) {
      await ctx.scheduler.runAfter(
        0,
        internal.system.conversations.generateSummary,
        {
          conversationId: conversation._id,
          threadId: args.threadId,
        },
      )
    }
  },
})

export const getByThreadId = internalQuery({
  args: {
    threadId: v.string(),
  },
  handler: async (ctx, args) => {
    const conversation = await ctx.db
      .query("conversations")
      .withIndex("by_thread_id", (q) => q.eq("threadId", args.threadId))
      .unique()
    return conversation
  },
})

// Internal mutation to save a summary to a conversation
export const saveSummary = internalMutation({
  args: {
    conversationId: v.id("conversations"),
    summary: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.conversationId, {
      summary: args.summary,
      summarizedAt: Date.now(),
    })
  },
})

// Internal action that fetches messages and calls AI to generate a summary
export const generateSummary = internalAction({
  args: {
    conversationId: v.id("conversations"),
    threadId: v.string(),
  },
  handler: async (ctx, args) => {
    // Fetch all messages in the thread (up to 100 for summarization)
    const messagesResult = await ctx.runQuery(
      internal.private.messages.getAllForThread,
      { threadId: args.threadId },
    )

    if (!messagesResult || messagesResult.length === 0) {
      return
    }

    // Build a transcript from messages
    const transcript = messagesResult
      .map((msg) => {
        const role = msg.message?.role === "user" ? "Customer" : "Agent"
        const text = msg.text || ""
        return `${role}: ${text}`
      })
      .filter((line) => line.includes(": ") && !line.endsWith(": "))
      .join("\n")

    if (!transcript.trim()) {
      return
    }

    try {
      const { text: summary } = await generateText({
        model: google("gemini-2.5-flash"),
        system: CONVERSATION_SUMMARY_PROMPT,
        prompt: transcript,
      })

      if (summary.trim()) {
        await ctx.runMutation(internal.system.conversations.saveSummary, {
          conversationId: args.conversationId,
          summary: summary.trim(),
        })
      }
    } catch (error) {
      console.error("Failed to generate conversation summary:", error)
    }
  },
})
