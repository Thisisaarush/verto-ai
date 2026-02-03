import { query } from "../_generated/server"
import { ConvexError, v } from "convex/values"

export const getOne = query({
  args: { contactSessionId: v.id("contactSessions") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (identity === null) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "User not authenticated",
      })
    }

    const contactSession = await ctx.db.get(args.contactSessionId)
    return contactSession
  },
})

export const getOneByConversationId = query({
  args: { conversationId: v.id("conversations") },
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
        code: "NOT_FOUND",
        message: "Conversation not found",
      })
    }

    if (conversation.organizationId !== orgId) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "You do not have access to this conversation",
      })
    }

    const contactSession = await ctx.db.get(conversation.contactSessionId)

    return contactSession
  },
})
