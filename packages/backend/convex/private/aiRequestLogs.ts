import { query } from "../_generated/server"
import { ConvexError, v } from "convex/values"
import { getErrorDescription } from "../system/aiRequestLogs"
import { GEMINI_FREE_TIER } from "../lib/rateLimit"

/**
 * Parse rate limit info from error message
 */
function parseRateLimitFromError(errorMessage: string | undefined): {
  limit?: number
  retryAfterSeconds?: number
} {
  if (!errorMessage) return {}

  const limitMatch = errorMessage.match(/limit:\s*(\d+)/i)
  const retryMatch = errorMessage.match(/retry in\s*([\d.]+)s/i)

  return {
    limit: limitMatch ? parseInt(limitMatch[1], 10) : undefined,
    retryAfterSeconds: retryMatch ? parseFloat(retryMatch[1]) : undefined,
  }
}

/**
 * Get AI request logs for the dashboard/customization page
 */
export const getAIRequestLogs = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "User not authenticated",
      })
    }

    const orgId = identity.orgId as string
    if (!orgId) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "Organization not found",
      })
    }

    const limit = args.limit ?? 30

    const logs = await ctx.db
      .query("aiRequestLogs")
      .withIndex("by_organization_and_time", (q) =>
        q.eq("organizationId", orgId),
      )
      .order("desc")
      .take(limit)

    return logs.map((log) => ({
      ...log,
      errorDescription: log.errorCode
        ? getErrorDescription(log.errorCode as any)
        : undefined,
    }))
  },
})

/**
 * Get AI usage stats for the dashboard/customization page
 */
export const getAIUsageStats = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "User not authenticated",
      })
    }

    const orgId = identity.orgId as string
    if (!orgId) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "Organization not found",
      })
    }

    const now = Date.now()
    const oneDayAgo = now - 24 * 60 * 60 * 1000
    const oneHourAgo = now - 60 * 60 * 1000
    const oneMinuteAgo = now - 60 * 1000

    // Get all logs from last 24 hours
    const logs = await ctx.db
      .query("aiRequestLogs")
      .withIndex("by_organization_and_time", (q) =>
        q.eq("organizationId", orgId),
      )
      .order("desc")
      .filter((q) => q.gte(q.field("createdAt"), oneDayAgo))
      .collect()

    // Calculate stats
    const totalRequests = logs.length
    const successCount = logs.filter((l) => l.status === "success").length
    const failedCount = logs.filter((l) => l.status === "failed").length

    // Requests in last hour (for rate limit awareness)
    const requestsLastHour = logs.filter(
      (l) => l.createdAt >= oneHourAgo,
    ).length
    const requestsLastMinute = logs.filter(
      (l) => l.createdAt >= oneMinuteAgo,
    ).length

    // Find the last rate limit error to calculate reset time
    const lastRateLimitError = logs.find(
      (l) =>
        l.status === "failed" &&
        (l.errorCode === "RATE_LIMIT" || l.errorCode === "QUOTA_EXCEEDED"),
    )

    // Parse rate limit info from the error message
    let rateLimitInfo: {
      isRateLimited: boolean
      resetAt: number | null
      retryAfterSeconds: number | null
      limitPerMinute: number
      currentUsage: number
    } = {
      isRateLimited: false,
      resetAt: null,
      retryAfterSeconds: null,
      limitPerMinute: GEMINI_FREE_TIER.rpm,
      currentUsage: requestsLastMinute,
    }

    if (lastRateLimitError) {
      const parsed = parseRateLimitFromError(lastRateLimitError.errorMessage)
      const errorTime = lastRateLimitError.createdAt

      // Calculate reset time (1 minute from the rate limit error)
      const resetAt = errorTime + GEMINI_FREE_TIER.resetPeriodMs
      const isStillRateLimited = resetAt > now

      if (parsed.limit) {
        rateLimitInfo.limitPerMinute = parsed.limit
      }

      if (isStillRateLimited) {
        rateLimitInfo.isRateLimited = true
        rateLimitInfo.resetAt = resetAt
        rateLimitInfo.retryAfterSeconds = Math.ceil((resetAt - now) / 1000)
      }
    }

    // Requests by type
    const byType: Record<string, { success: number; failed: number }> = {}
    logs.forEach((log) => {
      if (!byType[log.requestType]) {
        byType[log.requestType] = { success: 0, failed: 0 }
      }
      byType[log.requestType][log.status]++
    })

    // Error breakdown
    const errorCounts: Record<string, number> = {}
    logs
      .filter((l) => l.status === "failed" && l.errorCode)
      .forEach((log) => {
        errorCounts[log.errorCode!] = (errorCounts[log.errorCode!] || 0) + 1
      })

    // Last failure info
    const lastFailure = logs.find((l) => l.status === "failed")

    // Get AI model settings to show free tier usage
    const settings = await ctx.db
      .query("aiModelSettings")
      .withIndex("by_organization_id", (q) => q.eq("organizationId", orgId))
      .unique()

    const freeRequestsUsed = settings?.freeRequestsUsed ?? 0
    const freeRequestsLimit =
      settings?.freeRequestsLimit ?? GEMINI_FREE_TIER.rpd

    return {
      totalRequests24h: totalRequests,
      successCount,
      failedCount,
      successRate:
        totalRequests > 0
          ? Math.round((successCount / totalRequests) * 100)
          : 100,
      requestsLastHour,
      requestsLastMinute,
      // Rate limit info
      rateLimit: rateLimitInfo,
      byType,
      errorCounts: Object.entries(errorCounts).map(([code, count]) => ({
        code,
        count,
        description: getErrorDescription(code as any),
      })),
      lastFailure: lastFailure
        ? {
            requestType: lastFailure.requestType,
            errorMessage: lastFailure.errorMessage,
            errorCode: lastFailure.errorCode,
            errorDescription: lastFailure.errorCode
              ? getErrorDescription(lastFailure.errorCode as any)
              : undefined,
            createdAt: lastFailure.createdAt,
          }
        : null,
      // Free tier info (daily)
      freeRequestsUsed,
      freeRequestsLimit,
      freeRequestsRemaining: Math.max(0, freeRequestsLimit - freeRequestsUsed),
      isFreeTierExhausted: freeRequestsUsed >= freeRequestsLimit,
    }
  },
})
