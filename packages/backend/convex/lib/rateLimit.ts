import { ConvexError } from "convex/values"
import { ActionCtx, QueryCtx, MutationCtx } from "../_generated/server"

// Rate limit configuration
export interface RateLimitConfig {
  maxRequests: number
  windowMs: number
}

// Default rate limits
export const RATE_LIMITS = {
  // Public endpoints - more restrictive
  public: {
    maxRequests: 30,
    windowMs: 60 * 1000, // 1 minute
  },
  // Message creation - prevent spam
  messageCreate: {
    maxRequests: 20,
    windowMs: 60 * 1000, // 1 minute
  },
  // Session creation - prevent abuse
  sessionCreate: {
    maxRequests: 5,
    windowMs: 60 * 1000, // 1 minute
  },
  // Conversation creation - prevent spam
  conversationCreate: {
    maxRequests: 10,
    windowMs: 60 * 1000, // 1 minute
  },
  // Webhook - standard
  webhook: {
    maxRequests: 100,
    windowMs: 60 * 1000, // 1 minute
  },
  // AI requests - matches Gemini free tier limit of 20 RPM
  // We use 15 to leave buffer for retries and background tasks
  aiRequest: {
    maxRequests: 15,
    windowMs: 60 * 1000, // 1 minute
  },
} as const

// Gemini free tier limits - accurate as of the API error
export const GEMINI_FREE_TIER = {
  rpm: 20, // Requests per minute (actual limit)
  appRpm: 15, // Our app limit (with buffer)
  rpd: 1500, // Requests per day
  resetPeriodMs: 60 * 1000, // 1 minute for RPM reset
} as const

// In-memory rate limit store (resets on function cold start)
// For production, consider using Convex storage or external service like Upstash
const rateLimitStore = new Map<string, { count: number; resetTime: number }>()

export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig,
): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now()
  const key = identifier

  const existing = rateLimitStore.get(key)

  if (!existing || now > existing.resetTime) {
    // First request or window expired
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + config.windowMs,
    })
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetTime: now + config.windowMs,
    }
  }

  if (existing.count >= config.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: existing.resetTime,
    }
  }

  // Increment counter
  existing.count++
  rateLimitStore.set(key, existing)

  return {
    allowed: true,
    remaining: config.maxRequests - existing.count,
    resetTime: existing.resetTime,
  }
}

export function enforceRateLimit(
  identifier: string,
  config: RateLimitConfig,
): void {
  const result = checkRateLimit(identifier, config)

  if (!result.allowed) {
    throw new ConvexError({
      code: "RATE_LIMITED",
      message: "Too many requests. Please try again later.",
      retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000),
    })
  }
}

/**
 * Check if AI request is within rate limit for an organization
 * Returns info about whether the request is allowed and when to retry
 */
export function checkAIRateLimit(organizationId: string): {
  allowed: boolean
  remaining: number
  resetTime: number
  retryAfterSeconds: number
} {
  const key = `ai:${organizationId}`
  const result = checkRateLimit(key, RATE_LIMITS.aiRequest)

  return {
    ...result,
    retryAfterSeconds: result.allowed
      ? 0
      : Math.ceil((result.resetTime - Date.now()) / 1000),
  }
}

/**
 * Get the current AI rate limit status without incrementing
 */
export function getAIRateLimitStatus(organizationId: string): {
  currentUsage: number
  limit: number
  resetTime: number
  isRateLimited: boolean
  retryAfterSeconds: number
} {
  const key = `ai:${organizationId}`
  const now = Date.now()
  const existing = rateLimitStore.get(key)

  if (!existing || now > existing.resetTime) {
    return {
      currentUsage: 0,
      limit: RATE_LIMITS.aiRequest.maxRequests,
      resetTime: now + RATE_LIMITS.aiRequest.windowMs,
      isRateLimited: false,
      retryAfterSeconds: 0,
    }
  }

  const isRateLimited = existing.count >= RATE_LIMITS.aiRequest.maxRequests

  return {
    currentUsage: existing.count,
    limit: RATE_LIMITS.aiRequest.maxRequests,
    resetTime: existing.resetTime,
    isRateLimited,
    retryAfterSeconds: isRateLimited
      ? Math.ceil((existing.resetTime - now) / 1000)
      : 0,
  }
}

// Utility to get identifier from context (IP-based for HTTP, session-based for others)
export function getIdentifier(
  type: string,
  sessionId?: string,
  ip?: string,
): string {
  if (ip) return `${type}:${ip}`
  if (sessionId) return `${type}:${sessionId}`
  return `${type}:anonymous`
}

// Input validation utilities
export const INPUT_LIMITS = {
  message: {
    maxLength: 4000,
    minLength: 1,
  },
  name: {
    maxLength: 100,
    minLength: 2,
  },
  email: {
    maxLength: 255,
  },
  phone: {
    maxLength: 20,
  },
  organizationId: {
    maxLength: 100,
  },
} as const

export function validateInputLength(
  value: string,
  field: keyof typeof INPUT_LIMITS,
): boolean {
  const limits = INPUT_LIMITS[field]
  if ("minLength" in limits && value.length < limits.minLength) {
    return false
  }
  if (value.length > limits.maxLength) {
    return false
  }
  return true
}

export function sanitizeInput(value: string): string {
  // Basic XSS prevention - remove script tags and dangerous attributes
  return value
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/on\w+\s*=/gi, "")
    .trim()
}
