import { internalMutation, internalQuery } from "../_generated/server"
import { ConvexError, v } from "convex/values"
import { AUTO_REFRESH_THRESHOLD_MS, SESSION_DURATION_MS } from "../constants"

export const refresh = internalMutation({
  args: {
    contactSessionId: v.id("contactSessions"),
  },
  handler: async (ctx, args) => {
    const contactSession = await ctx.db.get(args.contactSessionId)
    if (!contactSession) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Session not found",
      })
    }

    if (contactSession.expiresAt && contactSession.expiresAt < Date.now()) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Cannot refresh an expired session",
      })
    }

    const timeRemaining =
      contactSession.expiresAt && contactSession.expiresAt - Date.now()

    if (timeRemaining && timeRemaining < AUTO_REFRESH_THRESHOLD_MS) {
      const newExpiresAt = Date.now() + SESSION_DURATION_MS

      await ctx.db.patch(args.contactSessionId, { expiresAt: newExpiresAt })
      return { ...contactSession, expiresAt: newExpiresAt }
    }
    return contactSession
  },
})

export const getOne = internalQuery({
  args: {
    contactSessionId: v.id("contactSessions"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.contactSessionId)
  },
})
