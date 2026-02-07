import {
  mutation,
  query,
  internalMutation,
  internalQuery,
} from "../_generated/server"
import { ConvexError, v } from "convex/values"
import { Doc, Id } from "../_generated/dataModel"

// Permission types
export const API_PERMISSIONS = [
  "conversations:read",
  "conversations:write",
  "messages:read",
  "messages:write",
  "analytics:read",
  "contacts:read",
  "contacts:write",
] as const

export type ApiPermission = (typeof API_PERMISSIONS)[number]

/**
 * Generate a cryptographically secure API key
 * Format: verto_pk_<32 random chars>
 */
function generateApiKey(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
  let result = "verto_pk_"
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

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
 * Create a new API key for the organization
 */
export const create = mutation({
  args: {
    name: v.string(),
    permissions: v.array(
      v.union(
        v.literal("conversations:read"),
        v.literal("conversations:write"),
        v.literal("messages:read"),
        v.literal("messages:write"),
        v.literal("analytics:read"),
        v.literal("contacts:read"),
        v.literal("contacts:write"),
      ),
    ),
    expiresAt: v.optional(v.number()),
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

    // Validate name
    if (!args.name || args.name.trim().length === 0) {
      throw new ConvexError({
        code: "INVALID_INPUT",
        message: "API key name is required",
      })
    }

    if (args.name.length > 100) {
      throw new ConvexError({
        code: "INVALID_INPUT",
        message: "API key name is too long (max 100 characters)",
      })
    }

    // Validate permissions
    if (args.permissions.length === 0) {
      throw new ConvexError({
        code: "INVALID_INPUT",
        message: "At least one permission is required",
      })
    }

    // Generate the API key
    const apiKey = generateApiKey()
    const keyHash = await hashApiKey(apiKey)
    const keyPrefix = apiKey.substring(0, 12) // "verto_pk_xxx"

    // Create the API key record
    await ctx.db.insert("apiKeys", {
      organizationId: orgId,
      name: args.name.trim(),
      keyHash,
      keyPrefix,
      permissions: args.permissions,
      expiresAt: args.expiresAt,
      isActive: true,
      createdBy: identity.subject,
      createdAt: Date.now(),
    })

    // Return the full API key (only shown once!)
    return {
      key: apiKey,
      prefix: keyPrefix,
    }
  },
})

/**
 * List all API keys for the organization
 */
export const list = query({
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

    const keys = await ctx.db
      .query("apiKeys")
      .withIndex("by_organization_id", (q) => q.eq("organizationId", orgId))
      .collect()

    // Never return the keyHash, only metadata
    return keys.map((key) => ({
      _id: key._id,
      name: key.name,
      keyPrefix: key.keyPrefix,
      permissions: key.permissions,
      lastUsedAt: key.lastUsedAt,
      expiresAt: key.expiresAt,
      isActive: key.isActive,
      createdAt: key.createdAt,
      revokedAt: key.revokedAt,
    }))
  },
})

/**
 * Revoke an API key
 */
export const revoke = mutation({
  args: {
    keyId: v.id("apiKeys"),
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

    const key = await ctx.db.get(args.keyId)
    if (!key) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "API key not found",
      })
    }

    if (key.organizationId !== orgId) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "Not authorized to revoke this key",
      })
    }

    await ctx.db.patch(args.keyId, {
      isActive: false,
      revokedAt: Date.now(),
    })

    return { success: true }
  },
})

/**
 * Delete an API key permanently
 */
export const deleteKey = mutation({
  args: {
    keyId: v.id("apiKeys"),
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

    const key = await ctx.db.get(args.keyId)
    if (!key) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "API key not found",
      })
    }

    if (key.organizationId !== orgId) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "Not authorized to delete this key",
      })
    }

    await ctx.db.delete(args.keyId)
    return { success: true }
  },
})

/**
 * Internal: Validate an API key and return the organization and permissions
 */
export const validateKey = internalQuery({
  args: {
    keyHash: v.string(),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    valid: boolean
    organizationId?: string
    permissions?: ApiPermission[]
    keyId?: Id<"apiKeys">
  }> => {
    const key = await ctx.db
      .query("apiKeys")
      .withIndex("by_key_hash", (q) => q.eq("keyHash", args.keyHash))
      .unique()

    if (!key) {
      return { valid: false }
    }

    // Check if key is active
    if (!key.isActive) {
      return { valid: false }
    }

    // Check if key is expired
    if (key.expiresAt && key.expiresAt < Date.now()) {
      return { valid: false }
    }

    return {
      valid: true,
      organizationId: key.organizationId,
      permissions: key.permissions as ApiPermission[],
      keyId: key._id,
    }
  },
})

/**
 * Internal: Update last used timestamp for an API key
 */
export const updateLastUsed = internalMutation({
  args: {
    keyId: v.id("apiKeys"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.keyId, {
      lastUsedAt: Date.now(),
    })
  },
})
