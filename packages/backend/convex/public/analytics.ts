import { query, mutation, internalMutation } from "../_generated/server"
import { ConvexError, v } from "convex/values"

// Log analytics event
export const logEvent = mutation({
  args: {
    organizationId: v.string(),
    eventType: v.string(),
    eventData: v.any(),
    sessionId: v.optional(v.id("contactSessions")),
    conversationId: v.optional(v.id("conversations")),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("analyticsEvents", {
      organizationId: args.organizationId,
      eventType: args.eventType,
      eventData: args.eventData,
      timestamp: Date.now(),
      sessionId: args.sessionId,
      conversationId: args.conversationId,
    })
  },
})

// Internal log event (for use in other mutations/actions)
export const logEventInternal = internalMutation({
  args: {
    organizationId: v.string(),
    eventType: v.string(),
    eventData: v.any(),
    sessionId: v.optional(v.id("contactSessions")),
    conversationId: v.optional(v.id("conversations")),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("analyticsEvents", {
      organizationId: args.organizationId,
      eventType: args.eventType,
      eventData: args.eventData,
      timestamp: Date.now(),
      sessionId: args.sessionId,
      conversationId: args.conversationId,
    })
  },
})

// Get analytics summary for dashboard
export const getSummary = query({
  args: {
    organizationId: v.string(),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now()
    const startDate = args.startDate || now - 30 * 24 * 60 * 60 * 1000 // Default: 30 days
    const endDate = args.endDate || now

    // Get all conversations for the organization
    const conversations = await ctx.db
      .query("conversations")
      .withIndex("by_organization_id", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect()

    // Filter by date range
    const filteredConversations = conversations.filter(
      (c) => c._creationTime >= startDate && c._creationTime <= endDate,
    )

    // Calculate metrics
    const totalConversations = filteredConversations.length
    const resolvedConversations = filteredConversations.filter(
      (c) => c.status === "resolved",
    ).length
    const escalatedConversations = filteredConversations.filter(
      (c) => c.status === "escalated",
    ).length
    const unresolvedConversations = filteredConversations.filter(
      (c) => c.status === "unresolved",
    ).length

    // Get analytics events
    const events = await ctx.db
      .query("analyticsEvents")
      .withIndex("by_organization_id", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect()

    const filteredEvents = events.filter(
      (e) => e.timestamp >= startDate && e.timestamp <= endDate,
    )

    // Calculate event counts by type
    const eventCounts = filteredEvents.reduce(
      (acc, event) => {
        acc[event.eventType] = (acc[event.eventType] || 0) + 1
        return acc
      },
      {} as Record<string, number>,
    )

    // Calculate daily conversation counts for chart
    const dailyData: Record<
      string,
      { date: string; conversations: number; resolved: number }
    > = {}
    filteredConversations.forEach((c) => {
      const date = new Date(c._creationTime).toISOString().split("T")[0]
      if (date) {
        if (!dailyData[date]) {
          dailyData[date] = { date, conversations: 0, resolved: 0 }
        }
        dailyData[date]!.conversations++
        if (c.status === "resolved") {
          dailyData[date]!.resolved++
        }
      }
    })

    return {
      summary: {
        totalConversations,
        resolvedConversations,
        escalatedConversations,
        unresolvedConversations,
        resolutionRate:
          totalConversations > 0
            ? Math.round((resolvedConversations / totalConversations) * 100)
            : 0,
        escalationRate:
          totalConversations > 0
            ? Math.round((escalatedConversations / totalConversations) * 100)
            : 0,
      },
      eventCounts,
      dailyData: Object.values(dailyData).sort((a, b) =>
        a.date.localeCompare(b.date),
      ),
      period: {
        startDate,
        endDate,
      },
    }
  },
})

// Get conversation metrics over time
export const getConversationMetrics = query({
  args: {
    organizationId: v.string(),
    days: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const days = args.days || 7
    const now = Date.now()
    const startDate = now - days * 24 * 60 * 60 * 1000

    const conversations = await ctx.db
      .query("conversations")
      .withIndex("by_organization_id", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect()

    const recentConversations = conversations.filter(
      (c) => c._creationTime >= startDate,
    )

    // Group by day
    const byDay: Record<
      string,
      { total: number; resolved: number; escalated: number }
    > = {}

    for (let i = 0; i < days; i++) {
      const date = new Date(now - i * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0]
      if (date) {
        byDay[date] = { total: 0, resolved: 0, escalated: 0 }
      }
    }

    recentConversations.forEach((c) => {
      const date = new Date(c._creationTime).toISOString().split("T")[0]
      if (date && byDay[date]) {
        byDay[date]!.total++
        if (c.status === "resolved") byDay[date]!.resolved++
        if (c.status === "escalated") byDay[date]!.escalated++
      }
    })

    return Object.entries(byDay)
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date))
  },
})
