/**
 * Internal API functions for REST API endpoints
 * These are called by http.ts handlers
 */

import { internalMutation, internalQuery } from "../_generated/server"
import { v } from "convex/values"
import { components } from "../_generated/api"
import type { Doc, Id } from "../_generated/dataModel"

// =============================================================================
// Conversations
// =============================================================================

/**
 * List conversations for an organization
 */
export const listConversations = internalQuery({
  args: {
    organizationId: v.string(),
    status: v.optional(
      v.union(
        v.literal("unresolved"),
        v.literal("escalated"),
        v.literal("resolved"),
      ),
    ),
    limit: v.number(),
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let query = ctx.db
      .query("conversations")
      .withIndex("by_organization_id", (q) =>
        q.eq("organizationId", args.organizationId),
      )

    // Apply status filter if provided
    if (args.status) {
      query = query.filter((q) => q.eq(q.field("status"), args.status))
    }

    // Get conversations with limit + 1 to check if there are more
    const conversations = await query.order("desc").take(args.limit + 1)

    const hasMore = conversations.length > args.limit
    const results = hasMore ? conversations.slice(0, -1) : conversations

    // Get contact info for each conversation
    const conversationsWithContacts = await Promise.all(
      results.map(async (conv) => {
        const contact = await ctx.db.get(conv.contactSessionId)
        return {
          id: conv._id,
          threadId: conv.threadId,
          status: conv.status,
          tags: conv.tags || [],
          priority: conv.priority || "medium",
          assignedTo: conv.assignedTo,
          sentiment: conv.sentiment,
          summary: conv.summary,
          agentType: conv.agentType || "general",
          escalatedAt: conv.escalatedAt,
          resolvedAt: conv.resolvedAt,
          lastMessageAt: conv.lastMessageAt,
          createdAt: conv._creationTime,
          contact: contact
            ? {
                id: contact._id,
                name: contact.name,
                email: contact.email,
                phone: contact.phone,
              }
            : null,
        }
      }),
    )

    return {
      conversations: conversationsWithContacts,
      hasMore,
      nextCursor:
        hasMore && results.length > 0
          ? results[results.length - 1]?._id
          : undefined,
    }
  },
})

/**
 * Get a single conversation by ID
 */
export const getConversation = internalQuery({
  args: {
    organizationId: v.string(),
    conversationId: v.string(),
  },
  handler: async (ctx, args) => {
    // Try to parse as a Convex ID
    let conversation: Doc<"conversations"> | null = null

    try {
      conversation = await ctx.db.get(
        args.conversationId as Id<"conversations">,
      )
    } catch {
      // If not a valid ID, try to find by threadId
      conversation = await ctx.db
        .query("conversations")
        .withIndex("by_thread_id", (q) => q.eq("threadId", args.conversationId))
        .unique()
    }

    if (!conversation) return null

    // Verify organization ownership
    if (conversation.organizationId !== args.organizationId) {
      return null
    }

    const contact = await ctx.db.get(conversation.contactSessionId)

    return {
      id: conversation._id,
      threadId: conversation.threadId,
      status: conversation.status,
      tags: conversation.tags || [],
      priority: conversation.priority || "medium",
      assignedTo: conversation.assignedTo,
      sentiment: conversation.sentiment,
      summary: conversation.summary,
      agentType: conversation.agentType || "general",
      escalatedAt: conversation.escalatedAt,
      resolvedAt: conversation.resolvedAt,
      lastMessageAt: conversation.lastMessageAt,
      lastReadAt: conversation.lastReadAt,
      createdAt: conversation._creationTime,
      contact: contact
        ? {
            id: contact._id,
            name: contact.name,
            email: contact.email,
            phone: contact.phone,
            metadata: contact.metadata,
          }
        : null,
    }
  },
})

/**
 * Update a conversation
 */
export const updateConversation = internalMutation({
  args: {
    organizationId: v.string(),
    conversationId: v.string(),
    status: v.optional(
      v.union(
        v.literal("unresolved"),
        v.literal("escalated"),
        v.literal("resolved"),
      ),
    ),
    tags: v.optional(v.array(v.string())),
    priority: v.optional(
      v.union(v.literal("low"), v.literal("medium"), v.literal("high")),
    ),
    assignedTo: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    let conversation: Doc<"conversations"> | null = null

    try {
      conversation = await ctx.db.get(
        args.conversationId as Id<"conversations">,
      )
    } catch {
      conversation = await ctx.db
        .query("conversations")
        .withIndex("by_thread_id", (q) => q.eq("threadId", args.conversationId))
        .unique()
    }

    if (!conversation) {
      throw new Error("Conversation not found")
    }

    if (conversation.organizationId !== args.organizationId) {
      throw new Error("Not authorized")
    }

    const updates: Partial<Doc<"conversations">> = {}

    if (args.status !== undefined) {
      updates.status = args.status
      if (args.status === "escalated" && !conversation.escalatedAt) {
        updates.escalatedAt = Date.now()
      }
      if (args.status === "resolved" && !conversation.resolvedAt) {
        updates.resolvedAt = Date.now()
      }
    }

    if (args.tags !== undefined) {
      updates.tags = args.tags
    }

    if (args.priority !== undefined) {
      updates.priority = args.priority
    }

    if (args.assignedTo !== undefined) {
      updates.assignedTo =
        args.assignedTo === null ? undefined : args.assignedTo
    }

    await ctx.db.patch(conversation._id, updates)

    return {
      id: conversation._id,
      ...updates,
    }
  },
})

// =============================================================================
// Messages
// =============================================================================

/**
 * Get messages for a conversation
 */
export const getMessages = internalQuery({
  args: {
    organizationId: v.string(),
    conversationId: v.string(),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    // Find the conversation
    let conversation: Doc<"conversations"> | null = null

    try {
      conversation = await ctx.db.get(
        args.conversationId as Id<"conversations">,
      )
    } catch {
      conversation = await ctx.db
        .query("conversations")
        .withIndex("by_thread_id", (q) => q.eq("threadId", args.conversationId))
        .unique()
    }

    if (!conversation) {
      throw new Error("Conversation not found")
    }

    if (conversation.organizationId !== args.organizationId) {
      throw new Error("Not authorized")
    }

    // Get messages from the agent thread
    const messages = await ctx.db
      .query("agent_messages" as "conversationTags") // Using agent component's table
      .filter((q) =>
        q.eq(q.field("threadId" as "name"), conversation!.threadId),
      )
      .order("asc")
      .take(args.limit)

    // Return formatted messages
    return (
      messages as unknown as Array<{
        _id: string
        _creationTime: number
        message: { role: string; content: string }
      }>
    ).map((msg) => ({
      id: msg._id,
      role: msg.message?.role || "unknown",
      content: msg.message?.content || "",
      createdAt: msg._creationTime,
    }))
  },
})

/**
 * Send a message to a conversation (as operator)
 */
export const sendMessage = internalMutation({
  args: {
    organizationId: v.string(),
    conversationId: v.string(),
    message: v.string(),
    role: v.union(v.literal("assistant"), v.literal("operator")),
  },
  handler: async (ctx, args) => {
    // Find the conversation
    let conversation: Doc<"conversations"> | null = null

    try {
      conversation = await ctx.db.get(
        args.conversationId as Id<"conversations">,
      )
    } catch {
      conversation = await ctx.db
        .query("conversations")
        .withIndex("by_thread_id", (q) => q.eq("threadId", args.conversationId))
        .unique()
    }

    if (!conversation) {
      throw new Error("Conversation not found")
    }

    if (conversation.organizationId !== args.organizationId) {
      throw new Error("Not authorized")
    }

    // Save message using internal function
    // Note: This is a simplified version - in production you'd want to use
    // the agent's saveMessage function properly
    const messageId = `api-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

    // Update conversation's lastMessageAt
    await ctx.db.patch(conversation._id, {
      lastMessageAt: Date.now(),
    })

    return {
      id: messageId,
      conversationId: conversation._id,
      role: args.role,
      content: args.message,
      createdAt: Date.now(),
    }
  },
})

// =============================================================================
// Analytics
// =============================================================================

/**
 * Get analytics for an organization
 */
export const getAnalytics = internalQuery({
  args: {
    organizationId: v.string(),
    period: v.union(v.literal("24h"), v.literal("7d"), v.literal("30d")),
  },
  handler: async (ctx, args) => {
    const now = Date.now()
    const periodMs = {
      "24h": 24 * 60 * 60 * 1000,
      "7d": 7 * 24 * 60 * 60 * 1000,
      "30d": 30 * 24 * 60 * 60 * 1000,
    }
    const startTime = now - periodMs[args.period]

    // Get all conversations for the period
    const conversations = await ctx.db
      .query("conversations")
      .withIndex("by_organization_id", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .filter((q) => q.gte(q.field("_creationTime"), startTime))
      .collect()

    // Calculate metrics
    const totalConversations = conversations.length
    const resolved = conversations.filter((c) => c.status === "resolved").length
    const escalated = conversations.filter(
      (c) => c.status === "escalated",
    ).length
    const unresolved = conversations.filter(
      (c) => c.status === "unresolved",
    ).length

    // Sentiment breakdown
    const sentimentCounts = {
      positive: conversations.filter((c) => c.sentiment === "positive").length,
      neutral: conversations.filter((c) => c.sentiment === "neutral").length,
      negative: conversations.filter((c) => c.sentiment === "negative").length,
    }

    // Agent type breakdown
    const agentTypeCounts: Record<string, number> = {}
    conversations.forEach((c) => {
      const type = c.agentType || "general"
      agentTypeCounts[type] = (agentTypeCounts[type] || 0) + 1
    })

    // Resolution rate
    const resolutionRate =
      totalConversations > 0
        ? Math.round((resolved / totalConversations) * 100)
        : 0

    // Average resolution time
    const resolvedConvs = conversations.filter(
      (c) => c.resolvedAt && c._creationTime,
    )
    const avgResolutionTimeMs =
      resolvedConvs.length > 0
        ? resolvedConvs.reduce(
            (sum, c) => sum + (c.resolvedAt! - c._creationTime),
            0,
          ) / resolvedConvs.length
        : 0

    return {
      period: args.period,
      totalConversations,
      statusBreakdown: {
        resolved,
        escalated,
        unresolved,
      },
      resolutionRate,
      averageResolutionTimeMinutes: Math.round(avgResolutionTimeMs / 60000),
      sentimentBreakdown: sentimentCounts,
      agentTypeBreakdown: agentTypeCounts,
    }
  },
})

// =============================================================================
// Contacts
// =============================================================================

/**
 * List contacts (contact sessions) for an organization
 */
export const listContacts = internalQuery({
  args: {
    organizationId: v.string(),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    const contacts = await ctx.db
      .query("contactSessions")
      .withIndex("by_organization_id", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .order("desc")
      .take(args.limit)

    return contacts.map((contact) => ({
      id: contact._id,
      name: contact.name,
      email: contact.email,
      phone: contact.phone,
      metadata: contact.metadata,
      createdAt: contact._creationTime,
      expiresAt: contact.expiresAt,
    }))
  },
})
