import { v } from "convex/values"
import { mutation, query } from "../_generated/server"

// Update typing status for operator/AI in a conversation
export const setTyping = mutation({
  args: {
    conversationId: v.id("conversations"),
    participantType: v.union(v.literal("ai"), v.literal("operator")),
    isTyping: v.boolean(),
  },
  handler: async (ctx, args) => {
    // Validate conversation exists
    const conversation = await ctx.db.get(args.conversationId)
    if (!conversation) {
      throw new Error("Invalid conversation")
    }

    const participantId =
      args.participantType === "ai" ? "ai-agent" : "operator"

    // Find existing indicator
    const existing = await ctx.db
      .query("typingIndicators")
      .withIndex("by_participant", (q) =>
        q
          .eq("conversationId", args.conversationId)
          .eq("participantId", participantId),
      )
      .first()

    if (existing) {
      await ctx.db.patch(existing._id, {
        isTyping: args.isTyping,
        lastUpdated: Date.now(),
      })
    } else {
      await ctx.db.insert("typingIndicators", {
        conversationId: args.conversationId,
        participantId,
        participantType: args.participantType,
        isTyping: args.isTyping,
        lastUpdated: Date.now(),
      })
    }
  },
})

// Get typing indicators for a conversation (for operators to see user typing)
export const getTypingStatus = query({
  args: {
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, args) => {
    // Validate conversation
    const conversation = await ctx.db.get(args.conversationId)
    if (!conversation) {
      return null
    }

    // Get all typing indicators for this conversation
    const indicators = await ctx.db
      .query("typingIndicators")
      .withIndex("by_conversation_id", (q) =>
        q.eq("conversationId", args.conversationId),
      )
      .collect()

    // Filter out stale indicators (older than 10 seconds)
    const now = Date.now()
    const TIMEOUT = 10000 // 10 seconds

    const activeIndicators = indicators.filter(
      (ind) => ind.isTyping && now - ind.lastUpdated < TIMEOUT,
    )

    return {
      userTyping: activeIndicators.some(
        (ind) => ind.participantType === "user",
      ),
      aiTyping: activeIndicators.some((ind) => ind.participantType === "ai"),
      operatorTyping: activeIndicators.some(
        (ind) => ind.participantType === "operator",
      ),
    }
  },
})

// Cleanup stale typing indicators (can be called periodically)
export const cleanupStaleIndicators = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now()
    const TIMEOUT = 30000 // 30 seconds for cleanup

    const allIndicators = await ctx.db.query("typingIndicators").collect()

    let cleaned = 0
    for (const indicator of allIndicators) {
      if (now - indicator.lastUpdated > TIMEOUT) {
        await ctx.db.delete(indicator._id)
        cleaned++
      }
    }

    return { cleaned }
  },
})
