import { v } from "convex/values"
import { mutation } from "../_generated/server"
import { SESSION_DURATION_MS } from "../constants"
import {
  enforceRateLimit,
  getIdentifier,
  RATE_LIMITS,
  sanitizeInput,
} from "../lib/rateLimit"

export const create = mutation({
  args: {
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    organizationId: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
    metadata: v.optional(
      v.object({
        userAgent: v.optional(v.string()),
        language: v.optional(v.string()),
        languages: v.optional(v.string()),
        platform: v.optional(v.string()),
        vendor: v.optional(v.string()),
        screenResolution: v.optional(v.string()),
        viewportSize: v.optional(v.string()),
        timezone: v.optional(v.string()),
        timezoneOffset: v.optional(v.number()),
        cookieEnabled: v.optional(v.boolean()),
        referrer: v.optional(v.string()),
        currentUrl: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    // Rate limiting based on organization ID or anonymous
    enforceRateLimit(
      getIdentifier("sessionCreate", undefined, args.organizationId),
      RATE_LIMITS.sessionCreate,
    )

    // Sanitize inputs
    const sanitizedName = args.name ? sanitizeInput(args.name) : undefined
    const sanitizedEmail = args.email ? sanitizeInput(args.email) : undefined

    const now = Date.now()
    const expiresAt = now + SESSION_DURATION_MS

    // Reuse an existing session for the same organization + email so
    // returning widget users can access their previous conversations.
    if (args.organizationId && sanitizedEmail) {
      const existingSessions = await ctx.db
        .query("contactSessions")
        .withIndex("by_organization_id", (q) =>
          q.eq("organizationId", args.organizationId),
        )
        .order("desc")
        .collect()

      const existingSession = existingSessions.find(
        (session) =>
          session.email?.toLowerCase() === sanitizedEmail.toLowerCase(),
      )

      if (existingSession) {
        await ctx.db.patch(existingSession._id, {
          name: sanitizedName,
          email: sanitizedEmail,
          expiresAt,
          metadata: args.metadata,
        })

        return existingSession._id
      }
    }

    const contactSessionId = await ctx.db.insert("contactSessions", {
      name: sanitizedName,
      email: sanitizedEmail,
      organizationId: args.organizationId,
      expiresAt,
      metadata: args.metadata,
    })

    return contactSessionId
  },
})

export const validate = mutation({
  args: {
    contactSessionId: v.id("contactSessions"),
  },
  handler: async (ctx, args) => {
    const contactSession = await ctx.db.get(args.contactSessionId)
    if (!contactSession) return { valid: false, reason: "Session not found" }

    if (contactSession.expiresAt && contactSession.expiresAt < Date.now()) {
      return { valid: false, reason: "Session expired" }
    }
    return { valid: true, contactSession }
  },
})
