import {
  internalAction,
  internalMutation,
  internalQuery,
} from "../_generated/server"
import { ConvexError, v } from "convex/values"
import { supportAgent } from "./ai/agents/supportAgent"
import {
  CONVERSATION_SUMMARY_PROMPT,
  SENTIMENT_ANALYSIS_PROMPT,
  AUTO_TAGGING_PROMPT,
  SUGGESTED_REPLIES_PROMPT,
} from "./ai/constants"
import { google } from "@ai-sdk/google"
import { generateText } from "ai"
import { internal } from "../_generated/api"
import rag from "./ai/rag"

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

// Internal mutation to update lastMessageAt when a new message is received
export const updateLastMessageAt = internalMutation({
  args: {
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.conversationId, {
      lastMessageAt: Date.now(),
    })
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

// Internal mutation to save sentiment to a conversation
export const saveSentiment = internalMutation({
  args: {
    conversationId: v.id("conversations"),
    sentiment: v.union(
      v.literal("positive"),
      v.literal("neutral"),
      v.literal("negative"),
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.conversationId, {
      sentiment: args.sentiment,
    })
  },
})

// Internal action that analyzes sentiment from user messages
export const analyzeSentiment = internalAction({
  args: {
    conversationId: v.id("conversations"),
    threadId: v.string(),
  },
  handler: async (ctx, args) => {
    // Fetch all messages in the thread
    const messagesResult = await ctx.runQuery(
      internal.private.messages.getAllForThread,
      { threadId: args.threadId },
    )

    if (!messagesResult || messagesResult.length === 0) {
      return
    }

    // Extract only user messages for sentiment analysis
    const userMessages = messagesResult
      .filter((msg) => msg.message?.role === "user")
      .map((msg) => msg.text || "")
      .filter((text) => text.trim())
      .join("\n---\n")

    if (!userMessages.trim()) {
      return
    }

    try {
      const { text: sentimentResult } = await generateText({
        model: google("gemini-2.5-flash"),
        system: SENTIMENT_ANALYSIS_PROMPT,
        prompt: `Analyze the sentiment of these customer messages:\n\n${userMessages}`,
      })

      const sentiment = sentimentResult.trim().toLowerCase()

      // Validate the response is one of the expected values
      if (
        sentiment === "positive" ||
        sentiment === "neutral" ||
        sentiment === "negative"
      ) {
        await ctx.runMutation(internal.system.conversations.saveSentiment, {
          conversationId: args.conversationId,
          sentiment: sentiment,
        })
      }
    } catch (error) {
      console.error("Failed to analyze conversation sentiment:", error)
    }
  },
})

// Internal query to get all tags for an organization
export const getTagsForOrg = internalQuery({
  args: {
    organizationId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("conversationTags")
      .withIndex("by_organization_id", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect()
  },
})

// Internal mutation to save tags and priority to a conversation
export const saveTagsAndPriority = internalMutation({
  args: {
    conversationId: v.id("conversations"),
    tags: v.optional(v.array(v.string())),
    priority: v.optional(
      v.union(v.literal("low"), v.literal("medium"), v.literal("high")),
    ),
  },
  handler: async (ctx, args) => {
    const updates: Record<string, unknown> = {}
    if (args.tags !== undefined) {
      updates.tags = args.tags
    }
    if (args.priority !== undefined) {
      updates.priority = args.priority
    }
    if (Object.keys(updates).length > 0) {
      await ctx.db.patch(args.conversationId, updates)
    }
  },
})

// Internal action that auto-tags and sets priority for a conversation
export const analyzeAndTag = internalAction({
  args: {
    conversationId: v.id("conversations"),
    threadId: v.string(),
    organizationId: v.string(),
  },
  handler: async (ctx, args) => {
    // Fetch available tags for the organization
    const availableTags = await ctx.runQuery(
      internal.system.conversations.getTagsForOrg,
      { organizationId: args.organizationId },
    )

    // If no tags are configured, skip tagging (but still set priority)
    const tagNames = availableTags.map((t) => t.name)
    const tagListStr =
      tagNames.length > 0
        ? tagNames.map((n) => `- ${n}`).join("\n")
        : "No tags configured. Skip tag suggestions and return empty tags array."

    // Fetch all messages in the thread
    const messagesResult = await ctx.runQuery(
      internal.private.messages.getAllForThread,
      { threadId: args.threadId },
    )

    if (!messagesResult || messagesResult.length === 0) {
      return
    }

    // Build a transcript
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
      // Replace placeholder in prompt with actual tags
      const systemPrompt = AUTO_TAGGING_PROMPT.replace(
        "{AVAILABLE_TAGS}",
        tagListStr,
      )

      const { text: result } = await generateText({
        model: google("gemini-2.5-flash"),
        system: systemPrompt,
        prompt: `Analyze this conversation and suggest tags and priority:\n\n${transcript}`,
      })

      // Parse JSON response
      const parsed = JSON.parse(result.trim())

      // Validate tags - only accept tags that exist in the available list
      const validTags = (parsed.tags || []).filter((tag: string) =>
        tagNames.includes(tag),
      )

      // Validate priority
      const validPriority =
        parsed.priority === "low" ||
        parsed.priority === "medium" ||
        parsed.priority === "high"
          ? parsed.priority
          : "medium"

      // Save to conversation
      await ctx.runMutation(internal.system.conversations.saveTagsAndPriority, {
        conversationId: args.conversationId,
        tags: validTags.length > 0 ? validTags : undefined,
        priority: validPriority,
      })
    } catch (error) {
      console.error("Failed to auto-tag conversation:", error)
    }
  },
})

// Internal action that generates AI suggested replies for agents
export const generateSuggestedReplies = internalAction({
  args: {
    conversationId: v.id("conversations"),
    threadId: v.string(),
    organizationId: v.string(),
  },
  handler: async (ctx, args): Promise<string[]> => {
    try {
      // Fetch recent messages
      const messagesResult = await ctx.runQuery(
        internal.private.messages.getAllForThread,
        { threadId: args.threadId },
      )

      if (!messagesResult || messagesResult.length === 0) {
        return []
      }

      // Get the latest user message (this is what we're responding to)
      const latestUserMsg = messagesResult
        .filter((msg) => msg.message?.role === "user")
        .pop()

      if (!latestUserMsg?.text?.trim()) {
        return []
      }

      // Build minimal context (last 4 messages for context)
      const recentMessages = messagesResult.slice(-4)
      const contextTranscript = recentMessages
        .map((msg) => {
          const role = msg.message?.role === "user" ? "Customer" : "Agent"
          const text = msg.text || ""
          return `${role}: ${text}`
        })
        .filter((line) => line.includes(": ") && !line.endsWith(": "))
        .join("\n")

      let kbContext = ""

      // Search KB based on the latest user message
      try {
        const searchResult = await rag.search(ctx, {
          namespace: args.organizationId,
          query: latestUserMsg.text,
          limit: 3,
        })

        if (searchResult.text && searchResult.text.trim()) {
          kbContext = `\n\nRelevant knowledge base info:\n${searchResult.text.slice(0, 400)}`
        }
      } catch {
        // Silently continue without KB context if search fails
      }

      const { text: result } = await generateText({
        model: google("gemini-2.5-flash"),
        system: SUGGESTED_REPLIES_PROMPT,
        prompt: `LATEST CUSTOMER MESSAGE TO RESPOND TO:
"${latestUserMsg.text}"

Recent conversation context:
${contextTranscript}${kbContext}`,
      })

      // Parse JSON response - handle potential markdown wrapping
      let jsonStr = result.trim()

      // Remove markdown code blocks if present
      if (jsonStr.startsWith("```")) {
        jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "")
      }

      try {
        const suggestions = JSON.parse(jsonStr)

        // Validate it's an array of strings
        if (
          Array.isArray(suggestions) &&
          suggestions.length > 0 &&
          suggestions.every((s) => typeof s === "string")
        ) {
          return suggestions.slice(0, 3) // Max 3 suggestions
        }
      } catch (parseError) {
        console.error("Failed to parse suggestions JSON:", parseError, jsonStr)
      }

      // Fallback: try to extract any quoted strings from the response
      const quotedStrings = jsonStr.match(/"([^"]+)"/g)
      if (quotedStrings && quotedStrings.length > 0) {
        return quotedStrings
          .slice(0, 3)
          .map((s) => s.replace(/"/g, ""))
          .filter((s) => s.length > 5 && s.length < 150)
      }

      return [] // No fallback suggestions - only show when AI provides specific ones
    } catch (error) {
      console.error("Failed to generate suggested replies:", error)
      return []
    }
  },
})
