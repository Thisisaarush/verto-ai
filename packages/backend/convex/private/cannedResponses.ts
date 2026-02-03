import { mutation, query } from "../_generated/server"
import { ConvexError, v } from "convex/values"
import { INPUT_CONSTRAINTS } from "../schema"

// Create a canned response
export const create = mutation({
  args: {
    organizationId: v.string(),
    title: v.string(),
    content: v.string(),
    shortcut: v.optional(v.string()),
    category: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.content.length > INPUT_CONSTRAINTS.CANNED_RESPONSE_MAX_LENGTH) {
      throw new ConvexError({
        code: "VALIDATION_ERROR",
        message: "Response content is too long",
      })
    }

    // Check if shortcut already exists
    if (args.shortcut) {
      const existing = await ctx.db
        .query("cannedResponses")
        .withIndex("by_shortcut_and_organization_id", (q) =>
          q
            .eq("shortcut", args.shortcut)
            .eq("organizationId", args.organizationId),
        )
        .first()

      if (existing) {
        throw new ConvexError({
          code: "DUPLICATE_SHORTCUT",
          message: "A canned response with this shortcut already exists",
        })
      }
    }

    return await ctx.db.insert("cannedResponses", {
      organizationId: args.organizationId,
      title: args.title,
      content: args.content,
      shortcut: args.shortcut,
      category: args.category,
      usageCount: 0,
    })
  },
})

// Get all canned responses for an organization
export const getMany = query({
  args: {
    organizationId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("cannedResponses")
      .withIndex("by_organization_id", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect()
  },
})

// Get canned response by shortcut (for quick insertion)
export const getByShortcut = query({
  args: {
    organizationId: v.string(),
    shortcut: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("cannedResponses")
      .withIndex("by_shortcut_and_organization_id", (q) =>
        q
          .eq("shortcut", args.shortcut)
          .eq("organizationId", args.organizationId),
      )
      .first()
  },
})

// Update canned response
export const update = mutation({
  args: {
    id: v.id("cannedResponses"),
    title: v.optional(v.string()),
    content: v.optional(v.string()),
    shortcut: v.optional(v.string()),
    category: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args

    const existing = await ctx.db.get(id)
    if (!existing) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Canned response not found",
      })
    }

    if (
      updates.content &&
      updates.content.length > INPUT_CONSTRAINTS.CANNED_RESPONSE_MAX_LENGTH
    ) {
      throw new ConvexError({
        code: "VALIDATION_ERROR",
        message: "Response content is too long",
      })
    }

    await ctx.db.patch(id, updates)
    return id
  },
})

// Delete canned response
export const remove = mutation({
  args: {
    id: v.id("cannedResponses"),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.id)
    if (!existing) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Canned response not found",
      })
    }

    await ctx.db.delete(args.id)
  },
})

// Increment usage count when a canned response is used
export const incrementUsage = mutation({
  args: {
    id: v.id("cannedResponses"),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.id)
    if (!existing) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Canned response not found",
      })
    }

    await ctx.db.patch(args.id, {
      usageCount: existing.usageCount + 1,
    })
  },
})
