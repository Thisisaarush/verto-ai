import { mutation, query } from "../_generated/server"
import { ConvexError, v } from "convex/values"
import { INPUT_CONSTRAINTS } from "../schema"

// Create a conversation tag
export const create = mutation({
  args: {
    organizationId: v.string(),
    name: v.string(),
    color: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.name.length > INPUT_CONSTRAINTS.TAG_NAME_MAX_LENGTH) {
      throw new ConvexError({
        code: "VALIDATION_ERROR",
        message: "Tag name is too long",
      })
    }

    // Check if tag already exists
    const existing = await ctx.db
      .query("conversationTags")
      .withIndex("by_name_and_organization_id", (q) =>
        q.eq("name", args.name).eq("organizationId", args.organizationId),
      )
      .first()

    if (existing) {
      throw new ConvexError({
        code: "DUPLICATE_TAG",
        message: "A tag with this name already exists",
      })
    }

    return await ctx.db.insert("conversationTags", {
      organizationId: args.organizationId,
      name: args.name,
      color: args.color,
      description: args.description,
    })
  },
})

// Get all tags for an organization
export const getMany = query({
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

// Update tag
export const update = mutation({
  args: {
    id: v.id("conversationTags"),
    name: v.optional(v.string()),
    color: v.optional(v.string()),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args

    const existing = await ctx.db.get(id)
    if (!existing) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Tag not found",
      })
    }

    if (
      updates.name &&
      updates.name.length > INPUT_CONSTRAINTS.TAG_NAME_MAX_LENGTH
    ) {
      throw new ConvexError({
        code: "VALIDATION_ERROR",
        message: "Tag name is too long",
      })
    }

    await ctx.db.patch(id, updates)
    return id
  },
})

// Delete tag
export const remove = mutation({
  args: {
    id: v.id("conversationTags"),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.id)
    if (!existing) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Tag not found",
      })
    }

    // Remove this tag from all conversations
    const conversations = await ctx.db
      .query("conversations")
      .withIndex("by_organization_id", (q) =>
        q.eq("organizationId", existing.organizationId),
      )
      .collect()

    for (const conversation of conversations) {
      if (conversation.tags?.includes(existing.name)) {
        await ctx.db.patch(conversation._id, {
          tags: conversation.tags.filter((t) => t !== existing.name),
        })
      }
    }

    await ctx.db.delete(args.id)
  },
})

// Add tag to conversation
export const addToConversation = mutation({
  args: {
    conversationId: v.id("conversations"),
    tagName: v.string(),
  },
  handler: async (ctx, args) => {
    const conversation = await ctx.db.get(args.conversationId)
    if (!conversation) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Conversation not found",
      })
    }

    const currentTags = conversation.tags || []
    if (currentTags.includes(args.tagName)) {
      return // Tag already exists
    }

    await ctx.db.patch(args.conversationId, {
      tags: [...currentTags, args.tagName],
    })
  },
})

// Remove tag from conversation
export const removeFromConversation = mutation({
  args: {
    conversationId: v.id("conversations"),
    tagName: v.string(),
  },
  handler: async (ctx, args) => {
    const conversation = await ctx.db.get(args.conversationId)
    if (!conversation) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Conversation not found",
      })
    }

    const currentTags = conversation.tags || []
    await ctx.db.patch(args.conversationId, {
      tags: currentTags.filter((t) => t !== args.tagName),
    })
  },
})
