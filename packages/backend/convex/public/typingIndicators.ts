import { v } from "convex/values"
import { mutation, query } from "../_generated/server"

// Update typing status for a user in a conversation
export const setTyping = mutation({
  args: {
    conversationId: v.id("conversations"),
    contactSessionId: v.id("contactSessions"),
    isTyping: v.boolean(),
  },
  handler: async (ctx, args) => {
    // Validate contact session
    const session = await ctx.db.get(args.contactSessionId)
    if (!session) {
      throw new Error("Invalid contact session")
    }

    // Validate conversation belongs to this session
    const conversation = await ctx.db.get(args.conversationId)
    if (
      !conversation ||
      conversation.contactSessionId !== args.contactSessionId
    ) {
      throw new Error("Invalid conversation")
    }

    // Find existing indicator
    const existing = await ctx.db
      .query("typingIndicators")
      .withIndex("by_participant", (q) =>
        q
          .eq("conversationId", args.conversationId)
          .eq("participantId", args.contactSessionId),
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
        participantId: args.contactSessionId,
        participantType: "user",
        isTyping: args.isTyping,
        lastUpdated: Date.now(),
      })
    }
  },
})

// Get typing indicators for a conversation (for users to see AI/operator typing)
export const getTypingStatus = query({
  args: {
    conversationId: v.id("conversations"),
    contactSessionId: v.id("contactSessions"),
  },
  handler: async (ctx, args) => {
    // Validate contact session
    const session = await ctx.db.get(args.contactSessionId)
    if (!session) {
      return null
    }

    // Validate conversation
    const conversation = await ctx.db.get(args.conversationId)
    if (
      !conversation ||
      conversation.contactSessionId !== args.contactSessionId
    ) {
      return null
    }

    // Get all typing indicators for this conversation
    const indicators = await ctx.db
      .query("typingIndicators")
      .withIndex("by_conversation_id", (q) =>
        q.eq("conversationId", args.conversationId),
      )
      .collect()

    // Filter to only show AI and operator typing to users
    // Also filter out stale indicators (older than 10 seconds)
    const now = Date.now()
    const TIMEOUT = 10000 // 10 seconds

    const activeIndicators = indicators.filter(
      (ind) =>
        ind.isTyping &&
        ind.participantType !== "user" &&
        now - ind.lastUpdated < TIMEOUT,
    )

    return {
      aiTyping: activeIndicators.some((ind) => ind.participantType === "ai"),
      operatorTyping: activeIndicators.some(
        (ind) => ind.participantType === "operator",
      ),
    }
  },
})
