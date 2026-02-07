import { httpRouter } from "convex/server"
import { httpAction, ActionCtx } from "./_generated/server"
import { Webhook } from "svix"
import { createClerkClient } from "@clerk/backend"
import type { WebhookEvent } from "@clerk/backend"
import { internal } from "./_generated/api"
import { checkRateLimit, RATE_LIMITS, getIdentifier } from "./lib/rateLimit"
import type { ApiPermission } from "./private/apiKeys"
import type { DataModel } from "./_generated/dataModel"
import type { GenericActionCtx } from "convex/server"

// Type for HTTP action context
type HttpActionCtx = GenericActionCtx<DataModel>

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY || "",
})

const http = httpRouter()

// =============================================================================
// Helper functions for REST API
// =============================================================================

/**
 * Hash an API key using SHA-256
 */
async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(key)
  const hashBuffer = await crypto.subtle.digest("SHA-256", data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")
}

/**
 * Standard JSON response helper
 */
function jsonResponse(
  data: unknown,
  status: number = 200,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  })
}

/**
 * Error response helper
 */
function errorResponse(
  code: string,
  message: string,
  status: number,
  details?: unknown,
): Response {
  const errorBody: { code: string; message: string; details?: unknown } = {
    code,
    message,
  }
  if (details !== undefined) {
    errorBody.details = details
  }
  return jsonResponse({ error: errorBody }, status)
}

/**
 * Authenticate API request using Bearer token
 */
async function authenticateApiRequest(
  ctx: HttpActionCtx,
  req: Request,
  requiredPermission: ApiPermission,
): Promise<
  { valid: true; organizationId: string } | { valid: false; error: Response }
> {
  const authHeader = req.headers.get("Authorization")

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return {
      valid: false,
      error: errorResponse(
        "UNAUTHORIZED",
        "Missing or invalid Authorization header. Use: Authorization: Bearer <api_key>",
        401,
      ),
    }
  }

  const apiKey = authHeader.substring(7) // Remove "Bearer "

  // Validate key format
  if (!apiKey.startsWith("verto_pk_")) {
    return {
      valid: false,
      error: errorResponse("UNAUTHORIZED", "Invalid API key format", 401),
    }
  }

  const keyHash = await hashApiKey(apiKey)
  const result = await ctx.runQuery(internal.private.apiKeys.validateKey, {
    keyHash,
  })

  if (!result.valid || !result.organizationId || !result.permissions) {
    return {
      valid: false,
      error: errorResponse("UNAUTHORIZED", "Invalid or expired API key", 401),
    }
  }

  // Check permission
  if (!result.permissions.includes(requiredPermission)) {
    return {
      valid: false,
      error: errorResponse(
        "FORBIDDEN",
        `API key does not have '${requiredPermission}' permission`,
        403,
      ),
    }
  }

  // Update last used timestamp (fire and forget)
  if (result.keyId) {
    ctx
      .runMutation(internal.private.apiKeys.updateLastUsed, {
        keyId: result.keyId,
      })
      .catch(() => {}) // Ignore errors
  }

  return { valid: true, organizationId: result.organizationId }
}

// =============================================================================
// Clerk Webhook (existing)
// =============================================================================

http.route({
  path: "/clerk-webhook",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    // Rate limiting for webhook
    const ip =
      req.headers.get("x-forwarded-for") ||
      req.headers.get("x-real-ip") ||
      "unknown"
    const rateLimitResult = checkRateLimit(
      getIdentifier("webhook", undefined, ip),
      RATE_LIMITS.webhook,
    )

    if (!rateLimitResult.allowed) {
      return new Response(
        JSON.stringify({
          error: "Too many requests",
          retryAfter: Math.ceil(
            (rateLimitResult.resetTime - Date.now()) / 1000,
          ),
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": String(
              Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000),
            ),
          },
        },
      )
    }

    const event = await validateRequest(req)
    if (!event) {
      return new Response("Invalid request", { status: 400 })
    }

    switch (event.type) {
      case "subscription.updated":
        const subscription = event.data as {
          status: string
          payer?: {
            organization_id: string
          }
        }

        const organizationId = subscription.payer?.organization_id
        if (!organizationId) {
          return new Response("No organization ID", { status: 400 })
        }

        const maxAllowedMemberships = subscription.status === "active" ? 5 : 1

        await clerkClient.organizations.updateOrganization(organizationId, {
          maxAllowedMemberships: maxAllowedMemberships,
        })

        await ctx.runMutation(internal.system.subscriptions.upsert, {
          organizationId,
          status: subscription.status,
        })

        break
      default:
        console.log("Ignored Clerk Webhook event:", event.type)
    }

    return new Response(null, { status: 200 })
  }),
})

// =============================================================================
// REST API Endpoints
// =============================================================================

// GET /api/v1/conversations - List conversations
http.route({
  path: "/api/v1/conversations",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    const auth = await authenticateApiRequest(ctx, req, "conversations:read")
    if (!auth.valid) return auth.error

    const url = new URL(req.url)
    const status = url.searchParams.get("status") as
      | "unresolved"
      | "escalated"
      | "resolved"
      | null
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 100)
    const cursor = url.searchParams.get("cursor") || undefined

    try {
      const result = await ctx.runQuery(internal.system.api.listConversations, {
        organizationId: auth.organizationId,
        status: status || undefined,
        limit,
        cursor,
      })

      return jsonResponse({
        data: result.conversations,
        pagination: {
          hasMore: result.hasMore,
          nextCursor: result.nextCursor,
        },
      })
    } catch (error) {
      console.error("API Error listing conversations:", error)
      return errorResponse(
        "INTERNAL_ERROR",
        "Failed to list conversations",
        500,
      )
    }
  }),
})

// GET /api/v1/conversations/:id - Get a single conversation
http.route({
  path: "/api/v1/conversations/:id",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    const auth = await authenticateApiRequest(ctx, req, "conversations:read")
    if (!auth.valid) return auth.error

    // Extract conversation ID from URL
    const url = new URL(req.url)
    const pathParts = url.pathname.split("/")
    const conversationId = pathParts[pathParts.length - 1]

    if (!conversationId) {
      return errorResponse("BAD_REQUEST", "Conversation ID is required", 400)
    }

    try {
      const conversation = await ctx.runQuery(
        internal.system.api.getConversation,
        {
          organizationId: auth.organizationId,
          conversationId,
        },
      )

      if (!conversation) {
        return errorResponse("NOT_FOUND", "Conversation not found", 404)
      }

      return jsonResponse({ data: conversation })
    } catch (error) {
      console.error("API Error getting conversation:", error)
      return errorResponse("INTERNAL_ERROR", "Failed to get conversation", 500)
    }
  }),
})

// GET /api/v1/conversations/:id/messages - Get messages for a conversation
http.route({
  path: "/api/v1/conversations/:id/messages",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    const auth = await authenticateApiRequest(ctx, req, "messages:read")
    if (!auth.valid) return auth.error

    // Extract conversation ID from URL
    const url = new URL(req.url)
    const pathParts = url.pathname.split("/")
    const conversationId = pathParts[pathParts.length - 2]

    if (!conversationId) {
      return errorResponse("BAD_REQUEST", "Conversation ID is required", 400)
    }

    const limit = Math.min(
      parseInt(url.searchParams.get("limit") || "100"),
      500,
    )

    try {
      const messages = await ctx.runQuery(internal.system.api.getMessages, {
        organizationId: auth.organizationId,
        conversationId,
        limit,
      })

      return jsonResponse({ data: messages })
    } catch (error) {
      console.error("API Error getting messages:", error)
      return errorResponse("INTERNAL_ERROR", "Failed to get messages", 500)
    }
  }),
})

// POST /api/v1/conversations/:id/messages - Send a message to a conversation
http.route({
  path: "/api/v1/conversations/:id/messages",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const auth = await authenticateApiRequest(ctx, req, "messages:write")
    if (!auth.valid) return auth.error

    // Extract conversation ID from URL
    const url = new URL(req.url)
    const pathParts = url.pathname.split("/")
    const conversationId = pathParts[pathParts.length - 2]

    if (!conversationId) {
      return errorResponse("BAD_REQUEST", "Conversation ID is required", 400)
    }

    let body: { message: string; role?: "assistant" | "operator" }
    try {
      body = await req.json()
    } catch {
      return errorResponse("BAD_REQUEST", "Invalid JSON body", 400)
    }

    if (!body.message || typeof body.message !== "string") {
      return errorResponse("BAD_REQUEST", "Message content is required", 400)
    }

    if (body.message.length > 4000) {
      return errorResponse(
        "BAD_REQUEST",
        "Message too long (max 4000 characters)",
        400,
      )
    }

    try {
      const result = await ctx.runMutation(internal.system.api.sendMessage, {
        organizationId: auth.organizationId,
        conversationId,
        message: body.message,
        role: body.role || "operator",
      })

      return jsonResponse({ data: result }, 201)
    } catch (error) {
      console.error("API Error sending message:", error)
      return errorResponse("INTERNAL_ERROR", "Failed to send message", 500)
    }
  }),
})

// PATCH /api/v1/conversations/:id - Update conversation (status, tags, etc.)
http.route({
  path: "/api/v1/conversations/:id",
  method: "PATCH",
  handler: httpAction(async (ctx, req) => {
    const auth = await authenticateApiRequest(ctx, req, "conversations:write")
    if (!auth.valid) return auth.error

    // Extract conversation ID from URL
    const url = new URL(req.url)
    const pathParts = url.pathname.split("/")
    const conversationId = pathParts[pathParts.length - 1]

    if (!conversationId) {
      return errorResponse("BAD_REQUEST", "Conversation ID is required", 400)
    }

    let body: {
      status?: "unresolved" | "escalated" | "resolved"
      tags?: string[]
      priority?: "low" | "medium" | "high"
      assignedTo?: string | null
    }
    try {
      body = await req.json()
    } catch {
      return errorResponse("BAD_REQUEST", "Invalid JSON body", 400)
    }

    try {
      const result = await ctx.runMutation(
        internal.system.api.updateConversation,
        {
          organizationId: auth.organizationId,
          conversationId,
          ...body,
        },
      )

      return jsonResponse({ data: result })
    } catch (error) {
      console.error("API Error updating conversation:", error)
      return errorResponse(
        "INTERNAL_ERROR",
        "Failed to update conversation",
        500,
      )
    }
  }),
})

// GET /api/v1/analytics - Get analytics data
http.route({
  path: "/api/v1/analytics",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    const auth = await authenticateApiRequest(ctx, req, "analytics:read")
    if (!auth.valid) return auth.error

    const url = new URL(req.url)
    const period =
      (url.searchParams.get("period") as "24h" | "7d" | "30d") || "7d"

    try {
      const analytics = await ctx.runQuery(internal.system.api.getAnalytics, {
        organizationId: auth.organizationId,
        period,
      })

      return jsonResponse({ data: analytics })
    } catch (error) {
      console.error("API Error getting analytics:", error)
      return errorResponse("INTERNAL_ERROR", "Failed to get analytics", 500)
    }
  }),
})

// GET /api/v1/contacts - List contacts (contact sessions)
http.route({
  path: "/api/v1/contacts",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    const auth = await authenticateApiRequest(ctx, req, "contacts:read")
    if (!auth.valid) return auth.error

    const url = new URL(req.url)
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 100)

    try {
      const contacts = await ctx.runQuery(internal.system.api.listContacts, {
        organizationId: auth.organizationId,
        limit,
      })

      return jsonResponse({ data: contacts })
    } catch (error) {
      console.error("API Error listing contacts:", error)
      return errorResponse("INTERNAL_ERROR", "Failed to list contacts", 500)
    }
  }),
})

// =============================================================================
// Webhook validation helper (existing)
// =============================================================================

async function validateRequest(req: Request): Promise<WebhookEvent | null> {
  const payloadString = await req.text()
  const svixHeaders = {
    "svix-id": req.headers.get("svix-id") || "",
    "svix-timestamp": req.headers.get("svix-timestamp") || "",
    "svix-signature": req.headers.get("svix-signature") || "",
  }

  const wh = new Webhook(process.env.CLERK_WEBHOOK_SECRET || "")

  try {
    return wh.verify(payloadString, svixHeaders) as unknown as WebhookEvent
  } catch (error) {
    console.error("Error validating webhook:", error)
    return null
  }
}

export default http
