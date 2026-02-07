import { internal } from "../_generated/api"
import {
  internalMutation,
  internalQuery,
  type MutationCtx,
} from "../_generated/server"
import { v, type Infer } from "convex/values"

// Request types we track
export const requestTypeValidator = v.union(
  v.literal("chat"),
  v.literal("sentiment"),
  v.literal("classification"),
  v.literal("tagging"),
  v.literal("summarization"),
  v.literal("suggested_replies"),
)

export type AIRequestType = Infer<typeof requestTypeValidator>

// Error codes for categorization
export type ErrorCode =
  | "QUOTA_EXCEEDED"
  | "RATE_LIMIT"
  | "INVALID_API_KEY"
  | "NETWORK_ERROR"
  | "CONTEXT_LENGTH"
  | "UNKNOWN"

/**
 * Determine error code from error message
 */
export function getErrorCode(error: unknown): ErrorCode {
  if (error instanceof Error) {
    const message = error.message.toLowerCase()

    if (
      message.includes("quota") ||
      message.includes("insufficient_quota") ||
      message.includes("billing") ||
      message.includes("credit") ||
      message.includes("payment")
    ) {
      return "QUOTA_EXCEEDED"
    }

    if (message.includes("rate limit") || message.includes("429")) {
      return "RATE_LIMIT"
    }

    if (
      message.includes("api key") ||
      message.includes("unauthorized") ||
      message.includes("authentication") ||
      message.includes("401")
    ) {
      return "INVALID_API_KEY"
    }

    if (
      message.includes("network") ||
      message.includes("timeout") ||
      message.includes("connection")
    ) {
      return "NETWORK_ERROR"
    }

    if (
      message.includes("context length") ||
      message.includes("too long") ||
      message.includes("max tokens")
    ) {
      return "CONTEXT_LENGTH"
    }
  }

  return "UNKNOWN"
}

/**
 * Get human-readable description for error code
 */
export function getErrorDescription(code: ErrorCode): string {
  switch (code) {
    case "QUOTA_EXCEEDED":
      return "API quota/billing limit exceeded"
    case "RATE_LIMIT":
      return "Too many requests (rate limited)"
    case "INVALID_API_KEY":
      return "Invalid or missing API key"
    case "NETWORK_ERROR":
      return "Network connection issue"
    case "CONTEXT_LENGTH":
      return "Input too long for model"
    case "UNKNOWN":
      return "Unknown error"
  }
}

/**
 * Log a successful AI request
 */
export const logSuccess = internalMutation({
  args: {
    organizationId: v.string(),
    requestType: requestTypeValidator,
    provider: v.string(),
    model: v.string(),
    durationMs: v.optional(v.number()),
    conversationId: v.optional(v.id("conversations")),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("aiRequestLogs", {
      organizationId: args.organizationId,
      requestType: args.requestType,
      status: "success",
      provider: args.provider,
      model: args.model,
      durationMs: args.durationMs,
      conversationId: args.conversationId,
      createdAt: Date.now(),
    })
  },
})

/**
 * Log a failed AI request
 */
export const logFailure = internalMutation({
  args: {
    organizationId: v.string(),
    requestType: requestTypeValidator,
    provider: v.string(),
    model: v.string(),
    errorMessage: v.string(),
    errorCode: v.optional(v.string()),
    durationMs: v.optional(v.number()),
    conversationId: v.optional(v.id("conversations")),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("aiRequestLogs", {
      organizationId: args.organizationId,
      requestType: args.requestType,
      status: "failed",
      errorMessage: args.errorMessage,
      errorCode: args.errorCode,
      provider: args.provider,
      model: args.model,
      durationMs: args.durationMs,
      conversationId: args.conversationId,
      createdAt: Date.now(),
    })
  },
})

/**
 * Helper type for logging context
 */
export type AILogContext = {
  organizationId: string
  provider: string
  model: string
  conversationId?: string
}

/**
 * Wrapper to execute an AI call with automatic logging
 * Use this in actions to wrap AI SDK calls
 */
export async function withAILogging<T>(
  ctx: { runMutation: (ref: unknown, args: unknown) => Promise<unknown> },
  requestType: AIRequestType,
  logContext: AILogContext,
  aiCall: () => Promise<T>,
): Promise<T> {
  const startTime = Date.now()

  try {
    const result = await aiCall()
    const durationMs = Date.now() - startTime

    await ctx.runMutation(internal.system.aiRequestLogs.logSuccess, {
      organizationId: logContext.organizationId,
      requestType,
      provider: logContext.provider,
      model: logContext.model,
      durationMs,
      conversationId: logContext.conversationId as any,
    })

    return result
  } catch (error) {
    const durationMs = Date.now() - startTime
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error"
    const errorCode = getErrorCode(error)

    await ctx.runMutation(internal.system.aiRequestLogs.logFailure, {
      organizationId: logContext.organizationId,
      requestType,
      provider: logContext.provider,
      model: logContext.model,
      errorMessage,
      errorCode,
      durationMs,
      conversationId: logContext.conversationId as any,
    })

    throw error
  }
}

/**
 * Get recent logs for an organization
 */
export const getRecentLogs = internalQuery({
  args: {
    organizationId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50

    const logs = await ctx.db
      .query("aiRequestLogs")
      .withIndex("by_organization_and_time", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .order("desc")
      .take(limit)

    return logs
  },
})

/**
 * Get aggregated stats for the last 24 hours
 */
export const getStats = internalQuery({
  args: {
    organizationId: v.string(),
  },
  handler: async (ctx, args) => {
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000
    const oneHourAgo = Date.now() - 60 * 60 * 1000

    // Get all logs from last 24 hours
    const logs = await ctx.db
      .query("aiRequestLogs")
      .withIndex("by_organization_and_time", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .order("desc")
      .filter((q) => q.gte(q.field("createdAt"), oneDayAgo))
      .collect()

    // Calculate stats
    const totalRequests = logs.length
    const successCount = logs.filter((l) => l.status === "success").length
    const failedCount = logs.filter((l) => l.status === "failed").length

    // Requests in last hour (for rate limit awareness)
    const requestsLastHour = logs.filter((l) => l.createdAt >= oneHourAgo).length

    // Requests by type
    const byType: Record<string, { success: number; failed: number }> = {}
    logs.forEach((log) => {
      if (!byType[log.requestType]) {
        byType[log.requestType] = { success: 0, failed: 0 }
      }
      const entry = byType[log.requestType]
      if (entry) {
        entry[log.status]++
      }
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

    return {
      totalRequests,
      successCount,
      failedCount,
      successRate:
        totalRequests > 0
          ? Math.round((successCount / totalRequests) * 100)
          : 100,
      requestsLastHour,
      byType,
      errorCounts,
      lastFailure: lastFailure
        ? {
            requestType: lastFailure.requestType,
            errorMessage: lastFailure.errorMessage,
            errorCode: lastFailure.errorCode,
            createdAt: lastFailure.createdAt,
          }
        : null,
    }
  },
})
